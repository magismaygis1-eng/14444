/* ================================================================
   records.js — جدول السجلات، العمليات الجماعية، جواز سفر المبنى (التقرير الرسمي)، التعديل والحذف
   ================================================================ */
/* ---- السجلات والتفاصيل ---- */
let PAGE=200;
function table(){const v=view();for(const id of [...SEL])if(!v.some(c=>c.id===id))SEL.delete(id);bulkUI();$("#cnt").textContent=v.length+" سجل";$("#empty").classList.toggle("hide",v.length>0);
  const shown=v.slice(0,PAGE),pg=$("#pager");pg.classList.toggle("hide",v.length<=PAGE);pg.innerHTML=v.length>PAGE?`<span class="hint">يُعرض ${NF(shown.length)} من ${NF(v.length)} · </span><button class="btn sm" type="button" id="pgMore">عرض المزيد</button> <button class="btn sm" type="button" id="pgAll">عرض الكل</button>`:"";
  $("#rows").innerHTML=shown.map(c=>`<tr data-id="${esc(c.id)}"><td class="cb"><input type="checkbox" ${SEL.has(c.id)?"checked":""} ${canAct(c)?"":"disabled"} aria-label="تحديد السجل"></td><td>${alertOf(c)?"🚨 ":""}${CF.has(c.id)?"⚠ ":""}${c.draft?"⏳ مسودة · ":PEND.has(c.id)?"⏳ ":""}${rid(c)}</td><td>${esc(c.owner)} <span class="hint">· ${esc(tOf(c.type).n)} · ${esc(c.qty)} طابق</span></td><td><b>${c.assessor_name?esc(c.assessor_name):'<span class="hint">غير مسجّل</span>'}</b></td><td>${esc(STRUCT[c.structure_type]||"—")}</td>
  <td>${riskChip(c.risk_level)}</td><td>${esc(c.district)}</td><td><span class="st" style="--c:${ST[c.status][1]}">${ST[c.status][0]}</span>${c.committee_decision?` <span class="st" style="--c:#12202e" title="قرار اللجنة">⚖ ${esc(DECIS[c.committee_decision]||"")}</span>`:DANGER.has(c.risk_level)&&!c.draft?' <span class="hint">بانتظار القرار</span>':""}</td><td style="white-space:nowrap"><button class="btn sm" data-a="d">تفاصيل</button> ${canDecide(c)?'<button class="btn sm gold" data-a="k">القرار</button> ':""}${canEdit(c)?'<button class="btn sm" data-a="e">تعديل</button> ':""}${canDel(c)?'<button class="btn sm bad" data-a="x">حذف</button>':""}</td></tr>`).join("")}
$("#pager").onclick=e=>{if(e.target.id==="pgMore"){PAGE+=500;table()}else if(e.target.id==="pgAll"){PAGE=1e9;table()}};
$("#rows").onclick=e=>{const tr=e.target.closest("tr");if(!tr)return;const id=tr.dataset.id,cell=e.target.closest("td.cb");
  if(cell){const cb=cell.querySelector("input");if(cb.disabled)return;if(e.target!==cb)cb.checked=!cb.checked;cb.checked?SEL.add(id):SEL.delete(id);return bulkUI()}
  const b=e.target.closest("button[data-a]");if(!b)return goMap(id);const a=b.dataset.a;a==="d"?detail(id):a==="e"?editRec(id):a==="k"?decideDlg(id):delIds([id])};
function bulkUI(){const n=SEL.size,rv=me.role==="reviewer"||me.role==="admin";$("#bulk").classList.toggle("hide",!n);$("#selN").textContent=n+" محدد";
  $("#bAp").classList.toggle("hide",!rv);$("#bRj").classList.toggle("hide",!rv);
  const act=view().filter(canAct),all=$("#selAll");all.checked=act.length>0&&act.every(c=>SEL.has(c.id));all.indeterminate=!all.checked&&n>0}
