import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Clock3,
  FileText,
  HeartPulse,
  LoaderCircle,
  Pill,
  Printer,
  Search,
  SlidersHorizontal,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

import {
  subscribeClinicVisits,
} from "../../services/visitService";

import "./VisitPage.css";

/* =========================================================
   HELPERS
   ========================================================= */

function normalizeTimestamp(value) {
  if (typeof value === "number") {
    return value;
  }

  if (!value) {
    return 0;
  }

  const numeric = Number(value);

  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}

function startOfToday() {
  const date = new Date();

  date.setHours(
    0,
    0,
    0,
    0
  );

  return date.getTime();
}

function startOfDaysAgo(days) {
  const date = new Date();

  date.setHours(
    0,
    0,
    0,
    0
  );

  date.setDate(
    date.getDate() -
      days
  );

  return date.getTime();
}

function formatDate(value) {
  const timestamp =
    normalizeTimestamp(value);

  if (!timestamp) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(
    new Date(timestamp)
  );
}

function formatTime(value) {
  const timestamp =
    normalizeTimestamp(value);

  if (!timestamp) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(
    new Date(timestamp)
  );
}

function formatFullDate(value) {
  const timestamp =
    normalizeTimestamp(value);

  if (!timestamp) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(
    new Date(timestamp)
  );
}

function getInitials(name = "") {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (word) =>
        word[0]
    )
    .join("");
}

function getSourceLabel(source) {
  switch (source) {
    case "appointment":
      return "موعد";

    case "queue":
      return "قائمة الانتظار";

    case "walk-in":
      return "بدون حجز";

    case "direct":
      return "زيارة مباشرة";

    default:
      return "زيارة";
  }
}

function getVitals(visit) {
  return [
    {
      label: "الضغط",
      value:
        visit?.vitals
          ?.bloodPressure ||
        visit?.pressure,
      unit: "mmHg",
    },
    {
      label: "النبض",
      value:
        visit?.vitals
          ?.pulse ||
        visit?.pulse,
      unit: "bpm",
    },
    {
      label: "الحرارة",
      value:
        visit?.vitals
          ?.temperature ||
        visit?.temperature,
      unit: "°C",
    },
    {
      label: "الأكسجين",
      value:
        visit?.vitals
          ?.oxygen ||
        visit?.spo2,
      unit: "%",
    },
    {
      label: "الوزن",
      value:
        visit?.vitals
          ?.weight ||
        visit?.weight,
      unit: "kg",
    },
  ].filter(
    (item) =>
      item.value !== undefined &&
      item.value !== null &&
      item.value !== ""
  );
}

function normalizeMedicines(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (
    typeof value ===
    "object"
  ) {
    return Object.values(
      value
    ).filter(Boolean);
  }

  return [];
}

/* =========================================================
   PAGE
   ========================================================= */

