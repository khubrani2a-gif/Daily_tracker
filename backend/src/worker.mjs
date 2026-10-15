const enc = new TextEncoder(),
  dec = new TextDecoder();
const scopes = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const url64 = (raw) =>
  b64(raw).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const random = () => url64(crypto.getRandomValues(new Uint8Array(32)));
const hash = async (s) =>
  url64(await crypto.subtle.digest("SHA-256", enc.encode(s)));
async function key(secret) {
  const raw = bytes(secret);
  if (raw.length !== 32) throw Error("invalid encryption key");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function seal(value, owner, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const result = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(owner) },
    await key(secret),
    enc.encode(value),
  );
  return b64(iv) + "." + b64(result);
}
export async function unseal(value, owner, secret) {
  const [iv, cipher] = value.split(".");
  return dec.decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes(iv), additionalData: enc.encode(owner) },
      await key(secret),
      bytes(cipher),
    ),
  );
}
class Failure extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const ready = (e) =>
  !!(
    e.DB &&
    e.GOOGLE_CLIENT_ID &&
    e.GOOGLE_CLIENT_SECRET &&
    e.TOKEN_KEY &&
    e.FIREBASE_API_KEY &&
    e.FIREBASE_PROJECT &&
    e.PUBLIC_ORIGIN &&
    e.APP_ORIGIN
  );
