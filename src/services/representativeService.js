import {
  get,
  onValue,
  push,
  ref,
  runTransaction,
  set,
  update,
} from "firebase/database";

import {
  database,
} from "../config/firebase";

/* =========================================================
   CONSTANTS
========================================================= */

export const REPRESENTATIVE_TYPES = [
  {
    value: "pharma",
    label: "شركة أدوية",
  },
  {
    value: "lab",
    label: "معمل تحاليل",
  },
  {
    value: "radiology",
    label: "مركز أشعة",
  },
  {
    value: "medical_devices",
    label: "أجهزة طبية",
  },
  {
    value: "other",
    label: "جهة أخرى",
  },
];

export const VISIT_STATUS = {
  SCHEDULED: "scheduled",
  ARRIVED: "arrived",
  WAITING: "waiting",
  IN_VISIT: "in_visit",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REJECTED: "rejected",
};

/* =========================================================
   HELPERS
========================================================= */

function objectToArray(value) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return [];
  }

  return Object.entries(value).map(
    ([key, item]) => ({
      id:
        item?.id ||
        key,

      ...(item || {}),
    })
  );
}

function normalizePhone(
  value = ""
) {
  return String(value)
    .replace(/[^\d+]/g, "")
    .trim();
}

function normalizeSearch(
  value = ""
) {
  return String(value)
    .toLowerCase()
    .trim();
}