export default function VisitsPage() {
  const navigate =
    useNavigate();

  const { clinicId } =
    useAuth();

  const [
    visits,
    setVisits,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    period,
    setPeriod,
  ] = useState("today");

  const [
    doctorFilter,
    setDoctorFilter,
  ] = useState("all");

  const [
    selectedVisit,
    setSelectedVisit,
  ] = useState(null);

  /* =======================================================
     REALTIME
     ======================================================= */

  useEffect(() => {
    if (!clinicId) {
      return;
    }

    setLoading(true);
    setError("");

    const unsubscribe =
      subscribeClinicVisits(
        clinicId,

        (data) => {
          setVisits(data);
          setLoading(false);
        },

        (firebaseError) => {
          console.error(
            "Visits realtime error:",
            firebaseError
          );

          setError(
            "تعذر تحميل سجل الزيارات."
          );

          setLoading(false);
        }
      );

    return () =>
      unsubscribe?.();
  }, [clinicId]);

  /* =======================================================
     DOCTORS
     ======================================================= */

  const doctors =
    useMemo(() => {
      const map =
        new Map();

      visits.forEach(
        (visit) => {
          if (
            visit.doctorId ||
            visit.doctorName
          ) {
            const key =
              visit.doctorId ||
              visit.doctorName;

            if (
              !map.has(key)
            ) {
              map.set(key, {
                id: key,

                name:
                  visit.doctorName ||
                  "طبيب",
              });
            }
          }
        }
      );

      return Array.from(
        map.values()
      ).sort((a, b) =>
        a.name.localeCompare(
          b.name,
          "ar"
        )
      );
    }, [visits]);

  /* =======================================================
     FILTER
     ======================================================= */

  const filteredVisits =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      const today =
        startOfToday();

      const week =
        startOfDaysAgo(6);

      const month =
        startOfDaysAgo(29);

      return visits.filter(
        (visit) => {
          const timestamp =
            normalizeTimestamp(
              visit.completedAt ||
                visit.createdAt
            );

          if (
            period === "today" &&
            timestamp < today
          ) {
            return false;
          }

          if (
            period === "week" &&
            timestamp < week
          ) {
            return false;
          }

          if (
            period === "month" &&
            timestamp < month
          ) {
            return false;
          }

          if (
            doctorFilter !==
              "all" &&
            String(
              visit.doctorId ||
                visit.doctorName
            ) !==
              String(
                doctorFilter
              )
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const medicines =
            normalizeMedicines(
              visit.medicines
            );

          const searchable = [
            visit.patientName,
            visit.patientCode,
            visit.doctorName,
            visit.diagnosis,
            visit.complaint,
            ...medicines.map(
              (medicine) =>
                medicine.name
            ),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchable.includes(
            query
          );
        }
      );
    }, [
      visits,
      search,
      period,
      doctorFilter,
    ]);

  /* =======================================================
     TODAY OPERATING LINE
     ======================================================= */

  const todayStats =
    useMemo(() => {
      const today =
        startOfToday();

      const todayVisits =
        visits.filter(
          (visit) =>
            normalizeTimestamp(
              visit.completedAt ||
                visit.createdAt
            ) >= today
        );

      const patients =
        new Set(
          todayVisits
            .map(
              (visit) =>
                visit.patientId
            )
            .filter(Boolean)
        );

      const doctorsSet =
        new Set(
          todayVisits
            .map(
              (visit) =>
                visit.doctorId ||
                visit.doctorName
            )
            .filter(Boolean)
        );

      const medicines =
        todayVisits.reduce(
          (total, visit) =>
            total +
            normalizeMedicines(
              visit.medicines
            ).length,
          0
        );

      return {
        visits:
          todayVisits.length,

        patients:
          patients.size,

        doctors:
          doctorsSet.size,

        prescriptions:
          todayVisits.filter(
            (visit) =>
              visit.prescriptionId ||
              normalizeMedicines(
                visit.medicines
              ).length > 0
          ).length,

        medicines,
      };
    }, [visits]);

  /* =======================================================
     LOADING
     ======================================================= */

  if (loading) {
    return (
      <div className="visits-page-state">
        <LoaderCircle
          size={26}
          className="visits-spinner"
        />

        <strong>
          جاري تحميل سجل الزيارات
        </strong>

        <span>
          يتم قراءة زيارات العيادة...
        </span>
      </div>
    );
  }

  /* =======================================================
     UI
     ======================================================= */

  return (
    <div className="visits-page">
      {/* PAGE HEADER */}

      <header className="visits-header">
        <div>
          <span className="visits-overline">
            MEDICAL RECORD
          </span>

          <h1>
            سجل الزيارات
          </h1>

          <p>
            السجل الطبي التشغيلي لجميع الزيارات التي تم إتمامها داخل العيادة.
          </p>
        </div>

        <div className="visits-realtime">
          <span />

          البيانات محدثة مباشرة
        </div>
      </header>

      {/* TODAY LINE */}

      <section className="visits-today-line">
        <div className="today-line-title">
          <span>
            اليوم
          </span>

          <strong>
            {
              todayStats.visits
            }{" "}
            زيارة مكتملة
          </strong>
        </div>

        <div className="today-line-data">
          <span>
            <UserRound
              size={14}
            />

            {
              todayStats.patients
            }{" "}
            مريض
          </span>

          <span>
            <Stethoscope
              size={14}
            />

            {
              todayStats.doctors
            }{" "}
            طبيب
          </span>

          <span>
            <FileText
              size={14}
            />

            {
              todayStats.prescriptions
            }{" "}
            روشتة
          </span>

          <span>
            <Pill
              size={14}
            />

            {
              todayStats.medicines
            }{" "}
            دواء موصوف
          </span>
        </div>
      </section>

      {/* ERROR */}

      {error && (
        <div className="visits-error">
          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* TOOLBAR */}

      <section className="visits-toolbar">
        <div className="visits-search">
          <Search size={17} />

          <input
            value={search}
            onChange={(
              event
            ) =>
              setSearch(
                event.target
                  .value
              )
            }
            placeholder="اسم المريض، رقم الملف، التشخيص أو الدواء..."
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                setSearch("")
              }
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="visits-filters">
          <div className="period-switch">
            <button
              type="button"
              className={
                period ===
                "today"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setPeriod(
                  "today"
                )
              }
            >
              اليوم
            </button>

            <button
              type="button"
              className={
                period ===
                "week"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setPeriod(
                  "week"
                )
              }
            >
              7 أيام
            </button>

            <button
              type="button"
              className={
                period ===
                "month"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setPeriod(
                  "month"
                )
              }
            >
              30 يوم
            </button>

            <button
              type="button"
              className={
                period ===
                "all"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setPeriod(
                  "all"
                )
              }
            >
              الكل
            </button>
          </div>

          <label className="doctor-filter">
            <SlidersHorizontal
              size={15}
            />

            <select
              value={
                doctorFilter
              }
              onChange={(
                event
              ) =>
                setDoctorFilter(
                  event.target
                    .value
                )
              }
            >
              <option value="all">
                كل الأطباء
              </option>

              {doctors.map(
                (doctor) => (
                  <option
                    key={
                      doctor.id
                    }
                    value={
                      doctor.id
                    }
                  >
                    {
                      doctor.name
                    }
                  </option>
                )
              )}
            </select>
          </label>
        </div>
      </section>

      {/* RECORD HEADER */}

      <div className="visits-record-heading">
        <div>
          <ClipboardList
            size={17}
          />

          <strong>
            الزيارات المكتملة
          </strong>

          <span>
            {
              filteredVisits.length
            }
          </span>
        </div>

        <small>
          اضغط على أي زيارة لعرض الملف الطبي الكامل
        </small>
      </div>

      {/* VISITS */}

      {filteredVisits.length ===
      0 ? (
        <div className="visits-empty">
          <span>
            <ClipboardList
              size={28}
            />
          </span>

          <strong>
            لا توجد زيارات مطابقة
          </strong>

          <p>
            لم يتم العثور على زيارات ضمن الفترة أو البحث المحدد.
          </p>

          {(search ||
            period !==
              "all" ||
            doctorFilter !==
              "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPeriod("all");
                setDoctorFilter(
                  "all"
                );
              }}
            >
              عرض كل الزيارات
            </button>
          )}
        </div>
      ) : (
        <div className="visits-record">
          <div className="visits-record-header">
            <span>
              التاريخ
            </span>

            <span>
              المريض
            </span>

            <span>
              الطبيب
            </span>

            <span>
              الشكوى
            </span>

            <span>
              التشخيص
            </span>

            <span>
              العلاج
            </span>

            <span />
          </div>

          <div className="visits-record-body">
            {filteredVisits.map(
              (visit) => (
                <VisitRow
                  key={
                    visit.id
                  }
                  visit={
                    visit
                  }
                  onOpen={() =>
                    setSelectedVisit(
                      visit
                    )
                  }
                />
              )
            )}
          </div>
        </div>
      )}

      {/* DRAWER */}

      {selectedVisit && (
        <VisitDrawer
          visit={
            selectedVisit
          }
          onClose={() =>
            setSelectedVisit(
              null
            )
          }
          onPatient={() =>
            navigate(
              `/patients/${selectedVisit.patientId}`
            )
          }
        />
      )}
    </div>
  );
}

