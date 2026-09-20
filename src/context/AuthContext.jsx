import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  get,
  onValue,
  ref,
} from "firebase/database";

import {
  auth,
  database,
} from "../config/firebase";

import {
  loginWithEmail,
  logoutUser,
} from "../services/authService";

const AuthContext =
  createContext(null);

/* =========================================================
   HELPERS
========================================================= */

function normalizePermissions(
  value
) {
  if (Array.isArray(value)) {
    return value;
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.entries(value)
      .filter(([, enabled]) =>
        Boolean(enabled)
      )
      .map(([permission]) =>
        permission
      );
  }

  return [];
}

function getProfileName(
  profile,
  staff
) {
  return (
    staff?.name ||
    staff?.fullName ||
    profile?.name ||
    profile?.fullName ||
    profile?.displayName ||
    ""
  );
}

/* =========================================================
   PROVIDER
========================================================= */

export function AuthProvider({
  children,
}) {
  const [
    firebaseUser,
    setFirebaseUser,
  ] = useState(null);

  const [
    profile,
    setProfile,
  ] = useState(null);

  const [
    clinic,
    setClinic,
  ] = useState(null);

  const [
    staff,
    setStaff,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    authError,
    setAuthError,
  ] = useState("");

  useEffect(() => {
    let unsubscribeProfile =
      null;

    let unsubscribeClinic =
      null;

    let unsubscribeStaff =
      null;

    let currentUid = null;

    let currentClinicId =
      null;

    let currentStaffId =
      null;

    let signingOut = false;

    const cleanupRealtime =
      () => {
        unsubscribeProfile?.();
        unsubscribeClinic?.();
        unsubscribeStaff?.();

        unsubscribeProfile =
          null;

        unsubscribeClinic =
          null;

        unsubscribeStaff =
          null;
      };

    const forceLogout =
      async (
        message = ""
      ) => {
        if (signingOut) {
          return;
        }

        signingOut = true;

        cleanupRealtime();

        setAuthError(message);

        setFirebaseUser(null);
        setProfile(null);
        setClinic(null);
        setStaff(null);

        try {
          await logoutUser();
        } catch (error) {
          console.error(
            "Force logout error:",
            error
          );
        } finally {
          setLoading(false);
          signingOut = false;
        }
      };

    const subscribeClinic =
      (clinicId) => {
        unsubscribeClinic?.();

        const clinicRef = ref(
          database,
          `clinics/${clinicId}/profile`
        );

        unsubscribeClinic =
          onValue(
            clinicRef,

            (snapshot) => {
              setClinic({
                id: clinicId,
                ...(snapshot.exists()
                  ? snapshot.val()
                  : {}),
              });

              setLoading(false);
            },

            (error) => {
              console.error(
                "Clinic realtime error:",
                error
              );

              setClinic({
                id: clinicId,
              });

              setLoading(false);
            }
          );
      };

    const subscribeStaff =
      (
        clinicId,
        staffId
      ) => {
        unsubscribeStaff?.();

        if (!staffId) {
          setStaff(null);
          return;
        }

        const staffRef = ref(
          database,
          `clinics/${clinicId}/staff/${staffId}`
        );

        unsubscribeStaff =
          onValue(
            staffRef,

            async (
              snapshot
            ) => {
              if (
                !snapshot.exists()
              ) {
                await forceLogout(
                  "لم يعد حساب الموظف موجوداً."
                );

                return;
              }

              const data =
                snapshot.val();

              if (
                data.status ===
                  "inactive" ||
                data.status ===
                  "disabled" ||
                data.accountStatus ===
                  "disabled" ||
                data.loginEnabled ===
                  false
              ) {
                await forceLogout(
                  "تم إيقاف حسابك من إدارة العيادة."
                );

                return;
              }

              setStaff({
                id: staffId,
                ...data,
              });
            },

            (error) => {
              console.error(
                "Staff realtime error:",
                error
              );
            }
          );
      };

    const unsubscribeAuth =
      onAuthStateChanged(
        auth,

        async (user) => {
          cleanupRealtime();

          currentUid =
            user?.uid || null;

          currentClinicId =
            null;

          currentStaffId =
            null;

          if (!user) {
            setFirebaseUser(
              null
            );

            setProfile(null);
            setClinic(null);
            setStaff(null);
            setLoading(false);

            return;
          }

          try {
            setLoading(true);
            setAuthError("");

            /* =====================================
               INITIAL PROFILE
            ===================================== */

            const userRef = ref(
              database,
              `users/${user.uid}`
            );

            const snapshot =
              await get(userRef);

            if (
              !snapshot.exists()
            ) {
              await forceLogout(
                "هذا الحساب غير مرتبط بعيادة."
              );

              return;
            }

            const data =
              snapshot.val();

            if (
              data.status !==
                "active" ||
              !data.clinicId
            ) {
              await forceLogout(
                "هذا الحساب غير نشط."
              );

              return;
            }

            currentClinicId =
              data.clinicId;

            currentStaffId =
              data.staffId ||
              null;

            setFirebaseUser(
              user
            );

            setProfile(data);

            /* =====================================
               CLINIC
            ===================================== */

            subscribeClinic(
              data.clinicId
            );

            /* =====================================
               STAFF
            ===================================== */

            if (data.staffId) {
              subscribeStaff(
                data.clinicId,
                data.staffId
              );
            } else {
              setStaff(null);
            }

            /* =====================================
               REALTIME USER PROFILE
            ===================================== */

            unsubscribeProfile =
              onValue(
                userRef,

                async (
                  profileSnapshot
                ) => {
                  if (
                    !profileSnapshot.exists()
                  ) {
                    await forceLogout(
                      "لم يعد الحساب موجوداً."
                    );

                    return;
                  }

                  const nextProfile =
                    profileSnapshot.val();

                  if (
                    nextProfile.status !==
                      "active" ||
                    !nextProfile.clinicId
                  ) {
                    await forceLogout(
                      "تم إيقاف الحساب."
                    );

                    return;
                  }

                  setProfile(
                    nextProfile
                  );

                  /*
                   * لو تم نقل الحساب لعيادة أخرى
                   * أو تغير staffId نعيد listeners.
                   */

                  if (
                    nextProfile.clinicId !==
                    currentClinicId
                  ) {
                    currentClinicId =
                      nextProfile.clinicId;

                    subscribeClinic(
                      nextProfile.clinicId
                    );
                  }

                  if (
                    nextProfile.staffId !==
                    currentStaffId
                  ) {
                    currentStaffId =
                      nextProfile.staffId ||
                      null;

                    if (
                      nextProfile.staffId
                    ) {
                      subscribeStaff(
                        nextProfile.clinicId,
                        nextProfile.staffId
                      );
                    } else {
                      unsubscribeStaff?.();
                      unsubscribeStaff =
                        null;

                      setStaff(null);
                    }
                  }
                },

                (error) => {
                  console.error(
                    "User realtime error:",
                    error
                  );
                }
              );
          } catch (error) {
            console.error(
              "Auth initialization error:",
              error
            );

            await forceLogout(
              "تعذر تجهيز حساب المستخدم."
            );
          }
        }
      );

    return () => {
      unsubscribeAuth();
      cleanupRealtime();
    };
  }, []);

  /* =======================================================
     LOGIN
  ======================================================= */

  const login = useCallback(
    async (
      email,
      password
    ) => {
      setAuthError("");

      return loginWithEmail(
        email,
        password
      );
    },
    []
  );

  /* =======================================================
     LOGOUT
  ======================================================= */

  const logout =
    useCallback(async () => {
      setAuthError("");

      await logoutUser();
    }, []);

  /* =======================================================
     ROLE
  ======================================================= */

  const hasRole =
    useCallback(
      (...roles) => {
        if (!profile) {
          return false;
        }

        return roles.includes(
          profile.role
        );
      },
      [profile]
    );

  /* =======================================================
     PERMISSIONS
  ======================================================= */

  const permissions =
    useMemo(() => {
      /*
       * Owner لا يحتاج قائمة permissions.
       * hasPermission سيرجعه true دائماً.
       */

      const source =
        staff?.permissions ??
        profile?.permissions;

      return normalizePermissions(
        source
      );
    }, [
      staff,
      profile,
    ]);

  const hasPermission =
    useCallback(
      (...requiredPermissions) => {
        if (!profile) {
          return false;
        }

        if (
          profile.role ===
          "owner"
        ) {
          return true;
        }

        if (
          requiredPermissions.length ===
          0
        ) {
          return true;
        }

        return requiredPermissions.some(
          (permission) =>
            permissions.includes(
              permission
            )
        );
      },
      [
        profile,
        permissions,
      ]
    );

  const hasAllPermissions =
    useCallback(
      (...requiredPermissions) => {
        if (!profile) {
          return false;
        }

        if (
          profile.role ===
          "owner"
        ) {
          return true;
        }

        return requiredPermissions.every(
          (permission) =>
            permissions.includes(
              permission
            )
        );
      },
      [
        profile,
        permissions,
      ]
    );

  /* =======================================================
     USER DISPLAY DATA
  ======================================================= */

  const displayName =
    useMemo(
      () =>
        getProfileName(
          profile,
          staff
        ) ||
        firebaseUser?.email ||
        "مستخدم OMG Clinic",
      [
        profile,
        staff,
        firebaseUser,
      ]
    );

  const role =
    profile?.role ||
    staff?.role ||
    null;

  const roleLabel =
    useMemo(() => {
      switch (role) {
        case "owner":
          return "مالك العيادة";

        case "doctor":
          return "طبيب";

        case "nurse":
          return "تمريض";

        case "reception":
          return "ريسبشن";

        case "custom":
          return (
            staff?.jobTitle ||
            "موظف"
          );

        default:
          return "مستخدم";
      }
    }, [
      role,
      staff,
    ]);

  /* =======================================================
     CONTEXT
  ======================================================= */

  const value = useMemo(
    () => ({
      firebaseUser,

      profile,

      clinic,

      staff,

      clinicId:
        profile?.clinicId ||
        null,

      staffId:
        profile?.staffId ||
        null,

      role,

      roleLabel,

      displayName,

      permissions,

      loading,

      authError,

      isAuthenticated:
        Boolean(
          firebaseUser &&
            profile
        ),

      isOwner:
        role === "owner",

      isDoctor:
        role === "doctor" ||
        role === "owner",

      isReception:
        role ===
        "reception",

      isNurse:
        role === "nurse",

      login,

      logout,

      hasRole,

      hasPermission,

      hasAllPermissions,
    }),

    [
      firebaseUser,
      profile,
      clinic,
      staff,
      role,
      roleLabel,
      displayName,
      permissions,
      loading,
      authError,
      login,
      logout,
      hasRole,
      hasPermission,
      hasAllPermissions,
    ]
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* =========================================================
   HOOK
========================================================= */

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}