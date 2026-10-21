# Dhikr session clarity and source corrections

## Behavior

- The circle continues to show the active round. A separate noninteractive line shows the sum of this dhikr across all rounds on the selected date, and explicitly names the recording date.
- Statistics distinguish the current round from the selected date's total.
- “جولات هذا اليوم” is inside More, away from the tapping area. Selecting an existing round restores its text, target and count, without creating or deleting rounds. A stale dialog cannot select a round after the selected date changes.
- The counter remains attached to the selected recording date; it does not silently move old-session counts across midnight. The recording date is visible in normal and focus views.
- A custom counter target is explicitly personal, not an assertion of a prescribed repetition count.

## Source review scope

Targeted corrections below are based on retrieved source text, not a claim that every entry in the collection has received a complete scholarly review. Text identity and counts were preserved, avoiding migration/reset of users' saved reader records. Reviewed entries now have direct source links.

| Entry | Evidence | Correction |
| --- | --- | --- |
| Seeking forgiveness 100 times | https://sunnah.com/muslim:2702b and https://sunnah.com/hisn:96 | The hundred-daily repentance report is in Muslim; label explicitly says the count is for the entire day. |
| Tahlil 100 times | https://sunnah.com/muslim:2691 | Clarify daily scope rather than implying an additional hundred each period. |
| Refuge from worry and debt | https://sunnah.com/abudawud:1555 | Attribute weakness of this morning/evening report to Al-Albani; avoid implying authenticated contextual prescription. |
| Hasbi Allah seven times | https://sunnah.com/abudawud:5081 | Attribute the report to Abu al-Darda; qualify its disputed authenticity instead of presenting the reward unconditionally. The source grades its particular wording as fabricated; this must not be generalized to the Quranic phrase itself. |
| Salawat ten times morning/evening | https://islamqa.info/ar/answers/130213 | Explain Al-Albani's later weakening after earlier improvement; remove unconditional intercession claim. The configured count is retained for organization. |

## Validation

- Browser regression tests cover round versus daily total, returning to a prior round and reload, explicit historical recording date, personal-goal labels and source links.
- Two isolated browser contexts each increment while cloud writes fail, then reconnect and retry. Four total increments remain four on both devices. This uses the real application merge/pending-sync functions and a fake cloud fixture, not the user's account.
- Responsive touch checks: widths 320, 390, 820 and 1366, both themes; no horizontal overflow, count and reader actions work.
- WebKit is a browser-engine check, not a physical iPhone test.

## Remaining verification limits

A physical iPhone/Safari session and exhaustive scholarly review of every text, context, and repetition in all collections remain outside the verified scope of this release. No claim of having completed either is made.
