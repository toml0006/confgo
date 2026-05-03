import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  // Port 9180 matches `firebase.test.json` so tests don't collide with the
  // dev emulator on 8180. Override with FIRESTORE_TEST_PORT for CI.
  const port = Number(process.env.FIRESTORE_TEST_PORT ?? 9180);
  env = await initializeTestEnvironment({
    projectId: "confgo-rules-test",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const seed = (fn: (db: import("firebase/firestore").Firestore) => Promise<void>) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore() as unknown as import("firebase/firestore").Firestore);
  });

describe("users/{uid}", () => {
  it("allows self read", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "users/alice"), {
        email: "a@a.com",
        saved_contacts: [{ type: "email", value: "a@a.com" }],
      });
    });
    const alice = env.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(alice, "users/alice")));
  });

  it("blocks peer read of email + saved_contacts", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "users/alice"), {
        email: "a@a.com",
        saved_contacts: [{ type: "phone", value: "+15551234567" }],
      });
    });
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(getDoc(doc(bob, "users/alice")));
  });

  it("blocks anonymous-provider peer read", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "users/alice"), { email: "a@a.com" });
    });
    const anon = env
      .authenticatedContext("anon-1", { firebase: { sign_in_provider: "anonymous" } })
      .firestore();
    await assertFails(getDoc(doc(anon, "users/alice")));
  });

  it("blocks unauthenticated peer read", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "users/alice"), { email: "a@a.com" });
    });
    const unauth = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauth, "users/alice")));
  });

  it("blocks list-all enumeration", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "users/alice"), { email: "a@a.com" });
      await setDoc(doc(db, "users/bob"), { email: "b@b.com" });
    });
    const eve = env.authenticatedContext("eve").firestore();
    await assertFails(getDocs(collection(eve, "users")));
  });

  it("allows self write", async () => {
    const alice = env.authenticatedContext("alice").firestore();
    await assertSucceeds(setDoc(doc(alice, "users/alice"), { display_name: "Alice" }));
  });

  it("blocks peer write", async () => {
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(setDoc(doc(bob, "users/alice"), { display_name: "pwned" }));
  });
});

describe("attendances", () => {
  it("allows signed-in read filtered by user_id", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "attendances/alice__c1"), {
        user_id: "alice",
        conference_id: "c1",
        intent: "going",
      });
    });
    const alice = env.authenticatedContext("alice").firestore();
    await assertSucceeds(
      getDocs(query(collection(alice, "attendances"), where("user_id", "==", "alice"))),
    );
  });

  it("blocks client write (attendance spoofing)", async () => {
    const alice = env.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(alice, "attendances/alice__c1"), {
        user_id: "alice",
        conference_id: "c1",
        intent: "going",
      }),
    );
  });
});

describe("conferences", () => {
  it("allows signed-in read", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "conferences/c1"), { name: "Confgo", start_date: "2026-05-01" });
    });
    const alice = env.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(alice, "conferences/c1")));
  });

  it("blocks client write (catalog tampering)", async () => {
    const alice = env.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(alice, "conferences/c1"), { name: "pwned" }));
  });
});

describe("pings", () => {
  it("allows from_user_id read", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "pings/alice__bob"), {
        from_user_id: "alice",
        to_user_id: "bob",
      });
    });
    const alice = env.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(alice, "pings/alice__bob")));
  });

  it("allows to_user_id read", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "pings/alice__bob"), {
        from_user_id: "alice",
        to_user_id: "bob",
      });
    });
    const bob = env.authenticatedContext("bob").firestore();
    await assertSucceeds(getDoc(doc(bob, "pings/alice__bob")));
  });

  it("blocks third-party read", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "pings/alice__bob"), {
        from_user_id: "alice",
        to_user_id: "bob",
      });
    });
    const eve = env.authenticatedContext("eve").firestore();
    await assertFails(getDoc(doc(eve, "pings/alice__bob")));
  });

  it("blocks client write", async () => {
    const alice = env.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(alice, "pings/alice__bob"), {
        from_user_id: "alice",
        to_user_id: "bob",
      }),
    );
  });
});

describe("ping_contacts", () => {
  it("allows owner (sender) read", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "ping_contacts/alice__bob"), {
        owner_id: "alice",
        contacts: [{ type: "phone", value: "+15551234567" }],
      });
    });
    const alice = env.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(alice, "ping_contacts/alice__bob")));
  });

  it("blocks recipient direct read (must come via API)", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "ping_contacts/alice__bob"), {
        owner_id: "alice",
        contacts: [{ type: "phone", value: "+15551234567" }],
      });
    });
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(getDoc(doc(bob, "ping_contacts/alice__bob")));
  });

  it("blocks third-party read", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "ping_contacts/alice__bob"), {
        owner_id: "alice",
        contacts: [{ type: "phone", value: "+15551234567" }],
      });
    });
    const eve = env.authenticatedContext("eve").firestore();
    await assertFails(getDoc(doc(eve, "ping_contacts/alice__bob")));
  });

  it("blocks client write", async () => {
    const alice = env.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(alice, "ping_contacts/alice__bob"), {
        owner_id: "alice",
        contacts: [],
      }),
    );
  });
});

// Sanity assertion that the type-system import is reachable; vitest with no
// expects in describe still needs at least one assertion to count the suite.
describe("smoke", () => {
  it("env is initialized", () => {
    expect(env).toBeDefined();
  });
});
