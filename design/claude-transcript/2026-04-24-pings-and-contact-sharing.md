# Claude Code Session — Map markers, 3D orbs, and the full ping/contact-sharing feature

**Date:** 2026-04-22 → 2026-04-24 (one continuous session)
**Working directory:** `/Users/ben/git/confgo`
**Model:** `claude-opus-4-7` (1M context)
**Secrets scrubbing:** Mapbox token in `web/.env` redacted as `[MAPBOX_TOKEN_REDACTED]`. The `fake-api-key` string used against the Firebase Auth emulator is not a real secret — the emulator accepts any value for its `?key=` parameter.

---

## 3. Designing the connect-with-other-users feature

### User
> let's figure out the connecting with other users functionality (pinging another user and them saying ok and sharing contact info)

### Claude
Found a lot already scaffolded: `pings` Firestore collection stub in `functions/src/lib/firestore.ts:13`, `Attendee` type already carries `youPinged` / `hasPingedYou` in `web/src/api.ts:56` (hardcoded `false` in `conferences.ts:162`), `UserAvatar` has an unused `pingIndicator` prop, `ping-pulse` CSS animation already defined, and a TODO Signals icon slot in `Toolbar.tsx:23`. Also found the design doc `design/ConferenceAttApp-PDD-v3.md` with a detailed spec for the feature (§3.8, §7, §8.5, §9).

The one real design gap: the PDD defines the *Matched* state but never specifies *what is exchanged* on match. Three options surfaced:

1. **Email reveal on mutual** — simplest, risk of surprise for users who signed up via Google without realizing email would be shareable.
2. **In-app only** — unlock a DM thread; safer, but adds a whole messaging surface.
3. **Opt-in per ping-back** — sender and receiver each pick what to share at the moment of their action. Most respectful, most UI.

Recommended an MVP slice: ping button from `ConferenceSheet` attendee rows only, plus a toolbar Signals panel. Deferred `/users/search` + `PeerSheet` for later.

Asked three questions:
1. Which contact-sharing model?
2. ConferenceSheet-only v1 or also search + PeerSheet?
3. Keep PDD's anon rule (can see, can't act)?

---

## 4. Answers + implementation kickoff

### User
> let's do #3, when you ping someone you make the same choice (that will be revealed when accepted/matched). The UI should be type: tiktok, insta, facebook, twitter, email, phone, etc and a field to enter the data. For your decisions at the end: 1) choose model 3, 2) do both, 3) anonymous accounts can do everything except act on pings (send or accept)

### Claude
Walked through the resulting shape:

**Data model** — `pings/{pingId}` keeps `from/to/created_at/rejected_at`, plus a new `contacts: ContactEntry[]` field owned by the sender. Mutual reveal still uses the existing invariant (both docs exist, neither rejected, both within 30-day decay window). The server-side privacy rule: a ping doc's `contacts` is only returned to the `to_user_id` when a matching reverse doc exists.

```ts
type ContactType =
  | "email" | "phone" | "twitter" | "instagram"
  | "tiktok" | "facebook" | "linkedin" | "github"
  | "website" | "other";
type ContactEntry = { type: ContactType; value: string; label?: string };
```

**API deltas** — `POST /users/:targetId/ping` and `POST /pings/:pingId/ping-back` take `{ contacts: ContactEntry[] }`. `/pings/incoming` never includes contacts. `/pings/outgoing` returns the sender's own. `/pings/mutual-contacts` returns both sides. Reject also blocked for anon.

**Saved contact profile** — added `users.saved_contacts` + `/me/contacts` GET/PUT so users don't re-type handles every ping.

**UI surfaces** — `PingComposer` modal, `PingInbox` 3-tab panel, `PeerSheet`, ping button in ConferenceSheet attendee rows, UserAvatar ring states.

Raised five open questions: edit disclosures after send, edit after match, validation strictness, refresh-resets-window, rate-limit shape. Proposed a 6-slice implementation plan.

### User
> yes

### Claude
Picked sensible defaults for all five open questions and began slice 1.

