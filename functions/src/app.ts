import crypto from "node:crypto";

import { getRequestListener } from "@hono/node-server";
import type { Context, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { Hono } from "hono";
import { cors } from "hono/cors";

import {
  activePingCutoffIso,
  buildCoAttendancePeer,
  chunk,
  docToAttendance,
  docToConference,
  docToPing,
  docToUser,
  incomingPingResponse,
  mutualContact,
  nowIso,
  outgoingPingResponse,
  randomAvatarId,
  resolvePingIndicator,
  toAttendee
} from "./model.js";
import type { AuthContext } from "./model.js";
import { adminAuth, adminDb } from "./firebase.js";
import { IS_PRODUCTION, PING_DECAY_DAYS } from "./config.js";
import { attendanceSchema, conferenceInputSchema, devSessionSchema, mePatchSchema, sharedConferenceSchema } from "../../shared/validation.js";
import type { ConferenceRecord, PingRecord, UserRecord } from "../../shared/domain.js";

type Variables = {
  auth: AuthContext | null;
};

const rootApp = new Hono<{ Variables: Variables }>();
const innerApp = new Hono<{ Variables: Variables }>();

rootApp.use("*", cors({
  origin: "*",
  allowHeaders: ["Authorization", "Content-Type"],
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
}));

rootApp.use("*", async (c, next) => {
  const token = extractBearer(c.req.header("Authorization"));
  if (!token) {
    c.set("auth", null);
    return next();
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const auth = {
      uid: decoded.uid,
      email: decoded.email ?? null,
      isAdmin: decoded.admin === true,
      rawToken: token
    };
    await ensureUserDoc(auth);
    c.set("auth", auth);
    return next();
  } catch {
    c.set("auth", null);
    return next();
  }
});

rootApp.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }
  console.error(error);
  return c.json({ error: "Internal server error" }, 500);
});

innerApp.get("/health", async (c) => {
  const snapshot = await adminDb.collection("conferences").count().get();
  return c.json({
    ok: true,
    conferenceCount: snapshot.data().count,
    database: "firestore"
  });
});

innerApp.post("/auth/dev-session", async (c) => {
  if (IS_PRODUCTION) {
    throw new HTTPException(404, { message: "Not found" });
  }
  const body = devSessionSchema.parse(await c.req.json());
  await ensureUserDoc({
    uid: body.userId,
    email: null,
    isAdmin: false,
    rawToken: ""
  });
  const customToken = await adminAuth.createCustomToken(body.userId);
  const userDoc = await adminDb.collection("users").doc(body.userId).get();
  return c.json({
    customToken,
    user: userDoc.exists ? { ...docToUser(userDoc as never), isAdmin: false } : null
  });
});