function cleanNumber(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  if (
    Number.isNaN(number) ||
    number < 0
  ) {
    return fallback;
  }

  return number;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

function localDateKey(
  value = new Date()
) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function sameDay(
  value,
  target = new Date()
) {
  const date =
    parseDate(value);

  if (!date) {
    return false;
  }

  return (
    localDateKey(date) ===
    localDateKey(target)
  );
}

function sameMonth(
  value,
  target = new Date()
) {
  const date =
    parseDate(value);

  if (!date) {
    return false;
  }

  return (
    date.getFullYear() ===
      target.getFullYear() &&
    date.getMonth() ===
      target.getMonth()
  );
}

function getVisitTimestamp(
  visit
) {
  return (
    visit.completedAt ||
    visit.startedAt ||
    visit.arrivedAt ||
    visit.scheduledAt ||
    visit.createdAt ||
    null
  );
}

function getRepresentativeTypeLabel(
  type
) {
  return (
    REPRESENTATIVE_TYPES.find(
      (item) =>
        item.value === type
    )?.label ||
    "جهة أخرى"
  );
}

function getEffectiveSettings(
  value = {}
) {
  const today =
    localDateKey();

  /*
    الإغلاق خاص باليوم فقط.

    لو Firebase فيها:
    visitsOpen = false
    لكن closedForDate كان أمس

    نعتبر الاستقبال مفتوح اليوم.
  */

  const closedToday =
    value.visitsOpen === false &&
    value.closedForDate ===
      today;

  return {
    ...value,

    visitsOpen:
      !closedToday,

    dailyVisitLimit:
      Math.max(
        1,
        Number(
          value.dailyVisitLimit ??
            6
        ) || 6
      ),

    closedForDate:
      value.closedForDate ||
      null,

    closeReason:
      closedToday
        ? value.closeReason ||
          "الطبيب أغلق استقبال المندوبين اليوم."
        : "",

    closedAt:
      closedToday
        ? value.closedAt ||
          null
        : null,
  };
}

/* =========================================================
   REPRESENTATIVE CODE
========================================================= */

async function generateRepresentativeCode(
  clinicId
) {
  if (!clinicId) {
    throw new Error(
      "بيانات العيادة غير مكتملة"
    );
  }

  const counterRef =
    ref(
      database,
      `clinics/${clinicId}/counters/representatives`
    );

  const result =
    await runTransaction(
      counterRef,

      (current) =>
        Number(
          current || 0
        ) + 1
    );

  const number =
    Number(
      result.snapshot.val() ||
        1
    );

  return `REP-${String(
    number
  ).padStart(5, "0")}`;
}

/* =========================================================
   SUBSCRIBE REPRESENTATIVES
========================================================= */

export function subscribeRepresentatives(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback?.([]);
    return () => {};
  }

  const representativesRef =
    ref(
      database,
      `clinics/${clinicId}/representatives`
    );

  return onValue(
    representativesRef,

    (snapshot) => {
      const representatives =
        objectToArray(
          snapshot.val()
        );

      representatives.sort(
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

      callback?.(
        representatives
      );
    },

    (error) => {
      console.error(
        "Representatives subscription error:",
        error
      );

      onError?.(
        error
      );
    }
  );
}

/* =========================================================
   CREATE REPRESENTATIVE
========================================================= */

export async function createRepresentative({
  clinicId,
  data,
  createdBy,
}) {
  if (!clinicId) {
    throw new Error(
      "بيانات العيادة غير مكتملة"
    );
  }

  if (
    !data?.name?.trim()
  ) {
    throw new Error(
      "اسم المندوب مطلوب"
    );
  }

  if (
    !data?.phone?.trim()
  ) {
    throw new Error(
      "رقم الهاتف مطلوب"
    );
  }

  if (
    !data
      ?.organizationName
      ?.trim()
  ) {
    throw new Error(
      "اسم الشركة أو الجهة مطلوب"
    );
  }

  if (
    !data
      ?.assignedDoctorId
  ) {
    throw new Error(
      "يجب تحديد الطبيب"
    );
  }

  const code =
    await generateRepresentativeCode(
      clinicId
    );

  const representativeRef =
    push(
      ref(
        database,
        `clinics/${clinicId}/representatives`
      )
    );

  const now =
    Date.now();

  const payload = {
    id:
      representativeRef.key,

    code,

    name:
      data.name.trim(),

    phone:
      data.phone.trim(),

    normalizedPhone:
      normalizePhone(
        data.phone
      ),

    organizationType:
      data.organizationType ||
      "pharma",

    organizationTypeLabel:
      getRepresentativeTypeLabel(
        data.organizationType ||
          "pharma"
      ),

    organizationName:
      data.organizationName.trim(),

    assignedDoctorId:
      data.assignedDoctorId,

    assignedDoctorName:
      data.assignedDoctorName ||
      "",

    status:
      data.status ||
      "active",

    /*
      بنحتفظ فقط بالحد الشهري
      للمندوب.

      الحد اليومي أصبح للطبيب
      وليس لكل مندوب.
    */

    visitPolicy: {
      maxVisitsPerMonth:
        cleanNumber(
          data.maxVisitsPerMonth,
          1
        ),
    },

    notes:
      data.notes?.trim() ||
      "",

    createdAt:
      now,

    updatedAt:
      now,

    createdBy:
      createdBy ||
      "",
  };

  await set(
    representativeRef,
    payload
  );

  return payload;
}

/* =========================================================
   UPDATE REPRESENTATIVE
========================================================= */

export async function updateRepresentative({
  clinicId,
  representativeId,
  data,
  updatedBy,
}) {
  if (
    !clinicId ||
    !representativeId
  ) {
    throw new Error(
      "بيانات المندوب غير مكتملة"
    );
  }

  if (
    !data?.name?.trim()
  ) {
    throw new Error(
      "اسم المندوب مطلوب"
    );
  }

  if (
    !data?.phone?.trim()
  ) {
    throw new Error(
      "رقم الهاتف مطلوب"
    );
  }

  if (
    !data
      ?.organizationName
      ?.trim()
  ) {
    throw new Error(
      "اسم الشركة أو الجهة مطلوب"
    );
  }

  if (
    !data
      ?.assignedDoctorId
  ) {
    throw new Error(
      "يجب تحديد الطبيب"
    );
  }

  const updates = {
    name:
      data.name.trim(),

    phone:
      data.phone.trim(),

    normalizedPhone:
      normalizePhone(
        data.phone
      ),

    organizationType:
      data.organizationType ||
      "other",

    organizationTypeLabel:
      getRepresentativeTypeLabel(
        data.organizationType
      ),

    organizationName:
      data.organizationName.trim(),

    assignedDoctorId:
      data.assignedDoctorId,

    assignedDoctorName:
      data.assignedDoctorName ||
      "",

    status:
      data.status ||
      "active",

    visitPolicy: {
      maxVisitsPerMonth:
        cleanNumber(
          data.maxVisitsPerMonth,
          1
        ),
    },

    notes:
      data.notes?.trim() ||
      "",

    updatedAt:
      Date.now(),

    updatedBy:
      updatedBy ||
      "",
  };

  await update(
    ref(
      database,
      `clinics/${clinicId}/representatives/${representativeId}`
    ),
    updates
  );

  return updates;
}

/* =========================================================
   REPRESENTATIVE STATUS
========================================================= */

export async function setRepresentativeStatus({
  clinicId,
  representativeId,
  status,
  updatedBy,
}) {
  if (
    !clinicId ||
    !representativeId
  ) {
    throw new Error(
      "بيانات المندوب غير مكتملة"
    );
  }

  await update(
    ref(
      database,
      `clinics/${clinicId}/representatives/${representativeId}`
    ),
    {
      status,

      updatedAt:
        Date.now(),

      updatedBy:
        updatedBy ||
        "",
    }
  );
}

/* =========================================================
   SUBSCRIBE VISITS
========================================================= */

export function subscribeRepresentativeVisits(
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
      `clinics/${clinicId}/representativeVisits`
    );

  return onValue(
    visitsRef,

    (snapshot) => {
      const visits =
        objectToArray(
          snapshot.val()
        );

      visits.sort(
        (a, b) =>
          Number(
            b.createdAt || 0
          ) -
          Number(
            a.createdAt || 0
          )
      );

      callback?.(
        visits
      );
    },

    (error) => {
      console.error(
        "Representative visits subscription error:",
        error
      );

      onError?.(
        error
      );
    }
  );
}

