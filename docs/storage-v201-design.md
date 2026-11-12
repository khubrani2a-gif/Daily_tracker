# Durable storage, release 201

Authorized scope: repair recurring local quota failures and publish without losing history, pending cloud changes, account separation or undo data.

Use IndexedDB for durable record values, with a synchronous localStorage write-ahead journal for current mutations. A write is acknowledged only after its journal entry is durable. Checkpointing commits journal entries to IndexedDB, verifies committed values, then removes only those immutable journal entries. Failed checkpoints retain the journal. Immutable operation IDs and monotonic revisions prevent delayed tabs/checkpoints from resurrecting deletions.

Bootstrap loads IndexedDB and replays journals before the application initializes. Existing legacy records are copied, committed and verified before matching legacy values are removed. The application does not start with an empty substitute if IndexedDB is unavailable. Caches remain disposable; account identifiers and small non-record preferences remain native localStorage. No unawaited memory-only writes count as saved.

Limits: browser storage is finite; private/blocked storage and individual writes larger than the temporary journal capacity must fail visibly. This is not a promise of unlimited capacity. Old clients must reload on the normal service-worker upgrade; migration protects changed legacy values by comparison before removal. Test concurrent current-version tabs, interrupted migration/checkpoints, failure/retry, deletion and account adoption.

Correct local save-error precedence, retain raw error classification, and test guest/offline/signed-in status. Publish only after regression checks and live verification.

Account adoption uses an intent marker, bounded checkpoints and a separate cross-tab operation lock. Ordinary writes are rejected while migration is in progress. Interrupted adoption is resumed before account initialization. A different legacy value competing with an existing durable value blocks startup without deleting either value.

Restore and post-cloud restore bookkeeping use one atomic IndexedDB transaction, including the restore-pending marker. Before a bulk transaction, publish a durable invalidation revision; stale tabs reject both ordinary writes and subsequent batches. Bootstrap shares the operation lock. Failed transactions retain the prior dataset; safety backups are awaited before restore. Large manual/safety backup payloads use the existing verified backup vault. Automatic backup growth remains capped.

New browser tests cover actual native quota exhaustion, aggregate history beyond that quota, interrupted checkpoint/adoption, multi-tab delete/revision behavior, atomic batch failure, and application prayer/adhkar save/reload with large history. CI runs these on Chromium (full suite) and WebKit (targeted storage/UI suite). Live account conflicts and physical device free-space limits remain separate from code verification.
