# Qiyam simplicity implementation plan
> Execute inline using superpowers:executing-plans; independently review the final branch.
**Goal:** a clear choose → read → record flow, preserving Quran and all existing data semantics.
**Architecture:** keep the monolithic app and core engines; introduce a guarded preview sheet shared by goal/source/hifz changes; reorganize the existing DOM without duplicate IDs.
**Tech Stack:** vanilla HTML/CSS/JS, Node tests, Playwright, GitHub Actions.
**Spec:** docs/superpowers/specs/2026-10-26-qiyam-simple-design.md
## Global constraints
Preserve motivational card wording, source text/font, record IDs/tombstones, date semantics, and accounting. Do not edit personal data.
## Review focus
- Stale previews during sync/account/night changes cannot overwrite new data.
- Cancelling source/goal/hifz changes must preserve current draft and distribution.
- Partial reading must remain clear without falsely counting browsing.
- Nested tools must work in focus, narrow screens, and keyboard navigation.
- Text/font failures must not show stale or truncated verses.
## Task 1: Safe plan transitions
Files: index.html; tests/qiyam-preview-v192.test.js.
- [ ] RED: target selection preserves existing draft before acceptance.
- [ ] Implement witrProposePlan(plan,afterAccept) with snapshot/owner/night checks, atomic qiyamCommit, cancel and double-submit protection.
- [ ] Route target/source and hifz creation through it; retain same-plan continuation.
- [ ] GREEN: unit preview/cancel/accept/stale/failure tests.
## Task 2: Reorder the UI
Files: index.html; tests/qiyam-simple-v192.test.js; affected qiyam browser fixtures.
- [ ] Current card for all saved plans, clear progress and single primary action.
- [ ] Preserve four cards; group source/options, reader tools and history.
- [ ] Make current-plan and reader actions named, themed, keyboard accessible; use inline SVG for tools.
- [ ] Retry text load and list every source range in fallback.
- [ ] Browser tests: explicit preview, hifz paths, partial reading/undo, focus/tools, responsive themes.
## Task 3: Verify and publish
- [ ] Run focused tests and full npm test/Firebase via CI if local browser is unavailable.
- [ ] Independent review; fix confirmed important defects with regressions.
- [ ] Merge only passing exact head and verify deployed release/file hashes.
