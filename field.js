/* ================================================================
   field.js — التقييم الميداني للسلامة الإنشائية: النموذج، مؤشرات التلف، الإشغال، التوصيات، الوحدات، الرسم على الخريطة، Polylabel
   ================================================================ */
/* ---- نموذج التسجيل ---- */
/* ---- التقييم الفني والسلامة العامة + ملّاك الوحدات (migration_v9) ---- */
const optS=(list,sel,first)=>(first?`<option value="">${first}</option>`:"")+list.map(([v,t])=>`<option value="${esc(v)}"${v===sel?" selected":""}>${esc(t)}</option>`).join("");
const unitRow=(u={})=>`<div class="urow" style="border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:8px;background:#fafcfc">
  <div class="row" style="justify-content:space-between;margin-bottom:6px"><b class="ut">وحدة</b><button type="button" class="btn sm bad" data-ud="1">حذف الوحدة</button></div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">
  <div><label>الطابق</label><select data-k="floor">${optS(FLOORS.map(x=>[x,x]),u.floor,"— الطابق —")}</select></div>
  <div><label>رقم / اسم الوحدة</label><input data-k="no" maxlength="20" value="${esc(u.no||"")}" placeholder="مثال: 3"></div>
  <div style="grid-column:span 2;min-width:220px"><label>الاسم الكامل *</label><input data-k="name" maxlength="120" value="${esc(u.name||"")}" placeholder="الاسم الرباعي"></div>
  <div><label>الصفة</label><select data-k="rel">${optS(Object.entries(REL),u.rel||"owner")}</select></div>
  <div><label>عدد الأفراد</label><input data-k="per" type="number" min="0" value="${esc(u.per??"")}"></div>
  <div><label>حالة الوحدة</label><select data-k="habit">${optS(Object.entries(HAB).map(([k,v])=>[k,v[0]]),u.habit,"— غير محدد —")}</select></div>
  <div><label>قرار اللجنة الفنية</label><select data-k="com">${optS(Object.entries(COM),u.com,"— لم يُحدد —")}</select></div>
  <div style="grid-column:1/-1"><label>ملاحظات</label><input data-k="notes" maxlength="200" value="${esc(u.notes||"")}"></div>
  </div></div>`;
function unitsGet(p){return [...$("#"+p+"UL").children].slice(0,80).map(r=>{const g=k=>r.querySelector(`[data-k="${k}"]`).value.trim();
  return{floor:g("floor")||null,no:g("no")||null,name:g("name"),rel:g("rel")||"owner",per:+g("per")||null,habit:g("habit")||null,com:g("com")||null,notes:g("notes")||null}}).filter(u=>u.name||u.no||u.per||u.notes)}
function unitsSync(p){const L=$("#"+p+"UL");[...L.children].forEach((r,i)=>r.querySelector(".ut").textContent="وحدة "+(i+1));
  const us=unitsGet(p),n=us.length;$("#"+p+"OwnH").textContent=n?`${n} وحدة مسجّلة، وكلها تتبع مالك المبنى.`:"";
  if(p==="a"&&n){const U=$("#aU");if(n>(+U.value||0)){U.value=n;uMan=true}
    const F=$("#aFam"),P=$("#aPer"),pv=us.reduce((x,u)=>x+(u.per||0),0);
    if(!F.value||F.dataset.auto){F.value=n;F.dataset.auto="1"}if(pv&&(!P.value||P.dataset.auto)){P.value=pv;P.dataset.auto="1"}}}
