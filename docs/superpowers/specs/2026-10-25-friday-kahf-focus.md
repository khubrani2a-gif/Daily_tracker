# Friday Al-Kahf reader — release 188

Bring the release 187 reader interaction to Friday prayers without sharing reading progress between modules. The existing Friday day record remains the persistence and synchronization boundary.

- Opt-in themed focus; fixed bottom navigation and explicit recording action. No browser-fullscreen dependency.
- Quran pages 293–304, with adjacent surah verses at the page boundaries. Arabic/Persian page input; browsing and swiping never count reading.
- Shared image loader hides stale images and offers retry and an external page link.
- Explicit range confirmation starts at the next unread page. Partial sessions can be recorded more than once and persist for the selected Friday.
- Undo restores the latest session's prior position/count. Completion history may be retained independently of the Friday completion marker. Legacy completion without snapshots resets to the start with an explanatory message.
- Confirmation snapshots guard changes in date, account, midnight, or Friday reading data; other Friday preparation changes remain independent.
- Keep existing records untouched on opening, retain daily synchronization, and leave finance unchanged.

Validation covers navigation, invalid ranges, completion, partial sessions, undo persistence, retained history, legacy records, duplicate clicks, stale writes, loading failure, swipes, and focus geometry. Test actual cross-device sessions separately; automated synchronization tests use synthetic accounts.
