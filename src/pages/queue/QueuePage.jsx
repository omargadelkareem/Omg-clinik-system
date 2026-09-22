import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  Clock3,
  LoaderCircle,
  Search,
  Stethoscope,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

import {
  startAppointmentVisit,
  subscribeQueue,
} from "../../services/appointmentService";

import {
  getRepresentativeUsage,
  quickAddRepresentativeToQueue,
  subscribeClinicDoctors,
  subscribeRepresentatives,
  subscribeRepresentativeSettings,
  subscribeRepresentativeVisits,
  VISIT_STATUS,
} from "../../services/representativeService";

import "./QueuePage.css";

/* =========================================================
   HELPERS
   ========================================================= */

function normalizeTimestamp(value) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const numeric = Number(value);

    if (Number.isFinite(numeric)) {
      return numeric;
    }

    const parsed = new Date(value).getTime();

    return Number.isNaN(parsed)
      ? 0
      : parsed;
  }

  return 0;
}

function formatClock(value) {
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
      month: "long",
      year: "numeric",
    }
  ).format(
    new Date(timestamp)
  );
}

function getWaitingMinutes(
  item,
  now
) {
  const start =
    normalizeTimestamp(
      item.checkedInAt ||
        item.createdAt
    );

  if (!start) {
    return 0;
  }

  const end =
    item.status === "in-progress"
      ? normalizeTimestamp(
          item.startedAt
        ) || now
      : now;

  return Math.max(
    0,
    Math.floor(
      (end - start) /
        60000
    )
  );
}

function formatWaiting(minutes) {
  if (minutes < 1) {
    return "أقل من دقيقة";
  }

  if (minutes < 60) {
    return `${minutes} دقيقة`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  const remaining =
    minutes % 60;

  if (!remaining) {
    return `${hours} ساعة`;
  }

  return `${hours} س ${remaining} د`;
}

function getInitials(
  name = ""
) {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]
    )
    .join("");
}

function getSourceLabel(source) {
  if (
    source === "walk-in" ||
    source === "walk_in"
  ) {
    return "بدون حجز";
  }

  if (
    source === "appointment"
  ) {
    return "موعد";
  }

  return "استقبال";
}

function getPriorityLabel(
  priority
) {
  switch (priority) {
    case "urgent":
      return "عاجل";

    case "high":
      return "أولوية";

    default:
      return "";
  }
}

