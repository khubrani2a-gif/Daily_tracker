/* عامل الخدمة — يخزّن ملفات التطبيق ليعمل بدون إنترنت.
   عند أي تحديث جوهري للتطبيق نرفع رقم النسخة أدناه. */
const CACHE = "mufakkirati-v127";
const ASSETS = [
  "./",
  "./index.html",
  "./sync-core.js",
  "./manifest.webmanifest",
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
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
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

/* إستراتيجية: نقدّم النسخة المخزنة فورًا (سرعة + عمل دون اتصال)
   ونحدّثها في الخلفية من الشبكة لزيارتك القادمة.
   طلبات Firebase وغيرها من النطاقات الخارجية لا نتدخل فيها. */
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  /* التنقّل والصفحة الرئيسية: الشبكة أولًا كي لا يبقى الجوال على إصدار قديم بعد النشر. */
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put("./index.html", res.clone()));
          return res;
        })
        .catch(() => caches.match("./index.html").then((cached) => cached || caches.match("./")))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fresh = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
