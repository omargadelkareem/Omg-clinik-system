import {
  useEffect,
  useState,
} from "react";

import {
  AlertCircle,
  CalendarDays,
  Check,
  LoaderCircle,
  Phone,
  UserRound,
  X,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext";

import {
  createPatient,
} from "../../services/patientService";

import "./AddPatientDrawer.css";

const EMPTY_FORM = {
  name: "",
  phone: "",
  gender: "",
  dateOfBirth: "",
  bloodType: "",
  maritalStatus: "",
  emergencyContact: "",
  address: "",
  notes: "",
};

export default function AddPatientDrawer({
  open,
  onClose,
  onCreated,
}) {
  const {
    clinicId,
    firebaseUser,
  } = useAuth();

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const change = (
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

  const validate = () => {
    if (!form.name.trim()) {
      return "اكتب اسم المريض.";
    }

    const phone =
      form.phone.replace(
        /\s+/g,
        ""
      );

    if (!phone) {
      return "اكتب رقم الهاتف.";
    }

    if (
      !/^01[0125][0-9]{8}$/.test(
        phone
      )
    ) {
      return "اكتب رقم موبايل مصري صحيح مكون من 11 رقم.";
    }

    return null;
  };

  const handleSubmit =
    async (e) => {
      e.preventDefault();

      if (loading) return;

      const validationError =
        validate();

      if (validationError) {
        setError(
          validationError
        );

        return;
      }

      setLoading(true);
      setError("");

      try {
        const patient =
          await createPatient({
            clinicId,

            userId:
              firebaseUser?.uid,

            data: form,
          });

        onCreated?.(patient);

        onClose();
      } catch (err) {
        console.error(
          "Create patient:",
          err
        );

        if (
          err.code ===
          "patient/phone-exists"
        ) {
          setError(
            "رقم الهاتف مسجل بالفعل لمريض آخر."
          );
        } else if (
          err.code ===
          "PERMISSION_DENIED" ||
          err.code ===
          "permission-denied"
        ) {
          setError(
            "ليس لديك صلاحية لإضافة مريض."
          );
        } else {
          setError(
            err.message ||
              "تعذر إضافة المريض."
          );
        }
      } finally {
        setLoading(false);
      }
    };

  return (
    <div className="patient-drawer-overlay">
      <aside
        className="patient-drawer"
        dir="rtl"
      >
        <header className="patient-drawer-header">
          <div>
            <span>
              PATIENT REGISTRATION
            </span>

            <h2>
              إضافة مريض جديد
            </h2>

            <p>
              إنشاء ملف أساسي للمريض
              داخل العيادة
            </p>
          </div>

          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            disabled={loading}
          >
            <X size={20} />
          </button>
        </header>

        <form
          className="patient-drawer-form"
          onSubmit={
            handleSubmit
          }
        >
          <section className="patient-form-section">
            <div className="patient-section-heading">
              <UserRound
                size={18}
              />

              <div>
                <strong>
                  البيانات الأساسية
                </strong>

                <span>
                  معلومات التعريف
                  والتواصل
                </span>
              </div>
            </div>

            <PatientField
              label="اسم المريض"
              required
            >
              <input
                value={form.name}
                onChange={(e) =>
                  change(
                    "name",
                    e.target.value
                  )
                }
                placeholder="الاسم بالكامل"
                autoFocus
              />
            </PatientField>

            <PatientField
              label="رقم الهاتف"
              required
            >
              <div className="patient-input-with-icon">
                <Phone
                  size={17}
                />

                <input
                  value={
                    form.phone
                  }
                  onChange={(e) =>
                    change(
                      "phone",
                      e.target.value
                    )
                  }
                  placeholder="01xxxxxxxxx"
                  inputMode="numeric"
                  dir="ltr"
                  maxLength={11}
                />
              </div>
            </PatientField>

            <div className="patient-form-grid">
              <PatientField label="النوع">
                <select
                  value={
                    form.gender
                  }
                  onChange={(e) =>
                    change(
                      "gender",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    اختر
                  </option>

                  <option value="male">
                    ذكر
                  </option>

                  <option value="female">
                    أنثى
                  </option>
                </select>
              </PatientField>

              <PatientField label="تاريخ الميلاد">
                <div className="patient-input-with-icon">
                  <CalendarDays
                    size={16}
                  />

                  <input
                    type="date"
                    value={
                      form.dateOfBirth
                    }
                    onChange={(e) =>
                      change(
                        "dateOfBirth",
                        e.target.value
                      )
                    }
                  />
                </div>
              </PatientField>
            </div>
          </section>

          <section className="patient-form-section">
            <div className="patient-section-heading">
              <span className="section-line" />

              <div>
                <strong>
                  بيانات إضافية
                </strong>

                <span>
                  اختيارية ويمكن
                  استكمالها لاحقاً
                </span>
              </div>
            </div>

            <div className="patient-form-grid">
              <PatientField label="فصيلة الدم">
                <select
                  value={
                    form.bloodType
                  }
                  onChange={(e) =>
                    change(
                      "bloodType",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    غير محدد
                  </option>

                  {[
                    "A+",
                    "A-",
                    "B+",
                    "B-",
                    "AB+",
                    "AB-",
                    "O+",
                    "O-",
                  ].map(
                    (type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {type}
                      </option>
                    )
                  )}
                </select>
              </PatientField>

              <PatientField label="الحالة الاجتماعية">
                <select
                  value={
                    form.maritalStatus
                  }
                  onChange={(e) =>
                    change(
                      "maritalStatus",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    غير محدد
                  </option>

                  <option value="single">
                    أعزب
                  </option>

                  <option value="married">
                    متزوج
                  </option>

                  <option value="divorced">
                    مطلق
                  </option>

                  <option value="widowed">
                    أرمل
                  </option>
                </select>
              </PatientField>
            </div>

            <PatientField label="رقم للطوارئ">
              <input
                value={
                  form.emergencyContact
                }
                onChange={(e) =>
                  change(
                    "emergencyContact",
                    e.target.value
                  )
                }
                placeholder="رقم شخص للتواصل عند الحاجة"
                dir="ltr"
              />
            </PatientField>

            <PatientField label="العنوان">
              <input
                value={
                  form.address
                }
                onChange={(e) =>
                  change(
                    "address",
                    e.target.value
                  )
                }
                placeholder="المدينة / المنطقة / العنوان"
              />
            </PatientField>

            <PatientField label="ملاحظات الاستقبال">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) =>
                  change(
                    "notes",
                    e.target.value
                  )
                }
                placeholder="أي ملاحظة إدارية مهمة..."
              />
            </PatientField>
          </section>

          {error && (
            <div className="patient-form-error">
              <AlertCircle
                size={17}
              />

              <span>
                {error}
              </span>
            </div>
          )}

          <footer className="patient-drawer-footer">
            <button
              type="button"
              className="patient-cancel-button"
              onClick={onClose}
              disabled={loading}
            >
              إلغاء
            </button>

            <button
              type="submit"
              className="patient-save-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle
                    size={17}
                    className="patient-loading-icon"
                  />

                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Check
                    size={17}
                  />

                  حفظ ملف المريض
                </>
              )}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}

function PatientField({
  label,
  required,
  children,
}) {
  return (
    <label className="patient-field">
      <span>
        {label}

        {required && (
          <b>*</b>
        )}
      </span>

      {children}
    </label>
  );
}