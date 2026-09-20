import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  CircleCheck,
  Clock3,
  FileImage,
  FileText,
  FlaskConical,
  LoaderCircle,
  Microscope,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Stethoscope,
  Upload,
  UserRound,
  X,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

import {
  addMedicalFileResult,
  changeMedicalFileStatus,
  createMedicalFile,
  subscribeMedicalFilePatients,
  subscribeMedicalFiles,
} from "../../services/medicalFileService";

import "./MedicalFilesPage.css";

/* =========================================================
   CONSTANTS
========================================================= */

const LAB_TESTS = [
  "صورة دم كاملة CBC",
  "سكر صائم FBS",
  "سكر تراكمي HbA1c",
  "وظائف كبد",
  "وظائف كلى",
  "تحليل بول كامل",
  "تحليل براز",
  "دهون كاملة Lipid Profile",
  "TSH",
  "Free T3",
  "Free T4",
  "Vitamin D",
  "Vitamin B12",
  "Ferritin",
  "CRP",
  "ESR",
];

const RADIOLOGY_TESTS = [
  "أشعة X-Ray",
  "سونار Ultrasound",
  "أشعة مقطعية CT",
  "رنين مغناطيسي MRI",
  "دوبلر",
  "إيكو على القلب",
  "ماموجرام",
];

/* =========================================================
   HELPERS
========================================================= */

function getTimestamp(value) {
  if (!value) {
    return 0;
  }

  if (
    typeof value ===
    "number"
  ) {
    return value;
  }

  const parsed =
    new Date(value).getTime();

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}

function formatDate(value) {
  const timestamp =
    getTimestamp(value);

  if (!timestamp) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(
    new Date(timestamp)
  );
}

function formatTime(value) {
  const timestamp =
    getTimestamp(value);

  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(
    new Date(timestamp)
  );
}

function isToday(value) {
  const timestamp =
    getTimestamp(value);

  if (!timestamp) {
    return false;
  }

  const item =
    new Date(timestamp);

  const today =
    new Date();

  return (
    item.getDate() ===
      today.getDate() &&
    item.getMonth() ===
      today.getMonth() &&
    item.getFullYear() ===
      today.getFullYear()
  );
}

function getStatusMeta(status) {
  switch (status) {
    case "completed":
      return {
        label: "النتيجة جاهزة",
        className: "completed",
      };

    case "in-progress":
      return {
        label: "جاري التنفيذ",
        className: "progress",
      };

    case "cancelled":
      return {
        label: "ملغي",
        className: "cancelled",
      };

    default:
      return {
        label: "مطلوب",
        className: "requested",
      };
  }
}

function getCategoryMeta(
  category
) {
  if (
    category === "radiology"
  ) {
    return {
      label: "أشعة",
      icon: FileImage,
    };
  }

  return {
    label: "تحاليل",
    icon: FlaskConical,
  };
}

function getPriorityLabel(
  priority
) {
  if (priority === "urgent") {
    return "عاجل";
  }

  return "عادي";
}

