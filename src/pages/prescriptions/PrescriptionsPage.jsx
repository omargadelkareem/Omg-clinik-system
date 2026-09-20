import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  CalendarDays,
  ChevronLeft,
  Clock3,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  Pill,
  Printer,
  Search,
  Settings2,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

import {
  subscribePrescriptions,
  subscribePrescriptionPatients,
  subscribePrescriptionVisits,
} from "../../services/prescriptionService";

import "./PrescriptionsPage.css";

/* =========================================================
   HELPERS
========================================================= */

function getTimestamp(value) {
  if (!value) return 0;

  if (typeof value === "number") {
    return value;
  }

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}

function getDateKey(timestamp) {
  if (!timestamp) return "";

  const date = new Date(timestamp);

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isToday(timestamp) {
  if (!timestamp) return false;

  return (
    getDateKey(timestamp) ===
    getDateKey(Date.now())
  );
}

function formatDate(timestamp) {
  if (!timestamp) return "—";

  try {
    return new Intl.DateTimeFormat(
      "ar-EG",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    ).format(
      new Date(timestamp)
    );
  } catch {
    return "—";
  }
}

function formatShortDate(timestamp) {
  if (!timestamp) return "—";

  try {
    return new Intl.DateTimeFormat(
      "ar-EG",
      {
        day: "numeric",
        month: "short",
      }
    ).format(
      new Date(timestamp)
    );
  } catch {
    return "—";
  }
}

function formatTime(timestamp) {
  if (!timestamp) return "";

  try {
    return new Intl.DateTimeFormat(
      "ar-EG",
      {
        hour: "numeric",
        minute: "2-digit",
      }
    ).format(
      new Date(timestamp)
    );
  } catch {
    return "";
  }
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return "";

  const birth = new Date(dateOfBirth);

  if (
    Number.isNaN(
      birth.getTime()
    )
  ) {
    return "";
  }

  const today = new Date();

  let age =
    today.getFullYear() -
    birth.getFullYear();

  const month =
    today.getMonth() -
    birth.getMonth();

  if (
    month < 0 ||
    (month === 0 &&
      today.getDate() <
        birth.getDate())
  ) {
    age -= 1;
  }

  return age >= 0
    ? age
    : "";
}

function genderLabel(value) {
  const gender = String(
    value || ""
  ).toLowerCase();

  if (
    gender === "male" ||
    gender === "ذكر"
  ) {
    return "ذكر";
  }

  if (
    gender === "female" ||
    gender === "أنثى" ||
    gender === "انثى"
  ) {
    return "أنثى";
  }

  return value || "";
}

function safeText(value) {
  return String(
    value || ""
  ).trim();
}

/* =========================================================
   PAGE
========================================================= */

export default function PrescriptionsPage() {
  const navigate = useNavigate();

  const {
    clinicId,
    clinic,
    profile,
  } = useAuth();

  const [
    prescriptions,
    setPrescriptions,
  ] = useState([]);

  const [
    patients,
    setPatients,
  ] = useState({});

  const [
    visits,
    setVisits,
  ] = useState({});

  const [
    selectedId,
    setSelectedId,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] = useState("all");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  /* =======================================================
     PRINT SETTINGS
  ======================================================= */

  const [
    settingsOpen,
    setSettingsOpen,
  ] = useState(false);

  const [
    settings,
    setSettings,
  ] = useState(() => {
    try {
      const saved =
        localStorage.getItem(
          "omg-clinic-prescription-settings"
        );

      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }

    return {
      clinicName: "",
      doctorName: "",
      specialty: "",
      degree: "",
      phone: "",
      address: "",
      footerNote:
        "نتمنى لكم دوام الصحة والعافية",
    };
  });

  /* =======================================================
     REALTIME
  ======================================================= */

  useEffect(() => {
    if (!clinicId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const unsubscribePrescriptions =
      subscribePrescriptions(
        clinicId,

        (items) => {
          setPrescriptions(items);

          setSelectedId(
            (current) => {
              if (
                current &&
                items.some(
                  (item) =>
                    item.id === current
                )
              ) {
                return current;
              }

              return (
                items[0]?.id || ""
              );
            }
          );

          setLoading(false);
        },

        (err) => {
          console.error(err);

          setError(
            "تعذر تحميل الروشتات."
          );

          setLoading(false);
        }
      );

    const unsubscribePatients =
      subscribePrescriptionPatients(
        clinicId,
        setPatients
      );

    const unsubscribeVisits =
      subscribePrescriptionVisits(
        clinicId,
        setVisits
      );

    return () => {
      unsubscribePrescriptions?.();
      unsubscribePatients?.();
      unsubscribeVisits?.();
    };
  }, [clinicId]);

  /* =======================================================
     SETTINGS DEFAULTS FROM SYSTEM
  ======================================================= */

  useEffect(() => {
    setSettings(
      (current) => ({
        ...current,

        clinicName:
          current.clinicName ||
          clinic?.name ||
          clinic?.clinicName ||
          clinic?.profile?.name ||
          "OMG Clinic",

        doctorName:
          current.doctorName ||
          profile?.name ||
          profile?.fullName ||
          profile?.displayName ||
          "",

        specialty:
          current.specialty ||
          profile?.specialty ||
          profile?.specialization ||
          "",

        phone:
          current.phone ||
          clinic?.phone ||
          clinic?.profile?.phone ||
          "",

        address:
          current.address ||
          clinic?.address ||
          clinic?.profile?.address ||
          "",
      })
    );
  }, [
    clinic,
    profile,
  ]);

  /* =======================================================
     ENRICH DATA
  ======================================================= */

  const enrichedPrescriptions =
    useMemo(() => {
      return prescriptions.map(
        (prescription) => {
          const patient =
            patients[
              prescription.patientId
            ] || {};

          const visit =
            visits[
              prescription.visitId
            ] || {};

          const createdAt =
            getTimestamp(
              prescription.createdAt ||
                visit.completedAt ||
                visit.createdAt
            );

          return {
            ...prescription,

            createdAt,

            patient: {
              ...patient,

              id:
                prescription.patientId,

              name:
                patient.name ||
                prescription.patientName ||
                "مريض",

              patientCode:
                patient.patientCode ||
                prescription.patientCode ||
                "",

              phone:
                patient.phone || "",

              gender:
                genderLabel(
                  patient.gender
                ),

              age:
                calculateAge(
                  patient.dateOfBirth
                ),
            },

            visit,
          };
        }
      );
    }, [
      prescriptions,
      patients,
      visits,
    ]);

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredPrescriptions =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return enrichedPrescriptions.filter(
        (prescription) => {
          const patient =
            prescription.patient;

          const searchMatch =
            !query ||
            safeText(
              patient.name
            )
              .toLowerCase()
              .includes(query) ||
            safeText(
              patient.phone
            ).includes(query) ||
            safeText(
              patient.patientCode
            )
              .toLowerCase()
              .includes(query) ||
            safeText(
              prescription.diagnosis
            )
              .toLowerCase()
              .includes(query) ||
            safeText(
              prescription.doctorName
            )
              .toLowerCase()
              .includes(query);

          let filterMatch = true;

          if (
            filter === "today"
          ) {
            filterMatch =
              isToday(
                prescription.createdAt
              );
          }

          if (
            filter === "previous"
          ) {
            filterMatch =
              !isToday(
                prescription.createdAt
              );
          }

          return (
            searchMatch &&
            filterMatch
          );
        }
      );
    }, [
      enrichedPrescriptions,
      search,
      filter,
    ]);

  const selectedPrescription =
    useMemo(() => {
      return (
        enrichedPrescriptions.find(
          (item) =>
            item.id === selectedId
        ) || null
      );
    }, [
      enrichedPrescriptions,
      selectedId,
    ]);

  /* =======================================================
     ACTIONS
  ======================================================= */

  const openPatient = () => {
    if (
      !selectedPrescription?.patientId
    ) {
      return;
    }

    navigate(
      `/patients/${selectedPrescription.patientId}`
    );
  };

  const openVisit = () => {
    if (
      !selectedPrescription?.visitId
    ) {
      return;
    }

    navigate(
      `/patients/${selectedPrescription.patientId}`
    );
  };

  const handlePrint = () => {
    if (!selectedPrescription) {
      return;
    }

    window.print();
  };

  const openWhatsApp = () => {
    const phone =
      selectedPrescription?.patient
        ?.phone;

    if (!phone) {
      return;
    }

    let normalized =
      String(phone)
        .replace(/\D/g, "");

    if (
      normalized.startsWith("0")
    ) {
      normalized =
        `20${normalized.slice(1)}`;
    }

    window.open(
      `https://wa.me/${normalized}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const updateSetting = (
    field,
    value
  ) => {
    setSettings(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  };

  const saveSettings = () => {
    localStorage.setItem(
      "omg-clinic-prescription-settings",
      JSON.stringify(settings)
    );

    setSettingsOpen(false);
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="rx-page">
        <div className="rx-state">
          <div className="rx-loader" />

          <strong>
            جاري تحميل الروشتات
          </strong>

          <span>
            لحظات ويتم تجهيز أرشيف
            العيادة
          </span>
        </div>
      </div>
    );
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <div className="rx-page">
      {/* HEADER */}

      <header className="rx-page-header">
        <div>
          <span className="rx-eyebrow">
            PRESCRIPTIONS
          </span>

          <h1>الروشتات</h1>

          <p>
            أرشيف الروشتات الطبية
            الصادرة من الزيارات
          </p>
        </div>

        <div className="rx-header-actions">
          <div className="rx-header-stat">
            <span>
              إجمالي الروشتات
            </span>

            <strong>
              {prescriptions.length}
            </strong>
          </div>

          <button
            className="rx-settings-button"
            onClick={() =>
              setSettingsOpen(true)
            }
          >
            <Settings2 size={17} />

            <span>
              إعدادات الطباعة
            </span>
          </button>
        </div>
      </header>

      {error && (
        <div className="rx-error">
          {error}
        </div>
      )}

      {/* WORKSPACE */}

      <main className="rx-workspace">
        {/* ARCHIVE */}

        <aside className="rx-archive">
          <div className="rx-archive-top">
            <div>
              <strong>
                أرشيف الروشتات
              </strong>

              <span>
                {
                  filteredPrescriptions.length
                }{" "}
                روشتة
              </span>
            </div>
          </div>

          <div className="rx-search">
            <Search size={17} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="ابحث باسم المريض أو الهاتف..."
            />

            {search && (
              <button
                onClick={() =>
                  setSearch("")
                }
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="rx-filters">
            <button
              className={
                filter === "all"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFilter("all")
              }
            >
              الكل
            </button>

            <button
              className={
                filter === "today"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFilter("today")
              }
            >
              اليوم
            </button>

            <button
              className={
                filter === "previous"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFilter(
                  "previous"
                )
              }
            >
              السابق
            </button>
          </div>

          <div className="rx-list">
            {filteredPrescriptions.length ===
            0 ? (
              <div className="rx-empty-list">
                <FileText size={30} />

                <strong>
                  لا توجد روشتات
                </strong>

                <span>
                  لم يتم العثور على
                  نتائج مطابقة.
                </span>
              </div>
            ) : (
              filteredPrescriptions.map(
                (prescription) => (
                  <PrescriptionRow
                    key={
                      prescription.id
                    }
                    prescription={
                      prescription
                    }
                    active={
                      selectedId ===
                      prescription.id
                    }
                    onClick={() =>
                      setSelectedId(
                        prescription.id
                      )
                    }
                  />
                )
              )
            )}
          </div>
        </aside>

        {/* MAIN */}

        <section className="rx-main">
          {!selectedPrescription ? (
            <div className="rx-no-selection">
              <FileText size={38} />

              <strong>
                اختر روشتة
              </strong>

              <span>
                اختر روشتة من الأرشيف
                لعرض التفاصيل.
              </span>
            </div>
          ) : (
            <>
              <div className="rx-main-toolbar">
                <div className="rx-current-patient">
                  <div className="rx-patient-avatar">
                    {selectedPrescription.patient.name.charAt(
                      0
                    )}
                  </div>

                  <div>
                    <span>
                      الروشتة الحالية
                    </span>

                    <strong>
                      {
                        selectedPrescription
                          .patient.name
                      }
                    </strong>

                    <small>
                      {selectedPrescription
                        .patient
                        .patientCode ||
                        "بدون كود"}
                      {" • "}
                      {formatDate(
                        selectedPrescription.createdAt
                      )}
                    </small>
                  </div>
                </div>

                <div className="rx-toolbar-actions">
                  <button
                    onClick={
                      openPatient
                    }
                  >
                    <UserRound
                      size={16}
                    />
                    ملف المريض
                  </button>

                  <button
                    onClick={
                      openWhatsApp
                    }
                    disabled={
                      !selectedPrescription
                        .patient.phone
                    }
                  >
                    <MessageCircle
                      size={16}
                    />
                    WhatsApp
                  </button>

                  <button
                    className="primary"
                    onClick={
                      handlePrint
                    }
                  >
                    <Printer
                      size={16}
                    />
                    طباعة
                  </button>
                </div>
              </div>

              <div className="rx-content">
                <div className="rx-paper-area">
                  <PrescriptionPaper
                    prescription={
                      selectedPrescription
                    }
                    settings={
                      settings
                    }
                  />
                </div>

                <aside className="rx-details">
                  <div className="rx-details-header">
                    <span>
                      RX DETAILS
                    </span>

                    <strong>
                      تفاصيل الروشتة
                    </strong>
                  </div>

                  <DetailRow
                    label="رقم الروشتة"
                    value={
                      selectedPrescription.id
                    }
                  />

                  <button
                    className="rx-patient-link"
                    onClick={
                      openPatient
                    }
                  >
                    <div className="rx-small-avatar">
                      {selectedPrescription.patient.name.charAt(
                        0
                      )}
                    </div>

                    <span>
                      <small>
                        المريض
                      </small>

                      <strong>
                        {
                          selectedPrescription
                            .patient
                            .name
                        }
                      </strong>

                      <em>
                        {selectedPrescription
                          .patient.age
                          ? `${selectedPrescription.patient.age} سنة`
                          : ""}
                        {selectedPrescription
                          .patient.gender
                          ? ` • ${selectedPrescription.patient.gender}`
                          : ""}
                      </em>
                    </span>

                    <ChevronLeft
                      size={16}
                    />
                  </button>

                  <DetailIconRow
                    icon={
                      <CalendarDays
                        size={16}
                      />
                    }
                    label="التاريخ"
                    value={formatDate(
                      selectedPrescription.createdAt
                    )}
                    sub={formatTime(
                      selectedPrescription.createdAt
                    )}
                  />

                  <DetailIconRow
                    icon={
                      <Stethoscope
                        size={16}
                      />
                    }
                    label="الطبيب"
                    value={
                      selectedPrescription.doctorName ||
                      settings.doctorName ||
                      "—"
                    }
                  />

                  <div className="rx-detail-section">
                    <span>
                      التشخيص
                    </span>

                    <strong>
                      {selectedPrescription.diagnosis ||
                        "غير مسجل"}
                    </strong>
                  </div>

                  <div className="rx-detail-section">
                    <div className="rx-section-heading">
                      <span>
                        الأدوية
                      </span>

                      <b>
                        {
                          (
                            selectedPrescription.medicines ||
                            []
                          ).length
                        }
                      </b>
                    </div>

                    <div className="rx-side-medicines">
                      {(
                        selectedPrescription.medicines ||
                        []
                      ).map(
                        (
                          medicine,
                          index
                        ) => (
                          <div
                            className="rx-side-medicine"
                            key={
                              medicine.id ||
                              index
                            }
                          >
                            <span>
                              {String(
                                index + 1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </span>

                            <div>
                              <strong>
                                {
                                  medicine.name
                                }

                                {medicine.strength
                                  ? ` ${medicine.strength}`
                                  : ""}
                              </strong>

                              <small>
                                {[
                                  medicine.dose,
                                  medicine.frequency,
                                ]
                                  .filter(
                                    Boolean
                                  )
                                  .join(
                                    " • "
                                  )}
                              </small>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {selectedPrescription.visitId && (
                    <button
                      className="rx-open-visit"
                      onClick={
                        openVisit
                      }
                    >
                      <FileText
                        size={16}
                      />

                      <span>
                        فتح السجل الطبي
                      </span>

                      <ChevronLeft
                        size={16}
                      />
                    </button>
                  )}
                </aside>
              </div>
            </>
          )}
        </section>
      </main>

      {/* SETTINGS */}

      {settingsOpen && (
        <div className="rx-modal-layer">
          <button
            className="rx-modal-overlay"
            onClick={() =>
              setSettingsOpen(false)
            }
            aria-label="إغلاق"
          />

          <div className="rx-settings-panel">
            <header>
              <div>
                <span>
                  PRESCRIPTION
                  IDENTITY
                </span>

                <h2>
                  بيانات الروشتة
                </h2>

                <p>
                  البيانات المطبوعة
                  أعلى وأسفل الروشتة.
                </p>
              </div>

              <button
                className="rx-close"
                onClick={() =>
                  setSettingsOpen(
                    false
                  )
                }
              >
                <X size={19} />
              </button>
            </header>

            <div className="rx-settings-body">
              <SettingsField
                label="اسم العيادة"
                value={
                  settings.clinicName
                }
                onChange={(value) =>
                  updateSetting(
                    "clinicName",
                    value
                  )
                }
              />

              <SettingsField
                label="اسم الطبيب"
                value={
                  settings.doctorName
                }
                onChange={(value) =>
                  updateSetting(
                    "doctorName",
                    value
                  )
                }
              />

              <SettingsField
                label="التخصص"
                value={
                  settings.specialty
                }
                onChange={(value) =>
                  updateSetting(
                    "specialty",
                    value
                  )
                }
              />

              <SettingsField
                label="الدرجة العلمية"
                value={
                  settings.degree
                }
                onChange={(value) =>
                  updateSetting(
                    "degree",
                    value
                  )
                }
              />

              <SettingsField
                label="هاتف العيادة"
                value={
                  settings.phone
                }
                onChange={(value) =>
                  updateSetting(
                    "phone",
                    value
                  )
                }
              />

              <label className="rx-settings-field">
                <span>
                  عنوان العيادة
                </span>

                <textarea
                  value={
                    settings.address
                  }
                  onChange={(event) =>
                    updateSetting(
                      "address",
                      event.target
                        .value
                    )
                  }
                />
              </label>

              <SettingsField
                label="عبارة أسفل الروشتة"
                value={
                  settings.footerNote
                }
                onChange={(value) =>
                  updateSetting(
                    "footerNote",
                    value
                  )
                }
              />
            </div>

            <footer>
              <button
                className="rx-cancel"
                onClick={() =>
                  setSettingsOpen(
                    false
                  )
                }
              >
                إلغاء
              </button>

              <button
                className="rx-save"
                onClick={
                  saveSettings
                }
              >
                حفظ البيانات
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   ARCHIVE ROW
========================================================= */

function PrescriptionRow({
  prescription,
  active,
  onClick,
}) {
  return (
    <button
      className={`rx-row ${
        active ? "active" : ""
      }`}
      onClick={onClick}
    >
      <div className="rx-row-date">
        <strong>
          {new Date(
            prescription.createdAt ||
              Date.now()
          ).getDate()}
        </strong>

        <span>
          {new Intl.DateTimeFormat(
            "ar-EG",
            {
              month: "short",
            }
          ).format(
            new Date(
              prescription.createdAt ||
                Date.now()
            )
          )}
        </span>
      </div>

      <div className="rx-row-content">
        <strong>
          {prescription.patient.name}
        </strong>

        <span>
          {prescription.diagnosis ||
            "بدون تشخيص"}
        </span>

        <small>
          {formatTime(
            prescription.createdAt
          )}
          {" • "}
          {
            (
              prescription.medicines ||
              []
            ).length
          }{" "}
          دواء
        </small>
      </div>

      <ChevronLeft size={16} />
    </button>
  );
}

/* =========================================================
   PRESCRIPTION PAPER
========================================================= */

function PrescriptionPaper({
  prescription,
  settings,
}) {
  const medicines =
    prescription.medicines || [];

  const doctorName =
    prescription.doctorName ||
    settings.doctorName ||
    "الطبيب";

  return (
    <article
      id="prescription-paper"
      className="rx-real-paper"
    >
      <div className="rx-paper-top-line" />

      <header className="rx-paper-header">
        <div className="rx-paper-doctor">
          <span>DR.</span>

          <h2>{doctorName}</h2>

          {settings.specialty && (
            <strong>
              {settings.specialty}
            </strong>
          )}

          {settings.degree && (
            <small>
              {settings.degree}
            </small>
          )}
        </div>

        <div className="rx-paper-brand">
          <div className="rx-paper-logo">
            OMG
          </div>

          <h1>
            {settings.clinicName ||
              "OMG Clinic"}
          </h1>

          <span>
            MEDICAL CLINIC
          </span>
        </div>
      </header>

      <div className="rx-paper-rule">
        <span />
      </div>

      <section className="rx-paper-patient">
        <div>
          <span>
            Patient / المريض
          </span>

          <strong>
            {prescription.patient.name}
          </strong>
        </div>

        <div>
          <span>
            Age / السن
          </span>

          <strong>
            {prescription.patient.age ||
              "—"}
          </strong>
        </div>

        <div>
          <span>
            Date / التاريخ
          </span>

          <strong>
            {formatShortDate(
              prescription.createdAt
            )}
          </strong>
        </div>
      </section>

      <section className="rx-paper-diagnosis">
        <span>Diagnosis</span>

        <strong>
          {prescription.diagnosis ||
            "—"}
        </strong>
      </section>

      <section className="rx-paper-body">
        <div className="rx-rx-symbol">
          ℞
        </div>

        <div className="rx-paper-medicines">
          {medicines.length === 0 ? (
            <div className="rx-paper-empty">
              لا توجد أدوية مسجلة
            </div>
          ) : (
            medicines.map(
              (
                medicine,
                index
              ) => (
                <div
                  className="rx-paper-medicine"
                  key={
                    medicine.id ||
                    index
                  }
                >
                  <span className="rx-paper-number">
                    {String(
                      index + 1
                    ).padStart(
                      2,
                      "0"
                    )}
                  </span>

                  <div>
                    <h3>
                      {medicine.name}

                      {medicine.strength && (
                        <b>
                          {
                            medicine.strength
                          }
                        </b>
                      )}
                    </h3>

                    <p>
                      {[
                        medicine.dose,
                        medicine.frequency,
                        medicine.duration,
                      ]
                        .filter(
                          Boolean
                        )
                        .join(
                          " — "
                        )}
                    </p>

                    {medicine.instructions && (
                      <small>
                        {
                          medicine.instructions
                        }
                      </small>
                    )}
                  </div>
                </div>
              )
            )
          )}
        </div>
      </section>

      {(prescription.notes ||
        prescription.followUp) && (
        <section className="rx-paper-notes">
          {prescription.notes && (
            <div>
              <span>
                تعليمات الطبيب
              </span>

              <p>
                {
                  prescription.notes
                }
              </p>
            </div>
          )}

          {prescription.followUp && (
            <div className="rx-paper-followup">
              <CalendarDays
                size={12}
              />

              <span>
                المتابعة:
              </span>

              <strong>
                {
                  prescription.followUp
                }
              </strong>
            </div>
          )}
        </section>
      )}

      <div className="rx-paper-signature">
        <span>
          Doctor Signature
        </span>

        <strong>
          {doctorName}
        </strong>
      </div>

      <footer className="rx-paper-footer">
        <div>
          <Phone size={12} />

          <span>
            {settings.phone ||
              "هاتف العيادة"}
          </span>
        </div>

        <div>
          <MapPin size={12} />

          <span>
            {settings.address ||
              "عنوان العيادة"}
          </span>
        </div>

        <small>
          {settings.footerNote}
        </small>
      </footer>
    </article>
  );
}

/* =========================================================
   DETAILS
========================================================= */

function DetailRow({
  label,
  value,
}) {
  return (
    <div className="rx-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DetailIconRow({
  icon,
  label,
  value,
  sub,
}) {
  return (
    <div className="rx-icon-row">
      <div>{icon}</div>

      <span>
        <small>{label}</small>
        <strong>{value}</strong>

        {sub && <em>{sub}</em>}
      </span>
    </div>
  );
}

function SettingsField({
  label,
  value,
  onChange,
}) {
  return (
    <label className="rx-settings-field">
      <span>{label}</span>

      <input
        value={value || ""}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
      />
    </label>
  );
}