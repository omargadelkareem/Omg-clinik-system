import {
  NavLink,
} from "react-router-dom";

import {
  Activity,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronsRight,
  ChevronLeft,
  FileText,
  FlaskConical,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  MessageCircle,
  PanelRightClose,
  PanelRightOpen,
  Pill,
  Settings,
  BriefcaseBusiness,
  Stethoscope,
  UserRoundCog,
  Users,
  WalletCards,
} from "lucide-react";

import {
  useAuth,
} from "../context/AuthContext";

/* =========================================================
   NAVIGATION
========================================================= */

const navigation = [
  {
    title: "إدارة العيادة",

    items: [
      {
        label: "الرئيسية",
        icon: LayoutDashboard,
        path: "/",
        publicForStaff: true,
      },

      {
        label: "المواعيد",
        icon: CalendarDays,
        path: "/appointments",

        permissions: [
          "appointments_view",
          "appointments_manage",
        ],
      },

      {
        label: "المرضى",
        icon: Users,
        path: "/patients",

        permissions: [
          "patients_basic",
        ],
      },

      {
        label: "قائمة الانتظار",
        icon: ListOrdered,
        path: "/queue",

        permissions: [
          "queue",
          "checkin",
        ],
      },

      {
        label: "الزيارات",
        icon: Stethoscope,
        path: "/visits",

        permissions: [
          "visits",
          "medical_history",
        ],
      },

      {
  label: "زيارات المندوبين",
  icon: BriefcaseBusiness,
  path: "/representatives",

  permissions: [
    "representatives",
    "representatives_manage",
  ],
},
    ],
  },

  {
    title: "الملف الطبي",

    items: [
      {
        label: "الروشتات",
        icon: FileText,
        path: "/prescriptions",

        permissions: [
          "prescriptions",
        ],
      },

      {
        label: "مكتبة الأدوية",
        icon: Pill,
        path: "/drugs",

        permissions: [
          "drug_library",
        ],
      },

      {
        label: "التحاليل والأشعة",
        icon: FlaskConical,
        path: "/medical-files",

        permissions: [
          "medical_files",
          "medical_files_upload",
        ],
      },

      {
        label: "WhatsApp Inbox",
        icon: MessageCircle,
        path: "/whatsapp",

        permissions: [
          "whatsapp",
          "medical_files",
        ],
      },
    ],
  },

  {
    title: "الإدارة",

    items: [
      {
        label: "المالية",
        icon: WalletCards,
        path: "/finance",

        permissions: [
          "finance",
          "payments",
          "receipts",
        ],
      },

      {
        label: "التقارير",
        icon:
          ChartNoAxesCombined,
        path: "/reports",

        permissions: [
          "reports",
        ],
      },

      {
        label: "فريق العمل",
        icon: UserRoundCog,
        path: "/staff",

        permissions: [
          "staff",
        ],
      },

      {
        label: "الإعدادات",
        icon: Settings,
        path: "/settings",

        permissions: [
          "settings",
        ],
      },
    ],
  },
];

/* =========================================================
   SIDEBAR
========================================================= */

