import { Hono } from "hono";
import { z } from "zod";
import { contactsArraySchema } from "../lib/contacts";
import {
  db,
  getUsersByIds,
  nowIso,
  pingContacts,
  pingId,
  pings,
  users,
} from "../lib/firestore";
import {
  loadContactsForPings,
  loadPingState,
  PING_RATE_LIMIT_PER_DAY,
  pingDecayCutoffIso,
  userPublic,
} from "../lib/pings";
import { AppEnv, getUserId, requireAuth, requireLinkedAccount } from "../auth";

export const pingRoutes = new Hono<AppEnv>();

const sendBody = z.object({ contacts: contactsArraySchema });

// Atomically write a ping's metadata + the sender's disclosures to the split
// `pings` / `ping_contacts` collections. Security: ping_contacts rules restrict
// read to owner_id, so a direct-Firestore read by the recipient cannot exfil.
function writePingAtomic(params: {
  pingId: string;
  fromUserId: string;
  toUserId: string;
  createdAt: string;
  rejectedAt: string | null;
  contacts: unknown[];
}): Promise<FirebaseFirestore.WriteResult[]> {
  const batch = db.batch();
  batch.set(pings().doc(params.pingId), {
    from_user_id: params.fromUserId,
    to_user_id: params.toUserId,
    created_at: params.createdAt,
    rejected_at: params.rejectedAt,
  });
  batch.set(pingContacts().doc(params.pingId), {
    owner_id: params.fromUserId,
    contacts: params.contacts,
  });
  return batch.commit();
}

// POST /users/:targetId/ping — create or refresh a ping. Body: { contacts }.
// Refresh-on-rejected is a silent no-op so the sender cannot infer rejection
// (PDD §3.8.5: "ignore and reject must be indistinguishable to the sender").
pingRoutes.post("/users/:targetId/ping", requireAuth, requireLinkedAccount, async (c) => {
  const me = getUserId(c);
  const target = c.req.param("targetId");
  if (target === me) return c.json({ error: "cannot_ping_self" }, 400);

  const body = await c.req.json().catch(() => null);
  const parsed = sendBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "bad_request", details: parsed.error.flatten() }, 400);
  }

  const targetSnap = await users().doc(target).get();
  if (!targetSnap.exists) return c.json({ error: "not_found" }, 404);

  const id = pingId(me, target);
  const existing = await pings().doc(id).get();
  const now = new Date();

  if (existing.exists && existing.get("rejected_at")) {
    // Silent no-op — leave the rejection in place. Sender sees success.
    return c.json({ ok: true });
  }

  if (!existing.exists) {
    const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
    const recent = await pings().where("from_user_id", "==", me).get();
    const recentCount = recent.docs.filter(
      (d) => (d.get("created_at") as string) > dayAgo,
    ).length;
    if (recentCount >= PING_RATE_LIMIT_PER_DAY) {
      return c.json({ error: "rate_limited" }, 429);
    }
  }

  await writePingAtomic({
    pingId: id,
    fromUserId: me,
    toUserId: target,
    createdAt: nowIso(),
    rejectedAt: null,
    contacts: parsed.data.contacts,
  });
  return c.json({ ok: true });
});

// GET /pings/incoming — pings sent to me. Excludes mutual + rejected. Never
// includes the sender's contacts.
pingRoutes.get("/pings/incoming", requireAuth, async (c) => {
  const me = getUserId(c);
  const state = await loadPingState(me);
  const senderIds = Array.from(state.incomingOnlyPeerIds);
  const usersById = await getUsersByIds(senderIds);
  const incoming = state.activeIncoming
    .filter((p) => state.incomingOnlyPeerIds.has(p.fromUserId))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((p) => ({
      pingId: p.id,
      fromUser: userPublic(p.fromUserId, usersById.get(p.fromUserId)),
      createdAt: p.createdAt,
    }));
  return c.json({ incoming });
});

// GET /pings/outgoing — pings I sent. Excludes mutual + rejected. Includes my
// own contacts (I wrote them).
pingRoutes.get("/pings/outgoing", requireAuth, async (c) => {
  const me = getUserId(c);
  const state = await loadPingState(me);
  const pingsForOutgoing = state.activeOutgoing.filter((p) =>
    state.outgoingOnlyPeerIds.has(p.toUserId),
  );
  const [usersById, contactsByPingId] = await Promise.all([
    getUsersByIds(pingsForOutgoing.map((p) => p.toUserId)),
    loadContactsForPings(pingsForOutgoing.map((p) => p.id)),
  ]);
  const outgoing = pingsForOutgoing
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((p) => ({
      pingId: p.id,
      toUser: userPublic(p.toUserId, usersById.get(p.toUserId)),
      createdAt: p.createdAt,
      contacts: contactsByPingId.get(p.id) ?? [],
    }));
  return c.json({ outgoing });
});

