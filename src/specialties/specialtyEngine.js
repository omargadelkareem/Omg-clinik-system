import {
  getSpecialtyById,
} from "../config/specialties";

/*
|--------------------------------------------------------------------------
| BASE MEDICAL WORKSPACE
|--------------------------------------------------------------------------
|
| أي تخصص ليس له Template متخصص حتى الآن سيعمل بهذا الـWorkspace.
|
*/

const BASE_SPECIALTY_CONFIG = {
  workspace: "general",

  modules: {
    complaints: true,
    history: true,
    examination: true,
    diagnosis: true,
    prescription: true,
    labs: true,
    radiology: true,
    followUp: true,
  },

  patientProfile: {
    allergies: true,
    chronicDiseases: true,
    previousSurgeries: true,
    medications: true,
    familyHistory: true,
  },

  vitals: [
    "weight",
    "height",
    "temperature",
    "bloodPressure",
    "pulse",
    "oxygenSaturation",
  ],

  prescription: {
    enabled: true,
    weightBasedDosing: false,
  },

  features: {
    growthCharts: false,
    vaccinations: false,
    pregnancyTracking: false,
    menstrualHistory: false,
    dentalChart: false,
    surgicalAssessment: false,
  },
};

/*
|--------------------------------------------------------------------------
| SPECIALTY CONFIGS
|--------------------------------------------------------------------------
*/

const SPECIALTY_CONFIGS = {
  internal_medicine: {
    workspace:
      "internal_medicine",

    vitals: [
      "weight",
      "height",
      "bmi",
      "temperature",
      "bloodPressure",
      "pulse",
      "oxygenSaturation",
      "bloodSugar",
    ],

    sections: [
      "chiefComplaint",
      "presentIllness",
      "chronicDiseases",
      "medications",
      "allergies",
      "familyHistory",
      "systemReview",
      "physicalExamination",
      "diagnosis",
      "investigations",
      "prescription",
      "followUp",
    ],
  },

  obstetrics_gynecology: {
    workspace:
      "obstetrics_gynecology",

    vitals: [
      "weight",
      "height",
      "bmi",
      "bloodPressure",
      "pulse",
      "temperature",
    ],

    features: {
      pregnancyTracking: true,
      menstrualHistory: true,
    },

    patientProfile: {
      obstetricHistory: true,
      menstrualHistory: true,
      pregnancyHistory: true,
    },

    sections: [
      "chiefComplaint",
      "menstrualHistory",
      "obstetricHistory",
      "pregnancyAssessment",
      "gynecologicalHistory",
      "examination",
      "ultrasound",
      "investigations",
      "diagnosis",
      "prescription",
      "followUp",
    ],
  },

  pediatrics: {
    workspace:
      "pediatrics",

    vitals: [
      "weight",
      "height",
      "headCircumference",
      "temperature",
      "pulse",
      "respiratoryRate",
      "oxygenSaturation",
    ],

    features: {
      growthCharts: true,
      vaccinations: true,
    },

    patientProfile: {
      birthHistory: true,
      feedingHistory: true,
      developmentHistory: true,
      vaccinations: true,
      growthHistory: true,
    },

    prescription: {
      weightBasedDosing: true,
    },

    sections: [
      "chiefComplaint",
      "birthHistory",
      "feedingHistory",
      "development",
      "vaccinations",
      "growth",
      "examination",
      "diagnosis",
      "investigations",
      "prescription",
      "followUp",
    ],
  },

  dentistry: {
    workspace:
      "dentistry",

    vitals: [],

    features: {
      dentalChart: true,
    },

    patientProfile: {
      dentalHistory: true,
    },

    sections: [
      "chiefComplaint",
      "dentalHistory",
      "dentalChart",
      "oralExamination",
      "diagnosis",
      "procedures",
      "dentalImaging",
      "prescription",
      "treatmentPlan",
      "followUp",
    ],
  },

  general_surgery: {
    workspace:
      "general_surgery",

    vitals: [
      "weight",
      "height",
      "bmi",
      "temperature",
      "bloodPressure",
      "pulse",
      "oxygenSaturation",
    ],

    features: {
      surgicalAssessment: true,
    },

    patientProfile: {
      previousSurgeries: true,
      anesthesiaHistory: true,
    },

    sections: [
      "chiefComplaint",
      "presentIllness",
      "surgicalHistory",
      "physicalExamination",
      "diagnosis",
      "preoperativeAssessment",
      "investigations",
      "procedurePlan",
      "prescription",
      "postoperativeFollowUp",
    ],
  },
};

/*
|--------------------------------------------------------------------------
| MERGE
|--------------------------------------------------------------------------
*/

function mergeConfig(
  base,
  specialty
) {
  return {
    ...base,
    ...specialty,

    modules: {
      ...base.modules,
      ...(specialty.modules ||
        {}),
    },

    patientProfile: {
      ...base.patientProfile,
      ...(specialty.patientProfile ||
        {}),
    },

    prescription: {
      ...base.prescription,
      ...(specialty.prescription ||
        {}),
    },

    features: {
      ...base.features,
      ...(specialty.features ||
        {}),
    },

    vitals:
      specialty.vitals ||
      base.vitals,

    sections:
      specialty.sections ||
      [],
  };
}

/*
|--------------------------------------------------------------------------
| PUBLIC API
|--------------------------------------------------------------------------
*/

export function getSpecialtyConfig(
  specialtyId
) {
  const specialty =
    getSpecialtyById(
      specialtyId
    );

  const customConfig =
    SPECIALTY_CONFIGS[
      specialtyId
    ] || {};

  return {
    specialty,

    ...mergeConfig(
      BASE_SPECIALTY_CONFIG,
      customConfig
    ),
  };
}

export function hasSpecialtyFeature(
  specialtyId,
  feature
) {
  const config =
    getSpecialtyConfig(
      specialtyId
    );

  return Boolean(
    config.features?.[
      feature
    ]
  );
}

export function hasSpecialtyModule(
  specialtyId,
  module
) {
  const config =
    getSpecialtyConfig(
      specialtyId
    );

  return Boolean(
    config.modules?.[
      module
    ]
  );
}

export function getSpecialtyWorkspace(
  specialtyId
) {
  return getSpecialtyConfig(
    specialtyId
  ).workspace;
}