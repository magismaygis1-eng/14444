/* =====================================================================
   sw.js — Service Worker لمنظومة السلامة والمباني الخطرة (DBAS)
   1) واجهة التطبيق (App Shell) والمكتبات: تُخزَّن عند التثبيت فيعمل التطبيق دون اتصال.
   2) التنقل وملفات الواجهة (ASSETS): من كاش الإصدار نفسه أولاً، فلا يختلط index.html جديد مع JS قديم.
      الإصدار الجديد يصل كاملاً عبر Service Worker جديد (رقم VERSION) وزر «تحديث الآن»، ثم يُحذف الكاش القديم كله.
   3) ملفات ثابتة أخرى من الموقع نفسه (خارج القائمة): stale-while-revalidate.
   4) بلاطات الخرائط: تخزين سلبي (ما يُعرض متصلاً يبقى متاحاً دون اتصال)، بحد أقصى للعدد.
      لا يجلب بلاطات مسبقاً: سياسات OSM وEsri تمنع التنزيل الجماعي.
   5) Supabase (البيانات والمصادقة والصور): لا يُخزَّن هنا إطلاقاً؛ التطبيق يدير ذلك عبر IndexedDB.
   عند تعديل أي ملف في القائمة: ارفع رقم VERSION ليحصل المستخدمون على التحديث.
   ===================================================================== */
const VERSION = "1.0.0"; // يطابق APP_VERSION في js/config.js — رفعه يستبدل كاش الواجهة كاملاً
const SHELL = "dbas-shell-" + VERSION, TILE_CACHE = "dbas-tiles", MAX_TILES = 4000;
const ASSETS = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-512-maskable.png",
  "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "vendor/leaflet/leaflet.draw.js", "vendor/leaflet/leaflet.draw.css",
  "vendor/leaflet/images/marker-icon.png", "vendor/leaflet/images/marker-icon-2x.png", "vendor/leaflet/images/marker-shadow.png",
  "vendor/leaflet/images/layers.png", "vendor/leaflet/images/layers-2x.png", "vendor/leaflet/images/spritesheet.png", "vendor/leaflet/images/spritesheet-2x.png", "vendor/leaflet/images/spritesheet.svg",
  "vendor/leaflet-heat.js", "vendor/chart.umd.js", "vendor/jszip.min.js", "vendor/shp.min.js", "vendor/supabase.js", "vendor/xlsx.mini.min.js",
  "vendor/fonts/tajawal-arabic-400-normal.woff2", "vendor/fonts/tajawal-arabic-500-normal.woff2", "vendor/fonts/tajawal-arabic-700-normal.woff2", "vendor/fonts/tajawal-arabic-800-normal.woff2",
  "vendor/fonts/tajawal-latin-400-normal.woff2", "vendor/fonts/tajawal-latin-500-normal.woff2", "vendor/fonts/tajawal-latin-700-normal.woff2", "vendor/fonts/tajawal-latin-800-normal.woff2",
  ...["bootguard", "config", "core", "audit", "ui", "offline", "auth", "data", "dashboard", "records", "export", "reports", "field", "map", "reflayers", "import", "admin", "monitor", "spatial", "app"].map(m => "js/" + m + ".js")
];
const SHELL_PATHS = new Set(ASSETS.map(u => new URL(u, self.registration.scope).pathname));
const TILE_RE = /(server\.arcgisonline\.com\/ArcGIS\/rest\/services\/(World_Imagery|Reference)|tile\.openstreetmap\.org|basemaps\.cartocdn\.com)/;

self.addEventListener("install", e => {
  /* cache:"reload" يتجاوز ذاكرة HTTP كي لا يُخزَّن ملف قديم مع إصدار جديد */
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" })))));
  /* لا skipWaiting تلقائياً: الصفحة تعرض «تحديث الآن» كي لا ينقطع رفع جارٍ */
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("dbas-shell-") && k !== SHELL) await caches.delete(k);
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting() });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* بلاطات الخرائط: الذاكرة أولاً (نادراً ما تتغير) */
  if (TILE_RE.test(req.url)) { e.respondWith(tile(req)); return }

  /* أي مصدر خارجي آخر (Supabase وغيره): بلا تدخل */
  if (url.origin !== location.origin) return;

  /* التنقل: index.html من كاش هذا الإصدار (يطابق ملفات JS/CSS المخزنة معه)، والشبكة فقط إن لم يُخزَّن بعد */
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const c = await caches.open(SHELL), hit = await c.match("index.html");
      if (hit) { e.waitUntil(e.preloadResponse && e.preloadResponse.catch(() => {})); return hit }
      try {
        const r = (await e.preloadResponse) || await fetch(req);
        if (r.ok) await c.put("index.html", r.clone());
        return r;
      } catch {
        return new Response("<h1 dir=rtl>غير متصل</h1>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }

  /* ملفات الواجهة المعروفة: من كاش الإصدار فقط (بلا تحديث خلفي يخلط الإصدارات)، والشبكة احتياطاً */
  if (SHELL_PATHS.has(url.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(SHELL), hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try { const r = await fetch(req); if (r.ok && r.type === "basic") c.put(req, r.clone()); return r }
      catch { return new Response("", { status: 504 }) }
    })());
    return;
  }

  /* ملفات ثابتة أخرى: stale-while-revalidate */
  e.respondWith((async () => {
    const c = await caches.open(SHELL), hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok && r.type === "basic") c.put(req, r.clone()); return r }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit }
    return (await net) || new Response("", { status: 504 });
  })());
});

async function tile(req) {
  const c = await caches.open(TILE_CACHE), hit = await c.match(req);
  if (hit) return hit;
  try {
    const r = await fetch(req);
    if (r.ok && r.type !== "opaque") { await c.put(req, r.clone()); if (Math.random() < .02) trimTiles(c) }
    return r;
  } catch { return new Response("", { status: 504 }) }   // دون اتصال ولا نسخة: بلاطة فارغة
}
async function trimTiles(c) {
  const k = await c.keys();
  if (k.length > MAX_TILES) for (const x of k.slice(0, k.length - MAX_TILES)) await c.delete(x);   // الأقدم أولاً
}
