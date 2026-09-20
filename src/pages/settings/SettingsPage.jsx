import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  Building2,
  Check,
  ChevronLeft,
  Clock3,
  FileText,
  Image,
  LoaderCircle,
  Receipt,
  Save,
  ShieldCheck,
  Stethoscope,
  Upload,
  Wallet,
  X,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

import {
  DEFAULT_CLINIC_SETTINGS,
  initializeClinicSettings,
  saveClinicSettings,
  subscribeClinicSettings,
} from "../../services/clinicSettingsService";

import "./SettingsPage.css";

/* =========================================================
   SECTIONS
========================================================= */

const sections = [
  {
    id: "clinic",
    label: "بيانات العيادة",
    icon: Building2,
  },
  {
    id: "prescription",
    label: "الروشتة والطبيب",
    icon: FileText,
  },
  {
    id: "pricing",
    label: "أسعار الكشف",
    icon: Wallet,
  },
  {
    id: "appointments",
    label: "المواعيد",
    icon: Clock3,
  },
  {
    id: "permissions",
    label: "الصلاحيات",
    icon: ShieldCheck,
  },
];

/* =========================================================
   HELPERS
========================================================= */

function getProfileName(profile) {
  return (
    profile?.name ||
    profile?.fullName ||
    profile?.displayName ||
    ""
  );
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return fallback;
  }

  return number;
}

