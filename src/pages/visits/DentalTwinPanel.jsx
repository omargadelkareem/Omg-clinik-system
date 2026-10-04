import { useMemo, useState } from "react";
import { Activity, CalendarClock, ChevronDown, Image, Sparkles, TrendingUp } from "lucide-react";
import Dental3DViewer from "./Dental3DViewer";
import { buildDentalInsights } from "../../services/dentalService";

const STATUS={healthy:"سليم",caries:"تسوس",filling:"حشو",root_canal:"علاج جذور",crown:"تاج",implant:"زرعة",missing:"مفقود",fracture:"كسر"};

export default function DentalTwinPanel({ twin, currentChart={}, onLoadTwin }) {
  const [mode,setMode]=useState("timeline");
  const [snapshotId,setSnapshotId]=useState("");
  const [selectedTooth,setSelectedTooth]=useState("");
  const snapshots=useMemo(()=>Object.values(twin?.snapshots||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)),[twin]);
  const timeline=useMemo(()=>Object.values(twin?.timeline||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)),[twin]);
  const insights=buildDentalInsights(twin);
  const selected=snapshots.find(x=>x.id===snapshotId)||snapshots[0];
  const toothEvents=selectedTooth?Object.values(twin?.teeth?.[selectedTooth]?.timeline||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)):[];
  const date=v=>v?new Date(v).toLocaleDateString("ar-EG",{year:"numeric",month:"short",day:"numeric"}):"—";

  return <section className="dental-twin">
    <div className="twin-head"><div><span><Sparkles size={13}/> PATIENT DIGITAL TWIN</span><h4>السجل السني عبر الزمن</h4><p>الحالة الحالية محفوظة للمريض، وكل كشف يضيف Snapshot بدون فقد التاريخ.</p></div>{twin?.currentChart&&<button type="button" onClick={()=>onLoadTwin?.(twin.currentChart)}>استخدام آخر حالة في الكشف</button>}</div>
    <div className="twin-intelligence">
      <div><Activity size={15}/><span>أسنان تحتاج متابعة</span><strong>{insights.affected}</strong></div>
      <div><CalendarClock size={15}/><span>إجراءات مفتوحة</span><strong>{insights.openPlans}</strong></div>
      <div><TrendingUp size={15}/><span>قيمة الخطة</span><strong>{insights.planValue.toLocaleString("ar-EG")}</strong><small>ج.م</small></div>
      <div><TrendingUp size={15}/><span>المتبقي</span><strong>{insights.remaining.toLocaleString("ar-EG")}</strong><small>ج.م</small></div>
      <div className={insights.overdue?"attention":""}><CalendarClock size={15}/><span>جلسات متأخرة</span><strong>{insights.overdue}</strong></div>
      <div><Image size={15}/><span>أشعة وصور</span><strong>{insights.media}</strong></div>
    </div>
    <div className="twin-tabs">{[["timeline","Timeline"],["compare","Before / After"],["tooth","Tooth History"],["media","X-Ray ↔ Tooth"]].map(([k,l])=><button type="button" key={k} className={mode===k?"active":""} onClick={()=>setMode(k)}>{l}</button>)}</div>
    {mode==="timeline"&&<div className="twin-timeline">{!timeline.length?<div className="twin-empty">سيبدأ الـTimeline بعد إنهاء أول كشف أسنان.</div>:timeline.map(event=><article key={event.id}><i/><div><strong>{date(event.createdAt)}</strong><span>{event.doctorName||"الطبيب"} · كشف أسنان</span><p>{event.changedTeeth?.length?<>تم تحديث الأسنان: <b>{event.changedTeeth.join(" · ")}</b></>:"Snapshot للحالة السنية"}</p></div></article>)}</div>}
    {mode==="compare"&&<div className="twin-compare"><div className="twin-selector"><label>قارن مع زيارة سابقة <span><select value={selected?.id||""} onChange={e=>setSnapshotId(e.target.value)}>{snapshots.map(s=><option value={s.id} key={s.id}>{date(s.createdAt)} — {s.doctorName||"الطبيب"}</option>)}</select><ChevronDown size={13}/></span></label></div>{!selected?<div className="twin-empty">لا توجد Snapshot سابقة للمقارنة بعد.</div>:<div className="twin-compare-grid"><div><header><span>BEFORE</span><strong>{date(selected.createdAt)}</strong></header><Dental3DViewer value={selected.chart||{}}/></div><div><header><span>NOW</span><strong>الحالة الحالية</strong></header><Dental3DViewer value={currentChart}/></div></div>}</div>}
    {mode==="tooth"&&<div className="tooth-history"><div className="twin-selector"><label>اختر السن <span><select value={selectedTooth} onChange={e=>setSelectedTooth(e.target.value)}><option value="">اختر رقم السن</option>{[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].map(n=><option key={n}>{n}</option>)}</select><ChevronDown size={13}/></span></label></div>{!selectedTooth?<div className="twin-empty">اختر سنًا لعرض تاريخه الكامل.</div>:!toothEvents.length?<div className="twin-empty">لا يوجد تاريخ مسجل لهذا السن بعد.</div>:<div className="tooth-event-list">{toothEvents.map(e=><article key={e.id}><time>{date(e.createdAt)}</time><div><strong>{STATUS[e.before?.status]||"غير مسجل"} <b>←</b> {STATUS[e.after?.status]||"غير مسجل"}</strong><span>{e.doctorName||"الطبيب"}</span>{e.after?.note&&<p>{e.after.note}</p>}</div></article>)}</div>}</div>}
    {mode==="media"&&<DentalLinkedMedia items={Array.isArray(twin?.media)?twin.media:Object.values(twin?.media||{})}/>}
  </section>;
}

function DentalLinkedMedia({items=[]}){
 const [tooth,setTooth]=useState("");
 const filtered=tooth?items.filter(x=>String(x.tooth||"")===tooth):items;
 return <div className="linked-media"><div className="twin-selector"><label>الأشعة المرتبطة بالسن <span><select value={tooth} onChange={e=>setTooth(e.target.value)}><option value="">كل الأسنان</option>{[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].map(n=><option key={n}>{n}</option>)}</select><ChevronDown size={13}/></span></label></div>{!filtered.length?<div className="twin-empty">لا توجد أشعة مرتبطة بهذا السن.</div>:<div className="linked-media-grid">{filtered.map(x=><article key={x.id}><div><Image size={22}/><span>{x.type||"Dental image"}</span></div><strong>{"السن "+(x.tooth||"عام")}</strong><small>{x.date||""}</small><p>{x.note||"بدون ملاحظات"}</p>{x.url&&<a href={x.url} target="_blank" rel="noreferrer">فتح الملف</a>}</article>)}</div>}</div>
}
