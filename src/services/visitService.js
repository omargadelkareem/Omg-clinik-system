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
import { createFinanceTransaction } from "./financeService";

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value) {
  return String(value ?? "").trim();
}

function getVitals(visit = {}) {
  return {
    bloodPressure: cleanText(
      visit.pressure ||
        visit.vitals?.bloodPressure
    ),

    pulse: cleanText(
      visit.pulse ||
        visit.vitals?.pulse
    ),

    temperature: cleanText(
      visit.temperature ||
        visit.vitals?.temperature
    ),

    oxygen: cleanText(
      visit.spo2 ||
        visit.vitals?.oxygen
    ),

    weight: cleanText(
      visit.weight ||
        visit.vitals?.weight
    ),
  };
}

function normalizeMedicines(
  medicines = []
) {
  if (!Array.isArray(medicines)) {
    return [];
  }

  return medicines
    .filter(
      (medicine) =>
        medicine?.name
    )
    .map((medicine) => ({
      id:
        medicine.id || null,

      drugId:
        medicine.drugId || "",

      name:
        cleanText(
          medicine.name
        ),

      activeIngredient:
        cleanText(
          medicine.activeIngredient ||
            medicine.generic
        ),

      concentration:
        cleanText(
          medicine.concentration ||
            medicine.strength
        ),

      form:
        cleanText(
          medicine.form
        ),

      dose:
        cleanText(
          medicine.dose
        ),

      frequency:
        cleanText(
          medicine.frequency
        ),

      duration:
        cleanText(
          medicine.duration
        ),

      timing:
        cleanText(
          medicine.timing
        ),

      instructions:
        cleanText(
          medicine.instructions
        ),
    }));
}

function normalizeInvestigations(
  investigations = []
) {
  if (
    !Array.isArray(
      investigations
    )
  ) {
    return [];
  }

  return investigations
    .filter(
      (item) =>
        item?.name
    )
    .map((item) => ({
      clientId:
        item.id || "",

      type:
        item.type ===
        "imaging"
          ? "imaging"
          : "lab",

      name:
        cleanText(
          item.name
        ),

      priority:
        item.priority ===
        "urgent"
          ? "urgent"
          : "normal",

      instructions:
        cleanText(
          item.instructions
        ),

      status:
        "requested",
    }));
}