function techHTML(p,c={}){const id=c.inspect_date??(p==="a"?todayS():"");
  return `<div class="w hide" id="${p}OwnBox"><label>وحدات المبنى وملّاكها <span class="hint">كل وحدة تُسجَّل كاملةً وتتبع مالك المبنى</span></label><div id="${p}UL"></div><button type="button" class="btn" id="${p}UAdd">＋ إضافة وحدة / مالك</button><div class="hint" id="${p}OwnH"></div>${c.unit_owners?`<div class="hint">نص قديم محفوظ: ${esc(c.unit_owners)}</div>`:""}</div>
  <div class="w f hide" id="${p}TechBox" style="padding:0"><div class="w"><b>السلامة العامة وتواريخ المعاينة</b></div>
  <div><label for="${p}DD">تاريخ وقوع الضرر</label><input id="${p}DD" type="date" max="${todayS()}" value="${esc(c.damage_date||"")}"></div>
  <div><label for="${p}ID">تاريخ المعاينة</label><input id="${p}ID" type="date" max="${todayS()}" value="${esc(id)}"></div>
  ${TECH.map(([k,,l])=>`<div><label for="${p}${k}">${l}</label><select id="${p}${k}"></select></div>`).join("")}</div>`}
function techInit(p,c={}){
  for(const [k,f,,m] of TECH){const el=$("#"+p+k);opts(el,"— غير محدد —",Object.entries(m).map(([a,b])=>[a,Array.isArray(b)?b[0]:b]));el.value=c[f]||""}
  const L=$("#"+p+"UL");
  $("#"+p+"UAdd").onclick=()=>{if(L.children.length>=80)return toast("الحد الأقصى 80 وحدة للمبنى.");L.insertAdjacentHTML("beforeend",unitRow());unitsSync(p);L.lastElementChild.querySelector('[data-k="name"]').focus()};
  L.addEventListener("click",e=>{if(e.target.dataset.ud){e.target.closest(".urow").remove();unitsSync(p)}});
  L.addEventListener("input",()=>unitsSync(p));
  (Array.isArray(c.units_detail)?c.units_detail:[]).forEach(u=>L.insertAdjacentHTML("beforeend",unitRow(u)));unitsSync(p);
  if(p==="a")["aFam","aPer"].forEach(i=>$("#"+i).addEventListener("input",e=>{delete e.target.dataset.auto}))}
function techToggle(p,k){$("#"+p+"OwnBox").classList.toggle("hide",!HOUS.has(k));$("#"+p+"TechBox").classList.toggle("hide",tOf(k).c!=="bld")}
function techGet(p){const vis=i=>!$("#"+p+i).classList.contains("hide"),g=i=>$("#"+i).value||null,tc=vis("TechBox"),o={};
  const us=vis("OwnBox")?unitsGet(p):[];o.units_detail=us.length?us:null;
  o.damage_date=tc?g(p+"DD"):null;o.inspect_date=tc?g(p+"ID"):null;
  for(const [k,f] of TECH)o[f]=tc?g(p+k):null;return o}
function techCheck(o){const t=todayS();
  if((o.units_detail||[]).some(u=>!u.name))return"أدخل الاسم الكامل لكل وحدة مضافة، أو احذف الوحدة الفارغة.";
  if(o.damage_date&&o.damage_date>t||o.inspect_date&&o.inspect_date>t)return"التاريخ المُدخل في المستقبل.";
  if(o.damage_date&&o.inspect_date&&o.inspect_date<o.damage_date)return"تاريخ المعاينة لا يسبق تاريخ وقوع الضرر.";return""}
function techReset(p){$("#"+p+"UL").innerHTML="";$("#"+p+"OwnH").textContent="";$("#"+p+"DD").value="";$("#"+p+"ID").value=todayS();for(const [k] of TECH)$("#"+p+k).value="";
  if(p==="a")["aFam","aPer"].forEach(i=>delete $("#"+i).dataset.auto)}
