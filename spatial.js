/* ================================================================
   spatial.js — التحليل المكاني للخطورة ودعم القرار:
   كثافة المباني الخطرة (Getis-Ord Gi*)، الأحياء الأكثر عرضة للتهديد (MCDA + حساسية)،
   نطاقات التأثير والحماية (Buffer) حول المباني الداهمة والآيلة مع المباني والطرق المجاورة، الارتباط المكاني (Moran's I)
   ================================================================ */
/* وزن الخطورة: داهمة 4، آيلة 3، متوسطة 1، آمن 0 */
const SEV={critical:4,high:3,medium:1,safe:0};
const MET={d:["المباني الداهمة والآيلة",c=>DANGER.has(c.risk_level)?1:0],w:["مؤشر الخطورة المرجّح",c=>SEV[c.risk_level]||0],p:["الأفراد المعرّضون",c=>DANGER.has(c.risk_level)?(+c.per||0):0],n:["عدد المباني المقيَّمة",()=>1]};
const PW={sev:"متوسط شدة الخطورة",cnt:"عدد المباني الداهمة والآيلة",per:"الأفراد المعرّضون",occ:"نسبة المأهول من المباني الخطرة",prox:"مبانٍ خطرة قرب مرافق حيوية"};
const SPM=[["hot","كثافة المباني الخطرة"],["prio","الأحياء الأكثر عرضة للتهديد"],["buf","نطاقات التأثير والحماية"],["mor","الارتباط المكاني"]];
let SP={mode:"hot",size:250,met:"d",unit:"d",lv:"danger",w:{sev:25,cnt:25,per:25,occ:15,prox:10},map:null,grp:null,res:null},ROADS=[],ROADS_SRC="",spT;
const spData=()=>view();
const erf=x=>{const s=Math.sign(x);x=Math.abs(x);const q=1/(1+.3275911*x);return s*(1-(((((1.061405429*q-1.453152027)*q)+1.421413741)*q-.284496736)*q+.254829592)*q*Math.exp(-x*x))};
const pval=z=>1-erf(Math.abs(z)/Math.SQRT2),dom=a=>{const o={};a.forEach(c=>o[c.district]=(o[c.district]||0)+1);return Object.entries(o).sort((x,y)=>y[1]-x[1])[0][0]};
const pct=(a,b)=>b?Math.round(a/b*100):0;
function hull(P){P=[...P].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(P.length<3)return P;const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lo=[],up=[];
  for(const p of P){while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}for(const p of [...P].reverse()){while(up.length>1&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}lo.pop();up.pop();return lo.concat(up)}
/* شبكة مربعة؛ منطقة الدراسة = الغلاف المحدب للنقاط حتى لا تُحسب خلايا البحر والفراغ الخارجي كأصفار فتزيّف الارتباط */
function mkGrid(pts,s,val){if(!pts.length)return null;const la0=pts.reduce((a,p)=>a+p.lat,0)/pts.length,kx=111320*Math.cos(la0*Math.PI/180),ky=110540,xs=pts.map(p=>p.lng*kx),ys=pts.map(p=>p.lat*ky),
  x0=Math.min(...xs)-1,y0=Math.min(...ys)-1,nx=Math.floor((Math.max(...xs)-x0)/s)+1,ny=Math.floor((Math.max(...ys)-y0)/s)+1;if(nx*ny>40000)return null;
  const X=new Float64Array(nx*ny),N=new Float64Array(nx*ny),A=new Uint8Array(nx*ny),m=new Map(),H=hull(xs.map((x,i)=>[x,ys[i]]));
  pts.forEach((p,i)=>{const k=Math.floor((ys[i]-y0)/s)*nx+Math.floor((xs[i]-x0)/s);X[k]+=val(p);N[k]++;(m.get(k)||m.set(k,[]).get(k)).push(p)});
  let nA=0;for(let k=0;k<nx*ny;k++){const cx=x0+(k%nx+.5)*s,cy=y0+(Math.floor(k/nx)+.5)*s;if(N[k]>0||H.length<3||inRing(cx,cy,H)){A[k]=1;nA++}}
  return{nx,ny,s,x0,y0,kx,ky,X,N,A,nA,m}}
const gcb=(g,k)=>{const ix=k%g.nx,iy=Math.floor(k/g.nx);return[[(g.y0+iy*g.s)/g.ky,(g.x0+ix*g.s)/g.kx],[(g.y0+(iy+1)*g.s)/g.ky,(g.x0+(ix+1)*g.s)/g.kx]]};
const gpoly=(g,k)=>{const b=gcb(g,k);return{type:"Polygon",coordinates:[[[b[0][1],b[0][0]],[b[1][1],b[0][0]],[b[1][1],b[1][0]],[b[0][1],b[1][0]],[b[0][1],b[0][0]]]]}};
function nbrs(g,k){const ix=k%g.nx,iy=Math.floor(k/g.nx),o=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const jx=ix+dx,jy=iy+dy;if(jx>=0&&jx<g.nx&&jy>=0&&jy<g.ny&&g.A[jy*g.nx+jx])o.push(jy*g.nx+jx)}return o}
/* Getis-Ord Gi* بجوار Queen (8 خلايا) وأوزان ثنائية تشمل الخلية نفسها */
function giStar(g){const n=g.nA;let sx=0,sxx=0;for(let k=0;k<g.X.length;k++)if(g.A[k]){sx+=g.X[k];sxx+=g.X[k]**2}const m=sx/n,S=Math.sqrt(sxx/n-m*m),z=new Float64Array(g.X.length);if(!S)return z;
  for(let k=0;k<g.X.length;k++){if(!g.A[k])continue;const nb=nbrs(g,k),kc=nb.length+1;let s=g.X[k];for(const j of nb)s+=g.X[j];z[k]=(s-m*kc)/(S*Math.sqrt((n*kc-kc*kc)/(n-1)))}return z}
