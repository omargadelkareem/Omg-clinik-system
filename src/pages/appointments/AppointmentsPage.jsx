import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, CheckCircle2, ChevronLeft, CircleAlert, Clock3,
  LoaderCircle, LogIn, Plus, Search, Stethoscope, UserCheck,
  UserRound, Users, X, CalendarPlus, ArrowUpLeft, Phone, CreditCard
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  cancelAppointment,
  checkInAppointment,
  createAppointment,
  createPatientAndAppointment,
  createPatientAndWalkIn,
  createWalkIn,
  markAppointmentNoShow,
  startAppointmentVisit,
  subscribeAppointmentDoctors,
  subscribeAppointmentPatients,
  subscribeAppointments,
  subscribeQueue,
} from "../../services/appointmentService";
import "./AppointmentsPage.css";

const VISIT_TYPES = ["كشف", "متابعة", "استشارة", "إجراء"];
const TIME_SLOTS = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00"];

function pad(value) { return String(value).padStart(2, "0"); }
function toDateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`; }
function formatTimeLabel(value) {
  if (!value) return "—";
  const [h,m] = String(value).split(":").map(Number);
  if (Number.isNaN(h)) return value;
  const d = new Date(); d.setHours(h,m||0,0,0);
  return new Intl.DateTimeFormat("ar-EG", {hour:"numeric", minute:"2-digit"}).format(d);
}
function formatFullDate(date) {
  return new Intl.DateTimeFormat("ar-EG", {weekday:"long", day:"numeric", month:"long", year:"numeric"}).format(date);
}
function getInitials(name="") { return String(name).trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("") || "؟"; }
function normalizeTimestamp(value) {
  if (typeof value === "number") return value;
  const n = Number(value); if (Number.isFinite(n) && n > 0) return n;
  const p = new Date(value || 0).getTime(); return Number.isNaN(p) ? 0 : p;
}
function normalizeStatus(value="") {
  const s=String(value).toLowerCase().replaceAll("_","-");
  if (["in-progress","in-consultation","in-visit"].includes(s)) return "in-progress";
  if (["arrived","waiting","checked-in"].includes(s)) return "waiting";
  if (["completed","done","finished"].includes(s)) return "completed";
  if (["cancelled","canceled"].includes(s)) return "cancelled";
  if (["no-show","noshow"].includes(s)) return "no-show";
  return "scheduled";
}
const STATUS_META = {
  scheduled:{label:"موعد قادم", short:"قادم"},
  waiting:{label:"في الانتظار", short:"منتظر"},
  "in-progress":{label:"داخل الكشف", short:"كشف جاري"},
  completed:{label:"انتهى الكشف", short:"انتهى"},
  cancelled:{label:"ملغي", short:"ملغي"},
  "no-show":{label:"لم يحضر", short:"لم يحضر"},
};
function queueTime(item) {
  if (item.time) return item.time;
  const ts=normalizeTimestamp(item.checkedInAt || item.createdAt);
  if (!ts) return "";
  const d=new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function waitingMinutes(item) {
  const ts=normalizeTimestamp(item.checkedInAt || item.arrivedAt || item.createdAt);
  if (!ts) return 0;
  return Math.max(0, Math.floor((Date.now()-ts)/60000));
}

export default function AppointmentsPage() {
  const navigate=useNavigate();
  const { clinicId, staffId, profile }=useAuth();
  const todayKey=toDateKey(new Date());
  const [selectedDateKey,setSelectedDateKey]=useState(todayKey);
  const [appointments,setAppointments]=useState([]);
  const [queue,setQueue]=useState([]);
  const [patients,setPatients]=useState([]);
  const [doctors,setDoctors]=useState([]);
  const [doctorFilter,setDoctorFilter]=useState("all");
  const [statusFilter,setStatusFilter]=useState("active");
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [actionId,setActionId]=useState("");
  const [toast,setToast]=useState(null);
  const [bookingOpen,setBookingOpen]=useState(false);
  const [defaultBookingTime,setDefaultBookingTime]=useState("");

  useEffect(()=>{
    if(!clinicId){setLoading(false);return;}
    let a=false,p=false,d=false,q=false;
    const done=()=>{if(a&&p&&d&&q)setLoading(false)};
    setLoading(true); setError("");
    const ua=subscribeAppointments(clinicId,x=>{setAppointments(Array.isArray(x)?x:[]);a=true;done()},()=>{a=true;setError("تعذر تحميل بيانات عيادة اليوم.");done()});
    const up=subscribeAppointmentPatients(clinicId,x=>{setPatients(Array.isArray(x)?x:[]);p=true;done()},()=>{p=true;done()});
    const ud=subscribeAppointmentDoctors(clinicId,x=>{setDoctors(Array.isArray(x)?x:[]);d=true;done()},()=>{d=true;done()});
    const uq=subscribeQueue(
      clinicId,
      x=>{setQueue(Array.isArray(x)?x:[]);q=true;done()},
      ()=>{q=true;done()},
      {includeCompleted:true,includeCancelled:true}
    );
    return()=>{ua?.();up?.();ud?.();uq?.()};
  },[clinicId]);

  useEffect(()=>{ if(!toast)return; const t=setTimeout(()=>setToast(null),3200); return()=>clearTimeout(t); },[toast]);

  const selectedDate=useMemo(()=>{ const [y,m,d]=selectedDateKey.split("-").map(Number); return new Date(y,m-1,d); },[selectedDateKey]);

  const rows=useMemo(()=>{
    const appointmentIds=new Set();
    const base=appointments.filter(a=>a.date===selectedDateKey).map(a=>{
      appointmentIds.add(a.id);
      const linked=queue.find(q=>q.appointmentId===a.id || q.id===a.queueId);
      const status=normalizeStatus(linked?.status || a.status);
      return { ...a, rowId:`a-${a.id}`, kind:"appointment", queueId:linked?.id || a.queueId || "", status, source:a.source || "appointment", checkedInAt:linked?.checkedInAt || a.checkedInAt };
    });
    if(selectedDateKey===todayKey){
      queue.forEach(q=>{
        if(q.appointmentId && appointmentIds.has(q.appointmentId)) return;
        const eventTime=normalizeTimestamp(q.checkedInAt || q.createdAt || q.completedAt || q.updatedAt);
        if(eventTime && toDateKey(new Date(eventTime))!==todayKey) return;
        base.push({ ...q, rowId:`q-${q.id}`, kind:"queue", time:queueTime(q), status:normalizeStatus(q.status), source:q.source || "walk-in" });
      });
    }
    const query=search.trim().toLowerCase();
    return base.filter(r=>doctorFilter==="all" || r.doctorId===doctorFilter)
      .filter(r=>statusFilter==="all" || (statusFilter==="active" ? !["completed","cancelled","no-show"].includes(r.status) : r.status===statusFilter))
      .filter(r=>!query || [r.patientName,r.patientPhone,r.patientCode,r.doctorName,r.type].filter(Boolean).some(v=>String(v).toLowerCase().includes(query)))
      .sort((a,b)=>{
        const order={"in-progress":0,waiting:1,scheduled:2,completed:3,cancelled:4,"no-show":5};
        if(order[a.status]!==order[b.status]) return order[a.status]-order[b.status];
        return String(a.time||"").localeCompare(String(b.time||""));
      });
  },[appointments,queue,selectedDateKey,todayKey,doctorFilter,statusFilter,search]);

  const stats=useMemo(()=>{
    const all=appointments
      .filter(a=>a.date===selectedDateKey)
      .map(a=>{
        const linked=queue.find(q=>q.appointmentId===a.id || q.id===a.queueId);
        return {...a,status:normalizeStatus(linked?.status || a.status)};
      });

    if(selectedDateKey===todayKey){
      const appointmentIds=new Set(all.map(a=>a.id));
      queue.forEach(q=>{
        if(q.appointmentId && appointmentIds.has(q.appointmentId)) return;
        const eventTime=normalizeTimestamp(q.checkedInAt || q.createdAt || q.completedAt || q.updatedAt);
        if(eventTime && toDateKey(new Date(eventTime))!==todayKey) return;
        all.push({...q,status:normalizeStatus(q.status)});
      });
    }

    const scoped=doctorFilter==="all" ? all : all.filter(r=>r.doctorId===doctorFilter);
    return {
      total:scoped.filter(r=>!["cancelled","no-show"].includes(r.status)).length,
      waiting:scoped.filter(r=>r.status==="waiting").length,
      current:scoped.filter(r=>r.status==="in-progress").length,
      completed:scoped.filter(r=>r.status==="completed").length,
    };
  },[appointments,queue,selectedDateKey,todayKey,doctorFilter]);

  function shiftDay(amount){ const d=new Date(selectedDate); d.setDate(d.getDate()+amount); setSelectedDateKey(toDateKey(d)); }
  async function run(id,fn){ try{setActionId(id);setError("");await fn()}catch(e){setToast({type:"error",message:e?.message||"تعذر تنفيذ العملية."})}finally{setActionId("")} }

  function openPatient(row){ if(row.patientId) navigate(`/patients/${row.patientId}`); }
  async function checkIn(row){
    await run(row.rowId, async()=>{
      await checkInAppointment({clinicId,appointment:row,staffId:staffId||profile?.staffId||""});
      setToast({type:"success",message:`تم تسجيل وصول ${row.patientName || "المريض"}.`});
    });
  }
  async function startVisit(row){
    await run(row.rowId, async()=>{
      let result;
      if(row.kind==="appointment"){
        result=await startAppointmentVisit({clinicId,appointment:row,queueId:row.queueId});
      }else{
        const module=await import("../../services/appointmentService");
        if(typeof module.startQueueVisit!=="function") throw new Error("خدمة بدء كشف مريض الانتظار غير موجودة في appointmentService.");
        result=await module.startQueueVisit({clinicId,queueItem:row});
      }
      navigate(`/patients/${row.patientId}/visit/new`,{state:{appointmentId:result?.appointmentId||row.appointmentId||row.id||"",queueId:result?.queueId||row.queueId||row.id||"",source:row.kind==="appointment"?"appointment":"queue"}});
    });
  }
  function resumeVisit(row){
    navigate(`/patients/${row.patientId}/visit/new`,{state:{appointmentId:row.appointmentId || (row.kind==="appointment"?row.id:"") ,queueId:row.queueId || (row.kind==="queue"?row.id:""),source:row.kind==="appointment"?"appointment":"queue"}});
  }
  async function cancel(row){ if(row.kind!=="appointment")return; await run(row.rowId,async()=>{await cancelAppointment(clinicId,row.id);setToast({type:"success",message:"تم إلغاء الموعد."})}); }
  async function noShow(row){ if(row.kind!=="appointment")return; await run(row.rowId,async()=>{await markAppointmentNoShow(clinicId,row.id);setToast({type:"success",message:"تم تسجيل عدم الحضور."})}); }

  if(loading) return <div className="today-clinic-page"><div className="today-state"><LoaderCircle className="spin" size={25}/><strong>جاري تجهيز عيادة اليوم</strong><span>يتم مزامنة المواعيد والانتظار...</span></div></div>;

  return <div className="today-clinic-page">
    <header className="today-header">
      <div className="today-heading"><span>RECEPTION DESK</span><h1>عيادة اليوم</h1><p>{formatFullDate(selectedDate)} · كل المرضى في مكان واحد</p></div>
      <div className="today-header-actions">
        <button className="primary-action" onClick={()=>{setDefaultBookingTime("");setBookingOpen(true)}}><Plus size={16}/> إضافة مريض</button>
      </div>
    </header>

    <section className="day-controlbar">
      <div className="date-switcher"><button onClick={()=>shiftDay(-1)} aria-label="اليوم السابق">‹</button><button className="date-main" onClick={()=>setSelectedDateKey(todayKey)}><CalendarDays size={16}/><span>{selectedDateKey===todayKey?"اليوم":formatFullDate(selectedDate)}</span></button><button onClick={()=>shiftDay(1)} aria-label="اليوم التالي">›</button></div>
      <label className="today-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث باسم المريض أو الهاتف أو رقم الملف"/>{search&&<button onClick={()=>setSearch("")}><X size={14}/></button>}</label>
      <label className="doctor-select"><Stethoscope size={15}/><select value={doctorFilter} onChange={e=>setDoctorFilter(e.target.value)}><option value="all">كل الأطباء</option>{doctors.map(d=><option key={d.id} value={d.id}>{d.name || d.fullName || "طبيب"}</option>)}</select></label>
    </section>

    <section className="today-metrics">
      <div><span>إجمالي اليوم</span><strong>{stats.total}</strong></div>
      <div><span>في الانتظار</span><strong>{stats.waiting}</strong></div>
      <div><span>داخل الكشف</span><strong>{stats.current}</strong></div>
      <div><span>انتهى الكشف</span><strong>{stats.completed}</strong></div>
    </section>

    <section className="flow-tabs">
      {[['active','العيادة الآن'],['all','الكل'],['waiting','الانتظار'],['in-progress','داخل الكشف'],['completed','انتهى']].map(([v,l])=><button key={v} className={statusFilter===v?'active':''} onClick={()=>setStatusFilter(v)}>{l}</button>)}
    </section>

    {error&&<div className="today-error"><CircleAlert size={16}/><span>{error}</span></div>}

    <main className="today-board">
      <div className="today-table-head"><span>الوقت</span><span>المريض</span><span>الطبيب</span><span>نوع الزيارة</span><span>الحالة</span><span>الإجراء</span></div>
      {rows.length===0 ? <div className="today-empty"><CalendarDays size={27}/><strong>لا توجد حالات مطابقة</strong><span>أضف المريض وحدد هل هو موجود الآن أم لديه موعد لاحق.</span></div> : rows.map(row=>{
        const meta=STATUS_META[row.status] || STATUS_META.scheduled;
        const busy=actionId===row.rowId;
        return <article className={`today-row status-${row.status}`} key={row.rowId}>
          <div className="cell-time"><strong>{row.time?formatTimeLabel(row.time):"الآن"}</strong>{row.status==='waiting'&&<small>منذ {waitingMinutes(row)} د</small>}</div>
          <button className="patient-cell" onClick={()=>openPatient(row)}><span className="patient-avatar">{getInitials(row.patientName)}</span><span><strong>{row.patientName || "مريض"}</strong><small>{row.patientPhone || row.patientCode || "بدون هاتف"}</small></span></button>
          <div className="doctor-cell"><strong>{row.doctorName || "غير محدد"}</strong><small>{row.source==='walk-in'||row.source==='walk_in'?'حضور مباشر':'موعد'}</small></div>
          <div className="type-cell">{row.type || "كشف"}</div>
          <div><span className={`flow-status flow-${row.status}`}><i/>{meta.label}</span>{row.status==='completed'&&row.visitPrice!==undefined&&<small className="row-billing-state">{Number(row.visitPrice||0).toLocaleString("ar-EG")} ج.م · {row.financeStatus==='paid'?'مدفوع':row.financeStatus==='partial'?'دفع جزئي':row.financeStatus==='free'?'مجاني':'غير مدفوع'}</small>}</div>
          <div className="row-actions">
            {busy ? <button className="main-row-action" disabled><LoaderCircle className="spin" size={15}/> جاري...</button> : <>
              {row.status==='scheduled'&&<button className="main-row-action" onClick={()=>checkIn(row)}><LogIn size={15}/> وصل العيادة</button>}
              {row.status==='waiting'&&<button className="main-row-action start" onClick={()=>startVisit(row)}><Stethoscope size={15}/> بدء الكشف</button>}
              {row.status==='in-progress'&&<button className="main-row-action current" onClick={()=>resumeVisit(row)}><ArrowUpLeft size={15}/> فتح الكشف</button>}
              {row.status==='completed'&&<><button className="main-row-action ghost" onClick={()=>openPatient(row)}><CheckCircle2 size={15}/> ملف المريض</button>{row.financeStatus!=='paid'&&row.financeStatus!=='free'&&<button className="main-row-action collect" onClick={()=>navigate("/finance")}><CreditCard size={15}/> تحصيل</button>}</>}
              {(row.status==='cancelled'||row.status==='no-show')&&<button className="main-row-action ghost" onClick={()=>openPatient(row)}>عرض الملف</button>}
            </>}
            {row.kind==='appointment'&&row.status==='scheduled'&&<div className="mini-actions"><button title="لم يحضر" onClick={()=>noShow(row)}>غياب</button><button title="إلغاء" onClick={()=>cancel(row)}>إلغاء</button></div>}
          </div>
        </article>
      })}
    </main>

    <footer className="today-footer"><span><i/> تحديث مباشر من Firebase</span><span>الحجز، الوصول، الانتظار والكشف في مسار واحد</span></footer>

    {toast&&<div className={`today-toast ${toast.type||''}`}>{toast.type==='error'?<CircleAlert size={16}/>:<CheckCircle2 size={16}/>}<span>{toast.message}</span></div>}

    {bookingOpen&&<BookingModal clinicId={clinicId} patients={patients} doctors={doctors} selectedDateKey={selectedDateKey} defaultTime={defaultBookingTime} staffId={staffId||profile?.staffId||""} onClose={()=>{setBookingOpen(false);setDefaultBookingTime("")}} onSuccess={message=>{setBookingOpen(false);setDefaultBookingTime("");setToast({type:"success",message})}}/>}
  </div>;
}

function PatientPicker({ patients, value, onChange }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return patients.filter((patient) =>
      [patient.name, patient.phone, patient.patientCode]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(q))
    ).slice(0, 6);
  }, [patients, query]);

  if (value) {
    return <div className="selected-patient-box">
      <span className="selected-patient-avatar">{getInitials(value.name)}</span>
      <div><strong>{value.name}</strong><small>{value.phone || value.patientCode || "ملف مريض"}</small></div>
      <button type="button" onClick={() => onChange(null)}>تغيير</button>
    </div>;
  }

  return <div className="patient-picker">
    <label className="patient-picker-search"><Search size={16}/><input autoFocus value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="اكتب اسم المريض أو رقم الهاتف..."/></label>
    {query && <div className="patient-picker-results">
      {results.length ? results.map((patient)=><button type="button" key={patient.id} onClick={()=>onChange(patient)}>
        <span className="picker-avatar">{getInitials(patient.name)}</span>
        <div><strong>{patient.name}</strong><small>{patient.phone || "بدون هاتف"}{patient.patientCode ? ` · ${patient.patientCode}` : ""}</small></div>
        <ChevronLeft size={15}/>
      </button>) : <div className="patient-picker-empty">لا يوجد مريض مطابق. اختر «مريض جديد» لإضافته.</div>}
    </div>}
  </div>;
}

function BookingModal({ clinicId, patients, doctors, selectedDateKey, defaultTime, staffId, onClose, onSuccess }) {
  const [arrivalMode, setArrivalMode] = useState("now");
  const [patientMode, setPatientMode] = useState("existing");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [doctorId, setDoctorId] = useState(doctors[0]?.id || "");
  const [date, setDate] = useState(selectedDateKey);
  const [time, setTime] = useState(defaultTime || "10:00");
  const [type, setType] = useState("كشف");
  const [notes, setNotes] = useState("");
  const [newPatient, setNewPatient] = useState({name:"",phone:"",gender:"",age:"",address:""});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const selectedDoctor=doctors.find((doctor)=>doctor.id===doctorId)||null;

  async function submit(event){
    event.preventDefault();
    try{
      setSaving(true); setError("");
      if(patientMode==="existing" && !selectedPatient) throw new Error("اختر المريض أولًا.");
      if(patientMode==="new" && (!newPatient.name.trim() || !newPatient.phone.trim())) throw new Error("اكتب اسم المريض ورقم الهاتف.");
      const patientData={...newPatient,age:newPatient.age ? Number(newPatient.age) : null};
      if(arrivalMode==="now"){
        if(patientMode==="existing") await createWalkIn({clinicId,patient:selectedPatient,doctor:selectedDoctor,type,notes,staffId});
        else await createPatientAndWalkIn({clinicId,patientData,doctor:selectedDoctor,type,notes,staffId});
        onSuccess("تم إضافة المريض إلى عيادة اليوم.");
      } else {
        if(patientMode==="existing") await createAppointment({clinicId,patient:selectedPatient,doctor:selectedDoctor,date,time,duration:30,type,notes,createdBy:staffId});
        else await createPatientAndAppointment({clinicId,patientData,doctor:selectedDoctor,date,time,duration:30,type,notes,createdBy:staffId});
        onSuccess("تم حفظ الموعد بنجاح.");
      }
    }catch(e){setError(e?.message||"تعذر حفظ البيانات.");}
    finally{setSaving(false);}
  }

  return <div className="booking-modal-layer" role="dialog" aria-modal="true">
    <button type="button" className="booking-modal-overlay" onClick={onClose} aria-label="إغلاق"/>
    <form className="booking-modal" onSubmit={submit}>
      <div className="booking-modal-header">
        <div><span>عيادة اليوم</span><h2>إضافة مريض</h2><p>خطوة واحدة للحضور المباشر أو حجز موعد.</p></div>
        <button type="button" onClick={onClose}><X size={18}/></button>
      </div>

      <div className="booking-form">
        <div className="entry-mode-switch">
          <button type="button" className={arrivalMode==="now"?"active":""} onClick={()=>setArrivalMode("now")}><UserCheck size={16}/><span><strong>موجود الآن</strong><small>يدخل قائمة الانتظار</small></span></button>
          <button type="button" className={arrivalMode==="later"?"active":""} onClick={()=>setArrivalMode("later")}><CalendarDays size={16}/><span><strong>موعد لاحق</strong><small>اختيار اليوم والوقت</small></span></button>
        </div>

        <div className="form-section-head"><strong>بيانات المريض</strong><div className="patient-mode-inline"><button type="button" className={patientMode==="existing"?"active":""} onClick={()=>setPatientMode("existing")}>مريض مسجل</button><button type="button" className={patientMode==="new"?"active":""} onClick={()=>setPatientMode("new")}>مريض جديد</button></div></div>
        {patientMode==="existing" ? <PatientPicker patients={patients} value={selectedPatient} onChange={setSelectedPatient}/> : <NewPatientFields value={newPatient} onChange={setNewPatient}/>} 

        <div className="form-divider"/>
        <div className="booking-form-grid calm-grid">
          <label className="booking-field"><span>الطبيب</span><select value={doctorId} onChange={(e)=>setDoctorId(e.target.value)}><option value="">بدون تحديد</option>{doctors.map((d)=><option key={d.id} value={d.id}>{d.name||d.fullName||"طبيب"}</option>)}</select></label>
          <label className="booking-field"><span>نوع الزيارة</span><select value={type} onChange={(e)=>setType(e.target.value)}>{VISIT_TYPES.map((item)=><option key={item} value={item}>{item}</option>)}</select></label>
        </div>

        {arrivalMode==="later" && <div className="booking-form-grid calm-grid schedule-fields">
          <label className="booking-field"><span>التاريخ</span><input type="date" value={date} required onChange={(e)=>setDate(e.target.value)}/></label>
          <label className="booking-field"><span>الوقت</span><input type="time" value={time} required onChange={(e)=>setTime(e.target.value)}/></label>
        </div>}

        <label className="booking-field notes-field"><span>ملاحظة <small>اختياري</small></span><textarea value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="سبب الزيارة أو ملاحظة قصيرة..."/></label>
        {error&&<div className="booking-error"><CircleAlert size={15}/>{error}</div>}
      </div>

      <div className="booking-modal-footer">
        <button type="button" className="booking-cancel" onClick={onClose} disabled={saving}>إلغاء</button>
        <button type="submit" className="booking-confirm" disabled={saving}>{saving?<LoaderCircle size={16} className="spin"/>:arrivalMode==="now"?<UserCheck size={16}/>:<CalendarDays size={16}/>} {arrivalMode==="now"?"إضافة للعيادة":"حفظ الموعد"}</button>
      </div>
    </form>
  </div>;
}

function NewPatientFields({value,onChange}){
  const change=(key,next)=>onChange({...value,[key]:next});
  return <div className="new-patient-fields">
    <div className="booking-form-grid calm-grid">
      <label className="booking-field"><span>اسم المريض</span><input type="text" required value={value.name} onChange={(e)=>change("name",e.target.value)} placeholder="الاسم بالكامل"/></label>
      <label className="booking-field"><span>رقم الهاتف</span><input type="tel" required dir="ltr" value={value.phone} onChange={(e)=>change("phone",e.target.value)} placeholder="01xxxxxxxxx"/></label>
    </div>
    <div className="booking-form-grid calm-grid compact-fields">
      <label className="booking-field"><span>السن</span><div className="age-input"><input type="number" min="0" max="120" inputMode="numeric" value={value.age} onChange={(e)=>change("age",e.target.value)} placeholder="مثال: 35"/><em>سنة</em></div></label>
      <label className="booking-field"><span>النوع</span><select value={value.gender} onChange={(e)=>change("gender",e.target.value)}><option value="">غير محدد</option><option value="male">ذكر</option><option value="female">أنثى</option></select></label>
    </div>
    <label className="booking-field"><span>العنوان <small>اختياري</small></span><input type="text" value={value.address} onChange={(e)=>change("address",e.target.value)} placeholder="المنطقة أو العنوان المختصر"/></label>
  </div>;
}
