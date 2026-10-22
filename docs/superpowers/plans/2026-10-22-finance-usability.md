# Finance usability v168 — approved scope

User asks to review and implement all seven proposed improvements, with earlier standing authorization to implement, fix, test and publish without repeated approvals. Existing v167 accounting contracts remain authoritative. Worktree: /workspace/finance-usability. Base dc69902.

## Task 1: integrated user flows
Implement in existing application, reuse accounting helpers; no new paid services or production data modifications.
1. Optional first-use setup, also reopenable: expected income for current cycle, savings reservation, weekly category budgets; display existing obligations and link to manage them. Preview before save; no actual income or savings movement created; cancelling leaves data intact. Existing settings prefilled, no destructive reset. Avoid repeated popups.
2. Clearly distinguish weekly limit remaining vs salary cycle availability; explanatory calculation links and labels. Not bank balance. Never add totals of overlapping periods.
3. Unified financial ledger: purchases/refunds, income, savings movements with type/date/text filters, meaningful empty state. Preserve original row identity and use existing edit/correct/delete/undo paths; do not merge funds or duplicate rows. Explicit correction path for savings if editing unsupported. Filter refunds separately; signs/types clear.
4. Split-week detail: full Saturday–Friday (or configured boundaries) remains intact, breakdown of spending for each salary-cycle intersection by actual dates. Distinguish variable budget-counting spend vs total. No write or budget division/reset. Contiguous slices sum to week spend, including transition settings.
5. Payday review action: current cycle income total, receipt entry link, commitments review, plan update and previous-cycle review; no automatic income/carryover and no assumption payday means paid.
6. One prioritized in-app financial alert with direct relevant action: exceeded/near category weekly limit, due/overdue bills and negative availability. No OS notifications/new permissions; don't repeat banners for same issue. May put lower priorities in expandable details.
7. Comparable report: current elapsed period vs same number of immediately preceding days, explicit date ranges/day counts; never future days; separate net purchase spending from savings, leading category increase, no misleading percentages from zero. Reuse reporting controls where possible.

Meaningful browser tests covering setup cancellation and save, ledger filters/corrections, boundary splits at27 & Saturday, comparison arithmetic/empty baselines, responsive320/390/820/1366. Baseline existing finance tests, then full regressions plus Firestore emulator. Independent final review, screenshots. Publish only after green.

## Task 2: independent review and release
Review calculations/storage/escaping/keyboard/mobile, correct demonstrated defects, run full app+firebase tests. Bump cache/footer release to168; publish using existing GitHub PR flow and verify deployment and live entry points.

## Ledger
- Design: extend existing flows rather than separate financial subsystem. No account-level balance model added.
- Task1 complete: 40a79dc, 39fb889. All seven features plus independent review fixes; 78 focused tests passed.
- Task2: independent review complete (no open findings); Firebase 8 passed, full regression and deployment enforced as release gates.