/* =========================================================
   SUBSCRIBE CLINIC DOCTORS
========================================================= */

export function subscribeClinicDoctors(
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
        objectToArray(
          snapshot.val()
        );

      const doctors =
        staff
          .filter(
            (item) => {
              const role =
                String(
                  item.role ||
                    item.userRole ||
                    item.jobRole ||
                    ""
                ).toLowerCase();

              const status =
                String(
                  item.status ||
                    "active"
                ).toLowerCase();

              const doctorRole =
                [
                  "doctor",
                  "owner",
                ].includes(
                  role
                );

              const active =
                ![
                  "inactive",
                  "suspended",
                  "disabled",
                ].includes(
                  status
                );

              return (
                doctorRole &&
                active
              );
            }
          )
          .map(
            (item) => ({
              ...item,

              name:
                item.name ||
                item.fullName ||
                item.displayName ||
                item.doctorName ||
                "طبيب",
            })
          )
          .sort(
            (a, b) =>
              String(
                a.name
              ).localeCompare(
                String(
                  b.name
                ),
                "ar"
              )
          );

      callback?.(
        doctors
      );
    },

    (error) => {
      console.error(
        "Clinic doctors subscription error:",
        error
      );

      onError?.(
        error
      );
    }
  );
}

/* =========================================================
   DOCTOR SETTINGS
========================================================= */

export function subscribeRepresentativeSettings(
  clinicId,
  doctorId,
  callback,
  onError
) {
  if (
    !clinicId ||
    !doctorId
  ) {
    callback?.({
      visitsOpen: true,
      dailyVisitLimit: 6,
      closedForDate: null,
      closeReason: "",
      closedAt: null,
    });

    return () => {};
  }

  const settingsRef =
    ref(
      database,
      `clinics/${clinicId}/representativeSettings/${doctorId}`
    );

  return onValue(
    settingsRef,

    (snapshot) => {
      const raw =
        snapshot.val() ||
        {};

      callback?.(
        getEffectiveSettings(
          raw
        )
      );
    },

    (error) => {
      console.error(
        "Representative settings subscription error:",
        error
      );

      onError?.(
        error
      );
    }
  );
}

/* =========================================================
   UPDATE SETTINGS
========================================================= */

export async function updateRepresentativeSettings({
  clinicId,
  doctorId,
  data,
  updatedBy,
}) {
  if (
    !clinicId ||
    !doctorId
  ) {
    throw new Error(
      "بيانات الطبيب غير مكتملة"
    );
  }

  await update(
    ref(
      database,
      `clinics/${clinicId}/representativeSettings/${doctorId}`
    ),
    {
      ...data,

      updatedAt:
        Date.now(),

      updatedBy:
        updatedBy ||
        "",
    }
  );
}

/* =========================================================
   OPEN REPRESENTATIVE RECEPTION
========================================================= */

