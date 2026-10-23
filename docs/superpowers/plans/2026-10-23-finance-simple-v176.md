# Finance and Family Simplicity Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task, with a final independent review.

**Goal:** Deliver the approved cream/teal finance mockup with a compact summary, one ordinary expense entry, ledger and plan destinations, and intact accounting.
**Architecture:** Keep all accounting, source records and specialized payment/shopping/refund operations. Move existing cards to Plan; use the existing unified ledger renderer for both page and dialog. UI calculations consume expFinancePeriods only.
**Tech Stack:** Single HTML application, vanilla JS/CSS, Node test runner and Playwright.
**Spec:** User-approved comparison image and preceding safety requirements in this conversation.

## Global Constraints
- Saturday–Friday and salary 27–26 remain independent, not additive; use configured effective periods.
- No changes to formulas, schema, authentication, synchronization or automatic receipt of salary.
- Specialized payment and shopping entry retain source identities.
- Show expected versus received income, dates, negative values and critical alerts.
- Reuse existing undo machinery; addition undo must remove money and reject changed records/owners.
- Responsive 320/390/820/1440, dark mode, keyboard controls, visible focus.

## Review Focus
- Same-day ledger corrections preserve filters and source identity after refresh.
- A late edit/refund or owner change must prevent stale undo.
- Opening Plan must not create new money movements.
- Hidden plan cards must remain reachable from alert and obligation routes.
- Spending drafts survive switching to advanced/split form, and failed persistence is recoverable.

### Task 1: Compact summary and navigation
**Files:** index.html; tests/finance-simple.test.js
**Interfaces:** expSetView('dash'|'ledger'|'plan'); expRenderDash(); expRenderPlan(); expRenderUnifiedLedger(host)
- [ ] Test navigation with hand-calculated cross-cycle records; assert no monetary mutations and working ledger correction.
- [ ] Watch new navigation test fail.
- [ ] Implement summary, contextual due item, latest three records, three destination navigation, Plan with existing cards, stable secondary menu.
- [ ] Run focused new tests and existing finance interface/usability tests.

### Task 2: Ordinary expense flow and safe undo
**Files:** index.html; tests/finance-simple.test.js
**Interfaces:** expOpenQuickExpense(); existing expAtomicFinance / expAddTransaction / expDeleteTransaction / expShowUndoAction
- [ ] Test primary entry, real amount restoration/reload/merge, stale-record guard, draft transfer and save failure.
- [ ] Watch new entry/undo tests fail.
- [ ] Implement short form, optional details, safe addition undo, preserve specialized paths.
- [ ] Run new tests plus finance undo, adjustments, integrity and family tests.

### Task 3: Responsive review and release verification
**Files:** index.html, sw.js, tests/finance-simple.test.js
- [ ] Exercise light/dark viewports and actual UI actions, inspect screenshots.
- [ ] Independent whole-diff review; address significant findings with tests.
- [ ] Full npm test; Firebase rules suite; syntax/diff checks; version 176 cache consistency.
- [ ] Commit, publish via authorized GitHub workflow after green checks, verify deployed bytes and basic live load.

## Execution ledger
- Baseline: 15 finance interface/usability tests passed.
- Authorized direct execution: user approved design and implementation; no redundant approval gate.
- Tasks 1 and 2 implemented. Behavioral tests observed red then green; 25 finance simplicity/usability tests pass after final fixes.
- Independent review found ordinary draft inheriting active-trip accounting and ledger row focus loss. Both reproduced with failing tests and fixed; active trip save now remains ordinary weekly spending.
- Ruling: no formula/schema refactor; 31 accounting/source-identity functions byte-match v175. Specialized flows remain separate.
- Ruling: existing route-based tests follow the new Plan/More/advanced-details entry points; their financial assertions are unchanged.
- 38 family + simplicity tests passed before the final two review regressions were added; final full application run in progress. Eight Firebase tests passed.
- Visual checks: 320/390/820/1440, light/dark, summary/ledger/plan/family: no horizontal overflow or page errors. Screenshots in /workspace/finance-simple-evidence.
