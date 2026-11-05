/* ================================================================
   core.js — منظومة السلامة والمباني الخطرة (DBAS): القواميس المعيارية (مستويات الخطورة، الهيكل الإنشائي، التلف، الإشغال، التوصيات)، الأدوات العامة، الصلاحيات، طبقة الثقة وكشف التعارض
   ================================================================ */
if(typeof Chart!=="undefined"){Chart.defaults.font.family="Tajawal, Tahoma, sans-serif";Chart.defaults.color="#12202e"}
const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
/* ---- مستويات الخطورة الإنشائية (Risk Hierarchy) — الحقل الأساسي لكل سجل ---- */
const RISK={critical:["خطورة داهمة / انهيار وشيك","#b3141a","🔴","Code Red","إخلاء فوري وهدم أو تدعيم طارئ"],
  high:["آيل للسقوط / خطورة عالية","#e8590c","🟠","Code Orange","إنذار وإشعار بالتدعيم أو الإخلاء"],
  medium:["خطورة متوسطة","#d9a400","🟡","Code Yellow","عيوب جزئية: صيانة الواجهات والعناصر غير الحرجة"],
  safe:["آمن / سليم","#2e7d32","🟢","Code Green","لا يتطلب تدخلاً"]};
const RISK_K=Object.keys(RISK),DANGER=new Set(["critical","high"]),ROADS_KEY="__roads__";
const riskName=k=>RISK[k]?RISK[k][0]:"غير مصنّف",riskCol=k=>RISK[k]?RISK[k][1]:"#7b8794",riskLab=k=>RISK[k]?RISK[k][2]+" "+RISK[k][0]:"غير مصنّف";
const riskChip=k=>`<span class="chip" style="--c:${riskCol(k)}">${RISK[k]?RISK[k][2]+" ":""}${riskName(k)}</span>`;
/* درجة الضرر (اختيارية، للتوافق مع تصنيفات الأضرار الدولية) */
const BLD=["مدمّر كلياً","ضرر شديد","ضرر متوسط","ضرر محتمل"];
const STRUCT={rc_frame:"خرسانة مسلحة (هيكلي)",bearing_wall:"جدران حاملة (طوب / بلوك)",old_stone:"حجر قديم / تراثي",steel:"هيكل معدني",mixed:"مختلط",other:"أخرى"};
const ELEMS={columns:"الأعمدة",beams:"الجسور",slabs:"البلاطات / الأسقف",walls:"الجدران",foundations:"الأساسات",stairs:"الأدراج",facades:"الواجهات"};
const INDIC={diag_cracks:"شقوق مائلة نافذة في الأعمدة والجدران",settlement:"هبوط أو ميلان في الأساسات",spalling:"تساقط الغطاء الخرساني وصدأ حديد التسليح",dampness:"رطوبة وتشبع الأساسات",
  deflection:"ترخيم البلاطات أو الجسور",bulging:"انتفاخ أو انبعاج الجدران",partial_collapse:"انهيار جزئي"};
const OCC={occupied:"مأهول",partial:"مأهول جزئياً",vacant:"مهجور"};
const PROX={school:"قرب مدرسة",health:"قرب مرفق صحي",narrow_street:"على شارع ضيق",main_road:"على طريق رئيسي",market:"قرب سوق أو تجمع"};
/* التوصيات الهندسية الإلزامية (من المهندس) — وقرار اللجنة منفصل عنها */
const RECO={evacuate:"إخلاء عاجل",demolish:"إزالة وتهديم فوري",shore:"تدعيم هيكلي مؤقت",maintain:"صيانة موضعية للواجهات"};
const DECIS={evacuate:"إخلاء",demolish:"إزالة / هدم",shore:"تدعيم",maintain:"صيانة",no_action:"لا إجراء"};
const labs=(m,a)=>(Array.isArray(a)?a:[]).map(k=>m[k]||k).join("، ");
const TYPES=[{k:"res",n:"مبنى سكني",c:"bld",u:"طابق"},{k:"multi",n:"عمارة سكنية",c:"bld",u:"طابق"},{k:"edu",n:"مدرسة / مرفق تعليمي",c:"bld",u:"طابق"},{k:"health",n:"مرفق صحي",c:"bld",u:"طابق"},{k:"mosque",n:"مسجد",c:"bld",u:"طابق"},{k:"church",n:"كنيسة",c:"bld",u:"طابق"},{k:"com",n:"منشأة تجارية",c:"bld",u:"طابق"},{k:"gov",n:"مبنى حكومي",c:"bld",u:"طابق"},{k:"heritage",n:"مبنى تراثي",c:"bld",u:"طابق"},{k:"other",n:"منشأة أخرى",c:"bld",u:"طابق"}];
const CATS={bld:"مبانٍ ومرافق"},SHAPE={bld:"b"};
/* ألوان: الخريطة والمخططات تُلوَّن بمستوى الخطورة؛ GCOL يبقى لدرجة الضرر الاختيارية */
const GCOL={"مدمّر كلياً":"#9d1c1c","ضرر شديد":"#e8590c","ضرر متوسط":"#d9a400","ضرر محتمل":"#7b8794"};
/* التسلسل الهرمي للأحياء (المرحلة 2): كل عنصر رئيسي بكود ثابت، وقد يحمل مناطق فرعية بأكوادها الخاصة.
   حدود المناطق الفرعية (geom) ستُستكمل لاحقاً من ملف GeoJSON يزوّده المستخدم — لا تُخمَّن. */
