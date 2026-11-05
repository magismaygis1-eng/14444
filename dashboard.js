/* ================================================================
   dashboard.js — لوحة مؤشرات السلامة الإنشائية: المؤشرات، مصفوفة الخطورة، الرسوم، التحديث الفوري
   ================================================================ */
const ymd=x=>x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0");
const pick=(sel,val)=>{const el=$(sel);if(![...el.options].some(o=>o.value===val))return;el.value=el.value===val?"":val;if(sel==="#fDist")fSubRefresh();refresh()};
const hov=(e,els)=>{e.native.target.style.cursor=els.length?"pointer":"default"};
const chCard=(id,title,hint,cls="")=>`<div class="card ${cls}"><h2>${title}${hint?` <span class="hint">${hint}</span>`:""}</h2><div class="pane"><div class="cv ${cls.includes("tall")?"tall":""}"><canvas id="${id}"></canvas></div></div></div>`;
const chHtml=()=>`<div class="grid">${chCard("chT","وتيرة التقييم عبر الزمن","أعمدة حسب مستوى الخطورة · خط: التراكمي","wide")}${chCard("chG","توزيع مستويات الخطورة","انقر للتصفية")}${chCard("chD","الخطورة حسب الحي","انقر لتصفية الحي","tall")}${chCard("chC","نوع الهيكل الإنشائي","انقر للتصفية")}${chCard("chE","العناصر المتضررة (المباني الخطرة)","انقر للتصفية")}${chCard("chI","مؤشرات التلف الإنشائي (المباني الخطرة)","","wide")}${chCard("chO","الإشغال في المباني الخطرة","انقر للتصفية")}${chCard("chP","الأفراد المعرّضون للخطر حسب الحي")}${chCard("chS","حالة المراجعة","انقر للتصفية")}${isAll()?chCard("chM","إنجاز المهندسين","النسبة بين قوسين = المعتمد من المسجَّل","wide tall"):""}</div>`;
function drawCharts(v){Object.values(CH).forEach(c=>c.destroy());CH={};if(!v.length)return;
  const base=(x={})=>({responsive:true,maintainAspectRatio:false,animation:{duration:250},onHover:hov,...x}),
    leg=(s=true)=>({legend:{display:s,rtl:true,textDirection:"rtl",labels:{boxWidth:12}},tooltip:{rtl:true,textDirection:"rtl"}}),
    mk=(id,cfg)=>{const el=$("#"+id);if(el)CH[id]=new Chart(el,cfg)},
    ints={beginAtZero:true,ticks:{precision:0}},D=v.filter(c=>DANGER.has(c.risk_level)),
    tally=(a,f)=>{const o={};a.forEach(c=>[].concat(f(c)||[]).forEach(k=>{o[k]=(o[k]||0)+1}));return Object.entries(o).sort((x,y)=>y[1]-x[1])};
  /* الزمن: يوم/أسبوع/شهر حسب المدى، مكدّس حسب مستوى الخطورة */
  const ts=v.map(c=>new Date(c.created_at)).sort((a,b)=>a-b),last=ts[ts.length-1],span=(last-ts[0])/864e5,mode=span>120?"m":span>30?"w":"d";
  const mon=d=>{const x=new Date(d);if(mode==="w")x.setDate(x.getDate()-((x.getDay()+6)%7));return mode==="m"?ymd(x).slice(0,7):ymd(x)};
  const keys=[],d0=new Date(ts[0]);if(mode==="m")d0.setDate(1);else if(mode==="w")d0.setDate(d0.getDate()-((d0.getDay()+6)%7));
  for(const d=new Date(d0);d<=last&&keys.length<400;mode==="m"?d.setMonth(d.getMonth()+1):d.setDate(d.getDate()+(mode==="w"?7:1)))keys.push(mon(d));
  const mm={};v.forEach(c=>{const k=c.risk_level+"|"+mon(c.created_at);mm[k]=(mm[k]||0)+1});let run=0;
  const cum=keys.map(k=>(run+=RISK_K.reduce((s,r)=>s+(mm[r+"|"+k]||0),0)));
  const lab=k=>mode==="m"?new Date(k+"-01T00:00:00").toLocaleDateString("ar-EG",{month:"short",year:"2-digit"}):new Date(k+"T00:00:00").toLocaleDateString("ar-EG",{day:"numeric",month:"short"});
  mk("chT",{type:"bar",data:{labels:keys.map(lab),datasets:[...RISK_K.map(r=>({label:riskName(r),data:keys.map(k=>mm[r+"|"+k]||0),backgroundColor:riskCol(r),stack:"s"})),{type:"line",label:"التراكمي",data:cum,yAxisID:"y1",borderColor:"#12202e",backgroundColor:"#12202e",tension:.25,pointRadius:2}]},
    options:base({plugins:leg(),scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,...ints},y1:{position:"right",...ints,grid:{drawOnChartArea:false}}}})});
  const g=RISK_K.map(r=>[r,v.filter(c=>c.risk_level===r).length]).filter(x=>x[1]);
  mk("chG",{type:"doughnut",data:{labels:g.map(x=>riskLab(x[0])),datasets:[{data:g.map(x=>x[1]),backgroundColor:g.map(x=>riskCol(x[0]))}]},options:base({plugins:leg(),onClick:(e,els)=>els.length&&pick("#fRisk",g[els[0].index][0])})});
  const dl=tally(v,c=>distMain(c.district)).slice(0,10).map(x=>x[0]);
  mk("chD",{type:"bar",data:{labels:dl,datasets:RISK_K.map(r=>({label:riskName(r),backgroundColor:riskCol(r),data:dl.map(d=>v.filter(c=>distMain(c.district)===d&&c.risk_level===r).length)}))},
    options:base({indexAxis:"y",plugins:leg(),scales:{x:{stacked:true,...ints},y:{stacked:true,grid:{display:false}}},onClick:(e,els)=>els.length&&pick("#fDist",dl[els[0].index])})});
  const sc=tally(v,c=>c.structure_type||"—");
  mk("chC",{type:"bar",data:{labels:sc.map(x=>STRUCT[x[0]]||"غير محدد"),datasets:[{data:sc.map(x=>x[1]),backgroundColor:"#0b5563"}]},options:base({plugins:leg(false),scales:{y:ints,x:{grid:{display:false}}},onClick:(e,els)=>els.length&&pick("#fStruct",sc[els[0].index][0])})});
  const el=tally(D,c=>c.damaged_elements);
  mk("chE",{type:"bar",data:{labels:el.map(x=>ELEMS[x[0]]||x[0]),datasets:[{data:el.map(x=>x[1]),backgroundColor:"#e8590c"}]},options:base({indexAxis:"y",plugins:leg(false),scales:{x:ints,y:{grid:{display:false}}},onClick:(e,els)=>els.length&&pick("#fElem",el[els[0].index][0])})});
  const ind=tally(D,c=>c.damage_indicators);
  mk("chI",{type:"bar",data:{labels:ind.map(x=>INDIC[x[0]]||x[0]),datasets:[{data:ind.map(x=>x[1]),backgroundColor:"#b3141a"}]},options:base({indexAxis:"y",plugins:leg(false),scales:{x:ints,y:{grid:{display:false}}}})});
  const oc=Object.keys(OCC).map(k=>[k,D.filter(c=>c.occupancy===k).length]).filter(x=>x[1]),OCOL={occupied:"#b3141a",partial:"#e8a317",vacant:"#7b8794"};
  mk("chO",{type:"doughnut",data:{labels:oc.map(x=>OCC[x[0]]),datasets:[{data:oc.map(x=>x[1]),backgroundColor:oc.map(x=>OCOL[x[0]])}]},options:base({plugins:leg(),onClick:(e,els)=>els.length&&pick("#fOcc",oc[els[0].index][0])})});
  const pd={};D.forEach(c=>{const d=distMain(c.district);pd[d]=(pd[d]||0)+(+c.per||0)});const pl=Object.entries(pd).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]).slice(0,10);
  mk("chP",{type:"bar",data:{labels:pl.map(x=>x[0]),datasets:[{label:"أفراد معرّضون",data:pl.map(x=>x[1]),backgroundColor:"#b3141a"}]},options:base({indexAxis:"y",plugins:leg(false),scales:{x:ints,y:{grid:{display:false}}}})});
  const st=tally(v,c=>c.status);
  mk("chS",{type:"doughnut",data:{labels:st.map(x=>ST[x[0]][0]),datasets:[{data:st.map(x=>x[1]),backgroundColor:st.map(x=>ST[x[0]][1])}]},options:base({plugins:leg(),onClick:(e,els)=>els.length&&pick("#fSt",st[els[0].index][0])})});
  if(isAll()){const u={};v.forEach(c=>{const o=u[c.created_by]||(u[c.created_by]={a:0,p:0,r:0});o[c.status==="approved"?"a":c.status==="rejected"?"r":"p"]++});
    const us=Object.entries(u).sort((a,b)=>(b[1].a+b[1].p+b[1].r)-(a[1].a+a[1].p+a[1].r)).slice(0,12),nm=id=>NAMES[id]||"مستخدم "+String(id).slice(0,4);
    mk("chM",{type:"bar",data:{labels:us.map(([id,o])=>nm(id)+" ("+Math.round(o.a/(o.a+o.p+o.r)*100)+"%)"),datasets:[["معتمد","a",ST.approved[1]],["بانتظار المراجعة","p",ST.pending[1]],["مرفوض","r",ST.rejected[1]]].map(([l,k,c])=>({label:l,backgroundColor:c,data:us.map(x=>x[1][k])}))},
      options:base({indexAxis:"y",plugins:leg(),scales:{x:{stacked:true,...ints},y:{stacked:true,grid:{display:false}}}})})}}
