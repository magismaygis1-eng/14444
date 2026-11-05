/* ================================================================
   offline.js — محرك العمل دون اتصال: IndexedDB، المسودات، طابور العمليات، المزامنة المتسلسلة، تسجيل الخروج الآمن
   ================================================================ */

/* ---- التخزين المحلي الكامل: التعديل والحذف والمراجعة تُنفَّذ محلياً فوراً وتُزامَن عند توفر الشبكة ---- */
/* الحقول التي يطبّقها «تعديل» على مسودة لم تُرفع بعد */
const FIELDS=["owner","assessor_name","type","qty","grade","district","district_code","subdistrict_code","usage_type","gov_category","street","fam","per","source","notes","units",
  "risk_level","structure_type","damaged_elements","damage_indicators","occupancy","proximity","recommendations",...V9];
const DECISION_FIELDS=["committee_decision","decision_note"];
/* الأعمدة المعروفة لحمولة سجل جديد؛ أي مفتاح آخر في مسودة يُتجاهل عند العرض والرفع بدل أن يكسر المزامنة */
const DRAFT_KEYS=new Set(["id","lat","lng","geom","area_m2",...FIELDS]);
const cleanPayload=p=>Object.fromEntries(Object.entries(p||{}).filter(([k])=>DRAFT_KEYS.has(k)));
function rebuild(){const ids=new Set(SRV.map(c=>c.id));recs=[...DRAFTV.filter(d=>!ids.has(d.id)),...SRV];CF=conflicts();markRef();refresh()}
function applyLocal(kind,ids,patch){const s=new Set(ids);SRV=kind==="delete"?SRV.filter(c=>!s.has(c.id)):SRV.map(c=>s.has(c.id)?{...c,...patch}:c);kvPut("recs:"+me.id,SRV);rebuild()}
/* ================= العمل دون اتصال (v13) ================= */
/* ---------- 1) IndexedDB ---------- */
const DB_NAME="dbasReg",DB_VER=1; // قاعدة محلية مستقلة عن المرصد (لا تتصادمان إن استُضيفتا على النطاق نفسه)
let _db=null;
function idb(){
  if(_db)return _db;
  return _db=new Promise((ok,no)=>{
    const r=indexedDB.open(DB_NAME,DB_VER);
    r.onupgradeneeded=()=>{
      const db=r.result;
      if(!db.objectStoreNames.contains("kv"))db.createObjectStore("kv");
      if(!db.objectStoreNames.contains("drafts"))db.createObjectStore("drafts",{keyPath:"id"}).createIndex("uid","uid");
      if(!db.objectStoreNames.contains("blobs"))db.createObjectStore("blobs");
      if(!db.objectStoreNames.contains("ops"))db.createObjectStore("ops",{keyPath:"seq",autoIncrement:true}).createIndex("uid","uid");
      if(!db.objectStoreNames.contains("refs"))db.createObjectStore("refs",{keyPath:"district"});
    };
    r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();_db=null};ok(db)};
    r.onerror=()=>{_db=null;no(r.error)};
    r.onblocked=()=>toast("أغلق نوافذ التطبيق الأخرى المفتوحة لإكمال تحديث التخزين المحلي.");
  });
}
const rq=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
/* يشغّل fn داخل معاملة واحدة ذرّية على مخزن أو أكثر؛ أي فشل (مثل امتلاء المساحة) يُلغي المعاملة كلها */
async function txRun(names,mode,fn){
  const db=await idb(),t=db.transaction(names,mode),
    done=new Promise((ok,no)=>{t.oncomplete=ok;t.onerror=()=>no(t.error);t.onabort=()=>no(t.error||new DOMException("aborted","AbortError"))});
  let out;
  try{out=await fn(...[].concat(names).map(n=>t.objectStore(n)))}
  catch(e){try{t.abort()}catch{}await done.catch(()=>{});throw e}
  await done;return out;
}
const kvGet=async k=>{try{return await txRun("kv","readonly",s=>rq(s.get(k)))}catch{return null}};
const kvPut=async(k,v)=>{try{await txRun("kv","readwrite",s=>{s.put(v,k)});return true}catch{return false}};
const kvSet=async(k,v)=>{if(v==null)await txRun("kv","readwrite",s=>{s.delete(k)}).catch(()=>{});else await kvPut(k,v)};