const fail = (status, message) => {
  throw new Failure(status, message);
};
function response(data, status = 200, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  return new Response(JSON.stringify(data), { status, headers });
}
export function createWorker(network = fetch) {
  async function call(url, options = {}) {
    const r = await network(url, {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok)
      throw new Failure(502, "تعذر الاتصال بخدمة الربط. أعد المحاولة.");
    return r.json();
  }
  async function owner(request, e) {
    const bearer = request.headers.get("Authorization") || "";
    if (!/^Bearer [A-Za-z0-9_.-]+$/.test(bearer) || bearer.length > 8192)
      fail(401, "سجّل الدخول للمفكرة أولًا.");
    const token = bearer.slice(7);
    let p;
    try {
      p = JSON.parse(
        dec.decode(
          bytes(token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")),
        ),
      );
    } catch {
      fail(401, "جلسة غير صالحة.");
    }
    if (
      p.aud !== e.FIREBASE_PROJECT ||
      p.iss !== "https://securetoken.google.com/" + e.FIREBASE_PROJECT ||
      !p.sub ||
      p.exp * 1000 <= Date.now()
    )
      fail(401, "جلسة غير صالحة.");
    // Firebase verifies the signature and account state; decoded claims alone are never trusted.
    const r = await network(
      "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" +
        encodeURIComponent(e.FIREBASE_API_KEY),
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
      },
    );
    if (!r.ok) fail(401, "انتهت جلسة المفكرة.");
    const u = (await r.json()).users?.[0],
      g = u?.providerUserInfo?.find((x) => x.providerId === "google.com");
    if (!u || u.disabled || u.localId !== p.sub || !g?.rawId)
      fail(401, "استخدم حساب Google المرتبط بالمفكرة.");
    return { uid: u.localId, googleSub: g.rawId };
  }
  async function route(request, e) {
    const u = new URL(request.url),
      origin = request.headers.get("Origin");
    if (u.origin !== e.PUBLIC_ORIGIN) fail(403, "عنوان غير معتمد.");
    if (request.method === "OPTIONS") {
      if (origin !== e.APP_ORIGIN) fail(403, "مصدر غير معتمد.");
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "600",
          Vary: "Origin",
        },
      });
    }
    if (u.pathname === "/health" && request.method === "GET")
      return response({
        service: "mufakkirati-background",
        oauthConfigured: ready(e),
        backgroundSync: false,
        backgroundPush: false,
      });
    if (!ready(e)) fail(503, "خدمة الخلفية قيد الإعداد ولم تُفعّل بعد.");
    if (u.pathname === "/oauth/google/callback" && request.method === "GET") {
      const state = u.searchParams.get("state");
      if (!state || state.length > 128) fail(400, "طلب الربط غير صالح.");
      const row = await e.DB.prepare(
        "DELETE FROM oauth_states WHERE state_hash=? RETURNING *",
      )
        .bind(await hash(state))
        .first();
      if (!row || row.expires_at < Date.now())
        fail(400, "انتهى طلب الربط؛ ابدأ من المفكرة مجددًا.");
      if (u.searchParams.has("error")) fail(400, "لم تمنح Google إذن الربط.");
      const code = u.searchParams.get("code");
      if (!code || code.length > 4096) fail(400, "لم يصل تصريح Google.");
      const grant = await call("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: e.GOOGLE_CLIENT_ID,
          client_secret: e.GOOGLE_CLIENT_SECRET,
          redirect_uri: e.PUBLIC_ORIGIN + "/oauth/google/callback",
          grant_type: "authorization_code",
          code_verifier: await unseal(row.verifier, row.uid, e.TOKEN_KEY),
        }).toString(),
      });
      if (
        !grant.access_token ||
        !grant.refresh_token ||
        !scopes
          .filter((s) => s.startsWith("https://"))
          .every((s) => (grant.scope || "").split(" ").includes(s))
      )
        fail(
          400,
          "لم تكتمل صلاحيات التقويم؛ أعد الربط ووافق على الأذونات المطلوبة.",
        );
      const google = await call(
        "https://openidconnect.googleapis.com/v1/userinfo",
        { headers: { Authorization: "Bearer " + grant.access_token } },
      );
      if (google.sub !== row.google_sub)
        fail(403, "اختر حساب Google نفسه المستخدم في المفكرة.");
      const cipher = await seal(grant.refresh_token, row.uid, e.TOKEN_KEY);
      await e.DB.prepare(
        "INSERT INTO google_grants (uid, google_sub, refresh_cipher, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET google_sub=excluded.google_sub, refresh_cipher=excluded.refresh_cipher, updated_at=excluded.updated_at",
      )
        .bind(row.uid, row.google_sub, cipher, Date.now())
        .run();
      return new Response(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ربط Google</title><main dir="rtl"><h1>تم حفظ إذن Google بأمان</h1><p>يمكنك إغلاق هذه الصفحة والعودة إلى المفكرة. المزامنة والتنبيهات في الخلفية لم تُفعّلا بعد؛ سيظهر وضعهما داخل المفكرة بعد اكتمال الإعداد.</p></main>',
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
            "Content-Security-Policy":
              "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
          },
        },
      );
    }
    if (request.method !== "POST") fail(404, "غير موجود.");
    if (origin !== e.APP_ORIGIN) fail(403, "مصدر غير معتمد.");
    if (Number(request.headers.get("Content-Length") || 0) > 8192)
      fail(413, "الطلب أكبر من المسموح.");
    const { uid, googleSub } = await owner(request, e);
    if (u.pathname === "/oauth/start") {
      const now = Date.now(),
        existing = await e.DB.prepare(
          "SELECT created_at FROM oauth_states WHERE uid=?",
        )
          .bind(uid)
          .first();
      if (existing && now - existing.created_at < 60000)
        fail(429, "انتظر دقيقة قبل بدء طلب ربط جديد.");
      const state = random(),
        verifier = random();
      await e.DB.prepare("DELETE FROM oauth_states WHERE expires_at<?")
        .bind(now)
        .run();
      await e.DB.prepare(
        "INSERT INTO oauth_states (state_hash,uid,google_sub,verifier,expires_at,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET state_hash=excluded.state_hash,google_sub=excluded.google_sub,verifier=excluded.verifier,expires_at=excluded.expires_at,created_at=excluded.created_at",
      )
        .bind(
          await hash(state),
          uid,
          googleSub,
          await seal(verifier, uid, e.TOKEN_KEY),
          now + 600000,
          now,
        )
        .run();
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: e.GOOGLE_CLIENT_ID,
        redirect_uri: e.PUBLIC_ORIGIN + "/oauth/google/callback",
        response_type: "code",
        scope: scopes.join(" "),
        access_type: "offline",
        prompt: "consent",
        state,
        code_challenge: await hash(verifier),
        code_challenge_method: "S256",
      }).toString();
      return response({ url: url.href }, 200, origin);
    }
    if (u.pathname === "/disconnect") {
      const grant = await e.DB.prepare(
        "SELECT refresh_cipher FROM google_grants WHERE uid=?",
      )
        .bind(uid)
        .first();
      // Stop local access first, even if Google cannot be reached to revoke the grant.
      await e.DB.prepare("DELETE FROM oauth_states WHERE uid=?")
        .bind(uid)
        .run();
      await e.DB.prepare("DELETE FROM google_grants WHERE uid=?")
        .bind(uid)
        .run();
      let revoked = !grant;
      if (grant) {
        try {
          const r = await network("https://oauth2.googleapis.com/revoke", {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(15000),
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              token: await unseal(grant.refresh_cipher, uid, e.TOKEN_KEY),
            }).toString(),
          });
          revoked = r.ok;
        } catch {}
      }
      return response(
        {
          disconnected: true,
          googleRevoked: revoked,
          message: revoked
            ? "تم إيقاف الربط."
            : "تم إيقاف الربط هنا؛ احذف إذن المفكرة من حساب Google لإتمام سحب الإذن.",
        },
        200,
        origin,
      );
    }
    if (u.pathname === "/status") {
      const grant = await e.DB.prepare(
        "SELECT updated_at FROM google_grants WHERE uid=?",
      )
        .bind(uid)
        .first();
      return response(
        {
          googleAuthorized: !!grant,
          authorizedAt: grant?.updated_at || null,
          backgroundSync: false,
          backgroundPush: false,
        },
        200,
        origin,
      );
    }
    fail(404, "غير موجود.");
  }
  return {
    async fetch(request, env) {
      try {
        return await route(request, env);
      } catch (error) {
        const origin = request.headers.get("Origin");
        return response(
          {
            error:
              error instanceof Failure
                ? error.message
                : "تعذر إكمال الطلب. أعد المحاولة.",
          },
          error instanceof Failure ? error.status : 500,
          origin === env.APP_ORIGIN ? origin : undefined,
        );
      }
    },
  };
}
export default createWorker();
