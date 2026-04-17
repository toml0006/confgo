# Confgo — Product Design Document (v3)

A specification complete enough to rebuild the application from scratch.

---

## 1. Vision

A web platform for discovering conferences and the people who orbit them. The interface is a global map — dark, minimal, like looking at Earth from space at night. Conferences appear as points of light, brighter when recent, dimmer as time passes. You find conferences, mark yourself there, and over time notice which strangers keep showing up alongside you. A single gesture — the **ping** — bridges the gap if you want to connect.

No profiles. No feeds. No messaging. Just lights on a map and the people behind them.

---

## 2. What This Is Not

- **Not a social network.** No follows, no feeds, no messaging, no content creation.
- **Not an event management tool.** No ticketing, no schedules, no speaker lists, no session tracks.
- **Not a review platform.** No ratings, no comments on conferences.
- **Not a professional network.** No job titles, no companies, no endorsements.

The platform does one thing: shows you conferences on a map and lets you discover the people who keep showing up at the same ones.

---

## 3. Core Concepts

### 3.1 The Map

The primary and nearly only interface. A dark Mapbox GL map centered on North America.

- **Brightness = recency.** A conference happening now renders at full brightness. Last month is dimmer. Last year is a faint glow. Two years ago is barely visible. The decay function `conferenceGlow(startDate, endDate, now)` returns a continuous value in [0, 1] — not bucketed.
- **Color encodes relationship:**
  - Warm amber — conferences you haven't marked
  - Teal — conferences you've marked attendance on
  - Muted rose — past conferences (ended before now)
  - Past + yours — muted blue
- **Location grouping.** Many conferences share a city (e.g., 61 in NYC). Clicking a dot opens a **LocationSheet** — a chronological list for that city with a "NOW" divider, auto-scrolled to the present. Past entries are dimmed. Each entry shows name, date, and your attendance status. Clicking one opens its detail view.
- **Single conference.** If only one conference exists at a clicked point, it opens the detail view directly (no location list).

Map configuration: Mapbox `dark-v11` style, mercator projection, initial center at [-98.35, 39.5] zoom 3.85 (continental US). Fog effect for depth.

### 3.2 Conferences

A conference is a named event at a location and time.

**Fields:**
- Name, location name (city/venue), latitude, longitude
- Start date, end date (ISO 8601 with timezone offset)
- Source ("confs.tech" for imported, absent for user-created)
- Topics (array, optional — e.g., ["javascript", "devops"])
- URL (optional)

**Conference detail view (ConferenceSheet):** name, location, dates, attendee count, and attendee avatars/photos with ping indicators. Attendance buttons: "I'll be there" / "I was there" / "Unmark."

