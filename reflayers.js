/* ================================================================
   reflayers.js — طبقات بصمات المباني المرجعية: التحميل والمطابقة والنشر، وفهرسة شبكية لحساب الإنجاز حسب الحي
   ================================================================ */
/* ---- طبقة المباني المرجعية (محفوظة على الجهاز فقط) ---- */
let REFSRC="",REFBYD={};
const refStatus=()=>{const n=REFHIT.filter(a=>a.length).length;$("#refS").textContent=REF?`طبقة مرجعية: ${REF.length} مبنى · موثّق ${n} · المتبقي ${REF.length-n}${REFSRC==="local"?" (محلية، غير منشورة بعد)":" (من الخادم)"}`:""};
let REFHIT=[],REFGRID=null,DRAFTV=[],DSIG="";
const SZ=.0005,gk=(la,ln)=>Math.floor(la/SZ)+"_"+Math.floor(ln/SZ);
const rings=g=>g.type==="Polygon"?[g.coordinates[0]]:g.coordinates.map(p=>p[0]);
const inRing=(x,y,r)=>{let o=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])o=!o}return o};
function buildIdx(list){const m=new Map(),rs=list.map(x=>rings(x.g));
  rs.forEach((rg,i)=>{let a=1e9,b=1e9,c=-1e9,d=-1e9;rg.forEach(r=>r.forEach(q=>{a=Math.min(a,q[1]);c=Math.max(c,q[1]);b=Math.min(b,q[0]);d=Math.max(d,q[0])}));
    for(let la=Math.floor(a/SZ);la<=Math.floor(c/SZ);la++)for(let ln=Math.floor(b/SZ);ln<=Math.floor(d/SZ);ln++){const k=la+"_"+ln;(m.get(k)||m.set(k,[]).get(k)).push(i)}});
  return{src:list,m,rs}}
function refIndex(){if(REFGRID&&REFGRID.src===REF)return REFGRID;return REFGRID=buildIdx(REF)}
/* ربط كل سجل (ومسودة) بالبصمة التي يقع مركزه داخلها */
const IPC=new WeakMap();
/* نقاط الاختبار لكل سجل: نقطته المخزنة، وإن لم تقع داخل شكله المخزن (سجلات قديمة بمركز ثقل خارجي) فنقطة داخلية من الشكل */
const recPts=c=>{const a=[[c.lng,c.lat]],g=c.geom;
  if(g&&typeof g==="object"&&/Polygon/.test(g.type||"")&&!rings(g).some(r=>inRing(c.lng,c.lat,r))){let p=IPC.get(g);if(p===undefined){p=geomPt(g);IPC.set(g,p||null)}if(p)a.push(p)}return a};
function markRef(skip){REFHIT=REF?REF.map(()=>[]):[];
  if(REF&&recs.length){const ix=refIndex();for(const c of recs){let ok=false;
    for(const [x,y] of recPts(c)){for(const i of ix.m.get(gk(y,x))||[])if(ix.rs[i].some(r=>inRing(x,y,r))){REFHIT[i].push(c);ok=true;break}if(ok)break}}}
  refStatus();if(!skip&&refL)refL.setStyle(refStyle);if(pickMap)drawDocs()}
