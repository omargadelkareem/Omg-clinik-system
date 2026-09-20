import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  ListOrdered,
  LoaderCircle,
  MapPin,
  Phone,
  Plus,
  Search,
  Stethoscope,
  UserCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../../context/AuthContext";

import {
  cancelAppointment,
  checkInAppointment,
  createAppointment,
  createPatientAndAppointment,
  createPatientAndWalkIn,
  createWalkIn,
  markAppointmentNoShow,
  startAppointmentVisit,
  subscribeAppointmentDoctors,
  subscribeAppointmentPatients,
  subscribeAppointments,
  subscribeQueue,
} from "../../services/appointmentService";

import "./AppointmentsPage.css";

/* =========================================================
   CONSTANTS
   ========================================================= */

const STATUS_META = {
  confirmed: {
    label:
      "مؤكد",
  },

  arrived: {
    label:
      "وصل",
  },

  "in-progress": {
    label:
      "داخل الكشف",
  },

  completed: {
    label:
      "مكتمل",
  },

  cancelled: {
    label:
      "ملغي",
  },

  "no-show": {
    label:
      "لم يحضر",
  },
};

const VISIT_TYPES = [
  "كشف",
  "متابعة",
  "استشارة",
  "إجراء",
];

const TIME_SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
];

/* =========================================================
   HELPERS
   ========================================================= */

function pad(
  value
) {
  return String(
    value
  ).padStart(
    2,
    "0"
  );
}

function toDateKey(
  date
) {
  return [
    date.getFullYear(),
    pad(
      date.getMonth() +
        1
    ),
    pad(
      date.getDate()
    ),
  ].join("-");
}

function fromDateKey(
  value
) {
  if (!value) {
    return new Date();
  }

  const [
    year,
    month,
    day,
  ] = value
    .split("-")
    .map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
}

function addDays(
  date,
  amount
) {
  const result =
    new Date(date);

  result.setDate(
    result.getDate() +
      amount
  );

  return result;
}

function startOfWeek(
  date
) {
  const result =
    new Date(date);

  const day =
    result.getDay();

  const difference =
    day === 6
      ? 0
      : day + 1;

  result.setDate(
    result.getDate() -
      difference
  );

  result.setHours(
    0,
    0,
    0,
    0
  );

  return result;
}

function buildWeek(
  selectedDate
) {
  const start =
    startOfWeek(
      selectedDate
    );

  return Array.from(
    {
      length: 7,
    },

    (_, index) => {
      const date =
        addDays(
          start,
          index
        );

      return {
        key:
          toDateKey(
            date
          ),

        date,

        dayName:
          new Intl.DateTimeFormat(
            "ar-EG",
            {
              weekday:
                "short",
            }
          ).format(
            date
          ),

        dayNumber:
          date.getDate(),

        monthName:
          new Intl.DateTimeFormat(
            "ar-EG",
            {
              month:
                "short",
            }
          ).format(
            date
          ),
      };
    }
  );
}

function formatFullDate(
  date
) {
  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(date);
}

