# Planner next usability implementation plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation and a fresh whole-branch review.

**Goal:** Complete the six approved planner usability improvements without changing task ownership, recurrence or synchronization semantics.
**Architecture:** Keep the existing HTML application and pure planner core. Reuse the validated quick-schedule dialog and plannerMove transaction for previewed schedule edits. Add backward-compatible weekday availability to existing preferences.
**Tech Stack:** Plain JavaScript, CSS, Playwright, Node test runner, existing Firebase/Google integration.
**Spec:** User-approved six proposals in this conversation: compact toolbar; progressive edit fields; consistent summary entry; visual preparation; precise move/resize with preview, undo and touch/keyboard alternative; per-weekday multiple availability windows. Free services only; assess background sync without claiming unsupported functionality.

## Global constraints
- Arabic RTL; mobile/tablet/laptop; no paid services.
- Preserve recurrence instances, learning source ownership, account isolation, existing drafts, cloud records and safe undo.
- No silent schedule changes; conflict preview and deliberate confirmation.
- True closed-app background synchronization cannot be represented by page timers. Existing calendar delivery remains explicitly described.

## Review focus
- A stale or deleted item must never be recreated by a gesture confirmation.
- A recurring occurrence changes only that occurrence; source learning events edit in learning.
- Dragging must not trap normal phone scrolling or lose event duration and preparation.
- Invalid/overlapping availability windows must not partially replace preferences; missing weekdays inherit legacy range.
- Collapsed editor fields must retain values and reveal the exact invalid field when save fails.

### Task 1: compact entry and progressive editor
Files: index.html, tests/planner-next.test.js, existing planner/calendar UI tests.
Interfaces: plannerSummary(row,trigger) becomes common entry; plannerOpen stays explicit editor API; existing field IDs remain stable.
- [x] Write tests for closed More, common summary, collapsed sections and preservation on save; run RED.
- [x] Move tools into details #plannerMore, preserve state; render optional field groups as details with data-presence badges and automatic validation reveal.
- [x] Update existing browser paths to explicitly choose Edit/open sections; run focused tests GREEN; commit.

### Task 2: preparation and gesture scheduling
Files: index.html, tests/planner-next.test.js.
Interfaces: plannerQuickActions(row,trigger,proposal) previews proposed date/time/end using existing validation and plannerMove. Pointer gestures use a separate handle; keyboard opens same dialog.
- [x] Write tests for visible buffer, drag/resize proposals without mutation, conflict acceptance, stale rows and recurring undo; run RED.
- [x] Render preparation bands and move/resize handles. Snap to 15 minutes, clamp to day bounds, preview on release; escape cancels. Keep touch scrolling outside handles and source events read-only.
- [x] Run focused tests GREEN; commit.

### Task 3: weekly availability and calendar handoff
Files: planner-core.js, index.html, tests/planner-core.test.js, tests/planner-next.test.js, docs/calendar-connection.md.
Interfaces: availability(prefs,date)->[{start,end}], availableSlots(rows,date,prefs,duration,buffer,notBefore)->slots. weeklyAvailability keys 0..6; each day [] (unavailable) or up to 3 nonoverlapping intervals; absent key inherits start/end.
- [x] Write tests for legacy fallback, unavailable day, split windows, conflicts/buffer and invalid settings; run RED.
- [x] Add pure validation/slot functions, day-specific settings and use them in suggestions. Preserve existing start/end/weekStart/workdays/prayers. Add summary calendar action using existing export/Google paths and honest foreground limitation.
- [x] Run focused tests GREEN; document free background limitation; commit.

### Task 4: integration and delivery
- [ ] Full npm test and Firebase emulator tests; browser review in Chromium/WebKit across 320–1366 px.
- [x] Fresh whole-branch reviewer using executing-plans requirement; fix important findings with failing regression then green suite.
- [ ] Bump cache v146, update docs, open PR, wait CI, merge exact head, wait Pages, verify published hashes and guest workflows.
