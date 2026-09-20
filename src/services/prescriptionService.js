import {
  onValue,
  ref,
} from "firebase/database";
import { database } from "../config/firebase";

/* =========================================================
   HELPERS
========================================================= */

function toArray(snapshot) {
  if (!snapshot.exists()) return [];

  return Object.entries(snapshot.val()).map(
    ([id, value]) => ({
      id,
      ...value,
    })
  );
}

function normalizeTimestamp(value) {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

/* =========================================================
   ALL PRESCRIPTIONS
========================================================= */

export function subscribePrescriptions(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback?.([]);
    return () => {};
  }

  const prescriptionsRef = ref(
    database,
    `clinics/${clinicId}/prescriptions`
  );

  return onValue(
    prescriptionsRef,

    (snapshot) => {
      const prescriptions = toArray(snapshot)
        .filter(
          (item) =>
            item.status !== "deleted"
        )
        .sort(
          (a, b) =>
            normalizeTimestamp(
              b.createdAt || b.updatedAt
            ) -
            normalizeTimestamp(
              a.createdAt || a.updatedAt
            )
        );

      callback?.(prescriptions);
    },

    (error) => {
      console.error(
        "Prescriptions realtime error:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   PATIENTS
========================================================= */

export function subscribePrescriptionPatients(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback?.({});
    return () => {};
  }

  const patientsRef = ref(
    database,
    `clinics/${clinicId}/patients`
  );

  return onValue(
    patientsRef,

    (snapshot) => {
      if (!snapshot.exists()) {
        callback?.({});
        return;
      }

      callback?.(snapshot.val());
    },

    (error) => {
      console.error(
        "Prescription patients error:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   VISITS
========================================================= */

export function subscribePrescriptionVisits(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback?.({});
    return () => {};
  }

  const visitsRef = ref(
    database,
    `clinics/${clinicId}/visits`
  );

  return onValue(
    visitsRef,

    (snapshot) => {
      if (!snapshot.exists()) {
        callback?.({});
        return;
      }

      callback?.(snapshot.val());
    },

    (error) => {
      console.error(
        "Prescription visits error:",
        error
      );

      onError?.(error);
    }
  );
}