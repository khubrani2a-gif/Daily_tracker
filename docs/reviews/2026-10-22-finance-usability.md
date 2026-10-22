# Finance usability v168 verification

Scope: seven usability improvements approved after v167, retaining the existing records and period accounting contracts. No production financial records are edited by this release.

## Checks and evidence
- Baseline targeted finance tests: 19/19 passing before implementation.
- Added a real Firestore emulator scenario: one browser saves an offline purchase tombstone and a savings movement/new goal while another records income and a cycle plan. Reconnection preserves all entries exactly once and keeps the deletion. Eight emulator tests passed.
- New setup is planning only: preview/cancel must not persist income, savings or transactions; only confirmed plan and category budget revisions save.
- Unified ledger is a derived view of stable records. Correction paths preserve original transaction IDs and tombstones.
- Week remains whole; intersections with salary cycles partition dated spending and must sum to the weekly amount. No reset at payday.
- Comparison uses equally many elapsed calendar days and explicitly names both ranges. Savings are separate; zero/negative baselines do not create misleading percentage growth.
- Financial alerts run inside the application and request no additional permissions or remote services.
- Responsive and security review: inspect escaping of descriptions/category/goal names, filter boundaries, button keyboard use and narrow-screen overflow. This is a local code/browser review, not a dedicated hosted security scan; that tooling is not available in this environment.

## Release status
Implementation complete at 39fb889. Independent review verified all seven features and six repaired findings: first-budget preview omission, negative-net comparison wording, dismissed-alert details, confirmation stacking, keyboard dialog focus/close/restore, and ledger refresh after delete/undo. No unresolved actionable findings in that reviewed scope.

Focused verification: 78 checks passed, including 12 new usability tests. The complete pre-change application baseline passed 466 tests. Real emulator verification of the final source passed 8 tests. The full post-change suite and deployment are release gates in GitHub Actions; their run results remain the authoritative publication record.

Screenshots were captured from isolated sample data at phone, tablet and laptop sizes; light and dark layouts were inspected. No production account or records were accessed for these fixtures.

## Deliberate behavior
- Setup remains optional and reopenable; budgets are applied from the current week boundary with a preview. It does not create receipts or transfers.
- Alert dismissal is for the current application session, as labeled. Reopening may show an unresolved issue again.
- Comparisons use immediately preceding equal-length day ranges, explicitly labeled; they are not whole unequal calendar-month comparisons.
- Savings corrections retain the existing cancel/re-record path and a guarded undo.
- All features use existing local/cloud persistence and require no paid service. No new background notifications or bank integration are introduced.

## Transition-week follow-up
Final inspection caught a mismatch when a scheduled week-start change creates a short week: setup displayed a prorated amount but projected/saved it as a full-week rate. Both setup and the existing budget editor now edit the nominal seven-day limit; the preview separately shows the effective current-week amount. Regression covers unchanged and changed limits on the October 31 one-day transition, next-week rates, and preview-versus-save equality. The first deployment was cancelled before publication so this correction is included in v168.
