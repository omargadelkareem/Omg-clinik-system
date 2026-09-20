import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";

import "./layout.css";

import Sidebar from "./Sidebar";
import Header from "./Header";

/* =========================================================
   ROUTE ACCESS
========================================================= */

const routePermissions = [
  {
    path: "/appointments",
    permissions: [
      "appointments_view",
      "appointments_manage",
    ],
  },

  {
    path: "/patients",
    permissions: [
      "patients_basic",
    ],
  },

  {
    path: "/queue",
    permissions: [
      "queue",
      "checkin",
    ],
  },

  {
    path: "/visits",
    permissions: [
      "visits",
      "medical_history",
    ],
  },

  {
    path: "/prescriptions",
    permissions: [
      "prescriptions",
    ],
  },

  {
    path: "/drugs",
    permissions: [
      "drug_library",
    ],
  },

  {
    path: "/medical-files",
    permissions: [
      "medical_files",
      "medical_files_upload",
    ],
  },

  {
    path: "/whatsapp",
    permissions: [
      "whatsapp",
      "medical_files",
    ],
  },

  {
    path: "/finance",
    permissions: [
      "finance",
      "payments",
      "receipts",
    ],
  },

  {
    path: "/reports",
    permissions: [
      "reports",
    ],
  },

  {
    path: "/staff",
    permissions: [
      "staff",
    ],
  },

  {
    path: "/settings",
    permissions: [
      "settings",
    ],
  },
];

function getRouteRule(
  pathname
) {
  return routePermissions.find(
    (item) =>
      pathname === item.path ||
      pathname.startsWith(
        `${item.path}/`
      )
  );
}

export default function MainLayout() {
  const location =
    useLocation();

  const {
    isOwner,
    hasPermission,
  } = useAuth();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] = useState(() => {
    try {
      return (
        localStorage.getItem(
          "omg-sidebar-collapsed"
        ) === "true"
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        "omg-sidebar-collapsed",
        String(
          sidebarCollapsed
        )
      );
    } catch {
      // localStorage unavailable
    }
  }, [
    sidebarCollapsed,
  ]);

  const handleToggleCollapse =
    () => {
      setSidebarCollapsed(
        (current) =>
          !current
      );
    };

  /* =======================================================
     ROUTE ACCESS
  ======================================================= */

  const routeAllowed =
    useMemo(() => {
      if (isOwner) {
        return true;
      }

      /*
       * Dashboard متاح لكل مستخدم نشط.
       */

      if (
        location.pathname ===
        "/"
      ) {
        return true;
      }

      /*
       * صفحة المريض:
       * /patients/:patientId
       */

      if (
        location.pathname.startsWith(
          "/patients/"
        )
      ) {
        return hasPermission(
          "patients_basic",
          "medical_history",
          "visits"
        );
      }

      const rule =
        getRouteRule(
          location.pathname
        );

      if (!rule) {
        return true;
      }

      return hasPermission(
        ...rule.permissions
      );
    }, [
      location.pathname,
      isOwner,
      hasPermission,
    ]);

  if (!routeAllowed) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return (
    <div
      className={[
        "app-shell",

        sidebarCollapsed
          ? "app-shell-sidebar-collapsed"
          : "",
      ].join(" ")}
      dir="rtl"
    >
      <Sidebar
        isOpen={
          sidebarOpen
        }
        onClose={() =>
          setSidebarOpen(
            false
          )
        }
        collapsed={
          sidebarCollapsed
        }
        onToggleCollapse={
          handleToggleCollapse
        }
      />

      <div className="app-main">
        <Header
          onMenuClick={() =>
            setSidebarOpen(
              true
            )
          }
        />

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}