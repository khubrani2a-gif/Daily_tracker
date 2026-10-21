# Academic learning release — v155

Implementation covers the six requested axes: academic years/terms, single-occurrence conflict alternatives, gap-aware Calendar coverage, existing recorded-time/focus integration, historical weekly reports, and study/teaching/both actions.

Academic ownership resolves through subject.termId. No legacy lecture or Google IDs are rewritten on assignment, selection or archive. Bounds propagation uses futureChanges and explicit bound-exception decisions. Copying creates new unlinked weekly source structure; selected subjects and conflict acceptance are previewed and rechecked. Term filters never limit global collision detection. Dates must come from the user's institution.

Coverage batches are foreground-only, limited to 90 days each, retry-safe and account-guarded. Confirmed means the current snapshot matches a successful saved Google snapshot, not that the page is monitoring Google while closed. Existing least-privilege scopes and memory-only access tokens remain unchanged.

Focus uses the existing actualMinutes field; wrong-day, account change, deleted task and duplicate finish are guarded. Manual time replaces the recorded aggregate. Weekly time is attributed to the scheduled task week; only sessions with both values contribute to the paired comparison. Missing attendance remains unrecorded.

## Verification ledger

- Targeted integrated tests: 74 passed before final acceptance polish.
- Additional batch acceptance: 3 passed (lost insert response/retry, bound exception, copy stale collision).
- Academic/core/UI/coverage suite: 25 passed before final copy/focus additions.
- Firebase SDK suite with independent concurrent academic additions: 8 passed at Batch A.
- Final independent whole-branch review found four issues; each reproduced RED and passed GREEN after repair: repeated-session recorded time, Google keep-exception cancellation guard, out-of-range cancellations, and term-end extension limit.
- Additional scenario tests cover flexible unready tasks alongside linkable lectures and daily/completion recurrence identity/time isolation.
- Chromium layout checks passed at widths 320, 390, 820 and 1366, plus short viewport and keyboard filter traversal.
- WebKit academic scenarios: 11 passed before final review fixes; final expanded suite is part of release validation.
- Firebase SDK final run: 8 passed.
- Full stable-tree regression results and publishing checks are recorded by the pull request and Pages GitHub Actions runs. Release is gated on both; simulated Google tests are not real-account acceptance.

## Acceptance boundary

Automated Google tests use a simulated API. Real personal OAuth consent, a real event round trip and device notification delivery have not been verified in this release. No new paid service, always-on synchronization or PWA push was added. Archived terms remain accessible; templates are structural copies rather than a new linked series across terms.

## Review dispositions

All four important review findings were fixed, with focused regressions. The minor combined-role grouping finding was also fixed with labeled study and teaching sections. Cross-viewport testing independently exposed a flexible task blocking a valid Calendar batch; unready tasks now appear for review and do not block eligible lectures. Follow-up recurrence checks found missing learningRef in daily seeding and copied actual time in completion recurrence; both were corrected without creating a second timer.

Coverage inspection may include dates outside a term, but new links are bounded by the current associated term. Relevant bound cancellations remain visible separately even outside the inspection range. Individual exceptions may still be linked using existing explicit occurrence controls. The release makes no claim of real Google/device verification.
