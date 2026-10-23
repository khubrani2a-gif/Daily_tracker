# Finance closure corrections — v172

Scope: five approved repair groups from the v171 closure review, preserving Saturday–Friday and27–26 cash-date contracts and existing records.

- Income/saving/plan revisions exceed the previous record. Restoring fixed plans preserves increasing template and instance revisions; derived payment recalculation cannot rewind them.
- Payment activity stores its transaction snapshot. Undo rejects changed or unverified legacy snapshots. Fixed-edit undo requires the original post-edit template; payment reversal preserves a subsequently edited plan rather than restoring an older snapshot.
- Family and Today summaries derive from the same period computation as finance and label available funds as estimated when appropriate.
- Financial save failure restores committed local state before any remote push. An Arabic message preserves form inputs; retry saves exactly once. No silent fallback to an empty successful state.
- Report search and CSV use one predicate, including trip names. Formula-looking text is prefixed as literal text; numeric amounts remain numeric strings. Backup metadata and visible footer use APP_RELEASE172.

Nine regression cases reproduced failures before fixes: revision merge, fixed undo merge, stale payment undo, storage retry, summary agreement, actual downloaded CSV, backup restore and later template edits. Prior finance/undo/period tests remain release gates.

No real user data changed. Responsive/touch/keyboard-area tests are browser emulation; no physical iOS/Android keyboard or user account on two physical devices is claimed. Full app tests, Firebase emulator checks, CI and public-site verification are required before publication is complete.
