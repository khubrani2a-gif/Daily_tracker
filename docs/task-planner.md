# Task and appointment planner

The task card now provides Today, Upcoming and All Tasks with one editor. Existing daily records, account isolation, pending-day synchronization, backup export and import remain the storage foundation. No additional Firebase collections or paid services are required.

## User behavior

- Tasks may be unscheduled, planned for a date, timed, or given a separate deadline. Appointments require a date and either start/end times or an all-day flag.
- Quick capture recognizes supported Arabic weekday/relative-date, time and duration expressions, annual repetition and explicit repeat intervals (including every two weeks). Ambiguous 12-hour times require explicit selection. Manually selected fields are not overwritten while typing.
- Upcoming has an agenda, hourly schedule and monthly calendar. A day strip jumps directly to a date. An explicit “أسبوع كامل” option retains all seven days with scrolling inside the calendar when necessary; automatic layout remains the default. The schedule fits seven, three or one day to the actual available content width; wide screens also show unscheduled tasks beside the calendar, with an explicit scheduling action and optional drag. On smaller screens the unscheduled section follows the calendar. Adding from an hour prefills its date/time. Moving also has an explicit button, so drag is optional.
- A compact Contact button beside Steps opens only the available link/call/WhatsApp actions. The single URL field is labeled “رابط الموقع أو الصفحة”; recognized Google/Apple Maps URLs use “فتح الموقع”, while other HTTP(S) URLs use “فتح الرابط”, preserving the supplied target. Contact details stay inside the popup; outside-click, Escape and choosing an action dismiss it. HTTP(S) links are validated and local Saudi mobile numbers use the existing international WhatsApp conversion.
- The ⋯ action opens a short date/time sheet with Today, Tomorrow and Unscheduled presets, explicit overlap acceptance and safe undo. Reordering buttons move tasks inside their current date/time group without disturbing appointment chronology.
- A simple task hides optional time inputs until requested or parsed; appointments show time inputs immediately.
- Today’s selected top three use the same `dailyRoute.planIds` as the overview route, without copying tasks. Stars remain an independent “Important” filter. Recurrence edits that replace an ID preserve the selected priority, including safe undo.
- Important, waiting, unscheduled, overdue-review and completed filters share the same records. Moving preserves the separate deadline and linked priorities. Unfinished work stays accessible instead of being copied automatically each morning.
- Learning appointments are read from their source and open that source editor. Legacy family appointment tasks appear as appointments; their secondary family metadata is not duplicated in the planner.
- Preparation items can become separately dated tasks linked to an appointment checklist. Completion updates both directions. Task cards expose a Steps disclosure with completion count and the next unfinished step; checkboxes save directly without opening the editor. The open disclosure also adds or edits step text inline. Edits preserve step IDs/completion and update the linked preparation title. Fixed recurrence text changes apply only to the selected date; completion-based recurrence remains active. Newer concurrent step text is protected. Expansion, keyboard focus and scroll position are retained while checking steps, and the same safe undo applies.
- Repeat rules support daily, weekly, monthly and yearly intervals, selected weekdays, workdays, end date/count and recurrence after completion. An edit can affect one occurrence or start a new series from that occurrence. Skip, delete and undo respect the series scope.
- Conflicts and free-slot suggestions use recorded times, durations and preparation buffers, including the new item’s own preparation before its suggested start. They do not move anything automatically. Suggested capacity is limited to the user-configured availability and known durations.
- Settings choose working days, week start, available hours and prayer display. Prayer-relative tasks resolve only against the selected location's cache for that exact date. Missing future times remain explicitly unresolved. Optional prayer markers appear inside the hourly calendar using only that date/location cache; a missing cache is labeled rather than borrowing today’s times.
- Reminders are best effort while the app is running. Timed reminders can precede midnight by using full timestamps. ICS exports a single occurrence with UTC times or an exclusive all-day end, escaped text and UTF-8-safe folded lines. Importing that file into a device calendar is not bidirectional synchronization.
- The weekly review excludes cancelled/skipped items, compares estimated and actual minutes only for the same completed items with both measurements, reports unknown durations, ranks busy days by recorded duration and shows repeatedly postponed work. Actual minutes come from manual entry or the existing focus timer.

