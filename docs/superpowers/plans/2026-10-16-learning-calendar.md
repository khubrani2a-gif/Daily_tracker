# Learning calendar linking

Goal: link learning lectures and dated learning targets using the existing foreground Google consent flow, without daily task copies, extra scopes or services.
Architecture: separate per-occurrence records in the learning document; independently merged by timestamp. A lecture's original date is its stable identity. Google changes apply only to that occurrence. Later source edits replace previously acknowledged overrides for the changed field group; concurrent Google edits still use existing explicit conflict resolution. Source deletion cancels linked events. Unlink retains overrides and the Google event, using a timestamped tombstone for the binding.
Tech stack: existing vanilla JS, calendar core, Playwright/Node tests.
Global constraints: no credentials in storage; same account/race protections; retain existing untracked background-project files; no paid/back-end services.
Review focus: moved occurrences, duplicate prevention, source edits/deletion, durable retry, cross-device record merge, account changes and responsive controls.

- [ ] Add failing core and API-mocked UI tests.
- [ ] Add pure learning occurrence projection and normalization helpers.
- [ ] Integrate persistence and existing sync adapter; expose source and planner actions.
- [ ] Add bounded date-range selection and preview for weekly lectures.
- [ ] Verify targeted tests and responsive UI; independent review.
- [ ] Run regression CI, merge and verify deployment.
