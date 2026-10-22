import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { BUILTIN_PROCEDURES, PROCEDURE_STATUSES, validateToothNumber } from "../../config/procedureCatalog";
import { addProcedureSession, createPatientProcedure, subscribePatientProcedures, updatePatientProcedureStatus } from "../../services/procedureService";
import "./PatientProceduresPage.css";
import DentalAnatomyChart from "./DentalAnatomyChart";
import { subscribeInstallmentPlans, saveInstallmentPlan, installmentProgress } from "../../services/installmentPlanService";
import { subscribePatientFinance } from "../../services/patientFinanceService";
import { createFinanceTransaction, collectFinancePayment, PAYMENT_METHODS } from "../../services/financeService";

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
  const [activeTab, setActiveTab] = useState("plan");
  const [sideTab, setSideTab] = useState("add");
  const [finance, setFinance] = useState({transactions:[],payments:[],summary:{billed:0,paid:0,remaining:0}});
  const [paymentAmounts, setPaymentAmounts] = useState({});
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [installmentPlans,setInstallmentPlans] = useState([]);
  const [scheduleForms,setScheduleForms] = useState({});
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
  useEffect(() => {
    if (!clinicId || !patientId) return undefined;
    return subscribePatientFinance(clinicId, patientId, setFinance, err => setError(err.message || "تعذر تحميل المدفوعات"));
  }, [clinicId, patientId]);
  useEffect(() => {
    if (!clinicId || !patientId) return undefined;
    return subscribeInstallmentPlans(clinicId,patientId,setInstallmentPlans,err=>setError(err.message||"تعذر تحميل جدول الأقساط"));
  },[clinicId,patientId]);
  const scheduleInvoice = async tx => {
    const draft=scheduleForms[tx.id]||{};
    setBusy(true);setError("");setSuccess("");
    try{
      await saveInstallmentPlan({clinicId,patientId,transaction:tx,deposit:Number(draft.deposit||0),count:Number(draft.count||1),firstDueDate:draft.date,actorId:firebaseUser?.uid});
      setSuccess("تم حفظ جدول الأقساط وربطه بالفاتورة");
    }catch(err){setError(err.message||"تعذر حفظ جدول الأقساط");}finally{setBusy(false);}
  };
  const options = useMemo(() => BUILTIN_PROCEDURES.filter(item => item.specialty === specialty && item.name.includes(search.trim()) && (activeCategory === "all" || item.category === activeCategory)), [specialty, search, activeCategory]);
  const categories = [...new Set(BUILTIN_PROCEDURES.filter(item => item.specialty === specialty).map(item => item.category))];
  const selected = BUILTIN_PROCEDURES.find(item => item.code === form.code && item.specialty === specialty);
  const total = records.filter(item=>item.status!=="cancelled").reduce((sum, item) => sum + Number(item.price || 0), 0);
  const paid = finance.summary.paid || 0;
  const invoiced = finance.summary.billed || 0;
  const outstanding = Math.max(0,total-paid);
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
  const createInvoice = async record => {
    setBusy(true); setError("");
    try {
      if (finance.transactions.some(tx => tx.visitId === `procedure:${record.id}` && tx.status !== "cancelled")) throw new Error("تم إصدار فاتورة لهذا الإجراء بالفعل");
      await createFinanceTransaction({clinicId,patientId,visitId:`procedure:${record.id}`,serviceType:"إجراء طبي",serviceName:record.name,amount:Number(record.price),createdBy:firebaseUser.uid});
      setSuccess("تم إصدار الفاتورة ويمكن تحصيلها على دفعات");setActiveTab("finance");
    } catch(err){setError(err.message||"تعذر إصدار الفاتورة");}finally{setBusy(false);}
  };
  const collectPayment = async tx => {
    setBusy(true);setError("");
    try {
      await collectFinancePayment({clinicId,transactionId:tx.id,amount:Number(paymentAmounts[tx.id]),method:paymentMethod,receivedBy:firebaseUser.uid});
      setPaymentAmounts(prev=>({...prev,[tx.id]:""}));setSuccess("تم تسجيل الدفعة بنجاح");
    }catch(err){setError(err.message||"تعذر تحصيل الدفعة");}finally{setBusy(false);}
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
    <nav className="dw-tabs" aria-label="أقسام المريض">
      <Link to={`/patients/${patientId}`}>الملف الشخصي</Link>
      <Link to={`/patients/${patientId}`}>التاريخ الطبي</Link>
      <Link to={`/patients/${patientId}/visit/new`}>الكشف</Link>
      <button type="button" className={activeTab==="plan"?"active":""} onClick={()=>setActiveTab("plan")}>خطة العلاج</button>
      <button type="button" className={activeTab==="sessions"?"active":""} onClick={()=>setActiveTab("sessions")}>الجلسات</button>
      <Link to="/medical-files">الأشعة</Link>
      <button type="button" className={activeTab==="finance"?"active":""} onClick={()=>setActiveTab("finance")}>الفواتير والمدفوعات</button>
    </nav>
    {error && <p role="alert" className="dw-alert">{error}</p>}{success && <p role="status" className="dw-alert">{success}</p>}
    <div className="dw-columns"><div className="dw-main">
      {activeTab==="finance"&&<section className="dw-plan dw-finance"><div className="dw-title"><h3>الحساب والمدفوعات</h3><span>تحصيل على دفعات</span></div><div className="dw-finance-summary"><div>قيمة خطة العلاج<strong>{total.toLocaleString("ar-EG")} ج.م</strong></div><div>الفواتير الصادرة<strong>{invoiced.toLocaleString("ar-EG")} ج.م</strong></div><div>المدفوع فعليًا<strong>{paid.toLocaleString("ar-EG")} ج.م</strong></div><div>المتبقي من الفواتير<strong>{(finance.summary.remaining||0).toLocaleString("ar-EG")} ج.م</strong></div></div><p className="dw-finance-note">إجمالي الخطة تقديري، ولا يعتبر مبلغًا مستحقًا إلا بعد إصدار الفاتورة. الفواتير هنا تشمل جميع خدمات المريض المسجلة في المالية.</p><div className="dw-table-wrap"><table><thead><tr><th>الفاتورة</th><th>الخدمة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>تحصيل دفعة</th></tr></thead><tbody>{finance.transactions.map(tx=><tr key={tx.id}><td>{tx.invoiceNumber}</td><td>{tx.serviceName||tx.serviceType}</td><td>{tx.amount}</td><td>{tx.paid||0}</td><td>{tx.remaining||0}</td><td>{Number(tx.remaining)>0&&<div className="dw-payment-form"><input type="number" min="0.01" step="0.01" max={tx.remaining} placeholder="المبلغ" value={paymentAmounts[tx.id]||""} onChange={e=>setPaymentAmounts(prev=>({...prev,[tx.id]:e.target.value}))}/><select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>{Object.entries(PAYMENT_METHODS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><button type="button" disabled={busy||!(Number(paymentAmounts[tx.id])>0)||Number(paymentAmounts[tx.id])>Number(tx.remaining)} onClick={()=>collectPayment(tx)}>تحصيل</button></div>}</td></tr>)}</tbody></table>{!finance.transactions.length&&<p className="dw-empty">لا توجد فواتير بعد. أصدر فاتورة من خطة العلاج أولًا.</p>}{finance.transactions.map(tx=>{const plan=installmentPlans.find(p=>p.transactionId===tx.id);const draft=scheduleForms[tx.id]||{};return <div className="dw-installment" key={tx.id}><h4>جدول أقساط الفاتورة {tx.invoiceNumber}</h4>{plan?<><div className="dw-installment-meta"><span>المقدم: {plan.deposit} ج.م</span><span>المحصل من الفاتورة: {installmentProgress(plan,finance.payments).collected} ج.م</span></div><table><thead><tr><th>القسط</th><th>تاريخ الاستحقاق</th><th>القيمة</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th></tr></thead><tbody>{installmentProgress(plan,finance.payments).rows.map(row=><tr key={row.index}><td>{row.index}</td><td>{row.dueDate}</td><td>{row.amount}</td><td>{row.paid}</td><td>{row.remaining}</td><td>{row.status==="paid"?"مسدد":row.status==="partial"?"جزئي":"مستحق"}</td></tr>)}</tbody></table></>:<div className="dw-schedule-form"><label>مقدم<input type="number" min="0" max={tx.amount} value={draft.deposit||""} onChange={e=>setScheduleForms(prev=>({...prev,[tx.id]:{...draft,deposit:e.target.value}}))}/></label><label>عدد الأقساط<input type="number" min="1" max="36" value={draft.count||1} onChange={e=>setScheduleForms(prev=>({...prev,[tx.id]:{...draft,count:e.target.value}}))}/></label><label>أول استحقاق<input type="date" value={draft.date||""} onChange={e=>setScheduleForms(prev=>({...prev,[tx.id]:{...draft,date:e.target.value}}))}/></label><button type="button" disabled={busy||!draft.date} onClick={()=>scheduleInvoice(tx)}>حفظ جدول الأقساط</button></div>}</div>})}</div></section>}
      {activeTab==="sessions"&&<section className="dw-plan"><div className="dw-title"><h3>الجلسات العلاجية</h3></div>{records.filter(x=>x.plannedSessions>1).map(item=><div className="dw-session-row" key={item.id}><strong>{item.name} — السن {item.toothNumber||"—"}</strong><span>{Object.keys(item.sessions||{}).length} / {item.plannedSessions}</span><button type="button" disabled={busy||Object.keys(item.sessions||{}).length>=item.plannedSessions||["completed","cancelled"].includes(item.status)} onClick={()=>addSession(item)}>+ تسجيل جلسة</button></div>)}{!records.some(x=>x.plannedSessions>1)&&<p className="dw-empty">لا توجد خطط متعددة الجلسات.</p>}</section>}
      {activeTab==="plan"&&<>
      {isDental && <section className="dw-chart"><div className="dw-title"><h3>مخطط الأسنان</h3><div className="dw-switch"><button className={dentition==="permanent"?"on":""} onClick={()=>setDentition("permanent")}>الأسنان الدائمة</button><button className={dentition==="primary"?"on":""} onClick={()=>setDentition("primary")}>الأسنان اللبنية</button></div></div>
      <DentalAnatomyChart teeth={teeth} selectedTooth={selectedTooth} onSelect={chooseTooth} statuses={toothStatuses}/>
      <div className="dw-legend"><span>🟠 مخطط</span><span>🔵 جاري العلاج</span><span>🟢 مكتمل</span></div>
      <div className="dw-surface-panel"><h3>السن <b>{selectedTooth || "—"}</b></h3><p>اختار السن ثم حدد أسطح العلاج</p><div className="dw-surfaces">{["O","M","D","B","L"].map(surface=><button key={surface} className={form.surfaces.includes(surface)?"on":""} onClick={()=>setForm(prev=>({...prev,surfaces:prev.surfaces.includes(surface)?prev.surfaces.filter(x=>x!==surface):[...prev.surfaces,surface]}))}><b>{surface}</b><small>{({O:"إطباقي",M:"أنسي",D:"بعيد",B:"دهليزي",L:"لساني"})[surface]}</small></button>)}</div></div>
      </section>}
      <section className="dw-plan"><div className="dw-title"><h3>خطة العلاج ({records.length} إجراءات)</h3><label><input type="checkbox" checked={showCompleted} onChange={e=>setShowCompleted(e.target.checked)}/> إظهار المكتمل</label></div><div className="dw-table-wrap"><table><thead><tr><th>السن</th><th>الإجراء</th><th>الأسطح</th><th>الجلسات</th><th>التكلفة</th><th>الحالة</th></tr></thead><tbody>{visibleRecords.map(item=><tr key={item.id}><td>{item.toothNumber||"—"}</td><td>{item.name}</td><td>{item.surfaces?.join(", ")||"—"}</td><td>{Object.keys(item.sessions||{}).length}/{item.plannedSessions||1}{item.plannedSessions>1&&Object.keys(item.sessions||{}).length<item.plannedSessions&&!["completed","cancelled"].includes(item.status)&&<button type="button" className="dw-session" disabled={busy} onClick={()=>addSession(item)}>+ جلسة</button>}</td><td>{Number(item.price||0).toLocaleString("ar-EG")} ج.م</td><td><select disabled={busy} value={item.status} onChange={e=>changeStatus(item,e.target.value)}>{PROCEDURE_STATUSES.map(status=><option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></td></tr>)}</tbody></table>{!visibleRecords.length&&<p className="dw-empty">لا توجد إجراءات في خطة العلاج حتى الآن.</p>}</div><div className="dw-total"><span>إجمالي خطة العلاج: <strong>{total.toLocaleString("ar-EG")} ج.م</strong></span><span>المدفوع: <strong>{paid.toLocaleString("ar-EG")} ج.م</strong></span><span>المتبقي على الفواتير: <strong>{(finance.summary.remaining||0).toLocaleString("ar-EG")} ج.م</strong></span></div><div className="dw-invoice-actions">{records.filter(item=>item.status!=="cancelled"&&Number(item.price)>0&&!finance.transactions.some(tx=>tx.visitId===`procedure:${item.id}`&&tx.status!=="cancelled")).map(item=><button key={item.id} type="button" disabled={busy} onClick={()=>createInvoice(item)}>إصدار فاتورة: {item.name} — {item.price} ج.م</button>)}</div></section>
      </>}
    </div><aside className="dw-side"><div className="dw-side-tabs"><button type="button" className={sideTab==="add"?"on":""} onClick={()=>setSideTab("add")}>إضافة إجراء</button><button type="button" className={sideTab==="current"?"on":""} onClick={()=>setSideTab("current")}>الإجراءات الحالية</button><button type="button" className={sideTab==="sessions"?"on":""} onClick={()=>setSideTab("sessions")}>الجلسات</button></div>{sideTab==="add"&&<form onSubmit={create}>
    <div className="dw-field"><h4>1. السن والأسطح</h4>{isDental&&<><label>رقم السن<input value={form.toothNumber} placeholder="اختار من خريطة الأسنان" onChange={e=>{setForm(prev=>({...prev,toothNumber:e.target.value}));setSelectedTooth(validateToothNumber(e.target.value)?Number(e.target.value):null);}}/></label><div className="dw-surface-buttons">{["O","M","D","B","L"].map(x=><button type="button" key={x} className={form.surfaces.includes(x)?"on":""} onClick={()=>setForm(prev=>({...prev,surfaces:prev.surfaces.includes(x)?prev.surfaces.filter(y=>y!==x):[...prev.surfaces,x]}))}>{x}</button>)}</div></>}</div>
    <div className="dw-field"><h4>2. نوع الإجراء</h4><input placeholder="ابحث عن إجراء..." value={search} onChange={e=>setSearch(e.target.value)}/><div className="dw-category-grid">{categories.map(category=><button type="button" key={category} className={activeCategory===category?"on":""} onClick={()=>setActiveCategory(activeCategory===category?"all":category)}>{({"restorative":"حشوات","endodontics":"علاج عصب","prosthodontics":"تركيبات","implants":"زراعة","surgery":"جراحة","orthodontics":"تقويم","imaging":"أشعة","periodontics":"لثة"})[category]||category}</button>)}</div><select value={form.code} required onChange={e=>setForm(prev=>({...prev,code:e.target.value}))}><option value="">اختر الإجراء</option>{options.map(item=><option key={item.code} value={item.code}>{item.name}</option>)}{selected&&!options.some(item=>item.code===selected.code)&&<option value={selected.code}>{selected.name}</option>}</select></div>
    <div className="dw-field"><h4>3. تفاصيل الإجراء</h4><label>التكلفة المتوقعة<input type="number" min="0" step="0.01" required value={form.price} onChange={e=>setForm(prev=>({...prev,price:e.target.value}))}/></label>{selected?.supportsSessions&&<label>عدد الجلسات<input type="number" min="1" max="30" value={form.plannedSessions} onChange={e=>setForm(prev=>({...prev,plannedSessions:e.target.value}))}/></label>}<label>ملاحظات<textarea rows="3" value={form.notes} onChange={e=>setForm(prev=>({...prev,notes:e.target.value}))}/></label>{selected?.requiresConsent&&<small>يلزم توثيق موافقة المريض قبل الإكمال.</small>}</div>
    <button type="submit" className="dw-save" disabled={busy||!clinicId||!selected}>{busy?"جاري الحفظ...":"+ إضافة إلى خطة العلاج"}</button>
    </form>}{sideTab==="current"&&<div className="dw-side-list">{records.map(item=><div key={item.id}><strong>{item.name}</strong><small>{item.toothNumber?"السن "+item.toothNumber:""} — {STATUS_LABELS[item.status]}</small></div>)}</div>}{sideTab==="sessions"&&<div className="dw-side-list">{records.filter(item=>item.plannedSessions>1).map(item=><div key={item.id}><strong>{item.name}</strong><small>{Object.keys(item.sessions||{}).length} / {item.plannedSessions} جلسات</small></div>)}</div>}</aside></div>
  </main>;
}
