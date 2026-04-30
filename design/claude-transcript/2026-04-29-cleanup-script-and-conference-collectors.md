# Dummy-data cleanup, marketability/pricing, and a multi-collector refactor

**Date:** 2026-04-29
**Scope:** A `clear-dummy-data.mjs` cleanup script promised by the PDD but
never written; an exploratory conversation about marketability and an
organizer-pays pricing model; a refactor of the conference-data collector
into a multi-source pipeline with four new hand-curated catalogs adding
~165 NA conferences on top of the confs.tech baseline.

---

## 1. Dummy-data cleanup script

**Ask.** "Did we set up the dummy users to be easy to identify and clean up
later? Do the IDs start with something specific?"

**State of the world.**
- All seeded users carry the `seed_` prefix on their document ID:
  - 10 named users (`seed_alex_stark`, `seed_priya_rao`, …)
  - 290 filler users (`seed_u000`, `seed_u001`, …)
- Related docs reuse those IDs:
  - `attendances/{seed_user}__{conf}` — `functions/scripts/seed-dummy-data.mjs:271`
  - `pings/{seed_from}__{seed_to}` — `:339`
  - `ping_contacts/{seed_from}__{seed_to}` — `:346`
  - Firebase Auth UIDs are also `seed_*` — `:233`
- The PDD (`design/ConferenceAttApp-PDD-v3.md:466-468`) describes a
  `clear-dummy-data.mjs` cleanup utility, but the file didn't exist —
  only `seed-dummy-data.mjs` was present in `functions/scripts/`.

**Change set.**

- `functions/scripts/clear-dummy-data.mjs` (new) — deletes seed-prefixed
  docs from `users`, `attendances`, `pings`, `ping_contacts`, plus matching
  Firebase Auth accounts. Flags:
  - default → all `seed_*` collections + Auth
  - `--users-only` → only `users` + Auth (leaves attendance/ping data)
  - `--confs-only` → only the imported `rc_*` conferences (the import-
    conferences companion path)
  - `--dry-run` → counts without writes
  - `--production` → targets live (otherwise emulator at `localhost:8180`/
    `9099`, mirroring the seed script)

**Implementation notes.**

