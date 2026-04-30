# Conference tagging, chip search, and a Venn-diagram easter egg

**Date:** 2026-04-30
**Scope:** Tag every conference in the seed (834 events) with a normalized
canonical tag set; lock a 16-category taxonomy; build a chip-style tag
picker with grouped autocomplete in `GlobalSearch`; ship a fullscreen
2-/3-circle Venn-diagram easter egg triggered by 3× Escape; promote
Minnebar 20 to premium in the canonical seed.

---

## 0. Worktree bootstrap

The worktree was originally created off `main` (`52fb7c3`), but the seed
data sitting on `production` was substantially larger than what `main`
carried. Quick check: `jq 'length' functions/data/real-conferences.json`
returned **448** on `main` vs **834** on `production` — the user had
expected ~800. Reset the worktree branch to `origin/production`
(`fc038c0 Updating with premium conference/sponsor options`) before
starting any work. No unique commits were lost (the worktree branch was
identical to `main`'s tip).

## 1. Tagging 834 conferences with Haiku

**Ask.** "Look at the conference list. Follow the links to the
conferences and use Haiku to determine a set of tags for the conference.
Then dedupe the tags into a normalized list for using Firebase."

**State of the world.**
- `functions/data/real-conferences.json` — 834 entries with `name`,
  `url`, `location_name`, `latitude/longitude`, `start_date`, `topics`
  (free-form, very coarse — `general`, `data`, `networking`, etc.).
- Existing `topics` were too generic to power useful search/discovery.

**Pipeline.**

1. Split the 834 entries into 12 batches of ~70 (`/tmp/conf-batches/
   batch-{0..11}.json`).
2. Spawn 12 parallel general-purpose subagents on the **Haiku** model.
   Each agent:
   - WebFetches the conference URL, extracting topics, technologies,
     audience, format, and vertical/industry from the live site.
   - Falls back to inferring tags from the `name` + URL slug when the
     fetch is empty or JS-heavy.
   - Emits 3–7 lowercase kebab-case tags per conf and a
     `confidence: high|medium|low` flag.
   - Writes its batch JSON to `/tmp/conf-batches/tags-{N}.json` to keep
     the JSONL transcripts out of the parent context.
3. Merge — 834/834 confs tagged, **535 raw unique tags** before any
   normalization. ~57s per batch wall-clock, ~3 minutes total in
   parallel.

**Confidence breakdown** after the run:
- 380 high-confidence (page fetch produced useful content)
- 245 medium (page returned but thin)
- 209 low (fallback to name-only inference)

The high-confidence ratio fell off after the sample (sample was 20
high-conf out of 20 — the long tail has more JS-heavy conference
microsites that don't render server-side).

## 2. Taxonomy and normalization

535 raw tags is unusable — synonym sprawl (`ai`, `ai-ml`, `ai-engineering`,
`generative-ai`, `ai-agents`, `llm`, `machine-learning` were all
emitted), trivial typos (`node-js` vs `nodejs`, `c-plus-plus` vs `cpp`),
and 255 singletons.

**Normalize.** A `/tmp/normalize-tags.mjs` script applied a synonym map
that folded raw tags onto canonical slugs and dropped meta-noise
(`software-development`, `developers`, `general`, `general-dev`,
`programming-languages`). Result: **222 canonical tags**, 3.7 tags per
conf on average.

**Locked taxonomy.** The user reviewed the top tags and locked in a
16-category structure with named subgroups:

```
format     {mode, structure}
language   {jvm, js-ts, systems, dotnet, scripting, apple, functional, legacy}
framework  {js-frontend, js-backend, jvm, php, python, cms, webassembly}
platform   {os, mobile, hardware, networking, vendor-cloud}
web        {core, styling, performance, a11y, apis}
cloud-infra {containers, iac, cloud, infra}
devops-sre {pipeline, ops, observe}
data       {general, engines, pipelines, analytics, graph, storage}
ai         {core, generative, agentic, ops, domains}
security   {general, offensive, defensive, community}
architecture {patterns, research, workflow, no-code}
people     {leadership, product, design, career, inclusion, method}
audience   {org, community, academic}
vertical   {finance, health, retail, media, enterprise-apps}
vendor     {hyperscaler, enterprise}
web3       {web3}
```

**Apply.** A second script (`/tmp/apply-taxonomy.mjs`) added
`tags`/`categories`/`subgroups` arrays to every conference entry and
wrote three artifacts to `functions/data/`:

- `tag-taxonomy.json` — locked categorical structure (used by both
  import and any future admin UI).
- `tag-vocabulary.json` — flat `{tag, category, subgroup, count}` × 249
  for cheap lookups / autocomplete.
- `real-conferences.json` (overwritten) — every conf now carries
  `tags`, `categories`, `subgroups`, `tag_confidence`.

Post-application stats: 206 of 249 taxonomy tags actually appear in the
seed; avg 3.8 tags / 2.9 categories per conf; 5 confs with empty `tags`
(IEEE WTS, Gartner Symposium, DevSpace, Strange Loop ×2 — all came in
with only `general`/`networking` topics that the synonym map drops).

A small alias step inside `apply-taxonomy.mjs` catches stragglers the
LLM emitted with bad slug shapes (`node.js` → `nodejs`, `c-plus-plus` →
`cpp`, `multi-language` → `polyglot`, `site-reliability` → `sre`,
`continuous-integration` → `ci-cd`).

## 3. Backend wiring

**Firestore collections.**

- `conferences/{rc_*}` — already exists; gains `tags[]`,
  `categories[]`, `subgroups[]`, `tag_confidence` on every doc.
- `tags/{tagSlug}` — new per-tag docs `{tag, category, subgroup, count,
  updated_at}` for facet UI / autocomplete.
- `meta/tag-taxonomy` — new single doc with the full nested taxonomy
  for clients that want to render the whole tree.

**Import.** `functions/scripts/import-conferences.mjs` was extended to:

- Pass `tags`/`categories`/`subgroups`/`tag_confidence` from the seed
  through to Firestore.
- Optionally read `tag-taxonomy.json` and `tag-vocabulary.json` and
  write them to `meta/tag-taxonomy` + `tags/*` in batches of 500.
- Pass premium fields (`premium`, `premium_image_url`, `premium_header`,
  `premium_subtitle`, `premium_body`) when present in the seed —
  important for Minnebar 20 (see §6).

**API.** `functions/src/lib/firestore.ts` got `tags()` and `meta()`
collection refs. `functions/src/routes/conferences.ts` was extended:

- `toApiConference()` now includes `tags`, `categories`, `subgroups`.
- `GET /conferences?tags=react,kubernetes` — **AND** filter. Firestore
  only allows one `array-contains` per query, so the route uses the
  first tag as the indexed predicate and filters the remaining tags in
  memory.
- `GET /conferences?tagsAny=react,graphql` — **OR** filter (added in
  the second pass for the Venn easter egg). Uses
  `array-contains-any`, capped at 30 tags (Firestore's hard limit).

A new `functions/src/routes/tags.ts` provides:

- `GET /tags` — flat list (sorted by count desc) plus a nested
  `category → subgroup → tags` grouping for autocomplete UIs.
- `GET /tags/taxonomy` — the raw `meta/tag-taxonomy` doc.

**Indexes.** `firestore.indexes.json` gained four composites:

```
conferences (tags CONTAINS, start_date ASC)
conferences (categories CONTAINS, start_date ASC)
conferences (subgroups CONTAINS, start_date ASC)
tags (category ASC, count DESC)
```

**Bug squashed mid-flight.** The first version of the conferences route
parsed `q` and `bbox` into the zod schema but forgot to pass `tags` —
so the AND filter silently fell through to the unbounded list.
Fixed by including `tags: c.req.query("tags")` (and later `tagsAny`)
in the safeParse input.

## 4. Tag chip search in GlobalSearch

**Decisions** (confirmed before coding):
1. Lives inside the existing `GlobalSearch` component (not a new panel).
2. Multi-tag is **AND**.
3. Fetch all 249 tags once, cache across mounts.
4. Autocomplete grouped by category.
5. Result list = conferences that match all selected tags.
6. People-by-tag is the next milestone — for now, `/users` search is
   text-only, so the people pane is empty when only tags are selected.

**Implementation.**

`web/src/components/GlobalSearch.tsx`:
- Module-level `tagsCache` + in-flight promise to dedupe `/tags`
  requests across re-mounts.
- Chip strip lives **inside** the existing input wrap, before the
  `<input>`. Each chip is a button (click → remove). Backspace on an
  empty input pops the last chip — a small win for keyboard users.
- A `# tag` button on the right toggles the picker dropdown.
- Picker dropdown:
  - Top input filters tags by substring.
  - Tags grouped by category (AI / DEVOPS-SRE / WEB / …) with the
    category name as a small uppercase label and tags as small chips
    showing their `count`.
  - When a needle is typed, categories sort by number of matches.
  - Enter picks the top match across all categories. Esc closes.
- Results query uses both `q` (text) and `tags` together — when both
  are present, the backend filters by tag first then narrows by name /
  location substring.
- Placeholder text adapts: empty → "Search conferences, people, or
  tags…"; with chips → "Refine by name or location…".

People search intentionally skipped when no text query is present — the
backend `/users` route requires `q`, and surfacing 0 results would be
misleading. Wiring people-by-tag is queued as the next pass.

## 5. The Venn easter egg

**Ask.** "When a user searches by more than one tag, create an easter
egg visual that takes up the whole screen which is a Venn diagram of
the conferences matching the tags. If a conference only matches one of
the tags, obviously it's gonna be outside of the overlap. And the way I
invoke this is by hitting escape three times."

**Mechanism.** A window-level `keydown` listener on `GlobalSearch`
counts Escape presses, resetting on any other key or after a 1500ms
gap. When the count hits 3 and `selectedTags.length >= 2`, the
`VennEgg` overlay opens.

The streak ref is captured on a separate ref (not state) so the
listener doesn't re-bind every keystroke; a sister ref mirrors
`selectedTags` so the listener always reads the latest value without
needing it in its dependency array.

**Render.** `web/src/components/VennEgg.tsx`:

- Fetches `/conferences?tagsAny=…` (the union — needs the OR-filter
  added in §3).
- Buckets conferences by the **exact** subset of selected tags they
  carry, keyed by sorted bitmask of indices (`"0,1"` for "in both",
  `"0,1,2"` for "in all three").
- Picks 2-circle layout for 2 tags, 3-circle for 3+. Extra tags beyond
  the first 3 are noted in the footer ("+N extra tags not shown").
- Each region shows up to 8 conference names; overflow → "+N more".
- Esc closes; outside-click closes; bottom-right close button.

**Visual tuning.** First iteration of the 3-circle Venn placed the top
labels inside the circles and the bottom label off-screen. After two
geometry passes (`r=200, cy=360, dy=110, dx=115`), all three labels
sit cleanly outside their circles within the 1000×720 viewBox.

The triple-overlap region for `react ∩ javascript ∩ frontend` is dense
(20+ conferences) — labels visibly overlap there, but it reads as "a
lot of conferences in this overlap" which is the right impression for
an easter egg. Not worth the complexity of a real label-collision
solver.

**Quirk.** Hitting Escape one more time after the egg opens gets
counted by the streak listener, so the user could in theory re-trigger
the egg by mashing Esc. Acceptable — the egg dismisses cleanly each
time and there's no destructive action behind it.

## 6. Minnebar 20 → premium

The canonical seed had **0** confs marked premium — the `premium` field
didn't exist in `real-conferences.json` at all. Premium status was
applied separately by `seed-dummy-data.mjs` (lines 354–391), which is
local-emulator-only.

To make Minnebar 20 premium **in production** as well, the change
needed to land in the canonical seed:

- Added `premium: true` + `premium_image_url` (Minnestar logo SVG) +
  `premium_header: "FOR TECH. BY TECH"` + a 397-char `premium_body`
  (lifted verbatim from `seed-dummy-data.mjs:359-371`) onto the
  Minnebar 20 entry in `real-conferences.json`.
- Patched `import-conferences.mjs` to pass `premium` and the
  `premium_*` companion fields through to Firestore — but only when
  present in the seed, so re-imports won't clobber sponsor copy that
  was set in Firestore directly via the admin flow
  (`set-premium.mjs`).

`dev:seed` continues to apply its own overlay (Minnebar 20 + 19 + 18 +
17), which is now redundant for Minnebar 20 specifically. The two
writes are idempotent (same values, `set(..., {merge: true})`), so
nothing breaks. Minnebar 19/18/17 still pick up just the bare flag from
dev:seed for testing UI fallbacks.

## 7. Conference detail card

The detail sheet (`ConferenceSheet.tsx`) was already rendering chips
from the legacy `topics` field. Swapped it to prefer the canonical
`tags` array, falling back to `topics` only when a conference has no
tags (catch-all for any future imports that bypass the tagging
pipeline). React Summit US went from showing a single `JAVASCRIPT` chip
to the full `FRONTEND, FULL-STACK, HYBRID, JAVASCRIPT, REACT,
WEB-DEVELOPMENT` set.

## 8. PR

PR **#5** opened against `production`:
https://github.com/toml0006/confgo/pull/5

Three commits in the branch (`worktree-conference-tagging`):
1. `2e1b44f` — initial seed enrichment + chip UI scaffold
2. `12ba093` — `tags.ts` route, `tagsAny` OR-filter, Venn easter egg
3. `5144dab` — raw per-conference tag output (auditable intermediate)

## Files added

- `design/claude-transcript/2026-04-30-conference-tagging-chip-search-venn-egg.md`
  *(this transcript)*
- `functions/data/conference-tags.json` — raw per-conf Haiku output
  with `confidence` + `fetch_status` (auditable intermediate)
- `functions/data/tag-taxonomy.json` — locked 16-category taxonomy
- `functions/data/tag-vocabulary.json` — 249 canonical tags w/ counts
- `functions/src/routes/tags.ts` — `/tags` + `/tags/taxonomy`
- `web/src/components/VennEgg.tsx` — fullscreen Venn overlay

## Files modified

- `functions/data/real-conferences.json` — every conf gains
  `tags`/`categories`/`subgroups`/`tag_confidence`; Minnebar 20 gains
  `premium: true` + image + header + body
- `functions/src/lib/firestore.ts` — added `tags()` + `meta()` refs
- `functions/src/routes/conferences.ts` — `tags` (AND) + `tagsAny` (OR)
  query params; `toApiConference()` exposes new fields
- `functions/src/index.ts` — wire `tagRoutes`
- `functions/scripts/import-conferences.mjs` — pass through tag fields,
  taxonomy, vocab, and premium fields
- `firestore.indexes.json` — four new composites for tag queries
- `web/src/api.ts` — `Conference` gains `tags/categories/subgroups`;
  new `TagDoc` + `TagsResponse` types
- `web/src/components/GlobalSearch.tsx` — chip strip, grouped picker,
  Esc-streak listener, Venn mount
- `web/src/components/ConferenceSheet.tsx` — prefer `tags` over
  `topics`, fall back to `topics` for un-tagged confs