const unitsTable=l=>`<div class="scroll"><table style="font-size:12px"><thead><tr><th>الطابق</th><th>الوحدة</th><th>الاسم الكامل</th><th>الصفة</th><th>الأفراد</th><th>حالة الوحدة</th><th>قرار اللجنة</th><th>ملاحظات</th></tr></thead><tbody>${l.map(u=>`<tr style="cursor:default"><td>${esc(u.floor||"—")}</td><td>${esc(u.no||"—")}</td><td><b>${esc(u.name||"")}</b></td><td>${esc(labOf(REL,u.rel))}</td><td>${esc(u.per??"—")}</td><td>${u.habit&&HAB[u.habit]?HAB[u.habit][0]:"—"}</td><td>${u.com&&COM[u.com]?COM[u.com]:"—"}</td><td>${esc(u.notes||"")}</td></tr>`).join("")}</tbody></table></div>`;
/* مجموعة خانات اختيار متعدد من قاموس (العناصر، المؤشرات، القرب، التوصيات) */
function chkGroup(el,dict,name){const lg=el.querySelector("legend");el.innerHTML="";el.append(lg);
  el.insertAdjacentHTML("beforeend",`<div class="chks">${Object.entries(dict).map(([k,v])=>`<label><input type="checkbox" name="${name}" value="${esc(k)}"> ${esc(v)}</label>`).join("")}</div>`)}
const chkGet=el=>[...el.querySelectorAll("input:checked")].map(i=>i.value);
const chkSet=(el,a)=>el.querySelectorAll("input").forEach(i=>i.checked=(a||[]).includes(i.value));
/* مؤشرات السلامة العامة على مستوى المجموعة (للوحة المؤشرات والتقرير) */
function safety(v){const B=v,N=x=>Number(x).toLocaleString("en-US"),n=f=>B.filter(f).length;if(!B.some(c=>V9.some(k=>c[k])))return{html:"",sum:[]};
  const k=[["وحدات مسجّلة بأسماء شاغليها",N(B.reduce((x,c)=>x+(Array.isArray(c.units_detail)?c.units_detail.length:0),0))],["موقع مغلق أو منهار",N(n(c=>c.site_access==="blocked"||c.site_access==="collapsed"))],["شهداء تحت الأنقاض (مؤكد / مشتبه)",N(n(c=>c.martyrs==="confirmed"))+" / "+N(n(c=>c.martyrs==="suspected"))],["مواقع بها ذخائر غير منفجرة",N(n(c=>c.uxo==="yes"))]];
  const html=`<div class="card"><h2>السلامة العامة <span class="hint">ضمن الفلاتر الحالية</span></h2><div class="kpis" style="margin:0;border:0;border-radius:0">${k.map(([l,x])=>`<div class="kpi"><b style="font-size:22px">${x}</b><span>${l}</span></div>`).join("")}</div></div>`;
  return{html,sum:[["— السلامة العامة —",""],...k]}}
function typeChange(){const t=tOf($("#aT").value);$("#aUbox").classList.toggle("hide",!HOUS.has(t.k));techToggle("a",$("#aT").value);autoU();areaTxt()}
/* مستوى الخطورة: يعرض الإجراء المقابل، ويقترح توصية أولية إن لم يختر المهندس أي توصية بعد */
const RISK_RECO={critical:["evacuate"],high:["shore"],medium:["maintain"],safe:[]};
let recoTouched=false;
function riskChange(){const k=$("#aRisk").value,box=$("#aRisk").closest(".riskbox");$("#aRiskH").textContent=RISK[k]?RISK[k][3]+" — "+RISK[k][4]:"";
  box.style.setProperty("--rc",RISK[k]?RISK[k][1]:"transparent");box.classList.toggle("set",!!RISK[k]);
  if(!recoTouched)chkSet($("#aReco"),RISK_RECO[k]||[]);areaTxt()}
$("#aRisk").onchange=riskChange;$("#aReco").addEventListener("change",()=>{recoTouched=true});
$("#aT").onchange=typeChange;
function govCatToggle(){$("#aGovBox").classList.toggle("hide",$("#aUse").value!=="gov")}
/* الوحدات = عدد الطوابق × وحدات الطابق (من مساحة البصمة إن وُجدت، وإلا الافتراضي للنوع) */
function autoU(){const k=$("#aT").value;if(!HOUS.has(k)){$("#aU").value="";$("#aUH").textContent="";return}
  const fl=Math.max(1,+$("#aQ").value||1),upf=areaM>0?Math.max(1,Math.round(areaM/UNIT_AREA)):UPF[k];
  $("#aUH").textContent=`تقدير تلقائي: ${fl} طابق × ${upf} وحدة/طابق`+(areaM>0?` (من مساحة البصمة ${areaM} م²)`:" (افتراضي للنوع)")+". عدّله يدوياً إن اختلف الواقع.";
  if(!uMan)$("#aU").value=fl*upf}