const DISTRICT_TREE=[
  {code:"rml",name:"الرمال",subs:[{code:"rml-n",name:"الرمال الشمالي"},{code:"rml-s",name:"الرمال الجنوبي"}]},
  {code:"tlh",name:"تل الهوى",subs:[]},
  {code:"shaj",name:"الشيخ عجلين",subs:[]},
  {code:"sabra",name:"الصبرة",subs:[]},
  {code:"shrd",name:"الشيخ رضوان",subs:[]},
  {code:"nasr",name:"النصر",subs:[]},
  {code:"daraj",name:"الدرج",subs:[]},
  {code:"tufah",name:"التفاح",subs:[]},
  {code:"zaytoun",name:"الزيتون",subs:[]},
  {code:"shjy",name:"الشجاعية",subs:[{code:"shjy-j",name:"الشجاعية – الجديدة"},{code:"shjy-t",name:"الشجاعية – التركمان"}]},
  {code:"sinaa",name:"الصناعة",subs:[]},
  {code:"oldtown",name:"البلدة القديمة",subs:[]},
  {code:"shati",name:"مخيم الشاطئ",subs:[{code:"shati-blkh",name:"البلاخية"}]}
]; // أحياء مدينة غزة فقط. أضف أي حي ناقص هنا ثم في sql/migration_v11_phase2.sql إن لزم
const DIST_MAIN=DISTRICT_TREE.map(d=>d.name);
const DISTS=DISTRICT_TREE.flatMap(d=>[d.name,...d.subs.map(s=>s.name)]); // قائمة مسطّحة (رئيسي+فرعي) للتوافق مع كل مواضع الاستخدام القديمة
const DIST_CODE={};DISTRICT_TREE.forEach(d=>{DIST_CODE[d.name]=d.code;d.subs.forEach(s=>{DIST_CODE[s.name]=s.code})});
const DIST_PARENT_OF={};DISTRICT_TREE.forEach(d=>d.subs.forEach(s=>{DIST_PARENT_OF[s.name]=d.name}));
const subsOf=mainName=>{const d=DISTRICT_TREE.find(x=>x.name===mainName);return d?d.subs.map(s=>s.name):[]};
const distMain=name=>DIST_PARENT_OF[name]||name; // يُرجع اسم الحي الرئيسي لأي اسم فرعي أو رئيسي (للتجميع التلقائي)
const distCodeOf=name=>DIST_CODE[name]||"";
/* نوع الاستخدام (المرحلة 2.1) */
const USAGE_TYPES=[["res","سكني"],["gov","حكومي ومؤسسات رسمية"],["com","تجاري"],["edu","تعليمي"],["health","صحي"],["rel","ديني"],["other","أخرى"]];
const GOV_CATS=[["ministry","وزارة"],["hq","مقر حكومي"],["facility","مرفق تابع للقطاع الحكومي"],["municipal","بلدية"]];
const usageLabel=k=>(USAGE_TYPES.find(x=>x[0]===k)||[,""])[1];
const govCatLabel=k=>(GOV_CATS.find(x=>x[0]===k)||[,""])[1];
/* حالات المستخدم الأربع (المرحلة 4.1) */
const USTAT={active:["نشط / معتمد","#2e7d32","✔"],pending:["قيد الانتظار","#9a7d00","⏳"],suspended:["موقوف","#5d6b78","⏸"],rejected:["مرفوض","#8a2f2f","✖"]};
const ustatOf=u=>u.status||(u.approved?"active":"pending");
const MON_PERMS=[["can_view_activity","عرض لوحة النشاط"],["can_view_audit","عرض سجل التدقيق"],["can_manage_sessions","إدارة الجلسات وإنهاؤها"],["can_receive_alerts","استلام التنبيهات الأمنية"],["can_export_monitoring","تصدير سجلات المراقبة"]];
const canMonitor=()=>me.role==="admin"||MON_PERMS.some(([k])=>me[k]);
/* افتراضات حساب الوحدات السكنية (عدّلها حسب منهجيتكم): وحدة سكنية لكل 100 م² من مساحة الطابق، وبلا بصمة: 1 للمبنى السكني و2 للعمارة لكل طابق */
const HOUS=new Set(["res","multi"]),UNIT_AREA=100,UPF={res:1,multi:2};
/* حالة الوحدة السكنية داخل المبنى (جدول الوحدات والشاغلين) */
const HAB={habitable:["صالح للسكن","#2e7d32"],minor:["يحتاج ترميماً بسيطاً","#8fba6a"],major:["يحتاج ترميماً كبيراً","#e8590c"],reinforce:["يحتاج تدعيماً إنشائياً","#c9a227"],committee:["يُحال إلى لجنة هندسية","#7b4ab3"],uninhabitable:["غير صالح للسكن","#9d1c1c"]};
const YN={yes:"نعم",no:"لا"},ACC={ok:"سالك",blocked:"مغلق / معاق",collapsed:"منهار"},MAR={none:"لا يوجد",suspected:"مشتبه",confirmed:"مؤكد"},UXOS={none:"لا",yes:"نعم"},
  V9=["units_detail","damage_date","inspect_date","site_access","martyrs","uxo"],
  TECH=[["Acc","site_access","إمكانية الوصول للموقع",ACC],["Mar","martyrs","شهداء / مفقودون تحت الأنقاض",MAR],["Uxo","uxo","ذخائر غير منفجرة",UXOS]];
