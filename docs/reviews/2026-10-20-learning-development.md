# Learning workspace release

The learning document now supports explicit subjects, bounded activity history, term dates and exceptions, future source versions, and attendance per occurrence. The planner projects dated prep/course/reading goals without requiring Google binding. Completion remains separate from event cancellation. Existing rows remain unassigned to subjects until the user chooses a relationship; no name-based migration is performed.

Study sessions, assignments and exams use the existing planner with `learningRef`, preserving one task identity and its existing Google integration. Source identity and original occurrence date remain stable when Google moves an occurrence. Source editor checks time overlaps; imported Google moves retain their requested time and surface time-conflict notices. Open-ended conflict checks cover one year; term checks are bounded to two years and the UI states the bound.

Scope choices distinguish one occurrence, future dates, and whole source editing. Semester exceptions are shared with projection/link selection. Weekly Google selection remains foreground-only and capped at 90 days; no background backend, billing, or new OAuth scope. The selected app calendar can be changed for new links, without moving old bindings.

Conflicting source edits remain explicit. Same-occurrence records now use three-way reconciliation rather than timestamp-only replacement. Google conflict UI displays actual differing fields and preserves independently changed fields. Source-specific conflict checks avoid pausing unrelated learning links.

Subject pages provide study work, templates and batch-edit previews. Bulk room/link/reminder changes preserve per-occurrence overrides by default. Archived content remains recoverable; archiving is an organizational view choice, not Google cancellation. Progress may be manual or derived from completed units. Week review labels planned time separately from recorded completion.

Validation evidence lives in /workspace/learning-development-evidence. A fresh independent review identified draft source identity, future first-date behavior, initial Google field choices, and archived lecture recovery; each is covered by a regression test before release. Actual signed-in OAuth and device notifications are not established by API simulations or emulator tests.

Release review fixes: initial Google conflict choices now override the fallback choice; study drafts are scoped to the learning source; future schedule edits respect their selected start date and do not copy a single-occurrence override; archived lectures can be restored even outside the displayed week; editing time preserves unchanged reminder arrays. The full test run caught a direct HTML rendering regression in learning status; shared calendar status now uses DOM text nodes and validated links.

Pre-release validation: 8/8 Firebase emulator integration checks passed. The first full run had 318/319 passing and identified the status rendering regression above; the final full rerun is the release gate.
