import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { BUILTIN_PROCEDURES, PROCEDURE_STATUSES, validateToothNumber } from "../../config/procedureCatalog";
import { createPatientProcedure, subscribePatientProcedures, updatePatientProcedureStatus } from "../../services/procedureService";
import "./PatientProceduresPage.css";

const STATUS_LABELS = { planned: "مخطط", scheduled: "مجدول", in_progress: "جاري العلاج", completed: "مكتمل", cancelled: "ملغي" };
const DENTAL_SPECIALTIES = ["dentistry", "orthodontics", "endodontics", "periodontics", "prosthodontics", "pediatric_dentistry", "oral_maxillofacial_surgery"];
const emptyForm = { code: "", toothNumber: "", price: "", notes: "" };

export default function PatientProceduresPage() {
  const { patientId } = useParams();
  const { clinicId, firebaseUser, specialtyId, primarySpecialtyId } = useAuth();
  const [specialty, setSpecialty] = useState("dentistry");
  const [form, setForm] = useState(emptyForm);
  const [records, setRecords] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    const current = specialtyId || primarySpecialtyId;
    if (current) setSpecialty(DENTAL_SPECIALTIES.includes(current) ? "dentistry" : current);
  }, [specialtyId, primarySpecialtyId]);
  useEffect(() => {
    if (!clinicId || !patientId) return undefined;
    return subscribePatientProcedures({ clinicId, patientId }, setRecords, err => setError(err.message || "تعذر تحميل الإجراءات"));
  }, [clinicId, patientId]);
  const options = useMemo(() => BUILTIN_PROCEDURES.filter(item => item.specialty === specialty), [specialty]);
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
        input: { code: selected.code, specialty: selected.specialty, toothNumber: form.toothNumber || null, price: form.price || 0, notes: form.notes },
      });
      setForm(emptyForm); setSuccess("تمت إضافة الإجراء إلى ملف المريض");
    } catch (err) { setError(err.message || "تعذر حفظ الإجراء"); }
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
  return <main className="procedures-page" dir="rtl">
    <header className="procedures-header">
      <div><Link to={`/patients/${patientId}`}>← الرجوع لملف المريض</Link><h1>الإجراءات وخطة العلاج</h1><p>سجل الإجراءات الطبية والأسنان والجلسات المخططة</p></div>
      <div className="procedures-total"><small>إجمالي الإجراءات المسجلة</small><strong>{total.toLocaleString("ar-EG")} ج.م</strong></div>
    </header>
    {error && <p className="procedures-alert error" role="alert">{error}</p>}
    {success && <p className="procedures-alert success" role="status">{success}</p>}
    <div className="procedures-grid">
      <section className="procedures-card">
        <h2>إضافة إجراء جديد</h2>
        <form onSubmit={create}>
          <label>التخصص
            <select value={specialty} onChange={e => { setSpecialty(e.target.value); setForm(emptyForm); }}>
              {[...new Set(BUILTIN_PROCEDURES.map(item => item.specialty))].map(value => <option key={value} value={value}>{({dentistry:"الأسنان",general_surgery:"الجراحة العامة",gynecology:"النساء والتوليد",orthopedics:"العظام",ent:"الأنف والأذن",ophthalmology:"العيون",dermatology:"الجلدية",urology:"المسالك"})[value] || value}</option>)}
            </select>
          </label>
          <label>الإجراء الطبي
            <select required value={form.code} onChange={e => setForm(prev => ({ ...prev, code: e.target.value }))}>
              <option value="">اختر الإجراء</option>
              {options.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select>
          </label>
          {selected?.requiresTooth && <label>رقم السن (FDI)
            <input required inputMode="numeric" placeholder="مثال: 16" value={form.toothNumber} onChange={e => setForm(prev => ({ ...prev, toothNumber: e.target.value }))}/>
          </label>}
          <label>التكلفة (جنيه مصري)
            <input required type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}/>
          </label>
          <label>ملاحظات الطبيب
            <textarea rows="3" value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}/>
          </label>
          {selected?.requiresConsent && <p className="procedures-hint">هذا الإجراء يحتاج توثيق موافقة المريض قبل تسجيله كمكتمل.</p>}
          <button type="submit" disabled={busy || !clinicId}>+ إضافة إلى خطة العلاج</button>
        </form>
      </section>
      <section className="procedures-card">
        <h2>سجل الإجراءات <span>({records.length})</span></h2>
        {!records.length && <p className="procedures-empty">لا توجد إجراءات مسجلة لهذا المريض حتى الآن.</p>}
        <div className="procedures-records">{records.map(item => <article key={item.id} className="procedures-record">
          <div className="procedures-record-top"><strong>{item.name}</strong><span>{Number(item.price || 0).toLocaleString("ar-EG")} ج.م</span></div>
          <p>{item.toothNumber ? `السن: ${item.toothNumber} · ` : ""}{item.notes || "بدون ملاحظات"}</p>
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
