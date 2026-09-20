import {
  get,
  onValue,
  ref,
  set,
  update,
} from "firebase/database";

import { database } from "../config/firebase";

/* =========================================================
   DEFAULT SETTINGS
========================================================= */

export const DEFAULT_CLINIC_SETTINGS = {
  clinic: {
    clinicName: "",
    clinicNameAr: "",
    phone: "",
    whatsapp: "",
    address: "",
  },

  prescription: {
    doctorName: "",
    specialty: "",
    degree: "",
    registration: "",
    prescriptionPhone: "",
    logoBase64: "",
    logoName: "",
    logoType: "",
  },

  pricing: {
    consultationPrice: 0,
    followupPrice: 0,
    followupDays: 14,
  },

  appointments: {
    slotDuration: 30,
    startTime: "09:00",
    endTime: "17:00",
  },

  permissions: {
    receptionPatients: true,
    receptionAppointments: true,
    receptionCheckin: true,
    receptionPayments: true,

    receptionFinanceSummary: false,
    receptionMedicalHistory: false,
    receptionPrescription: false,
    receptionSettings: false,
  },

  meta: {
    configured: false,
    createdAt: null,
    updatedAt: null,
    updatedBy: "",
    updatedByName: "",
  },
};

/* =========================================================
   HELPERS
========================================================= */

function settingsRef(clinicId) {
  if (!clinicId) {
    throw new Error("clinicId is required");
  }

  return ref(
    database,
    `clinics/${clinicId}/settings`
  );
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return fallback;
  }

  return number;
}

function normalizeSettings(data = {}) {
  return {
    clinic: {
      ...DEFAULT_CLINIC_SETTINGS.clinic,
      ...(data.clinic || {}),
    },

    prescription: {
      ...DEFAULT_CLINIC_SETTINGS.prescription,
      ...(data.prescription || {}),
    },

    pricing: {
      ...DEFAULT_CLINIC_SETTINGS.pricing,
      ...(data.pricing || {}),

      consultationPrice: normalizeNumber(
        data?.pricing?.consultationPrice,
        DEFAULT_CLINIC_SETTINGS.pricing.consultationPrice
      ),

      followupPrice: normalizeNumber(
        data?.pricing?.followupPrice,
        DEFAULT_CLINIC_SETTINGS.pricing.followupPrice
      ),

      followupDays: normalizeNumber(
        data?.pricing?.followupDays,
        DEFAULT_CLINIC_SETTINGS.pricing.followupDays
      ),
    },

    appointments: {
      ...DEFAULT_CLINIC_SETTINGS.appointments,
      ...(data.appointments || {}),

      slotDuration: normalizeNumber(
        data?.appointments?.slotDuration,
        DEFAULT_CLINIC_SETTINGS.appointments.slotDuration
      ),
    },

    permissions: {
      ...DEFAULT_CLINIC_SETTINGS.permissions,
      ...(data.permissions || {}),
    },

    meta: {
      ...DEFAULT_CLINIC_SETTINGS.meta,
      ...(data.meta || {}),
    },
  };
}

/* =========================================================
   GET SETTINGS
========================================================= */

export async function getClinicSettings(clinicId) {
  if (!clinicId) {
    return normalizeSettings();
  }

  const snapshot = await get(
    settingsRef(clinicId)
  );

  if (!snapshot.exists()) {
    return normalizeSettings();
  }

  return normalizeSettings(
    snapshot.val()
  );
}

/* =========================================================
   REALTIME SETTINGS
========================================================= */

