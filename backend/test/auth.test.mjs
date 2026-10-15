import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createWorker, seal, unseal } from "../src/worker.mjs";
function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("../migrations/0001_auth.sql", import.meta.url),
      "utf8",
    ),
  );
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              return db.prepare(sql).get(...args) || null;
            },
            async run() {
              return db.prepare(sql).run(...args);
            },
          };
        },
      };
    },
  };
  return {
    APP_ORIGIN: "https://khubrani2a-gif.github.io",
    PUBLIC_ORIGIN: "https://example.workers.dev",
    FIREBASE_PROJECT: "daily-tracker-85609",
    FIREBASE_API_KEY: "public-key",
    GOOGLE_CLIENT_ID: "test-client",
    GOOGLE_CLIENT_SECRET: "test-secret",
    TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"),
    DB,
  };
}

const token = (aud = "daily-tracker-85609") =>
  [
    {},
    {
      aud,
      iss: "https://securetoken.google.com/" + aud,
      sub: "user-1",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
  ]
    .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
    .join(".") + ".signature";
const req = (path, body = {}, bearer = token()) =>
  new Request("https://example.workers.dev" + path, {
    method: "POST",
    headers: {
      Origin: "https://khubrani2a-gif.github.io",
      Authorization: "Bearer " + bearer,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
const json = (v) =>
  new Response(JSON.stringify(v), {
    headers: { "Content-Type": "application/json" },
  });
const firebase = () =>
  json({
    users: [
      {
        localId: "user-1",
        providerUserInfo: [{ providerId: "google.com", rawId: "google-1" }],
      },
    ],
  });
test("encrypted grants are bound to their owner and never contain plaintext", async () => {
  const env = setup(),
    c = await seal("refresh-secret", "user-1", env.TOKEN_KEY);
  assert.ok(!c.includes("refresh-secret"));
  assert.equal(await unseal(c, "user-1", env.TOKEN_KEY), "refresh-secret");
  await assert.rejects(unseal(c, "user-2", env.TOKEN_KEY));
});
test("unconfigured backend fails closed and health does not claim background features", async () => {
  const env = setup();
  delete env.GOOGLE_CLIENT_SECRET;
  const w = createWorker(() => {
    throw Error("unexpected network");
  });
  assert.equal((await w.fetch(req("/oauth/start"), env)).status, 503);
  const h = await (
    await w.fetch(new Request("https://example.workers.dev/health"), env)
  ).json();
  assert.equal(h.backgroundSync, false);
  assert.equal(h.backgroundPush, false);
});
test("reject wrong origin and cross-project or unauthenticated tokens", async () => {
  const env = setup(),
    w = createWorker(firebase);
  assert.equal(
    (
      await w.fetch(
        new Request("https://example.workers.dev/oauth/start", {
          method: "POST",
          headers: { Origin: "https://evil.example" },
        }),
        env,
      )
    ).status,
    403,
  );
  assert.equal(
    (await w.fetch(req("/oauth/start", {}, token("other-project")), env))
      .status,
    401,
  );
  assert.equal((await w.fetch(req("/oauth/start", {}, ""), env)).status, 401);
});
test("offline OAuth uses PKCE, one-use state and matching Google identity", async () => {
  const env = setup();
  let refresh = "";
  const w = createWorker(async (url, opt) => {
    if (url.includes("accounts:lookup")) return firebase();
    if (url.includes("oauth2.googleapis.com/token")) {
      assert.match(opt.body, /code_verifier=/);
      return json({
        access_token: "access",
        refresh_token: "refresh",
        scope:
          "openid email https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      });
    }
    if (url.includes("openidconnect")) return json({ sub: "google-1" });
    throw Error("unexpected request");
  });
  const start = await (await w.fetch(req("/oauth/start"), env)).json();
  const u = new URL(start.url);
  assert.equal(u.searchParams.get("access_type"), "offline");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  const callback = new Request(
    "https://example.workers.dev/oauth/google/callback?code=one&state=" +
      u.searchParams.get("state"),
  );
  assert.equal((await w.fetch(callback, env)).status, 200);
  assert.equal((await w.fetch(callback, env)).status, 400);
  const row = await env.DB.prepare(
    "SELECT refresh_cipher FROM google_grants WHERE uid=?",
  )
    .bind("user-1")
    .first();
  assert.equal(
    await unseal(row.refresh_cipher, "user-1", env.TOKEN_KEY),
    "refresh",
  );
});
test("different Google account cannot bind and expired state cannot exchange code", async () => {
  const env = setup(),
    w = createWorker(async (url) =>
      url.includes("accounts:lookup")
        ? firebase()
        : url.includes("openidconnect")
          ? json({ sub: "other-user" })
          : json({
              access_token: "access",
              refresh_token: "refresh",
              scope:
                "openid email https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/calendar.calendarlist.readonly",
            }),
    );
  const { url } = await (await w.fetch(req("/oauth/start"), env)).json();
  assert.equal(
    (
      await w.fetch(
        new Request(
          "https://example.workers.dev/oauth/google/callback?code=one&state=" +
            new URL(url).searchParams.get("state"),
        ),
        env,
      )
    ).status,
    403,
  );
  assert.equal(
    await env.DB.prepare("SELECT * FROM google_grants WHERE uid=?")
      .bind("user-1")
      .first(),
    null,
  );
});
test("expired state is consumed without contacting Google", async () => {
  const env = setup();
  let googleCalls = 0;
  const w = createWorker(async (url) => {
    if (url.includes("accounts:lookup")) return firebase();
    googleCalls++;
    throw Error("unexpected call");
  });
  const { url } = await (await w.fetch(req("/oauth/start"), env)).json();
  await env.DB.prepare("UPDATE oauth_states SET expires_at=? WHERE uid=?")
    .bind(1, "user-1")
    .run();
  const r = await w.fetch(
    new Request(
      "https://example.workers.dev/oauth/google/callback?code=x&state=" +
        new URL(url).searchParams.get("state"),
    ),
    env,
  );
  assert.equal(r.status, 400);
  assert.equal(googleCalls, 0);
});
test("disconnect clears grants and pending states even if Google revocation fails", async () => {
  const env = setup();
  const cipher = await seal("refresh-secret", "user-1", env.TOKEN_KEY);
  await env.DB.prepare("INSERT INTO google_grants VALUES (?,?,?,?)")
    .bind("user-1", "google-1", cipher, Date.now())
    .run();
  const w = createWorker(async (url) =>
    url.includes("accounts:lookup")
      ? firebase()
      : new Response("", { status: 503 }),
  );
  const r = await (await w.fetch(req("/disconnect"), env)).json();
  assert.equal(r.disconnected, true);
  assert.equal(r.googleRevoked, false);
  assert.equal(
    await env.DB.prepare("SELECT * FROM google_grants WHERE uid=?")
      .bind("user-1")
      .first(),
    null,
  );
});