export default function Sidebar({
  isOpen,
  onClose,
  collapsed,
  onToggleCollapse,
}) {
  const {
    clinic,
    displayName,
    roleLabel,
    isOwner,
    hasPermission,
    logout,
  } = useAuth();

  /* =======================================================
     FILTER NAVIGATION
  ======================================================= */

  const visibleNavigation =
    navigation
      .map((section) => ({
        ...section,

        items:
          section.items.filter(
            (item) => {
              if (
                item.publicForStaff
              ) {
                return true;
              }

              if (isOwner) {
                return true;
              }

              return hasPermission(
                ...(item.permissions ||
                  [])
              );
            }
          ),
      }))
      .filter(
        (section) =>
          section.items.length >
          0
      );

  /* =======================================================
     CLINIC NAME
  ======================================================= */

  const clinicName =
    clinic?.nameAr ||
    clinic?.clinicNameAr ||
    clinic?.name ||
    clinic?.clinicName ||
    "عيادة OMG";

  const branchName =
    clinic?.branchName ||
    clinic?.branch ||
    "الفرع الرئيسي";

  /* =======================================================
     USER INITIAL
  ======================================================= */

  const userInitial =
    displayName
      ?.replace("د.", "")
      ?.trim()
      ?.charAt(0) ||
    "م";

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleLogout =
    async () => {
      try {
        await logout();
      } catch (error) {
        console.error(
          "Logout error:",
          error
        );
      }
    };

  return (
    <>
      {isOpen && (
        <button
          className="sidebar-overlay"
          onClick={
            onClose
          }
          aria-label="إغلاق القائمة"
        />
      )}

      <aside
        className={[
          "sidebar",

          isOpen
            ? "sidebar-open"
            : "",

          collapsed
            ? "sidebar-collapsed"
            : "",
        ].join(" ")}
      >
        {/* =========================================
            BRAND
        ========================================= */}

        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <span>O</span>
            <i />
          </div>

          <div className="sidebar-brand-copy">
            <div className="sidebar-brand-name">
              OMG
              <span>
                Clinic
              </span>
            </div>

            <p>
              Clinic OS
            </p>
          </div>

          <button
            className="sidebar-mobile-close"
            onClick={
              onClose
            }
            aria-label="إغلاق القائمة"
          >
            <PanelRightClose
              size={19}
            />
          </button>
        </div>

        {/* =========================================
            CLINIC
        ========================================= */}

        <div className="sidebar-clinic">
          <div className="clinic-avatar">
            <Building2
              size={17}
            />
          </div>

          <div className="clinic-info">
            <strong>
              {clinicName}
            </strong>

            <span>
              <i />
              {branchName}
            </span>
          </div>

          <ChevronLeft
            className="clinic-arrow"
            size={15}
          />

          <span className="sidebar-tooltip">
            {clinicName}
          </span>
        </div>

        {/* =========================================
            NAVIGATION
        ========================================= */}

        <nav className="sidebar-navigation">
          {visibleNavigation.map(
            (section) => (
              <div
                className="nav-section"
                key={
                  section.title
                }
              >
                <div className="nav-section-heading">
                  <span className="nav-section-title">
                    {
                      section.title
                    }
                  </span>

                  <span className="nav-section-line" />
                </div>

                <div className="nav-items">
                  {section.items.map(
                    (item) => {
                      const Icon =
                        item.icon;

                      return (
                        <NavLink
                          key={
                            item.path
                          }
                          to={
                            item.path
                          }
                          end={
                            item.path ===
                            "/"
                          }
                          onClick={
                            onClose
                          }
                          className={({
                            isActive,
                          }) =>
                            [
                              "nav-item",

                              isActive
                                ? "nav-item-active"
                                : "",
                            ].join(
                              " "
                            )
                          }
                        >
                          <span className="nav-active-line" />

                          <span className="nav-icon">
                            <Icon
                              size={
                                18
                              }
                              strokeWidth={
                                1.85
                              }
                            />
                          </span>

                          <span className="nav-label">
                            {
                              item.label
                            }
                          </span>

                          <span className="sidebar-tooltip">
                            {
                              item.label
                            }
                          </span>
                        </NavLink>
                      );
                    }
                  )}
                </div>
              </div>
            )
          )}
        </nav>

        {/* =========================================
            COLLAPSE
        ========================================= */}

        <div className="sidebar-collapse-area">
          <button
            className="sidebar-collapse-button"
            onClick={
              onToggleCollapse
            }
            aria-label={
              collapsed
                ? "توسيع القائمة"
                : "تصغير القائمة"
            }
          >
            <span className="collapse-icon">
              {collapsed ? (
                <PanelRightOpen
                  size={17}
                />
              ) : (
                <ChevronsRight
                  size={17}
                />
              )}
            </span>

            <span className="collapse-label">
              تصغير القائمة
            </span>

            <span className="sidebar-tooltip">
              {collapsed
                ? "توسيع القائمة"
                : "تصغير القائمة"}
            </span>
          </button>
        </div>

        {/* =========================================
            CURRENT USER
        ========================================= */}

        <div className="sidebar-footer">
          <div className="doctor-card">
            <div className="doctor-avatar">
              {userInitial}

              <span className="doctor-online" />
            </div>

            <div className="doctor-info">
              <strong>
                {displayName}
              </strong>

              <span>
                <Activity
                  size={11}
                />

                {roleLabel}
              </span>
            </div>

            <button
              className="doctor-logout"
              onClick={
                handleLogout
              }
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج"
            >
              <LogOut
                size={16}
              />
            </button>

            <span className="sidebar-tooltip">
              {displayName}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}