- Firestore prefix-delete uses doc-ID range queries:
  `orderBy(documentId).startAt(prefix).endAt(prefix + '')` with a
  450-doc batch limit (matching the seed script's batch size).
- Live deletes are simple: deleted docs disappear, so each iteration
  re-runs `startAt(prefix)` and naturally paginates by exhaustion.
- Dry-run can't paginate by deletion, so it uses `startAfter(lastDoc)`
  cursors — the only place the two paths diverge.
- Auth deletion uses `auth.listUsers(1000)` paginated, filtering uids by
  prefix client-side (Auth has no server-side prefix filter), then
  `auth.deleteUsers(uids)` in batches.

**Smoke test (emulator dry-run):**
```
attendances: would delete 14954
pings: would delete 9
ping_contacts: would delete 9
users: would delete 300
Auth: would delete 300
```
Matches what `seed-dummy-data.mjs` produces (300 users × ~50 attendances
each + 9 PDD-specified pings).

---

## 2. Marketability and pricing — recorded for context, no code

A pair of exploratory conversations the user wanted me to think through
honestly. No code came out of these; recording the conclusions because
they shape future product decisions.

### 2.1 Marketability

The product's strengths are a distinctive aesthetic, anonymous-first
onboarding, the pre-seeded conference data solving cold-start, and the
"can't tell ignore from reject" ping primitive. The main risks are a
narrow TAM (NA tech conference attendees, maybe ~1M people, most of whom
attend 1–2 events/year), a per-conference network-effect requirement
that makes growth lumpy, and existential risk from LinkedIn shipping
events-with-pings using their existing graph.

Honest read: **small-but-real lifestyle business**, not venture-scale.
Most coherent path is free for individuals + modest organizer/community
B2B revenue. Skip recruiter mode — collides with the privacy ethos.

### 2.2 Organizer-pays pricing model

The user asked for a concrete model where organizers pay, users are free.

| Tier | Price | Notes |
|---|---|---|
| Claim (Free) | $0 | Verified badge, fix data, basic count |
| Spotlight | $49/event or $199/yr | Brand colour/logo on dot+sheet, basic analytics, "Featured this week" eligibility |
| Insights | $499/event or $1,999/yr | Full anonymized dashboard incl. **co-attendance graph**, ping density, embeddable "going" widget, pre-event push to going-list |
| Enterprise | $5K–$25K | Custom branding, sponsor co-marketing, multi-event discount, CSM |

A-la-carte: **sponsor seat** ($500/sponsor/event on Insights tier — the
host event's sponsors get the analytics dashboard); **sponsored regional
placement** ($25–$250/week); **community grant** (free Spotlight for
non-profit / volunteer events under 500 attendees — Minnestar is the
prototype).

Design rules that became rationale we should keep:
- Baseline visibility stays free. Charge for uplift, not appearing.
- Never sell attendee identities. Aggregate only.
- Ping primitives stay user-side. Organizers don't ping or message.

Indicative year-1 mix (modest traction): **≈ $90K ARR**, gross margin
>90%. Path to ~$500K depends mainly on Enterprise + sponsor-seat volume.
Bottleneck is the sales motion, not infra cost.

Sequencing recommendation: ship Claim + Spotlight first, prove per-event
density on 10–20 events, then unlock Insights + sponsor seats.

---

## 3. Conference data — multi-collector refactor

**Ask.** "Help us find a lot more conferences over the last 5 years and any
in the future, fitting our current list."

**State of the world.** `functions/scripts/collect-conferences.mjs` was a
single-source script: pull from `github.com/tech-conferences/conference-
data`, filter to NA in-person, dedupe, geocode via Mapbox, write
`functions/data/real-conferences.json`. 652 entries. The Minnestar event
list was inlined at the bottom of the script.

The user wanted to expand the catalog without breaking the existing
import path or doc IDs (`rc_${sha256(name|startDate).slice(0,16)}`).

### 3.1 Collector architecture

Refactored into adapter shape under `functions/scripts/collectors/`:

```
collectors/
  confs-tech.mjs           extracted from existing logic
  minnestar.mjs            extracted from inline block
  vendor-flagships.mjs     new
  security-archives.mjs    new
  wikipedia.mjs            new
  linux-foundation.mjs     new

collect-conferences.mjs    orchestrator
```

Each collector exports `async collect()` returning normalized pre-
geocoded records:
```
{ name, city, country, startDate, endDate, topics[], url, online, source }
```

**Orchestrator responsibilities** (`collect-conferences.mjs`):
1. Run every collector.
2. Apply `isInPersonNorthAmerican` filter once at the merge step (not in
   each collector — one chokepoint, easy to flip later if scope changes).
3. Cross-source dedupe on `name.toLowerCase() | startDate`. When the same
   event appears in multiple sources, topics are unioned and source
   attribution falls back to `confs.tech` (established baseline) if
   present, otherwise the first collector to claim it.
4. Geocode unique cities via Mapbox.
5. Write the same output schema as before — `import-conferences.mjs` is
   unaffected, doc IDs stay stable, re-running is idempotent.

### 3.2 Vendor-flagships catalog

Hand-curated catalog of major NA tech vendor flagship events. 21 events,
72 editions covering 2021–2026:

> AWS re:Invent, Microsoft Build, Google I/O, Apple WWDC, Salesforce
> Dreamforce, GitHub Universe, HashiConf, Snowflake Summit, Databricks
> Data + AI Summit, NVIDIA GTC, Cisco Live US, Adobe MAX, Oracle
> CloudWorld, HubSpot INBOUND, SaaStr Annual, Salesforce TrailblazerDX,
> Atlassian Team, DockerCon, ServiceNow Knowledge, Twilio SIGNAL,
> KubeCon + CloudNativeCon NA.

**Yield check before building** — counted matches in the existing data
file for each vendor: re:Invent 0, Dreamforce 0, WWDC 0, Google I/O 0,
HashiConf 0, Cisco Live 0, Adobe MAX 0, Oracle CloudWorld 0, INBOUND 0,
SaaStr 0, TrailblazerDX 0, Atlassian Team 0, DockerCon 0, ServiceNow 0,
Twilio 0. Microsoft Build 1, GitHub Universe 1, NVIDIA GTC 6, Databricks
7, KubeCon 4. So the vast majority were net new.

### 3.3 Security-archives catalog

10 series, 35 editions — moved DEF CON / Black Hat / RSA out of vendor-
flagships into here so each collector stays topically coherent:

> DEF CON, Black Hat USA, RSA Conference, USENIX Security Symposium,
> ShmooCon, BSides Las Vegas, BSides San Francisco, OWASP Global AppSec
> NA, THOTCON, WildWestHackin'Fest.

### 3.4 Wikipedia catalog (academic / research)

21 series, 54 editions. Confs.tech yield check showed near-zero coverage
(only CVPR had 1 entry; everything else 0):

> NeurIPS, ICML, CVPR, AAAI, SIGGRAPH, IEEE S&P, USENIX ATC, OSDI, NSDI,
> SOSP, POPL, PLDI, SPLASH, ICSE, NDSS, ACM SIGMOD, VLDB, ACM SIGCOMM,
> ACM CCS, USENIX FAST, The Web Conference (WWW).

EU / APAC editions deliberately excluded — only NA editions of each
series are listed. Series whose NA editions had uncertain dates were
omitted rather than guessed (e.g., several PL/SE conferences had only
1–2 confident NA editions in the window).

### 3.5 Linux-foundation catalog

8 series, 17 editions covering LF + adjacent open-source ecosystem:

> Open Source Summit NA, All Things Open, OCP Global Summit, DevConf.US,
> Linux Plumbers Conference, Open Infrastructure Summit, plus SCaLE 19x
> and 21x (filling gaps in confs.tech's existing SCaLE 20x / 22x
> coverage).

KubeCon NA stayed in vendor-flagships since it was already there.
SCaLE 20x / 22x and SREcon Americas already in confs.tech, left alone.

### 3.6 Combined yield

| Collector | Records | Unique events |
|---|---|---|
| confs.tech (existing) | ~650 | ~620 |
| vendor-flagships | 72 | 21 |
| security-archives | 35 | 10 |
| wikipedia | 54 | 21 |
| linux-foundation | 17 | 8 |
| minnestar | 8 | 8 |

After cross-source dedupe with confs.tech (~7 small overlaps, all in
vendor-flagships: Microsoft Build 2023, Databricks 2023–2025, NVIDIA GTC
2024, KubeCon NA 2023–2025), realistic net adds **≈ 165 new conferences**
→ ~815 total post-merge.

### 3.7 Known caveat — naming drift

Cross-source dedupe collides when names differ across sources. One
concrete example surfaced: confs.tech labels NVIDIA's 2025 event as
"NVIDIA GTC AI Conference" while the new collector uses "NVIDIA GTC".
Different names → both survive as separate docs. Resolvable by aligning
spelling on either side, or by adding a small alias map in the
orchestrator's `dedupeKey()` once collisions accumulate.

### 3.8 To regenerate

```
MAPBOX_TOKEN=pk.xxx node functions/scripts/collect-conferences.mjs
```

Stable doc IDs make this idempotent — re-running won't duplicate; only
brand-new records (or records with corrected dates → different IDs) get
new docs.

---

## 4. Files touched

```
functions/scripts/
  clear-dummy-data.mjs                 (new)
  collect-conferences.mjs              (rewritten as orchestrator)
  collectors/
    confs-tech.mjs                     (new — extracted)
    minnestar.mjs                      (new — extracted)
    vendor-flagships.mjs               (new)
    security-archives.mjs              (new)
    wikipedia.mjs                      (new)
    linux-foundation.mjs               (new)
```

No changes to `seed-dummy-data.mjs`, `import-conferences.mjs`,
`migrate-ping-contacts.mjs`, or any application code.
