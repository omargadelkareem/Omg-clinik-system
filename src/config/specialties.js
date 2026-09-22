export const SPECIALTY_CATEGORIES = {
  GENERAL: "general",
  INTERNAL: "internal",
  SURGICAL: "surgical",
  WOMEN: "women",
  CHILDREN: "children",
  DENTAL: "dental",
  EYE_ENT: "eye_ent",
  MENTAL: "mental",
  REHAB: "rehab",
  OTHER: "other",
};

export const SPECIALTIES = [
  // =====================================================
  // GENERAL
  // =====================================================

  {
    id: "general_practice",
    nameAr: "طب عام",
    nameEn: "General Practice",
    category: SPECIALTY_CATEGORIES.GENERAL,
    icon: "stethoscope",
  },

  {
    id: "family_medicine",
    nameAr: "طب الأسرة",
    nameEn: "Family Medicine",
    category: SPECIALTY_CATEGORIES.GENERAL,
    icon: "users",
  },

  {
    id: "emergency_medicine",
    nameAr: "طب الطوارئ",
    nameEn: "Emergency Medicine",
    category: SPECIALTY_CATEGORIES.GENERAL,
    icon: "activity",
  },

  // =====================================================
  // INTERNAL MEDICINE
  // =====================================================

  {
    id: "internal_medicine",
    nameAr: "الباطنة العامة",
    nameEn: "Internal Medicine",
    category: SPECIALTY_CATEGORIES.INTERNAL,
    icon: "stethoscope",
    featured: true,
  },

  {
    id: "cardiology",
    nameAr: "القلب والأوعية الدموية",
    nameEn: "Cardiology",
    category: SPECIALTY_CATEGORIES.INTERNAL,
    icon: "heart",
  },

  {
    id: "gastroenterology",
    nameAr: "الجهاز الهضمي والكبد",
    nameEn: "Gastroenterology & Hepatology",
    category: SPECIALTY_CATEGORIES.INTERNAL,
    icon: "activity",
  },

  {
    id: "endocrinology",
    nameAr: "الغدد الصماء والسكر",
    nameEn: "Endocrinology & Diabetes",
    category: SPECIALTY_CATEGORIES.INTERNAL,
    icon: "activity",
  },

  {
    id: "pulmonology",
    nameAr: "الصدر والجهاز التنفسي",
    nameEn: "Pulmonology",
    category: SPECIALTY_CATEGORIES.INTERNAL,
    icon: "lungs",
  },

  {
    id: "nephrology",
    nameAr: "الكلى",
    nameEn: "Nephrology",
    category: SPECIALTY_CATEGORIES.INTERNAL,
    icon: "activity",
  },

  {
    id: "rheumatology",
    nameAr: "الروماتيزم والمناعة",
    nameEn: "Rheumatology",
    category: SPECIALTY_CATEGORIES.INTERNAL,
    icon: "bone",
  },

  {
    id: "hematology",
    nameAr: "أمراض الدم",
    nameEn: "Hematology",
    category: SPECIALTY_CATEGORIES.INTERNAL,
    icon: "droplet",
  },

  {
    id: "oncology",
    nameAr: "الأورام",
    nameEn: "Oncology",
    category: SPECIALTY_CATEGORIES.INTERNAL,
    icon: "activity",
  },

  {
    id: "infectious_diseases",
    nameAr: "الأمراض المعدية",
    nameEn: "Infectious Diseases",
    category: SPECIALTY_CATEGORIES.INTERNAL,
    icon: "shield",
  },

  {
    id: "allergy_immunology",
    nameAr: "الحساسية والمناعة",
    nameEn: "Allergy & Immunology",
    category: SPECIALTY_CATEGORIES.INTERNAL,
    icon: "shield",
  },

  {
    id: "geriatrics",
    nameAr: "طب المسنين",
    nameEn: "Geriatrics",
    category: SPECIALTY_CATEGORIES.INTERNAL,
    icon: "users",
  },

  // =====================================================
  // NEUROLOGY / PSYCHIATRY
  // =====================================================

  {
    id: "neurology",
    nameAr: "المخ والأعصاب",
    nameEn: "Neurology",
    category: SPECIALTY_CATEGORIES.INTERNAL,
    icon: "brain",
  },

  {
    id: "psychiatry",
    nameAr: "الطب النفسي",
    nameEn: "Psychiatry",
    category: SPECIALTY_CATEGORIES.MENTAL,
    icon: "brain",
  },

  {
    id: "child_psychiatry",
    nameAr: "الطب النفسي للأطفال والمراهقين",
    nameEn: "Child & Adolescent Psychiatry",
    category: SPECIALTY_CATEGORIES.MENTAL,
    icon: "brain",
  },

  // =====================================================
  // WOMEN
  // =====================================================

  {
    id: "obstetrics_gynecology",
    nameAr: "النساء والتوليد",
    nameEn: "Obstetrics & Gynecology",
    category: SPECIALTY_CATEGORIES.WOMEN,
    icon: "baby",
    featured: true,
  },

  {
    id: "fertility_ivf",
    nameAr: "تأخر الإنجاب والحقن المجهري",
    nameEn: "Fertility & IVF",
    category: SPECIALTY_CATEGORIES.WOMEN,
    icon: "baby",
  },

  {
    id: "maternal_fetal_medicine",
    nameAr: "طب الأم والجنين",
    nameEn: "Maternal Fetal Medicine",
    category: SPECIALTY_CATEGORIES.WOMEN,
    icon: "baby",
  },

  // =====================================================
  // PEDIATRICS
  // =====================================================

  {
    id: "pediatrics",
    nameAr: "طب الأطفال",
    nameEn: "Pediatrics",
    category: SPECIALTY_CATEGORIES.CHILDREN,
    icon: "baby",
    featured: true,
  },

  {
    id: "neonatology",
    nameAr: "حديثي الولادة",
    nameEn: "Neonatology",
    category: SPECIALTY_CATEGORIES.CHILDREN,
    icon: "baby",
  },

  {
    id: "pediatric_cardiology",
    nameAr: "قلب الأطفال",
    nameEn: "Pediatric Cardiology",
    category: SPECIALTY_CATEGORIES.CHILDREN,
    icon: "heart",
  },

  {
    id: "pediatric_neurology",
    nameAr: "مخ وأعصاب الأطفال",
    nameEn: "Pediatric Neurology",
    category: SPECIALTY_CATEGORIES.CHILDREN,
    icon: "brain",
  },

  {
    id: "pediatric_gastroenterology",
    nameAr: "جهاز هضمي وكبد الأطفال",
    nameEn: "Pediatric Gastroenterology",
    category: SPECIALTY_CATEGORIES.CHILDREN,
    icon: "activity",
  },

  // =====================================================
  // DENTISTRY
  // =====================================================

  {
    id: "dentistry",
    nameAr: "طب الأسنان",
    nameEn: "Dentistry",
    category: SPECIALTY_CATEGORIES.DENTAL,
    icon: "tooth",
    featured: true,
  },

  {
    id: "orthodontics",
    nameAr: "تقويم الأسنان",
    nameEn: "Orthodontics",
    category: SPECIALTY_CATEGORIES.DENTAL,
    icon: "tooth",
  },

  {
    id: "endodontics",
    nameAr: "علاج الجذور",
    nameEn: "Endodontics",
    category: SPECIALTY_CATEGORIES.DENTAL,
    icon: "tooth",
  },

  {
    id: "periodontics",
    nameAr: "أمراض وعلاج اللثة",
    nameEn: "Periodontics",
    category: SPECIALTY_CATEGORIES.DENTAL,
    icon: "tooth",
  },

  {
    id: "prosthodontics",
    nameAr: "تركيبات الأسنان",
    nameEn: "Prosthodontics",
    category: SPECIALTY_CATEGORIES.DENTAL,
    icon: "tooth",
  },

  {
    id: "pediatric_dentistry",
    nameAr: "أسنان الأطفال",
    nameEn: "Pediatric Dentistry",
    category: SPECIALTY_CATEGORIES.DENTAL,
    icon: "tooth",
  },

  {
    id: "oral_maxillofacial_surgery",
    nameAr: "جراحة الفم والوجه والفكين",
    nameEn: "Oral & Maxillofacial Surgery",
    category: SPECIALTY_CATEGORIES.DENTAL,
    icon: "tooth",
  },

  // =====================================================
  // SURGERY
  // =====================================================

  {
    id: "general_surgery",
    nameAr: "الجراحة العامة",
    nameEn: "General Surgery",
    category: SPECIALTY_CATEGORIES.SURGICAL,
    icon: "scissors",
    featured: true,
  },

  {
    id: "vascular_surgery",
    nameAr: "جراحة الأوعية الدموية",
    nameEn: "Vascular Surgery",
    category: SPECIALTY_CATEGORIES.SURGICAL,
    icon: "activity",
  },

  {
    id: "cardiothoracic_surgery",
    nameAr: "جراحة القلب والصدر",
    nameEn: "Cardiothoracic Surgery",
    category: SPECIALTY_CATEGORIES.SURGICAL,
    icon: "heart",
  },

  {
    id: "neurosurgery",
    nameAr: "جراحة المخ والأعصاب",
    nameEn: "Neurosurgery",
    category: SPECIALTY_CATEGORIES.SURGICAL,
    icon: "brain",
  },

  {
    id: "pediatric_surgery",
    nameAr: "جراحة الأطفال",
    nameEn: "Pediatric Surgery",
    category: SPECIALTY_CATEGORIES.SURGICAL,
    icon: "baby",
  },

  {
    id: "plastic_surgery",
    nameAr: "جراحة التجميل",
    nameEn: "Plastic Surgery",
    category: SPECIALTY_CATEGORIES.SURGICAL,
    icon: "scissors",
  },

  {
    id: "bariatric_surgery",
    nameAr: "جراحات السمنة",
    nameEn: "Bariatric Surgery",
    category: SPECIALTY_CATEGORIES.SURGICAL,
    icon: "activity",
  },

  {
    id: "colorectal_surgery",
    nameAr: "جراحة القولون والمستقيم",
    nameEn: "Colorectal Surgery",
    category: SPECIALTY_CATEGORIES.SURGICAL,
    icon: "scissors",
  },

  // =====================================================
  // ORTHOPEDICS
  // =====================================================

  {
    id: "orthopedics",
    nameAr: "العظام",
    nameEn: "Orthopedics",
    category: SPECIALTY_CATEGORIES.SURGICAL,
    icon: "bone",
  },

  {
    id: "spine_surgery",
    nameAr: "جراحة العمود الفقري",
    nameEn: "Spine Surgery",
    category: SPECIALTY_CATEGORIES.SURGICAL,
    icon: "bone",
  },

  {
    id: "sports_medicine",
    nameAr: "الطب الرياضي وإصابات الملاعب",
    nameEn: "Sports Medicine",
    category: SPECIALTY_CATEGORIES.REHAB,
    icon: "activity",
  },

  // =====================================================
  // UROLOGY
  // =====================================================

  {
    id: "urology",
    nameAr: "المسالك البولية",
    nameEn: "Urology",
    category: SPECIALTY_CATEGORIES.SURGICAL,
    icon: "activity",
  },

  {
    id: "andrology",
    nameAr: "الذكورة والعقم",
    nameEn: "Andrology",
    category: SPECIALTY_CATEGORIES.SURGICAL,
    icon: "activity",
  },

  // =====================================================
  // ENT
  // =====================================================

  {
    id: "ent",
    nameAr: "الأنف والأذن والحنجرة",
    nameEn: "ENT",
    category: SPECIALTY_CATEGORIES.EYE_ENT,
    icon: "ear",
  },

  {
    id: "audiology",
    nameAr: "السمع والاتزان",
    nameEn: "Audiology",
    category: SPECIALTY_CATEGORIES.EYE_ENT,
    icon: "ear",
  },

  // =====================================================
  // OPHTHALMOLOGY
  // =====================================================

  {
    id: "ophthalmology",
    nameAr: "العيون",
    nameEn: "Ophthalmology",
    category: SPECIALTY_CATEGORIES.EYE_ENT,
    icon: "eye",
  },

  // =====================================================
  // DERMATOLOGY
  // =====================================================

  {
    id: "dermatology",
    nameAr: "الجلدية",
    nameEn: "Dermatology",
    category: SPECIALTY_CATEGORIES.INTERNAL,
    icon: "activity",
  },

  {
    id: "dermatology_cosmetology",
    nameAr: "الجلدية والتجميل والليزر",
    nameEn: "Dermatology & Cosmetology",
    category: SPECIALTY_CATEGORIES.INTERNAL,
    icon: "activity",
  },

  // =====================================================
  // REHABILITATION
  // =====================================================

  {
    id: "physical_medicine_rehabilitation",
    nameAr: "الطب الطبيعي والتأهيل",
    nameEn: "Physical Medicine & Rehabilitation",
    category: SPECIALTY_CATEGORIES.REHAB,
    icon: "activity",
  },

  {
    id: "physiotherapy",
    nameAr: "العلاج الطبيعي",
    nameEn: "Physiotherapy",
    category: SPECIALTY_CATEGORIES.REHAB,
    icon: "activity",
  },

  // =====================================================
  // PAIN / ANESTHESIA
  // =====================================================

  {
    id: "anesthesiology",
    nameAr: "التخدير",
    nameEn: "Anesthesiology",
    category: SPECIALTY_CATEGORIES.SURGICAL,
    icon: "activity",
  },

  {
    id: "pain_management",
    nameAr: "علاج الألم",
    nameEn: "Pain Management",
    category: SPECIALTY_CATEGORIES.REHAB,
    icon: "activity",
  },

  // =====================================================
  // NUTRITION
  // =====================================================

  {
    id: "clinical_nutrition",
    nameAr: "التغذية العلاجية",
    nameEn: "Clinical Nutrition",
    category: SPECIALTY_CATEGORIES.GENERAL,
    icon: "activity",
  },

  // =====================================================
  // RADIOLOGY
  // =====================================================

  {
    id: "diagnostic_radiology",
    nameAr: "الأشعة التشخيصية",
    nameEn: "Diagnostic Radiology",
    category: SPECIALTY_CATEGORIES.OTHER,
    icon: "scan",
  },

  {
    id: "interventional_radiology",
    nameAr: "الأشعة التداخلية",
    nameEn: "Interventional Radiology",
    category: SPECIALTY_CATEGORIES.OTHER,
    icon: "scan",
  },

  // =====================================================
  // OTHER
  // =====================================================

  {
    id: "other",
    nameAr: "تخصص آخر",
    nameEn: "Other Specialty",
    category: SPECIALTY_CATEGORIES.OTHER,
    icon: "stethoscope",
  },
];

export const FEATURED_SPECIALTIES =
  SPECIALTIES.filter(
    (specialty) =>
      specialty.featured
  );

export function getSpecialtyById(id) {
  if (!id) {
    return null;
  }

  return (
    SPECIALTIES.find(
      (specialty) =>
        specialty.id === id
    ) || null
  );
}

export function searchSpecialties(query) {
  const normalized =
    String(query || "")
      .trim()
      .toLowerCase();

  if (!normalized) {
    return SPECIALTIES;
  }

  return SPECIALTIES.filter(
    (specialty) => {
      const text = [
        specialty.nameAr,
        specialty.nameEn,
        specialty.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(
        normalized
      );
    }
  );
}

export function getSpecialtiesByCategory(
  category
) {
  return SPECIALTIES.filter(
    (specialty) =>
      specialty.category ===
      category
  );
}