function getTodayKey() {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function isSameDay(
  timestamp,
  date = new Date()
) {
  const value =
    normalizeTimestamp(
      timestamp
    );

  if (!value) {
    return false;
  }

  const target =
    new Date(value);

  return (
    target.getFullYear() ===
      date.getFullYear() &&
    target.getMonth() ===
      date.getMonth() &&
    target.getDate() ===
      date.getDate()
  );
}

/* =========================================================
   PAGE
   ========================================================= */

export default function QueuePage() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const {
    clinicId,
    profile,
    staffId,
  } = useAuth();

  const [
    activeSection,
    setActiveSection,
  ] = useState(
    "patients"
  );

  const [
    queue,
    setQueue,
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
    activeActionId,
    setActiveActionId,
  ] = useState("");

  const [
    selectedPatient,
    setSelectedPatient,
  ] = useState(null);

  const [
    now,
    setNow,
  ] = useState(
    Date.now()
  );

  const [
    toast,
    setToast,
  ] = useState(() => {
    if (
      location.state
        ?.visitCompleted
    ) {
      return {
        type: "success",

        message:
          location.state
            ?.patientName
            ? `تم إنهاء كشف ${location.state.patientName} وحفظ الزيارة بنجاح.`
            : "تم إنهاء الكشف وحفظ الزيارة بنجاح.",
      };
    }

    return null;
  });

  /* =======================================================
     REPRESENTATIVES STATE
     ======================================================= */

  const [
    representatives,
    setRepresentatives,
  ] = useState([]);

  const [
    representativeVisits,
    setRepresentativeVisits,
  ] = useState([]);

  const [
    doctors,
    setDoctors,
  ] = useState([]);

  const [
    selectedDoctorId,
    setSelectedDoctorId,
  ] = useState("");

  const [
    representativeSettings,
    setRepresentativeSettings,
  ] = useState({
    visitsOpen: true,
    dailyVisitLimit: 6,
    closedForDate: null,
  });

  const [
    representativeSearch,
    setRepresentativeSearch,
  ] = useState("");

  const [
    selectedRepresentative,
    setSelectedRepresentative,
  ] = useState(null);

  const [
    representativeActionId,
    setRepresentativeActionId,
  ] = useState("");

  /* =======================================================
     CLEAR NAVIGATION STATE
     ======================================================= */

  useEffect(() => {
    if (
      location.state
        ?.visitCompleted
    ) {
      window.history.replaceState(
        {},
        document.title
      );
    }
  }, [
    location.state,
  ]);

  /* =======================================================
     CLOCK
     ======================================================= */

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setNow(
            Date.now()
          );
        },
        60000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, []);

  /* =======================================================
     TOAST
     ======================================================= */

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          setToast(null);
        },
        4000
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [toast]);

  /* =======================================================
     PATIENT QUEUE REALTIME
     ======================================================= */

  useEffect(() => {
    if (!clinicId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const unsubscribe =
      subscribeQueue(
        clinicId,

        (items) => {
          setQueue(
            Array.isArray(items)
              ? items
              : []
          );

          setLoading(false);
        },

        (firebaseError) => {
          console.error(
            "Queue realtime error:",
            firebaseError
          );

          setError(
            "تعذر تحميل قائمة الانتظار."
          );

          setLoading(false);
        }
      );

    return () =>
      unsubscribe?.();
  }, [clinicId]);

  /* =======================================================
     REPRESENTATIVES REALTIME
     ======================================================= */

  useEffect(() => {
    if (!clinicId) {
      return;
    }

    const unsubscribeRepresentatives =
      subscribeRepresentatives(
        clinicId,

        (items) => {
          setRepresentatives(
            Array.isArray(items)
              ? items
              : []
          );
        },

        (firebaseError) => {
          console.error(
            "Representatives realtime error:",
            firebaseError
          );
        }
      );

    const unsubscribeVisits =
      subscribeRepresentativeVisits(
        clinicId,

        (items) => {
          setRepresentativeVisits(
            Array.isArray(items)
              ? items
              : []
          );
        },

        (firebaseError) => {
          console.error(
            "Representative visits realtime error:",
            firebaseError
          );
        }
      );

    const unsubscribeDoctors =
      subscribeClinicDoctors(
        clinicId,

        (items) => {
          setDoctors(
            Array.isArray(items)
              ? items
              : []
          );
        },

        (firebaseError) => {
          console.error(
            "Doctors realtime error:",
            firebaseError
          );
        }
      );

    return () => {
      unsubscribeRepresentatives?.();
      unsubscribeVisits?.();
      unsubscribeDoctors?.();
    };
  }, [clinicId]);

  /* =======================================================
     SELECT DOCTOR
     ======================================================= */

  useEffect(() => {
    if (!doctors.length) {
      setSelectedDoctorId("");
      return;
    }

    if (
      staffId &&
      doctors.some(
        (doctor) =>
          doctor.id === staffId
      )
    ) {
      setSelectedDoctorId(
        staffId
      );

      return;
    }

    setSelectedDoctorId(
      (current) => {
        if (
          current &&
          doctors.some(
            (doctor) =>
              doctor.id === current
          )
        ) {
          return current;
        }

        return (
          doctors[0]?.id ||
          ""
        );
      }
    );
  }, [
    doctors,
    staffId,
  ]);

  const selectedDoctor =
    useMemo(
      () =>
        doctors.find(
          (doctor) =>
            doctor.id ===
            selectedDoctorId
        ) || null,
      [
        doctors,
        selectedDoctorId,
      ]
    );

  /* =======================================================
     REPRESENTATIVE SETTINGS
     ======================================================= */

  useEffect(() => {
    if (
      !clinicId ||
      !selectedDoctorId
    ) {
      setRepresentativeSettings({
        visitsOpen: true,
        dailyVisitLimit: 6,
        closedForDate: null,
      });

      return;
    }

    const unsubscribe =
      subscribeRepresentativeSettings(
        clinicId,
        selectedDoctorId,

        (settings) => {
          setRepresentativeSettings({
            visitsOpen:
              settings?.visitsOpen !==
              false,

            dailyVisitLimit:
              Number(
                settings
                  ?.dailyVisitLimit
              ) || 6,

            closedForDate:
              settings
                ?.closedForDate ||
              null,

            ...settings,
          });
        },

        (firebaseError) => {
          console.error(
            "Representative settings error:",
            firebaseError
          );
        }
      );

    return () =>
      unsubscribe?.();
  }, [
    clinicId,
    selectedDoctorId,
  ]);

  const todayKey =
    useMemo(
      () =>
        getTodayKey(),
      []
    );

  const representativeVisitsOpen =
    useMemo(() => {
      if (
        representativeSettings
          ?.visitsOpen !== false
      ) {
        return true;
      }

      if (
        representativeSettings
          ?.closedForDate &&
        representativeSettings
          .closedForDate !==
          todayKey
      ) {
        return true;
      }

      return false;
    }, [
      representativeSettings,
      todayKey,
    ]);

  /* =======================================================
     PATIENT FILTER
     ======================================================= */

  const filteredQueue =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return queue;
      }

      return queue.filter(
        (item) => {
          const text = [
            item.patientName,
            item.patientPhone,
            item.patientCode,
            item.doctorName,
            item.type,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return text.includes(
            query
          );
        }
      );
    }, [
      queue,
      search,
    ]);

  const inProgress =
    useMemo(
      () =>
        filteredQueue.filter(
          (item) =>
            item.status ===
            "in-progress"
        ),
      [
        filteredQueue,
      ]
    );

  const waiting =
    useMemo(
      () =>
        filteredQueue.filter(
          (item) =>
            item.status ===
            "waiting"
        ),
      [
        filteredQueue,
      ]
    );

  const stats =
    useMemo(() => {
      const allWaiting =
        queue.filter(
          (item) =>
            item.status ===
            "waiting"
        );

      const allInProgress =
        queue.filter(
          (item) =>
            item.status ===
            "in-progress"
        );

      const totalWait =
        allWaiting.reduce(
          (
            total,
            item
          ) =>
            total +
            getWaitingMinutes(
              item,
              now
            ),
          0
        );

      return {
        waiting:
          allWaiting.length,

        inProgress:
          allInProgress.length,

        total:
          allWaiting.length +
          allInProgress.length,

        average:
          allWaiting.length
            ? Math.round(
                totalWait /
                  allWaiting.length
              )
            : 0,
      };
    }, [
      queue,
      now,
    ]);

  /* =======================================================
     REPRESENTATIVES FILTER
     ======================================================= */

  const filteredRepresentatives =
    useMemo(() => {
      const query =
        representativeSearch
          .trim()
          .toLowerCase();

      return representatives
        .filter(
          (representative) =>
            representative.status !==
            "inactive"
        )
        .filter(
          (representative) =>
            !selectedDoctorId ||
            !representative
              .assignedDoctorId ||
            representative
              .assignedDoctorId ===
              selectedDoctorId
        )
        .filter(
          (representative) => {
            if (!query) {
              return true;
            }

            const text = [
              representative.code,
              representative.name,
              representative.phone,
              representative
                .normalizedPhone,
              representative
                .organizationName,
              representative
                .organizationTypeLabel,
              representative
                .assignedDoctorName,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return text.includes(
              query
            );
          }
        );
    }, [
      representatives,
      representativeSearch,
      selectedDoctorId,
    ]);

  const representativeVisitsToday =
    useMemo(
      () =>
        representativeVisits.filter(
          (visit) => {
            if (
              selectedDoctorId &&
              visit.doctorId !==
                selectedDoctorId
            ) {
              return false;
            }

            return isSameDay(
              visit.createdAt ||
                visit.arrivedAt ||
                visit.startedAt ||
                visit.completedAt
            );
          }
        ),
      [
        representativeVisits,
        selectedDoctorId,
      ]
    );

  const representativeWaitingCount =
    useMemo(
      () =>
        representativeVisitsToday.filter(
          (visit) =>
            visit.status ===
              VISIT_STATUS.WAITING ||
            visit.status ===
              VISIT_STATUS.ARRIVED
        ).length,
      [
        representativeVisitsToday,
      ]
    );

  /* =======================================================
     START PATIENT VISIT
     ======================================================= */

  async function startQueueVisit({
    clinicId:
      currentClinicId,
    queueItem,
  }) {
    const module =
      await import(
        "../../services/appointmentService"
      );

    if (
      typeof module
        .startQueueVisit !==
      "function"
    ) {
      throw new Error(
        "startQueueVisit service is missing."
      );
    }

    return module.startQueueVisit({
      clinicId:
        currentClinicId,

      queueItem,
    });
  }

  const handleStartVisit =
    async (item) => {
      if (
        !clinicId ||
        !item?.patientId ||
        activeActionId
      ) {
        return;
      }

      try {
        setActiveActionId(
          item.id
        );

        setError("");

        if (
          item.appointmentId
        ) {
          const appointment = {
            id:
              item.appointmentId,

            patientId:
              item.patientId,
          };

          const result =
            await startAppointmentVisit({
              clinicId,

              appointment,

              queueId:
                item.id,
            });

          navigate(
            `/patients/${item.patientId}/visit/new`,
            {
              state: {
                appointmentId:
                  result
                    ?.appointmentId ||
                  item.appointmentId,

                queueId:
                  result?.queueId ||
                  item.id,

                fromQueue: true,

                source: "queue",
              },
            }
          );

          return;
        }

        const result =
          await startQueueVisit({
            clinicId,

            queueItem:
              item,
          });

        navigate(
          `/patients/${item.patientId}/visit/new`,
          {
            state: {
              appointmentId:
                "",

              queueId:
                result?.queueId ||
                item.id,

              fromQueue: true,

              source: "queue",
            },
          }
        );
      } catch (
        actionError
      ) {
        console.error(
          "Start queue visit error:",
          actionError
        );

        setError(
          actionError?.message ||
            "تعذر بدء الكشف. حاول مرة أخرى."
        );
      } finally {
        setActiveActionId(
          ""
        );
      }
    };

  /* =======================================================
     CONTINUE PATIENT VISIT
     ======================================================= */

  function handleContinueVisit(
    item
  ) {
    if (
      !item?.patientId
    ) {
      return;
    }

    navigate(
      `/patients/${item.patientId}/visit/new`,
      {
        state: {
          appointmentId:
            item.appointmentId ||
            "",

          queueId:
            item.id,

          fromQueue: true,

          source: "queue",
        },
      }
    );
  }

  /* =======================================================
     ADD REPRESENTATIVE
     ======================================================= */

  async function handleAddRepresentative(
    representative
  ) {
    if (
      !clinicId ||
      !selectedDoctorId ||
      !representative?.id ||
      representativeActionId
    ) {
      return;
    }

    if (
      !representativeVisitsOpen
    ) {
      setError(
        `قسم زيارات المندوبين مغلق بواسطة ${
          selectedDoctor?.name ||
          "الطبيب"
        }.`
      );

      return;
    }

    const usage =
      getRepresentativeUsage({
        representative,
        visits:
          representativeVisits,
      });

    if (
      usage?.monthlyExceeded
    ) {
      setError(
        `${representative.name} استنفد عدد الزيارات المسموح بها هذا الشهر.`
      );

      return;
    }

    try {
      setRepresentativeActionId(
        representative.id
      );

      setError("");

      await quickAddRepresentativeToQueue({
        clinicId,

        representative,

        doctorId:
          selectedDoctorId,

        doctorName:
          selectedDoctor?.name ||
          representative
            .assignedDoctorName ||
          "",

        createdBy:
          profile?.uid ||
          profile?.id ||
          staffId ||
          "",
      });

      setToast({
        type: "success",

        message:
          `تم إضافة ${representative.name} إلى انتظار المندوبين.`,
      });
    } catch (
      actionError
    ) {
      console.error(
        "Add representative error:",
        actionError
      );

      setError(
        actionError?.message ||
          "تعذر إضافة المندوب إلى الانتظار."
      );
    } finally {
      setRepresentativeActionId(
        ""
      );
    }
  }

  /* =======================================================
     LOADING
     ======================================================= */

  if (loading) {
    return (
      <div className="queue-page-state">
        <LoaderCircle
          size={27}
          className="queue-spinner"
        />

        <strong>
          جاري تحميل قائمة الانتظار
        </strong>

        <span>
          يتم تحديث المرضى لحظيًا...
        </span>
      </div>
    );
  }

  /* =======================================================
     UI
     ======================================================= */

  return (
    <div className="queue-page">
      <header className="queue-header">
        <div className="queue-title">
          <span className="queue-eyebrow">
            CLINIC FLOW
          </span>

          <h1>
            قائمة الانتظار
          </h1>

          <p>
            متابعة المرضى والمندوبين
            وحركة الاستقبال داخل العيادة.
          </p>
        </div>

        <div className="queue-header-status">
          <span className="queue-live-dot" />

          تحديث مباشر
        </div>
      </header>

      {/* =========================
          MAIN TABS
          ========================= */}

      <div className="queue-main-tabs">
        <button
          type="button"
          className={
            activeSection ===
            "patients"
              ? "active"
              : ""
          }
          onClick={() => {
            setActiveSection(
              "patients"
            );

            setSelectedRepresentative(
              null
            );
          }}
        >
          <UsersRound
            size={17}
          />

          المرضى

          <span>
            {stats.total}
          </span>
        </button>

        <button
          type="button"
          className={
            activeSection ===
            "representatives"
              ? "active"
              : ""
          }
          onClick={() => {
            setActiveSection(
              "representatives"
            );

            setSelectedPatient(
              null
            );
          }}
        >
          <BriefcaseBusiness
            size={17}
          />

          المندوبون

          <span>
            {
              representativeWaitingCount
            }
          </span>
        </button>
      </div>

      {/* =========================
          ERROR
          ========================= */}

      {error && (
        <div className="queue-error">
          <AlertCircle
            size={17}
          />

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

      {/* ===================================================
          PATIENTS
          =================================================== */}

      {activeSection ===
        "patients" && (
        <>
          <section className="queue-summary">
            <QueueMetric
              icon={
                UsersRound
              }
              label="في الانتظار"
              value={
                stats.waiting
              }
              helper="مرضى ينتظرون الطبيب"
            />

            <QueueMetric
              icon={
                Stethoscope
              }
              label="داخل الكشف"
              value={
                stats.inProgress
              }
              helper="زيارات جارية الآن"
            />

            <QueueMetric
              icon={
                Clock3
              }
              label="متوسط الانتظار"
              value={
                stats.average
                  ? `${stats.average} د`
                  : "—"
              }
              helper="للمرضى المنتظرين"
            />

            <QueueMetric
              icon={
                Activity
              }
              label="الحركة الحالية"
              value={
                stats.total
              }
              helper="مرضى داخل دورة التشغيل"
            />
          </section>

          {/* SEARCH */}

          <section className="queue-toolbar">
            <div className="queue-search">
              <Search
                size={17}
              />

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
                placeholder="ابحث باسم المريض، رقم الملف أو الهاتف..."
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch(
                      ""
                    )
                  }
                >
                  <X
                    size={14}
                  />
                </button>
              )}
            </div>

            <div className="queue-toolbar-meta">
              <span>
                <CircleDot
                  size={14}
                />

                {stats.waiting} منتظر
              </span>

              <span>
                <Stethoscope
                  size={14}
                />

                {stats.inProgress} داخل الكشف
              </span>
            </div>
          </section>

          {/* CURRENT VISITS */}

          {inProgress.length >
            0 && (
            <section className="current-visit-section">
              <div className="queue-section-heading">
                <div>
                  <span className="section-indicator active" />

                  <div>
                    <h2>
                      الكشف الجاري
                    </h2>

                    <p>
                      المرضى الموجودون حاليًا لدى الطبيب
                    </p>
                  </div>
                </div>

                <span className="queue-count">
                  {
                    inProgress.length
                  }
                </span>
              </div>

              <div className="current-visits">
                {inProgress.map(
                  (item) => (
                    <CurrentVisit
                      key={
                        item.id
                      }
                      item={
                        item
                      }
                      now={
                        now
                      }
                      onPatient={() =>
                        navigate(
                          `/patients/${item.patientId}`
                        )
                      }
                      onContinue={() =>
                        handleContinueVisit(
                          item
                        )
                      }
                    />
                  )
                )}
              </div>
            </section>
          )}

          {/* WAITING */}

          <section className="waiting-section">
            <div className="queue-section-heading">
              <div>
                <span className="section-indicator" />

                <div>
                  <h2>
                    المرضى المنتظرون
                  </h2>

                  <p>
                    مرتبة حسب وقت الوصول إلى العيادة
                  </p>
                </div>
              </div>

              <span className="queue-count">
                {
                  waiting.length
                }
              </span>
            </div>

            {waiting.length ===
            0 ? (
              <div className="queue-empty">
                <span className="queue-empty-icon">
                  <CheckCircle2
                    size={27}
                  />
                </span>

                <strong>
                  لا يوجد مرضى في الانتظار
                </strong>

                <p>
                  المرضى الذين يتم تسجيل وصولهم من صفحة المواعيد سيظهرون هنا تلقائيًا.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/appointments"
                    )
                  }
                >
                  فتح المواعيد

                  <ArrowLeft
                    size={15}
                  />
                </button>
              </div>
            ) : (
              <div className="queue-table-shell">
                <div className="queue-table-header">
                  <span>#</span>
                  <span>المريض</span>
                  <span>الوصول</span>
                  <span>الانتظار</span>
                  <span>نوع الزيارة</span>
                  <span>الطبيب</span>
                  <span>الإجراء</span>
                </div>

                <div className="queue-table-body">
                  {waiting.map(
                    (
                      item,
                      index
                    ) => (
                      <WaitingRow
                        key={
                          item.id
                        }
                        item={
                          item
                        }
                        index={
                          index
                        }
                        now={
                          now
                        }
                        loading={
                          activeActionId ===
                          item.id
                        }
                        onStart={() =>
                          handleStartVisit(
                            item
                          )
                        }
                        onDetails={() =>
                          setSelectedPatient(
                            item
                          )
                        }
                      />
                    )
                  )}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* ===================================================
          REPRESENTATIVES
          =================================================== */}

      {activeSection ===
        "representatives" && (
        <RepresentativeReception
          representatives={
            filteredRepresentatives
          }
          visits={
            representativeVisits
          }
          search={
            representativeSearch
          }
          onSearch={
            setRepresentativeSearch
          }
          doctors={
            doctors
          }
          selectedDoctorId={
            selectedDoctorId
          }
          onDoctorChange={
            setSelectedDoctorId
          }
          selectedDoctor={
            selectedDoctor
          }
          settings={
            representativeSettings
          }
          visitsOpen={
            representativeVisitsOpen
          }
          waitingCount={
            representativeWaitingCount
          }
          actionId={
            representativeActionId
          }
          onAdd={
            handleAddRepresentative
          }
          onDetails={
            setSelectedRepresentative
          }
        />
      )}

      {/* ===================================================
          PATIENT DRAWER
          =================================================== */}

      {activeSection ===
        "patients" &&
        selectedPatient && (
          <PatientDrawer
            item={
              selectedPatient
            }
            now={
              now
            }
            loading={
              activeActionId ===
              selectedPatient.id
            }
            onClose={() =>
              setSelectedPatient(
                null
              )
            }
            onProfile={() =>
              navigate(
                `/patients/${selectedPatient.patientId}`
              )
            }
            onStart={() =>
              handleStartVisit(
                selectedPatient
              )
            }
          />
        )}

      {/* ===================================================
          REPRESENTATIVE DRAWER
          =================================================== */}

      {activeSection ===
        "representatives" &&
        selectedRepresentative && (
          <RepresentativeDrawer
            representative={
              selectedRepresentative
            }
            visits={
              representativeVisits
            }
            visitsOpen={
              representativeVisitsOpen
            }
            loading={
              representativeActionId ===
              selectedRepresentative.id
            }
            onClose={() =>
              setSelectedRepresentative(
                null
              )
            }
            onAdd={() =>
              handleAddRepresentative(
                selectedRepresentative
              )
            }
          />
        )}

      {/* TOAST */}

      {toast && (
        <div
          className={`queue-toast queue-toast-${toast.type}`}
        >
          <CheckCircle2
            size={18}
          />

          <span>
            {toast.message}
          </span>

          <button
            type="button"
            onClick={() =>
              setToast(null)
            }
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   METRIC
   ========================================================= */

function QueueMetric({
  icon: Icon,
  label,
  value,
  helper,
}) {
  return (
    <div className="queue-metric">
      <span className="queue-metric-icon">
        <Icon
          size={18}
        />
      </span>

      <div>
        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

        <small>
          {helper}
        </small>
      </div>
    </div>
  );
}

/* =========================================================
   CURRENT VISIT
   ========================================================= */

function CurrentVisit({
  item,
  now,
  onPatient,
  onContinue,
}) {
  const startedAt =
    normalizeTimestamp(
      item.startedAt
    );

  const duration =
    startedAt
      ? Math.max(
          0,
          Math.floor(
            (now -
              startedAt) /
              60000
          )
        )
      : 0;

  return (
    <article className="current-visit-card">
      <div className="current-visit-patient">
        <span className="queue-avatar active">
          {getInitials(
            item.patientName
          )}
        </span>

        <div>
          <div className="current-patient-name">
            <strong>
              {item.patientName}
            </strong>

            <span>
              داخل الكشف
            </span>
          </div>

          <p>
            {item.patientCode ||
              "بدون رقم ملف"}

            {item.type &&
              ` · ${item.type}`}
          </p>
        </div>
      </div>

      <div className="current-visit-data">
        <div>
          <span>
            الطبيب
          </span>

          <strong>
            {item.doctorName ||
              "غير محدد"}
          </strong>
        </div>

        <div>
          <span>
            بدأ الكشف
          </span>

          <strong>
            {formatClock(
              item.startedAt
            )}
          </strong>
        </div>

        <div>
          <span>
            المدة
          </span>

          <strong>
            {duration
              ? `${duration} دقيقة`
              : "الآن"}
          </strong>
        </div>
      </div>

      <div className="current-visit-actions">
        <button
          type="button"
          className="current-profile-button"
          onClick={
            onPatient
          }
        >
          ملف المريض

          <ChevronLeft
            size={15}
          />
        </button>

        <button
          type="button"
          className="queue-start-button"
          onClick={
            onContinue
          }
        >
          <Stethoscope
            size={15}
          />

          استكمال الكشف
        </button>
      </div>
    </article>
  );
}

/* =========================================================
   WAITING ROW
   ========================================================= */

function WaitingRow({
  item,
  index,
  now,
  loading,
  onStart,
  onDetails,
}) {
  const waitingMinutes =
    getWaitingMinutes(
      item,
      now
    );

  const priority =
    getPriorityLabel(
      item.priority
    );

  return (
    <div className="queue-table-row">
      <div className="queue-position">
        {index + 1}
      </div>

      <button
        type="button"
        className="queue-patient-cell"
        onClick={
          onDetails
        }
      >
        <span className="queue-avatar">
          {getInitials(
            item.patientName
          )}
        </span>

        <span>
          <strong>
            {item.patientName}
          </strong>

          <small>
            {item.patientCode ||
              item.patientPhone ||
              "بدون رقم ملف"}
          </small>
        </span>

        {priority && (
          <em
            className={`queue-priority queue-priority-${item.priority}`}
          >
            {priority}
          </em>
        )}
      </button>

      <div className="queue-time-cell">
        <CalendarClock
          size={14}
        />

        {formatClock(
          item.checkedInAt ||
            item.createdAt
        )}
      </div>

      <div
        className={`queue-wait-cell ${
          waitingMinutes >=
          30
            ? "queue-wait-long"
            : ""
        }`}
      >
        <Clock3
          size={14}
        />

        {formatWaiting(
          waitingMinutes
        )}
      </div>

      <div className="queue-type-cell">
        <strong>
          {item.type ||
            "كشف"}
        </strong>

        <span>
          {getSourceLabel(
            item.source
          )}
        </span>
      </div>

      <div className="queue-doctor-cell">
        <Stethoscope
          size={14}
        />

        <span>
          {item.doctorName ||
            "غير محدد"}
        </span>
      </div>

      <div className="queue-action-cell">
        <button
          type="button"
          className="queue-start-button"
          disabled={
            loading
          }
          onClick={
            onStart
          }
        >
          {loading ? (
            <LoaderCircle
              size={15}
              className="queue-spinner"
            />
          ) : (
            <Stethoscope
              size={15}
            />
          )}

          بدء الكشف
        </button>

        <button
          type="button"
          className="queue-more-button"
          onClick={
            onDetails
          }
          aria-label="تفاصيل المريض"
        >
          <ChevronLeft
            size={16}
          />
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   PATIENT DRAWER
   ========================================================= */

function PatientDrawer({
  item,
  now,
  loading,
  onClose,
  onProfile,
  onStart,
}) {
  return (
    <div className="queue-drawer-layer">
      <button
        type="button"
        className="queue-drawer-backdrop"
        onClick={
          onClose
        }
        aria-label="إغلاق"
      />

      <aside className="queue-drawer">
        <header className="queue-drawer-header">
          <div>
            <span>
              تفاصيل الانتظار
            </span>

            <h2>
              المريض
            </h2>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
          >
            <X size={18} />
          </button>
        </header>

        <div className="queue-drawer-patient">
          <span className="queue-drawer-avatar">
            {getInitials(
              item.patientName
            )}
          </span>

          <div>
            <h3>
              {item.patientName}
            </h3>

            <p>
              {item.patientCode ||
                "بدون رقم ملف"}
            </p>
          </div>
        </div>

        <div className="queue-drawer-info">
          <DrawerInfo
            label="رقم الهاتف"
            value={
              item.patientPhone ||
              "غير مسجل"
            }
          />

          <DrawerInfo
            label="وقت الوصول"
            value={
              formatClock(
                item.checkedInAt ||
                  item.createdAt
              )
            }
          />

          <DrawerInfo
            label="مدة الانتظار"
            value={
              formatWaiting(
                getWaitingMinutes(
                  item,
                  now
                )
              )
            }
          />

          <DrawerInfo
            label="نوع الزيارة"
            value={
              item.type ||
              "كشف"
            }
          />

          <DrawerInfo
            label="مصدر الزيارة"
            value={
              getSourceLabel(
                item.source
              )
            }
          />

          <DrawerInfo
            label="الطبيب"
            value={
              item.doctorName ||
              "غير محدد"
            }
          />
        </div>

        {item.notes && (
          <div className="queue-drawer-notes">
            <span>
              ملاحظات الاستقبال
            </span>

            <p>
              {item.notes}
            </p>
          </div>
        )}

        <div className="queue-drawer-actions">
          <button
            type="button"
            className="drawer-secondary"
            onClick={
              onProfile
            }
          >
            <UserRound
              size={16}
            />

            ملف المريض
          </button>

          <button
            type="button"
            className="drawer-primary"
            disabled={
              loading
            }
            onClick={
              onStart
            }
          >
            {loading ? (
              <LoaderCircle
                size={16}
                className="queue-spinner"
              />
            ) : (
              <Stethoscope
                size={16}
              />
            )}

            بدء الكشف
          </button>
        </div>
      </aside>
    </div>
  );
}

/* =========================================================
   REPRESENTATIVE RECEPTION
   ========================================================= */

function RepresentativeReception({
  representatives,
  visits,
  search,
  onSearch,
  doctors,
  selectedDoctorId,
  onDoctorChange,
  selectedDoctor,
  settings,
  visitsOpen,
  waitingCount,
  actionId,
  onAdd,
  onDetails,
}) {
  return (
    <section className="rep-reception-page">
      {/* STATUS */}

      <div
        className={`rep-reception-status ${
          visitsOpen
            ? "is-open"
            : "is-closed"
        }`}
      >
        <div className="rep-reception-status-main">
          <span className="rep-live-indicator" />

          <div>
            <strong>
              {visitsOpen
                ? "قسم زيارات المندوبين مفتوح"
                : "قسم زيارات المندوبين مغلق"}
            </strong>

            <span>
              {visitsOpen
                ? `يمكن تسجيل مندوبين لدى ${
                    selectedDoctor
                      ?.name ||
                    "الطبيب"
                  }`
                : `${
                    selectedDoctor
                      ?.name ||
                    "الطبيب"
                  } أغلق استقبال المندوبين اليوم`}
            </span>
          </div>
        </div>

        <div className="rep-doctor-select">
          <Stethoscope
            size={15}
          />

          <select
            value={
              selectedDoctorId
            }
            onChange={(
              event
            ) =>
              onDoctorChange(
                event.target
                  .value
              )
            }
          >
            {doctors.length ===
            0 ? (
              <option value="">
                لا يوجد أطباء
              </option>
            ) : (
              doctors.map(
                (doctor) => (
                  <option
                    key={
                      doctor.id
                    }
                    value={
                      doctor.id
                    }
                  >
                    {doctor.name}
                  </option>
                )
              )
            )}
          </select>
        </div>
      </div>

      {/* CLOSED */}

      {!visitsOpen && (
        <div className="rep-closed-banner">
          <AlertCircle
            size={18}
          />

          <div>
            <strong>
              استقبال المندوبين مغلق
            </strong>

            <span>
              {selectedDoctor
                ?.name ||
                "الطبيب"}{" "}
              أغلق استقبال المندوبين
              اليوم. يمكنك البحث وعرض
              بيانات المندوبين، ولكن لا
              يمكن إضافة مندوب جديد
              للانتظار.
            </span>
          </div>
        </div>
      )}

      {/* SEARCH */}

      <div className="rep-toolbar">
        <div className="queue-search">
          <Search
            size={17}
          />

          <input
            value={
              search
            }
            onChange={(
              event
            ) =>
              onSearch(
                event.target
                  .value
              )
            }
            placeholder="ابحث باسم المندوب، الكود، الهاتف أو الشركة..."
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                onSearch("")
              }
            >
              <X
                size={14}
              />
            </button>
          )}
        </div>

        <div className="rep-toolbar-info">
          <span>
            <BriefcaseBusiness
              size={14}
            />

            {
              representatives.length
            }{" "}
            مندوب
          </span>

          <span>
            <UsersRound
              size={14}
            />

            {
              waitingCount
            }{" "}
            في الانتظار
          </span>

          <span>
            الحد اليومي{" "}
            {
              settings
                ?.dailyVisitLimit ||
              6
            }
          </span>
        </div>
      </div>

      {/* LIST */}

      {representatives.length ===
      0 ? (
        <div className="queue-empty">
          <span className="queue-empty-icon">
            <BriefcaseBusiness
              size={27}
            />
          </span>

          <strong>
            لا يوجد مندوبون مطابقون
          </strong>

          <p>
            جرّب البحث بالاسم أو رقم
            الهاتف أو كود المندوب أو
            اسم الشركة.
          </p>
        </div>
      ) : (
        <div className="rep-list">
          <div className="rep-list-header">
            <span>
              المندوب
            </span>

            <span>
              الشركة / الجهة
            </span>

            <span>
              الطبيب
            </span>

            <span>
              الشهر
            </span>

            <span>
              الحالة
            </span>

            <span>
              الإجراء
            </span>
          </div>

          {representatives.map(
            (
              representative
            ) => {
              const usage =
                getRepresentativeUsage({
                  representative,

                  visits,
                });

              const exceeded =
                Boolean(
                  usage
                    ?.monthlyExceeded
                );

              const monthlyLimit =
                Number(
                  usage
                    ?.monthlyLimit
                ) || 0;

              const monthlyCompleted =
                Number(
                  usage
                    ?.monthlyCompleted
                ) || 0;

              const remaining =
                usage
                  ?.monthlyRemaining;

              const actionLoading =
                actionId ===
                representative.id;

              return (
                <article
                  key={
                    representative.id
                  }
                  className={`rep-row ${
                    exceeded
                      ? "is-exceeded"
                      : ""
                  }`}
                >
                  {/* REPRESENTATIVE */}

                  <button
                    type="button"
                    className="rep-main"
                    onClick={() =>
                      onDetails(
                        representative
                      )
                    }
                  >
                    <span className="queue-avatar">
                      {getInitials(
                        representative.name
                      )}
                    </span>

                    <span>
                      <strong>
                        {
                          representative.name
                        }
                      </strong>

                      <small>
                        {representative.code ||
                          "بدون كود"}

                        {" · "}

                        {representative.phone ||
                          "بدون هاتف"}
                      </small>
                    </span>
                  </button>

                  {/* COMPANY */}

                  <div className="rep-cell">
                    <Building2
                      size={14}
                    />

                    <span>
                      <strong>
                        {representative
                          .organizationName ||
                          "غير محدد"}
                      </strong>

                      <small>
                        {representative
                          .organizationTypeLabel ||
                          "جهة أخرى"}
                      </small>
                    </span>
                  </div>

                  {/* DOCTOR */}

                  <div className="rep-cell">
                    <Stethoscope
                      size={14}
                    />

                    <span>
                      {representative
                        .assignedDoctorName ||
                        selectedDoctor
                          ?.name ||
                        "غير محدد"}
                    </span>
                  </div>

                  {/* MONTH */}

                  <div className="rep-usage">
                    <strong>
                      {
                        monthlyCompleted
                      }
                      {" / "}
                      {monthlyLimit >
                      0
                        ? monthlyLimit
                        : "∞"}
                    </strong>

                    <small>
                      {monthlyLimit >
                      0
                        ? `متبقي ${
                            remaining ??
                            0
                          }`
                        : "بدون حد شهري"}
                    </small>
                  </div>

                  {/* STATUS */}

                  <div
                    className={
                      exceeded
                        ? "rep-danger"
                        : "rep-ok"
                    }
                  >
                    {exceeded ? (
                      <>
                        <AlertCircle
                          size={14}
                        />

                        استنفد الزيارات
                      </>
                    ) : (
                      <>
                        <CheckCircle2
                          size={14}
                        />

                        متاح
                      </>
                    )}
                  </div>

                  {/* ACTION */}

                  <div className="rep-actions">
                    <button
                      type="button"
                      className="rep-details"
                      onClick={() =>
                        onDetails(
                          representative
                        )
                      }
                    >
                      التفاصيل
                    </button>

                    <button
                      type="button"
                      className="rep-add"
                      disabled={
                        !visitsOpen ||
                        exceeded ||
                        actionLoading ||
                        !selectedDoctorId
                      }
                      onClick={() =>
                        onAdd(
                          representative
                        )
                      }
                    >
                      {actionLoading ? (
                        <LoaderCircle
                          size={15}
                          className="queue-spinner"
                        />
                      ) : (
                        <UsersRound
                          size={15}
                        />
                      )}

                      إضافة للانتظار
                    </button>
                  </div>

                  {exceeded && (
                    <p className="rep-reason">
                      استنفد عدد الزيارات
                      المسموح بها هذا الشهر
                      (
                      {
                        monthlyCompleted
                      }
                      /
                      {
                        monthlyLimit
                      }
                      ).
                    </p>
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

/* =========================================================
   REPRESENTATIVE DRAWER
   ========================================================= */

function RepresentativeDrawer({
  representative,
  visits,
  visitsOpen,
  loading,
  onClose,
  onAdd,
}) {
  const usage =
    getRepresentativeUsage({
      representative,

      visits,
    });

  const history =
    useMemo(
      () =>
        visits
          .filter(
            (visit) =>
              visit
                .representativeId ===
              representative.id
          )
          .sort(
            (a, b) =>
              normalizeTimestamp(
                b.completedAt ||
                  b.startedAt ||
                  b.arrivedAt ||
                  b.createdAt
              ) -
              normalizeTimestamp(
                a.completedAt ||
                  a.startedAt ||
                  a.arrivedAt ||
                  a.createdAt
              )
          ),
      [
        visits,
        representative.id,
      ]
    );

  function getStatusLabel(
    status
  ) {
    if (
      status ===
      VISIT_STATUS.COMPLETED
    ) {
      return "مكتملة";
    }

    if (
      status ===
      VISIT_STATUS.IN_VISIT
    ) {
      return "داخل الزيارة";
    }

    if (
      status ===
        VISIT_STATUS.WAITING ||
      status ===
        VISIT_STATUS.ARRIVED
    ) {
      return "في الانتظار";
    }

    if (
      status ===
      VISIT_STATUS.CANCELLED
    ) {
      return "ملغاة";
    }

    if (
      status ===
      VISIT_STATUS.REJECTED
    ) {
      return "مرفوضة";
    }

    if (
      status ===
      VISIT_STATUS.SCHEDULED
    ) {
      return "مجدولة";
    }

    return "مسجلة";
  }

  const monthlyLimit =
    Number(
      usage?.monthlyLimit
    ) || 0;

  const monthlyCompleted =
    Number(
      usage
        ?.monthlyCompleted
    ) || 0;

  return (
    <div className="queue-drawer-layer">
      <button
        type="button"
        className="queue-drawer-backdrop"
        onClick={
          onClose
        }
        aria-label="إغلاق"
      />

      <aside className="queue-drawer">
        <header className="queue-drawer-header">
          <div>
            <span>
              ملف المندوب
            </span>

            <h2>
              تفاصيل المندوب
            </h2>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
          >
            <X
              size={18}
            />
          </button>
        </header>

        <div className="queue-drawer-patient">
          <span className="queue-drawer-avatar">
            {getInitials(
              representative.name
            )}
          </span>

          <div>
            <h3>
              {
                representative.name
              }
            </h3>

            <p>
              {representative.code ||
                "بدون كود"}

              {" · "}

              {representative.phone ||
                "بدون هاتف"}
            </p>
          </div>
        </div>

        {usage
          ?.monthlyExceeded && (
          <div className="rep-closed-banner">
            <AlertCircle
              size={18}
            />

            <div>
              <strong>
                استنفد الحد الشهري
              </strong>

              <span>
                تمت{" "}
                {
                  monthlyCompleted
                }{" "}
                من{" "}
                {
                  monthlyLimit
                }{" "}
                زيارة مسموحة هذا الشهر.
              </span>
            </div>
          </div>
        )}

        {!visitsOpen && (
          <div className="rep-closed-banner">
            <AlertCircle
              size={18}
            />

            <div>
              <strong>
                استقبال المندوبين مغلق
              </strong>

              <span>
                لا يمكن إضافة زيارة جديدة
                لهذا الطبيب اليوم.
              </span>
            </div>
          </div>
        )}

        <div className="queue-drawer-info">
          <DrawerInfo
            label="الشركة / الجهة"
            value={
              representative
                .organizationName ||
              "غير محدد"
            }
          />

          <DrawerInfo
            label="نوع الجهة"
            value={
              representative
                .organizationTypeLabel ||
              "جهة أخرى"
            }
          />

          <DrawerInfo
            label="رقم الهاتف"
            value={
              representative.phone ||
              "غير مسجل"
            }
          />

          <DrawerInfo
            label="الطبيب"
            value={
              representative
                .assignedDoctorName ||
              "غير محدد"
            }
          />

          <DrawerInfo
            label="المسموح شهريًا"
            value={
              monthlyLimit > 0
                ? `${monthlyLimit} زيارة`
                : "بدون حد"
            }
          />

          <DrawerInfo
            label="تمت هذا الشهر"
            value={`${monthlyCompleted} زيارة`}
          />

          <DrawerInfo
            label="المتبقي"
            value={
              usage
                ?.monthlyRemaining ==
              null
                ? "غير محدود"
                : `${usage.monthlyRemaining} زيارة`
            }
          />

          <DrawerInfo
            label="حالة القسم"
            value={
              visitsOpen
                ? "مفتوح"
                : "مغلق اليوم"
            }
          />
        </div>

        {representative
          .notes && (
          <div className="queue-drawer-notes">
            <span>
              ملاحظات
            </span>

            <p>
              {
                representative
                  .notes
              }
            </p>
          </div>
        )}

        {/* VISIT HISTORY */}

        <div className="rep-history">
          <div className="rep-history-title">
            <strong>
              سجل الزيارات
            </strong>

            <span>
              {history.length}
            </span>
          </div>

          {history.length ===
          0 ? (
            <div className="rep-history-empty">
              لا توجد زيارات مسجلة لهذا
              المندوب حتى الآن.
            </div>
          ) : (
            <div className="rep-history-list">
              {history.map(
                (visit) => {
                  const timestamp =
                    visit.completedAt ||
                    visit.startedAt ||
                    visit.arrivedAt ||
                    visit.createdAt;

                  return (
                    <div
                      key={
                        visit.id
                      }
                      className="rep-history-row"
                    >
                      <div>
                        <strong>
                          {formatDate(
                            timestamp
                          )}
                        </strong>

                        <span>
                          {formatClock(
                            timestamp
                          )}
                        </span>
                      </div>

                      <span
                        className={`rep-history-status rep-history-status-${visit.status}`}
                      >
                        {getStatusLabel(
                          visit.status
                        )}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        <div className="queue-drawer-actions">
          <button
            type="button"
            className="drawer-secondary"
            onClick={
              onClose
            }
          >
            إغلاق
          </button>

          <button
            type="button"
            className="drawer-primary"
            disabled={
              loading ||
              usage
                ?.monthlyExceeded ||
              !visitsOpen
            }
            onClick={
              onAdd
            }
          >
            {loading ? (
              <LoaderCircle
                size={16}
                className="queue-spinner"
              />
            ) : (
              <UsersRound
                size={16}
              />
            )}

            {usage
              ?.monthlyExceeded
              ? "استنفد الزيارات"
              : !visitsOpen
                ? "القسم مغلق"
                : "إضافة للانتظار"}
          </button>
        </div>
      </aside>
    </div>
  );
}

/* =========================================================
   DRAWER INFO
   ========================================================= */

function DrawerInfo({
  label,
  value,
}) {
  return (
    <div>
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}