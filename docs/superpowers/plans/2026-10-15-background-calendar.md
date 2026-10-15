# Background Calendar Implementation Plan

**Goal:** Deliver the two approved background features without activating billing or weakening existing synchronization.
**Architecture:** Optional Workers Free/D1 backend alongside GitHub Pages and Firebase Spark, subject to provisioning and measured Free-tier feasibility. Preserve current foreground functionality until activation is verified.
**Spec:** ../specs/2026-10-15-background-calendar-design.md
**Status:** Cloudflare account connected; D1 and a staged OAuth service deployed. Seven backend tests pass. Google OAuth configuration, canonical data access, scheduler and device tests remain outstanding. Background features are not active.

## Global constraints
No paid services; no browser-stored refresh tokens; explicit account consent; Arabic RTL; preserve recurrence, safe conflict review and user data. Background delivery is best effort, never guaranteed to an exact second.

## Review focus
Cross-account access, concurrent day writes, cancellation after queueing, recurrence/zone changes, unknown delivery outcome after network failure.

## Delivery sequence
- [ ] Provision a Free-tier test deployment and establish CPU/quota viability for crypto, persistence and dispatch. Stop on required billing.
- [ ] Implement authenticated backend APIs and offline Google authorization with encrypted grants and state/PKCE tests.
- [ ] Implement canonical Firestore adapters with conditional multi-document transactions and no blind whole-day replacement.
- [ ] Implement selected-occurrence Google synchronization, explicit time zones, ETags, conflict reporting and disconnect; test stale/deleted/moved instances.
- [ ] Implement reminder derivation, job invalidation, device subscription lifecycle, Web Push dispatch and deduplication; test retry/expiry/account isolation.
- [ ] Integrate optional settings and service-worker handlers behind verified backend configuration; retain foreground fallback.
- [ ] Run the existing regression/Firebase suite plus backend security and concurrency tests; perform an independent review.
- [ ] Deploy only to the Free tier; finish real Google consent and actual closed-app device tests; then mark the feature active in the UI.

## Required next input
Cloudflare account availability and login. After the endpoint exists, provide its exact Google OAuth callback and guide the owner through consent setup. Keep all credentials in provider secret storage, never in chat or Git.

## Progress 2026-10-15
- Cloudflare device authorization succeeded. Created D1 `mufakkirati-background` and deployed the staged service. No paid-plan upgrade or Cron enabled.
- Live `/health` returned 200 with `oauthConfigured:false`, `backgroundSync:false`, `backgroundPush:false`.
- OAuth state/PKCE, uid-bound AES-GCM encryption, Firebase verification, matching Google identity and disconnect implemented; 7 tests pass. Real Google flow still blocked on client configuration.
- Exact callback and secret setup are documented in `backend/README.md`. Worker version: `4b940980-744a-42cb-8278-c9e58450a603`.