/* ---- إحصائيات المسح الميداني لكل حي (من الطبقات المرجعية والسجلات) ---- */
const IDXC=new WeakMap();let DSTAT=null,DSTK=null;
const pctOf=(a,b)=>b?Math.round(a/b*1000)/10:0,pctCol=p=>p<25?"#c0392b":p<60?"#e6a23c":"#2e7d32";
/* لكل حي: عدد البصمات، وعدد البصمات التي يقع داخلها سجل واحد على الأقل (المرفوضة لا تُحتسب) */
function distStats(){
  if(DSTAT&&DSTK&&DSTK[0]===REFBYD&&DSTK[1]===recs)return DSTAT;
  const ds=Object.keys(REFBYD||{}).filter(inScope).sort((a,b)=>a.localeCompare(b,"ar")),good=recs.filter(c=>c.status!=="rejected"&&isFinite(c.lat)&&isFinite(c.lng));
  const rows=ds.map(d=>{const list=REFBYD[d]||[];let ix=IDXC.get(list);if(!ix){ix=buildIdx(list);IDXC.set(list,ix)}
    const hit=new Uint8Array(list.length);
    for(const c of good){let ok=false;
      for(const [x,y] of recPts(c)){for(const i of ix.m.get(gk(y,x))||[])if(ix.rs[i].some(r=>inRing(x,y,r))){hit[i]=1;ok=true;break}if(ok)break}}
    let doc=0;for(let i=0;i<hit.length;i++)doc+=hit[i];
    const tot=list.length;return{d,tot,doc,left:tot-doc,pct:pctOf(doc,tot)}});
  const T=rows.reduce((s,r)=>({tot:s.tot+r.tot,doc:s.doc+r.doc}),{tot:0,doc:0});
  DSTK=[REFBYD,recs];return DSTAT={rows,tot:{d:"الإجمالي",tot:T.tot,doc:T.doc,left:T.tot-T.doc,pct:pctOf(T.doc,T.tot)}}}
const pbar=p=>`<div style="display:flex;align-items:center;gap:8px;min-width:130px"><div style="flex:1;height:10px;background:#e6ebef;border-radius:5px;overflow:hidden"><i style="display:block;height:100%;width:${Math.min(100,p)}%;background:${pctCol(p)}"></i></div><b style="min-width:44px;text-align:left">${p}%</b></div>`;
function distStatHtml(){const S=distStats();
  if(!S.rows.length)return `<div class="card"><h2>إنجاز المسح الميداني حسب الحي</h2><div class="pane"><p class="hint">لا توجد طبقات مرجعية منشورة ضمن نطاقك بعد، فلا يمكن احتساب نسب الإنجاز.</p></div></div>`;
  const tr=(r,tot)=>`<tr style="cursor:default${tot?";font-weight:700;background:#f0f3f5":""}"><td>${esc(r.d)}</td><td>${NF(r.tot)}</td><td>${NF(r.doc)}</td><td>${NF(r.left)}</td><td>${pbar(r.pct)}</td></tr>`;
  return `<div class="card"><h2>إنجاز المسح الميداني حسب الحي <span class="hint">البصمة تُحتسب موثّقة إن وقع داخلها سجل غير مرفوض · لا يتأثر بالفلاتر العلوية</span></h2><div class="scroll"><table><thead><tr><th>الحي</th><th>إجمالي المباني (البصمات)</th><th>الموثّق ميدانياً</th><th>المتبقي</th><th>نسبة الإنجاز</th></tr></thead><tbody>${S.rows.map(r=>tr(r)).join("")}${S.rows.length>1?tr(S.tot,true):""}</tbody></table></div></div>`}
const distStatSum=()=>{const S=distStats();return S.rows.length?[["— إنجاز المسح حسب الحي —",""],["الحي","إجمالي البصمات","الموثّق","المتبقي","نسبة الإنجاز %"],...S.rows.map(r=>[r.d,r.tot,r.doc,r.left,r.pct]),["الإجمالي",S.tot.tot,S.tot.doc,S.tot.left,S.tot.pct]]:[]};
const refStyle=f=>{const h=REFHIT[f.id]||[];if(!h.length)return{color:"#4fd1d9",weight:1,fillColor:"#4fd1d9",fillOpacity:.12};
  if($("#refOnly").checked)return{opacity:0,fillOpacity:0,weight:0};return{color:"#fff",weight:1.5,fillColor:riskCol(h[0].risk_level),fillOpacity:.7}};