/* المساحة الإجمالية = البصمة × عدد الطوابق، والارتفاع ونصف قطر نطاق الحماية من عدد الطوابق */
const bufR=fl=>Math.max(10,Math.round(APPSET.buffer_factor*APPSET.floor_height_m*Math.max(1,fl||1)));
function areaTxt(){const el=$("#areaOut"),fl=Math.max(1,+$("#aQ").value||1),p=[];
  if(areaM){p.push("مساحة البصمة: "+NF(areaM)+" م²");if(perimM)p.push("المحيط: "+NF(perimM)+" م");p.push("المساحة الإجمالية ("+fl+" طابق): "+NF(areaM*fl)+" م²")}
  p.push("الارتفاع التقريبي: "+NF(fl*APPSET.floor_height_m)+" م");
  if(DANGER.has($("#aRisk").value))p.push("نطاق الحماية المقترح: "+NF(bufR(fl))+" م حول المبنى");
  el.textContent=p.join(" · ")}
$("#aQ").addEventListener("input",()=>{autoU();areaTxt()});
$("#aU").addEventListener("input",()=>{uMan=true});$("#uReset").onclick=()=>{uMan=false;autoU()};
const LBL="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
function initPick(){sizeAdd();if(!pickMap){pickMap=L.map("pick",{maxZoom:20,preferCanvas:true}).setView([31.5017,34.4668],12);L.tileLayer(BASE.sat[0],{attribution:BASE.sat[1],maxNativeZoom:18,maxZoom:20}).addTo(pickMap);L.tileLayer(LBL,{maxNativeZoom:18,maxZoom:20}).addTo(pickMap);initDraw();showRef(REF);drawDocs();try{new ResizeObserver(()=>pickMap.invalidateSize()).observe($("#pick"))}catch{}}setTimeout(()=>pickMap.invalidateSize(),60)}
let drawn=null,areaM=null,perimM=null,uMan=false,dFG,busy=false,selL=null,refL=null,REF=null,REFMAP=null,REFNAME="",focusId=null,LM={};
/* ====== التوثيق الميداني: الخريطة هي الواجهة، ونموذج التسجيل نافذة منبثقة تُفتح عند اختيار مبنى أو نقطة ====== */
function sizeAdd(){const el=$("#add");if(!el||el.classList.contains("hide"))return;document.documentElement.style.setProperty("--hn",Math.max(0,Math.round(el.getBoundingClientRect().top+scrollY))+"px");pickMap&&pickMap.invalidateSize()}
addEventListener("resize",()=>{if(cur==="add")sizeAdd()});
const setNote=t=>{const n=$("#addNote");n.textContent=t||"";n.classList.toggle("hide",!t)};
const resetAddForm=()=>{["aO","aS","aN","aLat","aLng","aFam","aPer","aP","aU","aRisk","aStruct","aOcc","aG"].forEach(i=>$("#"+i).value="");$("#aQ").value=1;uMan=false;recoTouched=false;
  ["aElems","aIndic","aProx","aReco"].forEach(i=>chkSet($("#"+i),[]));riskChange();techReset("a");$("#addMsg").innerHTML="";setNote("")};
