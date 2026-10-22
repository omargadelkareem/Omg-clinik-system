import { useEffect, useState } from "react";
import { CalendarDays, Plus, LoaderCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { subscribeAppointments, subscribeQueue } from "../services/appointmentService";
import { subscribeFinanceTransactions } from "../services/financeService";
import { subscribeAppointmentPatients, subscribeAppointmentDoctors } from "../services/appointmentService";
import QuickReceptionModal from "./appointments/QuickReceptionModal";
import "./DashboardPage.css";

function dayKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,"0"), String(date.getDate()).padStart(2,"0")].join("-");
}
function showTime(value) {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{1,2}:\d{2}/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString("ar-EG", {hour:"2-digit",minute:"2-digit"});
}
const appointmentLabels = {
  pending: "في الانتظار", confirmed: "مؤكد", arrived: "حضر",
  waiting: "ينتظر الكشف", in_progress: "داخل الكشف",
  "in-progress": "داخل الكشف", completed: "تم الكشف",
  cancelled: "ملغي", no_show: "لم يحضر",
};
function paymentLabel(item) {
  if (item.paymentStatus === "paid") return "مدفوع";
  if (item.paymentStatus === "partial") return "مدفوع جزئيًا";
  if (item.paymentStatus === "unpaid") return "غير مدفوع";
  return "غير محدد";
}
export default function DashboardPage() {
  const navigate = useNavigate();
  const { clinicId, staffId, profile } = useAuth();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [notice, setNotice] = useState("");
  const [bookings, setBookings] = useState([]);
  const [queue, setQueue] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!clinicId) { setLoading(false); return undefined; }
    setLoading(true);
    setError("");
    const stopBookings = subscribeAppointments(clinicId, rows => {
      setBookings(rows);
      setLoading(false);
    }, () => { setError("تعذر تحميل المواعيد."); setLoading(false); });
    const stopQueue = subscribeQueue(clinicId, setQueue, () => {}, {includeCompleted:true,includeCancelled:true});
    const stopFinance = subscribeFinanceTransactions(clinicId, setTransactions, () => {});
    return () => { stopBookings?.(); stopQueue?.(); stopFinance?.(); };
  }, [clinicId]);
  useEffect(() => {
    if (!clinicId) return undefined;
    const stopPatients = subscribeAppointmentPatients(clinicId, setPatients);
    const stopDoctors = subscribeAppointmentDoctors(clinicId, setDoctors);
    return () => { stopPatients?.(); stopDoctors?.(); };
  }, [clinicId]);
  const todayKey = dayKey(new Date());
  const todaysBookings = bookings.filter(item => dayKey(item.date || item.appointmentDate) === todayKey);
  const scheduledIds = new Set(todaysBookings.map(item => item.id));
  const walkIns = queue.filter(item => {
    if (item.appointmentId && scheduledIds.has(item.appointmentId)) return false;
    return (item.source === "walk-in" || item.source === "walkin") && dayKey(item.checkedInAt || item.createdAt) === todayKey;
  });
  const appointments = [...todaysBookings, ...walkIns].map(item => {
    const invoice = transactions.find(tx => tx.status !== "cancelled" && (tx.appointmentId === item.id || (item.queueId && tx.queueId === item.queueId)));
    const paidAmount = Number(invoice?.paid || 0);
    const remaining = Number(invoice?.remaining ?? Math.max(0, Number(invoice?.amount || 0) - paidAmount));
    const paymentStatus = invoice ? (Number(invoice.amount) > 0 && remaining <= 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid") : (item.paymentStatus || null);
    return {...item, name:item.patientName || patients.find(p=>p.id===item.patientId)?.name || "مريض", phone:item.patientPhone || "", displayTime:showTime(item.time || item.checkedInAt), paymentStatus};
  }).sort((a,b) => String(a.displayTime).localeCompare(String(b.displayTime), "ar"));
  const paid = appointments.filter(item => item.paymentStatus === "paid").length;
  const unpaid = appointments.filter(item => item.paymentStatus === "unpaid").length;
  const partial = appointments.filter(item => item.paymentStatus === "partial").length;
  const unknown = appointments.length - paid - unpaid - partial;
  return (
    <main className="today-bookings-page" dir="rtl">
      <header className="today-bookings-header">
        <div className="today-bookings-title">
          <span>OMG CLINIC</span>
          <h1>حجوزات اليوم</h1>
          <p>{new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</p>
        </div>
        <button className="today-bookings-add" onClick={() => setBookingOpen(true)}><Plus size={17} /> حجز جديد</button>
      </header>
      <section className="today-clinic-stats" aria-label="إحصائيات العيادة اليوم">
        <div><span>حجوزات اليوم</span><strong>{appointments.length}</strong></div>
        <div><span>مدفوع</span><strong>{paid}</strong></div>
        <div><span>غير مدفوع</span><strong>{unpaid}</strong></div>
        <div><span>مدفوع جزئيًا</span><strong>{partial}</strong></div>
        <div><span>حالة دفع غير محددة</span><strong>{unknown}</strong></div>
      </section>
      <section className="today-bookings-board" aria-label="جدول حجوزات اليوم">
        <div className="today-bookings-board-header">
          <div><CalendarDays size={18} /><strong>جدول المواعيد</strong></div>
          <span>{appointments.length} حجز</span>
        </div>
        {loading ? (
          <div className="today-bookings-empty"><LoaderCircle className="today-bookings-spin" size={23} /> جاري تحميل الحجوزات...</div>
        ) : error ? (
          <div className="today-bookings-empty" role="alert">{error}</div>
        ) : appointments.length === 0 ? (
          <div className="today-bookings-empty">لا توجد حجوزات مسجلة لهذا اليوم.</div>
        ) : (
          <div className="today-bookings-scroll">
            <table className="today-bookings-table">
              <thead><tr><th>الوقت</th><th>اسم المريض</th><th>نوع الزيارة</th><th>حالة الحجز</th><th>الدفع</th><th>الإجراء</th></tr></thead>
              <tbody>
                {appointments.map((item, index) => (
                  <tr key={item.id || index}>
                    <td className="today-bookings-time">{item.displayTime || "—"}</td>
                    <td><strong>{item.name || "مريض"}</strong>{item.phone && <small>{item.phone}</small>}</td>
                    <td>{item.type || "كشف"}</td>
                    <td><span className={`today-bookings-status ${item.status === "cancelled" ? "is-cancelled" : ""}`}>{appointmentLabels[item.status] || item.status || "مجدول"}</span></td>
                    <td><span className={`today-bookings-payment ${item.paymentStatus || "unknown"}`}>{paymentLabel(item)}</span></td>
                    <td><button className="today-bookings-open" onClick={() => navigate("/appointments")}>فتح الحجز</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {notice && <div className="today-bookings-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")}>إغلاق</button></div>}
      {bookingOpen && <QuickReceptionModal clinicId={clinicId} patients={patients} doctors={doctors} staffId={staffId || profile?.staffId || ""} onClose={() => setBookingOpen(false)} onSuccess={message => { setBookingOpen(false); setNotice(message); }} />}
    </main>
  );
}
