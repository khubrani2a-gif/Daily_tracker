# Finance Year Usage Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this audit task-by-task.

**Goal:** Simulate a year of financial use through UI actions, audit trips and family controls, and publish an evidence-based coverage ledger with honest gaps.
**Architecture:** Isolated Playwright browser contexts and synthetic ledgers. Compare observed financial values to independently computed integer-minor-unit expectations. Parallel audit domains write separate artifact folders; no shared production edits.
**Tech Stack:** Existing plain HTML/JS application, Playwright, node assert, Python reporting.
**Spec:** User request in this turn: every finance/family button and hidden branch, realistic year including travel.

## Global Constraints
- Never touch personal account records.
- Current production release 180; no redesign or unproven fixes.
- Distinguish seeded setup, UI action, direct-function test, and code inspection.
- No claim of exhaustive infinite input/combinations; enumerate tested control families and uncovered actions.

## Review Focus
- Date changes across salary/week/month/year boundaries must not duplicate spending.
- Abandoned forms, cancel, duplicate save, and undo must preserve money.
- Travel include/exclude, foreign conversion, unlink and delete variants must preserve historical totals.
- Stale device and failed persistence must not acknowledge lost or overwritten money.
- Restoring a full-year ledger must preserve money and identifiers; do not certify real device/account sessions.

### Task 1: Coverage inventory
- [x] Agent coverage inventories static/dynamic finance/family action families and maps executed tests.
- [x] Exercise missing family/settings/category/recurring/goals/protection paths via UI, record result and gaps.
- Files: /workspace/finance-year-audit/coverage/*; no production changes.

### Task 2: Year lifecycle
- [x] Root runs 365-day UI-driven ordinary expense/income/saving lifecycle with independent expected totals per date.
- [x] Add edit/cancel/duplicate/undo, refresh, annual exports and restoration checks; keep evidence by date/action.
- Files: /workspace/finance-year-audit/year-ui.cjs and year-result.json.

### Task 3: Trip lifecycle
- [x] Agent trips exercises creation/edit/allocations, before/during/after expenses, FX, include/exclude weekly, filters and both deletion/undo paths.
- Files: /workspace/finance-year-audit/trips/*; no production changes.

### Task 4: Reconcile and review
- [x] Root verifies agent evidence and reproduces any consequential defect before changing source.
- [x] Fresh reviewer examines coverage, oracle independence, numerical claims, and untested controls.
- [x] Report findings, action coverage, limitations, and any proved blockers. Never replace an uncovered branch with a generic test-count claim.