$("#selAll").onchange=e=>{const act=view().filter(canAct);e.target.checked?act.forEach(c=>SEL.add(c.id)):act.forEach(c=>SEL.delete(c.id));table()};
$("#bClr").onclick=()=>{SEL.clear();table()};$("#bDel").onclick=()=>delIds([...SEL]);$("#bAp").onclick=()=>bulkReview("approved");$("#bRj").onclick=()=>bulkReview("rejected");
async function bulkReview(status){const ids=[...SEL].filter(id=>{const c=recs.find(x=>x.id===id);return c&&c.status!==status});
  if(!ids.length)return toast("لا يوجد ضمن التحديد ما يحتاج هذا الإجراء.");
  let note="";if(status==="rejected"){const n=await promptAsk("ملاحظة الرفض (اختيارية) تظهر لمهندس الحصر:",{title:"رفض "+ids.length+" سجل",ok:"رفض",danger:true});if(n===null)return;note=n.trim()}
  else if(!await confirmAsk("اعتماد "+ids.length+" سجل؟",{title:"اعتماد جماعي",ok:"اعتماد"}))return;
  const patch=status==="rejected"&&note?{status,review_note:note}:{status},r=await doOp("update",ids,patch);
  SEL.clear();if(r.err)return toast("توقف التحديث: "+r.err);if(!r.queued)await load();toast(`تم تحديث ${r.n} من ${ids.length} سجل.`+(r.queued?" (محلياً حتى عودة الشبكة)":""))}
/* ---- جواز سفر المبنى (Building Passport): نافذة التفاصيل = تقرير الطباعة الرسمي، يعمل دون اتصال ---- */
const ppRow=(l,v,full)=>`<div${full?' class="full"':""}><span>${l}</span><b>${v===""||v==null?"—":v}</b></div>`;
const ppBad=(txt,bad)=>bad?`<span class="ppbad">${txt}</span>`:txt;
function ppUnits(c,t){
  if(!HOUS.has(t.k))return'<p class="pp-note">هذا النوع من الكيانات لا يتضمن وحدات سكنية.</p>';
  const L=Array.isArray(c.units_detail)?c.units_detail:[];let h="";
  if(L.length)h=`<div class="scroll"><table class="pp-tbl"><thead><tr><th>#</th><th>الطابق</th><th>الوحدة</th><th>الاسم الكامل</th><th>الصفة</th><th>الأفراد</th><th>حالة الوحدة</th><th>قرار اللجنة</th><th>ملاحظات</th></tr></thead><tbody>${L.map((u,i)=>`<tr><td>${i+1}</td><td>${esc(u.floor||"—")}</td><td>${esc(u.no||"—")}</td><td><b>${esc(u.name||"")}</b></td><td>${esc(labOf(REL,u.rel))}</td><td>${esc(u.per??"—")}</td><td>${u.habit&&HAB[u.habit]?HAB[u.habit][0]:"—"}</td><td>${u.com&&COM[u.com]?COM[u.com]:"—"}</td><td>${esc(u.notes||"")}</td></tr>`).join("")}</tbody></table></div><p class="pp-note">عدد الوحدات الموثّقة تفصيلياً: ${L.length}${c.units!=null?" · العدد الكلي المسجّل للمبنى: "+c.units:""}</p>`;
  else h=`<p class="pp-note">لا توجد وحدات موثّقة تفصيلياً.${c.units!=null?" العدد التقديري للمبنى: "+c.units+" وحدة.":""}</p>`;
  if(c.unit_owners)h+=`<div class="pp-note pp-pre"><b>ملاحظة:</b> ${esc(c.unit_owners)}</div>`;
  return h}
