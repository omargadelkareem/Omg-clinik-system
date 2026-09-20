import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertCircle,
  ArrowLeft,
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

import "./QueuePage.css";

/* =========================================================
   HELPERS
   ========================================================= */

function normalizeTimestamp(
  value
) {
  if (
    typeof value === "number"
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    const numeric =
      Number(value);

    if (
      Number.isFinite(
        numeric
      )
    ) {
      return numeric;
    }

    const parsed =
      new Date(
        value
      ).getTime();

    return Number.isNaN(
      parsed
    )
      ? 0
      : parsed;
  }

  return 0;
}

function formatClock(
  value
) {
  const timestamp =
    normalizeTimestamp(
      value
    );

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
    new Date(
      timestamp
    )
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
    item.status ===
      "in-progress"
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

function formatWaiting(
  minutes
) {
  if (
    minutes < 1
  ) {
    return "أقل من دقيقة";
  }

  if (
    minutes < 60
  ) {
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
  return String(
    name
  )
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

function getSourceLabel(
  source
) {
  if (
    source ===
      "walk-in" ||
    source ===
      "walk_in"
  ) {
    return "بدون حجز";
  }

  if (
    source ===
    "appointment"
  ) {
    return "موعد";
  }

  return "استقبال";
}

function getPriorityLabel(
  priority
) {
  switch (
    priority
  ) {
    case "urgent":
      return "عاجل";

    case "high":
      return "أولوية";

    default:
      return "";
  }
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
  } = useAuth();

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
        type:
          "success",

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

     Updates waiting time every minute.
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
          setToast(
            null
          );
        },
        4000
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [toast]);

  /* =======================================================
     REALTIME QUEUE
     ======================================================= */

  useEffect(() => {
    if (!clinicId) {
      return;
    }

    setLoading(
      true
    );

    setError("");

    const unsubscribe =
      subscribeQueue(
        clinicId,

        (items) => {
          setQueue(
            items
          );

          setLoading(
            false
          );
        },

        (
          firebaseError
        ) => {
          console.error(
            "Queue realtime error:",
            firebaseError
          );

          setError(
            "تعذر تحميل قائمة الانتظار."
          );

          setLoading(
            false
          );
        }
      );

    return () =>
      unsubscribe?.();
  }, [clinicId]);

  /* =======================================================
     FILTER
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

  /* =======================================================
     GROUPS
     ======================================================= */

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
     START VISIT
     ======================================================= */

  const handleStartVisit =
    async (
      item
    ) => {
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

        /*
          Appointment patient:
          use existing atomic service so both
          appointment and queue become in-progress.
        */

        if (
          item.appointmentId
        ) {
          const appointment =
            {
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
                  result.appointmentId ||
                  item.appointmentId,

                queueId:
                  result.queueId ||
                  item.id,

                fromQueue:
                  true,

                source:
                  "queue",
              },
            }
          );

          return;
        }

        /*
          Walk-in has no appointment.
          Queue is already waiting.

          We need to mark only queue as
          in-progress. Since the current
          appointment service's start method
          expects an appointment, this helper
          is handled below by the service
          function added after this file.
        */

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
                result.queueId,

              fromQueue:
                true,

              source:
                "queue",
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
          "تعذر بدء الكشف. حاول مرة أخرى."
        );
      } finally {
        setActiveActionId(
          ""
        );
      }
    };

  /* =======================================================
     WALK-IN START

     Imported dynamically from helper below isn't possible,
     so implementation uses the exported service function.
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
      {/* HEADER */}

      <header className="queue-header">
        <div className="queue-title">
          <span className="queue-eyebrow">
            CLINIC FLOW
          </span>

          <h1>
            قائمة الانتظار
          </h1>

          <p>
            متابعة حركة المرضى من الاستقبال حتى دخول الطبيب.
          </p>
        </div>

        <div className="queue-header-status">
          <span className="queue-live-dot" />

          تحديث مباشر
        </div>
      </header>

      {/* ERROR */}

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
              setError(
                ""
              )
            }
          >
            <X
              size={15}
            />
          </button>
        </div>
      )}

      {/* STATS */}

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

      {/* TOOLBAR */}

      <section className="queue-toolbar">
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

      {/* CURRENT VISIT */}

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
              <span>
                #
              </span>

              <span>
                المريض
              </span>

              <span>
                الوصول
              </span>

              <span>
                الانتظار
              </span>

              <span>
                نوع الزيارة
              </span>

              <span>
                الطبيب
              </span>

              <span>
                الإجراء
              </span>
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

      {/* PATIENT QUICK VIEW */}

      {selectedPatient && (
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

      {/* TOAST */}

      {toast && (
        <div
          className={`queue-toast queue-toast-${toast.type}`}
        >
          <CheckCircle2
            size={18}
          />

          <span>
            {
              toast.message
            }
          </span>

          <button
            type="button"
            onClick={() =>
              setToast(
                null
              )
            }
          >
            <X
              size={14}
            />
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
              {
                item.patientName
              }
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
            {
              item.patientName
            }
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
   DRAWER
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
            <X
              size={18}
            />
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
              {
                item.patientName
              }
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
            value={formatClock(
              item.checkedInAt ||
                item.createdAt
            )}
          />

          <DrawerInfo
            label="مدة الانتظار"
            value={formatWaiting(
              getWaitingMinutes(
                item,
                now
              )
            )}
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
            value={getSourceLabel(
              item.source
            )}
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
              {
                item.notes
              }
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