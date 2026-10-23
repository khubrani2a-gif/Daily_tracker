# Finance Icons Implementation Plan
> **For agentic workers:** Use superpowers:executing-plans.
**Goal:** Refine finance without rebuilding its accounting.
**Architecture:** Existing actions with inline SVG and CSS; no dependencies or schema changes.
**Tech Stack:** HTML/CSS/JavaScript, Node test and Playwright.
**Spec:** docs/superpowers/specs/2026-10-23-finance-icons-design.md
## Global Constraints
Preserve money calculations, undo and original action handlers. Four shortcuts, named decorative SVG icons. Support RTL, dark, mobile and keyboard.
## Review Focus
- Shortcut must not save transactions.
- Missing income/budget must not imply zero progress or a bank balance.
- Large and negative amounts must remain readable.
- SVG clicks must activate the same button.
- Keyboard focus and narrow screens must remain usable.
## Task 1: presentation and shortcut routes
- [ ] Add behavioral tests for four shortcuts and unchanged financial state; observe failure.
- [ ] Add local icon helper, four read-only routes, summary indicators with explicit meanings, responsive styling.
- [ ] Run finance tests; inspect screenshots at four widths and two themes.
- [ ] Run full suite and independent review, fix verified issues.
- [ ] Commit, publish after CI and verify deployed assets.
## Ledger
Baseline: v176 passed596+8 in prior turn; clean branch from published6e09d1b.
Ruling: use existing isolated worktree, new branch; no approval repetition because user authorized development and previously opted out of repeated permission.