/* Moran's I العام بأوزان Queen الثنائية (توزيع طبيعي) */
function moran(g){const n=g.nA;let m=0;for(let k=0;k<g.X.length;k++)if(g.A[k])m+=g.X[k];m/=n;let den=0;for(let k=0;k<g.X.length;k++)if(g.A[k])den+=(g.X[k]-m)**2;if(!den)return null;let num=0,W=0,sk=0;
  for(let k=0;k<g.X.length;k++){if(!g.A[k])continue;const nb=nbrs(g,k);W+=nb.length;sk+=nb.length**2;for(const j of nb)num+=(g.X[k]-m)*(g.X[j]-m)}
  const I=n/W*num/den,E=-1/(n-1),V=(n*n*2*W-n*4*sk+3*W*W)/((n*n-1)*W*W)-E*E,z=(I-E)/Math.sqrt(V);return{I,E,z,p:pval(z),n}}
function spInit(){if(!SP.map){SP.map=L.map("spm",{maxZoom:20,preferCanvas:true}).setView([31.5017,34.4668],12);L.tileLayer(BASE.sat[0],{attribution:BASE.sat[1],maxNativeZoom:18,maxZoom:20}).addTo(SP.map);L.tileLayer(LBL,{maxNativeZoom:18,maxZoom:20}).addTo(SP.map);SP.grp=L.layerGroup().addTo(SP.map)}
  setTimeout(()=>SP.map.invalidateSize(),60);spCtl()}
function spCtl(){const m=SP.mode,o=(a,c)=>a.map(([v,t])=>`<option value="${v}"${String(c)===String(v)?" selected":""}>${t}</option>`).join("");
  const size=`<div><label>حجم الخلية</label><select data-k="size">${o([[100,"100 م"],[250,"250 م"],[500,"500 م"],[1000,"1 كم"]],SP.size)}</select></div>`,met=`<div><label>المؤشر</label><select data-k="met">${o(Object.entries(MET).map(([k,v])=>[k,v[0]]),SP.met)}</select></div>`;let h="";
  if(m==="hot"||m==="mor")h=met+size;
  if(m==="prio")h=`<div><label>وحدة التحليل</label><select data-k="unit">${o([["d","الأحياء"],["g","شبكة خلايا"]],SP.unit)}</select></div>`+(SP.unit==="g"?size:"")+Object.entries(PW).map(([k,l])=>`<div><label>وزن ${l}: <b id="pw_${k}">${SP.w[k]}</b></label><input type="range" min="0" max="100" value="${SP.w[k]}" data-k="w.${k}"></div>`).join("");
  if(m==="buf")h=`<div><label>المباني المصدر</label><select data-k="lv">${o([["danger","🔴🟠 الداهمة والآيلة للسقوط"],["critical","🔴 الداهمة فقط"]],SP.lv)}</select></div>
    <div><label>نصف القطر = المعامل × الارتفاع</label><div class="hint" style="margin:6px 0 0">المعامل ${APPSET.buffer_factor} · ارتفاع الطابق ${APPSET.floor_height_m} م · حد أدنى 10 م (يضبطها المدير في الإعدادات)</div></div>
    <div><label>طبقة الشوارع</label><div class="hint" style="margin:4px 0">${ROADS.length?`محمّلة: ${NF(ROADS.length)} مقطع (${ROADS_SRC==="server"?"من الخادم":"محلية، غير منشورة"})`:"غير محمّلة: لن تُحدَّد الطرق"}</div>
      <button class="btn sm" type="button" id="rdPick">تحميل ملف شوارع…</button>${me&&me.role==="admin"&&ROADS.length&&ROADS_SRC==="local"?' <button class="btn sm pri" type="button" id="rdPub">نشر للفريق</button>':""}<input id="rdF" type="file" accept=".geojson,.json,.zip" class="hide" tabindex="-1" aria-hidden="true"></div>`;
  $("#spCtl").innerHTML=h;$("#spTabs").innerHTML=SPM.map(([k,t])=>`<button class="btn${k===m?" pri":""}" data-m="${k}">${t}</button>`).join("")}
