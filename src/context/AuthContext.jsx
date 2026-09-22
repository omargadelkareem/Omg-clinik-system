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

import {
  getSpecialtyById,
} from "../config/specialties";

import {
  getSpecialtyConfig,
} from "../specialties/specialtyEngine";

/* =========================================================
   CONTEXT
========================================================= */

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

function normalizeSpecialties(
  value
) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (
    typeof value === "object"
  ) {
    return Object.entries(value)
      .filter(([, enabled]) =>
        Boolean(enabled)
      )
      .map(([specialty]) =>
        specialty
      );
  }

  if (
    typeof value === "string"
  ) {
    return value
      ? [value]
      : [];
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

function resolveSpecialtyId({
  staff,
  profile,
  clinic,
}) {
  /*
   * الأولوية:
   *
   * 1. تخصص الموظف/الطبيب
   * 2. تخصص User Profile
   * 3. تخصص العيادة
   * 4. fallback
   */

  return (
    staff?.primarySpecialty ||
    profile?.primarySpecialty ||
    clinic?.primarySpecialty ||
    "general_practice"
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

  /* =======================================================
     AUTH + REALTIME DATA
  ======================================================= */

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

    /* =====================================================
       CLEANUP
    ===================================================== */

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

    /* =====================================================
       FORCE LOGOUT
    ===================================================== */

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

    /* =====================================================
       CLINIC SUBSCRIPTION
    ===================================================== */

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

    /* =====================================================
       STAFF SUBSCRIPTION
    ===================================================== */

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

    /* =====================================================
       FIREBASE AUTH
    ===================================================== */

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
               INITIAL USER PROFILE
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
    useCallback(
      async () => {
        setAuthError("");

        await logoutUser();
      },
      []
    );

  /* =======================================================
     ROLE
  ======================================================= */

  const role =
    profile?.role ||
    staff?.role ||
    null;

  const hasRole =
    useCallback(
      (...roles) => {
        if (!profile) {
          return false;
        }

        return roles.includes(
          role
        );
      },
      [
        profile,
        role,
      ]
    );

  /* =======================================================
     PERMISSIONS
  ======================================================= */

  const permissions =
    useMemo(() => {
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
      (
        ...requiredPermissions
      ) => {
        if (!profile) {
          return false;
        }

        if (
          role === "owner"
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
        role,
        permissions,
      ]
    );

  const hasAllPermissions =
    useCallback(
      (
        ...requiredPermissions
      ) => {
        if (!profile) {
          return false;
        }

        if (
          role === "owner"
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
        role,
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
     FACILITY
  ======================================================= */

  const facilityType =
    clinic?.facilityType ||
    "single_doctor";

  const facilityTypeName =
    clinic?.facilityTypeName ||
    "";

  const isMultiSpecialty =
    Boolean(
      clinic?.multiSpecialty ||
        facilityType ===
          "multi_doctor" ||
        facilityType ===
          "medical_center"
    );

  const setupCompleted =
    clinic?.setupCompleted !==
    false;

  /* =======================================================
     SPECIALTY ENGINE
  ======================================================= */

  /*
   * تخصص العيادة الأساسي.
   *
   * العيادات القديمة التي لم تسجل تخصصًا بعد
   * تحصل مؤقتًا على general_practice.
   */

  const clinicSpecialty =
    clinic?.primarySpecialty ||
    "general_practice";

  const clinicSpecialtyData =
    useMemo(
      () =>
        getSpecialtyById(
          clinicSpecialty
        ) ||
        getSpecialtyById(
          "general_practice"
        ),
      [clinicSpecialty]
    );

  /*
   * التخصص الفعلي للمستخدم الحالي.
   *
   * في مركز متعدد التخصصات:
   *
   * دكتور الأطفال -> pediatrics
   * دكتور القلب -> cardiology
   *
   * بينما الريسبشن/الإدارة يمكن أن يعتمد
   * على التخصص الرئيسي للعيادة.
   */

  const activeSpecialty =
    useMemo(
      () =>
        resolveSpecialtyId({
          staff,
          profile,
          clinic,
        }),
      [
        staff,
        profile,
        clinic,
      ]
    );

  const activeSpecialtyData =
    useMemo(
      () =>
        getSpecialtyById(
          activeSpecialty
        ) ||
        getSpecialtyById(
          "general_practice"
        ),
      [activeSpecialty]
    );

  const specialtyConfig =
    useMemo(
      () =>
        getSpecialtyConfig(
          activeSpecialty
        ),
      [activeSpecialty]
    );

  /*
   * تخصصات الطبيب/الموظف المسجلة.
   */

  const staffSpecialties =
    useMemo(() => {
      const specialties =
        normalizeSpecialties(
          staff?.specialties
        );

      if (
        staff?.primarySpecialty &&
        !specialties.includes(
          staff.primarySpecialty
        )
      ) {
        return [
          staff.primarySpecialty,
          ...specialties,
        ];
      }

      return specialties;
    }, [staff]);

  const staffSpecialtyData =
    useMemo(
      () =>
        staffSpecialties
          .map(
            (specialtyId) =>
              getSpecialtyById(
                specialtyId
              )
          )
          .filter(Boolean),
      [staffSpecialties]
    );

  /*
   * Helper سريع:
   *
   * hasSpecialtyFeature("dentalChart")
   * hasSpecialtyFeature("growthCharts")
   */

  const hasSpecialtyFeature =
    useCallback(
      (feature) =>
        Boolean(
          specialtyConfig
            ?.features?.[
            feature
          ]
        ),
      [specialtyConfig]
    );

  /*
   * Helper للموديولات:
   *
   * hasSpecialtyModule("labs")
   * hasSpecialtyModule("radiology")
   */

  const hasSpecialtyModule =
    useCallback(
      (module) =>
        Boolean(
          specialtyConfig
            ?.modules?.[
            module
          ]
        ),
      [specialtyConfig]
    );

  /* =======================================================
     CONTEXT VALUE
  ======================================================= */

  const value = useMemo(
    () => ({
      /* =====================================
         AUTH
      ===================================== */

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

      /* =====================================
         ROLE
      ===================================== */

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

      /* =====================================
         FACILITY
      ===================================== */

      facilityType,

      facilityTypeName,

      isMultiSpecialty,

      setupCompleted,

      /* =====================================
         CLINIC SPECIALTY
      ===================================== */

      clinicSpecialty,

      clinicSpecialtyData,

      /* =====================================
         ACTIVE SPECIALTY
      ===================================== */

      activeSpecialty,

      activeSpecialtyData,

      /*
       * Alias مفيد:
       *
       * doctorSpecialty هو نفس activeSpecialty
       * للطبيب الحالي.
       */

      doctorSpecialty:
        activeSpecialty,

      doctorSpecialtyData:
        activeSpecialtyData,

      /* =====================================
         SPECIALTY ENGINE
      ===================================== */

      specialtyConfig,

      staffSpecialties,

      staffSpecialtyData,

      hasSpecialtyFeature,

      hasSpecialtyModule,

      /* =====================================
         ACTIONS
      ===================================== */

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

      facilityType,
      facilityTypeName,
      isMultiSpecialty,
      setupCompleted,

      clinicSpecialty,
      clinicSpecialtyData,

      activeSpecialty,
      activeSpecialtyData,

      specialtyConfig,

      staffSpecialties,
      staffSpecialtyData,

      hasSpecialtyFeature,
      hasSpecialtyModule,

      login,
      logout,

      hasRole,
      hasPermission,
      hasAllPermissions,
    ]
  );

  /* =======================================================
     PROVIDER
  ======================================================= */

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