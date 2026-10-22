# Integrated finance release (v167)

## Accounting and storage contracts

- Purchases/refunds remain in `transactions`. Income, savings movements, cycle plans, effective-dated settings, recurring dues, templates and review decisions use `financeEntries`, with stable IDs, tombstones and record timestamps.
- Firestore writes read/merge/write in a transaction, including concurrent devices. Settings carry per-field timestamps. Reconciliation preserves open editor references and recalculates derived payment caches.
- Money entry accepts Arabic/Persian/Latin digits and valid decimal/thousands separators; malformed, ambiguous and unsafe amounts are rejected rather than guessed.
- Income receipt dates do not move salary boundaries. When no income receipt is recorded, availability is explicitly **estimated**, based on the cycle plan or effective salary expectation.
- Savings opening balances are legacy holdings, not current spending. Deposits/withdrawals are separate movements. Availability subtracts net transfers plus the unfulfilled saving reservation, not the original reservation twice.
- Weekly budgets remain spending limits. Salary plans derive variable allocations from dated weekly budgets. Recurring commitments overlap only the budget of their own category; payment does not free a second allocation.
- New recurring rules default to confirmation. Legacy automatic rules retain their behavior and show that mode explicitly. Upcoming known dues reserve availability before they are materialized. Partial payments, refunds, variable amounts, skipping one due and stopping a rule are supported.
- Period changes start at the next existing boundary; transitional periods are contiguous and may be shorter. Previous records and dates remain unchanged. Report navigation uses adjacent boundaries.

## User flows

The dashboard leads with weekly remaining and cycle availability, next due, and one priority alert. Expand details for the arithmetic and conditional forecast. Direct actions: quick expense, income, salary plan, savings movements and previous-cycle review.

Quick entry supports recent categories, saved templates, duplicate confirmation and split invoices. Split amounts must equal the total; no extra parent expense is recorded. Refunds use actual receipt date and preserve obligation linkage. Archived categories remain selectable for their original transactions.

Cycle review compares plan/actual, shows pending-review records and commitments, and explicitly leaves surplus unallocated or opens an actual savings transfer. It never generates income or rolls money forward silently. Savings goals with balances cannot be deleted; hidden goals can be restored.

## Verification

- `node --test tests/finance-reliability.test.js tests/finance-ledger.test.js tests/finance-interface.test.js tests/finance-periods.test.js`
- `npm test` (whole application regression suite)
- `npm run test:firebase` (real Firestore emulator, including forced concurrent finance writers)
- Viewports 320, 390, 820, 1366; form interaction and overflow checks.
- Fresh-context independent review found recurring-refund linkage, future reservations, allocation after payment, transition navigation, open editor reference and archived-plan issues. Each was corrected with regression coverage. Follow-up per-category overlap and savings-goal restoration issues were also corrected.

All browser fixtures and emulator accounts are isolated from production user data. The application remains free/static-hosted. Values are bookkeeping estimates, not bank balances; synchronization requires connectivity, and recurring processing occurs while the app is running.
