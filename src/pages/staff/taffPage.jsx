import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertTriangle,
  Check,
  ChevronLeft,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  HeartPulse,
  KeyRound,
  LockKeyhole,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserCog,
  UserRound,
  Users,
  X,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext";

import {
  DEFAULT_STAFF_PERMISSIONS,
  STAFF_PERMISSION_GROUPS,
  calculateStaffStatistics,
  createStaffMember,
  deleteStaffMember,
  setStaffAccountStatus,
  subscribeClinicStaff,
  updateStaffMember,
  updateStaffPermissions,
} from "../../services/staffService";

import {
  createStaffLoginAccount,
} from "../../services/staffAuthService";

import "./StaffPage.css";

/* =========================================================
   CONSTANTS
========================================================= */

const roleDefinitions = {
  doctor: {
    label: "طبيب",
    icon: Stethoscope,
  },

  nurse: {
    label: "تمريض",
    icon: HeartPulse,
  },

  reception: {
    label: "ريسبشن",
    icon: UserRound,
  },

  custom: {
    label: "وظيفة أخرى",
    icon: UserCog,
  },
};

const EMPTY_MEMBER = {
  name: "",
  phone: "",
  email: "",
  branch:
    "الفرع الرئيسي",

  role: "reception",
  customRole: "",

  specialty: "",
  degree: "",
  registrationNumber: "",
  schedule: "",

  consultationPrice: "",
  followupPrice: "",
  followupDays: 14,

  permissionsMode:
    "role",

  permissions: [
    ...DEFAULT_STAFF_PERMISSIONS
      .reception,
  ],
};

/* =========================================================
   HELPERS
========================================================= */

function getProfileName(
  profile
) {
  return (
    profile?.name ||
    profile?.fullName ||
    profile?.displayName ||
    ""
  );
}

function formatDateTime(
  value
) {
  if (!value) {
    return "لم يسجل الدخول بعد";
  }

  try {
    return new Intl.DateTimeFormat(
      "ar-EG",
      {
        dateStyle:
          "medium",

        timeStyle:
          "short",
      }
    ).format(
      new Date(value)
    );
  } catch {
    return "—";
  }
}

function getRoleLabel(
  member
) {
  if (
    member?.role ===
    "custom"
  ) {
    return (
      member?.customRole ||
      "وظيفة أخرى"
    );
  }

  return (
    roleDefinitions[
      member?.role
    ]?.label ||
    "غير محدد"
  );
}

function getInitials(
  name
) {
  const parts =
    String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (!parts.length) {
    return "؟";
  }

  if (
    parts.length === 1
  ) {
    return parts[0].charAt(
      0
    );
  }

  return `${parts[0].charAt(
    0
  )}${parts[1].charAt(
    0
  )}`;
}

function memberToForm(
  member
) {
  return {
    name:
      member?.name || "",

    phone:
      member?.phone || "",

    email:
      member?.email || "",

    branch:
      member?.branch ||
      "الفرع الرئيسي",

    role:
      member?.role ||
      "reception",

    customRole:
      member?.customRole ||
      "",

    specialty:
      member?.specialty ||
      "",

    degree:
      member?.degree || "",

    registrationNumber:
      member
        ?.registrationNumber ||
      "",

    schedule:
      member?.schedule ||
      "",

    consultationPrice:
      member
        ?.consultationPrice ??
      "",

    followupPrice:
      member
        ?.followupPrice ??
      "",

    followupDays:
      member
        ?.followupDays ??
      14,

    permissionsMode:
      member
        ?.permissionsMode ||
      "custom",

    permissions:
      Array.isArray(
        member?.permissions
      )
        ? [
            ...member.permissions,
          ]
        : [],
  };
}

/* =========================================================
   PAGE
========================================================= */