function formatTimeLabel(
  value
) {
  if (!value) {
    return "";
  }

  const [
    hourValue,
    minuteValue,
  ] = value
    .split(":")
    .map(Number);

  const date =
    new Date();

  date.setHours(
    hourValue,
    minuteValue,
    0,
    0
  );

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      hour:
        "numeric",

      minute:
        "2-digit",
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

function getStatusMeta(
  status
) {
  return (
    STATUS_META[
      status
    ] ||
    {
      label:
        status ||
        "غير محدد",
    }
  );
}

function sameDay(
  appointment,
  dateKey
) {
  return (
    appointment.date ===
    dateKey
  );
}

function normalizeTimestamp(
  value
) {
  if (
    typeof value ===
    "number"
  ) {
    return value;
  }

  const parsed =
    new Date(
      value || 0
    ).getTime();

  return Number.isNaN(
    parsed
  )
    ? 0
    : parsed;
}

/* =========================================================
   PAGE
   ========================================================= */

export default function AppointmentsPage() {
  const navigate =
    useNavigate();

  const {
    clinicId,
    staffId,
    profile,
  } = useAuth();

  const todayKey =
    toDateKey(
      new Date()
    );

  const [
    selectedDateKey,
    setSelectedDateKey,
  ] = useState(
    todayKey
  );

  const [
    appointments,
    setAppointments,
  ] = useState([]);

  const [
    patients,
    setPatients,
  ] = useState([]);

  const [
    doctors,
    setDoctors,
  ] = useState([]);

  const [
    queue,
    setQueue,
  ] = useState([]);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    doctorFilter,
    setDoctorFilter,
  ] = useState(
    "all"
  );

  const [
    selectedAppointment,
    setSelectedAppointment,
  ] = useState(null);

  const [
    bookingOpen,
    setBookingOpen,
  ] = useState(false);

  const [
    walkInOpen,
    setWalkInOpen,
  ] = useState(false);

  const [
    defaultBookingTime,
    setDefaultBookingTime,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);

  const [
    toast,
    setToast,
  ] = useState(null);

  /* ======================================================
     REALTIME DATA
     ====================================================== */

  useEffect(() => {
    if (!clinicId) {
      return;
    }

    let loadedAppointments =
      false;

    let loadedPatients =
      false;

    let loadedDoctors =
      false;

    let loadedQueue =
      false;

    const checkLoaded =
      () => {
        if (
          loadedAppointments &&
          loadedPatients &&
          loadedDoctors &&
          loadedQueue
        ) {
          setLoading(
            false
          );
        }
      };

    setLoading(true);
    setError("");

    const unsubscribeAppointments =
      subscribeAppointments(
        clinicId,

        (data) => {
          setAppointments(
            data
          );

          loadedAppointments =
            true;

          checkLoaded();
        },

        () => {
          setError(
            "تعذر تحميل المواعيد."
          );

          loadedAppointments =
            true;

          checkLoaded();
        }
      );

    const unsubscribePatients =
      subscribeAppointmentPatients(
        clinicId,

        (data) => {
          setPatients(
            data
          );

          loadedPatients =
            true;

          checkLoaded();
        },

        () => {
          loadedPatients =
            true;

          checkLoaded();
        }
      );

    const unsubscribeDoctors =
      subscribeAppointmentDoctors(
        clinicId,

        (data) => {
          setDoctors(
            data
          );

          loadedDoctors =
            true;

          checkLoaded();
        },

        () => {
          loadedDoctors =
            true;

          checkLoaded();
        }
      );

    const unsubscribeQueue =
      subscribeQueue(
        clinicId,

        (data) => {
          setQueue(
            data
          );

          loadedQueue =
            true;

          checkLoaded();
        },

        () => {
          loadedQueue =
            true;

          checkLoaded();
        }
      );

    return () => {
      unsubscribeAppointments?.();
      unsubscribePatients?.();
      unsubscribeDoctors?.();
      unsubscribeQueue?.();
    };
  }, [
    clinicId,
  ]);

  /* ======================================================
     TOAST
     ====================================================== */

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          setToast(null);
        },
        3500
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [
    toast,
  ]);

  /* ======================================================
     DERIVED DATA
     ====================================================== */

  const selectedDate =
    useMemo(
      () =>
        fromDateKey(
          selectedDateKey
        ),
      [
        selectedDateKey,
      ]
    );

  const week =
    useMemo(
      () =>
        buildWeek(
          selectedDate
        ),
      [
        selectedDate,
      ]
    );

  const selectedDayAppointments =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        return appointments
          .filter(
            (appointment) =>
              sameDay(
                appointment,
                selectedDateKey
              )
          )
          .filter(
            (appointment) =>
              doctorFilter ===
                "all" ||
              appointment.doctorId ===
                doctorFilter
          )
          .filter(
            (appointment) => {
              if (!query) {
                return true;
              }

              return [
                appointment.patientName,
                appointment.patientPhone,
                appointment.patientCode,
                appointment.doctorName,
                appointment.type,
              ]
                .filter(Boolean)
                .some(
                  (value) =>
                    String(
                      value
                    )
                      .toLowerCase()
                      .includes(
                        query
                      )
                );
            }
          )
          .sort(
            (a, b) =>
              String(
                a.time || ""
              ).localeCompare(
                String(
                  b.time || ""
                )
              )
          );
      },
      [
        appointments,
        selectedDateKey,
        doctorFilter,
        search,
      ]
    );

  const appointmentsByTime =
    useMemo(
      () => {
        const result = {};

        selectedDayAppointments.forEach(
          (appointment) => {
            const time =
              appointment.time ||
              "00:00";

            if (!result[time]) {
              result[time] =
                [];
            }

            result[
              time
            ].push(
              appointment
            );
          }
        );

        return result;
      },
      [
        selectedDayAppointments,
      ]
    );

  const selectedDateAllAppointments =
    useMemo(
      () =>
        appointments.filter(
          (appointment) =>
            appointment.date ===
            selectedDateKey
        ),
      [
        appointments,
        selectedDateKey,
      ]
    );

  const stats =
    useMemo(
      () => {
        const dayAppointments =
          selectedDateAllAppointments;

        return {
          total:
            dayAppointments.filter(
              (item) =>
                item.status !==
                "cancelled"
            ).length,

          arrived:
            dayAppointments.filter(
              (item) =>
                item.status ===
                "arrived"
            ).length,

          inProgress:
            dayAppointments.filter(
              (item) =>
                item.status ===
                "in-progress"
            ).length,

          completed:
            dayAppointments.filter(
              (item) =>
                item.status ===
                "completed"
            ).length,
        };
      },
      [
        selectedDateAllAppointments,
      ]
    );

  const upcomingAppointments =
    useMemo(
      () =>
        selectedDateAllAppointments
          .filter(
            (appointment) =>
              [
                "confirmed",
                "arrived",
              ].includes(
                appointment.status
              )
          )
          .sort(
            (a, b) =>
              String(
                a.time
              ).localeCompare(
                String(
                  b.time
                )
              )
          )
          .slice(
            0,
            5
          ),
      [
        selectedDateAllAppointments,
      ]
    );

  const activeQueue =
    useMemo(
      () =>
        queue.filter(
          (item) =>
            [
              "waiting",
              "in-progress",
            ].includes(
              item.status
            )
        ),
      [
        queue,
      ]
    );

  /* ======================================================
     NAVIGATION
     ====================================================== */

  function moveWeek(
    amount
  ) {
    const next =
      addDays(
        selectedDate,
        amount * 7
      );

    setSelectedDateKey(
      toDateKey(next)
    );
  }

  function goToday() {
    setSelectedDateKey(
      todayKey
    );
  }

  function openBooking(
    time = ""
  ) {
    setDefaultBookingTime(
      time
    );

    setBookingOpen(
      true
    );
  }

  /* ======================================================
     APPOINTMENT ACTIONS
     ====================================================== */

  async function handleCheckIn(
    appointment
  ) {
    try {
      setActionLoading(
        true
      );

      await checkInAppointment({
        clinicId,

        appointment,

        staffId:
          staffId ||
          profile?.staffId ||
          "",
      });

      setSelectedAppointment(
        null
      );

      setToast({
        type:
          "success",

        message:
          "تم تسجيل وصول المريض وإضافته لقائمة الانتظار.",
      });
    } catch (actionError) {
      setToast({
        type:
          "error",

        message:
          actionError.message ||
          "تعذر تسجيل وصول المريض.",
      });
    } finally {
      setActionLoading(
        false
      );
    }
  }

  async function handleCancel(
    appointment
  ) {
    try {
      setActionLoading(
        true
      );

      await cancelAppointment(
        clinicId,
        appointment.id
      );

      setSelectedAppointment(
        null
      );

      setToast({
        type:
          "success",

        message:
          "تم إلغاء الموعد.",
      });
    } catch (actionError) {
      setToast({
        type:
          "error",

        message:
          actionError.message ||
          "تعذر إلغاء الموعد.",
      });
    } finally {
      setActionLoading(
        false
      );
    }
  }

  async function handleNoShow(
    appointment
  ) {
    try {
      setActionLoading(
        true
      );

      await markAppointmentNoShow(
        clinicId,
        appointment.id
      );

      setSelectedAppointment(
        null
      );

      setToast({
        type:
          "success",

        message:
          "تم تسجيل المريض كعدم حضور.",
      });
    } catch (actionError) {
      setToast({
        type:
          "error",

        message:
          actionError.message ||
          "تعذر تحديث الموعد.",
      });
    } finally {
      setActionLoading(
        false
      );
    }
  }

  async function handleStartVisit(
    appointment
  ) {
    try {
      setActionLoading(
        true
      );

      const result =
        await startAppointmentVisit({
          clinicId,
          appointment,
          queueId:
            appointment.queueId,
        });

      setSelectedAppointment(
        null
      );

      navigate(
        `/patients/${appointment.patientId}/visit/new`,
        {
          state: {
            appointmentId:
              result.appointmentId,

            queueId:
              result.queueId,

            source:
              "appointment",
          },
        }
      );
    } catch (actionError) {
      setToast({
        type:
          "error",

        message:
          actionError.message ||
          "تعذر بدء الكشف.",
      });
    } finally {
      setActionLoading(
        false
      );
    }
  }

  /* ======================================================
     LOADING
     ====================================================== */

  if (loading) {
    return (
      <div className="appointments-page">
        <div className="appointments-state">
          <LoaderCircle
            size={28}
            className="appointments-loader"
          />

          <strong>
            جاري تجهيز المواعيد
          </strong>

          <span>
            يتم قراءة بيانات العيادة...
          </span>
        </div>
      </div>
    );
  }

  /* ======================================================
     UI
     ====================================================== */

  return (
    <div className="appointments-page">

      {toast && (
        <div
          className={`appointments-toast ${toast.type}`}
        >
          {toast.type ===
          "success" ? (
            <Check
              size={18}
            />
          ) : (
            <CircleAlert
              size={18}
            />
          )}

          <span>
            {toast.message}
          </span>

          <button
            type="button"
            onClick={() =>
              setToast(null)
            }
          >
            <X
              size={16}
            />
          </button>
        </div>
      )}

      {/* =================================================
          HEADER
          ================================================= */}

      <header className="appointments-header">

        <div className="appointments-title">
          <span className="appointments-eyebrow">
            RECEPTION DESK
          </span>

          <h1>
            المواعيد
          </h1>

          <p>
            إدارة جدول العيادة واستقبال المرضى
            ومتابعة دورة الزيارة.
          </p>
        </div>

        <div className="appointments-header-actions">

          <label className="appointment-search">
            <Search
              size={17}
            />

            <input
              type="text"
              value={search}
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="ابحث باسم المريض أو الهاتف أو رقم الملف..."
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
              >
                <X
                  size={15}
                />
              </button>
            )}
          </label>

          <button
            type="button"
            className="walkin-button"
            onClick={() =>
              setWalkInOpen(
                true
              )
            }
          >
            <UserCheck
              size={17}
            />

            مريض بدون موعد
          </button>

          <button
            type="button"
            className="new-appointment-button"
            onClick={() =>
              openBooking()
            }
          >
            <Plus
              size={17}
            />

            حجز موعد
          </button>

        </div>

      </header>

      {/* =================================================
          WEEK
          ================================================= */}

      <section className="schedule-navigation">

        <button
          type="button"
          className="date-nav-button"
          onClick={() =>
            moveWeek(-1)
          }
          aria-label="الأسبوع السابق"
        >
          <ChevronRight
            size={17}
          />
        </button>

        <div className="week-strip">

          {week.map(
            (day) => (
              <button
                type="button"
                key={
                  day.key
                }
                className={
                  day.key ===
                  selectedDateKey
                    ? "week-day active"
                    : "week-day"
                }
                onClick={() =>
                  setSelectedDateKey(
                    day.key
                  )
                }
              >
                <span>
                  {
                    day.dayName
                  }
                </span>

                <strong>
                  {
                    day.dayNumber
                  }
                </strong>

                <small>
                  {
                    day.monthName
                  }
                </small>
              </button>
            )
          )}

        </div>

        <button
          type="button"
          className="today-button"
          onClick={
            goToday
          }
        >
          اليوم
        </button>

        <button
          type="button"
          className="date-nav-button"
          onClick={() =>
            moveWeek(1)
          }
          aria-label="الأسبوع التالي"
        >
          <ChevronLeft
            size={17}
          />
        </button>

      </section>

      {/* =================================================
          DESK
          ================================================= */}

      <section className="reception-desk">

        <main className="schedule-workspace">

          <div className="schedule-toolbar">

            <label className="doctor-filter">
              <Stethoscope
                size={16}
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
                  جميع الأطباء
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

            <div className="schedule-day-heading">
              <strong>
                {formatFullDate(
                  selectedDate
                )}
              </strong>

              <span>
                {
                  selectedDayAppointments.length
                }{" "}
                موعد ظاهر
              </span>
            </div>

            <div className="schedule-live-indicator">
              <i />

              Realtime
            </div>

          </div>

          {error && (
            <div className="appointments-inline-error">
              <CircleAlert
                size={17}
              />

              {error}
            </div>
          )}

          <div className="timeline">

            {TIME_SLOTS.map(
              (time) => {
                const slotAppointments =
                  appointmentsByTime[
                    time
                  ] || [];

                return (
                  <div
                    className="timeline-row"
                    key={
                      time
                    }
                  >
                    <div className="timeline-time">
                      <strong>
                        {formatTimeLabel(
                          time
                        )}
                      </strong>
                    </div>

                    <div className="timeline-slot">

                      <span className="slot-line" />

                      {slotAppointments.length ===
                      0 ? (
                        <button
                          type="button"
                          className="empty-time-slot"
                          onClick={() =>
                            openBooking(
                              time
                            )
                          }
                        >
                          <Plus
                            size={14}
                          />

                          حجز في هذا الوقت
                        </button>
                      ) : (
                        <div className="slot-appointments">

                          {slotAppointments.map(
                            (
                              appointment
                            ) => (
                              <AppointmentRow
                                key={
                                  appointment.id
                                }
                                appointment={
                                  appointment
                                }
                                onClick={() =>
                                  setSelectedAppointment(
                                    appointment
                                  )
                                }
                              />
                            )
                          )}

                        </div>
                      )}

                    </div>
                  </div>
                );
              }
            )}

          </div>

        </main>

        {/* ===============================================
            RECEPTION RAIL
            =============================================== */}

        <aside className="reception-rail">

          <div className="reception-rail-heading">
            <div>
              <span>
                DAILY FLOW
              </span>

              <strong>
                حالة اليوم
              </strong>
            </div>

            <CalendarDays
              size={18}
            />
          </div>

          <div className="reception-numbers">

            <div className="reception-number">
              <strong>
                {
                  stats.total
                }
              </strong>

              <span>
                مواعيد
              </span>
            </div>

            <div className="reception-number">
              <strong>
                {
                  activeQueue.filter(
                    (item) =>
                      item.status ===
                      "waiting"
                  ).length
                }
              </strong>

              <span>
                في الانتظار
              </span>
            </div>

            <div className="reception-number">
              <strong>
                {
                  stats.inProgress
                }
              </strong>

              <span>
                داخل الكشف
              </span>
            </div>

            <div className="reception-number">
              <strong>
                {
                  stats.completed
                }
              </strong>

              <span>
                مكتمل
              </span>
            </div>

          </div>

          <div className="rail-separator" />

          <div className="next-patients-heading">
            <strong>
              المواعيد التالية
            </strong>

            <span>
              {
                upcomingAppointments.length
              }{" "}
              مريض
            </span>
          </div>

          {upcomingAppointments.length ===
          0 ? (
            <div className="rail-empty">
              لا توجد مواعيد قادمة في هذا اليوم.
            </div>
          ) : (
            <div className="next-patients-list">

              {upcomingAppointments.map(
                (
                  appointment
                ) => (
                  <button
                    type="button"
                    className="next-patient"
                    key={
                      appointment.id
                    }
                    onClick={() =>
                      setSelectedAppointment(
                        appointment
                      )
                    }
                  >
                    <span className="next-time">
                      {formatTimeLabel(
                        appointment.time
                      )}
                    </span>

                    <div>
                      <strong>
                        {
                          appointment.patientName
                        }
                      </strong>

                      <span>
                        {appointment.type}

                        {appointment.doctorName
                          ? ` • ${appointment.doctorName}`
                          : ""}
                      </span>
                    </div>

                    <i
                      className={`patient-state ${appointment.status}`}
                    />
                  </button>
                )
              )}

            </div>
          )}

          <div className="rail-separator" />

          <button
            type="button"
            className="queue-link"
            onClick={() =>
              navigate(
                "/queue"
              )
            }
          >
            <span className="queue-link-icon">
              <ListOrdered
                size={17}
              />
            </span>

            <div>
              <strong>
                قائمة الانتظار
              </strong>

              <span>
                {
                  activeQueue.length
                }{" "}
                مريض حاليًا
              </span>
            </div>

            <ChevronLeft
              size={16}
            />
          </button>

        </aside>

      </section>

      {/* =================================================
          DETAILS
          ================================================= */}

      {selectedAppointment && (
        <AppointmentDetails
          appointment={
            selectedAppointment
          }
          actionLoading={
            actionLoading
          }
          onClose={() =>
            setSelectedAppointment(
              null
            )
          }
          onPatient={() => {
            navigate(
              `/patients/${selectedAppointment.patientId}`
            );
          }}
          onCheckIn={() =>
            handleCheckIn(
              selectedAppointment
            )
          }
          onStart={() =>
            handleStartVisit(
              selectedAppointment
            )
          }
          onCancel={() =>
            handleCancel(
              selectedAppointment
            )
          }
          onNoShow={() =>
            handleNoShow(
              selectedAppointment
            )
          }
        />
      )}

      {/* =================================================
          BOOKING
          ================================================= */}

      {bookingOpen && (
        <BookingModal
          clinicId={
            clinicId
          }
          patients={
            patients
          }
          doctors={
            doctors
          }
          selectedDateKey={
            selectedDateKey
          }
          defaultTime={
            defaultBookingTime
          }
          staffId={
            staffId ||
            profile?.staffId ||
            ""
          }
          onClose={() => {
            setBookingOpen(
              false
            );

            setDefaultBookingTime(
              ""
            );
          }}
          onSuccess={(
            message
          ) => {
            setBookingOpen(
              false
            );

            setDefaultBookingTime(
              ""
            );

            setToast({
              type:
                "success",

              message,
            });
          }}
        />
      )}

      {/* =================================================
          WALK IN
          ================================================= */}

      {walkInOpen && (
        <WalkInModal
          clinicId={
            clinicId
          }
          patients={
            patients
          }
          doctors={
            doctors
          }
          staffId={
            staffId ||
            profile?.staffId ||
            ""
          }
          onClose={() =>
            setWalkInOpen(
              false
            )
          }
          onSuccess={(
            message
          ) => {
            setWalkInOpen(
              false
            );

            setToast({
              type:
                "success",

              message,
            });
          }}
        />
      )}

    </div>
  );
}

