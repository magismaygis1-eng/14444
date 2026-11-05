/* ================================================================
   export.js — التصدير: CSV وGeoJSON المسطّح (صف لكل وحدة)، حزمة GIS، التجهيل
   ================================================================ */
/* ---- التصدير ---- */
function printDash(m){if(m==="pp"){print();return}document.body.classList.add("pd");addEventListener("afterprint",()=>document.body.classList.remove("pd"),{once:true});print()}
/* خصائص GeoJSON بأنواع ثابتة لكل حقل (رقم أو null، ونص أو null) كي لا يفشل QGIS/ArcGIS عند الحفظ إلى gdb أو shapefile */
/* نص مقروء لوحدات المبنى (يظهر في Identify): «الأول / وحدة 1: الاسم (الصفة، عدد الأفراد) | ...» */
const unitsText=l=>Array.isArray(l)&&l.length?l.map((u,i)=>`${[u.floor,"وحدة "+(u.no||i+1)].filter(Boolean).join(" / ")}: ${u.name||"—"} (${labOf(REL,u.rel)}${u.per?"، "+u.per+" أفراد":""})`).join(" | ").slice(0,2000):"";
/* ---- تسطيح التصدير: صف مستقل لكل وحدة، وبيانات المبنى والإحداثيات تتكرر مع كل صف ----
   building_id = UUID الكامل (rec_ref للعرض فقط). floor_no رقمي: 0 أرضي، 1..10، 11 سطح/ملحق.
   is_first_unit = 1 لأول صف في كل مبنى، فإذا جمعت حقولاً على مستوى المبنى (الأسر، الأفراد، المساحة…) فصفِّ على is_first_unit=1 كي لا تتضاعف. */
const floorNo=f=>{const i=FLOORS.indexOf(f);return i<0?"":i};
const csvQ=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
const csvOf=(rows,keys)=>"﻿"+[keys.join(","),...rows.map(o=>keys.map(k=>csvQ(o[k])).join(","))].join("\n");
const fTx=(n)=>["String("+n+")","Text Width "+n],fIn=["Integer","Long"],fRe=["Real","Double"];
/* [الاسم، نوع .csvt (QGIS/GDAL)، نوع schema.ini (ArcGIS/OGR)] */
/* أعمدة المبنى (بيانات السلامة الإنشائية) — مصدر واحد للتصدير بكل صيغه: [الاسم، csvt، schema.ini، الوصف] */
const BCOLS=[["building_id",...fTx(36),"المفتاح الفريد للمبنى (UUID كامل)، مفتاح الربط مع أي طبقة أخرى"],["rec_ref",...fTx(12),"رقم السجل المختصر للعرض فقط"],
  ["building_name",...fTx(120),"اسم المالك / المبنى / المرفق"],["assessor_name",...fTx(120),"مهندس الحصر / التقييم الميداني"],["building_type",...fTx(40),"نوع المبنى / المرفق"],["usage_type",...fTx(30),"نوع الاستخدام"],["gov_category",...fTx(40),"الفئة الحكومية (للمباني الحكومية)"],
  ["floors",...fIn,"عدد الطوابق"],["height_m",...fRe,"الارتفاع التقريبي (الطوابق × ارتفاع الطابق)"],["structure_type",...fTx(40),"نوع الهيكل الإنشائي"],
  ["risk_code",...fTx(10),"رمز مستوى الخطورة: critical / high / medium / safe"],["risk_level",...fTx(40),"مستوى الخطورة الإنشائية (Code Red/Orange/Yellow/Green)"],
  ["damaged_elements",...fTx(200),"العناصر الإنشائية المتضررة"],["damage_indicators",...fTx(400),"مؤشرات التلف الإنشائي"],["damage_grade",...fTx(20),"درجة الضرر (اختيارية)"],
  ["occupancy",...fTx(20),"حالة الإشغال"],["families_at_risk",...fIn,"الأسر المعرّضة للخطر المباشر"],["persons_at_risk",...fIn,"الأفراد المعرّضون للخطر المباشر"],["proximity",...fTx(200),"القرب من مرافق حيوية"],
  ["recommendations",...fTx(200),"التوصية الهندسية (من المهندس)"],["committee_decision",...fTx(40),"قرار اللجنة الهندسية المعتمد"],["decision_note",...fTx(500),"ملاحظة / شروط القرار"],["decided_at",...fTx(10),"تاريخ اعتماد القرار"],
  ["buffer_radius_m",...fIn,"نصف قطر نطاق الحماية المقترح (للداهمة والآيلة)"],["alert",...fTx(5),"عليه تنبيه سلامة (نعم/لا)"],
  ["district",...fTx(40),"الحي / المنطقة"],["district_code",...fTx(12),"كود الحي الرئيسي"],["subdistrict_code",...fTx(16),"كود المنطقة الفرعية"],["street",...fTx(160),"وصف الموقع والمعالم القريبة"],
  ["building_units",...fIn,"عدد الوحدات السكنية للمبنى"],["area_m2",...fRe,"مساحة البصمة (م²)"],["damage_date",...fTx(10),"تاريخ وقوع الضرر"],["inspect_date",...fTx(10),"تاريخ المعاينة"],
  ["site_access",...fTx(20),"إمكانية الوصول للموقع"],["martyrs",...fTx(20),"شهداء / مفقودون تحت الأنقاض"],["uxo",...fTx(5),"ذخائر غير منفجرة"],["building_notes",...fTx(500),"ملاحظات المعاينة الهندسية"],
  ["source",...fTx(30),"مصدر المعلومة"],["confidence",...fTx(10),"مستوى الثقة"],["conflict",...fTx(5),"تعارض مع سجل قريب"],["review",...fTx(20),"حالة المراجعة"],["date",...fTx(10),"تاريخ التسجيل"],["lat",...fRe,"خط العرض WGS84"],["lng",...fRe,"خط الطول WGS84"]];
