/* ================================================================
   map.js — الخريطة التفاعلية وطبقات الأساس، والبحث بالإحداثيات (WGS84 / UTM 36N)
   ================================================================ */
/* ---- الخريطة ---- */
const BASE={sat:["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}","Esri, Maxar, Earthstar Geographics"],osm:["https://tile.openstreetmap.org/{z}/{x}/{y}.png","© OpenStreetMap"],lt:["https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png","© CARTO"]};
function setBase(){baseL&&bigMap.removeLayer(baseL);const k=$("#base").value,b=BASE[k],ls=[L.tileLayer(b[0],{attribution:b[1],maxNativeZoom:18,maxZoom:20})];if(k==="sat")ls.push(L.tileLayer(LBL,{maxNativeZoom:18,maxZoom:20}));baseL=L.layerGroup(ls).addTo(bigMap)}
$("#base").onchange=()=>bigMap&&setBase();$("#lyr").onchange=drawMap;
function drawMap(){if(!bigMap){bigMap=L.map("map",{maxZoom:20,preferCanvas:true}).setView([31.5017,34.4668],12);setBase()}
  setTimeout(()=>bigMap.invalidateSize(),60);dataL&&bigMap.removeLayer(dataL);const v=view();
  if($("#lyr").value==="heat")dataL=L.heatLayer(v.map(c=>[c.lat,c.lng,1]),{radius:25}).addTo(bigMap);
  else{const pop=c=>`<b>${esc(c.owner)}</b><br>${riskChip(c.risk_level)}<br>${esc(tOf(c.type).n)} · ${esc(c.qty)} طابق · ${esc(STRUCT[c.structure_type]||"")}${c.committee_decision?"<br>⚖ قرار اللجنة: "+esc(DECIS[c.committee_decision]):""}${c.area_m2?"<br>المساحة: "+esc(c.area_m2)+" م²":""}<br><button class="btn sm pri" type="button" style="margin-top:6px" data-act="detail" data-id="${esc(c.id)}">التفاصيل</button>`;
    LM={};dataL=L.layerGroup(v.map(c=>LM[c.id]=c.geom?L.geoJSON(c.geom,{style:{color:"#fff",weight:1.5,fillColor:riskCol(c.risk_level),fillOpacity:.75}}).bindPopup(pop(c)):L.marker([c.lat,c.lng],{icon:L.divIcon({className:"",html:`<i class="m ${SHAPE[tOf(c.type).c]}" style="background:${riskCol(c.risk_level)}"></i>`,iconSize:[18,18]})}).bindPopup(pop(c)))).addTo(bigMap)}
  const fc=focusId&&recs.find(x=>x.id===focusId);focusId=null;
  if(fc){const l=LM[fc.id];l&&l.setStyle&&l.setStyle({color:"#f2b705",weight:4});setTimeout(()=>{l&&l.getBounds?bigMap.fitBounds(l.getBounds().pad(1.5),{maxZoom:19}):bigMap.setView([fc.lat,fc.lng],19);l&&l.openPopup([fc.lat,fc.lng])},160)}
  else if(v.length&&!keepView)bigMap.fitBounds(L.latLngBounds(v.map(c=>[c.lat,c.lng])).pad(.2),{maxZoom:17})}

/* ---- البحث بالإحداثيات والانتقال إليها (Lat/Lng أو UTM على WGS84) ---- */
const UK=(()=>{const f=1/298.257223563,a=6378137,n=f/(2-f),n2=n*n,n3=n2*n,n4=n2*n2;return{n,A:a/(1+n)*(1+n2/4+n4/64),al:[n/2-2*n2/3+5*n3/16,13*n2/48-3*n3/5,61*n3/240],be:[n/2-2*n2/3+37*n3/96,n2/48+n3/15,17*n3/480],de:[2*n-2*n2/3-2*n3,7*n2/3-8*n3/5,56*n3/15]}})(),D2R=Math.PI/180;
function utm2ll(E,N,zone=36,south=false){const {A,be,de}=UK,k0=.9996,xi=(south?N-1e7:N)/(k0*A),eta=(E-5e5)/(k0*A);let xp=xi,ep=eta;
  be.forEach((b,i)=>{const j=2*(i+1);xp-=b*Math.sin(j*xi)*Math.cosh(j*eta);ep-=b*Math.cos(j*xi)*Math.sinh(j*eta)});
  const chi=Math.asin(Math.sin(xp)/Math.cosh(ep));let lat=chi;de.forEach((d,i)=>lat+=d*Math.sin(2*(i+1)*chi));
  return{lat:lat/D2R,lng:((zone*6-183)*D2R+Math.atan2(Math.sinh(ep),Math.cos(xp)))/D2R}}
