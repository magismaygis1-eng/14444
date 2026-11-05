/* ================================================================
   auth.js — المصادقة، تهيئة القوائم، وتشغيل التطبيق (boot)
   ================================================================ */
function screen(v){["authView","pendingView","blockedView","appView"].forEach(x=>$("#"+x).classList.toggle("hide",x!==v));splashOff();if(v==="appView")requestAnimationFrame(measureHeader)}
const authErr=m=>$("#authMsg").innerHTML='<div class="msg">'+esc(m)+"</div>";
$("#authSwap").onclick=()=>{signup=!signup;$("#nameLbl").classList.toggle("hide",!signup);$("#passHint").classList.toggle("hide",!signup);$("#pass").autocomplete=signup?"new-password":"current-password";$("#authGo").textContent=signup?"إنشاء الحساب":"دخول";$("#authSwap").textContent=signup?"لدي حساب":"إنشاء حساب جديد";$("#authMsg").innerHTML=""};
const AUTH_AR={"Invalid login credentials":"البريد أو كلمة المرور غير صحيحة.","Email not confirmed":"لم يُؤكَّد البريد بعد. افتح رسالة التأكيد في بريدك.","User already registered":"هذا البريد مسجّل مسبقاً. استخدم «لدي حساب».","Email rate limit exceeded":"محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة."};
const authAr=m=>AUTH_AR[m]||(/fetch|network/i.test(m)?"تعذّر الاتصال بالخادم. تحقق من الإنترنت.":m);
$("#authForm").onsubmit=async e=>{e.preventDefault();
  const email=$("#email").value.trim(),password=$("#pass").value,go=$("#authGo");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return authErr("أدخل بريداً إلكترونياً صحيحاً.");
  if(signup){if(!$("#fullName").value.trim())return authErr("أدخل اسمك الكامل؛ يظهر في السجلات والتقارير الرسمية.");
    if(password.length<8||!/[A-Za-z\u0600-\u06FF]/.test(password)||!/\d/.test(password))return authErr("كلمة المرور: 8 أحرف على الأقل وتتضمن حرفاً ورقماً.")}
  else if(!password)return authErr("أدخل كلمة المرور.");
  go.disabled=true;$("#authMsg").innerHTML="";
  const r=await (signup?await sb.auth.signUp({email,password,options:{data:{full_name:$("#fullName").value.trim()}}}):await sb.auth.signInWithPassword({email,password})).catch(err=>({error:err}));go.disabled=false;
  if(r.error){try{await sb.from("gz_audit_log").insert({table_name:"auth",record_id:null,field:signup?"signup_failed":"login_failed",old_value:null,new_value:email,user_agent:navigator.userAgent.slice(0,300)})}catch{}return authErr(authAr(r.error.message||String(r.error)))}
  if(signup&&!r.data.session)return $("#authMsg").innerHTML='<div class="msg ok">تم إنشاء الحساب. أكّد بريدك إن طُلب منك، ثم سجّل الدخول.</div>';
  if(!signup&&r.data.user)try{await sb.from("gz_audit_log").insert({table_name:"auth",record_id:r.data.user.id,field:"login",old_value:null,new_value:email,changed_by:r.data.user.id,user_agent:navigator.userAgent.slice(0,300)})}catch{}
  $("#pass").value="";boot()};
function opts(sel,first,list){sel.innerHTML=(first?`<option value="">${first}</option>`:"")+list.map(([v,t])=>`<option value="${esc(v)}">${esc(t)}</option>`).join("")}
function initLists(){
  opts($("#fRisk"),"كل مستويات الخطورة",[["danger","🔴🟠 الداهمة والآيلة للسقوط"],...RISK_K.map(k=>[k,riskLab(k)]),["alert","🚨 تنبيهات السلامة"]]);
  opts($("#fStruct"),"كل أنواع الهياكل",Object.entries(STRUCT));
  opts($("#fElem"),"كل العناصر المتضررة",Object.entries(ELEMS));
  opts($("#fOcc"),"كل حالات الإشغال",Object.entries(OCC));
  opts($("#fDist"),"كل الأحياء",[...new Set(myD().map(distMain))].map(d=>[d,d]));fSubRefresh();
  opts($("#fSt"),"كل حالات المراجعة والقرار",[...Object.entries(ST).map(([k,v])=>[k,v[0]]),["undecided","⏳ بانتظار قرار اللجنة (داهمة/آيلة)"],...Object.entries(DECIS).map(([k,v])=>["d:"+k,"قرار: "+v])]);
  opts($("#aT"),"",TYPES.map(t=>[t.k,t.n]));opts($("#aD"),"",myD().map(d=>[d,d]));opts($("#aSrc"),"",Object.entries(SRC));
  opts($("#aUse"),"",USAGE_TYPES);opts($("#aGov"),"",GOV_CATS);govCatToggle();
  opts($("#aRisk"),"— اختر مستوى الخطورة —",RISK_K.map(k=>[k,riskLab(k)+" ("+RISK[k][3]+")"]));opts($("#aStruct"),"",Object.entries(STRUCT));opts($("#aOcc"),"",Object.entries(OCC));opts($("#aG"),"— غير محدد —",BLD.map(g=>[g,g]));
  chkGroup($("#aElems"),ELEMS,"el");chkGroup($("#aIndic"),INDIC,"in");chkGroup($("#aProx"),PROX,"px");chkGroup($("#aReco"),RECO,"rc");
  $("#aTechSlot").innerHTML=techHTML("a");techInit("a");typeChange();riskChange();opts($("#iT"),"",TYPES.map(t=>[t.k,t.n]));opts($("#iD"),"",DISTS.map(d=>[d,d]));opts($("#iUse"),"",USAGE_TYPES);opts($("#iS"),"",Object.entries(SRC));impType();
  $("#leg").innerHTML=RISK_K.map(k=>`<span><i style="--c:${riskCol(k)}"></i>${riskLab(k)}</span>`).join("");
  $("#verTxt").textContent="منظومة السلامة والمباني الخطرة (DBAS) · الإصدار "+APP_VERSION}
