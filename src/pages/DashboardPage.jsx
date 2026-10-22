import { useEffect, useState } from "react";
import { CalendarDays, Plus, LoaderCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { subscribeToDashboard } from "../services/dashboardService";
import { subscribeAppointmentPatients, subscribeAppointmentDoctors } from "../services/appointmentService";
import QuickReceptionModal from "./appointments/QuickReceptionModal";
import "./DashboardPage.css";

const empty = { appointments: [], totals: { appointments: 0 } };
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
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!clinicId) { setLoading(false); return undefined; }
    setLoading(true);
    setError("");
    return subscribeToDashboard(clinicId, value => {
      setData(value);
      setLoading(false);
    }, () => {
      setError("تعذر تحميل حجوزات اليوم.");
      setLoading(false);
    });
  }, [clinicId]);
  useEffect(() => {
    if (!clinicId) return undefined;
    const stopPatients = subscribeAppointmentPatients(clinicId, setPatients);
    const stopDoctors = subscribeAppointmentDoctors(clinicId, setDoctors);
    return () => { stopPatients?.(); stopDoctors?.(); };
  }, [clinicId]);
  const appointments = data.appointments || [];
  const totals = data.totals || {};
  const paid = appointments.filter(item => item.paymentStatus === "paid").length;
  const unpaid = appointments.filter(item => item.paymentStatus === "unpaid").length;
  const partial = appointments.filter(item => item.paymentStatus === "partial").length;
  const unknown = appointments.length - paid - unpaid - partial;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
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