- No edit-in-place; revoke + re-ping to change.
- Frozen after match; dematch and re-pair to change.
- Loose input, normalized storage (strip leading `@`, lowercase email, strip `https://` and trailing slash from URLs).
- Refresh overwrites `contacts` and bumps `created_at`.
- Rate limit: 20 sends per user per rolling 24h.

---

## 5. Slice 1 — Shared types + seed

Created:

- `functions/src/lib/contacts.ts` — Zod schemas `contactEntrySchema` / `contactsArraySchema` / `savedContactsArraySchema` with caps (10 per ping, 20 saved) and a `normalizeContact()` function.
- `web/src/lib/contacts.ts` — mirror types + the same normalizer + a `contactHref()` helper + a `CONTACT_LABELS` map.

Edits:

- `functions/src/lib/firestore.ts` — documented new `users.saved_contacts` and `pings.contacts` fields; added `pingId(from, to)` helper.
- `functions/scripts/seed-dummy-data.mjs` — each named user gets 2–3 saved cards; new ping-seed block writes 9 records per PDD (3 mutual, 2 one-way, 1 rejected) with `${from}__${to}` deterministic IDs.

Both `functions` and `web` typechecked clean.

---

## 6. Slice 2 — Backend endpoints

Created:

- `functions/src/auth.ts` — captured `firebase.sign_in_provider` into context; added `requireLinkedAccount` middleware (blocks anonymous users).
- `functions/src/lib/pings.ts` — `PING_DECAY_DAYS` (30, env-overridable), `PING_RATE_LIMIT_PER_DAY = 20`, `pingDecayCutoffIso()`, `userPublic()` projection, and the `loadPingState(userId)` helper that classifies pings as active (not rejected, within decay window) and computes `mutualPeerIds` / `incomingOnlyPeerIds` / `outgoingOnlyPeerIds`.
- `functions/src/routes/pings.ts` — all 7 ping endpoints. Key invariants enforced server-side:
  - Refresh-on-rejected is a silent no-op (preserves invisible-reject).
  - Rate limit only charged on *new* sends, not refreshes.
  - `/pings/outgoing` filters out rejected pings — sender sees them vanish, like decay.
  - `/pings/incoming` never includes `contacts`.
- `functions/src/routes/users.ts` — `/users/search?q=` with in-memory substring match, excludes self, max 20 results.

Edits:

- `functions/src/routes/me.ts` — added `GET /me/contacts` and `PUT /me/contacts`, both anon-allowed.
- `functions/src/routes/conferences.ts` — removed the hardcoded `false` on `youPinged` / `hasPingedYou`. When viewer is authenticated, calls `loadPingState(viewer)` once and stamps all attendee rows.
- `functions/src/index.ts` — mounted `pingRoutes` + `userRoutes`.
- `web/src/api.ts` — added `UserSummary`, `IncomingPing`, `OutgoingPing`, `MutualContact` types with an explicit "contacts intentionally omitted" comment on `IncomingPing` to keep the privacy invariant visible at the type level.

Both projects typecheck clean.

---

## 7. Emulator tests (slice 2 — exhaustive)

### User
> ok, let's run local emulator tests manually

### Claude
Plan: build functions → start emulators (background) → import conferences → seed → mint ID tokens → exercise endpoints with curl.

Wrote `/tmp/confgo-test.sh` helper with `idtoken <uid>` (via `/auth/dev-session` → `signInWithCustomToken`), `anon_idtoken`, `as <uid> <method> <path> [body]`, `anon <method> <path> [body]`.

Exercised the following scenarios, **all passed**:

