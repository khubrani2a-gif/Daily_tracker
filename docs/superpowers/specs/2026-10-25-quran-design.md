# Quran reliability and simplification

User explicitly requests audit, practical improvement/simplification and implementation, preserving existing data. Scope: daily Quran reading, custom page ranges, memorization review and shared Quran reader lifecycle; no scripture content changes or finance/learning feature edits.

Approach chosen as implementation judgment: targeted repairs and short existing-style forms. Alternatives considered: only patch defects (leaves no restart/position control and five-prompt creation); redesign all worship/navigation (unnecessary risk and scope). Existing vanilla JS/localStorage/Firebase architecture remains; no dependencies.

Daily reading: retain explicit read-and-next action and legacy progress fallback. Separate an explicit per-day read count when manually changing bookmark so position selection/restart cannot invent or erase read pages. New day resets daily count; final page remains explicitly recordable/undoable inside reader. Settings hold target and next-page bookmark, with restart preparing page1 until Save. Stale settings cannot overwrite new progress. Accepting cloud progress reconciles open reader cursor and durable daily completion.

Custom Quran ranges: one short form with label/start/end/target and optional icon; Arabic digits; bounds1–604; preserve unrelated worship records. Preserve existing range tracking semantics and editor fields.

Memorization/shared reader: generation and account/session guards prevent stale success/failure callbacks; closing ends review queue; audio failures restore usable controls; new segment IDs cannot collide in the same millisecond. Shared witr Quran loads receive scoped late-response guards.

Tests use synthetic data and mocked external transport. Real account/device sync and personal balances/content are not claimed verified. Record unresolved limitations and user-specific symptom if supplied. Full npm test and Firebase emulator suite, actual-font light/dark responsive screenshots, independent review, CI, deployment and public anonymous smoke required before completion.
