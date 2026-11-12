/* عامل الخدمة — يخزّن ملفات التطبيق ليعمل بدون إنترنت.
   عند أي تحديث جوهري للتطبيق نرفع رقم النسخة أدناه. */
const CACHE = "mufakkirati-v202";
const ASSETS = [
  "./",
  "./index.html",
  "./sync-core.js",
  "./data-core.js?v=202",
  "./planner-core.js", "./calendar-core.js?v=167", "./learning-core.js?v=167",
  "./manifest.webmanifest",
  "./fonts/AmiriQuran-Regular.woff2",
  "./fonts/ThmanyahSans-Regular.woff2",
  "./fonts/ThmanyahSans-Medium.woff2",
  "./fonts/ThmanyahSans-Bold.woff2",
  "./fonts/ThmanyahDisplay-Medium.woff2",
  "./fonts/ThmanyahDisplay-Bold.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS.map(asset => new Request(asset, {cache:"reload"})))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL("./", self.location).href + (e.notification.data && e.notification.data.date ? "?date=" + encodeURIComponent(e.notification.data.date) : "");
  e.waitUntil(
    clients.matchAll({type:"window", includeUncontrolled:true}).then((wins) => {
      for(const win of wins){
        if("focus" in win){
          win.postMessage({type:"OPEN_DAY", date:e.notification.data && e.notification.data.date});
          return win.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});

/* Each release owns its offline files. A retired worker/cache must not supply HTML
   to a newer storage implementation. Finish navigation writes before returning. */
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const cached = async request => (await caches.open(CACHE)).match(request);
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request, {cache:"no-store"})
        .then(async res => {
          if (res && res.ok) {
            const copy = res.clone();
            try { await (await caches.open(CACHE)).put("./index.html", copy); }
            catch (_) { /* A cache failure must not discard an available online page. */ }
          }
          return res;
        })
        .catch(async () => (await cached("./index.html")) || (await cached("./")) || Response.error())
    );
    return;
  }
  const fresh = fetch(e.request, {cache:"no-cache"})
    .then(async res => {
      if (res && res.ok) {
        const copy = res.clone();
        try { await (await caches.open(CACHE)).put(e.request, copy); } catch (_) {}
      }
      return res;
    })
    .catch(() => undefined);
  e.waitUntil(fresh.then(() => {}));
  e.respondWith(cached(e.request).then(async value => value || (await fresh) || Response.error()));
});
