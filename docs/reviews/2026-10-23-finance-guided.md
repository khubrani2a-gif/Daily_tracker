# Finance guided correction — v171

Scope approved: direct settlement-conflict review, guided savings correction after plan changes, salary-cycle picker, actionable validation and mobile form checks. No bank integration, automatic rollover or multi-cycle income allocation.

## Behavior
- Conflict alert opens the exact obligation. Only selected reductions are cancelled after a before/after preview. Cancelling a refund-attached reduction retains its cash amount, date and original transaction identity. Standalone reductions use tombstones. Corrections and undo reject changed snapshots; monotonic record revisions preserve stale-device merge behavior.
- Savings review identifies the first date that cancellation would overdraw the goal and links all movements of that goal. A changed plan can be reviewed and an old movement explicitly cancelled while preserving current plan records. Preview shows balances/reservation/availability on movement date and today. Later data changes block apply/undo. Regular unreviewed deletion retains its existing protection.
- Income picker derives receipt/next cycles from actual receipt date and effective period settings. A selected target is not silently moved when receipt date changes. Custom dates map to their actual cycle start. Cash receipt date and one-allocation-per-income contract are unchanged. Field-specific errors preserve entered values.
- Financial form uses the visual viewport and hides the underlying main navigation while open. Navigation/focus restore on close. Inline ledger undo replaces the overlapping floating toast while the ledger is open.

## Verification
- New behavior initially failed in browser tests before implementation.
- Focused finance suites: 60/60 including 12 new guided tests (later final full CI is authoritative).
- 24 rendered cases: income, savings review and settlement review at 320/390/820/1366 px, light/dark, no horizontal overflow or JS errors.
- Keyboard-area shrink checked with a simulated visualViewport resize/offset. No physical phone/iPad connection was available; native iOS/Android keyboard and touch behavior remain unverified on hardware.
- No actual account data accessed or changed. Screenshots use isolated fixtures.
- Full regression, Firebase emulator and deployment are release gates. Preserve the exact run links in the PR/release evidence.

## Boundaries
Corrections remain explicit; no automatic choice between conflicting records. Undo is guarded and available in the current correction screen. Snapshot invalidation is conservative, including unrelated financial changes. Missing obligations are identified, not silently recreated. The picker does not introduce multi-cycle allocation.

## Final undo follow-up
The first Pages run was cancelled before publication. A reproduced close-ledger case showed the toast needed to reappear after the dialog closed, and the mobile navigation covered its button. Hide the floating toast only while inline undo exists; position it above mobile navigation. The original six-second lifetime and callback remain intact. New failing reproduction then guided/usability suites 26/26 passed (13 guided cases total). Final full suite now includes 527 tests; final CI/deployment evidence supersedes the first candidate.

## Monetary undo follow-up

The user requested verification of amounts, not only undo visibility. A reproducing test found that transaction restore used the local wall clock: a tombstone from a clock-ahead device could win the next merge and remove the restored amount again. Reversals now write a revision strictly newer than the affected record. The same rule covers income/savings undo, payment undo, liability reduction cancellation and trip expense restoration.

Five additional browser tests assert exact cash, weekly spending/remaining, savings balance and liability amounts after undo, storage reload and merge in both directions. Expense/refund tests failed before the fix. Payment undo restores cash and unpaid liability together, so spendable availability can correctly stay unchanged. No real account records are used.
