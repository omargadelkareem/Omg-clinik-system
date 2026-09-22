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
  height: "",

  examination: "",
  diagnosis: "",
  notes: "",

  followUp: "",
  prescriptionNotes: "",

  medicines: [],
  investigations: [],

  specialty: {
    id: "",
    workspace: "general",
    data: {},
  },
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

const SPECIALTY_INVESTIGATION_GROUPS = {
  obstetrics_gynecology: {
    lab: ["CBC", "Blood Group & Rh", "Urine Analysis", "Urine Culture", "Beta-hCG", "Fasting Blood Sugar", "Random Blood Sugar", "HbA1c", "TSH", "Free T4", "Ferritin", "HBsAg", "HIV Screening", "Syphilis Screening (VDRL/RPR)", "Rubella IgG", "Toxoplasma IgG/IgM", "Coagulation Profile", "Vaginal/Cervical Swab", "Pap Smear"],
    imaging: ["Pelvic Ultrasound", "Transvaginal Ultrasound", "Obstetric Ultrasound", "Fetal Anomaly Scan", "Fetal Growth Scan", "Fetal Doppler", "NT Scan", "Cervical Length Ultrasound", "Follicular Tracking Ultrasound", "Hysterosalpingography (HSG)", "Mammography"],
  },
  pediatrics: {
    lab: ["CBC", "CRP", "ESR", "Ferritin", "Iron Profile", "Vitamin D", "Calcium", "Random Blood Sugar", "Urine Analysis", "Urine Culture", "Stool Analysis", "Stool Culture", "Liver Function Tests", "Kidney Function Tests", "TSH", "Free T4"],
    imaging: ["X-Ray Chest", "Abdominal Ultrasound", "Pelvic Ultrasound", "Cranial Ultrasound", "Echocardiography", "Hip Ultrasound", "CT Brain", "MRI Brain"],
  },
  internal: {
    lab: ["CBC", "HbA1c", "Fasting Blood Sugar", "Random Blood Sugar", "Lipid Profile", "Liver Function Tests", "Kidney Function Tests", "TSH", "Free T4", "CRP", "ESR", "Ferritin", "Vitamin B12", "Vitamin D", "Urine Analysis", "Uric Acid", "Electrolytes (Na/K)"],
    imaging: ["X-Ray Chest", "Abdominal Ultrasound", "Pelvic Ultrasound", "CT Chest", "CT Abdomen", "Echocardiography", "Doppler"],
  },
  cardiology: {
    lab: ["CBC", "Troponin", "CK-MB", "Lipid Profile", "HbA1c", "Fasting Blood Sugar", "Kidney Function Tests", "Electrolytes (Na/K/Mg)", "TSH", "BNP / NT-proBNP", "Coagulation Profile"],
    imaging: ["ECG", "Echocardiography", "Holter ECG", "Ambulatory Blood Pressure Monitoring", "Exercise Stress Test", "Coronary CT Angiography", "Cardiac MRI", "Carotid Doppler"],
  },
  dental: {
    lab: ["CBC", "Fasting Blood Sugar", "HbA1c", "Coagulation Profile", "INR"],
    imaging: ["Periapical X-Ray", "Bitewing X-Ray", "Panoramic X-Ray (OPG)", "Cephalometric X-Ray", "Dental CBCT", "TMJ Imaging"],
  },
  surgery: {
    lab: ["CBC", "Fasting Blood Sugar", "Random Blood Sugar", "Kidney Function Tests", "Liver Function Tests", "Coagulation Profile", "INR", "Blood Group & Rh", "Crossmatch", "Electrolytes (Na/K)"],
    imaging: ["X-Ray Chest", "Abdominal Ultrasound", "CT Abdomen", "CT Chest", "MRI", "Doppler", "ECG"],
  },
  neurology: {
    lab: ["CBC", "Random Blood Sugar", "HbA1c", "Electrolytes (Na/K/Ca/Mg)", "TSH", "Vitamin B12", "Folate", "Liver Function Tests", "Kidney Function Tests", "ESR", "CRP"],
    imaging: ["CT Brain", "MRI Brain", "MRI Spine", "EEG", "EMG / Nerve Conduction Study", "Carotid Doppler"],
  },
  orthopedics: {
    lab: ["CBC", "ESR", "CRP", "Vitamin D", "Calcium", "Uric Acid", "Rheumatoid Factor", "Anti-CCP"],
    imaging: ["X-Ray", "MRI Joint", "MRI Spine", "CT Bone", "Musculoskeletal Ultrasound", "DEXA Scan"],
  },
  urology: {
    lab: ["Urine Analysis", "Urine Culture", "Kidney Function Tests", "PSA", "CBC", "Uric Acid", "Semen Analysis"],
    imaging: ["Renal & Bladder Ultrasound", "Pelvic Ultrasound", "Scrotal Ultrasound", "CT KUB", "CT Urography", "Doppler"],
  },
  ent: {
    lab: ["CBC", "CRP", "ESR", "Throat Swab / Culture", "Allergy Testing"],
    imaging: ["Audiometry", "Tympanometry", "CT Paranasal Sinuses", "CT Temporal Bone", "Neck Ultrasound", "MRI IAC"],
  },
  ophthalmology: {
    lab: ["Fasting Blood Sugar", "HbA1c", "CBC", "ESR", "CRP"],
    imaging: ["OCT", "Fundus Photography", "Visual Field Test", "Corneal Topography", "Pachymetry", "B-Scan Ultrasound", "Fluorescein Angiography"],
  },
  dermatology: {
    lab: ["CBC", "Liver Function Tests", "Kidney Function Tests", "TSH", "Ferritin", "Vitamin D", "IgE", "Fungal Examination (KOH)", "Skin Scraping"],
    imaging: ["Dermatoscopy", "Skin Ultrasound"],
  },
  psychiatry: {
    lab: ["CBC", "TSH", "Free T4", "Vitamin B12", "Folate", "Vitamin D", "Liver Function Tests", "Kidney Function Tests", "Electrolytes (Na/K)", "Toxicology Screen"],
    imaging: ["CT Brain", "MRI Brain", "EEG"],
  },
  rehab: {
    lab: ["CBC", "ESR", "CRP", "Vitamin D", "Calcium", "CK", "Rheumatoid Factor"],
    imaging: ["X-Ray", "MRI Joint", "MRI Spine", "Musculoskeletal Ultrasound", "EMG / Nerve Conduction Study"],
  },
};