export function subscribeClinicSettings(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback?.(
      normalizeSettings()
    );

    return () => {};
  }

  const targetRef =
    settingsRef(clinicId);

  return onValue(
    targetRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback?.(
          normalizeSettings()
        );

        return;
      }

      callback?.(
        normalizeSettings(
          snapshot.val()
        )
      );
    },
    (error) => {
      console.error(
        "subscribeClinicSettings error:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   INITIALIZE SETTINGS
========================================================= */

export async function initializeClinicSettings({
  clinicId,
  clinic = null,
  profile = null,
  staffId = "",
}) {
  if (!clinicId) {
    throw new Error(
      "clinicId is required"
    );
  }

  const targetRef =
    settingsRef(clinicId);

  const snapshot =
    await get(targetRef);

  if (snapshot.exists()) {
    return normalizeSettings(
      snapshot.val()
    );
  }

  const now = Date.now();

  const initialSettings = {
    ...DEFAULT_CLINIC_SETTINGS,

    clinic: {
      ...DEFAULT_CLINIC_SETTINGS.clinic,

      clinicName:
        clinic?.profile?.nameEn ||
        clinic?.nameEn ||
        clinic?.name ||
        "",

      clinicNameAr:
        clinic?.profile?.name ||
        clinic?.profile?.nameAr ||
        clinic?.nameAr ||
        clinic?.name ||
        "",

      phone:
        clinic?.profile?.phone ||
        clinic?.phone ||
        "",

      whatsapp:
        clinic?.profile?.whatsapp ||
        clinic?.whatsapp ||
        clinic?.profile?.phone ||
        clinic?.phone ||
        "",

      address:
        clinic?.profile?.address ||
        clinic?.address ||
        "",
    },

    prescription: {
      ...DEFAULT_CLINIC_SETTINGS.prescription,

      doctorName:
        profile?.name ||
        profile?.fullName ||
        profile?.displayName ||
        "",

      specialty:
        profile?.specialty ||
        "",

      degree:
        profile?.degree ||
        "",

      registration:
        profile?.registration ||
        profile?.medicalRegistration ||
        "",

      prescriptionPhone:
        clinic?.profile?.phone ||
        clinic?.phone ||
        "",
    },

    meta: {
      configured: false,
      createdAt: now,
      updatedAt: now,
      updatedBy:
        staffId || "",
      updatedByName:
        profile?.name ||
        profile?.fullName ||
        profile?.displayName ||
        "",
    },
  };

  await set(
    targetRef,
    initialSettings
  );

  return initialSettings;
}

/* =========================================================
   SAVE ALL SETTINGS
========================================================= */

export async function saveClinicSettings({
  clinicId,
  settings,
  updatedBy = "",
  updatedByName = "",
}) {
  if (!clinicId) {
    throw new Error(
      "clinicId is required"
    );
  }

  if (!settings) {
    throw new Error(
      "settings are required"
    );
  }

  const now = Date.now();

  const payload = normalizeSettings({
    ...settings,

    meta: {
      ...(settings.meta || {}),

      configured: true,
      updatedAt: now,
      updatedBy:
        updatedBy || "",

      updatedByName:
        updatedByName || "",
    },
  });

  if (!payload.meta.createdAt) {
    payload.meta.createdAt =
      now;
  }

  await set(
    settingsRef(clinicId),
    payload
  );

  return payload;
}

/* =========================================================
   UPDATE CLINIC IDENTITY
========================================================= */

export async function updateClinicIdentity({
  clinicId,
  data,
  updatedBy = "",
  updatedByName = "",
}) {
  const now = Date.now();

  await update(
    ref(
      database,
      `clinics/${clinicId}/settings/clinic`
    ),
    {
      clinicName:
        data.clinicName || "",

      clinicNameAr:
        data.clinicNameAr || "",

      phone:
        data.phone || "",

      whatsapp:
        data.whatsapp || "",

      address:
        data.address || "",
    }
  );

  await updateSettingsMeta({
    clinicId,
    updatedBy,
    updatedByName,
    now,
  });
}

/* =========================================================
   UPDATE PRESCRIPTION SETTINGS
========================================================= */

export async function updatePrescriptionSettings({
  clinicId,
  data,
  updatedBy = "",
  updatedByName = "",
}) {
  const now = Date.now();

  await update(
    ref(
      database,
      `clinics/${clinicId}/settings/prescription`
    ),
    {
      doctorName:
        data.doctorName || "",

      specialty:
        data.specialty || "",

      degree:
        data.degree || "",

      registration:
        data.registration || "",

      prescriptionPhone:
        data.prescriptionPhone ||
        "",

      logoBase64:
        data.logoBase64 || "",

      logoName:
        data.logoName || "",

      logoType:
        data.logoType || "",
    }
  );

  await updateSettingsMeta({
    clinicId,
    updatedBy,
    updatedByName,
    now,
  });
}

/* =========================================================
   UPDATE PRICING
========================================================= */

export async function updateClinicPricing({
  clinicId,
  consultationPrice,
  followupPrice,
  followupDays,
  updatedBy = "",
  updatedByName = "",
}) {
  const now = Date.now();

  const newPrice =
    normalizeNumber(
      consultationPrice,
      0
    );

  const followPrice =
    normalizeNumber(
      followupPrice,
      0
    );

  const days =
    normalizeNumber(
      followupDays,
      14
    );

  if (newPrice < 0) {
    throw new Error(
      "سعر الكشف غير صحيح."
    );
  }

  if (followPrice < 0) {
    throw new Error(
      "سعر الإعادة غير صحيح."
    );
  }

  if (days < 0) {
    throw new Error(
      "مدة الإعادة غير صحيحة."
    );
  }

  await update(
    ref(
      database,
      `clinics/${clinicId}/settings/pricing`
    ),
    {
      consultationPrice:
        newPrice,

      followupPrice:
        followPrice,

      followupDays:
        days,
    }
  );

  await updateSettingsMeta({
    clinicId,
    updatedBy,
    updatedByName,
    now,
  });
}

/* =========================================================
   UPDATE APPOINTMENTS
========================================================= */

export async function updateAppointmentSettings({
  clinicId,
  slotDuration,
  startTime,
  endTime,
  updatedBy = "",
  updatedByName = "",
}) {
  const now = Date.now();

  const duration =
    normalizeNumber(
      slotDuration,
      30
    );

  if (duration <= 0) {
    throw new Error(
      "مدة الموعد غير صحيحة."
    );
  }

  if (!startTime) {
    throw new Error(
      "حدد وقت بداية العمل."
    );
  }

  if (!endTime) {
    throw new Error(
      "حدد وقت نهاية العمل."
    );
  }

  if (startTime >= endTime) {
    throw new Error(
      "وقت نهاية العمل يجب أن يكون بعد وقت البداية."
    );
  }

  await update(
    ref(
      database,
      `clinics/${clinicId}/settings/appointments`
    ),
    {
      slotDuration:
        duration,

      startTime,

      endTime,
    }
  );

  await updateSettingsMeta({
    clinicId,
    updatedBy,
    updatedByName,
    now,
  });
}

/* =========================================================
   UPDATE RECEPTION PERMISSIONS
========================================================= */

export async function updateReceptionPermissions({
  clinicId,
  permissions,
  updatedBy = "",
  updatedByName = "",
}) {
  const now = Date.now();

  await update(
    ref(
      database,
      `clinics/${clinicId}/settings/permissions`
    ),
    {
      receptionPatients:
        Boolean(
          permissions.receptionPatients
        ),

      receptionAppointments:
        Boolean(
          permissions.receptionAppointments
        ),

      receptionCheckin:
        Boolean(
          permissions.receptionCheckin
        ),

      receptionPayments:
        Boolean(
          permissions.receptionPayments
        ),

      receptionFinanceSummary:
        Boolean(
          permissions.receptionFinanceSummary
        ),

      receptionMedicalHistory:
        Boolean(
          permissions.receptionMedicalHistory
        ),

      receptionPrescription:
        Boolean(
          permissions.receptionPrescription
        ),

      receptionSettings:
        Boolean(
          permissions.receptionSettings
        ),
    }
  );

  await updateSettingsMeta({
    clinicId,
    updatedBy,
    updatedByName,
    now,
  });
}

/* =========================================================
   META
========================================================= */

async function updateSettingsMeta({
  clinicId,
  updatedBy,
  updatedByName,
  now = Date.now(),
}) {
  const metaRef =
    ref(
      database,
      `clinics/${clinicId}/settings/meta`
    );

  const snapshot =
    await get(metaRef);

  const current =
    snapshot.exists()
      ? snapshot.val()
      : {};

  await update(
    metaRef,
    {
      configured: true,

      createdAt:
        current.createdAt ||
        now,

      updatedAt: now,

      updatedBy:
        updatedBy || "",

      updatedByName:
        updatedByName || "",
    }
  );
}

/* =========================================================
   PRICING HELPERS
========================================================= */

export async function getClinicPricing(clinicId) {
  const snapshot =
    await get(
      ref(
        database,
        `clinics/${clinicId}/settings/pricing`
      )
    );

  if (!snapshot.exists()) {
    return {
      ...DEFAULT_CLINIC_SETTINGS.pricing,
    };
  }

  const value =
    snapshot.val();

  return {
    consultationPrice:
      normalizeNumber(
        value.consultationPrice,
        0
      ),

    followupPrice:
      normalizeNumber(
        value.followupPrice,
        0
      ),

    followupDays:
      normalizeNumber(
        value.followupDays,
        14
      ),
  };
}

/* =========================================================
   APPOINTMENT HELPERS
========================================================= */

export async function getClinicAppointmentSettings(
  clinicId
) {
  const snapshot =
    await get(
      ref(
        database,
        `clinics/${clinicId}/settings/appointments`
      )
    );

  if (!snapshot.exists()) {
    return {
      ...DEFAULT_CLINIC_SETTINGS.appointments,
    };
  }

  const value =
    snapshot.val();

  return {
    slotDuration:
      normalizeNumber(
        value.slotDuration,
        30
      ),

    startTime:
      value.startTime ||
      "09:00",

    endTime:
      value.endTime ||
      "17:00",
  };
}

/* =========================================================
   PERMISSION HELPERS
========================================================= */

export async function getClinicPermissions(
  clinicId
) {
  const snapshot =
    await get(
      ref(
        database,
        `clinics/${clinicId}/settings/permissions`
      )
    );

  if (!snapshot.exists()) {
    return {
      ...DEFAULT_CLINIC_SETTINGS.permissions,
    };
  }

  return {
    ...DEFAULT_CLINIC_SETTINGS.permissions,
    ...snapshot.val(),
  };
}

/* =========================================================
   DETERMINE VISIT PRICING
========================================================= */

export function calculateVisitPrice({
  visitType,
  pricing,
}) {
  if (!pricing) {
    return 0;
  }

  if (
    visitType ===
      "followup" ||
    visitType ===
      "follow-up" ||
    visitType ===
      "return"
  ) {
    return Number(
      pricing.followupPrice ||
        0
    );
  }

  return Number(
    pricing.consultationPrice ||
      0
  );
}

/* =========================================================
   FOLLOW-UP ELIGIBILITY
========================================================= */

export function isFollowupEligible({
  previousVisitDate,
  followupDays,
}) {
  if (!previousVisitDate) {
    return false;
  }

  const previous =
    typeof previousVisitDate ===
    "number"
      ? previousVisitDate
      : new Date(
          previousVisitDate
        ).getTime();

  if (
    !previous ||
    Number.isNaN(previous)
  ) {
    return false;
  }

  const days =
    Number(
      followupDays || 0
    );

  if (days <= 0) {
    return false;
  }

  const expiry =
    previous +
    days *
      24 *
      60 *
      60 *
      1000;

  return (
    Date.now() <= expiry
  );
}