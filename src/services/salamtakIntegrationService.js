import {
  get,
  onValue,
  push,
  ref,
  serverTimestamp,
  set,
  update,
} from "firebase/database";

import { database } from "../config/firebase";

function clean(value) {
  return String(value ?? "").trim();
}

function normalizePhone(value) {
  return clean(value).replace(/\s+/g, "").replace(/[^\d+]/g, "");
}

function normalizeList(value) {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).map(([id, item]) => ({ id, ...(item || {}) }));
}

/**
 * Link a Salamtak doctor to an OMG Clinic doctor.
 * This mapping is the single source of truth used by the integration layer.
 */
export async function saveSalamtakDoctorMapping({
  salamtakDoctorId,
  clinicId,
  omgDoctorId,
  omgDoctorName = "",
}) {
  if (!clean(salamtakDoctorId) || !clean(clinicId) || !clean(omgDoctorId)) {
    throw new Error("بيانات ربط الطبيب غير مكتملة.");
  }

  await set(
    ref(database, `integrations/salamtak/doctorMappings/${clean(salamtakDoctorId)}`),
    {
      salamtakDoctorId: clean(salamtakDoctorId),
      clinicId: clean(clinicId),
      omgDoctorId: clean(omgDoctorId),
      omgDoctorName: clean(omgDoctorName),
      active: true,
      updatedAt: serverTimestamp(),
    }
  );
}

export async function getSalamtakDoctorMapping(salamtakDoctorId) {
  const id = clean(salamtakDoctorId);
  if (!id) return null;

  const snapshot = await get(
    ref(database, `integrations/salamtak/doctorMappings/${id}`)
  );

  if (!snapshot.exists() || !snapshot.val()?.active) return null;
  return snapshot.val();
}

async function findOrCreatePatient(clinicId, booking) {
  const phone = normalizePhone(booking.patientPhone);
  const patientsRef = ref(database, `clinics/${clinicId}/patients`);
  const snapshot = await get(patientsRef);
  const patients = normalizeList(snapshot.val());

  const existing = patients.find(
    (patient) => phone && normalizePhone(patient.phone || patient.normalizedPhone) === phone
  );

  if (existing) return existing;

  const patientRef = push(patientsRef);
  const patientId = patientRef.key;
  const patient = {
    id: patientId,
    patientCode: `SLM-${String(patientId).slice(-6).toUpperCase()}`,
    name: clean(booking.patientName) || "مريض سلامتك",
    phone: clean(booking.patientPhone),
    normalizedPhone: phone,
    gender: clean(booking.patientGender),
    source: "salamtak",
    salamtakPatientId: clean(booking.patientId),
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await set(patientRef, patient);
  return patient;
}

/**
 * Idempotently imports a Salamtak booking into OMG Clinic.
 * Calling this function more than once with the same booking id will update
 * the same OMG appointment instead of creating duplicates.
 */
export async function importSalamtakBooking(booking) {
  const sourceBookingId = clean(
    booking?.salamtakBookingId || booking?.bookingId || booking?.id
  );
  const salamtakDoctorId = clean(booking?.doctorId);

  if (!sourceBookingId) throw new Error("Salamtak booking id is required.");
  if (!salamtakDoctorId) throw new Error("Salamtak doctor id is required.");

  const mapping = await getSalamtakDoctorMapping(salamtakDoctorId);
  if (!mapping) {
    throw new Error("هذا الطبيب غير مربوط بعيادة OMG Clinic حتى الآن.");
  }

  const clinicId = clean(mapping.clinicId);
  const patient = await findOrCreatePatient(clinicId, booking);

  const linkRef = ref(
    database,
    `integrations/salamtak/bookings/${sourceBookingId}`
  );
  const linkSnapshot = await get(linkRef);
  const existingLink = linkSnapshot.val();

  const appointmentId =
    clean(existingLink?.omgAppointmentId) ||
    push(ref(database, `clinics/${clinicId}/appointments`)).key;

  const appointmentRef = ref(
    database,
    `clinics/${clinicId}/appointments/${appointmentId}`
  );

  const status = clean(booking.status).toLowerCase();
  const omgStatus = ["cancelled", "canceled", "rejected"].includes(status)
    ? "cancelled"
    : "scheduled";

  const payload = {
    id: appointmentId,
    patientId: patient.id,
    patientName: clean(booking.patientName) || patient.name || "مريض",
    patientPhone: clean(booking.patientPhone) || patient.phone || "",
    patientCode: patient.patientCode || "",
    doctorId: clean(mapping.omgDoctorId),
    doctorName: clean(mapping.omgDoctorName || booking.doctorName),
    doctorSpecialty: clean(booking.doctorSpecialty),
    date: clean(booking.date || booking.dateIso || booking.selectedDateIso),
    time: clean(booking.time || booking.slot || booking.selectedSlot),
    duration: Number(booking.duration || 30),
    type: clean(booking.type) || "كشف",
    notes: clean(booking.notes),
    expectedPrice: Number(booking.appointmentPrice || booking.price || 0),
    source: "salamtak",
    sourceBookingId,
    salamtakDoctorId,
    salamtakPatientId: clean(booking.patientId),
    status: omgStatus,
    queueId: "",
    visitId: "",
    integrationVersion: 1,
    updatedAt: serverTimestamp(),
    ...(existingLink?.omgAppointmentId ? {} : { createdAt: serverTimestamp() }),
  };

  await update(appointmentRef, payload);

  await set(linkRef, {
    salamtakBookingId: sourceBookingId,
    salamtakDoctorId,
    clinicId,
    omgDoctorId: clean(mapping.omgDoctorId),
    omgPatientId: patient.id,
    omgAppointmentId: appointmentId,
    lastSalamtakStatus: clean(booking.status),
    syncStatus: "synced",
    syncedAt: serverTimestamp(),
  });

  return {
    clinicId,
    doctorId: clean(mapping.omgDoctorId),
    patientId: patient.id,
    appointmentId,
    sourceBookingId,
  };
}

/**
 * Realtime subscription for integration bookkeeping / future admin screen.
 */
export function subscribeSalamtakBookings(callback, onError) {
  const bookingsRef = ref(database, "integrations/salamtak/bookings");
  return onValue(
    bookingsRef,
    (snapshot) => callback?.(normalizeList(snapshot.val())),
    (error) => onError?.(error)
  );
}

/**
 * Writes an OMG-side status event for the outbound bridge to Salamtak.
 * The server integration will consume these events and update Salamtak.
 */
export async function queueSalamtakStatusSync({
  sourceBookingId,
  status,
  clinicId,
  appointmentId,
}) {
  const id = clean(sourceBookingId);
  if (!id) return;

  await set(ref(database, `integrations/salamtak/outbox/${id}`), {
    salamtakBookingId: id,
    status: clean(status),
    clinicId: clean(clinicId),
    omgAppointmentId: clean(appointmentId),
    pending: true,
    updatedAt: serverTimestamp(),
  });
}
