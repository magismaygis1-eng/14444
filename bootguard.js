/* ================================================================
   bootguard.js — حارس التحميل (يُحمَّل أولاً وبلا defer)
   يُظهر «تعذّر التحميل، أعد المحاولة» مع زر إعادة إذا فشل تحميل أي سكربت،
   أو بقيت شاشة البدء أكثر من 15 ثانية. لا يعتمد على أي ملف آخر.
   ================================================================ */
(function () {
  var failed = false;
  function fail() {
    var s = document.getElementById("splash"), f = document.getElementById("splashFail");
    if (!s || !f || !s.isConnected) return;               // التطبيق أزال شاشة البدء: التحميل نجح
    f.classList.remove("hide");
    var sp = s.querySelector(".spin"); if (sp) sp.style.display = "none";
    var m = document.getElementById("splashMsg"); if (m) m.style.display = "none";
    var b = document.getElementById("splashRetry"); if (b) { b.onclick = function () { location.reload() }; b.focus() }
  }
  /* أخطاء تحميل الموارد لا تنتشر للأعلى، لذا نلتقطها في مرحلة الالتقاط */
  addEventListener("error", function (e) {
    var t = e.target;
    if (t && t.tagName === "SCRIPT" && !failed) { failed = true; fail() }
  }, true);
  setTimeout(fail, 15000);
})();
