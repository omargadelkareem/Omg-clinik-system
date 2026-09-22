import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Building2,
  Check,
  ChevronLeft,
  Clock3,
  Edit3,
  LockKeyhole,
  Minus,
  Phone,
  Plus,
  Search,
  UnlockKeyhole,
  UserRound,
  Users,
  X,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext";

import {
  closeRepresentativeVisits,
  completeRepresentativeVisit,
  createRepresentative,
  filterRepresentatives,
  getRepresentativeUsage,
  openRepresentativeVisits,
  quickAddRepresentativeToQueue,
  quickStartRepresentativeVisit,
  REPRESENTATIVE_TYPES,
  setRepresentativeDailyLimit,
  subscribeClinicDoctors,
  subscribeRepresentatives,
  subscribeRepresentativeSettings,
  subscribeRepresentativeVisits,
  updateRepresentative,
  VISIT_STATUS,
} from "../../services/representativeService";

import "./RepresentativeVisitsPage.css";

/* =========================================================
   DEFAULTS
========================================================= */

const EMPTY_REPRESENTATIVE = {
  name: "",
  phone: "",
  organizationType: "pharma",
  organizationName: "",
  assignedDoctorId: "",
  assignedDoctorName: "",
  maxVisitsPerMonth: 1,
  notes: "",
  status: "active",
};

/* =========================================================
   HELPERS
========================================================= */

function localDateKey(date = new Date()) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function visitDate(visit) {
  return (
    visit.completedAt ||
    visit.startedAt ||
    visit.arrivedAt ||
    visit.scheduledAt ||
    visit.createdAt ||
    null
  );
}

function isToday(value) {
  if (!value) {
    return false;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false;
  }

  return (
    localDateKey(date) ===
    localDateKey()
  );
}

function formatTime(value) {
  if (!value) {
    return "--";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "--";
  }

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}

