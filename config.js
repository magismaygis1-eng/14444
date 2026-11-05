/* ================================================================
   config.js — إعدادات الاتصال وتهيئة عميل Supabase
   المفتاح هنا هو المفتاح «العام» (publishable) المصمم للظهور في المتصفح؛
   الحماية الفعلية للبيانات تتم عبر سياسات RLS في قاعدة البيانات.
   لا تضع مفتاح service_role هنا إطلاقاً.
   ================================================================ */
const APP_VERSION = "1.0.0"; // منظومة السلامة والمباني الخطرة (DBAS) — يجب أن يطابق VERSION في sw.js
const SCHEMA_VERSION = 1; // نسخة مخطط المسودات المحلية — ترتبط بـ DB_VER في js/offline.js ولا تُخفَّض أبداً
const CFG = Object.freeze({
  url: "https://lzyytxccctmquneqyncxo.supabase.co",
  key: "sb_publishable_-XeUt-rWg3cmxakFmC_lgg_f-lAcZ37"
});
function fatal(msg) {
  const d = document.createElement("div");
  d.style.cssText = "padding:22px;margin:16px;background:#fee2e2;color:#991b1b;border-radius:12px;font-family:sans-serif;font-weight:bold;position:relative;z-index:30000";
  d.textContent = msg;
  document.body.prepend(d);
  const s = document.getElementById("splash"); if (s) s.remove();
}
/* fetch بمهلة زمنية: لا يعلق الطلب على شبكة سيئة (يُمرَّر إلى Supabase) */
function tFetch(u, o = {}) {
  const c = new AbortController(), ms = /\/storage\/v1\//.test(String(u)) ? 180000 : 20000, t = setTimeout(() => c.abort(), ms);
  if (o.signal) { if (o.signal.aborted) c.abort(); else o.signal.addEventListener("abort", () => c.abort(), { once: true }) }
  return fetch(u, { ...o, signal: c.signal }).finally(() => clearTimeout(t));
}
var sb;
if (typeof supabase === "undefined") fatal("لم تُحمَّل مكتبة الاتصال بقاعدة البيانات. أعد تحميل الصفحة.");
else sb = supabase.createClient(CFG.url, CFG.key, { global: { fetch: tFetch } });
