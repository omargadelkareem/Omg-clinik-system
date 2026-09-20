
import { useState } from "react";
import {
  Navigate,
  useNavigate,
} from "react-router-dom";

import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();

  const {
    login,
    isAuthenticated,
    loading: authLoading,
  } = useAuth();

  const [showPassword, setShowPassword] =
    useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [rememberMe, setRememberMe] =
    useState(true);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState("");

  /*
   * لو المستخدم مسجل دخوله بالفعل
   * متعرضش Login Page مرة ثانية.
   */
  if (!authLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError("");

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError("من فضلك أدخل البريد الإلكتروني.");
      return;
    }

    if (!password) {
      setError("من فضلك أدخل كلمة المرور.");
      return;
    }

    setLoading(true);

    try {
      await login(cleanEmail, password);

      /*
       * Remember Me
       * هنربطه بعد قليل بـ Firebase Persistence.
       *
       * حالياً تسجيل الدخول نفسه يعمل بشكل طبيعي.
       */
      console.log("Remember me:", rememberMe);

      navigate("/", {
        replace: true,
      });
    } catch (err) {
      console.error("Login error:", err);

      switch (err?.code) {
        case "auth/invalid-email":
          setError(
            "البريد الإلكتروني الذي أدخلته غير صحيح."
          );
          break;

        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          setError(
            "البريد الإلكتروني أو كلمة المرور غير صحيحة."
          );
          break;

        case "auth/user-disabled":
          setError(
            "تم إيقاف هذا الحساب. تواصل مع إدارة العيادة."
          );
          break;

        case "auth/too-many-requests":
          setError(
            "تمت محاولات تسجيل دخول كثيرة. حاول مرة أخرى لاحقاً."
          );
          break;

        case "auth/network-request-failed":
          setError(
            "تعذر الاتصال بالإنترنت. تحقق من الاتصال وحاول مرة أخرى."
          );
          break;

        default:
          setError(
            err?.message ||
              "حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى."
          );
      }
    } finally {
      setLoading(false);
    }
  };

  /*
   * أثناء Firebase Auth بيحدد هل فيه
   * Session قديمة أم لا.
   */
  if (authLoading) {
    return (
      <main
        className="login-page"
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          background: "#f7f9fb",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            color: "#173552",
          }}
        >
          <div
            style={{
              width: "58px",
              height: "58px",
              display: "grid",
              placeItems: "center",
              borderRadius: "15px",
              background: "#123454",
              color: "#fff",
            }}
          >
            <Stethoscope size={27} />
          </div>

          <strong
            style={{
              marginTop: "5px",
              fontSize: "17px",
            }}
          >
            OMG Clinic
          </strong>

          <span
            style={{
              color: "#8290a0",
              fontSize: "13px",
            }}
          >
            جاري تجهيز النظام...
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="login-page">
      {/* ================================
          BRAND SIDE
      ================================= */}

      <section className="login-brand-panel">
        <div className="brand-content">
          <div className="brand-logo">
            <div className="brand-logo-icon">
              <Stethoscope size={27} />
            </div>

            <div>
              <div className="brand-name">
                OMG <span>Clinic</span>
              </div>

              <p>Smart Clinic Management</p>
            </div>
          </div>

          <div className="brand-message">
            <span className="brand-pill">
              <ShieldCheck size={16} />
              نظام متكامل لإدارة العيادات
            </span>

            <h1>
              عيادتك بالكامل
              <br />
              <span>في مكان واحد.</span>
            </h1>

            <p>
              المرضى، المواعيد، الزيارات، الروشتات
              والتقارير
              <br />
              بتجربة بسيطة وسريعة لفريق عيادتك.
            </p>
          </div>

          <div className="brand-stats">
            <div>
              <strong>24/7</strong>
              <span>وصول للنظام</span>
            </div>

            <div className="stat-divider" />

            <div>
              <strong>100%</strong>
              <span>إدارة رقمية</span>
            </div>

            <div className="stat-divider" />

            <div>
              <strong>OMG</strong>
              <span>Clinic Cloud</span>
            </div>
          </div>
        </div>

        <div className="brand-glow brand-glow-one" />
        <div className="brand-glow brand-glow-two" />
      </section>

      {/* ================================
          LOGIN SIDE
      ================================= */}

      <section
        className="login-form-panel"
        dir="rtl"
      >
        <div className="mobile-brand">
          <div className="brand-logo-icon">
            <Stethoscope size={23} />
          </div>

          <strong>OMG Clinic</strong>
        </div>

        <div className="login-container">
          <div className="login-heading">
            <span className="welcome-icon">
              👋
            </span>

            <h2>مرحباً بعودتك</h2>

            <p>
              سجل الدخول للوصول إلى لوحة إدارة عيادتك
            </p>
          </div>

          <form onSubmit={handleLogin}>
            {/* ERROR */}

            {error && (
              <div
                className="login-error"
                role="alert"
              >
                {error}
              </div>
            )}

            {/* EMAIL */}

            <div className="form-group">
              <label htmlFor="email">
                البريد الإلكتروني
              </label>

              <div className="input-wrapper">
                <Mail size={19} />

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);

                    if (error) {
                      setError("");
                    }
                  }}
                  placeholder="doctor@omgclinic.com"
                  autoComplete="email"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* PASSWORD */}

            <div className="form-group">
              <div className="password-label">
                <label htmlFor="password">
                  كلمة المرور
                </label>

                <button
                  type="button"
                  className="forgot-password"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              <div className="input-wrapper">
                <LockKeyhole size={19} />

                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);

                    if (error) {
                      setError("");
                    }
                  }}
                  placeholder="أدخل كلمة المرور"
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (prev) => !prev
                    )
                  }
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? "إخفاء كلمة المرور"
                      : "إظهار كلمة المرور"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </div>

            {/* OPTIONS */}

            <div className="login-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) =>
                    setRememberMe(
                      e.target.checked
                    )
                  }
                />

                <span>تذكرني</span>
              </label>

              <span className="secure-login">
                <ShieldCheck size={15} />
                تسجيل دخول آمن
              </span>
            </div>

            {/* SUBMIT */}

            <button
              className="login-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "جاري تسجيل الدخول..."
                : "تسجيل الدخول"}
            </button>
          </form>

          <div className="login-footer">
            <p>
              تحتاج مساعدة؟{" "}
              <button type="button">
                تواصل مع الدعم
              </button>
            </p>

            <span>OMG Clinic © 2026</span>
          </div>
        </div>
      </section>
    </main>
  );
}

