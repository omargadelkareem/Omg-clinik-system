import { useMemo, useState } from "react";
import { X, Search, LoaderCircle } from "lucide-react";
import { createAppointment, createPatientAndAppointment, checkInAppointment } from "../../services/appointmentService";
import { createFinanceTransaction, collectFinancePayment } from "../../services/financeService";


const dateKey = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-"); };
export default function QuickReceptionModal({ clinicId, patients, doctors, staffId, onClose, onSuccess }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState(doctors[0]?.id || "");
  const [type, setType] = useState("كشف");
  const [date, setDate] = useState(dateKey());
  const [time, setTime] = useState(() => { const d = new Date(); return [String(d.getHours()).padStart(2,"0"),String(d.getMinutes()).padStart(2,"0")].join(":"); });
  const [present, setPresent] = useState(true);
  const [paid, setPaid] = useState("none");
  const [partialAmount, setPartialAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const doctor = doctors.find(d => d.id === doctorId) || null;
  const price = Number(type === "متابعة" ? doctor?.followupPrice : doctor?.consultationPrice) || 0;
  const filtered = useMemo(() => {
    const q = phone.trim().toLowerCase();
    return q ? patients.filter(p => String(p.phone || "").includes(q) || String(p.name || "").toLowerCase().includes(q)).slice(0,5) : [];
  }, [phone, patients]);
  const selected = patients.find(p => p.id === patientId);
  const amount = paid === "full" ? price : paid === "partial" ? Number(partialAmount) : 0;
  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setError("");
    if (!clinicId) { setError("بيانات العيادة غير متاحة."); return; }
    if (!selected && (!name.trim() || !phone.trim())) { setError("اكتب اسم المريض ورقم الهاتف، أو اختر مريضًا مسجلًا."); return; }
    if (!date || !time) { setError("حدد التاريخ والوقت."); return; }
    if (present && date !== dateKey()) { setError("تسجيل الحضور متاح لمواعيد اليوم فقط."); return; }
    if (paid !== "none" && price <= 0) { setError("لا يوجد سعر مسجل للطبيب. حدد الطبيب وسعر الكشف أولًا."); return; }
    if (paid === "partial" && (!Number.isFinite(amount) || amount <= 0 || amount >= price)) { setError("المبلغ الجزئي لازم يكون أكبر من صفر وأقل من سعر الكشف."); return; }
    setSaving(true);
    let saved = false;
    try {
      const args = { clinicId, doctor, date, time, type, duration:30, createdBy:staffId };
      const result = selected
        ? await createAppointment({ ...args, patient:selected })
        : await createPatientAndAppointment({ ...args, patientData:{name:name.trim(),phone:phone.trim()} });
      const appointment = result.appointment || result;
      saved = true;
      if (price > 0) {
        const invoice = await createFinanceTransaction({
          clinicId, patientId:appointment.patientId, patientCode:appointment.patientCode,
          patientName:appointment.patientName, patientPhone:appointment.patientPhone,
          doctorId:appointment.doctorId, doctorName:appointment.doctorName,
          appointmentId:appointment.id, serviceType:type, serviceName:type,
          amount:price, createdBy:staffId,
        });
        if (amount > 0) await collectFinancePayment({clinicId,transactionId:invoice.id,amount,method,receivedBy:staffId});
      }
      if (present) await checkInAppointment({clinicId,appointment,staffId});
      onSuccess(present ? "تم استقبال المريض وتسجيل الحجز بنجاح." : "تم تسجيل الحجز بنجاح.");
    } catch (err) {
      setError(saved ? "تم حفظ الحجز، لكن تعذّر إكمال الدفع أو تسجيل الحضور. لا تضغط حفظ مرة ثانية؛ راجع الحجز في عيادة اليوم. " + (err.message || "") : (err.message || "تعذر حفظ الحجز."));
    } finally { setSaving(false); }
  }
  return <div className="quick-reception-layer" role="dialog" aria-modal="true" aria-label="استقبال مريض">
    <div className="quick-reception-backdrop" onClick={saving ? undefined : onClose}/>
    <form className="quick-reception-panel" onSubmit={submit}>
      <header><div><small>OMG CLINIC · استقبال سريع</small><h2>استقبال مريض</h2><p>بيانات بسيطة، وخطوة واحدة للحفظ.</p></div><button type="button" onClick={onClose} disabled={saving} aria-label="إغلاق"><X size={20}/></button></header>
      <div className="quick-reception-body">
        <div className="quick-reception-step"><b>1</b><strong>بيانات المريض</strong></div>
        <label>ابحث برقم الهاتف أو الاسم<div className="quick-reception-search"><Search size={17}/><input autoFocus value={phone} onChange={e=>{setPhone(e.target.value);setPatientId("");}} placeholder="رقم الهاتف أو اسم المريض"/></div></label>
        {filtered.length>0 && !selected && <div className="quick-reception-results">{filtered.map(p=><button type="button" key={p.id} onClick={()=>{setPatientId(p.id);setPhone(p.phone || "");setName(p.name || "");}}><strong>{p.name}</strong><span>{p.phone}</span></button>)}</div>}
        {selected ? <div className="quick-reception-selected">✓ مريض مسجل: {selected.name} <button type="button" onClick={()=>{setPatientId("");setName("");setPhone("");}}>تغيير</button></div> : <label>اسم المريض الجديد<input value={name} onChange={e=>setName(e.target.value)} placeholder="اسم المريض بالكامل" required/></label>}
        <div className="quick-reception-step"><b>2</b><strong>الكشف والدفع</strong></div>
        <div className="quick-reception-grid">
          <label>الطبيب<select value={doctorId} onChange={e=>setDoctorId(e.target.value)}><option value="">اختر الطبيب</option>{doctors.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label>نوع الزيارة<select value={type} onChange={e=>setType(e.target.value)}><option>كشف</option><option>متابعة</option><option>استشارة</option><option>إجراء</option></select></label>
        </div>
        <div className="quick-reception-grid">
          <label>التاريخ<input type="date" value={date} onChange={e=>{setDate(e.target.value);if(e.target.value!==dateKey())setPresent(false);}} required/></label>
          <label>الوقت<input type="time" value={time} onChange={e=>setTime(e.target.value)} required/></label>
        </div>
        <div className="quick-reception-price">سعر الكشف <strong>{price > 0 ? price.toLocaleString("ar-EG") + " ج.م" : "غير محدد"}</strong></div>
        <div className="quick-reception-choices">{[{id:"none",label:"غير مدفوع"},{id:"full",label:"مدفوع بالكامل"},{id:"partial",label:"دفع جزء"}].map(o=><button type="button" key={o.id} className={paid===o.id?"active":""} onClick={()=>setPaid(o.id)}>{o.label}</button>)}</div>
        {paid==="partial" && <label>المبلغ المدفوع<input type="number" min="1" max={Math.max(1,price-0.01)} step="0.01" value={partialAmount} onChange={e=>setPartialAmount(e.target.value)} placeholder="المبلغ بالجنيه" required/></label>}
        {paid!=="none" && <label>طريقة الدفع<select value={method} onChange={e=>setMethod(e.target.value)}><option value="cash">نقدي</option><option value="vodafone_cash">فودافون كاش</option><option value="instapay">إنستاباي</option></select></label>}
        <div className="quick-reception-step"><b>3</b><strong>تأكيد الاستقبال</strong></div>
        <label className="quick-reception-present"><input type="checkbox" checked={present} disabled={date!==dateKey()} onChange={e=>setPresent(e.target.checked)}/><span>المريض حاضر الآن — أضفه لانتظار الطبيب</span></label>
        {error && <div className="quick-reception-error" role="alert">{error}</div>}
      </div>
      <footer><button type="button" onClick={onClose} disabled={saving}>إلغاء</button><button type="submit" disabled={saving}>{saving ? <><LoaderCircle size={17}/> جاري الحفظ...</> : "تأكيد وحفظ"}</button></footer>
    </form>
  </div>;
}
