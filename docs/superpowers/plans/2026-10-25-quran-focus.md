# Quran Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Comfortable focus reading with consistent browsing and explicit, undoable recording.
**Architecture:** Extend the two existing readers in index.html with shared focus, jump and recording sheets. Retain current persistence and custom completion journal; add main-reader range snapshots for undo.
**Tech Stack:** Vanilla HTML/CSS/JavaScript, Playwright/node:test.
**Spec:** docs/superpowers/specs/2026-10-25-quran-focus-design.md

## Global Constraints
- No new dependencies; preserve unknown stored fields and unrelated items.
- Page bounds 1–604 or custom section; Arabic/Persian digits accepted.
- Focus is opt-in inside the reader; all browsing is non-recording.
- Keep theme colors, white mushaf image surface, pinch zoom and 44px controls.

## Review Focus
- Day rollover during recording draft must reject stale submission.
- Incoming sync must not move a valid current viewing position or accept stale writes.
- Failed or out-of-order images must not present stale page content.
- Partial custom sessions must be undoable without erasing prior sessions.
- Small/landscape viewports must retain accessible exit and recording controls.

### Task 1: Focus, navigation and loading
Files: index.html, tests/quran-focus-v187.test.js.
Interfaces: qReaderFocus(prefix,on), qReaderJump(prefix), qReaderControls(prefix), qShowPage(prefix,page).
- [x] Write failing tests: focus hides metadata, exit preserves page, next/swipe never records, jump accepts Arabic digits and bounds, loading hides stale image.
- [x] Run the new test file and observe failures.
- [x] Add shared focus CSS, focus toggle, tappable page label, browse-only next, guarded image loading/retry, stable sync browsing.
- [x] Run focused tests; inspect phone/landscape geometry; commit.

### Task 2: Explicit recording and undo
Files: index.html, tests/quran-focus-v187.test.js, tests/quran-usability-v184.test.js.
Interfaces: qReaderRecord(prefix), qUndoReading(), qsMarkTodayDone(endPage) (explicit end optional; summary compatibility).
- [x] Write failing tests for main range count and undo, custom partial/multiple sessions and undo, stale/day rollover and duplicate submissions, final page.
- [x] Implement range confirmation sheets with account/item/date snapshots and exact labels. Use explicit end for custom sessions; preserve summary shortcut behavior. Main journal stores before/after counters and position for guarded undo.
- [x] Update the old navigation-recording test to assert the new browsing-only contract and explicit recording.
- [x] Run all Quran/iman/coordinator tests; commit.

### Task 3: Review, release and live checks
Files: tests/quran-focus-v187.test.js, index.html, sw.js.
- [x] Add tests for the five Review Focus conditions, and inspect both themes at 320/390/820/landscape widths with the actual mushaf image.
- [x] Obtain fresh whole-branch review; fix important findings with red/green evidence.
- [ ] Bump release/cache to187, full CI and Firebase tests, merge and deploy using existing workflows.
- [ ] Verify public file hashes and anonymous UI smoke (focus, jump, explicit recording and undo). Do not claim personal account/device verification.
