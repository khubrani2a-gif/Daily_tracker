# Finance and family: annual usage audit

Status: verification in progress; not a claim that production or personal devices have been verified.

## Scope and method

Synthetic isolated Chromium sessions, Riyadh timezone, controlled dates. No personal records were accessed or modified. Initial categories, salary expectation, prior-cycle income and rent template are seeded. New daily purchases, income receipts, plans, savings movements, payments, cancellations and Undo use visible UI controls. Every dated step is checked against independent integer-minor-unit arithmetic, with Saturday–Friday weeks and 27–26 salary cycles.

The durable annual scenario is `tests/scenarios/finance-year.cjs`:

```sh
AUDIT_OUTPUT=/tmp/finance-year-audit node tests/scenarios/finance-year.cjs
```

It advances 365 days from 2026-10-24 through 2027-10-23; includes delayed/split first salary, later salary increase, bonus, rent, savings deposits/withdrawals, exceptional expenses, duplicate confirmation/cancellation, abandoned drafts, undo, reload, report views and CSV. Its final snapshot is restored on another empty synthetic browser and compared for exact transaction/finance-entry preservation and equal period totals. UI clicking and separate restore-function checks are explicitly distinguished.

Separate travel lifecycle scenarios cover creating/editing/activating/completing/archiving/restoring trips, before/during/after expenses, optional weekly inclusion, allocations, currencies, linked refunds, both deletion modes and Undo. Financial/family test suites cover concurrent edits, interrupted storage/cloud writes, recurring obligations, budget history, family members/shopping/events and data protection. Cloud transport is simulated, supplemented by Firestore emulator rules tests.

## Defects reproduced and fixed

1. Completing a future trip could persist an end date before its start. Completion before departure is now rejected with a helpful message; dates are preserved.
2. Completing an ongoing trip left it active until the next day and lost completion intent after archive/restore. Explicit completion is persisted; explicit Activate reopens it.
3. Dashboard trip banner opened the trip list instead of the selected detail. Route initialization now precedes selecting its detail.
4. Foreign exchange inputs such as `-3.75`, `1e3`, `1,2`, `1.2.3` and `abc3.75` were coerced into other positive numbers. Calculation and Save now strictly validate rates; Arabic/Persian decimal input remains supported. Invalid or out-of-range conversion preserves manual SAR. A blank rate still permits manually recorded SAR with original currency/amount.
5. A previous expense Undo toast could cover the next form's Details or Save on mobile. It is hidden only while the expense form is open; its callback remains intact and reappears if the form closes before expiry.

6. Pausing a custom expense category hid every route for reactivation. The existing settings recovery list now includes paused categories and labels their state; reactivation preserves historical transactions and budget periods.

These fixes do not rewrite historical transactions, budgets or imported amounts. Existing malformed historical trip dates cannot be safely inferred or automatically repaired.

## Coverage limits

A successful click proves its exercised path, not every input combination. Browser-only mocks do not establish real Google authentication, actual two-device account convergence, OS print dialog behavior, or correctness of the user's starting records. Those remain live-device/account checks. No claim of literally every possible scenario or a year of elapsed real-world use is made.

## Verification results

Pending final run and independent review. Baseline RED evidence and rerun GREEN evidence retained in the audit workspace.
