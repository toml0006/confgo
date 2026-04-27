# Profile photos, seed-data tuning, CI/CD wiring, coming-soon page, rebrand

**Date:** 2026-04-27
**Scope:** Profile-photo upload + circle crop, anon gating on photos, seed-data
density and topic affinity, version badge restoration, GitHub Actions deploy
with version-bump persistence, public coming-soon page with a MinneBar callout,
and a rename of the user-facing brand from `confgo` to `Venn•bar`.

---

## 1. Profile photo upload with circle crop

**Ask.** "We want to allow users to choose and circle crop/zoom an image to be
their profile image in addition to allowing the user to choose an avatar."

**State of the world.** The user model already had `photo_url` (nullable) and
`UserAvatar` already preferred a photo over the glyph fallback. Storage rules
were pre-wired for `profile-images/{userId}/...`. There was no upload UI and
Firebase Storage wasn't initialized on the client.

**Change set.**

- `web/src/firebase.ts` — added `getStorage` + `connectStorageEmulator` (port
  9199, already configured in `firebase.json`).
- `web/src/components/PhotoCropper.tsx` (new) — modal with:
    - 280 px square viewport, circular CSS mask
    - drag-to-pan (pointer events) + zoom slider (1× – 4×)
    - clamps offset so the image always covers the viewport
    - on save: draws the visible region to a 512 × 512 canvas, exports JPEG
      at 0.9 quality, uploads to `profile-images/{uid}/avatar-{ts}.jpg`,
      returns `getDownloadURL()` to the caller
    - geometry uses the Efraimidis-style transform math for mapping viewport
      pixels back to source pixels (scale = max(viewport/nW, viewport/nH) × zoom)
- `web/src/components/SettingsPanel.tsx`:
    - identity tile now uses `<UserAvatar>` instead of `<AvatarGlyph>` so it
      reflects the live photo
    - new "Photo" section above the avatar grid with Upload / Replace / Remove
      buttons and a hidden `<input type="file" accept="image/*">`
    - opens `PhotoCropper` once a file is picked; on save, optimistically updates
      local state and PATCHes `/me`

The cropper exports a *square* JPEG. Circular display is handled by the existing
`.avatar-photo { border-radius: 999px; object-fit: cover }` rule, so the same
file works at any avatar size everywhere in the app.

---

## 2. Anonymous accounts can pick avatars but not upload photos

**Ask.** "Anonymous can only choose avatars not upload profile images."

Three layers were tightened:

- **Backend** (`functions/src/routes/me.ts`) — added a guard inside `PATCH /me`:
  if `parsed.data.photoURL !== undefined` and the caller's `signInProvider` is
  `"anonymous"`, return 403 `linked_account_required`. Other field updates
  (avatarId, displayName) are still allowed for anon.

- **Storage rules** (`storage.rules`):

    ```
    match /profile-images/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.auth.token.firebase.sign_in_provider != "anonymous";
    }
    ```

- **UI** (`web/src/components/SettingsPanel.tsx`) — wrapped the entire Photo
  section in `{!isAnonymous ? ... : null}`. Anon users still see the existing
  "sign in to keep your conferences" prompt and can pick an avatar glyph.

Note: the storage-rule change requires `firebase deploy --only storage` to
apply on real Storage; the emulator picks it up automatically on restart.

---

## 3. Local-emulator data import order

**Ask.** "What data import scripts do I run after emulators start again?"

Answer: in this order, both default to the emulator with no flags needed:

```
node functions/scripts/import-conferences.mjs
node functions/scripts/seed-dummy-data.mjs
```

`import-conferences.mjs` loads `functions/data/real-conferences.json` into
the `conferences` collection. `seed-dummy-data.mjs` adds users, attendances,
and seed pings against whatever conferences are already there, so the import
has to run first. `migrate-ping-contacts.mjs` is a one-shot prod migration,
not a fresh-emulator step. `collect-conferences.mjs` is the upstream scraper
that produces `real-conferences.json` — only run it when refreshing source data.

---

## 4. Seed-data density tuning

**Ask.** "Take a look at the conferences in real-conferences.json and the seed
data script — do we need to create more seed data? A lot of conferences don't
have attendees."

**Diagnosis.** Simulating the existing seeder against the real conference set:

- 652 total conferences (614 past, 37 future, 1 in-progress as of 2026-04-27)
- 100 users × 20–60 random picks ÷ 652 confs ≈ **mean 6 attendees per conf**
- 3 conferences ended up with zero attendees, 31 with 1–2
- Picks were uniform random — no popularity skew, no topic affinity
- Future confs (where the matching/pings UX actually matters) averaged 6 each

