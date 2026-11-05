/* ================================================================
   ui.js — عناصر الواجهة المشتركة:
   حوارات التأكيد/الإدخال، تفويض الأحداث (بدل onclick المضمّنة لتوافق CSP)،
   شاشة البدء، قياس الهيدر، تحميل المكتبات عند الحاجة، نافذة «عن المنصة».
   ================================================================ */

/* ---- حوار تأكيد / إدخال بديل confirm() و prompt() ---- */
function ask(msg, { title = "تأكيد", ok = "تأكيد", cancel = "إلغاء", danger = false, input = null } = {}) {
  return new Promise(res => {
    const d = $("#ask"), I = $("#askI"), okB = $("#askOk"), noB = $("#askNo");
    $("#askT").textContent = title; $("#askM").textContent = msg;
    okB.textContent = ok; noB.textContent = cancel; okB.className = "btn " + (danger ? "bad" : "pri");
    I.classList.toggle("hide", input === null); I.value = input || "";
    let v = null;
    const done = r => { v = r; d.close() };
    okB.onclick = () => done(input === null ? true : I.value);
    noB.onclick = () => done(input === null ? false : null);
    I.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); okB.click() } };
    d.onclose = () => res(v === null && input === null ? false : v);
    d.showModal(); (input === null ? okB : I).focus();
  });
}
const confirmAsk = (m, o) => ask(m, o);
const promptAsk = (m, o = {}) => ask(m, { ...o, input: o.input ?? "" });

/* ---- تفويض الأحداث: data-act="..." data-id="..." ---- */
const ACT = {
  close: () => $("#dlg").close(),
  logout: () => logout(),
  detail: id => detail(id),
  edit: id => editRec(id),
  decide: id => { $("#dlg").close(); decideDlg(id) },
  del: id => del(id),
  approve: id => review(id, "approved"),
  reject: id => review(id, "rejected"),
  "goto-map": id => { $("#dlg").close(); goMap(id) },
  "print-dash": () => printDash(),
  "print-pp": () => printDash("pp"),
  "coord-clear": () => coordClear(),
  dist: id => distDlg(id),
  perms: id => permsDlg(id),
  about: () => aboutDlg(),
  report: () => situationReport(),
  xlsx: () => expXLSX()
};
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const f = ACT[el.dataset.act]; if (!f) return;
  e.preventDefault(); f(el.dataset.id);
});

/* ---- شاشة البدء ---- */
function splash(msg) { const m = $("#splashMsg"); if (m && msg) m.textContent = msg }
function splashOff() { const s = $("#splash"); if (!s) return; s.classList.add("out"); setTimeout(() => s.remove(), 350) }

/* ---- ارتفاع الهيدر: يضبط موضع شريط التنقل اللاصق ---- */
function measureHeader() {
  const h = $("#hdr"); if (!h || !h.offsetParent) return;
  if (innerWidth > 760) document.documentElement.style.setProperty("--hd", h.offsetHeight + "px");
  else document.documentElement.style.removeProperty("--hd");
}
addEventListener("resize", () => { clearTimeout(measureHeader.t); measureHeader.t = setTimeout(measureHeader, 120) });

