# SDD ledger — plan: docs/superpowers/plans/2026-10-23-family.md
Baseline: existing tests launched before changes; contract baseline green. Evidence in /workspace/family-review-evidence.
Ruling: execute inline without another approval — user explicitly requested implementation and standing instructions authorize proceeding.
Ruling: cloud skills became unavailable after reading planning/execution/TDD/worktree instructions; use those loaded instructions and a native ledger instead of unavailable bundled scripts.
Pre-flight: members expose stable IDs to planner and shopping; events migrate into planner with stable ID and source marker; expense linkage uses the existing form and deterministic receipt identity.
Task 1: implemented; RED probes reproduced member loss and record truncation; GREEN integration tests cover merge, limits, failure/retry and archive undo.
Task 2: implemented; RED tasks button/migration probes reproduced missing canonical behavior; GREEN tests cover assignment and retry-safe migration. Legacy sources remain as migration markers.
Task 3: implemented; integration tests cover shopping undo, stale edits and linked receipt update without duplication. Completion itself has no financial side effect.
Review Focus: simultaneous offline member additions/archive, failed writes/drafts, migration retries after move/deletion, duplicate linked receipts and responsive RTL.
Ruling: member removal is reversible archival preserving assignment IDs and historical names; assignments can be changed through the canonical editor.
Final review: fresh reviewer /root/family_final_review found restore-epoch member resurrection and shopping draft loss. Both reproduced RED then passed GREEN. Narrow-name overflow regraded as required responsive behavior and fixed with a failing 320px test.
Ruling: finance navigation tests now use the visible family finance action because finance tabs are hidden in the family view; financial assertions unchanged.
Ruling: previous full test runs overlapped working-file edits; their failures are not accepted as a final gate. A frozen final candidate receives a new complete run.
Final: fixed open-family daily-sync refresh — new task missing from open list RED→GREEN. All 15 family browser cases pass. Financial/reading navigation checks pass after adapting the route; no numerical assertions changed.
Firebase emulator acceptance: 8/8 pass. Responsive screens: 390, 820 and 1440 pixels, light/dark, no document overflow or browser errors. Narrow member sheet: 320px regression passes.