/* ---- تحديث فوري من الفريق (Supabase Realtime) ---- */
function subscribeRT(){if(rt)return;rt=sb.channel("dbas-records").on("postgres_changes",{event:"*",schema:"public",table:"gz_records"},()=>{clearTimeout(rtT);rtT=setTimeout(async()=>{keepView=true;await load();keepView=false},1200)}).subscribe()}
function bars(title,pairs,colorFn){const mx=Math.max(1,...pairs.map(p=>p[1]));
  return `<div class="card"><h2>${title}</h2><div class="pane">${pairs.length?pairs.map(([k,n])=>`<div class="bar"><em>${esc(k)}</em><i style="--c:${colorFn?colorFn(k):"var(--pri)"};width:${n/mx*100}%"></i><span>${n}</span></div>`).join(""):'<p class="hint">لا توجد بيانات مطابقة بعد.</p>'}</div></div>`}
/* ---- مصفوفة الخطورة ومؤشرات التعرّض (تُستخدم في اللوحة والتقرير وExcel) ---- */
function riskStats(v){const N=x=>Number(x).toLocaleString("en-US"),pc=(a,b)=>b?Math.round(a/b*100)+"%":"—",sum=(a,f)=>a.reduce((s,c)=>s+(+f(c)||0),0),
    D=v.filter(c=>DANGER.has(c.risk_level)),occD=D.filter(c=>c.occupancy&&c.occupancy!=="vacant"),nearD=D.filter(c=>(c.proximity||[]).some(p=>p==="school"||p==="health")),
    undec=D.filter(c=>!c.committee_decision&&!c.draft),rc=k=>v.filter(c=>recOf(c).includes(k)).length;
  const k=[["مبانٍ داهمة وآيلة للسقوط",N(D.length)+" ("+pc(D.length,v.length)+")"],["منها مأهولة",N(occD.length)],["أفراد معرّضون للخطر المباشر",N(sum(D,c=>c.per))],["أسر معرّضة للخطر المباشر",N(sum(D,c=>c.fam))],
    ["مبانٍ خطرة قرب مدرسة أو مرفق صحي",N(nearD.length)],["بانتظار قرار اللجنة",N(undec.length)],["توصيات إخلاء عاجل",N(rc("evacuate"))],["توصيات إزالة وتهديم",N(rc("demolish"))],["توصيات تدعيم مؤقت",N(rc("shore"))],["توصيات صيانة واجهات",N(rc("maintain"))]];
  const rows=RISK_K.map(r=>{const a=v.filter(c=>c.risk_level===r);return[riskLab(r),a.length,pc(a.length,v.length),a.filter(c=>c.occupancy&&c.occupancy!=="vacant").length,sum(a,c=>c.fam),sum(a,c=>c.per),a.filter(c=>(c.proximity||[]).length).length,a.filter(c=>c.committee_decision).length]}),
    tot=["الإجمالي",v.length,v.length?"100%":"—",v.filter(c=>c.occupancy&&c.occupancy!=="vacant").length,sum(v,c=>c.fam),sum(v,c=>c.per),v.filter(c=>(c.proximity||[]).length).length,v.filter(c=>c.committee_decision).length],
    hd=["مستوى الخطورة","المباني","النسبة","مأهولة","الأسر","الأفراد","قرب مرافق حيوية","بقرار لجنة"];
  const dqn=v.filter(needsCompletion).length,dq=dqn?`<div class="hint" style="margin-top:8px">جودة البيانات: ${N(dqn)} تقييم ناقص (بلا هيكل أو إشغال، أو مبنى خطر بلا مؤشرات تلف أو توصية). <button class="btn sm" type="button" id="dDQ">عرض التقييمات الناقصة</button></div>`:"";
  const html=`<div class="card"><h2>مؤشرات التعرّض والقرار <span class="hint">ضمن الفلاتر الحالية</span></h2><div class="kpis" style="margin:0;border:0;border-radius:0">${k.map(([l,x])=>`<div class="kpi"><b style="font-size:22px">${x}</b><span>${l}</span></div>`).join("")}</div>${dq}
  <div class="scroll"><table><thead><tr>${hd.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${[...rows,tot].map((r,i)=>`<tr style="cursor:default${i===rows.length?";font-weight:700;background:#f0f3f5":""}">${r.map((x,j)=>`<td>${j&&typeof x==="number"?N(x):x}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
  return{html,sum:[["— مؤشرات التعرّض والقرار —",""],...k,["— مصفوفة الخطورة —",""],hd,...rows,tot]}}