| # | Scenario | Result |
|---|---|---|
| 1 | `/me/contacts` returns seeded saved cards | ✓ |
| 2 | `/pings/mutual-contacts` reveals both sides on Alex↔Priya mutual | ✓ |
| 3 | Mutual peers filtered out of incoming/outgoing | ✓ |
| 4 | **Privacy invariant**: unanswered incoming never includes sender contacts | ✓ |
| 5 | `/pings/outgoing` includes sender's own contacts | ✓ |
| 6 | Ping-back creates mutual instantly, both sides see each other | ✓ |
| 7 | Self-ping → 400 `cannot_ping_self` | ✓ |
| 8 | Anon → 403 `linked_account_required` on send | ✓ |
| 9 | Anon → 200 on `/pings/incoming` and `/me/contacts` (read-only OK) | ✓ |
| 10 | **Invisible reject**: re-ping to a rejecter returns `{ok: true}` silently; rejection preserved | ✓ |
| 11 | `/users/search` excludes self, substring match | ✓ |
| 12 | Attendees endpoint sets `youPinged` + `hasPingedYou` from live ping state | ✓ |
| 13 | Reject hides the ping from both sides | ✓ |
| 14 | Revoke deletes the outgoing ping | ✓ |
| 15 | Dematch deletes both directions | ✓ |
| 16 | `PUT /me/contacts` normalizes (`@handle` → `handle`, lowercase email, strip protocol + trailing `/`) | ✓ |
| 17 | Invalid contact type → 400 with readable error | ✓ |

---

## 8. Slice 3 — Contact cards editor in Settings

### User
> yes, leave them up and keep going

### Claude
Created `web/src/components/ContactsEditor.tsx` — loads `/me/contacts`, renders rows with uppercase type label + value + `×` remove, plus an add row (type dropdown over 10 `CONTACT_TYPES`, value field, conditional label input when `other` is picked, Enter-to-submit). Client-side `normalizeContact()` runs before PUT. Optimistic update with rollback on failure. Respects `MAX_SAVED_CONTACTS = 20`.

Wired into `SettingsPanel.tsx` as a new "Contact cards" section between Avatar and Account, with caption: *"Picked per ping. Only revealed when someone matches back."*

Typecheck clean; Vite dev server boots cleanly on `http://localhost:5173`; both modules transform 200 OK.

---

## 9. Slice 4 — PingComposer + PingInbox + Signals toolbar

### User
> continue on

### Claude
Created:

- `web/src/hooks/useIncomingPingCount.ts` — Firestore `onSnapshot` on `pings where to_user_id == me AND rejected_at == null`, filters by 30-day decay cutoff client-side. Returns the live count for the toolbar badge.
- `web/src/components/ContactAddRow.tsx` — extracted the type/value/label + Add row from `ContactsEditor` so `PingComposer` can reuse the same inline-add UX.
- `web/src/components/PingComposer.tsx` — modal with backdrop dismiss. Loads `/me/contacts`, renders each saved card as a checkbox, includes inline `ContactAddRow` that persists to `/me/contacts` AND auto-selects the newly added card. Disabled until ≥1 picked. Emits `onSubmit(contacts)` — parent wires to the right endpoint.
- `web/src/components/PingInbox.tsx` — 3-tab panel (Matched / Incoming / Sent, each with count badge). Matched shows both sides' disclosures as clickable links via `contactHref()` + Unmatch. Incoming shows Ping back + Reject (or "Sign in to respond" for anon). Sent shows own disclosures + Revoke. Pops `PingComposer` for ping-back. Refetches after every action.

Refactored `ContactsEditor.tsx` to delegate the add row to `ContactAddRow`.

Edits:

- `web/src/components/Toolbar.tsx` — new Signals button with absolute-positioned count badge.
- `web/src/App.tsx` — `useIncomingPingCount`, new `"signals"` panel variant, renders `PingInbox`, passes count to `Toolbar`.

**Flagged a security gap**: `firestore.rules` currently allows any authenticated user to read any ping doc directly — bypassing the API's reveal-on-match logic. Recommended splitting disclosures into a separate collection with stricter rules before production.

Typecheck clean; Vite serves all modules; API feeds match UI data shapes.

---

## 10. Slice 5 — PeerSheet + ConferenceSheet ping wiring

### User
> continue!

### Claude
Backend:

