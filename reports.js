/* ================================================================
   reports.js — تقرير السلامة الإنشائية الرسمي (A4، يُطبع أو يُحفظ PDF، يعمل دون اتصال)
   ومصنّف Excel متعدد الأوراق باتجاه من اليمين لليسار.
   كلاهما يتبع الفلاتر الحالية وخيار «التصدير المُجهَّل».
   ================================================================ */

/* ---- تجميع حسب الحي (للتقرير والمصنّف) ---- */
function distTable(v) {
  const m = new Map(), sum = (a, f) => a.reduce((s, c) => s + (+f(c) || 0), 0);
  v.forEach(c => { const d = distMain(c.district); (m.get(d) || m.set(d, []).get(d)).push(c) });
  const rows = [...m].map(([d, a]) => {
    const D = a.filter(c => DANGER.has(c.risk_level)), g = k => a.filter(c => c.risk_level === k).length;
    return { d, n: a.length, r0: g("critical"), r1: g("high"), r2: g("medium"), r3: g("safe"),
      occ: D.filter(c => c.occupancy && c.occupancy !== "vacant").length, per: sum(D, c => c.per), fam: sum(D, c => c.fam),
      alerts: a.filter(alertOf).length, undec: D.filter(c => !c.committee_decision).length };
  }).sort((x, y) => (y.r0 + y.r1) - (x.r0 + x.r1) || y.n - x.n);
  const T = rows.reduce((s, r) => { for (const k in r) if (k !== "d") s[k] = (s[k] || 0) + r[k]; return s }, { d: "الإجمالي" });
  return { rows, T };
}

/* وصف الفلاتر النشطة بلغة مقروءة */
function filterDesc() {
  const L = [["fRisk", "الخطورة"], ["fStruct", "الهيكل"], ["fElem", "العنصر المتضرر"], ["fOcc", "الإشغال"], ["fDist", "الحي"], ["fSub", "المنطقة الفرعية"], ["fSt", "المراجعة / القرار"]]
    .map(([id, l]) => { const s = $("#" + id); return s && s.value ? l + ": " + s.options[s.selectedIndex].text : "" }).filter(Boolean);
  const q = $("#q").value.trim(); if (q && !isCoord(q)) L.push("بحث: «" + q + "»");
  return L.length ? L.join(" · ") : "كل السجلات المتاحة ضمن نطاق صلاحيتك";
}

/* رسم بياني خارج الشاشة → صورة (لا يعتمد على فتح لوحة المؤشرات) */
function chartImg(cfg, w = 760, h = 300) {
  if (typeof Chart === "undefined") return "";
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  cfg.options = { ...(cfg.options || {}), responsive: false, animation: false, devicePixelRatio: 2,
    plugins: { legend: { rtl: true, textDirection: "rtl", labels: { boxWidth: 12, font: { family: "Tajawal", size: 12 } } }, ...(cfg.options && cfg.options.plugins || {}) } };
  try { const ch = new Chart(cv, cfg), u = ch.toBase64Image("image/png"); ch.destroy(); return u } catch { return "" }
}

