import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarDays,
  ChevronLeft,
  LoaderCircle,
  Phone,
  Plus,
  Search,
  UserRound,
  Users,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../../context/AuthContext";

import {
  subscribeToPatients,
} from "../../services/patientService";

import AddPatientDrawer from './AddPatientDrawer';

import "./PatientsPage.css";

function calculateAge(
  dateOfBirth
) {
  if (!dateOfBirth) {
    return null;
  }

  const birth =
    new Date(dateOfBirth);

  if (
    Number.isNaN(
      birth.getTime()
    )
  ) {
    return null;
  }

  const today =
    new Date();

  let age =
    today.getFullYear() -
    birth.getFullYear();

  const month =
    today.getMonth() -
    birth.getMonth();

  if (
    month < 0 ||
    (month === 0 &&
      today.getDate() <
        birth.getDate())
  ) {
    age--;
  }

  return Math.max(age, 0);
}

function formatDate(timestamp) {
  if (!timestamp) {
    return "—";
  }

  const date =
    typeof timestamp ===
    "number"
      ? new Date(timestamp)
      : new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function getInitials(name = "") {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "؟";
  }

  return parts
    .slice(0, 2)
    .map(
      (part) => part[0]
    )
    .join("");
}

function genderLabel(
  gender
) {
  if (gender === "male") {
    return "ذكر";
  }

  if (gender === "female") {
    return "أنثى";
  }

  return "—";
}

export default function PatientsPage() {
  const navigate =
    useNavigate();

  const { clinicId } =
    useAuth();

  const [patients, setPatients] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [drawerOpen, setDrawerOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!clinicId) return;

    setLoading(true);
    setError("");

    const unsubscribe =
      subscribeToPatients(
        clinicId,

        (data) => {
          setPatients(data);
          setLoading(false);
        },

        (err) => {
          console.error(err);

          setError(
            "تعذر تحميل ملفات المرضى."
          );

          setLoading(false);
        }
      );

    return () =>
      unsubscribe?.();
  }, [clinicId]);

  const filteredPatients =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return patients;
      }

      return patients.filter(
        (patient) => {
          return [
            patient.name,
            patient.phone,
            patient.patientCode,
            patient.address,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(query)
            );
        }
      );
    }, [
      patients,
      search,
    ]);

  const todayCount =
    useMemo(() => {
      const now =
        new Date();

      return patients.filter(
        (patient) => {
          if (
            !patient.createdAt
          ) {
            return false;
          }

          const created =
            new Date(
              patient.createdAt
            );

          return (
            created.getFullYear() ===
              now.getFullYear() &&
            created.getMonth() ===
              now.getMonth() &&
            created.getDate() ===
              now.getDate()
          );
        }
      ).length;
    }, [patients]);

  return (
    <div className="patients-page">
      <header className="patients-page-header">
        <div>
          <span className="patients-eyebrow">
            PATIENT RECORDS
          </span>

          <h1>المرضى</h1>

          <p>
            ملفات المرضى المسجلة
            داخل العيادة
          </p>
        </div>

        <button
          className="add-patient-button"
          onClick={() =>
            setDrawerOpen(true)
          }
        >
          <Plus size={17} />
          مريض جديد
        </button>
      </header>

      <section className="patients-summary-strip">
        <div>
          <Users size={18} />

          <span>
            إجمالي المرضى
          </span>

          <strong>
            {patients.length}
          </strong>
        </div>

        <div>
          <UserRound
            size={18}
          />

          <span>
            ملفات اليوم
          </span>

          <strong>
            {todayCount}
          </strong>
        </div>

       
      </section>

      <section className="patients-workspace">
        <div className="patients-toolbar">
          <div className="patients-search">
            <Search size={18} />

            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="بحث بالاسم، الهاتف أو رقم الملف..."
            />
          </div>

          <span className="patients-results">
            {
              filteredPatients.length
            }{" "}
            ملف
          </span>
        </div>

        {loading ? (
          <div className="patients-state">
            <LoaderCircle
              size={24}
              className="patient-loading-icon"
            />

            <strong>
              جاري تحميل المرضى
            </strong>

            <span>
              يتم الاتصال بقاعدة
              البيانات...
            </span>
          </div>
        ) : error ? (
          <div className="patients-state patients-error">
            <strong>
              تعذر تحميل المرضى
            </strong>

            <span>
              {error}
            </span>
          </div>
        ) : filteredPatients
            .length === 0 ? (
          <div className="patients-empty">
            <div className="patients-empty-icon">
              <UserRound
                size={26}
              />
            </div>

            <strong>
              {search
                ? "لا توجد نتائج مطابقة"
                : "لا يوجد مرضى حتى الآن"}
            </strong>

            <p>
              {search
                ? "جرب البحث باسم أو رقم هاتف آخر."
                : "ابدأ بإنشاء أول ملف مريض داخل العيادة."}
            </p>

            {!search && (
              <button
                onClick={() =>
                  setDrawerOpen(
                    true
                  )
                }
              >
                <Plus
                  size={16}
                />
                إضافة أول مريض
              </button>
            )}
          </div>
        ) : (
          <div className="patients-table">
            <div className="patients-table-head">
              <span>المريض</span>
              <span>رقم الملف</span>
              <span>الهاتف</span>
              <span>النوع / العمر</span>
              <span>تاريخ التسجيل</span>
              <span />
            </div>

            {filteredPatients.map(
              (patient) => {
                const age =
                  calculateAge(
                    patient.dateOfBirth
                  );

                return (
                  <button
                    className="patient-record-row"
                    key={
                      patient.id
                    }
                    onClick={() =>
                      navigate(
                        `/patients/${patient.id}`
                      )
                    }
                  >
                    <div className="patient-record-person">
                      <span className="patient-record-avatar">
                        {getInitials(
                          patient.name
                        )}
                      </span>

                      <div>
                        <strong>
                          {
                            patient.name
                          }
                        </strong>

                        <small>
                          {patient.address ||
                            "لا يوجد عنوان مسجل"}
                        </small>
                      </div>
                    </div>

                    <span className="patient-code">
                      {patient.patientCode ||
                        "—"}
                    </span>

                    <span className="patient-phone">
                      <Phone
                        size={14}
                      />

                      {patient.phone ||
                        "—"}
                    </span>

                    <span>
                      {genderLabel(
                        patient.gender
                      )}

                      {age !== null
                        ? ` • ${age} سنة`
                        : ""}
                    </span>

                    <span className="patient-created">
                      <CalendarDays
                        size={14}
                      />

                      {formatDate(
                        patient.createdAt
                      )}
                    </span>

                    <ChevronLeft
                      size={17}
                      className="patient-row-arrow"
                    />
                  </button>
                );
              }
            )}
          </div>
        )}
      </section>

      <AddPatientDrawer
        open={drawerOpen}
        onClose={() =>
          setDrawerOpen(false)
        }
        onCreated={(patient) => {
          console.log(
            "Patient created:",
            patient.id
          );
        }}
      />
    </div>
  );
}