export async function openRepresentativeVisits({
  clinicId,
  doctorId,
  updatedBy,
}) {
  if (
    !clinicId ||
    !doctorId
  ) {
    throw new Error(
      "بيانات الطبيب غير مكتملة"
    );
  }

  const now =
    Date.now();

  await updateRepresentativeSettings({
    clinicId,
    doctorId,
    updatedBy,

    data: {
      visitsOpen: true,

      /*
        مهم جداً:
        نمسح تاريخ الإغلاق القديم.
      */

      closedForDate:
        null,

      closeReason:
        "",

      closedAt:
        null,

      openedAt:
        now,
    },
  });
}

/* =========================================================
   CLOSE REPRESENTATIVE RECEPTION
========================================================= */

export async function closeRepresentativeVisits({
  clinicId,
  doctorId,
  reason,
  closedForDate,
  updatedBy,
}) {
  if (
    !clinicId ||
    !doctorId
  ) {
    throw new Error(
      "بيانات الطبيب غير مكتملة"
    );
  }

  const dateKey =
    closedForDate ||
    localDateKey();

  const now =
    Date.now();

  await updateRepresentativeSettings({
    clinicId,
    doctorId,
    updatedBy,

    data: {
      visitsOpen: false,

      /*
        الإغلاق خاص باليوم.
      */

      closedForDate:
        dateKey,

      closeReason:
        reason ||
        "مغلق بواسطة الطبيب",

      closedAt:
        now,
    },
  });
}

/* =========================================================
   DAILY VISIT LIMIT
========================================================= */

export async function setRepresentativeDailyLimit({
  clinicId,
  doctorId,
  limit,
  dailyVisitLimit,
  updatedBy,
}) {
  if (
    !clinicId ||
    !doctorId
  ) {
    throw new Error(
      "بيانات الطبيب غير مكتملة"
    );
  }

  /*
    الصفحة الحالية ترسل limit
    لكن نقبل dailyVisitLimit كذلك
    لضمان التوافق.
  */

  const rawValue =
    limit ??
    dailyVisitLimit;

  const parsed =
    Number(rawValue);

  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed < 1 ||
    parsed > 100
  ) {
    throw new Error(
      "الحد اليومي يجب أن يكون من 1 إلى 100"
    );
  }

  await updateRepresentativeSettings({
    clinicId,
    doctorId,
    updatedBy,

    data: {
      dailyVisitLimit:
        parsed,
    },
  });

  return parsed;
}

/* =========================================================
   REPRESENTATIVE USAGE

   مهم:
   الزيارات COMPLETED فقط
   هي التي تخصم من الحد الشهري.
========================================================= */

export function getRepresentativeUsage({
  representative,
  visits = [],
  date = new Date(),
}) {
  if (!representative) {
    return {
      monthlyCompleted: 0,
      monthlyLimit: 0,
      monthlyExceeded: false,
      monthlyRemaining: null,
    };
  }

  const completedVisits =
    visits.filter(
      (visit) =>
        visit.representativeId ===
          representative.id &&
        visit.status ===
          VISIT_STATUS.COMPLETED
    );

  const monthlyCompleted =
    completedVisits.filter(
      (visit) =>
        sameMonth(
          getVisitTimestamp(
            visit
          ),
          date
        )
    ).length;

  const monthlyLimit =
    Number(
      representative
        .visitPolicy
        ?.maxVisitsPerMonth ??
        0
    );

  const monthlyExceeded =
    monthlyLimit > 0 &&
    monthlyCompleted >=
      monthlyLimit;

  return {
    monthlyCompleted,

    monthlyLimit,

    monthlyExceeded,

    monthlyRemaining:
      monthlyLimit > 0
        ? Math.max(
            0,
            monthlyLimit -
              monthlyCompleted
          )
        : null,
  };
}

/* =========================================================
   DOCTOR DAILY VISITS

   Waiting + In Visit + Completed
   كلهم محسوبين ضمن الحد اليومي.

   Cancelled / Rejected
   لا يتم احتسابهم.
========================================================= */