function openAdd(note){const d=$("#addDlg"),la=$("#aLat").value,ln=$("#aLng").value;$("#addCoord").textContent=la&&ln?la+", "+ln:"";if(note!==undefined)setNote(note);$("#reopenAdd").classList.add("hide");if(!d.open)d.showModal()}
/* إلغاء النموذج: تأكيد إن كانت هناك بيانات مُدخلة (الإحداثيات وحدها لا تُعدّ، فهي تُعبّأ بالنقر على الخريطة) */
function addDirty(){if(["aO","aS","aN","aFam","aPer","aRisk","aStruct","aOcc"].some(i=>$("#"+i).value.trim()))return true;if(["aElems","aIndic","aProx"].some(i=>chkGet($("#"+i)).length))return true;if($("#aP").files.length||uMan)return true;
  const tg=techGet("a");return!!((tg.units_detail||[]).length||TECH.some(([,f])=>tg[f])||tg.damage_date)}
async function cancelAdd(){if(addDirty()&&!await confirmAsk("في النموذج بيانات لم تُحفظ. إغلاقه يحذفها. هل تريد الإغلاق؟",{title:"إغلاق دون حفظ",ok:"إغلاق دون حفظ",cancel:"متابعة التعبئة",danger:true}))return;$("#addDlg").close()}
$("#addCancel").onclick=cancelAdd;
/* Esc: نمنع الإغلاق ونفتح التأكيد في المهمة التالية (فتح حوار مودال من داخل حدث cancel نفسه يتعارض مع معالجة المتصفح لـ Esc) */
$("#addDlg").addEventListener("cancel",e=>{if(addDirty()){e.preventDefault();setTimeout(cancelAdd,0)}});
$("#addDlg").addEventListener("close",()=>$("#reopenAdd").classList.toggle("hide",!($("#aLat").value&&$("#aLng").value)));
$("#reopenAdd").onclick=()=>openAdd();
/* سجلات (ومسودات) لا تقع داخل أي بصمة مرجعية: تُرسم بلون درجة الضرر كي تتلوّن الخريطة فور الحفظ */
let docL=null;
function drawDocs(){if(!pickMap)return;docL&&pickMap.removeLayer(docL);docL=null;
  const inRef=new Set();(REFHIT||[]).forEach(a=>a.forEach(c=>inRef.add(c.id)));
  const v=recs.filter(c=>c.status!=="rejected"&&isFinite(c.lat)&&isFinite(c.lng)&&!inRef.has(c.id));if(!v.length)return;
  docL=L.layerGroup(v.map(c=>{const col=riskCol(c.risk_level),
    l=c.geom&&/Polygon/.test(c.geom.type||"")?L.geoJSON(c.geom,{style:{color:"#fff",weight:1.5,fillColor:col,fillOpacity:.7}}):L.circleMarker([c.lat,c.lng],{radius:7,color:"#fff",weight:1.5,fillColor:col,fillOpacity:.9});
    l.on("click",ev=>{if(busy)return;L.DomEvent.stopPropagation(ev);docPopup(ev.latlng,{geometry:null,properties:{}},[c])});return l})).addTo(pickMap)}
function setPt(lat,lng,keep){$("#aLat").value=lat.toFixed(6);$("#aLng").value=lng.toFixed(6);const p=[lat,lng];pickMk?pickMk.setLatLng(p):pickMk=L.marker(p).addTo(pickMap);if(!keep)pickMap.setView(p,Math.max(pickMap.getZoom(),18))}
function clearShape(){dFG&&dFG.clearLayers();selL&&pickMap.removeLayer(selL);selL=null;drawn=null;areaM=null;perimM=null;areaTxt();autoU()}
function centroid(p){const ox=p[0][0],oy=p[0][1];let a=0,x=0,y=0;   /* الإحداثيات نسبية لأول نقطة لتفادي خطأ التقريب مع الإحداثيات الكبيرة */
  for(let i=0;i<p.length-1;i++){const X0=p[i][0]-ox,Y0=p[i][1]-oy,X1=p[i+1][0]-ox,Y1=p[i+1][1]-oy,f=X0*Y1-X1*Y0;a+=f;x+=(X0+X1)*f;y+=(Y0+Y1)*f}
  if(!a){const n=Math.max(1,p.length-1);return[p.slice(0,n).reduce((s,q)=>s+q[0],0)/n,p.slice(0,n).reduce((s,q)=>s+q[1],0)/n]}return[ox+x/(3*a),oy+y/(3*a)]}