const UCOLS=[["unit_id",...fTx(44),"معرّف الوحدة = building_id + رقم تسلسلي (فارغ للمبنى بلا وحدات)"],["is_first_unit",...fIn,"1 لأول صف في كل مبنى، وصفِّ عليه قبل جمع حقول المبنى"],
  ["floor_no",...fIn,"رقم الطابق: 0 أرضي، 1 إلى 10، 11 سطح/ملحق"],["floor_label",...fTx(20),"اسم الطابق"],["unit_number",...fTx(20),"رقم أو اسم الوحدة"],["owner_name",...fTx(120),"اسم مالك أو شاغل الوحدة"],["tenure",...fTx(20),"صفة الإشغال"],
  ["persons_count",...fIn,"عدد أفراد الوحدة"],["unit_status",...fTx(40),"حالة الوحدة"],["unit_committee_decision",...fTx(40),"قرار اللجنة للوحدة"],["unit_notes",...fTx(200),"ملاحظات الوحدة"]];
const FLAT_COLS=[BCOLS[0],BCOLS[1],...UCOLS,...BCOLS.slice(2)];
const FDESC=Object.fromEntries(FLAT_COLS.map(c=>[c[0],c[3]]));
const FKEYS=FLAT_COLS.map(c=>c[0]),BKEYS=BCOLS.map(c=>c[0]),FLAT_FILE="units_flat.csv";
const flatSchema=()=>({ini:`[${FLAT_FILE}]\r\nFormat=CSVDelimited\r\nColNameHeader=True\r\nCharacterSet=65001\r\nDecimalSymbol=.\r\n`+FLAT_COLS.map((c,i)=>`Col${i+1}=${c[0]} ${c[2]}`).join("\r\n")+"\r\n",csvt:FLAT_COLS.map(c=>'"'+c[1]+'"').join(",")});
/* صف لكل وحدة (ومبنى بلا وحدات يظهر بصف واحد وأعمدة وحدته فارغة). النقطة: داخل المبنى دائماً */
function flatRows(V=view()){const base=expRows(V),out=[];
  V.forEach((c,i)=>{const {_g,...r}=base[i],a=ANON?[[r.lng,r.lat]]:recPts(c),pt=a[a.length-1],us=Array.isArray(c.units_detail)&&c.units_detail.length?c.units_detail:[null],
    b={...r,lat:ANON?r.lat:+(+pt[1]).toFixed(7),lng:ANON?r.lng:+(+pt[0]).toFixed(7)};
    us.forEach((u,j)=>out.push({row:{...b,unit_id:u?c.id+"-U"+(j+1):"",is_first_unit:j?0:1,floor_no:u?floorNo(u.floor):"",floor_label:u&&u.floor||"",unit_number:u&&u.no||"",owner_name:u&&!ANON?(u.name||""):"",tenure:u?labOf(REL,u.rel):"",persons_count:u?(u.per??""):"",unit_status:u&&u.habit&&HAB[u.habit]?HAB[u.habit][0]:"",unit_committee_decision:u&&u.com&&COM[u.com]?COM[u.com]:"",unit_notes:u&&!ANON?(u.notes||""):""},pt:[b.lng,b.lat]}))});
  return out}
