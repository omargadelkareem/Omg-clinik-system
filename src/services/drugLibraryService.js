import {
  get,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
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

function normalizeDrug(raw = {}, id = "") {
  return {
    id: cleanText(raw.id || id),

    tradeName: cleanText(raw.tradeName),
    genericName: cleanText(raw.genericName),
    strength: cleanText(raw.strength),

    form: cleanText(raw.form) || "Tablet",
    route: cleanText(raw.route) || "Oral",

    defaultDose: cleanText(raw.defaultDose),
    frequency: cleanText(raw.frequency),
    duration: cleanText(raw.duration),
    instructions: cleanText(raw.instructions),

    favorite: Boolean(raw.favorite),

    usageCount: Number(raw.usageCount || 0),

    createdBy: cleanText(raw.createdBy),

    createdAt:
      typeof raw.createdAt === "number"
        ? raw.createdAt
        : 0,

    updatedAt:
      typeof raw.updatedAt === "number"
        ? raw.updatedAt
        : 0,
  };
}

function objectToList(value) {
  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).map(([id, item]) =>
    normalizeDrug(item, id)
  );
}

function sortDrugs(items = []) {
  return [...items].sort((a, b) => {
    const aTime = Number(a.createdAt || 0);
    const bTime = Number(b.createdAt || 0);

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    return String(a.tradeName || "").localeCompare(
      String(b.tradeName || ""),
      "en",
      {
        sensitivity: "base",
      }
    );
  });
}

function validateClinicId(clinicId) {
  if (!cleanText(clinicId)) {
    throw new Error("Clinic ID غير موجود.");
  }
}

function validateDrug(drug) {
  if (!cleanText(drug?.tradeName)) {
    throw new Error("اسم الدواء التجاري مطلوب.");
  }
}

export function createDrugKey(name, strength, form) {
  return `${cleanText(name)}-${cleanText(
    strength
  )}-${cleanText(form)}`
    .toLowerCase()
    .replace(/\s+/g, "");
}

/* =========================================================
   REALTIME SUBSCRIPTION
========================================================= */

export function subscribeDrugLibrary(
  clinicId,
  callback,
  onError
) {
  validateClinicId(clinicId);

  const drugLibraryRef = ref(
    database,
    `clinics/${clinicId}/drugLibrary`
  );

  return onValue(
    drugLibraryRef,
    (snapshot) => {
      const items = objectToList(snapshot.val());

      callback(sortDrugs(items));
    },
    (error) => {
      console.error(
        "subscribeDrugLibrary error:",
        error
      );

      if (onError) {
        onError(error);
      }
    }
  );
}

/* =========================================================
   GET ALL
========================================================= */

export async function getDrugLibrary(clinicId) {
  validateClinicId(clinicId);

  const snapshot = await get(
    ref(
      database,
      `clinics/${clinicId}/drugLibrary`
    )
  );

  return sortDrugs(
    objectToList(snapshot.val())
  );
}

/* =========================================================
   GET SINGLE
========================================================= */

export async function getDrugById(
  clinicId,
  drugId
) {
  validateClinicId(clinicId);

  if (!cleanText(drugId)) {
    throw new Error("Drug ID غير موجود.");
  }

  const snapshot = await get(
    ref(
      database,
      `clinics/${clinicId}/drugLibrary/${drugId}`
    )
  );

  if (!snapshot.exists()) {
    return null;
  }

  return normalizeDrug(
    snapshot.val(),
    drugId
  );
}

/* =========================================================
   CREATE
========================================================= */

