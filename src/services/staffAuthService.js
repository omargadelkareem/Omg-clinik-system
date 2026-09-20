import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signOut,
} from "firebase/auth";

import {
  deleteApp,
  initializeApp,
} from "firebase/app";

import {
  get,
  ref,
  update,
} from "firebase/database";

import {
  auth,
  database,
} from "../config/firebase";

/* =========================================================
   ROLE DEFAULT PERMISSIONS
========================================================= */

export const STAFF_DEFAULT_PERMISSIONS = {
  owner: [
    "dashboard",
    "patients_basic",
    "patients_create",
    "medical_history",
    "appointments_view",
    "appointments_manage",
    "checkin",
    "queue",
    "vitals",
    "nursing_notes",
    "visits",
    "prescriptions",
    "drug_library",
    "medical_files_upload",
    "medical_files",
    "payments",
    "receipts",
    "finance",
    "expenses",
    "reports",
    "staff",
    "settings",
    "whatsapp",
  ],

  doctor: [
    "dashboard",
    "patients_basic",
    "medical_history",
    "visits",
    "prescriptions",
    "medical_files",
    "medical_files_upload",
    "drug_library",
    "appointments_view",
    "queue",
    "pricing_own",
  ],

  nurse: [
    "dashboard",
    "patients_basic",
    "appointments_view",
    "queue",
    "vitals",
    "nursing_notes",
    "medical_files_upload",
  ],

  reception: [
    "dashboard",
    "patients_basic",
    "patients_create",
    "appointments_view",
    "appointments_manage",
    "checkin",
    "queue",
    "payments",
    "receipts",
  ],

  custom: [
    "dashboard",
  ],
};

/* =========================================================
   HELPERS
========================================================= */

function normalizeEmail(value = "") {
  return String(value)
    .trim()
    .toLowerCase();
}

function normalizePermissions(
  permissions,
  role
) {
  if (Array.isArray(permissions)) {
    return permissions;
  }

  if (
    permissions &&
    typeof permissions === "object"
  ) {
    return Object.entries(permissions)
      .filter(([, enabled]) =>
        Boolean(enabled)
      )
      .map(([permission]) => permission);
  }

  return [
    ...(STAFF_DEFAULT_PERMISSIONS[
      role
    ] || []),
  ];
}

