/* ================================================================
   admin.js — جلب كل الصفوف، النسخ الاحتياطي، وإدارة المستخدمين
   ================================================================ */
/* ---- جلب كل الصفوف (الحد الأقصى للطلب الواحد 1000) ---- */
async function fetchAll(tbl,ord="created_at"){const out=[];
  for(let i=0;;i+=1000){const {data,error}=await sb.from(tbl).select("*").order(ord,{ascending:false}).order("id").range(i,i+999);
    if(error)return{error,data:out};out.push(...data);if(data.length<1000)break}
  return{data:out}}
/* ---- النسخ الاحتياطي (للمدير) ---- */
const pgArr=a=>"{"+a.map(x=>'"'+String(x).replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'"').join(",")+"}";
const sqlv=v=>v==null?"null":Array.isArray(v)?"'"+pgArr(v).replace(/'/g,"''")+"'":typeof v==="object"?"'"+JSON.stringify(v).replace(/'/g,"''")+"'::jsonb":typeof v==="number"||typeof v==="boolean"?String(v):"'"+String(v).replace(/'/g,"''")+"'";
const showLastBk=async()=>{const d=await kvGet("lastBk");$("#bkLast").textContent=d?"آخر نسخة نزّلتها من هذا الجهاز: "+fmt(d)+(Date.now()-new Date(d)>7*864e5?" — مضى أكثر من أسبوع، نزّل نسخة جديدة.":""):"لم تنزّل أي نسخة من هذا الجهاز بعد."};
const bkDone=()=>{kvSet("lastBk",new Date().toISOString());showLastBk()};
async function backupJSON(){toast("جارٍ تجهيز النسخة…");const [r,p,l]=await Promise.all([fetchAll("gz_records"),fetchAll("gz_profiles"),fetchAll("gz_ref_layers","uploaded_at")]);
  const er=r.error||p.error||l.error;if(er)return toast("تعذّر جلب البيانات: "+er.message);
  dl("backup-"+ymd(new Date())+".json",JSON.stringify({app:"dbas-gaza",exported_at:new Date().toISOString(),counts:{records:r.data.length,profiles:p.data.length,ref_layers:l.data.length},gz_records:r.data,gz_profiles:p.data,gz_ref_layers:l.data}),"application/json");
  bkDone();toast(`تم تنزيل نسخة JSON: ${r.data.length} سجل، ${p.data.length} مستخدم.`)}
async function backupSQL(){toast("جارٍ تجهيز النسخة…");const {data,error}=await fetchAll("gz_records");if(error)return toast("تعذّر جلب البيانات: "+error.message);
  if(!data.length)return toast("لا توجد سجلات لنسخها.");const cols=Object.keys(data[0]),out=["-- Dangerous Buildings Assessment System (DBAS): data-only backup of gz_records","-- Restore inside the SAME Supabase project (rows reference existing user ids). Generated "+new Date().toISOString(),""];
  for(let i=0;i<data.length;i+=200)out.push("insert into public.gz_records ("+cols.join(", ")+") values\n"+data.slice(i,i+200).map(r=>"("+cols.map(c=>sqlv(r[c])).join(", ")+")").join(",\n")+"\non conflict (id) do nothing;\n");
  dl("backup-records-"+ymd(new Date())+".sql",out.join("\n"),"application/sql");bkDone();toast(`تم تنزيل نسخة SQL: ${data.length} سجل.`)}
async function backupPhotos(){if(typeof JSZip==="undefined")return toast("مكتبة الضغط لم تُحمَّل. تحقق من الاتصال وأعد المحاولة.");
  const {data,error}=await fetchAll("gz_records");if(error)return toast("تعذّر جلب البيانات: "+error.message);
  const paths=[...new Set(data.flatMap(r=>r.photos||[]))];if(!paths.length)return toast("لا توجد صور لنسخها.");
  if(!await confirmAsk(`تنزيل ${paths.length} صورة في ملف ZIP؟ قد يستغرق وقتاً ويستهلك ذاكرة المتصفح، فلا تغلق الصفحة.`,{title:"نسخة الصور",ok:"تنزيل"}))return;
  const z=new JSZip();let n=0,fail=0;
  for(let i=0;i<paths.length;i+=5){await Promise.all(paths.slice(i,i+5).map(async p=>{const {data:b,error:e}=await sb.storage.from("gz-photos").download(p);e||!b?fail++:z.file(p,b);n++}));toast(`جارٍ التنزيل… ${n} / ${paths.length}`)}
  const blob=await z.generateAsync({type:"blob",compression:"STORE"});dl("photos-"+ymd(new Date())+".zip",blob,"application/zip");
  bkDone();toast(fail?`تم تنزيل ${paths.length-fail} صورة، وتعذّر ${fail}.`:`تم تنزيل ${paths.length} صورة.`)}
$("#bkJ").onclick=backupJSON;$("#bkS").onclick=backupSQL;$("#bkP").onclick=backupPhotos;
/* ---- المستخدمون (للمدير) — المرحلة 4: حالات أربع، شارات، فلاتر سريعة، إجراءات فردية/جماعية مع تأكيد وتدقيق ---- */
let UF="all",UQ="",URF="",USF="",USEL=new Set();
const maskEmail=e=>{e=String(e||"");const i=e.indexOf("@");return i<2?e:e.slice(0,2)+"***"+e.slice(i)};
const scopeBadges=ds=>(ds||[]).map(d=>`<span class="badge sm" title="${esc(d)}">${esc(DIST_CODE[d]||d)}</span>`).join(" ")||'<span class="hint">غير معيّن</span>';
function uRows(){let r=USERS;
  if(UF!=="all")r=r.filter(u=>ustatOf(u)===UF);
  if(URF)r=r.filter(u=>u.role===URF);
  if(USF)r=r.filter(u=>(u.districts||[]).includes(USF));
  if(UQ){const q=UQ.toLowerCase();r=r.filter(u=>(u.full_name||"").toLowerCase().includes(q)||(u.email||"").toLowerCase().includes(q))}
  return r}
async function loadUsers(){showLastBk();const {data}=await sb.from("gz_profiles").select("*").order("created_at",{ascending:false});USERS=data||[];
  for(const id of [...USEL])if(!USERS.some(u=>u.id===id))USEL.delete(id);
  const n=k=>k==="all"?USERS.length:USERS.filter(u=>ustatOf(u)===k).length;
  $("#uCount").textContent=`${USERS.length} مستخدمين · ${n("active")} نشطون · ${n("pending")} بانتظار الموافقة · ${n("suspended")} موقوفون`;
  $("#uTabs").innerHTML=[["all","الكل"],["active","النشطون"],["pending","قيد الانتظار"],["suspended","الموقوفون"]].map(([k,l])=>`<button type="button" class="btn sm${UF===k?" pri":""}" data-uf="${k}">${l} (${n(k)})</button>`).join("");
  $("#uRoleF").innerHTML=`<option value="">كل الأدوار</option>`+Object.entries(ROLE).map(([k,v])=>`<option value="${k}" ${URF===k?"selected":""}>${v}</option>`).join("");
  $("#uScopeF").innerHTML=`<option value="">كل النطاقات</option>`+DISTS.map(d=>`<option value="${esc(d)}" ${USF===d?"selected":""}>${esc(d)}</option>`).join("");
  const rows=uRows();
  $("#urows").innerHTML=rows.map(u=>{const st=ustatOf(u),[sl,sc,si]=USTAT[st]||USTAT.pending;
    return`<tr style="cursor:default${st==="pending"?";background:#fff8e1":""}">
    <td><input type="checkbox" class="usel" value="${esc(u.id)}" ${USEL.has(u.id)?"checked":""} aria-label="تحديد"></td>
    <td>${esc(u.full_name)||"—"}</td><td dir="ltr" title="${esc(u.email||"")}">${esc(maskEmail(u.email))}</td>
    <td><select data-upd="role" data-id="${esc(u.id)}" aria-label="الدور">${Object.entries(ROLE).map(([k,v])=>`<option value="${k}" ${u.role===k?"selected":""}>${v}</option>`).join("")}</select></td>
    <td><span class="badge" style="--c:${sc}">${si} ${sl}</span></td>
    <td>${u.created_at?fmt(u.created_at):"—"}</td>
    <td>${u.approved_at?fmt(u.approved_at)+(u.approved_by?" / "+esc(NAMES[u.approved_by]||""):""):"—"}</td>
    <td>${u.role==="collector"?`<button class="btn sm" type="button" data-act="dist" data-id="${esc(u.id)}">${scopeBadges(u.districts)}</button>`:"كل المناطق"}</td>
    <td>${u.last_activity_at?fmt(u.last_activity_at):"—"}</td>
    <td class="row" style="gap:4px;flex-wrap:wrap">
      ${st==="pending"?`<button class="btn sm pri" type="button" data-uact="approve" data-id="${esc(u.id)}">موافقة</button><button class="btn sm bad" type="button" data-uact="reject" data-id="${esc(u.id)}">رفض</button>`:""}
      ${st==="active"?`<button class="btn sm" type="button" data-uact="suspend" data-id="${esc(u.id)}">إيقاف</button>`:""}
      ${st==="suspended"?`<button class="btn sm" type="button" data-uact="reactivate" data-id="${esc(u.id)}">إعادة تفعيل</button>`:""}
      ${me.role==="admin"?`<button class="btn sm" type="button" data-act="perms" data-id="${esc(u.id)}">صلاحيات المراقبة</button>`:""}
    </td></tr>`}).join("")}
$("#uTabs").onclick=e=>{const b=e.target.closest("[data-uf]");if(b){UF=b.dataset.uf;loadUsers()}};
$("#uQ").oninput=()=>{UQ=$("#uQ").value;loadUsers()};$("#uRoleF").onchange=()=>{URF=$("#uRoleF").value;loadUsers()};$("#uScopeF").onchange=()=>{USF=$("#uScopeF").value;loadUsers()};
$("#urows").addEventListener("change",async e=>{
  if(e.target.classList.contains("usel")){e.target.checked?USEL.add(e.target.value):USEL.delete(e.target.value);return}
  const k=e.target.dataset.upd,id=e.target.dataset.id;if(!k||!id)return;
  if(id===me.id&&k==="role"&&e.target.value!=="admin"){if(!await confirmAsk("أنت تغيّر دور حسابك أنت، وقد تفقد الوصول إلى صفحة الإدارة. متابعة؟",{danger:true})){loadUsers();return}}
  const old=USERS.find(x=>x.id===id);await upd(id,{role:e.target.value});await logAudit("gz_profiles",id,"role",old&&old.role,e.target.value);loadUsers()});
$("#urows").addEventListener("click",async e=>{const b=e.target.closest("[data-uact]");if(!b)return;const id=b.dataset.id,act=b.dataset.uact,u=USERS.find(x=>x.id===id);if(!u)return;
  if(act==="approve")return approveDlg(id);
  if(act==="reject"){const reason=await promptAsk("سبب الرفض:",{title:"رفض الحساب"});if(reason==null)return;
    if(!await confirmAsk(`رفض حساب ${esc(u.full_name||u.email||"")}؟`,{danger:true}))return;
    await upd(id,{status:"rejected",rejected_reason:reason});await logAudit("gz_profiles",id,"status","pending","rejected");loadUsers();return}
  if(act==="suspend"){if(!await confirmAsk(`إيقاف حساب ${esc(u.full_name||u.email||"")}؟ لن يستطيع الدخول حتى تُعاد تفعيله.`,{danger:true}))return;
    await upd(id,{status:"suspended"});await logAudit("gz_profiles",id,"status","active","suspended");loadUsers();return}
  if(act==="reactivate"){if(!await confirmAsk(`إعادة تفعيل حساب ${esc(u.full_name||u.email||"")}؟`))return;
    await upd(id,{status:"active"});await logAudit("gz_profiles",id,"status","suspended","active");loadUsers();return}});
function approveDlg(id){const u=USERS.find(x=>x.id===id);if(!u)return;
  $("#dlg").innerHTML=`<h3 style="margin-top:0">موافقة على حساب: ${esc(u.full_name||u.email||"")}</h3><div class="f">
    <div><label for="apRole">الدور</label><select id="apRole">${Object.entries(ROLE).map(([k,v])=>`<option value="${k}" ${u.role===k?"selected":""}>${v}</option>`).join("")}</select></div></div>
    <p class="hint">حدِّد نطاق العمل بعد الموافقة من زر «نطاق العمل» في الجدول إن كان الدور «جامع بيانات».</p>
    <div class="row" style="margin-top:12px"><button class="btn pri" id="apSave">موافقة وتفعيل</button><button class="btn" type="button" data-act="close">إلغاء</button></div>`;
  $("#apSave").onclick=async()=>{await upd(id,{role:$("#apRole").value,status:"active",approved_at:new Date().toISOString(),approved_by:me.id});
    await logAudit("gz_profiles",id,"status","pending","active");$("#dlg").close();toast("تم تفعيل الحساب.");loadUsers()};
  $("#dlg").showModal()}
/* نطاق العمل: اختيار متعدد من التسلسل الهرمي (رئيسي يشمل فروعه تلقائياً في myD، ويمكن اختيار فرعي بمفرده) — المرحلة 4.2 */
function distDlg(id){const u=USERS.find(x=>x.id===id);if(!u)return;const cur=u.districts||[];
  $("#dlg").innerHTML=`<h3 style="margin-top:0">نطاق عمل: ${esc(u.full_name||"")}</h3><p class="hint">سيرى هذا المهندس سجلات هذه الأحياء فقط (اختيار حي رئيسي يشمل مناطقه الفرعية تلقائياً)، ولا يستطيع التسجيل خارجها. يُفرض النطاق فعلياً على مستوى RLS في قاعدة البيانات.</p>
  <div class="f">${DISTRICT_TREE.map(d=>`<div class="w"><label style="margin:0;font-weight:700"><input type="checkbox" class="dz" value="${esc(d.name)}" ${cur.includes(d.name)?"checked":""} style="width:auto"> ${esc(d.name)} <span class="hint">(${d.code})</span></label>
    ${d.subs.length?`<div style="padding-inline-start:22px">${d.subs.map(s=>`<label style="margin:2px 0 0;display:block"><input type="checkbox" class="dz" value="${esc(s.name)}" ${cur.includes(s.name)?"checked":""} style="width:auto"> ${esc(s.name)} <span class="hint">(${s.code})</span></label>`).join("")}</div>`:""}</div>`).join("")}</div>
  <div class="row" style="margin-top:12px"><button class="btn pri" id="dzSave">حفظ</button><button class="btn" type="button" data-act="close">إلغاء</button></div>`;
  $("#dzSave").onclick=async()=>{const v=[...document.querySelectorAll(".dz:checked")].map(c=>c.value),old=u.districts,{error}=await sb.from("gz_profiles").update({districts:v}).eq("id",id);
    if(error)return toast(error.message);await logAudit("gz_profiles",id,"districts",old,v);$("#dlg").close();toast("تم حفظ النطاق.");loadUsers()};
  $("#dlg").showModal()}
/* صلاحيات وحدة المراقبة الخمس — المدير الأعلى فقط، كل واحدة مستقلة، مع تدقيق لكل منح/سحب — المرحلة 4.5 */
function permsDlg(id){if(me.role!=="admin")return;const u=USERS.find(x=>x.id===id);if(!u)return;
  $("#dlg").innerHTML=`<h3 style="margin-top:0">صلاحيات المراقبة: ${esc(u.full_name||u.email||"")}</h3><div class="f">${MON_PERMS.map(([k,l])=>`<label class="w" style="margin:0"><input type="checkbox" class="pm" data-k="${k}" ${u[k]?"checked":""} style="width:auto"> ${l}</label>`).join("")}</div>
  <div class="row" style="margin-top:12px"><button class="btn pri" id="pmSave">حفظ</button><button class="btn" type="button" data-act="close">إلغاء</button></div>`;
  $("#pmSave").onclick=async()=>{const v={};document.querySelectorAll(".pm").forEach(c=>v[c.dataset.k]=c.checked);
    const {error}=await sb.from("gz_profiles").update(v).eq("id",id);if(error)return toast(error.message);
    for(const[k]of MON_PERMS)if(!!u[k]!==!!v[k])await logAudit("gz_profiles",id,k,!!u[k],!!v[k]);
    $("#dlg").close();toast("تم حفظ الصلاحيات.");loadUsers()};
  $("#dlg").showModal()}
async function bulkUserAction(act){if(!USEL.size)return toast("لم تُحدَّد أي حسابات.");
  const ids=[...USEL],label={approve:"الموافقة على",suspend:"إيقاف",reactivate:"إعادة تفعيل"}[act];
  if(!await confirmAsk(`${label} ${ids.length} حساب؟`,{danger:act==="suspend"}))return;
  for(const id of ids){const u=USERS.find(x=>x.id===id);if(!u)continue;
    if(act==="approve"&&ustatOf(u)==="pending"){await upd(id,{status:"active",approved_at:new Date().toISOString(),approved_by:me.id});await logAudit("gz_profiles",id,"status","pending","active")}
    if(act==="suspend"&&ustatOf(u)==="active"){await upd(id,{status:"suspended"});await logAudit("gz_profiles",id,"status","active","suspended")}
    if(act==="reactivate"&&ustatOf(u)==="suspended"){await upd(id,{status:"active"});await logAudit("gz_profiles",id,"status","suspended","active")}}
  USEL.clear();toast("تم تنفيذ الإجراء الجماعي.");loadUsers()}
document.addEventListener("click",e=>{const b=e.target.closest("[data-bulku]");if(b)bulkUserAction(b.dataset.bulku)});
async function upd(id,v){const {error}=await sb.from("gz_profiles").update(v).eq("id",id);if(error)toast("تعذّر التحديث: "+error.message);else toast("تم تحديث المستخدم.")}