export function getDoctorDailyRepresentativeVisits({
  doctorId,
  visits = [],
  date = new Date(),
}) {
  if (!doctorId) {
    return [];
  }

  return visits.filter(
    (visit) =>
      visit.doctorId ===
        doctorId &&
      ![
        VISIT_STATUS.CANCELLED,
        VISIT_STATUS.REJECTED,
      ].includes(
        visit.status
      ) &&
      sameDay(
        getVisitTimestamp(
          visit
        ),
        date
      )
  );
}

/* =========================================================
   VALIDATE VISIT
========================================================= */

export async function validateRepresentativeVisit({
  clinicId,
  representative,
  doctorId,
}) {
  if (!clinicId) {
    return {
      allowed: false,
      reason:
        "بيانات العيادة غير مكتملة.",
      type:
        "clinic_missing",
    };
  }

  if (
    !representative?.id
  ) {
    return {
      allowed: false,
      reason:
        "بيانات المندوب غير مكتملة.",
      type:
        "representative_missing",
    };
  }

  if (!doctorId) {
    return {
      allowed: false,
      reason:
        "يجب تحديد الطبيب.",
      type:
        "doctor_missing",
    };
  }

  /* -------------------------------------------------------
     REPRESENTATIVE STATUS
  ------------------------------------------------------- */

  if (
    representative.status !==
    "active"
  ) {
    return {
      allowed: false,

      reason:
        "هذا المندوب موقوف حالياً.",

      type:
        "representative_inactive",
    };
  }

  /* -------------------------------------------------------
     ASSIGNED DOCTOR
  ------------------------------------------------------- */

  if (
    representative.assignedDoctorId &&
    representative.assignedDoctorId !==
      doctorId
  ) {
    return {
      allowed: false,

      reason:
        `هذا المندوب مخصص لـ ${
          representative.assignedDoctorName ||
          "طبيب آخر"
        }.`,

      type:
        "wrong_doctor",
    };
  }

  /* -------------------------------------------------------
     LOAD DATA
  ------------------------------------------------------- */

  const [
    visitsSnapshot,
    settingsSnapshot,
  ] =
    await Promise.all([
      get(
        ref(
          database,
          `clinics/${clinicId}/representativeVisits`
        )
      ),

      get(
        ref(
          database,
          `clinics/${clinicId}/representativeSettings/${doctorId}`
        )
      ),
    ]);

  const visits =
    objectToArray(
      visitsSnapshot.val()
    );

  const rawSettings =
    settingsSnapshot.val() ||
    {};

  const settings =
    getEffectiveSettings(
      rawSettings
    );

  /* -------------------------------------------------------
     DOCTOR CLOSED TODAY
  ------------------------------------------------------- */

  if (
    settings.visitsOpen ===
    false
  ) {
    return {
      allowed: false,

      reason:
        settings.closeReason ||
        "الطبيب أغلق استقبال المندوبين اليوم.",

      type:
        "doctor_closed",
    };
  }

  /* -------------------------------------------------------
     DUPLICATE TODAY

     لا نسمح لنفس المندوب
     بدورين لنفس الطبيب في نفس اليوم.
  ------------------------------------------------------- */

  const alreadyToday =
    visits.some(
      (visit) =>
        visit.representativeId ===
          representative.id &&
        visit.doctorId ===
          doctorId &&
        ![
          VISIT_STATUS.CANCELLED,
          VISIT_STATUS.REJECTED,
        ].includes(
          visit.status
        ) &&
        sameDay(
          getVisitTimestamp(
            visit
          )
        )
    );

  if (alreadyToday) {
    return {
      allowed: false,

      reason:
        "هذا المندوب مسجل بالفعل في زيارات اليوم.",

      type:
        "duplicate_today",
    };
  }

  /* -------------------------------------------------------
     MONTHLY LIMIT
  ------------------------------------------------------- */

  const usage =
    getRepresentativeUsage({
      representative,
      visits,
    });

  if (
    usage.monthlyExceeded
  ) {
    return {
      allowed: false,

      reason:
        `استنفد المندوب عدد الزيارات المسموح بها هذا الشهر (${usage.monthlyCompleted}/${usage.monthlyLimit}).`,

      type:
        "monthly_limit",

      usage,
    };
  }

  /* -------------------------------------------------------
     DOCTOR DAILY LIMIT
  ------------------------------------------------------- */

  const doctorVisits =
    getDoctorDailyRepresentativeVisits({
      doctorId,
      visits,
    });

  const dailyVisitLimit =
    Math.max(
      1,
      Number(
        settings.dailyVisitLimit ||
          6
      )
    );

  if (
    doctorVisits.length >=
    dailyVisitLimit
  ) {
    return {
      allowed: false,

      reason:
        `اكتمل الحد اليومي لزيارات المندوبين لدى الطبيب (${doctorVisits.length}/${dailyVisitLimit}).`,

      type:
        "doctor_daily_limit",

      usage,

      doctorVisitsToday:
        doctorVisits.length,

      doctorDailyLimit:
        dailyVisitLimit,
    };
  }

  return {
    allowed: true,

    usage,

    doctorVisitsToday:
      doctorVisits.length,

    doctorDailyLimit:
      dailyVisitLimit,
  };
}

