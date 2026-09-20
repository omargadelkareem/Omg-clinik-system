import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  Check,
  Download,
  FileSpreadsheet,
  Heart,
  Loader2,
  MoreHorizontal,
  Pencil,
  Pill,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import * as XLSX from "xlsx";

import {
  get,
  onValue,
  ref,
} from "firebase/database";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  auth,
  database,
} from "../../config/firebase";

import {
  createDrug,
  deleteDrug as deleteDrugFromFirebase,
  drugExists,
  importDrugs,
  setDrugFavorite,
  subscribeDrugLibrary,
  updateDrug,
} from "../../services/drugLibraryService";

import "./DrugLibraryPage.css";

/* =========================================================
   EMPTY DRUG
========================================================= */

const emptyDrug = {
  tradeName: "",
  genericName: "",
  strength: "",
  form: "Tablet",
  route: "Oral",
  defaultDose: "",
  frequency: "",
  duration: "",
  instructions: "",
  favorite: false,
  usageCount: 0,
};

/* =========================================================
   OPTIONS
========================================================= */

const forms = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Injection",
  "Drops",
  "Cream",
  "Ointment",
  "Inhaler",
  "Suppository",
  "Sachet",
  "Solution",
  "Other",
];

const routes = [
  "Oral",
  "Injection",
  "Topical",
  "Inhalation",
  "Eye",
  "Ear",
  "Nasal",
  "Rectal",
  "Other",
];

/* =========================================================
   PAGE
========================================================= */

