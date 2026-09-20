import {
  get,
  push,
  ref,
  remove,
  set,
  update,
} from "firebase/database";

import { database } from "../config/firebase";

export const DEFAULT_CLINIC_ID = "omg-main-clinic";

export function clinicPath(path = "") {
  const cleanPath = path.replace(/^\/+/, "");

  return cleanPath
    ? `clinics/${DEFAULT_CLINIC_ID}/${cleanPath}`
    : `clinics/${DEFAULT_CLINIC_ID}`;
}

export async function getClinicData(path) {
  const snapshot = await get(
    ref(database, clinicPath(path))
  );

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.val();
}

export async function setClinicData(path, data) {
  await set(ref(database, clinicPath(path)), data);

  return data;
}

export async function updateClinicData(path, data) {
  await update(ref(database, clinicPath(path)), data);

  return data;
}

export async function pushClinicData(path, data) {
  const newRef = push(
    ref(database, clinicPath(path))
  );

  const payload = {
    ...data,
    id: newRef.key,
  };

  await set(newRef, payload);

  return payload;
}

export async function removeClinicData(path) {
  await remove(ref(database, clinicPath(path)));
}