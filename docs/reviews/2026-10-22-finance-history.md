# Finance v169: effective weekly budgets and clearer accounting

## Scope
Fix the two reproduced accounting-history defects from the October22 review, plus clarify income/refunds/savings without changing receipt-date cash-flow policy. No production transactions are edited by the development fixtures.

## Effective-date policy
- A new category's first weekly rate starts at the current week boundary, explicitly labelled in its form; never at1970.
- Archiving/pausing prevents new entry immediately. Its current weekly limit remains; budget participation stops at the next week boundary.
- Dated `category-budget-state` records use existing financeEntries persistence/merge. Restoration resumes the current week while preserving intervening stopped weeks; same-week restoration cancels the scheduled stop.
- An older archive with a recorded archivedAt uses the following week boundary. Before restoration its stop is materialized so clearing archivedAt cannot erase history.
- Older inactive categories without an archive date or state history are captured as **observed inactive** from the current week on load/adoption. This preserves their inactive allocation from upgrade onwards without claiming to know when they were originally disabled. No older stop date is invented; known rate histories are retained.
- Weekly totals, per-category period allocations, detail and setup preview share eligibility. Archived current-week limits remain in preview even though they cannot be edited as active categories.

## Accounting explanations
Expected plan income and recorded receipts appear separately. Calculated availability still uses recorded receipts when present, otherwise an explicitly labelled estimate; these are never added. Income belongs to its actual receipt cycle, even before payday.
Refund detail splits purchases, receipts of refunds, net spending and remaining limit. A refund does not increase the approved limit. Savings withdrawals do not cancel the remaining reservation automatically. A refund linked to an outstanding obligation is separate from cancelling that obligation.

## Verification gates
Regression tests reproduce archival clock dependence, retroactive category creation, restore gaps, and retained-budget setup-preview mismatch before the fix. Tests also cover legacy inactive observation and visible accounting labels. Full application and Firebase emulator checks are required before release; GitHub run results are the authoritative deployment record. Sample phone/tablet/desktop screenshots use fake data only.