const flatCSV=F=>csvOf(F.map(x=>x.row),FKEYS);
const flatGeo=F=>JSON.stringify({type:"FeatureCollection",features:F.map(({row,pt})=>({type:"Feature",geometry:{type:"Point",coordinates:pt},properties:geoProps(Object.fromEntries(FKEYS.map(k=>[k,row[k]])))}))});
/* بصمات المباني (مضلعات) على مستوى المبنى للعرض، تُربط بـ building_id إن لزم */
function footFeats(V){return expRows(V).flatMap(({_g,lat,lng,units_list,unit_owners,...p})=>_g&&/Polygon/.test(_g.type)?[{type:"Feature",geometry:_g,properties:geoProps(p)}]:[])}
function expFlat(kind){const V=view();if(!V.length)return toast("لا توجد سجلات للتصدير.");const F=flatRows(V);
  if(kind==="csv")dl("dbas-units.csv",flatCSV(F),"text/csv;charset=utf-8");
  else dl("dbas-units.geojson",flatGeo(F),"application/geo+json");
  logAudit("gz_records",null,"export_"+kind,null,{n:V.length},true);if(V.length>BULK_EXPORT_THRESHOLD)raiseAlert("bulk_export",`تصدير ${V.length} سجل (${kind})`,"warn");
  toast(`تم التصدير: ${F.length} صف من ${V.length} مبنى (صف لكل وحدة).`)}
async function expBundle(){if(typeof JSZip==="undefined")return toast("مكتبة الضغط لم تُحمَّل. تحقق من الاتصال وأعد المحاولة.");
  const V=view();if(!V.length)return toast("لا توجد سجلات للتصدير.");
  const F=flatRows(V),sc=flatSchema(),fp=ANON?[]:footFeats(V),z=new JSZip(),nu=F.filter(x=>x.row.unit_id).length;
  z.file("units_flat.geojson",flatGeo(F));z.file(FLAT_FILE,flatCSV(F));z.file(FLAT_FILE+"t",sc.csvt);z.file("schema.ini",sc.ini);
  if(fp.length)z.file("buildings_footprints.geojson",JSON.stringify({type:"FeatureCollection",features:fp}));
  z.file("data_dictionary.csv",csvOf(FLAT_COLS.map(c=>({field:c[0],type:c[1].replace(/\(\d+\)/,""),description:FDESC[c[0]]||""})),["field","type","description"]));
  z.file("README.txt",`حزمة تصدير منظومة السلامة والمباني الخطرة (DBAS) - ${todayS()}${ANON?" (مُجهَّلة)":""}
المباني: ${V.length} · الوحدات: ${nu} · صفوف الملف: ${F.length}

الملفات
- units_flat.geojson: نقاط، صف (نقطة) لكل وحدة، وبيانات المبنى والإحداثيات مكررة مع كل وحدة. افتحه مباشرة دون أي ربط.
- units_flat.csv مع units_flat.csvt و schema.ini: النسخة الجدولية نفسها، والملفان الأخيران يثبتان الأنواع (نص/عدد) في QGIS وArcGIS.
- data_dictionary.csv: قاموس البيانات (اسم كل عمود ونوعه ومعناه).
- buildings_footprints.geojson: بصمات المباني (مضلعات) للعرض فقط، ويطابق building_id فيها ما في الجدول${fp.length?"":" (لم تُنشأ: لا توجد بصمات ضمن التصدير)"}.

أعمدة الوحدة: floor_no (0 أرضي، 1..10، 11 سطح/ملحق) · floor_label · unit_number · owner_name · tenure (مالك/مستأجر/شاغل) · persons_count · unit_status (حالة السكن) · committee_decision (قرار اللجنة الفنية) · unit_notes.
المباني التي لا وحدات مسجلة لها تظهر بصف واحد وأعمدة وحدتها فارغة.

risk_code / risk_level: مستوى الخطورة الإنشائية · recommendations: توصية المهندس · committee_decision: قرار اللجنة المعتمد · buffer_radius_m: نصف قطر نطاق الحماية.
تنبيه الجمع: حقول المبنى (families_at_risk, persons_at_risk, building_units, area_m2, floors) تتكرر مع كل وحدة، فلتجنّب التضاعف صفِّ على is_first_unit = 1 قبل جمعها أو عدّ المباني.
المفتاح building_id هو UUID الكامل. rec_ref (REC-xxxxxx) للعرض فقط.
`);
  const blob=await z.generateAsync({type:"blob",compression:"DEFLATE"});dl("gis-package-"+todayS()+".zip",blob,"application/zip");
  toast(`تم تنزيل الحزمة: ${V.length} مبنى، ${nu} وحدة.`)}
