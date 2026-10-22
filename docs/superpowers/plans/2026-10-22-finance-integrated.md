# Integrated finance implementation plan

Goal: reliable, explainable personal finance covering Saturday weeks, fixed salary cycles and calendar reports without duplicate accounting.

Architecture: retain the existing local-first ledger and stable record IDs; merge cloud writes transactionally. Income, savings movements and cycle plans are separate from purchase transactions. Existing records remain readable, with explicit migration defaults.

Constraints: no paid infrastructure; no real-user fixture mutations; no automatic rollover or changing historical period boundaries; amounts are integer minor units; pending plans are never actual spending.

Review focus: concurrent devices, invalid money, archived categories, historical settings, savings double counting, recurring duplication, refunds across cycle boundaries and narrow-screen accessibility.

- [x] Reliability: strict amounts, per-field settings clocks, transactional merge, archived category preservation, consistent activity retention; regression tests.
- [x] Effective-dated period/income settings, actual income ledger and salary allocation plan; boundary tests.
- [x] Savings movements and recurring confirmation/partial payment/skip flows; accounting tests.
- [x] Fast entry, templates, split invoice, duplicate warning and dated refunds; interaction tests.
- [x] Drill-downs, availability, forecast and end-cycle review; reconciliation tests.
- [ ] Full browser and Firebase tests, independent final review, deploy and verify live version.

Execution: test first for each contract, implementation, targeted verification, then full release verification. All implementation and release actions authorized by the user. A fresh-context reviewer will review the complete branch before release.