export default function DrugLibraryPage() {
  const fileInputRef = useRef(null);

  /* =======================================================
     CLINIC
  ======================================================= */

  const [clinicId, setClinicId] = useState("");
  const [currentUserId, setCurrentUserId] =
    useState("");

  const [clinicLoading, setClinicLoading] =
    useState(true);

  /* =======================================================
     DRUGS
  ======================================================= */

  const [drugs, setDrugs] = useState([]);
  const [drugsLoading, setDrugsLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState("");

  /* =======================================================
     FILTERS
  ======================================================= */

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] =
    useState("all");

  /* =======================================================
     SELECTION
  ======================================================= */

  const [selectedDrugId, setSelectedDrugId] =
    useState("");

  /* =======================================================
     EDITOR
  ======================================================= */

  const [editorOpen, setEditorOpen] =
    useState(false);

  const [editingDrug, setEditingDrug] =
    useState(null);

  const [drugForm, setDrugForm] =
    useState(emptyDrug);

  const [savingDrug, setSavingDrug] =
    useState(false);

  const [editorError, setEditorError] =
    useState("");

  /* =======================================================
     DELETE
  ======================================================= */

  const [deleteTarget, setDeleteTarget] =
    useState(null);

  const [deletingDrug, setDeletingDrug] =
    useState(false);

  /* =======================================================
     FAVORITE
  ======================================================= */

  const [favoriteLoadingId, setFavoriteLoadingId] =
    useState("");

  /* =======================================================
     IMPORT
  ======================================================= */

  const [importOpen, setImportOpen] =
    useState(false);

  const [importRows, setImportRows] =
    useState([]);

  const [importFileName, setImportFileName] =
    useState("");

  const [importError, setImportError] =
    useState("");

  const [importSuccess, setImportSuccess] =
    useState("");

  const [importing, setImporting] =
    useState(false);

  /* =======================================================
     GLOBAL MESSAGE
  ======================================================= */

  const [pageMessage, setPageMessage] =
    useState(null);

  /* =======================================================
     RESOLVE CLINIC FROM LOGGED USER
  ======================================================= */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        setClinicLoading(true);
        setLoadError("");

        try {
          if (!user) {
            setClinicId("");
            setCurrentUserId("");
            setClinicLoading(false);

            return;
          }

          setCurrentUserId(user.uid);

          const userSnapshot = await get(
            ref(
              database,
              `users/${user.uid}`
            )
          );

          if (!userSnapshot.exists()) {
            throw new Error(
              "لم يتم العثور على بيانات المستخدم."
            );
          }

          const userData =
            userSnapshot.val() || {};

          let resolvedClinicId =
            String(
              userData.clinicId || ""
            ).trim();

          /*
           * Fallback:
           * لو المستخدم مربوط بأكثر من عيادة
           * ومافيش clinicId مباشر.
           */
          if (!resolvedClinicId) {
            const clinicsSnapshot = await get(
              ref(
                database,
                `userClinics/${user.uid}`
              )
            );

            if (clinicsSnapshot.exists()) {
              const clinics =
                clinicsSnapshot.val() || {};

              const firstClinicId =
                Object.keys(clinics)[0];

              if (firstClinicId) {
                resolvedClinicId =
                  firstClinicId;
              }
            }
          }

          if (!resolvedClinicId) {
            throw new Error(
              "لم يتم ربط هذا المستخدم بعيادة."
            );
          }

          setClinicId(
            resolvedClinicId
          );
        } catch (error) {
          console.error(
            "DrugLibrary clinic error:",
            error
          );

          setClinicId("");

          setLoadError(
            error?.message ||
              "تعذر تحديد العيادة الحالية."
          );
        } finally {
          setClinicLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  /* =======================================================
     REALTIME DRUG LIBRARY
  ======================================================= */

  useEffect(() => {
    if (!clinicId) {
      setDrugs([]);
      setDrugsLoading(false);
      return undefined;
    }

    setDrugsLoading(true);
    setLoadError("");

    let unsubscribe;

    try {
      unsubscribe =
        subscribeDrugLibrary(
          clinicId,

          (items) => {
            setDrugs(items);
            setDrugsLoading(false);
          },

          (error) => {
            console.error(
              "Drug library realtime error:",
              error
            );

            setLoadError(
              "تعذر تحميل مكتبة الأدوية."
            );

            setDrugsLoading(false);
          }
        );
    } catch (error) {
      console.error(
        "Drug subscription error:",
        error
      );

      setLoadError(
        error?.message ||
          "تعذر تحميل مكتبة الأدوية."
      );

      setDrugsLoading(false);
    }

    return () => {
      if (
        typeof unsubscribe ===
        "function"
      ) {
        unsubscribe();
      }
    };
  }, [clinicId]);

  /* =======================================================
     KEEP SELECTED DRUG VALID
  ======================================================= */

  useEffect(() => {
    if (!drugs.length) {
      setSelectedDrugId("");
      return;
    }

    const selectedStillExists =
      drugs.some(
        (drug) =>
          drug.id === selectedDrugId
      );

    if (!selectedStillExists) {
      setSelectedDrugId(
        drugs[0].id
      );
    }
  }, [drugs, selectedDrugId]);

  /* =======================================================
     SELECTED DRUG
  ======================================================= */

  const selectedDrug = useMemo(
    () =>
      drugs.find(
        (drug) =>
          drug.id === selectedDrugId
      ) || null,
    [drugs, selectedDrugId]
  );

  /* =======================================================
     FILTERED DRUGS
  ======================================================= */

  const filteredDrugs = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    let result = drugs.filter(
      (drug) => {
        const tradeName = String(
          drug.tradeName || ""
        ).toLowerCase();

        const genericName = String(
          drug.genericName || ""
        ).toLowerCase();

        const strength = String(
          drug.strength || ""
        ).toLowerCase();

        const searchMatch =
          !query ||
          tradeName.includes(query) ||
          genericName.includes(query) ||
          strength.includes(query);

        if (!searchMatch) {
          return false;
        }

        if (
          activeFilter ===
          "favorites"
        ) {
          return Boolean(
            drug.favorite
          );
        }

        if (
          activeFilter ===
          "most-used"
        ) {
          return (
            Number(
              drug.usageCount || 0
            ) > 0
          );
        }

        if (
          activeFilter ===
          "recent"
        ) {
          return true;
        }

        return true;
      }
    );

    if (
      activeFilter ===
      "most-used"
    ) {
      result = [...result].sort(
        (a, b) =>
          Number(
            b.usageCount || 0
          ) -
          Number(
            a.usageCount || 0
          )
      );
    }

    if (
      activeFilter === "recent"
    ) {
      result = [...result].sort(
        (a, b) =>
          Number(
            b.createdAt || 0
          ) -
          Number(
            a.createdAt || 0
          )
      );
    }

    return result;
  }, [
    drugs,
    search,
    activeFilter,
  ]);

  /* =======================================================
     COUNTERS
  ======================================================= */

  const favoriteCount =
    useMemo(
      () =>
        drugs.filter(
          (drug) =>
            drug.favorite
        ).length,
      [drugs]
    );

  /* =======================================================
     PAGE MESSAGE
  ======================================================= */

  const showPageMessage = (
    type,
    text
  ) => {
    setPageMessage({
      type,
      text,
    });

    window.clearTimeout(
      showPageMessage.timeout
    );

    showPageMessage.timeout =
      window.setTimeout(() => {
        setPageMessage(null);
      }, 3500);
  };

  /* =======================================================
     OPEN ADD
  ======================================================= */

  const openAddDrug = () => {
    setEditingDrug(null);

    setDrugForm({
      ...emptyDrug,
    });

    setEditorError("");

    setEditorOpen(true);
  };

  /* =======================================================
     OPEN EDIT
  ======================================================= */

  const openEditDrug = (drug) => {
    if (!drug) return;

    setEditingDrug(drug);

    setDrugForm({
      tradeName:
        drug.tradeName || "",

      genericName:
        drug.genericName || "",

      strength:
        drug.strength || "",

      form:
        drug.form || "Tablet",

      route:
        drug.route || "Oral",

      defaultDose:
        drug.defaultDose || "",

      frequency:
        drug.frequency || "",

      duration:
        drug.duration || "",

      instructions:
        drug.instructions || "",

      favorite: Boolean(
        drug.favorite
      ),

      usageCount: Number(
        drug.usageCount || 0
      ),
    });

    setEditorError("");

    setEditorOpen(true);
  };

  /* =======================================================
     SAVE DRUG
  ======================================================= */

  const saveDrug = async () => {
    if (savingDrug) return;

    if (!clinicId) {
      setEditorError(
        "لم يتم تحديد العيادة الحالية."
      );

      return;
    }

    if (
      !drugForm.tradeName.trim()
    ) {
      setEditorError(
        "اكتب الاسم التجاري للدواء."
      );

      return;
    }

    setSavingDrug(true);
    setEditorError("");

    try {
      const duplicate =
        await drugExists({
          clinicId,

          tradeName:
            drugForm.tradeName,

          strength:
            drugForm.strength,

          form:
            drugForm.form,

          excludeDrugId:
            editingDrug?.id || "",
        });

      if (duplicate) {
        setEditorError(
          "هذا الدواء موجود بالفعل بنفس الاسم والتركيز والشكل الدوائي."
        );

        return;
      }

      if (editingDrug) {
        await updateDrug({
          clinicId,

          drugId:
            editingDrug.id,

          drug: {
            ...drugForm,

            usageCount:
              editingDrug.usageCount ||
              0,
          },
        });

        setSelectedDrugId(
          editingDrug.id
        );

        showPageMessage(
          "success",
          "تم حفظ تعديلات الدواء."
        );
      } else {
        const created =
          await createDrug({
            clinicId,

            drug: {
              ...drugForm,

              usageCount: 0,
            },

            createdBy:
              currentUserId,
          });

        if (created?.id) {
          setSelectedDrugId(
            created.id
          );
        }

        showPageMessage(
          "success",
          "تمت إضافة الدواء إلى مكتبة العيادة."
        );
      }

      setEditorOpen(false);
      setEditingDrug(null);

      setDrugForm({
        ...emptyDrug,
      });
    } catch (error) {
      console.error(
        "saveDrug error:",
        error
      );

      setEditorError(
        error?.message ||
          "تعذر حفظ الدواء."
      );
    } finally {
      setSavingDrug(false);
    }
  };

  /* =======================================================
     DELETE
  ======================================================= */

  const handleDeleteDrug =
    async () => {
      if (
        !deleteTarget ||
        deletingDrug
      ) {
        return;
      }

      if (!clinicId) {
        return;
      }

      setDeletingDrug(true);

      try {
        await deleteDrugFromFirebase(
          {
            clinicId,

            drugId:
              deleteTarget.id,
          }
        );

        if (
          selectedDrugId ===
          deleteTarget.id
        ) {
          setSelectedDrugId("");
        }

        setDeleteTarget(null);

        showPageMessage(
          "success",
          "تم حذف الدواء من مكتبة العيادة."
        );
      } catch (error) {
        console.error(
          "deleteDrug error:",
          error
        );

        showPageMessage(
          "error",
          error?.message ||
            "تعذر حذف الدواء."
        );
      } finally {
        setDeletingDrug(false);
      }
    };

  /* =======================================================
     FAVORITE
  ======================================================= */

  const toggleFavorite =
    async (drug) => {
      if (
        !drug ||
        favoriteLoadingId
      ) {
        return;
      }

      if (!clinicId) {
        return;
      }

      setFavoriteLoadingId(
        drug.id
      );

      try {
        await setDrugFavorite({
          clinicId,

          drugId: drug.id,

          favorite:
            !drug.favorite,
        });
      } catch (error) {
        console.error(
          "favorite error:",
          error
        );

        showPageMessage(
          "error",
          "تعذر تحديث المفضلة."
        );
      } finally {
        setFavoriteLoadingId("");
      }
    };

  /* =======================================================
     EXCEL FILE
  ======================================================= */

  const handleFile =
    async (event) => {
      const file =
        event.target.files?.[0];

      if (!file) return;

      setImportError("");
      setImportSuccess("");
      setImportRows([]);

      setImportFileName(
        file.name
      );

      try {
        const extension =
          file.name
            .split(".")
            .pop()
            ?.toLowerCase();

        if (
          ![
            "xlsx",
            "xls",
            "xlsm",
            "xlsb",
            "csv",
          ].includes(extension)
        ) {
          throw new Error(
            "صيغة الملف غير مدعومة."
          );
        }

        const data =
          await file.arrayBuffer();

        const workbook =
          XLSX.read(data, {
            type: "array",
            cellDates: true,
          });

        const firstSheetName =
          workbook.SheetNames[0];

        if (!firstSheetName) {
          throw new Error(
            "الملف لا يحتوي على Sheet."
          );
        }

        const sheet =
          workbook.Sheets[
            firstSheetName
          ];

        const rows =
          XLSX.utils.sheet_to_json(
            sheet,
            {
              defval: "",
              raw: false,
            }
          );

        if (!rows.length) {
          throw new Error(
            "الملف فارغ."
          );
        }

        const normalized =
          rows
            .map(
              (row, index) =>
                normalizeImportedDrug(
                  row,
                  index
                )
            )
            .filter(
              (row) =>
                row.tradeName
            );

        if (!normalized.length) {
          throw new Error(
            "لم أجد عمود اسم الدواء. راجع أسماء الأعمدة المطلوبة."
          );
        }

        setImportRows(
          normalized
        );
      } catch (error) {
        console.error(
          "Excel read error:",
          error
        );

        setImportError(
          error?.message ||
            "تعذر قراءة الملف."
        );
      } finally {
        event.target.value = "";
      }
    };

  /* =======================================================
     IMPORT TO FIREBASE
  ======================================================= */

  const confirmImport =
    async () => {
      if (
        !importRows.length ||
        importing
      ) {
        return;
      }

      if (!clinicId) {
        setImportError(
          "لم يتم تحديد العيادة الحالية."
        );

        return;
      }

      setImporting(true);
      setImportError("");
      setImportSuccess("");

      try {
        const result =
          await importDrugs({
            clinicId,

            drugs: importRows,

            createdBy:
              currentUserId,
          });

        const addedCount =
          Number(
            result?.addedCount || 0
          );

        const duplicateCount =
          Number(
            result?.duplicateCount ||
              0
          );

        setImportSuccess(
          `تمت إضافة ${addedCount} دواء${
            duplicateCount
              ? ` وتجاهل ${duplicateCount} مكرر`
              : ""
          }.`
        );

        setImportRows([]);

        showPageMessage(
          "success",
          `تم استيراد ${addedCount} دواء إلى مكتبة العيادة.`
        );
      } catch (error) {
        console.error(
          "confirmImport error:",
          error
        );

        setImportError(
          error?.message ||
            "تعذر استيراد الأدوية."
        );
      } finally {
        setImporting(false);
      }
    };

  /* =======================================================
     DOWNLOAD TEMPLATE
  ======================================================= */

  const downloadTemplate = () => {
    const template = [
      {
        "Trade Name":
          "Panadol",

        "Generic Name":
          "Paracetamol",

        Strength:
          "500 mg",

        Form:
          "Tablet",

        Route:
          "Oral",

        "Default Dose":
          "قرص واحد",

        Frequency:
          "مرتين يومياً",

        Duration:
          "5 أيام",

        Instructions:
          "بعد الأكل",
      },
    ];

    const worksheet =
      XLSX.utils.json_to_sheet(
        template
      );

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Drug Library"
    );

    XLSX.writeFile(
      workbook,
      "OMG-Clinic-Drug-Library-Template.xlsx"
    );
  };

  /* =======================================================
     LOADING CLINIC
  ======================================================= */

  if (clinicLoading) {
    return (
      <div className="drug-library-page">
        <div className="drug-empty-state">
          <Loader2
            size={38}
            className="drug-page-spinner"
          />

          <h3>
            جاري تجهيز مكتبة الأدوية
          </h3>

          <p>
            يتم تحديد العيادة الحالية...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     NO CLINIC
  ======================================================= */

  if (!clinicId) {
    return (
      <div className="drug-library-page">
        <div className="drug-empty-state">
          <AlertCircle size={38} />

          <h3>
            تعذر فتح مكتبة الأدوية
          </h3>

          <p>
            {loadError ||
              "هذا الحساب غير مرتبط بعيادة."}
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="drug-library-page">
      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="drug-library-header">
        <div className="drug-library-title">
          <span>
            DOCTOR MEDICATION WORKSPACE
          </span>

          <h1>
            مكتبة الأدوية
          </h1>

          <p>
            مكتبة أدوية العيادة للوصول السريع أثناء كتابة الروشتة
          </p>
        </div>

        <div className="drug-library-header-actions">
          <button
            className="import-drugs-button"
            onClick={() => {
              setImportOpen(true);
              setImportRows([]);
              setImportFileName("");
              setImportError("");
              setImportSuccess("");
            }}
          >
            <FileSpreadsheet
              size={17}
            />

            استيراد Excel
          </button>

          <button
            className="add-drug-button"
            onClick={openAddDrug}
          >
            <Plus size={17} />

            إضافة دواء
          </button>
        </div>
      </header>

      {/* ===================================================
          PAGE MESSAGE
      =================================================== */}

      {pageMessage && (
        <div
          className={`import-message ${pageMessage.type}`}
          style={{
            marginBottom: 14,
          }}
        >
          {pageMessage.type ===
          "success" ? (
            <Check size={17} />
          ) : (
            <AlertCircle
              size={17}
            />
          )}

          {pageMessage.text}
        </div>
      )}

      {/* ===================================================
          SEARCH
      =================================================== */}

      <section className="drug-search-desk">
        <div className="drug-master-search">
          <Search size={20} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="ابحث بالاسم التجاري، المادة الفعالة أو التركيز..."
          />

          {search && (
            <button
              onClick={() =>
                setSearch("")
              }
            >
              <X size={16} />
            </button>
          )}

          <span>
            <kbd>⌘</kbd>
            <kbd>K</kbd>
          </span>
        </div>

        <div className="library-quick-info">
          <div>
            <strong>
              {drugs.length}
            </strong>

            <span>
              دواء في مكتبة العيادة
            </span>
          </div>

          <i />

          <div>
            <strong>
              {favoriteCount}
            </strong>

            <span>
              في المفضلة
            </span>
          </div>
        </div>
      </section>

      {/* ===================================================
          FILTERS
      =================================================== */}

      <nav className="drug-library-tabs">
        <button
          className={
            activeFilter === "all"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveFilter("all")
          }
        >
          كل الأدوية

          <span>
            {drugs.length}
          </span>
        </button>

        <button
          className={
            activeFilter ===
            "favorites"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveFilter(
              "favorites"
            )
          }
        >
          <Heart size={14} />

          المفضلة

          <span>
            {favoriteCount}
          </span>
        </button>

        <button
          className={
            activeFilter ===
            "most-used"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveFilter(
              "most-used"
            )
          }
        >
          الأكثر استخداماً
        </button>

        <button
          className={
            activeFilter ===
            "recent"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveFilter(
              "recent"
            )
          }
        >
          أضيفت مؤخراً
        </button>
      </nav>

      {/* ===================================================
          WORKSPACE
      =================================================== */}

      <main className="drug-library-workspace">
        <section className="drug-shelf">
          <div className="drug-shelf-heading">
            <span>
              MEDICATION INDEX
            </span>

            <strong>
              {drugsLoading
                ? "جاري التحميل..."
                : `${filteredDrugs.length} نتيجة`}
            </strong>
          </div>

          <div className="drug-list-heading">
            <div>
              الدواء
            </div>

            <div>
              التركيز
            </div>

            <div>
              الشكل
            </div>

            <div>
              الاستخدام المعتاد
            </div>

            <div />
          </div>

          <div className="drug-list">
            {drugsLoading ? (
              <div className="drug-empty-state">
                <Loader2
                  size={38}
                  className="drug-page-spinner"
                />

                <h3>
                  جاري تحميل الأدوية
                </h3>

                <p>
                  يتم جلب مكتبة العيادة من Firebase...
                </p>
              </div>
            ) : loadError ? (
              <div className="drug-empty-state">
                <AlertCircle
                  size={38}
                />

                <h3>
                  تعذر تحميل الأدوية
                </h3>

                <p>
                  {loadError}
                </p>
              </div>
            ) : filteredDrugs.length ===
              0 ? (
              <div className="drug-empty-state">
                <Pill size={38} />

                <h3>
                  {drugs.length
                    ? "لا توجد أدوية مطابقة"
                    : "مكتبة الأدوية فارغة"}
                </h3>

                <p>
                  {drugs.length
                    ? "جرّب البحث باسم آخر أو غيّر الفلتر."
                    : "ابدأ بإضافة أول دواء أو استيراد مكتبة كاملة من Excel."}
                </p>

                <button
                  onClick={
                    openAddDrug
                  }
                >
                  <Plus size={15} />

                  إضافة دواء جديد
                </button>
              </div>
            ) : (
              filteredDrugs.map(
                (drug) => (
                  <DrugRow
                    key={drug.id}
                    drug={drug}
                    selected={
                      selectedDrugId ===
                      drug.id
                    }
                    favoriteLoading={
                      favoriteLoadingId ===
                      drug.id
                    }
                    onSelect={() =>
                      setSelectedDrugId(
                        drug.id
                      )
                    }
                    onFavorite={() =>
                      toggleFavorite(
                        drug
                      )
                    }
                    onEdit={() =>
                      openEditDrug(
                        drug
                      )
                    }
                    onDelete={() =>
                      setDeleteTarget(
                        drug
                      )
                    }
                  />
                )
              )
            )}
          </div>
        </section>

        {/* =================================================
            DRUG SHEET
        ================================================= */}

        <aside className="drug-sheet">
          {selectedDrug ? (
            <>
              <div className="drug-sheet-top">
                <span>
                  DRUG SHEET
                </span>

                <div>
                  <button
                    className={
                      selectedDrug.favorite
                        ? "favorite active"
                        : "favorite"
                    }
                    disabled={
                      favoriteLoadingId ===
                      selectedDrug.id
                    }
                    onClick={() =>
                      toggleFavorite(
                        selectedDrug
                      )
                    }
                  >
                    {favoriteLoadingId ===
                    selectedDrug.id ? (
                      <Loader2
                        size={18}
                        className="drug-page-spinner"
                      />
                    ) : (
                      <Heart
                        size={18}
                        fill={
                          selectedDrug.favorite
                            ? "currentColor"
                            : "none"
                        }
                      />
                    )}
                  </button>

                  <button>
                    <MoreHorizontal
                      size={19}
                    />
                  </button>
                </div>
              </div>

              <div className="drug-sheet-identity">
                <div className="drug-symbol">
                  <Pill
                    size={26}
                  />
                </div>

                <div>
                  <span>
                    TRADE NAME
                  </span>

                  <h2>
                    {
                      selectedDrug.tradeName
                    }
                  </h2>

                  <strong>
                    {selectedDrug.strength ||
                      "—"}
                  </strong>
                </div>
              </div>

              <div className="drug-generic-name">
                <span>
                  المادة الفعالة
                </span>

                <strong>
                  {selectedDrug.genericName ||
                    "—"}
                </strong>
              </div>

              <div className="drug-sheet-properties">
                <DrugProperty
                  label="الشكل الدوائي"
                  value={
                    selectedDrug.form
                  }
                />

                <DrugProperty
                  label="طريقة الاستخدام"
                  value={
                    selectedDrug.route
                  }
                />

                <DrugProperty
                  label="مرات الاستخدام"
                  value={`${Number(
                    selectedDrug.usageCount ||
                      0
                  )} مرة`}
                />
              </div>

              <div className="default-prescription">
                <div className="default-rx-heading">
                  <span>
                    DEFAULT PRESCRIPTION
                  </span>

                  <strong>
                    الوصفة الافتراضية
                  </strong>
                </div>

                <div className="default-rx-line">
                  <span>
                    الجرعة
                  </span>

                  <strong>
                    {selectedDrug.defaultDose ||
                      "غير محدد"}
                  </strong>
                </div>

                <div className="default-rx-line">
                  <span>
                    التكرار
                  </span>

                  <strong>
                    {selectedDrug.frequency ||
                      "غير محدد"}
                  </strong>
                </div>

                <div className="default-rx-line">
                  <span>
                    المدة
                  </span>

                  <strong>
                    {selectedDrug.duration ||
                      "غير محدد"}
                  </strong>
                </div>

                <div className="default-rx-line instruction">
                  <span>
                    تعليمات
                  </span>

                  <strong>
                    {selectedDrug.instructions ||
                      "لا توجد تعليمات افتراضية"}
                  </strong>
                </div>
              </div>

              <div className="drug-sheet-note">
                <AlertCircle
                  size={15}
                />

                <p>
                  هذه البيانات اختصارات خاصة بالعيادة لتسريع كتابة الروشتة ويمكن للطبيب تعديل الجرعة والتعليمات داخل كل وصفة قبل اعتمادها.
                </p>
              </div>

              <div className="drug-sheet-actions">
                <button
                  className="edit-selected-drug"
                  onClick={() =>
                    openEditDrug(
                      selectedDrug
                    )
                  }
                >
                  <Pencil
                    size={16}
                  />

                  تعديل بيانات الدواء
                </button>

                <button
                  className="delete-selected-drug"
                  onClick={() =>
                    setDeleteTarget(
                      selectedDrug
                    )
                  }
                >
                  <Trash2
                    size={16}
                  />

                  حذف
                </button>
              </div>
            </>
          ) : (
            <div className="no-selected-drug">
              <Pill size={40} />

              <strong>
                {drugs.length
                  ? "اختر دواء"
                  : "المكتبة فارغة"}
              </strong>

              <span>
                {drugs.length
                  ? "ستظهر بياناته هنا"
                  : "أضف أول دواء إلى مكتبة العيادة"}
              </span>
            </div>
          )}
        </aside>
      </main>

      {/* ===================================================
          ADD / EDIT DRAWER
      =================================================== */}

      {editorOpen && (
        <div className="drug-editor-layer">
          <div
            className="drug-editor-overlay"
            onClick={() => {
              if (!savingDrug) {
                setEditorOpen(
                  false
                );
              }
            }}
          />

          <aside className="drug-editor">
            <header className="drug-editor-header">
              <div>
                <span>
                  {editingDrug
                    ? "EDIT MEDICATION"
                    : "NEW MEDICATION"}
                </span>

                <h2>
                  {editingDrug
                    ? "تعديل الدواء"
                    : "إضافة دواء للمكتبة"}
                </h2>

                <p>
                  سيتم حفظ الدواء داخل مكتبة هذه العيادة فقط.
                </p>
              </div>

              <button
                disabled={
                  savingDrug
                }
                onClick={() =>
                  setEditorOpen(
                    false
                  )
                }
              >
                <X size={19} />
              </button>
            </header>

            <div className="drug-editor-body">
              {editorError && (
                <div className="import-message error">
                  <AlertCircle
                    size={17}
                  />

                  {editorError}
                </div>
              )}

              <div className="editor-section-title">
                <span>
                  01
                </span>

                <div>
                  <strong>
                    تعريف الدواء
                  </strong>

                  <small>
                    البيانات الأساسية للبحث والوصول السريع
                  </small>
                </div>
              </div>

              <DrugField
                label="الاسم التجاري"
                required
              >
                <input
                  autoFocus
                  value={
                    drugForm.tradeName
                  }
                  onChange={(
                    event
                  ) =>
                    setDrugForm(
                      {
                        ...drugForm,

                        tradeName:
                          event
                            .target
                            .value,
                      }
                    )
                  }
                  placeholder="مثال: Panadol"
                />
              </DrugField>

              <DrugField label="المادة الفعالة">
                <input
                  value={
                    drugForm.genericName
                  }
                  onChange={(
                    event
                  ) =>
                    setDrugForm(
                      {
                        ...drugForm,

                        genericName:
                          event
                            .target
                            .value,
                      }
                    )
                  }
                  placeholder="Paracetamol"
                />
              </DrugField>

              <div className="drug-editor-grid">
                <DrugField label="التركيز">
                  <input
                    value={
                      drugForm.strength
                    }
                    onChange={(
                      event
                    ) =>
                      setDrugForm(
                        {
                          ...drugForm,

                          strength:
                            event
                              .target
                              .value,
                        }
                      )
                    }
                    placeholder="500 mg"
                  />
                </DrugField>

                <DrugField label="الشكل الدوائي">
                  <select
                    value={
                      drugForm.form
                    }
                    onChange={(
                      event
                    ) =>
                      setDrugForm(
                        {
                          ...drugForm,

                          form:
                            event
                              .target
                              .value,
                        }
                      )
                    }
                  >
                    {forms.map(
                      (form) => (
                        <option
                          key={
                            form
                          }
                        >
                          {form}
                        </option>
                      )
                    )}
                  </select>
                </DrugField>
              </div>

              <DrugField label="طريقة الاستخدام">
                <select
                  value={
                    drugForm.route
                  }
                  onChange={(
                    event
                  ) =>
                    setDrugForm(
                      {
                        ...drugForm,

                        route:
                          event
                            .target
                            .value,
                      }
                    )
                  }
                >
                  {routes.map(
                    (route) => (
                      <option
                        key={
                          route
                        }
                      >
                        {route}
                      </option>
                    )
                  )}
                </select>
              </DrugField>

              <div className="drug-editor-divider" />

              <div className="editor-section-title">
                <span>
                  02
                </span>

                <div>
                  <strong>
                    الوصفة التي تستخدمها غالباً
                  </strong>

                  <small>
                    يمكن للطبيب تغييرها أثناء الكشف
                  </small>
                </div>
              </div>

              <DrugField label="الجرعة الافتراضية">
                <input
                  value={
                    drugForm.defaultDose
                  }
                  onChange={(
                    event
                  ) =>
                    setDrugForm(
                      {
                        ...drugForm,

                        defaultDose:
                          event
                            .target
                            .value,
                      }
                    )
                  }
                  placeholder="مثال: قرص واحد"
                />
              </DrugField>

              <div className="drug-editor-grid">
                <DrugField label="التكرار">
                  <input
                    value={
                      drugForm.frequency
                    }
                    onChange={(
                      event
                    ) =>
                      setDrugForm(
                        {
                          ...drugForm,

                          frequency:
                            event
                              .target
                              .value,
                        }
                      )
                    }
                    placeholder="مرتين يومياً"
                  />
                </DrugField>

                <DrugField label="المدة">
                  <input
                    value={
                      drugForm.duration
                    }
                    onChange={(
                      event
                    ) =>
                      setDrugForm(
                        {
                          ...drugForm,

                          duration:
                            event
                              .target
                              .value,
                        }
                      )
                    }
                    placeholder="5 أيام"
                  />
                </DrugField>
              </div>

              <DrugField label="تعليمات الاستخدام">
                <textarea
                  value={
                    drugForm.instructions
                  }
                  onChange={(
                    event
                  ) =>
                    setDrugForm(
                      {
                        ...drugForm,

                        instructions:
                          event
                            .target
                            .value,
                      }
                    )
                  }
                  placeholder="مثال: بعد الأكل"
                />
              </DrugField>

              <label className="drug-favorite-option">
                <button
                  type="button"
                  className={
                    drugForm.favorite
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setDrugForm({
                      ...drugForm,

                      favorite:
                        !drugForm.favorite,
                    })
                  }
                >
                  <Heart
                    size={17}
                    fill={
                      drugForm.favorite
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>

                <span>
                  <strong>
                    إضافة للمفضلة
                  </strong>

                  <small>
                    يظهر الدواء ضمن اختصارات العيادة
                  </small>
                </span>
              </label>
            </div>

            <footer className="drug-editor-footer">
              <button
                className="cancel-drug-editor"
                disabled={
                  savingDrug
                }
                onClick={() =>
                  setEditorOpen(
                    false
                  )
                }
              >
                إلغاء
              </button>

              <button
                className="save-drug-editor"
                disabled={
                  savingDrug
                }
                onClick={
                  saveDrug
                }
              >
                {savingDrug ? (
                  <Loader2
                    size={16}
                    className="drug-page-spinner"
                  />
                ) : (
                  <Save
                    size={16}
                  />
                )}

                {savingDrug
                  ? "جاري الحفظ..."
                  : editingDrug
                    ? "حفظ التعديلات"
                    : "إضافة للمكتبة"}
              </button>
            </footer>
          </aside>
        </div>
      )}

      {/* ===================================================
          IMPORT EXCEL
      =================================================== */}

      {importOpen && (
        <div className="drug-import-layer">
          <div
            className="drug-import-overlay"
            onClick={() => {
              if (!importing) {
                setImportOpen(
                  false
                );
              }
            }}
          />

          <div className="drug-import-window">
            <header className="drug-import-header">
              <div>
                <span>
                  SMART EXCEL IMPORT
                </span>

                <h2>
                  استيراد مكتبة الأدوية
                </h2>

                <p>
                  ارفع ملف الأدوية وراجع البيانات قبل إضافتها إلى مكتبة العيادة.
                </p>
              </div>

              <button
                disabled={
                  importing
                }
                onClick={() =>
                  setImportOpen(
                    false
                  )
                }
              >
                <X size={19} />
              </button>
            </header>

            <div className="drug-import-content">
              <section className="import-control-panel">
                <div className="excel-illustration">
                  <FileSpreadsheet
                    size={33}
                  />

                  <div>
                    <strong>
                      Excel / CSV
                    </strong>

                    <span>
                      استيراد مجموعة كبيرة دفعة واحدة
                    </span>
                  </div>
                </div>

                <button
                  className="excel-drop-zone"
                  disabled={
                    importing
                  }
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >
                  <Upload
                    size={25}
                  />

                  <strong>
                    اختر ملف الأدوية
                  </strong>

                  <span>
                    XLSX • XLS • XLSM • XLSB • CSV
                  </span>

                  <small>
                    سيتم عرض Preview قبل الاعتماد
                  </small>
                </button>

                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  hidden
                  accept=".xlsx,.xls,.xlsm,.xlsb,.csv"
                  onChange={
                    handleFile
                  }
                />

                <div className="import-template-box">
                  <div>
                    <strong>
                      مش عارف ترتيب الأعمدة؟
                    </strong>

                    <span>
                      حمّل نموذج OMG الجاهز واملأ بياناتك.
                    </span>
                  </div>

                  <button
                    onClick={
                      downloadTemplate
                    }
                  >
                    <Download
                      size={14}
                    />

                    تحميل النموذج
                  </button>
                </div>

                <div className="supported-columns">
                  <span>
                    الأعمدة التي يتعرف عليها النظام
                  </span>

                  <div>
                    <i>
                      Trade Name
                    </i>

                    <i>
                      Generic Name
                    </i>

                    <i>
                      Strength
                    </i>

                    <i>
                      Form
                    </i>

                    <i>
                      Route
                    </i>

                    <i>
                      Default Dose
                    </i>

                    <i>
                      Frequency
                    </i>

                    <i>
                      Duration
                    </i>

                    <i>
                      Instructions
                    </i>
                  </div>
                </div>
              </section>

              <section className="import-preview-panel">
                <div className="import-preview-heading">
                  <div>
                    <span>
                      IMPORT PREVIEW
                    </span>

                    <strong>
                      معاينة البيانات
                    </strong>
                  </div>

                  {importFileName && (
                    <div className="selected-excel-file">
                      <FileSpreadsheet
                        size={15}
                      />

                      <span>
                        {
                          importFileName
                        }
                      </span>
                    </div>
                  )}
                </div>

                {importError && (
                  <div className="import-message error">
                    <AlertCircle
                      size={17}
                    />

                    {importError}
                  </div>
                )}

                {importSuccess && (
                  <div className="import-message success">
                    <Check
                      size={17}
                    />

                    {importSuccess}
                  </div>
                )}

                {!importRows.length &&
                !importError &&
                !importSuccess ? (
                  <div className="empty-import-preview">
                    <FileSpreadsheet
                      size={43}
                    />

                    <strong>
                      لم يتم اختيار ملف بعد
                    </strong>

                    <span>
                      بعد رفع الملف ستظهر أول البيانات هنا لمراجعتها قبل الاستيراد.
                    </span>
                  </div>
                ) : importRows.length ? (
                  <>
                    <div className="import-preview-summary">
                      <div>
                        <strong>
                          {
                            importRows.length
                          }
                        </strong>

                        <span>
                          صف جاهز للاستيراد
                        </span>
                      </div>

                      <p>
                        راجع الأسماء والتركيزات قبل الضغط على اعتماد الاستيراد.
                      </p>
                    </div>

                    <div className="import-table-wrap">
                      <table className="import-preview-table">
                        <thead>
                          <tr>
                            <th>
                              #
                            </th>

                            <th>
                              الاسم التجاري
                            </th>

                            <th>
                              المادة الفعالة
                            </th>

                            <th>
                              التركيز
                            </th>

                            <th>
                              الشكل
                            </th>

                            <th>
                              الجرعة
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {importRows
                            .slice(
                              0,
                              100
                            )
                            .map(
                              (
                                drug,
                                index
                              ) => (
                                <tr
                                  key={
                                    drug.importIndex
                                  }
                                >
                                  <td>
                                    {index +
                                      1}
                                  </td>

                                  <td>
                                    <strong>
                                      {
                                        drug.tradeName
                                      }
                                    </strong>
                                  </td>

                                  <td>
                                    {drug.genericName ||
                                      "—"}
                                  </td>

                                  <td>
                                    {drug.strength ||
                                      "—"}
                                  </td>

                                  <td>
                                    {drug.form ||
                                      "—"}
                                  </td>

                                  <td>
                                    {drug.defaultDose ||
                                      "—"}
                                  </td>
                                </tr>
                              )
                            )}
                        </tbody>
                      </table>
                    </div>

                    {importRows.length >
                      100 && (
                      <div className="import-more-rows">
                        يتم عرض أول 100 صف فقط في المعاينة، وسيتم استيراد باقي الصفوف عند الاعتماد.
                      </div>
                    )}
                  </>
                ) : null}
              </section>
            </div>

            <footer className="drug-import-footer">
              <span>
                لن يتم تعديل مكتبة العيادة قبل اعتماد الاستيراد.
              </span>

              <div>
                <button
                  className="cancel-import"
                  disabled={
                    importing
                  }
                  onClick={() =>
                    setImportOpen(
                      false
                    )
                  }
                >
                  إلغاء
                </button>

                <button
                  className="confirm-import"
                  disabled={
                    !importRows.length ||
                    importing
                  }
                  onClick={
                    confirmImport
                  }
                >
                  {importing ? (
                    <Loader2
                      size={16}
                      className="drug-page-spinner"
                    />
                  ) : (
                    <Check
                      size={16}
                    />
                  )}

                  {importing
                    ? "جاري الاستيراد..."
                    : "اعتماد الاستيراد"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* ===================================================
          DELETE
      =================================================== */}

      {deleteTarget && (
        <div className="delete-drug-layer">
          <div
            className="delete-drug-overlay"
            onClick={() => {
              if (!deletingDrug) {
                setDeleteTarget(
                  null
                );
              }
            }}
          />

          <div className="delete-drug-dialog">
            <div className="delete-drug-icon">
              <Trash2
                size={23}
              />
            </div>

            <h3>
              حذف الدواء؟
            </h3>

            <p>
              سيتم حذف{" "}
              <strong>
                {
                  deleteTarget.tradeName
                }
              </strong>{" "}
              من مكتبة العيادة.
            </p>

            <span>
              الروشتات القديمة التي استخدمت هذا الدواء لن تتأثر.
            </span>

            <div>
              <button
                disabled={
                  deletingDrug
                }
                onClick={() =>
                  setDeleteTarget(
                    null
                  )
                }
              >
                إلغاء
              </button>

              <button
                className="confirm-delete-drug"
                disabled={
                  deletingDrug
                }
                onClick={
                  handleDeleteDrug
                }
              >
                {deletingDrug
                  ? "جاري الحذف..."
                  : "حذف الدواء"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   DRUG ROW
========================================================= */

function DrugRow({
  drug,
  selected,
  favoriteLoading,
  onSelect,
  onFavorite,
  onEdit,
  onDelete,
}) {
  return (
    <div
      className={`drug-row ${
        selected ? "selected" : ""
      }`}
    >
      <button
        className="drug-row-main"
        onClick={onSelect}
      >
        <div className="drug-row-icon">
          <Pill size={17} />
        </div>

        <div>
          <strong>
            {drug.tradeName}
          </strong>

          <span>
            {drug.genericName ||
              "—"}
          </span>
        </div>
      </button>

      <button
        className="drug-row-strength"
        onClick={onSelect}
      >
        {drug.strength || "—"}
      </button>

      <button
        className="drug-row-form"
        onClick={onSelect}
      >
        {drug.form || "—"}
      </button>

      <button
        className="drug-row-rx"
        onClick={onSelect}
      >
        <strong>
          {drug.defaultDose ||
            "غير محدد"}
        </strong>

        <span>
          {drug.frequency ||
            "لا توجد وصفة افتراضية"}
        </span>
      </button>

      <div className="drug-row-actions">
        <button
          className={
            drug.favorite
              ? "drug-heart active"
              : "drug-heart"
          }
          disabled={
            favoriteLoading
          }
          onClick={
            onFavorite
          }
          title="المفضلة"
        >
          {favoriteLoading ? (
            <Loader2
              size={16}
              className="drug-page-spinner"
            />
          ) : (
            <Heart
              size={16}
              fill={
                drug.favorite
                  ? "currentColor"
                  : "none"
              }
            />
          )}
        </button>

        <button
          onClick={onEdit}
          title="تعديل"
        >
          <Pencil
            size={15}
          />
        </button>

        <button
          className="drug-delete-row"
          onClick={onDelete}
          title="حذف"
        >
          <Trash2
            size={15}
          />
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   PROPERTY
========================================================= */

function DrugProperty({
  label,
  value,
}) {
  return (
    <div className="drug-property">
      <span>
        {label}
      </span>

      <strong>
        {value || "—"}
      </strong>
    </div>
  );
}

/* =========================================================
   FIELD
========================================================= */

function DrugField({
  label,
  required = false,
  children,
}) {
  return (
    <label className="drug-editor-field">
      <span>
        {label}

        {required && (
          <i>*</i>
        )}
      </span>

      {children}
    </label>
  );
}

/* =========================================================
   IMPORT NORMALIZATION
========================================================= */

function normalizeImportedDrug(
  row,
  index
) {
  const getValue = (
    ...names
  ) => {
    for (const name of names) {
      const key =
        Object.keys(row).find(
          (currentKey) =>
            normalizeColumnName(
              currentKey
            ) ===
            normalizeColumnName(
              name
            )
        );

      if (
        key !== undefined &&
        row[key] !==
          undefined &&
        row[key] !== null
      ) {
        return String(
          row[key]
        ).trim();
      }
    }

    return "";
  };

  return {
    importIndex: index,

    tradeName:
      getValue(
        "Trade Name",
        "TradeName",
        "Drug Name",
        "DrugName",
        "Brand",
        "Brand Name",
        "Medicine",
        "Medicine Name",
        "اسم الدواء",
        "الاسم التجاري",
        "اسم تجاري"
      ),

    genericName:
      getValue(
        "Generic Name",
        "GenericName",
        "Generic",
        "Active Ingredient",
        "Ingredient",
        "المادة الفعالة",
        "الاسم العلمي"
      ),

    strength:
      getValue(
        "Strength",
        "Concentration",
        "Dose Strength",
        "التركيز"
      ),

    form:
      getValue(
        "Form",
        "Dosage Form",
        "Drug Form",
        "الشكل الدوائي",
        "الشكل"
      ) || "Tablet",

    route:
      getValue(
        "Route",
        "Administration Route",
        "طريقة الاستخدام"
      ) || "Oral",

    defaultDose:
      getValue(
        "Default Dose",
        "Dose",
        "Dosage",
        "الجرعة",
        "الجرعة الافتراضية"
      ),

    frequency:
      getValue(
        "Frequency",
        "Times",
        "التكرار",
        "عدد المرات"
      ),

    duration:
      getValue(
        "Duration",
        "Period",
        "المدة"
      ),

    instructions:
      getValue(
        "Instructions",
        "Notes",
        "Directions",
        "تعليمات",
        "التعليمات"
      ),

    favorite: false,
    usageCount: 0,
  };
}

/* =========================================================
   COLUMN NORMALIZATION
========================================================= */

function normalizeColumnName(
  value
) {
  return String(value)
    .toLowerCase()
    .replace(
      /[\s_\-./\\]+/g,
      ""
    )
    .trim();
}