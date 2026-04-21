# Confgo

Confgo is a map-first conference discovery app built with React, Vite, Hono, Firebase Auth, Firestore, Cloud Storage, and Firebase Hosting/Functions.

## Structure

- `web/` React 19 + Vite client
- `functions/` Hono API deployed as a single Firebase Function
- `shared/` shared domain types and validation
- `data/` conference seed/import JSON

## Local Development

1. Copy `web/.env.example` to `web/.env`.
2. Set `VITE_MAPBOX_ACCESS_TOKEN`.
3. Install dependencies:

```bash
npm install
```

4. Start emulators:

```bash
firebase emulators:start
```

5. Import conferences and seed users in a second terminal:

```bash
npm run dev:import-conferences
npm run dev:seed
```

6. Start the web app:

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Data Tooling

- `node functions/scripts/collect-conferences.mjs`
- `node functions/scripts/import-conferences.mjs`
- `node functions/scripts/seed-dummy-data.mjs`
- `node functions/scripts/clear-dummy-data.mjs`

All scripts target emulators by default. Add `--production` to point at the configured Firebase project.

## Admin Conference Creation

Conference creation is gated server-side by the Firebase custom claim `admin: true`.
Set that claim manually for the users who should be allowed to add conferences.