/* =========================================================
   GENERATE QUEUE NUMBER
========================================================= */

async function generateQueueNumber({
  clinicId,
  doctorId,
}) {
  const todayKey =
    localDateKey();

  const queueCounterRef =
    ref(
      database,
      `clinics/${clinicId}/counters/representativeQueue/${doctorId}/${todayKey}`
    );

  const result =
    await runTransaction(
      queueCounterRef,

      (current) =>
        Number(
          current || 0
        ) + 1
    );

  return Number(
    result.snapshot.val() ||
      1
  );
}

/* =========================================================
   QUICK ADD TO WAITING QUEUE

   RECEPTION:
   بحث -> إضافة للانتظار

   لا يوجد Schedule
   لا يوجد Register Arrival
========================================================= */

export async function quickAddRepresentativeToQueue({
  clinicId,
  representative,
  doctorId,
  doctorName,
  createdBy,
}) {
  if (!clinicId) {
    throw new Error(
      "بيانات العيادة غير مكتملة"
    );
  }

  if (
    !representative?.id
  ) {
    throw new Error(
      "بيانات المندوب غير مكتملة"
    );
  }

  const selectedDoctorId =
    doctorId ||
    representative.assignedDoctorId;

  if (
    !selectedDoctorId
  ) {
    throw new Error(
      "يجب تحديد الطبيب"
    );
  }

  /* -------------------------------------------------------
     SERVER VALIDATION
  ------------------------------------------------------- */

  const validation =
    await validateRepresentativeVisit({
      clinicId,

      representative,

      doctorId:
        selectedDoctorId,
    });

  if (
    !validation.allowed
  ) {
    const error =
      new Error(
        validation.reason
      );

    error.code =
      validation.type ||
      "visit_not_allowed";

    error.validation =
      validation;

    throw error;
  }

  /* -------------------------------------------------------
     QUEUE NUMBER
  ------------------------------------------------------- */

  const queueNumber =
    await generateQueueNumber({
      clinicId,

      doctorId:
        selectedDoctorId,
    });

  /* -------------------------------------------------------
     CREATE VISIT
  ------------------------------------------------------- */

  const visitRef =
    push(
      ref(
        database,
        `clinics/${clinicId}/representativeVisits`
      )
    );

  const now =
    Date.now();

  const payload = {
    id:
      visitRef.key,

    representativeId:
      representative.id,

    representativeCode:
      representative.code ||
      "",

    representativeName:
      representative.name ||
      "",

    representativePhone:
      representative.phone ||
      "",

    organizationType:
      representative.organizationType ||
      "other",

    organizationTypeLabel:
      representative.organizationTypeLabel ||
      getRepresentativeTypeLabel(
        representative.organizationType
      ),

    organizationName:
      representative.organizationName ||
      "",

    doctorId:
      selectedDoctorId,

    doctorName:
      doctorName ||
      representative.assignedDoctorName ||
      "",

    /*
      يدخل مباشرة Waiting.
    */

    status:
      VISIT_STATUS.WAITING,

    queueNumber,

    /*
      نخزن تاريخ اليوم صراحة
      لتسهيل التقارير لاحقاً.
    */

    visitDate:
      localDateKey(),

    scheduledAt:
      null,

    arrivedAt:
      now,

    startedAt:
      null,

    completedAt:
      null,

    cancelledAt:
      null,

    createdAt:
      now,

    updatedAt:
      now,

    createdBy:
      createdBy ||
      "",
  };

  await set(
    visitRef,
    payload
  );

  return payload;
}

