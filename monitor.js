/* ================================================================
   monitor.js — المرحلة 4.4: وحدة مراقبة المستخدمين
   (سجل التدقيق، لوحة النشاط، التنبيهات، الجلسات) — وصول مقيَّد بالصلاحيات
   الخمس المستقلة (MON_PERMS) التي يمنحها المدير الأعلى فقط.
   ================================================================ */
let MON_TAB="";
const MON_DEFS=[["audit","سجل التدقيق","can_view_audit"],["activity","لوحة النشاط","can_view_activity"],["alerts","التنبيهات","can_receive_alerts"],["sessions","الجلسات","can_manage_sessions"]];
const monCan=k=>me.role==="admin"||me[k];
function monInit(){const avail=MON_DEFS.filter(([,,p])=>monCan(p));
  if(!avail.length){$("#monitor").innerHTML='<div class="msg warn">لا تملك أي صلاحية من صلاحيات وحدة المراقبة. تواصل مع المدير الأعلى.</div>';return}
  if(!MON_TAB||!avail.some(([k])=>k===MON_TAB))MON_TAB=avail[0][0];
  $("#monitor").innerHTML=`<div class="card"><h2>مراقبة المستخدمين</h2><div class="row" id="monTabs" style="margin-bottom:10px">${avail.map(([k,l])=>`<button type="button" class="btn sm${MON_TAB===k?" pri":""}" data-mt="${k}">${l}</button>`).join("")}</div><div id="monBody">جارٍ التحميل…</div></div>`;
  $("#monTabs").onclick=e=>{const b=e.target.closest("[data-mt]");if(b){MON_TAB=b.dataset.mt;monInit()}};
  ({audit:monAudit,activity:monActivity,alerts:monAlerts,sessions:monSessions}[MON_TAB])()}

/* أ) سجل التدقيق — غير قابل للتعديل أو الحذف، بفلاتر المستخدم/الإجراء/الفترة */
async function monAudit(){
  const uId=$("#monU")?.value||"",act=$("#monAct")?.value.trim()||"",from=$("#monFrom")?.value||"",to=$("#monTo")?.value||"";
  let q=sb.from("gz_audit_log").select("*").order("changed_at",{ascending:false}).limit(300);
  if(uId)q=q.eq("changed_by",uId);if(from)q=q.gte("changed_at",from);if(to)q=q.lte("changed_at",to+"T23:59:59");
  const {data,error}=await q;if(error){$("#monBody").innerHTML='<div class="msg err">تعذّر التحميل: '+esc(error.message)+'</div>';return}
  let rows=data||[];if(act)rows=rows.filter(r=>(r.table_name+"."+r.field).includes(act));
  $("#monBody").innerHTML=`<div class="row" style="gap:8px;margin-bottom:8px"><select id="monU"><option value="">كل المستخدمين</option>${USERS.map(u=>`<option value="${esc(u.id)}" ${uId===u.id?"selected":""}>${esc(u.full_name||u.email||"")}</option>`).join("")}</select>
  <input id="monAct" placeholder="تصفية بالإجراء (مثل gz_records.update)" value="${esc(act)}" style="flex:1 1 160px"><input id="monFrom" type="date" value="${esc(from)}"><input id="monTo" type="date" value="${esc(to)}"><button class="btn sm" id="monGo">تصفية</button>
  ${monCan("can_export_monitoring")?'<button class="btn sm pri" id="monExp">تصدير CSV</button>':""}</div>
  <p class="hint">آخر ${NF(rows.length)} سطر${to||from||uId?" ضمن التصفية":""}. سجل غير قابل للتعديل أو الحذف.</p>
  <div class="scroll"><table><thead><tr><th>المستخدم</th><th>الإجراء</th><th>الكيان</th><th>قديم → جديد</th><th>الوقت</th><th>الجهاز/المتصفح</th></tr></thead><tbody>${rows.map(r=>`<tr style="cursor:default"><td>${esc(NAMES[r.changed_by]||r.changed_by||"—")}</td><td dir="ltr">${esc(r.table_name)}.${esc(r.field)}</td><td dir="ltr">${esc(String(r.record_id||"—")).slice(0,12)}</td><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">${esc(JSON.stringify(r.old_value))} → ${esc(JSON.stringify(r.new_value))}</td><td>${fmt(r.changed_at)}</td><td style="max-width:160px;overflow:hidden;text-overflow:ellipsis" title="${esc(r.user_agent||"")}">${esc((r.user_agent||"—").slice(0,40))}</td></tr>`).join("")}</tbody></table></div>`;
  $("#monGo").onclick=monAudit;
  if($("#monExp"))$("#monExp").onclick=()=>{dl("audit-log-"+ymd(new Date())+".csv",csvOf(rows,["changed_by","table_name","field","old_value","new_value","changed_at","user_agent"]),"text/csv;charset=utf-8");logAudit("gz_audit_log",null,"export_monitoring",null,{n:rows.length},true)};
}