/* =========================================================
   APPOINTMENT ROW
   ========================================================= */

function AppointmentRow({
  appointment,
  onClick,
}) {
  const status =
    getStatusMeta(
      appointment.status
    );

  return (
    <button
      type="button"
      className={`appointment-row appointment-${appointment.status}`}
      onClick={
        onClick
      }
    >
      <span className="appointment-color-line" />

      <div className="appointment-main">
        <strong>
          {
            appointment.patientName
          }
        </strong>

        <span>
          {appointment.patientPhone ||
            appointment.patientCode ||
            "بدون رقم هاتف"}
        </span>
      </div>

      <div className="appointment-type">
        <span>
          {appointment.type ||
            "كشف"}
        </span>
      </div>

      <div className="appointment-doctor">
        <Stethoscope
          size={15}
        />

        <div>
          <strong>
            {appointment.doctorName ||
              "غير محدد"}
          </strong>

          <span>
            {appointment.doctorSpecialty ||
              "العيادة"}
          </span>
        </div>
      </div>

      <div
        className={`schedule-status ${appointment.status}`}
      >
        <i />

        {
          status.label
        }
      </div>

      <ChevronLeft
        size={16}
      />
    </button>
  );
}

/* =========================================================
   DETAILS
   ========================================================= */

function AppointmentDetails({
  appointment,
  actionLoading,
  onClose,
  onPatient,
  onCheckIn,
  onStart,
  onCancel,
  onNoShow,
}) {
  const status =
    getStatusMeta(
      appointment.status
    );

  const canCheckIn =
    appointment.status ===
      "confirmed";

  const canStart =
    appointment.status ===
      "arrived";

  const canCancel =
    [
      "confirmed",
      "arrived",
    ].includes(
      appointment.status
    );

  const canNoShow =
    appointment.status ===
      "confirmed";

  return (
    <div className="appointment-details-layer">

      <button
        type="button"
        className="appointment-details-overlay"
        onClick={
          onClose
        }
        aria-label="إغلاق"
      />

      <aside className="appointment-details-panel">

        <div className="details-panel-header">

          <div>
            <span>
              APPOINTMENT
            </span>

            <strong>
              تفاصيل الموعد
            </strong>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
          >
            <X
              size={17}
            />
          </button>

        </div>

        <div className="appointment-patient-profile">

          <span className="appointment-avatar">
            {getInitials(
              appointment.patientName
            )}
          </span>

          <div>
            <h3>
              {
                appointment.patientName
              }
            </h3>

            <p>
              {appointment.patientCode ||
                "ملف مريض"}
            </p>
          </div>

          <span
            className={`appointment-status ${appointment.status}`}
          >
            {
              status.label
            }
          </span>

        </div>

        <div className="appointment-info-lines">

          <InfoLine
            icon={
              CalendarDays
            }
            label="التاريخ"
            value={
              appointment.date
            }
          />

          <InfoLine
            icon={Clock3}
            label="الوقت"
            value={formatTimeLabel(
              appointment.time
            )}
            small={`${appointment.duration || 30} دقيقة`}
          />

          <InfoLine
            icon={
              Stethoscope
            }
            label="الطبيب"
            value={
              appointment.doctorName ||
              "غير محدد"
            }
            small={
              appointment.doctorSpecialty
            }
          />

          <InfoLine
            icon={Phone}
            label="الهاتف"
            value={
              appointment.patientPhone ||
              "—"
            }
          />

        </div>

        {appointment.notes && (
          <div className="appointment-notes">
            <span>
              ملاحظات الحجز
            </span>

            <p>
              {
                appointment.notes
              }
            </p>
          </div>
        )}

        <div className="appointment-flow">

          <span>
            مسار المريض
          </span>

          <div className="appointment-flow-line">

            <FlowStep
              label="حجز"
              completed
            />

            <FlowStep
              label="وصل"
              completed={[
                "arrived",
                "in-progress",
                "completed",
              ].includes(
                appointment.status
              )}
            />

            <FlowStep
              label="كشف"
              completed={[
                "in-progress",
                "completed",
              ].includes(
                appointment.status
              )}
            />

            <FlowStep
              label="انتهى"
              completed={
                appointment.status ===
                "completed"
              }
            />

          </div>

        </div>

        <div className="appointment-details-actions">

          <button
            type="button"
            className="patient-profile-button"
            onClick={
              onPatient
            }
          >
            <UserRound
              size={16}
            />

            فتح ملف المريض
          </button>

          {canCheckIn && (
            <button
              type="button"
              className="patient-arrived-button"
              disabled={
                actionLoading
              }
              onClick={
                onCheckIn
              }
            >
              {actionLoading ? (
                <LoaderCircle
                  size={16}
                  className="appointments-loader"
                />
              ) : (
                <UserCheck
                  size={16}
                />
              )}

              تسجيل وصول المريض
            </button>
          )}

          {canStart && (
            <button
              type="button"
              className="start-visit-button"
              disabled={
                actionLoading
              }
              onClick={
                onStart
              }
            >
              <Stethoscope
                size={16}
              />

              بدء الكشف
            </button>
          )}

          {canNoShow && (
            <button
              type="button"
              className="no-show-button"
              disabled={
                actionLoading
              }
              onClick={
                onNoShow
              }
            >
              لم يحضر
            </button>
          )}

          {canCancel && (
            <button
              type="button"
              className="cancel-appointment-button"
              disabled={
                actionLoading
              }
              onClick={
                onCancel
              }
            >
              إلغاء الموعد
            </button>
          )}

        </div>

      </aside>
    </div>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
  small,
}) {
  return (
    <div className="appointment-info-line">

      <span className="info-line-icon">
        <Icon
          size={15}
        />
      </span>

      <div>
        <span>
          {label}
        </span>

        <strong>
          {value ||
            "—"}
        </strong>

        {small && (
          <small>
            {small}
          </small>
        )}
      </div>

    </div>
  );
}