/* =========================================================
   QUICK START VISIT

   DOCTOR:
   إدخال
========================================================= */

export async function quickStartRepresentativeVisit({
  clinicId,
  visitId,
  doctorId,
  updatedBy,
}) {
  if (
    !clinicId ||
    !visitId ||
    !doctorId
  ) {
    throw new Error(
      "بيانات الزيارة غير مكتملة"
    );
  }

  /* -------------------------------------------------------
     LOAD VISITS
  ------------------------------------------------------- */

  const visitsSnapshot =
    await get(
      ref(
        database,
        `clinics/${clinicId}/representativeVisits`
      )
    );

  const visits =
    objectToArray(
      visitsSnapshot.val()
    );

  const selectedVisit =
    visits.find(
      (visit) =>
        visit.id ===
        visitId
    );

  if (!selectedVisit) {
    throw new Error(
      "الزيارة غير موجودة"
    );
  }

  if (
    selectedVisit.doctorId !==
    doctorId
  ) {
    throw new Error(
      "هذه الزيارة تخص طبيباً آخر"
    );
  }

  if (
    ![
      VISIT_STATUS.WAITING,
      VISIT_STATUS.ARRIVED,
      VISIT_STATUS.SCHEDULED,
    ].includes(
      selectedVisit.status
    )
  ) {
    throw new Error(
      "لا يمكن بدء هذه الزيارة في حالتها الحالية"
    );
  }

  /* -------------------------------------------------------
     ONLY ONE CURRENT VISIT
  ------------------------------------------------------- */

  const activeVisit =
    visits.find(
      (visit) =>
        visit.doctorId ===
          doctorId &&
        visit.status ===
          VISIT_STATUS.IN_VISIT &&
        visit.id !==
          visitId
    );

  if (activeVisit) {
    throw new Error(
      `${activeVisit.representativeName || "يوجد مندوب"} داخل الزيارة حالياً`
    );
  }

  /* -------------------------------------------------------
     START
  ------------------------------------------------------- */

  const now =
    Date.now();

  await update(
    ref(
      database,
      `clinics/${clinicId}/representativeVisits/${visitId}`
    ),
    {
      status:
        VISIT_STATUS.IN_VISIT,

      startedAt:
        now,

      updatedAt:
        now,

      updatedBy:
        updatedBy ||
        "",
    }
  );

  return true;
}

/* =========================================================
   COMPLETE VISIT

   فقط هنا الزيارة تتحسب من
   الحد الشهري للمندوب.
========================================================= */

export async function completeRepresentativeVisit({
  clinicId,
  visitId,
  updatedBy,
}) {
  if (
    !clinicId ||
    !visitId
  ) {
    throw new Error(
      "بيانات الزيارة غير مكتملة"
    );
  }

  const visitRef =
    ref(
      database,
      `clinics/${clinicId}/representativeVisits/${visitId}`
    );

  const snapshot =
    await get(
      visitRef
    );

  if (!snapshot.exists()) {
    throw new Error(
      "الزيارة غير موجودة"
    );
  }

  const visit =
    snapshot.val();

  if (
    visit.status ===
    VISIT_STATUS.COMPLETED
  ) {
    return {
      ...visit,
      id:
        visit.id ||
        visitId,
    };
  }

  if (
    visit.status !==
    VISIT_STATUS.IN_VISIT
  ) {
    throw new Error(
      "يجب إدخال المندوب للطبيب أولاً قبل إنهاء الزيارة"
    );
  }

  const now =
    Date.now();

  await update(
    visitRef,
    {
      status:
        VISIT_STATUS.COMPLETED,

      completedAt:
        now,

      updatedAt:
        now,

      updatedBy:
        updatedBy ||
        "",
    }
  );

  return {
    ...visit,

    id:
      visit.id ||
      visitId,

    status:
      VISIT_STATUS.COMPLETED,

    completedAt:
      now,

    updatedAt:
      now,
  };
}

/* =========================================================
   CANCEL VISIT

   الاستقبال يستطيع إلغاء دور
   لم يدخل للطبيب بعد.

   الزيارة الملغية لا تخصم من
   الحد اليومي أو الشهري.
========================================================= */

