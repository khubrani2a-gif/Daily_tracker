/* عامل الخدمة — يخزّن ملفات التطبيق ليعمل بدون إنترنت.
   عند أي تحديث جوهري للتطبيق نرفع رقم النسخة أدناه. */
const CACHE = "mufakkirati-v81";
const ASSETS = [
  "./",
  "./index.html",
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

/* إستراتيجية: نقدّم النسخة المخزنة فورًا (سرعة + عمل دون اتصال)
   ونحدّثها في الخلفية من الشبكة لزيارتك القادمة.
   طلبات Firebase وغيرها من النطاقات الخارجية لا نتدخل فيها. */
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
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