/* ---------- 2) الشبكة: فحص فعلي، تصنيف الأخطاء ---------- */
const isNet=e=>!navigator.onLine||/fetch|network|load failed|timed? ?out|offline|abort|ECONN/i.test(String(e&&(e.message||e.name||e)));
const isDup=e=>String(e&&e.statusCode)==="409"||/already exists|duplicate/i.test(String(e&&e.message));
const isAuth=(e,st)=>+st===401||+(e&&e.status)===401||/invalid jwt|jwt expired|token.*expired|PGRST301/i.test(String(e&&(e.message||e.code||"")));
const isTransient=(e,st)=>isNet(e)||+st>=500||+st===429||/overload|temporar|gateway|unavailable/i.test(String(e&&e.message||""));
const classify=(e,st)=>isAuth(e,st)?{auth:true}:isTransient(e,st)?{net:true}:{err:String(e&&e.message||e)};
/* navigator.onLine غير موثوق (واي فاي بلا إنترنت)، لذا نتحقق بطلب خفيف إلى Supabase */
async function reachable(ms=6000){
  if(!navigator.onLine)return false;
  const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
  try{const r=await fetch(CFG.url+"/auth/v1/health",{headers:{apikey:CFG.key},cache:"no-store",signal:c.signal});return r.status<500}
  catch{return false}finally{clearTimeout(t)}
}
let authLost=false;
async function ensureSession(){
  const {data:{session}}=await sb.auth.getSession();
  if(session&&session.expires_at*1000-Date.now()>30000)return true;
  const {data,error}=await sb.auth.refreshSession();
  if(!error&&data&&data.session)return true;
  return error&&isNet(error)?"net":false;
}
sb.auth.onAuthStateChange(ev=>{if(ev==="SIGNED_IN"||ev==="TOKEN_REFRESHED")authLost=false});

/* ---------- 3) المسودات (سجلات جديدة + صورها كـ Blob منفصلة) ---------- */
const fmtB=x=>x>=1048576?(x/1048576).toFixed(1)+" م.ب":Math.max(1,Math.round(x/1024))+" ك.ب";
const qGet=async uid=>{
  const a=await txRun("drafts","readonly",s=>rq(s.getAll())).catch(()=>[]);
  return(uid?a.filter(x=>x.uid===uid):a).sort((x,y)=>x.at<y.at?-1:1);
};
const qPut=d=>txRun("drafts","readwrite",s=>{s.put(d)});
const qDel=id=>txRun(["drafts","blobs"],"readwrite",(ds,bs)=>{ds.delete(id);bs.delete(IDBKeyRange.bound(id+"#",id+"#\uffff"))});
/* d = {uid,at,blobs:[Blob],done:[],payload} (نفس الشكل الذي يبنيه معالج الحفظ في v12) */
async function qAdd(d){
  try{
    const id=d.payload.id,
      photos=d.blobs.map((_,i)=>({key:id+"#"+i,done:false,path:null})).concat((d.done||[]).map(p=>({key:null,done:true,path:p})));
    await txRun(["drafts","blobs"],"readwrite",(ds,bs)=>{
      d.blobs.forEach((b,i)=>bs.put(b,id+"#"+i));
      ds.put({id,uid:d.uid,at:d.at,payload:d.payload,photos,err:null,tries:0});
    });
    await draftsUI();return true;
  }catch{return false}
}
const blobBytes=()=>txRun("blobs","readonly",s=>new Promise((ok,no)=>{
  let n=0;const c=s.openCursor();
  c.onsuccess=()=>{const x=c.result;if(!x)return ok(n);n+=(x.value&&x.value.size)||0;x.continue()};
  c.onerror=()=>no(c.error);
}));