- `functions/src/routes/users.ts` — `GET /users/:userId/profile` with `optionalAuth`. Returns `{user, shared, pingState}`. `shared` = attendance intersection; `pingState` = `{youPinged, hasPingedYou}` from `loadPingState`, or `null` if viewer unauthenticated/self.

Frontend:

- `web/src/api.ts` — added `PingPairState` + `UserProfile` types.
- `web/src/components/PeerSheet.tsx` — left-side glass panel mirroring `ConferenceSheet`. Shows avatar + name + shared-count header, state-aware ping control (Ping / Ping back / Pinged chip / Matched chip / hidden for self), and a clickable shared conferences list. Hosts its own `PingComposer`.
- `web/src/components/ConferenceSheet.tsx` — attendee tile restructured. Identity region now a `<button type="button">` that opens the peer sheet. New `AttendeePing` helper:
  - `✓ Matched` chip when `youPinged && hasPingedYou`
  - `Pinged` chip when `youPinged && !hasPingedYou`
  - **`Ping back`** primary-outline button when `hasPingedYou && !youPinged`
  - **`Ping`** button otherwise
  - Disabled with `"Sign in to ping"` tooltip for anon.
- `web/src/App.tsx` — `Selection` union gained a `peer` variant and `single.backTo` broadened to also carry `{kind:"peer", userId}` for round-trip navigation.

Verified `/users/:userId/profile` across mutual / no-ping / self / anon / invisible-reject cases — all behaviors correct. Typecheck + Vite clean.

---

## 11. Slice 6 — Avatar indicator rings

### User
> yes, continue

