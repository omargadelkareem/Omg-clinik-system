import { get, ref, serverTimestamp, set, update } from "firebase/database";
import { database } from "../config/firebase";

function clean(value) {
  return String(value ?? "").trim();
}

function appointmentStatus(value) {
  const status = clean(value).toLowerCase();
  if (["cancelled", "canceled", "rejected"].includes(status)) return "cancelled";
  if (["completed", "done", "finished"].includes(status)) return "completed";
  if (["waiting", "arrived", "checked-in"].includes(status)) return "waiting";
  if (["in-progress", "in_consultation", "in-visit"].includes(status)) return "in-progress";
  return "scheduled";
}

export async function getSalamtakDoctorMapping(salamtakDoctorId) {
  const id = clean(salamtakDoctorId);
  if (!id) return null;

  const snapshot = await get(ref(database, `integrations/salamtak/doctorMappings/${id}`));
  if (!snapshot.exists()) return null;

  const value = snapshot.val() || {};
  if (value.enabled === false) return null;

  return {
    salamtakDoctorId: id,
    clinicId: clean(value.clinicId),
    omgDoctorId: clean(value.omgDoctorId || value.doctorId),
    doctorName: clean(value.doctorName),
    clinicName: clean(value.clinicName),
  };
}

export async function saveSalamtakDoctorMapping({
  salamtakDoctorId,
  clinicId,
  omgDoctorId,
  doctorName = "",
  clinicName = "",
}) {
  const sourceDoctorId = clean(salamtakDoctorId);
  const targetClinicId = clean(clinicId);
  const targetDoctorId = clean(omgDoctorId);

  if (!sourceDoctorId || !targetClinicId || !targetDoctorId) {
    throw new Error("بيانات ربط طبيب سلامتك مع OMG غير مكتملة.");
  }

  await set(ref(database, `integrations/salamtak/doctorMappings/${sourceDoctorId}`), {
    salamtakDoctorId: sourceDoctorId,
    clinicId: targetClinicId,
    omgDoctorId: targetDoctorId,
    doctorName: clean(doctorName),
    clinicName: clean(clinicName),
    enabled: true,
    updatedAt: serverTimestamp(),
  });
}

export async function importSalamtakBooking(bookingId, booking = {}) {
  const sourceBookingId = clean(bookingId || booking.id || booking.bookingId);
  const salamtakDoctorId = clean(
    booking.doctorId || booking.doctorUid || booking.doctorUID || booking.doctor_id,
  );

  if (!sourceBookingId) throw new Error("رقم حجز سلامتك غير موجود.");
  if (!salamtakDoctorId) throw new Error("رقم طبيب سلامتك غير موجود.");

  const mapping = await getSalamtakDoctorMapping(salamtakDoctorId);
  if (!mapping?.clinicId || !mapping?.omgDoctorId) {
    throw new Error("هذا الطبيب غير مربوط بعيادة OMG حتى الآن.");
  }

  // Stable ID = idempotency. Re-syncing the same Salamtak booking updates it.
  const appointmentId = `salamtak_${sourceBookingId}`;
  const appointmentRef = ref(
    database,
    `clinics/${mapping.clinicId}/appointments/${appointmentId}`,
  );

  const existing = await get(appointmentRef);
  const payload = {
    id: appointmentId,
    clinicId: mapping.clinicId,
    doctorId: mapping.omgDoctorId,
    doctorName: clean(booking.doctorName || mapping.doctorName),
    patientId: clean(booking.patientId),
    patientName: clean(booking.patientName) || "مريض سلامتك",
    patientPhone: clean(booking.patientPhone || booking.phone),
    date: clean(
      booking.date || booking.dateIso || booking.selectedDateIso || booking.bookingDate,
    ),
    time: clean(
      booking.time || booking.slot || booking.selectedSlot || booking.timeSlot || booking.bookedSlot,
    ),
    type: clean(booking.type || booking.visitType) || "كشف",
    price: Number(booking.appointmentPrice || booking.price || 0) || 0,
    status: appointmentStatus(booking.status || booking.bookingStatus),
    source: "salamtak",
    sourceBookingId,
    salamtakDoctorId,
    integrationVersion: 1,
    updatedAt: serverTimestamp(),
  };

  if (existing.exists()) {
    await update(appointmentRef, payload);
  } else {
    await set(appointmentRef, {
      ...payload,
      createdAt: serverTimestamp(),
    });
  }

  await set(ref(database, `integrations/salamtak/bookings/${sourceBookingId}`), {
    source: "salamtak",
    sourceBookingId,
    appointmentId,
    clinicId: mapping.clinicId,
    omgDoctorId: mapping.omgDoctorId,
    salamtakDoctorId,
    status: payload.status,
    syncedAt: serverTimestamp(),
  });

  return { appointmentId, clinicId: mapping.clinicId, doctorId: mapping.omgDoctorId };
}

export async function syncSalamtakBookingChanges(bookingId, changes = {}) {
  const sourceBookingId = clean(bookingId);
  if (!sourceBookingId) throw new Error("رقم حجز سلامتك غير موجود.");

  const linkRef = ref(database, `integrations/salamtak/bookings/${sourceBookingId}`);
  const linkSnapshot = await get(linkRef);
  if (!linkSnapshot.exists()) throw new Error("الحجز غير مربوط مع OMG.");

  const link = linkSnapshot.val() || {};
  const clinicId = clean(link.clinicId);
  const appointmentId = clean(link.appointmentId);
  if (!clinicId || !appointmentId) throw new Error("بيانات ربط الحجز غير مكتملة.");

  const patch = { updatedAt: serverTimestamp() };
  if (changes.status != null) patch.status = appointmentStatus(changes.status);
  if (changes.date != null) patch.date = clean(changes.date);
  if (changes.time != null) patch.time = clean(changes.time);

  await update(ref(database, `clinics/${clinicId}/appointments/${appointmentId}`), patch);
  await update(linkRef, {
    ...(patch.status ? { status: patch.status } : {}),
    syncedAt: serverTimestamp(),
  });
}