/* =========================================================
   ROW
   ========================================================= */

function VisitRow({
  visit,
  onOpen,
}) {
  const medicines =
    normalizeMedicines(
      visit.medicines
    );

  const timestamp =
    visit.completedAt ||
    visit.createdAt;

  return (
    <button
      type="button"
      className="visit-record-row"
      onClick={onOpen}
    >
      <div className="record-date">
        <strong>
          {formatDate(
            timestamp
          )}
        </strong>

        <span>
          <Clock3
            size={12}
          />

          {formatTime(
            timestamp
          )}
        </span>
      </div>

      <div className="record-patient">
        <span className="record-avatar">
          {getInitials(
            visit.patientName
          )}
        </span>

        <span>
          <strong>
            {visit.patientName ||
              "مريض"}
          </strong>

          <small>
            {visit.patientCode ||
              "بدون رقم ملف"}
          </small>
        </span>
      </div>

      <div className="record-doctor">
        <Stethoscope
          size={14}
        />

        <span>
          {visit.doctorName ||
            "غير محدد"}
        </span>
      </div>

      <div className="record-text">
        {visit.complaint ? (
          <span>
            {visit.complaint}
          </span>
        ) : (
          <em>
            غير مسجلة
          </em>
        )}
      </div>

      <div className="record-diagnosis">
        {visit.diagnosis ? (
          <strong>
            {visit.diagnosis}
          </strong>
        ) : (
          <em>
            بدون تشخيص
          </em>
        )}
      </div>

      <div className="record-treatment">
        {medicines.length >
        0 ? (
          <>
            <Pill
              size={14}
            />

            <span>
              {
                medicines.length
              }{" "}
              دواء
            </span>
          </>
        ) : (
          <span className="no-treatment">
            بدون أدوية
          </span>
        )}
      </div>

      <div className="record-open">
        <ChevronLeft
          size={17}
        />
      </div>
    </button>
  );
}

