import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { BUILTIN_PROCEDURES, PROCEDURE_STATUSES, validateToothNumber } from "../../config/procedureCatalog";
import { addProcedureSession, createPatientProcedure, subscribePatientProcedures, updatePatientProcedureStatus } from "../../services/procedureService";
import "./PatientProceduresPage.css";
import DentalAnatomyChart from "./DentalAnatomyChart";

const STATUS_LABELS = { planned: "مخطط", scheduled: "مجدول", in_progress: "جاري العلاج", completed: "مكتمل", cancelled: "ملغي" };
const DENTAL_SPECIALTIES = ["dentistry", "orthodontics", "endodontics", "periodontics", "prosthodontics", "pediatric_dentistry", "oral_maxillofacial_surgery"];
const emptyForm = { code: "", toothNumber: "", price: "", notes: "", surfaces: [], plannedSessions: 1 };

export default function PatientProceduresPage() {
  const { patientId } = useParams();
  const { clinicId, firebaseUser, activeSpecialty, clinicSpecialty } = useAuth();
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [search, setSearch] = useState("");
  const [sessionNotes, setSessionNotes] = useState({});
  const [activeCategory, setActiveCategory] = useState("all");
  const [dentition, setDentition] = useState("permanent");
  const [showCompleted, setShowCompleted] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [records, setRecords] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Doctor's assigned specialty takes precedence; the clinic specialty is fallback.
  // No arbitrary specialty switching from the patient chart.
  const resolvedSpecialty = activeSpecialty || clinicSpecialty || "general_practice";
  const specialty = DENTAL_SPECIALTIES.includes(resolvedSpecialty) ? "dentistry" : (resolvedSpecialty === "obstetrics_gynecology" ? "gynecology" : resolvedSpecialty);
  const isDental = specialty === "dentistry";
  const specialtyLabel = isDental ? "طب الأسنان" : ({"general_surgery":"الجراحة العامة","obstetrics_gynecology":"النساء والتوليد","gynecology":"النساء والتوليد","orthopedics":"العظام","ent":"الأنف والأذن","ophthalmology":"العيون","dermatology":"الجلدية","urology":"المسالك البولية"}[specialty] || "التخصص الطبي");
  const permanentTeeth = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
  const primaryTeeth = [55,54,53,52,51,61,62,63,64,65,85,84,83,82,81,71,72,73,74,75];
  const teeth = dentition === "permanent" ? permanentTeeth : primaryTeeth;
  useEffect(() => {
    if (!clinicId || !patientId) return undefined;
    return subscribePatientProcedures({ clinicId, patientId }, setRecords, err => setError(err.message || "تعذر تحميل الإجراءات"));
  }, [clinicId, patientId]);
  const options = useMemo(() => BUILTIN_PROCEDURES.filter(item => item.specialty === specialty && item.name.includes(search.trim()) && (activeCategory === "all" || item.category === activeCategory)), [specialty, search, activeCategory]);
  const categories = [...new Set(BUILTIN_PROCEDURES.filter(item => item.specialty === specialty).map(item => item.category))];
  const selected = BUILTIN_PROCEDURES.find(item => item.code === form.code && item.specialty === specialty);
  const total = records.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const create = async event => {
    event.preventDefault();
    setError(""); setSuccess("");
    if (!selected) return setError("اختر إجراءً طبيًا");
    if (selected.requiresTooth && !validateToothNumber(form.toothNumber)) return setError("أدخل رقم سن صحيح وفق FDI");
    if (!firebaseUser?.uid) return setError("لا يمكن تحديد المستخدم الحالي");
    setBusy(true);
    try {
      await createPatientProcedure({
        clinicId, patientId, actorId: firebaseUser.uid,
        input: { code: selected.code, specialty: selected.specialty, toothNumber: (selected?.requiresTooth ? (selectedTooth || form.toothNumber) : null), price: form.price || 0, notes: form.notes, surfaces: form.surfaces, plannedSessions: form.plannedSessions },
      });
      setForm(emptyForm); setSuccess("تمت إضافة الإجراء إلى ملف المريض");
    } catch (err) { setError(err.message || "تعذر حفظ الإجراء"); }
    finally { setBusy(false); }
  };
  const addSession = async record => {
    setBusy(true); setError(""); setSuccess("");
    try {
      await addProcedureSession({ clinicId, patientId, procedureId: record.id, actorId: firebaseUser.uid, notes: sessionNotes[record.id] || "" });
      setSessionNotes(prev => ({ ...prev, [record.id]: "" }));
      setSuccess("تم تسجيل الجلسة");
    } catch (err) { setError(err.message || "تعذر تسجيل الجلسة"); }
    finally { setBusy(false); }
  };
  const changeStatus = async (record, status) => {
    setError(""); setSuccess(""); setBusy(true);
    try {
      await updatePatientProcedureStatus({ clinicId, patientId, procedureId: record.id, status, actorId: firebaseUser.uid });
      setSuccess("تم تحديث حالة الإجراء");
    } catch (err) { setError(err.message || "تعذر تحديث الحالة"); }
    finally { setBusy(false); }
  };
  const toothStatuses = new Map();
  records.forEach(item => { if (item.toothNumber && item.status !== "cancelled") toothStatuses.set(Number(item.toothNumber), item.status); });
  const visibleRecords = records.filter(item => showCompleted || item.status !== "completed");
  const activeCount = records.filter(item => !["completed","cancelled"].includes(item.status)).length;
  const completedCount = records.filter(item => item.status === "completed").length;
  const chooseTooth = tooth => { setSelectedTooth(tooth); setForm(prev => ({ ...prev, toothNumber: String(tooth) })); };
  return <main className="dentolize-workspace" dir="rtl">
    <div className="dw-patient-bar"><Link to={`/patients/${patientId}`}>← العودة للمرضى</Link><div className="dw-avatar">✚</div><div><h2>ملف المريض <small>#{patientId?.slice(-7)}</small></h2><p>{specialtyLabel} · خطة العلاج</p></div><span className="dw-active">● مريض نشط</span></div>
    <nav className="dw-tabs"><span>الملف الشخصي</span><span>التاريخ الطبي</span><span>الكشف</span><strong>خطة العلاج</strong><span>الأشعة</span><span>الفواتير</span></nav>
    {error && <p role="alert" className="dw-alert">{error}</p>}{success && <p role="status" className="dw-alert">{success}</p>}
    <div className="dw-columns"><div className="dw-main">
      {isDental && <section className="dw-chart"><div className="dw-title"><h3>مخطط الأسنان</h3><div className="dw-switch"><button className={dentition==="permanent"?"on":""} onClick={()=>setDentition("permanent")}>الأسنان الدائمة</button><button className={dentition==="primary"?"on":""} onClick={()=>setDentition("primary")}>الأسنان اللبنية</button></div></div>
      <DentalAnatomyChart teeth={teeth} selectedTooth={selectedTooth} onSelect={chooseTooth} statuses={toothStatuses}/>
      <div className="dw-legend"><span>🟠 مخطط</span><span>🔵 جاري العلاج</span><span>🟢 مكتمل</span></div>
      <div className="dw-surface-panel"><h3>السن <b>{selectedTooth || "—"}</b></h3><p>اختار السن ثم حدد أسطح العلاج</p><div className="dw-surfaces">{["O","M","D","B","L"].map(surface=><button key={surface} className={form.surfaces.includes(surface)?"on":""} onClick={()=>setForm(prev=>({...prev,surfaces:prev.surfaces.includes(surface)?prev.surfaces.filter(x=>x!==surface):[...prev.surfaces,surface]}))}><b>{surface}</b><small>{({O:"إطباقي",M:"أنسي",D:"بعيد",B:"دهليزي",L:"لساني"})[surface]}</small></button>)}</div></div>
      </section>}
      <section className="dw-plan"><div className="dw-title"><h3>خطة العلاج ({records.length} إجراءات)</h3><label><input type="checkbox" checked={showCompleted} onChange={e=>setShowCompleted(e.target.checked)}/> إظهار المكتمل</label></div><div className="dw-table-wrap"><table><thead><tr><th>السن</th><th>الإجراء</th><th>الأسطح</th><th>الجلسات</th><th>التكلفة</th><th>الحالة</th></tr></thead><tbody>{visibleRecords.map(item=><tr key={item.id}><td>{item.toothNumber||"—"}</td><td>{item.name}</td><td>{item.surfaces?.join(", ")||"—"}</td><td>{Object.keys(item.sessions||{}).length}/{item.plannedSessions||1}{item.plannedSessions>1&&!["completed","cancelled"].includes(item.status)&&<button type="button" className="dw-session" disabled={busy} onClick={()=>addSession(item)}>+ جلسة</button>}</td><td>{Number(item.price||0).toLocaleString("ar-EG")} ج.م</td><td><select disabled={busy} value={item.status} onChange={e=>changeStatus(item,e.target.value)}>{PROCEDURE_STATUSES.map(status=><option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></td></tr>)}</tbody></table>{!visibleRecords.length&&<p className="dw-empty">لا توجد إجراءات في خطة العلاج حتى الآن.</p>}</div><div className="dw-total">إجمالي خطة العلاج <strong>{total.toLocaleString("ar-EG")} ج.م</strong></div></section>
    </div><aside className="dw-side"><div className="dw-side-tabs"><strong>إضافة إجراء</strong><span>الإجراءات الحالية</span><span>الجلسات</span></div><form onSubmit={create}>
    <div className="dw-field"><h4>1. السن والأسطح</h4>{isDental&&<><label>رقم السن<input value={form.toothNumber} placeholder="اختار من خريطة الأسنان" onChange={e=>{setForm(prev=>({...prev,toothNumber:e.target.value}));setSelectedTooth(validateToothNumber(e.target.value)?Number(e.target.value):null);}}/></label><div className="dw-surface-buttons">{["O","M","D","B","L"].map(x=><button type="button" key={x} className={form.surfaces.includes(x)?"on":""} onClick={()=>setForm(prev=>({...prev,surfaces:prev.surfaces.includes(x)?prev.surfaces.filter(y=>y!==x):[...prev.surfaces,x]}))}>{x}</button>)}</div></>}</div>
    <div className="dw-field"><h4>2. نوع الإجراء</h4><input placeholder="ابحث عن إجراء..." value={search} onChange={e=>setSearch(e.target.value)}/><div className="dw-category-grid">{categories.map(category=><button type="button" key={category} className={activeCategory===category?"on":""} onClick={()=>setActiveCategory(activeCategory===category?"all":category)}>{({"restorative":"حشوات","endodontics":"علاج عصب","prosthodontics":"تركيبات","implants":"زراعة","surgery":"جراحة","orthodontics":"تقويم","imaging":"أشعة","periodontics":"لثة"})[category]||category}</button>)}</div><select value={form.code} required onChange={e=>setForm(prev=>({...prev,code:e.target.value}))}><option value="">اختر الإجراء</option>{options.map(item=><option key={item.code} value={item.code}>{item.name}</option>)}{selected&&!options.some(item=>item.code===selected.code)&&<option value={selected.code}>{selected.name}</option>}</select></div>
    <div className="dw-field"><h4>3. تفاصيل الإجراء</h4><label>التكلفة المتوقعة<input type="number" min="0" step="0.01" required value={form.price} onChange={e=>setForm(prev=>({...prev,price:e.target.value}))}/></label>{selected?.supportsSessions&&<label>عدد الجلسات<input type="number" min="1" max="30" value={form.plannedSessions} onChange={e=>setForm(prev=>({...prev,plannedSessions:e.target.value}))}/></label>}<label>ملاحظات<textarea rows="3" value={form.notes} onChange={e=>setForm(prev=>({...prev,notes:e.target.value}))}/></label>{selected?.requiresConsent&&<small>يلزم توثيق موافقة المريض قبل الإكمال.</small>}</div>
    <button type="submit" className="dw-save" disabled={busy||!clinicId||!selected}>{busy?"جاري الحفظ...":"+ إضافة إلى خطة العلاج"}</button>
    </form></aside></div>
  </main>;
}
