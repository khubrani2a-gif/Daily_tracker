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
- Full stable-tree suite, final Firebase run, cross-browser/layout checks, branch review and deployment: pending below; no completion claim yet.

## Acceptance boundary

Automated Google tests use a simulated API. Real personal OAuth consent, a real event round trip and device notification delivery have not been verified in this release. No new paid service, always-on synchronization or PWA push was added. Archived terms remain accessible; templates are structural copies rather than a new linked series across terms.