/* ب) لوحة النشاط */
async function monActivity(){
  const {data:recs2,error}=await fetchAll("gz_records");if(error){$("#monBody").innerHTML='<div class="msg err">تعذّر التحميل</div>';return}
  const today=todayS(),weekAgo=Date.now()-7*864e5,byUser=u=>recs2.filter(c=>c.created_by===u.id);
  const activeToday=USERS.filter(u=>u.last_activity_at&&u.last_activity_at.slice(0,10)===today).length,dailyTotal=recs2.filter(c=>c.created_at.slice(0,10)===today).length;
  $("#monBody").innerHTML=`<div class="kpis" style="margin:0 0 10px"><div class="kpi"><b>${NF(activeToday)}</b><span>مستخدمون نشطون اليوم</span></div><div class="kpi"><b>${NF(dailyTotal)}</b><span>إجمالي الإدخال اليومي</span></div></div>
  <p class="hint">عدد المسودات غير المزامنة لكل مستخدم غير متاح هنا (محفوظ محلياً على جهاز كل مستخدم فقط ولا تتيحه بنية IndexedDB الحالية للمدير عن بُعد — مهمة معلّقة إن رغبتم برفعه مركزياً).</p>
  <div class="scroll"><table><thead><tr><th>المستخدم</th><th>آخر نشاط</th><th>سجلات اليوم</th><th>سجلات الأسبوع</th><th>٪ مرفوض/جودة ناقصة</th></tr></thead><tbody>${USERS.filter(u=>u.role==="collector").map(u=>{const a=byUser(u),d=a.filter(c=>c.created_at.slice(0,10)===today).length,w=a.filter(c=>new Date(c.created_at).getTime()>weekAgo).length,bad=a.filter(c=>c.status==="rejected"||needsCompletion(c)).length;
    return`<tr style="cursor:default"><td>${esc(u.full_name||u.email||"")}</td><td>${u.last_activity_at?fmt(u.last_activity_at):"—"}</td><td>${NF(d)}</td><td>${NF(w)}</td><td>${a.length?Math.round(bad/a.length*100)+"%":"—"}</td></tr>`}).join("")}</tbody></table></div>`;
}

/* ج) التنبيهات */
async function monAlerts(){
  const {data,error}=await sb.from("gz_alerts").select("*").order("created_at",{ascending:false}).limit(200);
  if(error){$("#monBody").innerHTML='<div class="msg err">تعذّر التحميل: '+esc(error.message)+'</div>';return}
  const SEV={info:"#1c6ed5",warn:"#d9a400",high:"#9d1c1c"};
  $("#monBody").innerHTML=(data&&data.length?`<div class="scroll"><table><thead><tr><th>الخطورة</th><th>النوع</th><th>الرسالة</th><th>المستخدم</th><th>الوقت</th><th></th></tr></thead><tbody>${data.map(a=>`<tr style="cursor:default${a.resolved?';opacity:.5':""}"><td><span class="badge" style="--c:${SEV[a.severity]||"#999"}">${esc(a.severity)}</span></td><td>${esc(a.type)}</td><td>${esc(a.message)}</td><td>${esc(NAMES[a.user_id]||"—")}</td><td>${fmt(a.created_at)}</td><td>${a.resolved?"":`<button class="btn sm" data-res="${esc(a.id)}">تعليم كمُعالَج</button>`}</td></tr>`).join("")}</tbody></table></div>`:'<p class="hint">لا توجد تنبيهات.</p>')
    +'<p class="hint" style="margin-top:8px">قواعد كشف إضافية (حساب خامل طويلاً، وصول خارج النطاق، إحداثيات خارج النطاق) تحتاج فحصاً دورياً مجدولاً على الخادم (Edge Function/Cron) لم يُنفَّذ بعد — مهمة معلّقة. التنبيهات المفعَّلة حالياً فورية عند لحظة الفعل: حذف/تصدير بكميات كبيرة، ونسبة ضرر 100% بلا ملاحظات.</p>';
  $("#monBody").addEventListener("click",async e=>{const b=e.target.closest("[data-res]");if(!b)return;await sb.from("gz_alerts").update({resolved:true}).eq("id",b.dataset.res);monAlerts()});
}

/* د) الجلسات */
async function monSessions(){
  const {data,error}=await sb.from("gz_sessions").select("*").is("revoked_at",null).order("last_seen_at",{ascending:false}).limit(200);
  if(error){$("#monBody").innerHTML='<div class="msg err">تعذّر التحميل: '+esc(error.message)+'</div>';return}
  $("#monBody").innerHTML=(data&&data.length?`<div class="scroll"><table><thead><tr><th>المستخدم</th><th>الجهاز/المتصفح</th><th>بدأت</th><th>آخر ظهور</th><th></th></tr></thead><tbody>${data.map(s=>`<tr style="cursor:default"><td>${esc(NAMES[s.user_id]||"—")}</td><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">${esc(s.device_label||s.user_agent||"—")}</td><td>${fmt(s.created_at)}</td><td>${fmt(s.last_seen_at)}</td><td><button class="btn sm bad" data-rev="${esc(s.id)}">إنهاء الجلسة</button></td></tr>`).join("")}</tbody></table></div>`:'<p class="hint">لا توجد جلسات مسجَّلة بعد. سجل الجلسات الحالي يعتمد على ما تكتبه الواجهة عند الدخول — مهمة معلّقة: ربطه فعلياً بكل دخول عبر Supabase Auth.</p>');
  $("#monBody").addEventListener("click",async e=>{const b=e.target.closest("[data-rev]");if(!b)return;if(!await confirmAsk("إنهاء هذه الجلسة وإجبار الخروج؟",{danger:true}))return;
    await sb.from("gz_sessions").update({revoked_at:new Date().toISOString(),revoked_by:me.id}).eq("id",b.dataset.rev);await logAudit("gz_sessions",b.dataset.rev,"revoke",false,true,true);monSessions()});
}
