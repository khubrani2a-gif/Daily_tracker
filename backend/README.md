# Background service — staged, not active

This deployment currently implements only the authentication foundation. It does **not** synchronize calendar events or deliver background notifications yet. The existing planner is unchanged. `/health` explicitly reports both features as false, even after OAuth is configured.

Deployment: https://mufakkirati-background.mufakkirati-background.workers.dev

Google redirect URI (exact):

```
https://mufakkirati-background.mufakkirati-background.workers.dev/oauth/google/callback
```

## Owner configuration

1. In project `daily-tracker-85609`, enable Google Calendar API and configure Google Auth Platform consent/audience. Testing-mode refresh tokens may expire after seven days for these scopes; continuous operation needs an appropriate production consent configuration. Verification requirements depend on audience/scopes.
2. Create a Web application OAuth client. Use the exact redirect above. The server flow does not need an authorized JavaScript origin.
3. In Cloudflare → Workers & Pages → `mufakkirati-background` → Settings → Variables and Secrets, add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, both as Secret. `TOKEN_KEY` has already been generated securely and stored in Cloudflare; do not replace it without a grant reauthorization migration.
4. Do not send credentials through chat or commit them to Git. Secret values never belong in the app's HTML or Firestore client documents.
5. Canonical Firestore backend access, scheduler implementation, Web Push device enrollment and real closed-app tests are still outstanding. OAuth setup alone does not complete these.

## Development / deployment

```
node --test backend/test/*.test.mjs
cd backend
npx wrangler@4.151.0 d1 migrations apply mufakkirati-background --remote
npx wrangler@4.151.0 deploy
```

Use the authenticated owner's Cloudflare account, remain on Workers Free/D1 Free, and do not enable a paid service. No Cron trigger is configured in this staged deployment. Actual CPU cost of the complete scheduler is not yet measured; the Free-tier 10 ms CPU limit remains an acceptance gate.

`POST /oauth/start`, `/status` and `/disconnect` require a Firebase ID token and the exact app Origin. Firebase verifies the token; the backend checks project binding and the Google provider identity. OAuth uses encrypted PKCE state, single-use callbacks and matching Google account identity. Refresh tokens are AES-GCM encrypted with uid-bound additional authenticated data. Disconnect deletes stored grants even if Google's revocation endpoint is unavailable, and reports that the user must revoke the Google grant manually in that case.

The callback page currently states explicitly that authorization is saved but background functionality is not active. No access or refresh tokens are returned to the browser. Cloudflare request observability is disabled to avoid storing OAuth callback query strings in application logs.
