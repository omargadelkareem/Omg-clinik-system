import {
  Activity,
  AlertCircle,
  CalendarDays,
  ChevronDown,
  Clock3,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Printer,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../../context/AuthContext";

import {
  calculateCurrentDebts,
  calculateFinanceStatistics,
  getFinanceDateRange,
  subscribeFinanceExpenses,
  subscribeFinancePayments,
  subscribeFinanceTransactions,
} from "../../services/financeService";

import {
  subscribeClinicVisits,
} from "../../services/visitService";

import {
  subscribeAppointments,
} from "../../services/appointmentService";

import "./ReportsPage.css";

/* =========================================================
   CONSTANTS
========================================================= */

const PERIODS = [
  {
    value: "today",
    label: "اليوم",
  },
  {
    value: "yesterday",
    label: "أمس",
  },
  {
    value: "7days",
    label: "آخر 7 أيام",
  },
  {
    value: "month",
    label: "هذا الشهر",
  },
  {
    value: "previous-month",
    label: "الشهر السابق",
  },
  {
    value: "custom",
    label: "فترة مخصصة",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function numberValue(
  value
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}

function timestampValue(
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

function money(
  value
) {
  return numberValue(
    value
  ).toLocaleString(
    "ar-EG",
    {
      maximumFractionDigits: 2,
    }
  );
}

function formatNumber(
  value
) {
  return numberValue(
    value
  ).toLocaleString(
    "ar-EG"
  );
}

function formatPercent(
  value
) {
  return `${numberValue(
    value
  ).toLocaleString(
    "ar-EG",
    {
      maximumFractionDigits: 1,
    }
  )}%`;
}

function formatDate(
  timestamp
) {
  const value =
    timestampValue(
      timestamp
    );

  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  ).format(
    new Date(value)
  );
}

function formatShortDate(
  timestamp
) {
  const value =
    timestampValue(
      timestamp
    );

  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      day: "numeric",
      month: "short",
    }
  ).format(
    new Date(value)
  );
}

function getPeriodLabel(
  period
) {
  return (
    PERIODS.find(
      (item) =>
        item.value === period
    )?.label ||
    "الفترة"
  );
}

function isBetween(
  value,
  start,
  end
) {
  const timestamp =
    timestampValue(
      value
    );

  if (!timestamp) {
    return false;
  }

  if (
    start &&
    timestamp < start
  ) {
    return false;
  }

  if (
    end &&
    timestamp > end
  ) {
    return false;
  }

  return true;
}

function getVisitTimestamp(
  visit
) {
  return timestampValue(
    visit.completedAt ||
      visit.createdAt
  );
}

function getAppointmentTimestamp(
  appointment
) {
  if (
    appointment.date
  ) {
    const dateTime =
      appointment.time
        ? `${appointment.date}T${appointment.time}`
        : appointment.date;

    const parsed =
      new Date(
        dateTime
      ).getTime();

    if (
      !Number.isNaN(
        parsed
      )
    ) {
      return parsed;
    }
  }

  return timestampValue(
    appointment.createdAt
  );
}

function calculateVisitDuration(
  visit
) {
  const started =
    timestampValue(
      visit.startedAt
    );

  const completed =
    timestampValue(
      visit.completedAt
    );

  if (
    !started ||
    !completed ||
    completed < started
  ) {
    return 0;
  }

  return Math.round(
    (completed - started) /
      60000
  );
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

function downloadTextFile(
  content,
  filename,
  type
) {
  const blob =
    new Blob(
      ["\uFEFF", content],
      {
        type,
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    url;

  link.download =
    filename;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  URL.revokeObjectURL(
    url
  );
}

function escapeCsv(
  value
) {
  const text =
    String(
      value ?? ""
    );

  return `"${text.replace(
    /"/g,
    '""'
  )}"`;
}

/* =========================================================
   PAGE
========================================================= */

export default function ReportsPage() {
  const {
    clinicId,
    clinic,
  } = useAuth();

  const [
    transactions,
    setTransactions,
  ] = useState([]);

  const [
    payments,
    setPayments,
  ] = useState([]);

  const [
    expenses,
    setExpenses,
  ] = useState([]);

  const [
    visits,
    setVisits,
  ] = useState([]);

  const [
    appointments,
    setAppointments,
  ] = useState([]);

  const [
    period,
    setPeriod,
  ] = useState(
    "month"
  );

  const [
    customStart,
    setCustomStart,
  ] = useState("");

  const [
    customEnd,
    setCustomEnd,
  ] = useState("");

  const [
    periodOpen,
    setPeriodOpen,
  ] = useState(false);

  const [
    exportOpen,
    setExportOpen,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  /* =======================================================
     REALTIME
  ======================================================= */

  useEffect(() => {
    if (!clinicId) {
      return;
    }

    setLoading(true);
    setError("");

    let loaded = {
      transactions: false,
      payments: false,
      expenses: false,
      visits: false,
      appointments: false,
    };

    const checkLoading =
      () => {
        if (
          Object.values(
            loaded
          ).every(Boolean)
        ) {
          setLoading(false);
        }
      };

    const handleError =
      (firebaseError) => {
        console.error(
          "Reports realtime error:",
          firebaseError
        );

        setError(
          "تعذر تحميل بعض بيانات التقارير."
        );

        setLoading(false);
      };

    const unsubscribeTransactions =
      subscribeFinanceTransactions(
        clinicId,
        (items) => {
          setTransactions(
            items
          );

          loaded.transactions =
            true;

          checkLoading();
        },
        handleError
      );

    const unsubscribePayments =
      subscribeFinancePayments(
        clinicId,
        (items) => {
          setPayments(
            items
          );

          loaded.payments =
            true;

          checkLoading();
        },
        handleError
      );

    const unsubscribeExpenses =
      subscribeFinanceExpenses(
        clinicId,
        (items) => {
          setExpenses(
            items
          );

          loaded.expenses =
            true;

          checkLoading();
        },
        handleError
      );

    const unsubscribeVisits =
      subscribeClinicVisits(
        clinicId,
        (items) => {
          setVisits(
            items
          );

          loaded.visits =
            true;

          checkLoading();
        },
        handleError
      );

    const unsubscribeAppointments =
      subscribeAppointments(
        clinicId,
        (items) => {
          setAppointments(
            items
          );

          loaded.appointments =
            true;

          checkLoading();
        },
        handleError
      );

    return () => {
      unsubscribeTransactions?.();
      unsubscribePayments?.();
      unsubscribeExpenses?.();
      unsubscribeVisits?.();
      unsubscribeAppointments?.();
    };
  }, [
    clinicId,
  ]);

  /* =======================================================
     RANGE
  ======================================================= */

  const range =
    useMemo(
      () =>
        getFinanceDateRange(
          period,
          customStart ||
            null,
          customEnd ||
            null
        ),
      [
        period,
        customStart,
        customEnd,
      ]
    );

  /* =======================================================
     FILTERED VISITS
  ======================================================= */

  const periodVisits =
    useMemo(
      () =>
        visits.filter(
          (visit) =>
            isBetween(
              getVisitTimestamp(
                visit
              ),
              range.start,
              range.end
            )
        ),
      [
        visits,
        range,
      ]
    );

  const periodAppointments =
    useMemo(
      () =>
        appointments.filter(
          (appointment) =>
            isBetween(
              getAppointmentTimestamp(
                appointment
              ),
              range.start,
              range.end
            )
        ),
      [
        appointments,
        range,
      ]
    );

  /* =======================================================
     FINANCE
  ======================================================= */

  const finance =
    useMemo(
      () =>
        calculateFinanceStatistics({
          transactions,
          payments,
          expenses,
          startDate:
            range.start,
          endDate:
            range.end,
        }),
      [
        transactions,
        payments,
        expenses,
        range,
      ]
    );

  const debts =
    useMemo(
      () =>
        calculateCurrentDebts(
          transactions
        ),
      [
        transactions,
      ]
    );

  /* =======================================================
     VISIT STATISTICS
  ======================================================= */

  const visitStats =
    useMemo(() => {
      const total =
        periodVisits.length;

      const newVisits =
        periodVisits.filter(
          (visit) =>
            visit.visitType !==
            "followup"
        ).length;

      const followups =
        periodVisits.filter(
          (visit) =>
            visit.visitType ===
              "followup" ||
            visit.visitTypeLabel ===
              "إعادة"
        ).length;

      const patientIds =
        new Set(
          periodVisits
            .map(
              (visit) =>
                visit.patientId
            )
            .filter(Boolean)
        );

      /*
       * المرضى الجدد:
       * أول زيارة لهم في النظام
       * تقع داخل الفترة المختارة.
       */
      const firstVisitMap =
        new Map();

      visits.forEach(
        (visit) => {
          if (
            !visit.patientId
          ) {
            return;
          }

          const timestamp =
            getVisitTimestamp(
              visit
            );

          const current =
            firstVisitMap.get(
              visit.patientId
            );

          if (
            !current ||
            timestamp < current
          ) {
            firstVisitMap.set(
              visit.patientId,
              timestamp
            );
          }
        }
      );

      const newPatients =
        Array.from(
          firstVisitMap.values()
        ).filter(
          (timestamp) =>
            isBetween(
              timestamp,
              range.start,
              range.end
            )
        ).length;

      const durations =
        periodVisits
          .map(
            calculateVisitDuration
          )
          .filter(
            (value) =>
              value > 0
          );

      const averageDuration =
        durations.length
          ? Math.round(
              durations.reduce(
                (
                  sum,
                  value
                ) =>
                  sum + value,
                0
              ) /
                durations.length
            )
          : 0;

      const followupRate =
        total
          ? (
              followups /
              total
            ) *
            100
          : 0;

      return {
        total,
        newVisits,
        followups,
        uniquePatients:
          patientIds.size,
        newPatients,
        averageDuration,
        followupRate,
      };
    }, [
      periodVisits,
      visits,
      range,
    ]);

  /* =======================================================
     APPOINTMENT STATISTICS
  ======================================================= */

  const appointmentStats =
    useMemo(() => {
      const total =
        periodAppointments.length;

      const completed =
        periodAppointments.filter(
          (item) =>
            item.status ===
            "completed"
        ).length;

      const cancelled =
        periodAppointments.filter(
          (item) =>
            item.status ===
            "cancelled"
        ).length;

      const noShow =
        periodAppointments.filter(
          (item) =>
            item.status ===
              "no-show" ||
            item.status ===
              "no_show"
        ).length;

      const attendanceRate =
        total
          ? (
              completed /
              total
            ) *
            100
          : 0;

      const cancellationRate =
        total
          ? (
              cancelled /
              total
            ) *
            100
          : 0;

      return {
        total,
        completed,
        cancelled,
        noShow,
        attendanceRate,
        cancellationRate,
      };
    }, [
      periodAppointments,
    ]);

  /* =======================================================
     DOCTOR PERFORMANCE
  ======================================================= */

  const doctorPerformance =
    useMemo(() => {
      const map =
        new Map();

      periodVisits.forEach(
        (visit) => {
          const id =
            visit.doctorId ||
            visit.doctorName ||
            "unknown";

          if (
            !map.has(id)
          ) {
            map.set(
              id,
              {
                id,
                name:
                  visit.doctorName ||
                  "طبيب غير محدد",
                visits: 0,
                newVisits: 0,
                followups: 0,
                totalDuration: 0,
                durationCount: 0,
                revenue: 0,
              }
            );
          }

          const doctor =
            map.get(id);

          doctor.visits +=
            1;

          if (
            visit.visitType ===
              "followup" ||
            visit.visitTypeLabel ===
              "إعادة"
          ) {
            doctor.followups +=
              1;
          } else {
            doctor.newVisits +=
              1;
          }

          const duration =
            calculateVisitDuration(
              visit
            );

          if (
            duration > 0
          ) {
            doctor.totalDuration +=
              duration;

            doctor.durationCount +=
              1;
          }
        }
      );

      finance.doctors?.forEach?.(
        (doctor) => {
          const id =
            doctor.doctorId ||
            doctor.id ||
            doctor.name ||
            doctor.doctorName;

          const name =
            doctor.doctorName ||
            doctor.name ||
            "طبيب غير محدد";

          let record =
            map.get(id);

          if (!record) {
            record = {
              id,
              name,
              visits: 0,
              newVisits: 0,
              followups: 0,
              totalDuration: 0,
              durationCount: 0,
              revenue: 0,
            };

            map.set(
              id,
              record
            );
          }

          record.revenue =
            numberValue(
              doctor.collected ??
                doctor.revenue ??
                doctor.amount
            );
        }
      );

      /*
       * fallback:
       * لو finance.doctors لم يطابق IDs،
       * نقرأ المعاملات مباشرة.
       */
      finance.transactions?.forEach?.(
        (transaction) => {
          const id =
            transaction.doctorId ||
            transaction.doctorName ||
            "unknown";

          let record =
            map.get(id);

          if (!record) {
            record = {
              id,
              name:
                transaction.doctorName ||
                "طبيب غير محدد",
              visits: 0,
              newVisits: 0,
              followups: 0,
              totalDuration: 0,
              durationCount: 0,
              revenue: 0,
            };

            map.set(
              id,
              record
            );
          }

          record.revenue +=
            numberValue(
              transaction.paid
            );
        }
      );

      return Array.from(
        map.values()
      )
        .map(
          (doctor) => ({
            ...doctor,

            averageDuration:
              doctor.durationCount
                ? Math.round(
                    doctor.totalDuration /
                      doctor.durationCount
                  )
                : 0,
          })
        )
        .sort(
          (a, b) =>
            b.visits -
            a.visits
        );
    }, [
      periodVisits,
      finance,
    ]);

  /* =======================================================
     DAILY PERFORMANCE
  ======================================================= */

  const dailyPerformance =
    useMemo(() => {
      const map =
        new Map();

      periodVisits.forEach(
        (visit) => {
          const timestamp =
            getVisitTimestamp(
              visit
            );

          if (!timestamp) {
            return;
          }

          const date =
            new Date(
              timestamp
            );

          const key =
            `${date.getFullYear()}-${String(
              date.getMonth() +
                1
            ).padStart(
              2,
              "0"
            )}-${String(
              date.getDate()
            ).padStart(
              2,
              "0"
            )}`;

          if (
            !map.has(key)
          ) {
            map.set(
              key,
              {
                key,
                timestamp:
                  new Date(
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate()
                  ).getTime(),
                visits: 0,
                revenue: 0,
              }
            );
          }

          map.get(
            key
          ).visits += 1;
        }
      );

      finance.daily?.forEach?.(
        (day) => {
          const key =
            day.date ||
            day.key;

          if (!key) {
            return;
          }

          if (
            !map.has(key)
          ) {
            const parsed =
              new Date(
                `${key}T12:00:00`
              ).getTime();

            map.set(
              key,
              {
                key,
                timestamp:
                  Number.isNaN(
                    parsed
                  )
                    ? 0
                    : parsed,
                visits: 0,
                revenue: 0,
              }
            );
          }

          map.get(
            key
          ).revenue =
            numberValue(
              day.collected ??
                day.revenue ??
                day.amount
            );
        }
      );

      /*
       * لو daily finance لم يرجع قيمة،
       * نحسب التحصيل من payments.
       */
      finance.payments?.forEach?.(
        (payment) => {
          const timestamp =
            timestampValue(
              payment.paidAt ||
                payment.createdAt
            );

          if (!timestamp) {
            return;
          }

          const date =
            new Date(
              timestamp
            );

          const key =
            `${date.getFullYear()}-${String(
              date.getMonth() +
                1
            ).padStart(
              2,
              "0"
            )}-${String(
              date.getDate()
            ).padStart(
              2,
              "0"
            )}`;

          if (
            !map.has(key)
          ) {
            map.set(
              key,
              {
                key,
                timestamp:
                  new Date(
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate()
                  ).getTime(),
                visits: 0,
                revenue: 0,
              }
            );
          }
        }
      );

      return Array.from(
        map.values()
      )
        .sort(
          (a, b) =>
            a.timestamp -
            b.timestamp
        )
        .slice(-14);
    }, [
      periodVisits,
      finance,
    ]);

  const maxRevenue =
    useMemo(
      () =>
        Math.max(
          ...dailyPerformance.map(
            (item) =>
              item.revenue
          ),
          1
        ),
      [
        dailyPerformance,
      ]
    );

  /* =======================================================
     BUSIEST HOURS
  ======================================================= */

  const busiestHours =
    useMemo(() => {
      const hours = {};

      periodVisits.forEach(
        (visit) => {
          const timestamp =
            timestampValue(
              visit.startedAt ||
                visit.completedAt ||
                visit.createdAt
            );

          if (!timestamp) {
            return;
          }

          const hour =
            new Date(
              timestamp
            ).getHours();

          hours[hour] =
            (hours[hour] ||
              0) +
            1;
        }
      );

      const entries =
        Object.entries(
          hours
        ).sort(
          (a, b) =>
            b[1] -
            a[1]
        );

      if (
        !entries.length
      ) {
        return {
          label: "لا توجد بيانات",
          count: 0,
          percent: 0,
        };
      }

      const [
        hour,
        count,
      ] =
        entries[0];

      const start =
        Number(hour);

      const end =
        start + 1;

      const formatter =
        new Intl.DateTimeFormat(
          "ar-EG",
          {
            hour: "numeric",
          }
        );

      return {
        label:
          `${formatter.format(
            new Date(
              2026,
              0,
              1,
              start
            )
          )} — ${formatter.format(
            new Date(
              2026,
              0,
              1,
              end
            )
          )}`,

        count,

        percent:
          visitStats.total
            ? (
                count /
                visitStats.total
              ) *
              100
            : 0,
      };
    }, [
      periodVisits,
      visitStats.total,
    ]);

  /* =======================================================
     EXPORT
  ======================================================= */

  const handlePrint =
    () => {
      setExportOpen(
        false
      );

      setPeriodOpen(
        false
      );

      window.setTimeout(
        () => {
          window.print();
        },
        80
      );
    };

  const handlePdf =
    () => {
      /*
       * Browser Print Dialog:
       * المستخدم يختار Save as PDF.
       *
       * هذا يحافظ على العربي والتنسيق
       * بدون مكتبة PDF إضافية.
       */
      handlePrint();
    };

  const handleCsv =
    () => {
      const rows = [
        [
          "تقرير OMG Clinic",
        ],
        [
          "الفترة",
          getPeriodLabel(
            period
          ),
        ],
        [
          "من",
          formatDate(
            range.start
          ),
        ],
        [
          "إلى",
          formatDate(
            range.end
          ),
        ],
        [],
        [
          "المؤشر",
          "القيمة",
        ],
        [
          "إجمالي الفواتير",
          finance.summary
            ?.invoiced ||
            0,
        ],
        [
          "المبالغ المحصلة",
          finance.summary
            ?.collected ||
            0,
        ],
        [
          "المصروفات",
          finance.summary
            ?.expenses ||
            0,
        ],
        [
          "صافي التحصيل",
          finance.summary
            ?.net ||
            0,
        ],
        [
          "المبالغ غير المحصلة",
          finance.summary
            ?.outstanding ||
            0,
        ],
        [
          "إجمالي الزيارات",
          visitStats.total,
        ],
        [
          "كشف جديد",
          visitStats.newVisits,
        ],
        [
          "إعادة",
          visitStats.followups,
        ],
        [
          "مرضى جدد",
          visitStats.newPatients,
        ],
        [
          "متوسط مدة الكشف",
          visitStats.averageDuration,
        ],
        [],
        [
          "أداء الأطباء",
        ],
        [
          "الطبيب",
          "الزيارات",
          "كشف جديد",
          "إعادة",
          "الإيراد",
          "متوسط مدة الكشف",
        ],
        ...doctorPerformance.map(
          (doctor) => [
            doctor.name,
            doctor.visits,
            doctor.newVisits,
            doctor.followups,
            doctor.revenue,
            doctor.averageDuration,
          ]
        ),
      ];

      const csv =
        rows
          .map(
            (row) =>
              row
                .map(
                  escapeCsv
                )
                .join(",")
          )
          .join("\n");

      downloadTextFile(
        csv,
        `OMG-Clinic-Report-${Date.now()}.csv`,
        "text/csv;charset=utf-8"
      );

      setExportOpen(
        false
      );
    };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="reports-state">
        <LoaderCircle
          size={27}
          className="reports-spinner"
        />

        <strong>
          جاري إعداد التقارير
        </strong>

        <span>
          يتم تحليل بيانات العيادة والمالية...
        </span>
      </div>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  const clinicName =
    clinic?.profile?.name ||
    clinic?.name ||
    "OMG Clinic";

  const summary =
    finance.summary || {};

  const averageVisitValue =
    visitStats.total
      ? numberValue(
          summary.invoiced
        ) /
        visitStats.total
      : 0;

  const newVisitPercent =
    visitStats.total
      ? (
          visitStats.newVisits /
          visitStats.total
        ) *
        100
      : 0;

  const followupPercent =
    visitStats.total
      ? (
          visitStats.followups /
          visitStats.total
        ) *
        100
      : 0;

  return (
    <div className="reports-page">
      {/* PRINT HEADER */}

      <div className="reports-print-header">
        <div>
          <strong>
            {clinicName}
          </strong>

          <span>
            تقرير أداء العيادة
          </span>
        </div>

        <div>
          <span>
            {getPeriodLabel(
              period
            )}
          </span>

          <small>
            {formatDate(
              range.start
            )}
            {" — "}
            {formatDate(
              range.end
            )}
          </small>
        </div>
      </div>

      {/* HEADER */}

      <header className="reports-header">
        <div>
          <span>
            CLINIC PERFORMANCE
          </span>

          <h1>
            التقارير
          </h1>

          <p>
            تحليل تشغيلي ومالي مباشر من بيانات العيادة
          </p>
        </div>

        <div className="report-actions">
          <div className="report-period-wrapper">
            <button
              type="button"
              onClick={() =>
                setPeriodOpen(
                  (current) =>
                    !current
                )
              }
            >
              <CalendarDays
                size={16}
              />

              {getPeriodLabel(
                period
              )}

              <ChevronDown
                size={14}
              />
            </button>

            {periodOpen && (
              <div className="report-period-menu">
                {PERIODS.map(
                  (item) => (
                    <button
                      type="button"
                      key={
                        item.value
                      }
                      className={
                        period ===
                        item.value
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        setPeriod(
                          item.value
                        );

                        setPeriodOpen(
                          false
                        );
                      }}
                    >
                      {
                        item.label
                      }
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={
              handlePrint
            }
          >
            <Printer
              size={16}
            />

            طباعة
          </button>

          <div className="report-export-wrapper">
            <button
              type="button"
              className="report-primary-action"
              onClick={() =>
                setExportOpen(
                  (current) =>
                    !current
                )
              }
            >
              <Download
                size={16}
              />

              تصدير التقرير

              <ChevronDown
                size={14}
              />
            </button>

            {exportOpen && (
              <div className="report-export-menu">
                <button
                  type="button"
                  onClick={
                    handlePdf
                  }
                >
                  <Printer
                    size={16}
                  />

                  <span>
                    <strong>
                      حفظ PDF
                    </strong>

                    <small>
                      طباعة ثم Save as PDF
                    </small>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={
                    handleCsv
                  }
                >
                  <FileSpreadsheet
                    size={16}
                  />

                  <span>
                    <strong>
                      Excel / CSV
                    </strong>

                    <small>
                      تصدير بيانات التقرير
                    </small>
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CUSTOM RANGE */}

      {period ===
        "custom" && (
        <section className="reports-custom-range">
          <div>
            <label>
              من تاريخ
            </label>

            <input
              type="date"
              value={
                customStart
              }
              onChange={(
                event
              ) =>
                setCustomStart(
                  event.target
                    .value
                )
              }
            />
          </div>

          <div>
            <label>
              إلى تاريخ
            </label>

            <input
              type="date"
              value={
                customEnd
              }
              onChange={(
                event
              ) =>
                setCustomEnd(
                  event.target
                    .value
                )
              }
            />
          </div>
        </section>
      )}

      {/* ERROR */}

      {error && (
        <div className="reports-error">
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
            <X
              size={15}
            />
          </button>
        </div>
      )}

      {/* REPORT META */}

      <section className="report-meta-line">
        <div>
          <span>
            الفترة
          </span>

          <strong>
            {formatDate(
              range.start
            )}
            {" — "}
            {formatDate(
              range.end
            )}
          </strong>
        </div>

        <div>
          <span>
            آخر تحديث
          </span>

          <strong>
            {new Intl.DateTimeFormat(
              "ar-EG",
              {
                hour: "numeric",
                minute:
                  "2-digit",
              }
            ).format(
              new Date()
            )}
          </strong>
        </div>
      </section>

      {/* METRICS */}

      <section className="report-command-strip">
        <ReportMetric
          icon={
            <Wallet
              size={18}
            />
          }
          label="إجمالي الفواتير"
          value={money(
            summary.invoiced
          )}
          unit="ج.م"
          helper={`${formatNumber(
            summary.invoiceCount
          )} فاتورة`}
        />

        <ReportMetric
          icon={
            <TrendingUp
              size={18}
            />
          }
          label="المبالغ المحصلة"
          value={money(
            summary.collected
          )}
          unit="ج.م"
          helper={`نسبة التحصيل ${formatPercent(
            summary.collectionRate
          )}`}
        />

        <ReportMetric
          icon={
            <Activity
              size={18}
            />
          }
          label="إجمالي الزيارات"
          value={formatNumber(
            visitStats.total
          )}
          unit="زيارة"
          helper={`${formatNumber(
            visitStats.uniquePatients
          )} مريض`}
        />

        <ReportMetric
          icon={
            <UserPlus
              size={18}
            />
          }
          label="مرضى جدد"
          value={formatNumber(
            visitStats.newPatients
          )}
          unit="مريض"
          helper="أول زيارة خلال الفترة"
        />
      </section>

      {/* FINANCIAL SUMMARY */}

      <section className="reports-financial-line">
        <FinancialLine
          label="صافي التحصيل"
          value={`${money(
            summary.net
          )} ج.م`}
          type="positive"
        />

        <FinancialLine
          label="المصروفات"
          value={`${money(
            summary.expenses
          )} ج.م`}
        />

        <FinancialLine
          label="غير محصل خلال الفترة"
          value={`${money(
            summary.outstanding
          )} ج.م`}
          type={
            numberValue(
              summary.outstanding
            ) > 0
              ? "warning"
              : ""
          }
        />

        <FinancialLine
          label="المديونيات الحالية"
          value={`${money(
            debts.total
          )} ج.م`}
          type={
            debts.total > 0
              ? "danger"
              : ""
          }
        />
      </section>

      <main className="report-workspace">
        {/* REVENUE */}

        <section className="revenue-analysis">
          <div className="report-section-heading">
            <div>
              <span>
                REVENUE MOVEMENT
              </span>

              <strong>
                حركة الإيراد
              </strong>
            </div>

            <p>
              التحصيل اليومي خلال الفترة
            </p>
          </div>

          {dailyPerformance.length ? (
            <div className="revenue-chart">
              <div className="chart-field">
                <div className="chart-grid-line l1" />
                <div className="chart-grid-line l2" />
                <div className="chart-grid-line l3" />
                <div className="chart-grid-line l4" />

                <div className="chart-columns">
                  {dailyPerformance.map(
                    (item) => {
                      const height =
                        item.revenue
                          ? Math.max(
                              6,
                              (
                                item.revenue /
                                maxRevenue
                              ) *
                                100
                            )
                          : 2;

                      return (
                        <div
                          className="chart-column"
                          key={
                            item.key
                          }
                        >
                          <div className="bar-area">
                            <span>
                              {money(
                                item.revenue
                              )}
                            </span>

                            <div
                              className="revenue-bar"
                              style={{
                                height:
                                  `${height}%`,
                              }}
                            />
                          </div>

                          <strong>
                            {formatShortDate(
                              item.timestamp
                            )}
                          </strong>

                          <small>
                            {item.visits} زيارة
                          </small>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          ) : (
            <ReportEmpty
              text="لا توجد حركة مالية خلال هذه الفترة."
            />
          )}
        </section>

        {/* PULSE */}

        <aside className="clinic-pulse">
          <div className="report-section-heading">
            <div>
              <span>
                CLINIC PULSE
              </span>

              <strong>
                نبض العيادة
              </strong>
            </div>
          </div>

          <PulseLine
            icon={
              <Users
                size={18}
              />
            }
            title="معدل إتمام المواعيد"
            value={formatPercent(
              appointmentStats.attendanceRate
            )}
            note={`${appointmentStats.completed} مكتمل من ${appointmentStats.total} موعد`}
          />

          <PulseLine
            icon={
              <Clock3
                size={18}
              />
            }
            title="متوسط مدة الكشف"
            value={
              visitStats.averageDuration
                ? `${visitStats.averageDuration} د`
                : "—"
            }
            note="للزيارات ذات وقت بداية ونهاية"
          />

          <PulseLine
            icon={
              <TrendingDown
                size={18}
              />
            }
            title="إلغاء المواعيد"
            value={formatPercent(
              appointmentStats.cancellationRate
            )}
            note={`${appointmentStats.cancelled} موعد ملغي`}
          />

          <PulseLine
            icon={
              <TrendingUp
                size={18}
              />
            }
            title="نسبة الإعادة"
            value={formatPercent(
              visitStats.followupRate
            )}
            note={`${visitStats.followups} زيارة إعادة`}
          />

          <PulseLine
            icon={
              <ReceiptText
                size={18}
              />
            }
            title="نسبة التحصيل"
            value={formatPercent(
              summary.collectionRate
            )}
            note={`${money(
              summary.collected
            )} ج.م محصل`}
          />
        </aside>

        {/* DOCTORS */}

        <section className="doctor-performance">
          <div className="report-section-heading">
            <div>
              <span>
                DOCTOR PERFORMANCE
              </span>

              <strong>
                أداء الأطباء
              </strong>
            </div>

            <p>
              حسب الزيارات خلال الفترة
            </p>
          </div>

          {doctorPerformance.length ? (
            <>
              <div className="doctor-report-heading">
                <span>
                  الطبيب
                </span>

                <span>
                  الزيارات
                </span>

                <span>
                  جديد / إعادة
                </span>

                <span>
                  الإيراد
                </span>

                <span>
                  متوسط الكشف
                </span>
              </div>

              {doctorPerformance.map(
                (doctor) => (
                  <div
                    className="doctor-report-row"
                    key={
                      doctor.id
                    }
                  >
                    <div className="report-doctor">
                      <div>
                        {getInitials(
                          doctor.name
                        )}
                      </div>

                      <span>
                        <strong>
                          {doctor.name}
                        </strong>

                        <small>
                          أداء الفترة الحالية
                        </small>
                      </span>
                    </div>

                    <strong>
                      {formatNumber(
                        doctor.visits
                      )}
                    </strong>

                    <strong className="doctor-visit-breakdown">
                      {doctor.newVisits}
                      <small>
                        /
                      </small>
                      {doctor.followups}
                    </strong>

                    <strong>
                      {money(
                        doctor.revenue
                      )}{" "}
                      ج.م
                    </strong>

                    <strong>
                      {doctor.averageDuration
                        ? `${doctor.averageDuration} دقيقة`
                        : "—"}
                    </strong>
                  </div>
                )
              )}
            </>
          ) : (
            <ReportEmpty
              text="لا توجد زيارات أطباء خلال هذه الفترة."
            />
          )}
        </section>

        {/* VISIT MIX */}

        <section className="visit-distribution">
          <div className="report-section-heading">
            <div>
              <span>
                VISIT MIX
              </span>

              <strong>
                توزيع الزيارات
              </strong>
            </div>
          </div>

          <div className="visit-mix">
            <div className="visit-mix-main">
              <span>
                {formatNumber(
                  visitStats.total
                )}
              </span>

              <small>
                إجمالي زيارة
              </small>
            </div>

            <div className="visit-mix-lines">
              <MixLine
                title="كشف جديد"
                value={
                  visitStats.newVisits
                }
                percent={formatPercent(
                  newVisitPercent
                )}
                width={`${newVisitPercent}%`}
              />

              <MixLine
                title="إعادة"
                value={
                  visitStats.followups
                }
                percent={formatPercent(
                  followupPercent
                )}
                width={`${followupPercent}%`}
              />
            </div>
          </div>
        </section>

        {/* COLLECTION */}

        <section className="report-collection-section">
          <div className="report-section-heading">
            <div>
              <span>
                COLLECTION
              </span>

              <strong>
                التحصيل والفواتير
              </strong>
            </div>
          </div>

          <div className="report-collection-grid">
            <CollectionItem
              label="فواتير مدفوعة"
              value={
                summary.paidInvoices
              }
            />

            <CollectionItem
              label="دفع جزئي"
              value={
                summary.partialInvoices
              }
            />

            <CollectionItem
              label="غير مدفوعة"
              value={
                summary.unpaidInvoices
              }
            />

            <CollectionItem
              label="متوسط الفاتورة"
              value={`${money(
                summary.averageInvoice
              )} ج.م`}
            />
          </div>
        </section>
      </main>

      {/* BOTTOM */}

      <section className="reports-bottom">
        <div>
          <span>
            أكثر وقت ازدحامًا
          </span>

          <strong>
            {busiestHours.label}
          </strong>

          <p>
            {busiestHours.count
              ? `${formatPercent(
                  busiestHours.percent
                )} من الزيارات في هذه الساعة`
              : "لا توجد بيانات كافية"}
          </p>
        </div>

        <div>
          <span>
            متوسط قيمة الزيارة
          </span>

          <strong>
            {money(
              averageVisitValue
            )}{" "}
            ج.م
          </strong>

          <p>
            متوسط قيمة الفواتير مقابل عدد الزيارات
          </p>
        </div>

        <div>
          <span>
            المبالغ غير المحصلة
          </span>

          <strong>
            {money(
              summary.outstanding
            )}{" "}
            ج.م
          </strong>

          <p>
            {summary.unpaidInvoices ||
              summary.partialInvoices
              ? `${formatNumber(
                  numberValue(
                    summary.unpaidInvoices
                  ) +
                    numberValue(
                      summary.partialInvoices
                    )
                )} فاتورة تحتاج متابعة`
              : "لا توجد فواتير معلقة"}
          </p>
        </div>

        <div>
          <span>
            المرضى الفريدون
          </span>

          <strong>
            {formatNumber(
              visitStats.uniquePatients
            )}
          </strong>

          <p>
            عدد المرضى الذين تمت زيارتهم خلال الفترة
          </p>
        </div>
      </section>

      {/* PRINT FOOTER */}

      <footer className="reports-print-footer">
        <span>
          تم إنشاء التقرير من نظام OMG Clinic
        </span>

        <span>
          {new Intl.DateTimeFormat(
            "ar-EG",
            {
              dateStyle:
                "medium",
              timeStyle:
                "short",
            }
          ).format(
            new Date()
          )}
        </span>
      </footer>
    </div>
  );
}

/* =========================================================
   COMPONENTS
========================================================= */

function ReportMetric({
  icon,
  label,
  value,
  unit,
  helper,
}) {
  return (
    <div className="report-metric">
      <div className="report-metric-top">
        <span className="report-metric-icon">
          {icon}
        </span>

        <span>
          {label}
        </span>
      </div>

      <strong>
        {value}

        <small>
          {unit}
        </small>
      </strong>

      <p>
        {helper}
      </p>
    </div>
  );
}

function FinancialLine({
  label,
  value,
  type = "",
}) {
  return (
    <div
      className={`financial-line ${type}`}
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function PulseLine({
  icon,
  title,
  value,
  note,
}) {
  return (
    <div className="pulse-line">
      <div className="pulse-icon">
        {icon}
      </div>

      <span>
        <strong>
          {title}
        </strong>

        <small>
          {note}
        </small>
      </span>

      <b>
        {value}
      </b>
    </div>
  );
}

function MixLine({
  title,
  value,
  percent,
  width,
}) {
  return (
    <div className="mix-line">
      <div>
        <span>
          {title}
        </span>

        <strong>
          {formatNumber(
            value
          )}
        </strong>
      </div>

      <div className="mix-track">
        <i
          style={{
            width,
          }}
        />
      </div>

      <small>
        {percent}
      </small>
    </div>
  );
}

function CollectionItem({
  label,
  value,
}) {
  return (
    <div className="collection-item">
      <span>
        {label}
      </span>

      <strong>
        {typeof value ===
        "number"
          ? formatNumber(
              value
            )
          : value}
      </strong>
    </div>
  );
}

function ReportEmpty({
  text,
}) {
  return (
    <div className="report-empty">
      <Activity
        size={22}
      />

      <span>
        {text}
      </span>
    </div>
  );
}