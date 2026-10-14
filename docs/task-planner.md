# Task and appointment planner

The task card now provides Today, Upcoming and All Tasks with one editor. Existing daily records, account isolation, pending-day synchronization, backup export and import remain the storage foundation. No additional Firebase collections or paid services are required.

## User behavior

- Tasks may be unscheduled, planned for a date, timed, or given a separate deadline. Appointments require a date and either start/end times or an all-day flag.
- Quick capture recognizes supported Arabic weekday/relative-date, time and duration expressions. Ambiguous 12-hour times require explicit selection. Manually selected fields are not overwritten while typing.
- Upcoming has an agenda, hourly schedule and monthly calendar. The schedule displays seven days on large screens, three on landscape tablets, and one on narrow screens. Adding from an hour prefills its date/time. Moving also has an explicit button, so drag is optional.
- Important, waiting, unscheduled, overdue-review and completed filters share the same records. Moving preserves the separate deadline and linked priorities. Unfinished work stays accessible instead of being copied automatically each morning.
- Learning appointments are read from their source and open that source editor. Legacy family appointment tasks appear as appointments; their secondary family metadata is not duplicated in the planner.
- Preparation items can become separately dated tasks linked to an appointment checklist. Completion updates both directions.
- Repeat rules support daily, weekly, monthly and yearly intervals, selected weekdays, workdays, end date/count and recurrence after completion. An edit can affect one occurrence or start a new series from that occurrence. Skip, delete and undo respect the series scope.
- Conflicts and free-slot suggestions use recorded times, durations and preparation buffers. They do not move anything automatically. Suggested capacity is limited to the user-configured availability and known durations.
- Settings choose working days, week start, available hours and prayer display. Prayer-relative tasks resolve only against the selected location's cache for that exact date. Missing future times remain explicitly unresolved.
- Reminders are best effort while the app is running. Timed reminders can precede midnight by using full timestamps. ICS exports a single occurrence with UTC times or an exclusive all-day end, escaped text and UTF-8-safe folded lines. Importing that file into a device calendar is not bidirectional synchronization.
- The weekly review reports recorded completions, estimated/actual minutes, busiest day and repeatedly postponed work. Actual minutes come from manual entry or the existing focus timer.

## Compatibility and correctness

`planner-core.js` is a dependency-free UMD module with deterministic calendar rules, Arabic parsing, overlap/availability functions and ICS export. It is included in both the Pages artifact and the service worker's offline assets.

New task fields are additive and marked by `plannerVersion: 1`. `unscheduled` distinguishes a deliberate lack of date from legacy records whose day is implicit. `repeatAnchor` is stable across materialized occurrences. `occurrenceOnly` prevents an exception from replacing the series rule; hidden `seriesTemplate` records preserve future recurrence when the original occurrence changes. Future edits close the prior series and create a new root. `deletedAt` prevents resurrection of deleted series.

Changes are written through `persistDay`, retaining its journal and three-way cloud merge. Undo snapshots the changed records for 30 seconds and validates changed fields before reverting; unrelated later edits and other day data are preserved. Editing a form also merges unrelated updates received while it was open.

## Validation

- `tests/planner-core.test.js`: Arabic parsing, leap dates, recurrence intervals/counts/workdays, buffers, free slots, ICS escaping/durations.
- `tests/planner-ui.test.js`: add/edit/reload, explicit conflicts, recurrence exceptions/deletion/after-completion, linked preparations/priorities, safe undo, multi-select moves, reminders, prayer-date correctness, cloud persistence, global search and responsive widths.
- Existing overview, navigation, data/sync, finance, learning, reading and offline tests continue to run through `npm test`; Firestore authorization tests use the local emulator via `npm run test:firebase`.
- Additional manual browser automation covers Chromium and WebKit with real local fonts at phone/tablet/laptop dimensions. This simulates devices; it is not testing on physical iPads.