function ll2utm(lat,lng,zone){zone=zone||Math.floor((lng+180)/6)+1;const {n,A,al}=UK,k0=.9996,phi=lat*D2R,dl=(lng-(zone*6-183))*D2R,q=2*Math.sqrt(n)/(1+n),
  t=Math.sinh(Math.atanh(Math.sin(phi))-q*Math.atanh(q*Math.sin(phi))),xp=Math.atan2(t,Math.cos(dl)),ep=Math.atanh(Math.sin(dl)/Math.sqrt(1+t*t));let xi=xp,eta=ep;
  al.forEach((a,i)=>{const j=2*(i+1);xi+=a*Math.sin(j*xp)*Math.cosh(j*ep);eta+=a*Math.cos(j*xp)*Math.sinh(j*ep)});
  return{zone,E:5e5+k0*A*eta,N:(lat<0?1e7:0)+k0*A*xi}}
/* يقبل: «31.5017, 34.4668» (يُصحَّح الترتيب إن عُكس داخل نطاق غزة) أو «639300 3486100» أو «36N 639300 3486100»، ويفهم الأرقام العربية */
function parseCoord(t){t=String(t||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/٫/g,".").replace(/[،؛;]/g," ");
  let zone=36,south=false;const zm=t.match(/(?:^|\s)(\d{1,2})\s*([NnSs])(?=\s|$)/);if(zm){zone=+zm[1];south=/s/i.test(zm[2]);t=t.replace(zm[0]," ")}
  const nums=(t.match(/-?\d+(?:\.\d+)?/g)||[]).map(Number);if(nums.length!==2)return null;let [a,b]=nums;
  if(Math.abs(a)>1000&&Math.abs(b)>1000){const E=Math.min(a,b),N=Math.max(a,b);if(E<1e5||E>9e5||N>1e7||zone<1||zone>60)return null;return{...utm2ll(E,N,zone,south),src:"UTM"}}
  if(Math.abs(a)<=180&&Math.abs(b)<=180){if(a>=34&&a<=35&&b>=31&&b<=32)[a,b]=[b,a];if(Math.abs(a)>90)[a,b]=[b,a];if(Math.abs(a)>90)return null;return{lat:a,lng:b,src:"lat/lng"}}
  return null}
let coordMk=null;
function coordClear(){if(coordMk&&bigMap)bigMap.removeLayer(coordMk);coordMk=null}
function coordGo(txt){const p=parseCoord(txt);if(!p||!isFinite(p.lat)||!isFinite(p.lng))return toast("صيغة غير مفهومة. أمثلة: 31.5017, 34.4668 — أو UTM: 36N 639300 3486100");
  const was=cur;if(was!=="mapv")show("mapv");
  const ll=[p.lat,p.lng],u=ll2utm(p.lat,p.lng),inG=p.lat>=BB.la[0]&&p.lat<=BB.la[1]&&p.lng>=BB.ln[0]&&p.lng<=BB.ln[1];
  coordClear();bigMap.invalidateSize();
  coordMk=L.marker(ll,{title:"الموقع المُدخل"}).addTo(bigMap).bindPopup(`<div dir="rtl" style="font-family:Tajawal,sans-serif"><b>الموقع المُدخل</b><br><span dir="ltr">${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}</span><br><span dir="ltr" style="font-size:12px;color:#5d6b78">UTM ${u.zone}N · E ${Math.round(u.E)} · N ${Math.round(u.N)}</span>${inG?"":'<br><span style="color:#9d1c1c">خارج نطاق قطاع غزة</span>'}<br><button class="btn sm" style="margin-top:6px" type="button" data-act="coord-clear">إزالة العلامة</button></div>`);
  const z=Math.max(bigMap.getZoom(),18);was==="mapv"?bigMap.flyTo(ll,z,{duration:1.2}):bigMap.setView(ll,z);
  setTimeout(()=>coordMk&&coordMk.openPopup(),was==="mapv"?1300:150)}
