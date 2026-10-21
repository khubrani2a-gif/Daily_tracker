# Friday prayer research and integration review

Status: implemented for v163; release validation in progress. User confirmed the first call is approximately 40–60 minutes before the second call, the second is at the usual Dhuhr time when the imam ascends, and iqamah is generally about 20 minutes later. Defaults are 60 / 20 minutes with a 40-minute first-call option and configurable estimated iqamah. Mosque timing preferences are device-local; daily Friday records synchronize with the account.

## Verified current behavior (v162)

- PRAYERS and the live fard list always use Dhuhr/الظهر, with a fixed 20-minute iqamah delay. There is no Friday call/khutbah model.
- Names are repeated in the prayer card, recording dialog/undo, today's next action, notification loop, planner prayer markers and prayer-relative task selector.
- After-prayer adhkar have a Dhuhr session key and a static label. Renaming just the card would leave inconsistent labels elsewhere.
- A reusable Quran reader and configurable surah reader exist, but custom surah progress is not a Friday-specific session. Merely opening a reader must not complete Friday reading or advance the general daily wird.
- Salawat is an existing counter preset with preserved sessions; a Friday shortcut should resume/create its own session without resetting another active counter.

## Recommended integrated design

1. A Friday profile for the existing prayer slot, not a sixth obligatory prayer. On Fridays the user's primary action is “صليت الجمعة”. Retain an explicit Dhuhr alternative for someone praying Dhuhr instead. Do not rewrite old records as confirmed Jumuah attendance. Keep performance recording independent from the clock.
2. Mosque settings distinguish first adhan, imam's adhan/khutbah and iqamah. A first-call offset of approximately 60 minutes is the user's preference, not a universal Islamic rule. Configure the actual reference/time once known. Never inherit Dhuhr's +20m for Friday; unknown iqamah is displayed as “بعد الخطبة — الوقت غير محدد”, not a fabricated countdown. Any estimated time must be labelled as estimated.
3. Keep two compact countdown areas for the next Friday stage and known iqamah, with a short first-call/khutbah/iqamah sequence available in details. Timers use the mosque city's live date; reviewing a past Friday must not replace today's live clock.
4. A compact “يوم الجمعة” panel with three actions: preparation, Surah Al-Kahf, salawat. Preparation opens optional checkboxes for washing/purification, suitable preparation and early departure. Avoid a long visible list and avoid presenting recommended practices as extra obligatory prayers.
5. Al-Kahf opens surah 18 directly with resumable progress for that Friday. Opening alone is not completion; explicit completion is reversible. Keep weekly records and current daily Quran progress separate.
6. Salawat opens the existing circular counter, resumes the relevant session, and keeps any target explicitly personal/organizational; do not claim a fixed Friday count is prescribed by the cited hadith.
7. After-prayer adhkar use the matching Friday label/context, and the prayer card, today summary, planner markers and reminders agree. Preparation completion and reading are not added to the five-fard prayer score.
8. Deferred, not implemented: a voluntary khutbah focus mode may silence this app's own optional reminder sound/vibration until the configured end or manual exit. It cannot promise system-wide Do Not Disturb. No automatic attendance, background notification promise, paid service or Ramadan schedule is included.

## Sources reviewed

- Ibn Baz, first and second Friday adhan: https://binbaz.org.sa/fatwas/8255/حكم-الاذان-الاول-والثاني-للجمعة . The first call is an advance notice; examples include half an hour or an hour, not a universal mandated interval.
- Ibn Baz, first call and sequence of khutbah then iqamah: https://binbaz.org.sa/fatwas/5117/مشروعية-الاذان-الاول-يوم-الجمعة . Search excerpt; first source supplied the full answer for the distinction.
- Sahih al-Bukhari 883: https://sunnah.com/bukhari:883 . Full text: washing/purification, perfume, avoiding separating worshippers, and listening to the imam.
- Sunan Abi Dawud 1047: https://sunnah.com/abudawud:1047 . Full text, graded Sahih by al-Albani on the source: increasing salawat on Friday; no fixed numeric target stated.
- Ibn Baz, Al-Kahf: https://binbaz.org.sa/fatwas/5172/قراءة-سورة-الكهف-يوم-الجمعة . Supports Friday reading. Also reviewed fatwa 14884, which notes hadith weakness and established companion practice; avoid attaching an unqualified grading or guaranteed reward to the UI.
- Ibn Baz, women praying Dhuhr on Friday: https://binbaz.org.sa/fatwas/20471/وقت-صلاة-المراة-للظهر-يوم-الجمعة . Search excerpt supports retaining a Dhuhr option instead of removing it for every user.

## Acceptance checks for implementation

- Thursday/Friday/Saturday transition and city/device timezone differences.
- Historical Friday review does not affect current live countdowns.
- First call vs khutbah vs iqamah boundaries, missing settings, estimates, no negative countdowns and no unqualified fixed Friday iqamah claim (the user-confirmed 20-minute default is explicitly estimated).
- Single-tap recording, repeat-tap safety, undo, Dhuhr alternative, old records and five-fard total.
- Matching prayer labels in card, summaries, adhkar, notifications and planner without automatically rescheduling existing tasks.
- Al-Kahf opening/partial/completed/undo, next-Friday reset without losing history, and no double counting in Quran progress.
- Salawat session preservation, personal targets, offline edits and two-device merge.
- Responsive light/dark UI, large text, touch targets and keyboard navigation.

## Implemented validation

- Ten focused browser tests: prayer identity and undo, three timing phases, 40-minute preference, Dhuhr alternative, historical records, reading completion/position, salawat session preservation, first-call notification, and two-device independent-field merge.
- Existing prayer regression tests pass alongside the new tests (36 checks before the final additional merge test).
- Responsive light/dark checks at 320, 390, 820, and 1366 pixels pass with no horizontal overflow.
- All testing uses isolated guest/fake-cloud data, never the user's account records.
- All ten Friday tests also pass on WebKit.
- The existing Quran page host refused a connection from the test environment. A visible independent Quran.com/18 fallback was added and its HTTP 200 response verified; the internal reader still uses the app's existing page provider.