$("#spCtl").addEventListener("input",e=>{const k=e.target.dataset.k;if(!k)return;const v=e.target.type==="checkbox"?e.target.checked:e.target.value;
  if(k.startsWith("w.")){SP.w[k.slice(2)]=+v;const l=$("#pw_"+k.slice(2));if(l)l.textContent=v}else SP[k]=k==="size"?+v:v;
  if(k==="unit")spCtl();clearTimeout(spT);spT=setTimeout(spRun,250)});
$("#spCtl").addEventListener("change",e=>{if(e.target.id==="rdF")roadsFromFile(e.target)});
$("#spCtl").addEventListener("click",e=>{if(e.target.id==="rdPick")$("#rdF").click();else if(e.target.id==="rdPub")roadsPublish()});
$("#spTabs").onclick=e=>{const m=e.target.dataset.m;if(m){SP.mode=m;spCtl();spRun()}};
/* ---- طبقة الشوارع: خطوط GeoJSON (LineString/MultiLineString)، يرفعها المدير مرة وتصل للفريق وتعمل دون اتصال ---- */
const roadName=p=>String(p&&(p["name:ar"]||p.name||p["الاسم"]||p.street||p.NAME)||"").trim();
function roadsParse(feats){const out=[];for(const f of feats){const g=f&&f.geometry;if(!g)continue;const ls=g.type==="LineString"?[g.coordinates]:g.type==="MultiLineString"?g.coordinates:[];
  for(const l of ls)if(Array.isArray(l)&&l.length>1)out.push({n:roadName(f.properties)||"طريق بلا اسم",t:String((f.properties||{}).highway||""),c:l.map(q=>[+q[0],+q[1]])})}return out}
async function roadsFromFile(inp){const f=inp.files[0];if(!f)return;try{const R=roadsParse(await readGeo(f));if(!R.length)return toast("لا توجد خطوط شوارع في الملف.");
  ROADS=R;ROADS_SRC="local";await kvPut("roads",{src:"local",list:R});toast(`تم تحميل ${NF(R.length)} مقطع شارع.`);spCtl();spRun()}catch(e){toast("تعذّر قراءة الملف: "+e.message)}}
async function roadsPublish(){if(!ROADS.length)return;try{const blob=await gzip(JSON.stringify(ROADS)),gz=typeof CompressionStream!=="undefined",path="roads-"+crypto.randomUUID()+(gz?".json.gz":".json");
  const up=await sb.storage.from("gz-ref").upload(path,blob,{contentType:gz?"application/gzip":"application/json"});if(up.error)throw up.error;
  const {data:prev}=await sb.from("gz_ref_layers").select("file_path").eq("district",ROADS_KEY).maybeSingle();
  const {error}=await sb.from("gz_ref_layers").upsert({district:ROADS_KEY,file_path:path,features:ROADS.length,source_name:"طبقة الشوارع",uploaded_at:new Date().toISOString()},{onConflict:"district"});
  if(error){await sb.storage.from("gz-ref").remove([path]);throw error}if(prev&&prev.file_path)sb.storage.from("gz-ref").remove([prev.file_path]);
  ROADS_SRC="server";await kvPut("roads",{src:"server",path,list:ROADS});toast("نُشرت طبقة الشوارع للفريق.");spCtl()}catch(e){toast("تعذّر النشر: "+(e.message||e))}}
async function roadsSync(){const c=await kvGet("roads");if(c&&Array.isArray(c.list)){ROADS=c.list;ROADS_SRC=c.src}
  if(!navigator.onLine||OFFMODE)return;try{const {data}=await sb.from("gz_ref_layers").select("file_path").eq("district",ROADS_KEY).maybeSingle();if(!data||(c&&c.path===data.file_path))return;
    const {data:b,error}=await sb.storage.from("gz-ref").download(data.file_path);if(error||!b)return;
    const list=JSON.parse(data.file_path.endsWith(".gz")?await gunzip(b):await b.text());ROADS=list;ROADS_SRC="server";await kvPut("roads",{src:"server",path:data.file_path,list});if(cur==="spat")spCtl()}catch{}}
