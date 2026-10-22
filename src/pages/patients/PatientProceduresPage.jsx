import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { BUILTIN_PROCEDURES, PROCEDURE_STATUSES, validateToothNumber } from "../../config/procedureCatalog";
import { addProcedureSession, createPatientProcedure, subscribePatientProcedures, updatePatientProcedureStatus } from "../../services/procedureService";
import "./PatientProceduresPage.css";

const STATUS_LABELS = { planned: "مخطط", scheduled: "مجدول", in_progress: "جاري العلاج", completed: "مكتمل", cancelled: "ملغي" };
const DENTAL_SPECIALTIES = ["dentistry", "orthodontics", "endodontics", "periodontics", "prosthodontics", "pediatric_dentistry", "oral_maxillofacial_surgery"];
const emptyForm = { code: "", toothNumber: "", price: "", notes: "", surfaces: [], plannedSessions: 1 };

export default function PatientProceduresPage() {
  const { patientId } = useParams();
  const { clinicId, firebaseUser, activeSpecialty, clinicSpecialty } = useAuth();
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [search, setSearch] = useState("");
  const [sessionNotes, setSessionNotes] = useState({});
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
  const teeth = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
  useEffect(() => {
    if (!clinicId || !patientId) return undefined;
    return subscribePatientProcedures({ clinicId, patientId }, setRecords, err => setError(err.message || "تعذر تحميل الإجراءات"));
  }, [clinicId, patientId]);
  const options = useMemo(() => BUILTIN_PROCEDURES.filter(item => item.specialty === specialty && item.name.includes(search.trim())), [specialty, search]);
  const selected = options.find(item => item.code === form.code);
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
  return <main className="procedures-page" dir="rtl">
    <header className="procedures-header">
      <div><Link to={`/patients/${patientId}`}>← الرجوع لملف المريض</Link><h1>{isDental ? "مخطط الأسنان وخطة العلاج" : "الإجراءات وخطة العلاج"}</h1><p>{specialtyLabel} · ملف المريض · إدارة العلاج من مكان واحد</p></div>
      <div className="procedures-total"><small>إجمالي الإجراءات المسجلة (ليس فاتورة)</small><strong>{total.toLocaleString("ar-EG")} ج.م</strong></div>
    </header>
    {error && <p className="procedures-alert error" role="alert">{error}</p>}
    {success && <p className="procedures-alert success" role="status">{success}</p>}
    {isDental && <section className="procedures-card odontogram-panel">
      <div className="odontogram-heading"><div><h2>خريطة الأسنان التفاعلية</h2><p>اضغط على السن لتحديده وإضافة العلاج مباشرة</p></div><span className="odontogram-selection">{selectedTooth ? `السن المختار: ${selectedTooth}` : "اختر سنًا"}</span></div>
      <div className="odontogram-legend"><span><i className="tooth-indicator planned"/>مخطط</span><span><i className="tooth-indicator in_progress"/>جاري العلاج</span><span><i className="tooth-indicator completed"/>مكتمل</span></div>
      <div className="odontogram-arches">
        <div className="odontogram-arch-label">الفك العلوي</div>
        <div className="odontogram-row">{teeth.slice(0,16).map(tooth => <button type="button" key={tooth} aria-pressed={selectedTooth === tooth} className={`odontogram-tooth ${selectedTooth === tooth ? "selected" : ""} ${toothStatuses.get(tooth) || ""}`} onClick={() => { setSelectedTooth(tooth); setForm(prev => ({...prev, toothNumber:String(tooth)})); }}><span className="tooth-shape">♧</span><small>{tooth}</small></button>)}</div>
        <div className="odontogram-arch-divider"/>
        <div className="odontogram-row">{teeth.slice(16).map(tooth => <button type="button" key={tooth} aria-pressed={selectedTooth === tooth} className={`odontogram-tooth ${selectedTooth === tooth ? "selected" : ""} ${toothStatuses.get(tooth) || ""}`} onClick={() => { setSelectedTooth(tooth); setForm(prev => ({...prev, toothNumber:String(tooth)})); }}><small>{tooth}</small><span className="tooth-shape">♧</span></button>)}</div>
        <div className="odontogram-arch-label">الفك السفلي</div>
      </div>
      <p className="odontogram-note">مخطط FDI مبدئي للأسنان الدائمة؛ عرض حالات الأسطح والأسنان اللبنية سيتم إضافته لاحقًا.</p>
    </section>}
    <div className="procedures-grid">
      <section className="procedures-card">
        <h2>{isDental ? "إضافة علاج للسن" : "إضافة إجراء طبي"}</h2>
        <form onSubmit={create}>
          <div className="procedures-specialty-pill">{specialtyLabel} <small>محدد من حساب الطبيب</small></div>
          <label>ابحث عن الإجراء
            <input placeholder="بحث سريع..." value={search} onChange={e => setSearch(e.target.value)}/>
          </label>
          <div className="procedure-picks" role="group" aria-label="اختيار الإجراء">
            {options.map(item => <button type="button" key={item.code} aria-pressed={form.code === item.code} className={form.code === item.code ? "active" : ""} onClick={() => setForm(prev => ({...prev, code:item.code}))}>{item.name}</button>)}
            {!options.length && <p>لا توجد إجراءات معرفة لهذا التخصص حاليًا.</p>}
          </div>
          {selected?.requiresTooth && <label>رقم السن
            <input required inputMode="numeric" placeholder="اختار من المخطط أو اكتب رقم FDI" value={form.toothNumber} onChange={e => {setForm(prev => ({ ...prev, toothNumber: e.target.value })); setSelectedTooth(validateToothNumber(e.target.value) ? Number(e.target.value) : null);}}/>
          </label>}
          {selected?.requiresTooth && <div className="surfaces-control"><strong>أسطح السن</strong><div className="surface-buttons">{["M","D","O","B","L"].map(surface => <button key={surface} type="button" className={form.surfaces.includes(surface) ? "active" : ""} aria-pressed={form.surfaces.includes(surface)} onClick={() => setForm(prev => ({...prev, surfaces: prev.surfaces.includes(surface) ? prev.surfaces.filter(x => x !== surface) : [...prev.surfaces, surface]}))}>{surface}</button>)}</div></div>}
          {selected?.supportsSessions && <label>عدد الجلسات المخططة<input type="number" min="1" max="30" value={form.plannedSessions} onChange={e => setForm(prev => ({...prev, plannedSessions: e.target.value}))}/></label>}
          <label>التكلفة (جنيه مصري)
            <input required type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}/>
          </label>
          <label>ملاحظات الطبيب
            <textarea rows="3" placeholder="تفاصيل الحالة أو الخطة..." value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}/>
          </label>
          {selected?.requiresConsent && <p className="procedures-hint">هذا الإجراء يحتاج توثيق موافقة المريض قبل تسجيله كمكتمل.</p>}
          <button type="submit" disabled={busy || !clinicId || !selected}>+ إضافة إلى خطة العلاج</button>
        </form>
      </section>
      <section className="procedures-card">
        <h2>خطة العلاج <span>({records.length})</span></h2>
        {!records.length && <p className="procedures-empty">ابدأ باختيار {isDental ? "سن وإجراء" : "إجراء"} لإضافة أول خطوة علاجية.</p>}
        <div className="procedures-records">{records.map(item => <article key={item.id} className="procedures-record">
          <div className="procedures-record-top"><strong>{item.name}</strong><span>{Number(item.price || 0).toLocaleString("ar-EG")} ج.م</span></div>
          <p>{item.toothNumber ? `السن: ${item.toothNumber} · ` : ""}{item.notes || "بدون ملاحظات"}</p>
          {!!item.surfaces?.length && <p>أسطح السن: {item.surfaces.join(" · ")}</p>}
          {item.plannedSessions > 1 && <p>الجلسات: {Object.keys(item.sessions || {}).length} / {item.plannedSessions}</p>}
          {item.plannedSessions > 1 && item.status !== "completed" && item.status !== "cancelled" && <div className="session-entry"><input aria-label="ملاحظات الجلسة" placeholder="ملاحظات الجلسة الجديدة" value={sessionNotes[item.id] || ""} onChange={e => setSessionNotes(prev => ({...prev, [item.id]: e.target.value}))}/><button type="button" disabled={busy} onClick={() => addSession(item)}>+ تسجيل جلسة</button></div>}
          <div className="procedures-record-footer">
            <select aria-label="حالة الإجراء" disabled={busy} value={item.status} onChange={e => changeStatus(item, e.target.value)}>
              {PROCEDURE_STATUSES.map(value => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
            </select>
            <small>{item.createdAt ? new Date(item.createdAt).toLocaleDateString("ar-EG") : ""}</small>
          </div>
          {item.requiresConsent && !item.consentDocumentId && <p className="procedures-hint">الموافقة الطبية غير موثقة — لا يمكن إكمال الإجراء.</p>}
        </article>)}</div>
      </section>
    </div>
  </main>;
}