async function detail(id){const c=recs.find(x=>x.id===id);if(!c)return;const t=tOf(c.type),isB=t.c==="bld",canRev=me.role==="reviewer"||me.role==="admin";
  /* الصور: روابط موقّعة من الخادم (تتطلب اتصالاً)؛ دون اتصال يبقى باقي التقرير كاملاً */
  let ph='<p class="pp-note">لا توجد صور إثبات مرفقة.</p>';
  if(c.draft)ph='<p class="pp-note">مسودة محفوظة على جهازك، ستُرفع مع صورها عند توفر الاتصال.</p>';
  else if((c.photos||[]).length){let data=null;try{data=(await sb.storage.from("gz-photos").createSignedUrls(c.photos,600)).data}catch{}
    const u=(data||[]).filter(x=>x.signedUrl);ph=u.length?'<div class="pp-ph">'+u.map(x=>`<img src="${esc(x.signedUrl)}" alt="صورة إثبات" loading="lazy">`).join("")+"</div>":`<p class="pp-note">يوجد ${c.photos.length} صورة مرفوعة، وتُعرض عند توفر الاتصال بالشبكة.</p>`}
  const u=ll2utm(c.lat,c.lng),fl=Math.max(1,+c.qty||1),gross=c.area_m2?Math.round(c.area_m2*fl):null,NA="غير مقيَّم",hgt=fl*APPSET.floor_height_m;
  const s1=[
    ppRow("اسم المالك / المبنى / المرفق",esc(c.owner),1),
    ppRow("نوع المبنى",esc(t.n)),ppRow("نوع الاستخدام",esc(usageLabel(c.usage_type))+(c.gov_category?" – "+esc(govCatLabel(c.gov_category)):"")),
    ppRow("عدد الطوابق / الارتفاع التقريبي",`${esc(fl)} طابق · ≈ ${NF(hgt)} م`),ppRow("الحي / المنطقة",esc(c.district)),
    ppRow("وصف الموقع / المعالم القريبة",esc(c.street),1),
    ppRow("الإحداثيات (WGS84)",`<bdi>${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}</bdi>`),
    ppRow("إحداثيات UTM",`<bdi>${u.zone}N · E ${Math.round(u.E)} · N ${Math.round(u.N)}</bdi>`),
    ppRow("مساحة البصمة",c.area_m2?esc(c.area_m2)+" م²":""),ppRow("المساحة الإجمالية",gross?gross+" م²":""),
    HOUS.has(t.k)&&ppRow("الوحدات السكنية",esc(c.units??"")),
    ppRow("مهندس الحصر / التقييم الميداني",esc(c.assessor_name||"غير مسجّل")),
    ppRow("تاريخ التسجيل",fmt(c.created_at))].filter(Boolean).join("");
  const s2=[
    ppRow("مستوى الخطورة الإنشائية",riskChip(c.risk_level)+(RISK[c.risk_level]?`<div class="pp-note" style="margin:4px 0 0">${esc(RISK[c.risk_level][3])} — ${esc(RISK[c.risk_level][4])}</div>`:""),1),
    ppRow("نوع الهيكل الإنشائي",esc(STRUCT[c.structure_type]||"")),ppRow("درجة الضرر",esc(c.grade||"")),
    ppRow("العناصر الإنشائية المتضررة",esc(labs(ELEMS,c.damaged_elements)),1),
    ppRow("مؤشرات التلف الإنشائي",(c.damage_indicators||[]).length?`<ul class="pp-ul">${c.damage_indicators.map(k=>`<li>${esc(INDIC[k]||k)}</li>`).join("")}</ul>`:"",1),
    ppRow("تاريخ وقوع الضرر",esc(c.damage_date||"")),ppRow("تاريخ المعاينة",esc(c.inspect_date||"")),
    ppRow("إمكانية الوصول للموقع",c.site_access?ppBad(labOf(ACC,c.site_access),c.site_access!=="ok"):NA),
    ppRow("شهداء / مفقودون تحت الأنقاض",c.martyrs?ppBad(labOf(MAR,c.martyrs),c.martyrs!=="none"):NA),
    ppRow("ذخائر غير منفجرة",c.uxo?ppBad(labOf(UXOS,c.uxo),c.uxo==="yes"):NA)].join("");
  const s3=[
    ppRow("حالة الإشغال",c.occupancy?ppBad(esc(OCC[c.occupancy]),c.occupancy!=="vacant"&&DANGER.has(c.risk_level)):""),
    ppRow("الأسر / الأفراد المعرّضون للخطر المباشر",`${esc(c.fam||0)} / ${esc(c.per||0)}`),
    ppRow("القرب من مرافق حيوية",esc(labs(PROX,c.proximity)),1),
    DANGER.has(c.risk_level)&&ppRow("نطاق الحماية المقترح",`${NF(bufR(fl))} م حول المبنى (${APPSET.buffer_factor} × الارتفاع)`,1)].filter(Boolean).join("");
  const s5=[
    ppRow("التوصية الهندسية (المهندس)",recOf(c).length?`<b class="ppbad">${esc(labs(RECO,c.recommendations))}</b>`:"",1),
    ppRow("قرار اللجنة الهندسية",c.committee_decision?`<b>${esc(DECIS[c.committee_decision])}</b>`:(DANGER.has(c.risk_level)?'<span class="ppbad">بانتظار القرار</span>':"")),
    ppRow("اعتمده / التاريخ",c.decided_at?esc(NAMES[c.decided_by]||"")+" · "+fmt(c.decided_at):""),
    ppRow("ملاحظة القرار",c.decision_note?`<span class="pp-pre">${esc(c.decision_note)}</span>`:"",1)].join("");
  const s4=[
    ppRow("مصدر المعلومة",SRC[c.source]||""),
    ppRow("مستوى الثقة",`${cLvl(c)} (${conf(c)}%)`),
    ppRow("حالة المراجعة",ST[c.status][0]+(c.review_note?" – "+esc(c.review_note):""),1),
    ppRow("ملاحظات المعاينة الهندسية",c.notes?`<span class="pp-pre">${esc(c.notes)}</span>`:"",1)].join("");
  const line="................................",dl3="........../........../..........";
  $("#dlg").innerHTML=`<div class="pp">
  <div class="pp-head"><div class="pp-brand"><img src="icons/icon-192.png" alt=""><div><div class="pp-sys">منظومة السلامة والمباني الخطرة · DBAS</div><h3 class="pp-title">بطاقة السلامة الإنشائية للمبنى<small>Building Safety Passport</small></h3></div></div>
    <div class="pp-id"><span>رقم السجل الموحد</span><b dir="ltr">${rid(c)}</b><small>تاريخ الإصدار: ${fmt(new Date())}</small></div></div>
  ${alertOf(c)?`<div class="pp-alert">تنبيه سلامة: ${alertTxt(c)}</div>`:""}
  ${CF.has(c.id)?'<div class="pp-warn">يوجد سجل آخر قريب (أقل من 15 م) من الفئة نفسها بدرجة ضرر مختلفة. يلزم تدقيق.</div>':""}
  <section class="pp-sec"><h4>1. معلومات المبنى والموقع</h4><div class="pp-kv">${s1}</div></section>
  <section class="pp-sec"><h4>2. التقييم الإنشائي</h4><div class="pp-kv">${s2}</div></section>
  <section class="pp-sec"><h4>3. الإشغال والتعرّض للخطر</h4><div class="pp-kv">${s3}</div></section>
  <section class="pp-sec"><h4>4. التوصية الهندسية وقرار اللجنة</h4><div class="pp-kv">${s5}</div></section>
  <section class="pp-sec brk"><h4>5. جدول الوحدات والشاغلين</h4><div class="pp-body">${ppUnits(c,t)}</div></section>
  <section class="pp-sec brk"><h4>6. التوثيق والملاحظات الميدانية</h4><div class="pp-kv">${s4}</div><div class="pp-phh">صور الإثبات</div>${ph}</section>
  <div class="printonly pp-sign"><h4>الاعتماد والتوقيعات الرسمية</h4><div class="pp-sg">
    <div><b>توقيع مهندس الحصر / التقييم الميداني</b><span>الاسم: ${c.assessor_name?esc(c.assessor_name):line}</span><i></i><span>التوقيع</span><span>التاريخ: ${dl3}</span></div>
    <div><b>توقيع المراجع الفني</b><span>الاسم: ${line}</span><i></i><span>التوقيع</span><span>التاريخ: ${dl3}</span></div>
    <div><b>توقيع وختم اللجنة الهندسية</b><span>الاسم: ${line}</span><i></i><span>التوقيع والختم</span><span>التاريخ: ${dl3}</span></div></div></div>
  <div class="printonly pp-foot">وثيقة صادرة من منظومة السلامة والمباني الخطرة (DBAS) · ${rid(c)} · تاريخ الطباعة: ${fmt(new Date())}</div>
  </div>
  ${canRev?`<div class="noprint"><label class="hint" for="rn">ملاحظة المراجعة</label><input id="rn" value="${esc(c.review_note)}" style="width:100%;padding:7px 10px;border:1px solid var(--line);border-radius:8px;margin:3px 0 8px"><div class="row"><button class="btn pri" type="button" data-act="approve" data-id="${esc(c.id)}">اعتماد</button><button class="btn bad" type="button" data-act="reject" data-id="${esc(c.id)}">رفض</button></div></div>`:""}
  <div class="row noprint" style="margin-top:10px"><button class="btn pri" type="button" data-act="print-pp">طباعة بطاقة السلامة (PDF)</button>${canDecide(c)?`<button class="btn gold" type="button" data-act="decide" data-id="${esc(c.id)}">قرار اللجنة</button>`:""}<button class="btn" type="button" data-act="goto-map" data-id="${esc(c.id)}">على الخريطة</button>${canEdit(c)?`<button class="btn" type="button" data-act="edit" data-id="${esc(c.id)}">تعديل</button>`:""}${canDel(c)?`<button class="btn bad" type="button" data-act="del" data-id="${esc(c.id)}">حذف</button>`:""}<button class="btn" type="button" data-act="close">إغلاق</button></div>
  <p class="hint noprint" style="margin-bottom:0">في نافذة الطباعة اختر «حفظ بصيغة PDF» للحصول على ملف. يعمل دون اتصال بالإنترنت.</p>`;
  $("#dlg").showModal()}
