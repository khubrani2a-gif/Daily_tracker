# Expense Experience Implementation Plan
> Use superpowers:executing-plans for inline execution and fresh final review.
**Goal:** Consistent elegant entry and variable-category navigation without accounting changes.
**Architecture:** Local icon/context catalog plus DOM presentation layered on original transaction handlers.
**Tech Stack:** HTML/JS/CSS and Playwright/Node.
**Spec:** docs/superpowers/specs/2026-10-24-expense-experience-design.md
## Global Constraints
Preserve IDs, budgets, transaction semantics, hidden category visibility. Suggestions do not write data. No new dependencies.
## Review Focus
Archived selected subcategory survives editing. Optional hidden fields retain values. Picker cancellation preserves draft and focus. Custom category fallback. Save/undo unchanged; existing saving failures must remain retryable.
## Task1
- [x] Tests RED: one named chooser, all category contexts, archived selection preservation, payment visible, advanced fields retained, direct category action.
- [x] Add catalog and presentation, category actions, quick guidance, contextual suggestions.
- [x] Update obsolete navigation tests only, preserve assertions.
- [ ] Targeted then full tests, actual screenshots at320/390/820/1440 light/dark.
- [ ] Fresh independent review, fix material issues, CI and publish; live check.
## Ledger
Baseline publishedv17744ead9f. Existing worktree reused with new isolated branch. User explicitly approved implementation, no repeat design gate.

## Verification evidence
- 8 focused experience tests pass, including archived subtype, failed save retry, fixed classification preview and collapsed travel/FX preservation.
- 21 targeted navigation/finance/travel tests passed before the final two regressions were added.
- Actual-font render: 320/390/820/1440, light/dark, both forms: no horizontal overflow or JS errors.
- Independent reviewer found fixed-category weekly preview mismatch; fixed via expClassify with regression; reviewer verified closure.
- Full suite exposed custom imported icon compatibility; restored escaped custom icon text, security audit now passes.
- Full suite/CI/deployment final results recorded in PR.