/* ---- الحرف الأول من الاسم في شارة المستخدم ---- */
const initials = n => (String(n || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("") || "?").toUpperCase();

/* ---- تحميل مكتبة عند الحاجة فقط (مثل Excel) ---- */
const _ls = {};
function loadScript(src) {
  return _ls[src] || (_ls[src] = new Promise((ok, no) => {
    const s = document.createElement("script"); s.src = src; s.onload = ok;
    s.onerror = () => { delete _ls[src]; no(new Error("تعذّر تحميل " + src)) };
    document.head.append(s);
  }));
}

/* ---- عن المنصة والمنهجية (مفيد للتوثيق الأكاديمي) ---- */
/* بند الشفافية الإلزامي (المرحلة 4.6): يظهر مرة واحدة عند أول دخول، ويُسجَّل الإقرار فوراً */
function activityNoticeDlg(){
  $("#dlg").innerHTML=`<h3 style="margin-top:0">تنبيه شفافية</h3><p>يُسجَّل نشاطك على هذه المنصة (تسجيل الدخول والخروج، إنشاء السجلات وتعديلها وحذفها، التصدير) في سجل تدقيق لأغراض الجودة والأمان. لا يُستخدم أي تتبع حي لموقعك الجغرافي؛ تُستخدم فقط إحداثيات السجلات التي تُدخلها بنفسك.</p>
  <div class="row" style="margin-top:12px"><button class="btn pri" id="anOk">فهمت، متابعة</button></div>`;
  $("#dlg").addEventListener("close",()=>{},{once:true});
  $("#anOk").onclick=async()=>{await upd(me.id,{seen_activity_notice:true});me.seen_activity_notice=true;$("#dlg").close()};
  $("#dlg").showModal()}
function aboutDlg() {
  $("#dlg").innerHTML = `<div style="display:flex;gap:12px;align-items:center;margin-bottom:8px"><img src="icons/icon-192.png" alt="" style="width:52px;height:52px;border-radius:12px"><div><h3 style="margin:0">منظومة السلامة والمباني الخطرة</h3><span class="hint" dir="ltr">Dangerous Buildings Assessment System (DBAS) · v${esc(APP_VERSION)}</span></div></div>
  <p style="margin:.4rem 0">منصة هندسية جيومكانية لرصد وتوثيق المباني الآيلة للسقوط والتحليل المكاني للخطورة ودعم القرار. تعمل دون اتصال وتزامن البيانات تلقائياً.</p>
  <div class="scroll"><table><tbody>
  <tr style="cursor:default"><td><b>مستويات الخطورة</b></td><td>${RISK_K.map(k => RISK[k][2] + " " + RISK[k][0] + " (" + RISK[k][3] + "): " + RISK[k][4]).join("<br>")}</td></tr>
  <tr style="cursor:default"><td><b>التقييم الميداني</b></td><td>نوع الهيكل الإنشائي، العناصر المتضررة، مؤشرات التلف (الشقوق المائلة النافذة، هبوط الأساسات وميلانها، تساقط الغطاء الخرساني وصدأ التسليح، رطوبة الأساسات)، الإشغال والمعرّضون للخطر، والقرب من مرافق حيوية.</td></tr>
  <tr style="cursor:default"><td><b>التوصية والقرار</b></td><td>المهندس يضع توصية إلزامية (إخلاء عاجل، إزالة وتهديم، تدعيم مؤقت، صيانة واجهات)، واللجنة الهندسية تعتمد القرار النهائي ويُسجَّل باسم من اعتمده ووقته على الخادم.</td></tr>
  <tr style="cursor:default"><td><b>نطاقات الحماية</b></td><td>نصف قطر = ${APPSET.buffer_factor} × ارتفاع المبنى حول كل مبنى داهم أو آيل، مع المباني المجاورة والطرق الواجب إغلاقها أو حمايتها.</td></tr>
  <tr style="cursor:default"><td><b>التحليل المكاني</b></td><td>كثافة المباني الخطرة (Getis-Ord Gi*)، الأحياء الأكثر عرضة للتهديد (MCDA مع تحليل حساسية مونت كارلو)، والارتباط المكاني (Moran's I).</td></tr>
  <tr style="cursor:default"><td><b>العمل دون اتصال</b></td><td>IndexedDB (كتابة مسبقة للمسودات وطابور عمليات) + Service Worker، مع مزامنة متسلسلة وقفل بين التبويبات.</td></tr>
  <tr style="cursor:default"><td><b>الأمان</b></td><td>سياسات RLS بحسب الحالة والدور والحي، اسم المهندس وقرار اللجنة يُختمان على الخادم، تنبيه آلي من الخادم عند تسجيل مبنى بخطورة داهمة، وسياسة أمان محتوى (CSP).</td></tr>
  </tbody></table></div>
  <div class="row end" style="margin-top:12px"><button class="btn" data-act="close" type="button">إغلاق</button></div>`;
  $("#dlg").showModal();
}

/* ---- إمكانية الوصول: #dlg يُعاد بناء محتواه في كل مرة، فقبل كل فتح نعطي أول عنوان فيه المعرّف dlgT الذي يشير إليه aria-labelledby ---- */
(()=>{const d=$("#dlg");if(!d||!d.showModal)return;const open=d.showModal.bind(d);
  d.showModal=()=>{const old=d.querySelector("#dlgT"),h=d.querySelector("h3,h4,.pp-title");if(old&&old!==h)old.removeAttribute("id");if(h&&!h.id)h.id="dlgT";return open()}})();
