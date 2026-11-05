/* ================================================================
   audit.js — سجل التدقيق، فحص إصدار العميل، التنبيهات، والإعدادات العامة من الخادم
   ================================================================ */
/* إعدادات قابلة للضبط من المدير (gz_app_settings): ارتفاع الطابق ومعامل نطاق الحماية */
let APPSET={floor_height_m:3,buffer_factor:1.5};
async function refreshSettings(){
  try{const{data,error}=await sb.from("gz_app_settings").select("key,value").in("key",Object.keys(APPSET));
    if(!error&&data){data.forEach(r=>{const v=+r.value;if(isFinite(v)&&v>0)APPSET[r.key]=v});kvPut("appset",APPSET)}else{const c=await kvGet("appset");if(c)APPSET={...APPSET,...c}}}
  catch{const c=await kvGet("appset");if(c)APPSET={...APPSET,...c}}}
/* سجل تدقيق: القيمة القديمة والجديدة ومن عدّل (best-effort) */
async function logAudit(table,id,field,oldV,newV,force,occurredAt){if(!force&&JSON.stringify(oldV??null)===JSON.stringify(newV??null))return;
  try{await sb.from("gz_audit_log").insert({table_name:table,record_id:id,field,old_value:oldV,new_value:newV,changed_by:(me&&me.id)||null,user_agent:navigator.userAgent.slice(0,300),occurred_at:occurredAt||new Date().toISOString()})}catch{}}
/* فحص الحد الأدنى لإصدار المخطط قبل أي مزامنة (المرحلة 5): رفض مهذَّب بدل مزامنة قد تنكسر */
let _verChecked=false;
async function checkClientVersion(){if(_verChecked)return true;_verChecked=true;
  try{const{data}=await sb.from("gz_app_settings").select("value").eq("key","min_client_schema_version").single();
    const min=data?+data.value:1;if(SCHEMA_VERSION<min){toast("يوجد إصدار أحدث من التطبيق مطلوب لمتابعة المزامنة. حدِّث الصفحة لتثبيت آخر إصدار قبل المتابعة.","err");return false}}
  catch{} return true}
/* تنبيهات مبسَّطة عند لحظة الفعل (best-effort من طرف الواجهة؛ راقبة كاملة بقواعد دورية على الخادم تحتاج Edge Function/Cron مجدولة لم تُنفَّذ هنا — مذكورة في المهام المعلّقة) */
async function raiseAlert(type,message,severity,recordId){try{await sb.from("gz_alerts").insert({user_id:(me&&me.id)||null,type,message,severity:severity||"warn",record_id:recordId||null})}catch{}}
const BULK_EXPORT_THRESHOLD=200,BULK_DELETE_THRESHOLD=20;
