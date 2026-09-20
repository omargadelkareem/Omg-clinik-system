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

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value) {
  return String(value ?? "").trim();
}

export function normalizeWhatsAppPhone(value) {
  let phone = cleanText(value)
    .replace(/\s+/g, "")
    .replace(/[^\d+]/g, "");

  if (phone.startsWith("0020")) {
    phone = `+20${phone.slice(4)}`;
  }

  if (phone.startsWith("20") && !phone.startsWith("+20")) {
    phone = `+${phone}`;
  }

  if (phone.startsWith("01")) {
    phone = `+20${phone.slice(1)}`;
  }

  return phone;
}

function normalizeObjectList(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "object") {
    return Object.entries(value).map(([id, item]) => ({
      id,
      ...item,
    }));
  }

  return [];
}

function sortConversations(items) {
  return [...items].sort(
    (a, b) =>
      Number(b.lastMessageAt || b.updatedAt || b.createdAt || 0) -
      Number(a.lastMessageAt || a.updatedAt || a.createdAt || 0)
  );
}

function sortMessages(items) {
  return [...items].sort(
    (a, b) =>
      Number(a.createdAt || 0) -
      Number(b.createdAt || 0)
  );
}

/* =========================================================
   CONVERSATIONS
========================================================= */

export function subscribeWhatsAppConversations(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback?.([]);
    return () => {};
  }

  const conversationsRef = ref(
    database,
    `clinics/${clinicId}/whatsapp/conversations`
  );

  return onValue(
    conversationsRef,
    (snapshot) => {
      const conversations = normalizeObjectList(
        snapshot.val()
      );

      callback?.(
        sortConversations(conversations)
      );
    },
    (error) => {
      console.error(
        "WhatsApp conversations error:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   FIND PATIENT BY PHONE
========================================================= */

export async function findPatientByPhone(
  clinicId,
  phone
) {
  if (!clinicId || !phone) {
    return null;
  }

  const normalizedPhone =
    normalizeWhatsAppPhone(phone);

  const snapshot = await get(
    ref(
      database,
      `clinics/${clinicId}/patients`
    )
  );

  if (!snapshot.exists()) {
    return null;
  }

  const patients =
    normalizeObjectList(snapshot.val());

  return (
    patients.find((patient) => {
      const currentPhone =
        normalizeWhatsAppPhone(
          patient.phone ||
            patient.normalizedPhone ||
            ""
        );

      return (
        currentPhone &&
        currentPhone === normalizedPhone
      );
    }) || null
  );
}

/* =========================================================
   CREATE CONVERSATION
========================================================= */

export async function createWhatsAppConversation({
  clinicId,
  phone,
  patient = null,
  displayName = "",
  createdBy = "",
}) {
  if (!clinicId) {
    throw new Error(
      "بيانات العيادة غير مكتملة."
    );
  }

  const normalizedPhone =
    normalizeWhatsAppPhone(phone);

  if (!normalizedPhone) {
    throw new Error(
      "رقم الهاتف مطلوب."
    );
  }

  const conversationsSnapshot =
    await get(
      ref(
        database,
        `clinics/${clinicId}/whatsapp/conversations`
      )
    );

  if (conversationsSnapshot.exists()) {
    const conversations =
      normalizeObjectList(
        conversationsSnapshot.val()
      );

    const existing =
      conversations.find(
        (conversation) =>
          normalizeWhatsAppPhone(
            conversation.phone
          ) === normalizedPhone
      );

    if (existing) {
      return existing;
    }
  }

  const conversationRef = push(
    ref(
      database,
      `clinics/${clinicId}/whatsapp/conversations`
    )
  );

  const conversationId =
    conversationRef.key;

  const payload = {
    id: conversationId,

    phone: normalizedPhone,

    patientId:
      patient?.id || "",

    patientName:
      patient?.name ||
      cleanText(displayName) ||
      normalizedPhone,

    patientCode:
      patient?.patientCode || "",

    status: "open",

    unreadCount: 0,

    lastMessage: "",

    lastMessageType: "",

    lastMessageAt: null,

    lastMessageDirection: "",

    appointmentId: "",

    createdBy:
      cleanText(createdBy),

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  await set(
    conversationRef,
    payload
  );

  return {
    id: conversationId,
    ...payload,
  };
}

/* =========================================================
   CREATE CONVERSATION FROM PHONE
========================================================= */

export async function createConversationFromPhone({
  clinicId,
  phone,
  displayName = "",
  createdBy = "",
}) {
  const patient =
    await findPatientByPhone(
      clinicId,
      phone
    );

  return createWhatsAppConversation({
    clinicId,
    phone,
    patient,
    displayName,
    createdBy,
  });
}

/* =========================================================
   MESSAGES REALTIME
========================================================= */

export function subscribeWhatsAppMessages(
  clinicId,
  conversationId,
  callback,
  onError
) {
  if (
    !clinicId ||
    !conversationId
  ) {
    callback?.([]);
    return () => {};
  }

  const messagesRef = ref(
    database,
    `clinics/${clinicId}/whatsapp/messages/${conversationId}`
  );

  return onValue(
    messagesRef,
    (snapshot) => {
      const messages =
        normalizeObjectList(
          snapshot.val()
        );

      callback?.(
        sortMessages(messages)
      );
    },
    (error) => {
      console.error(
        "WhatsApp messages error:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   SEND MESSAGE
========================================================= */

export async function sendWhatsAppMessage({
  clinicId,
  conversationId,
  text,
  senderId = "",
  senderName = "",
  type = "text",
}) {
  if (
    !clinicId ||
    !conversationId
  ) {
    throw new Error(
      "بيانات المحادثة غير مكتملة."
    );
  }

  const messageText =
    cleanText(text);

  if (!messageText) {
    throw new Error(
      "اكتب الرسالة أولاً."
    );
  }

  const messageRef = push(
    ref(
      database,
      `clinics/${clinicId}/whatsapp/messages/${conversationId}`
    )
  );

  const messageId =
    messageRef.key;

  const message = {
    id: messageId,

    type,

    text: messageText,

    direction: "outbound",

    status: "local",

    senderId:
      cleanText(senderId),

    senderName:
      cleanText(senderName),

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  const rootUpdates = {};

  rootUpdates[
    `clinics/${clinicId}/whatsapp/messages/${conversationId}/${messageId}`
  ] = message;

  rootUpdates[
    `clinics/${clinicId}/whatsapp/conversations/${conversationId}/lastMessage`
  ] = messageText;

  rootUpdates[
    `clinics/${clinicId}/whatsapp/conversations/${conversationId}/lastMessageType`
  ] = type;

  rootUpdates[
    `clinics/${clinicId}/whatsapp/conversations/${conversationId}/lastMessageDirection`
  ] = "outbound";

  rootUpdates[
    `clinics/${clinicId}/whatsapp/conversations/${conversationId}/lastMessageAt`
  ] = serverTimestamp();

  rootUpdates[
    `clinics/${clinicId}/whatsapp/conversations/${conversationId}/updatedAt`
  ] = serverTimestamp();

  await update(
    ref(database),
    rootUpdates
  );

  return {
    id: messageId,
    ...message,
  };
}

/* =========================================================
   RECEIVE MESSAGE
   Used later by webhook / backend
========================================================= */

export async function receiveWhatsAppMessage({
  clinicId,
  conversationId,
  text,
  externalMessageId = "",
  type = "text",
}) {
  if (
    !clinicId ||
    !conversationId
  ) {
    throw new Error(
      "بيانات المحادثة غير مكتملة."
    );
  }

  const messageText =
    cleanText(text);

  const messageRef = push(
    ref(
      database,
      `clinics/${clinicId}/whatsapp/messages/${conversationId}`
    )
  );

  const messageId =
    messageRef.key;

  const message = {
    id: messageId,

    externalMessageId:
      cleanText(
        externalMessageId
      ),

    type,

    text: messageText,

    direction: "inbound",

    status: "received",

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  const conversationSnapshot =
    await get(
      ref(
        database,
        `clinics/${clinicId}/whatsapp/conversations/${conversationId}`
      )
    );

  const currentConversation =
    conversationSnapshot.val() || {};

  const unreadCount =
    Number(
      currentConversation.unreadCount ||
        0
    ) + 1;

  const rootUpdates = {};

  rootUpdates[
    `clinics/${clinicId}/whatsapp/messages/${conversationId}/${messageId}`
  ] = message;

  rootUpdates[
    `clinics/${clinicId}/whatsapp/conversations/${conversationId}/lastMessage`
  ] = messageText;

  rootUpdates[
    `clinics/${clinicId}/whatsapp/conversations/${conversationId}/lastMessageType`
  ] = type;

  rootUpdates[
    `clinics/${clinicId}/whatsapp/conversations/${conversationId}/lastMessageDirection`
  ] = "inbound";

  rootUpdates[
    `clinics/${clinicId}/whatsapp/conversations/${conversationId}/lastMessageAt`
  ] = serverTimestamp();

  rootUpdates[
    `clinics/${clinicId}/whatsapp/conversations/${conversationId}/unreadCount`
  ] = unreadCount;

  rootUpdates[
    `clinics/${clinicId}/whatsapp/conversations/${conversationId}/updatedAt`
  ] = serverTimestamp();

  await update(
    ref(database),
    rootUpdates
  );

  return {
    id: messageId,
    ...message,
  };
}

/* =========================================================
   MARK AS READ
========================================================= */

export async function markConversationRead(
  clinicId,
  conversationId
) {
  if (
    !clinicId ||
    !conversationId
  ) {
    return;
  }

  await update(
    ref(
      database,
      `clinics/${clinicId}/whatsapp/conversations/${conversationId}`
    ),
    {
      unreadCount: 0,
      lastReadAt:
        serverTimestamp(),
      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   CLOSE / OPEN CONVERSATION
========================================================= */

export async function setConversationStatus(
  clinicId,
  conversationId,
  status
) {
  if (
    !clinicId ||
    !conversationId
  ) {
    throw new Error(
      "بيانات المحادثة غير مكتملة."
    );
  }

  const resolvedStatus =
    status === "closed"
      ? "closed"
      : "open";

  await update(
    ref(
      database,
      `clinics/${clinicId}/whatsapp/conversations/${conversationId}`
    ),
    {
      status:
        resolvedStatus,

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   LINK PATIENT
========================================================= */

export async function linkConversationToPatient({
  clinicId,
  conversationId,
  patient,
}) {
  if (
    !clinicId ||
    !conversationId ||
    !patient?.id
  ) {
    throw new Error(
      "بيانات المريض غير مكتملة."
    );
  }

  await update(
    ref(
      database,
      `clinics/${clinicId}/whatsapp/conversations/${conversationId}`
    ),
    {
      patientId:
        patient.id,

      patientName:
        cleanText(
          patient.name
        ),

      patientCode:
        cleanText(
          patient.patientCode
        ),

      phone:
        normalizeWhatsAppPhone(
          patient.phone
        ),

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   PATIENTS
========================================================= */

export function subscribeWhatsAppPatients(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback?.([]);
    return () => {};
  }

  return onValue(
    ref(
      database,
      `clinics/${clinicId}/patients`
    ),
    (snapshot) => {
      const patients =
        normalizeObjectList(
          snapshot.val()
        )
          .filter(
            (patient) =>
              patient.status !==
              "archived"
          )
          .sort((a, b) =>
            cleanText(
              a.name
            ).localeCompare(
              cleanText(b.name),
              "ar"
            )
          );

      callback?.(patients);
    },
    onError
  );
}

/* =========================================================
   DOCTORS
========================================================= */

export function subscribeWhatsAppDoctors(
  clinicId,
  callback,
  onError
) {
  if (!clinicId) {
    callback?.([]);
    return () => {};
  }

  return onValue(
    ref(
      database,
      `clinics/${clinicId}/staff`
    ),
    (snapshot) => {
      const staff =
        normalizeObjectList(
          snapshot.val()
        );

      const doctors =
        staff.filter((member) => {
          const role =
            cleanText(
              member.role
            ).toLowerCase();

          return (
            member.accountStatus !==
              "disabled" &&
            member.status !==
              "inactive" &&
            (role === "doctor" ||
              role === "owner" ||
              member.isDoctor === true)
          );
        });

      callback?.(doctors);
    },
    onError
  );
}

/* =========================================================
   CREATE PATIENT FROM WHATSAPP
========================================================= */

export async function createPatientFromWhatsApp({
  clinicId,
  name,
  phone,
  gender = "",
  dateOfBirth = "",
  address = "",
  createdBy = "",
}) {
  if (!clinicId) {
    throw new Error(
      "بيانات العيادة غير مكتملة."
    );
  }

  const patientName =
    cleanText(name);

  const patientPhone =
    cleanText(phone);

  if (!patientName) {
    throw new Error(
      "اسم المريض مطلوب."
    );
  }

  if (!patientPhone) {
    throw new Error(
      "رقم الهاتف مطلوب."
    );
  }

  const patientRef = push(
    ref(
      database,
      `clinics/${clinicId}/patients`
    )
  );

  const patientId =
    patientRef.key;

  const shortCode =
    String(patientId)
      .slice(-6)
      .toUpperCase();

  const patient = {
    id: patientId,

    patientCode:
      `OMG-${shortCode}`,

    name:
      patientName,

    phone:
      patientPhone,

    normalizedPhone:
      normalizeWhatsAppPhone(
        patientPhone
      ),

    gender:
      cleanText(gender),

    dateOfBirth:
      cleanText(dateOfBirth),

    address:
      cleanText(address),

    source: "whatsapp",

    status: "active",

    createdBy:
      cleanText(createdBy),

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  await set(
    patientRef,
    patient
  );

  return patient;
}

/* =========================================================
   CREATE WHATSAPP APPOINTMENT
========================================================= */

export async function createWhatsAppAppointment({
  clinicId,
  conversationId,
  patient,
  doctor,
  date,
  time,
  duration = 30,
  type = "كشف",
  notes = "",
  createdBy = "",
}) {
  if (!clinicId) {
    throw new Error(
      "بيانات العيادة غير مكتملة."
    );
  }

  if (!conversationId) {
    throw new Error(
      "المحادثة غير محددة."
    );
  }

  if (!patient?.id) {
    throw new Error(
      "يجب ربط المحادثة بمريض أولاً."
    );
  }

  if (!date) {
    throw new Error(
      "حدد تاريخ الموعد."
    );
  }

  if (!time) {
    throw new Error(
      "حدد وقت الموعد."
    );
  }

  const appointmentRef = push(
    ref(
      database,
      `clinics/${clinicId}/appointments`
    )
  );

  const appointmentId =
    appointmentRef.key;

  const appointment = {
    id:
      appointmentId,

    patientId:
      patient.id,

    patientName:
      cleanText(
        patient.name
      ),

    patientPhone:
      cleanText(
        patient.phone
      ),

    patientCode:
      cleanText(
        patient.patientCode
      ),

    doctorId:
      doctor?.id || "",

    doctorName:
      cleanText(
        doctor?.name ||
          doctor?.fullName ||
          doctor?.displayName
      ),

    doctorSpecialty:
      cleanText(
        doctor?.specialty ||
          doctor?.specialization
      ),

    date:
      cleanText(date),

    time:
      cleanText(time),

    duration:
      Number(duration) || 30,

    type:
      cleanText(type) ||
      "كشف",

    notes:
      cleanText(notes),

    source:
      "whatsapp",

    conversationId,

    status:
      "confirmed",

    queueId: "",

    visitId: "",

    createdBy:
      cleanText(createdBy),

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  const eventRef = push(
    ref(
      database,
      `clinics/${clinicId}/whatsapp/messages/${conversationId}`
    )
  );

  const eventId =
    eventRef.key;

  const eventText =
    `تم إنشاء حجز يوم ${date} الساعة ${time}`;

  const rootUpdates = {};

  rootUpdates[
    `clinics/${clinicId}/appointments/${appointmentId}`
  ] = appointment;

  rootUpdates[
    `clinics/${clinicId}/whatsapp/conversations/${conversationId}/appointmentId`
  ] = appointmentId;

  rootUpdates[
    `clinics/${clinicId}/whatsapp/conversations/${conversationId}/patientId`
  ] = patient.id;

  rootUpdates[
    `clinics/${clinicId}/whatsapp/conversations/${conversationId}/patientName`
  ] = cleanText(
    patient.name
  );

  rootUpdates[
    `clinics/${clinicId}/whatsapp/conversations/${conversationId}/patientCode`
  ] = cleanText(
    patient.patientCode
  );

  rootUpdates[
    `clinics/${clinicId}/whatsapp/conversations/${conversationId}/updatedAt`
  ] = serverTimestamp();

  rootUpdates[
    `clinics/${clinicId}/whatsapp/messages/${conversationId}/${eventId}`
  ] = {
    id: eventId,

    type:
      "appointment",

    direction:
      "system",

    text:
      eventText,

    appointmentId,

    date:
      cleanText(date),

    time:
      cleanText(time),

    doctorId:
      doctor?.id || "",

    doctorName:
      cleanText(
        doctor?.name ||
          doctor?.fullName ||
          doctor?.displayName
      ),

    status:
      "created",

    createdBy:
      cleanText(createdBy),

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  await update(
    ref(database),
    rootUpdates
  );

  return {
    id:
      appointmentId,

    ...appointment,
  };
}

/* =========================================================
   TEMPLATES
========================================================= */

export const WHATSAPP_TEMPLATES = [
  {
    id: "appointment-confirmed",
    title: "تأكيد الحجز",
    text:
      "أهلاً {{name}}، تم تأكيد حجزك في العيادة يوم {{date}} الساعة {{time}}. نتشرف بزيارتك.",
  },
  {
    id: "appointment-reminder",
    title: "تذكير بالموعد",
    text:
      "مرحباً {{name}}، نذكرك بموعدك في العيادة يوم {{date}} الساعة {{time}}.",
  },
  {
    id: "results-ready",
    title: "النتائج جاهزة",
    text:
      "مرحباً {{name}}، نحيطك علماً بأن نتائج التحاليل أو الأشعة الخاصة بك أصبحت جاهزة.",
  },
  {
    id: "follow-up",
    title: "متابعة",
    text:
      "مرحباً {{name}}، نتمنى أن تكون بخير. هذه رسالة متابعة من العيادة للاطمئنان عليك بعد الزيارة.",
  },
];

export function applyWhatsAppTemplate(
  template,
  values = {}
) {
  let result =
    cleanText(template);

  Object.entries(values).forEach(
    ([key, value]) => {
      result = result.replaceAll(
        `{{${key}}}`,
        cleanText(value)
      );
    }
  );

  return result;
}