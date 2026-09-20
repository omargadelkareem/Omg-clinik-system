import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  FlaskConical,
  HeartPulse,
  Image,
  LoaderCircle,
  Pill,
  Plus,
  Printer,
  Save,
  Search,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react";

import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

import {
  subscribeToPatient,
} from "../../services/patientService";

import {
  completeVisit,
  saveVisitDraft,
  subscribeDrugLibrary,
} from "../../services/visitService";

import "./NewVisitPage.css";
import "./MedicalOrders.css";

/* =========================================================
   INITIAL STATE
   ========================================================= */

const initialVisit = {
  complaint: "",
  duration: "",
  history: "",

  pressure: "",
  pulse: "",
  temperature: "",
  spo2: "",
  weight: "",

  examination: "",
  diagnosis: "",
  notes: "",

  followUp: "",
  prescriptionNotes: "",

  medicines: [],
  investigations: [],
};

/* =========================================================
   HELPERS
   ========================================================= */

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;

  const birth = new Date(dateOfBirth);

  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const today = new Date();

  let age =
    today.getFullYear() -
    birth.getFullYear();

  const month =
    today.getMonth() -
    birth.getMonth();

  if (
    month < 0 ||
    (month === 0 &&
      today.getDate() <
        birth.getDate())
  ) {
    age--;
  }

  return Math.max(age, 0);
}

function genderLabel(gender) {
  if (gender === "male") return "ذكر";
  if (gender === "female") return "أنثى";

  return "";
}

function getInitials(name = "") {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
}

function toArray(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "object") {
    return Object.values(value).filter(
      Boolean
    );
  }

  return [value];
}

const COMMON_TESTS = {
  lab: [
    "CBC",
    "HbA1c",
    "Fasting Blood Sugar",
    "Random Blood Sugar",
    "Lipid Profile",
    "Liver Function Tests",
    "Kidney Function Tests",
    "TSH",
    "Free T4",
    "Vitamin D",
    "Ferritin",
    "CRP",
    "ESR",
    "Urine Analysis",
    "Stool Analysis",
  ],
  imaging: [
    "X-Ray Chest",
    "X-Ray",
    "Ultrasound Abdomen",
    "Ultrasound Pelvis",
    "CT Brain",
    "CT Chest",
    "CT Abdomen",
    "MRI Brain",
    "MRI Spine",
    "Echocardiography",
    "Doppler",
  ],
};

const emptyInvestigation = {
  type: "lab",
  name: "",
  priority: "normal",
  instructions: "",
};

/* =========================================================
   PAGE
   ========================================================= */

export default function NewVisitPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { patientId } =
    useParams();

  const appointmentId =
    location.state?.appointmentId || "";

  const queueId =
    location.state?.queueId || "";

  const fromQueue =
    Boolean(
      location.state?.fromQueue ||
      queueId
    );

  const source =
    location.state?.source ||
    (queueId
      ? "queue"
      : appointmentId
        ? "appointment"
        : "direct");

  const {
  clinicId,
  profile,
  staffId,
} = useAuth();

