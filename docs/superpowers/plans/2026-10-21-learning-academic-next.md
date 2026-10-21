# Learning Academic Organization and Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Native execution continues the previously used method; no new agent delegation is requested by this plan.

**Goal:** Organize Learning by academic year and term, then complete conflict resolution, Google coverage, role-specific actions, study-time visibility and weekly review without duplicating existing engines.

**Architecture:** Add a small pure `learning-core.js` UMD module for term validation/selection, coverage and summary calculations. Keep UI orchestration in existing Learning functions in `index.html`, reuse planner/calendar engines and existing task storage, and extend `data-core.js` three-way reconciliation for academic entities. Materialize term bounds only through explicit save/preview operations; opening or filtering the app never rewrites schedules.

**Tech Stack:** Vanilla JavaScript, existing Firebase compat integration, Node test runner, Playwright Chromium/WebKit, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-21-learning-academic-next.md` (read before executing).

## Global Constraints

- لا خدمة مدفوعة، ولا بنية خلفية، ولا صلاحيات Google إضافية.
- مزامنة Google أثناء فتح المفكرة واتصال الحساب فقط؛ أقصى دفعة ربط 90 يومًا شاملة البداية والنهاية.
- لا استنتاج لتقويم الجامعة أو اسم الفصل من تاريخ اليوم وحده.
- لا تغيير لمعرّفات المصادر أو المرات أو روابط Google عند إسناد بيانات قديمة لفصل.
- لا حذف للتاريخ أو الإنجاز أو المواعيد البعيدة بسبب الأرشفة أو تغيير مرشح العرض.
- الاختبارات تستخدم بيانات تجريبية؛ OAuth الحقيقي وإشعارات الجهاز تحقق مستقل.
- التخطيط فقط في هذه الجولة؛ التنفيذ والنشر مرحلة لاحقة.

At execution, reread the current production HEAD and AGENTS instructions; this plan is based on fdc8b88 (v154). Preserve the pre-existing untracked background plan/specs. Use an isolated worktree at execution, not a production edit. The current six improvements are one connected Learning program, split into three independently shippable batches below, not six unrelated redesigns.

## Review Focus

1. Old data with no term, orphaned references and restored backups must retain IDs, progress and Google bindings (Tasks 1–2).
2. Two overlapping terms, midnight/time-zone changes and explicit selection must not pick or rewrite the wrong term (Tasks 1–2).
3. Term shortening/holidays and Google-moved exceptions must preserve history and require explicit cancellation decisions (Tasks 2,5).
4. Changes from a second tab/device during preview, sync or focus must not overwrite newer state or add time twice (Tasks 2,4–6).
5. A later linked event, partial Google failure, missing attendance or missing time must not create false completeness/statistics (Tasks 5,7).

## File boundaries and interfaces

- Create `learning-core.js`: pure derived calculations, UMD `MufLearningCore`; CommonJS requires existing planner/calendar core, browser loaded after those scripts. No storage or network calls.
- Modify `index.html`: academic UI, source preview/save adapters, current focus/planner integration. Keep existing function entry points working.
- Modify `data-core.js`: academic entity validation/reconciliation and atomic structural groups.
- Modify `calendar-core.js` only if a regression proves the existing futureChanges/exception machinery cannot apply explicit bounds; don't change stable occurrence IDs.
- Modify `sw.js` and all index core query versions together whenever a batch changes cache assets. Add learning-core to install/offline caching; choose the next version from the then-current production version (155 if still 154).
- Tests: new `tests/learning-academic-core.test.js`, `tests/learning-academic-ui.test.js`, `tests/learning-coverage.test.js`; extend existing learning reconciliation, calendar UI, planner/focus and Firebase browser tests as specified below.

Data contract (all IDs immutable):
```
academicYears: [{id,name,startDate,endDate,createdAt,updatedAt,deletedAt}]
terms: [{id,yearId,name,startDate,endDate,excludedDates,archived,createdAt,updatedAt,deletedAt}]
subjects[].termId: string | ''
subjects[].role: 'study' | 'teaching' | 'both'
schedule[].termPolicy: 'inherit' | 'custom' | 'legacy'
```
Dates are valid ISO calendar dates, ranges inclusive. Subject termId is the sole academic ownership reference; existing source.subjectId/task.learningRef.subjectId resolve through it. Missing/deleted references are shown as unassigned with original reference retained, not dropped. `termPolicy` describes how saved schedule bounds were chosen; projection continues to read schedule.termStart/termEnd/excludedDates and existing futureChanges, never mutable UI selection. Academic archive does not imply cancellation.

Common test fixture in the new core test file (these dates are synthetic, not the user's university calendar):
```js
const {test} = require('node:test');
const assert = require('node:assert/strict');
const LC = require('../learning-core');
const year = {id:'y',name:'2026–2027',startDate:'2026-08-01',endDate:'2027-07-31'};
const term = {id:'t',yearId:'y',name:'الأول',startDate:'2026-09-01',endDate:'2026-12-31',excludedDates:[]};
const data = {academicYears:[year],terms:[term],subjects:[{id:'s',name:'Physics',termId:'t'}]};
```
Core APIs throw an Error with user-safe Arabic text on invalid mutation input; normalization retains legacy content and reports invalid academic associations instead of throwing during app startup. All preview result objects include a snapshot/version token checked before save.

## Batch A — academic organization and tailored actions

### Task 1: Academic model, selection and cloud/backup compatibility

**Files:** create `learning-core.js`, `tests/learning-academic-core.test.js`; modify `index.html`, `data-core.js`, `sw.js`, `tests/learning-reconcile.test.js`, `tests/firebase/browser-sync.test.cjs`.

**Interfaces:** `LC.validateAcademic(data) -> {valid,issues:[{id,field,message}]}`; `LC.selectTerm(data,today,selection) -> {status:'selected'|'ambiguous'|'none'|'independent'|'all',termId,candidateIds}`. `selection` is `{mode:'auto'|'term'|'independent'|'all',termId?}`. Store selection in account-scoped local preference, not the cloud Learning document. `LC.subjectTerm(data,subjectId) -> term|null` is used by later tasks.

- [ ] Write core regressions: one current term, two overlapping terms, leap/invalid day, end before start, term outside year, holiday outside term, empty legacy arrays. Assert `LC.selectTerm(data,'2026-10-21',{mode:'auto'}).termId === 't'`; adding a second matching term returns `ambiguous`, not either ID. Explicit archived selection remains openable; auto excludes archives.
  Test anchor (extend with the listed boundary cases):
  ```js
  test('current academic term is date-based and ambiguous overlap is explicit',()=>{
    assert.equal(LC.selectTerm(data,'2026-10-21',{mode:'auto'}).termId,'t');
    const overlapping={...data,terms:[term,{...term,id:'other'}]};
    assert.equal(LC.selectTerm(overlapping,'2026-10-21',{mode:'auto'}).status,'ambiguous');
  });
  ```
- [ ] Add reconciliation/backup cases: different entity edits merge; concurrent term date/holiday edits produce one structural conflict; editing a referenced year range cannot commit invalid children without review; old backups retain existing schedule IDs/bindings and all new arrays round-trip. Two real SDK clients preserve both independent term additions.
- [ ] Run `node --test tests/learning-academic-core.test.js tests/learning-reconcile.test.js` and confirm failures are missing academic behavior, not fixture errors.
- [ ] Extend learning normalizer/import validator/reconcile arrays for academicYears and terms, preserving unknown legacy relationships; structural groups year `[startDate,endDate]`, term `[yearId,startDate,endDate,excludedDates]`, subject `[termId]`. Surface invalid concurrent parent/child results for review instead of dropping children. Add module loading/cache assets and account-isolated selection.
- [ ] Rerun the targeted command and `npm run test:firebase`; all pass. Verify service-worker offline upgrade includes the new module. Commit `feat: add academic year and term data model`.

### Task 2: Term management, safe assignment and schedule propagation

**Files:** modify `learning-core.js`, `index.html`; create `tests/learning-academic-ui.test.js`; extend `tests/calendar-ui.test.js`.

**Interfaces:** `LC.previewTermAssignment(data,subjectIds,termId) -> {subjectIds,termId,sourceIds,snapshot}` changes relationships only. `LC.previewTermBounds(data,termId,fromDate,today,sourceIds) -> {changes,affectedOccurrenceIds,outsideBoundOccurrenceIds,snapshot}` applies to selected inheriting/explicitly adopted sources. `LC.copyTermStructure(data,sourceTermId,targetTerm,subjectIds,idFactory) -> {subjects,schedule}` returns new unlinked records only. UI `learningOpenAcademicTerms()` and `learningApplyAcademicPreview(preview,decisions)`; decisions enumerate keep-as-exception/cancel for affected bound occurrences.

- [ ] Write UI tests using `tests/audit-browser-helper.cjs`: create year and term, select it, assign an existing subject, reload; assert old source ID, original occurrence date and Google event ID unchanged. Open ambiguous current-term choice; change local day and verify explicit selection remains selected. Verify guest/account preference isolation.
- [ ] Write propagation/copy regressions: past lecture snapshot unchanged after shortening; moved Google occurrence is present in preview and cannot be silently discarded; concurrent update invalidates preview; copy produces distinct IDs, no calendarOccurrences, bindings, outcomes, tasks or progress. Unassigned personal course remains accessible.
- [ ] Run `node --test tests/learning-academic-core.test.js tests/learning-academic-ui.test.js tests/calendar-ui.test.js`, confirm new cases fail for intended reasons.
- [ ] Build compact year/term selector and CRUD/archive/restore sheets. New lecture inherits explicit saved term bounds; legacy assignment defaults to `legacy` and unchanged dates. Applying bounds uses futureChanges from `max(today,chosenFrom)` and the existing exception records. Require decisions before save for linked occurrences affected by range changes; do not make network writes from filters. For once-only lectures, preview existing dates and retain them unless explicitly edited; do not apply weekly futureChanges to them. Structural copy clears prepId and any old source-instance references as well as bindings/outcomes. Provide structural-copy preview and separate fresh Google linking afterward. Preview, stale account/data guard and save are distinct steps in UI.
- [ ] Rerun targeted suites; verify backup round-trip and 320/390/820/1366 widths plus short viewport. Commit `feat: organize learning by academic terms without rewriting history`.

### Task 3: Role-specific actions with all functions retained

**Files:** modify `index.html`, `tests/learning-academic-ui.test.js`.

**Interfaces:** `LC.actionsForRole(role) -> {primary:string[],secondary:string[]}` with stable action IDs. Primary study `[session,assignment,exam]`, teaching `[prep,lecture,outcome]`; both presents the two labeled groups without duplicating actions. Reuse learningCreateWork/learningOutcomeEditor and existing form functions.

- [ ] Add assertions for all three roles and legacy role default. For teaching, primary contains `prep` and `lecture`; session remains in secondary. Switching role leaves source/task/binding IDs unchanged.
- [ ] Run `node --test tests/learning-academic-core.test.js tests/learning-academic-ui.test.js` and confirm new failures.
- [ ] Add `both` to normalization and controls, reorder visible actions and label attendance options without deleting previously stored outcomes; retain every action under «المزيد». Keep term selector usable by keyboard and screen reader.
- [ ] Rerun tests, visually inspect light/dark mobile and wide screens, commit `feat: tailor learning actions for study and teaching`.

## Batch B — resolve conflicts and make Google coverage truthful

### Task 4: One-occurrence alternative time suggestions

**Files:** modify `learning-core.js`, `index.html`; extend `tests/learning-academic-core.test.js`, `tests/learning-academic-ui.test.js`, `tests/calendar-ui.test.js`.

**Interfaces:** `LC.suggestOccurrenceSlots(task,allRows,prefs,date,nowTime) -> [{start,end}]` uses PC.availableSlots and returns at most 3. `learningShowTimeConflicts()` adds suggestions; choosing one opens existing one-occurrence editor with defaults, not an immediate mutation.

- [ ] Test a 09:00–11:00 lecture with a conflict at 10:00, duration 30 and availability 09:00–12:00: returned starts must be at least 11:00, retain buffers, and exclude existing occurrence by ID only. Include another term's booking, no availability, all-day items and insufficient remaining time.
- [ ] UI regression: choose suggestion, insert a conflicting booking from another device before save, assert no silent save. Reschedule one occurrence and assert next week and Google event identity unchanged.
- [ ] Run core/UI/calendar targeted commands and see expected new failures.
- [ ] Implement suggestions and overlap interval labels using all planner rows regardless of academic filter. Reuse existing explicit conflict acceptance and scope editor. For missing duration require duration entry rather than guessing.
- [ ] Rerun targeted suites and commit `feat: suggest safe alternative lecture times`.

### Task 5: Gap-aware calendar coverage and bounded extension

**Files:** modify `learning-core.js`, `index.html`; create `tests/learning-coverage.test.js`; extend `tests/calendar-ui.test.js`.

**Interfaces:** `LC.calendarCoverage(expectedRows,records,context) -> {required,linked,confirmed,pending,review,unlinked,firstMissingDate,confirmedThrough,lastVerifiedAt,exceptionRows}`. Context `{calendarId,from,to,checkedById,errorsById,connected}`; records from current calendarRecords, checked/errors from current session. `LC.nextCoverageWindow(coverage,termEnd) -> {from,to}|null`, span <=90 inclusive days starting first missing occurrence. A binding base equal to current snapshot and successful syncedAt/checkedAt establishes last-known confirmation; lack of fresh connection must remain visible.

- [ ] Test expected dates 2026-10-05,12,19 with only 05 and19 confirmed: `unlinked === 1`, `firstMissingDate === '2026-10-12'`, `confirmedThrough === '2026-10-05'`. A later event must not cover the gap. Cover holidays, empty range, unlinked tombstone, cancellation pending, moved occurrence preserving original ID, mixed calendars/accounts and base differing from current fields.
- [ ] Test `nextCoverageWindow` never exceeds 89 days between endpoints nor term end. API UI tests: partial batch failure, reconnect, repeat click/lost insert response, account change while preview open. Assert no duplicate event ID and truthful confirmed counts after retry.
- [ ] Run `node --test tests/learning-coverage.test.js tests/calendar-ui.test.js` and confirm new failures.
- [ ] Add subject/term coverage card; derive expected rows from actual occurrence rules without filtering away bound exceptions. Group statuses disjointly, keeping pending cancellation in exceptionRows. Implement gap-started preview using existing calendarLink/calendarSync, never background scheduling. Store no extra OAuth secrets or second binding registry.
- [ ] Rerun tests and cache regression; commit `feat: show calendar gaps and extend learning coverage safely`.

## Batch C — reuse recorded study time and complete weekly review

### Task 6: Expose existing actual time and focus in subject workspace

**Files:** modify `index.html`; extend `tests/learning-academic-ui.test.js`, `tests/audit-tasks.test.js`, `tests/today-overview.test.js`, `tests/planner-next.test.js`, `tests/planner-ui.test.js`.

**Interfaces:** `learningOpenStudyFocus(row)` delegates to the existing planner focus path; `learningEditStudyTime(row)` opens existing actualMinutes control. Retain durationMinutes (planned), actualMinutes (recorded aggregate), learningRef and current storage engine. No new timer or session database.

- [ ] Add a 30-minute study task with actualMinutes=20: subject shows both correctly, editing to25 results in25 rather than45, and the course's progress remains unchanged. Completing a focus segment once adds once; repeated finish cannot add again. Projected recurring task records time only on that occurrence.
- [ ] Add guards for navigating to another day, changing account or deleting the source while focus is open. Saving must target original task identity or show stale-state error, not write to another active task/day.
- [ ] Run `node --test --test-concurrency=1 tests/learning-academic-ui.test.js tests/planner-ui.test.js tests/planner-next.test.js tests/audit-tasks.test.js tests/today-overview.test.js` and confirm relevant new tests fail.
- [ ] Wire primary focus/manual-time actions to current routes; repair only demonstrated identity/double-finish gaps. Show unknown time as «لم تسجل», retain manual input validation, and don't add a duplicate counter or mark the source course complete.
- [ ] Rerun identified focus/planner and academic suites; commit `feat: expose recorded study time in subject workspace`.

### Task 7: Historical weekly review by term and subject

**Files:** modify `learning-core.js`, `index.html`; extend `tests/learning-academic-core.test.js`, `tests/learning-academic-ui.test.js`.

**Interfaces:** `LC.weekRange(date,weekStart) -> {from,to}`; `LC.weekSummary({rows,data,from,to,termId,subjectId,asOfDate}) -> {lectures,attendance,sessions,deadlines,time}`. lectures and attendance group unique original occurrence IDs; sessions count unique actual task occurrences; deadlines uses deadline if present else dated learning targetDate. time `{plannedMinutes,recordedMinutes,measuredCount,pairedPlannedMinutes,pairedRecordedMinutes,unknownCount}` is attributed to task schedule dates, not timer-event dates. Empty values remain unknown, not invented zero measurements.

- [ ] Assert a Monday-start week containing 2026-10-21 has from2026-10-19/to2026-10-25. Cover year boundary and daylight-saving date arithmetic. Fixture: planned session30/actual20 and planned session60/no actual => planned90, recorded20, measuredCount1, pairedPlanned30, pairedRecorded20, unknownCount1.
- [ ] Attendance fixture with one attended, one absent, one cancelled and one past without outcome must keep the latter unrecorded. Task planned outside week but deadline inside is counted once as a due item. Include Google-moved lecture, independent goals, archived term, orphan subject and duplicate projected rows.
  Test anchor:
  ```js
  assert.deepEqual(LC.weekRange('2026-10-21',1),{from:'2026-10-19',to:'2026-10-25'});
  ```
- [ ] Run `node --test tests/learning-academic-core.test.js tests/learning-academic-ui.test.js` and confirm expected new failures.
- [ ] Replace rolling seven-day-only summary with previous/current/next week and term/subject controls using existing weekStart preference. Display aggregate attribution caveat from spec, drill down to underlying rows, and don't derive absence from time passing. Filter report rows by selected term but conflict computation continues to use all commitments.
- [ ] Rerun targeted suites; commit `feat: review learning weeks with explicit attendance and recorded time`.

## Task 8: Integrated release and real-account acceptance boundary

**Files:** update `docs/calendar-connection.md`, add `docs/reviews/2026-10-21-learning-academic-release.md`; version `index.html`/`sw.js`/new core assets consistently for each shipped batch.

- [ ] Walk the spec coverage map below and record implemented/partial status; don't label planned checks successful. Inspect each batch diff for unintended changes to existing user data or OAuth scope.
- [ ] Run `npm test` and `npm run test:firebase` against a stable tree; run new academic UI scenarios in Chromium and available WebKit at four widths and short viewport, with keyboard/focus and dark contrast checks. On failure, add the smallest regression reproducer and fix before release.
- [ ] Record a single integrated review before final publishing, focusing on the five risks above. Use permitted review tooling/method at execution; this document itself does not authorize spawning agents.
- [ ] Follow existing authorized publishing workflow: PR checks, merge, Pages checks, public asset hashes and fresh-guest smoke. Preserve original untracked files. Verify prior cache can upgrade and new core is available offline.
- [ ] Separately verify a clearly named test event through actual Google OAuth if a signed-in authorized session is available: app→Google, Google→app, conflict handling and reconnect. Record “not verified” if access is absent; never substitute simulation for this result. Device notification delivery requires observation on the user's device and is a separate result, not a publishing claim.
- [ ] Publish release notes with completed features, actual test counts and limitations; commit documentation with the implementation batch rather than claiming future validation already happened.

## Coverage and self-review

| Requirement | Owner tasks | Acceptance evidence |
|---|---|---|
| Year/term/current selection | 1–2 | date/overlap/legacy/UI/Firebase tests |
| Safe assignment, inherited bounds, archives, structural copy | 1–2 | IDs, old snapshots and Google binding unchanged; explicit exceptions |
| Study/teaching/both | 3 | action visibility and data invariance |
| Conflict alternative | 4 | real free slot, buffers, stale recheck, one occurrence |
| Google coverage/extension | 5 | gap before late event, partial failure and retry |
| Existing recorded time integration | 6 | no second counter; no wrong-day or repeated finish |
| Weekly history and trustworthy metrics | 7 | known/unknown split, deadline selection, paired sample |
| Release and real-account distinction | 8 | CI/live evidence plus separately labeled OAuth/device result |

Self-review completed at planning time: all six user-requested axes mapped; the existing timer/actualMinutes discovery corrected the earlier feature inventory. No academic dates assumed. Interfaces use termId via subjects, not redundant task ownership. Structural-copy and bounds previews are distinct. Code implementation and new tests have not been executed in this planning turn.
