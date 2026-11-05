/* ================================================================
   import.js — استيراد GeoJSON / CSV / Shapefile إلى السجلات
   ================================================================ */
/* ---- استيراد الملفات ---- */
let IMP=null,IMPN="";
const impType=()=>{if(!$("#iG").options.length)opts($("#iG"),"",RISK_K.map(k=>[k,riskLab(k)]))};$("#iT").onchange=impType;
function csv2fc(t){t=t.replace(/^\ufeff/,"");const rows=[];let r=[],c="",q=false;
  for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch=='"'){if(t[i+1]=='"'){c+='"';i++}else q=false}else c+=ch}else if(ch=='"')q=true;else if(ch==","){r.push(c);c=""}else if(ch=="\n"||ch=="\r"){if(ch=="\r"&&t[i+1]=="\n")i++;r.push(c);c="";rows.push(r);r=[]}else c+=ch}
  if(c||r.length){r.push(c);rows.push(r)}
  const h=rows.shift().map(x=>x.trim()),f=re=>h.findIndex(x=>re.test(x)),la=f(/^(lat|latitude|y|خط العرض)$/i),ln=f(/^(lon|lng|long|longitude|x|خط الطول)$/i);
  if(la<0||ln<0)throw new Error("لم أجد عمودي خط العرض والطول في ملف CSV");
  return{features:rows.filter(r=>r.length>1).map(r=>({geometry:{type:"Point",coordinates:[+r[ln],+r[la]]},properties:Object.fromEntries(h.map((k,i)=>[k,r[i]]))}))}}
$("#iFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;IMPN=f.name;let raw;try{raw=await readGeo(f)}catch(err){return toast("تعذّرت قراءة الملف: "+err.message)}
  const fs=raw.filter(x=>x.geometry&&/^(Multi)?(Point|Polygon)$/.test(x.geometry.type)).map(x=>({g:x.geometry,p:x.properties||{}}));
  if(!fs.length)return toast("لا توجد نقاط أو مضلعات في الملف.");
  IMP=fs;const cols=[...new Set(fs.slice(0,200).flatMap(x=>Object.keys(x.p)))],co=[["","— بدون —"],...cols.map(c=>[c,c])];
  opts($("#iO"),"",co);opts($("#iQ"),"",co);opts($("#iGF"),"",co);
  $("#iInfo").innerHTML=`عدد العناصر في الملف: <b>${fs.length}</b>${fs.length>5000?" (سيُستورد أول 5000 فقط)":""}. إن لم يحتوِ الملف مستوى خطورة فستأخذ كل السجلات المستوى الافتراضي المختار، وتبقى «بانتظار المراجعة» حتى يُستكمل تقييمها الميداني.`;
  $("#iMap").classList.remove("hide")};
$("#iGo").onclick=async()=>{if(!IMP)return;const t=tOf($("#iT").value),fo=$("#iO").value,fq=$("#iQ").value,fg=$("#iGF").value,key=(a,b)=>a.toFixed(5)+","+b.toFixed(5)+","+t.c;
  const seen=new Set(recs.filter(c=>tOf(c.type).c===t.c).map(c=>c.lat.toFixed(5)+","+c.lng.toFixed(5)+","+t.c));let bad=0,dup=0;const out=[];
  for(const x of IMP.slice(0,5000)){const g=x.g;let lat,lng,geom=null,area=null;
    if(/Polygon/.test(g.type)){const polys=g.type==="Polygon"?[g.coordinates]:g.coordinates,ring=polys[0][0];if(!ring||ring.length<4){bad++;continue}
      const c=geomPt(g)||centroid(ring);lng=c[0];lat=c[1];geom=g;area=polys.reduce((s,pl)=>s+gArea(pl[0]),0)}else[lng,lat]=g.coordinates;
    if(!(lat>=BB.la[0]&&lat<=BB.la[1]&&lng>=BB.ln[0]&&lng<=BB.ln[1])){bad++;continue}
    const k=key(lat,lng);if(seen.has(k)){dup++;continue}seen.add(k);const pv=x.p,gv=fg?String(pv[fg]??"").trim():"";
    out.push({type:t.k,owner:(fo?String(pv[fo]??"").trim().slice(0,120):"")||"مبنى مستورد",qty:Math.max(1,parseInt(fq?pv[fq]:1)||1),risk_level:guessRisk(gv)||$("#iG").value,district:$("#iD").value,district_code:distCodeOf(distMain($("#iD").value)),subdistrict_code:DIST_PARENT_OF[$("#iD").value]?distCodeOf($("#iD").value):null,usage_type:$("#iUse").value||null,lat,lng,geom,area_m2:area,source:$("#iS").value,notes:"مستورد من ملف: "+IMPN.slice(0,80)+" — يحتاج استكمال التقييم الميداني"})}
  if(!out.length)return toast(`لا يوجد ما يُستورد (خارج القطاع أو غير صالح: ${bad}، مكرر: ${dup}).`);
  $("#iGo").disabled=true;
  for(let i=0;i<out.length;i+=200){toast(`جارٍ الاستيراد… ${Math.min(i+200,out.length)} / ${out.length}`);const {error}=await sb.from("gz_records").insert(out.slice(i,i+200));
    if(error){$("#iGo").disabled=false;await load();return toast("توقف الاستيراد: "+error.message)}}
  $("#iGo").disabled=false;IMP=null;$("#iFile").value="";$("#iMap").classList.add("hide");toast(`تم استيراد ${out.length} سجل (تجاهل ${bad} غير صالح و${dup} مكرر).`);await load()};