let ME_NAME="";
async function boot(){splash("جارٍ التحقق من الجلسة…");
  const {data:{session}}=await sb.auth.getSession();let email=session&&session.user.email;
  if(!session){const c=await kvGet("lastMe");if(!(c&&!navigator.onLine))return screen("authView");me=c.me;email=c.email;OFFMODE=true}
  else{let {data,error}=await sb.from("gz_profiles").select("*").eq("id",session.user.id).single();
    if(error&&isNet(error)){const c=await kvGet("lastMe");if(c&&c.me.id===session.user.id){data=c.me;OFFMODE=true}}
    me=data;if(me&&me.approved&&!OFFMODE)kvPut("lastMe",{me,email})}
  if(!me||!me.approved){const st=me?ustatOf(me):"pending";
    if(st==="suspended"||st==="rejected"){/* حالة مستقلة للحساب الموقوف أو المرفوض بدل «بانتظار الموافقة» */
      $("#blkT").textContent=st==="suspended"?"تم إيقاف حسابك":"لم تتم الموافقة على حسابك";
      $("#blkM").textContent=st==="suspended"?"أوقف المدير هذا الحساب مؤقتاً، فلا يمكنك الوصول إلى السجلات أو إدخال بيانات جديدة. أي بيانات غير مرفوعة تبقى محفوظة على هذا الجهاز. تواصل مع المدير لإعادة تفعيله.":"رفض المدير طلب إنشاء هذا الحساب. تواصل معه إن كان ذلك عن طريق الخطأ.";
      $("#blkR").textContent=st==="rejected"&&me.rejected_reason?"السبب: "+me.rejected_reason:"";
      return screen("blockedView")}
    return screen("pendingView")}
  ME_NAME=((me.full_name||"").trim())||email||"";
  $("#who").textContent=(me.full_name||email)+" · "+ROLE[me.role];$("#who").parentElement.title=(me.full_name||email)+" – "+ROLE[me.role]+(isAll()?"":" – "+(myD().join("، ")||"بلا نطاق"));$("#whoAv").textContent=initials(me.full_name||email);
  $("#refAdmin").classList.toggle("hide",me.role!=="admin");const sm=$("#scopeMsg");sm.textContent="لم يُعيَّن لك حي بعد، فلن تظهر لك سجلات ولا يمكنك التسجيل. تواصل مع المدير ليحدد نطاقك.";sm.classList.toggle("hide",isAll()||myD().length>0);
  $("#usersTab").classList.toggle("hide",me.role!=="admin");$("#impTab").classList.toggle("hide",!(me.role==="admin"||me.role==="reviewer"));document.querySelector('#nav [data-v="add"]').classList.toggle("hide",!canEnter());$("#monTab").classList.toggle("hide",!canMonitor());
  screen("appView");navigator.storage&&navigator.storage.persist&&navigator.storage.persist();initLists();$("#aAs").value=ME_NAME;kvSet("srv",null);refLoad(me.id).then(useSrvRef).then(()=>{if(navigator.onLine&&!OFFMODE)syncRef()});subscribeRT();draftsUI();syncAll();refreshSettings().then(refresh);
  if(!OFFMODE){upd(me.id,{last_activity_at:new Date().toISOString()});
    sb.from("gz_sessions").insert({user_id:me.id,device_label:(navigator.userAgentData&&navigator.userAgentData.platform)||navigator.platform||"",user_agent:navigator.userAgent.slice(0,300)}).select("id").single().then(({data})=>{if(data)SESS_ID=data.id})}
  if(!me.seen_activity_notice)activityNoticeDlg();if(isAll())sb.from("gz_profiles").select("id,full_name").then(({data})=>{NAMES=Object.fromEntries((data||[]).map(u=>[u.id,u.full_name||""]));refresh()});splash("جارٍ تحميل السجلات…");await load();
  const sv=new URLSearchParams(location.search).get("v"),ok=["dash","list","mapv","spat"].includes(sv)||(sv==="add"&&canEnter())||(sv==="imp"&&me.role!=="collector")||(sv==="users"&&me.role==="admin");show(ok?sv:"dash")}
