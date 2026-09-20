import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Archive,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  CircleUserRound,
  Clock3,
  FileText,
  Inbox,
  MessageCircle,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Stethoscope,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

import {
  WHATSAPP_TEMPLATES,
  applyWhatsAppTemplate,
  createConversationFromPhone,
  createPatientFromWhatsApp,
  createWhatsAppAppointment,
  linkConversationToPatient,
  markConversationRead,
  sendWhatsAppMessage,
  setConversationStatus,
  subscribeWhatsAppConversations,
  subscribeWhatsAppDoctors,
  subscribeWhatsAppMessages,
  subscribeWhatsAppPatients,
} from "../../services/whatsappService";

import "./WhatsAppPage.css";

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value) {
  return String(value ?? "").trim();
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(
    Number(value)
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}

function formatConversationDate(
  value
) {
  if (!value) {
    return "";
  }

  const date = new Date(
    Number(value)
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const now = new Date();

  const sameDay =
    date.toDateString() ===
    now.toDateString();

  if (sameDay) {
    return formatTime(value);
  }

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      day: "numeric",
      month: "short",
    }
  ).format(date);
}

function getInitial(name) {
  const value =
    cleanText(name);

  return (
    value.charAt(0) || "م"
  );
}

function getTodayString() {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMessageStatusIcon(
  message
) {
  if (
    message.direction !==
    "outbound"
  ) {
    return null;
  }

  if (
    message.status === "read"
  ) {
    return (
      <CheckCheck
        size={14}
      />
    );
  }

  if (
    message.status ===
      "delivered" ||
    message.status ===
      "sent"
  ) {
    return (
      <CheckCheck
        size={14}
      />
    );
  }

  return (
    <Check size={14} />
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function WhatsAppPage() {
  const navigate =
    useNavigate();

  const {
    clinicId,
    staffId,
    displayName,
  } = useAuth();

  const messagesEndRef =
    useRef(null);

  const [
    conversations,
    setConversations,
  ] = useState([]);

  const [
    patients,
    setPatients,
  ] = useState([]);

  const [
    doctors,
    setDoctors,
  ] = useState([]);

  const [
    messages,
    setMessages,
  ] = useState([]);

  const [
    selectedConversationId,
    setSelectedConversationId,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] = useState("all");

  const [
    messageText,
    setMessageText,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    messagesLoading,
    setMessagesLoading,
  ] = useState(false);

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    newConversationOpen,
    setNewConversationOpen,
  ] = useState(false);

  const [
    createPatientOpen,
    setCreatePatientOpen,
  ] = useState(false);

  const [
    linkPatientOpen,
    setLinkPatientOpen,
  ] = useState(false);

  const [
    appointmentOpen,
    setAppointmentOpen,
  ] = useState(false);

  const [
    templatesOpen,
    setTemplatesOpen,
  ] = useState(false);

  /* =======================================================
     REALTIME
  ======================================================= */

  useEffect(() => {
    if (!clinicId) {
      return undefined;
    }

    setLoading(true);

    const unsubscribe =
      subscribeWhatsAppConversations(
        clinicId,
        (items) => {
          setConversations(
            items
          );

          setLoading(false);
        },
        (err) => {
          console.error(err);

          setError(
            "تعذر تحميل محادثات WhatsApp."
          );

          setLoading(false);
        }
      );

    return unsubscribe;
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) {
      return undefined;
    }

    const unsubscribe =
      subscribeWhatsAppPatients(
        clinicId,
        setPatients,
        (err) =>
          console.error(
            err
          )
      );

    return unsubscribe;
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) {
      return undefined;
    }

    const unsubscribe =
      subscribeWhatsAppDoctors(
        clinicId,
        setDoctors,
        (err) =>
          console.error(
            err
          )
      );

    return unsubscribe;
  }, [clinicId]);

  useEffect(() => {
    if (
      !clinicId ||
      !selectedConversationId
    ) {
      setMessages([]);
      return undefined;
    }

    setMessagesLoading(
      true
    );

    const unsubscribe =
      subscribeWhatsAppMessages(
        clinicId,
        selectedConversationId,
        (items) => {
          setMessages(items);

          setMessagesLoading(
            false
          );
        },
        (err) => {
          console.error(err);

          setMessagesLoading(
            false
          );
        }
      );

    markConversationRead(
      clinicId,
      selectedConversationId
    ).catch(console.error);

    return unsubscribe;
  }, [
    clinicId,
    selectedConversationId,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
      }
    );
  }, [messages]);

  /* =======================================================
     SELECTED
  ======================================================= */

  const selectedConversation =
    useMemo(
      () =>
        conversations.find(
          (item) =>
            item.id ===
            selectedConversationId
        ) || null,
      [
        conversations,
        selectedConversationId,
      ]
    );

  const selectedPatient =
    useMemo(() => {
      if (
        !selectedConversation
      ) {
        return null;
      }

      return (
        patients.find(
          (patient) =>
            patient.id ===
            selectedConversation.patientId
        ) || null
      );
    }, [
      patients,
      selectedConversation,
    ]);

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredConversations =
    useMemo(() => {
      const query =
        cleanText(
          search
        ).toLowerCase();

      return conversations.filter(
        (conversation) => {
          if (
            filter ===
              "unread" &&
            !Number(
              conversation.unreadCount ||
                0
            )
          ) {
            return false;
          }

          if (
            filter ===
              "open" &&
            conversation.status ===
              "closed"
          ) {
            return false;
          }

          if (
            filter ===
              "closed" &&
            conversation.status !==
              "closed"
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const haystack =
            [
              conversation.patientName,
              conversation.phone,
              conversation.patientCode,
              conversation.lastMessage,
            ]
              .join(" ")
              .toLowerCase();

          return haystack.includes(
            query
          );
        }
      );
    }, [
      conversations,
      search,
      filter,
    ]);

  const unreadTotal =
    useMemo(
      () =>
        conversations.reduce(
          (total, item) =>
            total +
            Number(
              item.unreadCount ||
                0
            ),
          0
        ),
      [conversations]
    );

  /* =======================================================
     SELECT CONVERSATION
  ======================================================= */

  async function selectConversation(
    conversation
  ) {
    setSelectedConversationId(
      conversation.id
    );

    try {
      await markConversationRead(
        clinicId,
        conversation.id
      );
    } catch (err) {
      console.error(err);
    }
  }

  /* =======================================================
     SEND
  ======================================================= */

  async function handleSendMessage() {
    const text =
      cleanText(
        messageText
      );

    if (
      !text ||
      !selectedConversation
    ) {
      return;
    }

    try {
      setSending(true);
      setError("");

      await sendWhatsAppMessage({
        clinicId,

        conversationId:
          selectedConversation.id,

        text,

        senderId:
          staffId || "",

        senderName:
          displayName || "",
      });

      setMessageText("");
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "تعذر إرسال الرسالة."
      );
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(
    event
  ) {
    if (
      event.key ===
        "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      handleSendMessage();
    }
  }

  /* =======================================================
     TEMPLATE
  ======================================================= */

  function selectTemplate(
    template
  ) {
    const text =
      applyWhatsAppTemplate(
        template.text,
        {
          name:
            selectedConversation
              ?.patientName ||
            "حضرتك",

          date: "موعدك",

          time: "",
        }
      );

    setMessageText(text);

    setTemplatesOpen(
      false
    );
  }

  /* =======================================================
     STATUS
  ======================================================= */

  async function toggleConversationStatus() {
    if (
      !selectedConversation
    ) {
      return;
    }

    try {
      const nextStatus =
        selectedConversation.status ===
        "closed"
          ? "open"
          : "closed";

      await setConversationStatus(
        clinicId,
        selectedConversation.id,
        nextStatus
      );

      setSuccess(
        nextStatus === "closed"
          ? "تم إغلاق المحادثة."
          : "تم إعادة فتح المحادثة."
      );
    } catch (err) {
      setError(
        err?.message ||
          "تعذر تحديث المحادثة."
      );
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="wa-page">
      {/* =================================================
          HEADER
      ================================================= */}

      <header className="wa-page-header">
        <div>
          <div className="wa-page-eyebrow">
            <MessageCircle
              size={15}
            />

            مركز التواصل
          </div>

          <h1>
            WhatsApp Inbox
          </h1>

          <p>
            إدارة رسائل المرضى
            والحجوزات من مكان
            واحد
          </p>
        </div>

        <div className="wa-header-actions">
          <div className="wa-live-badge">
            <span />

            متصل بالنظام
          </div>

          <button
            className="wa-primary-button"
            onClick={() =>
              setNewConversationOpen(
                true
              )
            }
          >
            <Plus size={17} />

            محادثة جديدة
          </button>
        </div>
      </header>

      {/* =================================================
          ALERTS
      ================================================= */}

      {error && (
        <div className="wa-alert wa-alert-error">
          <span>
            {error}
          </span>

          <button
            onClick={() =>
              setError("")
            }
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="wa-alert wa-alert-success">
          <span>
            {success}
          </span>

          <button
            onClick={() =>
              setSuccess("")
            }
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* =================================================
          WORKSPACE
      ================================================= */}

      <section className="wa-workspace">
        {/* ===============================================
            CONVERSATIONS
        =============================================== */}

        <aside className="wa-conversations">
          <div className="wa-conversations-head">
            <div className="wa-conversations-title">
              <div>
                <Inbox
                  size={18}
                />

                <strong>
                  المحادثات
                </strong>
              </div>

              <span>
                {
                  conversations.length
                }
              </span>
            </div>

            <div className="wa-search">
              <Search
                size={17}
              />

              <input
                value={search}
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                placeholder="بحث بالاسم أو الرقم..."
              />
            </div>

            <div className="wa-filter-tabs">
              <button
                className={
                  filter === "all"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter(
                    "all"
                  )
                }
              >
                الكل
              </button>

              <button
                className={
                  filter ===
                  "unread"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter(
                    "unread"
                  )
                }
              >
                غير مقروءة

                {unreadTotal >
                  0 && (
                  <b>
                    {
                      unreadTotal
                    }
                  </b>
                )}
              </button>

              <button
                className={
                  filter === "open"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter(
                    "open"
                  )
                }
              >
                مفتوحة
              </button>
            </div>
          </div>

          <div className="wa-conversation-list">
            {loading ? (
              <div className="wa-list-state">
                <RefreshCw
                  className="wa-spin"
                  size={22}
                />

                <span>
                  جاري تحميل
                  المحادثات...
                </span>
              </div>
            ) : filteredConversations.length ===
              0 ? (
              <div className="wa-list-state">
                <MessageCircle
                  size={28}
                />

                <strong>
                  لا توجد
                  محادثات
                </strong>

                <span>
                  ابدأ محادثة
                  جديدة مع أحد
                  المرضى
                </span>
              </div>
            ) : (
              filteredConversations.map(
                (
                  conversation
                ) => (
                  <button
                    key={
                      conversation.id
                    }
                    className={[
                      "wa-conversation-item",

                      selectedConversationId ===
                      conversation.id
                        ? "active"
                        : "",

                      Number(
                        conversation.unreadCount ||
                          0
                      ) > 0
                        ? "unread"
                        : "",
                    ].join(
                      " "
                    )}
                    onClick={() =>
                      selectConversation(
                        conversation
                      )
                    }
                  >
                    <div className="wa-conversation-avatar">
                      {getInitial(
                        conversation.patientName
                      )}

                      <span />
                    </div>

                    <div className="wa-conversation-body">
                      <div className="wa-conversation-row">
                        <strong>
                          {conversation.patientName ||
                            conversation.phone}
                        </strong>

                        <time>
                          {formatConversationDate(
                            conversation.lastMessageAt ||
                              conversation.updatedAt
                          )}
                        </time>
                      </div>

                      <div className="wa-conversation-row wa-conversation-preview">
                        <span>
                          {conversation.lastMessage ||
                            "محادثة جديدة"}
                        </span>

                        {Number(
                          conversation.unreadCount ||
                            0
                        ) >
                          0 && (
                          <b>
                            {
                              conversation.unreadCount
                            }
                          </b>
                        )}
                      </div>
                    </div>
                  </button>
                )
              )
            )}
          </div>
        </aside>

        {/* ===============================================
            CHAT
        =============================================== */}

        <main className="wa-chat">
          {!selectedConversation ? (
            <div className="wa-empty-chat">
              <div className="wa-empty-chat-icon">
                <MessageCircle
                  size={34}
                />
              </div>

              <h2>
                WhatsApp Inbox
              </h2>

              <p>
                اختر محادثة من
                القائمة لعرض
                الرسائل أو ابدأ
                محادثة جديدة.
              </p>

              <button
                className="wa-primary-button"
                onClick={() =>
                  setNewConversationOpen(
                    true
                  )
                }
              >
                <Plus
                  size={17}
                />

                محادثة جديدة
              </button>
            </div>
          ) : (
            <>
              {/* CHAT HEADER */}

              <div className="wa-chat-header">
                <div className="wa-chat-contact">
                  <div className="wa-chat-avatar">
                    {getInitial(
                      selectedConversation.patientName
                    )}
                  </div>

                  <div>
                    <strong>
                      {selectedConversation.patientName ||
                        selectedConversation.phone}
                    </strong>

                    <span>
                      {
                        selectedConversation.phone
                      }
                    </span>
                  </div>
                </div>

                <div className="wa-chat-actions">
                  {selectedPatient && (
                    <button
                      onClick={() =>
                        navigate(
                          `/patients/${selectedPatient.id}`
                        )
                      }
                      title="فتح ملف المريض"
                    >
                      <CircleUserRound
                        size={18}
                      />
                    </button>
                  )}

                  <button
                    onClick={() =>
                      setAppointmentOpen(
                        true
                      )
                    }
                    title="إنشاء حجز"
                  >
                    <CalendarDays
                      size={18}
                    />
                  </button>

                  <button
                    onClick={
                      toggleConversationStatus
                    }
                    title={
                      selectedConversation.status ===
                      "closed"
                        ? "إعادة فتح المحادثة"
                        : "إغلاق المحادثة"
                    }
                  >
                    <Archive
                      size={18}
                    />
                  </button>

                  <button title="المزيد">
                    <MoreVertical
                      size={18}
                    />
                  </button>
                </div>
              </div>

              {/* PATIENT STRIP */}

              {!selectedPatient && (
                <div className="wa-unlinked-patient">
                  <div>
                    <UserPlus
                      size={18}
                    />

                    <span>
                      هذا الرقم غير
                      مرتبط بملف مريض.
                    </span>
                  </div>

                  <div>
                    <button
                      onClick={() =>
                        setLinkPatientOpen(
                          true
                        )
                      }
                    >
                      ربط بمريض
                    </button>

                    <button
                      className="primary"
                      onClick={() =>
                        setCreatePatientOpen(
                          true
                        )
                      }
                    >
                      إنشاء مريض
                    </button>
                  </div>
                </div>
              )}

              {/* MESSAGES */}

              <div className="wa-messages">
                {messagesLoading ? (
                  <div className="wa-message-loading">
                    <RefreshCw
                      className="wa-spin"
                      size={20}
                    />

                    جاري تحميل
                    الرسائل...
                  </div>
                ) : messages.length ===
                  0 ? (
                  <div className="wa-chat-start">
                    <MessageCircle
                      size={25}
                    />

                    <strong>
                      بداية المحادثة
                    </strong>

                    <span>
                      أرسل أول رسالة
                      للمريض
                    </span>
                  </div>
                ) : (
                  messages.map(
                    (message) => {
                      if (
                        message.direction ===
                          "system" ||
                        message.type ===
                          "appointment"
                      ) {
                        return (
                          <AppointmentMessage
                            key={
                              message.id
                            }
                            message={
                              message
                            }
                          />
                        );
                      }

                      const outbound =
                        message.direction ===
                        "outbound";

                      return (
                        <div
                          key={
                            message.id
                          }
                          className={[
                            "wa-message-row",

                            outbound
                              ? "outbound"
                              : "inbound",
                          ].join(
                            " "
                          )}
                        >
                          <div className="wa-message-bubble">
                            <p>
                              {
                                message.text
                              }
                            </p>

                            <div className="wa-message-meta">
                              <time>
                                {formatTime(
                                  message.createdAt
                                )}
                              </time>

                              {getMessageStatusIcon(
                                message
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )
                )}

                <div
                  ref={
                    messagesEndRef
                  }
                />
              </div>

              {/* COMPOSER */}

              <div className="wa-composer">
                {templatesOpen && (
                  <div className="wa-template-menu">
                    <div className="wa-template-menu-head">
                      <strong>
                        رسائل جاهزة
                      </strong>

                      <button
                        onClick={() =>
                          setTemplatesOpen(
                            false
                          )
                        }
                      >
                        <X
                          size={16}
                        />
                      </button>
                    </div>

                    {WHATSAPP_TEMPLATES.map(
                      (
                        template
                      ) => (
                        <button
                          key={
                            template.id
                          }
                          onClick={() =>
                            selectTemplate(
                              template
                            )
                          }
                        >
                          <strong>
                            {
                              template.title
                            }
                          </strong>

                          <span>
                            {
                              template.text
                            }
                          </span>
                        </button>
                      )
                    )}
                  </div>
                )}

                <button
                  className="wa-template-trigger"
                  onClick={() =>
                    setTemplatesOpen(
                      (current) =>
                        !current
                    )
                  }
                  title="رسائل جاهزة"
                >
                  <FileText
                    size={18}
                  />
                </button>

                <textarea
                  value={
                    messageText
                  }
                  onChange={(
                    event
                  ) =>
                    setMessageText(
                      event.target
                        .value
                    )
                  }
                  onKeyDown={
                    handleComposerKeyDown
                  }
                  rows={1}
                  placeholder="اكتب رسالة..."
                />

                <button
                  className="wa-send-button"
                  disabled={
                    sending ||
                    !cleanText(
                      messageText
                    )
                  }
                  onClick={
                    handleSendMessage
                  }
                >
                  {sending ? (
                    <RefreshCw
                      className="wa-spin"
                      size={18}
                    />
                  ) : (
                    <Send
                      size={18}
                    />
                  )}
                </button>
              </div>
            </>
          )}
        </main>

        {/* ===============================================
            PATIENT INFO
        =============================================== */}

        {selectedConversation && (
          <aside className="wa-patient-panel">
            <div className="wa-patient-profile">
              <div className="wa-patient-big-avatar">
                {getInitial(
                  selectedConversation.patientName
                )}
              </div>

              <strong>
                {selectedConversation.patientName ||
                  "مريض جديد"}
              </strong>

              <span>
                {
                  selectedConversation.phone
                }
              </span>

              {selectedConversation.patientCode && (
                <b>
                  {
                    selectedConversation.patientCode
                  }
                </b>
              )}
            </div>

            <div className="wa-patient-panel-section">
              <span className="wa-panel-label">
                ملف المريض
              </span>

              {selectedPatient ? (
                <>
                  <InfoRow
                    icon={
                      Users
                    }
                    label="الاسم"
                    value={
                      selectedPatient.name
                    }
                  />

                  <InfoRow
                    icon={
                      Phone
                    }
                    label="الهاتف"
                    value={
                      selectedPatient.phone
                    }
                  />

                  <button
                    className="wa-panel-action"
                    onClick={() =>
                      navigate(
                        `/patients/${selectedPatient.id}`
                      )
                    }
                  >
                    فتح الملف الطبي

                    <ChevronLeft
                      size={16}
                    />
                  </button>
                </>
              ) : (
                <div className="wa-no-patient">
                  <span>
                    لا يوجد ملف مريض
                    مرتبط بهذا الرقم.
                  </span>

                  <button
                    onClick={() =>
                      setCreatePatientOpen(
                        true
                      )
                    }
                  >
                    <UserPlus
                      size={16}
                    />

                    إنشاء ملف
                  </button>
                </div>
              )}
            </div>

            <div className="wa-patient-panel-section">
              <span className="wa-panel-label">
                إجراءات سريعة
              </span>

              <button
                className="wa-quick-action primary"
                onClick={() =>
                  setAppointmentOpen(
                    true
                  )
                }
              >
                <CalendarDays
                  size={17}
                />

                إنشاء حجز
              </button>

              <button
                className="wa-quick-action"
                onClick={() =>
                  setTemplatesOpen(
                    true
                  )
                }
              >
                <MessageCircle
                  size={17}
                />

                إرسال رسالة جاهزة
              </button>
            </div>

            <div className="wa-patient-panel-section">
              <span className="wa-panel-label">
                حالة المحادثة
              </span>

              <div
                className={[
                  "wa-status-box",

                  selectedConversation.status ===
                  "closed"
                    ? "closed"
                    : "",
                ].join(" ")}
              >
                <span />

                {selectedConversation.status ===
                "closed"
                  ? "مغلقة"
                  : "مفتوحة"}
              </div>
            </div>
          </aside>
        )}
      </section>

      {/* =================================================
          DIALOGS
      ================================================= */}

      {newConversationOpen && (
        <NewConversationDialog
          patients={
            patients
          }
          clinicId={
            clinicId
          }
          staffId={
            staffId
          }
          onClose={() =>
            setNewConversationOpen(
              false
            )
          }
          onCreated={(
            conversation
          ) => {
            setSelectedConversationId(
              conversation.id
            );

            setNewConversationOpen(
              false
            );

            setSuccess(
              "تم فتح المحادثة."
            );
          }}
        />
      )}

      {createPatientOpen &&
        selectedConversation && (
          <CreatePatientDialog
            clinicId={
              clinicId
            }
            conversation={
              selectedConversation
            }
            staffId={
              staffId
            }
            onClose={() =>
              setCreatePatientOpen(
                false
              )
            }
            onCreated={async (
              patient
            ) => {
              await linkConversationToPatient(
                {
                  clinicId,

                  conversationId:
                    selectedConversation.id,

                  patient,
                }
              );

              setCreatePatientOpen(
                false
              );

              setSuccess(
                "تم إنشاء ملف المريض وربطه بالمحادثة."
              );
            }}
          />
        )}

      {linkPatientOpen &&
        selectedConversation && (
          <LinkPatientDialog
            patients={
              patients
            }
            onClose={() =>
              setLinkPatientOpen(
                false
              )
            }
            onSelect={async (
              patient
            ) => {
              try {
                await linkConversationToPatient(
                  {
                    clinicId,

                    conversationId:
                      selectedConversation.id,

                    patient,
                  }
                );

                setLinkPatientOpen(
                  false
                );

                setSuccess(
                  "تم ربط المريض بالمحادثة."
                );
              } catch (err) {
                setError(
                  err?.message ||
                    "تعذر ربط المريض."
                );
              }
            }}
          />
        )}

      {appointmentOpen &&
        selectedConversation && (
          <AppointmentDialog
            clinicId={
              clinicId
            }
            conversation={
              selectedConversation
            }
            patient={
              selectedPatient
            }
            patients={
              patients
            }
            doctors={
              doctors
            }
            staffId={
              staffId
            }
            onNeedPatient={() => {
              setAppointmentOpen(
                false
              );

              setCreatePatientOpen(
                true
              );
            }}
            onClose={() =>
              setAppointmentOpen(
                false
              )
            }
            onCreated={() => {
              setAppointmentOpen(
                false
              );

              setSuccess(
                "تم إنشاء الحجز وظهر في المواعيد."
              );
            }}
          />
        )}
    </div>
  );
}

/* =========================================================
   INFO ROW
========================================================= */

function InfoRow({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="wa-info-row">
      <div className="wa-info-icon">
        <Icon size={15} />
      </div>

      <div>
        <span>
          {label}
        </span>

        <strong>
          {value || "—"}
        </strong>
      </div>
    </div>
  );
}

/* =========================================================
   APPOINTMENT MESSAGE
========================================================= */

function AppointmentMessage({
  message,
}) {
  return (
    <div className="wa-system-event">
      <div className="wa-system-event-icon">
        <CalendarDays
          size={17}
        />
      </div>

      <div>
        <span>
          تم إنشاء حجز
        </span>

        <strong>
          {message.date}
          {" · "}
          {message.time}
        </strong>

        {message.doctorName && (
          <small>
            {message.doctorName}
          </small>
        )}
      </div>

      <CheckCheck
        size={16}
      />
    </div>
  );
}

/* =========================================================
   DIALOG SHELL
========================================================= */

function DialogShell({
  title,
  subtitle,
  children,
  onClose,
  width = "520px",
}) {
  return (
    <div
      className="wa-dialog-backdrop"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        className="wa-dialog"
        style={{
          maxWidth: width,
        }}
      >
        <div className="wa-dialog-header">
          <div>
            <h2>
              {title}
            </h2>

            {subtitle && (
              <p>
                {subtitle}
              </p>
            )}
          </div>

          <button
            onClick={
              onClose
            }
          >
            <X size={19} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

/* =========================================================
   NEW CONVERSATION
========================================================= */

function NewConversationDialog({
  patients,
  clinicId,
  staffId,
  onClose,
  onCreated,
}) {
  const [
    mode,
    setMode,
  ] = useState("patient");

  const [
    patientSearch,
    setPatientSearch,
  ] = useState("");

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    name,
    setName,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const filteredPatients =
    useMemo(() => {
      const query =
        cleanText(
          patientSearch
        ).toLowerCase();

      if (!query) {
        return patients.slice(
          0,
          20
        );
      }

      return patients
        .filter((patient) =>
          [
            patient.name,
            patient.phone,
            patient.patientCode,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
        )
        .slice(0, 20);
    }, [
      patients,
      patientSearch,
    ]);

  async function createFromPatient(
    patient
  ) {
    try {
      setSaving(true);

      const conversation =
        await createConversationFromPhone(
          {
            clinicId,

            phone:
              patient.phone,

            displayName:
              patient.name,

            createdBy:
              staffId || "",
          }
        );

      onCreated(
        conversation
      );
    } catch (err) {
      setError(
        err?.message ||
          "تعذر فتح المحادثة."
      );
    } finally {
      setSaving(false);
    }
  }

  async function createFromPhone() {
    if (
      !cleanText(phone)
    ) {
      setError(
        "اكتب رقم الهاتف."
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      const conversation =
        await createConversationFromPhone(
          {
            clinicId,
            phone,
            displayName:
              name,
            createdBy:
              staffId || "",
          }
        );

      onCreated(
        conversation
      );
    } catch (err) {
      setError(
        err?.message ||
          "تعذر فتح المحادثة."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogShell
      title="محادثة جديدة"
      subtitle="اختر مريضًا مسجلًا أو ابدأ برقم هاتف جديد."
      onClose={onClose}
    >
      <div className="wa-dialog-tabs">
        <button
          className={
            mode === "patient"
              ? "active"
              : ""
          }
          onClick={() =>
            setMode(
              "patient"
            )
          }
        >
          مريض مسجل
        </button>

        <button
          className={
            mode === "phone"
              ? "active"
              : ""
          }
          onClick={() =>
            setMode(
              "phone"
            )
          }
        >
          رقم جديد
        </button>
      </div>

      {error && (
        <div className="wa-dialog-error">
          {error}
        </div>
      )}

      {mode === "patient" ? (
        <div className="wa-dialog-body">
          <label className="wa-field">
            <span>
              البحث عن مريض
            </span>

            <div className="wa-input-icon">
              <Search
                size={16}
              />

              <input
                value={
                  patientSearch
                }
                onChange={(
                  event
                ) =>
                  setPatientSearch(
                    event.target
                      .value
                  )
                }
                placeholder="الاسم، الهاتف أو كود المريض"
                autoFocus
              />
            </div>
          </label>

          <div className="wa-patient-select-list">
            {filteredPatients.map(
              (patient) => (
                <button
                  key={
                    patient.id
                  }
                  disabled={
                    saving
                  }
                  onClick={() =>
                    createFromPatient(
                      patient
                    )
                  }
                >
                  <div className="wa-small-avatar">
                    {getInitial(
                      patient.name
                    )}
                  </div>

                  <div>
                    <strong>
                      {
                        patient.name
                      }
                    </strong>

                    <span>
                      {
                        patient.phone
                      }
                    </span>
                  </div>

                  <ChevronLeft
                    size={17}
                  />
                </button>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="wa-dialog-body">
          <label className="wa-field">
            <span>
              اسم المريض
            </span>

            <input
              value={name}
              onChange={(
                event
              ) =>
                setName(
                  event.target
                    .value
                )
              }
              placeholder="اختياري"
            />
          </label>

          <label className="wa-field">
            <span>
              رقم WhatsApp
            </span>

            <input
              value={phone}
              onChange={(
                event
              ) =>
                setPhone(
                  event.target
                    .value
                )
              }
              placeholder="01xxxxxxxxx"
              dir="ltr"
            />
          </label>

          <div className="wa-dialog-footer">
            <button
              className="wa-secondary-button"
              onClick={
                onClose
              }
            >
              إلغاء
            </button>

            <button
              className="wa-primary-button"
              disabled={
                saving
              }
              onClick={
                createFromPhone
              }
            >
              {saving ? (
                <RefreshCw
                  className="wa-spin"
                  size={17}
                />
              ) : (
                <MessageCircle
                  size={17}
                />
              )}

              فتح المحادثة
            </button>
          </div>
        </div>
      )}
    </DialogShell>
  );
}

/* =========================================================
   CREATE PATIENT
========================================================= */

function CreatePatientDialog({
  clinicId,
  conversation,
  staffId,
  onClose,
  onCreated,
}) {
  const [
    form,
    setForm,
  ] = useState({
    name:
      conversation.patientName &&
      conversation.patientName !==
        conversation.phone
        ? conversation.patientName
        : "",

    phone:
      conversation.phone ||
      "",

    gender: "",

    dateOfBirth: "",

    address: "",
  });

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  function change(
    key,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      })
    );
  }

  async function submit() {
    try {
      setSaving(true);
      setError("");

      const patient =
        await createPatientFromWhatsApp(
          {
            clinicId,

            ...form,

            createdBy:
              staffId || "",
          }
        );

      await onCreated(
        patient
      );
    } catch (err) {
      setError(
        err?.message ||
          "تعذر إنشاء المريض."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogShell
      title="إنشاء ملف مريض"
      subtitle="سيتم ربط الملف بهذه المحادثة تلقائيًا."
      onClose={onClose}
    >
      <div className="wa-dialog-body">
        {error && (
          <div className="wa-dialog-error">
            {error}
          </div>
        )}

        <div className="wa-form-grid">
          <label className="wa-field wa-field-full">
            <span>
              اسم المريض *
            </span>

            <input
              value={
                form.name
              }
              onChange={(
                event
              ) =>
                change(
                  "name",
                  event.target
                    .value
                )
              }
              placeholder="اسم المريض"
            />
          </label>

          <label className="wa-field wa-field-full">
            <span>
              رقم الهاتف *
            </span>

            <input
              value={
                form.phone
              }
              onChange={(
                event
              ) =>
                change(
                  "phone",
                  event.target
                    .value
                )
              }
              dir="ltr"
            />
          </label>

          <label className="wa-field">
            <span>
              النوع
            </span>

            <select
              value={
                form.gender
              }
              onChange={(
                event
              ) =>
                change(
                  "gender",
                  event.target
                    .value
                )
              }
            >
              <option value="">
                غير محدد
              </option>

              <option value="male">
                ذكر
              </option>

              <option value="female">
                أنثى
              </option>
            </select>
          </label>

          <label className="wa-field">
            <span>
              تاريخ الميلاد
            </span>

            <input
              type="date"
              value={
                form.dateOfBirth
              }
              onChange={(
                event
              ) =>
                change(
                  "dateOfBirth",
                  event.target
                    .value
                )
              }
            />
          </label>

          <label className="wa-field wa-field-full">
            <span>
              العنوان
            </span>

            <input
              value={
                form.address
              }
              onChange={(
                event
              ) =>
                change(
                  "address",
                  event.target
                    .value
                )
              }
              placeholder="العنوان - اختياري"
            />
          </label>
        </div>

        <div className="wa-dialog-footer">
          <button
            className="wa-secondary-button"
            onClick={
              onClose
            }
          >
            إلغاء
          </button>

          <button
            className="wa-primary-button"
            disabled={
              saving
            }
            onClick={
              submit
            }
          >
            {saving ? (
              <RefreshCw
                className="wa-spin"
                size={17}
              />
            ) : (
              <UserPlus
                size={17}
              />
            )}

            إنشاء وربط
          </button>
        </div>
      </div>
    </DialogShell>
  );
}

/* =========================================================
   LINK PATIENT
========================================================= */

function LinkPatientDialog({
  patients,
  onClose,
  onSelect,
}) {
  const [
    search,
    setSearch,
  ] = useState("");

  const filtered =
    useMemo(() => {
      const query =
        cleanText(
          search
        ).toLowerCase();

      return patients
        .filter((patient) =>
          !query
            ? true
            : [
                patient.name,
                patient.phone,
                patient.patientCode,
              ]
                .join(" ")
                .toLowerCase()
                .includes(query)
        )
        .slice(0, 30);
    }, [
      patients,
      search,
    ]);

  return (
    <DialogShell
      title="ربط بمريض"
      subtitle="اختر ملف المريض المرتبط برقم WhatsApp."
      onClose={onClose}
    >
      <div className="wa-dialog-body">
        <label className="wa-field">
          <span>
            البحث
          </span>

          <div className="wa-input-icon">
            <Search
              size={16}
            />

            <input
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="اسم، هاتف أو كود المريض"
              autoFocus
            />
          </div>
        </label>

        <div className="wa-patient-select-list">
          {filtered.map(
            (patient) => (
              <button
                key={
                  patient.id
                }
                onClick={() =>
                  onSelect(
                    patient
                  )
                }
              >
                <div className="wa-small-avatar">
                  {getInitial(
                    patient.name
                  )}
                </div>

                <div>
                  <strong>
                    {
                      patient.name
                    }
                  </strong>

                  <span>
                    {
                      patient.phone
                    }
                  </span>
                </div>

                <ChevronLeft
                  size={17}
                />
              </button>
            )
          )}
        </div>
      </div>
    </DialogShell>
  );
}

/* =========================================================
   APPOINTMENT
========================================================= */

function AppointmentDialog({
  clinicId,
  conversation,
  patient,
  doctors,
  staffId,
  onNeedPatient,
  onClose,
  onCreated,
}) {
  const [
    form,
    setForm,
  ] = useState({
    doctorId: "",

    date:
      getTodayString(),

    time: "",

    duration: 30,

    type: "كشف",

    notes: "",
  });

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const selectedDoctor =
    doctors.find(
      (doctor) =>
        doctor.id ===
        form.doctorId
    ) || null;

  function change(
    key,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      })
    );
  }

  async function submit() {
    if (!patient?.id) {
      onNeedPatient();
      return;
    }

    if (!form.date) {
      setError(
        "حدد تاريخ الموعد."
      );

      return;
    }

    if (!form.time) {
      setError(
        "حدد وقت الموعد."
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      await createWhatsAppAppointment(
        {
          clinicId,

          conversationId:
            conversation.id,

          patient,

          doctor:
            selectedDoctor,

          date:
            form.date,

          time:
            form.time,

          duration:
            form.duration,

          type:
            form.type,

          notes:
            form.notes,

          createdBy:
            staffId || "",
        }
      );

      onCreated();
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "تعذر إنشاء الحجز."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogShell
      title="إنشاء حجز من WhatsApp"
      subtitle="سيظهر الموعد مباشرة في شاشة المواعيد."
      onClose={onClose}
      width="580px"
    >
      <div className="wa-dialog-body">
        {!patient ? (
          <div className="wa-appointment-no-patient">
            <UserPlus
              size={25}
            />

            <strong>
              المحادثة غير
              مرتبطة بمريض
            </strong>

            <span>
              أنشئ ملف المريض
              أولاً قبل تسجيل
              الحجز.
            </span>

            <button
              className="wa-primary-button"
              onClick={
                onNeedPatient
              }
            >
              إنشاء ملف مريض
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div className="wa-dialog-error">
                {error}
              </div>
            )}

            <div className="wa-booking-patient">
              <div className="wa-small-avatar">
                {getInitial(
                  patient.name
                )}
              </div>

              <div>
                <span>
                  المريض
                </span>

                <strong>
                  {
                    patient.name
                  }
                </strong>

                <small>
                  {
                    patient.phone
                  }
                </small>
              </div>
            </div>

            <div className="wa-form-grid">
              <label className="wa-field wa-field-full">
                <span>
                  الطبيب
                </span>

                <select
                  value={
                    form.doctorId
                  }
                  onChange={(
                    event
                  ) =>
                    change(
                      "doctorId",
                      event.target
                        .value
                    )
                  }
                >
                  <option value="">
                    بدون تحديد
                    طبيب
                  </option>

                  {doctors.map(
                    (
                      doctor
                    ) => (
                      <option
                        key={
                          doctor.id
                        }
                        value={
                          doctor.id
                        }
                      >
                        {doctor.name ||
                          doctor.fullName ||
                          doctor.displayName ||
                          "طبيب"}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="wa-field">
                <span>
                  التاريخ *
                </span>

                <div className="wa-input-icon">
                  <CalendarDays
                    size={16}
                  />

                  <input
                    type="date"
                    min={
                      getTodayString()
                    }
                    value={
                      form.date
                    }
                    onChange={(
                      event
                    ) =>
                      change(
                        "date",
                        event.target
                          .value
                      )
                    }
                  />
                </div>
              </label>

              <label className="wa-field">
                <span>
                  الساعة *
                </span>

                <div className="wa-input-icon">
                  <Clock3
                    size={16}
                  />

                  <input
                    type="time"
                    value={
                      form.time
                    }
                    onChange={(
                      event
                    ) =>
                      change(
                        "time",
                        event.target
                          .value
                      )
                    }
                  />
                </div>
              </label>

              <label className="wa-field">
                <span>
                  نوع الزيارة
                </span>

                <select
                  value={
                    form.type
                  }
                  onChange={(
                    event
                  ) =>
                    change(
                      "type",
                      event.target
                        .value
                    )
                  }
                >
                  <option value="كشف">
                    كشف
                  </option>

                  <option value="استشارة">
                    استشارة
                  </option>

                  <option value="متابعة">
                    متابعة
                  </option>

                  <option value="إجراء">
                    إجراء
                  </option>
                </select>
              </label>

              <label className="wa-field">
                <span>
                  مدة الموعد
                </span>

                <select
                  value={
                    form.duration
                  }
                  onChange={(
                    event
                  ) =>
                    change(
                      "duration",
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                >
                  <option value={15}>
                    15 دقيقة
                  </option>

                  <option value={30}>
                    30 دقيقة
                  </option>

                  <option value={45}>
                    45 دقيقة
                  </option>

                  <option value={60}>
                    60 دقيقة
                  </option>
                </select>
              </label>

              <label className="wa-field wa-field-full">
                <span>
                  ملاحظات
                </span>

                <textarea
                  value={
                    form.notes
                  }
                  onChange={(
                    event
                  ) =>
                    change(
                      "notes",
                      event.target
                        .value
                    )
                  }
                  rows={3}
                  placeholder="ملاحظات على الحجز..."
                />
              </label>
            </div>

            <div className="wa-dialog-footer">
              <button
                className="wa-secondary-button"
                onClick={
                  onClose
                }
              >
                إلغاء
              </button>

              <button
                className="wa-primary-button"
                disabled={
                  saving
                }
                onClick={
                  submit
                }
              >
                {saving ? (
                  <RefreshCw
                    className="wa-spin"
                    size={17}
                  />
                ) : (
                  <CalendarDays
                    size={17}
                  />
                )}

                تأكيد الحجز
              </button>
            </div>
          </>
        )}
      </div>
    </DialogShell>
  );
}