const spLeg=a=>$("#spLeg").innerHTML=a.map(([c,t])=>`<span><i style="--c:${c}"></i>${t}</span>`).join("");
function spEmpty(msg){if(SP.grp)SP.grp.clearLayers();SP.res=null;spLeg([]);$("#spRes").innerHTML=`<p class="hint">${msg}</p>`}
function spShow(kpis,text,head,rows,geo,note){SP.res={head,rows,geo};
  $("#spRes").innerHTML=`<div class="kpis" style="margin:0 0 12px">${kpis.map(([l,x])=>`<div class="kpi"><b style="font-size:22px">${x}</b><span>${l}</span></div>`).join("")}</div>${text?`<div class="msg" style="background:#e8f1f3;color:#12202e;line-height:1.9"><b>ملخص لدعم القرار:</b> ${text}</div>`:""}
  <div class="scroll"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.slice(0,50).map((r,i)=>`<tr data-i="${i}" style="cursor:${r.z?"pointer":"default"}">${r.c.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${rows.length>50?`<p class="hint">يُعرض أول 50 من ${rows.length}. التصدير يشمل الكل.</p>`:""}<p class="hint">${note||""}</p>
  <div class="row noprint" style="margin-top:8px"><button class="btn sm" data-sx="csv">تصدير الجدول CSV</button><button class="btn sm" data-sx="geo">تصدير الخريطة GeoJSON</button><button class="btn sm pri" data-sx="print">طباعة تقرير القرار</button></div>`}
$("#spRes").onclick=e=>{const x=e.target.dataset.sx,tr=e.target.closest("tr[data-i]");
  if(x&&SP.res){if(x==="print")return printDash();const q=v=>'"'+String(v).replace(/"/g,'""')+'"';
    if(x==="csv")dl("spatial-"+SP.mode+".csv","\ufeff"+[SP.res.head.map(q).join(","),...SP.res.rows.map(r=>r.c.map(q).join(","))].join("\n"),"text/csv;charset=utf-8");
    else dl("spatial-"+SP.mode+".geojson",JSON.stringify({type:"FeatureCollection",features:SP.res.geo}),"application/geo+json");return}
  if(tr&&SP.res){const z=SP.res.rows[+tr.dataset.i].z;if(z)Array.isArray(z[0])?SP.map.fitBounds(z,{maxZoom:18}):SP.map.setView(z,18)}};
function spRun(){if(!SP.map)return;SP.grp.clearLayers();({hot:spHot,prio:spPrio,buf:spBuf,mor:spMor})[SP.mode]()}
function spHot(){const B=spData(),Mt=MET[SP.met];if(!B.length)return spEmpty("لا توجد مبانٍ ضمن الفلاتر الحالية.");const g=mkGrid(B,SP.size,Mt[1]);if(!g)return spEmpty("حجم الخلية صغير جداً لهذا النطاق. اختر حجماً أكبر.");
  const z=giStar(g),cls=v=>v>=2.58?[3,"#b3141a","ساخنة 99%"]:v>=1.96?[2,"#e8590c","ساخنة 95%"]:v>=1.65?[1,"#f2b705","ساخنة 90%"]:v<=-2.58?[-3,"#0b3d91","باردة 99%"]:v<=-1.96?[-2,"#1c6ed5","باردة 95%"]:v<=-1.65?[-1,"#9fc5f0","باردة 90%"]:[0,"#c9d2d8","غير دالة"];
  const cells=[],geo=[];let c99=0,c95=0,c90=0,hotSum=0,tot=0;
  for(let k=0;k<g.X.length;k++){if(!g.N[k])continue;const c=cls(z[k]);cells.push({k,z:z[k],c});tot+=g.X[k];if(c[0]>0){hotSum+=g.X[k];c[0]===3?c99++:c[0]===2?c95++:c90++}
    L.rectangle(gcb(g,k),{color:c[1],weight:.5,fillColor:c[1],fillOpacity:c[0]?.65:.28}).bindPopup(`<b>${Mt[0]}: ${NF(g.X[k])}</b><br>المباني: ${g.N[k]}<br>Gi* z = ${z[k].toFixed(2)} (${c[2]})`).addTo(SP.grp);
    geo.push({type:"Feature",geometry:gpoly(g,k),properties:{value:g.X[k],buildings:g.N[k],z:+z[k].toFixed(2),class:c[2]}})}
  spLeg([["#b3141a","ساخنة 99%"],["#e8590c","ساخنة 95%"],["#f2b705","ساخنة 90%"],["#c9d2d8","غير دالة"],["#1c6ed5","باردة"]]);SP.map.fitBounds(L.latLngBounds([[g.y0/g.ky,g.x0/g.kx],[(g.y0+g.ny*g.s)/g.ky,(g.x0+g.nx*g.s)/g.kx]]));
  const hot=c99+c95+c90,top=cells.filter(c=>c.c[0]>0).sort((a,b)=>b.z-a.z),list=(top.length?top:cells.sort((a,b)=>g.X[b.k]-g.X[a.k])).slice(0,15);
  const rows=list.map((c,i)=>{const b=gcb(g,c.k);return{c:[i+1,esc(dom(g.m.get(c.k))),NF(g.X[c.k]),g.N[c.k],c.z.toFixed(2),c.c[2]],z:b}});
  const dd={};top.forEach(c=>{const d=dom(g.m.get(c.k));dd[d]=(dd[d]||0)+1});const td=Object.entries(dd).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
  spShow([["خلايا بها بيانات",NF(cells.length)],["بؤر ساخنة 99%",c99],["بؤر ساخنة 95%",c95],["بؤر ساخنة 90%",c90],["حصة البؤر من "+Mt[0],pct(hotSum,tot)+"%"]],
   hot?`رُصدت ${hot} خلية بؤرة ساخنة (${c99} بثقة 99%) من ${cells.length} خلية، وتضم ${pct(hotSum,tot)}% من إجمالي «${Mt[0]}». أكثر الأحياء احتواءً لها: ${esc(td.join("، "))}. يُنصح بتوجيه فرق التقييم التفصيلي والتدعيم والإخلاء إلى هذه الخلايا أولاً.`:`لا توجد بؤر دالة إحصائياً عند خلايا ${SP.size} م؛ المباني الخطرة موزعة بلا تجمع واضح. جرّب حجماً مختلفاً.`,
   ["#","الحي الغالب",Mt[0],"المباني","قيمة z","التصنيف"],rows,geo,"Getis-Ord Gi* بجوار 8 خلايا (Queen). الدلالة غير مصحَّحة للاختبارات المتعددة، فاستخدم النتيجة لترتيب الاهتمام لا كدليل نهائي. تتغير النتائج مع حجم الخلية والفلاتر.")}
function spPrio(){const B=spData();if(!B.length)return spEmpty("لا توجد مبانٍ ضمن الفلاتر الحالية.");let U=[];
  if(SP.unit==="d"){const m=new Map();B.forEach(c=>(m.get(c.district)||m.set(c.district,[]).get(c.district)).push(c));U=[...m].map(([n,a])=>({n,a}))}
  else{const g=mkGrid(B,SP.size,()=>1);if(!g)return spEmpty("حجم الخلية صغير جداً لهذا النطاق. اختر حجماً أكبر.");U=[...g.m].map(([k,a])=>({n:`خلية ${k%g.nx}-${Math.floor(k/g.nx)} (${dom(a)})`,a,b:gcb(g,k),poly:gpoly(g,k)}))}
  const keys=Object.keys(PW),sm=(a,f)=>a.reduce((s,c)=>s+(+f(c)||0),0),F=U.map(u=>{const a=u.a,n=a.length,D=a.filter(c=>DANGER.has(c.risk_level));return{sev:sm(a,c=>SEV[c.risk_level])/n/4,cnt:D.length,per:sm(D,c=>c.per),occ:D.length?D.filter(c=>c.occupancy&&c.occupancy!=="vacant").length/D.length:0,prox:D.filter(c=>(c.proximity||[]).length).length,units:sm(D,c=>c.units),fam:sm(D,c=>c.fam)}});
  const mn={},mx={};keys.forEach(k=>{const v=F.map(f=>f[k]);mn[k]=Math.min(...v);mx[k]=Math.max(...v)});
  const norm=F.map(f=>Object.fromEntries(keys.map(k=>[k,mx[k]>mn[k]?(f[k]-mn[k])/(mx[k]-mn[k]):0]))),score=w=>{const s=keys.reduce((t,k)=>t+w[k],0)||1;return norm.map(o=>100*keys.reduce((t,k)=>t+w[k]*o[k],0)/s)};
  const sc=score(SP.w),top=Math.max(1,Math.ceil(U.length*.2)),hits=new Array(U.length).fill(0),R=200;
  for(let r=0;r<R;r++){const w=Object.fromEntries(keys.map(k=>[k,SP.w[k]*(.5+Math.random())])),s2=score(w);s2.map((v,i)=>i).sort((a,b)=>s2[b]-s2[a]).slice(0,top).forEach(i=>hits[i]++)}
  const ord=sc.map((v,i)=>i).sort((a,b)=>sc[b]-sc[a]),rank=[];ord.forEach((i,r)=>rank[i]=r+1);
  const cl=i=>{const q=rank[i]/U.length;return q<=.2?["أولوية قصوى","#9d1c1c"]:q<=.4?["عالية","#e8590c"]:q<=.7?["متوسطة","#d9a400"]:["منخفضة","#7b8794"]};
  const geo=[],rows=ord.map(i=>{const u=U[i],f=F[i],c=cl(i),a=u.a,la=a.reduce((s,x)=>s+x.lat,0)/a.length,ln=a.reduce((s,x)=>s+x.lng,0)/a.length,pop=`<b>${esc(u.n)}</b><br>الترتيب ${rank[i]} · الدرجة ${sc[i].toFixed(1)}<br>${c[0]}<br>المباني ${a.length} · الداهمة والآيلة ${NF(f.cnt)} · الأفراد المعرّضون ${NF(f.per)}`;
    if(u.b)L.rectangle(u.b,{color:c[1],weight:.5,fillColor:c[1],fillOpacity:.6}).bindPopup(pop).addTo(SP.grp);else L.circleMarker([la,ln],{radius:8+Math.sqrt(a.length)*2,color:"#fff",weight:2,fillColor:c[1],fillOpacity:.85}).bindPopup(pop).addTo(SP.grp);
    geo.push({type:"Feature",geometry:u.poly||{type:"Point",coordinates:[ln,la]},properties:{name:u.n,rank:rank[i],score:+sc[i].toFixed(1),class:c[0],buildings:a.length,dangerous:f.cnt,persons_at_risk:f.per,families_at_risk:f.fam,occupied_share:pct(f.occ*100,100),near_facilities:f.prox,stability:pct(hits[i],R)}});
    return{c:[rank[i],esc(u.n),a.length,NF(f.cnt),NF(f.per),pct(f.occ*100,100)+"%",NF(f.prox),(f.sev*4).toFixed(1)+"/4",sc[i].toFixed(1),c[0],pct(hits[i],R)+"%"],z:u.b||[la,ln]}});
  spLeg([["#9d1c1c","أولوية قصوى"],["#e8590c","عالية"],["#d9a400","متوسطة"],["#7b8794","منخفضة"]]);SP.map.fitBounds(L.latLngBounds(B.map(c=>[c.lat,c.lng])).pad(.15),{maxZoom:16});
  const T=ord.slice(0,top),sh=f=>pct(T.reduce((s,i)=>s+f(i),0),U.reduce((s,_,i)=>s+f(i),0)),names=T.slice(0,3).map(i=>U[i].n.replace(/ \(.*/,""));
  spShow([["وحدات التحليل",U.length],["الأكثر عرضة للتهديد",top],["حصتها من المباني الخطرة",sh(i=>F[i].cnt)+"%"],["حصتها من الأفراد المعرّضين",sh(i=>F[i].per)+"%"],["حصتها من المباني المقيَّمة",sh(i=>U[i].a.length)+"%"]],
   `الأكثر عرضة للتهديد: ${esc(names.join("، "))}${top>3?" وغيرها":""}. تضم ${sh(i=>F[i].cnt)}% من المباني الداهمة والآيلة للسقوط و${sh(i=>F[i].per)}% من الأفراد المعرّضين للخطر المباشر. نقترح توجيه فرق الإخلاء والتدعيم ولجان القرار إليها أولاً. ثبات الترتيب لأعلى وحدة: ${pct(hits[ord[0]],R)}% عند تغيير الأوزان عشوائياً.`,
   ["الترتيب","الوحدة","المباني","داهمة وآيلة","أفراد معرّضون","مأهول من الخطرة","قرب مرافق","شدة الخطورة","الدرجة","الفئة","الثبات"],rows,geo,"الدرجة نسبية بين الوحدات الظاهرة وتتغير مع الفلاتر. الأوزان قابلة للتعديل. «الثبات» نسبة المرات التي بقيت فيها الوحدة ضمن أعلى 20% في 200 تجربة بأوزان تتغير ±50%؛ فكلما ارتفع كان القرار أمتن.")}
/* ---- نطاقات التأثير والحماية (Buffer) ----
   لكل مبنى داهم/آيل: نصف القطر = المعامل × (عدد الطوابق × ارتفاع الطابق)، بحد أدنى 10 م (نطاق الانهيار التقريبي).
   داخل النطاق: المباني المجاورة (السجلات المقيَّمة + بصمات الطبقة المرجعية) والطرق (طبقة الشوارع) الواجب إغلاقها أو حمايتها.
   المسافة من نقطة المبنى (داخل البصمة) إلى نقطة المبنى المجاور أو أقرب نقطة على مقطع الطريق، على إسقاط محلي بالمتر. */
function circlePoly(lat,lng,r,n=48){const kx=111320*Math.cos(lat*Math.PI/180),ky=110540,ring=[];for(let i=0;i<=n;i++){const a=i/n*2*Math.PI;ring.push([lng+r*Math.cos(a)/kx,lat+r*Math.sin(a)/ky])}return{type:"Polygon",coordinates:[ring]}}
function segDist(px,py,ax,ay,bx,by){let dx=bx-ax,dy=by-ay,t=dx||dy?((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy):0;t=Math.max(0,Math.min(1,t));const x=ax+t*dx-px,y=ay+t*dy-py;return Math.hypot(x,y)}
function spBuf(){const src=view().filter(c=>SP.lv==="critical"?c.risk_level==="critical":DANGER.has(c.risk_level)).filter(c=>isFinite(c.lat)&&isFinite(c.lng));
  if(!src.length)return spEmpty("لا توجد مبانٍ داهمة أو آيلة للسقوط ضمن الفلاتر الحالية.");
  const la0=src[0].lat,kx=111320*Math.cos(la0*Math.PI/180),ky=110540,P=(lat,lng)=>[lng*kx,lat*ky];
  /* المباني المجاورة المرشّحة: كل السجلات المرئية (لا الفلاتر فقط) + بصمات الطبقة المرجعية غير الموثّقة */
  const docIds=new Set(),nb=recs.filter(c=>c.status!=="rejected"&&isFinite(c.lat)).map(c=>({id:c.id,n:c.owner,lat:c.lat,lng:c.lng,rec:c}));
  (REF||[]).forEach((x,i)=>{if((REFHIT[i]||[]).length)return;const p=geomPt(x.g);if(p)nb.push({id:"ref-"+i,n:(x.p&&(x.p.owner||x.p.name))||"مبنى من الطبقة المرجعية",lat:p[1],lng:p[0]})});
  const roadsXY=ROADS.map(r=>({n:r.n,t:r.t,xy:r.c.map(q=>P(q[1],q[0]))}));
  const roadsHit=new Map(),bldHit=new Map(),geo=[],rows=[];let pers=0;
  for(const c of src){const fl=Math.max(1,+c.qty||1),r=bufR(fl),[x0,y0]=P(c.lat,c.lng),col=riskCol(c.risk_level);
    const near=nb.filter(o=>o.id!==c.id&&Math.hypot(o.lng*kx-x0,o.lat*ky-y0)<=r);
    const rd=[];for(const rr of roadsXY){let m=Infinity;for(let i=0;i<rr.xy.length-1;i++){m=Math.min(m,segDist(x0,y0,rr.xy[i][0],rr.xy[i][1],rr.xy[i+1][0],rr.xy[i+1][1]));if(m===0)break}if(m<=r)rd.push({n:rr.n,d:m})}
    const rdNames=[...new Set(rd.sort((a,b)=>a.d-b.d).map(x=>x.n))];
    rdNames.forEach(n=>{const o=roadsHit.get(n)||{n,src:new Set()};o.src.add(c.id);roadsHit.set(n,o)});near.forEach(o=>bldHit.set(o.id,o));
    const occN=near.filter(o=>o.rec&&o.rec.occupancy&&o.rec.occupancy!=="vacant").length;pers+=(+c.per||0)+near.reduce((s,o)=>s+(o.rec?+o.rec.per||0:0),0);
    const pop=`<b>${esc(c.owner)}</b> · ${riskLab(c.risk_level)}<br>${fl} طابق · نصف القطر ${NF(r)} م<br>مبانٍ داخل النطاق: ${near.length}${occN?` (${occN} مأهولة)`:""}${rdNames.length?"<br>طرق: "+esc(rdNames.slice(0,4).join("، "))+(rdNames.length>4?"…":""):""}`;
    L.circle([c.lat,c.lng],{radius:r,color:col,weight:1.5,fillColor:col,fillOpacity:.15,dashArray:c.risk_level==="critical"?null:"5 4"}).bindPopup(pop).addTo(SP.grp);
    L.circleMarker([c.lat,c.lng],{radius:6,color:"#fff",weight:2,fillColor:col,fillOpacity:1}).bindPopup(pop).addTo(SP.grp);
    geo.push({type:"Feature",geometry:circlePoly(c.lat,c.lng,r),properties:{building_id:c.id,rec_ref:rid(c),owner:ANON?"":c.owner,risk_level:c.risk_level,floors:fl,radius_m:r,buildings_inside:near.length,occupied_inside:occN,roads:rdNames.join(" | ")}});
    rows.push({c:[rid(c),esc(c.owner),riskLab(c.risk_level),fl,NF(r),near.length,occN,esc(rdNames.join("، ")||"—")],z:[c.lat,c.lng],r:c.risk_level==="critical"?0:1,n:near.length})}
  /* المباني المجاورة المتأثرة بنقاط حمراء، والطرق المتأثرة بخطوط */
  bldHit.forEach(o=>L.circleMarker([o.lat,o.lng],{radius:3.5,color:"#12202e",weight:1,fillColor:"#fff",fillOpacity:.9}).bindPopup(esc(o.n)).addTo(SP.grp));
  ROADS.forEach(rr=>{if(roadsHit.has(rr.n))L.polyline(rr.c.map(q=>[q[1],q[0]]),{color:"#7b1fa2",weight:4,opacity:.85}).bindPopup("طريق داخل نطاق حماية: "+esc(rr.n)).addTo(SP.grp)});
  rows.sort((a,b)=>a.r-b.r||b.n-a.n);
  spLeg([[riskCol("critical"),"نطاق مبنى داهم"],[riskCol("high"),"نطاق مبنى آيل (متقطع)"],["#12202e","مبنى مجاور داخل النطاق"],["#7b1fa2","طريق يُغلق أو يُحمى"]]);
  SP.map.fitBounds(L.latLngBounds(src.map(c=>[c.lat,c.lng])).pad(.25),{maxZoom:18});
  const rl=[...roadsHit.values()].sort((a,b)=>b.src.size-a.src.size);
  spShow([["نطاقات حماية",src.length],["مبانٍ مجاورة داخل النطاقات",NF(bldHit.size)],["طرق تُغلق أو تُحمى",ROADS.length?NF(rl.length):"—"],["أفراد ضمن النطاقات",NF(pers)],["أكبر نصف قطر (م)",NF(Math.max(...src.map(c=>bufR(c.qty))))]],
    `حُدِّد ${src.length} نطاق حماية حول المباني ${SP.lv==="critical"?"الداهمة":"الداهمة والآيلة للسقوط"}، يقع داخلها ${NF(bldHit.size)} مبنى مجاور يجب إخطاره أو إخلاؤه مؤقتاً عند التدخل.`+
    (ROADS.length?(rl.length?` الطرق الواجب إغلاقها أو حمايتها: ${esc(rl.slice(0,6).map(x=>x.n+(x.src.size>1?" ("+x.src.size+" نطاقات)":"")).join("، "))}${rl.length>6?" وغيرها":""}.`:" لا تقطع النطاقات أي طريق في طبقة الشوارع."):" حمّل طبقة الشوارع لتحديد الطرق الواجب إغلاقها."),
    ["المبنى","الاسم","الخطورة","الطوابق","نصف القطر (م)","مبانٍ داخل النطاق","منها مأهولة","الطرق المتأثرة"],rows,geo,
    `نصف القطر = ${APPSET.buffer_factor} × الارتفاع (الطوابق × ${APPSET.floor_height_m} م)، بحد أدنى 10 م، تقدير أولي لنطاق السقوط وليس بديلاً عن تقدير المهندس في الموقع. المسافات من نقطة داخل المبنى، فالمباني الكبيرة قد يتجاوز تأثيرها النطاق قليلاً. المباني المجاورة تشمل كل السجلات المرئية وبصمات الطبقة المرجعية غير الموثّقة.`)}
function spMor(){const B=spData(),Mt=MET[SP.met];if(!B.length)return spEmpty("لا توجد مبانٍ ضمن الفلاتر الحالية.");const g=mkGrid(B,SP.size,Mt[1]);if(!g)return spEmpty("حجم الخلية صغير جداً لهذا النطاق. اختر حجماً أكبر.");const r=moran(g);if(!r)return spEmpty("القيم متطابقة في كل الخلايا، فلا يمكن حساب الارتباط.");
  const pos=[...g.X].filter(x=>x>0).sort((a,b)=>a-b),q=[.25,.5,.75].map(f=>pos[Math.floor(f*(pos.length-1))]),pal=["#fde9b0","#f8b968","#e8590c","#8e1b1b"],geo=[];
  for(let k=0;k<g.X.length;k++){if(!g.N[k])continue;const v=g.X[k],i=v<=q[0]?0:v<=q[1]?1:v<=q[2]?2:3;L.rectangle(gcb(g,k),{color:pal[i],weight:.4,fillColor:pal[i],fillOpacity:.7}).bindPopup(`${Mt[0]}: ${NF(v)}`).addTo(SP.grp);geo.push({type:"Feature",geometry:gpoly(g,k),properties:{value:v}})}
  spLeg(pal.map((c,i)=>[c,["أدنى ربع","ثاني","ثالث","أعلى ربع"][i]]));SP.map.fitBounds(L.latLngBounds([[g.y0/g.ky,g.x0/g.kx],[(g.y0+g.ny*g.s)/g.ky,(g.x0+g.nx*g.s)/g.kx]]));
  const sweep=[100,250,500,1000].map(s=>{const gg=mkGrid(B,s,Mt[1]),m=gg&&moran(gg);return{c:[s+" م",m?m.I.toFixed(3):"—",m?m.z.toFixed(2):"—",m?(m.p<.001?"< 0.001":m.p.toFixed(3)):"—",m?(m.p<.05?(m.I>m.E?"تجمع دال":"تشتت دال"):"عشوائي"):"—"]}});
  const sig=r.p<.05,txt=sig?(r.I>r.E?"تجمّع مكاني إيجابي دال إحصائياً: المباني الخطرة تتركز في مناطق متجاورة، وهذا يبرر التدخل على مستوى المنطقة (إغلاق، إخلاء جماعي) لا المبنى المفرد.":"تشتت مكاني دال: المباني الخطرة متفرقة بين خلايا متجاورة، ويلزم حصر شامل لا مركّز."):"نمط عشوائي: لا دليل إحصائي على تجمّع المباني الخطرة عند هذا الحجم.";
  spShow([["Moran's I",r.I.toFixed(3)],["المتوقع عشوائياً",r.E.toFixed(3)],["قيمة z",r.z.toFixed(2)],["القيمة الاحتمالية p",r.p<.001?"< 0.001":r.p.toFixed(3)],["خلايا منطقة الدراسة",NF(r.n)]],`النتيجة عند خلايا ${SP.size} م لمؤشر «${Mt[0]}»: ${txt}`,["حجم الخلية","Moran's I","z","p","التفسير"],sweep,geo,"Moran's I العام بأوزان Queen وافتراض التوزيع الطبيعي. الجدول يوضح حساسية النتيجة لحجم الخلية (مشكلة الوحدة المساحية المعدّلة MAUP). الخلايا الحدودية تحوي بيانات أقل بطبيعتها فقد ترفع قيمة I قليلاً، خصوصاً مع الخلايا الكبيرة؛ فالأدق استخدام 100–250 م وتفسير النتيجة كمؤشر لا كدليل قاطع.")}
roadsSync();
