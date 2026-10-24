# Finance and family: annual usage audit

Status: annual simulation, restoration and independent source review complete; remote release checks pending. Personal devices/accounts are not certified.

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

- Final annual run: **365 days, 16,514 assertions, 2,337 visible UI clicks, no page errors**. 390 live transactions; 15 income entries (one initial seed, 14 newly recorded); 23 savings movements. Covers 53 weekly ranges and 13 salary-cycle ranges because both end periods are partial.
- Overspending was intentional: 10 days with negative weekly remaining and 6 days with negative cycle availability; values were preserved and matched the independent oracle.
- Full-year backup restored on a separate empty synthetic browser: exact live transaction records and finance entries preserved; end-period totals matched. Source and restored data both pass normal reload normalization before comparison. This does not claim byte-for-byte equivalence of all unrelated snapshot collections.
- Focused new regressions: **12/12 passed**, independently rerun by the fresh reviewer.
- Initial full application run: **630/630 passed**. Final run after the additional paused-category fix: **630/631 passed**; one existing dhikr UI test timed out under concurrent browser load. Its isolated suite passed 5/5; canonical CI remains the release gate. No financial assertion failed.
- Firestore emulator: **8/8 passed**.
- Separate coverage: **164 reachable stable button selectors and 32 menu actions exercised**; 174 existing regression tests, 35 supplemental scenarios and two focused conditional branches passed. Two defensive built-in-delete controls and one inactive-menu alternative have no public route and are marked inspected, not clicked. The new Settings recovery route was actually exercised.
- Travel: **51 lifecycle/year checks, 9 FX validation cases and 8 linked refund/payment/delete/Undo checks passed**. These are separate scenario counts, not additional unique buttons.
- Fresh reviewer found **no critical or important source findings** and independently reran all 12 new tests successfully. Documentation completion was the only minor item.

Baseline RED evidence, GREEN reruns, action ledger, synthetic backup, annual CSV and screenshots remain under `/workspace/finance-year-audit/`. No claim that every value/error combination or real account session was exercised.
