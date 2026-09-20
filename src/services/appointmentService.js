import {
  get,
  onValue,
  push,
  ref,
  serverTimestamp,
  set,
  update,
} from "firebase/database";

import {
  database,
} from "../config/firebase";

/* =========================================================
   HELPERS
   ========================================================= */

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}

function normalizePhone(
  value
) {
  return cleanText(value)
    .replace(/\s+/g, "")
    .replace(/[^\d+]/g, "");
}

function normalizeObjectList(
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
    return Object.entries(
      value
    ).map(
      ([id, item]) => ({
        id,
        ...item,
      })
    );
  }

  return [];
}

function sortAppointments(
  appointments
) {
  return [
    ...appointments,
  ].sort(
    (a, b) => {
      const dateA =
        `${a.date || ""} ${a.time || ""}`;

      const dateB =
        `${b.date || ""} ${b.time || ""}`;

      return dateA.localeCompare(
        dateB
      );
    }
  );
}



export async function startQueueVisit({
  clinicId,
  queueItem,
}) {
  if (!clinicId) {
    throw new Error(
      "Clinic ID is required."
    );
  }

  if (!queueItem?.id) {
    throw new Error(
      "بيانات قائمة الانتظار غير مكتملة."
    );
  }

  if (!queueItem?.patientId) {
    throw new Error(
      "بيانات المريض غير مكتملة."
    );
  }

  if (
    queueItem.status ===
    "completed"
  ) {
    throw new Error(
      "تم إنهاء الكشف بالفعل."
    );
  }

  if (
    queueItem.status ===
    "cancelled"
  ) {
    throw new Error(
      "تم إلغاء هذا المريض من قائمة الانتظار."
    );
  }

  const timestamp =
    serverTimestamp();

  const rootUpdates = {};

  rootUpdates[
    `clinics/${clinicId}/queue/${queueItem.id}/status`
  ] = "in-progress";

  rootUpdates[
    `clinics/${clinicId}/queue/${queueItem.id}/startedAt`
  ] = timestamp;

  rootUpdates[
    `clinics/${clinicId}/queue/${queueItem.id}/updatedAt`
  ] = timestamp;

  await update(
    ref(database),
    rootUpdates
  );

  return {
    patientId:
      queueItem.patientId,

    appointmentId:
      "",

    queueId:
      queueItem.id,
  };
}

/* =========================================================
   APPOINTMENTS REALTIME
   ========================================================= */

