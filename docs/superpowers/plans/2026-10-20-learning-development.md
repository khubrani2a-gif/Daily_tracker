# Learning development implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. Final fresh-context review required.

**Goal:** Make learning schedules, goals, study work and Google occurrences coherent and usable.
**Architecture:** Extend the existing learning document with subjects, activity, and per-occurrence outcomes; use existing daily tasks for study sessions/assignments/exams with durable source references. Keep calendar identity stable and foreground-only sync. Add pure calendar/learning helpers to calendar-core.js and UI in the existing index.html closure.
**Tech Stack:** Vanilla JS, Firebase compat, Node test, Playwright.
**Spec:** docs/reviews/learning-development-requirements.md and learning-development-additions.md.

## Global constraints
- No paid services, no background backend, no new Google scopes or personal calendar writes during tests.
- Preserve user data, stable Google IDs, existing guest/account isolation and existing untracked files.
- Approved autonomous execution/publish persists; no repeat approval needed.

## Review focus
- Source edits after Google occurrence overrides; stable identity and cancelled occurrences.
- Concurrent same-occurrence edits/unlink and stale open editors.
- Semester boundaries, weekly day changes and holidays.
- Completion separate from calendar cancellation and study-session completion.
- Mobile keyboards, long RTL labels and visible actions without horizontal overflow.

## Task 1 — consistent projection and occurrence merge
Files: calendar-core.js, data-core.js, index.html; tests/learning-development.test.js, tests/learning-development-ui.test.js.
Interfaces: learningSource/learningTask keep signature; add learningOccurs(item,date), learningConflictAffects(conflicts,row).
- [ ] RED: unlinked dated targets visible, completed source is done, semester/holiday skips, same occurrence field merge conflicts.
- [ ] Implement projection for all target kinds and all-day non-blocking deadlines; preserve state independent of Google values.
- [ ] GREEN targeted suites and commit.

## Task 2 — scheduling and Google controls
Files: index.html/calendar-core.js; UI and calendar tests.
- [ ] RED: learning editor refuses overlap without explicit acceptance; single occurrence edits don't change series; future scope preserves past; range respects term/holidays.
- [ ] Add source scope selector, local occurrence editor, week navigation, global schedule conflict notice after remote moves, granular calendar conflict choices and scoped pause.
- [ ] Add optional reminders/url and calendar state/coverage controls; preserve narrow scopes.
- [ ] GREEN targeted suites and commit.

## Task 3 — subjects and actionable study work
Files: index.html/data-core.js; UI tests.
Interfaces: learning subjects have immutable id; source rows carry subjectId. Existing task rows carry learningRef {kind,sourceId,subjectId,type}; sessions use existing planner, not copied learning objects.
- [ ] RED: subject rename preserves IDs; assignments/exams/session added once, attendance applies to occurrence only, progress from units, filters/archive and Arabic labels.
- [ ] Add subject page, templates, linked task creation, outcomes, bulk source changes with preview, bounded activity log and week summary.
- [ ] Simplify forms, preserve controls, add search/status filters and focused primary actions.
- [ ] GREEN targeted suites and commit.

## Task 4 — release
- [ ] Fresh review of branch; fix material findings with regression tests.
- [ ] Run npm test and npm run test:firebase; version all changed core assets and cache.
- [ ] Merge/publish under existing authorization; verify deployed assets and synthetic public UI, report actual limitations.
