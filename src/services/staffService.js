import {
  get,
  onValue,
  push,
  ref,
  remove,
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

export const STAFF_ROLES = {
  doctor: {
    id: "doctor",
    label: "طبيب",
  },

  nurse: {
    id: "nurse",
    label: "تمريض",
  },

  reception: {
    id: "reception",
    label: "ريسبشن",
  },

  custom: {
    id: "custom",
    label: "وظيفة أخرى",
  },
};

export const DEFAULT_STAFF_PERMISSIONS = {
  doctor: [
    "patients_basic",
    "medical_history",
    "visits",
    "prescriptions",
    "medical_files",
    "drug_library",
    "appointments_view",
    "pricing_own",
  ],

  nurse: [
    "patients_basic",
    "queue",
    "vitals",
    "nursing_notes",
    "medical_files_upload",
  ],

  reception: [
    "patients_basic",
    "patients_create",
    "appointments_manage",
    "appointments_view",
    "checkin",
    "queue",
    "payments",
    "receipts",
  ],

  custom: [],
};

export const STAFF_PERMISSION_GROUPS = [
  {
    id: "patients",
    title: "المرضى",
    description:
      "الوصول إلى ملفات المرضى وبياناتهم",

    permissions: [
      {
        id: "patients_basic",
        label:
          "عرض بيانات المرضى الأساسية",
      },

      {
        id: "patients_create",
        label:
          "إضافة وتعديل المرضى",
      },

      {
        id: "medical_history",
        label:
          "عرض التاريخ الطبي",
        sensitive: true,
      },
    ],
  },

  {
    id: "appointments",
    title:
      "المواعيد والاستقبال",
    description:
      "تشغيل حركة المرضى داخل العيادة",

    permissions: [
      {
        id: "appointments_view",
        label:
          "عرض المواعيد",
      },

      {
        id: "appointments_manage",
        label:
          "حجز وتعديل وإلغاء المواعيد",
      },

      {
        id: "checkin",
        label:
          "تسجيل وصول المريض",
      },

      {
        id: "queue",
        label:
          "إدارة قائمة الانتظار",
      },
    ],
  },

  {
    id: "medical",
    title: "الكشف الطبي",
    description:
      "الصلاحيات الطبية الحساسة",

    permissions: [
      {
        id: "vitals",
        label:
          "تسجيل العلامات الحيوية",
      },

      {
        id: "nursing_notes",
        label:
          "إضافة ملاحظات تمريضية",
      },

      {
        id: "visits",
        label:
          "فتح وتسجيل الكشف",
        sensitive: true,
      },

      {
        id: "prescriptions",
        label:
          "كتابة وعرض الروشتات",
        sensitive: true,
      },

      {
        id: "drug_library",
        label:
          "إدارة مكتبة الأدوية",
        sensitive: true,
      },
    ],
  },

  {
    id: "medicalFiles",
    title:
      "التحاليل والملفات",
    description:
      "المستندات الطبية للمريض",

    permissions: [
      {
        id: "medical_files_upload",
        label:
          "رفع ملفات وتحاليل",
      },

      {
        id: "medical_files",
        label:
          "عرض جميع الملفات الطبية",
        sensitive: true,
      },
    ],
  },

  {
    id: "finance",
    title: "المالية",
    description:
      "التحصيل والإيرادات",

    permissions: [
      {
        id: "payments",
        label:
          "تسجيل دفع المريض",
      },

      {
        id: "receipts",
        label:
          "طباعة إيصالات الدفع",
      },

      {
        id: "finance",
        label:
          "عرض المالية الكاملة",
        sensitive: true,
      },

      {
        id: "expenses",
        label:
          "تسجيل المصروفات",
        sensitive: true,
      },
    ],
  },

  {
    id: "administration",
    title: "الإدارة",
    description:
      "صلاحيات إدارة النظام",

    permissions: [
      {
        id: "pricing_own",
        label:
          "تعديل أسعار الكشف الخاصة به",
      },

      {
        id: "reports",
        label:
          "عرض التقارير",
        sensitive: true,
      },

      {
        id: "staff",
        label:
          "إدارة فريق العمل",
        sensitive: true,
      },

      {
        id: "settings",
        label:
          "تعديل إعدادات النظام",
        sensitive: true,
      },
    ],
  },
];

/* =========================================================
   HELPERS
========================================================= */

function timestamp() {
  return Date.now();
}

function clean(value) {
  return String(
    value ?? ""
  ).trim();
}

function number(
  value,
  fallback = 0
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return fallback;
  }

  return parsed;
}