export default function StaffPage() {
  const {
    clinicId,
    staffId,
    profile,
  } = useAuth();

  const [
    staff,
    setStaff,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    activeRole,
    setActiveRole,
  ] = useState("all");

  const [
    selectedMember,
    setSelectedMember,
  ] = useState(null);

  const [
    memberModal,
    setMemberModal,
  ] = useState(null);

  const [
    permissionsMember,
    setPermissionsMember,
  ] = useState(null);

  const [
    deleteMemberTarget,
    setDeleteMemberTarget,
  ] = useState(null);

  const [
    loginMember,
    setLoginMember,
  ] = useState(null);

  /* =======================================================
     REALTIME
  ======================================================= */

  useEffect(() => {
    if (!clinicId) {
      setStaff([]);
      setLoading(false);

      return undefined;
    }

    setLoading(true);

    const unsubscribe =
      subscribeClinicStaff(
        clinicId,

        (items) => {
          setStaff(items);

          setLoading(false);

          setSelectedMember(
            (current) => {
              if (!current) {
                return null;
              }

              return (
                items.find(
                  (item) =>
                    item.id ===
                    current.id
                ) || null
              );
            }
          );

          setPermissionsMember(
            (current) => {
              if (!current) {
                return null;
              }

              return (
                items.find(
                  (item) =>
                    item.id ===
                    current.id
                ) || null
              );
            }
          );

          setLoginMember(
            (current) => {
              if (!current) {
                return null;
              }

              return (
                items.find(
                  (item) =>
                    item.id ===
                    current.id
                ) || null
              );
            }
          );
        },

        (firebaseError) => {
          console.error(
            firebaseError
          );

          setError(
            "تعذر تحميل فريق العمل من قاعدة البيانات."
          );

          setLoading(false);
        }
      );

    return unsubscribe;
  }, [clinicId]);

  /* =======================================================
     STATS
  ======================================================= */

  const stats =
    useMemo(
      () =>
        calculateStaffStatistics(
          staff
        ),
      [staff]
    );

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredStaff =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return staff.filter(
        (member) => {
          let roleMatch =
            true;

          if (
            activeRole ===
            "disabled"
          ) {
            roleMatch =
              member.accountStatus ===
              "disabled";
          } else if (
            activeRole !==
            "all"
          ) {
            roleMatch =
              member.role ===
                activeRole &&
              member.accountStatus ===
                "active";
          }

          if (!roleMatch) {
            return false;
          }

          if (!query) {
            return true;
          }

          const haystack = [
            member.name,
            member.phone,
            member.email,
            member.staffCode,
            member.specialty,
            member.customRole,
            member.branch,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(
            query
          );
        }
      );
    }, [
      staff,
      search,
      activeRole,
    ]);

  /* =======================================================
     FEEDBACK
  ======================================================= */

  const showSuccess =
    (message) => {
      setError("");
      setSuccess(message);

      window.setTimeout(
        () => {
          setSuccess("");
        },
        3000
      );
    };

  /* =======================================================
     CREATE
  ======================================================= */

  const openCreate =
    () => {
      setError("");

      setMemberModal({
        mode: "create",

        member: null,

        form: {
          ...EMPTY_MEMBER,

          permissions: [
            ...DEFAULT_STAFF_PERMISSIONS
              .reception,
          ],
        },
      });
    };

  /* =======================================================
     EDIT
  ======================================================= */

  const openEdit =
    (member) => {
      setError("");

      setMemberModal({
        mode: "edit",
        member,
        form:
          memberToForm(
            member
          ),
      });
    };

  /* =======================================================
     SAVE
  ======================================================= */

  const saveMember =
    async (form) => {
      if (
        !clinicId ||
        saving
      ) {
        return;
      }

      try {
        setSaving(true);
        setError("");

        if (
          memberModal?.mode ===
          "edit"
        ) {
          await updateStaffMember({
            clinicId,

            staffId:
              memberModal.member
                .id,

            member: form,

            updatedBy:
              staffId || "",

            updatedByName:
              getProfileName(
                profile
              ),
          });

          showSuccess(
            "تم تحديث بيانات عضو الفريق بنجاح."
          );
        } else {
          await createStaffMember({
            clinicId,

            member: form,

            createdBy:
              staffId || "",

            createdByName:
              getProfileName(
                profile
              ),
          });

          showSuccess(
            "تمت إضافة عضو الفريق بنجاح."
          );
        }

        setMemberModal(
          null
        );
      } catch (saveError) {
        console.error(
          saveError
        );

        setError(
          saveError?.message ||
            "تعذر حفظ بيانات عضو الفريق."
        );
      } finally {
        setSaving(false);
      }
    };

  /* =======================================================
     CREATE LOGIN
  ======================================================= */

  const createLogin =
    async ({
      member,
      email,
      password,
    }) => {
      if (
        !clinicId ||
        !member ||
        saving
      ) {
        return;
      }

      try {
        setSaving(true);
        setError("");

        await createStaffLoginAccount({
          clinicId,

          staffId:
            member.id,

          email,

          password,

          createdBy:
            staffId || "",
        });

        setLoginMember(
          null
        );

        showSuccess(
          `تم إنشاء حساب الدخول لـ ${member.name} بنجاح.`
        );
      } catch (
        loginError
      ) {
        console.error(
          loginError
        );

        setError(
          loginError?.message ||
            "تعذر إنشاء حساب الدخول."
        );

        throw loginError;
      } finally {
        setSaving(false);
      }
    };

  /* =======================================================
     ACCOUNT
  ======================================================= */

  const toggleAccount =
    async (member) => {
      if (
        !clinicId ||
        !member ||
        saving
      ) {
        return;
      }

      const nextStatus =
        member.accountStatus ===
        "active"
          ? "disabled"
          : "active";

      try {
        setSaving(true);
        setError("");

        await setStaffAccountStatus({
          clinicId,

          staffId:
            member.id,

          status:
            nextStatus,

          updatedBy:
            staffId || "",

          updatedByName:
            getProfileName(
              profile
            ),
        });

        showSuccess(
          nextStatus ===
            "active"
            ? "تم تفعيل حساب الموظف."
            : "تم إيقاف حساب الموظف."
        );
      } catch (
        accountError
      ) {
        console.error(
          accountError
        );

        setError(
          accountError?.message ||
            "تعذر تغيير حالة الحساب."
        );
      } finally {
        setSaving(false);
      }
    };

  /* =======================================================
     PERMISSIONS
  ======================================================= */

  const savePermissions =
    async (
      member,
      permissions
    ) => {
      try {
        setSaving(true);
        setError("");

        await updateStaffPermissions({
          clinicId,

          staffId:
            member.id,

          permissions,

          updatedBy:
            staffId || "",

          updatedByName:
            getProfileName(
              profile
            ),
        });

        setPermissionsMember(
          null
        );

        showSuccess(
          "تم حفظ صلاحيات الموظف."
        );
      } catch (
        permissionError
      ) {
        console.error(
          permissionError
        );

        setError(
          permissionError?.message ||
            "تعذر حفظ الصلاحيات."
        );
      } finally {
        setSaving(false);
      }
    };

  /* =======================================================
     DELETE
  ======================================================= */

  const confirmDelete =
    async () => {
      if (
        !deleteMemberTarget
      ) {
        return;
      }

      try {
        setSaving(true);
        setError("");

        await deleteStaffMember({
          clinicId,

          staffId:
            deleteMemberTarget.id,
        });

        setDeleteMemberTarget(
          null
        );

        setSelectedMember(
          null
        );

        showSuccess(
          "تم حذف عضو الفريق وإيقاف وصوله للنظام."
        );
      } catch (
        deleteError
      ) {
        console.error(
          deleteError
        );

        setError(
          deleteError?.message ||
            "تعذر حذف عضو الفريق."
        );
      } finally {
        setSaving(false);
      }
    };

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="staff-page">
      <header className="staff-header">
        <div>
          <span className="staff-eyebrow">
            CLINIC TEAM
          </span>

          <h1>
            فريق العمل
          </h1>

          <p>
            إدارة الأطباء
            والتمريض والاستقبال
            وحسابات الدخول
            والصلاحيات داخل
            العيادة.
          </p>
        </div>

        <button
          className="add-team-member"
          onClick={
            openCreate
          }
        >
          <Plus
            size={17}
          />

          إضافة عضو
        </button>
      </header>

      {(error ||
        success) && (
        <div
          className={`staff-feedback ${
            error
              ? "error"
              : "success"
          }`}
        >
          {error ? (
            <AlertTriangle
              size={17}
            />
          ) : (
            <Check
              size={17}
            />
          )}

          <span>
            {error ||
              success}
          </span>

          <button
            onClick={() => {
              setError("");
              setSuccess("");
            }}
          >
            <X
              size={15}
            />
          </button>
        </div>
      )}

      <section className="team-overview">
        <TeamCount
          active={
            activeRole ===
            "all"
          }
          label="الفريق النشط"
          value={
            stats.active
          }
          icon={
            <Users
              size={18}
            />
          }
          onClick={() =>
            setActiveRole(
              "all"
            )
          }
        />

        <TeamCount
          active={
            activeRole ===
            "doctor"
          }
          label="الأطباء"
          value={
            stats.doctors
          }
          icon={
            <Stethoscope
              size={18}
            />
          }
          onClick={() =>
            setActiveRole(
              "doctor"
            )
          }
        />

        <TeamCount
          active={
            activeRole ===
            "nurse"
          }
          label="التمريض"
          value={
            stats.nurses
          }
          icon={
            <HeartPulse
              size={18}
            />
          }
          onClick={() =>
            setActiveRole(
              "nurse"
            )
          }
        />

        <TeamCount
          active={
            activeRole ===
            "reception"
          }
          label="الريسبشن"
          value={
            stats.reception
          }
          icon={
            <UserRound
              size={18}
            />
          }
          onClick={() =>
            setActiveRole(
              "reception"
            )
          }
        />

        <TeamCount
          active={
            activeRole ===
            "disabled"
          }
          label="حسابات موقوفة"
          value={
            stats.disabled
          }
          icon={
            <LockKeyhole
              size={18}
            />
          }
          onClick={() =>
            setActiveRole(
              "disabled"
            )
          }
        />
      </section>

      <main className="team-workspace">
        <section className="team-directory">
          <div className="team-toolbar">
            <div className="team-toolbar-title">
              <span>
                TEAM DIRECTORY
              </span>

              <strong>
                {activeRole ===
                "all"
                  ? "كل فريق العيادة"
                  : activeRole ===
                      "disabled"
                    ? "الحسابات الموقوفة"
                    : roleDefinitions[
                        activeRole
                      ]?.label}
              </strong>

              <small>
                {
                  filteredStaff.length
                }{" "}
                عضو
              </small>
            </div>

            <div className="team-search">
              <Search
                size={16}
              />

              <input
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event
                      .target
                      .value
                  )
                }
                placeholder="ابحث بالاسم، الهاتف، التخصص..."
              />

              {search && (
                <button
                  onClick={() =>
                    setSearch(
                      ""
                    )
                  }
                >
                  <X
                    size={14}
                  />
                </button>
              )}
            </div>
          </div>

          <div className="team-table-heading">
            <span>
              عضو الفريق
            </span>

            <span>
              الوظيفة
            </span>

            <span>
              الفرع
            </span>

            <span>
              الحساب
            </span>

            <span>
              آخر دخول
            </span>

            <span />
          </div>

          <div className="team-list">
            {loading ? (
              <TeamLoading />
            ) : filteredStaff.length ? (
              filteredStaff.map(
                (member) => (
                  <TeamMemberRow
                    key={
                      member.id
                    }
                    member={
                      member
                    }
                    onOpen={() =>
                      setSelectedMember(
                        member
                      )
                    }
                    onPermissions={() =>
                      setPermissionsMember(
                        member
                      )
                    }
                  />
                )
              )
            ) : (
              <div className="team-empty">
                <Users
                  size={32}
                />

                <strong>
                  لا يوجد أعضاء
                  مطابقون
                </strong>

                <span>
                  جرّب تغيير البحث
                  أو فلتر الوظيفة.
                </span>
              </div>
            )}
          </div>
        </section>

        <aside className="team-side">
          <div className="team-side-heading">
            <span>
              ACCESS STATUS
            </span>

            <strong>
              حسابات الدخول
            </strong>
          </div>

          <div className="presence-number">
            <strong>
              {
                stats.loginAccounts
              }
            </strong>

            <span>
              حساب دخول مرتبط
            </span>
          </div>

          <div className="presence-lines">
            <PresenceLine
              label="حسابات نشطة"
              value={
                stats.active
              }
            />

            <PresenceLine
              label="بدون حساب دخول"
              value={
                stats.pendingLogin
              }
            />

            <PresenceLine
              label="حسابات موقوفة"
              value={
                stats.disabled
              }
            />
          </div>

          <div className="team-side-divider" />

          <div className="team-account-summary">
            <div>
              <span>
                أطباء
              </span>

              <strong>
                {
                  stats.doctors
                }
              </strong>
            </div>

            <div>
              <span>
                تمريض
              </span>

              <strong>
                {
                  stats.nurses
                }
              </strong>
            </div>

            <div>
              <span>
                ريسبشن
              </span>

              <strong>
                {
                  stats.reception
                }
              </strong>
            </div>
          </div>

          <div className="team-side-divider" />

          <div className="security-note">
            <ShieldCheck
              size={20}
            />

            <div>
              <strong>
                صلاحيات منفصلة
                لكل موظف
              </strong>

              <p>
                كل حساب مرتبط
                بنفس العيادة، لكن
                يرى فقط البيانات
                والوظائف المسموح
                بها له.
              </p>
            </div>
          </div>
        </aside>
      </main>

      {selectedMember && (
        <MemberPanel
          member={
            selectedMember
          }
          saving={
            saving
          }
          onClose={() =>
            setSelectedMember(
              null
            )
          }
          onEdit={() =>
            openEdit(
              selectedMember
            )
          }
          onPermissions={() =>
            setPermissionsMember(
              selectedMember
            )
          }
          onCreateLogin={() =>
            setLoginMember(
              selectedMember
            )
          }
          onToggleAccount={() =>
            toggleAccount(
              selectedMember
            )
          }
          onDelete={() =>
            setDeleteMemberTarget(
              selectedMember
            )
          }
        />
      )}

      {memberModal && (
        <MemberModal
          mode={
            memberModal.mode
          }
          initialForm={
            memberModal.form
          }
          saving={
            saving
          }
          onClose={() =>
            setMemberModal(
              null
            )
          }
          onSave={
            saveMember
          }
        />
      )}

      {permissionsMember && (
        <PermissionsPanel
          member={
            permissionsMember
          }
          saving={
            saving
          }
          onClose={() =>
            setPermissionsMember(
              null
            )
          }
          onSave={(
            permissions
          ) =>
            savePermissions(
              permissionsMember,
              permissions
            )
          }
        />
      )}

      {loginMember &&
        !loginMember.authUid && (
          <LoginAccountDialog
            member={
              loginMember
            }
            saving={
              saving
            }
            onClose={() =>
              setLoginMember(
                null
              )
            }
            onCreate={
              createLogin
            }
          />
        )}

      {deleteMemberTarget && (
        <DeleteDialog
          member={
            deleteMemberTarget
          }
          saving={
            saving
          }
          onClose={() =>
            setDeleteMemberTarget(
              null
            )
          }
          onConfirm={
            confirmDelete
          }
        />
      )}
    </div>
  );
}