### Claude
Rewrote `web/src/components/UserAvatar.tsx` to wire the existing `pingIndicator` prop. Avatar wrapped in `.avatar-wrap--{state}` with a `::after` pseudo-element ring (so opacity pulses don't dim the avatar itself):

- `mutual` — solid teal border + teal glow (static)
- `outgoing` — dim teal border (static)
- `incoming` — ember amber border + `ping-pulse` animation (keyframes already in `animations.css:12`)
- `none` — no ring

Added `aria-label` for screen readers: "Matched with X" / "X pinged you" / "You pinged X".

Plumbed indicator state to all three callers: `ConferenceSheet` attendee tile, `PeerSheet` header, `PingInbox` rows (matched/incoming/sent get mutual/incoming/outgoing respectively).

Feature-complete.

---

## 12. Security hardening — split disclosures off pings

### User
> keep going

### Claude
Tackled the flagged rules gap.

**Data model split**

- `pings/{pingId}` — metadata only (`from_user_id`, `to_user_id`, `created_at`, `rejected_at`).
- `ping_contacts/{pingId}` — `{owner_id, contacts}`, same doc id, owner is always the sender.

**Rules** (`firestore.rules`)

- `pings`: read if viewer is `from_user_id` or `to_user_id`; **write: false** (API only; Admin SDK bypasses rules).
- `ping_contacts`: read if viewer is `owner_id`; write: false.

`useIncomingPingCount`'s `where to_user_id == me` still works because every doc the query could match satisfies the rule.

**Backend changes**

- `PingDoc` no longer carries `contacts`. New `loadContactsForPings(ids)` batch-loader.
- Every create/refresh/ping-back goes through a `writePingAtomic` helper that commits both docs in a single Firestore batch.
- Revoke + dematch delete metadata + disclosure docs atomically.
- `/pings/outgoing` and `/pings/mutual-contacts` call the batch loader.

**Seed**: writes both docs, plus wipes stale `pings` + `ping_contacts` in emulator before seeding (guarded so production never wipes).

**Verification — five direct-Firestore-read scenarios as each role:**

| Scenario | Result |
|---|---|
| Kai (owner) reads `ping_contacts/kai__tess` | ✓ 200, contacts visible |
| **Tess (recipient, not owner) reads same** | ✓ **PERMISSION_DENIED 403** |
| Jordan (third party) reads `pings/kai__tess` | ✓ PERMISSION_DENIED 403 |
| Tess reads `pings/kai__tess` metadata | ✓ 200, `hasContactsField: false` |
| Jordan reads `ping_contacts/kai__tess` | ✓ PERMISSION_DENIED 403 |

Rules gap closed.

---

## 13. Migration script

### User
> write the migration script

### Claude
Created `functions/scripts/migrate-ping-contacts.mjs` — one-shot idempotent migration for pre-split production data.

**Safety-first defaults:** dry-run by default, requires `--apply` to write (inverts the `--dry-run` convention of other scripts because a destructive migration warrants a safer default). `--production` required for live Firestore.

**Three code paths:**

| Doc state | Script action |
|---|---|
| No inline `contacts` | Skip |
| Inline `contacts`, no `ping_contacts` doc | Write `ping_contacts/{id}` with `{owner_id: from_user_id, contacts}` + strip inline field |
| Inline `contacts`, `ping_contacts/{id}` already exists | Preserve existing `ping_contacts` as canonical; strip inline field only |

**Verified scenarios:**

1. Clean post-split seed → 0 migrated, 0 stripped ✓
2. Injected legacy inline-contacts doc → correctly migrated ✓
3. Rerun after migration → idempotent no-op ✓
4. Half-finished state (inline + newer canonical `ping_contacts`) → stripped inline only; newer data preserved ✓

Batches ≤ 250 pings per commit (2 ops each, stays under 500-op batch limit).

---

## 14. Production auth error

### User
> I have to set the environment first? (base) [26-04-24 1:40PM] ben@Aptrgangr confgo$ node functions/scripts/migrate-ping-contacts.mjs --production
>
> Target: PRODUCTION (project demo-confgo)
> Mode:   dry-run (no writes)
> ...
> Error: 7 PERMISSION_DENIED: Permission denied on resource project demo-confgo.
> ...

### Claude
Two prereqs missing, and the first is dispositive:

1. **`demo-confgo` is emulator-only by design.** The `demo-` prefix is a Firebase convention that blocks real GCP connections (PDD §13.3: "prevents any accidental connection to real Google Cloud services"). `.firebaserc:3` has `"default": "demo-confgo"`, so `--production` used that id, the Firestore SDK tried to reach real GCP, and was refused. No real production project is currently configured in this repo.
2. **Credentials.** Even with a real project id, admin SDK needs either `gcloud auth application-default login` or `GOOGLE_APPLICATION_CREDENTIALS` pointing at a service account JSON.

Recommended pattern when prod exists: add a `production` alias to `.firebaserc` and switch the script to read `projects.production` under `--production`. Offered to make the change.

---

## Final state at session end

**Emulators still running:** bg task `bv7v4sql9` (Firebase emulators), `bcy1j95ra` (Vite). UI reachable at http://localhost:5173; emulator UI at http://localhost:4000.

**Everything merged into working tree** (no commits made — user hasn't requested any):

- `functions/src/lib/contacts.ts`, `functions/src/lib/pings.ts`, `functions/src/lib/firestore.ts`
- `functions/src/routes/pings.ts`, `functions/src/routes/users.ts`, `functions/src/routes/me.ts`, `functions/src/routes/conferences.ts`
- `functions/src/auth.ts`, `functions/src/index.ts`
- `functions/scripts/seed-dummy-data.mjs`, `functions/scripts/migrate-ping-contacts.mjs` (new)
- `firestore.rules`
- `web/src/api.ts`, `web/src/hooks/useIncomingPingCount.ts`
- `web/src/lib/contacts.ts`
- `web/src/components/ContactsEditor.tsx`, `ContactAddRow.tsx`, `PingComposer.tsx`, `PingInbox.tsx`, `PeerSheet.tsx`
- `web/src/components/UserAvatar.tsx`, `ConferenceSheet.tsx`, `SettingsPanel.tsx`, `Toolbar.tsx`
- `web/src/App.tsx`

**Open follow-ups flagged but not done:**

- Production `.firebaserc` alias + script update to read `projects.production` under `--production`.
- Visual/browser verification of the UI flows (I can't click pixels from this environment).
- No git commits made during the session — working tree has all changes.

---

