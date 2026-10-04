import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  Clock3,
  FileText,
  FlaskConical,
  HeartPulse,
  LoaderCircle,
  MapPin,
  Phone,
  Pill,
  Plus,
  Stethoscope,
  UserRound,
  CheckCircle2,
  X,
  Activity,
  CreditCard,
  ClipboardList,
  History,
  Image,
  ShieldAlert,
  WalletCards,
} from "lucide-react";

import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  useAuth,
} from "../../context/AuthContext";

import {
  subscribeToPatient,
} from "../../services/patientService";

import {
  subscribeToPatientChart,
} from "../../services/patientChartService";

import {
  subscribePatientVisits,
  subscribePatientPrescriptions,
} from "../../services/visitService";

import { subscribeDentalTwin, buildDentalInsights } from "../../services/dentalService";
import Dental3DViewer from "../visits/Dental3DViewer";

import "./PatientProfilePage.css";

/* ======================================================
   CONSTANTS
   ====================================================== */

const EMPTY_CHART = {
  visits: [],
  prescriptions: [],
  medicalFiles: [],
  appointments: [],
  latestVisit: null,
  upcomingAppointment: null,
};

/* ======================================================
   HELPERS
   ====================================================== */

function calculateAge(
  dateOfBirth
) {
  if (!dateOfBirth) {
    return null;
  }

  const birth =
    new Date(dateOfBirth);

  if (
    Number.isNaN(
      birth.getTime()
    )
  ) {
    return null;
  }

  const today =
    new Date();

  let age =
    today.getFullYear() -
    birth.getFullYear();

  const month =
    today.getMonth() -
    birth.getMonth();

  if (
    month < 0 ||
    (
      month === 0 &&
      today.getDate() <
        birth.getDate()
    )
  ) {
    age--;
  }

  return Math.max(
    age,
    0
  );
}

function formatDate(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(date);
}