/* صفوف المباني للتصدير (تتبع الفلاتر) — بأعمدة BCOLS بالترتيب نفسه */
function expRows(V=view()){const an=ANON,r=(p=>an?+p.toFixed(3):p);
  return V.map(c=>{const fl=Math.max(1,+c.qty||1);return{building_id:c.id,rec_ref:rid(c),building_name:an?"":c.owner,assessor_name:an?"":(c.assessor_name||""),building_type:tOf(c.type).n,usage_type:c.usage_type?usageLabel(c.usage_type):"",gov_category:c.gov_category?govCatLabel(c.gov_category):"",
    floors:fl,height_m:fl*APPSET.floor_height_m,structure_type:STRUCT[c.structure_type]||"",risk_code:c.risk_level||"",risk_level:riskName(c.risk_level),damaged_elements:labs(ELEMS,c.damaged_elements),damage_indicators:labs(INDIC,c.damage_indicators),damage_grade:c.grade||"",
    occupancy:OCC[c.occupancy]||"",families_at_risk:c.fam??"",persons_at_risk:c.per??"",proximity:labs(PROX,c.proximity),recommendations:labs(RECO,c.recommendations),committee_decision:DECIS[c.committee_decision]||"",decision_note:an?"":(c.decision_note||""),decided_at:c.decided_at?String(c.decided_at).slice(0,10):"",
    buffer_radius_m:DANGER.has(c.risk_level)?bufR(fl):"",alert:alertOf(c)?"نعم":"لا",district:c.district,district_code:distCodeOf(distMain(c.district)),subdistrict_code:DIST_PARENT_OF[c.district]?distCodeOf(c.district):"",street:an?"":c.street,
    building_units:c.units??"",area_m2:c.area_m2||"",damage_date:c.damage_date||"",inspect_date:c.inspect_date||"",site_access:labOf(ACC,c.site_access),martyrs:labOf(MAR,c.martyrs),uxo:labOf(UXOS,c.uxo),building_notes:an?"":c.notes,
    source:SRC[c.source]||"",confidence:cLvl(c),conflict:CF.has(c.id)?"نعم":"لا",review:ST[c.status][0],date:c.created_at.slice(0,10),lat:r(c.lat),lng:r(c.lng),_g:an?null:c.geom}})}
const GEO_NUM=["floors","height_m","families_at_risk","persons_at_risk","buffer_radius_m","building_units","area_m2","is_first_unit","floor_no","persons_count","lat","lng"];
const geoProps=p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,GEO_NUM.includes(k)?(v===""||v==null||isNaN(+v)?null:+v):(v===""||v===undefined?null:v)]));
function dl(name,text,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
document.addEventListener("change",e=>{if(e.target.classList.contains("anonc")){ANON=e.target.checked;document.querySelectorAll(".anonc").forEach(c=>c.checked=ANON)}});
document.addEventListener("click",e=>{const x=e.target.dataset?.x;if(!x)return;
  if(x==="sum")return dl("dbas-summary-"+todayS()+".csv","\ufeff"+SUM.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n"),"text/csv;charset=utf-8");
  if(x==="csv"||x==="geo")return expFlat(x);if(x==="bundle")return expBundle();
  const rows=expRows();if(!rows.length)return toast("لا توجد سجلات للتصدير.");
  logAudit("gz_records",null,"export_"+x,null,{n:rows.length},true);if(rows.length>BULK_EXPORT_THRESHOLD)raiseAlert("bulk_export",`تصدير ${rows.length} سجل (${x})`,"warn");
  if(x==="geob")dl("dbas-buildings-"+todayS()+".geojson",JSON.stringify({type:"FeatureCollection",features:rows.map(({lat,lng,_g,...p})=>({type:"Feature",geometry:_g||{type:"Point",coordinates:[lng,lat]},properties:geoProps(p)}))}),"application/geo+json");
  else if(x==="csvb")dl("dbas-buildings-"+todayS()+".csv",csvOf(rows,Object.keys(rows[0]).filter(k=>k!=="_g")),"text/csv;charset=utf-8")});
