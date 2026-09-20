import {
  get,
  onValue,
  push,
  ref,
  set,
  update,
} from "firebase/database";

import { database } from "../config/firebase";

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value) {
  return String(value ?? "").trim();
}

function getTimestamp(value) {
  if (!value) return 0;

  if (typeof value === "number") {
    return value;
  }

  const parsed =
    new Date(value).getTime();

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}

function normalizeCategory(value) {
  if (
    value === "radiology" ||
    value === "imaging"
  ) {
    return "radiology";
  }

  return "lab";
}

function normalizeStatus(value) {
  const allowed = [
    "requested",
    "in-progress",
    "result-added",
    "reviewed",
    "cancelled",
  ];

  return allowed.includes(value)
    ? value
    : "requested";
}

/* =========================================================
   SUBSCRIBE MEDICAL FILES
========================================================= */

export function subscribeMedicalFiles(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback?.([]);
    return () => {};
  }

  const medicalFilesRef =
    ref(
      database,
      `clinics/${clinicId}/medicalFiles`
    );

  return onValue(
    medicalFilesRef,

    (snapshot) => {
      if (!snapshot.exists()) {
        callback?.([]);
        return;
      }

      const items =
        Object.entries(
          snapshot.val()
        )
          .map(
            ([id, value]) => ({
              id,
              ...value,
            })
          )
          .sort(
            (a, b) =>
              getTimestamp(
                b.createdAt ||
                  b.requestedAt
              ) -
              getTimestamp(
                a.createdAt ||
                  a.requestedAt
              )
          );

      callback?.(items);
    },

    (error) => {
      console.error(
        "Medical files realtime error:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   PATIENTS
========================================================= */

export function subscribeMedicalFilePatients(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback?.({});
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
      if (!snapshot.exists()) {
        callback?.({});
        return;
      }

      const data =
        snapshot.val();

      const patients = {};

      Object.entries(data).forEach(
        ([id, value]) => {
          patients[id] = {
            id,
            ...value,
          };
        }
      );

      callback?.(patients);
    },

    (error) => {
      console.error(
        "Medical file patients error:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   PATIENT MEDICAL FILES
========================================================= */

export function subscribePatientMedicalFiles(
  clinicId,
  patientId,
  callback,
  onError
) {
  if (
    !clinicId ||
    !patientId
  ) {
    callback?.([]);
    return () => {};
  }

  const medicalFilesRef =
    ref(
      database,
      `clinics/${clinicId}/medicalFiles`
    );

  return onValue(
    medicalFilesRef,

    (snapshot) => {
      if (!snapshot.exists()) {
        callback?.([]);
        return;
      }

      const items =
        Object.entries(
          snapshot.val()
        )
          .map(
            ([id, value]) => ({
              id,
              ...value,
            })
          )
          .filter(
            (item) =>
              item.patientId ===
              patientId
          )
          .sort(
            (a, b) =>
              getTimestamp(
                b.createdAt ||
                  b.requestedAt
              ) -
              getTimestamp(
                a.createdAt ||
                  a.requestedAt
              )
          );

      callback?.(items);
    },

    (error) => {
      console.error(
        "Patient medical files error:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   CREATE MEDICAL FILE
========================================================= */

export async function createMedicalFile({
  clinicId,

  patientId,
  patientName = "",
  patientCode = "",
  patientPhone = "",

  doctorId = "",
  doctorName = "",

  visitId = "",
  appointmentId = "",
  queueId = "",

  category = "lab",
  testName = "",

  priority = "normal",

  clinicalNotes = "",
  instructions = "",

  createdBy = "",
}) {
  if (!clinicId) {
    throw new Error(
      "Clinic ID is required."
    );
  }

  if (!patientId) {
    throw new Error(
      "Patient ID is required."
    );
  }

  if (!cleanText(testName)) {
    throw new Error(
      "Test name is required."
    );
  }

  const medicalFileId =
    push(
      ref(
        database,
        `clinics/${clinicId}/medicalFiles`
      )
    ).key;

  if (!medicalFileId) {
    throw new Error(
      "Could not create medical file."
    );
  }

  const timestamp =
    Date.now();

  const item = {
    id:
      medicalFileId,

    patientId,

    patientName:
      cleanText(patientName),

    patientCode:
      cleanText(patientCode),

    patientPhone:
      cleanText(patientPhone),

    doctorId:
      cleanText(doctorId),

    doctorName:
      cleanText(doctorName),

    visitId:
      cleanText(visitId),

    appointmentId:
      cleanText(appointmentId),

    queueId:
      cleanText(queueId),

    category:
      normalizeCategory(
        category
      ),

    testName:
      cleanText(testName),

    priority:
      priority === "urgent"
        ? "urgent"
        : "normal",

    clinicalNotes:
      cleanText(
        clinicalNotes
      ),

    instructions:
      cleanText(
        instructions
      ),

    status:
      "requested",

    result: null,

    review: null,

    whatsapp: {
      sent:
        false,

      sentAt:
        null,

      sentBy:
        "",

      phone:
        "",

      message:
        "",
    },

    createdBy:
      cleanText(createdBy),

    requestedAt:
      timestamp,

    createdAt:
      timestamp,

    updatedAt:
      timestamp,
  };

  await set(
    ref(
      database,
      `clinics/${clinicId}/medicalFiles/${medicalFileId}`
    ),

    item
  );

  return item;
}

/* =========================================================
   CREATE MEDICAL FILES FROM VISIT

   يسمح بإضافة أكثر من تحليل / أشعة مرة واحدة.
========================================================= */

export async function createMedicalFilesFromVisit({
  clinicId,

  patient,

  doctor,

  visitId,

  appointmentId = "",

  queueId = "",

  investigations = [],

  createdBy = "",
}) {
  if (!clinicId) {
    throw new Error(
      "Clinic ID is required."
    );
  }

  if (!patient?.id) {
    throw new Error(
      "Patient ID is required."
    );
  }

  if (!visitId) {
    throw new Error(
      "Visit ID is required."
    );
  }

  if (
    !Array.isArray(
      investigations
    ) ||
    investigations.length === 0
  ) {
    return [];
  }

  const timestamp =
    Date.now();

  const updates = {};

  const createdItems = [];

  investigations.forEach(
    (investigation) => {
      const testName =
        cleanText(
          investigation.testName ||
            investigation.name
        );

      if (!testName) {
        return;
      }

      const medicalFileId =
        push(
          ref(
            database,
            `clinics/${clinicId}/medicalFiles`
          )
        ).key;

      if (!medicalFileId) {
        return;
      }

      const category =
        normalizeCategory(
          investigation.category ||
            investigation.type
        );

      const item = {
        id:
          medicalFileId,

        patientId:
          patient.id,

        patientName:
          cleanText(
            patient.name
          ),

        patientCode:
          cleanText(
            patient.patientCode
          ),

        patientPhone:
          cleanText(
            patient.phone
          ),

        doctorId:
          cleanText(
            doctor?.id
          ),

        doctorName:
          cleanText(
            doctor?.name
          ),

        visitId,

        appointmentId:
          cleanText(
            appointmentId
          ),

        queueId:
          cleanText(
            queueId
          ),

        category,

        testName,

        priority:
          investigation.priority ===
          "urgent"
            ? "urgent"
            : "normal",

        clinicalNotes:
          cleanText(
            investigation.clinicalNotes
          ),

        instructions:
          cleanText(
            investigation.instructions
          ),

        status:
          "requested",

        result: null,

        review: null,

        whatsapp: {
          sent:
            false,

          sentAt:
            null,

          sentBy:
            "",

          phone:
            "",

          message:
            "",
        },

        createdBy:
          cleanText(
            createdBy ||
              doctor?.id
          ),

        requestedAt:
          timestamp,

        createdAt:
          timestamp,

        updatedAt:
          timestamp,
      };

      updates[
        `clinics/${clinicId}/medicalFiles/${medicalFileId}`
      ] = item;

      createdItems.push(
        item
      );
    }
  );

  if (
    createdItems.length === 0
  ) {
    return [];
  }

  await update(
    ref(database),
    updates
  );

  return createdItems;
}

/* =========================================================
   GET MEDICAL FILE
========================================================= */

export async function getMedicalFile(
  clinicId,
  medicalFileId
) {
  if (
    !clinicId ||
    !medicalFileId
  ) {
    return null;
  }

  const snapshot =
    await get(
      ref(
        database,
        `clinics/${clinicId}/medicalFiles/${medicalFileId}`
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id:
      medicalFileId,

    ...snapshot.val(),
  };
}

/* =========================================================
   CHANGE STATUS
========================================================= */

export async function changeMedicalFileStatus({
  clinicId,
  medicalFileId,
  status,
  changedBy = "",
}) {
  if (
    !clinicId ||
    !medicalFileId
  ) {
    throw new Error(
      "Medical file data is required."
    );
  }

  const normalizedStatus =
    normalizeStatus(status);

  const timestamp =
    Date.now();

  const payload = {
    status:
      normalizedStatus,

    updatedAt:
      timestamp,

    lastStatusChangedBy:
      cleanText(
        changedBy
      ),

    lastStatusChangedAt:
      timestamp,
  };

  if (
    normalizedStatus ===
    "in-progress"
  ) {
    payload.startedAt =
      timestamp;
  }

  if (
    normalizedStatus ===
    "cancelled"
  ) {
    payload.cancelledAt =
      timestamp;

    payload.cancelledBy =
      cleanText(
        changedBy
      );
  }

  await update(
    ref(
      database,
      `clinics/${clinicId}/medicalFiles/${medicalFileId}`
    ),

    payload
  );
}

/* =========================================================
   ADD / UPDATE RESULT

   Base64 داخل RTDB كما طلبت.
========================================================= */

export async function addMedicalFileResult({
  clinicId,

  medicalFileId,

  summary = "",

  notes = "",

  fileName = "",

  fileData = "",

  fileType = "",

  addedBy = "",
}) {
  if (
    !clinicId ||
    !medicalFileId
  ) {
    throw new Error(
      "Medical file data is required."
    );
  }

  if (
    !cleanText(summary) &&
    !cleanText(fileData)
  ) {
    throw new Error(
      "Result summary or file is required."
    );
  }

  const medicalFile =
    await getMedicalFile(
      clinicId,
      medicalFileId
    );

  if (!medicalFile) {
    throw new Error(
      "Medical file not found."
    );
  }

  const timestamp =
    Date.now();

  /*
   * لو المستخدم عدل النتيجة
   * ولم يرفع ملفًا جديدًا،
   * نحافظ على الملف القديم.
   */

  const previousResult =
    medicalFile.result || {};

  const finalFileData =
    cleanText(fileData) ||
    previousResult.fileData ||
    "";

  const finalFileName =
    cleanText(fileName) ||
    previousResult.fileName ||
    "";

  const finalFileType =
    cleanText(fileType) ||
    previousResult.fileType ||
    "";

  const result = {
    summary:
      cleanText(summary),

    notes:
      cleanText(notes),

    fileName:
      finalFileName,

    fileData:
      finalFileData,

    fileType:
      finalFileType,

    addedBy:
      cleanText(addedBy),

    addedAt:
      timestamp,

    updatedAt:
      timestamp,
  };

  const updates = {
    result,

    status:
      "result-added",

    resultAddedAt:
      timestamp,

    resultAddedBy:
      cleanText(
        addedBy
      ),

    /*
     * أي تعديل على النتيجة
     * يلغي المراجعة القديمة
     * حتى يراجع الطبيب النسخة الجديدة.
     */

    review:
      null,

    reviewedAt:
      null,

    reviewedBy:
      "",

    reviewedByName:
      "",

    updatedAt:
      timestamp,
  };

  await update(
    ref(
      database,
      `clinics/${clinicId}/medicalFiles/${medicalFileId}`
    ),

    updates
  );

  return {
    ...medicalFile,

    ...updates,

    result,
  };
}

/* =========================================================
   REVIEW RESULT
========================================================= */

export async function reviewMedicalFile({
  clinicId,

  medicalFileId,

  reviewedBy = "",

  reviewedByName = "",

  doctorNotes = "",
}) {
  if (
    !clinicId ||
    !medicalFileId
  ) {
    throw new Error(
      "Medical file data is required."
    );
  }

  const medicalFile =
    await getMedicalFile(
      clinicId,
      medicalFileId
    );

  if (!medicalFile) {
    throw new Error(
      "Medical file not found."
    );
  }

  if (!medicalFile.result) {
    throw new Error(
      "Result is required before review."
    );
  }

  const timestamp =
    Date.now();

  const review = {
    reviewedBy:
      cleanText(
        reviewedBy
      ),

    reviewedByName:
      cleanText(
        reviewedByName
      ),

    doctorNotes:
      cleanText(
        doctorNotes
      ),

    reviewedAt:
      timestamp,
  };

  await update(
    ref(
      database,
      `clinics/${clinicId}/medicalFiles/${medicalFileId}`
    ),

    {
      review,

      status:
        "reviewed",

      reviewedBy:
        cleanText(
          reviewedBy
        ),

      reviewedByName:
        cleanText(
          reviewedByName
        ),

      reviewedAt:
        timestamp,

      updatedAt:
        timestamp,
    }
  );

  return review;
}

/* =========================================================
   CANCEL REQUEST
========================================================= */

export async function cancelMedicalFile({
  clinicId,

  medicalFileId,

  cancelledBy = "",

  reason = "",
}) {
  if (
    !clinicId ||
    !medicalFileId
  ) {
    throw new Error(
      "Medical file data is required."
    );
  }

  const timestamp =
    Date.now();

  await update(
    ref(
      database,
      `clinics/${clinicId}/medicalFiles/${medicalFileId}`
    ),

    {
      status:
        "cancelled",

      cancellationReason:
        cleanText(
          reason
        ),

      cancelledBy:
        cleanText(
          cancelledBy
        ),

      cancelledAt:
        timestamp,

      updatedAt:
        timestamp,
    }
  );
}

/* =========================================================
   WHATSAPP
========================================================= */

export function buildMedicalFileWhatsAppMessage({
  item,

  patient,

  clinicName = "",
}) {
  const patientName =
    cleanText(
      patient?.name ||
        item?.patientName
    ) || "المريض";

  const testName =
    cleanText(
      item?.testName
    ) || "الفحص";

  const resultSummary =
    cleanText(
      item?.result?.summary
    );

  const doctorNotes =
    cleanText(
      item?.review
        ?.doctorNotes
    );

  const lines = [
    `مرحباً ${patientName}،`,

    clinicName
      ? `نتيجة الفحص من ${clinicName}:`
      : "نتيجة الفحص:",

    `الفحص: ${testName}`,
  ];

  if (resultSummary) {
    lines.push(
      `النتيجة: ${resultSummary}`
    );
  }

  if (doctorNotes) {
    lines.push(
      `ملاحظات الطبيب: ${doctorNotes}`
    );
  }

  lines.push(
    "",
    "نتمنى لكم دوام الصحة والعافية."
  );

  return lines.join("\n");
}

export function normalizeWhatsAppPhone(
  phone
) {
  let value =
    String(phone || "")
      .replace(/\D/g, "");

  if (!value) {
    return "";
  }

  /*
   * دعم أرقام مصر بشكل مباشر.
   * لو الرقم متخزن 01xxxxxxxxx
   * يتحول إلى 201xxxxxxxxx.
   */

  if (
    value.startsWith("0") &&
    value.length === 11
  ) {
    value =
      `20${value.slice(1)}`;
  }

  if (
    value.startsWith("00")
  ) {
    value =
      value.slice(2);
  }

  return value;
}

export function getMedicalFileWhatsAppUrl({
  item,

  patient,

  clinicName = "",
}) {
  const phone =
    normalizeWhatsAppPhone(
      patient?.phone ||
        item?.patientPhone
    );

  if (!phone) {
    throw new Error(
      "Patient phone is required."
    );
  }

  const message =
    buildMedicalFileWhatsAppMessage({
      item,
      patient,
      clinicName,
    });

  return `https://wa.me/${phone}?text=${encodeURIComponent(
    message
  )}`;
}

/* =========================================================
   MARK WHATSAPP SENT
========================================================= */

export async function markMedicalFileWhatsAppSent({
  clinicId,

  medicalFileId,

  phone = "",

  message = "",

  sentBy = "",
}) {
  if (
    !clinicId ||
    !medicalFileId
  ) {
    throw new Error(
      "Medical file data is required."
    );
  }

  const timestamp =
    Date.now();

  await update(
    ref(
      database,
      `clinics/${clinicId}/medicalFiles/${medicalFileId}`
    ),

    {
      whatsapp: {
        sent:
          true,

        sentAt:
          timestamp,

        sentBy:
          cleanText(
            sentBy
          ),

        phone:
          cleanText(
            phone
          ),

        message:
          cleanText(
            message
          ),
      },

      sentToPatientAt:
        timestamp,

      sentToPatientBy:
        cleanText(
          sentBy
        ),

      updatedAt:
        timestamp,
    }
  );
}