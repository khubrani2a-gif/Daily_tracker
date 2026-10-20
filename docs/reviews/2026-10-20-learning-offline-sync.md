# Learning edits across devices

Learning source records now reconcile against this account/device's last acknowledged server snapshot. Disjoint fields merge; same-field conflicts, unknown divergent first-sync records, and delete-versus-edit conflicts stop the cloud write and show a persistent review button in Learning. Lecture date/time/recurrence fields are one atomic group. A user's choice applies only to conflicting fields, preserving disjoint changes. A stale review cannot overwrite a newer local edit.

Firestore transactions re-read and retry when another client writes between reading and committing. A local edit made while a commit is pending is reconciled against the just-committed result and remains pending for the next transaction. Account switches and pending restores guard both reads and result application. Cache/offline failures retain local data; transactions do not claim server success offline.

The review and baseline are account-scoped local data (`h2do-learning-sync-v1`). Backup restoration excludes this synchronization state so a historical baseline cannot authorize an overwrite. Conflicting learning rows are paused in Google sync while pending review; other daily calendar items continue. Google OAuth scopes and foreground-only behavior are unchanged.

Calendar occurrence metadata retains its existing independent-record merge policy. The new field reconciliation applies to lectures, preparation, courses and professional reading. Existing daily/finance/reading synchronization policies are not replaced.

Validation includes pure three-way merge tests, browser tests for offline edits, reload and explicit review, delete/edit conflicts, updates during a delayed commit, responsive conflict dialogs, Google write blocking, cache upgrade and offline PWA loading. The real Firebase SDK emulator test uses two browser contexts, network disable/reconnect and a barrier forcing both transactions to read the same server version before committing.

External validation boundaries: this execution session has no local-browser connector or signed-in Firebase CLI. It cannot verify a real personal OAuth round trip, administrative deployed rules, or physical iPhone/iPad behavior. The system could not install WebKit dependencies, but an isolated local dependency bundle enabled 13 passing WebKit tests. WebKit on Linux is not physical Safari/iOS validation. The personal OAuth, deployed rules and physical-device checks remain uncompleted.

Network-unavailable transactions may report cache fallback after an explicit cache read, without merging that cache, writing to the server, advancing the baseline or claiming server success. Permission/write failures remain failures.