function getTypeLabel(type) {
  return (
    REPRESENTATIVE_TYPES.find(
      (item) =>
        item.value === type
    )?.label ||
    "جهة طبية"
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function RepresentativeVisitsPage() {
  const {
    clinicId,
    profile,
    staffId,
    isOwner,
  } = useAuth();

  /* =======================================================
     DATA
  ======================================================= */

  const [
    representatives,
    setRepresentatives,
  ] = useState([]);

  const [
    visits,
    setVisits,
  ] = useState([]);

  const [
    doctors,
    setDoctors,
  ] = useState([]);

  const [
    selectedDoctorId,
    setSelectedDoctorId,
  ] = useState("");

  const [
    settings,
    setSettings,
  ] = useState({
    visitsOpen: true,
    dailyVisitLimit: 6,
    closedForDate: null,
    closeReason: "",
  });

  /* =======================================================
     UI
  ======================================================= */

  const [
    activeTab,
    setActiveTab,
  ] = useState("today");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    formOpen,
    setFormOpen,
  ] = useState(false);

  const [
    limitModalOpen,
    setLimitModalOpen,
  ] = useState(false);

  const [
    dailyLimitInput,
    setDailyLimitInput,
  ] = useState("6");

  const [
    editing,
    setEditing,
  ] = useState(null);

  const [
    form,
    setForm,
  ] = useState(
    EMPTY_REPRESENTATIVE
  );

  const [
    busyId,
    setBusyId,
  ] = useState("");

  const [
    pageBusy,
    setPageBusy,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /* =======================================================
     REALTIME
  ======================================================= */

  useEffect(() => {
    if (!clinicId) {
      return;
    }

    const unsubscribeRepresentatives =
      subscribeRepresentatives(
        clinicId,

        (data) => {
          setRepresentatives(
            data || []
          );
        },

        (err) => {
          console.error(
            "Representatives subscription:",
            err
          );

          setError(
            err?.message ||
              "تعذر تحميل المندوبين"
          );
        }
      );

    const unsubscribeVisits =
      subscribeRepresentativeVisits(
        clinicId,

        (data) => {
          setVisits(
            data || []
          );
        },

        (err) => {
          console.error(
            "Representative visits subscription:",
            err
          );

          setError(
            err?.message ||
              "تعذر تحميل الزيارات"
          );
        }
      );

    const unsubscribeDoctors =
      subscribeClinicDoctors(
        clinicId,

        (data) => {
          setDoctors(
            data || []
          );
        },

        (err) => {
          console.error(
            "Doctors subscription:",
            err
          );

          setError(
            err?.message ||
              "تعذر تحميل الأطباء"
          );
        }
      );

    return () => {
      unsubscribeRepresentatives?.();
      unsubscribeVisits?.();
      unsubscribeDoctors?.();
    };
  }, [clinicId]);

  /* =======================================================
     DEFAULT DOCTOR
  ======================================================= */

  useEffect(() => {
    if (!doctors.length) {
      return;
    }

    /*
      لو المستخدم الحالي طبيب
      نختاره تلقائياً.
    */

    if (
      staffId &&
      doctors.some(
        (doctor) =>
          doctor.id === staffId
      )
    ) {
      setSelectedDoctorId(
        staffId
      );

      return;
    }

    /*
      لو فيه طبيب محدد بالفعل
      وما زال موجوداً.
    */

    if (
      selectedDoctorId &&
      doctors.some(
        (doctor) =>
          doctor.id ===
          selectedDoctorId
      )
    ) {
      return;
    }

    /*
      Owner / Admin / Reception
      يبدأ بأول طبيب.
    */

    setSelectedDoctorId(
      doctors[0].id
    );
  }, [
    doctors,
    staffId,
    selectedDoctorId,
  ]);

  /* =======================================================
     SELECTED DOCTOR
  ======================================================= */

  const selectedDoctor =
    useMemo(
      () =>
        doctors.find(
          (doctor) =>
            doctor.id ===
            selectedDoctorId
        ) || null,
      [
        doctors,
        selectedDoctorId,
      ]
    );

  /* =======================================================
     DOCTOR SETTINGS
  ======================================================= */

  useEffect(() => {
    if (
      !clinicId ||
      !selectedDoctorId
    ) {
      return;
    }

    const unsubscribe =
      subscribeRepresentativeSettings(
        clinicId,
        selectedDoctorId,

        (data) => {
          setSettings({
            visitsOpen:
              data?.visitsOpen ??
              true,

            dailyVisitLimit:
              Number(
                data?.dailyVisitLimit ??
                  6
              ),

            closedForDate:
              data?.closedForDate ||
              null,

            closeReason:
              data?.closeReason ||
              "",
          });
        },

        (err) => {
          console.error(
            "Representative settings:",
            err
          );

          setError(
            err?.message ||
              "تعذر تحميل إعدادات زيارات المندوبين"
          );
        }
      );

    return () => {
      unsubscribe?.();
    };
  }, [
    clinicId,
    selectedDoctorId,
  ]);

  /* =======================================================
     EFFECTIVE OPEN STATE

     لو الطبيب قفل أمس
     النهارده نعتبره مفتوح تلقائياً.
  ======================================================= */

  const effectiveOpen =
    !(
      settings.visitsOpen ===
        false &&
      settings.closedForDate ===
        localDateKey()
    );

  /* =======================================================
     TODAY VISITS
  ======================================================= */

  const doctorTodayVisits =
    useMemo(
      () =>
        visits
          .filter(
            (visit) =>
              visit.doctorId ===
                selectedDoctorId &&
              isToday(
                visitDate(
                  visit
                )
              )
          )
          .sort(
            (a, b) => {
              const first =
                Number(
                  a.queueNumber ||
                    999999
                );

              const second =
                Number(
                  b.queueNumber ||
                    999999
                );

              return (
                first -
                second
              );
            }
          ),
      [
        visits,
        selectedDoctorId,
      ]
    );

  /* =======================================================
     WAITING
  ======================================================= */

  const waitingVisits =
    useMemo(
      () =>
        doctorTodayVisits.filter(
          (visit) =>
            [
              VISIT_STATUS.WAITING,
              VISIT_STATUS.SCHEDULED,
              VISIT_STATUS.ARRIVED,
            ].includes(
              visit.status
            )
        ),
      [doctorTodayVisits]
    );

  /* =======================================================
     CURRENT
  ======================================================= */

  const currentVisit =
    useMemo(
      () =>
        doctorTodayVisits.find(
          (visit) =>
            visit.status ===
            VISIT_STATUS.IN_VISIT
        ) || null,
      [doctorTodayVisits]
    );

  /* =======================================================
     COMPLETED
  ======================================================= */

  const completedVisits =
    useMemo(
      () =>
        doctorTodayVisits
          .filter(
            (visit) =>
              visit.status ===
              VISIT_STATUS.COMPLETED
          )
          .sort(
            (a, b) =>
              Number(
                b.completedAt ||
                  0
              ) -
              Number(
                a.completedAt ||
                  0
              )
          ),
      [doctorTodayVisits]
    );

  /* =======================================================
     DAILY LIMIT
  ======================================================= */

  const dailyUsed =
    doctorTodayVisits.filter(
      (visit) =>
        ![
          VISIT_STATUS.CANCELLED,
          VISIT_STATUS.REJECTED,
        ].includes(
          visit.status
        )
    ).length;

  const dailyLimit =
    Math.max(
      1,
      Number(
        settings.dailyVisitLimit ||
          6
      )
    );

  const dailyFull =
    dailyUsed >=
    dailyLimit;

  /* =======================================================
     ROLE
  ======================================================= */

  const role =
    String(
      profile?.role ||
        ""
    ).toLowerCase();

  const isDoctorUser =
    role === "doctor";

  const canControlReception =
    isOwner ||
    role === "admin" ||
    (
      isDoctorUser &&
      (
        !staffId ||
        staffId ===
          selectedDoctorId
      )
    );

  const canManageDirectory =
    isOwner ||
    role === "admin" ||
    role === "reception";

  /* =======================================================
     SEARCH
  ======================================================= */

  const filteredRepresentatives =
    useMemo(
      () =>
        filterRepresentatives(
          representatives,
          search
        ),
      [
        representatives,
        search,
      ]
    );

  /* =======================================================
     OPEN / CLOSE
  ======================================================= */

  async function handleToggleReception() {
    if (
      !selectedDoctorId ||
      pageBusy
    ) {
      return;
    }

    try {
      setPageBusy(true);
      setError("");

      if (effectiveOpen) {
        await closeRepresentativeVisits({
          clinicId,

          doctorId:
            selectedDoctorId,

          reason:
            "مغلق بواسطة الطبيب",

          closedForDate:
            localDateKey(),

          updatedBy:
            profile?.uid ||
            profile?.id ||
            "",
        });
      } else {
        await openRepresentativeVisits({
          clinicId,

          doctorId:
            selectedDoctorId,

          updatedBy:
            profile?.uid ||
            profile?.id ||
            "",
        });
      }
    } catch (err) {
      console.error(
        "Toggle representative reception:",
        err
      );

      setError(
        err?.message ||
          "تعذر تغيير حالة استقبال المندوبين"
      );
    } finally {
      setPageBusy(false);
    }
  }

  /* =======================================================
     DAILY LIMIT MODAL
  ======================================================= */

  function openDailyLimitModal() {
    setDailyLimitInput(
      String(
        dailyLimit
      )
    );

    setLimitModalOpen(
      true
    );
  }

  function decreaseLimit() {
    const current =
      Number(
        dailyLimitInput ||
          1
      );

    setDailyLimitInput(
      String(
        Math.max(
          1,
          current - 1
        )
      )
    );
  }

  function increaseLimit() {
    const current =
      Number(
        dailyLimitInput ||
          0
      );

    setDailyLimitInput(
      String(
        Math.min(
          100,
          current + 1
        )
      )
    );
  }

  async function handleSaveDailyLimit() {
    const limit =
      Number(
        dailyLimitInput
      );

    if (
      !Number.isInteger(
        limit
      ) ||
      limit < 1 ||
      limit > 100
    ) {
      setError(
        "حدد عدد زيارات يومي صحيح من 1 إلى 100"
      );

      return;
    }

    if (
      !selectedDoctorId
    ) {
      setError(
        "يجب تحديد الطبيب"
      );

      return;
    }

    try {
      setPageBusy(true);
      setError("");

      await setRepresentativeDailyLimit({
        clinicId,

        doctorId:
          selectedDoctorId,

        /*
          بنرسل الاسمين لضمان التوافق
          لو service القديمة تستخدم limit
          والجديدة تستخدم dailyVisitLimit.
        */
        limit,
        dailyVisitLimit:
          limit,

        updatedBy:
          profile?.uid ||
          profile?.id ||
          "",
      });

      setLimitModalOpen(
        false
      );
    } catch (err) {
      console.error(
        "Save daily representative limit:",
        err
      );

      setError(
        err?.message ||
          "تعذر حفظ الحد اليومي للزيارات"
      );
    } finally {
      setPageBusy(false);
    }
  }

  /* =======================================================
     QUICK ADD TO QUEUE
  ======================================================= */

  async function handleAddToQueue(
    representative
  ) {
    if (
      busyId ||
      !selectedDoctorId
    ) {
      return;
    }

    if (
      !effectiveOpen
    ) {
      setError(
        "الطبيب أغلق استقبال المندوبين اليوم"
      );

      return;
    }

    if (dailyFull) {
      setError(
        `تم الوصول للحد اليومي للزيارات (${dailyUsed}/${dailyLimit})`
      );

      return;
    }

    try {
      setBusyId(
        representative.id
      );

      setError("");

      const doctorId =
        representative
          .assignedDoctorId ||
        selectedDoctorId;

      const doctor =
        doctors.find(
          (item) =>
            item.id ===
            doctorId
        );

      await quickAddRepresentativeToQueue({
        clinicId,

        representative,

        doctorId,

        doctorName:
          representative
            .assignedDoctorName ||
          doctor?.name ||
          selectedDoctor?.name ||
          "",

        createdBy:
          profile?.uid ||
          profile?.id ||
          "",
      });

      /*
        بعد الإضافة نفرغ البحث
        لتسهيل تسجيل المندوب التالي.
      */

      setSearch("");
    } catch (err) {
      console.error(
        "Add representative to queue:",
        err
      );

      setError(
        err?.message ||
          "تعذر إضافة المندوب للانتظار"
      );
    } finally {
      setBusyId("");
    }
  }

  /* =======================================================
     ENTER DOCTOR
  ======================================================= */

  async function handleEnter(
    visit
  ) {
    if (
      busyId
    ) {
      return;
    }

    if (
      currentVisit
    ) {
      setError(
        `${currentVisit.representativeName || "يوجد مندوب"} داخل الزيارة حالياً`
      );

      return;
    }

    try {
      setBusyId(
        visit.id
      );

      setError("");

      await quickStartRepresentativeVisit({
        clinicId,

        visitId:
          visit.id,

        doctorId:
          selectedDoctorId,

        updatedBy:
          profile?.uid ||
          profile?.id ||
          "",
      });
    } catch (err) {
      console.error(
        "Start representative visit:",
        err
      );

      setError(
        err?.message ||
          "تعذر إدخال المندوب"
      );
    } finally {
      setBusyId("");
    }
  }

  /* =======================================================
     COMPLETE VISIT
  ======================================================= */

  async function handleComplete() {
    if (
      !currentVisit ||
      busyId
    ) {
      return;
    }

    try {
      setBusyId(
        currentVisit.id
      );

      setError("");

      await completeRepresentativeVisit({
        clinicId,

        visitId:
          currentVisit.id,

        updatedBy:
          profile?.uid ||
          profile?.id ||
          "",
      });
    } catch (err) {
      console.error(
        "Complete representative visit:",
        err
      );

      setError(
        err?.message ||
          "تعذر إنهاء الزيارة"
      );
    } finally {
      setBusyId("");
    }
  }

  /* =======================================================
     CREATE REPRESENTATIVE
  ======================================================= */

  function openCreate() {
    setEditing(null);

    setForm({
      ...EMPTY_REPRESENTATIVE,

      assignedDoctorId:
        selectedDoctorId ||
        "",

      assignedDoctorName:
        selectedDoctor?.name ||
        "",
    });

    setFormOpen(
      true
    );
  }

  /* =======================================================
     EDIT REPRESENTATIVE
  ======================================================= */

  function openEdit(
    representative
  ) {
    setEditing(
      representative
    );

    setForm({
      name:
        representative.name ||
        "",

      phone:
        representative.phone ||
        "",

      organizationType:
        representative.organizationType ||
        "pharma",

      organizationName:
        representative.organizationName ||
        "",

      assignedDoctorId:
        representative.assignedDoctorId ||
        "",

      assignedDoctorName:
        representative.assignedDoctorName ||
        "",

      maxVisitsPerMonth:
        representative
          .visitPolicy
          ?.maxVisitsPerMonth ??
        1,

      notes:
        representative.notes ||
        "",

      status:
        representative.status ||
        "active",
    });

    setFormOpen(
      true
    );
  }

  /* =======================================================
     REPRESENTATIVE DOCTOR
  ======================================================= */

  function handleFormDoctor(
    doctorId
  ) {
    const doctor =
      doctors.find(
        (item) =>
          item.id ===
          doctorId
      );

    setForm(
      (current) => ({
        ...current,

        assignedDoctorId:
          doctorId,

        assignedDoctorName:
          doctor?.name ||
          "",
      })
    );
  }

  /* =======================================================
     SAVE REPRESENTATIVE
  ======================================================= */

  async function handleSaveRepresentative(
    event
  ) {
    event.preventDefault();

    if (
      !form.assignedDoctorId
    ) {
      setError(
        "يجب تحديد الطبيب للمندوب"
      );

      return;
    }

    try {
      setPageBusy(true);
      setError("");

      const data = {
        ...form,

        maxVisitsPerMonth:
          Number(
            form.maxVisitsPerMonth ||
              0
          ),

        /*
          لم نعد نستخدم حد يومي
          منفصل لكل مندوب.
        */
        maxVisitsPerDay: 0,
      };

      if (editing) {
        await updateRepresentative({
          clinicId,

          representativeId:
            editing.id,

          data,

          updatedBy:
            profile?.uid ||
            profile?.id ||
            "",
        });
      } else {
        await createRepresentative({
          clinicId,

          data,

          createdBy:
            profile?.uid ||
            profile?.id ||
            "",
        });
      }

      setFormOpen(false);

      setEditing(null);

      setForm(
        EMPTY_REPRESENTATIVE
      );
    } catch (err) {
      console.error(
        "Save representative:",
        err
      );

      setError(
        err?.message ||
          "تعذر حفظ بيانات المندوب"
      );
    } finally {
      setPageBusy(false);
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="rep-ops-page">

      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="rep-ops-header">
        <div>
          <h1>
            زيارات المندوبين
          </h1>

          <p>
            {selectedDoctor?.name
              ? `إدارة زيارات ${selectedDoctor.name}`
              : "إدارة زيارات المندوبين"}
          </p>
        </div>

        {doctors.length >
          1 && (
          <select
            className="rep-doctor-switch"
            value={
              selectedDoctorId
            }
            onChange={(
              event
            ) =>
              setSelectedDoctorId(
                event.target
                  .value
              )
            }
          >
            {doctors.map(
              (doctor) => (
                <option
                  key={
                    doctor.id
                  }
                  value={
                    doctor.id
                  }
                >
                  {
                    doctor.name
                  }
                </option>
              )
            )}
          </select>
        )}
      </header>

      {/* ===================================================
          ERROR
      =================================================== */}

      {error && (
        <div className="rep-error">
          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            <X
              size={17}
            />
          </button>
        </div>
      )}

      {/* ===================================================
          OPERATION BAR
      =================================================== */}

      <section
        className={`rep-operation-bar ${
          effectiveOpen
            ? "is-open"
            : "is-closed"
        }`}
      >
        <div className="rep-reception-state">
          <span className="rep-state-dot" />

          <div>
            <strong>
              {effectiveOpen
                ? "استقبال المندوبين مفتوح"
                : "استقبال المندوبين مغلق"}
            </strong>

            <span>
              {effectiveOpen
                ? "يمكن للاستقبال إضافة مندوبين لقائمة الانتظار"
                : `${selectedDoctor?.name || "الطبيب"} أغلق استقبال المندوبين اليوم`}
            </span>
          </div>
        </div>

        {/* DAILY LIMIT */}

        <div className="rep-day-counter">
          <span>
            زيارات اليوم
          </span>

          <strong>
            {dailyUsed}

            <small>
              {" / "}
              {dailyLimit}
            </small>
          </strong>

          {canControlReception && (
            <button
              type="button"
              className="rep-change-limit"
              onClick={
                openDailyLimitModal
              }
            >
              تعديل الحد
            </button>
          )}
        </div>

        {/* WAITING */}

        <div className="rep-wait-counter">
          <span>
            في الانتظار
          </span>

          <strong>
            {
              waitingVisits.length
            }
          </strong>
        </div>

        {/* OPEN / CLOSE */}

        {canControlReception && (
          <button
            type="button"
            className="rep-toggle-button"
            disabled={
              pageBusy
            }
            onClick={
              handleToggleReception
            }
          >
            {effectiveOpen ? (
              <>
                <LockKeyhole
                  size={17}
                />

                إغلاق الاستقبال
              </>
            ) : (
              <>
                <UnlockKeyhole
                  size={17}
                />

                فتح الاستقبال
              </>
            )}
          </button>
        )}
      </section>

      {/* ===================================================
          LIMIT REACHED
      =================================================== */}

      {dailyFull && (
        <div className="rep-limit-notice">
          تم الوصول للحد اليومي لزيارات المندوبين:
          {" "}
          {dailyUsed}
          /
          {dailyLimit}
          {" "}
          — لا يمكن إضافة مندوب جديد اليوم.
        </div>
      )}

      {/* ===================================================
          TABS
      =================================================== */}

      <div className="rep-tabs">
        <button
          type="button"
          className={
            activeTab ===
            "today"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab(
              "today"
            )
          }
        >
          زيارات اليوم
        </button>

        <button
          type="button"
          className={
            activeTab ===
            "directory"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab(
              "directory"
            )
          }
        >
          دليل المندوبين
        </button>
      </div>

      {/* ===================================================
          TODAY TAB
      =================================================== */}

      {activeTab ===
        "today" && (
        <div className="rep-today-layout">

          {/* ===============================================
              DOCTOR WORKSPACE
          =============================================== */}

          <main className="rep-today-main">

            {/* CURRENT VISIT */}

            {currentVisit && (
              <section className="rep-current">
                <div className="rep-current-label">
                  <span className="pulse" />

                  المندوب الحالي
                </div>

                <div className="rep-current-body">
                  <div className="rep-current-avatar">
                    <UserRound
                      size={24}
                    />
                  </div>

                  <div className="rep-current-info">
                    <h2>
                      {
                        currentVisit
                          .representativeName
                      }
                    </h2>

                    <div>
                      <Building2
                        size={14}
                      />

                      {
                        currentVisit
                          .organizationName
                      }
                    </div>

                    <span>
                      بدأت الزيارة{" "}
                      {formatTime(
                        currentVisit
                          .startedAt
                      )}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="rep-finish-button"
                    disabled={
                      busyId ===
                      currentVisit.id
                    }
                    onClick={
                      handleComplete
                    }
                  >
                    <Check
                      size={17}
                    />

                    {busyId ===
                    currentVisit.id
                      ? "جاري الإنهاء..."
                      : "إنهاء الزيارة"}
                  </button>
                </div>
              </section>
            )}

            {/* WAITING */}

            <section className="rep-section">
              <div className="rep-section-title">
                <div>
                  <h2>
                    في الانتظار
                  </h2>

                  <span>
                    ترتيب دخول المندوبين للطبيب
                  </span>
                </div>

                <strong>
                  {
                    waitingVisits.length
                  }
                </strong>
              </div>

              {waitingVisits.length ===
              0 ? (
                <EmptyState
                  title="لا يوجد مندوبون في الانتظار"
                  text={
                    effectiveOpen
                      ? "ستظهر الزيارات هنا فور إضافتها من الاستقبال."
                      : "استقبال المندوبين مغلق حالياً."
                  }
                />
              ) : (
                <div className="rep-waiting-list">
                  {waitingVisits.map(
                    (
                      visit,
                      index
                    ) => (
                      <div
                        className="rep-waiting-row"
                        key={
                          visit.id
                        }
                      >
                        <div className="rep-order">
                          {visit.queueNumber ||
                            index +
                              1}
                        </div>

                        <div className="rep-waiting-person">
                          <strong>
                            {
                              visit
                                .representativeName
                            }
                          </strong>

                          <span>
                            {
                              visit
                                .organizationName
                            }
                          </span>
                        </div>

                        <div className="rep-waiting-time">
                          <Clock3
                            size={14}
                          />

                          {formatTime(
                            visit.arrivedAt ||
                              visit.createdAt ||
                              visit.scheduledAt
                          )}
                        </div>

                        <button
                          type="button"
                          className="rep-enter-button"
                          disabled={
                            Boolean(
                              currentVisit
                            ) ||
                            busyId ===
                              visit.id
                          }
                          onClick={() =>
                            handleEnter(
                              visit
                            )
                          }
                        >
                          {busyId ===
                          visit.id
                            ? "جاري الإدخال..."
                            : currentVisit
                              ? "يوجد مندوب بالداخل"
                              : "إدخال"}

                          {!currentVisit &&
                            busyId !==
                              visit.id && (
                              <ChevronLeft
                                size={
                                  16
                                }
                              />
                            )}
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>

            {/* COMPLETED */}

            <section className="rep-section rep-completed-section">
              <div className="rep-section-title">
                <div>
                  <h2>
                    تمت اليوم
                  </h2>

                  <span>
                    الزيارات المنتهية
                  </span>
                </div>

                <strong>
                  {
                    completedVisits.length
                  }
                </strong>
              </div>

              {completedVisits.length ===
              0 ? (
                <div className="rep-compact-empty">
                  لم يتم إنهاء أي زيارة حتى الآن.
                </div>
              ) : (
                <div className="rep-completed-list">
                  {completedVisits.map(
                    (visit) => (
                      <div
                        className="rep-completed-row"
                        key={
                          visit.id
                        }
                      >
                        <Check
                          size={16}
                        />

                        <strong>
                          {
                            visit
                              .representativeName
                          }
                        </strong>

                        <span>
                          {
                            visit
                              .organizationName
                          }
                        </span>

                        <time>
                          {formatTime(
                            visit
                              .completedAt
                          )}
                        </time>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>
          </main>

          {/* ===============================================
              QUICK RECEPTION PANEL
          =============================================== */}

          <aside className="rep-quick-panel">
            <div className="rep-quick-head">
              <div>
                <h2>
                  إضافة للانتظار
                </h2>

                <span>
                  تسجيل سريع من الاستقبال
                </span>
              </div>

              {canManageDirectory && (
                <button
                  type="button"
                  onClick={
                    openCreate
                  }
                  title="إضافة مندوب جديد"
                >
                  <Plus
                    size={18}
                  />
                </button>
              )}
            </div>

            {/* CLOSED */}

            {!effectiveOpen && (
              <div className="rep-closed-notice">
                <LockKeyhole
                  size={18}
                />

                <div>
                  <strong>
                    الاستقبال مغلق
                  </strong>

                  <span>
                    لا يمكن إضافة مندوب جديد للانتظار.
                  </span>
                </div>
              </div>
            )}

            {/* FULL */}

            {dailyFull && (
              <div className="rep-limit-notice">
                اكتمل الحد اليومي
                {" "}
                {dailyUsed}
                /
                {dailyLimit}
              </div>
            )}

            {/* SEARCH */}

            <div className="rep-search-box">
              <Search
                size={17}
              />

              <input
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                placeholder="الاسم، الكود، الهاتف أو الشركة"
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                >
                  <X
                    size={15}
                  />
                </button>
              )}
            </div>

            {/* RESULTS */}

            <div className="rep-quick-results">
              {!search ? (
                <div className="rep-search-hint">
                  <Search
                    size={23}
                  />

                  <strong>
                    ابحث عن المندوب
                  </strong>

                  <span>
                    اكتب الاسم أو الهاتف أو الكود.
                  </span>
                </div>
              ) : filteredRepresentatives.length ===
                0 ? (
                <div className="rep-search-hint">
                  <Users
                    size={23}
                  />

                  <strong>
                    المندوب غير مسجل
                  </strong>

                  {canManageDirectory && (
                    <button
                      type="button"
                      onClick={
                        openCreate
                      }
                    >
                      + إضافة مندوب جديد
                    </button>
                  )}
                </div>
              ) : (
                filteredRepresentatives
                  .slice(
                    0,
                    8
                  )
                  .map(
                    (
                      representative
                    ) => {
                      const usage =
                        getRepresentativeUsage({
                          representative,
                          visits,
                        });

                      const wrongDoctor =
                        Boolean(
                          representative
                            .assignedDoctorId
                        ) &&
                        representative
                          .assignedDoctorId !==
                          selectedDoctorId;

                      const alreadyToday =
                        doctorTodayVisits.some(
                          (
                            visit
                          ) =>
                            visit.representativeId ===
                              representative.id &&
                            ![
                              VISIT_STATUS.CANCELLED,
                              VISIT_STATUS.REJECTED,
                            ].includes(
                              visit.status
                            )
                        );

                      const inactive =
                        representative.status !==
                        "active";

                      const monthlyExceeded =
                        Boolean(
                          usage.monthlyExceeded
                        );

                      const blocked =
                        inactive ||
                        monthlyExceeded ||
                        wrongDoctor ||
                        alreadyToday ||
                        !effectiveOpen ||
                        dailyFull;

                      let reason =
                        "";

                      if (
                        inactive
                      ) {
                        reason =
                          "المندوب موقوف";
                      } else if (
                        monthlyExceeded
                      ) {
                        reason =
                          `استنفد زيارات الشهر ${usage.monthlyCompleted}/${usage.monthlyLimit}`;
                      } else if (
                        wrongDoctor
                      ) {
                        reason =
                          `مخصص لـ ${representative.assignedDoctorName || "طبيب آخر"}`;
                      } else if (
                        alreadyToday
                      ) {
                        reason =
                          "مسجل اليوم بالفعل";
                      } else if (
                        !effectiveOpen
                      ) {
                        reason =
                          "الطبيب أغلق الاستقبال";
                      } else if (
                        dailyFull
                      ) {
                        reason =
                          "اكتمل الحد اليومي";
                      }

                      return (
                        <div
                          key={
                            representative.id
                          }
                          className={`rep-quick-result ${
                            blocked
                              ? "blocked"
                              : ""
                          }`}
                        >
                          <div>
                            <strong>
                              {
                                representative.name
                              }
                            </strong>

                            <span>
                              {
                                representative.organizationName
                              }
                            </span>

                            <small>
                              {
                                representative.code
                              }

                              {" · "}

                              {
                                usage.monthlyCompleted
                              }

                              {" / "}

                              {usage.monthlyLimit ||
                                "∞"}

                              {" هذا الشهر"}
                            </small>

                            {reason && (
                              <em>
                                {
                                  reason
                                }
                              </em>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={
                              blocked ||
                              Boolean(
                                busyId
                              )
                            }
                            onClick={() =>
                              handleAddToQueue(
                                representative
                              )
                            }
                          >
                            {busyId ===
                            representative.id
                              ? "..."
                              : "إضافة"}
                          </button>
                        </div>
                      );
                    }
                  )
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ===================================================
          DIRECTORY TAB
      =================================================== */}

      {activeTab ===
        "directory" && (
        <section className="rep-directory-page">
          <div className="rep-directory-toolbar">
            <div className="rep-search-box directory-search">
              <Search
                size={17}
              />

              <input
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                placeholder="بحث بالاسم، الهاتف، الكود أو الشركة..."
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                >
                  <X
                    size={15}
                  />
                </button>
              )}
            </div>

            {canManageDirectory && (
              <button
                type="button"
                className="rep-main-button"
                onClick={
                  openCreate
                }
              >
                <Plus
                  size={17}
                />

                إضافة مندوب
              </button>
            )}
          </div>

          <div className="rep-table-wrap">
            <table className="rep-table">
              <thead>
                <tr>
                  <th>
                    الكود
                  </th>

                  <th>
                    المندوب
                  </th>

                  <th>
                    الجهة
                  </th>

                  <th>
                    الهاتف
                  </th>

                  <th>
                    الطبيب
                  </th>

                  <th>
                    زيارات الشهر
                  </th>

                  <th>
                    الحالة
                  </th>

                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredRepresentatives.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="rep-table-empty"
                    >
                      لا يوجد مندوبون مطابقون للبحث.
                    </td>
                  </tr>
                ) : (
                  filteredRepresentatives.map(
                    (
                      representative
                    ) => {
                      const usage =
                        getRepresentativeUsage({
                          representative,
                          visits,
                        });

                      return (
                        <tr
                          key={
                            representative.id
                          }
                          className={
                            usage.monthlyExceeded
                              ? "quota-exceeded"
                              : ""
                          }
                        >
                          <td>
                            <b className="rep-code">
                              {
                                representative.code
                              }
                            </b>
                          </td>

                          <td>
                            <strong>
                              {
                                representative.name
                              }
                            </strong>
                          </td>

                          <td>
                            <span className="rep-company">
                              {
                                representative.organizationName
                              }
                            </span>

                            <small>
                              {getTypeLabel(
                                representative.organizationType
                              )}
                            </small>
                          </td>

                          <td
                            dir="ltr"
                          >
                            <span className="rep-phone">
                              <Phone
                                size={12}
                              />

                              {
                                representative.phone
                              }
                            </span>
                          </td>

                          <td>
                            {
                              representative.assignedDoctorName ||
                              "—"
                            }
                          </td>

                          <td>
                            <strong>
                              {
                                usage.monthlyCompleted
                              }

                              {" / "}

                              {usage.monthlyLimit ||
                                "∞"}
                            </strong>

                            {usage.monthlyExceeded && (
                              <span className="rep-quota-text">
                                استنفد الحد
                              </span>
                            )}
                          </td>

                          <td>
                            <span
                              className={`rep-status ${
                                representative.status ===
                                "active"
                                  ? "active"
                                  : "inactive"
                              }`}
                            >
                              {representative.status ===
                              "active"
                                ? "نشط"
                                : "موقوف"}
                            </span>
                          </td>

                          <td>
                            {canManageDirectory && (
                              <button
                                type="button"
                                className="rep-edit-button"
                                title="تعديل"
                                onClick={() =>
                                  openEdit(
                                    representative
                                  )
                                }
                              >
                                <Edit3
                                  size={15}
                                />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===================================================
          REPRESENTATIVE FORM
      =================================================== */}

      {formOpen && (
        <div className="rep-modal-backdrop">
          <form
            className="rep-form-modal"
            onSubmit={
              handleSaveRepresentative
            }
          >
            <div className="rep-form-header">
              <div>
                <h2>
                  {editing
                    ? "تعديل بيانات المندوب"
                    : "إضافة مندوب"}
                </h2>

                <span>
                  البيانات الأساسية وسياسة الزيارة
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setFormOpen(
                    false
                  )
                }
              >
                <X
                  size={19}
                />
              </button>
            </div>

            <div className="rep-form-content">

              {/* NAME */}

              <label>
                <span>
                  اسم المندوب
                </span>

                <input
                  required
                  autoFocus
                  value={
                    form.name
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,

                      name:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              {/* PHONE */}

              <label>
                <span>
                  رقم الهاتف
                </span>

                <input
                  required
                  dir="ltr"
                  value={
                    form.phone
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,

                      phone:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              {/* TYPE */}

              <label>
                <span>
                  نوع الجهة
                </span>

                <select
                  value={
                    form.organizationType
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,

                      organizationType:
                        event.target
                          .value,
                    })
                  }
                >
                  {REPRESENTATIVE_TYPES.map(
                    (type) => (
                      <option
                        key={
                          type.value
                        }
                        value={
                          type.value
                        }
                      >
                        {
                          type.label
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              {/* ORGANIZATION */}

              <label>
                <span>
                  اسم الشركة / المعمل / الجهة
                </span>

                <input
                  required
                  value={
                    form.organizationName
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,

                      organizationName:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              {/* DOCTOR */}

              <label>
                <span>
                  الطبيب
                </span>

                <select
                  required
                  value={
                    form.assignedDoctorId
                  }
                  onChange={(
                    event
                  ) =>
                    handleFormDoctor(
                      event.target
                        .value
                    )
                  }
                >
                  <option value="">
                    اختر الطبيب
                  </option>

                  {doctors.map(
                    (doctor) => (
                      <option
                        key={
                          doctor.id
                        }
                        value={
                          doctor.id
                        }
                      >
                        {
                          doctor.name
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              {/* MONTHLY LIMIT */}

              <label>
                <span>
                  الزيارات المسموحة شهرياً
                </span>

                <input
                  type="number"
                  min="0"
                  value={
                    form.maxVisitsPerMonth
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,

                      maxVisitsPerMonth:
                        event.target
                          .value,
                    })
                  }
                />

                <small>
                  0 = بدون حد شهري
                </small>
              </label>

              {/* NOTES */}

              <label className="rep-full-field">
                <span>
                  ملاحظات
                </span>

                <textarea
                  rows="3"
                  value={
                    form.notes
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,

                      notes:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              {/* STATUS */}

              {editing && (
                <label>
                  <span>
                    الحالة
                  </span>

                  <select
                    value={
                      form.status
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,

                        status:
                          event.target
                            .value,
                      })
                    }
                  >
                    <option value="active">
                      نشط
                    </option>

                    <option value="inactive">
                      موقوف
                    </option>
                  </select>
                </label>
              )}
            </div>

            <div className="rep-form-footer">
              <button
                type="button"
                onClick={() =>
                  setFormOpen(
                    false
                  )
                }
              >
                إلغاء
              </button>

              <button
                type="submit"
                className="primary"
                disabled={
                  pageBusy
                }
              >
                {pageBusy
                  ? "جاري الحفظ..."
                  : editing
                    ? "حفظ التعديلات"
                    : "إضافة المندوب"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================
          DAILY LIMIT MODAL
      =================================================== */}

      {limitModalOpen && (
        <div className="rep-modal-backdrop">
          <div className="rep-limit-modal">

            <div className="rep-limit-modal-head">
              <div>
                <h3>
                  الحد اليومي للمندوبين
                </h3>

                <p>
                  أقصى عدد زيارات يستقبلها{" "}
                  {selectedDoctor?.name ||
                    "الطبيب"}{" "}
                  يومياً
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setLimitModalOpen(
                    false
                  )
                }
              >
                <X
                  size={18}
                />
              </button>
            </div>

            <div className="rep-limit-modal-body">
              <label>
                عدد الزيارات اليومية
              </label>

              <div className="rep-limit-input">

                <button
                  type="button"
                  onClick={
                    decreaseLimit
                  }
                >
                  <Minus
                    size={18}
                  />
                </button>

                <input
                  type="number"
                  min="1"
                  max="100"
                  value={
                    dailyLimitInput
                  }
                  onChange={(
                    event
                  ) =>
                    setDailyLimitInput(
                      event.target
                        .value
                    )
                  }
                />

                <button
                  type="button"
                  onClick={
                    increaseLimit
                  }
                >
                  <Plus
                    size={18}
                  />
                </button>
              </div>

              <div className="rep-limit-example">
                <span>
                  الحد الحالي
                </span>

                <strong>
                  {dailyLimitInput ||
                    0}{" "}
                  زيارة / يوم
                </strong>
              </div>
            </div>

            <div className="rep-limit-modal-actions">
              <button
                type="button"
                onClick={() =>
                  setLimitModalOpen(
                    false
                  )
                }
              >
                إلغاء
              </button>

              <button
                type="button"
                className="save"
                disabled={
                  pageBusy
                }
                onClick={
                  handleSaveDailyLimit
                }
              >
                {pageBusy
                  ? "جاري الحفظ..."
                  : "حفظ الحد"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({
  title,
  text,
}) {
  return (
    <div className="rep-empty-state">
      <Users
        size={25}
      />

      <strong>
        {title}
      </strong>

      <span>
        {text}
      </span>
    </div>
  );
}