function uniqueTests(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function getInvestigationGroup(specialtyId) {
  if (["obstetrics_gynecology", "fertility_ivf", "maternal_fetal_medicine"].includes(specialtyId)) return "obstetrics_gynecology";
  if (["pediatrics", "neonatology", "pediatric_cardiology", "pediatric_neurology", "pediatric_gastroenterology", "pediatric_surgery"].includes(specialtyId)) return "pediatrics";
  if (["cardiology", "cardiothoracic_surgery"].includes(specialtyId)) return "cardiology";
  if (["dentistry", "orthodontics", "endodontics", "periodontics", "prosthodontics", "pediatric_dentistry", "oral_maxillofacial_surgery"].includes(specialtyId)) return "dental";
  if (["general_surgery", "vascular_surgery", "neurosurgery", "plastic_surgery", "bariatric_surgery", "colorectal_surgery"].includes(specialtyId)) return "surgery";
  if (["neurology", "neurosurgery"].includes(specialtyId)) return "neurology";
  if (["orthopedics", "spine_surgery", "sports_medicine", "rheumatology"].includes(specialtyId)) return "orthopedics";
  if (["urology", "andrology"].includes(specialtyId)) return "urology";
  if (["ent", "audiology"].includes(specialtyId)) return "ent";
  if (["ophthalmology"].includes(specialtyId)) return "ophthalmology";
  if (["dermatology", "dermatology_cosmetology", "allergy_immunology"].includes(specialtyId)) return "dermatology";
  if (["psychiatry", "child_psychiatry"].includes(specialtyId)) return "psychiatry";
  if (["physical_medicine_rehabilitation", "physiotherapy", "pain_management"].includes(specialtyId)) return "rehab";
  if (["internal_medicine", "gastroenterology", "endocrinology", "pulmonology", "nephrology", "hematology", "oncology", "infectious_diseases", "geriatrics", "clinical_nutrition", "general_practice", "family_medicine", "emergency_medicine"].includes(specialtyId)) return "internal";
  return null;
}

function getObgynScenarioInvestigations(data = {}) {
  const scenario = data.obgynScenario || "general_gynecology";

  if (scenario === "pregnancy") {
    const firstPregnancy = data.firstPregnancy === "yes";
    return {
      lab: uniqueTests([
        "CBC", "Blood Group & Rh", "Urine Analysis", "Urine Culture", "Fasting Blood Sugar", "HbA1c", "TSH", "Free T4", "HBsAg", "HIV Screening", "Syphilis Screening (VDRL/RPR)", "Rubella IgG", "Toxoplasma IgG/IgM", "Coagulation Profile",
        !firstPregnancy && "Indirect Coombs Test",
      ]),
      imaging: uniqueTests(["Obstetric Ultrasound", "NT Scan", "Fetal Anomaly Scan", "Fetal Growth Scan", "Fetal Doppler", "Cervical Length Ultrasound"]),
    };
  }

  if (scenario === "fertility") {
    return {
      lab: ["CBC", "TSH", "Free T4", "Prolactin", "FSH", "LH", "AMH", "Estradiol (E2)", "Progesterone", "HbA1c", "Fasting Blood Sugar", "Semen Analysis"],
      imaging: ["Transvaginal Ultrasound", "Pelvic Ultrasound", "Follicular Tracking Ultrasound", "Hysterosalpingography (HSG)"],
    };
  }

  if (scenario === "postpartum") {
    return {
      lab: ["CBC", "Ferritin", "CRP", "Urine Analysis", "Urine Culture", "Fasting Blood Sugar", "HbA1c", "TSH", "Free T4"],
      imaging: ["Pelvic Ultrasound", "Transvaginal Ultrasound", "Breast Ultrasound"],
    };
  }

  return SPECIALTY_INVESTIGATION_GROUPS.obstetrics_gynecology;
}

function getSpecialtyInvestigations(specialtyId, specialtyData = {}) {
  if (["obstetrics_gynecology", "fertility_ivf", "maternal_fetal_medicine"].includes(specialtyId)) {
    return getObgynScenarioInvestigations(specialtyData);
  }

  const group = getInvestigationGroup(specialtyId);
  return group ? SPECIALTY_INVESTIGATION_GROUPS[group] : COMMON_TESTS;
}

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
    activeSpecialty,
    activeSpecialtyData,
    specialtyConfig,
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

  const resolvedSpecialty =
    activeSpecialty ||
    "general_practice";

  const resolvedWorkspace =
    specialtyConfig?.workspace ||
    "general";

  useEffect(() => {
    setVisit((current) => {
      if (current.specialty?.id) {
        return current;
      }

      return {
        ...current,
        specialty: {
          ...current.specialty,
          id: resolvedSpecialty,
          workspace: resolvedWorkspace,
          data: {
            ...(current.specialty?.data || {}),
          },
        },
      };
    });
  }, [resolvedSpecialty, resolvedWorkspace]);

  const updateSpecialtyField = (
    field,
    value
  ) => {
    setVisit((current) => ({
      ...current,
      specialty: {
        ...current.specialty,
        id:
          current.specialty?.id ||
          resolvedSpecialty,
        workspace:
          current.specialty?.workspace ||
          resolvedWorkspace,
        data: {
          ...(current.specialty?.data || {}),
          [field]: value,
        },
      },
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

  const specialtyInvestigations = useMemo(
    () =>
      getSpecialtyInvestigations(
        resolvedSpecialty,
        visit.specialty?.data || {}
      ),
    [
      resolvedSpecialty,
      visit.specialty?.data,
    ]
  );

  const availableTests = useMemo(() => {
    const query =
      investigationSearch
        .trim()
        .toLowerCase();

    const specialtyTests =
      specialtyInvestigations[
        investigationDraft.type
      ] || [];

    // الاقتراحات المعروضة تتبع تخصص الطبيب والحالة السريرية.
    // يظل حقل "فحص آخر" متاحًا لأي تحليل/أشعة خارج القائمة.
    return specialtyTests.filter((name) =>
      !query ||
      name
        .toLowerCase()
        .includes(query)
    );
  }, [
    investigationDraft.type,
    investigationSearch,
    specialtyInvestigations,
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

          {/* SPECIALTY WORKSPACE */}

          <SpecialtyWorkspace
            specialtyId={resolvedSpecialty}
            specialtyName={
              activeSpecialtyData?.nameAr ||
              "طب عام"
            }
            config={specialtyConfig}
            visit={visit}
            updateField={updateField}
            updateSpecialtyField={
              updateSpecialtyField
            }
          />

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
                  اقتراحات سريعة حسب تخصص الطبيب والحالة الحالية، ويمكن إضافة أي فحص يدويًا
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
                  placeholder="ابحث في الفحوصات المقترحة للتخصص..."
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
   SPECIALTY WORKSPACE
   ========================================================= */

function SpecialtyWorkspace({
  specialtyId,
  specialtyName,
  config,
  visit,
  updateField,
  updateSpecialtyField,
}) {
  const data =
    visit.specialty?.data || {};

  return (
    <>
      <div className="specialty-workspace-banner">
        <div>
          <Stethoscope size={17} />
          <span>مساحة الكشف</span>
          <strong>{specialtyName}</strong>
        </div>

        <small>
          {config?.workspace || "general"}
        </small>
      </div>

      {specialtyId === "pediatrics" ? (
        <PediatricsWorkspace
          visit={visit}
          data={data}
          updateField={updateField}
          updateSpecialtyField={updateSpecialtyField}
        />
      ) : specialtyId === "obstetrics_gynecology" ? (
        <ObgynWorkspace
          data={data}
          updateSpecialtyField={updateSpecialtyField}
        />
      ) : specialtyId === "dentistry" ? (
        <DentistryWorkspace
          data={data}
          updateSpecialtyField={updateSpecialtyField}
        />
      ) : specialtyId === "general_surgery" ? (
        <SurgeryWorkspace
          data={data}
          updateSpecialtyField={updateSpecialtyField}
        />
      ) : specialtyId === "internal_medicine" ? (
        <InternalMedicineWorkspace
          visit={visit}
          data={data}
          updateField={updateField}
          updateSpecialtyField={updateSpecialtyField}
        />
      ) : (
        <GeneralWorkspace
          visit={visit}
          updateField={updateField}
        />
      )}
    </>
  );
}

function GeneralWorkspace({ visit, updateField }) {
  return (
    <VisitSection title="العلامات الحيوية">
      <div className="simple-vitals">
        <VitalField label="الضغط" value={visit.pressure} placeholder="120/80" unit="mmHg" onChange={(value) => updateField("pressure", value)} />
        <VitalField label="النبض" value={visit.pulse} placeholder="76" unit="bpm" onChange={(value) => updateField("pulse", value)} />
        <VitalField label="الحرارة" value={visit.temperature} placeholder="37" unit="°C" onChange={(value) => updateField("temperature", value)} />
        <VitalField label="الأكسجين" value={visit.spo2} placeholder="98" unit="%" onChange={(value) => updateField("spo2", value)} />
        <VitalField label="الوزن" value={visit.weight} placeholder="78" unit="kg" onChange={(value) => updateField("weight", value)} />
      </div>
    </VisitSection>
  );
}

function InternalMedicineWorkspace({
  visit,
  data,
  updateField,
  updateSpecialtyField,
}) {
  return (
    <>
      <GeneralWorkspace visit={visit} updateField={updateField} />
      <VisitSection title="تقييم الباطنة">
        <SpecialtyGrid>
          <SpecialtyTextarea label="مراجعة الأجهزة" value={data.systemReview || ""} placeholder="القلب، الجهاز التنفسي، الجهاز الهضمي..." onChange={(value) => updateSpecialtyField("systemReview", value)} />
          <SpecialtyTextarea label="تقييم الأمراض المزمنة" value={data.chronicDiseaseAssessment || ""} placeholder="السكري، الضغط، القلب، الكلى..." onChange={(value) => updateSpecialtyField("chronicDiseaseAssessment", value)} />
          <SpecialtyInput label="سكر الدم" value={data.bloodSugar || ""} placeholder="110 mg/dL" onChange={(value) => updateSpecialtyField("bloodSugar", value)} />
        </SpecialtyGrid>
      </VisitSection>
    </>
  );
}

function PediatricsWorkspace({
  visit,
  data,
  updateField,
  updateSpecialtyField,
}) {
  return (
    <>
      <VisitSection title="قياسات الطفل">
        <div className="simple-vitals">
          <VitalField label="الوزن" value={visit.weight} placeholder="12" unit="kg" onChange={(value) => updateField("weight", value)} />
          <VitalField label="الطول" value={visit.height} placeholder="90" unit="cm" onChange={(value) => updateField("height", value)} />
          <VitalField label="الحرارة" value={visit.temperature} placeholder="37" unit="°C" onChange={(value) => updateField("temperature", value)} />
          <VitalField label="الأكسجين" value={visit.spo2} placeholder="98" unit="%" onChange={(value) => updateField("spo2", value)} />
          <VitalField label="محيط الرأس" value={data.headCircumference || ""} placeholder="48" unit="cm" onChange={(value) => updateSpecialtyField("headCircumference", value)} />
          <VitalField label="معدل التنفس" value={data.respiratoryRate || ""} placeholder="24" unit="/min" onChange={(value) => updateSpecialtyField("respiratoryRate", value)} />
        </div>
      </VisitSection>

      <VisitSection title="التاريخ الطبي للطفل">
        <SpecialtyGrid>
          <SpecialtyTextarea label="تاريخ الولادة" value={data.birthHistory || ""} placeholder="نوع الولادة، عمر الحمل، وزن الولادة..." onChange={(value) => updateSpecialtyField("birthHistory", value)} />
          <SpecialtyTextarea label="التغذية" value={data.feedingHistory || ""} placeholder="رضاعة طبيعية أو صناعية والتغذية الحالية..." onChange={(value) => updateSpecialtyField("feedingHistory", value)} />
          <SpecialtyTextarea label="النمو والتطور" value={data.developmentHistory || ""} placeholder="ملاحظات النمو والتطور..." onChange={(value) => updateSpecialtyField("developmentHistory", value)} />
          <SpecialtyTextarea label="التطعيمات" value={data.vaccinationHistory || ""} placeholder="حالة التطعيمات والملاحظات..." onChange={(value) => updateSpecialtyField("vaccinationHistory", value)} />
        </SpecialtyGrid>
      </VisitSection>
    </>
  );
}

function ObgynWorkspace({ data, updateSpecialtyField }) {
  const scenario = data.obgynScenario || "general_gynecology";
  const isPregnancy = scenario === "pregnancy";
  const isFirstPregnancy = data.firstPregnancy === "yes";

  const setScenario = (value) => {
    updateSpecialtyField("obgynScenario", value);

    if (value !== "pregnancy") {
      updateSpecialtyField("firstPregnancy", "");
    }
  };

  return (
    <>
      <VisitSection title="نوع الزيارة">
        <div className="obgyn-scenario-grid">
          {[
            ["general_gynecology", "كشف نساء", "الدورة، الأعراض والتاريخ النسائي"],
            ["pregnancy", "متابعة حمل", "بيانات الحمل والمتابعة الحالية"],
            ["fertility", "تأخر إنجاب / خصوبة", "التبويض والخصوبة والتاريخ السابق"],
            ["postpartum", "متابعة بعد الولادة", "النفاس والرضاعة والتعافي"],
          ].map(([value, label, description]) => (
            <button
              key={value}
              type="button"
              className={`obgyn-scenario-button ${scenario === value ? "selected" : ""}`}
              onClick={() => setScenario(value)}
            >
              <strong>{label}</strong>
              <span>{description}</span>
              {scenario === value && <Check size={15} />}
            </button>
          ))}
        </div>
      </VisitSection>

      {isPregnancy && (
        <VisitSection title="بيانات الحمل">
          <div className="first-pregnancy-box">
            <div>
              <strong>هل هذا أول حمل؟</strong>
              <span>الإجابة تغيّر بيانات التاريخ التوليدي والفحوصات المقترحة.</span>
            </div>

            <div className="first-pregnancy-actions">
              <button
                type="button"
                className={data.firstPregnancy === "yes" ? "selected" : ""}
                onClick={() => {
                  updateSpecialtyField("firstPregnancy", "yes");
                  updateSpecialtyField("gravida", "1");
                  updateSpecialtyField("para", "0");
                  updateSpecialtyField("abortions", "0");
                }}
              >
                نعم، أول حمل
              </button>

              <button
                type="button"
                className={data.firstPregnancy === "no" ? "selected" : ""}
                onClick={() => updateSpecialtyField("firstPregnancy", "no")}
              >
                لا، سبق الحمل
              </button>
            </div>
          </div>

          <div className="specialty-inline-grid">
            <SpecialtyInput label="آخر دورة LMP" type="date" value={data.lmp || ""} onChange={(value) => updateSpecialtyField("lmp", value)} />
            <SpecialtyInput label="عمر الحمل" value={data.gestationalAge || ""} placeholder="مثال: 12 أسبوع" onChange={(value) => updateSpecialtyField("gestationalAge", value)} />
            <SpecialtyInput label="موعد الولادة المتوقع EDD" type="date" value={data.edd || ""} onChange={(value) => updateSpecialtyField("edd", value)} />
            <SpecialtyInput label="G" value={data.gravida || ""} placeholder="1" onChange={(value) => updateSpecialtyField("gravida", value)} />
            <SpecialtyInput label="P" value={data.para || ""} placeholder="0" onChange={(value) => updateSpecialtyField("para", value)} />
            <SpecialtyInput label="الإجهاضات" value={data.abortions || ""} placeholder="0" onChange={(value) => updateSpecialtyField("abortions", value)} />
          </div>
        </VisitSection>
      )}

      {scenario === "general_gynecology" && (
        <VisitSection title="بيانات النساء">
          <div className="specialty-inline-grid">
            <SpecialtyInput label="آخر دورة LMP" type="date" value={data.lmp || ""} onChange={(value) => updateSpecialtyField("lmp", value)} />
            <SpecialtyInput label="انتظام الدورة" value={data.cycle || ""} placeholder="منتظمة كل 28 يوم" onChange={(value) => updateSpecialtyField("cycle", value)} />
            <SpecialtyInput label="مدة الدورة" value={data.cycleDuration || ""} placeholder="5 أيام" onChange={(value) => updateSpecialtyField("cycleDuration", value)} />
            <SpecialtyInput label="وسيلة منع الحمل" value={data.contraception || ""} placeholder="إن وجدت" onChange={(value) => updateSpecialtyField("contraception", value)} />
          </div>
        </VisitSection>
      )}

      {scenario === "fertility" && (
        <VisitSection title="تقييم الخصوبة">
          <SpecialtyGrid>
            <SpecialtyInput label="مدة محاولة الحمل" value={data.tryingDuration || ""} placeholder="مثال: سنتان" onChange={(value) => updateSpecialtyField("tryingDuration", value)} />
            <SpecialtyInput label="انتظام الدورة" value={data.cycle || ""} placeholder="منتظمة / غير منتظمة" onChange={(value) => updateSpecialtyField("cycle", value)} />
            <SpecialtyTextarea label="علاجات خصوبة سابقة" value={data.previousFertilityTreatment || ""} placeholder="أدوية تنشيط، حقن، IUI، IVF..." onChange={(value) => updateSpecialtyField("previousFertilityTreatment", value)} />
            <SpecialtyTextarea label="حمل أو إجهاض سابق" value={data.previousPregnancyHistory || ""} onChange={(value) => updateSpecialtyField("previousPregnancyHistory", value)} />
          </SpecialtyGrid>
        </VisitSection>
      )}

      {scenario === "postpartum" && (
        <VisitSection title="متابعة ما بعد الولادة">
          <SpecialtyGrid>
            <SpecialtyInput label="تاريخ الولادة" type="date" value={data.deliveryDate || ""} onChange={(value) => updateSpecialtyField("deliveryDate", value)} />
            <SpecialtyInput label="نوع الولادة" value={data.deliveryType || ""} placeholder="طبيعي / قيصري" onChange={(value) => updateSpecialtyField("deliveryType", value)} />
            <SpecialtyTextarea label="النزيف والنفاس" value={data.postpartumBleeding || ""} onChange={(value) => updateSpecialtyField("postpartumBleeding", value)} />
            <SpecialtyTextarea label="الرضاعة" value={data.breastfeeding || ""} onChange={(value) => updateSpecialtyField("breastfeeding", value)} />
            <SpecialtyTextarea label="الجرح / القيصرية" value={data.woundAssessment || ""} onChange={(value) => updateSpecialtyField("woundAssessment", value)} />
          </SpecialtyGrid>
        </VisitSection>
      )}

      <VisitSection title="التاريخ النسائي والتوليدي">
        <SpecialtyGrid>
          {!isFirstPregnancy && (
            <SpecialtyTextarea label="التاريخ التوليدي السابق" value={data.obstetricHistory || ""} placeholder="الحمل والولادات السابقة والمضاعفات..." onChange={(value) => updateSpecialtyField("obstetricHistory", value)} />
          )}
          <SpecialtyTextarea label="التاريخ النسائي" value={data.gynecologicalHistory || ""} placeholder="الدورة، العمليات، وسائل منع الحمل، أمراض نسائية سابقة..." onChange={(value) => updateSpecialtyField("gynecologicalHistory", value)} />
          {isPregnancy && (
            <SpecialtyTextarea label="تقييم الحمل الحالي" value={data.pregnancyAssessment || ""} placeholder="الأعراض، حركة الجنين، النزيف، الألم، ضغط الدم والملاحظات..." onChange={(value) => updateSpecialtyField("pregnancyAssessment", value)} />
          )}
        </SpecialtyGrid>
      </VisitSection>
    </>
  );
}

function DentistryWorkspace({ data, updateSpecialtyField }) {
  return (
    <>
      <VisitSection title="كشف الأسنان">
        <SpecialtyGrid>
          <SpecialtyTextarea label="التاريخ السني" value={data.dentalHistory || ""} placeholder="الخلع، الحشو، التركيبات والعلاجات السابقة..." onChange={(value) => updateSpecialtyField("dentalHistory", value)} />
          <SpecialtyTextarea label="فحص الفم والأسنان" value={data.oralExamination || ""} placeholder="نتيجة فحص الأسنان واللثة..." onChange={(value) => updateSpecialtyField("oralExamination", value)} />
          <SpecialtyTextarea label="الإجراءات" value={data.dentalProcedures || ""} placeholder="الإجراء الذي تم أو المطلوب..." onChange={(value) => updateSpecialtyField("dentalProcedures", value)} />
          <SpecialtyTextarea label="خطة العلاج" value={data.treatmentPlan || ""} placeholder="خطة العلاج والجلسات..." onChange={(value) => updateSpecialtyField("treatmentPlan", value)} />
        </SpecialtyGrid>
      </VisitSection>

      <VisitSection title="Dental Chart">
        <DentalChart value={data.dentalChart || {}} onChange={(chart) => updateSpecialtyField("dentalChart", chart)} />
      </VisitSection>
    </>
  );
}

function SurgeryWorkspace({ data, updateSpecialtyField }) {
  return (
    <VisitSection title="التقييم الجراحي">
      <SpecialtyGrid>
        <SpecialtyTextarea label="التاريخ الجراحي" value={data.surgicalHistory || ""} placeholder="العمليات والتدخلات السابقة..." onChange={(value) => updateSpecialtyField("surgicalHistory", value)} />
        <SpecialtyTextarea label="تاريخ التخدير" value={data.anesthesiaHistory || ""} placeholder="مشاكل أو مضاعفات التخدير السابقة..." onChange={(value) => updateSpecialtyField("anesthesiaHistory", value)} />
        <SpecialtyTextarea label="تقييم ما قبل العملية" value={data.preoperativeAssessment || ""} onChange={(value) => updateSpecialtyField("preoperativeAssessment", value)} />
        <SpecialtyTextarea label="خطة الإجراء" value={data.procedurePlan || ""} onChange={(value) => updateSpecialtyField("procedurePlan", value)} />
        <SpecialtyTextarea label="متابعة ما بعد العملية" value={data.postoperativeFollowUp || ""} onChange={(value) => updateSpecialtyField("postoperativeFollowUp", value)} />
      </SpecialtyGrid>
    </VisitSection>
  );
}

function SpecialtyGrid({ children }) {
  return <div className="specialty-fields-grid">{children}</div>;
}

function SpecialtyTextarea({
  label,
  value,
  placeholder = "",
  onChange,
}) {
  return (
    <label className="specialty-field specialty-textarea-field">
      <span>{label}</span>
      <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SpecialtyInput({
  label,
  value,
  placeholder = "",
  type = "text",
  onChange,
}) {
  return (
    <label className="specialty-field">
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function DentalChart({ value = {}, onChange }) {
  const teeth = [
    18, 17, 16, 15, 14, 13, 12, 11,
    21, 22, 23, 24, 25, 26, 27, 28,
    48, 47, 46, 45, 44, 43, 42, 41,
    31, 32, 33, 34, 35, 36, 37, 38,
  ];

  const toggleTooth = (tooth) => {
    const key = String(tooth);
    const next = { ...value };

    if (next[key]) {
      delete next[key];
    } else {
      next[key] = { selected: true };
    }

    onChange(next);
  };

  return (
    <div className="dental-chart">
      {teeth.map((tooth) => (
        <button
          key={tooth}
          type="button"
          className={value[String(tooth)] ? "dental-tooth selected" : "dental-tooth"}
          onClick={() => toggleTooth(tooth)}
        >
          <span>🦷</span>
          <strong>{tooth}</strong>
        </button>
      ))}
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