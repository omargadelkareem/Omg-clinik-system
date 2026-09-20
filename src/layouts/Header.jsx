import {
  Bell,
  CalendarPlus,
  Menu,
  Search,
  HelpCircle,
  ChevronDown,
  UserRound,
  Settings,
  LogOut,
  Users,
  X,
  Loader2,
  Phone,
  FileText,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  get,
  onValue,
  ref,
} from "firebase/database";

import {
  signOut,
} from "firebase/auth";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  auth,
  database,
} from "../config/firebase";

/* =========================================================
   HELPERS
========================================================= */

function clean(value) {
  return String(value ?? "").trim();
}

function getInitials(name) {
  const value = clean(name);

  if (!value) return "U";

  const words = value
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${words[0][0] || ""}${
    words[1][0] || ""
  }`.toUpperCase();
}

function normalizeCollection(value) {
  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).map(
    ([id, item]) => ({
      id,
      ...(item || {}),
    })
  );
}

function formatRole(role) {
  const roles = {
    owner: "مالك العيادة",
    doctor: "طبيب",
    receptionist: "الاستقبال",
    reception: "الاستقبال",
    nurse: "تمريض",
    accountant: "محاسب",
    admin: "مدير النظام",
  };

  return roles[role] || "مستخدم";
}

/* =========================================================
   COMPONENT
========================================================= */

export default function Header({
  onMenuClick,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const searchRef = useRef(null);
  const profileRef = useRef(null);
  const notificationRef = useRef(null);

  /* =======================================================
     USER / CLINIC
  ======================================================= */

  const [loadingProfile, setLoadingProfile] =
    useState(true);

  const [profile, setProfile] = useState({
    uid: "",
    clinicId: "",
    staffId: "",
    role: "",
    name: "",
    email: "",
    clinicName: "",
  });

  /* =======================================================
     SEARCH
  ======================================================= */

  const [patients, setPatients] = useState([]);

  const [searchValue, setSearchValue] =
    useState("");

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [searchLoading, setSearchLoading] =
    useState(false);

  /* =======================================================
     PROFILE
  ======================================================= */

  const [profileOpen, setProfileOpen] =
    useState(false);

  /* =======================================================
     NOTIFICATIONS
  ======================================================= */

  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [notifications, setNotifications] =
    useState([]);

  /* =======================================================
     AUTH / PROFILE
  ======================================================= */

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      setLoadingProfile(false);
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      setLoadingProfile(true);

      try {
        const userSnapshot = await get(
          ref(
            database,
            `users/${user.uid}`
          )
        );

        if (!userSnapshot.exists()) {
          throw new Error(
            "User record not found"
          );
        }

        const userData =
          userSnapshot.val() || {};

        let clinicId =
          clean(userData.clinicId);

        let staffId =
          clean(userData.staffId);

        let role =
          clean(userData.role);

        /*
         * Fallback لو الحساب مربوط عن طريق userClinics
         */
        if (!clinicId) {
          const userClinicsSnapshot =
            await get(
              ref(
                database,
                `userClinics/${user.uid}`
              )
            );

          if (
            userClinicsSnapshot.exists()
          ) {
            const userClinics =
              userClinicsSnapshot.val() ||
              {};

            const firstClinicId =
              Object.keys(
                userClinics
              )[0];

            if (firstClinicId) {
              clinicId =
                firstClinicId;

              const relation =
                userClinics[
                  firstClinicId
                ] || {};

              staffId =
                staffId ||
                clean(
                  relation.staffId
                );

              role =
                role ||
                clean(
                  relation.role
                );
            }
          }
        }

        if (!clinicId) {
          throw new Error(
            "Clinic not found"
          );
        }

        const [
          clinicSnapshot,
          staffSnapshot,
        ] = await Promise.all([
          get(
            ref(
              database,
              `clinics/${clinicId}/profile`
            )
          ),

          staffId
            ? get(
                ref(
                  database,
                  `clinics/${clinicId}/staff/${staffId}`
                )
              )
            : Promise.resolve(null),
        ]);

        const clinicData =
          clinicSnapshot?.exists()
            ? clinicSnapshot.val() ||
              {}
            : {};

        const staffData =
          staffSnapshot?.exists?.()
            ? staffSnapshot.val() ||
              {}
            : {};

        if (cancelled) return;

        setProfile({
          uid: user.uid,

          clinicId,

          staffId,

          role:
            role ||
            staffData.role ||
            "",

          name:
            clean(
              staffData.name ||
                staffData.fullName ||
                userData.name ||
                userData.fullName ||
                user.displayName
            ) ||
            "مستخدم OMG",

          email:
            clean(
              staffData.email ||
                userData.email ||
                user.email
            ),

          clinicName:
            clean(
              clinicData.name ||
                clinicData.clinicName
            ) ||
            "OMG Clinic",
        });
      } catch (error) {
        console.error(
          "Header profile error:",
          error
        );

        if (!cancelled) {
          setProfile({
            uid: user.uid,

            clinicId: "",

            staffId: "",

            role: "",

            name:
              user.displayName ||
              "مستخدم OMG",

            email:
              user.email || "",

            clinicName:
              "OMG Clinic",
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =======================================================
     PATIENTS REALTIME
  ======================================================= */

  useEffect(() => {
    if (!profile.clinicId) {
      setPatients([]);
      return undefined;
    }

    setSearchLoading(true);

    const patientsRef = ref(
      database,
      `clinics/${profile.clinicId}/patients`
    );

    const unsubscribe = onValue(
      patientsRef,

      (snapshot) => {
        const list =
          normalizeCollection(
            snapshot.val()
          )
            .filter(
              (patient) =>
                patient.archived !==
                true
            )
            .sort((a, b) =>
              clean(a.name).localeCompare(
                clean(b.name),
                "ar"
              )
            );

        setPatients(list);
        setSearchLoading(false);
      },

      (error) => {
        console.error(
          "Header patients error:",
          error
        );

        setPatients([]);
        setSearchLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile.clinicId]);

  /* =======================================================
     NOTIFICATIONS
  ======================================================= */

  useEffect(() => {
    if (!profile.clinicId) {
      setNotifications([]);
      return undefined;
    }

    /*
     * هنا بنستخدم appointments الحالية كإشعارات تشغيلية
     * بدل نقطة Notification وهمية.
     */

    const appointmentsRef = ref(
      database,
      `clinics/${profile.clinicId}/appointments`
    );

    const unsubscribe = onValue(
      appointmentsRef,

      (snapshot) => {
        const appointments =
          normalizeCollection(
            snapshot.val()
          );

        const today =
          new Date()
            .toISOString()
            .slice(0, 10);

        const todayAppointments =
          appointments
            .filter(
              (appointment) =>
                clean(
                  appointment.date
                ) === today &&
                ![
                  "cancelled",
                  "canceled",
                  "completed",
                ].includes(
                  clean(
                    appointment.status
                  ).toLowerCase()
                )
            )
            .sort((a, b) =>
              clean(a.time).localeCompare(
                clean(b.time)
              )
            )
            .slice(0, 6)
            .map(
              (appointment) => ({
                id:
                  appointment.id,

                type: "appointment",

                title:
                  appointment.patientName ||
                  "موعد جديد",

                description: `${
                  appointment.time ||
                  "بدون وقت"
                } • ${
                  appointment.type ||
                  "كشف"
                }`,

                appointment,
              })
            );

        setNotifications(
          todayAppointments
        );
      },

      (error) => {
        console.error(
          "Header notifications error:",
          error
        );
      }
    );

    return () => unsubscribe();
  }, [profile.clinicId]);

  /* =======================================================
     SEARCH RESULTS
  ======================================================= */

  const searchResults = useMemo(() => {
    const query =
      searchValue
        .trim()
        .toLowerCase();

    if (!query) {
      return [];
    }

    return patients
      .filter((patient) => {
        const values = [
          patient.name,
          patient.fullName,
          patient.phone,
          patient.patientCode,
          patient.code,
          patient.fileNumber,
          patient.medicalFileNumber,
        ]
          .map((value) =>
            clean(value)
              .toLowerCase()
          )
          .filter(Boolean);

        return values.some(
          (value) =>
            value.includes(query)
        );
      })
      .slice(0, 8);
  }, [
    patients,
    searchValue,
  ]);

  /* =======================================================
     KEYBOARD SHORTCUT
  ======================================================= */

  useEffect(() => {
    function handleKeyboard(event) {
      const isShortcut =
        (event.ctrlKey ||
          event.metaKey) &&
        event.key.toLowerCase() ===
          "k";

      if (isShortcut) {
        event.preventDefault();

        searchRef.current?.focus();

        setSearchOpen(true);
      }

      if (
        event.key === "Escape"
      ) {
        setSearchOpen(false);
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyboard
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyboard
      );
  }, []);

  /* =======================================================
     CLICK OUTSIDE
  ======================================================= */

  useEffect(() => {
    function handleClickOutside(
      event
    ) {
      if (
        profileRef.current &&
        !profileRef.current.contains(
          event.target
        )
      ) {
        setProfileOpen(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(
          event.target
        )
      ) {
        setNotificationsOpen(
          false
        );
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
  }, []);

  /* =======================================================
     ROUTE CHANGE
  ======================================================= */

  useEffect(() => {
    setProfileOpen(false);
    setNotificationsOpen(false);
    setSearchOpen(false);
    setSearchValue("");
  }, [location.pathname]);

  /* =======================================================
     PATIENT CLICK
  ======================================================= */

  function openPatient(patient) {
    if (!patient?.id) return;

    setSearchOpen(false);
    setSearchValue("");

    navigate(
      `/patients/${patient.id}`
    );
  }

  /* =======================================================
     LOGOUT
  ======================================================= */

  async function handleLogout() {
    try {
      await signOut(auth);

      navigate(
        "/login",
        {
          replace: true,
        }
      );
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );
    }
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <header className="main-header">
      {/* ===================================================
          START
      =================================================== */}

      <div className="header-start">
        <button
          className="mobile-menu-button"
          onClick={onMenuClick}
          aria-label="فتح القائمة"
        >
          <Menu size={21} />
        </button>

        {/* ===============================================
            GLOBAL SEARCH
        =============================================== */}

        <div className="header-search-wrapper">
          <div
            className={`global-search ${
              searchOpen
                ? "active"
                : ""
            }`}
          >
            <Search size={18} />

            <input
              ref={searchRef}
              type="text"
              value={searchValue}
              placeholder="ابحث عن مريض، رقم هاتف أو رقم ملف..."
              onFocus={() =>
                setSearchOpen(true)
              }
              onChange={(event) => {
                setSearchValue(
                  event.target.value
                );

                setSearchOpen(true);
              }}
            />

            {searchValue ? (
              <button
                type="button"
                className="clear-header-search"
                onClick={() => {
                  setSearchValue("");
                  searchRef.current?.focus();
                }}
              >
                <X size={15} />
              </button>
            ) : (
              <span className="search-shortcut">
                Ctrl K
              </span>
            )}
          </div>

          {searchOpen && (
            <div className="header-search-results">
              {!searchValue ? (
                <div className="header-search-placeholder">
                  <Search
                    size={23}
                  />

                  <div>
                    <strong>
                      البحث السريع
                    </strong>

                    <span>
                      ابحث باسم المريض أو رقم الهاتف أو رقم الملف الطبي
                    </span>
                  </div>
                </div>
              ) : searchLoading ? (
                <div className="header-search-state">
                  <Loader2
                    size={19}
                    className="header-spinner"
                  />

                  جاري البحث...
                </div>
              ) : searchResults.length ? (
                <>
                  <div className="header-results-title">
                    <span>
                      المرضى
                    </span>

                    <strong>
                      {
                        searchResults.length
                      }{" "}
                      نتيجة
                    </strong>
                  </div>

                  {searchResults.map(
                    (patient) => (
                      <button
                        type="button"
                        key={patient.id}
                        className="header-patient-result"
                        onClick={() =>
                          openPatient(
                            patient
                          )
                        }
                      >
                        <div className="patient-search-avatar">
                          {getInitials(
                            patient.name ||
                              patient.fullName
                          )}
                        </div>

                        <div className="patient-search-info">
                          <strong>
                            {patient.name ||
                              patient.fullName ||
                              "مريض"}
                          </strong>

                          <div>
                            {patient.phone && (
                              <span>
                                <Phone
                                  size={
                                    12
                                  }
                                />

                                {
                                  patient.phone
                                }
                              </span>
                            )}

                            {(patient.patientCode ||
                              patient.fileNumber) && (
                              <span>
                                <FileText
                                  size={
                                    12
                                  }
                                />

                                {patient.patientCode ||
                                  patient.fileNumber}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="open-patient-label">
                          فتح الملف
                        </span>
                      </button>
                    )
                  )}
                </>
              ) : (
                <div className="header-search-empty">
                  <Users size={24} />

                  <strong>
                    لا توجد نتائج
                  </strong>

                  <span>
                    لم نجد مريضاً مطابقاً لـ "{searchValue}"
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===================================================
          ACTIONS
      =================================================== */}

      <div className="header-actions">
        {/* ===============================================
            NEW APPOINTMENT
        =============================================== */}

        <button
          className="new-appointment-button"
          onClick={() =>
            navigate(
              "/appointments"
            )
          }
        >
          <CalendarPlus
            size={18}
          />

          <span>
            حجز جديد
          </span>
        </button>

        {/* ===============================================
            HELP
        =============================================== */}

        <button
          className="header-icon-button"
          aria-label="المساعدة"
          title="المساعدة"
          onClick={() =>
            navigate(
              "/settings"
            )
          }
        >
          <HelpCircle
            size={20}
          />
        </button>

        {/* ===============================================
            NOTIFICATIONS
        =============================================== */}

        <div
          className="header-notification-wrapper"
          ref={notificationRef}
        >
          <button
            className={`header-icon-button notification-button ${
              notificationsOpen
                ? "active"
                : ""
            }`}
            aria-label="الإشعارات"
            onClick={() => {
              setNotificationsOpen(
                (value) => !value
              );

              setProfileOpen(false);
            }}
          >
            <Bell size={20} />

            {notifications.length >
              0 && (
              <span className="notification-count">
                {notifications.length >
                9
                  ? "9+"
                  : notifications.length}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="header-notifications-menu">
              <div className="notification-menu-header">
                <div>
                  <span>
                    TODAY
                  </span>

                  <strong>
                    مواعيد اليوم
                  </strong>
                </div>

                <span className="today-appointments-count">
                  {
                    notifications.length
                  }
                </span>
              </div>

              <div className="notification-list">
                {notifications.length ? (
                  notifications.map(
                    (item) => (
                      <button
                        type="button"
                        key={
                          item.id
                        }
                        className="notification-item"
                        onClick={() => {
                          setNotificationsOpen(
                            false
                          );

                          navigate(
                            "/appointments"
                          );
                        }}
                      >
                        <div className="notification-item-icon">
                          <CalendarPlus
                            size={
                              16
                            }
                          />
                        </div>

                        <div>
                          <strong>
                            {
                              item.title
                            }
                          </strong>

                          <span>
                            {
                              item.description
                            }
                          </span>
                        </div>
                      </button>
                    )
                  )
                ) : (
                  <div className="empty-notifications">
                    <Bell
                      size={27}
                    />

                    <strong>
                      لا توجد مواعيد حالياً
                    </strong>

                    <span>
                      ستظهر هنا مواعيد اليوم الخاصة بالعيادة.
                    </span>
                  </div>
                )}
              </div>

              <button
                className="view-all-notifications"
                onClick={() => {
                  setNotificationsOpen(
                    false
                  );

                  navigate(
                    "/appointments"
                  );
                }}
              >
                عرض جدول المواعيد
              </button>
            </div>
          )}
        </div>

        <div className="header-separator" />

        {/* ===============================================
            PROFILE
        =============================================== */}

        <div
          className="header-profile-wrapper"
          ref={profileRef}
        >
          <button
            className={`header-profile ${
              profileOpen
                ? "active"
                : ""
            }`}
            onClick={() => {
              setProfileOpen(
                (value) => !value
              );

              setNotificationsOpen(
                false
              );
            }}
          >
            <div className="header-profile-avatar">
              {loadingProfile ? (
                <Loader2
                  size={17}
                  className="header-spinner"
                />
              ) : (
                getInitials(
                  profile.name
                )
              )}
            </div>

            <div className="header-profile-info">
              <strong>
                {loadingProfile
                  ? "جاري التحميل..."
                  : profile.name}
              </strong>

              <span>
                {
                  profile.clinicName
                }
              </span>
            </div>

            <ChevronDown
              size={15}
              className={
                profileOpen
                  ? "profile-chevron open"
                  : "profile-chevron"
              }
            />
          </button>

          {profileOpen && (
            <div className="header-profile-menu">
              <div className="profile-menu-account">
                <div className="profile-menu-avatar">
                  {getInitials(
                    profile.name
                  )}
                </div>

                <div>
                  <strong>
                    {profile.name}
                  </strong>

                  <span>
                    {profile.email ||
                      "—"}
                  </span>
                </div>
              </div>

              <div className="profile-menu-clinic">
                <span>
                  العيادة الحالية
                </span>

                <strong>
                  {
                    profile.clinicName
                  }
                </strong>

                <small>
                  {formatRole(
                    profile.role
                  )}
                </small>
              </div>

              <div className="profile-menu-divider" />

              {profile.staffId && (
                <button
                  onClick={() => {
                    setProfileOpen(
                      false
                    );

                    navigate(
                      `/staff`
                    );
                  }}
                >
                  <UserRound
                    size={17}
                  />

                  <span>
                    فريق العمل
                  </span>
                </button>
              )}

              <button
                onClick={() => {
                  setProfileOpen(
                    false
                  );

                  navigate(
                    "/settings"
                  );
                }}
              >
                <Settings
                  size={17}
                />

                <span>
                  إعدادات العيادة
                </span>
              </button>

              <div className="profile-menu-divider" />

              <button
                className="profile-logout-button"
                onClick={
                  handleLogout
                }
              >
                <LogOut
                  size={17}
                />

                <span>
                  تسجيل الخروج
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}