function formatTime(
  value
) {
  if (!value) {
    return "";
  }

  if (
    typeof value === "string" &&
    /^\d{1,2}:\d{2}/.test(
      value
    )
  ) {
    return value;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}

function getInitials(
  name = ""
) {
  const parts =
    String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (!parts.length) {
    return "؟";
  }

  return parts
    .slice(0, 2)
    .map(
      (part) =>
        part[0]
    )
    .join("");
}

function genderLabel(
  gender
) {
  if (
    gender === "male" ||
    gender === "ذكر"
  ) {
    return "ذكر";
  }

  if (
    gender === "female" ||
    gender === "أنثى"
  ) {
    return "أنثى";
  }

  return "";
}

function normalizeArray(
  value
) {
  if (!value) {
    return [];
  }

  if (
    Array.isArray(value)
  ) {
    return value.filter(
      Boolean
    );
  }

  if (
    typeof value ===
    "object"
  ) {
    return Object.values(
      value
    ).filter(Boolean);
  }

  return [value];
}

function getEmergencyPhone(
  emergencyContact
) {
  if (!emergencyContact) {
    return "";
  }

  if (
    typeof emergencyContact ===
    "string"
  ) {
    return emergencyContact;
  }

  if (
    typeof emergencyContact ===
    "object"
  ) {
    return (
      emergencyContact.phone ||
      emergencyContact.mobile ||
      ""
    );
  }

  return "";
}

function getEmergencyName(
  emergencyContact
) {
  if (
    !emergencyContact ||
    typeof emergencyContact !==
      "object"
  ) {
    return "";
  }

  return (
    emergencyContact.name ||
    ""
  );
}

function getEmergencyRelation(
  emergencyContact
) {
  if (
    !emergencyContact ||
    typeof emergencyContact !==
      "object"
  ) {
    return "";
  }

  return (
    emergencyContact.relation ||
    ""
  );
}

/* ======================================================
   PAGE
   ====================================================== */

export default function PatientProfilePage() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const {
    patientId,
  } = useParams();

  const {
    clinicId,
  } = useAuth();

  const [
    patient,
    setPatient,
  ] = useState(null);

  /*
   * patientChartService is still responsible
   * for appointments + medical files.
   *
   * Visits and prescriptions are loaded
   * separately from visitService.
   */
  const [
    baseChart,
    setBaseChart,
  ] = useState(
    EMPTY_CHART
  );

  const [
    visits,
    setVisits,
  ] = useState([]);

  const [
    prescriptions,
    setPrescriptions,
  ] = useState([]);

  const [
    activeTab,
    setActiveTab,
  ] = useState(
    "summary"
  );

  const [dentalTwin, setDentalTwin] = useState(null);

  const [
    patientLoading,
    setPatientLoading,
  ] = useState(true);

  const [
    chartLoading,
    setChartLoading,
  ] = useState(true);

  const [
    visitsLoading,
    setVisitsLoading,
  ] = useState(true);

  const [
    prescriptionsLoading,
    setPrescriptionsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    visitSuccess,
    setVisitSuccess,
  ] = useState(
    Boolean(
      location.state
        ?.visitCompleted
    )
  );

  /* ======================================================
     PATIENT REALTIME
     ====================================================== */

  useEffect(() => {
    if (
      !clinicId ||
      !patientId
    ) {
      return;
    }

    setPatientLoading(
      true
    );

    setError("");

    const unsubscribe =
      subscribeToPatient(
        clinicId,
        patientId,

        (data) => {
          setPatient(data);

          setPatientLoading(
            false
          );
        },

        (subscriptionError) => {
          console.error(
            "Patient realtime error:",
            subscriptionError
          );

          setError(
            "تعذر قراءة ملف المريض."
          );

          setPatientLoading(
            false
          );
        }
      );

    return () => {
      unsubscribe?.();
    };
  }, [
    clinicId,
    patientId,
  ]);

  /* ======================================================
     APPOINTMENTS + FILES
     ====================================================== */

  useEffect(() => {
    if (
      !clinicId ||
      !patientId
    ) {
      return;
    }

    setChartLoading(
      true
    );

    const unsubscribe =
      subscribeToPatientChart(
        clinicId,
        patientId,

        (data) => {
          setBaseChart({
            ...EMPTY_CHART,
            ...data,
          });

          setChartLoading(
            false
          );
        },

        (subscriptionError) => {
          console.error(
            "Patient chart realtime error:",
            subscriptionError
          );

          setChartLoading(
            false
          );
        }
      );

    return () => {
      unsubscribe?.();
    };
  }, [
    clinicId,
    patientId,
  ]);

  /* ======================================================
     VISITS REALTIME
     ====================================================== */

  useEffect(() => {
    if (
      !clinicId ||
      !patientId
    ) {
      return;
    }

    setVisitsLoading(
      true
    );

    const unsubscribe =
      subscribePatientVisits(
        clinicId,
        patientId,

        (data) => {
          setVisits(
            Array.isArray(data)
              ? data
              : []
          );

          setVisitsLoading(
            false
          );
        },

        (subscriptionError) => {
          console.error(
            "Patient visits realtime error:",
            subscriptionError
          );

          setVisits([]);

          setVisitsLoading(
            false
          );
        }
      );

    return () => {
      unsubscribe?.();
    };
  }, [
    clinicId,
    patientId,
  ]);

  /* ======================================================
     PRESCRIPTIONS REALTIME
     ====================================================== */

  useEffect(() => {
    if (
      !clinicId ||
      !patientId
    ) {
      return;
    }

    setPrescriptionsLoading(
      true
    );

    const unsubscribe =
      subscribePatientPrescriptions(
        clinicId,
        patientId,

        (data) => {
          setPrescriptions(
            Array.isArray(data)
              ? data
              : []
          );

          setPrescriptionsLoading(
            false
          );
        },

        (subscriptionError) => {
          console.error(
            "Patient prescriptions realtime error:",
            subscriptionError
          );

          setPrescriptions([]);

          setPrescriptionsLoading(
            false
          );
        }
      );

    return () => {
      unsubscribe?.();
    };
  }, [
    clinicId,
    patientId,
  ]);

  useEffect(() => {
    if (!clinicId || !patientId) return;
    return subscribeDentalTwin(
      clinicId,
      patientId,
      setDentalTwin,
      (subscriptionError) => console.error("Patient dental twin error:", subscriptionError)
    );
  }, [clinicId, patientId]);

  /* ======================================================
     SUCCESS MESSAGE
     ====================================================== */

  useEffect(() => {
    if (!visitSuccess) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          setVisitSuccess(
            false
          );

          navigate(
            `/patients/${patientId}`,
            {
              replace: true,
              state: {},
            }
          );
        },
        4500
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    visitSuccess,
    navigate,
    patientId,
  ]);

  /* ======================================================
     DERIVED CHART
     ====================================================== */

  const chart =
    useMemo(
      () => ({
        ...EMPTY_CHART,
        ...baseChart,

        visits,

        prescriptions,

        latestVisit:
          visits.length > 0
            ? visits[0]
            : null,
      }),
      [
        baseChart,
        visits,
        prescriptions,
      ]
    );

  const age =
    useMemo(
      () =>
        calculateAge(
          patient?.dateOfBirth
        ),
      [
        patient
          ?.dateOfBirth,
      ]
    );

  const allergies =
    normalizeArray(
      patient?.allergies
    );

  const chronicDiseases =
    normalizeArray(
      patient
        ?.chronicDiseases
    );

  const currentMedications =
    normalizeArray(
      patient
        ?.currentMedications
    );

  const tabs = [
    { id: "summary", label: "نظرة عامة" },
    { id: "timeline", label: "السجل الطبي", count: chart.visits.length + chart.prescriptions.length + chart.medicalFiles.length },
    { id: "visits", label: "الكشوفات", count: chart.visits.length },
    { id: "prescriptions", label: "الروشتات", count: chart.prescriptions.length },
    { id: "files", label: "التحاليل والأشعة", count: chart.medicalFiles.length },
    { id: "appointments", label: "المواعيد", count: chart.appointments.length },
    ...(dentalTwin ? [{ id: "dental", label: "ملف الأسنان" }] : []),
  ];

  const loadingChart =
    chartLoading ||
    visitsLoading ||
    prescriptionsLoading;

  /* ======================================================
     PATIENT LOADING
     ====================================================== */

  if (
    patientLoading
  ) {
    return (
      <div className="patient-chart-page">
        <div className="patient-chart-state">
          <LoaderCircle
            size={25}
            className="patient-chart-loader"
          />

          <strong>
            جاري فتح ملف المريض
          </strong>

          <span>
            يتم قراءة البيانات...
          </span>
        </div>
      </div>
    );
  }

  /* ======================================================
     PATIENT ERROR
     ====================================================== */

  if (
    error ||
    !patient
  ) {
    return (
      <div className="patient-chart-page">
        <div className="patient-chart-state">
          <UserRound
            size={27}
          />

          <strong>
            ملف المريض غير متاح
          </strong>

          <span>
            {error ||
              "لم يتم العثور على هذا المريض."}
          </span>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/patients"
              )
            }
          >
            العودة للمرضى
          </button>
        </div>
      </div>
    );
  }

  /* ======================================================
     UI
     ====================================================== */

  return (
    <div className="patient-chart-page">

      {/* ================================================
          VISIT SUCCESS
          ================================================ */}

      {visitSuccess && (
        <div className="patient-visit-success">
          <div className="patient-visit-success-icon">
            <CheckCircle2
              size={19}
            />
          </div>

          <div className="patient-visit-success-copy">
            <strong>
              تم إنهاء الكشف بنجاح
            </strong>

            <span>
              تم حفظ الزيارة
              والروشتة داخل الملف
              الطبي للمريض.
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setVisitSuccess(
                false
              );

              navigate(
                `/patients/${patientId}`,
                {
                  replace: true,
                  state: {},
                }
              );
            }}
            aria-label="إغلاق"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* ================================================
          BACK
          ================================================ */}

      <button
        type="button"
        className="chart-back"
        onClick={() =>
          navigate(
            "/patients"
          )
        }
      >
        <ArrowRight
          size={16}
        />

        المرضى
      </button>

      {/* ================================================
          PATIENT HEADER
          ================================================ */}

      <header className="chart-patient-header">
        <div className="chart-patient-identity">
          <span className="chart-avatar">
            {getInitials(
              patient.name
            )}
          </span>

          <div className="chart-patient-copy">
            <div className="chart-name-row">
              <h1>
                {patient.name}
              </h1>

              <span className="chart-file-code">
                {patient.patientCode ||
                  "بدون رقم ملف"}
              </span>
            </div>

            <div className="chart-demographics">
              {age !== null && (
                <span>
                  {age} سنة
                </span>
              )}

              {patient.gender && (
                <>
                  <i />

                  <span>
                    {genderLabel(
                      patient.gender
                    )}
                  </span>
                </>
              )}

              {patient.bloodType && (
                <>
                  <i />

                  <span>
                    فصيلة الدم{" "}
                    <b>
                      {
                        patient
                          .bloodType
                      }
                    </b>
                  </span>
                </>
              )}
            </div>

            <div className="chart-contact">
              {patient.phone && (
                <span>
                  <Phone
                    size={14}
                  />

                  <b dir="ltr">
                    {
                      patient.phone
                    }
                  </b>
                </span>
              )}

              {patient.address && (
                <span>
                  <MapPin
                    size={14}
                  />

                  {
                    patient.address
                  }
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="chart-start-visit"
          onClick={() =>
            navigate(
              `/patients/${patient.id}/visit/new`
            )
          }
        >
          <Stethoscope
            size={17}
          />

          بدء زيارة
        </button>
      </header>

      {/* ================================================
          MEDICAL FLAGS
          ================================================ */}

      {(
        allergies.length > 0 ||
        chronicDiseases.length >
          0 ||
        currentMedications.length >
          0
      ) && (
        <section className="chart-flags">

          {allergies.length >
            0 && (
            <div className="chart-flag chart-flag-danger">
              <AlertTriangle
                size={15}
              />

              <span>
                حساسية
              </span>

              <strong>
                {allergies.join(
                  "، "
                )}
              </strong>
            </div>
          )}

          {chronicDiseases.length >
            0 && (
            <div className="chart-flag">
              <HeartPulse
                size={15}
              />

              <span>
                أمراض مزمنة
              </span>

              <strong>
                {chronicDiseases.join(
                  "، "
                )}
              </strong>
            </div>
          )}

          {currentMedications.length >
            0 && (
            <div className="chart-flag">
              <Pill
                size={15}
              />

              <span>
                علاج حالي
              </span>

              <strong>
                {currentMedications.join(
                  "، "
                )}
              </strong>
            </div>
          )}

        </section>
      )}

      {/* ================================================
          TABS
          ================================================ */}

      <nav className="chart-tabs">
        {tabs.map(
          (tab) => (
            <button
              type="button"
              key={tab.id}
              className={
                activeTab ===
                tab.id
                  ? "chart-tab chart-tab-active"
                  : "chart-tab"
              }
              onClick={() =>
                setActiveTab(
                  tab.id
                )
              }
            >
              {tab.label}

              {typeof tab.count ===
                "number" &&
                tab.count > 0 && (
                  <span>
                    {tab.count}
                  </span>
                )}
            </button>
          )
        )}
      </nav>

      {/* ================================================
          CONTENT
          ================================================ */}

      <main className="chart-content">

        {loadingChart ? (
          <div className="chart-inline-loading">
            <LoaderCircle
              size={20}
              className="patient-chart-loader"
            />

            جاري تحميل السجل
            الطبي...
          </div>
        ) : (
          <>
            {activeTab ===
              "summary" && (
              <SummaryTab patient={patient} chart={chart} navigate={navigate} dentalTwin={dentalTwin} />
            )}

            {activeTab ===
              "visits" && (
              <VisitsTab
                patient={
                  patient
                }
                visits={
                  chart.visits
                }
                navigate={
                  navigate
                }
              />
            )}

            {activeTab ===
              "prescriptions" && (
              <PrescriptionsTab
                prescriptions={
                  chart.prescriptions
                }
              />
            )}

            {activeTab ===
              "files" && (
              <FilesTab
                files={
                  chart.medicalFiles
                }
              />
            )}

            {activeTab === "timeline" && (
              <PatientTimeline chart={chart} />
            )}

            {activeTab === "appointments" && (
              <AppointmentsTab appointments={chart.appointments} />
            )}

            {activeTab === "dental" && dentalTwin && (
              <PatientDentalRecord twin={dentalTwin} />
            )}
          </>
        )}

      </main>
    </div>
  );
}

