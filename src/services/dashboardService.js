import {
  onValue,
  ref,
} from "firebase/database";

import { database } from "../config/firebase";

/* =========================================================
   HELPERS
========================================================= */

function objectToArray(value) {
  if (!value) return [];

  return Object.entries(value).map(
    ([key, item]) => ({
      id: item?.id || key,
      ...item,
    })
  );
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  if (!value) return null;

  if (typeof value === "number") {
    return new Date(value);
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function isSameLocalDay(
  value,
  targetDate
) {
  const date = parseDate(value);

  if (!date) return false;

  return (
    date.getFullYear() ===
      targetDate.getFullYear() &&
    date.getMonth() ===
      targetDate.getMonth() &&
    date.getDate() ===
      targetDate.getDate()
  );
}

function appointmentDate(
  appointment
) {
  return (
    appointment.date ||
    appointment.appointmentDate ||
    appointment.scheduledDate ||
    appointment.createdAt
  );
}

function visitDate(visit) {
  return (
    visit.completedAt ||
    visit.visitDate ||
    visit.createdAt ||
    visit.updatedAt
  );
}

function transactionDate(
  transaction
) {
  return (
    transaction.paidAt ||
    transaction.createdAt ||
    transaction.date
  );
}

function expenseDate(expense) {
  return (
    expense.createdAt ||
    expense.date
  );
}

function getAppointmentTime(item) {
  return (
    item.time ||
    item.appointmentTime ||
    item.startTime ||
    ""
  );
}

function formatTime(value) {
  if (!value) return "--:--";

  if (
    typeof value === "string" &&
    /^\d{1,2}:\d{2}/.test(value)
  ) {
    const [hourString, minute] =
      value.split(":");

    let hour = Number(hourString);

    const period =
      hour >= 12 ? "م" : "ص";

    hour = hour % 12 || 12;

    return `${hour}:${minute} ${period}`;
  }

  const date = parseDate(value);

  if (!date) return "--:--";

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}

function getPatientName(
  item,
  patientsMap
) {
  if (
    item.patientName ||
    item.name
  ) {
    return (
      item.patientName ||
      item.name
    );
  }

  if (
    item.patientId &&
    patientsMap[item.patientId]
  ) {
    return (
      patientsMap[item.patientId]
        .name ||
      patientsMap[item.patientId]
        .fullName ||
      "مريض"
    );
  }

  return "مريض";
}

function getPatientPhone(
  item,
  patientsMap
) {
  if (item.phone) {
    return item.phone;
  }

  if (
    item.patientId &&
    patientsMap[item.patientId]
  ) {
    return (
      patientsMap[item.patientId]
        .phone || ""
    );
  }

  return "";
}

function getDoctorName(
  item,
  staffMap
) {
  if (item.doctorName) {
    return item.doctorName;
  }

  if (
    item.doctorId &&
    staffMap[item.doctorId]
  ) {
    return (
      staffMap[item.doctorId]
        .name || ""
    );
  }

  return "";
}

function getPaidAmount(
  transaction
) {
  return Number(
    transaction.paidAmount ??
      transaction.amount ??
      transaction.total ??
      0
  );
}

function getExpenseAmount(
  expense
) {
  return Number(
    expense.amount ?? 0
  );
}

function getQueueTimestamp(item) {
  return (
    item.arrivedAt ||
    item.checkInAt ||
    item.createdAt ||
    null
  );
}

function getWaitMinutes(item) {
  const timestamp =
    getQueueTimestamp(item);

  const date =
    parseDate(timestamp);

  if (!date) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (Date.now() -
        date.getTime()) /
        60000
    )
  );
}

function getInitials(name = "") {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "؟";
  }

  return parts
    .slice(0, 2)
    .map(
      (part) => part[0]
    )
    .join("");
}

function getLastSevenDays() {
  const days = [];

  for (
    let i = 6;
    i >= 0;
    i--
  ) {
    const date = new Date();

    date.setHours(
      0,
      0,
      0,
      0
    );

    date.setDate(
      date.getDate() - i
    );

    days.push(date);
  }

  return days;
}

/* =========================================================
   VISIT TYPE
========================================================= */

function isConsultationVisit(
  visit
) {
  return (
    visit.visitType ===
      "consultation" ||
    visit.visitType === "new" ||
    visit.visitType ===
      "new_visit" ||
    visit.visitTypeLabel ===
      "كشف جديد" ||
    visit.visitTypeLabel ===
      "كشف"
  );
}

function isFollowupVisit(visit) {
  return (
    visit.visitType ===
      "followup" ||
    visit.visitType ===
      "follow_up" ||
    visit.visitType ===
      "follow-up" ||
    visit.visitTypeLabel ===
      "إعادة"
  );
}

