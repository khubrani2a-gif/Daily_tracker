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