**Conference data:** Pre-seeded with 620 real North American tech conferences (2022–2026) sourced from the [tech-conferences/conference-data](https://github.com/tech-conferences/conference-data) open-source repository, filtered to U.S. and Canada in-person events, deduplicated across topic files, and geocoded via Mapbox Geocoding API. Includes 8 Minnestar community events (Minnebar 17–20, Minnedemo 38–41).

**Adding conferences:** Available to authorized users via Settings panel. Fields validated: name (1–200 chars), location name (1–200), latitude (-90 to 90), longitude (-180 to 180), start/end dates (ISO 8601 with offset).

### 3.3 Marking Attendance

The primary user action.

- Two intents: "been" (past) or "going" (future). Toggle freely, unmark anytime.
- Anonymous users can mark attendance — all data carries over if they later create an account (same Firebase UID).
- Attendance is stored as a separate document per user+conference pair (composite uniqueness enforced).
- Attendance updates in real-time across browser tabs via Firestore `onSnapshot` listener on the `attendances` collection.
- When attendance changes, the co-attendance peer list refreshes automatically.

### 3.4 My Conferences

A toolbar panel showing the user's personal conference history.

- **Going** section: future conferences sorted soonest-first, teal accent.
- **Been** section: past conferences sorted most-recent-first, rose accent.
- Count badge on the toolbar button.
- Clicking a conference flies the map to its location and opens its detail view.

### 3.5 People & Identity

Users are identified by an **avatar glyph** or an optional **profile photo**.

**Avatar glyphs:** 48 Unicode geometric symbols (diamonds, stars, snowflakes, arrows) each paired with a unique HSL hue. Rendered as circular badges with radial gradient backgrounds. Glyph + hue combination is determined by `avatarId % 48`.

**Profile photos:** Upload from device, crop and position within a circular preview using drag + zoom slider, client-side resize to 200x200 JPEG (0.85 quality) via `<canvas>`, uploaded directly to Firebase Cloud Storage at `profile-images/{userId}/photo.jpg`. Photos replace the glyph everywhere in the UI. "Remove photo" reverts to glyph.

**Display names:** Optional free-text (max 50 chars), searchable. Users without a display name appear as "Unnamed" or "Anonymous."

**UserAvatar component:** Renders photo if `photoURL` is set (with error fallback to glyph), otherwise renders `AvatarGlyph`. Supports a `pingIndicator` prop for visual ring effects (see Ping section). Used consistently across all avatar rendering sites.

### 3.6 User Search

Search people by display name. Debounced (260ms), returns up to 20 results with avatar and name. Selecting one or more users shows shared conference intersections in a clickable list. Co-attendance toast updates with "Selected: Y conferences, Z co-attendees."

### 3.7 Co-Attendance Overlay

When toggled on, the map visualization shifts to emphasize shared connections:

- **Conference dot scaling:** Dots grow in size and brightness proportional to the number of co-attendees at that conference. Conferences with zero co-attendees fade to near-invisible (0.06 opacity). Size interpolates from 5px (1 co-attendee) to 16px (15+).
- **Summary toast:** Bottom-center glass panel showing "Co-attendance: N conferences, M co-attendees." When users are selected via search, a second line shows "Selected: Y conferences, Z co-attendees."
- **Empty state:** If the user has no conferences marked, a centered overlay prompts: "Mark conferences to see co-attendees." If they have conferences but no one shares them: "No co-attendees yet."
- **Co-attendance computation:** Server-side multi-step aggregation in a Cloud Function — get user's conference IDs, chunk into Firestore `where("conference_id", "in", chunk)` queries (max 30 per), aggregate by peer user, batch-fetch user docs for profiles, check ping status per peer.

### 3.8 The Ping (Signal)

The only social action. Intentionally constrained.

**Flow:**

1. You see someone in a conference attendee list or the co-attendance overlay. You send a **ping** — a small "ping" button below their avatar in ConferenceSheet, or from the PeerSheet.
2. The recipient sees a **pulsing teal glow ring** on that user's avatar wherever it appears. The Signals badge in the toolbar updates in real-time via Firestore listener.
3. **If they ping you back** — mutual ping — both parties see a "Matched" state in the Signals panel. Either party can unmatch at any time.
4. **If they ignore it** — the ping fades over ~30 days. No action required.
5. **If they reject it** — the ping disappears from their side instantly. The sender sees normal fade. **The sender cannot distinguish between ignore and reject.** This is a core design principle.

**Signals panel (PingInbox):** Three sections with uppercase headers:
- **Matched** — mutual pings confirming a connection. "Unmatch" button deletes both ping directions.
- **Incoming** — pings from others with "Ping back" and "Reject" buttons. Anonymous users see "Create an account to respond."
- **Sent** — outgoing pings with recipient name/avatar and "Revoke" button.
- Mutual users are filtered out of Incoming and Sent so they only appear in Matched.
- Caption: "Mutual pings confirm connections. Pings fade after 30 days."

**Visual indicators on UserAvatar (pingIndicator prop):**
- `"incoming"` — 2px teal border + teal glow, pulsing animation (2s ease-in-out infinite)
- `"outgoing"` — 1px subtle tan border, static
- `"mutual"` — 2px teal border + stronger teal glow, static

**Ping gating:** Anonymous users can see incoming pings but cannot act (send, ping back, reject). All ping actions require a linked account.

**Ping decay:** Linear decay over 30 days (configurable via `PING_DECAY_DAYS` env var). `pingIntensity(createdAt)` returns [0, 1]. Server filters by decay cutoff. Client renders opacity as `0.35 + intensity * 0.65`.

**Real-time:** Ping badge count and PingInbox content update via Firestore `onSnapshot` listeners. No polling.

### 3.9 Peer Detail (PeerSheet)

Opened by tapping an attendee avatar or a co-attendee. Shows:
- Peer's display name (or "Unnamed") with their avatar/photo
- Count of shared conferences
- Clickable list of shared conferences (tapping one opens ConferenceSheet)
- "Send ping" button (hidden for self, anonymous users, or already-pinged)

---

## 4. Accounts & Authentication

### 4.1 Anonymous (Default)

- Open the app, start browsing and marking conferences immediately.
- Firebase Auth anonymous session creates a UID. Data persists in Firestore.
- Full functionality except ping actions.
- If dev-session login fails (emulators not running), falls back to anonymous automatically.

### 4.2 Account Upgrade (Credential Linking)

From the Settings panel, anonymous users upgrade without losing data:

- **Email/password:** Firebase `linkWithCredential()` with `EmailAuthProvider.credential()`. Same UID preserved.
- **Google Sign-In:** `linkWithPopup()` with `GoogleAuthProvider`. Same UID preserved.
- **Email-only users** can additionally link Google for multi-provider access.
- Edge cases: `auth/email-already-in-use` and `auth/credential-already-in-use` caught — UI offers sign-in instead.

### 4.3 Returning User Sign-In

Email/password or Google popup. Restores full state. Auth middleware automatically syncs email from Firebase token to Firestore user doc on each API call (handles credential linking email propagation).

### 4.4 Dev Seed Users

`POST /auth/dev-session` (non-production only) accepts `{ userId }`, returns a Firebase custom token. Frontend calls `signInWithCustomToken()`. Seed users with emails get a password provider (`seed-dev-password`) so they behave like real linked accounts in the UI.

---

## 5. UI Layout & Components

### 5.1 Overall Layout

```
Full-screen map canvas (fixed position)
  |
  |-- Top-left: Search stack (500px max width)
  |     |-- Conference search (glass panel, z-index 10)
  |     |     |-- Dropdown results (z-index 50, above user search)
  |     |-- User search (glass panel, z-index 1)
  |           |-- Selected user chips
  |           |-- Shared conferences list (clickable)
  |
  |-- Top-right: Toolbar (glass panel, aligned with search)
  |     |-- Signal icon + Settings gear (same row)
  |     |-- My conferences button (count badge)
  |     |-- Co-attendance toggle
  |     |-- Past/Future filter checkboxes (centered, divider above)
  |
  |-- Bottom-center: Co-attendance toast (when overlay active)
  |
  |-- Overlay panels (open on demand):
        |-- ConferenceSheet (top-left)
        |-- LocationSheet (top-left)
        |-- PeerSheet (top-left)
        |-- PingInbox (top-right)
        |-- SettingsPanel (top-right)
        |-- MyConferencesPanel (top-right)
        |-- AddConferenceModal (full-screen modal)
        |-- ProfileImageEditor (full-screen modal)
        |-- UserProfileSheet (top-left)
```

### 5.2 Settings Panel

- Header: Avatar/photo at 75px with pencil edit icon + display name + email/anonymous subtitle + X close button
- Display name field with save
- Account section (varies by auth state):
  - Anonymous: email/password form + "Sign in with Google" + "Already have an account?" toggle
  - Email-only: "Link Google account" button
  - Linked: provider info display
- Manage section (divider above): "Add a conference" button
- Sign out button (danger style)

### 5.3 Profile Image Editor

Full-screen modal with three views:
- **Choose:** "Upload a photo" (file input) or "Choose an avatar" button. "Remove photo" if photo exists.
- **Crop:** 180px circular preview with drag-to-reposition, zoom slider (1x–3x). Save renders to 200x200 canvas, uploads to Cloud Storage.
- **Avatar:** 48-glyph grid, tap to select and save (clears photo).

### 5.4 Consistent UI Patterns

- All panels use X-in-circle close button (28px, upper right, `border: 1px solid var(--mist)`)
- Navigation panels (PeerSheet, LocationSheet, ConferenceSheet, UserProfileSheet) use "Back" text button
- Glass panel aesthetic: `background: linear-gradient(...)` + `backdrop-filter: blur(18px)` + subtle border
- Buttons: `.soft-button` variants — primary (teal border), quiet (transparent), danger (pink)

---

## 6. Visual Design

### 6.1 Color System

```
--void: #03040a          Background
--haze: #0c1020          Panel backgrounds
--mist: rgba(232, 240, 255, 0.08)   Borders, dividers
--ember: #f6d4a3          Warm accent (conferences)
--ember-hot: #fff4e0      Bright warm
--signal: #5ee7d9         Teal primary (your conferences, pings)
--signal-dim: rgba(94, 231, 217, 0.35)   Dim teal
--past-signal: #8ca0dc    Past + yours
--past-ember: #c3a0b4     Past conferences
--danger: #ff6b8a         Destructive actions
```

### 6.2 Typography

- **UI font:** Lexend Exa (light weight, 300, letter-spacing 0.04em)
- **Note font:** Newsreader (serif, for body text/descriptions)
- Button text: 0.72rem, uppercase, letter-spacing 0.14em
- Muted text: opacity 0.55

### 6.3 Map Rendering

Conference dots: two Mapbox circle layers stacked:
- **Core dot:** radius 3.5–9px by glow, blur 0.25. Color by state (mine/past/default).
- **Halo ring:** radius 7–18px by glow, blur 0.9, lower opacity. Same color logic.

Co-attendance mode overrides: core radius scales by `coCount` (5–16px), halo scales (10–32px). Zero co-attendee conferences drop to 0.06 opacity.

Peer overlay: two layers (halo + core circle) positioned at average lat/lng of shared conferences. Peer trail: GeoJSON LineString connecting shared conference points chronologically.

### 6.4 Animations

- `sheet-in`: 420ms cubic-bezier slide-up + fade for panel entry
- `ping-pulse`: 2s ease-in-out infinite opacity oscillation (1 → 0.4 → 1) for incoming ping rings

---

## 7. Data Model

### 7.1 Firestore Collections

```
users/{userId}
  avatar_id         integer (0–47)
  email             string | null
  display_name      string | null
  photo_url         string | null (Cloud Storage download URL)
  created_at        string (ISO 8601)

conferences/{confId}
  name              string
  location_name     string
  latitude          number
  longitude         number
  start_date        string (ISO 8601)
  end_date          string (ISO 8601)
  source            string | absent ("confs.tech" for imported)
  topics            string[] (optional)
  url               string | null
  created_at        string (ISO 8601)

attendances/{attendanceId}
  user_id           string (→ users)
  conference_id     string (→ conferences)
  intent            "been" | "going"
  created_at        string (ISO 8601)
  Uniqueness: one doc per user_id + conference_id pair

pings/{pingId}
  from_user_id      string (→ users)
  to_user_id        string (→ users)
  created_at        string (ISO 8601)
  rejected_at       string | null
  Uniqueness: one doc per from_user_id + to_user_id pair
```

### 7.2 Composite Indexes

```
attendances: user_id ASC, conference_id ASC
attendances: conference_id ASC, user_id ASC
pings: from_user_id ASC, to_user_id ASC
pings: to_user_id ASC, rejected_at ASC, created_at DESC
pings: from_user_id ASC, rejected_at ASC, created_at DESC
```

### 7.3 Security Rules

- **conferences:** authenticated read/write
- **users:** authenticated read all, write own only (`request.auth.uid == userId`)
- **attendances:** authenticated read/write (server enforces ownership)
- **pings:** authenticated read/write (server enforces ownership)
- **Cloud Storage** `profile-images/{userId}/**`: authenticated read all, write own only

### 7.4 Derived Data

**Co-attendance** is computed server-side per request (not stored): get user's conference IDs → chunk into `where("conference_id", "in", chunk)` queries (max 30 per Firestore `in` query) → aggregate by peer user → batch-fetch user docs (100 per `getAll` call) → check ping status per peer.

**Mutual ping detection:** Two active ping docs exist (A→B and B→A), neither rejected, both with `created_at` within the 30-day decay window.

---

## 8. API Specification

Base path: `/api` (production via Firebase Hosting rewrite) or `/` (emulator direct).

Server: Hono.js wrapped in Firebase Cloud Functions v2 `onRequest` via `@hono/node-server` `getRequestListener`. Dual-mount: routes registered on an inner Hono app, mounted at both `/` and `/api` on a root Hono instance.

Auth middleware: extracts Bearer token from Authorization header, verifies via Firebase Admin `verifyIdToken()`. Auto-provisions user doc on first API call (random avatar, null email). Syncs email from token to Firestore if changed (handles credential linking).

### 8.1 Auth

| Method | Path | Auth | Body / Params | Response |
|--------|------|------|---------------|----------|
| POST | `/auth/dev-session` | No | `{ userId }` | `{ customToken, user }` — dev/emulator only |

### 8.2 User

| Method | Path | Auth | Body / Params | Response |
|--------|------|------|---------------|----------|
| GET | `/me` | Yes | — | `{ id, avatarId, email, displayName, photoURL }` |
| PATCH | `/me` | Yes | `{ avatarId?, displayName?, photoURL? }` | Updated user object |
| GET | `/me/attendances` | Yes | — | `{ attendances: [{ conferenceId, intent }] }` |
| GET | `/me/co-attendance` | Yes | — | `{ peers: CoPeer[] }` |

### 8.3 Conferences

| Method | Path | Auth | Body / Params | Response |
|--------|------|------|---------------|----------|
| GET | `/conferences` | No | `?q=text&bbox=minLng,minLat,maxLng,maxLat` | `{ conferences: Conference[] }` (max 2000, newest first; text search: max 500, date-sorted) |
| POST | `/conferences` | Yes | `{ name, locationName, latitude, longitude, startDate, endDate }` | Conference object (201) |
| GET | `/conferences/:id` | No | — | Conference object |
| GET | `/conferences/:id/attendees` | No* | — | `{ attendees: Attendee[] }` — includes `youPinged`, `hasPingedYou` if auth token present |
| POST | `/conferences/:id/attend` | Yes | `{ intent: "been" \| "going" }` | `{ ok: true }` |
| DELETE | `/conferences/:id/attend` | Yes | — | `{ ok: true }` |

### 8.4 Users

| Method | Path | Auth | Body / Params | Response |
|--------|------|------|---------------|----------|
| GET | `/users/search` | Yes | `?q=name` | `{ users: [{ id, avatarId, displayName, photoURL }] }` (max 20) |
| GET | `/users/:userId/profile` | Yes | — | `{ user, conferences, shared }` |
| GET | `/users/:peerId/shared-map` | Yes | — | `{ conferences: Conference[] }` |
| POST | `/users/shared-conferences` | Yes | `{ userIds: string[] }` (1–20) | `{ conferences: Conference[] }` |

### 8.5 Pings

| Method | Path | Auth | Body / Params | Response |
|--------|------|------|---------------|----------|
| POST | `/users/:targetId/ping` | Yes | — | `{ ok: true }` — creates or refreshes ping |
| GET | `/pings/incoming` | Yes | — | `{ incoming: IncomingPing[] }` |
| GET | `/pings/outgoing` | Yes | — | `{ outgoing: OutgoingPing[] }` |
| POST | `/pings/:pingId/ping-back` | Yes | — | `{ ok: true }` |
| POST | `/pings/:pingId/reject` | Yes | — | `{ ok: true }` |
| POST | `/pings/:pingId/revoke` | Yes | — | `{ ok: true }` — deletes the ping doc |
| POST | `/pings/dematch/:peerId` | Yes | — | `{ ok: true }` — deletes both directions |
| GET | `/pings/mutual-contacts` | Yes | — | `{ contacts: MutualContact[] }` |

### 8.6 Health

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/health` | No | `{ ok: true, conferenceCount, database: "firestore" }` |

---

## 9. Real-Time Architecture

Client-side Firestore `onSnapshot` listeners replace polling:

| Hook | Query | Purpose |
|------|-------|---------|
| `useIncomingPingCount(userId)` | `pings` where `to_user_id == userId AND rejected_at == null` | Live badge count (filters by 30-day decay client-side) |
| `useMyAttendances(userId)` | `attendances` where `user_id == userId` | Live `Map<conferenceId, intent>` — updates "My conferences" count and map highlights instantly |
| `useConferenceUpdates(callback)` | `conferences` ordered by `created_at DESC`, limit 1 | Fires callback when new conference added (skips initial snapshot) |
| `usePingUpdates(userId, callback)` | `pings` where `to_user_id == userId` + `pings` where `from_user_id == userId` | Fires callback when any ping involving the user changes (skips 2 initial snapshots) |

Complex queries (co-attendance aggregation, conference attendees with ping state) remain API calls — too complex for client-side Firestore queries.

---

## 10. Technical Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5.7, Vite 6 |
| Map | Mapbox GL JS 3.9, dark-v11 style |
| Backend | Hono 4.6 on Node.js 22, wrapped in Firebase Cloud Functions v2 |
| Database | Firestore (top-level collections) |
| Auth | Firebase Auth (Anonymous, Email/Password, Google) |
| Storage | Firebase Cloud Storage (profile images) |
| Validation | Zod 3.24 (server-side request validation) |
| Real-time | Firestore onSnapshot (client-side listeners) |
| Hosting | Firebase Hosting (SPA with `/api/**` rewrite to Cloud Function) |
| Dev environment | Firebase Emulator Suite (Auth 9099, Firestore 8080, Functions 5001, Storage 9199, UI 4000) |

---

## 11. Conference Data Pipeline

### 11.1 Collection (`collect-conferences.mjs`)

1. Fetches JSON files from `github.com/tech-conferences/conference-data` for years 2022–2026 across 26 topics
2. Filters to country = "U.S.A." or "Canada", in-person only (has city, not online-only)
3. Deduplicates by `name.toLowerCase() + "|" + startDate`
4. Geocodes unique city strings via Mapbox Geocoding API v6 (`/search/geocode/v6/forward`)
5. Outputs `data/real-conferences.json`

Additional conferences (e.g., Minnestar events) are added manually to the JSON file.

### 11.2 Import (`import-conferences.mjs`)

- Reads `real-conferences.json` (or `--file <path>`)
- Generates stable document IDs: `"rc_" + SHA-256(name.toLowerCase() + "|" + startDate).slice(0, 16)`
- Firestore `batch.set()` in chunks of 500 (idempotent — re-running overwrites same docs)
- Tags with `source: "confs.tech"`
- Targets emulator by default; `--production` reads project ID from `.firebaserc`
- Supports `--dry-run`

### 11.3 Seed Data (`seed-dummy-data.mjs`)

Run AFTER import-conferences. Reads conferences from Firestore, then:
- Creates 100 Firebase Auth accounts (10 named + 90 synthetic with deterministic display names)
- Named users with emails get password provider (`seed-dev-password`)
- Creates 100 Firestore user docs
- Generates ~3,500 attendance records against existing conferences (deterministic PRNG, seeded `0x5eedc0de`)
- Creates 9 ping records (mutual pairs, one-way, rejected)
- Emulator by default; `--production` flag for live

### 11.4 Cleanup (`clear-dummy-data.mjs`)

Deletes seed-prefixed docs (`seed_*`) from all collections + Auth accounts. Flags: `--users-only`, `--confs-only`, or clear all.

---

## 12. Development Setup

### Prerequisites
- Node.js 22+
- Firebase CLI (`npm install -g firebase-tools`)
- Mapbox access token (free tier)

### Local Development

```bash
# Install
npm install --prefix confgo
npm install --prefix confgo/functions
npm install --prefix confgo/web

# Configure
cp confgo/web/.env.example confgo/web/.env
# Edit .env: set VITE_MAPBOX_ACCESS_TOKEN

# Start (terminal 1)
cd confgo && firebase emulators:start

# Seed (terminal 2)
npm run dev:import-conferences --prefix confgo
npm run dev:seed --prefix confgo

# Vite (terminal 3)
npm run dev --prefix confgo/web

# Open http://localhost:5173
```

### Production Deployment

```bash
cd confgo
firebase use dev                    # switch to production project
cd web && npm run build && cd ..    # build frontend
firebase deploy                     # deploy everything

# Import conferences to production
node functions/scripts/import-conferences.mjs --production
```

Cloud Functions v2 requires `allUsers` invoker policy on the underlying Cloud Run service:
```bash
gcloud run services add-iam-policy-binding api \
  --region=us-central1 --project=<project-id> \
  --member="allUsers" --role="roles/run.invoker"
```

---

## 13. Key Design Decisions

1. **Anonymous-first.** Users start immediately without creating an account. Firebase Auth anonymous sessions provide a UID that persists. Account upgrade via credential linking preserves the same UID — no data migration needed.

2. **Server-side aggregation for co-attendance.** Firestore doesn't support joins. Rather than denormalize, co-attendance is computed per-request in the Cloud Function. Acceptable for the current dataset size (<1000 conferences, <200 users).

3. **Conference text search is in-memory.** Firestore doesn't support `LIKE` queries. The full conference catalog (<2000 docs) is fetched and filtered in the Cloud Function. A search index (Algolia, Typesense) would be needed at scale.

4. **Single Cloud Function for all routes.** The Hono app is wrapped in one `onRequest` handler rather than decomposed into per-route functions. Simpler deployment, shared cold start, easier routing.

5. **Client-side image processing.** Profile photos are cropped and resized to 200x200 in the browser via `<canvas>` before upload. No server-side image processing needed.

6. **Ping rejection is invisible.** The sender cannot distinguish between a rejected ping and one that faded naturally. This eliminates social pressure to respond.

7. **Real-time where it matters, API where it's complex.** Simple queries (my attendances, incoming ping count) use Firestore listeners for instant updates. Complex queries (co-attendance aggregation, attendees with ping state) use the API.

8. **Emulators are the default.** All scripts, all Firebase SDK connections default to emulators. Production requires explicit `--production` flags or absent `VITE_USE_FIREBASE_EMULATORS` env var.

9. **`demo-` project prefix for safety.** The emulator project ID is `demo-confgo` — Firebase's convention that prevents any accidental connection to real Google Cloud services.

10. **Past/Future as filters, not modes.** Checkbox-style toggles (with ☑/☐ glyphs) let users show/hide past and future conferences independently. Both default to on.