function FlowStep({
  label,
  completed,
}) {
  return (
    <div
      className={
        completed
          ? "flow-step completed"
          : "flow-step"
      }
    >
      <i>
        {completed && (
          <Check
            size={9}
          />
        )}
      </i>

      <span>
        {label}
      </span>
    </div>
  );
}

/* =========================================================
   PATIENT PICKER
   ========================================================= */

function PatientPicker({
  patients,
  value,
  onChange,
}) {
  const [
    query,
    setQuery,
  ] = useState("");

  const results =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        if (!normalized) {
          return patients.slice(
            0,
            8
          );
        }

        return patients
          .filter(
            (patient) =>
              [
                patient.name,
                patient.phone,
                patient.patientCode,
              ]
                .filter(Boolean)
                .some(
                  (item) =>
                    String(
                      item
                    )
                      .toLowerCase()
                      .includes(
                        normalized
                      )
                )
          )
          .slice(
            0,
            8
          );
      },
      [
        patients,
        query,
      ]
    );

  if (value) {
    return (
      <div className="selected-patient-box">

        <span className="selected-patient-avatar">
          {getInitials(
            value.name
          )}
        </span>

        <div>
          <strong>
            {value.name}
          </strong>

          <span>
            {value.phone ||
              value.patientCode}
          </span>
        </div>

        <button
          type="button"
          onClick={() =>
            onChange(null)
          }
        >
          تغيير
        </button>

      </div>
    );
  }

  return (
    <div className="patient-picker">

      <label className="patient-picker-search">
        <Search
          size={16}
        />

        <input
          value={query}
          onChange={(
            event
          ) =>
            setQuery(
              event.target
                .value
            )
          }
          placeholder="ابحث باسم المريض أو الهاتف أو رقم الملف..."
        />
      </label>

      <div className="patient-picker-results">

        {results.length ===
        0 ? (
          <div className="patient-picker-empty">
            لا يوجد مريض مطابق.
          </div>
        ) : (
          results.map(
            (patient) => (
              <button
                type="button"
                key={
                  patient.id
                }
                onClick={() =>
                  onChange(
                    patient
                  )
                }
              >
                <span>
                  {getInitials(
                    patient.name
                  )}
                </span>

                <div>
                  <strong>
                    {
                      patient.name
                    }
                  </strong>

                  <small>
                    {patient.phone ||
                      "بدون هاتف"}

                    {patient.patientCode
                      ? ` • ${patient.patientCode}`
                      : ""}
                  </small>
                </div>

                <ChevronLeft
                  size={15}
                />
              </button>
            )
          )
        )}

      </div>

    </div>
  );
}