export function subscribeAppointments(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback?.([]);
    return () => {};
  }

  const appointmentsRef =
    ref(
      database,
      `clinics/${clinicId}/appointments`
    );

  return onValue(
    appointmentsRef,

    (snapshot) => {
      const appointments =
        normalizeObjectList(
          snapshot.val()
        );

      callback?.(
        sortAppointments(
          appointments
        )
      );
    },

    (error) => {
      console.error(
        "Appointments realtime error:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   PATIENTS REALTIME
   ========================================================= */

export function subscribeAppointmentPatients(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback?.([]);
    return () => {};
  }

  const patientsRef =
    ref(
      database,
      `clinics/${clinicId}/patients`
    );

  return onValue(
    patientsRef,

    (snapshot) => {
      const patients =
        normalizeObjectList(
          snapshot.val()
        )
          .filter(
            (patient) =>
              patient.status !==
              "archived"
          )
          .sort(
            (a, b) =>
              cleanText(
                a.name
              ).localeCompare(
                cleanText(
                  b.name
                ),
                "ar"
              )
          );

      callback?.(
        patients
      );
    },

    (error) => {
      console.error(
        "Appointment patients realtime error:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   STAFF / DOCTORS REALTIME
   ========================================================= */

export function subscribeAppointmentDoctors(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback?.([]);
    return () => {};
  }

  const staffRef =
    ref(
      database,
      `clinics/${clinicId}/staff`
    );

  return onValue(
    staffRef,

    (snapshot) => {
      const staff =
        normalizeObjectList(
          snapshot.val()
        );

      const doctors =
        staff
          .filter(
            (member) => {
              const role =
                cleanText(
                  member.role
                ).toLowerCase();

              return (
                member.status !==
                  "inactive" &&
                (
                  role ===
                    "doctor" ||
                  role ===
                    "owner" ||
                  member.isDoctor ===
                    true
                )
              );
            }
          )
          .map(
            (member) => ({
              id:
                member.id,

              name:
                member.name ||
                member.fullName ||
                member.displayName ||
                "طبيب",

              specialty:
                member.specialty ||
                member.specialization ||
                "",

              role:
                member.role ||
                "doctor",
            })
          );

      callback?.(
        doctors
      );
    },

    (error) => {
      console.error(
        "Doctors realtime error:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   CREATE APPOINTMENT
   ========================================================= */

export async function createAppointment({
  clinicId,
  patient,
  doctor,
  date,
  time,
  duration = 30,
  type = "كشف",
  notes = "",
  createdBy = "",
}) {
  if (!clinicId) {
    throw new Error(
      "clinicId is required"
    );
  }

  if (!patient?.id) {
    throw new Error(
      "يجب اختيار المريض."
    );
  }

  if (!date) {
    throw new Error(
      "يجب تحديد تاريخ الموعد."
    );
  }

  if (!time) {
    throw new Error(
      "يجب تحديد وقت الموعد."
    );
  }

  const appointmentRef =
    push(
      ref(
        database,
        `clinics/${clinicId}/appointments`
      )
    );

  const appointmentId =
    appointmentRef.key;

  const payload = {
    id:
      appointmentId,

    patientId:
      patient.id,

    patientName:
      cleanText(
        patient.name
      ),

    patientPhone:
      cleanText(
        patient.phone
      ),

    patientCode:
      cleanText(
        patient.patientCode
      ),

    doctorId:
      doctor?.id || "",

    doctorName:
      cleanText(
        doctor?.name
      ),

    doctorSpecialty:
      cleanText(
        doctor?.specialty
      ),

    date:
      cleanText(date),

    time:
      cleanText(time),

    duration:
      Number(duration) ||
      30,

    type:
      cleanText(type) ||
      "كشف",

    notes:
      cleanText(notes),

    source:
      "appointment",

    status:
      "confirmed",

    queueId:
      "",

    visitId:
      "",

    createdBy:
      cleanText(
        createdBy
      ),

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  await set(
    appointmentRef,
    payload
  );

  return {
    id:
      appointmentId,

    ...payload,
  };
}

/* =========================================================
   CREATE PATIENT + APPOINTMENT
   ========================================================= */

export async function createPatientAndAppointment({
  clinicId,
  patientData,
  doctor,
  date,
  time,
  duration = 30,
  type = "كشف",
  notes = "",
  createdBy = "",
}) {
  if (!clinicId) {
    throw new Error(
      "clinicId is required"
    );
  }

  const name =
    cleanText(
      patientData?.name
    );

  const phone =
    cleanText(
      patientData?.phone
    );

  if (!name) {
    throw new Error(
      "اسم المريض مطلوب."
    );
  }

  if (!phone) {
    throw new Error(
      "رقم الهاتف مطلوب."
    );
  }

  const patientRef =
    push(
      ref(
        database,
        `clinics/${clinicId}/patients`
      )
    );

  const patientId =
    patientRef.key;

  const shortCode =
    String(patientId)
      .slice(-6)
      .toUpperCase();

  const patient = {
    id:
      patientId,

    patientCode:
      `OMG-${shortCode}`,

    name,

    phone,

    normalizedPhone:
      normalizePhone(
        phone
      ),

    gender:
      cleanText(
        patientData?.gender
      ),

    dateOfBirth:
      cleanText(
        patientData?.dateOfBirth
      ),

    address:
      cleanText(
        patientData?.address
      ),

    status:
      "active",

    createdBy:
      cleanText(
        createdBy
      ),

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  await set(
    patientRef,
    patient
  );

  const appointment =
    await createAppointment({
      clinicId,
      patient,
      doctor,
      date,
      time,
      duration,
      type,
      notes,
      createdBy,
    });

  return {
    patient,
    appointment,
  };
}

/* =========================================================
   UPDATE APPOINTMENT
   ========================================================= */

export async function updateAppointment(
  clinicId,
  appointmentId,
  updates
) {
  if (
    !clinicId ||
    !appointmentId
  ) {
    throw new Error(
      "Appointment data is incomplete."
    );
  }

  const appointmentRef =
    ref(
      database,
      `clinics/${clinicId}/appointments/${appointmentId}`
    );

  await update(
    appointmentRef,
    {
      ...updates,

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   CANCEL APPOINTMENT
   ========================================================= */

export async function cancelAppointment(
  clinicId,
  appointmentId
) {
  await updateAppointment(
    clinicId,
    appointmentId,
    {
      status:
        "cancelled",

      cancelledAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   NO SHOW
   ========================================================= */

export async function markAppointmentNoShow(
  clinicId,
  appointmentId
) {
  await updateAppointment(
    clinicId,
    appointmentId,
    {
      status:
        "no-show",

      noShowAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   CHECK IN
   Appointment -> Queue
   ========================================================= */

export async function checkInAppointment({
  clinicId,
  appointment,
  staffId = "",
}) {
  if (
    !clinicId ||
    !appointment?.id
  ) {
    throw new Error(
      "بيانات الموعد غير مكتملة."
    );
  }

  if (
    appointment.status ===
      "arrived" &&
    appointment.queueId
  ) {
    return {
      queueId:
        appointment.queueId,
    };
  }

  if (
    appointment.status ===
      "in-progress"
  ) {
    throw new Error(
      "المريض داخل الكشف بالفعل."
    );
  }

  if (
    appointment.status ===
      "completed"
  ) {
    throw new Error(
      "تم إنهاء هذا الموعد بالفعل."
    );
  }

  if (
    appointment.status ===
      "cancelled"
  ) {
    throw new Error(
      "هذا الموعد ملغي."
    );
  }

  const queueRef =
    push(
      ref(
        database,
        `clinics/${clinicId}/queue`
      )
    );

  const queueId =
    queueRef.key;

  const rootUpdates = {};

  rootUpdates[
    `clinics/${clinicId}/queue/${queueId}`
  ] = {
    id:
      queueId,

    appointmentId:
      appointment.id,

    patientId:
      appointment.patientId,

    patientName:
      appointment.patientName,

    patientPhone:
      appointment.patientPhone ||
      "",

    patientCode:
      appointment.patientCode ||
      "",

    doctorId:
      appointment.doctorId ||
      "",

    doctorName:
      appointment.doctorName ||
      "",

    type:
      appointment.type ||
      "كشف",

    status:
      "waiting",

    source:
      "appointment",

    priority:
      "normal",

    checkedInBy:
      staffId,

    checkedInAt:
      serverTimestamp(),

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  rootUpdates[
    `clinics/${clinicId}/appointments/${appointment.id}/status`
  ] = "arrived";

  rootUpdates[
    `clinics/${clinicId}/appointments/${appointment.id}/queueId`
  ] = queueId;

  rootUpdates[
    `clinics/${clinicId}/appointments/${appointment.id}/arrivedAt`
  ] = serverTimestamp();

  rootUpdates[
    `clinics/${clinicId}/appointments/${appointment.id}/updatedAt`
  ] = serverTimestamp();

  await update(
    ref(database),
    rootUpdates
  );

  return {
    queueId,
  };
}

/* =========================================================
   WALK-IN
   Existing patient -> Queue directly
   ========================================================= */

export async function createWalkIn({
  clinicId,
  patient,
  doctor,
  type = "كشف",
  notes = "",
  staffId = "",
}) {
  if (!clinicId) {
    throw new Error(
      "clinicId is required"
    );
  }

  if (!patient?.id) {
    throw new Error(
      "يجب اختيار المريض."
    );
  }

  const queueRef =
    push(
      ref(
        database,
        `clinics/${clinicId}/queue`
      )
    );

  const queueId =
    queueRef.key;

  const payload = {
    id:
      queueId,

    appointmentId:
      "",

    patientId:
      patient.id,

    patientName:
      cleanText(
        patient.name
      ),

    patientPhone:
      cleanText(
        patient.phone
      ),

    patientCode:
      cleanText(
        patient.patientCode
      ),

    doctorId:
      doctor?.id || "",

    doctorName:
      cleanText(
        doctor?.name
      ),

    type:
      cleanText(type) ||
      "كشف",

    notes:
      cleanText(notes),

    status:
      "waiting",

    source:
      "walk-in",

    priority:
      "normal",

    checkedInBy:
      cleanText(
        staffId
      ),

    checkedInAt:
      serverTimestamp(),

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  await set(
    queueRef,
    payload
  );

  return {
    id:
      queueId,

    ...payload,
  };
}

/* =========================================================
   CREATE NEW PATIENT + WALK-IN
   ========================================================= */

export async function createPatientAndWalkIn({
  clinicId,
  patientData,
  doctor,
  type = "كشف",
  notes = "",
  staffId = "",
}) {
  const name =
    cleanText(
      patientData?.name
    );

  const phone =
    cleanText(
      patientData?.phone
    );

  if (!name) {
    throw new Error(
      "اسم المريض مطلوب."
    );
  }

  if (!phone) {
    throw new Error(
      "رقم الهاتف مطلوب."
    );
  }

  const patientRef =
    push(
      ref(
        database,
        `clinics/${clinicId}/patients`
      )
    );

  const patientId =
    patientRef.key;

  const shortCode =
    String(patientId)
      .slice(-6)
      .toUpperCase();

  const patient = {
    id:
      patientId,

    patientCode:
      `OMG-${shortCode}`,

    name,

    phone,

    normalizedPhone:
      normalizePhone(
        phone
      ),

    gender:
      cleanText(
        patientData?.gender
      ),

    dateOfBirth:
      cleanText(
        patientData?.dateOfBirth
      ),

    address:
      cleanText(
        patientData?.address
      ),

    status:
      "active",

    createdBy:
      cleanText(
        staffId
      ),

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  await set(
    patientRef,
    patient
  );

  const queueEntry =
    await createWalkIn({
      clinicId,
      patient,
      doctor,
      type,
      notes,
      staffId,
    });

  return {
    patient,
    queueEntry,
  };
}

/* =========================================================
   QUEUE REALTIME
   ========================================================= */

export function subscribeQueue(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback?.([]);
    return () => {};
  }

  const queueRef =
    ref(
      database,
      `clinics/${clinicId}/queue`
    );

  return onValue(
    queueRef,

    (snapshot) => {
      const queue =
        normalizeObjectList(
          snapshot.val()
        )
          .filter(
            (item) =>
              item.status !==
              "completed" &&
              item.status !==
              "cancelled"
          )
          .sort(
            (a, b) =>
              Number(
                a.checkedInAt ||
                  a.createdAt ||
                  0
              ) -
              Number(
                b.checkedInAt ||
                  b.createdAt ||
                  0
              )
          );

      callback?.(
        queue
      );
    },

    (error) => {
      console.error(
        "Queue realtime error:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   START VISIT
   Queue + Appointment -> in progress
   ========================================================= */

export async function startAppointmentVisit({
  clinicId,
  appointment,
  queueId = "",
}) {
  if (
    !clinicId ||
    !appointment?.patientId
  ) {
    throw new Error(
      "بيانات المريض غير مكتملة."
    );
  }

  const resolvedQueueId =
    queueId ||
    appointment.queueId ||
    "";

  const rootUpdates = {};

  if (
    appointment.id
  ) {
    rootUpdates[
      `clinics/${clinicId}/appointments/${appointment.id}/status`
    ] = "in-progress";

    rootUpdates[
      `clinics/${clinicId}/appointments/${appointment.id}/startedAt`
    ] = serverTimestamp();

    rootUpdates[
      `clinics/${clinicId}/appointments/${appointment.id}/updatedAt`
    ] = serverTimestamp();
  }

  if (
    resolvedQueueId
  ) {
    rootUpdates[
      `clinics/${clinicId}/queue/${resolvedQueueId}/status`
    ] = "in-progress";

    rootUpdates[
      `clinics/${clinicId}/queue/${resolvedQueueId}/startedAt`
    ] = serverTimestamp();

    rootUpdates[
      `clinics/${clinicId}/queue/${resolvedQueueId}/updatedAt`
    ] = serverTimestamp();
  }

  if (
    Object.keys(
      rootUpdates
    ).length
  ) {
    await update(
      ref(database),
      rootUpdates
    );
  }

  return {
    patientId:
      appointment.patientId,

    appointmentId:
      appointment.id || "",

    queueId:
      resolvedQueueId,
  };
}

/* =========================================================
   GET APPOINTMENT
   ========================================================= */

export async function getAppointment(
  clinicId,
  appointmentId
) {
  if (
    !clinicId ||
    !appointmentId
  ) {
    return null;
  }

  const snapshot =
    await get(
      ref(
        database,
        `clinics/${clinicId}/appointments/${appointmentId}`
      )
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  return {
    id:
      appointmentId,

    ...snapshot.val(),
  };
}