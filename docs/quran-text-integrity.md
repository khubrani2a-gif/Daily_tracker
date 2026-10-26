# Quran text integrity

Pinned on 2026-10-26 from https://api.alquran.cloud/v1/quran/quran-uthmani (Arabic Uthmani text edition). 114 surahs, 6236 ayahs. Text is not normalized, rewritten, or generated. Each SHA-256 covers UTF-8 JSON of [numberInSurah, globalNumber, text] rows, in order. Runtime checks the requested surah, edition, language, format, total count, global sequence and digest before rendering or accepting cache.

This is integrity verification against a captured upstream edition, not an independent scholarly certification or a proof that all upstream glyphs are correct. Do not silently update hashes on mismatch: review the source change and text diff first. The bundled Amiri Quran font remains mandatory. Requests time out after 15 seconds, including response-body loading.

Changing view pagination does not count reading or prayer; recorded totals and snapshot undo are unchanged.

Existing saved plans keep their original pagination to preserve their page indices and undo snapshots; new or explicitly replaced plans use ten-verse display pagination independently of optional prayer distribution.