function numberValue(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

/* =========================================================
   PRICING
========================================================= */

async function getVisitPricing(
  clinicId,
  patientId
) {
  const [
    settingsSnapshot,
    visitsSnapshot,
  ] = await Promise.all([
    get(
      ref(
        database,
        `clinics/${clinicId}/settings/pricing`
      )
    ),

    get(
      ref(
        database,
        `clinics/${clinicId}/visits`
      )
    ),
  ]);

  const pricing =
    settingsSnapshot.exists()
      ? settingsSnapshot.val()
      : {};

  const consultationPrice =
    numberValue(
      pricing.consultationPrice,
      0
    );

  const followupPrice =
    numberValue(
      pricing.followupPrice,
      0
    );

  const followupDays =
    Math.max(
      0,
      numberValue(
        pricing.followupDays,
        0
      )
    );

  let previousVisit =
    null;

  if (
    visitsSnapshot.exists()
  ) {
    previousVisit =
      Object.entries(
        visitsSnapshot.val()
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
              patientId &&
            item.status ===
              "completed"
        )
        .sort(
          (a, b) =>
            Number(
              b.completedAt ||
                b.createdAt ||
                0
            ) -
            Number(
              a.completedAt ||
                a.createdAt ||
                0
            )
        )[0] || null;
  }

  const previousVisitAt =
    Number(
      previousVisit
        ?.completedAt ||
        previousVisit
          ?.createdAt ||
        0
    );

  const followupWindowMs =
    followupDays *
    24 *
    60 *
    60 *
    1000;

  const difference =
    previousVisitAt
      ? Date.now() -
        previousVisitAt
      : 0;

  const isFollowup =
    Boolean(
      previousVisitAt &&
        followupDays > 0 &&
        difference >= 0 &&
        difference <=
          followupWindowMs
    );

  return {
    visitType:
      isFollowup
        ? "followup"
        : "consultation",

    visitTypeLabel:
      isFollowup
        ? "إعادة"
        : "كشف جديد",

    price:
      isFollowup
        ? followupPrice
        : consultationPrice,

    consultationPrice,

    followupPrice,

    followupDays,

    previousVisitId:
      previousVisit?.id ||
      "",

    previousVisitAt:
      previousVisitAt ||
      null,
  };
}

/* =========================================================
   DRUG LIBRARY
========================================================= */

export function subscribeDrugLibrary(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback?.([]);
    return () => {};
  }

  const drugsRef = ref(
    database,
    `clinics/${clinicId}/drugLibrary`
  );

  return onValue(
    drugsRef,

    (snapshot) => {
      if (
        !snapshot.exists()
      ) {
        callback?.([]);
        return;
      }

      const drugs =
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
            (drug) =>
              drug.status !==
              "archived"
          )
          .sort(
            (a, b) =>
              String(
                a.name || ""
              ).localeCompare(
                String(
                  b.name || ""
                ),
                "ar"
              )
          );

      callback?.(drugs);
    },

    (error) => {
      console.error(
        "Drug library realtime error:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   SAVE DRAFT
========================================================= */

export async function saveVisitDraft({
  clinicId,
  draftId,
  patient,
  doctor,
  visit,
  appointmentId = "",
  queueId = "",
  source = "direct",
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

  const draftsRef =
    ref(
      database,
      `clinics/${clinicId}/visitDrafts`
    );

  const id =
    draftId ||
    push(draftsRef).key;

  if (!id) {
    throw new Error(
      "Could not create draft ID."
    );
  }

  const draftRef =
    ref(
      database,
      `clinics/${clinicId}/visitDrafts/${id}`
    );

  const payload = {
    id,

    patientId:
      patient.id,

    patientName:
      patient.name || "",

    patientCode:
      patient.patientCode ||
      "",

    doctorId:
      doctor?.id || "",

    doctorName:
      doctor?.name || "",

    appointmentId:
      appointmentId || "",

    queueId:
      queueId || "",

    source:
      source || "direct",

    status:
      "draft",

    complaint:
      cleanText(
        visit.complaint
      ),

    duration:
      cleanText(
        visit.duration
      ),

    history:
      cleanText(
        visit.history
      ),

    examination:
      cleanText(
        visit.examination
      ),

    diagnosis:
      cleanText(
        visit.diagnosis
      ),

    notes:
      cleanText(
        visit.notes
      ),

    vitals:
      getVitals(visit),

    followUp:
      cleanText(
        visit.followUp
      ),

    prescriptionNotes:
      cleanText(
        visit.prescriptionNotes
      ),

    medicines:
      normalizeMedicines(
        visit.medicines
      ),

    investigations:
      normalizeInvestigations(
        visit.investigations
      ),

    updatedAt:
      serverTimestamp(),
  };

  const existingSnapshot =
    await get(
      draftRef
    );

  if (
    existingSnapshot.exists() &&
    existingSnapshot.val()
      ?.createdAt
  ) {
    payload.createdAt =
      existingSnapshot.val()
        .createdAt;
  } else {
    payload.createdAt =
      serverTimestamp();
  }

  await set(
    draftRef,
    payload
  );

  if (queueId) {
    await update(
      ref(
        database,
        `clinics/${clinicId}/queue/${queueId}`
      ),
      {
        draftId:
          id,

        updatedAt:
          serverTimestamp(),
      }
    );
  }

  return id;
}

/* =========================================================
   GET DRAFT
========================================================= */

export async function getVisitDraft(
  clinicId,
  draftId
) {
  if (
    !clinicId ||
    !draftId
  ) {
    return null;
  }

  const snapshot =
    await get(
      ref(
        database,
        `clinics/${clinicId}/visitDrafts/${draftId}`
      )
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  return {
    id:
      draftId,

    ...snapshot.val(),
  };
}

/* =========================================================
   DELETE DRAFT
========================================================= */

export async function deleteVisitDraft(
  clinicId,
  draftId
) {
  if (
    !clinicId ||
    !draftId
  ) {
    return;
  }

  await remove(
    ref(
      database,
      `clinics/${clinicId}/visitDrafts/${draftId}`
    )
  );
}

/* =========================================================
   COMPLETE VISIT
========================================================= */

export async function completeVisit({
  clinicId,
  patient,
  doctor,
  visit,
  draftId = null,
  appointmentId = "",
  queueId = "",
  source = "direct",
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

  if (
    !cleanText(
      visit?.diagnosis
    )
  ) {
    throw new Error(
      "Diagnosis is required."
    );
  }

  /*
   * نقرأ السعر ونحدد كشف/إعادة
   * قبل إنشاء الزيارة الجديدة.
   */
  const pricingResult =
    await getVisitPricing(
      clinicId,
      patient.id
    );

  const visitId =
    push(
      ref(
        database,
        `clinics/${clinicId}/visits`
      )
    ).key;

  if (!visitId) {
    throw new Error(
      "Could not create visit."
    );
  }

  const medicines =
    normalizeMedicines(
      visit.medicines
    );

  const investigations =
    normalizeInvestigations(
      visit.investigations
    );

  const timestamp =
    Date.now();

  /* =======================================================
     PRESCRIPTION ID
  ======================================================= */

  let prescriptionId =
    null;

  if (
    medicines.length > 0
  ) {
    prescriptionId =
      push(
        ref(
          database,
          `clinics/${clinicId}/prescriptions`
        )
      ).key;

    if (!prescriptionId) {
      throw new Error(
        "Could not create prescription."
      );
    }
  }

  /* =======================================================
     MEDICAL FILES
  ======================================================= */

  const medicalFiles =
    investigations.map(
      (item) => {
        const id =
          push(
            ref(
              database,
              `clinics/${clinicId}/medicalFiles`
            )
          ).key;

        if (!id) {
          throw new Error(
            "Could not create medical request."
          );
        }

        return {
          id,

          visitId,

          patientId:
            patient.id,

          patientName:
            patient.name || "",

          patientCode:
            patient.patientCode ||
            "",

          patientPhone:
            patient.phone || "",

          doctorId:
            doctor?.id || "",

          doctorName:
            doctor?.name || "",

          appointmentId:
            appointmentId || "",

          queueId:
            queueId || "",

          source:
            source ||
            "direct",

          type:
            item.type,

          name:
            item.name,

          priority:
            item.priority,

          instructions:
            item.instructions,

          status:
            "requested",

          resultText:
            "",

          attachments:
            [],

          requestedAt:
            timestamp,

          uploadedAt:
            null,

          reviewedAt:
            null,

          reviewedBy:
            "",

          sentToPatientAt:
            null,

          createdAt:
            timestamp,

          updatedAt:
            timestamp,
        };
      }
    );

  const medicalFileIds =
    medicalFiles.map(
      (item) =>
        item.id
    );

  /* =======================================================
     VISIT
  ======================================================= */

  const visitPayload = {
    id:
      visitId,

    patientId:
      patient.id,

    patientName:
      patient.name || "",

    patientCode:
      patient.patientCode ||
      "",

    patientPhone:
      patient.phone || "",

    doctorId:
      doctor?.id || "",

    doctorName:
      doctor?.name || "",

    appointmentId:
      appointmentId || "",

    queueId:
      queueId || "",

    source:
      source ||
      (
        queueId
          ? "queue"
          : appointmentId
            ? "appointment"
            : "direct"
      ),

    complaint:
      cleanText(
        visit.complaint
      ),

    duration:
      cleanText(
        visit.duration
      ),

    history:
      cleanText(
        visit.history
      ),

    examination:
      cleanText(
        visit.examination
      ),

    diagnosis:
      cleanText(
        visit.diagnosis
      ),

    notes:
      cleanText(
        visit.notes
      ),

    vitals:
      getVitals(
        visit
      ),

    followUp:
      cleanText(
        visit.followUp
      ),

    prescriptionNotes:
      cleanText(
        visit.prescriptionNotes
      ),

    medicines,

    investigations:
      investigations.map(
        (
          item,
          index
        ) => ({
          ...item,

          medicalFileId:
            medicalFileIds[
              index
            ],
        })
      ),

    medicalFileIds,

    prescriptionId:
      prescriptionId ||
      null,

    /* =====================================================
       PRICING SNAPSHOT
    ===================================================== */

    visitType:
      pricingResult.visitType,

    visitTypeLabel:
      pricingResult.visitTypeLabel,

    visitPrice:
      pricingResult.price,

    servicePrice:
      pricingResult.price,

    pricingSnapshot: {
      consultationPrice:
        pricingResult.consultationPrice,

      followupPrice:
        pricingResult.followupPrice,

      followupDays:
        pricingResult.followupDays,

      resolvedAt:
        timestamp,
    },

    previousVisitId:
      pricingResult.previousVisitId,

    previousVisitAt:
      pricingResult.previousVisitAt,

    /* =====================================================
       FINANCE
    ===================================================== */

    financeTransactionId:
      "",

    invoiceNumber:
      "",

    financeStatus:
      pricingResult.price > 0
        ? "pending"
        : "free",

    status:
      "completed",

    createdAt:
      timestamp,

    completedAt:
      timestamp,

    updatedAt:
      timestamp,
  };

  /* =======================================================
     ATOMIC MEDICAL UPDATE
  ======================================================= */

  const updates = {};

  updates[
    `clinics/${clinicId}/visits/${visitId}`
  ] =
    visitPayload;

  /* =======================================================
     PRESCRIPTION
  ======================================================= */

  if (
    prescriptionId
  ) {
    updates[
      `clinics/${clinicId}/prescriptions/${prescriptionId}`
    ] = {
      id:
        prescriptionId,

      visitId,

      patientId:
        patient.id,

      patientName:
        patient.name ||
        "",

      patientCode:
        patient.patientCode ||
        "",

      patientPhone:
        patient.phone ||
        "",

      doctorId:
        doctor?.id || "",

      doctorName:
        doctor?.name || "",

      diagnosis:
        cleanText(
          visit.diagnosis
        ),

      medicines,

      notes:
        cleanText(
          visit.prescriptionNotes
        ),

      followUp:
        cleanText(
          visit.followUp
        ),

      status:
        "active",

      createdAt:
        timestamp,

      updatedAt:
        timestamp,
    };
  }

  /* =======================================================
     MEDICAL FILES
  ======================================================= */

  medicalFiles.forEach(
    (file) => {
      updates[
        `clinics/${clinicId}/medicalFiles/${file.id}`
      ] =
        file;
    }
  );

  /* =======================================================
     DELETE DRAFT
  ======================================================= */

  if (draftId) {
    updates[
      `clinics/${clinicId}/visitDrafts/${draftId}`
    ] =
      null;
  }

  /* =======================================================
     UPDATE PATIENT
  ======================================================= */

  updates[
    `clinics/${clinicId}/patients/${patient.id}/lastVisitId`
  ] =
    visitId;

  updates[
    `clinics/${clinicId}/patients/${patient.id}/lastVisitAt`
  ] =
    timestamp;

  updates[
    `clinics/${clinicId}/patients/${patient.id}/lastVisitType`
  ] =
    pricingResult.visitType;

  updates[
    `clinics/${clinicId}/patients/${patient.id}/lastVisitTypeLabel`
  ] =
    pricingResult.visitTypeLabel;

  updates[
    `clinics/${clinicId}/patients/${patient.id}/lastVisitPrice`
  ] =
    pricingResult.price;

  updates[
    `clinics/${clinicId}/patients/${patient.id}/lastDiagnosis`
  ] =
    cleanText(
      visit.diagnosis
    );

  updates[
    `clinics/${clinicId}/patients/${patient.id}/updatedAt`
  ] =
    timestamp;

  /* =======================================================
     APPOINTMENT
  ======================================================= */

  if (
    appointmentId
  ) {
    updates[
      `clinics/${clinicId}/appointments/${appointmentId}/status`
    ] =
      "completed";

    updates[
      `clinics/${clinicId}/appointments/${appointmentId}/visitId`
    ] =
      visitId;

    updates[
      `clinics/${clinicId}/appointments/${appointmentId}/completedAt`
    ] =
      timestamp;

    updates[
      `clinics/${clinicId}/appointments/${appointmentId}/updatedAt`
    ] =
      timestamp;

    updates[
      `clinics/${clinicId}/appointments/${appointmentId}/prescriptionId`
    ] =
      prescriptionId ||
      "";

    updates[
      `clinics/${clinicId}/appointments/${appointmentId}/visitType`
    ] =
      pricingResult.visitType;

    updates[
      `clinics/${clinicId}/appointments/${appointmentId}/visitTypeLabel`
    ] =
      pricingResult.visitTypeLabel;

    updates[
      `clinics/${clinicId}/appointments/${appointmentId}/visitPrice`
    ] =
      pricingResult.price;

    if (queueId) {
      updates[
        `clinics/${clinicId}/appointments/${appointmentId}/queueId`
      ] =
        queueId;
    }
  }

  /* =======================================================
     QUEUE
  ======================================================= */

  if (queueId) {
    updates[
      `clinics/${clinicId}/queue/${queueId}/status`
    ] =
      "completed";

    updates[
      `clinics/${clinicId}/queue/${queueId}/visitId`
    ] =
      visitId;

    updates[
      `clinics/${clinicId}/queue/${queueId}/completedAt`
    ] =
      timestamp;

    updates[
      `clinics/${clinicId}/queue/${queueId}/updatedAt`
    ] =
      timestamp;

    updates[
      `clinics/${clinicId}/queue/${queueId}/prescriptionId`
    ] =
      prescriptionId ||
      "";

    updates[
      `clinics/${clinicId}/queue/${queueId}/draftId`
    ] =
      null;

    updates[
      `clinics/${clinicId}/queue/${queueId}/visitType`
    ] =
      pricingResult.visitType;

    updates[
      `clinics/${clinicId}/queue/${queueId}/visitTypeLabel`
    ] =
      pricingResult.visitTypeLabel;

    updates[
      `clinics/${clinicId}/queue/${queueId}/visitPrice`
    ] =
      pricingResult.price;
  }

  /*
   * الجزء الطبي كله Atomic:
   * زيارة + روشتة + تحاليل + المريض
   * + الموعد + قائمة الانتظار.
   */
  await update(
    ref(database),
    updates
  );

  /* =======================================================
     FINANCE
  ======================================================= */

  let financeTransaction =
    null;

  let financeError =
    null;

  /*
   * سعر صفر = زيارة مجانية.
   * financeService يرفض invoice = 0
   * لذلك لا ننشئ فاتورة.
   */
  if (
    pricingResult.price > 0
  ) {
    try {
      /*
       * حماية بسيطة من التكرار:
       * نبحث أولاً عن فاتورة لنفس visitId.
       */
      const transactionsSnapshot =
        await get(
          ref(
            database,
            `clinics/${clinicId}/finance/transactions`
          )
        );

      if (
        transactionsSnapshot.exists()
      ) {
        const existingTransaction =
          Object.entries(
            transactionsSnapshot.val()
          )
            .map(
              ([id, value]) => ({
                id,
                ...value,
              })
            )
            .find(
              (transaction) =>
                transaction.visitId ===
                  visitId &&
                transaction.status !==
                  "cancelled"
            );

        if (
          existingTransaction
        ) {
          financeTransaction =
            existingTransaction;
        }
      }

      /*
       * لو مفيش فاتورة موجودة،
       * ننشئ واحدة.
       */
      if (
        !financeTransaction
      ) {
        financeTransaction =
          await createFinanceTransaction({
            clinicId,

            patientId:
              patient.id,

            patientCode:
              patient.patientCode ||
              "",

            patientName:
              patient.name || "",

            patientPhone:
              patient.phone || "",

            doctorId:
              doctor?.id || "",

            doctorName:
              doctor?.name || "",

            visitId,

            appointmentId:
              appointmentId ||
              "",

            /*
             * Finance statistics الحالية
             * تعتمد على كلمة "إعادة".
             */
            serviceType:
              pricingResult.visitType ===
              "followup"
                ? "إعادة"
                : "كشف",

            serviceName:
              pricingResult.visitTypeLabel,

            amount:
              pricingResult.price,

            createdBy:
              doctor?.id ||
              "",

            createdByName:
              doctor?.name ||
              "",

            notes:
              pricingResult.visitType ===
              "followup"
                ? `إعادة خلال مدة الصلاحية (${pricingResult.followupDays} يوم)`
                : "كشف جديد",
          });
      }

      /*
       * ربط الفاتورة بالزيارة.
       */
      await update(
        ref(
          database,
          `clinics/${clinicId}/visits/${visitId}`
        ),
        {
          financeTransactionId:
            financeTransaction?.id ||
            "",

          invoiceNumber:
            financeTransaction
              ?.invoiceNumber ||
            "",

          financeStatus:
            financeTransaction
              ?.status ||
            "unpaid",

          financeError:
            null,

          billingUpdatedAt:
            Date.now(),

          updatedAt:
            Date.now(),
        }
      );

      /*
       * نخزن رقم الفاتورة كذلك في الموعد.
       */
      if (
        appointmentId
      ) {
        await update(
          ref(
            database,
            `clinics/${clinicId}/appointments/${appointmentId}`
          ),
          {
            financeTransactionId:
              financeTransaction
                ?.id ||
              "",

            invoiceNumber:
              financeTransaction
                ?.invoiceNumber ||
              "",

            financeStatus:
              financeTransaction
                ?.status ||
              "unpaid",

            updatedAt:
              Date.now(),
          }
        );
      }

      /*
       * وكذلك في Queue.
       */
      if (queueId) {
        await update(
          ref(
            database,
            `clinics/${clinicId}/queue/${queueId}`
          ),
          {
            financeTransactionId:
              financeTransaction
                ?.id ||
              "",

            invoiceNumber:
              financeTransaction
                ?.invoiceNumber ||
              "",

            financeStatus:
              financeTransaction
                ?.status ||
              "unpaid",

            updatedAt:
              Date.now(),
          }
        );
      }
    } catch (error) {
      console.error(
        "Visit finance error:",
        error
      );

      /*
       * مهم:
       * لو حصل خطأ في المالية
       * ما نرميش Error بعد حفظ الكشف،
       * وإلا الطبيب ممكن يضغط إنهاء مرة ثانية
       * ويعمل زيارة مكررة.
       */
      financeError =
        error?.message ||
        "تعذر إنشاء فاتورة الزيارة.";

      await update(
        ref(
          database,
          `clinics/${clinicId}/visits/${visitId}`
        ),
        {
          financeStatus:
            "error",

          financeError,

          billingUpdatedAt:
            Date.now(),

          updatedAt:
            Date.now(),
        }
      );
    }
  }

  /* =======================================================
     RESULT
  ======================================================= */

  return {
    visitId,

    prescriptionId,

    medicalFileIds,

    appointmentId,

    queueId,

    visitType:
      pricingResult.visitType,

    visitTypeLabel:
      pricingResult.visitTypeLabel,

    visitPrice:
      pricingResult.price,

    pricingSnapshot: {
      consultationPrice:
        pricingResult.consultationPrice,

      followupPrice:
        pricingResult.followupPrice,

      followupDays:
        pricingResult.followupDays,
    },

    financeTransactionId:
      financeTransaction?.id ||
      "",

    invoiceNumber:
      financeTransaction
        ?.invoiceNumber ||
      "",

    financeStatus:
      pricingResult.price <= 0
        ? "free"
        : financeTransaction
          ?.status ||
          (
            financeError
              ? "error"
              : "unpaid"
          ),

    financeError,
  };
}

/* =========================================================
   PATIENT VISITS
========================================================= */

export function subscribePatientVisits(
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

  const visitsRef =
    ref(
      database,
      `clinics/${clinicId}/visits`
    );

  return onValue(
    visitsRef,

    (snapshot) => {
      if (
        !snapshot.exists()
      ) {
        callback?.([]);
        return;
      }

      const visits =
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
            (visit) =>
              visit.patientId ===
                patientId &&
              visit.status ===
                "completed"
          )
          .sort(
            (a, b) =>
              Number(
                b.completedAt ||
                  b.createdAt ||
                  0
              ) -
              Number(
                a.completedAt ||
                  a.createdAt ||
                  0
              )
          );

      callback?.(
        visits
      );
    },

    (error) => {
      console.error(
        "Patient visits error:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   CLINIC VISITS
========================================================= */

export function subscribeClinicVisits(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback?.([]);
    return () => {};
  }

  const visitsRef =
    ref(
      database,
      `clinics/${clinicId}/visits`
    );

  return onValue(
    visitsRef,

    (snapshot) => {
      if (
        !snapshot.exists()
      ) {
        callback?.([]);
        return;
      }

      const visits =
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
            (visit) =>
              visit.status ===
              "completed"
          )
          .sort(
            (a, b) =>
              Number(
                b.completedAt ||
                  b.createdAt ||
                  0
              ) -
              Number(
                a.completedAt ||
                  a.createdAt ||
                  0
              )
          );

      callback?.(
        visits
      );
    },

    (error) => {
      console.error(
        "Clinic visits realtime error:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   PATIENT PRESCRIPTIONS
========================================================= */

export function subscribePatientPrescriptions(
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

  const prescriptionsRef =
    ref(
      database,
      `clinics/${clinicId}/prescriptions`
    );

  return onValue(
    prescriptionsRef,

    (snapshot) => {
      if (
        !snapshot.exists()
      ) {
        callback?.([]);
        return;
      }

      const prescriptions =
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
            (prescription) =>
              prescription.patientId ===
              patientId
          )
          .sort(
            (a, b) =>
              Number(
                b.createdAt ||
                  0
              ) -
              Number(
                a.createdAt ||
                  0
              )
          );

      callback?.(
        prescriptions
      );
    },

    (error) => {
      console.error(
        "Patient prescriptions error:",
        error
      );

      onError?.(error);
    }
  );
}