async function review(id,status){const r=await doOp("update",[id],{status,review_note:$("#rn").value});
  if(r.err)return toast("تعذّر الحفظ: "+r.err);$("#dlg").close();toast((status==="approved"?"تم الاعتماد":"تم الرفض")+(r.queued?" (محفوظ محلياً وسيُزامَن عند عودة الشبكة)":""));if(!r.queued)await load()}
function goMap(id){focusId=id;$("#lyr").value="pts";show("mapv")}
function editRec(id){const c=recs.find(x=>x.id===id);if(!c)return;
  const fs=(k,l,req)=>`<fieldset class="w chk" id="${k}"><legend>${l}${req||""}</legend></fieldset>`;
  $("#dlg").innerHTML=`<h3 style="margin-top:0">تعديل تقييم ${rid(c)}</h3><div class="f">
  <div class="w"><label for="eO">اسم المالك / المبنى / المرفق</label><input id="eO" value="${esc(c.owner)}" maxlength="120"></div>
  <div class="w"><label for="eAs">مهندس الحصر / التقييم الميداني (توثيق تلقائي)</label><input id="eAs" value="${esc(c.assessor_name||"")}" readonly class="ro" aria-readonly="true"><div class="hint">عند الحفظ يُوثَّق التعديل باسمك: ${esc(ME_NAME||"—")}</div></div>
  <div><label for="eT">نوع المبنى</label><select id="eT"></select></div><div><label for="eUse">نوع الاستخدام</label><select id="eUse"></select></div>
  <div id="eGovBox" class="hide"><label for="eGov">الفئة الحكومية</label><select id="eGov"></select></div>
  <div><label for="eStruct">نوع الهيكل الإنشائي</label><select id="eStruct"></select></div><div><label for="eQ">عدد الطوابق</label><input id="eQ" type="number" min="1" max="60" value="${esc(c.qty)}"></div>
  <div><label for="eRisk">مستوى الخطورة</label><select id="eRisk"></select></div><div><label for="eG">درجة الضرر (اختياري)</label><select id="eG"></select></div>
  ${fs("eElems","العناصر الإنشائية المتضررة")}${fs("eIndic","مؤشرات التلف الإنشائي")}
  <div><label for="eOcc">حالة الإشغال</label><select id="eOcc"></select></div><div><label for="eD">الحي</label><select id="eD"></select></div>
  <div><label for="eF">الأسر المعرّضة للخطر</label><input id="eF" type="number" min="0" value="${esc(c.fam??"")}"></div><div><label for="eP">الأفراد المعرّضون للخطر</label><input id="eP" type="number" min="0" value="${esc(c.per??"")}"></div>
  ${fs("eProx","القرب من مرافق حيوية")}${fs("eReco","التوصية الهندسية"," *")}
  <div class="w"><label for="eS">وصف الموقع</label><input id="eS" value="${esc(c.street)}" maxlength="160"></div>
  <div id="eUbox"><label for="eU">الوحدات السكنية</label><input id="eU" type="number" min="0" value="${esc(c.units??"")}"></div>
  <div class="w f" style="padding:0">${techHTML("e",c)}</div>
  <div class="w"><label for="eSrc">المصدر</label><select id="eSrc"></select></div>
  <div class="w"><label for="eN">ملاحظات المعاينة الهندسية</label><textarea id="eN" rows="2" maxlength="500">${esc(c.notes)}</textarea></div></div>
  <div class="row" style="margin-top:12px"><button class="btn pri" id="eSave">حفظ التعديل</button><button class="btn" type="button" data-act="close">إلغاء</button></div>`;
  opts($("#eT"),"",TYPES.map(x=>[x.k,x.n]));$("#eT").value=c.type;const eSync=()=>$("#eUbox").classList.toggle("hide",!HOUS.has($("#eT").value));eSync();$("#eT").onchange=()=>{techToggle("e",$("#eT").value);eSync()};
  opts($("#eStruct"),"",Object.entries(STRUCT));$("#eStruct").value=c.structure_type||"";opts($("#eRisk"),"",RISK_K.map(k=>[k,riskLab(k)]));$("#eRisk").value=c.risk_level||"";
  opts($("#eG"),"— غير محدد —",BLD.map(g=>[g,g]));$("#eG").value=c.grade||"";opts($("#eOcc"),"",Object.entries(OCC));$("#eOcc").value=c.occupancy||"";
  [["eElems",ELEMS,c.damaged_elements],["eIndic",INDIC,c.damage_indicators],["eProx",PROX,c.proximity],["eReco",RECO,c.recommendations]].forEach(([k,d,v])=>{chkGroup($("#"+k),d,k);chkSet($("#"+k),v)});
  opts($("#eD"),"",myD().map(d=>[d,d]));if(!DISTS.includes(c.district))$("#eD").add(new Option(c.district,c.district));$("#eD").value=c.district;
  opts($("#eUse"),"",USAGE_TYPES);$("#eUse").value=c.usage_type||"";opts($("#eGov"),"",GOV_CATS);$("#eGov").value=c.gov_category||"";
  const eGovToggle=()=>$("#eGovBox").classList.toggle("hide",$("#eUse").value!=="gov");eGovToggle();$("#eUse").onchange=eGovToggle;
  opts($("#eSrc"),"",Object.entries(SRC));$("#eSrc").value=c.source||"";techInit("e",c);techToggle("e",$("#eT").value);
  $("#eSave").onclick=async()=>{const owner=$("#eO").value.trim();if(!owner)return toast("أدخل الاسم.");const as=ME_NAME;if(!as)return toast("تعذّر التحقق من اسم حسابك. أعد تسجيل الدخول ثم حاول مجدداً.");
    const risk=$("#eRisk").value,reco=chkGet($("#eReco"));if(!RISK[risk])return toast("حدّد مستوى الخطورة.");if(risk!=="safe"&&!reco.length)return toast("اختر توصية هندسية واحدة على الأقل لمبنى غير آمن.");
    const tg=techGet("e"),tm=techCheck(tg);if(tm)return toast(tm);const tp={};for(const k in tg)if(JSON.stringify(tg[k]??null)!==JSON.stringify(c[k]??null))tp[k]=tg[k];
    const dv=$("#eD").value;
    const r=await doOp("update",[id],{owner,assessor_name:as,type:$("#eT").value,qty:Math.max(1,+$("#eQ").value||1),grade:$("#eG").value||null,district:dv,district_code:distCodeOf(distMain(dv)),subdistrict_code:DIST_PARENT_OF[dv]?distCodeOf(dv):null,usage_type:$("#eUse").value||null,gov_category:$("#eUse").value==="gov"?($("#eGov").value||null):null,
      risk_level:risk,structure_type:$("#eStruct").value||null,damaged_elements:chkGet($("#eElems")),damage_indicators:chkGet($("#eIndic")),occupancy:$("#eOcc").value||null,proximity:chkGet($("#eProx")),recommendations:reco,
      street:$("#eS").value.trim(),fam:+$("#eF").value||null,per:+$("#eP").value||null,source:$("#eSrc").value||null,notes:$("#eN").value.trim(),units:$("#eU").value===""||!HOUS.has($("#eT").value)?null:+$("#eU").value,...tp});
    if(r.err)return toast("تعذّر الحفظ: "+r.err);
    if(!r.queued&&navigator.onLine&&risk!==c.risk_level)logAudit("gz_records",id,"risk_level",c.risk_level,risk);
    $("#dlg").close();toast("تم حفظ التعديل."+(r.queued?" (محلياً حتى عودة الشبكة)":""));if(!r.queued)await load()};
  $("#dlg").showModal()}