/* ====== نقطة داخل المبنى: قطب عدم الوصول (Polylabel) ======
   أبعد نقطة داخل البصمة عن كل حدودها (مع مراعاة الفتحات/الأفنية)، فتقع دائماً داخل الهيكل
   حتى في مباني L وU، ولا تتداخل مع الشارع أو المبنى المجاور. المسافات مقيسة بعد تصحيح خط العرض. */
function polyLabel(rings,prec){
  const k=Math.cos(rings[0][0][1]*Math.PI/180)||1,P=rings.map(r=>r.map(q=>[q[0]*k,q[1]]));prec=prec||2e-7;
  const segD=(px,py,a,b)=>{let x=a[0],y=a[1],dx=b[0]-x,dy=b[1]-y;if(dx||dy){const t=((px-x)*dx+(py-y)*dy)/(dx*dx+dy*dy);if(t>1){x=b[0];y=b[1]}else if(t>0){x+=dx*t;y+=dy*t}}dx=px-x;dy=py-y;return dx*dx+dy*dy};
  const sd=(px,py)=>{let ins=false,m=Infinity;for(const r of P)for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>py)!==(b[1]>py)&&px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0])ins=!ins;m=Math.min(m,segD(px,py,a,b))}return(ins?1:-1)*Math.sqrt(m)};
  const mk=(x,y,h)=>{const d=sd(x,y);return{x,y,h,d,max:d+h*Math.SQRT2}};
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const q of P[0]){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1])}
  const w=x1-x0,hh=y1-y0,cs=Math.min(w,hh);if(!cs)return[x0/k,y0];
  const Q=[],push=c=>{Q.push(c);let i=Q.length-1;while(i>0){const p=(i-1)>>1;if(Q[p].max>=Q[i].max)break;[Q[p],Q[i]]=[Q[i],Q[p]];i=p}},
    pop=()=>{const t=Q[0],l=Q.pop();if(Q.length){Q[0]=l;let i=0;for(;;){const a=2*i+1,b=a+1;let m=i;if(a<Q.length&&Q[a].max>Q[m].max)m=a;if(b<Q.length&&Q[b].max>Q[m].max)m=b;if(m===i)break;[Q[m],Q[i]]=[Q[i],Q[m]];i=m}}return t};
  let h=cs/2;for(let x=x0;x<x1;x+=cs)for(let y=y0;y<y1;y+=cs)push(mk(x+h,y+h,h));
  const cc=centroid(P[0]);let best=mk(cc[0],cc[1],0);const bb=mk(x0+w/2,y0+hh/2,0);if(bb.d>best.d)best=bb;
  for(let n=0;Q.length&&n<20000;n++){const c=pop();if(c.d>best.d)best=c;if(c.max-best.d<=prec)continue;h=c.h/2;push(mk(c.x-h,c.y-h,h));push(mk(c.x+h,c.y-h,h));push(mk(c.x-h,c.y+h,h));push(mk(c.x+h,c.y+h,h))}
  return best.d>0?[best.x/k,best.y]:[cc[0]/k,cc[1]]}
const innerPt=r=>polyLabel([r]);
const shoe=r=>Math.abs(r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-q[0]*p[1]},0));
const geomPt=g=>{const P=!g?null:g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:null;
  if(!P||!P.length||!P[0][0]||P[0][0].length<4)return null;return polyLabel(P.reduce((a,b)=>shoe(b[0])>shoe(a[0])?b:a))};
