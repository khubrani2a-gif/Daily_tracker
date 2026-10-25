# Learning conflicts and full-term sync — v183

## Confirmed issues and corrections

- Schedule source/future edit conflict validation used a synthetic occurrence and ignored saved occurrence time overrides and cancellations. Renaming a source could report an overlap at the original time while the actual instance had moved. Validation now projects candidate occurrences through the same effective-source/override rules as the planner.
- Saved once-instance identity must survive source rescheduling. Candidate validation reuses it instead of inventing a second self-conflicting occurrence.
- Moved instances are checked against commitments on their actual dates, including beyond original source dates or bounds. Existing independently moved same-source instances can still genuinely conflict.
- Conflict details formerly showed only repeated names and dates. They now expose both parties, date/time, learning/planner origin, year/term, filtered/archived status and link presence, with fresh-row opening.
- Review was reachable only when a conflict existed in the next seven days. It is now always available and can inspect 30 upcoming days or the selected term (up to two years), with incremental rendering and explicit scope.
- Explicit override consent is invalidated when draft fields or the set/details of conflicting rows change.
- Scope-selection and Google coverage text explain effects and 90-day linking batches. Google algorithms and finance accounting are unchanged.

## Scenario coverage

New browser regressions in `tests/learning-conflicts-v183.test.js` cover hidden/archived same-name sources, late-term conflicts, preserved local drafts, occurrence-only overrides, future edits, cancellation, real overlaps, consent refresh, once rescheduling and moved dates. Viewport checks include 320/390/820/1366 widths and keyboard height, in light and dark themes.

`tests/learning-term-sync-v183.test.js` exercises the real application with simulated Google transport: 15 weekly occurrences from Aug 30 to Dec 17, a holiday exclusion, 12+3 coverage batches, repeated link/sync, one/future/all edits, lost responses, partial failures, cancellation, term shrink and moved occurrence identity.

No duplicate Google event defect reproduced in these scenarios. The user's personal PHSH111 source records were not accessed. No automatic deletion, name-based merging, migration or personal-data changes are included. Real OAuth/account and device synchronization remain outside synthetic verification.

## Evidence

Working-session artifacts: `/workspace/learning-conflicts-v183/` (red/green regressions, full-suite and Firebase logs, independent sync review, actual-font screenshots and viewport metrics). Final CI and deployment conclusions are recorded in the pull request.
