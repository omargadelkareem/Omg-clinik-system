import {
  onValue,
  ref,
} from "firebase/database";

import {
  database,
} from "../config/firebase";

function toArray(value) {
  if (!value) return [];

  return Object.entries(value).map(
    ([id, item]) => ({
      id: item?.id || id,
      ...item,
    })
  );
}

function getTime(value) {
  if (!value) return 0;

  if (typeof value === "number") {
    return value;
  }

  const parsed = new Date(
    value
  ).getTime();

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}

function belongsToPatient(
  item,
  patientId
) {
  return (
    item?.patientId === patientId
  );
}

export function subscribeToPatientChart(
  clinicId,
  patientId,
  callback,
  onError
) {
  if (!clinicId || !patientId) {
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

      const visits = toArray(
        clinic.visits
      )
        .filter((item) =>
          belongsToPatient(
            item,
            patientId
          )
        )
        .sort(
          (a, b) =>
            getTime(
              b.createdAt ||
                b.visitDate
            ) -
            getTime(
              a.createdAt ||
                a.visitDate
            )
        );

      const prescriptions =
        toArray(
          clinic.prescriptions
        )
          .filter((item) =>
            belongsToPatient(
              item,
              patientId
            )
          )
          .sort(
            (a, b) =>
              getTime(
                b.createdAt
              ) -
              getTime(
                a.createdAt
              )
          );

      const medicalFiles =
        toArray(
          clinic.medicalFiles
        )
          .filter((item) =>
            belongsToPatient(
              item,
              patientId
            )
          )
          .sort(
            (a, b) =>
              getTime(
                b.createdAt
              ) -
              getTime(
                a.createdAt
              )
          );

      const appointments =
        toArray(
          clinic.appointments
        )
          .filter((item) =>
            belongsToPatient(
              item,
              patientId
            )
          )
          .sort(
            (a, b) =>
              getTime(
                a.startAt ||
                  a.date ||
                  a.appointmentDate
              ) -
              getTime(
                b.startAt ||
                  b.date ||
                  b.appointmentDate
              )
          );

      const now = Date.now();

      const upcomingAppointment =
        appointments.find(
          (item) => {
            if (
              [
                "cancelled",
                "completed",
              ].includes(
                item.status
              )
            ) {
              return false;
            }

            const time = getTime(
              item.startAt ||
                item.date ||
                item.appointmentDate
            );

            return (
              !time ||
              time >= now
            );
          }
        ) || null;

      callback({
        visits,
        prescriptions,
        medicalFiles,
        appointments,

        latestVisit:
          visits[0] || null,

        upcomingAppointment,
      });
    },

    (error) => {
      console.error(
        "Patient chart error:",
        error
      );

      onError?.(error);
    }
  );
}