Optional Google Calendar connection is available inside scheduling settings and notifications. It synchronizes selected occurrences in both directions while the app is open and authorized; device-calendar reminders can then work independently of the PWA. See [calendar-connection.md](calendar-connection.md) for activation, exact scope, consent requirements and limitations. Live OAuth and device notification delivery have not been verified by mocked API tests.

## Compatibility and correctness

`planner-core.js` is a dependency-free UMD module with deterministic calendar rules, Arabic parsing, overlap/availability functions and ICS export. It is included in both the Pages artifact and the service worker's offline assets.

New task fields are additive and marked by `plannerVersion: 1`. `unscheduled` distinguishes a deliberate lack of date from legacy records whose day is implicit. `repeatAnchor` is stable across materialized occurrences. `occurrenceOnly` prevents an exception from replacing the series rule; hidden `seriesTemplate` records preserve future recurrence when the original occurrence changes. Future edits close the prior series and create a new root. `deletedAt` prevents resurrection of deleted series.

Changes are written through `persistDay`, retaining its journal and three-way cloud merge. Undo snapshots the changed records for 30 seconds and validates changed fields before reverting; unrelated later edits and other day data are preserved. Editing a form also merges unrelated updates received while it was open.

## Validation

- `tests/calendar-core.test.js` and `tests/calendar-ui.test.js`: calendar conversions, concurrent edits/deletions, ETags, token isolation, disconnect races, repeated insert safety, local/remote edits, recurring occurrence isolation and new planning calculations.
- `tests/planner-core.test.js`: Arabic parsing, leap dates, recurrence intervals/counts/workdays, buffers, free slots, ICS escaping/durations.
- `tests/planner-ease.test.js`: map labeling, progressive time fields, quick scheduling/conflicts, inline step edits/concurrency/recurrence, ordering, shared priorities and calendar/backlog/prayer responsiveness.
- `tests/planner-ui.test.js`: add/edit/reload, explicit conflicts, recurrence exceptions/deletion/after-completion, linked preparations/priorities, safe undo, multi-select moves, reminders, prayer-date correctness, cloud persistence, global search and responsive widths.
- Existing overview, navigation, data/sync, finance, learning, reading and offline tests continue to run through `npm test`; Firestore authorization tests use the local emulator via `npm run test:firebase`.
- Additional manual browser automation covers Chromium and WebKit with real local fonts at phone/tablet/laptop dimensions. This simulates devices; it is not testing on physical iPads.

### Proportional timeline

The Today and Upcoming views have direct List / Timeline buttons. This layout preference is saved locally. The time canvas uses a consistent minute scale, places overlapping cards in separate columns, and displays a live current-time line. The canvas scrolls within its container; the existing full-week option remains available. Untimed and all-day items remain outside the hour grid. Start-only tasks are explicitly labelled as having no duration.

An hour that falls inside an active booking, including a learning schedule entry, is marked occupied rather than offered as a free add slot. Filtering does not remove bookings from availability checks. Conflicts are shown beside the editor's time fields; even a start-only task inside an existing appointment requires an explicit conflict override. Unknown task durations are not inferred or saved. Calendar data and the list view continue to use the same source records.

## Compact planning and direct schedule editing

- Task list and timeline cards open the same summary. The explicit Edit action opens the form; optional contact, steps, notes, preparation and metadata sections retain values while collapsed. Native validation opens hidden invalid fields.
- Secondary filter/select/review/settings controls are under More, whose expanded state survives rerenders. Search and list/timeline switching remain available.
- Preparation is drawn before a booking and participates in lane layout and conflict checks. Its width follows the parent event. Crowded groups still expose individual records through their summary.
- In the summary choose **تعديل الوقت على الجدول**. Drag the move or end handle, or choose the numeric-time alternative. Gestures snap to 15-minute increments and always open a preview; Save confirms, conflicts require explicit acceptance, and Undo uses the existing transaction. Escape/pointer cancellation does not change data. Learning records remain editable only in their source.
- Availability settings accept up to three nonoverlapping periods per weekday, an unavailable day, or inheritance from the legacy general period. Availability guides suggestions and does not forbid manual bookings. Existing preferences keep their old behavior until customized.
- Closed-app reminders can be handed to the device calendar from the summary; this is distinct from continuous background synchronization. See calendar-connection.md.
