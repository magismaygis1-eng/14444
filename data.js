/* ================================================================
   data.js — التنقل بين الأقسام، تحميل السجلات، الفلاتر والبحث
   ================================================================ */
function show(v){cur=v;
  document.querySelectorAll("main>section").forEach(s=>s.classList.toggle("hide",s.id!==v));
  document.querySelectorAll("#nav button").forEach(b=>{const on=b.dataset.v===v;b.classList.toggle("on",on);on?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current")});
  $("#filters").classList.toggle("hide",!["dash","list","mapv","spat"].includes(v));
  if(v==="add")initPick();if(v==="users")loadUsers();if(v==="monitor")monInit();if(v==="spat")spInit();if(v!=="add")scrollTo({top:0});refresh()}
$("#nav").onclick=e=>{const b=e.target.closest("button[data-v]");if(b)show(b.dataset.v)};
const FIDS=["fRisk","fStruct","fElem","fOcc","fDist","fSub","fSt"];
/* فلتر الأحياء المتسلسل (المرحلة 2.4): تغيير الحي الرئيسي يعيد تعبئة المناطق الفرعية التابعة له */
function fSubRefresh(){const main=$("#fDist").value,subs=main?subsOf(main):[],sel=$("#fSub");
  sel.closest(".fitem")?.classList.toggle("hide",!subs.length);
  if(!subs.length){sel.value="";opts(sel,"كل المناطق",[]);return}
  const cur=sel.value;opts(sel,"كل المناطق",subs.map(s=>[s,s]));if(subs.includes(cur))sel.value=cur}
$("#fDist").addEventListener("input",fSubRefresh);
function filterUI(){let n=0;FIDS.forEach(i=>{const on=!!$("#"+i).value;$("#"+i).classList.toggle("set",on);n+=on});const q=$("#q").value.trim()&&!isCoord($("#q").value);$("#fCount").textContent=n||q?`${n+(q?1:0)} فلتر نشط · ${NF(view().length)} من ${NF(recs.length)} سجل`:""}
function refresh(){filterUI();cur==="dash"?dash():cur==="list"?table():cur==="mapv"?drawMap():cur==="spat"?spRun():0}
async function load(){
  if(!inFlush&&navigator.onLine&&!OFFMODE&&me&&await hasPending()){const s=await syncAll();if(s&&s.loaded)return}
  const {data,error}=await fetchAll("gz_records");
  if(error){const c=me&&await kvGet("recs:"+me.id);if(c&&isNet(error)){SRV=c;OFFDATA=true;toast("وضع غير متصل: تُعرض بيانات محفوظة على جهازك.")}else{SRV=[];toast("تعذّر تحميل السجلات: "+error.message)}}
  else{SRV=data;OFFDATA=false;kvPut("recs:"+me.id,data);kvPut("recsAt:"+me.id,Date.now())}
  if(isAll()){const cur=$("#fDist").value,ex=[...new Set(SRV.map(c=>distMain(c.district)))].filter(d=>!DIST_MAIN.includes(d));opts($("#fDist"),"كل الأحياء",[...DIST_MAIN,...ex].map(d=>[d,d]));$("#fDist").value=cur;fSubRefresh()}
  rebuild()}
FIDS.forEach(i=>$("#"+i).addEventListener("input",refresh));let qT;$("#q").addEventListener("input",()=>{clearTimeout(qT);qT=setTimeout(refresh,180)});
/* حقل البحث الذكي في الهيدر: اسم/معرّف يصفّي السجلات، وإحداثيات (Lat/Lng أو UTM) تنقل الخريطة فوراً */
const coordLike=t=>/[\d٠-٩][.,٫][\d٠-٩]|[\d٠-٩]{5,}/.test(String(t));
function isCoord(t){t=String(t||"").trim();return!!t&&coordLike(t)&&!!parseCoord(t)}
function gsSync(){const v=$("#q").value;$(".gsx").classList.toggle("hide",!v);$(".gs").classList.toggle("geo",isCoord(v))}
$("#q").addEventListener("input",gsSync);
$("#q").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();const v=e.target.value.trim();if(!v)return;if(isCoord(v))coordGo(v);else if(!["dash","list","mapv","spat"].includes(cur))show("list")}
  else if(e.key==="Escape"&&e.target.value){e.target.value="";gsSync();refresh()}});
$("#q").addEventListener("paste",()=>setTimeout(()=>{const v=$("#q").value.trim();if(isCoord(v)){gsSync();coordGo(v)}},0));
$(".gsx").onclick=()=>{$("#q").value="";gsSync();refresh();$("#q").focus()};

$("#fClr").onclick=()=>{["q",...FIDS].forEach(i=>$("#"+i).value="");DQ_ONLY=false;fSubRefresh();gsSync();refresh()};
function view(){const q=(v=>isCoord(v)?"":v.toLowerCase())($("#q").value.trim()),rk=$("#fRisk").value,stc=$("#fStruct").value,el=$("#fElem").value,oc=$("#fOcc").value,d=$("#fDist").value,sd=$("#fSub").value,s=$("#fSt").value;
  const stOk=c=>!s||(s==="undecided"?DANGER.has(c.risk_level)&&!c.committee_decision:s.startsWith("d:")?c.committee_decision===s.slice(2):c.status===s);
  return recs.filter(c=>(!q||c.owner.toLowerCase().includes(q)||(c.assessor_name||"").toLowerCase().includes(q)||rid(c).toLowerCase().includes(q)||(Array.isArray(c.units_detail)&&c.units_detail.some(u=>(u.name||"").toLowerCase().includes(q))))
    &&(!rk||(rk==="danger"?DANGER.has(c.risk_level):rk==="alert"?alertOf(c):c.risk_level===rk))&&(!stc||c.structure_type===stc)&&(!el||(c.damaged_elements||[]).includes(el))&&(!oc||c.occupancy===oc)
    &&(!sd?(!d||distMain(c.district)===d):c.district===sd)&&stOk(c)&&(c.usage_type!=="gov"||canViewGov())&&(!DQ_ONLY||needsCompletion(c)))}
