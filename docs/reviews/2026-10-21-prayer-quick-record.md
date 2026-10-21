# Prayer quick recording and live countdowns

The prayer card prioritizes the live adhan/iqamah countdowns and recording. Calculation metadata, location, refresh, and notification settings are collapsed under one disclosure.

- The user-confirmed iqamah schedule is Fajr 25 minutes, Dhuhr/Asr/Isha 20, Maghrib 10. Ramadan overrides are not included.
- Both clocks use the configured city's current date and timezone, independent of the selected recording day. Tomorrow's Fajr requires that date's validated timings. Missing timings remain unavailable instead of reusing today's values.
- Each unrecorded prayer has a one-tap action that records “ontime” with guarded undo. Repeated taps do not change the record. The separate ellipsis provides explicit late/missed/clear corrections. Future-day performance remains blocked.
- Five direct adhkar actions open their matching prayer context without recording performance; Duha has none and remains outside the five-fard total.
- Clock text updates every second without replacing the recording buttons. Date/location validation, legacy five-entry records, planner conversion, and independent offline edits retain their protections.

Validation: 26 prayer regression tests (including six quick-record/countdown tests), responsive checks at 320/390/820/1366 pixels in both themes. Full regression and deployment checks are tracked with the PR.
