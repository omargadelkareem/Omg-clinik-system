import {
  Navigate,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";

export default function ProtectedRoute({
  children,
  roles = [],
  permissions = [],
  requireAllPermissions = false,
}) {
  const {
    loading,
    isAuthenticated,
    hasRole,
    hasPermission,
    hasAllPermissions,
  } = useAuth();

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-logo">
          OMG
        </div>

        <strong>
          OMG Clinic
        </strong>

        <span>
          جاري تجهيز العيادة...
        </span>
      </div>
    );
  }

  /* =======================================================
     NOT AUTHENTICATED
  ======================================================= */

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  /* =======================================================
     ROLE CHECK
  ======================================================= */

  if (
    roles.length > 0 &&
    !hasRole(...roles)
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  /* =======================================================
     PERMISSION CHECK
  ======================================================= */

  if (
    permissions.length > 0
  ) {
    const allowed =
      requireAllPermissions
        ? hasAllPermissions(
            ...permissions
          )
        : hasPermission(
            ...permissions
          );

    if (!allowed) {
      return (
        <Navigate
          to="/"
          replace
        />
      );
    }
  }

  return children;
}