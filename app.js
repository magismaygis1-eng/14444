/* ================================================================
   app.js — نقطة التشغيل: التثبيت، Service Worker، وتشغيل boot()
   ================================================================ */
sb&&sb.auth.onAuthStateChange(ev=>{if(ev==="SIGNED_OUT")screen("authView")});
let instEv=null;addEventListener("beforeinstallprompt",e=>{e.preventDefault();instEv=e;$("#instBtn").classList.remove("hide")});
$("#instBtn").onclick=async()=>{if(!instEv)return;instEv.prompt();await instEv.userChoice;instEv=null;$("#instBtn").classList.add("hide")};
addEventListener("appinstalled",()=>$("#instBtn").classList.add("hide"));
/* ---- Service Worker: تسجيل + إشعار التحديث ---- */
if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol)){
  navigator.serviceWorker.register("sw.js").then(reg=>{
    const offer=w=>{if(!w||$("#updBar"))return;const b=document.createElement("div");b.id="updBar";b.innerHTML='<span>يتوفر إصدار أحدث من المنصة</span><button class="btn sm pri" type="button">تحديث الآن</button>';
      b.querySelector("button").onclick=async()=>{if(typeof BUSY!=="undefined"&&BUSY)return toast("انتظر انتهاء الرفع الجاري ثم حدّث.");w.postMessage("skipWaiting")};document.body.append(b)};
    if(reg.waiting&&navigator.serviceWorker.controller)offer(reg.waiting);
    reg.addEventListener("updatefound",()=>{const w=reg.installing;w&&w.addEventListener("statechange",()=>{if(w.state==="installed"&&navigator.serviceWorker.controller)offer(w)})});
    setInterval(()=>reg.update().catch(()=>{}),30*60000);
  }).catch(()=>{});
  let reloaded=false;navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!reloaded){reloaded=true;location.reload()}});
}
if(sb)boot().catch(e=>{console.error(e);splashOff();toast("تعذّر تشغيل التطبيق: "+(e.message||e),"err")});
else splashOff();