/* ======================================================
   SUMMARY
   ====================================================== */

function SummaryTab({
  patient,
  chart,
  navigate,
  dentalTwin,
}) {
  const latest =
    chart.latestVisit;

  const latestVitals = latest?.vitals || {};
  const openFiles = chart.medicalFiles.filter(file => !["reviewed","completed"].includes(file.status)).length;
  const completedAppointments = chart.appointments.filter(item => item.status === "completed").length;
  const totalVisitValue = chart.visits.reduce((sum, visit) => sum + (Number(visit.visitPrice || visit.servicePrice) || 0), 0);
  const dentalInsights = buildDentalInsights(dentalTwin);

  return (
    <>
    <section className="patient-command-strip">
      <div><span>آخر زيارة</span><strong>{latest ? formatDate(latest.completedAt || latest.createdAt) : "لا توجد"}</strong><small>{latest?.doctorName || "—"}</small></div>
      <div><span>إجمالي الكشوفات</span><strong>{chart.visits.length}</strong><small>{completedAppointments} موعد مكتمل</small></div>
      <div><span>طلبات طبية مفتوحة</span><strong>{openFiles}</strong><small>تحاليل / أشعة / ملفات</small></div>
      <div><span>قيمة الكشوفات المسجلة</span><strong>{totalVisitValue.toLocaleString("ar-EG")} ج.م</strong><small>لا تشمل خطط العلاج</small></div>
      {dentalTwin && <div><span>خطة الأسنان المتبقية</span><strong>{dentalInsights.remaining.toLocaleString("ar-EG")} ج.م</strong><small>{dentalInsights.openPlans} إجراء مفتوح</small></div>}
    </section>

    <div className="chart-summary">

      <section className="chart-main-column">

        <div className="chart-section-heading">
          <div>
            <span>
              CLINICAL SUMMARY
            </span>

            <h2>
              آخر زيارة
            </h2>
          </div>

          {latest && (
            <time>
              {formatDate(
                latest.completedAt ||
                  latest.createdAt ||
                  latest.visitDate
              )}
            </time>
          )}
        </div>

        {!latest ? (
          <div className="new-patient-empty">
            <Stethoscope
              size={27}
            />

            <strong>
              لا يوجد تاريخ طبي حتى
              الآن
            </strong>

            <p>
              هذا ملف مريض جديد ولم
              يتم تسجيل زيارة له.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate(
                  `/patients/${patient.id}/visit/new`
                )
              }
            >
              <Plus
                size={16}
              />

              بدء أول زيارة
            </button>
          </div>
        ) : (
          <LatestVisit
            visit={latest}
          />
        )}

      </section>

      <aside className="chart-side-column">

        <NextAppointment
          appointment={
            chart.upcomingAppointment
          }
          navigate={
            navigate
          }
        />

        <PatientFacts
          patient={
            patient
          }
          visitsCount={
            chart.visits.length
          }
          prescriptionsCount={
            chart.prescriptions
              .length
          }
        />

        <RecentFiles
          files={
            chart.medicalFiles
          }
        />

      </aside>

    </div>

    <section className="clinical-overview-ledger">
      <div className="ledger-title"><div><Activity size={16}/><span>آخر قياسات مسجلة</span></div><small>من آخر كشف</small></div>
      <div className="ledger-vitals">
        <Vital label="الضغط" value={latestVitals.bloodPressure || latestVitals.pressure} />
        <Vital label="النبض" value={latestVitals.pulse} />
        <Vital label="الحرارة" value={latestVitals.temperature} />
        <Vital label="الأكسجين" value={latestVitals.oxygen ? `${latestVitals.oxygen}%` : "—"} />
        <Vital label="الوزن" value={latestVitals.weight} />
      </div>
    </section>
    </>
  );
}