function docPopup(ll,f,h){const c=h[0];
  L.popup().setLatLng(ll).setContent(`<div dir="rtl" style="min-width:200px;font-family:Tajawal,sans-serif"><b>${c.draft?"⏳ مسودة على جهازك لم تُرفع بعد":"✔ مُقيَّم سابقاً"}${h.length>1?" ("+h.length+" سجلات)":""}</b><br>${esc(c.owner)} – ${riskLab(c.risk_level)}${c.draft?"":`<br><span style="color:#5d6b78;font-size:12px">${rid(c)} · ${ST[c.status][0]}</span>`}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${c.draft?"":`<button class="btn sm pri" type="button" data-act="detail" data-id="${esc(c.id)}">عرض السجل</button>`}${!c.draft&&canEdit(c)?`<button class="btn sm" type="button" data-act="edit" data-id="${esc(c.id)}">تعديل</button>`:""}<button class="btn sm" id="again">توثيق مرة أخرى</button></div></div>`).openOn(pickMap);
  setTimeout(()=>{const b=document.getElementById("again");if(b)b.onclick=()=>{pickMap.closePopup();f.geometry?pickFeat(f.geometry,f.properties):(clearShape(),resetAddForm(),setPt(c.lat,c.lng,true),openAdd())}},0)}
function showRef(list){refL&&pickMap.removeLayer(refL);refL=null;if(!list||!list.length)return;markRef(true);
  refL=L.geoJSON({type:"FeatureCollection",features:list.map((x,i)=>({type:"Feature",id:i,geometry:x.g,properties:x.p||{name:x.n}}))},{style:refStyle,
    onEachFeature:(f,l)=>l.on("click",ev=>{if(busy)return;L.DomEvent.stopPropagation(ev);const h=REFHIT[f.id]||[];h.length?docPopup(ev.latlng,f,h):pickFeat(f.geometry,f.properties)})}).addTo(pickMap)}
$("#refOnly").onchange=()=>refL&&refL.setStyle(refStyle);
const RT=[["owner","الاسم"],["risk","مستوى الخطورة"],["grade","درجة الضرر"],["qty","العدد (طوابق…)"],["type","نوع المبنى"],["district","الحي"],["street","وصف الموقع"]];
const RKX={owner:/(^name$|name:ar|^الاسم|owner|مالك|^اسم)/i,risk:/(risk|hazard|danger|خطور|خطر)/i,grade:/(damage|grade|الضرر|درجة|تصنيف)/i,qty:/(floor|storey|level|طابق|طوابق|^qty|^عدد)/i,type:/(^type$|building|usage|^use|نوع|استخدام|amenity)/i,district:/(neigh|district|الحي|منطقة)/i,street:/(street|address|عنوان|شارع|موقع)/i};
const GN=/no\s*(visible\s*)?damage|intact|سليم|لا ضرر|none/i,GD=[[/destroy|collaps|مدمر|هدم|كلي/i,"مدمّر كلياً"],[/sever|heavy|major|شديد|بالغ/i,"ضرر شديد"],[/moder|medium|متوسط/i,"ضرر متوسط"],[/possib|potent|light|minor|slight|محتمل|طفيف/i,"ضرر محتمل"]];
const TD=[[/gov|ministry|municip|حكوم|وزار|بلدي/i,"gov"],[/herit|histor|تراث|أثري|اثري/i,"heritage"],[/mosque|masjid|مسجد|جامع(?!ة)/i,"mosque"],[/church|كنيسة|كنائس/i,"church"],[/hospital|clinic|health|صح|مستشفى|عياد/i,"health"],[/school|educat|univers|تعليم|مدرس|جامعة/i,"edu"],[/commerc|shop|market|retail|تجار|محل|سوق/i,"com"],[/multi|apartment|عمارة|عمارات/i,"multi"],[/resid|house|home|dwell|سكن|بيت|منزل/i,"res"]];
const strip=s=>String(s??"").replace(/[\u064B-\u0652\u0640]/g,"").trim();
/* مستوى الخطورة من نص حر عربي أو إنجليزي (Code Red/Orange/Yellow/Green) */
function guessRisk(v){const w=strip(v).toLowerCase();if(!w)return null;if(RISK[w])return w;
  return /critical|red|imminent|collaps|داهم|وشيك|انهيار|احمر|أحمر/.test(w)?"critical":/high|orange|dilapid|آيل|ايل|عالي|برتقال/.test(w)?"high":/medium|moderate|yellow|متوسط|اصفر|أصفر/.test(w)?"medium":/safe|green|sound|آمن|امن|سليم|اخضر|أخضر/.test(w)?"safe":null}