/* =========================================================
   BOOKING MODAL
   ========================================================= */

function BookingModal({
  clinicId,
  patients,
  doctors,
  selectedDateKey,
  defaultTime,
  staffId,
  onClose,
  onSuccess,
}) {
  const [
    patientMode,
    setPatientMode,
  ] = useState(
    "existing"
  );

  const [
    selectedPatient,
    setSelectedPatient,
  ] = useState(null);

  const [
    doctorId,
    setDoctorId,
  ] = useState(
    doctors[0]?.id ||
      ""
  );

  const [
    date,
    setDate,
  ] = useState(
    selectedDateKey
  );

  const [
    time,
    setTime,
  ] = useState(
    defaultTime ||
      "10:00"
  );

  const [
    duration,
    setDuration,
  ] = useState(30);

  const [
    type,
    setType,
  ] = useState(
    "كشف"
  );

  const [
    notes,
    setNotes,
  ] = useState("");

  const [
    newPatient,
    setNewPatient,
  ] = useState({
    name: "",
    phone: "",
    gender: "",
    dateOfBirth: "",
    address: "",
  });

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const selectedDoctor =
    doctors.find(
      (doctor) =>
        doctor.id ===
        doctorId
    ) || null;

  async function submit(
    event
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      if (
        patientMode ===
        "existing"
      ) {
        if (
          !selectedPatient
        ) {
          throw new Error(
            "اختر المريض أولًا."
          );
        }

        await createAppointment({
          clinicId,

          patient:
            selectedPatient,

          doctor:
            selectedDoctor,

          date,
          time,
          duration,
          type,
          notes,

          createdBy:
            staffId,
        });
      } else {
        await createPatientAndAppointment({
          clinicId,

          patientData:
            newPatient,

          doctor:
            selectedDoctor,

          date,
          time,
          duration,
          type,
          notes,

          createdBy:
            staffId,
        });
      }

      onSuccess(
        "تم حجز الموعد بنجاح."
      );
    } catch (submitError) {
      setError(
        submitError.message ||
          "تعذر حفظ الموعد."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="booking-modal-layer">

      <button
        type="button"
        className="booking-modal-overlay"
        onClick={
          onClose
        }
        aria-label="إغلاق"
      />

      <form
        className="booking-modal"
        onSubmit={
          submit
        }
      >

        <div className="booking-modal-header">

          <div>
            <span>
              NEW APPOINTMENT
            </span>

            <h2>
              حجز موعد
            </h2>

            <p>
              اختر المريض وحدد الموعد والطبيب.
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
          >
            <X
              size={17}
            />
          </button>

        </div>

        <div className="booking-form">

          <div className="patient-mode-switch">

            <button
              type="button"
              className={
                patientMode ===
                "existing"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setPatientMode(
                  "existing"
                )
              }
            >
              مريض مسجل
            </button>

            <button
              type="button"
              className={
                patientMode ===
                "new"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setPatientMode(
                  "new"
                )
              }
            >
              مريض جديد
            </button>

          </div>

          {patientMode ===
          "existing" ? (
            <div className="booking-patient-section">
              <span className="booking-section-label">
                المريض
              </span>

              <PatientPicker
                patients={
                  patients
                }
                value={
                  selectedPatient
                }
                onChange={
                  setSelectedPatient
                }
              />
            </div>
          ) : (
            <NewPatientFields
              value={
                newPatient
              }
              onChange={
                setNewPatient
              }
            />
          )}

          <div className="booking-form-grid">

            <label className="booking-field">
              <span>
                التاريخ
              </span>

              <input
                type="date"
                value={date}
                required
                onChange={(
                  event
                ) =>
                  setDate(
                    event.target
                      .value
                  )
                }
              />
            </label>

            <label className="booking-field">
              <span>
                الوقت
              </span>

              <input
                type="time"
                value={time}
                required
                onChange={(
                  event
                ) =>
                  setTime(
                    event.target
                      .value
                  )
                }
              />
            </label>

          </div>

          <div className="booking-form-grid">

            <label className="booking-field">
              <span>
                الطبيب
              </span>

              <select
                value={
                  doctorId
                }
                onChange={(
                  event
                ) =>
                  setDoctorId(
                    event.target
                      .value
                  )
                }
              >
                <option value="">
                  بدون تحديد
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

            <label className="booking-field">
              <span>
                نوع الزيارة
              </span>

              <select
                value={type}
                onChange={(
                  event
                ) =>
                  setType(
                    event.target
                      .value
                  )
                }
              >
                {VISIT_TYPES.map(
                  (item) => (
                    <option
                      key={
                        item
                      }
                      value={
                        item
                      }
                    >
                      {item}
                    </option>
                  )
                )}
              </select>
            </label>

          </div>

          <div className="booking-form-grid">

            <label className="booking-field">
              <span>
                مدة الموعد
              </span>

              <select
                value={
                  duration
                }
                onChange={(
                  event
                ) =>
                  setDuration(
                    Number(
                      event.target
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
            </label>

            <div className="booking-duration">
              <span>
                حالة الحجز
              </span>

              <strong>
                مؤكد
              </strong>
            </div>

          </div>

          <label className="booking-field">
            <span>
              ملاحظات
            </span>

            <textarea
              value={notes}
              onChange={(
                event
              ) =>
                setNotes(
                  event.target
                    .value
                )
              }
              placeholder="سبب الحجز أو أي ملاحظة للاستقبال..."
            />
          </label>

          {error && (
            <div className="booking-error">
              <CircleAlert
                size={16}
              />

              {error}
            </div>
          )}

        </div>

        <div className="booking-modal-footer">

          <button
            type="button"
            className="booking-cancel"
            onClick={
              onClose
            }
            disabled={
              saving
            }
          >
            إلغاء
          </button>

          <button
            type="submit"
            className="booking-confirm"
            disabled={
              saving
            }
          >
            {saving ? (
              <LoaderCircle
                size={16}
                className="appointments-loader"
              />
            ) : (
              <CalendarDays
                size={16}
              />
            )}

            حفظ الموعد
          </button>

        </div>

      </form>
    </div>
  );
}

/* =========================================================
   WALK IN
   ========================================================= */

function WalkInModal({
  clinicId,
  patients,
  doctors,
  staffId,
  onClose,
  onSuccess,
}) {
  const [
    patientMode,
    setPatientMode,
  ] = useState(
    "existing"
  );

  const [
    selectedPatient,
    setSelectedPatient,
  ] = useState(null);

  const [
    doctorId,
    setDoctorId,
  ] = useState(
    doctors[0]?.id ||
      ""
  );

  const [
    type,
    setType,
  ] = useState(
    "كشف"
  );

  const [
    notes,
    setNotes,
  ] = useState("");

  const [
    newPatient,
    setNewPatient,
  ] = useState({
    name: "",
    phone: "",
    gender: "",
    dateOfBirth: "",
    address: "",
  });

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const selectedDoctor =
    doctors.find(
      (doctor) =>
        doctor.id ===
        doctorId
    ) || null;

  async function submit(
    event
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      if (
        patientMode ===
        "existing"
      ) {
        if (
          !selectedPatient
        ) {
          throw new Error(
            "اختر المريض أولًا."
          );
        }

        await createWalkIn({
          clinicId,

          patient:
            selectedPatient,

          doctor:
            selectedDoctor,

          type,
          notes,
          staffId,
        });
      } else {
        await createPatientAndWalkIn({
          clinicId,

          patientData:
            newPatient,

          doctor:
            selectedDoctor,

          type,
          notes,
          staffId,
        });
      }

      onSuccess(
        "تم تسجيل المريض وإضافته لقائمة الانتظار."
      );
    } catch (submitError) {
      setError(
        submitError.message ||
          "تعذر تسجيل المريض."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="booking-modal-layer">

      <button
        type="button"
        className="booking-modal-overlay"
        onClick={
          onClose
        }
        aria-label="إغلاق"
      />

      <form
        className="booking-modal walkin-modal"
        onSubmit={
          submit
        }
      >

        <div className="booking-modal-header">

          <div>
            <span>
              WALK-IN
            </span>

            <h2>
              مريض بدون موعد
            </h2>

            <p>
              أضف المريض مباشرة إلى قائمة الانتظار.
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
          >
            <X
              size={17}
            />
          </button>

        </div>

        <div className="booking-form">

          <div className="patient-mode-switch">

            <button
              type="button"
              className={
                patientMode ===
                "existing"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setPatientMode(
                  "existing"
                )
              }
            >
              مريض مسجل
            </button>

            <button
              type="button"
              className={
                patientMode ===
                "new"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setPatientMode(
                  "new"
                )
              }
            >
              مريض جديد
            </button>

          </div>

          {patientMode ===
          "existing" ? (
            <div className="booking-patient-section">
              <span className="booking-section-label">
                المريض
              </span>

              <PatientPicker
                patients={
                  patients
                }
                value={
                  selectedPatient
                }
                onChange={
                  setSelectedPatient
                }
              />
            </div>
          ) : (
            <NewPatientFields
              value={
                newPatient
              }
              onChange={
                setNewPatient
              }
            />
          )}

          <div className="booking-form-grid">

            <label className="booking-field">
              <span>
                الطبيب
              </span>

              <select
                value={
                  doctorId
                }
                onChange={(
                  event
                ) =>
                  setDoctorId(
                    event.target
                      .value
                  )
                }
              >
                <option value="">
                  بدون تحديد
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

            <label className="booking-field">
              <span>
                نوع الزيارة
              </span>

              <select
                value={type}
                onChange={(
                  event
                ) =>
                  setType(
                    event.target
                      .value
                  )
                }
              >
                {VISIT_TYPES.map(
                  (item) => (
                    <option
                      key={
                        item
                      }
                      value={
                        item
                      }
                    >
                      {item}
                    </option>
                  )
                )}
              </select>
            </label>

          </div>

          <label className="booking-field">
            <span>
              ملاحظات
            </span>

            <textarea
              value={notes}
              onChange={(
                event
              ) =>
                setNotes(
                  event.target
                    .value
                )
              }
              placeholder="سبب الزيارة أو ملاحظة للاستقبال..."
            />
          </label>

          {error && (
            <div className="booking-error">
              <CircleAlert
                size={16}
              />

              {error}
            </div>
          )}

        </div>

        <div className="booking-modal-footer">

          <button
            type="button"
            className="booking-cancel"
            onClick={
              onClose
            }
            disabled={
              saving
            }
          >
            إلغاء
          </button>

          <button
            type="submit"
            className="booking-confirm"
            disabled={
              saving
            }
          >
            {saving ? (
              <LoaderCircle
                size={16}
                className="appointments-loader"
              />
            ) : (
              <UserCheck
                size={16}
              />
            )}

            إضافة للانتظار
          </button>

        </div>

      </form>
    </div>
  );
}

/* =========================================================
   NEW PATIENT
   ========================================================= */

function NewPatientFields({
  value,
  onChange,
}) {
  function change(
    key,
    nextValue
  ) {
    onChange({
      ...value,
      [key]:
        nextValue,
    });
  }

  return (
    <div className="new-patient-booking-fields">

      <div className="booking-form-grid">

        <label className="booking-field">
          <span>
            اسم المريض
          </span>

          <input
            type="text"
            required
            value={
              value.name
            }
            onChange={(
              event
            ) =>
              change(
                "name",
                event.target
                  .value
              )
            }
            placeholder="الاسم بالكامل"
          />
        </label>

        <label className="booking-field">
          <span>
            رقم الهاتف
          </span>

          <input
            type="tel"
            required
            dir="ltr"
            value={
              value.phone
            }
            onChange={(
              event
            ) =>
              change(
                "phone",
                event.target
                  .value
              )
            }
            placeholder="01xxxxxxxxx"
          />
        </label>

      </div>

      <div className="booking-form-grid">

        <label className="booking-field">
          <span>
            النوع
          </span>

          <select
            value={
              value.gender
            }
            onChange={(
              event
            ) =>
              change(
                "gender",
                event.target
                  .value
              )
            }
          >
            <option value="">
              غير محدد
            </option>

            <option value="male">
              ذكر
            </option>

            <option value="female">
              أنثى
            </option>
          </select>
        </label>

        <label className="booking-field">
          <span>
            تاريخ الميلاد
          </span>

          <input
            type="date"
            value={
              value.dateOfBirth
            }
            onChange={(
              event
            ) =>
              change(
                "dateOfBirth",
                event.target
                  .value
              )
            }
          />
        </label>

      </div>

      <label className="booking-field">
        <span>
          العنوان
        </span>

        <input
          type="text"
          value={
            value.address
          }
          onChange={(
            event
          ) =>
            change(
              "address",
              event.target
                .value
            )
          }
          placeholder="العنوان - اختياري"
        />
      </label>

    </div>
  );
}