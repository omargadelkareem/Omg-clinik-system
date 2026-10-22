// Configurable clinical procedure definitions. Codes are internal, not ICD/CPT claims.
export const PROCEDURE_CATEGORIES = Object.freeze({
  restorative: "الحشوات والترميم", endodontics: "علاج الجذور", surgery: "الجراحة",
  implants: "زراعة الأسنان", prosthodontics: "التركيبات", periodontics: "اللثة",
  orthodontics: "التقويم", preventive: "الوقاية", imaging: "التصوير الطبي",
  dermatology: "الجلدية", gynecology: "النساء والتوليد", orthopedics: "العظام",
  ent: "الأنف والأذن", ophthalmology: "العيون", urology: "المسالك",
  general: "إجراءات عامة",
});
const procedure = (code, name, specialty, category, options = {}) => ({
  code, name, specialty, category, requiresConsent: false,
  supportsSessions: false, requiresTooth: false, ...options,
});
export const BUILTIN_PROCEDURES = Object.freeze([
  procedure("D-FILL", "حشو الأسنان", "dentistry", "restorative", { requiresTooth: true }),
  procedure("D-ROOT", "علاج عصب", "dentistry", "endodontics", { requiresTooth: true, supportsSessions: true }),
  procedure("D-RE-ROOT", "إعادة علاج عصب", "dentistry", "endodontics", { requiresTooth: true, supportsSessions: true }),
  procedure("D-CROWN", "تركيب تاج", "dentistry", "prosthodontics", { requiresTooth: true, supportsSessions: true }),
  procedure("D-BRIDGE", "تركيب جسر", "dentistry", "prosthodontics", { supportsSessions: true }),
  procedure("D-VENEER", "قشرة تجميلية", "dentistry", "prosthodontics", { requiresTooth: true }),
  procedure("D-IMPLANT", "زراعة سن", "dentistry", "implants", { requiresConsent: true, supportsSessions: true, requiresTooth: true }),
  procedure("D-BONE-GRAFT", "ترقيع عظم", "dentistry", "implants", { requiresConsent: true, supportsSessions: true }),
  procedure("D-SINUS-LIFT", "رفع الجيب الأنفي", "dentistry", "implants", { requiresConsent: true }),
  procedure("D-EXTRACT", "خلع سن", "dentistry", "surgery", { requiresConsent: true, requiresTooth: true }),
  procedure("D-SURGICAL-EXTRACT", "خلع جراحي", "dentistry", "surgery", { requiresConsent: true, requiresTooth: true }),
  procedure("D-SCALING", "إزالة الجير", "dentistry", "periodontics"),
  procedure("D-PERIO", "علاج اللثة", "dentistry", "periodontics", { supportsSessions: true }),
  procedure("D-ORTHO", "تقويم الأسنان", "dentistry", "orthodontics", { supportsSessions: true }),
  procedure("D-WHITEN", "تبييض الأسنان", "dentistry", "preventive"),
  procedure("D-OPG", "أشعة بانوراما OPG", "dentistry", "imaging"),
  procedure("D-CBCT", "أشعة CBCT", "dentistry", "imaging"),
  procedure("D-INTRAORAL", "أشعة داخل الفم", "dentistry", "imaging"),
  procedure("G-BIOPSY", "خزعة", "general_surgery", "surgery", { requiresConsent: true }),
  procedure("G-MINOR", "إجراء جراحي بسيط", "general_surgery", "surgery", { requiresConsent: true }),
  procedure("G-HERNIA", "إصلاح فتق", "general_surgery", "surgery", { requiresConsent: true }),
  procedure("OB-CSECTION", "عملية قيصرية", "gynecology", "gynecology", { requiresConsent: true }),
  procedure("OB-HYSTEROSCOPY", "منظار رحمي", "gynecology", "gynecology", { requiresConsent: true }),
  procedure("ORTH-INJECTION", "حقن مفصل", "orthopedics", "orthopedics", { requiresConsent: true }),
  procedure("ORTH-CAST", "تجبير", "orthopedics", "orthopedics"),
  procedure("ENT-ENDOSCOPY", "منظار أنف وأذن", "ent", "ent", { requiresConsent: true }),
  procedure("EYE-CATARACT", "جراحة مياه بيضاء", "ophthalmology", "ophthalmology", { requiresConsent: true }),
  procedure("DERM-LASER", "جلسة ليزر", "dermatology", "dermatology", { supportsSessions: true, requiresConsent: true }),
  procedure("URO-CYSTOSCOPY", "منظار مثانة", "urology", "urology", { requiresConsent: true }),
]);
export const PROCEDURE_STATUSES = Object.freeze(["planned", "scheduled", "in_progress", "completed", "cancelled"]);
export function proceduresForSpecialty(specialty, custom = []) {
  return [...BUILTIN_PROCEDURES, ...custom].filter(item => item.specialty === specialty);
}
export function validateToothNumber(tooth) {
  // FDI permanent (11–48) and primary (51–85), excluding 0 and 9 positions.
  const value = Number(tooth);
  const quadrant = Math.floor(value / 10);
  const position = value % 10;
  return Number.isInteger(value) &&
    ((quadrant >= 1 && quadrant <= 4 && position >= 1 && position <= 8) ||
     (quadrant >= 5 && quadrant <= 8 && position >= 1 && position <= 5));
}