function guessGrade(v,t){const w=strip(v);if(!w)return null;const gs=gradesOf(t),ex=gs.find(g=>strip(g)===w);if(ex)return ex;
  if(GN.test(w))return null;const m=GD.find(([r])=>r.test(w));return m?m[1]:null}
function guessType(v){const w=strip(v);if(!w)return null;const e=TYPES.find(x=>x.k===w||x.n===w);if(e)return e.k;const m=TD.find(([r])=>r.test(w));return m?m[1]:null}
function guessDist(v){const w=strip(v);if(w.length<3)return null;return DISTS.find(d=>d===w||d.includes(w)||w.includes(d.replace(/^(حي|مخيم|محافظة)\s+/,"")))||null}
function prefill(p){if(!REFMAP)return 0;const g=k=>REFMAP[k]?String(p[REFMAP[k]]??"").trim():"";let n=0,x;
  if(x=guessType(g("type"))){$("#aT").value=x;typeChange();n++}
  if(x=g("owner")){$("#aO").value=x;n++}
  if((x=parseInt(g("qty")))>0){$("#aQ").value=x;n++}
  if(x=guessRisk(g("risk"))){$("#aRisk").value=x;riskChange();n++}
  if(x=guessGrade(g("grade"),tOf($("#aT").value))){$("#aG").value=x;n++}
  if(x=guessDist(g("district"))){$("#aD").value=x;n++}
  if(x=g("street")){$("#aS").value=x;n++}
  return n}
function pickFeat(g,p){clearShape();resetAddForm();const polys=g.type==="Polygon"?[g.coordinates]:g.coordinates;drawn=g;areaM=polys.reduce((s,pl)=>s+gArea(pl[0]),0);perimM=Math.round(polys.reduce((s,pl)=>s+perim(pl[0]),0));const c=geomPt(g)||centroid(polys[0][0]);setPt(c[1],c[0],true);
  if(g.type==="Polygon"&&g.coordinates.length===1)dFG.addLayer(L.polygon(g.coordinates[0].slice(0,-1).map(q=>[q[1],q[0]]),{color:"#f2b705",weight:3,fillColor:"#f2b705",fillOpacity:.35}));
  else selL=L.geoJSON(g,{style:{color:"#f2b705",weight:3,fillColor:"#f2b705",fillOpacity:.35},interactive:false}).addTo(pickMap);
  const n=prefill(p||{});uMan=false;hMan=false;autoU();autoH();areaTxt();const msg=(n?`تمت تعبئة ${n} حقول من الطبقة المرجعية. راجعها قبل الحفظ، ويمكنك تعديل رؤوس البصمة بأداة التعديل.`:"تم اختيار المبنى. يمكنك تعديل رؤوس البصمة بأداة التعديل.");toast(msg);openAdd(msg)}
