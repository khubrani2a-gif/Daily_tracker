# Finance comprehensive audit — v173

Scope: weekly and salary-cycle boundaries, income allocation, expenses/refunds, savings, fixed and recurring obligations, travel, reports/export, backups, save failure and synchronization/undo. Synthetic data only; no customer records touched. Existing finance suites are reused where inputs and logic remain relevant; this is not an exhaustive guarantee over all devices or concurrent real accounts.

Confirmed five causes, reproduced before repairs:

1. Open edit forms could overwrite newer synchronized monetary fields. Record snapshots now reject stale saves, retain the draft and ask users to reopen for current values. Applied to income, expense/refund, savings goal, recurring, fixed payment/plan, category/budget and trip editors. Rechecked inside fixed scope selection.
2. Payment plan, payment and activity were separate writes: a failure could leave a plan without its payment, or a payment without undo history. A synchronous finance batch normalizes revisions but defers storage/cloud writes until one commit. Fixed edits and their activity share this boundary too.
3. Failed local storage left saving locks/buttons stuck. Failure restores committed values, unlocks retry and retains inputs; scoped fixed edits show the error without losing the scope controls.
4. The payment-cancellation confirmation could delete a later synced payment. Confirmation now validates its opening transaction snapshot.
5. Changing salary-cycle start could invalidate existing future income allocation and silently change prior balances. Settings now simulate the proposed schedule and refuse an allocation-invalidating change; existing cash/assignment dates are preserved. Unaffected schedule changes still work.

Fourteen regressions fail on v172 and pass after these fixes. Independent UTC calculation compared 1461 dates (2025–2028) for Saturday–Friday,27–26 and weekly allocation conservation with no discrepancy. Browser review samples major finance sections at390/820/1366px; physical device keyboards and real two-device account concurrency remain unverified. Full application tests, Firebase rules and CI remain release gates; see external evidence log for final results.