/* =========================================================
   COUNT
========================================================= */

function TeamCount({
  label,
  value,
  icon,
  active,
  onClick,
}) {
  return (
    <button
      className={`team-count ${
        active
          ? "active"
          : ""
      }`}
      onClick={
        onClick
      }
    >
      <div>
        {icon}
      </div>

      <span>
        <small>
          {label}
        </small>

        <strong>
          {value}
        </strong>
      </span>
    </button>
  );
}

/* =========================================================
   ROW
========================================================= */

function TeamMemberRow({
  member,
  onOpen,
  onPermissions,
}) {
  return (
    <div
      className={`team-member-row ${
        member.accountStatus ===
        "disabled"
          ? "disabled"
          : ""
      }`}
    >
      <button
        className="team-person"
        onClick={
          onOpen
        }
      >
        <div className="team-avatar">
          {getInitials(
            member.name
          )}
        </div>

        <span>
          <strong>
            {member.name}
          </strong>

          <small>
            {member.role ===
            "doctor"
              ? member.specialty ||
                member.staffCode
              : member.staffCode}
          </small>
        </span>
      </button>

      <div className="team-role">
        <strong>
          {getRoleLabel(
            member
          )}
        </strong>

        {member.authUid ? (
          <span>
            دخول مفعل
          </span>
        ) : (
          <span>
            بدون حساب دخول
          </span>
        )}
      </div>

      <div className="team-branch">
        {member.branch ||
          "—"}
      </div>

      <div className="member-presence">
        {member.accountStatus ===
        "disabled" ? (
          <span className="account-disabled">
            موقوف
          </span>
        ) : member.authUid ? (
          <>
            <i
              className={
                member.presenceStatus ===
                "online"
                  ? "online"
                  : ""
              }
            />

            <span>
              {member.presenceStatus ===
              "online"
                ? "متواجد"
                : "نشط"}
            </span>
          </>
        ) : (
          <span>
            غير مرتبط
          </span>
        )}
      </div>

      <div className="member-last-login">
        {formatDateTime(
          member.lastLoginAt
        )}
      </div>

      <div className="member-row-actions">
        <button
          className="permissions-shortcut"
          onClick={
            onPermissions
          }
          title="الصلاحيات"
        >
          <ShieldCheck
            size={15}
          />
        </button>

        <button
          className="open-member"
          onClick={
            onOpen
          }
          title="فتح الملف"
        >
          <ChevronLeft
            size={16}
          />
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   LOADING
========================================================= */

function TeamLoading() {
  return (
    <div className="team-loading">
      <RefreshCw
        size={23}
        className="staff-spin"
      />

      <strong>
        جاري تحميل فريق
        العمل
      </strong>

      <span>
        يتم مزامنة البيانات
        مع العيادة...
      </span>
    </div>
  );
}

/* =========================================================
   PRESENCE
========================================================= */

function PresenceLine({
  label,
  value,
}) {
  return (
    <div className="presence-line">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

/* =========================================================
   MEMBER PANEL
========================================================= */

function MemberPanel({
  member,
  saving,
  onClose,
  onEdit,
  onPermissions,
  onCreateLogin,
  onToggleAccount,
  onDelete,
}) {
  const hasLogin =
    Boolean(
      member.authUid
    );

  return (
    <div className="staff-layer">
      <div
        className="staff-overlay"
        onClick={
          onClose
        }
      />

      <aside className="member-panel">
        <header className="member-panel-header">
          <div>
            <span>
              TEAM MEMBER
            </span>

            <strong>
              ملف عضو الفريق
            </strong>
          </div>

          <button
            onClick={
              onClose
            }
          >
            <X
              size={18}
            />
          </button>
        </header>

        <div className="member-panel-scroll">
          <section className="member-profile-head">
            <div className="large-team-avatar">
              {getInitials(
                member.name
              )}
            </div>

            <div>
              <h2>
                {member.name}
              </h2>

              <p>
                {getRoleLabel(
                  member
                )}

                {member.specialty
                  ? ` • ${member.specialty}`
                  : ""}
              </p>

              <span
                className={
                  member.accountStatus ===
                  "active"
                    ? "member-active"
                    : "member-inactive"
                }
              >
                {member.accountStatus ===
                "active"
                  ? "حساب نشط"
                  : "الحساب موقوف"}
              </span>
            </div>
          </section>

          <div className="member-identity-line">
            <span>
              كود الموظف
            </span>

            <strong>
              {member.staffCode ||
                "—"}
            </strong>
          </div>

          <div className="member-panel-section">
            <span className="member-section-label">
              بيانات التواصل
            </span>

            <PanelInfo
              icon={
                <Phone
                  size={16}
                />
              }
              label="الهاتف"
              value={
                member.phone ||
                "—"
              }
            />

            <PanelInfo
              icon={
                <Mail
                  size={16}
                />
              }
              label="البريد الإلكتروني"
              value={
                member.email ||
                "غير مسجل"
              }
            />

            <PanelInfo
              icon={
                <Activity
                  size={16}
                />
              }
              label="الفرع"
              value={
                member.branch ||
                "الفرع الرئيسي"
              }
            />
          </div>

          {member.role ===
            "doctor" && (
            <>
              <div className="member-panel-section">
                <span className="member-section-label">
                  بيانات الطبيب
                </span>

                <PanelInfo
                  icon={
                    <Stethoscope
                      size={16}
                    />
                  }
                  label="التخصص"
                  value={
                    member.specialty ||
                    "غير محدد"
                  }
                />

                <PanelInfo
                  icon={
                    <FileText
                      size={16}
                    />
                  }
                  label="الدرجة العلمية"
                  value={
                    member.degree ||
                    "غير محددة"
                  }
                />

                <PanelInfo
                  icon={
                    <ShieldCheck
                      size={16}
                    />
                  }
                  label="رقم التسجيل الطبي"
                  value={
                    member.registrationNumber ||
                    "غير مسجل"
                  }
                />

                <PanelInfo
                  icon={
                    <Clock3
                      size={16}
                    />
                  }
                  label="مواعيد العمل"
                  value={
                    member.schedule ||
                    "غير محددة"
                  }
                />
              </div>

              <div className="doctor-pricing-panel">
                <span>
                  PRICING
                </span>

                <div>
                  <small>
                    سعر الكشف
                  </small>

                  <strong>
                    {Number(
                      member.consultationPrice ||
                        0
                    ).toLocaleString(
                      "ar-EG"
                    )}{" "}
                    ج.م
                  </strong>
                </div>

                <div>
                  <small>
                    سعر الإعادة
                  </small>

                  <strong>
                    {Number(
                      member.followupPrice ||
                        0
                    ).toLocaleString(
                      "ar-EG"
                    )}{" "}
                    ج.م
                  </strong>
                </div>

                <div>
                  <small>
                    صلاحية الإعادة
                  </small>

                  <strong>
                    {member.followupDays ||
                      0}{" "}
                    يوم
                  </strong>
                </div>
              </div>
            </>
          )}

          <div className="member-panel-section">
            <div className="member-permission-summary">
              <span>
                <ShieldCheck
                  size={17}
                />

                <b>
                  صلاحيات الحساب
                </b>
              </span>

              <strong>
                {member.permissions
                  ?.length ||
                  0}{" "}
                صلاحية
              </strong>
            </div>

            <button
              className="manage-member-permissions"
              onClick={
                onPermissions
              }
            >
              <Settings2
                size={17}
              />

              إدارة الصلاحيات

              <ChevronLeft
                size={16}
              />
            </button>
          </div>

          <div className="member-login-state">
            <div>
              <span>
                حساب الدخول
              </span>

              <strong>
                {hasLogin
                  ? "مرتبط بالنظام"
                  : "لم يتم إنشاء حساب دخول"}
              </strong>
            </div>

            <div>
              <span>
                آخر دخول
              </span>

              <strong>
                {formatDateTime(
                  member.lastLoginAt
                )}
              </strong>
            </div>
          </div>

          {!hasLogin && (
            <div className="member-panel-section">
              <button
                className="manage-member-permissions"
                onClick={
                  onCreateLogin
                }
              >
                <KeyRound
                  size={17}
                />

                إنشاء حساب دخول

                <ChevronLeft
                  size={16}
                />
              </button>
            </div>
          )}
        </div>

        <footer className="member-panel-footer">
          <button
            className="edit-member"
            onClick={
              onEdit
            }
          >
            <Pencil
              size={16}
            />

            تعديل
          </button>

          <button
            disabled={
              saving
            }
            className={
              member.accountStatus ===
              "active"
                ? "disable-member"
                : "enable-member"
            }
            onClick={
              onToggleAccount
            }
          >
            <LockKeyhole
              size={16}
            />

            {member.accountStatus ===
            "active"
              ? "إيقاف"
              : "تفعيل"}
          </button>

          <button
            disabled={
              saving
            }
            className="delete-member"
            onClick={
              onDelete
            }
          >
            <Trash2
              size={16}
            />
          </button>
        </footer>
      </aside>
    </div>
  );
}

/* =========================================================
   LOGIN ACCOUNT DIALOG
========================================================= */

function LoginAccountDialog({
  member,
  saving,
  onClose,
  onCreate,
}) {
  const [
    email,
    setEmail,
  ] = useState(
    member?.email || ""
  );

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    localError,
    setLocalError,
  ] = useState("");

  const submit =
    async () => {
      setLocalError("");

      const cleanEmail =
        email
          .trim()
          .toLowerCase();

      if (!cleanEmail) {
        setLocalError(
          "اكتب البريد الإلكتروني."
        );

        return;
      }

      if (
        !cleanEmail.includes(
          "@"
        )
      ) {
        setLocalError(
          "البريد الإلكتروني غير صحيح."
        );

        return;
      }

      if (
        password.length < 6
      ) {
        setLocalError(
          "كلمة المرور يجب ألا تقل عن 6 أحرف."
        );

        return;
      }

      if (
        password !==
        confirmPassword
      ) {
        setLocalError(
          "تأكيد كلمة المرور غير مطابق."
        );

        return;
      }

      try {
        await onCreate({
          member,
          email:
            cleanEmail,
          password,
        });
      } catch {
        // Parent handles error.
      }
    };

  return (
    <div className="staff-modal-layer">
      <div
        className="staff-overlay"
        onClick={
          saving
            ? undefined
            : onClose
        }
      />

      <div className="staff-confirm-dialog">
        <div className="staff-danger-icon">
          <KeyRound
            size={23}
          />
        </div>

        <h3>
          إنشاء حساب دخول
        </h3>

        <p>
          سيتم إنشاء حساب لـ{" "}
          <strong>
            {member.name}
          </strong>{" "}
          وربطه بنفس بيانات
          العيادة وصلاحيات
          الوظيفة الحالية.
        </p>

        {localError && (
          <div className="staff-feedback error">
            <AlertTriangle
              size={16}
            />

            <span>
              {localError}
            </span>
          </div>
        )}

        <div className="member-form-grid">
          <StaffField label="البريد الإلكتروني">
            <input
              type="email"
              autoComplete="off"
              value={
                email
              }
              onChange={(
                event
              ) =>
                setEmail(
                  event.target
                    .value
                )
              }
              placeholder="reception@clinic.com"
            />
          </StaffField>

          <StaffField label="كلمة المرور">
            <div
              style={{
                position:
                  "relative",
              }}
            >
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                value={
                  password
                }
                onChange={(
                  event
                ) =>
                  setPassword(
                    event.target
                      .value
                  )
                }
                placeholder="6 أحرف على الأقل"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) =>
                      !current
                  )
                }
                style={{
                  position:
                    "absolute",
                  left: 10,
                  top: "50%",
                  transform:
                    "translateY(-50%)",
                  border: 0,
                  background:
                    "transparent",
                  cursor:
                    "pointer",
                  display:
                    "flex",
                }}
              >
                {showPassword ? (
                  <EyeOff
                    size={17}
                  />
                ) : (
                  <Eye
                    size={17}
                  />
                )}
              </button>
            </div>
          </StaffField>

          <StaffField label="تأكيد كلمة المرور">
            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              autoComplete="new-password"
              value={
                confirmPassword
              }
              onChange={(
                event
              ) =>
                setConfirmPassword(
                  event.target
                    .value
                )
              }
              placeholder="أعد كتابة كلمة المرور"
            />
          </StaffField>
        </div>

        <div>
          <button
            onClick={
              onClose
            }
            disabled={
              saving
            }
          >
            إلغاء
          </button>

          <button
            className="confirm-danger"
            onClick={
              submit
            }
            disabled={
              saving
            }
          >
            {saving ? (
              <>
                <RefreshCw
                  size={15}
                  className="staff-spin"
                />

                جاري إنشاء
                الحساب...
              </>
            ) : (
              <>
                <KeyRound
                  size={15}
                />

                إنشاء الحساب
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   INFO
========================================================= */

function PanelInfo({
  icon,
  label,
  value,
}) {
  return (
    <div className="staff-panel-info">
      <div>
        {icon}
      </div>

      <span>
        <small>
          {label}
        </small>

        <strong>
          {value}
        </strong>
      </span>
    </div>
  );
}

/* =========================================================
   MEMBER MODAL
========================================================= */

function MemberModal({
  mode,
  initialForm,
  saving,
  onClose,
  onSave,
}) {
  const [
    form,
    setForm,
  ] = useState(
    initialForm
  );

  const changeRole =
    (role) => {
      setForm(
        (current) => ({
          ...current,

          role,

          customRole:
            role ===
            "custom"
              ? current.customRole
              : "",

          permissions:
            current.permissionsMode ===
            "role"
              ? [
                  ...(DEFAULT_STAFF_PERMISSIONS[
                    role
                  ] || []),
                ]
              : current.permissions,
        })
      );
    };

  const changePermissionMode =
    (mode) => {
      setForm(
        (current) => ({
          ...current,

          permissionsMode:
            mode,

          permissions:
            mode === "role"
              ? [
                  ...(DEFAULT_STAFF_PERMISSIONS[
                    current
                      .role
                  ] || []),
                ]
              : current.permissions,
        })
      );
    };

  const togglePermission =
    (permission) => {
      setForm(
        (current) => {
          const exists =
            current.permissions.includes(
              permission
            );

          return {
            ...current,

            permissionsMode:
              "custom",

            permissions:
              exists
                ? current.permissions.filter(
                    (
                      item
                    ) =>
                      item !==
                      permission
                  )
                : [
                    ...current.permissions,
                    permission,
                  ],
          };
        }
      );
    };

  return (
    <div className="staff-modal-layer">
      <div
        className="staff-overlay"
        onClick={
          onClose
        }
      />

      <div className="add-member-window">
        <header>
          <div>
            <span>
              {mode ===
              "edit"
                ? "EDIT TEAM MEMBER"
                : "NEW TEAM MEMBER"}
            </span>

            <h2>
              {mode ===
              "edit"
                ? "تعديل عضو الفريق"
                : "إضافة عضو لفريق العيادة"}
            </h2>

            <p>
              بيانات التشغيل
              والوظيفة والصلاحيات.
            </p>
          </div>

          <button
            onClick={
              onClose
            }
          >
            <X
              size={18}
            />
          </button>
        </header>

        <div className="add-member-scroll">
          <section className="member-form-section">
            <FormSectionHeading
              number="01"
              title="البيانات الأساسية"
              text="بيانات الموظف داخل العيادة"
            />

            <div className="member-form-grid">
              <StaffField label="الاسم بالكامل">
                <input
                  value={
                    form.name
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      name:
                        event
                          .target
                          .value,
                    })
                  }
                  placeholder="اسم الموظف"
                />
              </StaffField>

              <StaffField label="رقم الهاتف">
                <input
                  value={
                    form.phone
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      phone:
                        event
                          .target
                          .value,
                    })
                  }
                  placeholder="01xxxxxxxxx"
                />
              </StaffField>

              <StaffField label="البريد الإلكتروني">
                <input
                  type="email"
                  value={
                    form.email
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      email:
                        event
                          .target
                          .value,
                    })
                  }
                  placeholder="name@clinic.com"
                />
              </StaffField>

              <StaffField label="الفرع">
                <input
                  value={
                    form.branch
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      branch:
                        event
                          .target
                          .value,
                    })
                  }
                  placeholder="الفرع الرئيسي"
                />
              </StaffField>
            </div>
          </section>

          <section className="member-form-section">
            <FormSectionHeading
              number="02"
              title="الوظيفة"
              text="حدد دور الموظف داخل النظام"
            />

            <div className="role-selector">
              <RoleOption
                icon={
                  <Stethoscope
                    size={20}
                  />
                }
                title="طبيب"
                text="كشف وروشتات"
                active={
                  form.role ===
                  "doctor"
                }
                onClick={() =>
                  changeRole(
                    "doctor"
                  )
                }
              />

              <RoleOption
                icon={
                  <HeartPulse
                    size={20}
                  />
                }
                title="تمريض"
                text="متابعة وتمريض"
                active={
                  form.role ===
                  "nurse"
                }
                onClick={() =>
                  changeRole(
                    "nurse"
                  )
                }
              />

              <RoleOption
                icon={
                  <Users
                    size={20}
                  />
                }
                title="ريسبشن"
                text="استقبال ومواعيد"
                active={
                  form.role ===
                  "reception"
                }
                onClick={() =>
                  changeRole(
                    "reception"
                  )
                }
              />

              <RoleOption
                icon={
                  <UserCog
                    size={20}
                  />
                }
                title="وظيفة أخرى"
                text="مسمى مخصص"
                active={
                  form.role ===
                  "custom"
                }
                onClick={() =>
                  changeRole(
                    "custom"
                  )
                }
              />
            </div>

            {form.role ===
              "custom" && (
              <div className="custom-role-field">
                <StaffField label="المسمى الوظيفي">
                  <input
                    value={
                      form.customRole
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,

                        customRole:
                          event
                            .target
                            .value,
                      })
                    }
                    placeholder="مدير فرع، محاسب..."
                  />
                </StaffField>
              </div>
            )}
          </section>

          {form.role ===
            "doctor" && (
            <section className="member-form-section">
              <FormSectionHeading
                number="03"
                title="بيانات الطبيب"
                text="بيانات التشغيل والأسعار"
              />

              <div className="member-form-grid">
                <StaffField label="التخصص">
                  <input
                    value={
                      form.specialty
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,

                        specialty:
                          event
                            .target
                            .value,
                      })
                    }
                    placeholder="باطنة عامة"
                  />
                </StaffField>

                <StaffField label="الدرجة العلمية">
                  <input
                    value={
                      form.degree
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,

                        degree:
                          event
                            .target
                            .value,
                      })
                    }
                    placeholder="استشاري / أخصائي"
                  />
                </StaffField>

                <StaffField label="رقم التسجيل الطبي">
                  <input
                    value={
                      form.registrationNumber
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,

                        registrationNumber:
                          event
                            .target
                            .value,
                      })
                    }
                  />
                </StaffField>

                <StaffField label="مواعيد العمل">
                  <input
                    value={
                      form.schedule
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,

                        schedule:
                          event
                            .target
                            .value,
                      })
                    }
                    placeholder="09:00 ص - 05:00 م"
                  />
                </StaffField>
              </div>

              <div className="doctor-price-line">
                <DoctorPriceInput
                  label="سعر الكشف"
                  value={
                    form.consultationPrice
                  }
                  suffix="ج.م"
                  onChange={(
                    value
                  ) =>
                    setForm({
                      ...form,

                      consultationPrice:
                        value,
                    })
                  }
                />

                <DoctorPriceInput
                  label="سعر الإعادة"
                  value={
                    form.followupPrice
                  }
                  suffix="ج.م"
                  onChange={(
                    value
                  ) =>
                    setForm({
                      ...form,

                      followupPrice:
                        value,
                    })
                  }
                />

                <DoctorPriceInput
                  label="صلاحية الإعادة"
                  value={
                    form.followupDays
                  }
                  suffix="يوم"
                  onChange={(
                    value
                  ) =>
                    setForm({
                      ...form,

                      followupDays:
                        value,
                    })
                  }
                />
              </div>
            </section>
          )}

          <section className="member-form-section">
            <FormSectionHeading
              number={
                form.role ===
                "doctor"
                  ? "04"
                  : "03"
              }
              title="صلاحيات الحساب"
              text="حدد مستوى وصول الموظف"
            />

            <div className="permission-mode">
              <button
                className={
                  form.permissionsMode ===
                  "role"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  changePermissionMode(
                    "role"
                  )
                }
              >
                <ShieldCheck
                  size={18}
                />

                <span>
                  <strong>
                    صلاحيات الوظيفة
                  </strong>

                  <small>
                    الصلاحيات الافتراضية
                  </small>
                </span>

                {form.permissionsMode ===
                  "role" && (
                  <Check
                    size={16}
                  />
                )}
              </button>

              <button
                className={
                  form.permissionsMode ===
                  "custom"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  changePermissionMode(
                    "custom"
                  )
                }
              >
                <Settings2
                  size={18}
                />

                <span>
                  <strong>
                    صلاحيات مخصصة
                  </strong>

                  <small>
                    تحكم يدوي كامل
                  </small>
                </span>

                {form.permissionsMode ===
                  "custom" && (
                  <Check
                    size={16}
                  />
                )}
              </button>
            </div>

            {form.permissionsMode ===
              "custom" && (
              <PermissionEditor
                permissions={
                  form.permissions
                }
                onToggle={
                  togglePermission
                }
              />
            )}
          </section>
        </div>

        <footer className="add-member-footer">
          <button
            className="cancel-add-member"
            onClick={
              onClose
            }
            disabled={
              saving
            }
          >
            إلغاء
          </button>

          <button
            className="confirm-add-member"
            disabled={
              saving
            }
            onClick={() =>
              onSave(form)
            }
          >
            {saving ? (
              <RefreshCw
                size={16}
                className="staff-spin"
              />
            ) : mode ===
              "edit" ? (
              <Check
                size={17}
              />
            ) : (
              <Plus
                size={17}
              />
            )}

            {saving
              ? "جاري الحفظ..."
              : mode ===
                  "edit"
                ? "حفظ التعديلات"
                : "إضافة العضو"}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* =========================================================
   PERMISSION EDITOR