function fileToBase64(file) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        resolve(reader.result);
      };

      reader.onerror = () => {
        reject(
          new Error(
            "تعذر قراءة الملف."
          )
        );
      };

      reader.readAsDataURL(
        file
      );
    }
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function SettingsPage() {
  const {
    clinicId,
    staffId,
    profile,
    clinic,
  } = useAuth();

  const [
    active,
    setActive,
  ] = useState(
    "clinic"
  );

  const [
    settings,
    setSettings,
  ] = useState(
    DEFAULT_CLINIC_SETTINGS
  );

  const [
    loading,
    setLoading,
  ] = useState(
    true
  );

  const [
    saving,
    setSaving,
  ] = useState(
    false
  );

  const [
    saved,
    setSaved,
  ] = useState(
    false
  );

  const [
    dirty,
    setDirty,
  ] = useState(
    false
  );

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  /* =======================================================
     LOAD / INITIALIZE SETTINGS
  ======================================================= */

  useEffect(() => {
    if (!clinicId) {
      setLoading(
        false
      );

      return undefined;
    }

    let mounted =
      true;

    let unsubscribe =
      null;

    const start =
      async () => {
        try {
          setLoading(
            true
          );

          setError("");

          await initializeClinicSettings(
            {
              clinicId,
              clinic,
              profile,
              staffId:
                staffId ||
                "",
            }
          );

          if (!mounted) {
            return;
          }

          unsubscribe =
            subscribeClinicSettings(
              clinicId,

              (
                clinicSettings
              ) => {
                if (
                  !mounted
                ) {
                  return;
                }

                setSettings(
                  clinicSettings
                );

                setLoading(
                  false
                );
              },

              (err) => {
                console.error(
                  err
                );

                if (
                  !mounted
                ) {
                  return;
                }

                setError(
                  "تعذر تحميل إعدادات العيادة."
                );

                setLoading(
                  false
                );
              }
            );
        } catch (err) {
          console.error(
            err
          );

          if (
            !mounted
          ) {
            return;
          }

          setError(
            err?.message ||
              "تعذر تجهيز إعدادات العيادة."
          );

          setLoading(
            false
          );
        }
      };

    start();

    return () => {
      mounted =
        false;

      unsubscribe?.();
    };
  }, [
    clinicId,
    clinic,
    profile,
    staffId,
  ]);

  /* =======================================================
     SUCCESS TIMER
  ======================================================= */

  useEffect(() => {
    if (!success) {
      return undefined;
    }

    const timer =
      window.setTimeout(
        () => {
          setSuccess(
            ""
          );
        },
        3000
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [success]);

  /* =======================================================
     UPDATE HELPERS
  ======================================================= */

  const updateSection = (
    section,
    key,
    value
  ) => {
    setSaved(false);
    setDirty(true);
    setSuccess("");

    setSettings(
      (current) => ({
        ...current,

        [section]: {
          ...current[
            section
          ],

          [key]: value,
        },
      })
    );
  };

  const updateClinic = (
    key,
    value
  ) => {
    updateSection(
      "clinic",
      key,
      value
    );
  };

  const updatePrescription = (
    key,
    value
  ) => {
    updateSection(
      "prescription",
      key,
      value
    );
  };

  const updatePricing = (
    key,
    value
  ) => {
    updateSection(
      "pricing",
      key,
      value
    );
  };

  const updateAppointments = (
    key,
    value
  ) => {
    updateSection(
      "appointments",
      key,
      value
    );
  };

  const updatePermissions = (
    key,
    value
  ) => {
    updateSection(
      "permissions",
      key,
      value
    );
  };

  /* =======================================================
     VALIDATION
  ======================================================= */

  const validate =
    () => {
      const consultationPrice =
        normalizeNumber(
          settings
            .pricing
            .consultationPrice,
          -1
        );

      const followupPrice =
        normalizeNumber(
          settings
            .pricing
            .followupPrice,
          -1
        );

      const followupDays =
        normalizeNumber(
          settings
            .pricing
            .followupDays,
          -1
        );

      const slotDuration =
        normalizeNumber(
          settings
            .appointments
            .slotDuration,
          0
        );

      if (
        !settings.clinic.clinicNameAr.trim() &&
        !settings.clinic.clinicName.trim()
      ) {
        setActive(
          "clinic"
        );

        throw new Error(
          "اكتب اسم العيادة."
        );
      }

      if (
        consultationPrice <
        0
      ) {
        setActive(
          "pricing"
        );

        throw new Error(
          "سعر الكشف غير صحيح."
        );
      }

      if (
        followupPrice <
        0
      ) {
        setActive(
          "pricing"
        );

        throw new Error(
          "سعر الإعادة غير صحيح."
        );
      }

      if (
        followupDays <
        0
      ) {
        setActive(
          "pricing"
        );

        throw new Error(
          "مدة صلاحية الإعادة غير صحيحة."
        );
      }

      if (
        slotDuration <=
        0
      ) {
        setActive(
          "appointments"
        );

        throw new Error(
          "مدة الموعد غير صحيحة."
        );
      }

      if (
        !settings
          .appointments
          .startTime
      ) {
        setActive(
          "appointments"
        );

        throw new Error(
          "حدد وقت بداية العمل."
        );
      }

      if (
        !settings
          .appointments
          .endTime
      ) {
        setActive(
          "appointments"
        );

        throw new Error(
          "حدد وقت نهاية العمل."
        );
      }

      if (
        settings
          .appointments
          .startTime >=
        settings
          .appointments
          .endTime
      ) {
        setActive(
          "appointments"
        );

        throw new Error(
          "وقت نهاية العمل يجب أن يكون بعد وقت البداية."
        );
      }
    };

  /* =======================================================
     SAVE
  ======================================================= */

  const save =
    async () => {
      if (!clinicId) {
        setError(
          "لم يتم العثور على العيادة الحالية."
        );

        return;
      }

      try {
        setSaving(
          true
        );

        setError("");
        setSuccess("");

        validate();

        const payload = {
          ...settings,

          pricing: {
            ...settings.pricing,

            consultationPrice:
              normalizeNumber(
                settings
                  .pricing
                  .consultationPrice,
                0
              ),

            followupPrice:
              normalizeNumber(
                settings
                  .pricing
                  .followupPrice,
                0
              ),

            followupDays:
              normalizeNumber(
                settings
                  .pricing
                  .followupDays,
                14
              ),
          },

          appointments: {
            ...settings.appointments,

            slotDuration:
              normalizeNumber(
                settings
                  .appointments
                  .slotDuration,
                30
              ),
          },
        };

        const savedSettings =
          await saveClinicSettings(
            {
              clinicId,

              settings:
                payload,

              updatedBy:
                staffId ||
                "",

              updatedByName:
                getProfileName(
                  profile
                ),
            }
          );

        setSettings(
          savedSettings
        );

        setDirty(false);
        setSaved(true);

        setSuccess(
          "تم حفظ إعدادات العيادة وتطبيقها بنجاح."
        );
      } catch (err) {
        console.error(
          err
        );

        setSaved(false);

        setError(
          err?.message ||
            "تعذر حفظ إعدادات العيادة."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="settings-page">
        <div
          style={{
            minHeight:
              "520px",

            display:
              "flex",

            flexDirection:
              "column",

            alignItems:
              "center",

            justifyContent:
              "center",

            gap: "10px",

            color:
              "#718195",
          }}
        >
          <LoaderCircle
            size={30}
            style={{
              animation:
                "spin 0.8s linear infinite",
            }}
          />

          <strong>
            جاري تحميل إعدادات العيادة
          </strong>

          <span
            style={{
              fontSize:
                "12px",
            }}
          >
            يتم تجهيز الأسعار والمواعيد والصلاحيات...
          </span>
        </div>
      </div>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="settings-page">
      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="settings-header">
        <div>
          <span>
            SYSTEM CONTROL ROOM
          </span>

          <h1>
            الإعدادات
          </h1>

          <p>
            اضبط العيادة مرة واحدة وسيستخدم OMG Clinic هذه البيانات في كل أجزاء النظام
          </p>
        </div>

        <button
          className={`settings-save ${
            saved
              ? "saved"
              : ""
          }`}
          onClick={
            save
          }
          disabled={
            saving ||
            !dirty
          }
        >
          {saving ? (
            <LoaderCircle
              size={17}
              style={{
                animation:
                  "spin 0.8s linear infinite",
              }}
            />
          ) : saved ? (
            <Check
              size={17}
            />
          ) : (
            <Save
              size={17}
            />
          )}

          {saving
            ? "جاري الحفظ..."
            : saved
              ? "تم الحفظ"
              : dirty
                ? "حفظ التغييرات"
                : "الإعدادات محفوظة"}
        </button>
      </header>

      {/* ===================================================
          ALERTS
      =================================================== */}

      {error && (
        <div
          style={{
            margin:
              "14px 24px 0",

            minHeight:
              "42px",

            display:
              "flex",

            alignItems:
              "center",

            gap: "8px",

            padding:
              "8px 12px",

            border:
              "1px solid #efcfd2",

            borderRadius:
              "6px",

            background:
              "#fff6f7",

            color:
              "#a94751",

            fontSize:
              "12px",
          }}
        >
          <AlertCircle
            size={16}
          />

          <span
            style={{
              flex: 1,
            }}
          >
            {error}
          </span>

          <button
            onClick={() =>
              setError("")
            }
            style={{
              width:
                "28px",

              height:
                "28px",

              display:
                "grid",

              placeItems:
                "center",

              padding: 0,

              border: 0,

              background:
                "transparent",

              color:
                "inherit",

              cursor:
                "pointer",
            }}
          >
            <X
              size={15}
            />
          </button>
        </div>
      )}

      {success && (
        <div
          style={{
            margin:
              "14px 24px 0",

            minHeight:
              "42px",

            display:
              "flex",

            alignItems:
              "center",

            gap: "8px",

            padding:
              "8px 12px",

            border:
              "1px solid #cde5d7",

            borderRadius:
              "6px",

            background:
              "#f3faf6",

            color:
              "#347658",

            fontSize:
              "12px",

            fontWeight:
              700,
          }}
        >
          <Check
            size={16}
          />

          {success}
        </div>
      )}

      {/* ===================================================
          WORKSPACE
      =================================================== */}

      <main className="settings-workspace">
        <aside className="settings-index">
          <div className="settings-index-title">
            <span>
              CONFIGURATION
            </span>

            <strong>
              إعداد النظام
            </strong>
          </div>

          {sections.map(
            (section) => {
              const Icon =
                section.icon;

              return (
                <button
                  key={
                    section.id
                  }
                  className={
                    active ===
                    section.id
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActive(
                      section.id
                    )
                  }
                >
                  <Icon
                    size={18}
                  />

                  <span>
                    {
                      section.label
                    }
                  </span>

                  <ChevronLeft
                    size={15}
                  />
                </button>
              );
            }
          )}
        </aside>

        <section className="settings-editor">
          {active ===
            "clinic" && (
            <ClinicSettings
              settings={
                settings.clinic
              }
              update={
                updateClinic
              }
            />
          )}

          {active ===
            "prescription" && (
            <PrescriptionSettings
              clinicSettings={
                settings.clinic
              }
              settings={
                settings.prescription
              }
              update={
                updatePrescription
              }
            />
          )}

          {active ===
            "pricing" && (
            <PricingSettings
              settings={
                settings.pricing
              }
              update={
                updatePricing
              }
            />
          )}

          {active ===
            "appointments" && (
            <AppointmentSettings
              settings={
                settings.appointments
              }
              update={
                updateAppointments
              }
            />
          )}

          {active ===
            "permissions" && (
            <PermissionsSettings
              settings={
                settings.permissions
              }
              update={
                updatePermissions
              }
            />
          )}
        </section>
      </main>
    </div>
  );
}

/* =========================================================
   SECTION HEADING
========================================================= */

function SectionHeading({
  eyebrow,
  title,
  text,
}) {
  return (
    <div className="settings-section-heading">
      <span>
        {eyebrow}
      </span>

      <h2>
        {title}
      </h2>

      <p>
        {text}
      </p>
    </div>
  );
}

/* =========================================================
   CLINIC SETTINGS
========================================================= */

function ClinicSettings({
  settings,
  update,
}) {
  return (
    <>
      <SectionHeading
        eyebrow="CLINIC IDENTITY"
        title="بيانات العيادة"
        text="هذه البيانات محفوظة على العيادة وتستخدم في النظام والإيصالات والمستندات."
      />

      <div className="settings-form">
        <SettingField label="اسم العيادة بالعربية">
          <input
            value={
              settings.clinicNameAr
            }
            onChange={(
              event
            ) =>
              update(
                "clinicNameAr",
                event
                  .target
                  .value
              )
            }
            placeholder="مثال: عيادة د. أحمد"
          />
        </SettingField>

        <SettingField label="اسم العيادة بالإنجليزية">
          <input
            value={
              settings.clinicName
            }
            onChange={(
              event
            ) =>
              update(
                "clinicName",
                event
                  .target
                  .value
              )
            }
            placeholder="Clinic name"
          />
        </SettingField>

        <div className="settings-two-columns">
          <SettingField label="رقم الهاتف">
            <input
              value={
                settings.phone
              }
              onChange={(
                event
              ) =>
                update(
                  "phone",
                  event
                    .target
                    .value
                )
              }
              placeholder="01xxxxxxxxx"
            />
          </SettingField>

          <SettingField label="WhatsApp">
            <input
              value={
                settings.whatsapp
              }
              onChange={(
                event
              ) =>
                update(
                  "whatsapp",
                  event
                    .target
                    .value
                )
              }
              placeholder="01xxxxxxxxx"
            />
          </SettingField>
        </div>

        <SettingField label="عنوان العيادة">
          <textarea
            value={
              settings.address
            }
            onChange={(
              event
            ) =>
              update(
                "address",
                event
                  .target
                  .value
              )
            }
            placeholder="عنوان العيادة..."
          />
        </SettingField>
      </div>
    </>
  );
}

/* =========================================================
   PRESCRIPTION SETTINGS
========================================================= */

function PrescriptionSettings({
  clinicSettings,
  settings,
  update,
}) {
  const fileInputRef =
    useRef(null);

  const [
    logoLoading,
    setLogoLoading,
  ] = useState(
    false
  );

  const [
    logoError,
    setLogoError,
  ] = useState("");

  const selectLogo =
    async (event) => {
      const file =
        event.target
          .files?.[0];

      event.target.value =
        "";

      if (!file) {
        return;
      }

      if (
        !file.type.startsWith(
          "image/"
        )
      ) {
        setLogoError(
          "اختر صورة PNG أو JPG."
        );

        return;
      }

      /*
       * لأننا نخزن Base64 في RTDB،
       * لا نسمح بصورة ضخمة.
       */
      if (
        file.size >
        700 * 1024
      ) {
        setLogoError(
          "حجم اللوجو كبير. استخدم صورة أقل من 700KB."
        );

        return;
      }

      try {
        setLogoLoading(
          true
        );

        setLogoError(
          ""
        );

        const base64 =
          await fileToBase64(
            file
          );

        update(
          "logoBase64",
          base64
        );

        update(
          "logoName",
          file.name
        );

        update(
          "logoType",
          file.type
        );
      } catch (err) {
        console.error(
          err
        );

        setLogoError(
          err?.message ||
            "تعذر رفع اللوجو."
        );
      } finally {
        setLogoLoading(
          false
        );
      }
    };

  const removeLogo =
    () => {
      update(
        "logoBase64",
        ""
      );

      update(
        "logoName",
        ""
      );

      update(
        "logoType",
        ""
      );
    };

  return (
    <>
      <SectionHeading
        eyebrow="PRESCRIPTION IDENTITY"
        title="بيانات الروشتة والطبيب"
        text="تكتب هذه البيانات مرة واحدة، وبعد الحفظ يمكن للروشتات الاعتماد عليها تلقائياً."
      />

      <div className="prescription-settings-layout">
        <div className="settings-form">
          <div className="logo-uploader">
            <div>
              {settings.logoBase64 ? (
                <img
                  src={
                    settings.logoBase64
                  }
                  alt="Clinic logo"
                  style={{
                    width:
                      "100%",

                    height:
                      "100%",

                    objectFit:
                      "contain",

                    borderRadius:
                      "6px",
                  }}
                />
              ) : (
                <Image
                  size={25}
                />
              )}
            </div>

            <span>
              <strong>
                لوجو الروشتة
              </strong>

              <small>
                PNG أو JPG - يتم حفظه داخل RTDB
              </small>

              {settings.logoName && (
                <small>
                  {
                    settings.logoName
                  }
                </small>
              )}
            </span>

            <input
              ref={
                fileInputRef
              }
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={
                selectLogo
              }
              style={{
                display:
                  "none",
              }}
            />

            <button
              type="button"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={
                logoLoading
              }
            >
              {logoLoading ? (
                <LoaderCircle
                  size={15}
                />
              ) : (
                <Upload
                  size={15}
                />
              )}

              {logoLoading
                ? "جاري القراءة..."
                : settings.logoBase64
                  ? "تغيير اللوجو"
                  : "اختيار اللوجو"}
            </button>
          </div>

          {settings.logoBase64 && (
            <button
              type="button"
              onClick={
                removeLogo
              }
              style={{
                width:
                  "fit-content",

                padding:
                  "7px 12px",

                border:
                  "1px solid #e2c7ca",

                borderRadius:
                  "5px",

                background:
                  "#fff",

                color:
                  "#a84c55",

                cursor:
                  "pointer",

                fontSize:
                  "11px",
              }}
            >
              حذف اللوجو
            </button>
          )}

          {logoError && (
            <span
              style={{
                color:
                  "#b34d56",

                fontSize:
                  "11px",
              }}
            >
              {logoError}
            </span>
          )}

          <SettingField label="اسم الطبيب">
            <input
              value={
                settings.doctorName
              }
              onChange={(
                event
              ) =>
                update(
                  "doctorName",
                  event
                    .target
                    .value
                )
              }
              placeholder="د. أحمد محمد"
            />
          </SettingField>

          <SettingField label="التخصص">
            <input
              value={
                settings.specialty
              }
              onChange={(
                event
              ) =>
                update(
                  "specialty",
                  event
                    .target
                    .value
                )
              }
              placeholder="استشاري الباطنة العامة"
            />
          </SettingField>

          <SettingField label="الدرجة العلمية">
            <input
              value={
                settings.degree
              }
              onChange={(
                event
              ) =>
                update(
                  "degree",
                  event
                    .target
                    .value
                )
              }
              placeholder="دكتوراه الأمراض الباطنة"
            />
          </SettingField>

          <div className="settings-two-columns">
            <SettingField label="رقم التسجيل الطبي">
              <input
                value={
                  settings.registration
                }
                onChange={(
                  event
                ) =>
                  update(
                    "registration",
                    event
                      .target
                      .value
                  )
                }
              />
            </SettingField>

            <SettingField label="رقم الهاتف على الروشتة">
              <input
                value={
                  settings.prescriptionPhone
                }
                onChange={(
                  event
                ) =>
                  update(
                    "prescriptionPhone",
                    event
                      .target
                      .value
                  )
                }
              />
            </SettingField>
          </div>
        </div>

        <PrescriptionMiniPreview
          clinicSettings={
            clinicSettings
          }
          settings={
            settings
          }
        />
      </div>
    </>
  );
}

/* =========================================================
   PRESCRIPTION PREVIEW
========================================================= */

function PrescriptionMiniPreview({
  clinicSettings,
  settings,
}) {
  return (
    <aside className="settings-rx-preview">
      <span>
        LIVE PREVIEW
      </span>

      <div className="mini-rx-paper">
        <div className="mini-rx-brand">
          {settings.logoBase64 ? (
            <div
              className="mini-logo"
              style={{
                overflow:
                  "hidden",

                background:
                  "#fff",
              }}
            >
              <img
                src={
                  settings.logoBase64
                }
                alt=""
                style={{
                  width:
                    "100%",

                  height:
                    "100%",

                  objectFit:
                    "contain",
                }}
              />
            </div>
          ) : (
            <div className="mini-logo">
              OMG
            </div>
          )}

          <div>
            <strong>
              {clinicSettings.clinicName ||
                "Clinic"}
            </strong>

            <span>
              {clinicSettings.clinicNameAr ||
                "العيادة"}
            </span>
          </div>
        </div>

        <div className="mini-doctor">
          <strong>
            {settings.doctorName ||
              "اسم الطبيب"}
          </strong>

          <span>
            {settings.specialty ||
              "التخصص"}
          </span>

          <small>
            {settings.degree ||
              "الدرجة العلمية"}
          </small>
        </div>

        <div className="mini-patient-line">
          Patient
          <i />
          Age
          <i />
          Date
        </div>

        <b className="mini-rx-symbol">
          ℞
        </b>

        <div className="mini-writing-line" />

        <div className="mini-writing-line short" />

        <div className="mini-writing-line" />

        <footer>
          {settings.prescriptionPhone ||
            clinicSettings.phone ||
            ""}

          {(settings.prescriptionPhone ||
            clinicSettings.phone) &&
          clinicSettings.address
            ? " • "
            : ""}

          {clinicSettings.address ||
            ""}
        </footer>
      </div>
    </aside>
  );
}

/* =========================================================
   PRICING
========================================================= */

function PricingSettings({
  settings,
  update,
}) {
  return (
    <>
      <SectionHeading
        eyebrow="PRICING RULES"
        title="أسعار الكشف والإعادة"
        text="هذه الأسعار ستصبح المصدر الرسمي الذي يعتمد عليه OMG Clinic في تحديد قيمة زيارة المريض والفاتورة."
      />

      <div className="pricing-sheet">
        <div className="price-line">
          <span>
            <Stethoscope
              size={20}
            />

            <b>
              كشف جديد

              <small>
                السعر الذي يحسب لأول زيارة أو بعد انتهاء مدة الإعادة
              </small>
            </b>
          </span>

          <label>
            <input
              type="number"
              min="0"
              step="1"
              value={
                settings.consultationPrice
              }
              onChange={(
                event
              ) =>
                update(
                  "consultationPrice",
                  event
                    .target
                    .value
                )
              }
            />

            <strong>
              ج.م
            </strong>
          </label>
        </div>

        <div className="price-line">
          <span>
            <Receipt
              size={20}
            />

            <b>
              إعادة

              <small>
                سعر زيارة المتابعة داخل مدة الإعادة
              </small>
            </b>
          </span>

          <label>
            <input
              type="number"
              min="0"
              step="1"
              value={
                settings.followupPrice
              }
              onChange={(
                event
              ) =>
                update(
                  "followupPrice",
                  event
                    .target
                    .value
                )
              }
            />

            <strong>
              ج.م
            </strong>
          </label>
        </div>

        <div className="price-line">
          <span>
            <Clock3
              size={20}
            />

            <b>
              مدة صلاحية الإعادة

              <small>
                بعد هذه المدة لا تعتبر الزيارة إعادة ويتم احتساب كشف جديد
              </small>
            </b>
          </span>

          <label>
            <input
              type="number"
              min="0"
              step="1"
              value={
                settings.followupDays
              }
              onChange={(
                event
              ) =>
                update(
                  "followupDays",
                  event
                    .target
                    .value
                )
              }
            />

            <strong>
              يوم
            </strong>
          </label>
        </div>
      </div>

      <div
        style={{
          marginTop:
            "16px",

          padding:
            "13px 15px",

          border:
            "1px solid #dce5ec",

          borderRadius:
            "6px",

          background:
            "#f7f9fb",

          color:
            "#62758a",

          fontSize:
            "11px",

          lineHeight:
            1.8,
        }}
      >
        <strong
          style={{
            display:
              "block",

            marginBottom:
              "3px",

            color:
              "#38536d",
          }}
        >
          طريقة التطبيق
        </strong>

        كشف جديد:{" "}
        <b>
          {normalizeNumber(
            settings.consultationPrice
          ).toLocaleString(
            "ar-EG"
          )}{" "}
          ج.م
        </b>

        {" • "}

        إعادة:{" "}
        <b>
          {normalizeNumber(
            settings.followupPrice
          ).toLocaleString(
            "ar-EG"
          )}{" "}
          ج.م
        </b>

        {" • "}

        الإعادة صالحة لمدة{" "}
        <b>
          {normalizeNumber(
            settings.followupDays
          )}{" "}
          يوم
        </b>
      </div>
    </>
  );
}

/* =========================================================
   APPOINTMENTS
========================================================= */

function AppointmentSettings({
  settings,
  update,
}) {
  return (
    <>
      <SectionHeading
        eyebrow="SCHEDULE RULES"
        title="إعداد المواعيد"
        text="هذه القواعد هي الإعدادات الرسمية لجدول عمل العيادة."
      />

      <div className="settings-form">
        <SettingField label="مدة الموعد الافتراضية">
          <select
            value={
              settings.slotDuration
            }
            onChange={(
              event
            ) =>
              update(
                "slotDuration",
                Number(
                  event
                    .target
                    .value
                )
              )
            }
          >
            <option value={15}>
              15 دقيقة
            </option>

            <option value={20}>
              20 دقيقة
            </option>

            <option value={30}>
              30 دقيقة
            </option>

            <option value={45}>
              45 دقيقة
            </option>

            <option value={60}>
              60 دقيقة
            </option>
          </select>
        </SettingField>

        <div className="settings-two-columns">
          <SettingField label="بداية العمل">
            <input
              type="time"
              value={
                settings.startTime
              }
              onChange={(
                event
              ) =>
                update(
                  "startTime",
                  event
                    .target
                    .value
                )
              }
            />
          </SettingField>

          <SettingField label="نهاية العمل">
            <input
              type="time"
              value={
                settings.endTime
              }
              onChange={(
                event
              ) =>
                update(
                  "endTime",
                  event
                    .target
                    .value
                )
              }
            />
          </SettingField>
        </div>

        <div
          style={{
            padding:
              "12px 14px",

            border:
              "1px solid #dce5ec",

            borderRadius:
              "6px",

            background:
              "#f7f9fb",

            color:
              "#62758a",

            fontSize:
              "11px",
          }}
        >
          يوم العمل من{" "}
          <strong>
            {settings.startTime}
          </strong>{" "}
          إلى{" "}
          <strong>
            {settings.endTime}
          </strong>

          {" • "}

          كل موعد{" "}
          <strong>
            {settings.slotDuration} دقيقة
          </strong>
        </div>
      </div>
    </>
  );
}

/* =========================================================
   PERMISSIONS
========================================================= */

function PermissionsSettings({
  settings,
  update,
}) {
  return (
    <>
      <SectionHeading
        eyebrow="RECEPTION ACCESS"
        title="صلاحيات موظف الاستقبال"
        text="يتم حفظ هذه الصلاحيات على مستوى العيادة، وسنستخدمها للتحكم الفعلي في شاشات موظف الاستقبال."
      />

      <div className="permissions-sheet">
        <div className="permission-group-title">
          <span>
            مسموح للاستقبال
          </span>

          <strong>
            التشغيل اليومي
          </strong>
        </div>

        <PermissionLine
          title="تسجيل المرضى"
          text="إضافة مريض جديد وتعديل بيانات التواصل"
          enabled={
            settings.receptionPatients
          }
          onChange={() =>
            update(
              "receptionPatients",
              !settings.receptionPatients
            )
          }
        />

        <PermissionLine
          title="إدارة المواعيد"
          text="حجز، تعديل، إلغاء وترتيب مواعيد المرضى"
          enabled={
            settings.receptionAppointments
          }
          onChange={() =>
            update(
              "receptionAppointments",
              !settings.receptionAppointments
            )
          }
        />

        <PermissionLine
          title="تسجيل الوصول وقائمة الانتظار"
          text="Check-in للمريض وإضافته لطابور الطبيب"
          enabled={
            settings.receptionCheckin
          }
          onChange={() =>
            update(
              "receptionCheckin",
              !settings.receptionCheckin
            )
          }
        />

        <PermissionLine
          title="تسجيل دفع الكشف"
          text="تسجيل التحصيل وطريقة الدفع وطباعة الإيصال"
          enabled={
            settings.receptionPayments
          }
          onChange={() =>
            update(
              "receptionPayments",
              !settings.receptionPayments
            )
          }
        />

        <div className="permission-separator" />

        <div className="permission-group-title restricted">
          <span>
            صلاحيات حساسة
          </span>

          <strong>
            تحتاج موافقة الـOwner
          </strong>
        </div>

        <PermissionLine
          title="عرض إجمالي المالية"
          text="مشاهدة إيرادات ومصروفات العيادة"
          enabled={
            settings.receptionFinanceSummary
          }
          onChange={() =>
            update(
              "receptionFinanceSummary",
              !settings.receptionFinanceSummary
            )
          }
        />

        <PermissionLine
          title="عرض التاريخ الطبي"
          text="الوصول للتشخيصات والزيارات الطبية السابقة"
          enabled={
            settings.receptionMedicalHistory
          }
          onChange={() =>
            update(
              "receptionMedicalHistory",
              !settings.receptionMedicalHistory
            )
          }
        />

        <PermissionLine
          title="عرض الروشتات"
          text="فتح الوصفات الطبية الخاصة بالمرضى"
          enabled={
            settings.receptionPrescription
          }
          onChange={() =>
            update(
              "receptionPrescription",
              !settings.receptionPrescription
            )
          }
        />

        <PermissionLine
          title="تعديل إعدادات النظام"
          text="الأسعار، بيانات الطبيب وصلاحيات المستخدمين"
          enabled={
            settings.receptionSettings
          }
          onChange={() =>
            update(
              "receptionSettings",
              !settings.receptionSettings
            )
          }
        />
      </div>
    </>
  );
}

/* =========================================================
   PERMISSION LINE
========================================================= */

function PermissionLine({
  title,
  text,
  enabled,
  onChange,
}) {
  return (
    <div className="permission-line">
      <span>
        <strong>
          {title}
        </strong>

        <small>
          {text}
        </small>
      </span>

      <button
        type="button"
        className={`permission-switch ${
          enabled
            ? "active"
            : ""
        }`}
        onClick={
          onChange
        }
      >
        <i />
      </button>
    </div>
  );
}

/* =========================================================
   FIELD
========================================================= */

function SettingField({
  label,
  children,
}) {
  return (
    <label className="setting-field">
      <span>
        {label}
      </span>

      {children}
    </label>
  );
}