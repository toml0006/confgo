# Venn·bar launch prep — Minnebar 20 week

**Date:** 2026-05-02 (and the few days leading up to the talk)
**Scope:** A long, sprawling work session covering the conference data
shrinkage / online-events expansion, the premium conference feature,
Minnebar premium overlay seeding, doc-id drift cleanup, the cherry-pick
of the marketing coming-soon page from `production` into `main`, DNS
setup for `venn.bar`, the live-refresh polling that flips visitors from
gated to live the moment a deploy lands, the `/demo/topics` flashcard
wall with live voting and a triple-Esc leaderboard, the first-load intro
tour, OG tags + image + PWA manifest, and a handful of merge-conflict /
auth / Firestore fixes that came up along the way.

Not chronological — grouped by topic so it's findable later.

---

## 1. Conference data: why we still had 605

**Ask.** "We recently expanded our conference import, why do we still
only have 605 conferences?"

**Funnel.** Of the 2,435 unique events confs.tech serves across 2022–2026,
only ~440 survive the `isInPersonNorthAmerican` filter:

```
confs.tech raw (2022–2026):     2,435
  – online events:             −1,025
  – no city:                       −1
  – non-NA (Germany, UK, NL…): −  969
                              -------
  NA in-person (kept):           440
```

The earlier dataset had ~645 confs.tech rows; today's same fetch yielded
440. Difference is upstream churn — `tech-conferences/conference-data`
prunes / restructures historical years.

**linux-foundation collector silently 0.** The collector itself returns
17 records, all NA-in-person, but the on-disk JSON was generated *before*
the collector was wired into `COLLECTORS`. Re-running the orchestrator
would have caught it. Filed as: regenerate `real-conferences.json`.

---

## 2. Online conferences via organizer-HQ lookup

**Ask.** "What's an interesting approach for adding the online conferences?"

**Recommendation chosen.** Conservative, two-path combo:

- **Path A — hybrid passthrough.** Confs.tech's `online: true` often
  means *hybrid* — the record already carries a city/country.
  ~90 NA hybrids become eligible just by removing the `online === true`
  exclusion in the NA filter.
- **Path B — pure online → curated HQ map.** A small
  `organizer-hq.mjs` lookup (~32 regex patterns) anchors well-known
  vendor events to company HQ cities (AWS→Seattle, Microsoft→Redmond,
  NVIDIA→Santa Clara, Snowflake→Bozeman, …). Pure-online events
  without a city get the HQ city; unmatched events drop.

**Schema.** Output records gain optional `online: true`; missing in JSON
= false. `import-conferences.mjs` carries it through to Firestore when
present. Filter renamed `isInPersonNorthAmerican` → `isNorthAmericanAnchored`.
Cross-source dedupe ORs the `online` flag so any source's "hybrid"
signal propagates.

**Result.** 605 → 814 records (440 in-person + 175 Path A + 23 Path B
+ rest from new collectors).

**Files touched.**

```
functions/scripts/collectors/organizer-hq.mjs   (new — 32 patterns)
functions/scripts/collect-conferences.mjs       (filter + HQ lookup + dedupe OR)
functions/scripts/import-conferences.mjs        (carry online to Firestore)
web/src/api.ts                                  (Conference type)
```

---

## 3. Data-ML curated catalog

**Ask.** "Do we have a good reliable set or is there a way we can get more?"

Built `functions/scripts/collectors/data-ml.mjs` — 9 series, 21 editions
(Ray Summit, MLOps World, dbt Coalesce, ODSC East/West, PyData NYC,
Ai4, Knowledge Graph Conference, Confluent Current, plus a couple of
2-edition gap-fillers). Web-search-verified each date against conference
homepages before committing. 20 net-new after cross-source dedupe; 1
collision (Ai4 2024 already in confs.tech). Ran 814 → 834.

---

## 4. Premium conference feature

**Ask.** Sponsor / "premium" treatment for paid conferences — image,
header, subtitle, body — and a CLI to flip without losing the metadata.

**Schema (Firestore conference doc).** 5 new optional fields:

```
premium             boolean (the gate)
premium_image_url   string | null
premium_header      string | null
premium_subtitle    string | null
premium_body        string | null
```