/* ---------- 4) طابور العمليات (تعديل / حذف / مراجعة) ---------- */
const oGet=async uid=>{const a=await txRun("ops","readonly",s=>rq(s.getAll())).catch(()=>[]);return uid?a.filter(o=>o.uid===uid):a};
const oAdd=async o=>{try{await txRun("ops","readwrite",s=>{s.add({...o,uid:me.id,at:new Date().toISOString(),err:null,tries:0})});return true}catch{return false}};
const oPut=o=>txRun("ops","readwrite",s=>{s.put(o)});
const oDel=seq=>txRun("ops","readwrite",s=>{s.delete(seq)});
const hasPending=async()=>(await qGet(me.id)).some(d=>!d.err)||(await oGet(me.id)).some(o=>!o.err);

/* ---------- 5) الطبقات المرجعية: مخزن لكل حي، وتُعرض ضمن نطاق صلاحية المستخدم فقط ---------- */
const inScope=d=>isAll()||myD().includes(d);
const refSave=(uid,district,path,list)=>txRun("refs","readwrite",s=>{s.put({district,uid,path,list,at:Date.now()})});
const refLoad=async uid=>{
  const a=await txRun("refs","readonly",s=>rq(s.getAll())).catch(()=>[]);
  return Object.fromEntries(a.filter(x=>x.uid===uid).map(x=>[x.district,x]));
};
const refDrop=d=>txRun("refs","readwrite",s=>{s.delete(d)}).catch(()=>{});
const refClear=()=>txRun("refs","readwrite",s=>{s.clear()}).catch(()=>{});
function useSrvRef(layers){
  REFBYD=Object.fromEntries(Object.values(layers||{}).filter(x=>inScope(x.district)).map(x=>[x.district,x.list||[]]));
  if(cur==="dash")dash();
  if(REFSRC==="local")return;
  const a=Object.values(layers||{}).filter(x=>inScope(x.district)).flatMap(x=>x.list);
  REF=a.length?a:null;REFMAP=a.length?STD:null;REFSRC=a.length?"server":"";
  markRef(true);refStatus();if(pickMap)showRef(REF);
}
async function syncRef(){
  const {data:rows,error}=await sb.from("gz_ref_layers").select("*");
  if(error||!rows)return;
  const cache=await refLoad(me.id),keep=new Set();
  for(const r of rows){
    if(r.district===ROADS_KEY||!inScope(r.district))continue;   // طبقة الشوارع تُحمَّل في spatial.js لا كبصمات
    keep.add(r.district);
    const c=cache[r.district];
    if(c&&c.path===r.file_path)continue;                       // النسخة المحلية حديثة
    const {data:b,error:e2}=await sb.storage.from("gz-ref").download(r.file_path);
    if(e2||!b)continue;                                         // نُبقي النسخة القديمة إن فشل التنزيل
    try{
      const list=JSON.parse(r.file_path.endsWith(".gz")?await gunzip(b):await b.text());
      await refSave(me.id,r.district,r.file_path,list);
    }catch{}
  }
  for(const d of Object.keys(cache))if(!keep.has(d))await refDrop(d);   // طبقات سُحبت صلاحيتها أو حُذفت
  useSrvRef(await refLoad(me.id));
}
/* عند عودة الاتصال: هل تغيّر دوري أو نطاقي أو اعتمادي؟ */
async function refreshMe(){
  const {data}=await sb.from("gz_profiles").select("*").eq("id",me.id).single();
  if(!data)return;
  if(data.role!==me.role||data.approved!==me.approved||JSON.stringify(data.districts||[])!==JSON.stringify(me.districts||[])){
    toast("تغيّرت صلاحياتك، جارٍ تحديث التطبيق…");
    const {data:{session}}=await sb.auth.getSession();
    await kvPut("lastMe",{me:data,email:session&&session.user.email});
    boot();
  }
}

