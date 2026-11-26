import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { database } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";
import { CLINOVA_MONTHLY_PRICE_EGP, getSubscriptionState } from "../../subscriptions/subscriptionPolicy";

const money = amount => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(amount);
const date = value => value ? new Date(value).toLocaleDateString("ar-EG") : "—";

export default function SuperAdminPage() {
  const { firebaseUser } = useAuth();
  const [clinics, setClinics] = useState({});
  const [subscriptions, setSubscriptions] = useState({});
  const [error, setError] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopClinics, stopSubscriptions, cancelled = false;
    async function load() {
      try {
        const token = await firebaseUser?.getIdTokenResult();
        if (!token?.claims?.superAdmin) {
          if (!cancelled) { setError("ليس لديك صلاحية إدارة المنصة."); setLoading(false); }
          return;
        }
        if (cancelled) return;
        setAuthorized(true);
        stopClinics = onValue(ref(database, "clinics"), snap => {
          const raw = snap.val() || {};
          setClinics(Object.fromEntries(Object.entries(raw).map(([id, value]) => [id, value?.profile || {}])));
          setLoading(false);
        }, e => { setError(e.message); setLoading(false); });
        stopSubscriptions = onValue(ref(database, "clinicSubscriptions"), snap => setSubscriptions(snap.val() || {}), e => setError(e.message));
      } catch (e) { if (!cancelled) { setError(e.message); setLoading(false); } }
    }
    load();
    return () => { cancelled = true; stopClinics?.(); stopSubscriptions?.(); };
  }, [firebaseUser]);

  const rows = useMemo(() => Object.entries(clinics).map(([id, clinic]) => ({
    id, clinic, subscription: subscriptions[id], state: getSubscriptionState(subscriptions[id]),
  })), [clinics, subscriptions]);
  const active = rows.filter(row => row.state === "active").length;

  return <main dir="rtl" style={{ padding: 28, maxWidth: 1250, margin: "auto", fontFamily: "Cairo, sans-serif" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
      <div><h1>Clinova — إدارة الاشتراكات</h1><p>الاشتراك الموحد: {money(CLINOVA_MONTHLY_PRICE_EGP)} شهريًا لكل عيادة — بدون تجربة مجانية</p></div>
      <a href="/">العودة للنظام</a>
    </header>
    {loading && <p>جاري تحميل البيانات...</p>}
    {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
    {authorized && !loading && <>
      <section style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 24 }}>
        <strong>إجمالي العيادات: {rows.length}</strong>
        <strong>اشتراكات نشطة: {active}</strong>
        <strong>الإيراد الشهري النظري: {money(active * CLINOVA_MONTHLY_PRICE_EGP)}</strong>
      </section>
      <p>هذه لوحة متابعة للقراءة فقط. التفعيل والتجديد يتمان من خدمة إدارية موثوقة، وليس من المتصفح.</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
          <thead><tr>{["العيادة", "المعرف", "الحالة", "بداية الفترة", "نهاية الفترة"].map(h => <th key={h} style={{ padding: 12, borderBottom: "1px solid #ddd" }}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.id}>
            <td style={{ padding: 12 }}>{row.clinic.nameAr || row.clinic.name || "عيادة"}</td>
            <td style={{ padding: 12 }}>{row.id}</td>
            <td style={{ padding: 12 }}>{row.state === "active" ? "نشط" : row.state === "expired" ? "منتهي" : "غير مفعل"}</td>
            <td style={{ padding: 12 }}>{date(row.subscription?.currentPeriodStart)}</td>
            <td style={{ padding: 12 }}>{date(row.subscription?.currentPeriodEnd)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </main>;
}