const STD=Object.fromEntries(RT.map(([k])=>[k,k]));
const gzip=async s=>typeof CompressionStream==="undefined"?new Blob([s]):new Response(new Blob([s]).stream().pipeThrough(new CompressionStream("gzip"))).blob();
const gunzip=async b=>new Response(b.stream().pipeThrough(new DecompressionStream("gzip"))).text();
const stdProps=p=>Object.fromEntries(RT.map(([k])=>[k,REFMAP&&REFMAP[k]?String(p[REFMAP[k]]??""):""]));
async function refPubDlg(){if(!REF||REFSRC!=="local")return toast("حمّل طبقة من ملف أولاً (زر «تحميل طبقة من ملف»).");
  if(!Object.values(REFMAP||{}).some(Boolean)&&!await confirmAsk("لم تطابق أي حقل. تنشر البصمات بلا بيانات وصفية؟",{title:"نشر الطبقة"}))return;
  $("#dlg").innerHTML=`<h3 style="margin-top:0">نشر الطبقة على الخادم</h3><p class="hint">تصل تلقائياً إلى مهندسي هذا الحي والمراجعين والمدير، وتُستبدل أي طبقة منشورة سابقاً لهذا الحي. عدد البصمات: ${REF.length}.</p><div class="f"><div class="w"><label for="pD">الحي</label><select id="pD"></select></div></div><div class="row" style="margin-top:12px"><button class="btn pri" id="pGo">نشر</button><button class="btn" type="button" data-act="close">إلغاء</button></div>`;
  opts($("#pD"),"",DISTS.map(d=>[d,d]));
  $("#pGo").onclick=async()=>{$("#pGo").disabled=true;const d=$("#pD").value;
    try{const gzOK=typeof CompressionStream!=="undefined",blob=await gzip(JSON.stringify(REF.map(x=>({g:x.g,p:stdProps(x.p||{})}))));
      if(blob.size>45*1048576)throw new Error("الملف أكبر من 45 م.ب بعد الضغط. قسّمه إلى أحياء أصغر.");
      const path=crypto.randomUUID()+(gzOK?".json.gz":".json"),up=await sb.storage.from("gz-ref").upload(path,blob,{contentType:gzOK?"application/gzip":"application/json"});if(up.error)throw up.error;
      const {data:prev}=await sb.from("gz_ref_layers").select("file_path").eq("district",d).maybeSingle();
      const {error}=await sb.from("gz_ref_layers").upsert({district:d,file_path:path,features:REF.length,source_name:REFNAME,uploaded_at:new Date().toISOString()},{onConflict:"district"});
      if(error){await sb.storage.from("gz-ref").remove([path]);throw error}
      if(prev&&prev.file_path)sb.storage.from("gz-ref").remove([prev.file_path]);
      $("#dlg").close();REFSRC="";await syncRef();toast("تم نشر الطبقة لحي "+d+".")}catch(e){$("#pGo").disabled=false;toast("تعذّر النشر: "+(e.message||e))}};
  $("#dlg").showModal()}
async function refSrvDlg(){const {data,error}=await sb.from("gz_ref_layers").select("*").order("district");if(error)return toast(error.message);
  const DS=Object.fromEntries(distStats().rows.map(r=>[r.d,r])),dsT=distStats().tot;
  $("#dlg").innerHTML=`<h3 style="margin-top:0">الطبقات المنشورة</h3>${(data||[]).length?`<div class="scroll"><table><thead><tr><th>الحي</th><th>البصمات</th><th>الموثّق</th><th>المتبقي</th><th>الإنجاز</th><th>الملف</th><th>التاريخ</th><th></th></tr></thead><tbody>${data.map(r=>`<tr style="cursor:default"><td>${esc(r.district===ROADS_KEY?"طبقة الشوارع":r.district)}</td><td>${NF(+r.features||0)}</td>${DS[r.district]?`<td>${NF(DS[r.district].doc)}</td><td>${NF(DS[r.district].left)}</td><td>${pbar(DS[r.district].pct)}</td>`:"<td>—</td><td>—</td><td>—</td>"}<td>${esc(r.source_name)||"—"}</td><td>${fmt(r.uploaded_at)}</td><td><button class="btn sm bad" data-d="${esc(r.id)}" data-p="${esc(r.file_path)}">حذف</button></td></tr>`).join("")}${data.length>1?`<tr style="cursor:default;font-weight:700;background:#f0f3f5"><td>الإجمالي</td><td>${NF(data.reduce((s,r)=>s+(+r.features||0),0))}</td><td>${NF(dsT.doc)}</td><td>${NF(dsT.left)}</td><td>${pbar(dsT.pct)}</td><td colspan="3"></td></tr>`:""}</tbody></table></div><p class="hint">الموثّق = بصمات وقع داخلها سجل غير مرفوض، من السجلات المتاحة على جهازك.</p>`:'<p class="hint">لا توجد طبقات منشورة بعد.</p>'}<div class="row" style="margin-top:12px"><button class="btn" type="button" data-act="close">إغلاق</button></div>`;
  $("#dlg").querySelectorAll("button[data-d]").forEach(b=>b.onclick=async()=>{if(!await confirmAsk("حذف هذه الطبقة من الخادم؟ ستختفي من أجهزة كل مهندسي الحي عند مزامنتهم.",{title:"حذف طبقة",ok:"حذف",danger:true}))return;
    const {error}=await sb.from("gz_ref_layers").delete().eq("id",b.dataset.d);if(error)return toast(error.message);
    sb.storage.from("gz-ref").remove([b.dataset.p]);await syncRef();toast("تم حذف الطبقة.");refSrvDlg()});
  if(!$("#dlg").open)$("#dlg").showModal()}