/* ---------- 6) تنفيذ العمليات: على الخادم إن أمكن، وإلا في الطابور + تطبيق محلي فوري ---------- */
async function remoteOp(kind,ids,patch,occurredAt){
  let n=0;const paths=[];
  for(let i=0;i<ids.length;i+=50){
    const ch=ids.slice(i,i+50),
      {data,error,status}=await(kind==="delete"
        ?sb.from("gz_records").delete().in("id",ch).select("id,photos")
        :sb.from("gz_records").update(patch).in("id",ch).select("id"));
    if(error)return{...classify(error,status),n};
    const got=(data||[]).length;n+=got;(data||[]).forEach(r=>paths.push(...(r.photos||[])));
    if(kind==="delete"&&got<ch.length){
      /* تكرار عملية حذف نُفّذ جزئياً: ما اختفى مسبقاً يُعدّ منفّذاً، وما بقي فسببه الصلاحيات */
      const g=await sb.from("gz_records").select("id").in("id",ch);
      if(g.error)return{...classify(g.error,g.status),n};
      n+=ch.length-got-(g.data||[]).length;
    }
  }
  for(let i=0;i<paths.length;i+=100)sb.storage.from("gz-photos").remove(paths.slice(i,i+100));
  if(n)for(const id of ids.slice(0,n))logAudit("gz_records",id,kind,null,kind==="delete"?null:patch,true,occurredAt);
  return{n};
}
async function doOp(kind,ids,patch){
  const ds=await qGet(me.id),dset=new Set(ds.map(d=>d.id)),dIds=ids.filter(i=>dset.has(i)),sIds=ids.filter(i=>!dset.has(i));
  let n=0,queued=false;
  try{
    for(const id of dIds){
      const d=ds.find(x=>x.id===id);
      if(kind==="delete")await qDel(id);
      else{for(const k of FIELDS)if(patch&&k in patch)d.payload[k]=patch[k];d.err=null;await qPut(d)}
      n++;
    }
  }catch{return{err:"تعذّر الحفظ على الجهاز (المساحة ممتلئة؟)"}}
  if(dIds.length){DSIG="";await draftsUI()}
  if(sIds.length){
    let r=null;
    if(navigator.onLine&&!OFFMODE){r=await remoteOp(kind,sIds,patch);if(r.auth)r=null}
    if(!r||r.net){
      if(!await oAdd({kind,ids:sIds,patch}))return{err:"تعذّر حفظ العملية على الجهاز (المساحة ممتلئة؟)"};
      sIds.forEach(i=>PEND.add(i));applyLocal(kind,sIds,patch);queued=true;n+=sIds.length;draftsUI();scheduleRetry();
    }else if(r.err)return{err:r.err};
    else n+=r.n;
  }
  return{n,queued};
}

/* ---------- 7) محرك المزامنة المتسلسل ---------- */
let BUSY=false,_syn=false,retryT=null,retryN=0;
const syncLocked=fn=>navigator.locks
  ?navigator.locks.request("dbas-sync",{ifAvailable:true},l=>l?fn():false)   // قفل بين تبويبات المتصفح
  :_syn?Promise.resolve(false):(_syn=true,fn().finally(()=>{_syn=false}));