/* ---- قرار اللجنة الهندسية: منفصل عن توصية المهندس، ويختمه الخادم باسم من اعتمده ووقته ---- */
function decideDlg(id){const c=recs.find(x=>x.id===id);if(!c||!canDecide(c))return;
  $("#dlg").innerHTML=`<h3 style="margin-top:0">قرار اللجنة الهندسية — ${rid(c)}</h3>
  <p style="margin:0 0 6px"><b>${esc(c.owner)}</b> · ${esc(c.district)} · ${riskChip(c.risk_level)}</p>
  <p class="hint" style="margin:0 0 10px">توصية المهندس: <b>${esc(labs(RECO,c.recommendations)||"لا توجد")}</b> · الإشغال: ${esc(OCC[c.occupancy]||"—")} · الأفراد المعرّضون: ${esc(c.per||0)}</p>
  <div class="f"><div class="w"><label for="kD">القرار المعتمد *</label><select id="kD"></select></div>
  <div class="w"><label for="kN">ملاحظة / شروط التنفيذ</label><textarea id="kN" rows="3" maxlength="500">${esc(c.decision_note||"")}</textarea></div></div>
  ${c.decided_at?`<p class="hint">القرار الحالي: ${esc(DECIS[c.committee_decision]||"")} · ${esc(NAMES[c.decided_by]||"")} · ${fmt(c.decided_at)}</p>`:""}
  <div class="row" style="margin-top:12px"><button class="btn pri" id="kSave">اعتماد القرار</button><button class="btn" type="button" data-act="close">إلغاء</button></div>`;
  opts($("#kD"),"— اختر —",Object.entries(DECIS));$("#kD").value=c.committee_decision||"";
  $("#kSave").onclick=async()=>{const d=$("#kD").value;if(!d)return toast("اختر القرار.");
    if(!await confirmAsk(`اعتماد القرار «${DECIS[d]}» للمبنى ${rid(c)}؟ يُسجَّل باسمك ووقته.`,{title:"اعتماد قرار",ok:"اعتماد"}))return;
    const r=await doOp("update",[id],{committee_decision:d,decision_note:$("#kN").value.trim()||null});
    if(r.err)return toast("تعذّر اعتماد القرار: "+r.err);$("#dlg").close();toast("تم اعتماد القرار."+(r.queued?" (محلياً حتى عودة الشبكة)":""));if(!r.queued)await load()};
  $("#dlg").showModal()}
async function delIds(ids){ids=ids.filter(id=>{const c=recs.find(x=>x.id===id);return c&&canDel(c)});
  if(!ids.length)return toast("لا يوجد ضمن التحديد ما يحق لك حذفه.");
  if(!await confirmAsk(`حذف ${ids.length} سجل نهائياً مع صورها؟ لا يمكن التراجع.`,{title:"حذف نهائي",ok:"حذف",danger:true}))return;
  if(ids.length>BULK_DELETE_THRESHOLD)raiseAlert("bulk_delete",`حذف ${ids.length} سجل دفعة واحدة`,"high");
  const r=await doOp("delete",ids);SEL.clear();$("#dlg").close();if(r.err)return toast("تعذّر الحذف: "+r.err);if(!r.queued)await load();
  toast(r.queued?`حُذف ${r.n} سجل محلياً وسيُزامَن عند عودة الشبكة.`:r.n===ids.length?`تم حذف ${r.n} سجل.`:`حُذف ${r.n} من ${ids.length}. الباقي لم تسمح به الصلاحيات أو تغيّرت حالته.`)}
const del=id=>delIds([id]);
