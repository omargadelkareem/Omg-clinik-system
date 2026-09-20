import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  LoaderCircle,
  Plus,
  ReceiptText,
  Stethoscope,
  UserPlus,
  Users,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "./../context/AuthContext";

import {
  subscribeToDashboard,
} from "../services/dashboardService";

import "./DashboardPage.css";

const EMPTY_DASHBOARD = {
  profile: {},

  totals: {
    appointments: 0,
    confirmedAppointments: 0,
    patientsToday: 0,
    newPatientsToday: 0,
    waiting: 0,
    averageWait: 0,
    revenue: 0,
    expenses: 0,
    net: 0,
    weekRevenue: 0,
  },

  appointments: [],
  queue: [],
  currentPatient: null,
  revenueChart: [],
  recentActivity: [],
};

function formatMoney(value) {
  return Number(
    value || 0
  ).toLocaleString("ar-EG");
}

function formatDashboardDate() {
  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(new Date());
}

function getFirstName(name = "") {
  const cleaned = name
    .replace(/^د\.?\s*/i, "")
    .trim();

  return (
    cleaned.split(/\s+/)[0] ||
    ""
  );
}

function StatusText({
  status,
}) {
  const labels = {
    confirmed: "مؤكد",
    pending: "بانتظار التأكيد",
    arrived: "وصل",
    waiting: "في الانتظار",
    in_progress: "داخل الكشف",
    completed: "مكتمل",
    cancelled: "ملغي",
  };

  return (
    <span
      className={`ops-status ops-status-${status}`}
    >
      {labels[status] ||
        status ||
        "مجدول"}
    </span>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const {
    clinicId,
    profile: userProfile,
    clinic,
  } = useAuth();

  const [dashboard, setDashboard] =
    useState(EMPTY_DASHBOARD);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!clinicId) return;

    setLoading(true);
    setError("");

    const unsubscribe =
      subscribeToDashboard(
        clinicId,

        (data) => {
          setDashboard(data);
          setLoading(false);
        },

        () => {
          setError(
            "تعذر قراءة بيانات العيادة."
          );

          setLoading(false);
        }
      );

    return () => {
      unsubscribe?.();
    };
  }, [clinicId]);

  const maxRevenue = useMemo(
    () =>
      Math.max(
        ...dashboard.revenueChart.map(
          (item) => item.value
        ),
        1
      ),
    [dashboard.revenueChart]
  );

  const displayClinicName =
    dashboard.profile?.nameAr ||
    clinic?.nameAr ||
    dashboard.profile?.name ||
    clinic?.name ||
    "العيادة";

  const displayUserName =
    userProfile?.name || "";

  const firstName =
    getFirstName(displayUserName);

  const quickActions = [
    {
      label: "إضافة مريض",
      icon: UserPlus,
      action: () =>
        navigate("/patients"),
    },

    {
      label: "حجز موعد",
      icon: CalendarDays,
      action: () =>
        navigate(
          "/appointments"
        ),
    },

    {
      label: "قائمة الانتظار",
      icon: Clock3,
      action: () =>
        navigate("/queue"),
    },

    {
      label: "المالية",
      icon: ReceiptText,
      action: () =>
        navigate("/finance"),
    },
  ];

  if (loading) {
    return (
      <div className="ops-dashboard">
        <div className="dashboard-state">
          <LoaderCircle
            size={24}
            className="dashboard-loader"
          />

          <strong>
            جاري قراءة بيانات العيادة
          </strong>

          <span>
            يتم تجهيز مساحة العمل...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ops-dashboard">
        <div className="dashboard-state dashboard-error-state">
          <strong>
            لم نتمكن من تحميل لوحة
            التشغيل
          </strong>

          <span>{error}</span>

          <button
            onClick={() =>
              window.location.reload()
            }
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ops-dashboard">
      {/* TOP BAR */}

      <header className="ops-header">
        <div>
          <span className="ops-eyebrow">
            CLINIC OPERATIONS
          </span>

          <h1>
            {firstName
              ? `أهلاً ${firstName}`
              : "مساحة تشغيل العيادة"}
          </h1>

          <p>
            {displayClinicName}
            <span />
            {formatDashboardDate()}
          </p>
        </div>

        <div className="ops-header-actions">
          <span className="clinic-live-state">
            <i />
            النظام متصل
          </span>

          <button
            className="primary-operation"
            onClick={() =>
              navigate(
                "/appointments"
              )
            }
          >
            <Plus size={17} />
            حجز موعد
          </button>
        </div>
      </header>

      {/* COMMAND STRIP */}

      <section className="command-strip">
        <CommandMetric
          label="مواعيد اليوم"
          value={
            dashboard.totals
              .appointments
          }
          note={`${dashboard.totals.confirmedAppointments} مؤكد`}
          icon={CalendarDays}
        />

        <CommandMetric
          label="حضور اليوم"
          value={
            dashboard.totals
              .patientsToday
          }
          note={`${dashboard.totals.newPatientsToday} ملفات جديدة`}
          icon={Users}
        />

        <CommandMetric
          label="بانتظار الكشف"
          value={
            dashboard.totals.waiting
          }
          note={
            dashboard.totals.waiting
              ? `متوسط ${dashboard.totals.averageWait} د`
              : "لا يوجد انتظار"
          }
          icon={Clock3}
          attention={
            dashboard.totals.waiting >
            0
          }
        />

        <CommandMetric
          label="تحصيل اليوم"
          value={formatMoney(
            dashboard.totals.revenue
          )}
          suffix="ج.م"
          note={`صافي ${formatMoney(
            dashboard.totals.net
          )} ج.م`}
          icon={Banknote}
        />
      </section>

      {/* MAIN OPERATIONS */}

      <section className="operations-layout">
        {/* APPOINTMENT DESK */}

        <div className="schedule-workspace">
          <div className="workspace-heading">
            <div>
              <span>جدول التشغيل</span>
              <h2>مواعيد اليوم</h2>
            </div>

            <button
              onClick={() =>
                navigate(
                  "/appointments"
                )
              }
            >
              الجدول الكامل
              <ArrowLeft size={15} />
            </button>
          </div>

          {dashboard.appointments
            .length === 0 ? (
            <EmptySchedule
              onAdd={() =>
                navigate(
                  "/appointments"
                )
              }
            />
          ) : (
            <div className="schedule-list">
              {dashboard.appointments.map(
                (
                  appointment,
                  index
                ) => (
                  <button
                    className="schedule-line"
                    key={
                      appointment.id
                    }
                    onClick={() =>
                      navigate(
                        "/appointments"
                      )
                    }
                  >
                    <div className="schedule-sequence">
                      {String(
                        index + 1
                      ).padStart(
                        2,
                        "0"
                      )}
                    </div>

                    <div className="schedule-time">
                      <strong>
                        {
                          appointment.displayTime
                        }
                      </strong>

                      <span>
                        {appointment.duration ||
                          appointment.slotDuration ||
                          30}{" "}
                        دقيقة
                      </span>
                    </div>

                    <div className="schedule-patient">
                      <span className="patient-mark">
                        {
                          appointment.initials
                        }
                      </span>

                      <div>
                        <strong>
                          {
                            appointment.name
                          }
                        </strong>

                        <span>
                          {appointment.phone ||
                            "بدون رقم هاتف"}
                        </span>
                      </div>
                    </div>

                    <div className="schedule-service">
                      <span>
                        {
                          appointment.type
                        }
                      </span>

                      {appointment.doctorName && (
                        <small>
                          {
                            appointment.doctorName
                          }
                        </small>
                      )}
                    </div>

                    <StatusText
                      status={
                        appointment.status
                      }
                    />

                    <ChevronLeft
                      size={17}
                      className="schedule-arrow"
                    />
                  </button>
                )
              )}
            </div>
          )}

          <button
            className="schedule-add-line"
            onClick={() =>
              navigate(
                "/appointments"
              )
            }
          >
            <Plus size={16} />
            إضافة موعد جديد
          </button>
        </div>

        {/* LIVE CLINIC */}

        <aside className="clinic-live-panel">
          <div className="live-panel-heading">
            <div>
              <span>LIVE FLOOR</span>
              <h2>العيادة الآن</h2>
            </div>

            <i />
          </div>

          {dashboard.currentPatient ? (
            <div className="exam-room">
              <div className="exam-room-label">
                <Stethoscope
                  size={16}
                />
                داخل الكشف الآن
              </div>

              <div className="exam-patient">
                <span>
                  {
                    dashboard
                      .currentPatient
                      .initials
                  }
                </span>

                <div>
                  <strong>
                    {
                      dashboard
                        .currentPatient
                        .name
                    }
                  </strong>

                  <small>
                    {dashboard
                      .currentPatient
                      .doctorName ||
                      "جلسة كشف جارية"}
                  </small>
                </div>
              </div>
            </div>
          ) : (
            <div className="exam-room exam-room-empty">
              <Stethoscope
                size={22}
              />

              <strong>
                لا يوجد كشف جارٍ
              </strong>

              <span>
                ستظهر حالة غرفة الكشف
                هنا فور بدء الزيارة.
              </span>
            </div>
          )}

          <div className="waiting-head">
            <span>
              التالي في الانتظار
            </span>

            <strong>
              {
                dashboard.queue
                  .length
              }
            </strong>
          </div>

          <div className="live-queue">
            {dashboard.queue.length ===
            0 ? (
              <div className="empty-queue">
                قائمة الانتظار فارغة
              </div>
            ) : (
              dashboard.queue.map(
                (patient) => (
                  <button
                    key={patient.id}
                    onClick={() =>
                      navigate(
                        "/queue"
                      )
                    }
                    className="live-queue-line"
                  >
                    <span className="live-queue-number">
                      {
                        patient.number
                      }
                    </span>

                    <div>
                      <strong>
                        {patient.name}
                      </strong>

                      <small>
                        منذ{" "}
                        {
                          patient.waitMinutes
                        }{" "}
                        دقيقة
                      </small>
                    </div>

                    <Clock3
                      size={15}
                    />
                  </button>
                )
              )
            )}
          </div>

          <button
            className="manage-floor"
            onClick={() =>
              navigate("/queue")
            }
          >
            فتح إدارة الانتظار
            <ArrowLeft size={15} />
          </button>
        </aside>
      </section>

      {/* LOWER WORKSPACE */}

      <section className="lower-operations">
        {/* FINANCE */}

        <div className="cash-workspace">
          <div className="lower-heading">
            <div>
              <span>FINANCE</span>
              <h2>حركة اليوم</h2>
            </div>

            <button
              onClick={() =>
                navigate("/finance")
              }
            >
              المالية
              <ArrowLeft size={14} />
            </button>
          </div>

          <div className="cash-ledger">
            <div>
              <span>المحصل</span>

              <strong>
                {formatMoney(
                  dashboard.totals
                    .revenue
                )}
                <small> ج.م</small>
              </strong>
            </div>

            <div>
              <span>المصروفات</span>

              <strong>
                {formatMoney(
                  dashboard.totals
                    .expenses
                )}
                <small> ج.م</small>
              </strong>
            </div>

            <div className="net-cell">
              <span>صافي اليوم</span>

              <strong>
                {formatMoney(
                  dashboard.totals.net
                )}
                <small> ج.م</small>
              </strong>
            </div>
          </div>

          <div className="revenue-graph">
            <div className="revenue-graph-head">
              <span>
                تحصيل آخر 7 أيام
              </span>

              <strong>
                {formatMoney(
                  dashboard.totals
                    .weekRevenue
                )}{" "}
                ج.م
              </strong>
            </div>

            <div className="revenue-bars">
              {dashboard.revenueChart.map(
                (day) => (
                  <div
                    className="revenue-day"
                    key={day.key}
                  >
                    <div className="revenue-track">
                      <div
                        className="revenue-fill"
                        style={{
                          height:
                            day.value ===
                            0
                              ? "2px"
                              : `${Math.max(
                                  10,
                                  (day.value /
                                    maxRevenue) *
                                    100
                                )}%`,
                        }}
                      >
                        {day.value >
                          0 && (
                          <span>
                            {formatMoney(
                              day.value
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <small>
                      {day.label}
                    </small>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* QUICK COMMANDS */}

        <div className="quick-command-panel">
          <div className="lower-heading">
            <div>
              <span>SHORTCUTS</span>
              <h2>تشغيل سريع</h2>
            </div>
          </div>

          <div className="quick-command-list">
            {quickActions.map(
              (action) => {
                const Icon =
                  action.icon;

                return (
                  <button
                    key={
                      action.label
                    }
                    onClick={
                      action.action
                    }
                  >
                    <Icon
                      size={18}
                    />

                    <span>
                      {action.label}
                    </span>

                    <ChevronLeft
                      size={16}
                    />
                  </button>
                );
              }
            )}
          </div>

          <div className="system-note">
            <CircleDollarSign
              size={17}
            />

            <div>
              <strong>
                البيانات مباشرة
              </strong>

              <span>
                أي تغيير في Firebase
                يظهر هنا لحظياً.
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function CommandMetric({
  label,
  value,
  suffix,
  note,
  icon: Icon,
  attention,
}) {
  return (
    <div
      className={`command-metric ${
        attention
          ? "command-attention"
          : ""
      }`}
    >
      <Icon size={18} />

      <div>
        <span>{label}</span>

        <strong>
          {value}

          {suffix && (
            <small>
              {" "}
              {suffix}
            </small>
          )}
        </strong>

        <small>{note}</small>
      </div>
    </div>
  );
}

function EmptySchedule({
  onAdd,
}) {
  return (
    <div className="empty-schedule">
      <CalendarDays size={25} />

      <div>
        <strong>
          لا توجد مواعيد اليوم
        </strong>

        <span>
          جدول العيادة فارغ حتى الآن.
        </span>
      </div>

      <button onClick={onAdd}>
        <Plus size={15} />
        إضافة أول موعد
      </button>
    </div>
  );
}