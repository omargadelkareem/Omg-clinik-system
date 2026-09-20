import {
  ref,
  set,
  get,
  serverTimestamp,
} from "firebase/database";

import { database } from "../config/firebase";

const CLINIC_ID = "omg-main-clinic";

export async function seedOMGClinic() {
  const clinicRef = ref(
    database,
    `clinics/${CLINIC_ID}`
  );

  const snapshot = await get(clinicRef);

  if (snapshot.exists()) {
    console.log("OMG Clinic already exists.");
    return;
  }

  await set(clinicRef, {
    profile: {
      id: CLINIC_ID,

      name: "OMG Clinic",

      nameAr: "عيادة OMG",

      branchName: "الفرع الرئيسي",

      phone: "",

      address: "",

      logo: "",

      currency: "EGP",

      country: "EG",

      timezone: "Africa/Cairo",

      status: "active",

      createdAt: serverTimestamp(),
    },

    settings: {
      appointments: {
        defaultDuration: 30,
        allowWalkIn: true,
      },

      finance: {
        currency: "EGP",
      },

      prescription: {
        clinicName: "OMG Clinic",

        doctorName: "د. أحمد محمد",

        specialty: "استشاري الباطنة العامة",

        phone: "",

        address: "",

        footerNote:
          "نتمنى لكم دوام الصحة والعافية",
      },
    },

    patients: {},

    appointments: {},

    queue: {},

    visits: {},

    prescriptions: {},

    drugLibrary: {},

    medicalFiles: {},

    staff: {},

    finance: {
      transactions: {},
      expenses: {},
      payments: {},
    },

    whatsapp: {
      conversations: {},
    },

    auditLogs: {},
  });

  console.log("OMG Clinic created successfully.");
}