const COM={none:"لم يصدر قرار",keep:"إبقاء / استخدام",repair:"ترميم",shore:"تدعيم",demolish:"هدم"};
const NF=x=>Number(x).toLocaleString("en-US");
const REL={owner:"مالك",tenant:"مستأجر",other:"شاغل / آخر"},FLOORS=["أرضي","الأول","الثاني","الثالث","الرابع","الخامس","السادس","السابع","الثامن","التاسع","العاشر","سطح / ملحق"];
const labOf=(m,k)=>k?(Array.isArray(m[k])?m[k][0]:m[k])||k:"";
const recOf=c=>Array.isArray(c.recommendations)?c.recommendations:[];
/* تقييم ناقص: بلا هيكل أو إشغال، أو مبنى خطر بلا مؤشرات تلف أو بلا توصية (جودة البيانات) */
const needsCompletion=c=>!c.structure_type||!c.occupancy||(DANGER.has(c.risk_level)&&(!recOf(c).length||!(c.damage_indicators||[]).length));
const alertOf=c=>c.risk_level==="critical"||c.uxo==="yes"||c.martyrs==="confirmed"||c.martyrs==="suspected"||c.site_access==="collapsed"||(c.risk_level==="high"&&!!c.occupancy&&c.occupancy!=="vacant");
const alertTxt=c=>[c.risk_level==="critical"&&"خطورة داهمة / انهيار وشيك",c.risk_level==="high"&&c.occupancy&&c.occupancy!=="vacant"&&"آيل للسقوط وما زال مأهولاً",recOf(c).includes("evacuate")&&"توصية بإخلاء عاجل",c.uxo==="yes"&&"ذخائر غير منفجرة",c.martyrs==="confirmed"&&"شهداء تحت الأنقاض (مؤكد)",c.martyrs==="suspected"&&"اشتباه بشهداء تحت الأنقاض",c.site_access==="collapsed"&&"الموقع منهار"].filter(Boolean).join(" · ");
const todayS=()=>{const x=new Date();return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
const ST={pending:["بانتظار المراجعة","#5d6b78"],approved:["معتمد","#2e7d32"],rejected:["مرفوض","#9d1c1c"]};
const SRC={field:"معاينة ميدانية",witness:"شهادة شاهد",imagery:"صورة جوية/قمر صناعي",other:"أخرى"},SW={field:20,imagery:15,witness:10,other:0};
const ROLE={collector:"مهندس حصر وتقييم",reviewer:"مراجع فني",committee:"لجنة هندسية",admin:"مدير"},CC={"عالية":"#2e7d32","متوسطة":"#d9a400","منخفضة":"#9aa5b1"};
const BB={la:[31.2,31.62],ln:[34.2,34.6]};
const tOf=k=>TYPES.find(t=>t.k===k)||TYPES[TYPES.length-1],gradesOf=()=>BLD;
let PEND=new Set(),SRV=[],opsBusy=false,inFlush=false,OFFMODE=false,OFFDATA=false,CH={},NAMES={},rt=null,rtT,keepView=false,USERS=[],SEL=new Set(),ANON=false,SUM=[],me=null,recs=[],CF=new Set(),cur="dash",signup=false,pickMap,pickMk,bigMap,baseL,dataL,DQ_ONLY=false,SESS_ID=null;

/* إشعارات مكدّسة بنوع تلقائي (نجاح/خطأ/تحذير) يُستنتج من النص إن لم يُحدَّد */
function toast(m,kind){const box=$("#toasts");if(!box)return;m=String(m??"");
  kind=kind||(/^(تعذّر|تعذر|توقف|فشل|خطأ)|لم تُحمَّل/.test(m)?"err":/^(تم|حُفظ|تمت)/.test(m)?"ok":/انقطع|غير متصل|ممتلئة|انتهت/.test(m)?"warn":"");
  const last=box.lastElementChild;if(last&&last.dataset.m===m){clearTimeout(last._h);last._h=setTimeout(()=>dropT(last),4200);return}
  const t=document.createElement("div");t.className="toast "+kind;t.dataset.m=m;t.textContent=m;t.onclick=()=>dropT(t);box.append(t);
  while(box.children.length>4)box.firstElementChild.remove();
  t._h=setTimeout(()=>dropT(t),kind==="err"?7000:4200)}
function dropT(t){t.classList.add("out");setTimeout(()=>t.remove(),260)}
const canEdit=c=>me.role==="reviewer"||me.role==="admin"||(c.created_by===me.id&&c.status==="pending"),canDel=c=>me.role==="admin"||(c.created_by===me.id&&c.status==="pending");
/* اللجنة الهندسية تعتمد القرار فقط (يفرضه الخادم أيضاً)، والمهندس لا يكتبه */
const canDecide=c=>!c.draft&&(me.role==="committee"||me.role==="admin");
const canEnter=()=>me.role!=="committee";
const isAll=()=>me.role==="reviewer"||me.role==="committee"||me.role==="admin";
/* نطاق الأحياء الفعلي للمستخدم: اختيار حي رئيسي يشمل مناطقه الفرعية تلقائياً (المرحلة 4.2)؛ اختيار منطقة فرعية بمفردها يقصر النطاق عليها فقط */
const expandScope=list=>{const s=new Set();(list||[]).forEach(d=>{if(DIST_MAIN.includes(d)){s.add(d);subsOf(d).forEach(x=>s.add(x))}else if(d)s.add(d)});return[...s]};
const myD=()=>isAll()?DISTS:DISTS.filter(d=>expandScope(me.districts).includes(d));
/* إخفاء المباني الحكومية (المرحلة 2.1): يضبطه المدير العام فقط (profiles.can_view_gov)؛ الإخفاء الفعلي يُفرض بسياسة RLS تقييدية على الخادم — هذا فقط حجب إضافي في الواجهة */
const canViewGov=()=>me.role==="admin"||me.can_view_gov!==false;
const canAct=c=>canEdit(c)||canDel(c);
const rid=c=>"REC-"+c.id.slice(0,6).toUpperCase(),fmt=d=>new Date(d).toLocaleDateString("ar-EG");
/* ---- طبقة الثقة (أوزان تقديرية، عدّلها حسب منهجيتك) ---- */
function conf(c){if(c.status==="rejected")return 0;const n=(c.photos||[]).length;return Math.min(100,(n?30:0)+(n>1?10:0)+(c.status==="approved"?40:0)+(SW[c.source]||0))}
const cLvl=c=>{const x=conf(c);return x>=70?"عالية":x>=40?"متوسطة":"منخفضة"};
const hav=(a,b,c,d)=>{const R=6371000,r=Math.PI/180;return R*Math.hypot((c-a)*r,(d-b)*r*Math.cos((a+c)*r/2))};
function conflicts(){const o=new Set(),a=recs.filter(c=>c.status!=="rejected");
  for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){const x=a[i],y=a[j];
    if(Math.abs(x.lat-y.lat)<.0002&&x.risk_level!==y.risk_level&&hav(x.lat,x.lng,y.lat,y.lng)<15){o.add(x.id);o.add(y.id)}}
  return o}