function situationReport() {
  const v = view(); if (!v.length) return toast("لا توجد سجلات ضمن الفلاتر الحالية لإعداد التقرير.");
  const sum = (a, f) => a.reduce((s, c) => s + (+f(c) || 0), 0), pc = (a, b) => b ? Math.round(a / b * 100) : 0,
    now = new Date(), no = "DBAS-" + ymd(now).replace(/-/g, "") + "-" + String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0"),
    n = k => v.filter(c => c.risk_level === k).length, D = v.filter(c => DANGER.has(c.risk_level)),
    occD = D.filter(c => c.occupancy && c.occupancy !== "vacant"), perD = sum(D, c => c.per), famD = sum(D, c => c.fam),
    nearD = D.filter(c => (c.proximity || []).some(p => p === "school" || p === "health")), undec = D.filter(c => !c.committee_decision),
    rc = k => v.filter(c => recOf(c).includes(k)).length, al = v.filter(alertOf),
    DT = distTable(v), S = distStats(), top3 = DT.rows.filter(r => r.r0 + r.r1).slice(0, 3).map(r => r.d), appr = v.filter(c => c.status === "approved").length,
    dates = v.map(c => c.created_at).filter(Boolean).sort(), d0 = dates[0] ? fmt(dates[0]) : "—", d1 = dates.length ? fmt(dates[dates.length - 1]) : "—";

  /* الملخص التنفيذي: نص مولَّد من الأرقام */
  const ex = [
    `يغطي هذا التقرير <b>${NF(v.length)}</b> مبنى ومرفقاً قُيِّمت ميدانياً في الفترة من ${d0} إلى ${d1}.`,
    `صُنِّف منها <b style="color:${riskCol("critical")}">${NF(n("critical"))}</b> مبنى بخطورة داهمة / انهيار وشيك، و<b style="color:${riskCol("high")}">${NF(n("high"))}</b> آيلاً للسقوط، و${NF(n("medium"))} بخطورة متوسطة، و${NF(n("safe"))} آمناً.`,
    D.length ? `من المباني الداهمة والآيلة للسقوط ما زال <b>${NF(occD.length)}</b> مأهولاً (${pc(occD.length, D.length)}%)، ويُقدَّر عدد المعرّضين للخطر المباشر بـ <b>${NF(perD)}</b> فرداً في ${NF(famD)} أسرة.` : "",
    nearD.length ? `يقع <b>${NF(nearD.length)}</b> مبنى خطر قرب مدرسة أو مرفق صحي، ما يوسّع نطاق الخطر إلى غير القاطنين.` : "",
    undec.length ? `<b style="color:#9d1c1c">${NF(undec.length)}</b> مبنى خطر ما زال بانتظار قرار اللجنة الهندسية.` : D.length ? "صدرت قرارات اللجنة الهندسية لكل المباني الداهمة والآيلة ضمن نطاق التقرير." : "",
    top3.length ? `أكثر الأحياء تركّزاً للمباني الخطرة: ${esc(top3.join("، "))}.` : "",
    S.rows.length ? `بلغت نسبة إنجاز المسح مقارنةً ببصمات المباني المرجعية <b>${S.tot.pct}%</b> (${NF(S.tot.doc)} من ${NF(S.tot.tot)} مبنى).` : "",
    `اعتُمد ${NF(appr)} تقييماً (${pc(appr, v.length)}%) بعد المراجعة الفنية.`
  ].filter(Boolean).join(" ");

  /* التوصيات المبنية على البيانات */
  const rec = [];
  const critOcc = v.filter(c => c.risk_level === "critical" && c.occupancy && c.occupancy !== "vacant").length;
  if (critOcc) rec.push(`إخلاء فوري لـ ${NF(critOcc)} مبنى بخطورة داهمة ما زال مأهولاً، وتطويق محيطه ضمن نطاق الحماية المقترح.`);
  if (rc("demolish")) rec.push(`عرض ${NF(rc("demolish"))} توصية بالإزالة والتهديم الفوري على اللجنة الهندسية لاعتمادها وجدولة التنفيذ.`);
  if (rc("shore")) rec.push(`تنفيذ تدعيم هيكلي مؤقت لـ ${NF(rc("shore"))} مبنى إلى حين القرار النهائي.`);
  if (nearD.length) rec.push(`تأمين محيط ${NF(nearD.length)} مبنى خطر قرب مدارس ومرافق صحية وإغلاق المسارات المجاورة (انظر تحليل نطاقات الحماية).`);
  const uxo = v.filter(c => c.uxo === "yes").length; if (uxo) rec.push(`إحالة ${NF(uxo)} موقعاً يُشتبه بوجود ذخائر غير منفجرة فيه إلى الجهات المختصة قبل أي تدخل هندسي.`);
  const mar = v.filter(c => c.martyrs === "confirmed" || c.martyrs === "suspected").length; if (mar) rec.push(`تنسيق فرق الانتشال مع الدفاع المدني لـ ${NF(mar)} موقعاً مؤكداً أو مشتبهاً بوجود شهداء أو مفقودين تحت الأنقاض.`);
  if (rc("maintain")) rec.push(`برمجة صيانة موضعية للواجهات والعناصر غير الحرجة في ${NF(rc("maintain"))} مبنى لمنع تطوّر الخطورة.`);
  if (undec.length) rec.push(`استكمال قرارات اللجنة الهندسية لـ ${NF(undec.length)} مبنى خطر.`);
  if (S.rows.length && S.tot.pct < 100) { const low = S.rows.filter(r => r.pct < 50).map(r => r.d); if (low.length) rec.push(`توجيه فرق التقييم إلى الأحياء ذات الإنجاز المنخفض (أقل من 50%): ${esc(low.join("، "))}.`) }
  const pend = v.filter(c => c.status === "pending").length; if (pend) rec.push(`مراجعة ${NF(pend)} تقييماً معلقاً لرفع موثوقية البيانات.`);

  /* الرسوم */
  const g = RISK_K.map(k => [k, n(k)]).filter(x => x[1]);
  const img1 = g.length ? chartImg({ type: "doughnut", data: { labels: g.map(x => riskName(x[0])), datasets: [{ data: g.map(x => x[1]), backgroundColor: g.map(x => riskCol(x[0])) }] }, options: { plugins: { legend: { position: "right" } } } }, 380, 240) : "";
  const dl = DT.rows.slice(0, 10), img2 = dl.length ? chartImg({ type: "bar", data: { labels: dl.map(r => r.d), datasets: RISK_K.map((k, i) => ({ label: riskName(k), backgroundColor: riskCol(k), data: dl.map(r => r["r" + i]) })) },
    options: { indexAxis: "y", scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }, y: { stacked: true, ticks: { font: { family: "Tajawal" } } } } } }, 760, Math.max(220, 34 * dl.length + 60)) : "";

  const K = [["المباني المقيَّمة", v.length], ["🔴 خطورة داهمة", n("critical")], ["🟠 آيل للسقوط", n("high")], ["🟡 خطورة متوسطة", n("medium")], ["🟢 آمن", n("safe")],
    ["خطرة ومأهولة", occD.length], ["أفراد معرّضون للخطر", perD], ["بانتظار قرار اللجنة", undec.length]];
  const th = a => `<thead><tr>${a.map(h => `<th>${h}</th>`).join("")}</tr></thead>`;
  const dRow = (r, t) => `<tr${t ? ' style="font-weight:800;background:#eef3f8"' : ""}><td>${esc(r.d)}</td><td>${NF(r.n)}</td><td>${NF(r.r0)}</td><td>${NF(r.r1)}</td><td>${NF(r.r2)}</td><td>${NF(r.r3)}</td><td>${NF(r.occ)}</td><td>${NF(r.per)}</td><td>${NF(r.undec)}</td></tr>`;
  const AL = [...al].sort((a, b) => (b.risk_level === "critical") - (a.risk_level === "critical") || (+b.per || 0) - (+a.per || 0)).slice(0, 30);
  const line = "................................";
  const sec = (i, t, body, brk) => `<section class="pp-sec${brk ? " brk" : ""}"><h4>${i}. ${t}</h4>${body}</section>`;
  let i = 0;

  $("#dlg").innerHTML = `<div class="pp rp">
  <div class="pp-head"><div class="pp-brand"><img src="icons/icon-192.png" alt=""><div><div class="pp-sys">منظومة السلامة والمباني الخطرة · DBAS</div><h3 class="pp-title">تقرير السلامة الإنشائية والمباني الخطرة<small>Structural Safety Situation Report</small></h3></div></div>
    <div class="pp-id"><span>رقم التقرير</span><b dir="ltr" style="font-size:15px">${no}</b><small>تاريخ الإصدار: ${fmt(now)}</small></div></div>
  <div class="pp-kv" style="border:1px solid #9fb3c8;border-radius:6px;margin-bottom:10px">
    <div><span>أعدّه</span><b>${esc(ME_NAME || "—")} (${esc(ROLE[me.role] || "")})</b></div><div><span>حالة البيانات</span><b>${OFFDATA || OFFMODE ? "نسخة محفوظة على الجهاز (دون اتصال)" : "محدّثة من الخادم"}</b></div>
    <div class="full"><span>نطاق التقرير</span><b>${esc(filterDesc())}</b></div>${ANON ? '<div class="full"><span>الخصوصية</span><b>نسخة مُجهَّلة: لا تتضمن أسماء الملّاك</b></div>' : ""}</div>
  ${sec(++i, "الملخص التنفيذي", `<div class="pp-body" style="line-height:1.95">${ex}</div>`)}
  ${sec(++i, "المؤشرات الرئيسية", `<div class="rp-k">${K.map(([l, x]) => `<div><b>${NF(x)}</b><span>${l}</span></div>`).join("")}</div>`)}
  ${sec(++i, "توزيع مستويات الخطورة", `<div class="pp-body"><div class="rp-ch">${img1 ? `<img src="${img1}" alt="توزيع مستويات الخطورة" style="width:380px">` : ""}<table class="pp-tbl" style="flex:1">${th(["مستوى الخطورة", "المباني", "النسبة", "مأهولة", "الأفراد المعرّضون", "الإجراء المطلوب"])}<tbody>${RISK_K.map(k => { const a = v.filter(c => c.risk_level === k); return `<tr><td><span style="display:inline-block;width:10px;height:10px;background:${riskCol(k)};border-radius:2px;margin-inline-end:6px"></span>${riskName(k)}</td><td>${NF(a.length)}</td><td>${pc(a.length, v.length)}%</td><td>${NF(a.filter(c => c.occupancy && c.occupancy !== "vacant").length)}</td><td>${NF(sum(a, c => c.per))}</td><td style="font-size:11px">${RISK[k][4]}</td></tr>` }).join("")}</tbody></table></div>
    ${img2 ? `<img src="${img2}" alt="الخطورة حسب الحي" style="width:100%;margin-top:8px">` : ""}</div>`, 1)}
  ${sec(++i, "التوزيع حسب الحي", `<div class="pp-body"><table class="pp-tbl">${th(["الحي", "المباني", "🔴 داهمة", "🟠 آيلة", "🟡 متوسطة", "🟢 آمنة", "خطرة مأهولة", "أفراد معرّضون", "بانتظار القرار"])}<tbody>${DT.rows.map(r => dRow(r)).join("")}${DT.rows.length > 1 ? dRow(DT.T, 1) : ""}</tbody></table></div>`, 1)}
  ${S.rows.length ? sec(++i, "إنجاز المسح الميداني", `<div class="pp-body"><table class="pp-tbl">${th(["الحي", "بصمات المباني", "المُقيَّم", "المتبقي", "الإنجاز"])}<tbody>${[...S.rows, ...(S.rows.length > 1 ? [S.tot] : [])].map((r, j) => `<tr${j === S.rows.length ? ' style="font-weight:800;background:#eef3f8"' : ""}><td>${esc(r.d)}</td><td>${NF(r.tot)}</td><td>${NF(r.doc)}</td><td>${NF(r.left)}</td><td>${r.pct}%</td></tr>`).join("")}</tbody></table></div>`, 1) : ""}
  ${sec(++i, `مبانٍ تتطلب تدخلاً عاجلاً ${al.length > AL.length ? `<small style="font-weight:500">(أول ${AL.length} من ${NF(al.length)})</small>` : ""}`, `<div class="pp-body">${AL.length ? `<table class="pp-tbl">${th(["#", "رقم السجل", "الاسم", "الحي", "الخطورة", "الإشغال", "التوصية", "قرار اللجنة", "التنبيه"])}<tbody>${AL.map((c, j) => `<tr><td>${j + 1}</td><td dir="ltr">${rid(c)}</td><td>${ANON ? "—" : esc(c.owner)}</td><td>${esc(c.district)}</td><td>${RISK[c.risk_level] ? RISK[c.risk_level][2] + " " + riskName(c.risk_level) : "—"}</td><td>${esc(OCC[c.occupancy] || "—")}</td><td>${esc(labs(RECO, c.recommendations) || "—")}</td><td>${esc(DECIS[c.committee_decision] || "بانتظار")}</td><td class="ppbad">${alertTxt(c)}</td></tr>`).join("")}</tbody></table>` : '<p class="pp-note">لا توجد مبانٍ عليها تنبيهات سلامة ضمن نطاق التقرير.</p>'}</div>`, 1)}
  ${sec(++i, "التوصيات", `<div class="pp-body">${rec.length ? `<ol style="margin:0;padding-inline-start:22px;line-height:1.9">${rec.map(x => `<li>${x}</li>`).join("")}</ol>` : '<p class="pp-note">لا توجد توصيات عاجلة.</p>'}</div>`, 1)}
  ${sec(++i, "المنهجية وحدود البيانات", `<div class="pp-body pp-note" style="line-height:1.8">
    يُقيَّم كل مبنى ميدانياً من مهندس حصر وفق أربعة مستويات خطورة إنشائية: داهمة / انهيار وشيك (Code Red)، آيل للسقوط (Code Orange)، متوسطة (Code Yellow)، آمن (Code Green)، مع نوع الهيكل الإنشائي والعناصر المتضررة ومؤشرات التلف (الشقوق المائلة النافذة، هبوط الأساسات وميلانها، تساقط الغطاء الخرساني وصدأ التسليح، رطوبة الأساسات وتشبعها). يضع المهندس توصية هندسية إلزامية، ويبقى القرار النهائي للجنة الهندسية ويُسجَّل باسم من اعتمده ووقته.
    نطاق الحماية المقترح = ${APPSET.buffer_factor} × ارتفاع المبنى (عدد الطوابق × ${APPSET.floor_height_m} م)، بحد أدنى 10 م، وهو تقدير أولي لا يغني عن تقدير المهندس في الموقع. أعداد المعرّضين للخطر تقديرية ما لم توثَّق الوحدات تفصيلياً، والأرقام تعكس ما قُيِّم فعلاً وليست حصراً شاملاً ما لم تبلغ نسبة الإنجاز 100%.</div>`, 1)}
  <div class="pp-sign"><h4>الاعتماد</h4><div class="pp-sg">
    <div><b>معدّ التقرير</b><span>الاسم: ${esc(ME_NAME || line)}</span><i></i><span>التوقيع</span><span>التاريخ: ${fmt(now)}</span></div>
    <div><b>المراجع الفني</b><span>الاسم: ${line}</span><i></i><span>التوقيع</span><span>التاريخ: ........../........../..........</span></div>
    <div><b>رئيس اللجنة الهندسية (ختم)</b><span>الاسم: ${line}</span><i></i><span>التوقيع والختم</span><span>التاريخ: ........../........../..........</span></div></div></div>
  <div class="pp-foot">وثيقة صادرة آلياً من منظومة السلامة والمباني الخطرة (DBAS) · الإصدار ${APP_VERSION} · ${no}</div>
  </div>
  <div class="row end noprint" style="margin-top:12px"><button class="btn pri" type="button" data-act="print-pp">طباعة / حفظ PDF</button><button class="btn" type="button" data-act="xlsx">تنزيل البيانات Excel</button><button class="btn" type="button" data-act="close">إغلاق</button></div>
  <p class="hint noprint" style="margin-bottom:0">في نافذة الطباعة اختر «حفظ بصيغة PDF». التقرير يتبع الفلاتر الحالية ويعمل دون اتصال.</p>`;
  $("#dlg").showModal(); $("#dlg").scrollTop = 0;
}