const perim=r=>{let s=0;for(let i=0;i<r.length-1;i++)s+=hav(r[i][1],r[i][0],r[i+1][1],r[i+1][0]);return Math.round(s)};
const gArea=ring=>Math.round(L.GeometryUtil.geodesicArea(ring.map(q=>({lat:q[1],lng:q[0]}))));
function setShape(l){const pts=l.getLatLngs()[0].map(q=>[q.lng,q.lat]);pts.push(pts[0]);drawn={type:"Polygon",coordinates:[pts]};areaM=gArea(pts.slice(0,-1));perimM=perim(pts);const c=innerPt(pts);setPt(c[1],c[0],true);autoU();areaTxt()}
function initDraw(){L.GeometryUtil.readableArea=a=>a>=1e4?(a/1e4).toFixed(2)+" هكتار":Math.round(a)+" م²";
  try{const D=L.drawLocal;D.draw.toolbar.buttons.polygon="ارسم محيط المبنى (مضلع)";D.draw.toolbar.buttons.rectangle="ارسم مستطيلاً";D.draw.toolbar.actions.title="إلغاء الرسم";D.draw.toolbar.actions.text="إلغاء";D.draw.toolbar.finish.title="إنهاء الرسم";D.draw.toolbar.finish.text="إنهاء";D.draw.toolbar.undo.title="حذف آخر نقطة";D.draw.toolbar.undo.text="حذف آخر نقطة";
    D.draw.handlers.polygon.tooltip={start:"انقر لبدء رسم محيط المبنى",cont:"انقر لإضافة نقطة",end:"انقر على النقطة الأولى لإغلاق الشكل"};D.draw.handlers.rectangle.tooltip.start="اضغط واسحب لرسم مستطيل";D.draw.handlers.simpleshape.tooltip.end="اترك لإنهاء الرسم";
    D.edit.toolbar.buttons.edit="تعديل رؤوس الشكل";D.edit.toolbar.buttons.remove="حذف الرسم";D.edit.toolbar.actions.save={title:"حفظ التعديلات",text:"حفظ"};D.edit.toolbar.actions.cancel={title:"تراجع",text:"تراجع"};D.edit.toolbar.actions.clearAll={title:"حذف الكل",text:"حذف الكل"};
    D.edit.handlers.edit.tooltip={text:"اسحب النقاط لتعديل الشكل",subtext:"اضغط «تراجع» للإلغاء"};D.edit.handlers.remove.tooltip.text="اضغط على الشكل لحذفه"}catch{}
  dFG=L.featureGroup().addTo(pickMap);const sh={color:"#f2b705",weight:2};
  pickMap.addControl(new L.Control.Draw({draw:{polygon:{allowIntersection:false,showArea:true,metric:true,shapeOptions:sh},rectangle:{showArea:true,metric:true,shapeOptions:sh},polyline:false,circle:false,marker:false,circlemarker:false},edit:{featureGroup:dFG}}));
  const E=L.Draw.Event;
  pickMap.on("click",e=>{if(busy)return;clearShape();resetAddForm();setPt(e.latlng.lat,e.latlng.lng,true);openAdd()});
  pickMap.on(E.DRAWSTART+" "+E.EDITSTART+" "+E.DELETESTART,()=>busy=true);
  pickMap.on(E.DRAWSTOP+" "+E.EDITSTOP+" "+E.DELETESTOP,()=>setTimeout(()=>busy=false,80));
  pickMap.on(E.CREATED,e=>{clearShape();resetAddForm();dFG.addLayer(e.layer);setShape(e.layer);openAdd()});
  pickMap.on(E.EDITED,e=>{e.layers.eachLayer(setShape);openAdd()});
  pickMap.on(E.DELETED,()=>{if(!dFG.getLayers().length)clearShape()})}
