
import { useState } from "react";
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";

import {
  deleteApp,
  initializeApp,
} from "firebase/app";

import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from "firebase/auth";

import {
  getDatabase,
  ref,
  serverTimestamp,
  set,
  update,
} from "firebase/database";

import "./SetupClinicPage.css";

const firebaseConfig = {
  apiKey: "AIzaSyD6zRLO0tFMxsY7Ywf7OxDegGlt85DQyFE",
  authDomain: "omg-clinic.firebaseapp.com",
  databaseURL:
    "https://omg-clinic-default-rtdb.firebaseio.com",
  projectId: "omg-clinic",
  storageBucket:
    "omg-clinic.firebasestorage.app",
  messagingSenderId: "1070920920868",
  appId:
    "1:1070920920868:web:1ee0b1845fa94c6ad38db1",
  measurementId: "G-VW2GGHV63S",
};

/*
 * حماية مؤقتة فقط أثناء التطوير.
 *
 * غير القيمة دي لأي كلمة قوية خاصة بك.
 *
 * مهم:
 * دي ليست حماية Production حقيقية لأن أي Secret
 * داخل React يمكن رؤيته من المتصفح.
 *
 * هنستبدلها لاحقاً بـ Super Admin Backend.
 */
const TEMP_SETUP_KEY =
  "omar";

const createSlug = (name) => {
  const clean = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return clean || `clinic-${Date.now()}`;
};