// GET /pings/mutual-contacts — matched peers + both sides' disclosures. This
// is the only surface where a recipient sees the sender's disclosures.
pingRoutes.get("/pings/mutual-contacts", requireAuth, async (c) => {
  const me = getUserId(c);
  const state = await loadPingState(me);
  const peerIds = Array.from(state.mutualPeerIds);
  const incomingByPeer = new Map(state.activeIncoming.map((p) => [p.fromUserId, p]));
  const outgoingByPeer = new Map(state.activeOutgoing.map((p) => [p.toUserId, p]));

  const pingIdsToLoad = peerIds.flatMap((peerId) => {
    const fromThem = incomingByPeer.get(peerId);
    const fromMe = outgoingByPeer.get(peerId);
    return [fromThem?.id, fromMe?.id].filter((x): x is string => !!x);
  });

  const [usersById, contactsByPingId] = await Promise.all([
    getUsersByIds(peerIds),
    loadContactsForPings(pingIdsToLoad),
  ]);

  const contacts = peerIds
    .map((peerId) => {
      const fromThem = incomingByPeer.get(peerId)!;
      const fromMe = outgoingByPeer.get(peerId)!;
      const matchedAt =
        fromThem.createdAt > fromMe.createdAt ? fromThem.createdAt : fromMe.createdAt;
      return {
        peer: userPublic(peerId, usersById.get(peerId)),
        theirContacts: contactsByPingId.get(fromThem.id) ?? [],
        yourContacts: contactsByPingId.get(fromMe.id) ?? [],
        matchedAt,
      };
    })
    .sort((a, b) => (a.matchedAt < b.matchedAt ? 1 : -1));
  return c.json({ contacts });
});

// POST /pings/:pingId/ping-back — body: { contacts }. Reciprocate an incoming
// ping by creating the reverse direction with my own disclosures.
pingRoutes.post("/pings/:pingId/ping-back", requireAuth, requireLinkedAccount, async (c) => {
  const me = getUserId(c);
  const id = c.req.param("pingId");
  const body = await c.req.json().catch(() => null);
  const parsed = sendBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "bad_request", details: parsed.error.flatten() }, 400);
  }
  const incoming = await pings().doc(id).get();
  if (!incoming.exists) return c.json({ error: "not_found" }, 404);
  if (incoming.get("to_user_id") !== me) return c.json({ error: "forbidden" }, 403);
  if (incoming.get("rejected_at")) return c.json({ error: "rejected" }, 409);
  if ((incoming.get("created_at") as string) <= pingDecayCutoffIso()) {
    return c.json({ error: "expired" }, 410);
  }
  const peerId = incoming.get("from_user_id") as string;
  const reverseId = pingId(me, peerId);
  await writePingAtomic({
    pingId: reverseId,
    fromUserId: me,
    toUserId: peerId,
    createdAt: nowIso(),
    rejectedAt: null,
    contacts: parsed.data.contacts,
  });
  return c.json({ ok: true });
});

// POST /pings/:pingId/reject — recipient rejects. Sender never sees this.
// Only updates the pings doc; the ping_contacts row is left alone so the
// sender (owner) can still see what they'd offered.
pingRoutes.post("/pings/:pingId/reject", requireAuth, requireLinkedAccount, async (c) => {
  const me = getUserId(c);
  const id = c.req.param("pingId");
  const snap = await pings().doc(id).get();
  if (!snap.exists) return c.json({ error: "not_found" }, 404);
  if (snap.get("to_user_id") !== me) return c.json({ error: "forbidden" }, 403);
  await pings().doc(id).update({ rejected_at: nowIso() });
  return c.json({ ok: true });
});

// POST /pings/:pingId/revoke — sender deletes their own outgoing ping.
pingRoutes.post("/pings/:pingId/revoke", requireAuth, requireLinkedAccount, async (c) => {
  const me = getUserId(c);
  const id = c.req.param("pingId");
  const snap = await pings().doc(id).get();
  if (!snap.exists) return c.json({ error: "not_found" }, 404);
  if (snap.get("from_user_id") !== me) return c.json({ error: "forbidden" }, 403);
  const batch = db.batch();
  batch.delete(pings().doc(id));
  batch.delete(pingContacts().doc(id));
  await batch.commit();
  return c.json({ ok: true });
});

// POST /pings/dematch/:peerId — delete both directions of a mutual pair.
pingRoutes.post("/pings/dematch/:peerId", requireAuth, requireLinkedAccount, async (c) => {
  const me = getUserId(c);
  const peer = c.req.param("peerId");
  if (peer === me) return c.json({ error: "bad_request" }, 400);
  const forwardId = pingId(me, peer);
  const reverseId = pingId(peer, me);
  const batch = db.batch();
  batch.delete(pings().doc(forwardId));
  batch.delete(pings().doc(reverseId));
  batch.delete(pingContacts().doc(forwardId));
  batch.delete(pingContacts().doc(reverseId));
  await batch.commit();
  return c.json({ ok: true });
});