const doctor = useMemo(
  () => ({
    id:
      staffId ||
      profile?.staffId ||
      profile?.uid ||
      "",

    name:
      profile?.name ||
      profile?.fullName ||
      profile?.displayName ||
      "الطبيب",
  }),
  [staffId, profile]
);

  const [patient, setPatient] =
    useState(null);

  const [patientLoading, setPatientLoading] =
    useState(true);

  const [visit, setVisit] =
    useState(initialVisit);

  const [drugLibrary, setDrugLibrary] =
    useState([]);

  const [drugSearch, setDrugSearch] =
    useState("");

  const [drugSearchOpen, setDrugSearchOpen] =
    useState(false);

  const [draftId, setDraftId] =
    useState(null);

  const [saving, setSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [finishOpen, setFinishOpen] =
    useState(false);

  const [newDrugOpen, setNewDrugOpen] =
    useState(false);

  const [
    investigationOpen,
    setInvestigationOpen,
  ] = useState(false);

  const [
    investigationSearch,
    setInvestigationSearch,
  ] = useState("");

  const [
    investigationDraft,
    setInvestigationDraft,
  ] = useState(emptyInvestigation);

  const [
    selectedTests,
    setSelectedTests,
  ] = useState([]);

  const [error, setError] =
    useState("");

  const [newDrug, setNewDrug] =
    useState({
      name: "",
      generic: "",
      strength: "",
      form: "Tablet",
    });

  /* =======================================================
     PATIENT
     ======================================================= */

  useEffect(() => {
    if (!clinicId || !patientId) {
      return;
    }

    setPatientLoading(true);

    const unsubscribe =
      subscribeToPatient(
        clinicId,
        patientId,

        (data) => {
          setPatient(data);
          setPatientLoading(false);
        },

        () => {
          setError(
            "تعذر قراءة بيانات المريض."
          );

          setPatientLoading(false);
        }
      );

    return () =>
      unsubscribe?.();
  }, [
    clinicId,
    patientId,
  ]);

  /* =======================================================
     DRUG LIBRARY
     ======================================================= */

  useEffect(() => {
    if (!clinicId) return;

    const unsubscribe =
      subscribeDrugLibrary(
        clinicId,

        (drugs) => {
          setDrugLibrary(drugs);
        },

        (firebaseError) => {
          console.error(
            "Drug library error:",
            firebaseError
          );
        }
      );

    return () =>
      unsubscribe?.();
  }, [clinicId]);

  /* =======================================================
     VISIT STATE
     ======================================================= */

  const updateField = (
    field,
    value
  ) => {
    setVisit((current) => ({
      ...current,
      [field]: value,
    }));

    setSaved(false);
  };

  /* =======================================================
     DRUG SEARCH
     ======================================================= */

  const filteredDrugs = useMemo(
    () => {
      const query =
        drugSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return drugLibrary.slice(
          0,
          7
        );
      }

      return drugLibrary
        .filter((drug) => {
          const name = String(
            drug.name ||
              drug.tradeName ||
              ""
          ).toLowerCase();

          const generic = String(
            drug.generic ||
              drug.activeIngredient ||
              ""
          ).toLowerCase();

          return (
            name.includes(query) ||
            generic.includes(query)
          );
        })
        .slice(0, 10);
    },
    [
      drugSearch,
      drugLibrary,
    ]
  );

  const addMedicine = (
    drug
  ) => {
    const medicine = {
      id: `MED-${Date.now()}-${Math.random()}`,

      drugId: drug.id,

      name:
        drug.name ||
        drug.tradeName ||
        "",

      generic:
        drug.generic ||
        drug.activeIngredient ||
        "",

      strength:
        drug.strength || "",

      form:
        drug.form || "",

      dose:
        drug.defaultDose ||
        "قرص واحد",

      frequency:
        drug.defaultFrequency ||
        "مرتين يومياً",

      duration:
        drug.defaultDuration ||
        "5 أيام",

      instructions:
        drug.defaultInstructions ||
        "بعد الأكل",
    };

    setVisit((current) => ({
      ...current,

      medicines: [
        ...current.medicines,
        medicine,
      ],
    }));

    setDrugSearch("");
    setDrugSearchOpen(false);
    setSaved(false);
  };

  const updateMedicine = (
    medicineId,
    field,
    value
  ) => {
    setVisit((current) => ({
      ...current,

      medicines:
        current.medicines.map(
          (medicine) =>
            medicine.id ===
            medicineId
              ? {
                  ...medicine,
                  [field]: value,
                }
              : medicine
        ),
    }));

    setSaved(false);
  };

  const removeMedicine = (
    medicineId
  ) => {
    setVisit((current) => ({
      ...current,

      medicines:
        current.medicines.filter(
          (medicine) =>
            medicine.id !==
            medicineId
        ),
    }));

    setSaved(false);
  };

  const handleCustomDrug = () => {
    if (
      !newDrug.name.trim()
    ) {
      return;
    }

    addMedicine({
      id: `CUSTOM-${Date.now()}`,

      name:
        newDrug.name.trim(),

      generic:
        newDrug.generic.trim(),

      strength:
        newDrug.strength.trim(),

      form:
        newDrug.form,
    });

    setNewDrug({
      name: "",
      generic: "",
      strength: "",
      form: "Tablet",
    });

    setNewDrugOpen(false);
  };

  const availableTests = useMemo(() => {
    const query =
      investigationSearch
        .trim()
        .toLowerCase();

    return COMMON_TESTS[
      investigationDraft.type
    ].filter((name) =>
      !query ||
      name
        .toLowerCase()
        .includes(query)
    );
  }, [
    investigationDraft.type,
    investigationSearch,
  ]);

  const toggleSelectedTest = (name) => {
    setSelectedTests((current) =>
      current.includes(name)
        ? current.filter(
            (item) =>
              item !== name
          )
        : [...current, name]
    );
  };

  const addInvestigationRequests = () => {
    const manual =
      investigationDraft.name.trim();

    const names = [
      ...selectedTests,
    ];

    if (
      manual &&
      !names.includes(manual)
    ) {
      names.push(manual);
    }

    if (!names.length) return;

    const rows = names.map(
      (name, index) => ({
        id: `INV-${Date.now()}-${index}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,

        type:
          investigationDraft.type,

        name,

        priority:
          investigationDraft.priority,

        instructions:
          investigationDraft.instructions.trim(),

        status: "requested",
      })
    );

    setVisit((current) => ({
      ...current,

      investigations: [
        ...(current.investigations ||
          []),

        ...rows,
      ],
    }));

    setInvestigationDraft(
      emptyInvestigation
    );

    setInvestigationSearch("");
    setSelectedTests([]);
    setInvestigationOpen(false);
    setSaved(false);
  };

  const removeInvestigation = (
    investigationId
  ) => {
    setVisit((current) => ({
      ...current,

      investigations: (
        current.investigations ||
        []
      ).filter(
        (item) =>
          item.id !==
          investigationId
      ),
    }));

    setSaved(false);
  };

  /* =======================================================
     SAVE DRAFT
     ======================================================= */

  const handleSave = async () => {
  if (!patient || !clinicId) {
    return;
  }

  try {
    setSaving(true);
    setError("");

    const id =
      await saveVisitDraft({
        clinicId,

        draftId,

        patient,

        doctor,

        visit,

        appointmentId,

        queueId,

        source,
      });

    setDraftId(id);

    setSaved(true);

    window.setTimeout(() => {
      setSaved(false);
    }, 2000);
  } catch (error) {
    console.error(
      "Save visit draft error:",
      error
    );

    setError(
      "تعذر حفظ مسودة الكشف. حاول مرة أخرى."
    );
  } finally {
    setSaving(false);
  }
};

  /* =======================================================
     FINISH
     ======================================================= */

 const confirmFinish = async () => {
  if (!patient || !clinicId) {
    return;
  }

  if (!visit.diagnosis?.trim()) {
    setError(
      "اكتب التشخيص قبل إنهاء الكشف."
    );

    setFinishOpen(false);

    return;
  }

  try {
    setSaving(true);
    setError("");

    const result =
      await completeVisit({
        clinicId,

        patient,

        doctor,

        visit,

        draftId,

        appointmentId,

        queueId,

        source,
      });

    console.log(
      "Visit completed:",
      result
    );

    setFinishOpen(false);

    if (fromQueue) {
      navigate(
        "/queue",
        {
          replace: true,

          state: {
            visitCompleted: true,

            patientName:
              patient.name,

            visitId:
              result.visitId,

            prescriptionId:
              result.prescriptionId,

            medicalFileIds:
              result.medicalFileIds ||
              [],
          },
        }
      );

      return;
    }

    navigate(
      `/patients/${patient.id}`,
      {
        replace: true,

        state: {
          visitCompleted: true,

          visitId:
            result.visitId,

          prescriptionId:
            result.prescriptionId,

          medicalFileIds:
            result.medicalFileIds ||
            [],
        },
      }
    );
  } catch (error) {
    console.error(
      "Complete visit error:",
      error
    );

    setError(
      error?.message ===
        "Diagnosis is required."
        ? "اكتب التشخيص قبل إنهاء الكشف."
        : "حدث خطأ أثناء إنهاء الكشف. لم يتم فقد البيانات، حاول مرة أخرى."
    );
  } finally {
    setSaving(false);
  }
};

  const handlePrint = () => {
    window.print();
  };

  /* =======================================================
     LOADING
     ======================================================= */

  if (patientLoading) {
    return (
      <div className="visit-page-state">
        <LoaderCircle
          size={25}
          className="visit-spinner"
        />

        <strong>
          جاري فتح جلسة الكشف
        </strong>

        <span>
          يتم تحميل ملف المريض...
        </span>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="visit-page-state">
        <Stethoscope
          size={28}
        />

        <strong>
          المريض غير موجود
        </strong>

        <button
          onClick={() =>
            navigate("/patients")
          }
        >
          العودة للمرضى
        </button>
      </div>
    );
  }

  const age =
    calculateAge(
      patient.dateOfBirth
    );

  const allergies =
    toArray(
      patient.allergies
    );

  const chronic =
    toArray(
      patient.chronicDiseases
    );

  const currentMedications =
    toArray(
      patient.currentMedications
    );

  /* =======================================================
     UI
     ======================================================= */

  return (
    <div className="doctor-visit-page">
      {/* ===================================================
          TOP BAR
          =================================================== */}

      <header className="visit-topbar">
        <div className="visit-patient">
          <button
            className="visit-back"
            onClick={() =>
              navigate(
                `/patients/${patient.id}`
              )
            }
          >
            <ArrowRight
              size={17}
            />
          </button>

          <span className="visit-avatar">
            {getInitials(
              patient.name
            )}
          </span>

          <div>
            <div className="visit-patient-name">
              <h1>
                {patient.name}
              </h1>

              <span>
                كشف جاري
              </span>
            </div>

            <p>
              {patient.patientCode ||
                "بدون رقم ملف"}

              {age !== null &&
                ` · ${age} سنة`}

              {patient.gender &&
                ` · ${genderLabel(
                  patient.gender
                )}`}

              {patient.bloodType &&
                ` · ${patient.bloodType}`}
            </p>
          </div>
        </div>

        <div className="visit-top-actions">
          <button
            className="visit-draft-button"
            disabled={saving}
            onClick={
              handleSave
            }
          >
            {saving ? (
              <LoaderCircle
                size={15}
                className="visit-spinner"
              />
            ) : saved ? (
              <Check size={15} />
            ) : (
              <Save size={15} />
            )}

            {saved
              ? "تم الحفظ"
              : "حفظ"}
          </button>

          <button
            className="visit-finish-button"
            onClick={() =>
              setFinishOpen(true)
            }
          >
            <Check size={16} />
            إنهاء الكشف
          </button>
        </div>
      </header>

      {/* ===================================================
          IMPORTANT PATIENT INFO
          =================================================== */}

      {(allergies.length >
        0 ||
        chronic.length >
          0 ||
        currentMedications.length >
          0) && (
        <div className="visit-patient-alerts">
          {allergies.length >
            0 && (
            <span className="visit-alert-danger">
              <AlertTriangle
                size={14}
              />

              <b>
                حساسية:
              </b>

              {allergies.join(
                "، "
              )}
            </span>
          )}

          {chronic.length >
            0 && (
            <span>
              <HeartPulse
                size={14}
              />

              <b>
                مرض مزمن:
              </b>

              {chronic.join(
                "، "
              )}
            </span>
          )}

          {currentMedications.length >
            0 && (
            <span>
              <Pill size={14} />

              <b>
                علاج حالي:
              </b>

              {currentMedications.join(
                "، "
              )}
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="visit-error">
          <AlertTriangle
            size={15}
          />

          {error}
        </div>
      )}

      {/* ===================================================
          DESK
          =================================================== */}

      <div className="doctor-desk">
        {/* =================================================
            CONSULTATION
            ================================================= */}

        <main className="consultation-sheet">
          <div className="consultation-heading">
            <div>
              <span>
                زيارة اليوم
              </span>

              <h2>
                الكشف الطبي
              </h2>
            </div>

            <div className="consultation-doctor">
              <Stethoscope
                size={16}
              />

              <span>
                {profile?.name ||
                  "الطبيب"}
              </span>
            </div>
          </div>

          {/* COMPLAINT */}

          <VisitSection title="الشكوى">
            <div className="complaint-row">
              <textarea
                value={
                  visit.complaint
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "complaint",
                    event.target
                      .value
                  )
                }
                placeholder="ما الذي يعاني منه المريض؟"
              />

              <label className="duration-input">
                <span>
                  مدة الأعراض
                </span>

                <input
                  value={
                    visit.duration
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "duration",
                      event.target
                        .value
                    )
                  }
                  placeholder="مثال: 3 أيام"
                />
              </label>
            </div>

            <textarea
              className="secondary-textarea"
              value={
                visit.history
              }
              onChange={(
                event
              ) =>
                updateField(
                  "history",
                  event.target
                    .value
                )
              }
              placeholder="تفاصيل إضافية عن الحالة أو الأعراض المصاحبة..."
            />
          </VisitSection>

          {/* VITALS */}

          <VisitSection title="العلامات الحيوية">
            <div className="simple-vitals">
              <VitalField
                label="الضغط"
                value={
                  visit.pressure
                }
                placeholder="120/80"
                unit="mmHg"
                onChange={(
                  value
                ) =>
                  updateField(
                    "pressure",
                    value
                  )
                }
              />

              <VitalField
                label="النبض"
                value={
                  visit.pulse
                }
                placeholder="76"
                unit="bpm"
                onChange={(
                  value
                ) =>
                  updateField(
                    "pulse",
                    value
                  )
                }
              />

              <VitalField
                label="الحرارة"
                value={
                  visit.temperature
                }
                placeholder="37"
                unit="°C"
                onChange={(
                  value
                ) =>
                  updateField(
                    "temperature",
                    value
                  )
                }
              />

              <VitalField
                label="الأكسجين"
                value={
                  visit.spo2
                }
                placeholder="98"
                unit="%"
                onChange={(
                  value
                ) =>
                  updateField(
                    "spo2",
                    value
                  )
                }
              />

              <VitalField
                label="الوزن"
                value={
                  visit.weight
                }
                placeholder="78"
                unit="kg"
                onChange={(
                  value
                ) =>
                  updateField(
                    "weight",
                    value
                  )
                }
              />
            </div>
          </VisitSection>

          {/* EXAM + DIAGNOSIS */}

          <VisitSection title="الفحص والتشخيص">
            <div className="exam-diagnosis-grid">
              <label>
                <span>
                  الفحص السريري
                </span>

                <textarea
                  value={
                    visit.examination
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "examination",
                      event.target
                        .value
                    )
                  }
                  placeholder="نتائج الفحص السريري..."
                />
              </label>

              <div className="diagnosis-column">
                <label>
                  <span>
                    التشخيص
                  </span>

                  <input
                    className="diagnosis-field"
                    value={
                      visit.diagnosis
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "diagnosis",
                        event.target
                          .value
                      )
                    }
                    placeholder="التشخيص الأساسي..."
                  />
                </label>

                <label>
                  <span>
                    ملاحظات
                  </span>

                  <textarea
                    value={
                      visit.notes
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "notes",
                        event.target
                          .value
                      )
                    }
                    placeholder="ملاحظات إضافية..."
                  />
                </label>
              </div>
            </div>
          </VisitSection>

          {/* INVESTIGATIONS */}

          <VisitSection title="التحاليل والأشعة">
            <div className="investigation-head">
              <div>
                <strong>
                  طلبات الفحوصات
                </strong>

                <span>
                  تُحفظ مع الزيارة وتظهر
                  في ملف المريض تلقائيًا.
                </span>
              </div>

              <button
                className="add-investigation-button"
                onClick={() =>
                  setInvestigationOpen(
                    true
                  )
                }
              >
                <Plus size={15} />
                طلب تحليل / أشعة
              </button>
            </div>

            {(visit.investigations ||
              []).length === 0 ? (
              <div className="investigation-empty">
                <FlaskConical
                  size={20}
                />

                <span>
                  لا توجد فحوصات مطلوبة
                  في هذه الزيارة
                </span>
              </div>
            ) : (
              <div className="investigation-list">
                {visit.investigations.map(
                  (item) => (
                    <div
                      className="investigation-row"
                      key={item.id}
                    >
                      <span
                        className={`investigation-type ${item.type}`}
                      >
                        {item.type ===
                        "lab" ? (
                          <FlaskConical
                            size={15}
                          />
                        ) : (
                          <Image
                            size={15}
                          />
                        )}
                      </span>

                      <div className="investigation-main">
                        <strong>
                          {item.name}
                        </strong>

                        <span>
                          {item.type ===
                          "lab"
                            ? "تحليل"
                            : "أشعة"}

                          {item.instructions
                            ? ` · ${item.instructions}`
                            : ""}
                        </span>
                      </div>

                      <span
                        className={`investigation-priority ${item.priority}`}
                      >
                        {item.priority ===
                        "urgent"
                          ? "عاجل"
                          : "عادي"}
                      </span>

                      <button
                        className="investigation-remove"
                        onClick={() =>
                          removeInvestigation(
                            item.id
                          )
                        }
                      >
                        <Trash2
                          size={14}
                        />
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </VisitSection>

          {/* TREATMENT */}

          <VisitSection
            title="العلاج"
            last
          >
            <div className="medicine-toolbar">
              <div className="medicine-search">
                <Search
                  size={16}
                />

                <input
                  value={
                    drugSearch
                  }
                  onFocus={() =>
                    setDrugSearchOpen(
                      true
                    )
                  }
                  onChange={(
                    event
                  ) => {
                    setDrugSearch(
                      event.target
                        .value
                    );

                    setDrugSearchOpen(
                      true
                    );
                  }}
                  placeholder="ابحث عن دواء..."
                />

                {drugSearch && (
                  <button
                    onClick={() =>
                      setDrugSearch(
                        ""
                      )
                    }
                  >
                    <X
                      size={13}
                    />
                  </button>
                )}

                {drugSearchOpen && (
                  <div className="medicine-results">
                    {filteredDrugs.length >
                    0 ? (
                      filteredDrugs.map(
                        (drug) => (
                          <button
                            key={
                              drug.id
                            }
                            onClick={() =>
                              addMedicine(
                                drug
                              )
                            }
                          >
                            <div>
                              <strong>
                                {drug.name ||
                                  drug.tradeName}
                              </strong>

                              <span>
                                {drug.generic ||
                                  drug.activeIngredient}
                              </span>
                            </div>

                            <small>
                              {
                                drug.strength
                              }
                            </small>

                            <Plus
                              size={
                                15
                              }
                            />
                          </button>
                        )
                      )
                    ) : (
                      <div className="medicine-empty-search">
                        <span>
                          الدواء غير موجود
                        </span>

                        <button
                          onClick={() => {
                            setDrugSearchOpen(
                              false
                            );

                            setNewDrugOpen(
                              true
                            );
                          }}
                        >
                          إضافته يدويًا
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                className="manual-drug-button"
                onClick={() =>
                  setNewDrugOpen(
                    true
                  )
                }
              >
                <Plus size={15} />
                دواء يدوي
              </button>
            </div>

            {visit.medicines
              .length === 0 ? (
              <div className="no-medicines">
                <Pill
                  size={21}
                />

                <span>
                  لم تتم إضافة أدوية
                  للروشتة
                </span>
              </div>
            ) : (
              <div className="medicine-list">
                {visit.medicines.map(
                  (
                    medicine,
                    index
                  ) => (
                    <MedicineRow
                      key={
                        medicine.id
                      }
                      index={
                        index
                      }
                      medicine={
                        medicine
                      }
                      onChange={
                        updateMedicine
                      }
                      onRemove={
                        removeMedicine
                      }
                    />
                  )
                )}
              </div>
            )}

            <div className="visit-end-fields">
              <label>
                <span>
                  المتابعة
                </span>

                <input
                  value={
                    visit.followUp
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "followUp",
                      event.target
                        .value
                    )
                  }
                  placeholder="مثال: بعد أسبوعين"
                />
              </label>

              <label>
                <span>
                  تعليمات للمريض
                </span>

                <input
                  value={
                    visit.prescriptionNotes
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "prescriptionNotes",
                      event.target
                        .value
                    )
                  }
                  placeholder="تعليمات إضافية..."
                />
              </label>
            </div>
          </VisitSection>
        </main>

        {/* =================================================
            PRESCRIPTION
            ================================================= */}

        <aside className="live-prescription">
          <div className="rx-preview-heading">
            <div>
              <span>
                الروشتة
              </span>

              <strong>
                معاينة الطباعة
              </strong>
            </div>

            <button
              onClick={
                handlePrint
              }
            >
              <Printer
                size={15}
              />
              طباعة
            </button>
          </div>

          <PrescriptionPaper
            patient={patient}
            age={age}
            visit={visit}
            doctorName={
              profile?.name ||
              "الطبيب"
            }
          />
        </aside>
      </div>

      {/* ===================================================
          INVESTIGATIONS
          =================================================== */}

      {investigationOpen && (
        <div className="simple-modal-layer">
          <button
            className="simple-modal-backdrop"
            onClick={() =>
              setInvestigationOpen(
                false
              )
            }
          />

          <div className="investigation-modal">
            <div className="simple-modal-header">
              <div>
                <h3>
                  طلب تحليل أو أشعة
                </h3>

                <p>
                  اختر الفحوصات المطلوبة
                  بدون الخروج من الكشف
                </p>
              </div>

              <button
                onClick={() =>
                  setInvestigationOpen(
                    false
                  )
                }
              >
                <X size={17} />
              </button>
            </div>

            <div className="investigation-tabs">
              <button
                className={
                  investigationDraft.type ===
                  "lab"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setInvestigationDraft(
                    (current) => ({
                      ...current,
                      type: "lab",
                      name: "",
                    })
                  );

                  setSelectedTests([]);
                  setInvestigationSearch(
                    ""
                  );
                }}
              >
                <FlaskConical
                  size={16}
                />
                تحاليل
              </button>

              <button
                className={
                  investigationDraft.type ===
                  "imaging"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setInvestigationDraft(
                    (current) => ({
                      ...current,
                      type: "imaging",
                      name: "",
                    })
                  );

                  setSelectedTests([]);
                  setInvestigationSearch(
                    ""
                  );
                }}
              >
                <Image size={16} />
                أشعة
              </button>
            </div>

            <div className="investigation-modal-body">
              <div className="investigation-search">
                <Search size={16} />

                <input
                  value={
                    investigationSearch
                  }
                  onChange={(
                    event
                  ) =>
                    setInvestigationSearch(
                      event.target
                        .value
                    )
                  }
                  placeholder="ابحث في الفحوصات الشائعة..."
                />
              </div>

              <div className="common-tests">
                {availableTests.map(
                  (name) => (
                    <button
                      key={name}
                      className={
                        selectedTests.includes(
                          name
                        )
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        toggleSelectedTest(
                          name
                        )
                      }
                    >
                      {selectedTests.includes(
                        name
                      ) && (
                        <Check
                          size={13}
                        />
                      )}

                      {name}
                    </button>
                  )
                )}
              </div>

              <label className="investigation-field">
                <span>
                  فحص آخر غير موجود
                  بالقائمة
                </span>

                <input
                  value={
                    investigationDraft.name
                  }
                  onChange={(
                    event
                  ) =>
                    setInvestigationDraft(
                      (current) => ({
                        ...current,
                        name:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  placeholder={
                    investigationDraft.type ===
                    "lab"
                      ? "اكتب اسم التحليل..."
                      : "اكتب اسم الأشعة..."
                  }
                />
              </label>

              <div className="investigation-options">
                <label className="investigation-field">
                  <span>
                    الأولوية
                  </span>

                  <select
                    value={
                      investigationDraft.priority
                    }
                    onChange={(
                      event
                    ) =>
                      setInvestigationDraft(
                        (current) => ({
                          ...current,
                          priority:
                            event
                              .target
                              .value,
                        })
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

                <label className="investigation-field">
                  <span>
                    تعليمات
                  </span>

                  <input
                    value={
                      investigationDraft.instructions
                    }
                    onChange={(
                      event
                    ) =>
                      setInvestigationDraft(
                        (current) => ({
                          ...current,
                          instructions:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    placeholder="مثال: صيام 8 ساعات"
                  />
                </label>
              </div>
            </div>

            <div className="simple-modal-actions">
              <span className="selected-count">
                {selectedTests.length +
                  (investigationDraft.name.trim()
                    ? 1
                    : 0)}{" "}
                فحص محدد
              </span>

              <button
                onClick={() =>
                  setInvestigationOpen(
                    false
                  )
                }
              >
                إلغاء
              </button>

              <button
                className="modal-primary"
                disabled={
                  !selectedTests.length &&
                  !investigationDraft.name.trim()
                }
                onClick={
                  addInvestigationRequests
                }
              >
                <Plus size={15} />
                إضافة للزيارة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          CUSTOM DRUG
          =================================================== */}

      {newDrugOpen && (
        <div className="simple-modal-layer">
          <button
            className="simple-modal-backdrop"
            onClick={() =>
              setNewDrugOpen(
                false
              )
            }
          />

          <div className="simple-modal">
            <div className="simple-modal-header">
              <div>
                <h3>
                  إضافة دواء
                </h3>

                <p>
                  إضافة سريعة
                  للروشتة الحالية
                </p>
              </div>

              <button
                onClick={() =>
                  setNewDrugOpen(
                    false
                  )
                }
              >
                <X
                  size={17}
                />
              </button>
            </div>

            <div className="simple-modal-body">
              <label>
                <span>
                  اسم الدواء *
                </span>

                <input
                  autoFocus
                  value={
                    newDrug.name
                  }
                  onChange={(
                    event
                  ) =>
                    setNewDrug({
                      ...newDrug,

                      name:
                        event.target
                          .value,
                    })
                  }
                  placeholder="Panadol"
                />
              </label>

              <label>
                <span>
                  المادة الفعالة
                </span>

                <input
                  value={
                    newDrug.generic
                  }
                  onChange={(
                    event
                  ) =>
                    setNewDrug({
                      ...newDrug,

                      generic:
                        event.target
                          .value,
                    })
                  }
                  placeholder="Paracetamol"
                />
              </label>

              <div className="simple-modal-grid">
                <label>
                  <span>
                    التركيز
                  </span>

                  <input
                    value={
                      newDrug.strength
                    }
                    onChange={(
                      event
                    ) =>
                      setNewDrug({
                        ...newDrug,

                        strength:
                          event.target
                            .value,
                      })
                    }
                    placeholder="500 mg"
                  />
                </label>

                <label>
                  <span>
                    الشكل
                  </span>

                  <select
                    value={
                      newDrug.form
                    }
                    onChange={(
                      event
                    ) =>
                      setNewDrug({
                        ...newDrug,

                        form:
                          event.target
                            .value,
                      })
                    }
                  >
                    <option value="Tablet">
                      أقراص
                    </option>

                    <option value="Capsule">
                      كبسول
                    </option>

                    <option value="Syrup">
                      شراب
                    </option>

                    <option value="Injection">
                      حقن
                    </option>

                    <option value="Cream">
                      كريم
                    </option>

                    <option value="Drops">
                      نقط
                    </option>
                  </select>
                </label>
              </div>
            </div>

            <div className="simple-modal-actions">
              <button
                onClick={() =>
                  setNewDrugOpen(
                    false
                  )
                }
              >
                إلغاء
              </button>

              <button
                className="modal-primary"
                onClick={
                  handleCustomDrug
                }
              >
                <Plus
                  size={15}
                />
                إضافة للروشتة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          FINISH
          =================================================== */}

      {finishOpen && (
        <div className="simple-modal-layer">
          <button
            className="simple-modal-backdrop"
            onClick={() =>
              !saving &&
              setFinishOpen(
                false
              )
            }
          />

          <div className="finish-dialog">
            <span className="finish-icon">
              <Check
                size={22}
              />
            </span>

            <h3>
              إنهاء الكشف
            </h3>

            <p>
              سيتم حفظ الزيارة والروشتة
              وطلبات التحاليل والأشعة
              وربطها بملف المريض.
            </p>

            <div className="finish-summary">
              <div>
                <span>
                  التشخيص
                </span>

                <strong>
                  {visit.diagnosis ||
                    "غير مسجل"}
                </strong>
              </div>

              <div>
                <span>
                  الأدوية
                </span>

                <strong>
                  {
                    visit
                      .medicines
                      .length
                  }
                </strong>
              </div>

              <div>
                <span>
                  الفحوصات
                </span>

                <strong>
                  {
                    (visit
                      .investigations ||
                      []).length
                  }
                </strong>
              </div>
            </div>

            {!visit.diagnosis && (
              <div className="finish-notice">
                <AlertTriangle
                  size={14}
                />

                لم يتم تسجيل
                تشخيص حتى الآن.
              </div>
            )}

            <div className="finish-actions">
              <button
                disabled={saving}
                onClick={() =>
                  setFinishOpen(
                    false
                  )
                }
              >
                رجوع
              </button>

              <button
                className="finish-confirm"
                disabled={saving}
                onClick={
                  confirmFinish
                }
              >
                {saving ? (
                  <LoaderCircle
                    size={15}
                    className="visit-spinner"
                  />
                ) : (
                  <Check
                    size={15}
                  />
                )}

                تأكيد وإنهاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   SECTION
   ========================================================= */

function VisitSection({
  title,
  children,
  last = false,
}) {
  return (
    <section
      className={`visit-section ${
        last
          ? "visit-section-last"
          : ""
      }`}
    >
      <h3>{title}</h3>

      <div>
        {children}
      </div>
    </section>
  );
}

/* =========================================================
   VITAL
   ========================================================= */

function VitalField({
  label,
  value,
  placeholder,
  unit,
  onChange,
}) {
  return (
    <label className="simple-vital">
      <span>{label}</span>

      <div>
        <input
          value={value}
          placeholder={
            placeholder
          }
          onChange={(
            event
          ) =>
            onChange(
              event.target.value
            )
          }
        />

        <small>
          {unit}
        </small>
      </div>
    </label>
  );
}

/* =========================================================
   MEDICINE ROW
   ========================================================= */

function MedicineRow({
  medicine,
  index,
  onChange,
  onRemove,
}) {
  return (
    <div className="medicine-row">
      <span className="medicine-index">
        {index + 1}
      </span>

      <div className="medicine-row-main">
        <div className="medicine-name">
          <strong>
            {medicine.name}{" "}
            {medicine.strength}
          </strong>

          <span>
            {medicine.generic}
          </span>
        </div>

        <div className="medicine-prescribing">
          <MedicineSelect
            value={
              medicine.dose
            }
            options={[
              "نصف قرص",
              "قرص واحد",
              "قرصان",
              "5 مل",
              "10 مل",
            ]}
            onChange={(
              value
            ) =>
              onChange(
                medicine.id,
                "dose",
                value
              )
            }
          />

          <MedicineSelect
            value={
              medicine.frequency
            }
            options={[
              "مرة يومياً",
              "مرتين يومياً",
              "3 مرات يومياً",
              "كل 8 ساعات",
              "كل 12 ساعة",
              "عند اللزوم",
            ]}
            onChange={(
              value
            ) =>
              onChange(
                medicine.id,
                "frequency",
                value
              )
            }
          />

          <input
            value={
              medicine.duration
            }
            onChange={(
              event
            ) =>
              onChange(
                medicine.id,
                "duration",
                event.target
                  .value
              )
            }
            placeholder="المدة"
          />

          <MedicineSelect
            value={
              medicine.instructions
            }
            options={[
              "بعد الأكل",
              "قبل الأكل",
              "مع الأكل",
              "قبل النوم",
              "عند اللزوم",
            ]}
            onChange={(
              value
            ) =>
              onChange(
                medicine.id,
                "instructions",
                value
              )
            }
          />
        </div>
      </div>

      <button
        className="medicine-remove"
        onClick={() =>
          onRemove(
            medicine.id
          )
        }
      >
        <Trash2
          size={14}
        />
      </button>
    </div>
  );
}

function MedicineSelect({
  value,
  options,
  onChange,
}) {
  return (
    <div className="medicine-select">
      <select
        value={value}
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
      >
        {options.map(
          (option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          )
        )}
      </select>

      <ChevronDown
        size={12}
      />
    </div>
  );
}

/* =========================================================
   PRESCRIPTION
   ========================================================= */

function PrescriptionPaper({
  patient,
  age,
  visit,
  doctorName,
}) {
  const today =
    new Intl.DateTimeFormat(
      "ar-EG",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    ).format(new Date());

  return (
    <div
      id="prescription-paper"
      className="simple-rx-paper"
    >
      <header className="simple-rx-header">
        <div>
          <strong>
            OMG
          </strong>

          <span>
            CLINIC
          </span>
        </div>

        <section>
          <strong>
            {doctorName}
          </strong>

          <span>
            OMG Clinic
          </span>
        </section>
      </header>

      <div className="simple-rx-patient">
        <div>
          <span>
            المريض
          </span>

          <strong>
            {patient.name}
          </strong>
        </div>

        <div>
          <span>
            العمر
          </span>

          <strong>
            {age !== null
              ? `${age} سنة`
              : "—"}
          </strong>
        </div>

        <div>
          <span>
            التاريخ
          </span>

          <strong>
            {today}
          </strong>
        </div>
      </div>

      {visit.diagnosis && (
        <div className="simple-rx-diagnosis">
          <span>Dx</span>

          <strong>
            {visit.diagnosis}
          </strong>
        </div>
      )}

      <main className="simple-rx-body">
        <span className="rx-symbol">
          ℞
        </span>

        {visit.medicines
          .length === 0 ? (
          <div className="simple-rx-empty">
            ستظهر الأدوية هنا أثناء
            الكشف
          </div>
        ) : (
          <div className="simple-rx-medicines">
            {visit.medicines.map(
              (
                medicine,
                index
              ) => (
                <div
                  key={
                    medicine.id
                  }
                  className="simple-rx-medicine"
                >
                  <span>
                    {index + 1}
                  </span>

                  <div>
                    <strong>
                      {
                        medicine.name
                      }{" "}
                      {
                        medicine.strength
                      }
                    </strong>

                    <p>
                      {
                        medicine.dose
                      }{" "}
                      ·{" "}
                      {
                        medicine.frequency
                      }
                    </p>

                    <small>
                      {
                        medicine.duration
                      }

                      {medicine.instructions
                        ? ` — ${medicine.instructions}`
                        : ""}
                    </small>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {(visit.prescriptionNotes ||
          visit.followUp) && (
          <div className="simple-rx-notes">
            {visit.prescriptionNotes && (
              <p>
                <b>
                  تعليمات:
                </b>{" "}
                {
                  visit.prescriptionNotes
                }
              </p>
            )}

            {visit.followUp && (
              <p>
                <b>
                  المتابعة:
                </b>{" "}
                {
                  visit.followUp
                }
              </p>
            )}
          </div>
        )}
      </main>

      <footer className="simple-rx-footer">
        <span>
          توقيع الطبيب
        </span>

        <strong>
          {doctorName}
        </strong>
      </footer>
    </div>
  );
}