/* ======================================================
   LATEST VISIT
   ====================================================== */

function LatestVisit({
  visit,
}) {
  const complaint =
    visit.complaint ||
    visit.chiefComplaint ||
    visit.reason ||
    "";

  const duration =
    visit.duration || "";

  const history =
    visit.history || "";

  const examination =
    visit.examination || "";

  const diagnosis =
    visit.diagnosis ||
    visit.assessment ||
    "";

  const notes =
    visit.notes ||
    visit.clinicalNotes ||
    "";

  const vitals =
    visit.vitals || {};

  const medicines =
    normalizeArray(
      visit.medicines
    );

  return (
    <div className="latest-visit">

      {(complaint ||
        duration ||
        history ||
        examination ||
        diagnosis ||
        notes) && (
        <div className="visit-clinical-copy">

          {complaint && (
            <div>
              <span>
                الشكوى
              </span>

              <p>
                {complaint}
              </p>
            </div>
          )}

          {duration && (
            <div>
              <span>
                مدة الأعراض
              </span>

              <p>
                {duration}
              </p>
            </div>
          )}

          {history && (
            <div>
              <span>
                التاريخ المرضي
              </span>

              <p>
                {history}
              </p>
            </div>
          )}

          {examination && (
            <div>
              <span>
                الفحص السريري
              </span>

              <p>
                {examination}
              </p>
            </div>
          )}

          {diagnosis && (
            <div>
              <span>
                التشخيص
              </span>

              <p>
                {diagnosis}
              </p>
            </div>
          )}

          {notes && (
            <div>
              <span>
                ملاحظات
              </span>

              <p>
                {notes}
              </p>
            </div>
          )}

        </div>
      )}

      <div className="visit-vitals">

        <Vital
          label="الضغط"
          value={
            vitals.bloodPressure ||
            vitals.pressure ||
            visit.bloodPressure ||
            visit.pressure
          }
        />

        <Vital
          label="النبض"
          value={
            vitals.pulse ||
            visit.pulse
          }
        />

        <Vital
          label="الحرارة"
          value={
            vitals.temperature ||
            visit.temperature
          }
        />

        <Vital
          label="الأكسجين"
          value={
            vitals.oxygen
              ? `${vitals.oxygen}%`
              : visit.oxygen
                ? `${visit.oxygen}%`
                : "—"
          }
        />

        <Vital
          label="الوزن"
          value={
            vitals.weight ||
            visit.weight
          }
        />

      </div>

      {medicines.length >
        0 && (
        <div className="latest-visit-treatment">
          <div className="latest-treatment-heading">
            <Pill
              size={16}
            />

            <strong>
              العلاج الموصوف
            </strong>
          </div>

          <div className="latest-treatment-list">
            {medicines.map(
              (
                medicine,
                index
              ) => (
                <div
                  key={
                    medicine?.id ||
                    `medicine-${index}`
                  }
                >
                  <strong>
                    {typeof medicine ===
                    "object"
                      ? medicine.name ||
                        "دواء"
                      : String(
                          medicine
                        )}
                  </strong>

                  {typeof medicine ===
                    "object" && (
                    <span>
                      {[
                        medicine.dose,
                        medicine.frequency,
                        medicine.duration,
                        medicine.timing,
                      ]
                        .filter(
                          Boolean
                        )
                        .join(
                          " • "
                        ) || "—"}
                    </span>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {!complaint &&
        !diagnosis &&
        !notes &&
        !examination &&
        !history && (
          <div className="visit-no-summary">
            تم تسجيل هذه الزيارة بدون
            ملخص سريري.
          </div>
        )}

    </div>
  );
}

function Vital({
  label,
  value,
}) {
  return (
    <div>
      <span>
        {label}
      </span>

      <strong>
        {value || "—"}
      </strong>
    </div>
  );
}

/* ======================================================
   NEXT APPOINTMENT
   ====================================================== */

function NextAppointment({
  appointment,
  navigate,
}) {
  return (
    <section className="side-section">

      <div className="side-section-title">
        <CalendarDays
          size={16}
        />

        <strong>
          الموعد القادم
        </strong>
      </div>

      {!appointment ? (
        <div className="side-empty">
          لا يوجد موعد قادم
        </div>
      ) : (
        <button
          type="button"
          className="next-appointment-line"
          onClick={() =>
            navigate(
              "/appointments"
            )
          }
        >
          <div>
            <strong>
              {formatDate(
                appointment.startAt ||
                  appointment.date ||
                  appointment.appointmentDate
              )}
            </strong>

            <span>
              {appointment.type ||
                appointment.visitType ||
                "موعد"}
            </span>
          </div>

          <div className="next-time">
            <Clock3
              size={14}
            />

            {formatTime(
              appointment.startAt ||
                appointment.time ||
                appointment.startTime
            )}
          </div>

          <ChevronLeft
            size={16}
          />
        </button>
      )}

    </section>
  );
}

/* ======================================================
   PATIENT FACTS
   ====================================================== */

function PatientFacts({
  patient,
  visitsCount,
  prescriptionsCount,
}) {
  const emergencyPhone =
    getEmergencyPhone(
      patient
        .emergencyContact
    );

  const emergencyName =
    getEmergencyName(
      patient
        .emergencyContact
    );

  const emergencyRelation =
    getEmergencyRelation(
      patient
        .emergencyContact
    );

  return (
    <section className="side-section">

      <div className="side-section-title">
        <UserRound
          size={16}
        />

        <strong>
          بيانات الملف
        </strong>
      </div>

      <dl className="patient-facts">

        <div>
          <dt>
            إجمالي الزيارات
          </dt>

          <dd>
            {visitsCount}
          </dd>
        </div>

        <div>
          <dt>
            الروشتات
          </dt>

          <dd>
            {
              prescriptionsCount
            }
          </dd>
        </div>

        <div>
          <dt>
            تاريخ التسجيل
          </dt>

          <dd>
            {formatDate(
              patient.createdAt
            )}
          </dd>
        </div>

        {emergencyPhone && (
          <div>
            <dt>
              رقم الطوارئ
            </dt>

            <dd dir="ltr">
              {emergencyPhone}
            </dd>
          </div>
        )}

        {emergencyName && (
          <div>
            <dt>
              جهة اتصال الطوارئ
            </dt>

            <dd>
              {emergencyName}

              {emergencyRelation
                ? ` - ${emergencyRelation}`
                : ""}
            </dd>
          </div>
        )}

      </dl>

    </section>
  );
}

/* ======================================================
   RECENT FILES
   ====================================================== */

function RecentFiles({
  files,
}) {
  const normalizedFiles =
    Array.isArray(files)
      ? files
      : [];

  return (
    <section className="side-section">

      <div className="side-section-title">
        <FileText
          size={16}
        />

        <strong>
          آخر الملفات
        </strong>
      </div>

      {normalizedFiles.length ===
      0 ? (
        <div className="side-empty">
          لا توجد ملفات طبية
        </div>
      ) : (
        <div className="recent-files-list">

          {normalizedFiles
            .slice(0, 3)
            .map(
              (file) => (
                <div
                  className="recent-file-line"
                  key={
                    file.id
                  }
                >
                  <FileText
                    size={15}
                  />

                  <div>
                    <strong>
                      {file.name ||
                        file.fileName ||
                        "ملف طبي"}
                    </strong>

                    <span>
                      {formatDate(
                        file.createdAt
                      )}
                    </span>
                  </div>
                </div>
              )
            )}

        </div>
      )}

    </section>
  );
}

/* ======================================================
   VISITS TAB
   ====================================================== */

function VisitsTab({
  patient,
  visits,
  navigate,
}) {
  return (
    <section className="records-section">

      <div className="records-heading">
        <div>
          <h2>
            سجل الزيارات
          </h2>

          <p>
            التاريخ الطبي المسجل داخل
            العيادة
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate(
              `/patients/${patient.id}/visit/new`
            )
          }
        >
          <Plus
            size={16}
          />

          زيارة جديدة
        </button>
      </div>

      {visits.length ===
      0 ? (
        <RecordsEmpty
          icon={
            Stethoscope
          }
          title="لا توجد زيارات"
          text="لم يتم تسجيل أي زيارة لهذا المريض حتى الآن."
        />
      ) : (
        <div className="records-list">

          {visits.map(
            (visit) => (
              <div
                className="record-line"
                key={
                  visit.id
                }
              >
                <div className="record-date">
                  <strong>
                    {formatDate(
                      visit.completedAt ||
                        visit.createdAt ||
                        visit.visitDate
                    )}
                  </strong>

                  <span>
                    {formatTime(
                      visit.completedAt ||
                        visit.createdAt
                    )}
                  </span>
                </div>

                <div className="record-copy">
                  <strong>
                    {visit.diagnosis ||
                      visit.complaint ||
                      "زيارة طبية"}
                  </strong>

                  <span>
                    {visit.doctorName
                      ? `بواسطة ${visit.doctorName}`
                      : "زيارة مكتملة"}
                  </span>
                </div>

                {visit.medicines &&
                  normalizeArray(
                    visit.medicines
                  ).length >
                    0 && (
                    <span className="record-count">
                      {
                        normalizeArray(
                          visit.medicines
                        ).length
                      }{" "}
                      دواء
                    </span>
                  )}

                <ChevronLeft
                  size={16}
                />
              </div>
            )
          )}

        </div>
      )}

    </section>
  );
}

/* ======================================================
   PRESCRIPTIONS TAB
   ====================================================== */

function PrescriptionsTab({
  prescriptions,
}) {
  return (
    <section className="records-section">

      <div className="records-heading">
        <div>
          <h2>
            الروشتات
          </h2>

          <p>
            جميع الروشتات المحفوظة
            في الملف الطبي للمريض
          </p>
        </div>
      </div>

      {prescriptions.length ===
      0 ? (
        <RecordsEmpty
          icon={Pill}
          title="لا توجد روشتات"
          text="لم يتم حفظ أي روشتة لهذا المريض حتى الآن."
        />
      ) : (
        <div className="prescriptions-records">

          {prescriptions.map(
            (
              prescription
            ) => {
              const medicines =
                normalizeArray(
                  prescription
                    .medicines
                );

              return (
                <article
                  className="prescription-record"
                  key={
                    prescription.id
                  }
                >
                  <div className="prescription-record-head">

                    <div className="record-icon">
                      <Pill
                        size={17}
                      />
                    </div>

                    <div className="prescription-record-title">
                      <strong>
                        {prescription.diagnosis ||
                          "روشتة طبية"}
                      </strong>

                      <span>
                        {formatDate(
                          prescription.createdAt
                        )}

                        {prescription.doctorName
                          ? ` • ${prescription.doctorName}`
                          : ""}
                      </span>
                    </div>

                    <span className="prescription-medicine-count">
                      {
                        medicines.length
                      }{" "}
                      دواء
                    </span>

                  </div>

                  {medicines.length >
                    0 && (
                    <div className="prescription-medicines-preview">

                      {medicines.map(
                        (
                          medicine,
                          index
                        ) => {
                          const isObject =
                            typeof medicine ===
                              "object" &&
                            medicine !==
                              null;

                          return (
                            <div
                              key={
                                isObject &&
                                medicine.id
                                  ? medicine.id
                                  : `${prescription.id}-${index}`
                              }
                            >
                              <strong>
                                {isObject
                                  ? medicine.name ||
                                    "دواء"
                                  : String(
                                      medicine
                                    )}
                              </strong>

                              {isObject && (
                                <span>
                                  {[
                                    medicine.concentration,
                                    medicine.dose,
                                    medicine.frequency,
                                    medicine.duration,
                                    medicine.timing,
                                  ]
                                    .filter(
                                      Boolean
                                    )
                                    .join(
                                      " • "
                                    ) ||
                                    "بدون تعليمات إضافية"}
                                </span>
                              )}
                            </div>
                          );
                        }
                      )}

                    </div>
                  )}

                  {prescription.notes && (
                    <div className="prescription-record-notes">
                      <span>
                        تعليمات الطبيب
                      </span>

                      <p>
                        {
                          prescription
                            .notes
                        }
                      </p>
                    </div>
                  )}

                  {prescription.followUp && (
                    <div className="prescription-follow-up">
                      <CalendarDays
                        size={14}
                      />

                      <span>
                        المتابعة:
                      </span>

                      <strong>
                        {
                          prescription
                            .followUp
                        }
                      </strong>
                    </div>
                  )}

                </article>
              );
            }
          )}

        </div>
      )}

    </section>
  );
}

/* ======================================================
   FILES TAB
   ====================================================== */

function FilesTab({
  files,
}) {
  const normalizedFiles =
    Array.isArray(files)
      ? files
      : [];

  return (
    <section className="records-section">

      <div className="records-heading">
        <div>
          <h2>
            الملفات الطبية
          </h2>

          <p>
            التحاليل والأشعة والتقارير
            والمرفقات
          </p>
        </div>

        <button
          type="button"
        >
          <Plus
            size={16}
          />

          إضافة ملف
        </button>
      </div>

      {normalizedFiles.length ===
      0 ? (
        <RecordsEmpty
          icon={
            FlaskConical
          }
          title="لا توجد ملفات"
          text="لم يتم رفع تحاليل أو أشعة أو تقارير لهذا المريض."
        />
      ) : (
        <div className="records-list">

          {normalizedFiles.map(
            (file) => (
              <div
                className="record-line"
                key={
                  file.id
                }
              >
                <div className="record-icon">
                  <FileText
                    size={16}
                  />
                </div>

                <div className="record-copy">
                  <strong>
                    {file.name ||
                      file.fileName ||
                      "ملف طبي"}
                  </strong>

                  <span>
                    {file.type ||
                      "مرفق"}{" "}
                    •{" "}
                    {formatDate(
                      file.createdAt
                    )}
                  </span>
                </div>

                <ChevronLeft
                  size={16}
                />
              </div>
            )
          )}

        </div>
      )}

    </section>
  );
}

/* ======================================================
   EMPTY STATE
   ====================================================== */

function RecordsEmpty({
  icon: Icon,
  title,
  text,
}) {
  return (
    <div className="records-empty">
      <Icon
        size={25}
      />

      <strong>
        {title}
      </strong>

      <span>
        {text}
      </span>
    </div>
  );
}
/* ======================================================
   COMPLETE PATIENT RECORD
   ====================================================== */

function PatientTimeline({ chart }) {
  const events = [
    ...chart.visits.map(item => ({...item,_kind:"visit",_time:item.completedAt||item.createdAt})),
    ...chart.prescriptions.map(item => ({...item,_kind:"rx",_time:item.createdAt})),
    ...chart.medicalFiles.map(item => ({...item,_kind:"file",_time:item.uploadedAt||item.createdAt})),
    ...chart.appointments.map(item => ({...item,_kind:"appointment",_time:item.completedAt||item.createdAt||item.date})),
  ].sort((a,b)=>new Date(b._time||0)-new Date(a._time||0));

  const labels={visit:"كشف طبي",rx:"روشتة",file:"تحليل / أشعة",appointment:"موعد"};
  return <section className="patient-ledger-section">
    <div className="records-heading"><div><h2>السجل الطبي الكامل</h2><p>كل ما حدث للمريض مرتب زمنيًا في مكان واحد</p></div></div>
    {!events.length?<RecordsEmpty icon={History} title="لا يوجد سجل طبي" text="ستظهر الزيارات والروشتات والملفات والمواعيد هنا تلقائيًا."/>:
    <div className="patient-master-timeline">{events.map((event,index)=><article key={event.id+"-"+event._kind+"-"+index}>
      <div className={"timeline-kind kind-"+event._kind}>{event._kind==="visit"?<Stethoscope size={15}/>:event._kind==="rx"?<Pill size={15}/>:event._kind==="file"?<FlaskConical size={15}/>:<CalendarDays size={15}/>}</div>
      <div className="timeline-date"><strong>{formatDate(event._time)}</strong><span>{formatTime(event._time)}</span></div>
      <div className="timeline-body"><span>{labels[event._kind]}</span><strong>{event.diagnosis||event.name||event.fileName||event.type||"سجل طبي"}</strong><p>{event.doctorName ? "د. "+event.doctorName : event.notes||event.instructions||""}</p></div>
      <div className="timeline-state">{event.status||"مسجل"}</div>
    </article>)}</div>}
  </section>;
}

function AppointmentsTab({ appointments=[] }) {
  const statusLabel={confirmed:"مؤكد",arrived:"وصل",waiting:"انتظار","in-progress":"داخل الكشف",completed:"تم الكشف",cancelled:"ملغي","no-show":"لم يحضر"};
  return <section className="patient-ledger-section">
    <div className="records-heading"><div><h2>المواعيد والحضور</h2><p>تاريخ الحجز والوصول والكشف وعدم الحضور</p></div></div>
    {!appointments.length?<RecordsEmpty icon={CalendarDays} title="لا توجد مواعيد" text="لم يتم تسجيل مواعيد لهذا المريض."/>:
    <div className="appointments-ledger">{appointments.map(item=><article key={item.id}>
      <div className="appointment-date-box"><strong>{formatDate(item.date||item.startAt||item.createdAt)}</strong><span>{formatTime(item.time||item.startAt)}</span></div>
      <div><strong>{item.type||"كشف"}</strong><span>{item.doctorName ? "د. "+item.doctorName : "طبيب غير محدد"}</span></div>
      <span className={"appointment-status status-"+item.status}>{statusLabel[item.status]||item.status||"مسجل"}</span>
    </article>)}</div>}
  </section>;
}

function PatientDentalRecord({ twin }) {
  const insights=buildDentalInsights(twin);
  const snapshots=Object.values(twin.snapshots||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const plan=Array.isArray(twin.treatmentPlan)?twin.treatmentPlan:Object.values(twin.treatmentPlan||{});
  const media=Array.isArray(twin.media)?twin.media:Object.values(twin.media||{});
  return <section className="patient-ledger-section dental-record-file">
    <div className="records-heading"><div><h2>ملف الأسنان</h2><p>الحالة الحالية، خطة العلاج، الصور والتاريخ السني للمريض</p></div></div>
    <div className="dental-record-metrics"><div><span>أسنان تحتاج متابعة</span><strong>{insights.affected}</strong></div><div><span>إجراءات مفتوحة</span><strong>{insights.openPlans}</strong></div><div><span>قيمة الخطة</span><strong>{insights.planValue.toLocaleString("ar-EG")} ج.م</strong></div><div><span>المتبقي</span><strong>{insights.remaining.toLocaleString("ar-EG")} ج.م</strong></div></div>
    <div className="patient-dental-grid"><div className="patient-dental-model"><div className="ledger-title"><div><Activity size={16}/><span>Dental Digital Twin</span></div><small>الحالة الحالية</small></div><Dental3DViewer value={twin.currentChart||{}}/></div>
    <div className="patient-dental-side"><div className="ledger-title"><div><ClipboardList size={16}/><span>خطة العلاج</span></div><small>{plan.length} إجراء</small></div>{!plan.length?<div className="side-empty">لا توجد خطة علاج</div>:plan.map((item,i)=><div className="dental-plan-line" key={item.id||i}><div><strong>{item.procedure||item.name||"إجراء"}</strong><span>{item.tooth ? "السن "+item.tooth : "—"} · {item.status||"planned"}</span></div><b>{Number(item.cost||0).toLocaleString("ar-EG")} ج.م</b></div>)}</div></div>
    <div className="dental-file-bottom"><div><div className="ledger-title"><div><History size={16}/><span>Snapshots</span></div><small>{snapshots.length}</small></div>{snapshots.slice(0,5).map(s=><div className="plain-ledger-line" key={s.id}><strong>{formatDate(s.createdAt)}</strong><span>{s.doctorName||"الطبيب"}</span></div>)}</div><div><div className="ledger-title"><div><Image size={16}/><span>الأشعة والصور</span></div><small>{media.length}</small></div>{media.slice(0,5).map((m,i)=><div className="plain-ledger-line" key={m.id||i}><strong>{m.type||"Dental image"}</strong><span>{m.tooth ? "السن "+m.tooth : "عام"} · {m.stage||"diagnostic"}</span></div>)}</div></div>
  </section>;
}
