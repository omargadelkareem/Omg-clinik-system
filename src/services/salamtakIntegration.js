import { get, ref, serverTimestamp, set, update } from "firebase/database";
import { database } from "../config/firebase";

function clean(value) {
  return String(value ?? "").trim();
}

export async function getSalamtakDoctorMapping(salamtakDoctorId) {
  const id = clean(salamtakDoctorId);
  if (!id) return null;

  const snapshot = await get(
    ref(database, `integrations/salamtak/doctorMappings/${id}`)
  );

  if (!snapshot.exists()) return null;
  const data = snapshot.val() || {};
  if (data.enabled === false) return null;

  return {
    salamtakDoctorId: id,
    clinicId: clean(data.clinicId),
    omgDoctorId: clean(data.omgDoctorId || data.doctorId),
    clinicName: clean(data.clinicName),
    doctorName: clean(data.doctorName),
  };
}

export async function upsertSalamtakBooking(bookingId, booking = {}) {
  const sourceBookingId = clean(bookingId || booking.id || booking.bookingId);
  const salamtakDoctorId = clean(
    booking.doctorId || booking.doctorUid || booking.doctorUID
  );

  if (!sourceBookingId) throw new Error("Salamtak booking id is required.");
  if (!salamtakDoctorId) throw new Error("Salamtak doctor id is required.");

  const mapping = await getSalamtakDoctorMapping(salamtakDoctorId);
  if (!mapping?.clinicId || !mapping?.omgDoctorId) {
    throw new Error(`No active OMG mapping for Salamtak doctor ${salamtakDoctorId}.`);
  }

  // Stable id prevents duplicate appointments if the same booking is synced again.
  const appointmentId = `salamtak_${sourceBookingId}`;
  const appointmentRef = ref(
    database,
    `clinics/${mapping.clinicId}/appointments/${appointmentId}`
  );

  const existing = await get(appointmentRef);
  const appointment = {
    id: appointmentId,
    clinicId: mapping.clinicId,
    doctorId: mapping.omgDoctorId,
    doctorName: clean(booking.doctorName || mapping.doctorName),
    patientId: clean(booking.patientId),
    patientName: clean(booking.patientName) || "مريض سلامتك",
    patientPhone: clean(booking.patientPhone || booking.phone),
    date: clean(
      booking.date || booking.dateIso || booking.selectedDateIso || booking.bookingDate
    ),
    time: clean(
      booking.time || booking.slot || booking.selectedSlot || booking.timeSlot
    ),
    type: clean(booking.type || booking.visitType) || "كشف",
    price: Number(booking.appointmentPrice || booking.price || 0),
    status: clean(booking.status || booking.bookingStatus) || "scheduled",
    source: "salamtak",
    sourceBookingId,
    salamtakDoctorId,
    integrationVersion: 1,
    updatedAt: serverTimestamp(),
  };

  if (existing.exists()) {
    await update(appointmentRef, appointment);
  } else {
    await set(appointmentRef, {
      ...appointment,
      createdAt: serverTimestamp(),
    });
  }

  await set(
    ref(database, `integrations/salamtak/bookings/${sourceBookingId}`),
    {
      sourceBookingId,
      appointmentId,
      clinicId: mapping.clinicId,
      omgDoctorId: mapping.omgDoctorId,
      salamtakDoctorId,
      status: appointment.status,
      syncedAt: serverTimestamp(),
    }
  );

  return { appointmentId, mapping };
}

export async function updateSalamtakBooking(bookingId, changes = {}) {
  const sourceBookingId = clean(bookingId);
  if (!sourceBookingId) throw new Error("Salamtak booking id is required.");

  const linkRef = ref(
    database,
    `integrations/salamtak/bookings/${sourceBookingId}`
  );
  const linkSnapshot = await get(linkRef);
  if (!linkSnapshot.exists()) {
    throw new Error("Salamtak booking is not linked to OMG Clinic.");
  }

  const link = linkSnapshot.val() || {};
  const clinicId = clean(link.clinicId);
  const appointmentId = clean(link.appointmentId);
  if (!clinicId || !appointmentId) {
    throw new Error("Invalid Salamtak integration link.");
  }

  const patch = { updatedAt: serverTimestamp() };
  if (changes.status != null) patch.status = clean(changes.status);
  if (changes.date != null) patch.date = clean(changes.date);
  if (changes.time != null) patch.time = clean(changes.time);

  await update(
    ref(database, `clinics/${clinicId}/appointments/${appointmentId}`),
    patch
  );

  await update(linkRef, {
    ...(patch.status ? { status: patch.status } : {}),
    syncedAt: serverTimestamp(),
  });
}
