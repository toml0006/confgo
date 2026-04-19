# Confgo

A map of conferences and the people who orbit them.

Spec: [`design/ConferenceAttApp-PDD-v4.md`](design/ConferenceAttApp-PDD-v4.md).

## Ports

All emulator ports are shifted +300 from Firebase defaults so multiple projects can run concurrently on the same host.

| Service | Port | URL |
|---|---|---|
| Vite dev server | **5174** | http://localhost:5174 |
| Firebase Emulator UI | **4300** | http://localhost:4300 |
| Emulator Hub | **4700** | — |
| Emulator Logging | **4800** | — |
| Hosting emulator | **5300** | http://localhost:5300 |
| Functions emulator | **5301** | http://127.0.0.1:5301/demo-confgo/us-central1/api |
| Firestore emulator | **8380** | — |
| Auth emulator | **9399** | — |
| Storage emulator | **9499** | — |

To change them, edit `firebase.json` (emulator ports), `web/vite.config.ts` (`server.port` + proxy target), `web/src/config/firebase.ts` (`connectXxxEmulator` calls), `functions/src/app.ts` (CORS origin regex), and `functions/scripts/lib/admin.mjs` (emulator host env vars).

## Local dev

```bash
npm install
npm install --prefix functions
npm install --prefix web

cp web/.env.example web/.env
# edit web/.env: set VITE_MAPBOX_ACCESS_TOKEN

# build the Cloud Function once (emulator loads the compiled JS, not the TS)
npm run build --prefix functions

# terminal 1 — emulators
firebase emulators:start

# terminal 2 — keep functions compiled on every change
npm run build:watch --prefix functions

# terminal 3 — seed data (first run only)
npm run import-conferences
npm run seed

# terminal 4 — frontend
npm run dev --prefix web
```

Open http://localhost:5174.

The `firebase-functions` SDK warning on startup (`outdated version`) is safe to ignore — pinned intentionally to the v6.1 API surface the app was written against.

### Signing in as a seed user

When emulators are running, set `VITE_DEV_USER_ID` in `web/.env` to auto-sign-in as a seed user instead of a fresh anonymous session. Good starting points:

- `seed_ava` — admin (can add conferences), mutual-pinged with `seed_ben`
- `seed_cora` — mutual-pinged with `seed_dev`
- `seed_elena`, `seed_gita`, `seed_iris` — one-way pings pending response

Each seed user carries ~12–51 attendance records, so flipping Co-attendance on shows real density. Remove the var (or leave blank) to return to anonymous sign-in.

## Deploy

```bash
firebase use dev          # switch to production project alias
npm run build:web
firebase deploy
```