function createSecondaryAppName() {
  return `omg-staff-auth-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

/* =========================================================
   CREATE STAFF LOGIN ACCOUNT

   مهم:
   بنستخدم Firebase App ثانوي علشان إنشاء حساب الموظف
   ما يعملش Logout لصاحب العيادة الحالي.
========================================================= */

export async function createStaffLoginAccount({
  clinicId,
  staffId,
  email,
  password,
  createdBy = "",
}) {
  if (!clinicId) {
    throw new Error(
      "Clinic ID is required."
    );
  }

  if (!staffId) {
    throw new Error(
      "Staff ID is required."
    );
  }

  const cleanEmail =
    normalizeEmail(email);

  if (!cleanEmail) {
    throw new Error(
      "من فضلك أدخل البريد الإلكتروني."
    );
  }

  if (!password) {
    throw new Error(
      "من فضلك أدخل كلمة المرور."
    );
  }

  if (password.length < 6) {
    throw new Error(
      "كلمة المرور يجب ألا تقل عن 6 أحرف."
    );
  }

  /* =====================================
     GET STAFF
  ===================================== */

  const staffRef = ref(
    database,
    `clinics/${clinicId}/staff/${staffId}`
  );

  const staffSnapshot =
    await get(staffRef);

  if (!staffSnapshot.exists()) {
    throw new Error(
      "عضو الفريق غير موجود."
    );
  }

  const staff =
    staffSnapshot.val();

  if (
    staff.status &&
    staff.status !== "active"
  ) {
    throw new Error(
      "لا يمكن إنشاء حساب لموظف غير نشط."
    );
  }

  if (staff.authUid) {
    throw new Error(
      "يوجد حساب دخول بالفعل لهذا الموظف."
    );
  }

  const role =
    staff.role || "custom";

  const permissions =
    normalizePermissions(
      staff.permissions,
      role
    );

  /* =====================================
     SECONDARY FIREBASE APP
  ===================================== */

  const secondaryApp =
    initializeApp(
      auth.app.options,
      createSecondaryAppName()
    );

  const secondaryAuth =
    getAuth(secondaryApp);

  let createdUser = null;

  try {
    const credential =
      await createUserWithEmailAndPassword(
        secondaryAuth,
        cleanEmail,
        password
      );

    createdUser =
      credential.user;

    const uid =
      createdUser.uid;

    const now =
      Date.now();

    /* =====================================
       ATOMIC DATABASE LINK
    ===================================== */

    const updates = {};

    updates[`users/${uid}`] = {
      uid,
      clinicId,
      staffId,
      role,
      status: "active",
      name:
        staff.name ||
        staff.fullName ||
        "",
      email: cleanEmail,
      phone:
        staff.phone || "",
      permissions,
      accountType: "staff",
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    updates[
      `userClinics/${uid}/${clinicId}`
    ] = {
      clinicId,
      staffId,
      role,
      status: "active",
      joinedAt: now,
    };

    updates[
      `clinics/${clinicId}/staff/${staffId}/authUid`
    ] = uid;

    updates[
      `clinics/${clinicId}/staff/${staffId}/email`
    ] = cleanEmail;

    updates[
      `clinics/${clinicId}/staff/${staffId}/loginEnabled`
    ] = true;

    updates[
      `clinics/${clinicId}/staff/${staffId}/accountStatus`
    ] = "active";

    updates[
      `clinics/${clinicId}/staff/${staffId}/permissions`
    ] = permissions;

    updates[
      `clinics/${clinicId}/staff/${staffId}/updatedAt`
    ] = now;

    updates[
      `clinics/${clinicId}/staff/${staffId}/loginCreatedAt`
    ] = now;

    updates[
      `clinics/${clinicId}/staff/${staffId}/loginCreatedBy`
    ] = createdBy;

    await update(
      ref(database),
      updates
    );

    return {
      uid,
      email: cleanEmail,
      clinicId,
      staffId,
      role,
      permissions,
    };
  } catch (error) {
    /*
     * لو Firebase Auth أنشأ المستخدم
     * لكن ربط قاعدة البيانات فشل،
     * نحاول حذف الحساب حتى لا يبقى orphan.
     */
    if (
      createdUser &&
      !String(error?.code || "").startsWith(
        "auth/"
      )
    ) {
      try {
        await deleteUser(
          createdUser
        );
      } catch (cleanupError) {
        console.error(
          "Staff auth cleanup error:",
          cleanupError
        );
      }
    }

    if (
      error?.code ===
      "auth/email-already-in-use"
    ) {
      throw new Error(
        "البريد الإلكتروني مستخدم بالفعل في حساب آخر."
      );
    }

    if (
      error?.code ===
      "auth/invalid-email"
    ) {
      throw new Error(
        "البريد الإلكتروني غير صحيح."
      );
    }

    if (
      error?.code ===
      "auth/weak-password"
    ) {
      throw new Error(
        "كلمة المرور ضعيفة. استخدم كلمة مرور أقوى."
      );
    }

    throw error;
  } finally {
    try {
      await signOut(
        secondaryAuth
      );
    } catch {
      // ignore
    }

    try {
      await deleteApp(
        secondaryApp
      );
    } catch {
      // ignore
    }
  }
}

/* =========================================================
   UPDATE STAFF ACCESS
========================================================= */

export async function updateStaffAccess({
  clinicId,
  staffId,
  permissions,
  role,
  updatedBy = "",
}) {
  if (!clinicId || !staffId) {
    throw new Error(
      "Clinic ID and Staff ID are required."
    );
  }

  const staffSnapshot =
    await get(
      ref(
        database,
        `clinics/${clinicId}/staff/${staffId}`
      )
    );

  if (!staffSnapshot.exists()) {
    throw new Error(
      "عضو الفريق غير موجود."
    );
  }

  const staff =
    staffSnapshot.val();

  const nextRole =
    role ||
    staff.role ||
    "custom";

  const nextPermissions =
    normalizePermissions(
      permissions,
      nextRole
    );

  const now =
    Date.now();

  const updates = {
    [`clinics/${clinicId}/staff/${staffId}/role`]:
      nextRole,

    [`clinics/${clinicId}/staff/${staffId}/permissions`]:
      nextPermissions,

    [`clinics/${clinicId}/staff/${staffId}/updatedAt`]:
      now,

    [`clinics/${clinicId}/staff/${staffId}/updatedBy`]:
      updatedBy,
  };

  if (staff.authUid) {
    updates[
      `users/${staff.authUid}/role`
    ] = nextRole;

    updates[
      `users/${staff.authUid}/permissions`
    ] = nextPermissions;

    updates[
      `users/${staff.authUid}/updatedAt`
    ] = now;

    updates[
      `userClinics/${staff.authUid}/${clinicId}/role`
    ] = nextRole;
  }

  await update(
    ref(database),
    updates
  );

  return {
    role: nextRole,
    permissions:
      nextPermissions,
  };
}

/* =========================================================
   ENABLE / DISABLE LOGIN
========================================================= */

export async function setStaffLoginStatus({
  clinicId,
  staffId,
  active,
  updatedBy = "",
}) {
  if (!clinicId || !staffId) {
    throw new Error(
      "Clinic ID and Staff ID are required."
    );
  }

  const staffSnapshot =
    await get(
      ref(
        database,
        `clinics/${clinicId}/staff/${staffId}`
      )
    );

  if (!staffSnapshot.exists()) {
    throw new Error(
      "عضو الفريق غير موجود."
    );
  }

  const staff =
    staffSnapshot.val();

  const status =
    active
      ? "active"
      : "disabled";

  const now =
    Date.now();

  const updates = {
    [`clinics/${clinicId}/staff/${staffId}/accountStatus`]:
      status,

    [`clinics/${clinicId}/staff/${staffId}/loginEnabled`]:
      Boolean(active),

    [`clinics/${clinicId}/staff/${staffId}/updatedAt`]:
      now,

    [`clinics/${clinicId}/staff/${staffId}/updatedBy`]:
      updatedBy,
  };

  if (staff.authUid) {
    updates[
      `users/${staff.authUid}/status`
    ] = status;

    updates[
      `users/${staff.authUid}/updatedAt`
    ] = now;

    updates[
      `userClinics/${staff.authUid}/${clinicId}/status`
    ] = status;
  }

  await update(
    ref(database),
    updates
  );

  return status;
}