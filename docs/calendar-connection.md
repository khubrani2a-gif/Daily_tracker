# Optional Google Calendar connection

This is a free, foreground client integration for **individually selected occurrences**. It does not run a server, enable Firebase billing, access Google credentials from assistant connectors, or claim continuous background PWA push delivery.

## User flow

1. Sign into Mufakkirati using its existing Google sign-in.
2. Open Tasks → scheduling settings → **التقويم والتنبيهات** (also available from notifications).
3. Choose **ربط تقويم Google** and grant permission in Google's popup.
4. Save a dated item with a start/end time, or an all-day appointment. In its details choose **ربط هذه المرة مع Google**.
5. Selected occurrences appear in an app-owned secondary calendar named **مفكرتي اليومية**. Enable that calendar and its notifications in the Google Calendar/device app.

Once Google receives an event with reminders, the device calendar can deliver its notifications when Mufakkirati is closed, subject to OS/calendar notification settings. **These are calendar notifications, not service-worker push notifications from Mufakkirati.** New edits made in either system converge when Mufakkirati is open, online, and its Google authorization is valid. The connection does not request or store refresh tokens; reconnect after expiry, reload or a new device session.

## Google project setup, if connection reports 403

Using the Google Cloud project behind the existing Firebase Google OAuth provider:

- Enable **Google Calendar API**: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=daily-tracker-85609
- Check the OAuth consent screen / Google Auth Platform audience, data access and test-user configuration for the two requested scopes:
  - `https://www.googleapis.com/auth/calendar.app.created`: create a secondary calendar and read/write events on app-created calendars.
  - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`: discover the existing app calendar on another device instead of creating a duplicate on every connection. This lists calendar metadata, not personal calendar events.
- Keep the already configured Firebase authorized domains and Google provider enabled. OAuth consent/test-user/verification requirements depend on the project's audience; enabling the API alone is not proof that production consent works for every user.
- No service-account JSON, private key or OAuth client secret belongs in this repository or browser storage.

The integration is tested with a simulated API and Firebase provider. Live OAuth consent, project API enablement and real device notification delivery require verification in the owner's signed-in session; automated tests cannot establish these.

## Synchronization and limitations

- Auto-sync after local persistence, when returning online/foreground, and every minute while the page is visible and connected; manual retry is in the same settings sheet.
- Only bound occurrences are synchronized. Ordinary unlinked items and events created independently in Google are not imported. Recurring selection binds **that occurrence only**, retaining the planner's future series without duplicating it. Completion-based recurrence also requires selecting each new occurrence.
- Shared fields: title, local date/time or all-day flag, notes, location, saved site link, custom popup reminders, and cancellation. Checklists, priorities, task completion, categories and deadlines stay in Mufakkirati.
- Identifiers and last shared values are stored on the existing task record, using the existing daily journal/cloud merge. OAuth access tokens live only in memory and are cleared on disconnect/account change.
- Durably stored event IDs avoid duplicate inserts after a lost response. Updates use `If-Match` ETags. Three-way field merging keeps independent changes, treats date/time as a single unit and presents competing edits/deletions for an explicit choice. No blind overwrite on a 412 response or a local change during an outstanding request.
- Date moves retain the task ID, checklist and independent deadline. Remote cancellation is retained locally; unlinking deliberately leaves the Google event and reminders in place, as stated in the UI.
- Google multi-day events, independent Google recurrence and default-calendar reminder inheritance are not silently approximated: the item shows an actionable review error. Change it to a supported single occurrence/custom reminder, or unlink it.
- Moving a linked timed task to unscheduled requires unlinking it first; a Google event must have a date/time.
- Existing ICS export remains compatible with Google/Apple and requires no OAuth connection. ICS is a file transfer, not bidirectional synchronization. Direct iCloud/Apple two-way integration and a continuous backend push scheduler are **not implemented**.

## Official references

- https://developers.google.com/workspace/calendar/api/auth
- https://developers.google.com/workspace/calendar/api/guides/version-resources
- https://firebase.google.com/docs/auth/web/google-signin

## Direct reminder handoff

A saved dated task or appointment summary now has **التذكير عبر التقويم**. It offers the existing selected-occurrence Google link, ICS export, and direct access to reminder editing. The sheet explicitly distinguishes calendar delivery after closing the planner from foreground-only synchronization. An item without reminders is labeled rather than silently receiving a default alarm.

Continuous closed-app synchronization and planner-origin push remain unavailable on this static GitHub Pages / Firebase Spark architecture: no always-running scheduler or secure refresh-token backend is configured. This release introduces no paid infrastructure, service-account keys or browser-stored refresh tokens. Actual device calendar delivery and OAuth consent must be verified on the owner's device.

## Connection clarity

Linked appointment summaries and calendar settings show pending local changes, the last successful check, reconnect requests, or sync errors. The saved check is not a claim of continuous monitoring. After Google returns its event URL, a validated HTTPS link opens the linked event. Only Google Calendar host/path combinations are accepted.

Disconnect clears this device session only. The privacy section links to Google account connections for removing the app grant; this is a separate user action and leaves existing calendar events intact. Independently created Google events are not automatically imported.

## Quick connection

The planner shows **تفعيل اتصال Google** beside its primary controls. It starts the Google consent popup directly; after connection the same button opens sync management. Linking an appointment while disconnected presents **تفعيل Google وربط هذا الموعد** and continues that selected occurrence after successful consent. Closing the sheet cancels the pending link; it does not silently select other appointments.
