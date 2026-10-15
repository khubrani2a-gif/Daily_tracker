# Background Google Calendar synchronization and Web Push

Status: implementation/deployment blocked on backend account access and Google OAuth configuration. No background capability has been activated.

## Approved outcome
Keep selected linked Google Calendar occurrences synchronized while the planner is closed, and deliver planner-origin reminders for dated tasks and appointments while closed. Preserve the existing foreground integration, recurrence semantics and all user data. No paid plan, billing activation or paid fallback is authorized.

## Proposed deployment
Keep the UI on GitHub Pages and data in Firebase Spark. Use a separate Cloudflare Workers Free deployment with D1 for OAuth handshakes, encrypted grants, device subscriptions, job leases and delivery receipts. A minute Cron trigger dispatches reminders; calendar polling is bounded (initial target five minutes, not real time). This is conditional on a measured Free-tier CPU/quota test: current documentation limits each Free invocation, including Cron, to 10 ms CPU. Failure to fit must stop deployment, not enable billing.

The app must expose foreground-only status until the backend is provisioned, health checks succeed, and the owner completes account binding. No browser timer may stand in for background execution.

## Account and deployment prerequisites
- Cloudflare Free account with Workers and D1 available. Authenticate deployment through the provider's login flow; do not paste API tokens into chat.
- Google web OAuth client in the existing daily-tracker-85609 project, Calendar API enabled, an exact deployed HTTPS callback, and consent-screen configuration appropriate to the account. Offline authorization requires a new consent flow; existing Firebase popup access tokens are insufficient.
- Secure backend access to the canonical Firestore data, configured through secret storage with restricted permissions. Do not place a service-account key or OAuth client secret in the repository, the web app, or client-writable Firestore documents.
- The owner must bind Google and grant notification permission on the actual device. For iOS/iPadOS 16.4+, install the PWA on the Home Screen first. No Apple paid developer subscription is needed for standards-based Web Push.

## Backend responsibilities
1. Verify Firebase ID tokens (signature, issuer, audience, expiry and uid) on authenticated API requests. Bind Google identity to the expected signed-in account and validate OAuth state, PKCE and callback expiry. Use single-use state. Encrypt refresh tokens at rest; tokens never appear in logs or responses. Handle revocation and consent expiry explicitly.
2. Read canonical saved tasks. Preserve selected-occurrence linking and durable event IDs. Reuse the current three-way merge contract, Google ETags and explicit conflict review. Never silently resolve competing edits. Use Firestore update-time preconditions and atomic writes when moving an occurrence between day documents; retain unrelated day fields, priorities and tombstones.
3. Explicitly use the user's IANA time zone for Google conversion and reminder instants; the worker runs in UTC. Handle nonexistent/ambiguous DST times without guessing. Preserve all-day end exclusivity and current unsupported multi-day/Google-recurrence review behavior.
4. Derive reminder jobs from canonical task/occurrence data, not unvalidated browser snapshots. Before sending, recheck completion, cancellation, deletion, schedule revision and device ownership. Recurrence exclusions and one-instance rescheduling must invalidate affected jobs. Delayed jobs have a finite expiry and must not flood the user when the service recovers.
5. Persist delivery identity per account, occurrence, schedule revision, reminder offset and device. Use leases and an explicit retry policy. Web Push does not offer general exactly-once delivery: use stable notification tags and client deduplication; document the residual uncertain-response tradeoff.
6. Validate subscription endpoints against supported push providers; prevent arbitrary server fetch targets. Remove expired subscriptions on 404/410, back off on 429/5xx, and discard overdue notifications. Support per-device opt-out and account-wide disconnect with grant revocation and job removal. Signing out on a shared device must detach its subscription.
7. Coordinate foreground and background delivery so the same reminder is not deliberately scheduled twice. Explain that existing Google Calendar alarms are separate; changing their channel must be explicit. Service-worker notification clicks open only the trusted app origin and intended occurrence.

## UI
Extend the existing Calendar and Notifications settings, with separate toggles for background calendar sync and reminders on this device, a test notification, last successful sync, actionable errors and disconnect. Show pending cloud writes before closing; edits that never reached the server cannot be synchronized or cancel a server reminder. Keep account/permission actions short and do not expose backend configuration in ordinary task forms.

## Acceptance gates
- Unit/integration: rejected identities and stale OAuth state; encrypted grant lifecycle; refresh/revocation; conditional Firestore writes; deleted/moved tasks; independent and competing Google edits; timezone/DST; recurrence exceptions; concurrent dispatch; failed/retried sends; revoked device; free-quota exhaustion.
- Browser: existing foreground/calendar tests stay green; unsupported/denied push remains usable; service-worker activation, notification click and account switching are covered.
- Deployment: prove no billing activation, measure CPU and quotas on Workers Free, bind real Google account, close all planner windows, edit a linked Google event and confirm canonical Firestore update; receive a scheduled push with the app closed on the owner's actual device. Mock tests cannot substitute for this gate.

## Verified references
- Cloudflare limits: https://developers.cloudflare.com/workers/platform/limits/ (official source fetched from cloudflare/cloudflare-docs production: 100,000 requests/day, 10 ms Free CPU, 5 Cron triggers/account).
- Cron: https://developers.cloudflare.com/workers/configuration/cron-triggers/ (UTC, supports minute cadence; configuration propagation may take up to 15 minutes).
- Google offline authorization: https://developers.google.com/identity/protocols/oauth2/web-server#offline
- iOS Web Push: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