function dash(){const v=view(),cnt=f=>{const o={};v.forEach(c=>{const k=f(c);o[k]=(o[k]||0)+1});return Object.entries(o).sort((a,b)=>b[1]-a[1])},n=r=>v.filter(c=>c.risk_level===r).length;
  const K=[["المباني المقيَّمة",v.length],["🔴 خطورة داهمة",n("critical")],["🟠 آيل للسقوط",n("high")],["🟡 خطورة متوسطة",n("medium")],["🟢 آمن",n("safe")],["طوابق مرصودة",v.reduce((a,c)=>a+(+c.qty||0),0)],["بانتظار المراجعة",v.filter(c=>c.status==="pending").length],["عالية الثقة",v.filter(c=>cLvl(c)==="عالية").length],["تعارضات للمراجعة",v.filter(c=>CF.has(c.id)).length]];
  const KC=["#12202e",riskCol("critical"),riskCol("high"),riskCol("medium"),riskCol("safe"),"#0b5563","#5d6b78","#2e7d32","#d9a400"];
  const E=riskStats(v),S=safety(v);SUM=[["المؤشر","القيمة"],...K,...E.sum,...S.sum,...distStatSum(),...cnt(c=>distMain(c.district)).map(([k,x])=>["حي: "+k,x]),...cnt(c=>riskName(c.risk_level)).map(([k,x])=>["خطورة: "+k,x])];
  const al=v.filter(alertOf),crit=n("critical");
  const alertBar=al.length?`<div class="msg" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 14px;border-width:2px"><b>🚨 ${NF(al.length)} مبنى عليه تنبيه سلامة</b><span>${crit?NF(crit)+" بخطورة داهمة / انهيار وشيك · ":""}مبانٍ آيلة ما زالت مأهولة، ذخائر، شهداء تحت الأنقاض أو موقع منهار.</span><button class="btn sm bad" type="button" id="dAlert" style="margin-inline-start:auto">عرض المباني</button></div>`:"";
  $("#dash").innerHTML=`${alertBar}<div class="card noprint"><h2>التقارير والتصدير <span class="st">${NF(v.length)} سجل ضمن الفلاتر الحالية</span></h2><div class="pane">
    <div class="row end" style="margin-bottom:8px"><button class="btn gold" type="button" data-act="report" title="تقرير رسمي A4 بالمؤشرات والرسوم والجداول والتوصيات، جاهز للطباعة أو الحفظ PDF">📄 تقرير السلامة الإنشائية (PDF)</button><button class="btn pri" type="button" data-act="xlsx" title="مصنّف Excel متعدد الأوراق">📊 مصنّف Excel متكامل</button><button class="btn pri" data-x="geob" type="button" title="معلم لكل مبنى (بصمة أو نقطة) بكل حقول السلامة الإنشائية">🗺 GeoJSON المباني</button><button class="btn" data-x="bundle" type="button" title="ZIP: GeoJSON وCSV + csvt + schema.ini + البصمات + دليل">حزمة GIS (ZIP)</button></div>
    <details><summary class="hint" style="cursor:pointer;font-weight:700">صيغ إضافية</summary><div class="row end" style="margin-top:8px"><button class="btn" data-x="csvb" type="button">CSV المباني</button><button class="btn" data-x="geo" type="button" title="نقطة لكل وحدة سكنية">GeoJSON – صف لكل وحدة</button><button class="btn" data-x="csv" type="button" title="صف لكل وحدة">CSV – صف لكل وحدة</button><button class="btn" data-x="sum" type="button">ملخص المؤشرات (CSV)</button><button class="btn" type="button" data-act="print-dash">طباعة لوحة المؤشرات</button></div></details>
    <label class="hint" style="display:block;margin-top:10px" title="يحذف الأسماء والعناوين والملاحظات ويقرّب الإحداثيات (~100 م)"><input type="checkbox" class="anonc" style="width:auto" ${ANON?"checked":""}> تصدير مُجهَّل (بدون أسماء وعناوين وملاحظات، وإحداثيات مقرّبة)</label></div></div>
  <div class="sec-t">المؤشرات العامة</div><div class="kpis">${K.map(([l,x],i)=>`<div class="kpi" style="--kc:${KC[i]||"var(--pri)"}"><b>${NF(x)}</b><span>${l}</span></div>`).join("")}</div>
  <div class="sec-t">التعرّض والقرار الهندسي</div>${E.html}${S.html}<div class="sec-t">الإنجاز الميداني</div>${distStatHtml()}<div class="sec-t">التحليل البياني</div>${typeof Chart==="undefined"?`<div class="grid">${bars("حسب مستوى الخطورة",cnt(c=>riskName(c.risk_level)))}${bars("حسب الهيكل الإنشائي",cnt(c=>STRUCT[c.structure_type]||"غير محدد"))}${bars("حسب الحي",cnt(c=>distMain(c.district)).slice(0,8))}${bars("حالة المراجعة",cnt(c=>ST[c.status][0]))}</div>`:chHtml()}`;
  const da=$("#dAlert");if(da)da.onclick=()=>{$("#fRisk").value="alert";show("list")};
  const dq=$("#dDQ");if(dq)dq.onclick=()=>{DQ_ONLY=true;show("list")};
  if(typeof Chart!=="undefined")drawCharts(v)}