export async function createDrug({
  clinicId,
  drug,
  createdBy = "",
}) {
  validateClinicId(clinicId);
  validateDrug(drug);

  const collectionRef = ref(
    database,
    `clinics/${clinicId}/drugLibrary`
  );

  const newDrugRef = push(collectionRef);

  const drugId = newDrugRef.key;

  if (!drugId) {
    throw new Error(
      "تعذر إنشاء معرف للدواء."
    );
  }

  const payload = {
    id: drugId,

    tradeName: cleanText(drug.tradeName),
    genericName: cleanText(drug.genericName),
    strength: cleanText(drug.strength),

    form: cleanText(drug.form) || "Tablet",
    route: cleanText(drug.route) || "Oral",

    defaultDose: cleanText(drug.defaultDose),
    frequency: cleanText(drug.frequency),
    duration: cleanText(drug.duration),
    instructions: cleanText(drug.instructions),

    favorite: Boolean(drug.favorite),

    usageCount: Number(drug.usageCount || 0),

    createdBy: cleanText(createdBy),

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await set(newDrugRef, payload);

  return {
    ...payload,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/* =========================================================
   UPDATE
========================================================= */

export async function updateDrug({
  clinicId,
  drugId,
  drug,
}) {
  validateClinicId(clinicId);

  if (!cleanText(drugId)) {
    throw new Error("Drug ID غير موجود.");
  }

  validateDrug(drug);

  const drugRef = ref(
    database,
    `clinics/${clinicId}/drugLibrary/${drugId}`
  );

  const updates = {
    tradeName: cleanText(drug.tradeName),
    genericName: cleanText(drug.genericName),
    strength: cleanText(drug.strength),

    form: cleanText(drug.form) || "Tablet",
    route: cleanText(drug.route) || "Oral",

    defaultDose: cleanText(drug.defaultDose),
    frequency: cleanText(drug.frequency),
    duration: cleanText(drug.duration),
    instructions: cleanText(drug.instructions),

    favorite: Boolean(drug.favorite),

    updatedAt: serverTimestamp(),
  };

  await update(drugRef, updates);

  return {
    id: drugId,
    ...drug,
    ...updates,
    updatedAt: Date.now(),
  };
}

/* =========================================================
   DELETE
========================================================= */

export async function deleteDrug({
  clinicId,
  drugId,
}) {
  validateClinicId(clinicId);

  if (!cleanText(drugId)) {
    throw new Error("Drug ID غير موجود.");
  }

  await remove(
    ref(
      database,
      `clinics/${clinicId}/drugLibrary/${drugId}`
    )
  );

  return true;
}

/* =========================================================
   FAVORITE
========================================================= */

export async function setDrugFavorite({
  clinicId,
  drugId,
  favorite,
}) {
  validateClinicId(clinicId);

  if (!cleanText(drugId)) {
    throw new Error("Drug ID غير موجود.");
  }

  await update(
    ref(
      database,
      `clinics/${clinicId}/drugLibrary/${drugId}`
    ),
    {
      favorite: Boolean(favorite),
      updatedAt: serverTimestamp(),
    }
  );

  return true;
}

/* =========================================================
   USAGE COUNT
========================================================= */

export async function incrementDrugUsage({
  clinicId,
  drugId,
}) {
  validateClinicId(clinicId);

  if (!cleanText(drugId)) {
    return;
  }

  const usageRef = ref(
    database,
    `clinics/${clinicId}/drugLibrary/${drugId}/usageCount`
  );

  await runTransaction(
    usageRef,
    (currentValue) =>
      Number(currentValue || 0) + 1
  );

  await update(
    ref(
      database,
      `clinics/${clinicId}/drugLibrary/${drugId}`
    ),
    {
      updatedAt: serverTimestamp(),
    }
  );
}

/* =========================================================
   IMPORT MANY
========================================================= */

export async function importDrugs({
  clinicId,
  drugs,
  createdBy = "",
}) {
  validateClinicId(clinicId);

  if (!Array.isArray(drugs) || !drugs.length) {
    return {
      addedCount: 0,
      duplicateCount: 0,
    };
  }

  const currentDrugs = await getDrugLibrary(
    clinicId
  );

  const existingKeys = new Set(
    currentDrugs.map((drug) =>
      createDrugKey(
        drug.tradeName,
        drug.strength,
        drug.form
      )
    )
  );

  const rootUpdates = {};

  let addedCount = 0;
  let duplicateCount = 0;

  drugs.forEach((drug) => {
    if (!cleanText(drug.tradeName)) {
      return;
    }

    const key = createDrugKey(
      drug.tradeName,
      drug.strength,
      drug.form
    );

    if (existingKeys.has(key)) {
      duplicateCount += 1;
      return;
    }

    existingKeys.add(key);

    const newDrugRef = push(
      ref(
        database,
        `clinics/${clinicId}/drugLibrary`
      )
    );

    const drugId = newDrugRef.key;

    if (!drugId) {
      return;
    }

    rootUpdates[
      `clinics/${clinicId}/drugLibrary/${drugId}`
    ] = {
      id: drugId,

      tradeName: cleanText(drug.tradeName),
      genericName: cleanText(drug.genericName),
      strength: cleanText(drug.strength),

      form: cleanText(drug.form) || "Tablet",
      route: cleanText(drug.route) || "Oral",

      defaultDose: cleanText(drug.defaultDose),
      frequency: cleanText(drug.frequency),
      duration: cleanText(drug.duration),
      instructions: cleanText(drug.instructions),

      favorite: Boolean(drug.favorite),

      usageCount: Number(drug.usageCount || 0),

      createdBy: cleanText(createdBy),

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    addedCount += 1;
  });

  if (addedCount > 0) {
    await update(
      ref(database),
      rootUpdates
    );
  }

  return {
    addedCount,
    duplicateCount,
  };
}

/* =========================================================
   CHECK DUPLICATE
========================================================= */

export async function drugExists({
  clinicId,
  tradeName,
  strength = "",
  form = "",
  excludeDrugId = "",
}) {
  const drugs = await getDrugLibrary(
    clinicId
  );

  const targetKey = createDrugKey(
    tradeName,
    strength,
    form
  );

  return drugs.some((drug) => {
    if (
      excludeDrugId &&
      drug.id === excludeDrugId
    ) {
      return false;
    }

    return (
      createDrugKey(
        drug.tradeName,
        drug.strength,
        drug.form
      ) === targetKey
    );
  });
}