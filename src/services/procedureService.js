import { get, push, ref, set, update, onValue, runTransaction } from "firebase/database";
import { database } from "../config/firebase";
import { BUILTIN_PROCEDURES, PROCEDURE_STATUSES, validateToothNumber } from "../config/procedureCatalog";

function requiredId(value, name) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}
function basePath(clinicId, patientId) {
  return `clinics/${requiredId(clinicId, "clinicId")}/patients/${requiredId(patientId, "patientId")}/procedures`;
}
function normalize(input) {
  const code = String(input.code || "").trim();
  const definition = BUILTIN_PROCEDURES.find(item => item.code === code);
  const name = String(input.name || definition?.name || "").trim();
  const specialty = String(input.specialty || definition?.specialty || "").trim();
  if (!name || !specialty) throw new Error("Procedure name and specialty are required");
  if (definition?.requiresTooth && !validateToothNumber(input.toothNumber)) {
    throw new Error("Valid FDI tooth number is required");
  }
  const status = input.status || "planned";
  if (!PROCEDURE_STATUSES.includes(status)) throw new Error("Invalid procedure status");
  const price = Number(input.price ?? 0);
  if (!Number.isFinite(price) || price < 0) throw new Error("Invalid procedure price");
  return {
    code, name, specialty, category: String(input.category || definition?.category || "general"),
    status, toothNumber: input.toothNumber ? Number(input.toothNumber) : null,
    price, currency: String(input.currency || "EGP"),
    surfaces: Array.isArray(input.surfaces) ? [...new Set(input.surfaces.filter(x => ["M","D","O","B","L"].includes(x)))] : [],
    plannedSessions: definition?.supportsSessions ? Math.max(1, Math.min(30, Math.floor(Number(input.plannedSessions) || 1))) : 1,
    requiresConsent: Boolean(input.requiresConsent ?? definition?.requiresConsent),
    consentDocumentId: input.consentDocumentId || null,
    sessionIds: Array.isArray(input.sessionIds) ? input.sessionIds : [],
    visitId: input.visitId || null,
    notes: String(input.notes || "").slice(0, 5000),
  };
}
// clinicId must be resolved from the authenticated clinic membership, never from an untrusted URL.
// Firebase RTDB security rules MUST enforce tenant membership and clinical role permissions.
export async function createPatientProcedure({ clinicId, patientId, input, actorId }) {
  const path = basePath(clinicId, patientId);
  const author = requiredId(actorId, "actorId");
  const payload = normalize(input);
  const item = push(ref(database, path));
  const record = { ...payload, id: item.key, patientId, clinicId, createdBy: author,
    createdAt: Date.now(), updatedAt: Date.now() };
  await set(item, record);
  return record;
}
export async function listPatientProcedures({ clinicId, patientId }) {
  const snapshot = await get(ref(database, basePath(clinicId, patientId)));
  return snapshot.exists() ? Object.values(snapshot.val()) : [];
}
export function subscribePatientProcedures({ clinicId, patientId }, callback, onError) {
  return onValue(ref(database, basePath(clinicId, patientId)), snapshot => {
    callback(snapshot.exists() ? Object.values(snapshot.val()) : []);
  }, onError);
}
export async function updatePatientProcedureStatus({ clinicId, patientId, procedureId, status, actorId }) {
  if (!PROCEDURE_STATUSES.includes(status)) throw new Error("Invalid procedure status");
  requiredId(actorId, "actorId");
  const path = `${basePath(clinicId, patientId)}/${requiredId(procedureId, "procedureId")}`;
  const snapshot = await get(ref(database, path));
  if (!snapshot.exists()) throw new Error("Procedure not found");
  const record = snapshot.val();
  if (record.requiresConsent && status === "completed" && !record.consentDocumentId) {
    throw new Error("Consent documentation is required before completion");
  }
  await update(ref(database, path), { status, updatedBy: actorId, updatedAt: Date.now() });
}

export async function addProcedureSession({ clinicId, patientId, procedureId, actorId, notes }) {
  const author = requiredId(actorId, "actorId");
  const path = basePath(clinicId, patientId) + "/" + requiredId(procedureId, "procedureId");
  const procedureRef = ref(database, path);
  const sessionId = push(ref(database, path + "/sessions")).key;
  const now = Date.now();
  const result = await runTransaction(procedureRef, current => {
    if (!current || ["completed", "cancelled"].includes(current.status)) return;
    const planned = Math.max(1, Number(current.plannedSessions) || 1);
    const completed = Object.keys(current.sessions || {}).length;
    if (completed >= planned) return;
    return {
      ...current,
      sessions: { ...(current.sessions || {}), [sessionId]: { id: sessionId, notes: String(notes || "").slice(0, 2000), createdBy: author, createdAt: now } },
      status: "in_progress",
      updatedBy: author,
      updatedAt: now,
    };
  }, { applyLocally: false });
  if (!result.committed) throw new Error("تم تسجيل جميع الجلسات المخططة أو الإجراء مغلق. لا يمكن إضافة جلسة أخرى.");
  return sessionId;
}