function scheduleRetry(){
  clearTimeout(retryT);retryN=Math.min(retryN+1,6);
  retryT=setTimeout(goOnline,Math.min(300000,5000*3**(retryN-1)));        // 5ث، 15ث، 45ث … حتى 5 د
}
/* يرفع صور مسودة واحدة (مسار ثابت: لا تتكرر الصور) ثم يُدرج السجل بمعرّفه (upsert يتجاهل المكرر) */
async function pushDraft(d){
  for(const ph of d.photos){
    if(ph.done)continue;
    const blob=await txRun("blobs","readonly",s=>rq(s.get(ph.key))).catch(()=>null);
    if(!blob){ph.done=true;ph.lost=true;await qPut(d);continue}
    const path=`${d.uid}/${d.id}_${String(ph.key).split("#")[1]}.jpg`,
      up=await sb.storage.from("gz-photos").upload(path,blob,{contentType:"image/jpeg"});
    if(up.error&&!isDup(up.error))return classify(up.error,up.error.statusCode);
    ph.done=true;ph.path=path;
    await txRun(["drafts","blobs"],"readwrite",(ds,bs)=>{ds.put(d);bs.delete(ph.key)});   // تقدّم الرفع يُحفظ بعد كل صورة
  }
  const paths=d.photos.filter(p=>p.path).map(p=>p.path);
  const r=await sb.from("gz_records").upsert({...cleanPayload(d.payload),photos:paths},{onConflict:"id",ignoreDuplicates:true});
  if(r.error&&/column|schema cache|relation .* does not exist/i.test(r.error.message||""))
    return{err:"قاعدة البيانات تحتاج تنفيذ sql/schema.sql أولاً. السجل محفوظ على جهازك وسيُرفع بعد التنفيذ."};
    return{err:"قاعدة البيانات تحتاج تنفيذ migration_v9.sql وmigration_v10.sql أولاً. السجل محفوظ على جهازك وسيُرفع بعد التنفيذ."};
  if(!r.error)logAudit("gz_records",d.payload.id,"create",null,{type:d.payload.type,district:d.payload.district,risk_level:d.payload.risk_level},true,d.at);
  return r.error?classify(r.error,r.status):{ok:true};
}
async function runSync(manual,onlyId){
  const uid=me.id,st={drafts:0,ops:0,fail:0,net:false,loaded:false};
  const dr=(await qGet(uid)).filter(d=>(manual||!d.err)&&(!onlyId||d.id===onlyId)),
    ops=onlyId?[]:(await oGet(uid)).filter(o=>manual||!o.err);
  if(!dr.length&&!ops.length){if(manual)toast("لا توجد عمليات بانتظار الرفع.");return st}
  if(!await reachable()){st.net=true;if(manual)toast("لا يوجد اتصال فعلي بالخادم الآن.");scheduleRetry();return st}
  const s=await ensureSession();
  if(s==="net"){st.net=true;scheduleRetry();return st}
  if(!s){if(!authLost){authLost=true;toast("انتهت جلستك. سجّل الخروج ثم الدخول لإكمال رفع بياناتك (هي محفوظة على الجهاز).")}return st}
  BUSY=true;draftsUI();
  try{
    for(const d of dr){
      const r=await pushDraft(d);
      if(r.ok){await qDel(d.id);st.drafts++}
      else if(r.net){st.net=true;break}
      else if(r.auth){authLost=true;break}
      else{d.err=r.err;d.tries=(d.tries||0)+1;await qPut(d);st.fail++}
      draftsUI();
    }
    if(!st.net&&!authLost)for(const o of ops){                  // الإنشاء أولاً ثم التعديلات بترتيب وقوعها
      const r=await remoteOp(o.kind,o.ids,o.patch,o.at);
      if(r.net){st.net=true;break}
      if(r.auth){authLost=true;break}
      if(r.err)o.err=r.err;
      else if(r.n===0)o.err="لم يُطبَّق: السجل غير موجود أو لا تملك صلاحية عليه";
      else{await oDel(o.seq);st.ops++;draftsUI();continue}
      o.tries=(o.tries||0)+1;await oPut(o);st.fail++;
    }
  }finally{BUSY=false}
  if(st.drafts+st.ops>0){inFlush=true;try{await load()}finally{inFlush=false}st.loaded=true}
  if(st.net)scheduleRetry();else{retryN=0;clearTimeout(retryT)}
  if(!onlyId){
    const p=[];if(st.drafts)p.push(st.drafts+" سجل جديد");if(st.ops)p.push(st.ops+" عملية (تعديل/حذف/مراجعة)");
    let m=p.length?"تمت المزامنة: "+p.join(" و "):"";
    if(st.fail)m+=(m?" · ":"")+"تعذّر "+st.fail+" (راجع «غير مرفوع»)";
    if(st.net&&p.length)m+=" · انقطع الاتصال وتبقّى بعضها";
    if(m)toast(m);
  }
  draftsUI();return st;
}
/* نقطة الدخول الوحيدة: manual=true يعيد محاولة العناصر الفاشلة أيضاً، onlyId يقتصر على مسودة واحدة */
async function syncAll(manual,onlyId){
  if(!me||OFFMODE)return null;
  if(!await checkClientVersion())return{err:"إصدار قديم"};
  const r=await syncLocked(()=>runSync(manual,onlyId));
  return r||null;
}
async function goOnline(){
  if(!me)return;
  if(!await reachable()){scheduleRetry();return}
  if(OFFMODE){OFFMODE=false;boot();return}
  keepView=true;
  try{
    const s=await syncAll();
    if(s&&s.net)return;
    if(!s||!s.loaded)await load();
    await refreshMe();await syncRef();
  }finally{keepView=false}
}