**Recommendations made.** Four leverage points, ranked:

1. Bump users 100 → 300.
2. Skew picks toward future confs (where matching is the demo's punchline).
3. Per-conference popularity weights for a power-law tail.
4. Per-user topic affinity (1–3 favorite topics, 3× weight when conf topics
   overlap).

The user accepted (1), (2), and (4); explicitly declined (3).

**Implementation** in `functions/scripts/seed-dummy-data.mjs`:

- Bumped the anon-user loop from `i < 90` to `i < 290` (10 named + 290 anon).
- Added `AFFINITY_TOPICS` (10 topics drawn from the real-confs vocabulary).
- Per-user 1–3 favorite topics, sampled deterministically from the shared
  `mulberry32(0x5eedc0de)` PRNG so the seed is reproducible.
- `pickWeighted(pool, count, weightOf)` — Efraimidis–Spirakis weighted
  reservoir sample without replacement, key = `u^(1/weight)`. Topic-overlap
  yields weight 3, otherwise 1.
- Split conferences into `futureConfs` / `pastConfs` by start-date comparison.
- Each user attends 5–10 future + 20–40 past picks, weighted by topic affinity
  on each pool independently.

**Resulting distribution** (simulated against the real data):

```
total attendances: ~11,170 (was ~4,000)

FUTURE confs (37):
  mean=61   median=62   min=37   max=100
  zero=0    every future conf is now populated

PAST confs (615):
  mean=15   median=14   max=66
  zero=162  (long-tail past confs without affinity-topic overlap)
```

Top 10 future confs by attendees lean heavily on JS / data / devops /
networking — exactly the affinity vocabulary, so the social graph clusters
by interest instead of looking like white noise.

---

## 5. Version badge in lower-right

**Ask.** "We would like a semver x.x.x version number and build number
displayed in a subtle way in the lower right corner of the site."

This had been added and reverted in the previous session (because of a
prod blank-screen incident caused by an unrelated predeploy hook). The
`assertProductionEnvIsReal()` guard from that fix is still in place, so
re-enabling the badge is now safe.

**Change set.**

- `web/scripts/bump-version.mjs` (new) — patch-bumps semver and increments
  `buildNumber` in `web/package.json`. Runs as the `prebuild` step, so every
  `npm run build` produces a fresh pair. `npm run dev` does not bump.
- `web/package.json` — added `"buildNumber": 0` and a `"prebuild"` script.
- `web/vite.config.ts` — reads `package.json` at config time and exposes
  `__APP_VERSION__` and `__APP_BUILD__` via `define`.
- `web/src/env.d.ts` — TS declarations for the two compile-time globals.
- `web/src/components/VersionBadge.tsx` (new) — fixed bottom-right, 10 px,
  ~28 % white, `pointer-events: none`, soft text-shadow for readability over
  the map.
- `web/src/App.tsx` — mounted `<VersionBadge />` once at the root.

**Format.** First rendered as `v0.1.0 · b0`; the user requested change to
`v0.1.0 (0)` (semver, build number in parens). Final string is exactly that.

**Sizing.** The brand mark on the coming-soon page was bumped twice — first
to honor the "Venn•bar" mixed case (after dropping the `text-transform:
uppercase`), then bumped again to `clamp(1.8rem, 5.5vw, 2.8rem)` per
"make the coming soon app name bigger."

---

## 6. CI/CD: bump persists across deploys

**Ask.** "Put the bump version script in reasonable places so it's run when
we deploy" → followed by "we have a CI/CD flow that deploys on main merge,
let's make sure that works" → followed by "PAT-based push."

**Initial mistake to avoid.** Adding a `predeploy` to `firebase.json`'s
hosting block runs `npm run build` again, which double-bumps every CI
release. Reverted that and let CI's explicit `Build web` step be the
single bump point.

**Persistence problem.** CI mutates `web/package.json` during the build,
but unless that change is committed back, every future run starts from
the same baseline version — the badge would lie.

**Fix in `.github/workflows/deploy.yml`.**

- Granted `contents: write` permission.
- Checkout step now uses `RELEASE_PAT` and `fetch-depth: 0` so a later
  `git pull --rebase` has full history and the push can target a protected
  branch:

    ```yaml
    - uses: actions/checkout@v4
      with:
        token: ${{ secrets.RELEASE_PAT }}
        fetch-depth: 0
    ```

- New "Commit version bump back to main" step runs after a successful
  Firebase deploy:
    - skips if `web/package.json` is unchanged
    - configures the bot identity (`confgo-release-bot`)
    - reads the new version + build number from the bumped file
    - commits with message `chore: bump web to vX.Y.Z (N) [skip ci]`
      (the `[skip ci]` token is natively respected by GitHub Actions, so
      the auto-commit doesn't loop)
    - rebases on origin/main (in case humans merged during the deploy
      window) and pushes

**One-time setup the user has to do in GitHub.**

1. Create a fine-grained PAT at github.com/settings/personal-access-tokens
   with **Contents: Read and write** scoped to the confgo repo only.
2. Add it as repo secret `RELEASE_PAT`.
3. Allow the PAT's owner to bypass branch protection on `main`
   (Settings → Branches → main → bypass allowlist).

Recommended: register a dedicated bot account so the release commits show
up under its identity and the PAT scope is limited.

---

## 7. Coming-soon page with MinneBar callout

**Ask.** "Add a simple coming soon page that feels compatible with the confgo
site and indicates that people who want to learn more should go to MinneBar 20:
https://sessions.minnestar.org/sessions/1903 — that would be in a card/callout
under the Coming soon page, feel free to use a lighter background on the
callout and use the minnebar logo
https://sessions.minnestar.org/assets/logos/minnebar-horizontal-...svg"

**Change set.**

- `web/public/minnebar.svg` — fetched the upstream asset and saved locally,
  so the content-hashed URL can't break the page later.
- `web/src/components/ComingSoonPage.tsx` (new) — public marketing page:
    - dark `--void` backdrop with soft signal/ember radial glows that match
      the site's existing palette
    - centered brand mark (initially small eyebrow, later bumped to
      `clamp(1.8rem, 5.5vw, 2.8rem)`)
    - "Coming soon" headline at `clamp(2.4rem, 7vw, 3.6rem)`, light-weight,
      muted tagline beneath
    - **Callout card**: near-white background (`color(display-p3 0.972 0.98 1
      / 0.94)`) so the MinneBar logo's brand colors (red / two purples /
      teal) read clearly; left-aligned logo + eyebrow + headline + meta line;
      hover lift; small-screen breakpoint stacks logo above text
- `web/src/main.tsx` — moved into `<Routes>` so `/coming-soon` renders without
  mounting `AuthProvider` or the rest of the App tree:

    ```tsx
    <Routes>
      <Route path="/coming-soon" element={<ComingSoonPage />} />
      <Route path="*" element={<AuthProvider><App /></AuthProvider>} />
    </Routes>
    ```

The marketing page therefore makes zero Firestore listeners and zero auth
calls — it loads instantly and works for unauthenticated visitors.

---

## 8. Rebrand: confgo → Venn•bar

**Ask.** "Our brand name has changed to 'Venn•bar', we only need to change
user-facing things."

User-visible occurrences of `confgo` in the codebase:

- `web/index.html` — `<title>Confgo</title>` → `<title>Venn•bar</title>`
- `web/src/components/ComingSoonPage.tsx` — brand mark text and the
  uppercase `text-transform` was removed so the mixed casing renders as
  intended

Internal stuff was deliberately left alone:

- repo path `git/confgo`
- npm package names `confgo-web`, `confgo-functions`
- Firebase project IDs `demo-confgo` (emulator) and `confgo-dev` (hosting site)
- CSS class names like `.coming-soon-brand`
- comments referencing "the rest of confgo"
- log filenames like `firebase-debug.log`

None of those reach the user, so they're untouched.

---

## Files touched in this session

```
firebase.json
firestore-debug.log                     (untouched, listed for clarity)
storage.rules
functions/src/routes/me.ts
functions/scripts/seed-dummy-data.mjs
.github/workflows/deploy.yml
web/index.html
web/package.json
web/scripts/bump-version.mjs            (new)
web/vite.config.ts
web/public/minnebar.svg                 (new, fetched)
web/src/firebase.ts
web/src/main.tsx
web/src/App.tsx
web/src/env.d.ts
web/src/components/PhotoCropper.tsx     (new)
web/src/components/VersionBadge.tsx     (new)
web/src/components/ComingSoonPage.tsx   (new)
web/src/components/SettingsPanel.tsx
```

All changes pass `npm run typecheck` in `web/` and `npm run build` in
`functions/`.