function refMapDlg(){if(!REF)return toast("حمّل طبقة مرجعية أولاً.");
  const keys=[...new Set(REF.slice(0,300).flatMap(x=>Object.keys(x.p||{})))],ex={};REF.slice(0,300).forEach(x=>keys.forEach(k=>{if(!ex[k]&&x.p&&x.p[k])ex[k]=x.p[k]}));
  if(!keys.length)return toast("الملف لا يحتوي حقولاً وصفية للمطابقة.");
  const cur=REFMAP||Object.fromEntries(RT.map(([k])=>[k,keys.find(c=>RKX[k].test(c))||""]));
  $("#dlg").innerHTML=`<h3 style="margin-top:0">مطابقة حقول الطبقة المرجعية</h3><p class="hint">اختر الحقل في ملفك الذي يقابل كل خانة، فتُعبَّأ تلقائياً عند النقر على مبنى. القيم تُفسَّر عربياً أو إنجليزياً (مثل Destroyed أو مدمّر).</p><div class="f">${RT.map(([k,l])=>`<div><label for="rm_${k}">${l}</label><select id="rm_${k}"><option value="">— بدون —</option>${keys.map(c=>`<option value="${esc(c)}"${cur[k]===c?" selected":""}>${esc(c)}${ex[c]?" ← "+esc(String(ex[c]).slice(0,18)):""}</option>`).join("")}</select></div>`).join("")}</div>
  <div class="row" style="margin-top:12px"><button class="btn pri" id="rmSave">حفظ</button><button class="btn" type="button" data-act="close">إلغاء</button></div>`;
  $("#rmSave").onclick=()=>{REFMAP=Object.fromEntries(RT.map(([k])=>[k,$("#rm_"+k).value]));$("#dlg").close();toast("تم حفظ المطابقة.")};
  $("#dlg").showModal()}
$("#refM").onclick=refMapDlg;$("#refPub").onclick=refPubDlg;$("#refSrv").onclick=refSrvDlg;
async function readGeo(f){const n=f.name.toLowerCase();let fc;
  if(n.endsWith(".zip")){if(typeof shp==="undefined")throw new Error("مكتبة Shapefile لم تُحمَّل. حوّل الملف إلى GeoJSON.");fc=await shp(await f.arrayBuffer())}
  else if(n.endsWith(".csv"))fc=csv2fc(await f.text());else fc=JSON.parse(await f.text());
  if(Array.isArray(fc))fc={features:fc.flatMap(x=>x.features)};if(fc.type==="Feature")fc={features:[fc]};return fc.features||[]}
$("#refF").onchange=async e=>{const f=e.target.files[0];if(!f)return;
  try{const raw=await readGeo(f),slim=o=>Object.fromEntries(Object.entries(o||{}).slice(0,25).map(([k,v])=>[k,v==null?"":String(v).slice(0,80)])),
      list=raw.filter(x=>x.geometry&&/^(Multi)?Polygon$/.test(x.geometry.type)).slice(0,30000).map(x=>({g:x.geometry,p:slim(x.properties)}));
    if(!list.length)return toast("لا توجد مضلعات في الملف.");REF=list;REFNAME=f.name;REFMAP=null;REFSRC="local";refStatus();if(pickMap)showRef(REF);
    toast(`تم تحميل ${list.length} بصمة مرجعية${raw.length>30000?" (أول 30000 فقط)":""}.`);refMapDlg()}catch(err){toast("تعذّر تحميل الملف: "+err.message)}e.target.value=""};

/* زر حقيقي يفتح منتقي الملفات (يصل إليه لوحة المفاتيح، بدل label[for]) */
$("#refPick").onclick=()=>$("#refF").click();
