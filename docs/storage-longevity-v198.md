# Storage longevity verification — v198

This release is a measured first step, not an unlimited-capacity or ten-year cloud-sync guarantee. Test records are synthetic; no personal account was inspected or migrated.

## Problems reproduced

- Repeated account-storage enumeration made a 3,650-day key scan perform 26,655,951 native key reads in the baseline Node fixture. One snapshot now enumerates the native key set once. Snapshots remain fresh across outside writes and exclude other accounts.
- The 1,000-entry import limit rejected otherwise-small multi-year exports. The limit is now 10,000 entries; the complete imported JSON is still limited to 5 MiB.
- Repeated full automatic snapshots can exhaust the same storage used for everyday records. Automatic library growth beyond approximately 2 MiB UTF-16 is refused without changing existing backups. Explicit manual/import/safety backups remain available subject to native capacity. Quota failures no longer silently drop additional backup history.
- A full 2.67 MB file import followed by restore failed in Linux WebKit because the imported snapshot and its restored contents occupied the same localStorage quota. Large imported snapshots (>512 KiB JSON) now use IndexedDB, verified after transaction commit before their index is added.

## Representative fixtures

| Fixture | Records | Verified scope |
| --- | --- | --- |
| Light ten-year history | 3,653 daily entries | Export/restore, first and final day, financial amount preservation, reload |
| Active five-year history | 1,825 days and 9,125 expenses; JSON 2,669,568 bytes | Direct roundtrip and full file picker → backup library → safety backup → restore → reload |
| Native quota exhaustion | Actual browser quota filled | New backup fails without deleting existing library |
| Archive lifecycle | Large imported file | Verified durable storage, reload/download, explicit deletion, missing payload refusal, blocked IndexedDB, guest adoption/account separation |

Archived imports stay visible until explicitly deleted. They are local browser data, not an external backup. Ordinary snapshots retain the existing maximum of seven. The archive namespace follows account-scoped guest adoption, is not exported/imported, and is retained through restore so existing local backup references remain valid. No financial calculations changed.

## Limits and remaining architecture work

- Active daily and financial records still use localStorage. Heavy histories can still reach its native limit; no old personal records are automatically deleted.
- Financial synchronization still uses a single Firestore expense document. The synthetic 9,125-transaction JSON alone is 1,308,468 bytes; successful local restore does not establish cloud viability at that size. Cloud segmentation and a transactional personal-record migration require separate compatibility and multi-device validation.
- Browser data can be removed by the browser or user. Keep an external JSON copy. IndexedDB is larger storage, not a backup outside the device.
- Wall-clock timings are environment-dependent. The regression tests enforce enumeration work and record correctness rather than a fragile speed threshold.