Toggling `premium` doesn't clear the other fields — they persist across
on/off flips so a sponsor can be muted and re-lit without re-entering
content.

**Backend.** `toApiConference()` (`functions/src/routes/conferences.ts`)
exposes camelCase versions: `premium`, `premiumImage`, `premiumHeader`,
`premiumSubtitle`, `premiumBody`.

**CLI — `functions/scripts/set-premium.mjs`.**

```
node functions/scripts/set-premium.mjs --id rc_abc --on \
    --image https://… --header "FOR TECH. BY TECH" \
    --subtitle "Saturday in Minneapolis" --body "First held in 2006…"

node functions/scripts/set-premium.mjs --id rc_abc --off
node functions/scripts/set-premium.mjs --id rc_abc --header "New copy"
node functions/scripts/set-premium.mjs --id rc_abc --clear-body
```

Flags: `--id` (required), `--on/--off`, `--image/--header/--subtitle/--body`,
`--clear-image/--clear-header/--clear-subtitle/--clear-body`,
`--production`, `--dry-run`. Explicit sets win over `--clear-*` when
both are passed.

**Visual language — new `--aurora` token.** Soft violet `#b794f6`,
distinct from `--ember` (default), `--signal` (mine/future), `--past-*`.
Added `--aurora-dim` (35% alpha) and `--aurora-wash` (12% alpha) for
backgrounds and borders. Plus a shared `.premium-chip` rule with a
leading `★`.

**`PremiumCard` component.** New file `web/src/components/PremiumCard.tsx`.
Renders image (or falls back to gradient wash if missing), header
(default = `conference.name`), subtitle (default = `locationName · date`),
optional body. Image uses `background-size: contain` so SVG logos like
Minnestar's render full-width without cropping.

**Wiring.** `ConferenceSheet` swaps the source/name/date block for
`<PremiumCard />` when `conference.premium`, plus an aurora-tinted glow
on the sheet itself. `MyConferencesPanel` and `GlobalSearch` show a
small thumbnail of `premiumImage` (or a `★` glyph fallback) next to
premium rows; rows pick up an `--aurora-dim` border + `--aurora-wash`
background. `MapView`'s `coreColor` expression has a `case` for
`premium === true` that overrides the existing state-based color —
sponsors read as a single distinct hue regardless of mine/past.

**Demo seed (Minnebar overlays).** `seed-dummy-data.mjs` now applies a
`premiumSeeds` overlay after the user/attendance/ping seed:

- **Minnebar 20** — fully populated (Minnestar logo, "FOR TECH. BY TECH"
  header, BarCamp body)
- **Minnebar 17 / 18 / 19** — `{ premium: true }` only, sparse, so the
  fallback paths get exercised in the demo

Matcher prefers `source === "minnestar"` so the overlay can't land on a
drift doc from an earlier import.

---

## 5. Doc-id drift — 11 Minnebars in Firestore

**Symptom.** `Minnebar 20` showing up three times in the conference list.