$("#gps").onclick=()=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>{clearShape();resetAddForm();setPt(p.coords.latitude,p.coords.longitude);openAdd()},()=>toast("تعذّر تحديد الموقع. اسمح للمتصفح بالوصول إليه أو انقر على الخريطة.")):0;
async function shrink(f){const b=await createImageBitmap(f),k=Math.min(1,1280/Math.max(b.width,b.height)),c=document.createElement("canvas");c.width=b.width*k;c.height=b.height*k;c.getContext("2d").drawImage(b,0,0,c.width,c.height);return new Promise(r=>c.toBlob(r,"image/jpeg",.8))}
const bad=m=>$("#addMsg").innerHTML='<div class="msg">'+esc(m)+"</div>";
$("#save").onclick=async()=>{const owner=$("#aO").value.trim(),lat=+$("#aLat").value,lng=+$("#aLng").value;
  if(!owner)return bad("أدخل اسم المالك أو المخيم أو المرفق.");
  const assessor=ME_NAME;if(!assessor)return bad("تعذّر التحقق من اسم حسابك. أعد تسجيل الدخول ثم حاول مجدداً.");
  if(!$("#aD").value)return bad("لا يوجد حي معيَّن لك. تواصل مع المدير.");
  if(!$("#aUse").value)return bad("اختر نوع الاستخدام.");
  if(!$("#aLat").value||!$("#aLng").value)return bad("حدّد الموقع بالنقر على الخريطة أو بزر الموقع الحالي.");
  if(!(lat>=BB.la[0]&&lat<=BB.la[1]&&lng>=BB.ln[0]&&lng<=BB.ln[1]))return bad("الإحداثيات خارج نطاق قطاع غزة. تحقق من خط العرض والطول.");
  const tg=techGet("a"),tm=techCheck(tg);if(tm)return bad(tm);
  const fl=Math.max(1,+$("#aQ").value||1),risk=$("#aRisk").value,reco=chkGet($("#aReco"));
  if(!RISK[risk])return bad("حدّد مستوى الخطورة الإنشائية.");
  if(!$("#aStruct").value)return bad("حدّد نوع الهيكل الإنشائي.");
  if(!$("#aOcc").value)return bad("حدّد حالة الإشغال (مأهول، مأهول جزئياً، مهجور).");
  if(risk!=="safe"&&!reco.length)return bad("اختر توصية هندسية واحدة على الأقل لمبنى غير آمن.");
  if(risk==="critical"&&$("#aOcc").value!=="vacant"&&!reco.includes("evacuate")&&!await confirmAsk("المبنى بخطورة داهمة وما زال مأهولاً، ولم تُختر توصية «إخلاء عاجل». متابعة الحفظ؟",{title:"تحقق من التوصية",ok:"حفظ رغم ذلك",cancel:"رجوع"}))return;
  if(areaM>0&&areaM<15&&fl>3)toast("تنبيه: بصمة صغيرة جداً مع عدد طوابق كبير نسبياً — تحقق من القيم (لن يمنع الحفظ).","warn");
  $("#save").disabled=true;$("#addMsg").innerHTML="";
  const blobs=[];for(const f of [...$("#aP").files].slice(0,5)){try{const b=await shrink(f);if(b)blobs.push(b)}catch{toast("تعذّر تجهيز إحدى الصور.")}}
  const d={uid:me.id,at:new Date().toISOString(),blobs,done:[],payload:{id:crypto.randomUUID(),type:$("#aT").value,owner,assessor_name:assessor,qty:fl,grade:$("#aG").value||null,district:$("#aD").value,district_code:distCodeOf(distMain($("#aD").value)),subdistrict_code:DIST_PARENT_OF[$("#aD").value]?distCodeOf($("#aD").value):null,usage_type:$("#aUse").value,gov_category:$("#aUse").value==="gov"?($("#aGov").value||null):null,street:$("#aS").value.trim(),lat,lng,notes:$("#aN").value.trim(),
    risk_level:risk,structure_type:$("#aStruct").value,damaged_elements:chkGet($("#aElems")),damage_indicators:chkGet($("#aIndic")),occupancy:$("#aOcc").value,proximity:chkGet($("#aProx")),recommendations:reco,
    fam:+$("#aFam").value||null,per:+$("#aPer").value||null,source:$("#aSrc").value,geom:drawn,area_m2:areaM,units:HOUS.has($("#aT").value)&&$("#aU").value!==""?+$("#aU").value:null,...Object.fromEntries(Object.entries(tg).filter(([,x])=>x!=null))}};
  await finishSave(d)};
