
  import {
  useMemo,
  useState,
} from "react";

import {
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Hospital,
  KeyRound,
  LockKeyhole,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UsersRound,
  X,
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
} from "firebase/database";

import {
  FEATURED_SPECIALTIES,
  SPECIALTIES,
  searchSpecialties,
} from "../../config/specialties";

import "./SetupClinicPage.css";

/* =========================================================
   FIREBASE
========================================================= */

const firebaseConfig = {
  apiKey:
    "AIzaSyD6zRLO0tFMxsY7Ywf7OxDegGlt85DQyFE",

  authDomain:
    "omg-clinic.firebaseapp.com",

  databaseURL:
    "https://omg-clinic-default-rtdb.firebaseio.com",

  projectId:
    "omg-clinic",

  storageBucket:
    "omg-clinic.firebasestorage.app",

  messagingSenderId:
    "1070920920868",

  appId:
    "1:1070920920868:web:1ee0b1845fa94c6ad38db1",

  measurementId:
    "G-VW2GGHV63S",
};

/*
 * حماية مؤقتة أثناء التطوير.
 *
 * مهم:
 * أي Secret داخل React يمكن رؤيته من المتصفح.
 * لاحقًا يتم نقل إنشاء العيادات إلى Super Admin Backend.
 */
const TEMP_SETUP_KEY = "omar";

/* =========================================================
   FACILITY TYPES
========================================================= */

const FACILITY_TYPES = [
  {
    id: "single_doctor",
    name: "عيادة طبيب واحد",
    description:
      "مناسبة للطبيب الذي يدير عيادته وتخصصه بشكل مستقل.",
    icon: UserRound,
    multiSpecialty: false,
  },

  {
    id: "multi_doctor",
    name: "عيادة متعددة الأطباء",
    description:
      "أكثر من طبيب داخل نفس العيادة ويمكن إضافة تخصصات لاحقًا.",
    icon: UsersRound,
    multiSpecialty: true,
  },

  {
    id: "medical_center",
    name: "مركز طبي متعدد التخصصات",
    description:
      "عدة تخصصات وأطباء تحت إدارة منشأة طبية واحدة.",
    icon: Hospital,
    multiSpecialty: true,
  },
];

/* =========================================================
   HELPERS
========================================================= */

const createSlug = (name) => {
  const clean = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(
      /[^\u0600-\u06FFa-z0-9-]/g,
      ""
    )
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return (
    clean ||
    `clinic-${Date.now()}`
  );
};