/* ================= مصنّف Excel ================= */
async function expXLSX() {
  const V = view(); if (!V.length) return toast("لا توجد سجلات للتصدير.");
  try { await loadScript("vendor/xlsx.mini.min.js") } catch (e) { return toast("تعذّر تحميل مكتبة Excel: " + e.message) }
  toast("جارٍ تجهيز المصنّف…");
  const wb = XLSX.utils.book_new(), add = (name, rows, widths) => {
    const ws = Array.isArray(rows[0]) ? XLSX.utils.aoa_to_sheet(rows) : XLSX.utils.json_to_sheet(rows);
    if (widths) ws["!cols"] = widths.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  const num = x => typeof x === "string" && /^[\d,]+(\.\d+)?$/.test(x) ? +x.replace(/,/g, "") : x;
  /* 1) الملخص */
  const E = riskStats(V), S2 = safety(V);
  add("الملخص", [["تقرير بيانات منظومة السلامة والمباني الخطرة (DBAS)"], ["تاريخ التصدير", new Date().toLocaleString("ar-EG")], ["أعدّه", ME_NAME], ["النطاق", filterDesc()], ["مُجهَّل", ANON ? "نعم" : "لا"], [], ["المؤشر", "القيمة"], ["عدد المباني المقيَّمة", V.length], ...RISK_K.map(k => [riskLab(k), V.filter(c => c.risk_level === k).length]), ...E.sum.map(r => r.map(num)), ...S2.sum], [38, 22, 14, 14, 12, 12, 18, 14]);
  /* 2) المباني — بأعمدة BCOLS وعناوين عربية */
  const B = expRows(V).map(({ _g, ...r }) => Object.fromEntries(BCOLS.map(c => [c[3].replace(/\s*\(.*$/, "").slice(0, 40) + " [" + c[0] + "]", r[c[0]]])));
  add("المباني", B, BCOLS.map(c => /name|notes|indicators|street|elements|proximity|recommend|decision_note/.test(c[0]) ? 32 : c[0] === "building_id" ? 38 : 16));
  /* 3) قرارات اللجنة: الداهمة والآيلة */
  const Dn = V.filter(c => DANGER.has(c.risk_level));
  if (Dn.length) add("القرارات", [["رقم السجل", "الاسم", "الحي", "الخطورة", "الإشغال", "الأفراد المعرّضون", "توصية المهندس", "قرار اللجنة", "تاريخ القرار", "ملاحظة القرار"],
    ...Dn.map(c => [rid(c), ANON ? "" : c.owner, c.district, riskName(c.risk_level), OCC[c.occupancy] || "", +c.per || 0, labs(RECO, c.recommendations), DECIS[c.committee_decision] || "بانتظار القرار", c.decided_at ? String(c.decided_at).slice(0, 10) : "", ANON ? "" : (c.decision_note || "")])], [12, 30, 16, 22, 14, 12, 30, 16, 12, 34]);
  /* 4) الوحدات */
  const F = flatRows(V).map(x => x.row);
  add("الوحدات", F, FKEYS.map(k => /name|notes|street|indicators|elements|recommend/.test(k) ? 28 : k === "building_id" || k === "unit_id" ? 40 : 13));
  /* 5) الأحياء */
  const D = distTable(V), dh = ["الحي", "المباني", "خطورة داهمة", "آيل للسقوط", "خطورة متوسطة", "آمن", "خطرة مأهولة", "أفراد معرّضون", "أسر معرّضة", "تنبيهات السلامة", "بانتظار القرار"],
    dr = r => [r.d, r.n, r.r0, r.r1, r.r2, r.r3, r.occ, r.per, r.fam, r.alerts, r.undec];
  add("الأحياء", [dh, ...D.rows.map(dr), dr(D.T)], dh.map((_, i) => i ? 13 : 20));
  /* 6) الهيكل الإنشائي × الخطورة، والعناصر ومؤشرات التلف */
  add("الهياكل الإنشائية", [["نوع الهيكل", ...RISK_K.map(riskName), "الإجمالي"], ...[...Object.keys(STRUCT), ""].map(s => { const a = V.filter(c => (c.structure_type || "") === s); return [STRUCT[s] || "غير محدد", ...RISK_K.map(k => a.filter(c => c.risk_level === k).length), a.length] }).filter(r => r[r.length - 1])], [26, 16, 16, 16, 16, 12]);
  const cnt = (d, f) => Object.entries(d).map(([k, l]) => [l, V.filter(c => (f(c) || []).includes(k)).length, Dn.filter(c => (f(c) || []).includes(k)).length]);
  add("التلف الإنشائي", [["العنصر / المؤشر", "كل المباني", "الداهمة والآيلة"], ["— العناصر المتضررة —", "", ""], ...cnt(ELEMS, c => c.damaged_elements), ["— مؤشرات التلف —", "", ""], ...cnt(INDIC, c => c.damage_indicators)], [44, 14, 16]);
  /* 7) إنجاز المسح */
  const St = distStats(); if (St.rows.length) add("إنجاز المسح", [["الحي", "بصمات المباني", "المُقيَّم", "المتبقي", "نسبة الإنجاز %"], ...St.rows.map(r => [r.d, r.tot, r.doc, r.left, r.pct]), ["الإجمالي", St.tot.tot, St.tot.doc, St.tot.left, St.tot.pct]], [20, 14, 12, 12, 14]);
  /* 8) قاموس البيانات */
  add("قاموس البيانات", [["الحقل", "النوع", "الوصف"], ...FLAT_COLS.map(c => [c[0], c[1].replace(/\(\d+\)/, ""), c[3] || ""])], [24, 12, 80]);
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.writeFile(wb, "dbas-export-" + todayS() + (ANON ? "-anon" : "") + ".xlsx", { compression: true });
  logAudit("gz_records", null, "export_xlsx", null, { n: V.length }, true); if (V.length > BULK_EXPORT_THRESHOLD) raiseAlert("bulk_export", `تصدير Excel لـ${V.length} سجل`, "warn");
  toast(`تم تنزيل المصنّف: ${NF(V.length)} مبنى.`);
}
document.addEventListener("click", e => { if (e.target.closest('[data-x="xlsx"]')) expXLSX() });
