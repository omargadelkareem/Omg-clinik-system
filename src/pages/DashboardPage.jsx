import { useEffect, useState } from "react";
import { CalendarDays, Plus, LoaderCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { subscribeToDashboard } from "../services/dashboardService";
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
  const { clinicId } = useAuth();
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
  const appointments = data.appointments || [];
  return (
    <main className="today-bookings-page" dir="rtl">
      <header className="today-bookings-header">
        <div className="today-bookings-title">
          <span>OMG CLINIC</span>
          <h1>حجوزات اليوم</h1>
          <p>{new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</p>
        </div>
        <button className="today-bookings-add" onClick={() => navigate("/appointments")}><Plus size={17} /> حجز جديد</button>
      </header>
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
    </main>
  );
}