function getFacilityById(id) {
  return (
    FACILITY_TYPES.find(
      (item) => item.id === id
    ) || null
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function SetupClinicPage() {
  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showSpecialties,
    setShowSpecialties,
  ] = useState(false);

  const [
    specialtySearch,
    setSpecialtySearch,
  ] = useState("");

  const [form, setForm] =
    useState({
      setupKey: "",

      clinicNameAr: "",
      clinicNameEn: "",

      branchName:
        "الفرع الرئيسي",

      facilityType:
        "single_doctor",

      primarySpecialty: "",

      ownerName: "",
      phone: "",
      email: "",
      password: "",
    });

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [result, setResult] =
    useState(null);

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const selectedFacility =
    useMemo(
      () =>
        getFacilityById(
          form.facilityType
        ),
      [form.facilityType]
    );

  const selectedSpecialty =
    useMemo(
      () =>
        SPECIALTIES.find(
          (item) =>
            item.id ===
            form.primarySpecialty
        ) || null,
      [form.primarySpecialty]
    );

  const filteredSpecialties =
    useMemo(() => {
      return searchSpecialties(
        specialtySearch
      );
    }, [specialtySearch]);

  /* =======================================================
     FORM
  ======================================================= */

  const updateField = (
    key,
    value
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    if (error) {
      setError("");
    }
  };

  const selectSpecialty = (
    specialty
  ) => {
    updateField(
      "primarySpecialty",
      specialty.id
    );

    setSpecialtySearch("");
    setShowSpecialties(false);
  };

  const clearSpecialty = () => {
    updateField(
      "primarySpecialty",
      ""
    );

    setSpecialtySearch("");
  };

  /* =======================================================
     VALIDATION
  ======================================================= */

  const validate = () => {
    if (
      form.setupKey.trim() !==
      TEMP_SETUP_KEY
    ) {
      return "Setup Key غير صحيح.";
    }

    if (
      !form.clinicNameAr.trim()
    ) {
      return "اكتب اسم العيادة.";
    }

    if (!form.facilityType) {
      return "اختر نوع المنشأة.";
    }

    if (
      !form.primarySpecialty
    ) {
      return "اختر التخصص الرئيسي للعيادة.";
    }

    if (!selectedSpecialty) {
      return "التخصص المختار غير صحيح.";
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

    if (
      form.password.length < 6
    ) {
      return "كلمة المرور يجب ألا تقل عن 6 أحرف.";
    }

    return null;
  };

  /* =======================================================
     CREATE CLINIC
  ======================================================= */

  const handleCreateClinic =
    async (e) => {
      e.preventDefault();

      if (loading) {
        return;
      }

      setError("");
      setResult(null);

      const validationError =
        validate();

      if (validationError) {
        setError(validationError);
        return;
      }

      setLoading(true);

      let secondaryApp = null;

      try {
        /* ==========================================
           1. SECONDARY FIREBASE APP
        ========================================== */

        const secondaryName =
          `omg-setup-${Date.now()}`;

        secondaryApp =
          initializeApp(
            firebaseConfig,
            secondaryName
          );

        const secondaryAuth =
          getAuth(secondaryApp);

        const secondaryDatabase =
          getDatabase(
            secondaryApp
          );

        /* ==========================================
           2. CREATE FIREBASE AUTH ACCOUNT
        ========================================== */

        const credential =
          await createUserWithEmailAndPassword(
            secondaryAuth,
            form.email
              .trim()
              .toLowerCase(),
            form.password
          );

        const uid =
          credential.user.uid;

        /* ==========================================
           3. GENERATE CLINIC ID
        ========================================== */

        const baseSlug =
          createSlug(
            form.clinicNameEn ||
              form.clinicNameAr
          );

        const clinicId =
          `${baseSlug}-${uid.slice(
            0,
            6
          )}`;

        const staffId =
          `owner_${uid}`;

        const specialtyId =
          selectedSpecialty.id;

        const specialtyName =
          selectedSpecialty.nameAr;

        const facility =
          selectedFacility;

        /* ==========================================
           4. CREATE USER FIRST

           Firebase Rules تعتمد على users/{uid}
           لمعرفة clinicId و role.
        ========================================== */

        const userData = {
          uid,

          clinicId,

          staffId,

          name:
            form.ownerName.trim(),

          email:
            form.email
              .trim()
              .toLowerCase(),

          phone:
            form.phone.trim(),

          role: "owner",

          status: "active",

          primarySpecialty:
            specialtyId,

          createdAt:
            serverTimestamp(),
        };

        await set(
          ref(
            secondaryDatabase,
            `users/${uid}`
          ),
          userData
        );

        /* ==========================================
           5. CREATE USER <-> CLINIC MEMBERSHIP

           Multi-Clinic / Multi-Center architecture:
           permissions are resolved per clinic through
           userClinics/{uid}/{clinicId}.
        ========================================== */

        const membershipData = {
          clinicId,

          staffId,

          role: "owner",

          status: "active",

          facilityType:
            facility.id,

          facilityTypeName:
            facility.name,

          primarySpecialty:
            specialtyId,

          primarySpecialtyName:
            specialtyName,

          specialties: {
            [specialtyId]: true,
          },

          permissionsMode:
            "owner",

          isDefault: true,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        };

        await set(
          ref(
            secondaryDatabase,
            `userClinics/${uid}/${clinicId}`
          ),
          membershipData
        );

        /* ==========================================
           6. CLINIC DATA
        ========================================== */

        const clinicData = {
          /* ========================================
             PROFILE
          ======================================== */

          profile: {
            id: clinicId,

            name:
              form.clinicNameEn.trim() ||
              form.clinicNameAr.trim(),

            nameAr:
              form.clinicNameAr.trim(),

            nameEn:
              form.clinicNameEn.trim(),

            branchName:
              form.branchName.trim() ||
              "الفرع الرئيسي",

            phone:
              form.phone.trim(),

            address: "",

            logo: "",

            currency: "EGP",

            country: "EG",

            timezone:
              "Africa/Cairo",

            status: "active",

            /* =====================================
               SPECIALTY ENGINE
            ===================================== */

            facilityType:
              facility.id,

            facilityTypeName:
              facility.name,

            multiSpecialty:
              Boolean(
                facility.multiSpecialty
              ),

            primarySpecialty:
              specialtyId,

            primarySpecialtyName:
              specialtyName,

            primarySpecialtyNameEn:
              selectedSpecialty.nameEn ||
              "",

            specialtyEngineVersion:
              1,

            setupCompleted: true,

            setupVersion: 1,

            createdAt:
              serverTimestamp(),
          },

          /* ========================================
             STAFF
          ======================================== */

          staff: {
            [staffId]: {
              id: staffId,

              uid,

              name:
                form.ownerName.trim(),

              email:
                form.email
                  .trim()
                  .toLowerCase(),

              phone:
                form.phone.trim(),

              role: "owner",

              customRole: "",

              branch:
                form.branchName.trim() ||
                "الفرع الرئيسي",

              status: "offline",

              accountStatus:
                "active",

              permissionsMode:
                "owner",

              /* ===================================
                 DOCTOR SPECIALTY
              =================================== */

              primarySpecialty:
                specialtyId,

              primarySpecialtyName:
                specialtyName,

              specialties: {
                [specialtyId]: true,
              },

              createdAt:
                serverTimestamp(),
            },
          },

          /* ========================================
             SETTINGS
          ======================================== */

          settings: {
            clinic: {
              clinicName:
                form.clinicNameEn.trim() ||
                form.clinicNameAr.trim(),

              clinicNameAr:
                form.clinicNameAr.trim(),

              clinicNameEn:
                form.clinicNameEn.trim(),

              phone:
                form.phone.trim(),

              whatsapp:
                form.phone.trim(),

              address: "",

              facilityType:
                facility.id,

              primarySpecialty:
                specialtyId,

              primarySpecialtyName:
                specialtyName,
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

              doctorName:
                form.ownerName.trim(),

              specialty:
                specialtyName,

              specialtyId,

              degree: "",

              phone:
                form.phone.trim(),

              address: "",

              footerNote:
                "نتمنى لكم دوام الصحة والعافية",

              logo: "",

              layout: "classic",
            },

            specialty: {
              engineVersion: 1,

              primary:
                specialtyId,

              primaryName:
                specialtyName,

              allowMultiple:
                Boolean(
                  facility.multiSpecialty
                ),
            },
          },

          /* ========================================
             SUBSCRIPTION
          ======================================== */

          subscription: {
            plan: "trial",

            status: "active",

            createdAt:
              serverTimestamp(),
          },
        };

        await set(
          ref(
            secondaryDatabase,
            `clinics/${clinicId}`
          ),
          clinicData
        );

        /* ==========================================
           7. LOGOUT SECONDARY ACCOUNT
        ========================================== */

        await signOut(
          secondaryAuth
        );

        /* ==========================================
           8. SUCCESS
        ========================================== */

        setResult({
          clinicId,

          uid,

          ownerName:
            form.ownerName.trim(),

          clinicName:
            form.clinicNameAr.trim(),

          email:
            form.email
              .trim()
              .toLowerCase(),

          facilityType:
            facility.name,

          specialty:
            specialtyName,
        });

        /* ==========================================
           9. RESET FORM
        ========================================== */

        setForm({
          setupKey:
            form.setupKey,

          clinicNameAr: "",

          clinicNameEn: "",

          branchName:
            "الفرع الرئيسي",

          facilityType:
            "single_doctor",

          primarySpecialty: "",

          ownerName: "",

          phone: "",

          email: "",

          password: "",
        });

        setSpecialtySearch("");
        setShowSpecialties(false);
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
                .includes(
                  "permission_denied"
                )
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
          } catch (
            cleanupError
          ) {
            console.error(
              "Secondary Firebase cleanup:",
              cleanupError
            );
          }
        }

        setLoading(false);
      }
    };

  /* =======================================================
     UI
  ======================================================= */

  return (
    <main
      className="setup-clinic-page"
      dir="rtl"
    >
      {/* ===================================================
          LEFT SIDE
      =================================================== */}

      <aside className="setup-side">
        <div className="setup-brand">
          <div className="setup-brand-icon">
            <Stethoscope
              size={25}
            />
          </div>

          <div>
            <strong>
              OMG Clinic
            </strong>

            <span>
              Internal Setup
            </span>
          </div>
        </div>

        <div className="setup-side-content">
          <span className="setup-private-label">
            <ShieldCheck
              size={15}
            />

            INTERNAL ACCESS
          </span>

          <h1>
            إضافة
            <br />
            <span>
              عيادة جديدة.
            </span>
          </h1>

          <p>
            إنشاء العيادة وتحديد
            نوع المنشأة والتخصص الطبي
            الذي سيعمل عليه OMG Clinic.
          </p>
        </div>

        <div className="setup-flow">
          <SetupStep
            number="01"
            title="إنشاء العيادة"
          />

          <SetupStep
            number="02"
            title="اختيار التخصص"
          />

          <SetupStep
            number="03"
            title="إنشاء حساب Owner"
          />

          <SetupStep
            number="04"
            title="تجهيز النظام الطبي"
          />
        </div>
      </aside>

      {/* ===================================================
          FORM
      =================================================== */}

      <section className="setup-form-side">
        <div className="setup-form-container">
          <header className="setup-heading">
            <span>
              OMG INTERNAL TOOL
            </span>

            <h2>
              إنشاء حساب عيادة
            </h2>

            <p>
              سيتم تجهيز النظام
              تلقائيًا حسب نوع المنشأة
              والتخصص الطبي المختار.
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
              onSubmit={
                handleCreateClinic
              }
            >
              {/* ===========================================
                  ACCESS
              =========================================== */}

              <section className="setup-form-section">
                <div className="setup-section-title">
                  <KeyRound
                    size={18}
                  />

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
                    <LockKeyhole
                      size={17}
                    />
                  }
                >
                  <input
                    type="password"
                    value={
                      form.setupKey
                    }
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

              {/* ===========================================
                  CLINIC
              =========================================== */}

              <section className="setup-form-section">
                <div className="setup-section-title">
                  <Building2
                    size={18}
                  />

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
                      <Building2
                        size={17}
                      />
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

                  <SetupField
                    label="الفرع"
                  >
                    <input
                      value={
                        form.branchName
                      }
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
                    icon={
                      <Phone
                        size={17}
                      />
                    }
                  >
                    <input
                      value={
                        form.phone
                      }
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

              {/* ===========================================
                  FACILITY TYPE
              =========================================== */}

              <section className="setup-form-section">
                <div className="setup-section-title">
                  <Hospital
                    size={18}
                  />

                  <div>
                    <strong>
                      نوع المنشأة
                    </strong>

                    <span>
                      يحدد طريقة عمل
                      التخصصات والأطباء
                    </span>
                  </div>
                </div>

                <div className="facility-type-grid">
                  {FACILITY_TYPES.map(
                    (facility) => {
                      const Icon =
                        facility.icon;

                      const active =
                        form.facilityType ===
                        facility.id;

                      return (
                        <button
                          key={
                            facility.id
                          }
                          type="button"
                          className={`facility-type-card ${
                            active
                              ? "is-selected"
                              : ""
                          }`}
                          onClick={() =>
                            updateField(
                              "facilityType",
                              facility.id
                            )
                          }
                        >
                          <div className="facility-type-icon">
                            <Icon
                              size={21}
                            />
                          </div>

                          <div className="facility-type-content">
                            <strong>
                              {
                                facility.name
                              }
                            </strong>

                            <span>
                              {
                                facility.description
                              }
                            </span>
                          </div>

                          <div className="facility-type-check">
                            {active && (
                              <Check
                                size={15}
                              />
                            )}
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </section>

              {/* ===========================================
                  SPECIALTY
              =========================================== */}

              <section className="setup-form-section specialty-setup-section">
                <div className="setup-section-title">
                  <Stethoscope
                    size={18}
                  />

                  <div>
                    <strong>
                      التخصص الطبي
                    </strong>

                    <span>
                      سيحدد هيكل الملف
                      الطبي والكشف
                    </span>
                  </div>
                </div>

                <div className="specialty-intro">
                  <div>
                    <strong>
                      التخصص الرئيسي
                    </strong>

                    <p>
                      اختر التخصص الذي
                      ستبدأ به العيادة.
                      يمكن إضافة تخصصات
                      وأطباء آخرين لاحقًا
                      للمنشآت متعددة
                      التخصصات.
                    </p>
                  </div>

                  {selectedFacility
                    ?.multiSpecialty && (
                    <span className="multi-specialty-badge">
                      يدعم عدة تخصصات
                    </span>
                  )}
                </div>

                {/* FEATURED */}

                <div className="featured-specialties">
                  <span className="featured-specialties-label">
                    التخصصات الأساسية
                  </span>

                  <div className="featured-specialties-grid">
                    {FEATURED_SPECIALTIES.map(
                      (
                        specialty
                      ) => {
                        const active =
                          form.primarySpecialty ===
                          specialty.id;

                        return (
                          <button
                            key={
                              specialty.id
                            }
                            type="button"
                            className={`featured-specialty ${
                              active
                                ? "is-selected"
                                : ""
                            }`}
                            onClick={() =>
                              selectSpecialty(
                                specialty
                              )
                            }
                          >
                            <Stethoscope
                              size={17}
                            />

                            <span>
                              {
                                specialty.nameAr
                              }
                            </span>

                            {active && (
                              <Check
                                size={15}
                              />
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* SEARCH SELECT */}

                <div className="specialty-selector">
                  <span className="specialty-selector-label">
                    جميع التخصصات
                  </span>

                  <div
                    className={`specialty-select-box ${
                      showSpecialties
                        ? "is-open"
                        : ""
                    }`}
                  >
                    <div className="specialty-select-control">
                      <Search
                        size={18}
                      />

                      <input
                        value={
                          showSpecialties
                            ? specialtySearch
                            : selectedSpecialty
                              ?.nameAr ||
                              ""
                        }
                        onFocus={() => {
                          setShowSpecialties(
                            true
                          );

                          setSpecialtySearch(
                            ""
                          );
                        }}
                        onChange={(
                          e
                        ) => {
                          setSpecialtySearch(
                            e.target
                              .value
                          );

                          setShowSpecialties(
                            true
                          );
                        }}
                        placeholder="ابحث عن التخصص..."
                      />

                      {selectedSpecialty &&
                      !showSpecialties ? (
                        <button
                          type="button"
                          className="specialty-clear"
                          onClick={
                            clearSpecialty
                          }
                          title="إلغاء الاختيار"
                        >
                          <X
                            size={16}
                          />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="specialty-toggle"
                          onClick={() =>
                            setShowSpecialties(
                              (
                                current
                              ) =>
                                !current
                            )
                          }
                        >
                          <ChevronDown
                            size={17}
                          />
                        </button>
                      )}
                    </div>

                    {showSpecialties && (
                      <div className="specialty-dropdown">
                        <div className="specialty-dropdown-head">
                          <span>
                            {
                              filteredSpecialties.length
                            }{" "}
                            تخصص
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              setShowSpecialties(
                                false
                              );

                              setSpecialtySearch(
                                ""
                              );
                            }}
                          >
                            <X
                              size={15}
                            />
                          </button>
                        </div>

                        <div className="specialty-dropdown-list">
                          {filteredSpecialties.length >
                          0 ? (
                            filteredSpecialties.map(
                              (
                                specialty
                              ) => {
                                const active =
                                  form.primarySpecialty ===
                                  specialty.id;

                                return (
                                  <button
                                    key={
                                      specialty.id
                                    }
                                    type="button"
                                    className={`specialty-dropdown-item ${
                                      active
                                        ? "is-selected"
                                        : ""
                                    }`}
                                    onClick={() =>
                                      selectSpecialty(
                                        specialty
                                      )
                                    }
                                  >
                                    <div>
                                      <strong>
                                        {
                                          specialty.nameAr
                                        }
                                      </strong>

                                      <span>
                                        {
                                          specialty.nameEn
                                        }
                                      </span>
                                    </div>

                                    {active && (
                                      <Check
                                        size={16}
                                      />
                                    )}
                                  </button>
                                );
                              }
                            )
                          ) : (
                            <div className="specialty-no-results">
                              لا يوجد تخصص
                              مطابق للبحث.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedSpecialty && (
                  <div className="selected-specialty-summary">
                    <div className="selected-specialty-icon">
                      <Stethoscope
                        size={20}
                      />
                    </div>

                    <div>
                      <span>
                        التخصص المحدد
                      </span>

                      <strong>
                        {
                          selectedSpecialty.nameAr
                        }
                      </strong>

                      <small>
                        {
                          selectedSpecialty.nameEn
                        }
                      </small>
                    </div>

                    <CheckCircle2
                      size={21}
                    />
                  </div>
                )}
              </section>

              {/* ===========================================
                  OWNER
              =========================================== */}

              <section className="setup-form-section">
                <div className="setup-section-title">
                  <UserRound
                    size={18}
                  />

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
                    <UserRound
                      size={17}
                    />
                  }
                >
                  <input
                    value={
                      form.ownerName
                    }
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
                    icon={
                      <Mail
                        size={17}
                      />
                    }
                  >
                    <input
                      type="email"
                      value={
                        form.email
                      }
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
                        value={
                          form.password
                        }
                        onChange={(e) =>
                          updateField(
                            "password",
                            e.target
                              .value
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
                            (
                              current
                            ) =>
                              !current
                          )
                        }
                      >
                        {showPassword ? (
                          <EyeOff
                            size={17}
                          />
                        ) : (
                          <Eye
                            size={17}
                          />
                        )}
                      </button>
                    </div>
                  </SetupField>
                </div>
              </section>

              {/* ===========================================
                  ERROR
              =========================================== */}

              {error && (
                <div className="setup-error">
                  {error}
                </div>
              )}

              {/* ===========================================
                  SUBMIT
              =========================================== */}

              <button
                className="create-clinic-button"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="setup-spinner" />

                    جاري إنشاء
                    العيادة...
                  </>
                ) : (
                  <>
                    <ShieldCheck
                      size={18}
                    />

                    إنشاء العيادة
                    وتجهيز التخصص
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

/* =========================================================
   FIELD
========================================================= */

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

        {optional && (
          <small>
            اختياري
          </small>
        )}
      </span>

      <div className="setup-input">
        {icon && icon}

        {children}
      </div>
    </label>
  );
}

/* =========================================================
   STEP
========================================================= */

function SetupStep({
  number,
  title,
}) {
  return (
    <div className="setup-step">
      <span>
        {number}
      </span>

      <strong>
        {title}
      </strong>
    </div>
  );
}

/* =========================================================
   SUCCESS
========================================================= */

function SuccessResult({
  result,
  onCreateAnother,
}) {
  return (
    <div className="setup-success">
      <div className="setup-success-icon">
        <CheckCircle2
          size={35}
        />
      </div>

      <span>
        CLINIC READY
      </span>

      <h2>
        تم إنشاء العيادة بنجاح
      </h2>

      <p>
        الحساب جاهز الآن وتم
        تجهيز OMG Clinic بالتخصص
        الطبي المحدد.
      </p>

      <div className="created-clinic-sheet">
        <div>
          <span>
            العيادة
          </span>

          <strong>
            {
              result.clinicName
            }
          </strong>
        </div>

        <div>
          <span>
            نوع المنشأة
          </span>

          <strong>
            {
              result.facilityType
            }
          </strong>
        </div>

        <div>
          <span>
            التخصص
          </span>

          <strong>
            {
              result.specialty
            }
          </strong>
        </div>

        <div>
          <span>
            صاحب الحساب
          </span>

          <strong>
            {
              result.ownerName
            }
          </strong>
        </div>

        <div>
          <span>
            البريد
          </span>

          <strong dir="ltr">
            {
              result.email
            }
          </strong>
        </div>

        <div>
          <span>
            Clinic ID
          </span>

          <strong dir="ltr">
            {
              result.clinicId
            }
          </strong>
        </div>
      </div>

      <div className="setup-success-actions">
        <a href="/login">
          تسجيل الدخول
        </a>

        <button
          type="button"
          onClick={
            onCreateAnother
          }
        >
          إضافة عيادة أخرى
        </button>
      </div>
    </div>
  );
}