function normalizePhone(
  phone
) {
  return clean(
    phone
  ).replace(/\D/g, "");
}

function normalizeEmail(
  email
) {
  return clean(
    email
  ).toLowerCase();
}

function normalizePermissions(
  permissions = []
) {
  if (
    !Array.isArray(
      permissions
    )
  ) {
    return [];
  }

  return [
    ...new Set(
      permissions.filter(
        Boolean
      )
    ),
  ];
}

function getRolePermissions(
  role
) {
  return [
    ...(DEFAULT_STAFF_PERMISSIONS[
      role
    ] ||
      DEFAULT_STAFF_PERMISSIONS
        .custom),
  ];
}

function sortStaff(
  items
) {
  return [...items].sort(
    (a, b) => {
      const aActive =
        a.accountStatus ===
        "active"
          ? 0
          : 1;

      const bActive =
        b.accountStatus ===
        "active"
          ? 0
          : 1;

      if (
        aActive !== bActive
      ) {
        return (
          aActive - bActive
        );
      }

      return clean(
        a.name
      ).localeCompare(
        clean(b.name),
        "ar"
      );
    }
  );
}

async function getNextStaffCode(
  clinicId
) {
  const counterRef = ref(
    database,
    `clinics/${clinicId}/counters/staff`
  );

  const result =
    await runTransaction(
      counterRef,
      (current) => {
        const currentValue =
          Number(
            current || 0
          );

        return (
          currentValue + 1
        );
      }
    );

  const value =
    Number(
      result.snapshot.val() ||
        1
    );

  return `ST-${String(
    value
  ).padStart(4, "0")}`;
}

/* =========================================================
   SUBSCRIBE
========================================================= */

