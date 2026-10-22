# Independent weekly and salary-cycle finance views

Scope: retain one transaction ledger; show the configured Saturday–Friday week separately from the 27–26 salary cycle, keeping calendar-month reports optional. No transaction migration or balance rollover.

- Dashboard shows weekly budget and salary-cycle estimates with explicit date ranges and a non-bank-balance explanation.
- Obligations are reserved only for unpaid amounts; overdue periods are included and listed. Snapshot calculation does not save generated instances.
- Salary-cycle reports support navigation, row actions, search and CSV through the shared report-range function.
- Variable-category cards compare weekly and salary-cycle plans. Hidden active categories retain their budgets in totals.
- Budget allocation uses cumulative integer rounding so the two portions of a crossing week sum to its original budget.
- Fixed-amount edits gain effective-month history and update previously generated future instances. Reversals recalculate actual payments after snapshot restoration.

Validation: new isolated browser tests cover a payday crossing week, Saturday/Friday payday, year transition, leap February, no transaction duplication, unchanged availability after partial obligation payment, overdue debt, hidden budgets, historical and pre-generated fixed amounts, old-payment undo and rounding conservation. Viewports 320/390/820/1366 inspected without horizontal document overflow.

Limits: salary remains a configured estimate, not a bank ledger. Existing salary/week-start settings remain configurable. Automatic recurring expense behavior and the separately audited cloud-write/settings-merge issues are not changed in this release. No user account data was edited during validation.