export default function SetupClinicPage() {
  const [showPassword, setShowPassword] =
    useState(false);

  const [form, setForm] = useState({
    setupKey: "",

    clinicNameAr: "",
    clinicNameEn: "",
    branchName: "الفرع الرئيسي",

    ownerName: "",
    phone: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState("");

  const [result, setResult] =
    useState(null);

  const updateField = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    if (error) {
      setError("");
    }
  };

  const validate = () => {
    if (
      form.setupKey.trim() !== TEMP_SETUP_KEY
    ) {
      return "Setup Key غير صحيح.";
    }

    if (!form.clinicNameAr.trim()) {
      return "اكتب اسم العيادة.";
    }

    if (!form.ownerName.trim()) {
      return "اكتب اسم صاحب العيادة.";
    }

    if (!form.email.trim()) {
      return "اكتب البريد الإلكتروني.";
    }

    if (!form.password) {
      return "اكتب كلمة المرور.";
    }

    if (form.password.length < 6) {
      return "كلمة المرور يجب ألا تقل عن 6 أحرف.";
    }

    return null;
  };

  const handleCreateClinic = async (e) => {
  e.preventDefault();

  if (loading) return;

  setError("");
  setResult(null);

  const validationError = validate();

  if (validationError) {
    setError(validationError);
    return;
  }

  setLoading(true);

  let secondaryApp = null;

  try {
    // ==========================================
    // 1. Firebase Secondary App
    // ==========================================

    const secondaryName =
      `omg-setup-${Date.now()}`;

    secondaryApp = initializeApp(
      firebaseConfig,
      secondaryName
    );

    const secondaryAuth =
      getAuth(secondaryApp);

    const secondaryDatabase =
      getDatabase(secondaryApp);

    // ==========================================
    // 2. Create Firebase Authentication Account
    // ==========================================

    const credential =
      await createUserWithEmailAndPassword(
        secondaryAuth,
        form.email.trim().toLowerCase(),
        form.password
      );

    const uid = credential.user.uid;

    console.log(
      "Firebase Auth account created:",
      uid
    );

    // ==========================================
    // 3. Generate Clinic ID
    // ==========================================

    const baseSlug = createSlug(
      form.clinicNameEn ||
        form.clinicNameAr
    );

    const clinicId =
      `${baseSlug}-${uid.slice(0, 6)}`;

    const staffId = `owner_${uid}`;

    // ==========================================
    // 4. IMPORTANT
    // Create /users/{uid} FIRST
    // ==========================================

    const userData = {
      uid,

      clinicId,
      staffId,

      name: form.ownerName.trim(),

      email: form.email
        .trim()
        .toLowerCase(),

      phone: form.phone.trim(),

      role: "owner",

      status: "active",

      createdAt: serverTimestamp(),
    };

    await set(
      ref(
        secondaryDatabase,
        `users/${uid}`
      ),
      userData
    );

    console.log(
      "OMG user profile created."
    );

    // ==========================================
    // 5. NOW Firebase Rules know:
    //
    // auth.uid
    // clinicId
    // role = owner
    // status = active
    //
    // So we can create the Clinic.
    // ==========================================

    const clinicData = {
      profile: {
        id: clinicId,

        name:
          form.clinicNameEn.trim() ||
          form.clinicNameAr.trim(),

        nameAr:
          form.clinicNameAr.trim(),

        branchName:
          form.branchName.trim() ||
          "الفرع الرئيسي",

        phone: form.phone.trim(),

        address: "",

        logo: "",

        currency: "EGP",

        country: "EG",

        timezone: "Africa/Cairo",

        status: "active",

        createdAt: serverTimestamp(),
      },

      staff: {
        [staffId]: {
          id: staffId,

          uid,

          name: form.ownerName.trim(),

          email: form.email
            .trim()
            .toLowerCase(),

          phone: form.phone.trim(),

          role: "owner",

          customRole: "",

          branch:
            form.branchName.trim() ||
            "الفرع الرئيسي",

          status: "offline",

          accountStatus: "active",

          permissionsMode: "owner",

          createdAt: serverTimestamp(),
        },
      },

      settings: {
        clinic: {
          clinicName:
            form.clinicNameEn.trim() ||
            form.clinicNameAr.trim(),

          clinicNameAr:
            form.clinicNameAr.trim(),

          phone: form.phone.trim(),

          whatsapp: form.phone.trim(),

          address: "",
        },

        appointments: {
          slotDuration: 30,

          startTime: "09:00",

          endTime: "17:00",

          allowWalkIn: true,
        },

        finance: {
          currency: "EGP",
        },

        prescription: {
          clinicName:
            form.clinicNameAr.trim(),

          doctorName: "",

          specialty: "",

          degree: "",

          phone: form.phone.trim(),

          address: "",

          footerNote:
            "نتمنى لكم دوام الصحة والعافية",

          logo: "",

          layout: "classic",
        },
      },

      subscription: {
        plan: "trial",

        status: "active",

        createdAt: serverTimestamp(),
      },
    };

    await set(
      ref(
        secondaryDatabase,
        `clinics/${clinicId}`
      ),
      clinicData
    );

    console.log(
      "OMG Clinic created:",
      clinicId
    );

    // ==========================================
    // 6. Logout Secondary Account
    // ==========================================

    await signOut(secondaryAuth);

    // ==========================================
    // 7. Success
    // ==========================================

    setResult({
      clinicId,

      uid,

      ownerName:
        form.ownerName.trim(),

      clinicName:
        form.clinicNameAr.trim(),

      email: form.email
        .trim()
        .toLowerCase(),
    });

    // ==========================================
    // 8. Reset Form
    // ==========================================

    setForm({
      setupKey: form.setupKey,

      clinicNameAr: "",
      clinicNameEn: "",

      branchName:
        "الفرع الرئيسي",

      ownerName: "",

      phone: "",

      email: "",

      password: "",
    });
  } catch (err) {
    console.error(
      "Create clinic error:",
      err
    );

    switch (err?.code) {
      case "auth/email-already-in-use":
        setError(
          "البريد الإلكتروني مستخدم بالفعل في حساب آخر."
        );
        break;

      case "auth/invalid-email":
        setError(
          "البريد الإلكتروني غير صحيح."
        );
        break;

      case "auth/weak-password":
        setError(
          "كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل."
        );
        break;

      case "PERMISSION_DENIED":
      case "permission-denied":
        setError(
          "Firebase رفض العملية بسبب الصلاحيات."
        );
        break;

      default:
        if (
          err?.message
            ?.toLowerCase()
            .includes("permission_denied")
        ) {
          setError(
            "Firebase رفض العملية بسبب Database Rules."
          );
        } else {
          setError(
            err?.message ||
              "حدث خطأ أثناء إنشاء العيادة."
          );
        }
    }
  } finally {
    if (secondaryApp) {
      try {
        await deleteApp(
          secondaryApp
        );
      } catch (cleanupError) {
        console.error(
          "Secondary Firebase cleanup:",
          cleanupError
        );
      }
    }

    setLoading(false);
  }
};

  return (
    <main
      className="setup-clinic-page"
      dir="rtl"
    >
      <aside className="setup-side">
        <div className="setup-brand">
          <div className="setup-brand-icon">
            <Stethoscope size={25} />
          </div>

          <div>
            <strong>OMG Clinic</strong>
            <span>Internal Setup</span>
          </div>
        </div>

        <div className="setup-side-content">
          <span className="setup-private-label">
            <ShieldCheck size={15} />
            INTERNAL ACCESS
          </span>

          <h1>
            إضافة
            <br />
            <span>عيادة جديدة.</span>
          </h1>

          <p>
            الصفحة دي مخصصة لإدارة OMG فقط لإنشاء
            حسابات العيادات قبل تشغيل لوحة الـSuper
            Admin.
          </p>
        </div>

        <div className="setup-flow">
          <SetupStep
            number="01"
            title="إنشاء العيادة"
          />

          <SetupStep
            number="02"
            title="إنشاء حساب Owner"
          />

          <SetupStep
            number="03"
            title="ربط المستخدم بالعيادة"
          />

          <SetupStep
            number="04"
            title="تجهيز الإعدادات"
          />
        </div>
      </aside>

      <section className="setup-form-side">
        <div className="setup-form-container">
          <header className="setup-heading">
            <span>OMG INTERNAL TOOL</span>

            <h2>إنشاء حساب عيادة</h2>

            <p>
              بعد الحفظ يستطيع صاحب العيادة تسجيل
              الدخول مباشرة من صفحة Login.
            </p>
          </header>

          {result ? (
            <SuccessResult
              result={result}
              onCreateAnother={() =>
                setResult(null)
              }
            />
          ) : (
            <form
              onSubmit={handleCreateClinic}
            >
              <section className="setup-form-section">
                <div className="setup-section-title">
                  <KeyRound size={18} />

                  <div>
                    <strong>
                      تصريح الإنشاء
                    </strong>

                    <span>
                      خاص بإدارة OMG
                    </span>
                  </div>
                </div>

                <SetupField
                  label="Setup Key"
                  icon={
                    <LockKeyhole size={17} />
                  }
                >
                  <input
                    type="password"
                    value={form.setupKey}
                    onChange={(e) =>
                      updateField(
                        "setupKey",
                        e.target.value
                      )
                    }
                    placeholder="أدخل مفتاح الإدارة"
                    autoComplete="off"
                  />
                </SetupField>
              </section>

              <section className="setup-form-section">
                <div className="setup-section-title">
                  <Building2 size={18} />

                  <div>
                    <strong>
                      بيانات العيادة
                    </strong>

                    <span>
                      الهوية الأساسية
                    </span>
                  </div>
                </div>

                <div className="setup-grid">
                  <SetupField
                    label="اسم العيادة"
                    icon={
                      <Building2 size={17} />
                    }
                  >
                    <input
                      value={
                        form.clinicNameAr
                      }
                      onChange={(e) =>
                        updateField(
                          "clinicNameAr",
                          e.target.value
                        )
                      }
                      placeholder="مثال: عيادة الحياة"
                    />
                  </SetupField>

                  <SetupField
                    label="الاسم بالإنجليزية"
                    optional
                  >
                    <input
                      value={
                        form.clinicNameEn
                      }
                      onChange={(e) =>
                        updateField(
                          "clinicNameEn",
                          e.target.value
                        )
                      }
                      placeholder="Al Hayah Clinic"
                      dir="ltr"
                    />
                  </SetupField>

                  <SetupField label="الفرع">
                    <input
                      value={form.branchName}
                      onChange={(e) =>
                        updateField(
                          "branchName",
                          e.target.value
                        )
                      }
                    />
                  </SetupField>

                  <SetupField
                    label="هاتف العيادة"
                    icon={<Phone size={17} />}
                  >
                    <input
                      value={form.phone}
                      onChange={(e) =>
                        updateField(
                          "phone",
                          e.target.value
                        )
                      }
                      placeholder="01xxxxxxxxx"
                      dir="ltr"
                    />
                  </SetupField>
                </div>
              </section>

              <section className="setup-form-section">
                <div className="setup-section-title">
                  <UserRound size={18} />

                  <div>
                    <strong>
                      حساب صاحب العيادة
                    </strong>

                    <span>
                      Owner Account
                    </span>
                  </div>
                </div>

                <SetupField
                  label="اسم صاحب العيادة"
                  icon={
                    <UserRound size={17} />
                  }
                >
                  <input
                    value={form.ownerName}
                    onChange={(e) =>
                      updateField(
                        "ownerName",
                        e.target.value
                      )
                    }
                    placeholder="الاسم بالكامل"
                  />
                </SetupField>

                <div className="setup-grid">
                  <SetupField
                    label="البريد الإلكتروني"
                    icon={<Mail size={17} />}
                  >
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        updateField(
                          "email",
                          e.target.value
                        )
                      }
                      placeholder="owner@clinic.com"
                      dir="ltr"
                      autoComplete="off"
                    />
                  </SetupField>

                  <SetupField
                    label="كلمة المرور"
                    icon={
                      <LockKeyhole
                        size={17}
                      />
                    }
                  >
                    <div className="setup-password">
                      <input
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        value={form.password}
                        onChange={(e) =>
                          updateField(
                            "password",
                            e.target.value
                          )
                        }
                        placeholder="6 أحرف على الأقل"
                        dir="ltr"
                        autoComplete="new-password"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(
                            (current) =>
                              !current
                          )
                        }
                      >
                        {showPassword ? (
                          <EyeOff
                            size={17}
                          />
                        ) : (
                          <Eye size={17} />
                        )}
                      </button>
                    </div>
                  </SetupField>
                </div>
              </section>

              {error && (
                <div className="setup-error">
                  {error}
                </div>
              )}

              <button
                className="create-clinic-button"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="setup-spinner" />
                    جاري إنشاء العيادة...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    إنشاء العيادة والحساب
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function SetupField({
  label,
  icon,
  optional,
  children,
}) {
  return (
    <label className="setup-field">
      <span>
        {label}

        {optional && <small>اختياري</small>}
      </span>

      <div className="setup-input">
        {icon && icon}
        {children}
      </div>
    </label>
  );
}

function SetupStep({ number, title }) {
  return (
    <div className="setup-step">
      <span>{number}</span>
      <strong>{title}</strong>
    </div>
  );
}

function SuccessResult({
  result,
  onCreateAnother,
}) {
  return (
    <div className="setup-success">
      <div className="setup-success-icon">
        <CheckCircle2 size={35} />
      </div>

      <span>CLINIC READY</span>

      <h2>تم إنشاء العيادة بنجاح</h2>

      <p>
        الحساب جاهز الآن ويمكن استخدامه في صفحة
        تسجيل الدخول.
      </p>

      <div className="created-clinic-sheet">
        <div>
          <span>العيادة</span>
          <strong>
            {result.clinicName}
          </strong>
        </div>

        <div>
          <span>صاحب الحساب</span>
          <strong>
            {result.ownerName}
          </strong>
        </div>

        <div>
          <span>البريد</span>
          <strong dir="ltr">
            {result.email}
          </strong>
        </div>

        <div>
          <span>Clinic ID</span>
          <strong dir="ltr">
            {result.clinicId}
          </strong>
        </div>
      </div>

      <div className="setup-success-actions">
        <a href="/login">
          تسجيل الدخول
        </a>

        <button
          type="button"
          onClick={onCreateAnother}
        >
          إضافة عيادة أخرى
        </button>
      </div>
    </div>
  );
}

