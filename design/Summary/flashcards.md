# Minnebar 20 / Venn•bar talk — flashcards

Distilled from the nine `30 min` Gemini summaries (Mar 25 → Apr 30, 2026).
Each card is one scannable beat — topic, idea, or anecdote — for use as a quick reminder
on stage. Ordering is by category, not priority; cherry-pick what fits the room.

---

## 🎯 Big themes (frame the talk)

- **Prove the thesis by shipping.** Push existing projects out; the next thing isn't worth
  building until the current one has reacted-to evidence. *(Mar 25)*
- **"What counts as complete?"** The central framing question for the talk in an agentic
  world. *(Mar 25)*
- **AI augments, doesn't replace.** Productivity / value gain belongs to humans. The right
  response to AI is *more* people, capitalizing on new capabilities — not fewer. *(Mar 25)*
- **"The point of AI is it's adequate."** Ben's LinkedIn premise; Jackson agreed. *(Apr 21)*
- **AI is not magic — it predicts patterns.** Tuned to answer questions positively. The
  party-trick demo (see Anecdotes) collapses the mystique fast. *(Apr 28)*
- **"Just fix it" beats "who broke it."** AI dissolves the cost of a fix to the point
  where blame culture is obsolete. The old "you break it, you own it" mentality made
  sense when fixing was expensive. *(Apr 28)*
- **AI lets engineers write *more* fun code, not less.** It eats peripheral work — tests,
  dummy data, ETL glue — and leaves the interesting decisions on the table. *(Apr 28)*
- **Velocity should be reinvested.** Faster ship dates aren't the win — better test
  coverage and scenario planning is. *(Apr 20)*
- **Programmer's value is expertise.** Guiding LLMs to better results is the craft.
  Jackson's 3D-rendering knowledge cracked a MapKit occlusion problem the LLM swore was
  impossible. *(Mar 25)*

## 🛠 Workflow / process

- **Plan mode vs raw prompting.** Ben Slack-pasted the whole project description → broken
  app (missing map, dead buttons). Jackson did contextual prompt → plan mode → trimmed
  scope review → working app. Demo-able A/B. *(Apr 14)*
- **Cross-model plan review.** Use Claude to make a plan, Codex to review pros/cons.
  Surfaces "conspicuous changes" before code. *(Apr 8)*
- **Throwaway code is fine.** Not every line needs a commit; retaining junk confuses
  future LLM passes. *(Apr 8)*
- **Output styles that summarize discoveries.** Skim for red flags without reading every
  line of generated code. *(Apr 14)*
- **Tag interdependencies for parallel agents.** Frame the plan as dev tasks with deps;
  the planning itself becomes a self-review. *(Apr 14)*
- **Cloud Code > IDE wrappers.** Purpose-built tools beat IDE-layered system prompts on
  top of Opus (e.g. Cursor). *(Apr 14)*
- **Git worktrees for parallel efforts.** Multiple agents running side-by-side without
  stomping on each other. *(Apr 14)*
- **Save chat history.** Claude/Codex CLIs persist transcripts. Use them as proof and as
  presentation material. *(Apr 8)*
- **Time-box the LLM's failures.** When 430-of-834 conference fetches failed during
  tagging: don't dive in fixing — check the successes are reasonable, then ship. "Good
  enough for now" beats blocking on the long tail. *(Apr 30)*
- **Two-pass tagging (free-form, then taxonomy).** Cheap model generates loose tags
  across all items first; smarter model collapses them into a normalized taxonomy.
  Avoids over-constraining the first pass. *(Apr 30)*
- **Politeness is cheap.** A few extra tokens per prompt; long-term hygiene if it ever
  matters; doesn't seem to hurt output. Default to polite. *(Apr 30)*
- **AI is like driving on icy roads.** The point is to get where you want to go not be in absolute control the entire time.


## 🤖 LLM strategy

- **Backend / data structures first.** UI is trivial once the API is well-documented and
  structured. *(Mar 25)*
- **Strong language sometimes improves results.** Jackson's anecdote on getting un-stuck
  after a polite prompt failed. *(Apr 14)*
- **Fewer prompts than expected.** Ben's app: ~27 prompts. Jackson's: one-shot from a
  single specific paragraph. *(Apr 20)*
