# Hifz Quran text rendering correction

The memorization reader used the app's Thmanyah Sans font for Uthmani Quran text, unlike the qiyam reader. It also rendered without checking that the Quran font loaded. This can make Quran-specific marks appear incorrectly even when the source text passes its pinned integrity check.

The reader now uses the bundled Amiri Quran font with normal weight, no synthetic styling, and normal letter spacing. Text and font load concurrently; rendering requires both the existing source validation and a loaded Quran font. If either fails, the existing safe fallback asks the reader to use their mushaf. No stored memorization progress, review intervals, Quran strings, or source hashes change.

Two browser regressions reproduce the old behavior and pass after the fix: exact preservation of the source text including combining marks with the Quran font loaded, and refusal to render in a substitute font when the font download fails. Both also pass on Linux WebKit.

This corrects a proven display defect. It does not independently certify the entire upstream Quran edition. A reported textual error still needs its surah and ayah identified and compared with a trusted reference.

Validation on 2026-10-28:
- Targeted hifz/reader regression run: 37 passed.
- New rendering tests on Linux WebKit: 2 passed.
- Whole suite with four workers: 932 passed, 2 failed (934 total). The failures were calendar-ui's unchanged-check timestamp assertion and dhikr-session-clarity's statistics-button click timeout. The calendar group subsequently passed 39/39; the dhikr group passed 5/5 when rerun without the parallel full-suite load. The dhikr timeout was also reproduced using the pre-change index.html. The parallel full run is not recorded as a clean pass.
- No deployment or personal account changes performed in this correction.
