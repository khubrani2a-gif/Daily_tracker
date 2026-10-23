# Family usability v175

## Scope
Follow-up to v174. Preserve canonical planner task identity and shopping-linked transaction identity. Personal-account family organization; no account sharing or paid services.

## Changes
- Count remaining tasks for the selected date, not the next 90 projected recurrence instances.
- Classify appointment times as past, ongoing, future or all-day; retain past appointments in lists for explicit outcome recording.
- Independent task and appointment filters; default selected day and bounded upcoming seven days.
- In-dialog member archive undo validates owner and the post-operation snapshot before restoring.
- Archived members collapsed; member assignments accessible directly.
- Direct planner completion, inline subtasks, and existing guarded planner undo inside family.
- Existing expense remains reachable after reopening a shopping item; shopping state changes do not reverse financial transactions.
- Explicit selected date vs current financial date; label activity as members and shopping instead of implying complete planner history.
- Reduce duplicate navigation buttons. Prevent underlying mobile navigation obscuring the family overlay.

## Verification
New browser regression file: tests/family-usability.test.js. Existing family integration checks retained with the task navigation test updated to the unified tab. Tested with isolated synthetic data and mocked network services; no access to personal production records was required. Responsive screenshots captured at 320/390/820/1440px. Full application and Firebase suites form the release gate.
