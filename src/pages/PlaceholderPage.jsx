import { useLocation } from "react-router-dom";

const pageNames = {
  "/appointments": "المواعيد",
  "/patients": "المرضى",
  "/queue": "قائمة الانتظار",
  "/visits": "الزيارات",
  "/prescriptions": "الروشتات",
  "/drugs": "مكتبة الأدوية",
  "/medical-files": "التحاليل والأشعة",
  "/whatsapp": "WhatsApp Medical Inbox",
  "/finance": "المالية",
  "/reports": "التقارير",
  "/staff": "فريق العمل",
  "/settings": "الإعدادات",
};

export default function PlaceholderPage() {
  const location = useLocation();
  const title = pageNames[location.pathname] || "OMG Clinic";

  return (
    <div className="temporary-page">
      <span className="temporary-badge">قريباً</span>
      <h1>{title}</h1>
      <p>هنبني الشاشة دي خطوة بخطوة.</p>
    </div>
  );
}