- **"LLM-speak. Talk to it like it's the average/adequate version of the expert you want it to be."** Use the model's own vocabulary back at it. Better outcomes. *(Apr 14)*
- **Phrasing changes the answer.** "State-of-the-art" pulls a very different context than
  "best practice." Word choice is a config knob. *(Apr 28)*
- **Non-directive prompts delegate decisions.** "I want…" / "It would be nice if…" gives
  the model room to choose well, instead of pinning it to a specific implementation that
  may not match the codebase. *(Apr 30)*
- **AI estimates are *human* time.** It says a change is 1.5 days of work and then
  finishes it in 90 seconds. Like book hours in mechanics — useful for planning, lousy
  as a wall-clock predictor. *(Apr 28)*
- **The skill is *how to talk to it*, not your config.** People ask "what's in your
  Claude.md?" — the wrong question. The reusable skill is interaction style; configs are
  individual artifacts. *(Apr 30)*

## 🎙 Anecdotes for color

- **AI-simulated frontend/backend team.** Ben fed a proposal in and had the model
  role-play both sides of an engineering debate. Surfaced realistic tradeoffs and
  practical solutions — a use case nobody pre-AI had access to. *(Apr 28)*
- **Jackson's "told it was impossible" scraper.** As VP Eng, no one would build it; he
  was warned scraping was a fool's errand. Today: tells AI to "figure it out," gets
  purpose-built code that's *better than good enough* because it's fitted to four
  government sites — not a generic reusable system. The throwaway *is* the win. *(Apr 28)*
- **Apple credit card / Finance Kit API.** Jackson's tax-reconciliation pain. Built a
  tiny app, hit Apple's app-review wall — illustrates platform gatekeeping vs. solo-dev
  ambition. *(Apr 14)*

## 🌐 Confgo / Venn•bar product story

- **Anonymous-first auth.** You ARE an account on first visit. Google/GitHub buttons
  aren't sign-up — they're *portability* upgrades. *(Apr 16)*
- **Stable doc IDs by date-only hash.** Lesson learned the hard way: Minnebar dupes from
  drift across import eras. Talkable failure → fix.
- **Live-build candidates (ranked).** Feed of new users/activity (Firestore reactive
  snapshots), CI/CD pipeline setup, real conference data ETL with AI prompts, Mapbox
  dot styling. *(Apr 16)*
- **Conference catalog: 652 → 834 → 3,000 target.** Sourced from confs.tech, then
  vendor-flagships, security archives, Wikipedia CS conferences, Linux Foundation, data/ML
  series, and Minnestar. NA-only target is ~3,000 events. *(Apr 28)*
- **"Drop a demo user when a real user joins."** Playful idea — the feed never empties,
  and the platform telegraphs growth honestly. Wouldn't survive product-grooming, which
  is part of the charm. *(Apr 28)*
- **Multi-chip search: AND first, OR later.** MVP discipline — the default narrows
  results; the OR (any-of) can come once the AND is right. *(Apr 30)*

## 🚧 Lessons / hot takes

- **Don't drag-and-drop, write components.** Squarespace / Wizzywig hostility. Time goes
  to content, not framework selection. *(Apr 20)*
- **Hyper-personalized apps explosion.** Number of apps spikes, then declines as AI
  generates one-off specialized tools on demand. *(Mar 25)*
- **Welcome audience bug reports — even ask for a PR.** Reframes "found a bug" from
  shame to collaboration; matches the "just fix it" theme of the talk. *(Apr 28)*

## ⚙️ Demo-plumbing reminders

- **`COMING_SOON_ONLY` flag.** Single const in `web/src/main.tsx`. Flip to `false`,
  push to main, deploy auto-flips audience.
- **Build-number live refresh.** `bump-version.mjs` mutates `web/public/version.json`;
  root-level poller in `main.tsx` reloads on mismatch. Bidirectional (live↔gated).
- **Bidirectional reload trade.** Every deploy hard-refreshes everyone with the tab
  open. Fine for the demo; demote to a "new version available" banner once routine
  deploys resume.

## 🎤 Presentation strategy

- **"Cooking show" framing.** Some prep is pre-baked; the entire process is in git, so
  nothing's hidden. Manages expectations and gives you license to skip past plumbing on
  stage. *(Apr 28)*
- **Be transparent about AI in the PDD itself.** Owning the AI-generated spec resonates
  more than pretending. *(Apr 20)*
- **Live build is the point, not the polished result.** Process > artifact. Disingenuous
  to present a finished product in a from-scratch session. *(Apr 8)*