export function subscribeClinicStaff(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback([]);
    return () => {};
  }

  const staffRef = ref(
    database,
    `clinics/${clinicId}/staff`
  );

  return onValue(
    staffRef,

    (snapshot) => {
      const value =
        snapshot.val() || {};

      const staff =
        Object.entries(
          value
        ).map(
          ([id, item]) => ({
            id,
            ...item,

            permissions:
              normalizePermissions(
                item?.permissions
              ),
          })
        );

      callback(
        sortStaff(staff)
      );
    },

    (error) => {
      console.error(
        "subscribeClinicStaff:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   GET
========================================================= */

export async function getStaffMember(
  clinicId,
  staffId
) {
  if (
    !clinicId ||
    !staffId
  ) {
    return null;
  }

  const snapshot =
    await get(
      ref(
        database,
        `clinics/${clinicId}/staff/${staffId}`
      )
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  return {
    id: staffId,
    ...snapshot.val(),
  };
}

/* =========================================================
   CREATE
========================================================= */

export async function createStaffMember({
  clinicId,
  member,
  createdBy = "",
  createdByName = "",
}) {
  if (!clinicId) {
    throw new Error(
      "Clinic ID is required."
    );
  }

  const name =
    clean(member?.name);

  const phone =
    clean(member?.phone);

  const normalizedPhone =
    normalizePhone(phone);

  const email =
    normalizeEmail(
      member?.email
    );

  const role =
    member?.role ||
    "reception";

  if (!name) {
    throw new Error(
      "اسم الموظف مطلوب."
    );
  }

  if (!phone) {
    throw new Error(
      "رقم الهاتف مطلوب."
    );
  }

  if (
    normalizedPhone.length <
    10
  ) {
    throw new Error(
      "رقم الهاتف غير صحيح."
    );
  }

  if (
    !STAFF_ROLES[role]
  ) {
    throw new Error(
      "نوع الوظيفة غير صحيح."
    );
  }

  if (
    role === "custom" &&
    !clean(
      member?.customRole
    )
  ) {
    throw new Error(
      "اكتب المسمى الوظيفي."
    );
  }

  const staffRootRef =
    ref(
      database,
      `clinics/${clinicId}/staff`
    );

  const existingSnapshot =
    await get(
      staffRootRef
    );

  const existingStaff =
    existingSnapshot.val() ||
    {};

  const duplicatePhone =
    Object.values(
      existingStaff
    ).some(
      (item) =>
        normalizePhone(
          item?.phone
        ) ===
        normalizedPhone
    );

  if (duplicatePhone) {
    throw new Error(
      "يوجد عضو فريق مسجل بنفس رقم الهاتف."
    );
  }

  if (email) {
    const duplicateEmail =
      Object.values(
        existingStaff
      ).some(
        (item) =>
          normalizeEmail(
            item?.email
          ) === email
      );

    if (
      duplicateEmail
    ) {
      throw new Error(
        "يوجد عضو فريق مسجل بنفس البريد الإلكتروني."
      );
    }
  }

  const newMemberRef =
    push(staffRootRef);

  const staffId =
    newMemberRef.key;

  const staffCode =
    await getNextStaffCode(
      clinicId
    );

  const permissions =
    member?.permissionsMode ===
    "custom"
      ? normalizePermissions(
          member?.permissions
        )
      : getRolePermissions(
          role
        );

  const now =
    timestamp();

  const payload = {
    id: staffId,
    staffCode,

    name,
    initials:
      name.charAt(0),

    phone,
    normalizedPhone,
    email,

    role,

    customRole:
      role === "custom"
        ? clean(
            member?.customRole
          )
        : "",

    branch:
      clean(
        member?.branch
      ) ||
      "الفرع الرئيسي",

    specialty:
      role === "doctor"
        ? clean(
            member?.specialty
          )
        : "",

    degree:
      role === "doctor"
        ? clean(
            member?.degree
          )
        : "",

    registrationNumber:
      role === "doctor"
        ? clean(
            member
              ?.registrationNumber
          )
        : "",

    schedule:
      role === "doctor"
        ? clean(
            member?.schedule
          )
        : "",

    consultationPrice:
      role === "doctor"
        ? Math.max(
            0,
            number(
              member
                ?.consultationPrice
            )
          )
        : 0,

    followupPrice:
      role === "doctor"
        ? Math.max(
            0,
            number(
              member
                ?.followupPrice
            )
          )
        : 0,

    followupDays:
      role === "doctor"
        ? Math.max(
            0,
            number(
              member
                ?.followupDays,
              14
            )
          )
        : 0,

    permissionsMode:
      member?.permissionsMode ===
      "custom"
        ? "custom"
        : "role",

    permissions,

    accountStatus:
      "active",

    presenceStatus:
      "offline",

    authStatus:
      "not-created",

    authUid: "",

    loginEnabled:
      false,

    lastLoginAt:
      null,

    lastSeenAt:
      null,

    createdAt: now,
    updatedAt: now,

    createdBy:
      clean(createdBy),

    createdByName:
      clean(
        createdByName
      ),
  };

  await set(
    newMemberRef,
    payload
  );

  return payload;
}

/* =========================================================
   UPDATE MEMBER
========================================================= */

export async function updateStaffMember({
  clinicId,
  staffId,
  member,
  updatedBy = "",
  updatedByName = "",
}) {
  if (
    !clinicId ||
    !staffId
  ) {
    throw new Error(
      "بيانات الموظف غير مكتملة."
    );
  }

  const current =
    await getStaffMember(
      clinicId,
      staffId
    );

  if (!current) {
    throw new Error(
      "الموظف غير موجود."
    );
  }

  const role =
    member?.role ||
    current.role;

  const name =
    clean(member?.name);

  const phone =
    clean(member?.phone);

  const email =
    normalizeEmail(
      member?.email
    );

  if (!name) {
    throw new Error(
      "اسم الموظف مطلوب."
    );
  }

  if (!phone) {
    throw new Error(
      "رقم الهاتف مطلوب."
    );
  }

  if (
    normalizePhone(
      phone
    ).length < 10
  ) {
    throw new Error(
      "رقم الهاتف غير صحيح."
    );
  }

  if (
    !STAFF_ROLES[role]
  ) {
    throw new Error(
      "نوع الوظيفة غير صحيح."
    );
  }

  if (
    role === "custom" &&
    !clean(
      member?.customRole
    )
  ) {
    throw new Error(
      "اكتب المسمى الوظيفي."
    );
  }

  /*
   * لو الحساب مرتبط بـFirebase Auth
   * لا نسمح بتغيير البريد من هنا؛
   * تغيير Email في Auth يحتاج re-authentication.
   */

  if (
    current.authUid &&
    email &&
    current.email &&
    email !==
      normalizeEmail(
        current.email
      )
  ) {
    throw new Error(
      "لا يمكن تغيير بريد تسجيل الدخول من بيانات الموظف بعد إنشاء الحساب."
    );
  }

  const permissions =
    member?.permissionsMode ===
    "custom"
      ? normalizePermissions(
          member?.permissions
        )
      : getRolePermissions(
          role
        );

  const now =
    timestamp();

  const memberUpdates = {
    name,

    initials:
      name.charAt(0),

    phone,

    normalizedPhone:
      normalizePhone(
        phone
      ),

    email,

    role,

    customRole:
      role === "custom"
        ? clean(
            member?.customRole
          )
        : "",

    branch:
      clean(
        member?.branch
      ) ||
      "الفرع الرئيسي",

    specialty:
      role === "doctor"
        ? clean(
            member?.specialty
          )
        : "",

    degree:
      role === "doctor"
        ? clean(
            member?.degree
          )
        : "",

    registrationNumber:
      role === "doctor"
        ? clean(
            member
              ?.registrationNumber
          )
        : "",

    schedule:
      role === "doctor"
        ? clean(
            member?.schedule
          )
        : "",

    consultationPrice:
      role === "doctor"
        ? Math.max(
            0,
            number(
              member
                ?.consultationPrice
            )
          )
        : 0,

    followupPrice:
      role === "doctor"
        ? Math.max(
            0,
            number(
              member
                ?.followupPrice
            )
          )
        : 0,

    followupDays:
      role === "doctor"
        ? Math.max(
            0,
            number(
              member
                ?.followupDays,
              14
            )
          )
        : 0,

    permissionsMode:
      member?.permissionsMode ===
      "custom"
        ? "custom"
        : "role",

    permissions,

    updatedAt: now,

    updatedBy:
      clean(updatedBy),

    updatedByName:
      clean(
        updatedByName
      ),
  };

  const rootUpdates = {};

  Object.entries(
    memberUpdates
  ).forEach(
    ([key, value]) => {
      rootUpdates[
        `clinics/${clinicId}/staff/${staffId}/${key}`
      ] = value;
    }
  );

  /*
   * الحساب مرتبط بالفعل:
   * role + permissions + display data
   * يجب أن يتحدثوا في /users أيضاً.
   */

  if (current.authUid) {
    rootUpdates[
      `users/${current.authUid}/name`
    ] = name;

    rootUpdates[
      `users/${current.authUid}/phone`
    ] = phone;

    rootUpdates[
      `users/${current.authUid}/role`
    ] = role;

    rootUpdates[
      `users/${current.authUid}/permissions`
    ] = permissions;

    rootUpdates[
      `users/${current.authUid}/updatedAt`
    ] = now;

    rootUpdates[
      `userClinics/${current.authUid}/${clinicId}/role`
    ] = role;
  }

  await update(
    ref(database),
    rootUpdates
  );

  return {
    ...current,
    ...memberUpdates,
  };
}

/* =========================================================
   PERMISSIONS
========================================================= */

export async function updateStaffPermissions({
  clinicId,
  staffId,
  permissions,
  updatedBy = "",
  updatedByName = "",
}) {
  if (
    !clinicId ||
    !staffId
  ) {
    throw new Error(
      "بيانات الموظف غير مكتملة."
    );
  }

  const member =
    await getStaffMember(
      clinicId,
      staffId
    );

  if (!member) {
    throw new Error(
      "الموظف غير موجود."
    );
  }

  const normalized =
    normalizePermissions(
      permissions
    );

  const now =
    timestamp();

  const updates = {
    [`clinics/${clinicId}/staff/${staffId}/permissions`]:
      normalized,

    [`clinics/${clinicId}/staff/${staffId}/permissionsMode`]:
      "custom",

    [`clinics/${clinicId}/staff/${staffId}/updatedAt`]:
      now,

    [`clinics/${clinicId}/staff/${staffId}/updatedBy`]:
      clean(updatedBy),

    [`clinics/${clinicId}/staff/${staffId}/updatedByName`]:
      clean(
        updatedByName
      ),
  };

  if (member.authUid) {
    updates[
      `users/${member.authUid}/permissions`
    ] = normalized;

    updates[
      `users/${member.authUid}/updatedAt`
    ] = now;
  }

  await update(
    ref(database),
    updates
  );

  return normalized;
}

export async function resetStaffPermissionsToRole({
  clinicId,
  staffId,
  role,
  updatedBy = "",
  updatedByName = "",
}) {
  const member =
    await getStaffMember(
      clinicId,
      staffId
    );

  if (!member) {
    throw new Error(
      "الموظف غير موجود."
    );
  }

  const permissions =
    getRolePermissions(
      role
    );

  const now =
    timestamp();

  const updates = {
    [`clinics/${clinicId}/staff/${staffId}/permissions`]:
      permissions,

    [`clinics/${clinicId}/staff/${staffId}/permissionsMode`]:
      "role",

    [`clinics/${clinicId}/staff/${staffId}/updatedAt`]:
      now,

    [`clinics/${clinicId}/staff/${staffId}/updatedBy`]:
      clean(updatedBy),

    [`clinics/${clinicId}/staff/${staffId}/updatedByName`]:
      clean(
        updatedByName
      ),
  };

  if (member.authUid) {
    updates[
      `users/${member.authUid}/permissions`
    ] = permissions;

    updates[
      `users/${member.authUid}/updatedAt`
    ] = now;
  }

  await update(
    ref(database),
    updates
  );

  return permissions;
}

/* =========================================================
   ACCOUNT STATUS
========================================================= */

export async function setStaffAccountStatus({
  clinicId,
  staffId,
  status,
  updatedBy = "",
  updatedByName = "",
}) {
  if (
    !clinicId ||
    !staffId
  ) {
    throw new Error(
      "بيانات الموظف غير مكتملة."
    );
  }

  if (
    ![
      "active",
      "disabled",
    ].includes(status)
  ) {
    throw new Error(
      "حالة الحساب غير صحيحة."
    );
  }

  const member =
    await getStaffMember(
      clinicId,
      staffId
    );

  if (!member) {
    throw new Error(
      "الموظف غير موجود."
    );
  }

  const now =
    timestamp();

  const updates = {
    [`clinics/${clinicId}/staff/${staffId}/accountStatus`]:
      status,

    [`clinics/${clinicId}/staff/${staffId}/presenceStatus`]:
      status === "disabled"
        ? "offline"
        : member
            .presenceStatus ||
          "offline",

    [`clinics/${clinicId}/staff/${staffId}/updatedAt`]:
      now,

    [`clinics/${clinicId}/staff/${staffId}/updatedBy`]:
      clean(updatedBy),

    [`clinics/${clinicId}/staff/${staffId}/updatedByName`]:
      clean(
        updatedByName
      ),
  };

  /*
   * loginEnabled معناها:
   * هل حساب الدخول المرتبط مسموح له بالدخول؟
   *
   * الموظف الذي لم ننشئ له Auth Account
   * يظل loginEnabled=false.
   */

  if (member.authUid) {
    const loginEnabled =
      status === "active";

    updates[
      `clinics/${clinicId}/staff/${staffId}/loginEnabled`
    ] = loginEnabled;

    updates[
      `users/${member.authUid}/status`
    ] = status;

    updates[
      `users/${member.authUid}/updatedAt`
    ] = now;

    updates[
      `userClinics/${member.authUid}/${clinicId}/status`
    ] = status;
  }

  await update(
    ref(database),
    updates
  );

  return status;
}

/* =========================================================
   DELETE
========================================================= */

export async function deleteStaffMember({
  clinicId,
  staffId,
}) {
  if (
    !clinicId ||
    !staffId
  ) {
    throw new Error(
      "بيانات الموظف غير مكتملة."
    );
  }

  const member =
    await getStaffMember(
      clinicId,
      staffId
    );

  if (!member) {
    return;
  }

  /*
   * مهم:
   * لو الموظف عنده Auth Account لا نحذف Record المستخدم
   * ونتركه Active.
   *
   * أولاً نعطل الوصول.
   */

  if (member.authUid) {
    await update(
      ref(database),
      {
        [`users/${member.authUid}/status`]:
          "disabled",

        [`users/${member.authUid}/updatedAt`]:
          timestamp(),

        [`userClinics/${member.authUid}/${clinicId}/status`]:
          "disabled",
      }
    );
  }

  await remove(
    ref(
      database,
      `clinics/${clinicId}/staff/${staffId}`
    )
  );
}

/* =========================================================
   STATISTICS
========================================================= */

export function calculateStaffStatistics(
  staff = []
) {
  const activeStaff =
    staff.filter(
      (item) =>
        item.accountStatus ===
        "active"
    );

  const onlineStaff =
    activeStaff.filter(
      (item) =>
        item.presenceStatus ===
        "online"
    );

  return {
    total:
      staff.length,

    active:
      activeStaff.length,

    disabled:
      staff.filter(
        (item) =>
          item.accountStatus ===
          "disabled"
      ).length,

    online:
      onlineStaff.length,

    doctors:
      activeStaff.filter(
        (item) =>
          item.role ===
          "doctor"
      ).length,

    nurses:
      activeStaff.filter(
        (item) =>
          item.role ===
          "nurse"
      ).length,

    reception:
      activeStaff.filter(
        (item) =>
          item.role ===
          "reception"
      ).length,

    custom:
      activeStaff.filter(
        (item) =>
          item.role ===
          "custom"
      ).length,

    onlineDoctors:
      onlineStaff.filter(
        (item) =>
          item.role ===
          "doctor"
      ).length,

    onlineNurses:
      onlineStaff.filter(
        (item) =>
          item.role ===
          "nurse"
      ).length,

    onlineReception:
      onlineStaff.filter(
        (item) =>
          item.role ===
          "reception"
      ).length,

    loginAccounts:
      staff.filter(
        (item) =>
          Boolean(
            item.authUid
          )
      ).length,

    pendingLogin:
      staff.filter(
        (item) =>
          !item.authUid
      ).length,
  };
}