function fileToBase64(file) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () =>
        resolve(
          reader.result
        );

      reader.onerror =
        reject;

      reader.readAsDataURL(
        file
      );
    }
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function MedicalFilesPage() {
  const navigate =
    useNavigate();

  const {
    clinicId,
    staffId,
    profile,
  } = useAuth();

  const [
    medicalFiles,
    setMedicalFiles,
  ] = useState([]);

  const [
    patients,
    setPatients,
  ] = useState({});

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("all");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("active");

  const [
    selectedItem,
    setSelectedItem,
  ] = useState(null);

  const [
    createOpen,
    setCreateOpen,
  ] = useState(false);

  const [
    resultOpen,
    setResultOpen,
  ] = useState(false);

  /* =======================================================
     REALTIME
  ======================================================= */

  useEffect(() => {
    if (!clinicId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const unsubscribeFiles =
      subscribeMedicalFiles(
        clinicId,

        (items) => {
          setMedicalFiles(
            items
          );

          setSelectedItem(
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

          setLoading(false);
        },

        (firebaseError) => {
          console.error(
            firebaseError
          );

          setError(
            "تعذر تحميل التحاليل والأشعة."
          );

          setLoading(false);
        }
      );

    const unsubscribePatients =
      subscribeMedicalFilePatients(
        clinicId,
        setPatients
      );

    return () => {
      unsubscribeFiles?.();
      unsubscribePatients?.();
    };
  }, [clinicId]);

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredItems =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return medicalFiles.filter(
        (item) => {
          if (
            categoryFilter !==
              "all" &&
            item.category !==
              categoryFilter
          ) {
            return false;
          }

          if (
            statusFilter ===
              "active" &&
            ![
              "requested",
              "in-progress",
            ].includes(
              item.status
            )
          ) {
            return false;
          }

          if (
            statusFilter ===
              "completed" &&
            item.status !==
              "completed"
          ) {
            return false;
          }

          if (
            statusFilter ===
              "today" &&
            !isToday(
              item.createdAt
            )
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const patient =
            patients[
              item.patientId
            ] || {};

          const text = [
            item.patientName,
            patient.name,
            item.patientCode,
            patient.patientCode,
            patient.phone,
            item.testName,
            item.doctorName,
            item.clinicalNotes,
            item.result?.summary,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return text.includes(
            query
          );
        }
      );
    }, [
      medicalFiles,
      patients,
      search,
      categoryFilter,
      statusFilter,
    ]);

  /* =======================================================
     STATS
  ======================================================= */

  const stats =
    useMemo(() => {
      const today =
        medicalFiles.filter(
          (item) =>
            isToday(
              item.createdAt
            )
        );

      return {
        today:
          today.length,

        waiting:
          medicalFiles.filter(
            (item) =>
              item.status ===
                "requested" ||
              item.status ===
                "in-progress"
          ).length,

        completed:
          medicalFiles.filter(
            (item) =>
              item.status ===
              "completed"
          ).length,

        urgent:
          medicalFiles.filter(
            (item) =>
              item.priority ===
                "urgent" &&
              item.status !==
                "completed" &&
              item.status !==
                "cancelled"
          ).length,
      };
    }, [medicalFiles]);

  /* =======================================================
     ACTIONS
  ======================================================= */

  const handleStart =
    async (item) => {
      try {
        await changeMedicalFileStatus(
          {
            clinicId,
            medicalFileId:
              item.id,
            status:
              "in-progress",
          }
        );
      } catch (err) {
        console.error(err);

        setError(
          "تعذر تحديث حالة الطلب."
        );
      }
    };

  const openResult = (
    item
  ) => {
    setSelectedItem(item);
    setResultOpen(true);
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="medical-files-state">
        <LoaderCircle
          className="medical-files-spinner"
          size={27}
        />

        <strong>
          جاري تحميل التحاليل
          والأشعة
        </strong>

        <span>
          يتم تجهيز السجل الطبي...
        </span>
      </div>
    );
  }

  return (
    <div className="medical-files-page">
      {/* HEADER */}

      <header className="mf-header">
        <div>
          <span className="mf-overline">
            INVESTIGATIONS
          </span>

          <h1>
            التحاليل والأشعة
          </h1>

          <p>
            متابعة طلبات الفحوصات
            والنتائج المرتبطة بملفات
            المرضى.
          </p>
        </div>

        <button
          className="mf-create-button"
          onClick={() =>
            setCreateOpen(true)
          }
        >
          <Plus size={17} />

          طلب جديد
        </button>
      </header>

      {error && (
        <div className="mf-error">
          <AlertCircle
            size={16}
          />

          <span>
            {error}
          </span>

          <button
            onClick={() =>
              setError("")
            }
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* OPERATING LINE */}

      <section className="mf-operating-line">
        <div>
          <span>
            طلبات اليوم
          </span>

          <strong>
            {stats.today}
          </strong>
        </div>

        <div>
          <span>
            قيد الانتظار
          </span>

          <strong>
            {stats.waiting}
          </strong>
        </div>

        <div>
          <span>
            نتائج مكتملة
          </span>

          <strong>
            {stats.completed}
          </strong>
        </div>

        <div
          className={
            stats.urgent
              ? "urgent"
              : ""
          }
        >
          <span>
            طلبات عاجلة
          </span>

          <strong>
            {stats.urgent}
          </strong>
        </div>
      </section>

      {/* TOOLBAR */}

      <section className="mf-toolbar">
        <div className="mf-search">
          <Search size={17} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="ابحث باسم المريض، رقم الملف أو اسم الفحص..."
          />

          {search && (
            <button
              onClick={() =>
                setSearch("")
              }
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="mf-filter-group">
          <div className="mf-switch">
            <button
              className={
                categoryFilter ===
                "all"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setCategoryFilter(
                  "all"
                )
              }
            >
              الكل
            </button>

            <button
              className={
                categoryFilter ===
                "lab"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setCategoryFilter(
                  "lab"
                )
              }
            >
              تحاليل
            </button>

            <button
              className={
                categoryFilter ===
                "radiology"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setCategoryFilter(
                  "radiology"
                )
              }
            >
              أشعة
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option value="active">
              الطلبات الحالية
            </option>

            <option value="today">
              اليوم
            </option>

            <option value="completed">
              النتائج المكتملة
            </option>

            <option value="all">
              كل السجل
            </option>
          </select>
        </div>
      </section>

      {/* LIST */}

      <section className="mf-record">
        <div className="mf-record-title">
          <div>
            <Microscope
              size={17}
            />

            <strong>
              سجل الفحوصات
            </strong>

            <span>
              {
                filteredItems.length
              }
            </span>
          </div>

          <small>
            اضغط على الطلب لعرض
            التفاصيل والنتيجة
          </small>
        </div>

        <div className="mf-table">
          <div className="mf-table-head">
            <span>
              المريض
            </span>

            <span>
              الفحص
            </span>

            <span>
              الطبيب
            </span>

            <span>
              تاريخ الطلب
            </span>

            <span>
              الأولوية
            </span>

            <span>
              الحالة
            </span>

            <span />
          </div>

          {filteredItems.length ===
          0 ? (
            <div className="mf-empty">
              <Microscope
                size={31}
              />

              <strong>
                لا توجد طلبات
              </strong>

              <p>
                لا توجد تحاليل أو أشعة
                مطابقة للفلاتر الحالية.
              </p>

              <button
                onClick={() =>
                  setCreateOpen(true)
                }
              >
                <Plus size={15} />

                إنشاء أول طلب
              </button>
            </div>
          ) : (
            <div className="mf-table-body">
              {filteredItems.map(
                (item) => (
                  <MedicalFileRow
                    key={
                      item.id
                    }
                    item={item}
                    patient={
                      patients[
                        item.patientId
                      ]
                    }
                    onOpen={() =>
                      setSelectedItem(
                        item
                      )
                    }
                  />
                )
              )}
            </div>
          )}
        </div>
      </section>

      {/* DETAILS */}

      {selectedItem && (
        <MedicalFileDrawer
          item={
            selectedItem
          }
          patient={
            patients[
              selectedItem.patientId
            ]
          }
          onClose={() =>
            setSelectedItem(
              null
            )
          }
          onPatient={() =>
            navigate(
              `/patients/${selectedItem.patientId}`
            )
          }
          onStart={() =>
            handleStart(
              selectedItem
            )
          }
          onResult={() =>
            openResult(
              selectedItem
            )
          }
        />
      )}

      {/* CREATE */}

      {createOpen && (
        <CreateMedicalFileModal
          clinicId={
            clinicId
          }
          staffId={
            staffId
          }
          profile={
            profile
          }
          patients={
            patients
          }
          onClose={() =>
            setCreateOpen(
              false
            )
          }
          onCreated={(
            item
          ) => {
            setCreateOpen(
              false
            );

            setSelectedItem(
              item
            );
          }}
        />
      )}

      {/* RESULT */}

      {resultOpen &&
        selectedItem && (
          <ResultModal
            clinicId={
              clinicId
            }
            staffId={
              staffId
            }
            item={
              selectedItem
            }
            onClose={() =>
              setResultOpen(
                false
              )
            }
            onSaved={() => {
              setResultOpen(
                false
              );
            }}
          />
        )}
    </div>
  );
}

/* =========================================================
   ROW
========================================================= */

function MedicalFileRow({
  item,
  patient,
  onOpen,
}) {
  const category =
    getCategoryMeta(
      item.category
    );

  const CategoryIcon =
    category.icon;

  const status =
    getStatusMeta(
      item.status
    );

  return (
    <button
      className="mf-row"
      onClick={onOpen}
    >
      <div className="mf-patient">
        <div className="mf-avatar">
          {(patient?.name ||
            item.patientName ||
            "م")[0]}
        </div>

        <div>
          <strong>
            {patient?.name ||
              item.patientName ||
              "مريض"}
          </strong>

          <span>
            {patient?.patientCode ||
              item.patientCode ||
              "بدون رقم ملف"}
          </span>
        </div>
      </div>

      <div className="mf-test">
        <span
          className={`mf-category-icon ${item.category}`}
        >
          <CategoryIcon
            size={15}
          />
        </span>

        <div>
          <strong>
            {item.testName}
          </strong>

          <span>
            {category.label}
          </span>
        </div>
      </div>

      <div className="mf-doctor">
        <Stethoscope
          size={14}
        />

        <span>
          {item.doctorName ||
            "غير محدد"}
        </span>
      </div>

      <div className="mf-date">
        <strong>
          {formatDate(
            item.createdAt
          )}
        </strong>

        <span>
          <Clock3
            size={11}
          />

          {formatTime(
            item.createdAt
          )}
        </span>
      </div>

      <div>
        <span
          className={`mf-priority ${item.priority}`}
        >
          {getPriorityLabel(
            item.priority
          )}
        </span>
      </div>

      <div>
        <span
          className={`mf-status ${status.className}`}
        >
          <i />

          {status.label}
        </span>
      </div>

      <div className="mf-open">
        <ChevronLeft
          size={17}
        />
      </div>
    </button>
  );
}

/* =========================================================
   DRAWER
========================================================= */

function MedicalFileDrawer({
  item,
  patient,
  onClose,
  onPatient,
  onStart,
  onResult,
}) {
  const category =
    getCategoryMeta(
      item.category
    );

  const CategoryIcon =
    category.icon;

  const status =
    getStatusMeta(
      item.status
    );

  const hasResult =
    item.status ===
    "completed";

  return (
    <div className="mf-drawer-layer">
      <button
        className="mf-drawer-overlay"
        onClick={onClose}
        aria-label="إغلاق"
      />

      <aside className="mf-drawer">
        <header className="mf-drawer-header">
          <div>
            <span>
              INVESTIGATION
            </span>

            <h2>
              تفاصيل الطلب
            </h2>
          </div>

          <button
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="mf-drawer-scroll">
          <section className="mf-drawer-patient">
            <div className="mf-large-avatar">
              {(patient?.name ||
                item.patientName ||
                "م")[0]}
            </div>

            <div>
              <span>
                المريض
              </span>

              <strong>
                {patient?.name ||
                  item.patientName}
              </strong>

              <small>
                {patient?.patientCode ||
                  item.patientCode ||
                  "بدون رقم ملف"}
              </small>
            </div>

            <button
              onClick={
                onPatient
              }
            >
              فتح الملف
              <ChevronLeft
                size={14}
              />
            </button>
          </section>

          <section className="mf-investigation-title">
            <div
              className={`mf-big-type ${item.category}`}
            >
              <CategoryIcon
                size={20}
              />
            </div>

            <div>
              <span>
                {category.label}
              </span>

              <h3>
                {item.testName}
              </h3>
            </div>

            <span
              className={`mf-status ${status.className}`}
            >
              <i />
              {status.label}
            </span>
          </section>

          <section className="mf-drawer-meta">
            <DrawerMeta
              icon={
                <Stethoscope
                  size={15}
                />
              }
              label="الطبيب"
              value={
                item.doctorName ||
                "غير محدد"
              }
            />

            <DrawerMeta
              icon={
                <CalendarDays
                  size={15}
                />
              }
              label="تاريخ الطلب"
              value={formatDate(
                item.createdAt
              )}
            />

            <DrawerMeta
              icon={
                <Activity
                  size={15}
                />
              }
              label="الأولوية"
              value={getPriorityLabel(
                item.priority
              )}
            />
          </section>

          {item.clinicalNotes && (
            <DrawerSection
              title="الملاحظات الإكلينيكية"
            >
              <p>
                {
                  item.clinicalNotes
                }
              </p>
            </DrawerSection>
          )}

          {item.instructions && (
            <DrawerSection
              title="تعليمات الفحص"
            >
              <p>
                {
                  item.instructions
                }
              </p>
            </DrawerSection>
          )}

          <DrawerSection
            title="النتيجة"
          >
            {!hasResult ? (
              <div className="mf-no-result">
                <FileText
                  size={23}
                />

                <strong>
                  لم تتم إضافة النتيجة
                  بعد
                </strong>

                <span>
                  يمكن إضافة تقرير
                  النتيجة وملف التحليل
                  أو الأشعة عند
                  استلامه.
                </span>
              </div>
            ) : (
              <div className="mf-result-content">
                {item.result
                  ?.summary && (
                  <div>
                    <span>
                      ملخص النتيجة
                    </span>

                    <p>
                      {
                        item.result
                          .summary
                      }
                    </p>
                  </div>
                )}

                {item.result
                  ?.notes && (
                  <div>
                    <span>
                      ملاحظات
                    </span>

                    <p>
                      {
                        item.result
                          .notes
                      }
                    </p>
                  </div>
                )}

                {item.result
                  ?.fileData && (
                  <a
                    className="mf-result-file"
                    href={
                      item.result
                        .fileData
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Paperclip
                      size={16}
                    />

                    <div>
                      <strong>
                        {item.result
                          .fileName ||
                          "ملف النتيجة"}
                      </strong>

                      <span>
                        فتح الملف
                      </span>
                    </div>

                    <ChevronLeft
                      size={16}
                    />
                  </a>
                )}
              </div>
            )}
          </DrawerSection>
        </div>

        <footer className="mf-drawer-footer">
          {item.status ===
            "requested" && (
            <button
              className="secondary"
              onClick={
                onStart
              }
            >
              بدء التنفيذ
            </button>
          )}

          {item.status !==
            "cancelled" && (
            <button
              className="primary"
              onClick={
                onResult
              }
            >
              <Upload
                size={15}
              />

              {hasResult
                ? "تعديل النتيجة"
                : "إضافة النتيجة"}
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}

function DrawerMeta({
  icon,
  label,
  value,
}) {
  return (
    <div className="mf-meta-item">
      <span>
        {icon}
      </span>

      <div>
        <small>
          {label}
        </small>

        <strong>
          {value}
        </strong>
      </div>
    </div>
  );
}

function DrawerSection({
  title,
  children,
}) {
  return (
    <section className="mf-drawer-section">
      <h4>
        {title}
      </h4>

      {children}
    </section>
  );
}

/* =========================================================
   CREATE MODAL
========================================================= */

function CreateMedicalFileModal({
  clinicId,
  staffId,
  profile,
  patients,
  onClose,
  onCreated,
}) {
  const patientList =
    useMemo(
      () =>
        Object.values(
          patients || {}
        ).sort((a, b) =>
          String(
            a.name || ""
          ).localeCompare(
            String(
              b.name || ""
            ),
            "ar"
          )
        ),
      [patients]
    );

  const [
    form,
    setForm,
  ] = useState({
    patientId: "",
    category: "lab",
    testName: "",
    priority: "normal",
    clinicalNotes: "",
    instructions: "",
  });

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const tests =
    form.category === "lab"
      ? LAB_TESTS
      : RADIOLOGY_TESTS;

  const updateForm = (
    field,
    value
  ) => {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  };

  const submit =
    async (event) => {
      event.preventDefault();

      if (
        !form.patientId
      ) {
        setError(
          "اختر المريض أولاً."
        );

        return;
      }

      if (
        !form.testName.trim()
      ) {
        setError(
          "اكتب اسم الفحص."
        );

        return;
      }

      const patient =
        patients[
          form.patientId
        ];

      try {
        setSaving(true);
        setError("");

        const item =
          await createMedicalFile(
            {
              clinicId,

              patientId:
                form.patientId,

              patientName:
                patient?.name ||
                "",

              patientCode:
                patient?.patientCode ||
                "",

              doctorId:
                staffId || "",

              doctorName:
                profile?.name ||
                profile?.fullName ||
                profile?.displayName ||
                "",

              category:
                form.category,

              testName:
                form.testName,

              priority:
                form.priority,

              clinicalNotes:
                form.clinicalNotes,

              instructions:
                form.instructions,

              createdBy:
                staffId || "",
            }
          );

        onCreated(item);
      } catch (err) {
        console.error(err);

        setError(
          "تعذر إنشاء الطلب."
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <div className="mf-modal-layer">
      <button
        className="mf-modal-overlay"
        onClick={onClose}
        aria-label="إغلاق"
      />

      <form
        className="mf-modal"
        onSubmit={submit}
      >
        <header>
          <div>
            <span>
              NEW REQUEST
            </span>

            <h2>
              طلب تحليل أو أشعة
            </h2>

            <p>
              إضافة فحص جديد إلى
              الملف الطبي للمريض.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="mf-modal-body">
          {error && (
            <div className="mf-form-error">
              {error}
            </div>
          )}

          <label className="mf-field">
            <span>
              المريض *
            </span>

            <select
              value={
                form.patientId
              }
              onChange={(event) =>
                updateForm(
                  "patientId",
                  event.target
                    .value
                )
              }
            >
              <option value="">
                اختر المريض
              </option>

              {patientList.map(
                (patient) => (
                  <option
                    key={
                      patient.id
                    }
                    value={
                      patient.id
                    }
                  >
                    {patient.name}
                    {patient.patientCode
                      ? ` — ${patient.patientCode}`
                      : ""}
                  </option>
                )
              )}
            </select>
          </label>

          <div className="mf-field">
            <span>
              نوع الفحص *
            </span>

            <div className="mf-type-selector">
              <button
                type="button"
                className={
                  form.category ===
                  "lab"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  updateForm(
                    "category",
                    "lab"
                  );

                  updateForm(
                    "testName",
                    ""
                  );
                }}
              >
                <FlaskConical
                  size={18}
                />

                <strong>
                  تحاليل
                </strong>

                <small>
                  Laboratory
                </small>
              </button>

              <button
                type="button"
                className={
                  form.category ===
                  "radiology"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  updateForm(
                    "category",
                    "radiology"
                  );

                  updateForm(
                    "testName",
                    ""
                  );
                }}
              >
                <FileImage
                  size={18}
                />

                <strong>
                  أشعة
                </strong>

                <small>
                  Radiology
                </small>
              </button>
            </div>
          </div>

          <label className="mf-field">
            <span>
              اسم الفحص *
            </span>

            <input
              list="mf-test-options"
              value={
                form.testName
              }
              onChange={(event) =>
                updateForm(
                  "testName",
                  event.target
                    .value
                )
              }
              placeholder="اكتب أو اختر اسم الفحص"
            />

            <datalist id="mf-test-options">
              {tests.map(
                (test) => (
                  <option
                    value={test}
                    key={test}
                  />
                )
              )}
            </datalist>
          </label>

          <label className="mf-field">
            <span>
              الأولوية
            </span>

            <select
              value={
                form.priority
              }
              onChange={(event) =>
                updateForm(
                  "priority",
                  event.target
                    .value
                )
              }
            >
              <option value="normal">
                عادي
              </option>

              <option value="urgent">
                عاجل
              </option>
            </select>
          </label>

          <label className="mf-field">
            <span>
              ملاحظات إكلينيكية
            </span>

            <textarea
              value={
                form.clinicalNotes
              }
              onChange={(event) =>
                updateForm(
                  "clinicalNotes",
                  event.target
                    .value
                )
              }
              placeholder="سبب طلب الفحص أو معلومات مهمة..."
            />
          </label>

          <label className="mf-field">
            <span>
              تعليمات للمريض
            </span>

            <textarea
              value={
                form.instructions
              }
              onChange={(event) =>
                updateForm(
                  "instructions",
                  event.target
                    .value
                )
              }
              placeholder="مثال: صيام 8 ساعات قبل التحليل"
            />
          </label>
        </div>

        <footer>
          <button
            type="button"
            className="cancel"
            onClick={onClose}
          >
            إلغاء
          </button>

          <button
            className="submit"
            disabled={saving}
          >
            {saving ? (
              <>
                <LoaderCircle
                  className="medical-files-spinner"
                  size={15}
                />

                جاري الحفظ
              </>
            ) : (
              <>
                <Plus size={15} />

                إنشاء الطلب
              </>
            )}
          </button>
        </footer>
      </form>
    </div>
  );
}

/* =========================================================
   RESULT MODAL
========================================================= */

function ResultModal({
  clinicId,
  staffId,
  item,
  onClose,
  onSaved,
}) {
  const [
    summary,
    setSummary,
  ] = useState(
    item.result?.summary ||
      ""
  );

  const [
    notes,
    setNotes,
  ] = useState(
    item.result?.notes ||
      ""
  );

  const [
    file,
    setFile,
  ] = useState(null);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const submit =
    async (event) => {
      event.preventDefault();

      if (
        !summary.trim() &&
        !file &&
        !item.result?.fileData
      ) {
        setError(
          "أضف ملخص النتيجة أو ملف النتيجة."
        );

        return;
      }

      try {
        setSaving(true);
        setError("");

        let fileData =
          item.result?.fileData ||
          "";

        let fileName =
          item.result?.fileName ||
          "";

        let fileType =
          item.result?.fileType ||
          "";

        if (file) {
          fileData =
            await fileToBase64(
              file
            );

          fileName =
            file.name;

          fileType =
            file.type;
        }

        await addMedicalFileResult(
          {
            clinicId,

            medicalFileId:
              item.id,

            summary,

            notes,

            fileName,
            fileData,
            fileType,

            addedBy:
              staffId || "",
          }
        );

        onSaved();
      } catch (err) {
        console.error(err);

        setError(
          "تعذر حفظ النتيجة."
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <div className="mf-modal-layer mf-result-modal-layer">
      <button
        className="mf-modal-overlay"
        onClick={onClose}
        aria-label="إغلاق"
      />

      <form
        className="mf-modal mf-result-modal"
        onSubmit={submit}
      >
        <header>
          <div>
            <span>
              RESULT
            </span>

            <h2>
              إضافة نتيجة الفحص
            </h2>

            <p>
              {item.testName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="mf-modal-body">
          {error && (
            <div className="mf-form-error">
              {error}
            </div>
          )}

          <label className="mf-field">
            <span>
              ملخص النتيجة
            </span>

            <textarea
              className="large"
              value={summary}
              onChange={(event) =>
                setSummary(
                  event.target.value
                )
              }
              placeholder="اكتب ملخص التقرير أو النتيجة..."
            />
          </label>

          <label className="mf-field">
            <span>
              ملاحظات إضافية
            </span>

            <textarea
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value
                )
              }
            />
          </label>

          <label className="mf-upload-box">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(event) =>
                setFile(
                  event.target
                    .files?.[0] ||
                    null
                )
              }
            />

            <Upload size={24} />

            <strong>
              {file
                ? file.name
                : "إرفاق نتيجة الفحص"}
            </strong>

            <span>
              PDF أو صورة التقرير
            </span>
          </label>

          {item.result
            ?.fileName &&
            !file && (
              <div className="mf-existing-file">
                <Paperclip
                  size={15}
                />

                <span>
                  الملف الحالي:
                </span>

                <strong>
                  {
                    item.result
                      .fileName
                  }
                </strong>
              </div>
            )}
        </div>

        <footer>
          <button
            type="button"
            className="cancel"
            onClick={onClose}
          >
            إلغاء
          </button>

          <button
            className="submit"
            disabled={saving}
          >
            {saving ? (
              <>
                <LoaderCircle
                  className="medical-files-spinner"
                  size={15}
                />

                جاري الحفظ
              </>
            ) : (
              <>
                <CircleCheck
                  size={15}
                />

                حفظ النتيجة
              </>
            )}
          </button>
        </footer>
      </form>
    </div>
  );
}