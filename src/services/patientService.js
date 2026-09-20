import {
  get,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from "firebase/database";

import { database } from "../config/firebase";

function patientsPath(clinicId) {
  if (!clinicId) {
    throw new Error("clinicId is required");
  }

  return `clinics/${clinicId}/patients`;
}

function normalizePatient(id, data = {}) {
  return {
    id,
    patientCode: data.patientCode || "",
    name: data.name || "",
    phone: data.phone || "",
    gender: data.gender || "",
    dateOfBirth: data.dateOfBirth || "",
    bloodType: data.bloodType || "",
    maritalStatus: data.maritalStatus || "",
    address: data.address || "",
    emergencyContact:
      data.emergencyContact || "",
    notes: data.notes || "",
    status: data.status || "active",
    createdAt: data.createdAt || null,
    createdBy: data.createdBy || "",
    updatedAt: data.updatedAt || null,
  };
}

export function subscribeToPatients(
  clinicId,
  callback,
  onError
) {
  const patientsRef = ref(
    database,
    patientsPath(clinicId)
  );

  return onValue(
    patientsRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }

      const data = snapshot.val();

      const patients = Object.entries(data)
        .map(([id, patient]) =>
          normalizePatient(id, patient)
        )
        .sort((a, b) => {
          return (
            Number(b.createdAt || 0) -
            Number(a.createdAt || 0)
          );
        });

      callback(patients);
    },
    (error) => {
      console.error(
        "Patients realtime error:",
        error
      );

      onError?.(error);
    }
  );
}

export async function getPatient(
  clinicId,
  patientId
) {
  const snapshot = await get(
    ref(
      database,
      `${patientsPath(
        clinicId
      )}/${patientId}`
    )
  );

  if (!snapshot.exists()) {
    return null;
  }

  return normalizePatient(
    patientId,
    snapshot.val()
  );
}

export function subscribeToPatient(
  clinicId,
  patientId,
  callback,
  onError
) {
  if (!clinicId || !patientId) {
    return () => {};
  }

  const patientRef = ref(
    database,
    `clinics/${clinicId}/patients/${patientId}`
  );

  return onValue(
    patientRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      callback(
        normalizePatient(
          patientId,
          snapshot.val()
        )
      );
    },
    (error) => {
      console.error(
        "Patient realtime error:",
        error
      );

      onError?.(error);
    }
  );
}

export async function findPatientByPhone(
  clinicId,
  phone
) {
  const cleanPhone =
    phone.replace(/\s+/g, "");

  const snapshot = await get(
    ref(
      database,
      patientsPath(clinicId)
    )
  );

  if (!snapshot.exists()) {
    return null;
  }

  const patients =
    snapshot.val();

  const entry = Object.entries(
    patients
  ).find(([, patient]) => {
    return (
      patient.phone
        ?.replace(/\s+/g, "") ===
      cleanPhone
    );
  });

  if (!entry) {
    return null;
  }

  return normalizePatient(
    entry[0],
    entry[1]
  );
}

export async function createPatient({
  clinicId,
  userId,
  data,
}) {
  const duplicate =
    await findPatientByPhone(
      clinicId,
      data.phone
    );

  if (duplicate) {
    const error = new Error(
      "يوجد مريض مسجل بنفس رقم الهاتف."
    );

    error.code =
      "patient/phone-exists";

    error.patient = duplicate;

    throw error;
  }

  const newPatientRef = push(
    ref(
      database,
      patientsPath(clinicId)
    )
  );

  const patientId =
    newPatientRef.key;

  const shortId = patientId
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-6)
    .toUpperCase();

  const patient = {
    id: patientId,

    patientCode:
      `OMG-${shortId}`,

    name: data.name.trim(),

    phone:
      data.phone
        .replace(/\s+/g, "")
        .trim(),

    gender:
      data.gender || "",

    dateOfBirth:
      data.dateOfBirth || "",

    bloodType:
      data.bloodType || "",

    maritalStatus:
      data.maritalStatus || "",

    address:
      data.address?.trim() || "",

    emergencyContact:
      data.emergencyContact
        ?.trim() || "",

    notes:
      data.notes?.trim() || "",

    status: "active",

    createdBy:
      userId || "",

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  await set(
    newPatientRef,
    patient
  );

  return {
    ...patient,
    id: patientId,
  };
}

export async function updatePatient({
  clinicId,
  patientId,
  data,
}) {
  if (data.phone) {
    const duplicate =
      await findPatientByPhone(
        clinicId,
        data.phone
      );

    if (
      duplicate &&
      duplicate.id !== patientId
    ) {
      const error = new Error(
        "رقم الهاتف مستخدم لمريض آخر."
      );

      error.code =
        "patient/phone-exists";

      throw error;
    }
  }

  const patientRef = ref(
    database,
    `${patientsPath(
      clinicId
    )}/${patientId}`
  );

  await update(patientRef, {
    ...data,

    ...(data.name && {
      name: data.name.trim(),
    }),

    ...(data.phone && {
      phone: data.phone
        .replace(/\s+/g, "")
        .trim(),
    }),

    updatedAt:
      serverTimestamp(),
  });
}

export async function deletePatient(
  clinicId,
  patientId
) {
  await remove(
    ref(
      database,
      `${patientsPath(
        clinicId
      )}/${patientId}`
    )
  );
}