export async function cancelRepresentativeVisit({
  clinicId,
  visitId,
  reason,
  updatedBy,
}) {
  if (
    !clinicId ||
    !visitId
  ) {
    throw new Error(
      "بيانات الزيارة غير مكتملة"
    );
  }

  const visitRef =
    ref(
      database,
      `clinics/${clinicId}/representativeVisits/${visitId}`
    );

  const snapshot =
    await get(
      visitRef
    );

  if (!snapshot.exists()) {
    throw new Error(
      "الزيارة غير موجودة"
    );
  }

  const visit =
    snapshot.val();

  if (
    visit.status ===
    VISIT_STATUS.COMPLETED
  ) {
    throw new Error(
      "لا يمكن إلغاء زيارة مكتملة"
    );
  }

  const now =
    Date.now();

  await update(
    visitRef,
    {
      status:
        VISIT_STATUS.CANCELLED,

      cancelReason:
        reason?.trim() ||
        "",

      cancelledAt:
        now,

      updatedAt:
        now,

      updatedBy:
        updatedBy ||
        "",
    }
  );

  return true;
}

/* =========================================================
   SEARCH REPRESENTATIVES
========================================================= */

export function filterRepresentatives(
  representatives = [],
  search = ""
) {
  const query =
    normalizeSearch(
      search
    );

  if (!query) {
    return representatives;
  }

  return representatives.filter(
    (item) => {
      const searchable =
        [
          item.code,
          item.name,
          item.phone,
          item.normalizedPhone,
          item.organizationName,
          item.organizationTypeLabel,
          item.assignedDoctorName,
        ]
          .map(
            (value) =>
              normalizeSearch(
                value
              )
          )
          .join(" ");

      return searchable.includes(
        query
      );
    }
  );
}

/* =========================================================
   TODAY VISITS
========================================================= */

export function getTodayRepresentativeVisits(
  visits = [],
  doctorId = null
) {
  const now =
    new Date();

  return visits
    .filter(
      (visit) => {
        const today =
          sameDay(
            getVisitTimestamp(
              visit
            ),
            now
          );

        if (!today) {
          return false;
        }

        if (
          doctorId &&
          visit.doctorId !==
            doctorId
        ) {
          return false;
        }

        return true;
      }
    )
    .sort(
      (a, b) => {
        const firstQueue =
          Number(
            a.queueNumber ??
              999999
          );

        const secondQueue =
          Number(
            b.queueNumber ??
              999999
          );

        if (
          firstQueue !==
          secondQueue
        ) {
          return (
            firstQueue -
            secondQueue
          );
        }

        return (
          Number(
            a.createdAt || 0
          ) -
          Number(
            b.createdAt || 0
          )
        );
      }
    );
}

/* =========================================================
   DASHBOARD STATS
========================================================= */

export function buildRepresentativeStats(
  visits = [],
  doctorId = null
) {
  const today =
    getTodayRepresentativeVisits(
      visits,
      doctorId
    );

  const active =
    today.filter(
      (visit) =>
        ![
          VISIT_STATUS.CANCELLED,
          VISIT_STATUS.REJECTED,
        ].includes(
          visit.status
        )
    );

  const waiting =
    active.filter(
      (visit) =>
        [
          VISIT_STATUS.WAITING,
          VISIT_STATUS.ARRIVED,
          VISIT_STATUS.SCHEDULED,
        ].includes(
          visit.status
        )
    );

  const inVisit =
    active.filter(
      (visit) =>
        visit.status ===
        VISIT_STATUS.IN_VISIT
    );

  const completed =
    active.filter(
      (visit) =>
        visit.status ===
        VISIT_STATUS.COMPLETED
    );

  const pharma =
    completed.filter(
      (visit) =>
        visit.organizationType ===
        "pharma"
    ).length;

  const labs =
    completed.filter(
      (visit) =>
        visit.organizationType ===
        "lab"
    ).length;

  const radiology =
    completed.filter(
      (visit) =>
        visit.organizationType ===
        "radiology"
    ).length;

  return {
    total:
      active.length,

    waiting:
      waiting.length,

    inVisit:
      inVisit.length,

    completed:
      completed.length,

    pharma,

    labs,

    radiology,
  };
}