**Root cause.** `stableId(name, startDate)` was hashing on the *full ISO*
start date string. Across import eras the same edition was emitted
with `T00:00:00`, `T14:00:00`, and `T08:00:00 (4/20)` — three different
hashes, three different docs. With ~12 months of imports there were
**11 Minnebar docs in Firestore** (one currently-correct + several
drifters), and the premium overlay had landed on the wrong copies (the
matcher took the first by name and didn't disambiguate by source).

**Fix.** Two-line change in `import-conferences.mjs`:

```js
function stableId(name, startDate) {
  const day = String(startDate).slice(0, 10); // YYYY-MM-DD only
  const h = crypto.createHash("sha256");
  h.update(`${name.toLowerCase()}|${day}`);
  return `rc_${h.digest("hex").slice(0, 16)}`;
}
```

Plus `seed-dummy-data.mjs`'s premium matcher now disambiguates:

```js
const candidates = conferences.filter((c) => c.name === seed.name);
const match = candidates.find((c) => c.source === seed.source) ?? candidates[0];
```

**Cleanup ran.** Wiped seed_* + rc_* in the emulator, re-imported with
the date-only hash, re-seeded. Verified: 4 Minnebar docs (was 11), all
`source === "minnestar"`, all `premium === true`, Minnebar 20 with the
full hero card.

---

## 6. Cherry-pick: coming-soon marketing site → main

**Ask.** Ship `main` with all traffic routed to a `Coming soon` page;
flip later via deploy.

**Found.** The `ComingSoonPage.tsx` + `minnebar.svg` lived inside one big
`production`-branch commit (`3f21d4b`) bundled with photo-cropper,
version badge, deploy workflow changes, etc. A clean cherry-pick of just
the marketing site is three pieces:

1. `web/src/components/ComingSoonPage.tsx` (new file)
2. `web/public/minnebar.svg` (new asset)
3. `web/src/main.tsx` (wrap routes in a gate)

**The gate.** Single `const COMING_SOON_ONLY = true` at the top of
`main.tsx`. While true, every route serves `ComingSoonPage`. Flip to
`false`, push, the existing main-deploy workflow rebuilds and ships.

**Branch.** `cherry/coming-soon` off `main`, one commit, no push —
inspected, then merged. The trade I flagged: gating means *we* can't
show the live app on the deployed URL during the conference unless we
flip first; backdoor preview routes deferred.

---

## 7. Live refresh on deploy

**Ask.** "We want the coming-soon page to live refresh for everyone if
they have the site up."

**Considered.** Firestore listener (`deploys` collection) was the
proposed approach. Recommended polling instead — simpler, no per-visitor
gRPC connection, no auth dependency, public file works for unauthed
visitors. 10s ceiling settled at **3.5s** per request.

**Plumbing.**

- `web/scripts/bump-version.mjs` (the `prebuild` step) now also writes
  `web/public/version.json` with `{version, build}` so the deployed
  bundle ships its own version marker.
- `firebase.json` adds `Cache-Control: no-store, max-age=0` on
  `/version.json` so Firebase Hosting's CDN doesn't pin a stale copy.
- A small `<VersionPoller />` component in `main.tsx` runs a
  `setInterval(3500)` polling `/version.json` (with `cache: "no-store"`).
  Reloads when the served `build` exceeds `__APP_BUILD__`.

**Hoisted to root.** Originally I wrote the poller inside
`ComingSoonPage`. The user pointed out: that means a flip from live →
gated wouldn't auto-flip visitors back, since the poller only runs
inside the gated component. Moved it to `main.tsx` so it stays active
in either gating direction. Trade flagged: every future deploy now
hard-reloads anyone with the tab open. Fine for the demo; should be
demoted to a "new version available" banner once routine deploys
resume.

**Unique-id gotcha.** The version-bump-back-to-main step in the deploy
workflow needs `RELEASE_PAT` to push past branch protection. Without
the PAT, every CI deploy starts from the same `package.json` baseline,
bumps to the same `build = N+1`, and visitors never see a version delta
on consecutive deploys — silently breaks live-refresh. Quick-fix flagged:
swap to `git short SHA` so every commit gets a unique marker without
needing a write-back.

---

## 8. DNS setup for `venn.bar`

The whole arc, in order, because each step had its own gotcha:

**Step 1 — ACME 403.** Firebase Hosting's certificate issuer probed the
old A records (Squarespace parking IPs `198.185.159.144/.145`,
`198.49.23.144/.145`) and got `403 Forbidden`. Squarespace had pre-set
those when the user registered the domain. Fix: delete the four parking
A records, leave only `A venn.bar → 199.36.158.100` and
`TXT venn.bar → hosting-site=confgo-dev`.

**Step 2 — `@` vs literal.** User added the TXT record as
`venn.bar → hosting-site=confgo-dev`. Squarespace interpreted the
literal `venn.bar` as `venn.bar.venn.bar` (a subdomain), so it never
landed at the apex. Fix: name field needs to be `@`. Same logic for
the apex A record, but Squarespace had auto-set that one as `@` already.

**Step 3 — second A record.** User had both `A @ → 199.36.158.100`
*and* `A venn.bar → 199.36.158.100` — the literal one is redundant
(or worse, becomes a `venn.bar.venn.bar` subdomain depending on
provider). Deleted the literal.

**Step 4 — propagation.** TTL was 4h. Lowered for iteration. After
propagation `dig +short TXT venn.bar @1.1.1.1` returned both
`"v=spf1 -all"` and `"hosting-site=confgo-dev"`, Firebase verify
flipped, SSL issued.

**Step 5 — Firebase Auth authorized domains.** First Google sign-in
attempt threw `auth/unauthorized-domain` — popup opens, OAuth checks
origin, doesn't find `venn.bar` in the allowlist, immediately closes.
Fix: Firebase Console → Authentication → Settings → Authorized domains
→ add `venn.bar` and `www.venn.bar`. Server-side, no redeploy needed.

---

## 9. Sign-in flow — COOP, popup loops, reload-after

**Symptom.** After Google login, popup completes Google's side, then a
second popup opens for the same Google flow — looping. Console shows
`Cross-Origin-Opener-Policy policy would block the window.close call`.

**Diagnosis.** Firebase Auth's `__/auth/handler` page is served with
`COOP: same-origin`, which prevents the popup from `postMessage`-ing
back to the venn.bar opener window. Firebase's recovery path is to
re-open the popup, hence the loop. With nothing relaxing COOP on our
side, the credential message is silently lost.

**Fix.** Add a hosting header in `firebase.json`:

```json
{
  "source": "**",
  "headers": [
    { "key": "Cross-Origin-Opener-Policy", "value": "same-origin-allow-popups" }
  ]
}
```

`same-origin-allow-popups` keeps the origin isolated from arbitrary
third parties *and* lets the OAuth popup talk back. The version.json
header rule sits above this one with a more specific source, so
version.json still gets its `Cache-Control: no-store`.

**Reload after sign-in.** Earlier in the session: added
`window.location.reload()` to `AuthContext.linkProvider` after both
the anonymous-link path and the credential-collision fallback path,
so every fetch (`/me`, `/conferences`, attendances, pings) re-runs
with the upgraded identity. Trade flagged: blows away any in-progress
UI state. Acceptable for sign-in, would be jarring for routine flows.

---

## 10. Firestore + Safari long-polling

**Symptom.** After Google login, console floods with
`Firestore (11.10.0): WebChannelConnection RPC 'Listen' stream errored.`
plus `Fetch API cannot load …firestore.googleapis.com…/Listen/channel
due to access control checks.` HTTP fetches to `/api/me` and
`/api/conferences` also report `TypeError: Load failed`.

**Diagnosis.** Safari's Intelligent Tracking Prevention blocks
Firestore's WebChannel transport (cross-origin streaming + cookies).
Classic, well-known issue.

**Fix.** Swap `getFirestore(app)` → `initializeFirestore(app, {
experimentalAutoDetectLongPolling: true })`. The SDK tries WebChannel
first, detects the failure, and falls back to long polling. Slight
first-listen latency cost (~100ms); no behavior change in
Chrome / Firefox.

The HTTP `Load failed` errors were a likely cascade from the same
Safari ITP behavior — once Safari nukes one cross-origin connection in
a tab, subsequent fetches on the same context can fail too. Worth
re-testing post-deploy; if they persist, it's a separate Cloud
Functions CORS issue.

---

## 11. /demo/topics — the live flashcard wall

**Ask.** Public route on `venn.bar/demo/topics` that displays randomized
flashcards (talk topics distilled from Gemini meeting summaries),
fading in/holding/fading out, click-to-popup for full body. Then
escalating: more cards on screen, less overlap, live voting, leaderboard
easter egg, search, design polish.

**Source data — `web/scripts/build-topics.mjs`.** Parses
`design/Summary/flashcards.md` into `web/public/topics.json`. Wired into
`prebuild` so the deployed bundle always reflects the latest flashcards.
Stable IDs derived from `sha256(title)` so re-running the script after
edits is **idempotent** — unchanged cards keep their id (and thus their
accumulated `topic_likes`). Re-runnable manually via
`npm run dev:topics` from repo root.

**Layout — 4×3 cell pool.** 12 cells, 10 active slots. Each spawn picks
an unused cell (random); two cells are always free; cards never overlap
but the rotation feels organic. Random ±2° tilt + 3% jitter within each
cell.

**Lifecycle.** 5s fade-in / 30s hold / 5s fade-out (originally), then
shortened on user feedback to 2.5s / 15s / 2.5s. Single CSS keyframe
with breakpoints at 12.5% / 87.5%; per-card `animation-duration` riding
on the inline style scales the keyframe across longer-lifetime cards.

**Live voting.**

- Schema:
  - `/topic_likes/{topicId}` — counter doc `{ count }`. Public read,
    signed-in write.
  - `/user_topic_likes/{userId}` — `{ liked: [topicId, …] }`. Self
    only.
- Authentication. The route is wrapped in `<AuthProvider>` so anonymous
  sign-in fires automatically; every visitor gets a UID for vote
  attribution.
- Like toggle = atomic 2-doc batch write: `arrayUnion`/`arrayRemove`
  on the user side + `increment(±1)` on the counter. Optimistic UI
  with rollback on Firestore failure.
- Live updates via two `onSnapshot` listeners (counts collection-wide,
  user's own liked-set on a single doc).

**Bias from likes.**

- **Selection weight.** `1 + likeCount` per topic in cumulative-weight
  random pick. Active topics excluded so the same topic never appears
  in two slots.
- **Lifetime extension.** `BASE + likeCount × PER_LIKE` capped at
  `BASE + MAX_EXTRA`. Concretely: 20s base + 1.5s × likes, capped at
  +30s extra. So a popular topic stays up to 50s.

**Search bar.** Pill input fixed top-center, glass-paper, lucide
`Search` icon. Title-substring filter (case-insensitive, max 8). Click
opens the same modal as a card click. `Enter` opens top match, `Esc`
clears query. Z-50 above cards, below modal backdrop (z-100).

**Triple-Esc easter egg — leaderboard.** Hidden window-level keydown
listener counts Esc presses with a 1.5s rolling window. 3+ presses with
**no popup open and no input focused** (so search-clear doesn't leak)
→ open the leaderboard modal at z-110. Lists every topic ranked by
`likeCount` desc with title alphabetical tiebreaker. Click row → close
leaderboard, open that topic's modal. Esc / X / backdrop dismisses.

**Design pass — Atlas overhaul.** Once the design system from another
PR landed (Tailwind v4, shadcn primitives, Atlas tokens —
paper/ink/terracotta), I rewrote `TopicsDemo.tsx` from inline `<style>`
+ `--void/--signal` palette to utility-first Tailwind + Atlas tokens.
Floating cards: `bg-paper border-hair`, Fraunces serif title with
`tracking-tight-1`, `Kicker` eyebrow, lucide `Heart` for likes that
fills `var(--brand)` (terracotta) when liked. Modal + leaderboard share
a `ModalShell` helper (paper card, hair border, `animate-sheet-in`,
lucide `X` close button). Like button uses Atlas Button with `variant`
toggling between `atlas` and `atlas-primary`. Wordmark + `esc·esc·esc`
hint in opposite corners.

---

## 12. Intro tour — first-load + re-runnable

**Ask.** First-load tour explaining what the app's for. Conferences,
people, light pings; display names can be as anonymous as you want;
ignore anyone you don't want to hear from. Re-runnable from settings.
Clean and beautiful.

**Implementation.** New `web/src/components/IntroTour.tsx`. Five
slides, each with a lucide icon in a brand-soft circle, kicker eyebrow,
display-font title, body, optional muted detail line. Step indicator at
bottom — active dot widens to a 24px pill, prior dots stay ink2,
future dots stay hair. Arrow keys nav, Esc / X / click-outside
dismisses (and marks `localStorage.vb.intro.v1 = "seen"`).

Slides:

1. **Welcome** · Compass — what Venn·bar *is*
2. **Conferences** · MapPin — Going / Been; sponsors get premium cards
3. **People** · UserCircle2 — display name freedom, anonymous-first
4. **Light pings** · Waves — symmetric "ignore = reject" privacy by
   design, no read receipts
5. **Ready** · Sparkles — one-line CTA + reminder that the tour is
   re-runnable from settings

**Wiring.** `App.tsx` adds `[showIntro, setShowIntro]` state and a
`useEffect` that fires on first auth-ready load when
`hasSeenIntro()` returns false. SettingsPanel gets an optional
`onShowIntro` prop and renders a "Run intro" button under a "Help"
kicker.

**Avatar-click stopped working symptom.** Realized that
`{panel === "settings" && me ? <SettingsPanel /> : null}` swallowed the
click silently when `/me` hadn't returned. Added a fallback render —
`FloatingPanel` with `Kicker: Profile` + `Caption` showing either
"Signing you in…" (when `!ready`) or "Loading your profile… if this
hangs, /me may be failing — check the console." Click now always
produces visible feedback.

---

## 13. Open Graph tags + image + manifest

**Ask.** OG tags so links shared on Twitter / LinkedIn / iMessage /
Slack look great, plus a manifest for PWA installs.

**OG image — `og.png` 1200×630.** Source SVG (`og.svg`) renders via
`rsvg-convert`. Editorial paper-warm composition — soft terracotta
top-left wash, lavender bottom-right, hairline frame, kicker
"QUIET CONFERENCE NETWORKING", venn-circles brand mark, big serif
"Venn·bar" wordmark with terracotta `·`, italic two-line tagline,
"VENN.BAR" mono footer. 117KB. Renders cleanly with Georgia/Iowan
fallbacks (Fraunces not installed locally but the fallback chain holds
the editorial vibe).

**Square variant — initially.** Generated `og-square.png` 1200×1200,
chained as a second `og:image` for platforms that prefer square (Slack,
WhatsApp). User reported back: iMessage rendered **both** images
side-by-side (cropped, ugly). Removed the second `og:image` declaration;
single wide hero only.

**PWA manifest — `manifest.webmanifest`.**

```json
{
  "name": "Venn·bar",
  "short_name": "Venn·bar",
  "description": "A map of the conferences worth showing up to — and the people you'll see there.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#fbf9f4",
  "theme_color": "#fbf9f4",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

**Icon source — `icon-source.svg`.** Same venn-circles motif as the
favicon but with ~17% safe-area padding so Android adaptive masking
doesn't crop the strokes. Rendered to `icon-192.png` (4.5KB) and
`icon-512.png` (13KB).

**`index.html` final.** Title upgraded to "Venn·bar — quiet conference
networking". Description, theme-color (light + dark), apple-touch-icon
pointing at PNG, manifest link, full og:* set + twitter:* set.

---

## 14. Flashcards from Gemini transcripts

Read 9 Gemini meeting summaries in `design/Summary/`, distilled into
`design/Summary/flashcards.md` — short scannable beats organized by
theme: Big themes / Workflow / LLM strategy / Anecdotes / Confgo
product story / Lessons + hot takes / Demo plumbing / Presentation
strategy. ~78 cards across 8 sections. Each has a date pointer back to
its source transcript.

Filter pass: dropped the cards that weren't about AI / software /
product / expertise (NASA-call silence, robot lawnmower, "whittling
forks" coworker joke). Kept anecdotes that hook back into talk themes
(platform gatekeeping, agentic-mandate failure, capability-vs-release
tension, low-cost experimentation, dogfooding).

This file is what `build-topics.mjs` parses to populate the
`/demo/topics` flashcard wall — single source of truth for both the
green-room reference doc *and* the live audience-facing demo.

---

## 15. PhotoCropper — saving state stuck

**Symptom.** Upload photo once → works. Try again same session → button
grayed, says "Uploading…", never resets.

**Root cause.** Radix `<Dialog>` doesn't unmount its children when
closed — it just hides them. So the `<PhotoCropper>` instance survives
between cropper sessions. The success path called `onSave(url)` and
let the parent close the dialog, but never `setSaving(false)` —
`saving=true` carried over to the next session.

**Fix.** Two `setSaving(false)` calls:

1. In the `handleSave` success path, after `onSave(url)`.
2. In the `useEffect` that watches `[file]`, alongside `setError(null)`
   — defense in depth so any other path that doesn't hit success also
   clears stale state on a fresh file.

---

## 16. Merge-conflict + housekeeping fixes

**main.tsx JSX nesting.** After merging another dev's work, line 96 had
`</Routes>` where it should have been `</>` (closing a fragment), with
the actual `<Routes>` left unclosed. Tsc errored hard. Restored proper
nesting + tidied indentation around `<ThemeProvider>`.

**MapView accent reference.** Same merge introduced
`const { mode, accent } = useTheme()` and `useEffect(..., [accent, mode])`,
but `ThemeContextValue` only exposes `{ mode, setMode }`. Dropped
`accent` from the destructure and the dep array — effect still
re-fires on `mode` changes, which is what drives `--accent-color-hex`
via CSS data attributes anyway. Flagged: if the accent picker is
intended to ship later, the theme context needs a sibling change to
add `accent` / `setAccent`.

**.firebaserc project IDs.** Three rounds of confusion:

1. Original: `default = demo-confgo` (emulator), `dev = confgo-dev`
   (real). Active alias was `dev` so `firebase use` complained when
   targeting demo-confgo.
2. Switched explicit: `firebase emulators:start --project demo-confgo`
   bypasses the alias check (since `demo-` prefixed projects don't
   exist in Firebase's cloud and `firebase use` validates against the
   live API).
3. Final: user manually edited `.firebaserc` to put `default =
   confgo-dev`, demoted `demo-confgo` to a `demo` alias. Scripts'
   `loadProjectId()` now resolves correctly under `--production`.

**Deploy workflow — RELEASE_PAT optional fallback.** The
`actions/checkout@v4` step required `token: ${{ secrets.RELEASE_PAT }}`,
which was unset on the production environment. Action errored out with
`Input required and not supplied: token`. Made the token a fallback:
`token: ${{ secrets.RELEASE_PAT || github.token }}`. Plus the
"Commit version bump back to main" step is now gated on
`if: success() && env.RELEASE_PAT != ''` so it silently no-ops when no
PAT is configured (the default GITHUB_TOKEN can't push past branch
protection anyway, so failing there would mark a successful deploy as
red).

---

## 17. Files touched (rough)

```
.firebaserc
firebase.json
firestore.rules
.github/workflows/deploy.yml

functions/scripts/collect-conferences.mjs
functions/scripts/collectors/data-ml.mjs              (new)
functions/scripts/collectors/organizer-hq.mjs         (new)
functions/scripts/import-conferences.mjs
functions/scripts/seed-dummy-data.mjs
functions/scripts/set-premium.mjs                     (new)
functions/src/routes/conferences.ts

package.json                                          (root, add dev:topics)

web/index.html
web/package.json                                      (prebuild chain)
web/scripts/bump-version.mjs                          (write version.json)
web/scripts/build-topics.mjs                          (new)

web/public/favicon.svg                                (kept)
web/public/icon-192.png                               (new)
web/public/icon-512.png                               (new)
web/public/icon-source.svg                            (new)
web/public/manifest.webmanifest                       (new)
web/public/og.png                                     (new)
web/public/og.svg                                     (new)
web/public/og-square.png                              (new, unreferenced)
web/public/og-square.svg                              (new, unreferenced)
web/public/topics.json                                (generated)
web/public/version.json                               (generated)

web/src/api.ts
web/src/App.tsx
web/src/auth/AuthContext.tsx
web/src/firebase.ts
web/src/main.tsx

web/src/components/ComingSoonPage.tsx                 (cherry-picked from production)
web/src/components/ConferenceSheet.tsx
web/src/components/GlobalSearch.tsx
web/src/components/IntroTour.tsx                      (new)
web/src/components/MyConferencesPanel.tsx
web/src/components/PhotoCropper.tsx
web/src/components/PremiumCard.tsx                    (new)
web/src/components/SettingsPanel.tsx
web/src/components/TopicsDemo.tsx                     (new, then rewritten in Atlas)
web/src/components/map/MapView.tsx
web/src/components/map/styleExpressions.ts
web/src/styles/tokens.css                             (--aurora token, .premium-chip)

design/Summary/flashcards.md                          (new)
design/claude-transcript/2026-05-02-venn-bar-launch-prep.md  (this file)
```
