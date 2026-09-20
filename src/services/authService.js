import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "firebase/auth";

import {
  get,
  ref,
  serverTimestamp,
  set,
  update,
} from "firebase/database";

import { auth, database } from "../config/firebase";

export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );

  const uid = credential.user.uid;

  const userSnapshot = await get(
    ref(database, `users/${uid}`)
  );

  if (!userSnapshot.exists()) {
    await signOut(auth);

    throw new Error(
      "هذا الحساب غير مرتبط بأي عيادة داخل OMG Clinic."
    );
  }

  const profile = userSnapshot.val();

  if (profile.status !== "active") {
    await signOut(auth);

    throw new Error("هذا الحساب موقوف.");
  }

  return {
    firebaseUser: credential.user,
    profile,
  };
}

export async function logoutUser() {
  return signOut(auth);
}

export async function createOwnerAccount({
  email,
  password,
  name,
  phone = "",
  clinicId,
}) {
  const credential =
    await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

  const uid = credential.user.uid;

  const staffId = `owner_${uid}`;

  const updates = {};

  updates[`users/${uid}`] = {
    uid,
    clinicId,
    staffId,
    name,
    email: email.trim(),
    role: "owner",
    status: "active",
    createdAt: serverTimestamp(),
  };

  updates[
    `clinics/${clinicId}/staff/${staffId}`
  ] = {
    id: staffId,
    uid,
    name,
    email: email.trim(),
    phone,
    role: "owner",
    customRole: "",
    branch: "الفرع الرئيسي",
    status: "offline",
    accountStatus: "active",
    permissionsMode: "owner",
    createdAt: serverTimestamp(),
  };

  await update(ref(database), updates);

  return credential.user;
}

export async function changeCurrentPassword(
  newPassword
) {
  if (!auth.currentUser) {
    throw new Error("لا يوجد مستخدم مسجل الدخول.");
  }

  await updatePassword(
    auth.currentUser,
    newPassword
  );
}