/* ---------- 8) الواجهة: مؤشر المعلّق، نافذة التفاصيل، الحفظ ---------- */
async function draftsUI(){
  if(!me)return;
  const [q,ops,bytes]=await Promise.all([qGet(me.id),oGet(me.id),blobBytes().catch(()=>0)]),sig=q.map(d=>d.id).join();
  PEND=new Set(ops.filter(o=>!o.err).flatMap(o=>o.ids));
  if(sig!==DSIG){
    DSIG=sig;
    DRAFTV=q.map(d=>({...cleanPayload(d.payload),draft:true,status:"pending",created_by:me.id,created_at:d.at,photos:d.photos.map(p=>p.path||"local:"+p.key)}));
    rebuild();
  }
  const n=q.length+ops.length,err=[...q,...ops].filter(x=>x.err).length,b=$("#draftsBtn");
  b.textContent=(BUSY?"⟳ جارٍ الرفع… ":"غير مرفوع ")+"("+n+")"+(bytes?" · "+fmtB(bytes):"")+(err?" ⚠":"");
  b.classList.toggle("hide",!n&&!BUSY);
  b.style.background=err?"#9d1c1c":"";
  $("#netBadge").classList.toggle("hide",navigator.onLine&&!OFFMODE);
  storageWarn();
}
let _sw=0;
async function storageWarn(){
  if(!navigator.storage||!navigator.storage.estimate||Date.now()-_sw<6e5)return;_sw=Date.now();
  const e=await navigator.storage.estimate();
  if(e.quota&&e.usage/e.quota>.8)toast("مساحة التخزين المحلي شبه ممتلئة ("+Math.round(e.usage/e.quota*100)+"%). ارفع البيانات المعلقة أو أفرغ مساحة.");
}
async function readiness(){
  const L=await refLoad(me.id),ds=Object.values(L).filter(x=>inScope(x.district)),
    recs=(await kvGet("recs:"+me.id))||[],at=await kvGet("recsAt:"+me.id),
    tiles=window.caches?await caches.open("dbas-tiles").then(c=>c.keys()).then(k=>k.length).catch(()=>0):0;
  return{layers:ds.map(x=>x.district),fp:ds.reduce((s,x)=>s+x.list.length,0),recs:recs.length,at,tiles};
}
async function draftsDlg(){
  const uid=me.id,q=await qGet(uid),ops=await oGet(uid),bytes=await blobBytes().catch(()=>0),R=await readiness(),
    est=navigator.storage&&navigator.storage.estimate?await navigator.storage.estimate():null,
    KN={update:"تعديل / مراجعة",delete:"حذف"},tm=x=>new Date(x).toLocaleString("ar-EG"),
    stt=x=>x.err?`<span class="st" style="--c:#9d1c1c">${esc(x.err)}</span>`:"بانتظار الرفع",on=navigator.onLine&&!OFFMODE;
  $("#dlg").innerHTML=`<h3 style="margin-top:0">ما لم يُرفع بعد</h3>
  <div class="msg ${on?"ok":"warn"}">${on?"متصل بالشبكة":"أنت تعمل دون اتصال"} · صور معلقة: ${fmtB(bytes)}${est?` · التخزين المحلي: ${fmtB(est.usage)} من ${fmtB(est.quota)}`:""}</div>
  ${q.length?`<h4 style="margin:8px 0">تسجيلات جديدة (مسودات)</h4><div class="scroll"><table><thead><tr><th>الوقت</th><th>الاسم</th><th>الحي</th><th>الصور</th><th>الحالة</th><th></th></tr></thead><tbody>${q.map(d=>`<tr style="cursor:default"><td>${tm(d.at)}</td><td>${esc(d.payload.owner)}</td><td>${esc(d.payload.district)}</td><td>${d.photos.filter(p=>!p.lost).length}</td><td>${stt(d)}</td><td><button class="btn sm bad" data-q="${d.id}">حذف</button></td></tr>`).join("")}</tbody></table></div>`:""}
  ${ops.length?`<h4 style="margin:8px 0">تعديلات وحذف وقرارات مراجعة</h4><div class="scroll"><table><thead><tr><th>الوقت</th><th>العملية</th><th>السجلات</th><th>الحالة</th><th></th></tr></thead><tbody>${ops.map(o=>`<tr style="cursor:default"><td>${tm(o.at)}</td><td>${KN[o.kind]}</td><td>${o.ids.length}</td><td>${stt(o)}</td><td><button class="btn sm bad" data-o="${o.seq}">إلغاء</button></td></tr>`).join("")}</tbody></table></div><p class="hint">إلغاء عملية لا يُرجع الشكل المحلي إلا بعد مزامنة البيانات من الخادم.</p>`:""}
  ${!q.length&&!ops.length?'<p class="hint">لا يوجد شيء بانتظار الرفع.</p>':""}
  <h4 style="margin:12px 0 4px">جاهزية العمل دون اتصال</h4>
  <p class="hint" style="margin:0">${R.layers.length?`✔ طبقات مرجعية مخزنة: ${esc(R.layers.join("، "))} (${R.fp} بصمة)`:"✖ لا توجد طبقات مرجعية مخزنة (تُنزَّل تلقائياً عند الاتصال إن نُشرت لحيّك)"}</p>
  <p class="hint" style="margin:0">${R.recs?`✔ سجلات محفوظة: ${R.recs}${R.at?" · آخر تحديث "+tm(R.at):""}`:"✖ لا توجد نسخة محلية من السجلات"}</p>
  <p class="hint" style="margin:0">خريطة الأساس المخزنة: ${R.tiles} بلاطة (تُخزَّن أثناء التصفح المتصل فقط)</p>
  <div class="row" style="margin-top:12px"><button class="btn pri" id="dfGo">رفع الآن</button><button class="btn" type="button" data-act="close">إغلاق</button></div>`;
  $("#dfGo").onclick=async()=>{$("#dfGo").disabled=true;await syncAll(true);draftsDlg()};
  $("#dlg").querySelectorAll("button[data-q]").forEach(b=>b.onclick=async()=>{
    if(!await confirmAsk("حذف هذه المسودة نهائياً؟ ستُفقد بياناتها وصورها من هذا الجهاز.",{title:"حذف مسودة",ok:"حذف",danger:true}))return;await qDel(b.dataset.q);DSIG="";await draftsUI();draftsDlg()});
  $("#dlg").querySelectorAll("button[data-o]").forEach(b=>b.onclick=async()=>{
    if(!await confirmAsk("إلغاء هذه العملية وعدم رفعها؟",{title:"إلغاء عملية",ok:"إلغاء العملية",cancel:"رجوع",danger:true}))return;await oDel(+b.dataset.o);await draftsUI();if(navigator.onLine&&!OFFMODE)await load();draftsDlg()});
  if(!$("#dlg").open)$("#dlg").showModal();
}
/* بديل نهاية معالج الحفظ: اكتب المسودة على الجهاز أولاً (Write-Ahead) ثم حاول رفعها فوراً */
async function finishSave(d){
  if(!await qAdd(d)){$("#save").disabled=false;return bad("تعذّر حفظ المسودة على الجهاز (المساحة ممتلئة؟). لم يُحفظ شيء.")}
  resetAddForm();
  if(pickMk){pickMap.removeLayer(pickMk);pickMk=null}clearShape();$("#save").disabled=false;
  $("#addDlg").close();await draftsUI();   /* أغلق النافذة وحدّث ألوان البصمات فوراً دون تغيير التبويب */
  if(navigator.onLine&&!OFFMODE)await syncAll(false,d.payload.id);
  const x=(await qGet(me.id)).find(z=>z.id===d.payload.id);
  toast(!x?"تم حفظ السجل وهو بانتظار المراجعة."
    :x.err?"تعذّر رفع السجل: "+x.err+" — هو محفوظ في «غير مرفوع».":"حُفظ السجل على جهازك وسيُرفع تلقائياً عند توفر الاتصال.");
}