/* =========================================================
   DRAWER
   ========================================================= */

function VisitDrawer({
  visit,
  onClose,
  onPatient,
}) {
  const medicines =
    normalizeMedicines(
      visit.medicines
    );

  const vitals =
    getVitals(visit);

  const timestamp =
    visit.completedAt ||
    visit.createdAt;

  const handlePrint =
    () => {
      window.print();
    };

  return (
    <div className="visit-drawer-layer">
      <button
        type="button"
        className="visit-drawer-backdrop"
        onClick={onClose}
      />

      <aside className="visit-details-drawer">
        {/* HEADER */}

        <header className="visit-drawer-header">
          <div>
            <span>
              MEDICAL VISIT
            </span>

            <h2>
              تفاصيل الزيارة
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        {/* PATIENT */}

        <div className="visit-drawer-patient">
          <span className="drawer-patient-avatar">
            {getInitials(
              visit.patientName
            )}
          </span>

          <div>
            <h3>
              {visit.patientName ||
                "المريض"}
            </h3>

            <p>
              {visit.patientCode ||
                "بدون رقم ملف"}
            </p>
          </div>

          <button
            type="button"
            onClick={
              onPatient
            }
          >
            فتح الملف

            <ChevronLeft
              size={14}
            />
          </button>
        </div>

        {/* META */}

        <div className="visit-meta-line">
          <span>
            <CalendarDays
              size={14}
            />

            {formatFullDate(
              timestamp
            )}
          </span>

          <span>
            <Stethoscope
              size={14}
            />

            {visit.doctorName ||
              "طبيب غير محدد"}
          </span>

          <span>
            <Activity
              size={14}
            />

            {getSourceLabel(
              visit.source
            )}
          </span>
        </div>

        <div className="visit-drawer-scroll">
          {/* COMPLAINT */}

          <MedicalSection
            title="الشكوى والتاريخ المرضي"
          >
            <MedicalField
              label="الشكوى الرئيسية"
              value={
                visit.complaint
              }
            />

            {visit.duration && (
              <MedicalField
                label="مدة الأعراض"
                value={
                  visit.duration
                }
              />
            )}

            {visit.history && (
              <MedicalField
                label="التاريخ الحالي للحالة"
                value={
                  visit.history
                }
                wide
              />
            )}
          </MedicalSection>

          {/* VITALS */}

          {vitals.length >
            0 && (
            <MedicalSection
              title="العلامات الحيوية"
            >
              <div className="drawer-vitals">
                {vitals.map(
                  (vital) => (
                    <div
                      key={
                        vital.label
                      }
                    >
                      <span>
                        {
                          vital.label
                        }
                      </span>

                      <strong>
                        {
                          vital.value
                        }
                      </strong>

                      <small>
                        {
                          vital.unit
                        }
                      </small>
                    </div>
                  )
                )}
              </div>
            </MedicalSection>
          )}

          {/* EXAMINATION */}

          <MedicalSection
            title="الفحص والتشخيص"
          >
            {visit.examination && (
              <MedicalField
                label="الفحص السريري"
                value={
                  visit.examination
                }
                wide
              />
            )}

            <div className="drawer-diagnosis">
              <span>
                التشخيص
              </span>

              <strong>
                {visit.diagnosis ||
                  "غير مسجل"}
              </strong>
            </div>

            {visit.notes && (
              <MedicalField
                label="ملاحظات الطبيب"
                value={
                  visit.notes
                }
                wide
              />
            )}
          </MedicalSection>

          {/* TREATMENT */}

          <MedicalSection
            title="العلاج"
          >
            {medicines.length >
            0 ? (
              <div className="drawer-medicines">
                {medicines.map(
                  (
                    medicine,
                    index
                  ) => (
                    <div
                      className="drawer-medicine"
                      key={
                        medicine.id ||
                        `${medicine.name}-${index}`
                      }
                    >
                      <span className="drawer-medicine-number">
                        {index + 1}
                      </span>

                      <div className="drawer-medicine-main">
                        <strong>
                          {medicine.name}

                          {medicine.strength
                            ? ` ${medicine.strength}`
                            : ""}
                        </strong>

                        {(medicine.generic ||
                          medicine.activeIngredient) && (
                          <small>
                            {medicine.generic ||
                              medicine.activeIngredient}
                          </small>
                        )}

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
                              " · "
                            )}
                        </p>

                        {medicine.instructions && (
                          <em>
                            {
                              medicine.instructions
                            }
                          </em>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="drawer-no-treatment">
                لم يتم تسجيل أدوية في هذه الزيارة.
              </div>
            )}

            {visit.prescriptionNotes && (
              <MedicalField
                label="تعليمات العلاج"
                value={
                  visit.prescriptionNotes
                }
                wide
              />
            )}

            {visit.followUp && (
              <div className="drawer-follow-up">
                <CalendarDays
                  size={16}
                />

                <span>
                  المتابعة
                </span>

                <strong>
                  {
                    visit.followUp
                  }
                </strong>
              </div>
            )}
          </MedicalSection>
        </div>

        {/* FOOTER */}

        <footer className="visit-drawer-footer">
          <div>
            <span>
              Visit ID
            </span>

            <strong>
              {visit.id}
            </strong>
          </div>

          <button
            type="button"
            onClick={
              handlePrint
            }
          >
            <Printer
              size={15}
            />

            طباعة
          </button>
        </footer>
      </aside>
    </div>
  );
}

/* =========================================================
   MEDICAL SECTION
   ========================================================= */

function MedicalSection({
  title,
  children,
}) {
  return (
    <section className="medical-section">
      <h4>
        {title}
      </h4>

      <div className="medical-section-content">
        {children}
      </div>
    </section>
  );
}

function MedicalField({
  label,
  value,
  wide = false,
}) {
  if (!value) {
    return null;
  }

  return (
    <div
      className={`medical-field ${
        wide
          ? "medical-field-wide"
          : ""
      }`}
    >
      <span>
        {label}
      </span>

      <p>
        {value}
      </p>
    </div>
  );
}