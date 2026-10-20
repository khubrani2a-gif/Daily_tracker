# Learning editor audit fixes

The learning editor now merges disjoint changes received while a form is open. A conflicting field, deleted record, or concurrent change to the lecture time group blocks saving and offers an explicitly labeled reload that discards the draft. The draft remains visible until that choice is made. Calendar occurrence metadata and unrelated records remain in the latest collection.

Planner edit routes now select the source's learning kind (lecture, preparation, course or professional reading). Lectures reject specified end times at or before their start time; an omitted end remains supported.

Nine browser regressions cover cloud reconciliation, same-field conflict, deletion, three target editors, atomic lecture times, responsive dialogs, and offline save/reload/reconnection without duplicates. Google API integration tests exercise mocked endpoints; they are not proof of a real user's OAuth session. Firestore emulator tests validate repository rules, not the deployed project's configuration. Viewport/keyboard-height simulation does not replace physical iOS/iPad testing.

This fixes stale open forms after a newer update is received. It does not change the existing whole-record last-update policy for independently edited offline learning records; that path retains the application's existing collection-conflict reporting.

Additional dialog-level checks found intrinsic input widths overflowing learning forms at 320px and in the two-column tablet/desktop layout, despite no document-level overflow. Learning fields now use shrinkable grid tracks and width-constrained controls. Both normal and conflict dialogs are checked against their own scroll width. This follow-up bumps the cache to v152; the v151 deployment was canceled before publication.