/* ---------- 9) تسجيل الخروج الآمن + مراقبة الشبكة ---------- */
async function logout(){
  const n=me?(await qGet(me.id)).length+(await oGet(me.id)).length:0;
  if(n&&!await confirmAsk(`يوجد ${n} عنصر غير مرفوع محفوظ على هذا الجهاز. سيبقى محفوظاً ويُرفع عند دخولك بالحساب نفسه لاحقاً، ولن تستطيع فتح التطبيق دون اتصال بعد الخروج. متابعة؟`,{title:"تسجيل الخروج",ok:"خروج"}))return;
  if(me){try{await sb.from("gz_audit_log").insert({table_name:"auth",record_id:me.id,field:"logout",old_value:null,new_value:null,changed_by:me.id,user_agent:navigator.userAgent.slice(0,300)})}catch{}
    if(SESS_ID)try{await sb.from("gz_sessions").update({revoked_at:new Date().toISOString(),revoked_by:me.id}).eq("id",SESS_ID)}catch{}}
  await sb.auth.signOut();rt&&sb.removeChannel(rt);rt=null;
  if(me){await refClear();await kvSet("recs:"+me.id,null);await kvSet("recsAt:"+me.id,null)}
  await kvSet("lastMe",null);me=null;screen("authView");
}
$("#draftsBtn").onclick=draftsDlg;
addEventListener("online",()=>{retryN=0;draftsUI();goOnline()});
addEventListener("offline",()=>{draftsUI();toast("انقطع الاتصال. تُحفظ أعمالك على الجهاز وتُرفع تلقائياً عند عودته.")});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&me&&navigator.onLine)goOnline()});
setInterval(()=>{if(me&&navigator.onLine)goOnline()},60000);
addEventListener("beforeunload",e=>{if(BUSY){e.preventDefault();e.returnValue=""}});
/* بلاطات الخرائط بطلبات CORS كي يستطيع sw.js تخزينها (بدل استجابات opaque الثقيلة على الحصة) */
if(typeof L!=="undefined"&&L.TileLayer&&L.TileLayer.mergeOptions)L.TileLayer.mergeOptions({crossOrigin:true});
