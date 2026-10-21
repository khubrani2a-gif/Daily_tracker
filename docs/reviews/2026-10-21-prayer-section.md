# Prayer section integrity and usability (v161)

## Findings and changes

1. Fixed iqamah offsets were presented as mosque facts. They are removed. The strip distinguishes entry of a prayer time, the next calculated prayer, and manual performance recording. It never labels the day's prayers completed merely because Isha time passed or reuses today's Fajr as tomorrow's.
2. Timings lacked calculation settings, timezone validation, and a complete cache identity. Settings now include location, calculation method, and Asr school. New caches include exact location/country/coordinates, method, school, date, timezone, and retrieval time. Old timing caches are disposable and are not used for task scheduling; prayer history remains intact.
3. Responses are validated for all required HH:mm values, timezone, requested date, and current request/location context. Failed forced refresh can use the matching cached date. A 15-second timeout ends a stuck request. Malformed saved location data does not crash rendering. Location changes in another tab refresh via the account-scoped storage event key.
4. The countdown uses the provider's city timezone. Timeline anchors and reminders convert those times to the device timezone. A time or offset outside the represented day stays unresolved rather than producing a negative time or a false slot. Date rollover does not present yesterday's selected date as live today.
5. Repeated taps formerly cycled through prayed/late/missed. Tapping now opens explicit choices, with visible state labels, keyboard-accessible buttons, date context, and a separate undo. Stale dialogs and undo cannot overwrite newer prayer statuses. Future-date performance recording is disabled.
6. Five obligatory prayers are consistently counted in the overview, overall progress, weekly summaries, and exports; Duha remains available as an optional prayer. Its sunrise-plus-15-minute estimate is labelled approximate.
7. Legacy five-entry arrays are read with the correct prayer identity. Concurrent migration to six entries and old boolean values is normalized during three-way merge so independent device edits survive.
8. A shortcut opens the corresponding after-prayer adhkar session without automatically marking either prayer or adhkar complete.
9. Prayer reminder settings are reachable from the section. The UI states that reminders depend on the app running and are not guaranteed while it is closed. Browser notification failures/retries retain existing behavior.
10. Prayer-relative task synchronization also updates the pending-time flag, and rejects offsets before 00:00 as well as after the day's end.

## Evidence and validation

- `tests/prayer-integrity.test.js`: location corruption, invalid responses, calculation settings, timezone conversion, date rollover, explicit recording, undo/stale guards, legacy display/edit, prayer-adhkar context, offline refresh, reminder deduplication, old-cache rejection, invalid offsets, and two isolated devices recording while writes fail then reconnecting.
- `tests/audit-data-core.test.js`: independent edits through five/six-entry migration and true/ontime normalization.
- Existing stale-response test now supplies a realistic complete timings response and timezone. Planner tests now seed the versioned timezone-aware cache.
- Responsive checks at 320, 390, 820, and 1366 pixels in light and dark modes exercise settings, recording, and undo.
- WebKit verification supplements Chromium; neither is a physical iPhone test.
- Full application suite and deployment CI are required before release completion.

## External provider / operational limits

Aladhan is the calculation source: https://aladhan.com/prayer-times-api . The timings endpoint supports `method` and `school`, and returns `meta.timezone` and `meta.method`. Calculation results must be compared with the user's locally adopted timetable; the app does not claim to know a mosque's iqamah. Browser reminders are not a background push service. Location/calculation settings belong to this device; prayer recording uses the existing account synchronization.

No live account prayer records were changed during testing. Scholarly verification of the remaining adhkar collection remains a separate outstanding review; this release concerns prayer functionality and its integration.