========================================================= */

function PermissionEditor({
  permissions,
  onToggle,
}) {
  return (
    <div className="inline-permissions">
      {STAFF_PERMISSION_GROUPS.map(
        (group) => (
          <div
            className="inline-permission-group"
            key={
              group.id
            }
          >
            <div className="inline-permission-heading">
              <strong>
                {group.title}
              </strong>

              <small>
                {
                  group.description
                }
              </small>
            </div>

            <div>
              {group.permissions.map(
                (
                  permission
                ) => (
                  <label
                    key={
                      permission.id
                    }
                    className={
                      permission.sensitive
                        ? "sensitive"
                        : ""
                    }
                  >
                    <input
                      type="checkbox"
                      checked={permissions.includes(
                        permission.id
                      )}
                      onChange={() =>
                        onToggle(
                          permission.id
                        )
                      }
                    />

                    <span>
                      {
                        permission.label
                      }
                    </span>

                    {permission.sensitive && (
                      <small>
                        حساسة
                      </small>
                    )}
                  </label>
                )
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

/* =========================================================
   PERMISSIONS PANEL
========================================================= */

function PermissionsPanel({
  member,
  saving,
  onClose,
  onSave,
}) {
  const [
    permissions,
    setPermissions,
  ] = useState([
    ...(member.permissions ||
      []),
  ]);

  const toggle =
    (permission) => {
      setPermissions(
        (current) =>
          current.includes(
            permission
          )
            ? current.filter(
                (item) =>
                  item !==
                  permission
              )
            : [
                ...current,
                permission,
              ]
      );
    };

  const resetToRole =
    () => {
      setPermissions([
        ...(DEFAULT_STAFF_PERMISSIONS[
          member.role
        ] || []),
      ]);
    };

  return (
    <div className="staff-layer permissions-layer">
      <div
        className="staff-overlay"
        onClick={
          onClose
        }
      />

      <aside className="permissions-panel">
        <header>
          <div>
            <span>
              ACCESS CONTROL
            </span>

            <h2>
              إدارة الصلاحيات
            </h2>

            <p>
              {member.name}
            </p>
          </div>

          <button
            onClick={
              onClose
            }
          >
            <X
              size={18}
            />
          </button>
        </header>

        <div className="permission-role-summary">
          <div className="permission-user-avatar">
            {getInitials(
              member.name
            )}
          </div>

          <span>
            <strong>
              {member.name}
            </strong>

            <small>
              {getRoleLabel(
                member
              )}
            </small>
          </span>

          <button
            onClick={
              resetToRole
            }
          >
            استعادة الافتراضي
          </button>
        </div>

        <div className="permissions-scroll">
          {STAFF_PERMISSION_GROUPS.map(
            (group) => (
              <section
                className="permission-access-group"
                key={
                  group.id
                }
              >
                <div className="access-group-heading">
                  <strong>
                    {
                      group.title
                    }
                  </strong>

                  <span>
                    {
                      group.description
                    }
                  </span>
                </div>

                {group.permissions.map(
                  (
                    permission
                  ) => {
                    const active =
                      permissions.includes(
                        permission.id
                      );

                    return (
                      <div
                        className="access-permission-line"
                        key={
                          permission.id
                        }
                      >
                        <span>
                          <strong>
                            {
                              permission.label
                            }
                          </strong>

                          {permission.sensitive && (
                            <small>
                              صلاحية
                              حساسة
                            </small>
                          )}
                        </span>

                        <button
                          className={`access-switch ${
                            active
                              ? "active"
                              : ""
                          }`}
                          onClick={() =>
                            toggle(
                              permission.id
                            )
                          }
                        >
                          <i />
                        </button>
                      </div>
                    );
                  }
                )}
              </section>
            )
          )}
        </div>

        <footer>
          <span>
            <ShieldCheck
              size={16}
            />

            {
              permissions.length
            }{" "}
            صلاحية مفعلة
          </span>

          <button
            disabled={
              saving
            }
            onClick={() =>
              onSave(
                permissions
              )
            }
          >
            {saving ? (
              <RefreshCw
                size={16}
                className="staff-spin"
              />
            ) : (
              <Check
                size={17}
              />
            )}

            حفظ الصلاحيات
          </button>
        </footer>
      </aside>
    </div>
  );
}

/* =========================================================
   DELETE
========================================================= */

function DeleteDialog({
  member,
  saving,
  onClose,
  onConfirm,
}) {
  return (
    <div className="staff-modal-layer">
      <div
        className="staff-overlay"
        onClick={
          onClose
        }
      />

      <div className="staff-confirm-dialog">
        <div className="staff-danger-icon">
          <Trash2
            size={23}
          />
        </div>

        <h3>
          حذف عضو الفريق؟
        </h3>

        <p>
          سيتم حذف{" "}
          <strong>
            {member.name}
          </strong>{" "}
          من فريق العيادة
          وإيقاف وصول حسابه
          للنظام.
        </p>

        <div>
          <button
            onClick={
              onClose
            }
            disabled={
              saving
            }
          >
            إلغاء
          </button>

          <button
            className="confirm-danger"
            onClick={
              onConfirm
            }
            disabled={
              saving
            }
          >
            {saving
              ? "جاري الحذف..."
              : "حذف العضو"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   FORM HELPERS
========================================================= */

function FormSectionHeading({
  number,
  title,
  text,
}) {
  return (
    <div className="form-section-heading">
      <span>
        {number}
      </span>

      <div>
        <strong>
          {title}
        </strong>

        <small>
          {text}
        </small>
      </div>
    </div>
  );
}

function RoleOption({
  icon,
  title,
  text,
  active,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`role-option ${
        active
          ? "active"
          : ""
      }`}
      onClick={
        onClick
      }
    >
      <div>
        {icon}
      </div>

      <span>
        <strong>
          {title}
        </strong>

        <small>
          {text}
        </small>
      </span>

      <i>
        {active && (
          <Check
            size={13}
          />
        )}
      </i>
    </button>
  );
}

function DoctorPriceInput({
  label,
  value,
  suffix,
  onChange,
}) {
  return (
    <label className="doctor-price-input">
      <span>
        {label}
      </span>

      <div>
        <input
          type="number"
          min="0"
          value={
            value
          }
          onChange={(
            event
          ) =>
            onChange(
              event.target
                .value
            )
          }
        />

        <strong>
          {suffix}
        </strong>
      </div>
    </label>
  );
}

function StaffField({
  label,
  children,
}) {
  return (
    <label className="staff-field">
      <span>
        {label}
      </span>

      {children}
    </label>
  );
}