innerApp.get("/conferences", async (c) => {
  const q = c.req.query("q")?.trim().toLowerCase() ?? "";
  const bboxParam = c.req.query("bbox");
  const bbox = bboxParam ? parseBoundingBox(bboxParam) : null;

  const snapshot = await adminDb.collection("conferences").get();
  let conferences = snapshot.docs.map(docToConference);

  if (bbox) {
    conferences = conferences.filter((conference) =>
      conference.longitude >= bbox.minLng &&
      conference.longitude <= bbox.maxLng &&
      conference.latitude >= bbox.minLat &&
      conference.latitude <= bbox.maxLat
    );
  }

  conferences.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  if (q) {
    conferences = conferences
      .filter((conference) => {
        const haystack = `${conference.name} ${conference.locationName} ${(conference.topics ?? []).join(" ")}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 500);
  } else {
    conferences = conferences.slice(0, 2000);
  }

  return c.json({ conferences });
});

innerApp.post("/conferences", requireAdmin(), async (c) => {
  const auth = mustAuth(c);
  const body = conferenceInputSchema.parse(await c.req.json());
  const id = `uc_${crypto.createHash("sha256").update(`${body.name.toLowerCase()}|${body.startDate}|${auth.uid}`).digest("hex").slice(0, 16)}`;
  const createdAt = nowIso();

  await adminDb.collection("conferences").doc(id).set({
    name: body.name,
    location_name: body.locationName,
    latitude: body.latitude,
    longitude: body.longitude,
    start_date: body.startDate,
    end_date: body.endDate,
    topics: body.topics ?? [],
    url: body.url ?? null,
    created_at: createdAt
  });

  return c.json({
    conference: {
      id,
      ...body,
      createdAt
    }
  }, 201);
});

innerApp.get("/conferences/:id", async (c) => {
  const snapshot = await adminDb.collection("conferences").doc(c.req.param("id")).get();
  if (!snapshot.exists) {
    throw new HTTPException(404, { message: "Conference not found" });
  }
  return c.json({ conference: docToConference(snapshot as never) });
});

innerApp.get("/conferences/:id/attendees", async (c) => {
  const conferenceId = c.req.param("id");
  const attendanceSnapshot = await adminDb.collection("attendances")
    .where("conference_id", "==", conferenceId)
    .get();

  const attendances = attendanceSnapshot.docs.map(docToAttendance);
  const users = await getUsersByIds(attendances.map((attendance) => attendance.userId));
  const auth = c.get("auth");
  const pingState = auth ? await getPingRelationshipMaps(auth.uid, users.map((user) => user.id)) : emptyPingMaps();

  const attendees = attendances
    .map((attendance) => {
      const user = users.find((candidate) => candidate.id === attendance.userId);
      if (!user) {
        return null;
      }
      return toAttendee(
        user,
        attendance.intent,
        pingState.outgoing.has(user.id),
        pingState.incoming.has(user.id)
      );
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  return c.json({ attendees });
});

innerApp.post("/conferences/:id/attend", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const conferenceId = c.req.param("id");
  const body = attendanceSchema.parse(await c.req.json());

  await upsertAttendance(auth.uid, conferenceId, body.intent);
  return c.json({ ok: true });
});

innerApp.delete("/conferences/:id/attend", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  await deleteAttendance(auth.uid, c.req.param("id"));
  return c.json({ ok: true });
});

innerApp.get("/me", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const user = await getUserById(auth.uid);
  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }
  return c.json({
    id: user.id,
    avatarId: user.avatarId,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    isAdmin: auth.isAdmin
  });
});

innerApp.patch("/me", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const body = mePatchSchema.parse(await c.req.json());
  const updates: Record<string, unknown> = {};

  if ("avatarId" in body) {
    updates.avatar_id = body.avatarId;
  }
  if ("displayName" in body) {
    updates.display_name = body.displayName?.trim() || null;
  }
  if ("photoURL" in body) {
    updates.photo_url = body.photoURL;
  }

  if (Object.keys(updates).length) {
    await adminDb.collection("users").doc(auth.uid).set(updates, { merge: true });
  }

  const user = await getUserById(auth.uid);
  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }
  return c.json({
    id: user.id,
    avatarId: user.avatarId,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    isAdmin: auth.isAdmin
  });
});

innerApp.get("/me/attendances", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const snapshot = await adminDb.collection("attendances")
    .where("user_id", "==", auth.uid)
    .get();

  return c.json({
    attendances: snapshot.docs.map(docToAttendance).map((attendance) => ({
      conferenceId: attendance.conferenceId,
      intent: attendance.intent
    }))
  });
});

innerApp.get("/me/co-attendance", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const peers = await computeCoAttendance(auth.uid);
  return c.json({ peers });
});

innerApp.get("/users/search", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const query = (c.req.query("q") ?? "").trim().toLowerCase();
  if (!query) {
    return c.json({ users: [] });
  }

  const snapshot = await adminDb.collection("users").limit(500).get();
  const users = snapshot.docs
    .map(docToUser)
    .filter((user) => user.id !== auth.uid)
    .filter((user) => (user.displayName ?? "").toLowerCase().includes(query))
    .sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? ""))
    .slice(0, 20)
    .map(({ id, avatarId, displayName, photoURL }) => ({ id, avatarId, displayName, photoURL }));

  return c.json({ users });
});

innerApp.get("/users/:userId/profile", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const peerId = c.req.param("userId");
  const [user, peerConferenceIds, myConferenceIds] = await Promise.all([
    getUserById(peerId),
    getConferenceIdsForUser(peerId),
    getConferenceIdsForUser(auth.uid)
  ]);

  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }

  const conferenceIds = Array.from(new Set(peerConferenceIds));
  const sharedIds = conferenceIds.filter((conferenceId) => myConferenceIds.includes(conferenceId));
  const conferences = await getConferencesByIds(conferenceIds);
  const shared = conferences.filter((conference) => sharedIds.includes(conference.id));

  return c.json({
    user: { id: user.id, avatarId: user.avatarId, displayName: user.displayName, photoURL: user.photoURL },
    conferences,
    shared
  });
});

innerApp.get("/users/:peerId/shared-map", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const shared = await getSharedConferences(auth.uid, c.req.param("peerId"));
  return c.json({ conferences: shared });
});

innerApp.post("/users/shared-conferences", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const body = sharedConferenceSchema.parse(await c.req.json());
  const allUserIds = Array.from(new Set([auth.uid, ...body.userIds]));
  const conferenceIdSets = await Promise.all(allUserIds.map((userId) => getConferenceIdsForUser(userId)));
  const sharedIds = conferenceIdSets.reduce<string[]>((intersection, current, index) => {
    if (index === 0) {
      return current;
    }
    return intersection.filter((conferenceId) => current.includes(conferenceId));
  }, []);
  const conferences = await getConferencesByIds(sharedIds);
  return c.json({ conferences });
});

innerApp.post("/users/:targetId/ping", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const targetId = c.req.param("targetId");
  if (targetId === auth.uid) {
    throw new HTTPException(400, { message: "Cannot ping yourself" });
  }
  await upsertPing(auth.uid, targetId);
  return c.json({ ok: true });
});

innerApp.get("/pings/incoming", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const incoming = await getIncomingPings(auth.uid);
  return c.json({ incoming });
});

innerApp.get("/pings/outgoing", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const outgoing = await getOutgoingPings(auth.uid);
  return c.json({ outgoing });
});

innerApp.post("/pings/:pingId/ping-back", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const ping = await getPingById(c.req.param("pingId"));
  if (!ping || ping.toUserId !== auth.uid) {
    throw new HTTPException(404, { message: "Ping not found" });
  }
  await upsertPing(auth.uid, ping.fromUserId);
  return c.json({ ok: true });
});

innerApp.post("/pings/:pingId/reject", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const ping = await getPingById(c.req.param("pingId"));
  if (!ping || ping.toUserId !== auth.uid) {
    throw new HTTPException(404, { message: "Ping not found" });
  }
  await adminDb.collection("pings").doc(ping.id).set({ rejected_at: nowIso() }, { merge: true });
  return c.json({ ok: true });
});

innerApp.post("/pings/:pingId/revoke", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const ping = await getPingById(c.req.param("pingId"));
  if (!ping || ping.fromUserId !== auth.uid) {
    throw new HTTPException(404, { message: "Ping not found" });
  }
  await adminDb.collection("pings").doc(ping.id).delete();
  return c.json({ ok: true });
});

innerApp.post("/pings/dematch/:peerId", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const peerId = c.req.param("peerId");
  await adminDb.runTransaction(async (transaction) => {
    const forward = adminDb.collection("pings")
      .where("from_user_id", "==", auth.uid)
      .where("to_user_id", "==", peerId)
      .limit(1);
    const reverse = adminDb.collection("pings")
      .where("from_user_id", "==", peerId)
      .where("to_user_id", "==", auth.uid)
      .limit(1);
    const [forwardSnapshot, reverseSnapshot] = await Promise.all([
      transaction.get(forward),
      transaction.get(reverse)
    ]);
    for (const doc of [...forwardSnapshot.docs, ...reverseSnapshot.docs]) {
      transaction.delete(doc.ref);
    }
  });
  return c.json({ ok: true });
});

innerApp.get("/pings/mutual-contacts", requireAuth(), async (c) => {
  const auth = mustAuth(c);
  const contacts = await getMutualContacts(auth.uid);
  return c.json({ contacts });
});

rootApp.route("/", innerApp);
rootApp.route("/api", innerApp);

export const requestListener = getRequestListener(rootApp.fetch);

function extractBearer(header?: string): string | null {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}

type AppContext = Context<{ Variables: Variables }>;

function mustAuth(c: AppContext): AuthContext {
  const auth = c.get("auth");
  if (!auth) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  return auth;
}

function requireAuth(): MiddlewareHandler<{ Variables: Variables }> {
  return async (c, next) => {
    if (!c.get("auth")) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    return next();
  };
}

function requireAdmin(): MiddlewareHandler<{ Variables: Variables }> {
  return async (c, next) => {
    const auth = c.get("auth");
    if (!auth) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    if (!auth.isAdmin) {
      throw new HTTPException(403, { message: "Forbidden" });
    }
    return next();
  };
}

async function ensureUserDoc(auth: AuthContext): Promise<void> {
  const ref = adminDb.collection("users").doc(auth.uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    await ref.set({
      avatar_id: randomAvatarId(auth.uid),
      email: auth.email,
      display_name: null,
      photo_url: null,
      created_at: nowIso()
    });
    return;
  }

  const data = snapshot.data() ?? {};
  if ((data.email ?? null) !== auth.email) {
    await ref.set({ email: auth.email }, { merge: true });
  }
}

function parseBoundingBox(value: string): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
  const parts = value.split(",").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  return {
    minLng: parts[0]!,
    minLat: parts[1]!,
    maxLng: parts[2]!,
    maxLat: parts[3]!
  };
}

async function getUserById(userId: string): Promise<UserRecord | null> {
  const snapshot = await adminDb.collection("users").doc(userId).get();
  return snapshot.exists ? docToUser(snapshot as never) : null;
}

async function getUsersByIds(userIds: string[]): Promise<UserRecord[]> {
  const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
  if (!uniqueIds.length) {
    return [];
  }
  const snapshots = await Promise.all(uniqueIds.map((userId) => adminDb.collection("users").doc(userId).get()));
  return snapshots.filter((snapshot) => snapshot.exists).map((snapshot) => docToUser(snapshot as never));
}

async function getConferencesByIds(conferenceIds: string[]): Promise<ConferenceRecord[]> {
  const uniqueIds = Array.from(new Set(conferenceIds)).filter(Boolean);
  if (!uniqueIds.length) {
    return [];
  }
  const snapshots = await Promise.all(uniqueIds.map((conferenceId) => adminDb.collection("conferences").doc(conferenceId).get()));
  return snapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => docToConference(snapshot as never))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

async function getConferenceIdsForUser(userId: string): Promise<string[]> {
  const snapshot = await adminDb.collection("attendances")
    .where("user_id", "==", userId)
    .get();
  return snapshot.docs.map(docToAttendance).map((attendance) => attendance.conferenceId);
}

async function upsertAttendance(userId: string, conferenceId: string, intent: "been" | "going"): Promise<void> {
  await adminDb.runTransaction(async (transaction) => {
    const query = adminDb.collection("attendances")
      .where("user_id", "==", userId)
      .where("conference_id", "==", conferenceId)
      .limit(1);
    const existing = await transaction.get(query);
    if (!existing.empty) {
      transaction.update(existing.docs[0]!.ref, { intent });
      return;
    }
    const ref = adminDb.collection("attendances").doc();
    transaction.set(ref, {
      user_id: userId,
      conference_id: conferenceId,
      intent,
      created_at: nowIso()
    });
  });
}

async function deleteAttendance(userId: string, conferenceId: string): Promise<void> {
  await adminDb.runTransaction(async (transaction) => {
    const query = adminDb.collection("attendances")
      .where("user_id", "==", userId)
      .where("conference_id", "==", conferenceId)
      .limit(1);
    const existing = await transaction.get(query);
    if (existing.empty) {
      return;
    }
    transaction.delete(existing.docs[0]!.ref);
  });
}

async function computeCoAttendance(userId: string) {
  const myConferenceIds = await getConferenceIdsForUser(userId);
  if (!myConferenceIds.length) {
    return [];
  }

  const sharedByUser = new Map<string, Set<string>>();
  for (const group of chunk(myConferenceIds, 30)) {
    const snapshot = await adminDb.collection("attendances")
      .where("conference_id", "in", group)
      .get();

    for (const attendance of snapshot.docs.map(docToAttendance)) {
      if (attendance.userId === userId) {
        continue;
      }
      const current = sharedByUser.get(attendance.userId) ?? new Set<string>();
      current.add(attendance.conferenceId);
      sharedByUser.set(attendance.userId, current);
    }
  }

  const peerIds = Array.from(sharedByUser.keys());
  const [users, conferences, pingState] = await Promise.all([
    getUsersByIds(peerIds),
    getConferencesByIds(myConferenceIds),
    getPingRelationshipMaps(userId, peerIds)
  ]);

  const conferenceMap = new Map(conferences.map((conference) => [conference.id, conference]));
  return users
    .map((user) => {
      const sharedConferenceIds = Array.from(sharedByUser.get(user.id) ?? []);
      const pingIndicator = resolvePingIndicator({
        outgoing: pingState.outgoing.has(user.id),
        outgoingRejected: pingState.rejectedOutgoing.has(user.id),
        incoming: pingState.incoming.has(user.id)
      });
      return buildCoAttendancePeer(user, sharedConferenceIds, conferenceMap, pingIndicator);
    })
    .sort((a, b) => b.sharedCount - a.sharedCount);
}

async function getSharedConferences(userId: string, peerId: string): Promise<ConferenceRecord[]> {
  const [mine, peer] = await Promise.all([
    getConferenceIdsForUser(userId),
    getConferenceIdsForUser(peerId)
  ]);
  const sharedIds = mine.filter((conferenceId) => peer.includes(conferenceId));
  return getConferencesByIds(sharedIds);
}

async function upsertPing(fromUserId: string, toUserId: string): Promise<void> {
  await adminDb.runTransaction(async (transaction) => {
    const query = adminDb.collection("pings")
      .where("from_user_id", "==", fromUserId)
      .where("to_user_id", "==", toUserId)
      .limit(1);
    const existing = await transaction.get(query);
    if (!existing.empty) {
      transaction.update(existing.docs[0]!.ref, {
        created_at: nowIso(),
        rejected_at: null
      });
      return;
    }
    transaction.set(adminDb.collection("pings").doc(), {
      from_user_id: fromUserId,
      to_user_id: toUserId,
      created_at: nowIso(),
      rejected_at: null
    });
  });
}

async function getPingById(pingId: string): Promise<PingRecord | null> {
  const snapshot = await adminDb.collection("pings").doc(pingId).get();
  return snapshot.exists ? docToPing(snapshot as never) : null;
}

function emptyPingMaps() {
  return {
    outgoing: new Set<string>(),
    rejectedOutgoing: new Set<string>(),
    incoming: new Set<string>()
  };
}

async function getPingRelationshipMaps(userId: string, peerIds: string[]) {
  const state = emptyPingMaps();
  if (!peerIds.length) {
    return state;
  }

  const cutoff = activePingCutoffIso(PING_DECAY_DAYS);
  const peerSet = new Set(peerIds);
  const [outgoingSnapshots, incomingSnapshots] = await Promise.all([
    adminDb.collection("pings")
      .where("from_user_id", "==", userId)
      .get(),
    adminDb.collection("pings")
      .where("to_user_id", "==", userId)
      .where("rejected_at", "==", null)
      .get()
  ]);

  for (const ping of outgoingSnapshots.docs.map(docToPing)) {
    if (ping.createdAt < cutoff || !peerSet.has(ping.toUserId)) {
      continue;
    }
    state.outgoing.add(ping.toUserId);
    if (ping.rejectedAt) {
      state.rejectedOutgoing.add(ping.toUserId);
    }
  }

  for (const ping of incomingSnapshots.docs.map(docToPing)) {
    if (ping.createdAt < cutoff || !peerSet.has(ping.fromUserId)) {
      continue;
    }
    state.incoming.add(ping.fromUserId);
  }

  return state;
}

async function getIncomingPings(userId: string) {
  const cutoff = activePingCutoffIso(PING_DECAY_DAYS);
  const incomingSnapshot = await adminDb.collection("pings")
    .where("to_user_id", "==", userId)
    .where("rejected_at", "==", null)
    .orderBy("created_at", "desc")
    .get();
  const incoming = incomingSnapshot.docs
    .map(docToPing)
    .filter((ping) => ping.createdAt >= cutoff);
  const outgoingMap = await getPingRelationshipMaps(userId, incoming.map((ping) => ping.fromUserId));
  const filtered = incoming.filter((ping) => !outgoingMap.outgoing.has(ping.fromUserId) || outgoingMap.rejectedOutgoing.has(ping.fromUserId));
  const users = await getUsersByIds(filtered.map((ping) => ping.fromUserId));
  return filtered
    .map((ping) => {
      const user = users.find((candidate) => candidate.id === ping.fromUserId);
      return user ? incomingPingResponse(user, ping) : null;
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
}

async function getOutgoingPings(userId: string) {
  const cutoff = activePingCutoffIso(PING_DECAY_DAYS);
  const outgoingSnapshot = await adminDb.collection("pings")
    .where("from_user_id", "==", userId)
    .orderBy("created_at", "desc")
    .get();
  const outgoing = outgoingSnapshot.docs
    .map(docToPing)
    .filter((ping) => ping.createdAt >= cutoff);
  const incomingMap = await getPingRelationshipMaps(userId, outgoing.map((ping) => ping.toUserId));
  const filtered = outgoing.filter((ping) => !incomingMap.incoming.has(ping.toUserId) || incomingMap.rejectedOutgoing.has(ping.toUserId));
  const users = await getUsersByIds(filtered.map((ping) => ping.toUserId));
  return filtered
    .map((ping) => {
      const user = users.find((candidate) => candidate.id === ping.toUserId);
      return user ? outgoingPingResponse(user, ping) : null;
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
}

async function getMutualContacts(userId: string) {
  const outgoingSnapshot = await adminDb.collection("pings")
    .where("from_user_id", "==", userId)
    .where("rejected_at", "==", null)
    .get();
  const outgoing = outgoingSnapshot.docs.map(docToPing).filter((ping) => ping.createdAt >= activePingCutoffIso(PING_DECAY_DAYS));
  const peerIds = outgoing.map((ping) => ping.toUserId);
  const incomingMap = await getPingRelationshipMaps(userId, peerIds);
  const mutuals = outgoing.filter((ping) => incomingMap.incoming.has(ping.toUserId));
  const users = await getUsersByIds(mutuals.map((ping) => ping.toUserId));
  return mutuals
    .map((ping) => {
      const user = users.find((candidate) => candidate.id === ping.toUserId);
      return user ? mutualContact(user, ping.createdAt) : null;
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
}