/* =========================================================
   DASHBOARD SUBSCRIPTION
========================================================= */

export function subscribeToDashboard(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    return () => {};
  }

  const clinicRef = ref(
    database,
    `clinics/${clinicId}`
  );

  return onValue(
    clinicRef,

    (snapshot) => {
      const clinic =
        snapshot.val() || {};

      const profile =
        clinic.profile || {};

      const patientsMap =
        clinic.patients || {};

      const staffMap =
        clinic.staff || {};

      const appointments =
        objectToArray(
          clinic.appointments
        );

      const queue =
        objectToArray(
          clinic.queue
        );

      const visits =
        objectToArray(
          clinic.visits
        );

      const finance =
        clinic.finance || {};

      const transactions =
        objectToArray(
          finance.transactions
        );

      const expenses =
        objectToArray(
          finance.expenses
        );

      const now =
        new Date();

      /* =====================================================
         TODAY APPOINTMENTS
      ===================================================== */

      const todayAppointments =
        appointments
          .filter(
            (item) =>
              isSameLocalDay(
                appointmentDate(
                  item
                ),
                now
              )
          )
          .sort(
            (a, b) =>
              getAppointmentTime(
                a
              ).localeCompare(
                getAppointmentTime(
                  b
                )
              )
          );

      const confirmedToday =
        todayAppointments.filter(
          (item) =>
            [
              "confirmed",
              "arrived",
              "waiting",
              "in_progress",
              "completed",
            ].includes(
              item.status
            )
        ).length;

      /* =====================================================
         TODAY COMPLETED VISITS
      ===================================================== */

      const todayVisits =
        visits.filter(
          (item) =>
            item.status ===
              "completed" &&
            isSameLocalDay(
              visitDate(item),
              now
            )
        );

      const consultationsToday =
        todayVisits.filter(
          isConsultationVisit
        ).length;

      const followupsToday =
        todayVisits.filter(
          isFollowupVisit
        ).length;

      const completedVisitsToday =
        todayVisits.length;

      /* =====================================================
         TODAY PATIENTS
      ===================================================== */

      const todayPatientsIds =
        new Set();

      todayAppointments.forEach(
        (item) => {
          if (item.patientId) {
            todayPatientsIds.add(
              item.patientId
            );
          }
        }
      );

      todayVisits.forEach(
        (item) => {
          if (item.patientId) {
            todayPatientsIds.add(
              item.patientId
            );
          }
        }
      );

      const newPatientsToday =
        Object.values(
          patientsMap
        ).filter(
          (patient) =>
            isSameLocalDay(
              patient.createdAt,
              now
            )
        ).length;

      /* =====================================================
         QUEUE
      ===================================================== */

      const activeQueue =
        queue
          .filter(
            (item) =>
              ![
                "completed",
                "cancelled",
                "removed",
              ].includes(
                item.status
              )
          )
          .sort(
            (a, b) => {
              const aOrder =
                Number(
                  a.order ??
                    a.queueNumber ??
                    999999
                );

              const bOrder =
                Number(
                  b.order ??
                    b.queueNumber ??
                    999999
                );

              return (
                aOrder -
                bOrder
              );
            }
          );

      const currentPatient =
        activeQueue.find(
          (item) =>
            [
              "in_progress",
              "in_exam",
              "examining",
            ].includes(
              item.status
            )
        ) || null;

      const waitingQueue =
        activeQueue.filter(
          (item) =>
            ![
              "in_progress",
              "in_exam",
              "examining",
            ].includes(
              item.status
            )
        );

      const averageWait =
        waitingQueue.length
          ? Math.round(
              waitingQueue.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  getWaitMinutes(
                    item
                  ),
                0
              ) /
                waitingQueue.length
            )
          : 0;

      /* =====================================================
         FINANCE
      ===================================================== */

      const todayTransactions =
        transactions.filter(
          (item) =>
            isSameLocalDay(
              transactionDate(
                item
              ),
              now
            )
        );

      const todayExpenses =
        expenses.filter(
          (item) =>
            isSameLocalDay(
              expenseDate(item),
              now
            )
        );

      const todayRevenue =
        todayTransactions.reduce(
          (
            sum,
            item
          ) =>
            sum +
            getPaidAmount(
              item
            ),
          0
        );

      const todayExpenseTotal =
        todayExpenses.reduce(
          (
            sum,
            item
          ) =>
            sum +
            getExpenseAmount(
              item
            ),
          0
        );

      /* =====================================================
         LAST 7 DAYS REVENUE
      ===================================================== */

      const sevenDays =
        getLastSevenDays();

      const revenueChart =
        sevenDays.map(
          (date) => {
            const value =
              transactions
                .filter(
                  (item) =>
                    isSameLocalDay(
                      transactionDate(
                        item
                      ),
                      date
                    )
                )
                .reduce(
                  (
                    sum,
                    item
                  ) =>
                    sum +
                    getPaidAmount(
                      item
                    ),
                  0
                );

            return {
              key:
                getLocalDateKey(
                  date
                ),

              label:
                new Intl.DateTimeFormat(
                  "ar-EG",
                  {
                    weekday:
                      "short",
                  }
                ).format(
                  date
                ),

              value,
            };
          }
        );

      const weekRevenue =
        revenueChart.reduce(
          (
            sum,
            day
          ) =>
            sum +
            day.value,
          0
        );

      /* =====================================================
         APPOINTMENTS VIEW
      ===================================================== */

      const appointmentsView =
        todayAppointments
          .slice(0, 7)
          .map(
            (item) => {
              const name =
                getPatientName(
                  item,
                  patientsMap
                );

              return {
                ...item,

                name,

                initials:
                  getInitials(
                    name
                  ),

                phone:
                  getPatientPhone(
                    item,
                    patientsMap
                  ),

                doctorName:
                  getDoctorName(
                    item,
                    staffMap
                  ),

                displayTime:
                  formatTime(
                    getAppointmentTime(
                      item
                    )
                  ),

                type:
                  item.type ||
                  item.visitTypeLabel ||
                  item.visitType ||
                  item.serviceName ||
                  "كشف",
              };
            }
          );

      /* =====================================================
         QUEUE VIEW
      ===================================================== */

      const queueView =
        waitingQueue
          .slice(0, 6)
          .map(
            (
              item,
              index
            ) => {
              const name =
                getPatientName(
                  item,
                  patientsMap
                );

              return {
                ...item,

                name,

                number:
                  String(
                    item.queueNumber ??
                      item.order ??
                      index +
                        1
                  ).padStart(
                    2,
                    "0"
                  ),

                waitMinutes:
                  getWaitMinutes(
                    item
                  ),

                doctorName:
                  getDoctorName(
                    item,
                    staffMap
                  ),
              };
            }
          );

      /* =====================================================
         CURRENT PATIENT VIEW
      ===================================================== */

      let currentPatientView =
        null;

      if (currentPatient) {
        const name =
          getPatientName(
            currentPatient,
            patientsMap
          );

        currentPatientView = {
          ...currentPatient,

          name,

          initials:
            getInitials(
              name
            ),

          doctorName:
            getDoctorName(
              currentPatient,
              staffMap
            ),
        };
      }

      /* =====================================================
         RECENT ACTIVITY
      ===================================================== */

      const recentActivity = [
        ...todayAppointments.map(
          (item) => ({
            id:
              `appointment-${item.id}`,

            type:
              "appointment",

            title:
              getPatientName(
                item,
                patientsMap
              ),

            description:
              item.status ===
              "completed"
                ? "تم إنهاء الموعد"
                : item.status ===
                    "arrived"
                  ? "وصل إلى العيادة"
                  : "موعد اليوم",

            time:
              getAppointmentTime(
                item
              ),
          })
        ),

        ...todayTransactions.map(
          (item) => ({
            id:
              `payment-${item.id}`,

            type:
              "payment",

            title:
              item.patientName ||
              "عملية تحصيل",

            description:
              `تم تحصيل ${getPaidAmount(
                item
              ).toLocaleString(
                "ar-EG"
              )} ج.م`,

            time:
              item.paidAt ||
              item.createdAt,
          })
        ),
      ]
        .slice(-6)
        .reverse();

      /* =====================================================
         RESULT
      ===================================================== */

      callback({
        profile,

        totals: {
          appointments:
            todayAppointments.length,

          confirmedAppointments:
            confirmedToday,

          patientsToday:
            todayPatientsIds.size,

          newPatientsToday,

          completedVisits:
            completedVisitsToday,

          consultations:
            consultationsToday,

          followups:
            followupsToday,

          waiting:
            waitingQueue.length,

          averageWait,

          revenue:
            todayRevenue,

          expenses:
            todayExpenseTotal,

          net:
            todayRevenue -
            todayExpenseTotal,

          weekRevenue,
        },

        appointments:
          appointmentsView,

        queue:
          queueView,

        currentPatient:
          currentPatientView,

        revenueChart,

        recentActivity,
      });
    },

    (error) => {
      console.error(
        "Dashboard realtime error:",
        error
      );

      onError?.(error);
    }
  );
}