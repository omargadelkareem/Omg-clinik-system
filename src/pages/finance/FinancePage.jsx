import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpLeft,
  Banknote,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  Landmark,
  LoaderCircle,
  Plus,
  Printer,
  Receipt,
  Search,
  Stethoscope,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  calculateCurrentDebts,
  calculateFinanceStatistics,
  calculateShiftSummary,
  closeFinanceShift,
  collectFinancePayment,
  createFinanceExpense,
  getFinanceDateRange,
  getOpenFinanceShift,
  getTransactionPayments,
  openFinanceShift,
  subscribeFinanceExpenses,
  subscribeFinancePayments,
  subscribeFinanceShifts,
  subscribeFinanceTransactions,
} from "../../services/financeService";

import "./FinancePage.css";

/* =========================================================
   HELPERS
========================================================= */

function money(value) {
  return Number(
    value || 0
  ).toLocaleString(
    "ar-EG",
    {
      maximumFractionDigits: 2,
    }
  );
}

function timestamp(value) {
  if (!value) return 0;

  if (
    typeof value ===
    "number"
  ) {
    return value;
  }

  const parsed =
    new Date(
      value
    ).getTime();

  return Number.isNaN(
    parsed
  )
    ? 0
    : parsed;
}

function formatDate(value) {
  const time =
    timestamp(value);

  if (!time) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(
    new Date(time)
  );
}

function formatTime(value) {
  const time =
    timestamp(value);

  if (!time) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "ar-EG",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(
    new Date(time)
  );
}

function getUserName(
  profile
) {
  return (
    profile?.name ||
    profile?.fullName ||
    profile?.displayName ||
    ""
  );
}

function getPatientName(
  item
) {
  return (
    item.patientName ||
    item.patient ||
    "مريض"
  );
}

function getPatientCode(
  item
) {
  return (
    item.patientCode ||
    item.patientId ||
    "—"
  );
}

function getServiceName(
  item
) {
  return (
    item.serviceType ||
    item.serviceName ||
    item.type ||
    "خدمة"
  );
}

function getDoctorName(
  item
) {
  return (
    item.doctorName ||
    item.doctor ||
    "غير محدد"
  );
}

function getRemaining(
  item
) {
  if (
    item.remaining !==
    undefined
  ) {
    return Number(
      item.remaining || 0
    );
  }

  return Math.max(
    Number(
      item.amount || 0
    ) -
      Number(
        item.paid || 0
      ),
    0
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function FinancePage() {
  const {
    clinicId,
    staffId,
    profile,
    clinic,
  } = useAuth();

  const [
    transactions,
    setTransactions,
  ] = useState([]);

  const [
    payments,
    setPayments,
  ] = useState([]);

  const [
    expenses,
    setExpenses,
  ] = useState([]);

  const [
    shifts,
    setShifts,
  ] = useState([]);

  const [
    openShift,
    setOpenShift,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    activeTab,
    setActiveTab,
  ] = useState(
    "overview"
  );

  const [
    period,
    setPeriod,
  ] = useState(
    "today"
  );

  const [
    customStart,
    setCustomStart,
  ] = useState("");

  const [
    customEnd,
    setCustomEnd,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    transactionFilter,
    setTransactionFilter,
  ] = useState(
    "all"
  );

  const [
    selectedInvoice,
    setSelectedInvoice,
  ] = useState(null);

  const [
    invoicePayments,
    setInvoicePayments,
  ] = useState([]);

  const [
    paymentTarget,
    setPaymentTarget,
  ] = useState(null);

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState(
    "cash"
  );

  const [
    paymentAmount,
    setPaymentAmount,
  ] = useState("");

  const [
    paymentNotes,
    setPaymentNotes,
  ] = useState("");

  const [
    paymentSaving,
    setPaymentSaving,
  ] = useState(false);

  const [
    expenseOpen,
    setExpenseOpen,
  ] = useState(false);

  const [
    expenseSaving,
    setExpenseSaving,
  ] = useState(false);

  const [
    expense,
    setExpense,
  ] = useState({
    title: "",
    amount: "",
    category:
      "medical_supplies",
    method: "cash",
    notes: "",
  });

  const [
    shiftOpenModal,
    setShiftOpenModal,
  ] = useState(false);

  const [
    shiftCloseModal,
    setShiftCloseModal,
  ] = useState(false);

  const [
    openingBalance,
    setOpeningBalance,
  ] = useState("");

  const [
    actualCash,
    setActualCash,
  ] = useState("");

  const [
    shiftSaving,
    setShiftSaving,
  ] = useState(false);

  /* =======================================================
     REALTIME
  ======================================================= */

  useEffect(() => {
    if (!clinicId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    let readyTransactions =
      false;

    let readyPayments =
      false;

    let readyExpenses =
      false;

    let readyShifts =
      false;

    const checkReady =
      () => {
        if (
          readyTransactions &&
          readyPayments &&
          readyExpenses &&
          readyShifts
        ) {
          setLoading(
            false
          );
        }
      };

    const unsubscribeTransactions =
      subscribeFinanceTransactions(
        clinicId,
        (items) => {
          setTransactions(
            items
          );

          readyTransactions =
            true;

          checkReady();
        },
        (err) => {
          console.error(
            err
          );

          setError(
            "تعذر تحميل الحركة المالية."
          );

          readyTransactions =
            true;

          checkReady();
        }
      );

    const unsubscribePayments =
      subscribeFinancePayments(
        clinicId,
        (items) => {
          setPayments(
            items
          );

          readyPayments =
            true;

          checkReady();
        },
        (err) => {
          console.error(
            err
          );

          readyPayments =
            true;

          checkReady();
        }
      );

    const unsubscribeExpenses =
      subscribeFinanceExpenses(
        clinicId,
        (items) => {
          setExpenses(
            items
          );

          readyExpenses =
            true;

          checkReady();
        },
        (err) => {
          console.error(
            err
          );

          readyExpenses =
            true;

          checkReady();
        }
      );

    const unsubscribeShifts =
      subscribeFinanceShifts(
        clinicId,
        (items) => {
          setShifts(
            items
          );

          setOpenShift(
            items.find(
              (item) =>
                item.status ===
                "open"
            ) || null
          );

          readyShifts =
            true;

          checkReady();
        },
        (err) => {
          console.error(
            err
          );

          readyShifts =
            true;

          checkReady();
        }
      );

    return () => {
      unsubscribeTransactions?.();
      unsubscribePayments?.();
      unsubscribeExpenses?.();
      unsubscribeShifts?.();
    };
  }, [clinicId]);

  /* =======================================================
     ALERT TIMER
  ======================================================= */

  useEffect(() => {
    if (!success) {
      return undefined;
    }

    const timer =
      window.setTimeout(
        () => {
          setSuccess(
            ""
          );
        },
        3000
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [success]);

  /* =======================================================
     DATE RANGE
  ======================================================= */

  const dateRange =
    useMemo(
      () =>
        getFinanceDateRange(
          period,
          customStart,
          customEnd
        ),
      [
        period,
        customStart,
        customEnd,
      ]
    );

  /* =======================================================
     STATISTICS
  ======================================================= */

  const statistics =
    useMemo(
      () =>
        calculateFinanceStatistics(
          {
            transactions,
            payments,
            expenses,

            startDate:
              dateRange.start,

            endDate:
              dateRange.end,
          }
        ),
      [
        transactions,
        payments,
        expenses,
        dateRange,
      ]
    );

  const currentDebts =
    useMemo(
      () =>
        calculateCurrentDebts(
          transactions
        ),
      [transactions]
    );

  const shiftSummary =
    useMemo(
      () =>
        calculateShiftSummary(
          {
            shift:
              openShift,

            payments,

            expenses,
          }
        ),
      [
        openShift,
        payments,
        expenses,
      ]
    );

  /* =======================================================
     FILTER TRANSACTIONS
  ======================================================= */

  const filteredTransactions =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return statistics.transactions.filter(
        (item) => {
          if (
            transactionFilter !==
              "all" &&
            item.status !==
              transactionFilter
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const text = [
            getPatientName(
              item
            ),
            getPatientCode(
              item
            ),
            item.invoiceNumber,
            getServiceName(
              item
            ),
            getDoctorName(
              item
            ),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return text.includes(
            query
          );
        }
      );
    }, [
      statistics.transactions,
      search,
      transactionFilter,
    ]);

  /* =======================================================
     INVOICE
  ======================================================= */

  const openInvoice =
    async (item) => {
      setSelectedInvoice(
        item
      );

      try {
        const result =
          await getTransactionPayments(
            clinicId,
            item.id
          );

        setInvoicePayments(
          result
        );
      } catch (err) {
        console.error(
          err
        );

        setInvoicePayments(
          []
        );
      }
    };

  /* =======================================================
     PAYMENT
  ======================================================= */

  const openPayment =
    (item) => {
      const remaining =
        getRemaining(
          item
        );

      setPaymentTarget(
        item
      );

      setPaymentMethod(
        "cash"
      );

      setPaymentAmount(
        String(
          remaining
        )
      );

      setPaymentNotes(
        ""
      );
    };

  const confirmPayment =
    async () => {
      if (
        !paymentTarget
      ) {
        return;
      }

      const amount =
        Number(
          paymentAmount
        );

      if (
        !amount ||
        amount <= 0
      ) {
        setError(
          "أدخل قيمة التحصيل."
        );

        return;
      }

      if (
        amount >
        getRemaining(
          paymentTarget
        )
      ) {
        setError(
          "قيمة التحصيل أكبر من المبلغ المتبقي."
        );

        return;
      }

      try {
        setPaymentSaving(
          true
        );

        setError("");

        await collectFinancePayment(
          {
            clinicId,

            transactionId:
              paymentTarget.id,

            amount,

            method:
              paymentMethod,

            receivedBy:
              staffId || "",

            receivedByName:
              getUserName(
                profile
              ),

            notes:
              paymentNotes,

            shiftId:
              openShift?.id ||
              "",
          }
        );

        setPaymentTarget(
          null
        );

        setSuccess(
          "تم تسجيل التحصيل بنجاح."
        );
      } catch (err) {
        console.error(
          err
        );

        setError(
          err?.message ||
            "تعذر تسجيل التحصيل."
        );
      } finally {
        setPaymentSaving(
          false
        );
      }
    };

  /* =======================================================
     EXPENSE
  ======================================================= */

  const addExpense =
    async () => {
      if (
        !expense.title.trim()
      ) {
        setError(
          "اكتب وصف المصروف."
        );

        return;
      }

      if (
        Number(
          expense.amount
        ) <= 0
      ) {
        setError(
          "أدخل قيمة المصروف."
        );

        return;
      }

      try {
        setExpenseSaving(
          true
        );

        setError("");

        await createFinanceExpense(
          {
            clinicId,

            title:
              expense.title,

            amount:
              expense.amount,

            category:
              expense.category,

            method:
              expense.method,

            notes:
              expense.notes,

            createdBy:
              staffId || "",

            createdByName:
              getUserName(
                profile
              ),

            shiftId:
              openShift?.id ||
              "",
          }
        );

        setExpense({
          title: "",
          amount: "",
          category:
            "medical_supplies",
          method:
            "cash",
          notes: "",
        });

        setExpenseOpen(
          false
        );

        setSuccess(
          "تم تسجيل المصروف."
        );
      } catch (err) {
        console.error(
          err
        );

        setError(
          err?.message ||
            "تعذر تسجيل المصروف."
        );
      } finally {
        setExpenseSaving(
          false
        );
      }
    };

  /* =======================================================
     OPEN SHIFT
  ======================================================= */

  const confirmOpenShift =
    async () => {
      try {
        setShiftSaving(
          true
        );

        setError("");

        await openFinanceShift(
          {
            clinicId,

            openingBalance:
              Number(
                openingBalance ||
                  0
              ),

            openedBy:
              staffId || "",

            openedByName:
              getUserName(
                profile
              ),
          }
        );

        setOpeningBalance(
          ""
        );

        setShiftOpenModal(
          false
        );

        setSuccess(
          "تم فتح الوردية."
        );
      } catch (err) {
        console.error(
          err
        );

        setError(
          err?.message ||
            "تعذر فتح الوردية."
        );
      } finally {
        setShiftSaving(
          false
        );
      }
    };

  /* =======================================================
     CLOSE SHIFT
  ======================================================= */

  const openCloseShift =
    () => {
      setActualCash(
        String(
          shiftSummary.expectedCash
        )
      );

      setShiftCloseModal(
        true
      );
    };

  const confirmCloseShift =
    async () => {
      if (!openShift) {
        return;
      }

      try {
        setShiftSaving(
          true
        );

        setError("");

        const result =
          await closeFinanceShift(
            {
              clinicId,

              shift:
                openShift,

              payments,

              expenses,

              actualCash:
                Number(
                  actualCash ||
                    0
                ),

              closedBy:
                staffId ||
                "",

              closedByName:
                getUserName(
                  profile
                ),
            }
          );

        setShiftCloseModal(
          false
        );

        setSuccess(
          result.difference ===
            0
            ? "تم إقفال الوردية بدون فروقات."
            : `تم إقفال الوردية. فرق الخزنة ${money(
                result.difference
              )} ج.م`
        );
      } catch (err) {
        console.error(
          err
        );

        setError(
          err?.message ||
            "تعذر إقفال الوردية."
        );
      } finally {
        setShiftSaving(
          false
        );
      }
    };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="finance-loading-state">
        <LoaderCircle
          size={28}
          className="finance-spinner"
        />

        <strong>
          جاري تحميل المالية
        </strong>

        <span>
          يتم تجهيز الخزنة والحركة المالية...
        </span>
      </div>
    );
  }

  return (
    <div className="finance-page">
      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="finance-header">
        <div>
          <span className="finance-eyebrow">
            CLINIC FINANCE
          </span>

          <h1>
            المالية
          </h1>

          <p>
            التحصيل، المصروفات، المديونيات والخزنة في مكان واحد
          </p>
        </div>

        <div className="finance-header-actions">
          <button
            className="expense-button"
            onClick={() =>
              setExpenseOpen(
                true
              )
            }
          >
            <Plus
              size={17}
            />

            تسجيل مصروف
          </button>

          {!openShift ? (
            <button
              className="close-shift-button"
              onClick={() =>
                setShiftOpenModal(
                  true
                )
              }
            >
              <Landmark
                size={17}
              />

              فتح وردية
            </button>
          ) : (
            <button
              className="close-shift-button"
              onClick={
                openCloseShift
              }
            >
              <Landmark
                size={17}
              />

              إقفال الوردية
            </button>
          )}
        </div>
      </header>

      {/* ===================================================
          ALERTS
      =================================================== */}

      {error && (
        <div className="finance-alert error">
          <AlertCircle
            size={16}
          />

          <span>
            {error}
          </span>

          <button
            onClick={() =>
              setError("")
            }
          >
            <X size={15} />
          </button>
        </div>
      )}

      {success && (
        <div className="finance-alert success">
          <Check
            size={16}
          />

          <span>
            {success}
          </span>
        </div>
      )}

      {/* ===================================================
          PERIOD
      =================================================== */}

      <section className="finance-period-bar">
        <div className="finance-period-options">
          {[
            [
              "today",
              "اليوم",
            ],
            [
              "yesterday",
              "أمس",
            ],
            [
              "7days",
              "7 أيام",
            ],
            [
              "month",
              "هذا الشهر",
            ],
            [
              "previous-month",
              "الشهر السابق",
            ],
            [
              "custom",
              "فترة مخصصة",
            ],
          ].map(
            ([
              value,
              label,
            ]) => (
              <button
                key={
                  value
                }
                className={
                  period ===
                  value
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setPeriod(
                    value
                  )
                }
              >
                {label}
              </button>
            )
          )}
        </div>

        {period ===
          "custom" && (
          <div className="finance-custom-dates">
            <label>
              <span>
                من
              </span>

              <input
                type="date"
                value={
                  customStart
                }
                onChange={(
                  event
                ) =>
                  setCustomStart(
                    event
                      .target
                      .value
                  )
                }
              />
            </label>

            <label>
              <span>
                إلى
              </span>

              <input
                type="date"
                value={
                  customEnd
                }
                onChange={(
                  event
                ) =>
                  setCustomEnd(
                    event
                      .target
                      .value
                  )
                }
              />
            </label>
          </div>
        )}
      </section>

      {/* ===================================================
          PRIMARY NUMBERS
      =================================================== */}

      <section className="cash-register-strip">
        <div className="register-primary">
          <span>
            تم تحصيله
          </span>

          <strong>
            {money(
              statistics
                .totals
                .collected
            )}

            <small>
              ج.م
            </small>
          </strong>

          <p>
            صافي بعد المصروفات:{" "}
            <b>
              {money(
                statistics
                  .totals
                  .net
              )}{" "}
              ج.م
            </b>
          </p>
        </div>

        <RegisterMetric
          label="إجمالي الفواتير"
          value={
            statistics
              .totals
              .invoiced
          }
        />

        <RegisterMetric
          label="مديونيات الفترة"
          value={
            statistics
              .totals
              .outstanding
          }
          danger={
            statistics
              .totals
              .outstanding >
            0
          }
        />

        <RegisterMetric
          label="المصروفات"
          value={
            statistics
              .totals
              .expenses
          }
        />

        <RegisterMetric
          label="نسبة التحصيل"
          value={`${money(
            statistics
              .totals
              .collectionRate
          )}%`}
          currency={
            false
          }
        />
      </section>

      {/* ===================================================
          TABS
      =================================================== */}

      <nav className="finance-main-tabs">
        {[
          [
            "overview",
            "نظرة عامة",
            BarChart3,
          ],
          [
            "transactions",
            "الحركة المالية",
            Receipt,
          ],
          [
            "expenses",
            "المصروفات",
            ArrowDownLeft,
          ],
          [
            "debts",
            "المديونيات",
            Clock3,
          ],
          [
            "doctors",
            "الأطباء",
            Stethoscope,
          ],
          [
            "cash",
            "الخزنة والورديات",
            Wallet,
          ],
        ].map(
          ([
            value,
            label,
            Icon,
          ]) => (
            <button
              key={
                value
              }
              className={
                activeTab ===
                value
                  ? "active"
                  : ""
              }
              onClick={() =>
                setActiveTab(
                  value
                )
              }
            >
              <Icon
                size={16}
              />

              {label}
            </button>
          )
        )}
      </nav>

      {/* ===================================================
          OVERVIEW
      =================================================== */}

      {activeTab ===
        "overview" && (
        <OverviewTab
          statistics={
            statistics
          }
          currentDebts={
            currentDebts
          }
          openShift={
            openShift
          }
          shiftSummary={
            shiftSummary
          }
        />
      )}

      {/* ===================================================
          TRANSACTIONS
      =================================================== */}

      {activeTab ===
        "transactions" && (
        <TransactionsTab
          items={
            filteredTransactions
          }
          search={
            search
          }
          setSearch={
            setSearch
          }
          filter={
            transactionFilter
          }
          setFilter={
            setTransactionFilter
          }
          onInvoice={
            openInvoice
          }
          onPayment={
            openPayment
          }
        />
      )}

      {/* ===================================================
          EXPENSES
      =================================================== */}

      {activeTab ===
        "expenses" && (
        <ExpensesTab
          items={
            statistics.expenses
          }
          categories={
            statistics.expenseCategories
          }
          onCreate={() =>
            setExpenseOpen(
              true
            )
          }
        />
      )}

      {/* ===================================================
          DEBTS
      =================================================== */}

      {activeTab ===
        "debts" && (
        <DebtsTab
          debts={
            currentDebts
          }
          onInvoice={
            openInvoice
          }
          onPayment={
            openPayment
          }
        />
      )}

      {/* ===================================================
          DOCTORS
      =================================================== */}

      {activeTab ===
        "doctors" && (
        <DoctorsTab
          doctors={
            statistics.doctors
          }
        />
      )}

      {/* ===================================================
          CASH
      =================================================== */}

      {activeTab ===
        "cash" && (
        <CashTab
          openShift={
            openShift
          }
          summary={
            shiftSummary
          }
          shifts={
            shifts
          }
          paymentMethods={
            statistics.paymentMethods
          }
          onOpen={() =>
            setShiftOpenModal(
              true
            )
          }
          onClose={
            openCloseShift
          }
        />
      )}

      {/* ===================================================
          PAYMENT MODAL
      =================================================== */}

      {paymentTarget && (
        <PaymentModal
          item={
            paymentTarget
          }
          amount={
            paymentAmount
          }
          setAmount={
            setPaymentAmount
          }
          method={
            paymentMethod
          }
          setMethod={
            setPaymentMethod
          }
          notes={
            paymentNotes
          }
          setNotes={
            setPaymentNotes
          }
          saving={
            paymentSaving
          }
          onClose={() =>
            setPaymentTarget(
              null
            )
          }
          onConfirm={
            confirmPayment
          }
        />
      )}

      {/* ===================================================
          EXPENSE MODAL
      =================================================== */}

      {expenseOpen && (
        <ExpenseModal
          expense={
            expense
          }
          setExpense={
            setExpense
          }
          saving={
            expenseSaving
          }
          onClose={() =>
            setExpenseOpen(
              false
            )
          }
          onSave={
            addExpense
          }
        />
      )}

      {/* ===================================================
          OPEN SHIFT
      =================================================== */}

      {shiftOpenModal && (
        <OpenShiftModal
          value={
            openingBalance
          }
          setValue={
            setOpeningBalance
          }
          saving={
            shiftSaving
          }
          onClose={() =>
            setShiftOpenModal(
              false
            )
          }
          onConfirm={
            confirmOpenShift
          }
        />
      )}

      {/* ===================================================
          CLOSE SHIFT
      =================================================== */}

      {shiftCloseModal &&
        openShift && (
          <CloseShiftModal
            shift={
              openShift
            }
            summary={
              shiftSummary
            }
            actualCash={
              actualCash
            }
            setActualCash={
              setActualCash
            }
            saving={
              shiftSaving
            }
            onClose={() =>
              setShiftCloseModal(
                false
              )
            }
            onConfirm={
              confirmCloseShift
            }
          />
        )}

      {/* ===================================================
          INVOICE
      =================================================== */}

      {selectedInvoice && (
        <InvoiceDrawer
          clinic={
            clinic
          }
          item={
            selectedInvoice
          }
          payments={
            invoicePayments
          }
          onClose={() =>
            setSelectedInvoice(
              null
            )
          }
          onPayment={() => {
            const item =
              selectedInvoice;

            setSelectedInvoice(
              null
            );

            openPayment(
              item
            );
          }}
        />
      )}
    </div>
  );
}

/* =========================================================
   REGISTER METRIC
========================================================= */

function RegisterMetric({
  label,
  value,
  currency = true,
  danger = false,
}) {
  return (
    <div
      className={`register-metric ${
        danger
          ? "danger"
          : ""
      }`}
    >
      <span>
        {label}
      </span>

      <strong>
        {typeof value ===
        "number"
          ? money(value)
          : value}
      </strong>

      {currency && (
        <small>
          جنيه مصري
        </small>
      )}
    </div>
  );
}

/* =========================================================
   OVERVIEW
========================================================= */

function OverviewTab({
  statistics,
  currentDebts,
  openShift,
  shiftSummary,
}) {
  const {
    totals,
  } = statistics;

  return (
    <main className="finance-overview">
      <section className="finance-kpi-grid">
        <FinanceKpi
          icon={
            CircleDollarSign
          }
          label="صافي الفترة"
          value={`${money(
            totals.net
          )} ج.م`}
          hint={`${totals.paymentCount} عملية تحصيل`}
        />

        <FinanceKpi
          icon={
            FileText
          }
          label="عدد الفواتير"
          value={
            totals.invoiceCount
          }
          hint={`متوسط ${money(
            totals.averageInvoice
          )} ج.م`}
        />

        <FinanceKpi
          icon={
            Check
          }
          label="فواتير مكتملة"
          value={
            totals.paidInvoices
          }
          hint={`${totals.partialInvoices} دفع جزئي`}
        />

        <FinanceKpi
          icon={
            Clock3
          }
          label="إجمالي المديونية الحالية"
          value={`${money(
            currentDebts.total
          )} ج.م`}
          hint={`${currentDebts.count} فاتورة`}
        />
      </section>

      <div className="finance-overview-columns">
        <section className="finance-panel">
          <PanelHeading
            title="طرق الدفع"
            subtitle="توزيع التحصيل خلال الفترة"
          />

          <div className="payment-breakdown">
            {statistics.paymentMethods.map(
              (item) => (
                <div
                  className="payment-breakdown-row"
                  key={
                    item.method
                  }
                >
                  <div>
                    <PaymentIcon
                      method={
                        item.method
                      }
                    />

                    <span>
                      <strong>
                        {
                          item.label
                        }
                      </strong>

                      <small>
                        {money(
                          item.percentage
                        )}
                        %
                      </small>
                    </span>
                  </div>

                  <b>
                    {money(
                      item.amount
                    )}{" "}
                    ج.م
                  </b>
                </div>
              )
            )}
          </div>
        </section>

        <section className="finance-panel">
          <PanelHeading
            title="حالة الفواتير"
            subtitle="موقف التحصيل"
          />

          <div className="invoice-status-summary">
            <StatusSummary
              label="تم الدفع"
              value={
                statistics
                  .invoiceStatus
                  .paid
              }
              type="paid"
            />

            <StatusSummary
              label="دفع جزئي"
              value={
                statistics
                  .invoiceStatus
                  .partial
              }
              type="partial"
            />

            <StatusSummary
              label="غير مدفوع"
              value={
                statistics
                  .invoiceStatus
                  .unpaid
              }
              type="unpaid"
            />
          </div>
        </section>
      </div>

      <div className="finance-overview-columns">
        <section className="finance-panel">
          <PanelHeading
            title="الخدمات"
            subtitle="الإيراد حسب نوع الخدمة"
          />

          {statistics.services.length ===
          0 ? (
            <EmptyMini
              text="لا توجد خدمات في الفترة"
            />
          ) : (
            <div className="finance-ranking">
              {statistics.services
                .slice(
                  0,
                  8
                )
                .map(
                  (
                    service,
                    index
                  ) => (
                    <div
                      key={
                        service.name
                      }
                      className="ranking-row"
                    >
                      <span className="ranking-index">
                        {index +
                          1}
                      </span>

                      <div>
                        <strong>
                          {
                            service.name
                          }
                        </strong>

                        <small>
                          {
                            service.count
                          }{" "}
                          زيارة
                        </small>
                      </div>

                      <span>
                        <strong>
                          {money(
                            service.invoiced
                          )}{" "}
                          ج.م
                        </strong>

                        <small>
                          محصل{" "}
                          {money(
                            service.paid
                          )}
                        </small>
                      </span>
                    </div>
                  )
                )}
            </div>
          )}
        </section>

        <section className="finance-panel">
          <PanelHeading
            title="المصروفات"
            subtitle="توزيع المصروفات حسب التصنيف"
          />

          {statistics
            .expenseCategories
            .length ===
          0 ? (
            <EmptyMini
              text="لا توجد مصروفات في الفترة"
            />
          ) : (
            <div className="finance-ranking">
              {statistics.expenseCategories.map(
                (
                  category,
                  index
                ) => (
                  <div
                    key={
                      category.category
                    }
                    className="ranking-row"
                  >
                    <span className="ranking-index">
                      {index +
                        1}
                    </span>

                    <div>
                      <strong>
                        {
                          category.label
                        }
                      </strong>

                      <small>
                        {
                          category.count
                        }{" "}
                        حركة
                      </small>
                    </div>

                    <span>
                      <strong>
                        {money(
                          category.amount
                        )}{" "}
                        ج.م
                      </strong>

                      <small>
                        {money(
                          category.percentage
                        )}
                        %
                      </small>
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>

      <section className="finance-panel">
        <PanelHeading
          title="الأداء اليومي"
          subtitle="الفواتير والتحصيل والمصروفات وصافي كل يوم"
        />

        {statistics.daily.length ===
        0 ? (
          <EmptyMini
            text="لا توجد حركة مالية"
          />
        ) : (
          <div className="daily-finance-table">
            <div className="daily-finance-head">
              <span>
                التاريخ
              </span>

              <span>
                الفواتير
              </span>

              <span>
                التحصيل
              </span>

              <span>
                المصروفات
              </span>

              <span>
                الصافي
              </span>
            </div>

            {statistics.daily.map(
              (day) => (
                <div
                  className="daily-finance-row"
                  key={
                    day.date
                  }
                >
                  <strong>
                    {formatDate(
                      day.date
                    )}
                  </strong>

                  <span>
                    {money(
                      day.invoiced
                    )}{" "}
                    ج.م
                  </span>

                  <span>
                    {money(
                      day.collected
                    )}{" "}
                    ج.م
                  </span>

                  <span>
                    {money(
                      day.expenses
                    )}{" "}
                    ج.م
                  </span>

                  <strong>
                    {money(
                      day.net
                    )}{" "}
                    ج.م
                  </strong>
                </div>
              )
            )}
          </div>
        )}
      </section>

      <section className="finance-panel">
        <PanelHeading
          title="حالة الخزنة الحالية"
          subtitle={
            openShift
              ? `الوردية ${openShift.shiftNumber}`
              : "لا توجد وردية مفتوحة"
          }
        />

        {openShift ? (
          <div className="overview-shift-line">
            <ShiftNumber
              label="رصيد البداية"
              value={
                shiftSummary.openingBalance
              }
            />

            <ShiftNumber
              label="تحصيل نقدي"
              value={
                shiftSummary.cashPayments
              }
            />

            <ShiftNumber
              label="مصروف نقدي"
              value={
                shiftSummary.cashExpenses
              }
            />

            <ShiftNumber
              label="الرصيد المتوقع"
              value={
                shiftSummary.expectedCash
              }
              strong
            />
          </div>
        ) : (
          <EmptyMini
            text="افتح وردية لبدء متابعة الخزنة"
          />
        )}
      </section>
    </main>
  );
}

/* =========================================================
   TRANSACTIONS
========================================================= */

function TransactionsTab({
  items,
  search,
  setSearch,
  filter,
  setFilter,
  onInvoice,
  onPayment,
}) {
  return (
    <section className="payments-ledger finance-tab-panel">
      <div className="ledger-toolbar">
        <div>
          <span>
            FINANCIAL LEDGER
          </span>

          <strong>
            حركة الفواتير
          </strong>
        </div>

        <div className="finance-search">
          <Search
            size={17}
          />

          <input
            value={
              search
            }
            onChange={(
              event
            ) =>
              setSearch(
                event
                  .target
                  .value
              )
            }
            placeholder="اسم المريض، رقم الملف أو الفاتورة..."
          />

          {search && (
            <button
              onClick={() =>
                setSearch(
                  ""
                )
              }
            >
              <X
                size={14}
              />
            </button>
          )}
        </div>
      </div>

      <nav className="finance-filters">
        {[
          [
            "all",
            "الكل",
          ],
          [
            "paid",
            "تم الدفع",
          ],
          [
            "partial",
            "دفع جزئي",
          ],
          [
            "unpaid",
            "لم يدفع",
          ],
        ].map(
          ([
            value,
            label,
          ]) => (
            <button
              key={
                value
              }
              className={
                filter ===
                value
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFilter(
                  value
                )
              }
            >
              {label}
            </button>
          )
        )}
      </nav>

      <div className="finance-table-heading finance-table-v2">
        <span>
          المريض
        </span>

        <span>
          الخدمة
        </span>

        <span>
          الإجمالي
        </span>

        <span>
          المدفوع
        </span>

        <span>
          المتبقي
        </span>

        <span>
          الحالة
        </span>

        <span />
      </div>

      <div className="finance-rows">
        {items.length ===
        0 ? (
          <FinanceEmpty
            title="لا توجد فواتير"
            text="لا توجد حركة مالية مطابقة للفترة والفلاتر الحالية."
          />
        ) : (
          items.map(
            (item) => (
              <div
                className="finance-row finance-row-v2"
                key={
                  item.id
                }
              >
                <button
                  className="finance-patient"
                  onClick={() =>
                    onInvoice(
                      item
                    )
                  }
                >
                  <div>
                    {getPatientName(
                      item
                    ).charAt(
                      0
                    )}
                  </div>

                  <span>
                    <strong>
                      {getPatientName(
                        item
                      )}
                    </strong>

                    <small>
                      {getPatientCode(
                        item
                      )}{" "}
                      •{" "}
                      {item.invoiceNumber ||
                        "فاتورة"}
                    </small>
                  </span>
                </button>

                <div className="finance-service">
                  <strong>
                    {getServiceName(
                      item
                    )}
                  </strong>

                  <span>
                    {getDoctorName(
                      item
                    )}
                  </span>
                </div>

                <MoneyCell
                  value={
                    item.amount
                  }
                />

                <MoneyCell
                  value={
                    item.paid
                  }
                />

                <MoneyCell
                  value={getRemaining(
                    item
                  )}
                  danger={
                    getRemaining(
                      item
                    ) > 0
                  }
                />

                <FinanceStatus
                  status={
                    item.status
                  }
                />

                <div className="finance-row-actions">
                  {item.status !==
                    "paid" &&
                  item.status !==
                    "cancelled" ? (
                    <button
                      className="collect-button"
                      onClick={() =>
                        onPayment(
                          item
                        )
                      }
                    >
                      تحصيل

                      <ChevronLeft
                        size={
                          14
                        }
                      />
                    </button>
                  ) : (
                    <button
                      className="receipt-button"
                      onClick={() =>
                        onInvoice(
                          item
                        )
                      }
                    >
                      <Receipt
                        size={
                          16
                        }
                      />

                      إيصال
                    </button>
                  )}
                </div>
              </div>
            )
          )
        )}
      </div>
    </section>
  );
}

/* =========================================================
   EXPENSES
========================================================= */

function ExpensesTab({
  items,
  categories,
  onCreate,
}) {
  const total =
    items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.amount || 0
        ),
      0
    );

  return (
    <main className="finance-section-layout">
      <section className="finance-panel finance-section-main">
        <PanelHeading
          title="سجل المصروفات"
          subtitle={`${items.length} حركة مصروف`}
          action={
            <button
              className="small-primary-button"
              onClick={
                onCreate
              }
            >
              <Plus
                size={15}
              />

              مصروف جديد
            </button>
          }
        />

        <div className="expense-table">
          <div className="expense-table-head">
            <span>
              المصروف
            </span>

            <span>
              التصنيف
            </span>

            <span>
              طريقة الدفع
            </span>

            <span>
              التاريخ
            </span>

            <span>
              القيمة
            </span>
          </div>

          {items.length ===
          0 ? (
            <FinanceEmpty
              title="لا توجد مصروفات"
              text="لم يتم تسجيل مصروفات في الفترة المحددة."
            />
          ) : (
            items.map(
              (item) => (
                <div
                  className="expense-table-row"
                  key={
                    item.id
                  }
                >
                  <div>
                    <strong>
                      {
                        item.title
                      }
                    </strong>

                    <small>
                      {item.expenseNumber ||
                        ""}
                    </small>
                  </div>

                  <span>
                    {item.categoryLabel ||
                      EXPENSE_CATEGORIES[
                        item.category
                      ] ||
                      "أخرى"}
                  </span>

                  <span>
                    {item.methodLabel ||
                      PAYMENT_METHODS[
                        item.method
                      ] ||
                      "—"}
                  </span>

                  <span>
                    {formatDate(
                      item.createdAt
                    )}

                    <small>
                      {formatTime(
                        item.createdAt
                      )}
                    </small>
                  </span>

                  <strong className="expense-value">
                    -{" "}
                    {money(
                      item.amount
                    )}{" "}
                    ج.م
                  </strong>
                </div>
              )
            )
          )}
        </div>
      </section>

      <aside className="finance-panel finance-side-summary">
        <span className="summary-label">
          إجمالي المصروفات
        </span>

        <strong className="summary-big-number">
          {money(
            total
          )}{" "}
          ج.م
        </strong>

        <div className="drawer-divider" />

        <strong className="side-title">
          حسب التصنيف
        </strong>

        {categories.map(
          (item) => (
            <div
              className="side-breakdown-line"
              key={
                item.category
              }
            >
              <span>
                {
                  item.label
                }
              </span>

              <strong>
                {money(
                  item.amount
                )}{" "}
                ج.م
              </strong>
            </div>
          )
        )}
      </aside>
    </main>
  );
}

/* =========================================================
   DEBTS
========================================================= */

function DebtsTab({
  debts,
  onInvoice,
  onPayment,
}) {
  return (
    <main className="finance-debts-tab">
      <section className="debt-summary-line">
        <div>
          <span>
            إجمالي المديونية
          </span>

          <strong>
            {money(
              debts.total
            )}{" "}
            ج.م
          </strong>
        </div>

        <div>
          <span>
            عدد الفواتير
          </span>

          <strong>
            {
              debts.count
            }
          </strong>
        </div>

        <div>
          <span>
            قيمة الفواتير
          </span>

          <strong>
            {money(
              debts.totalInvoices
            )}{" "}
            ج.م
          </strong>
        </div>

        <div>
          <span>
            تم تحصيله منها
          </span>

          <strong>
            {money(
              debts.alreadyCollected
            )}{" "}
            ج.م
          </strong>
        </div>
      </section>

      <section className="finance-panel">
        <PanelHeading
          title="مديونيات المرضى"
          subtitle="كل الفواتير غير المسددة بالكامل بغض النظر عن تاريخها"
        />

        <div className="debt-table">
          <div className="debt-table-head">
            <span>
              المريض
            </span>

            <span>
              الفاتورة
            </span>

            <span>
              الإجمالي
            </span>

            <span>
              المدفوع
            </span>

            <span>
              المتبقي
            </span>

            <span />
          </div>

          {debts.items.length ===
          0 ? (
            <FinanceEmpty
              title="لا توجد مديونيات"
              text="كل الفواتير مسددة بالكامل."
            />
          ) : (
            debts.items.map(
              (item) => (
                <div
                  className="debt-table-row"
                  key={
                    item.id
                  }
                >
                  <button
                    onClick={() =>
                      onInvoice(
                        item
                      )
                    }
                  >
                    <strong>
                      {getPatientName(
                        item
                      )}
                    </strong>

                    <small>
                      {getPatientCode(
                        item
                      )}
                    </small>
                  </button>

                  <span>
                    {item.invoiceNumber ||
                      "—"}
                  </span>

                  <strong>
                    {money(
                      item.amount
                    )}{" "}
                    ج.م
                  </strong>

                  <span>
                    {money(
                      item.paid
                    )}{" "}
                    ج.م
                  </span>

                  <strong className="debt-remaining">
                    {money(
                      item.remaining
                    )}{" "}
                    ج.م
                  </strong>

                  <button
                    className="collect-button"
                    onClick={() =>
                      onPayment(
                        item
                      )
                    }
                  >
                    تحصيل
                  </button>
                </div>
              )
            )
          )}
        </div>
      </section>
    </main>
  );
}

/* =========================================================
   DOCTORS
========================================================= */

function DoctorsTab({
  doctors,
}) {
  const totalCollected =
    doctors.reduce(
      (sum, item) =>
        sum +
        Number(
          item.collected ||
            0
        ),
      0
    );

  return (
    <section className="finance-panel doctors-finance-panel">
      <PanelHeading
        title="أداء الأطباء"
        subtitle="الإيرادات والتحصيل وعدد الزيارات خلال الفترة"
      />

      <div className="doctor-finance-head">
        <span>
          الطبيب
        </span>

        <span>
          الزيارات
        </span>

        <span>
          كشف جديد
        </span>

        <span>
          إعادة
        </span>

        <span>
          الفواتير
        </span>

        <span>
          المحصل
        </span>

        <span>
          المتبقي
        </span>

        <span>
          المتوسط
        </span>
      </div>

      {doctors.length ===
      0 ? (
        <FinanceEmpty
          title="لا توجد بيانات"
          text="لا توجد زيارات مالية للأطباء في الفترة."
        />
      ) : (
        doctors.map(
          (doctor) => {
            const percentage =
              totalCollected >
              0
                ? (doctor.collected /
                    totalCollected) *
                  100
                : 0;

            return (
              <div
                className="doctor-finance-row"
                key={
                  doctor.doctorId ||
                  doctor.doctorName
                }
              >
                <div className="doctor-finance-name">
                  <div>
                    <Stethoscope
                      size={
                        16
                      }
                    />
                  </div>

                  <span>
                    <strong>
                      {
                        doctor.doctorName
                      }
                    </strong>

                    <small>
                      {money(
                        percentage
                      )}
                      % من التحصيل
                    </small>
                  </span>
                </div>

                <strong>
                  {
                    doctor.visits
                  }
                </strong>

                <span>
                  {
                    doctor.newVisits
                  }
                </span>

                <span>
                  {
                    doctor.followUps
                  }
                </span>

                <span>
                  {money(
                    doctor.invoiced
                  )}{" "}
                  ج.م
                </span>

                <strong>
                  {money(
                    doctor.collected
                  )}{" "}
                  ج.م
                </strong>

                <span>
                  {money(
                    doctor.outstanding
                  )}{" "}
                  ج.م
                </span>

                <span>
                  {money(
                    doctor.averageVisit
                  )}{" "}
                  ج.م
                </span>
              </div>
            );
          }
        )
      )}
    </section>
  );
}

/* =========================================================
   CASH
========================================================= */

function CashTab({
  openShift,
  summary,
  shifts,
  paymentMethods,
  onOpen,
  onClose,
}) {
  return (
    <main className="cash-management-layout">
      <section className="finance-panel current-shift-panel">
        <PanelHeading
          title="الوردية الحالية"
          subtitle={
            openShift
              ? `${openShift.shiftNumber} • بدأت ${formatTime(
                  openShift.openedAt
                )}`
              : "لا توجد وردية مفتوحة"
          }
          action={
            openShift ? (
              <button
                className="small-primary-button"
                onClick={
                  onClose
                }
              >
                إقفال الوردية
              </button>
            ) : (
              <button
                className="small-primary-button"
                onClick={
                  onOpen
                }
              >
                فتح وردية
              </button>
            )
          }
        />

        {openShift ? (
          <>
            <div className="cash-shift-main">
              <Wallet
                size={25}
              />

              <span>
                الرصيد النقدي المتوقع
              </span>

              <strong>
                {money(
                  summary.expectedCash
                )}{" "}
                ج.م
              </strong>
            </div>

            <div className="cash-shift-metrics">
              <ShiftNumber
                label="رصيد افتتاحي"
                value={
                  summary.openingBalance
                }
              />

              <ShiftNumber
                label="تحصيل نقدي"
                value={
                  summary.cashPayments
                }
              />

              <ShiftNumber
                label="مصروف نقدي"
                value={
                  summary.cashExpenses
                }
              />

              <ShiftNumber
                label="إجمالي التحصيل"
                value={
                  summary.totalPayments
                }
              />

              <ShiftNumber
                label="إجمالي المصروف"
                value={
                  summary.totalExpenses
                }
              />

              <ShiftNumber
                label="صافي الوردية"
                value={
                  summary.net
                }
                strong
              />
            </div>
          </>
        ) : (
          <FinanceEmpty
            title="الخزنة مغلقة"
            text="افتح وردية جديدة لتسجيل رصيد البداية ومتابعة حركة النقد."
          />
        )}
      </section>

      <section className="finance-panel">
        <PanelHeading
          title="طرق التحصيل"
          subtitle="حسب الفترة المحددة أعلى الصفحة"
        />

        <div className="payment-breakdown">
          {paymentMethods.map(
            (item) => (
              <div
                className="payment-breakdown-row"
                key={
                  item.method
                }
              >
                <div>
                  <PaymentIcon
                    method={
                      item.method
                    }
                  />

                  <span>
                    <strong>
                      {
                        item.label
                      }
                    </strong>

                    <small>
                      {money(
                        item.percentage
                      )}
                      %
                    </small>
                  </span>
                </div>

                <b>
                  {money(
                    item.amount
                  )}{" "}
                  ج.م
                </b>
              </div>
            )
          )}
        </div>
      </section>

      <section className="finance-panel shift-history-panel">
        <PanelHeading
          title="سجل الورديات"
          subtitle={`${shifts.length} وردية`}
        />

        <div className="shift-history-table">
          <div className="shift-history-head">
            <span>
              الوردية
            </span>

            <span>
              الموظف
            </span>

            <span>
              البداية
            </span>

            <span>
              المتوقع
            </span>

            <span>
              الفعلي
            </span>

            <span>
              الفرق
            </span>

            <span>
              الحالة
            </span>
          </div>

          {shifts.length ===
          0 ? (
            <EmptyMini
              text="لا توجد ورديات مسجلة"
            />
          ) : (
            shifts.map(
              (shift) => (
                <div
                  className="shift-history-row"
                  key={
                    shift.id
                  }
                >
                  <div>
                    <strong>
                      {shift.shiftNumber}
                    </strong>

                    <small>
                      {formatDate(
                        shift.openedAt
                      )}
                    </small>
                  </div>

                  <span>
                    {shift.openedByName ||
                      "—"}
                  </span>

                  <span>
                    {money(
                      shift.openingBalance
                    )}{" "}
                    ج.م
                  </span>

                  <span>
                    {shift.status ===
                    "closed"
                      ? `${money(
                          shift.expectedCash
                        )} ج.م`
                      : "—"}
                  </span>

                  <span>
                    {shift.status ===
                    "closed"
                      ? `${money(
                          shift.actualCash
                        )} ج.م`
                      : "—"}
                  </span>

                  <strong
                    className={
                      Number(
                        shift.difference ||
                          0
                      ) !== 0
                        ? "shift-difference"
                        : ""
                    }
                  >
                    {shift.status ===
                    "closed"
                      ? `${money(
                          shift.difference
                        )} ج.م`
                      : "—"}
                  </strong>

                  <span
                    className={`shift-status ${shift.status}`}
                  >
                    {shift.status ===
                    "open"
                      ? "مفتوحة"
                      : "مغلقة"}
                  </span>
                </div>
              )
            )
          )}
        </div>
      </section>
    </main>
  );
}

/* =========================================================
   PAYMENT MODAL
========================================================= */

function PaymentModal({
  item,
  amount,
  setAmount,
  method,
  setMethod,
  notes,
  setNotes,
  saving,
  onClose,
  onConfirm,
}) {
  const remaining =
    getRemaining(
      item
    );

  return (
    <div className="finance-modal-layer">
      <button
        className="finance-modal-overlay"
        onClick={
          onClose
        }
        aria-label="إغلاق"
      />

      <div className="payment-window payment-window-v2">
        <header>
          <div>
            <span>
              COLLECT PAYMENT
            </span>

            <h2>
              تحصيل دفعة
            </h2>
          </div>

          <button
            onClick={
              onClose
            }
          >
            <X
              size={18}
            />
          </button>
        </header>

        <div className="payment-patient-line">
          <div>
            <span>
              المريض
            </span>

            <strong>
              {getPatientName(
                item
              )}
            </strong>
          </div>

          <div>
            <span>
              المتبقي
            </span>

            <strong>
              {money(
                remaining
              )}{" "}
              ج.م
            </strong>
          </div>
        </div>

        <label className="finance-form-field">
          <span>
            قيمة الدفعة
          </span>

          <div className="money-input">
            <input
              type="number"
              min="0"
              max={
                remaining
              }
              step="0.01"
              value={
                amount
              }
              onChange={(
                event
              ) =>
                setAmount(
                  event
                    .target
                    .value
                )
              }
            />

            <b>
              ج.م
            </b>
          </div>
        </label>

        <button
          className="collect-full-button"
          onClick={() =>
            setAmount(
              String(
                remaining
              )
            )
          }
        >
          تحصيل كامل المتبقي
        </button>

        <span className="payment-method-title">
          طريقة الدفع
        </span>

        <div className="payment-methods">
          <PaymentMethod
            active={
              method ===
              "cash"
            }
            icon={
              <Banknote
                size={20}
              />
            }
            title="نقدي"
            onClick={() =>
              setMethod(
                "cash"
              )
            }
          />

          <PaymentMethod
            active={
              method ===
              "card"
            }
            icon={
              <CreditCard
                size={20}
              />
            }
            title="بطاقة"
            onClick={() =>
              setMethod(
                "card"
              )
            }
          />

          <PaymentMethod
            active={
              method ===
              "wallet"
            }
            icon={
              <Wallet
                size={20}
              />
            }
            title="محفظة"
            onClick={() =>
              setMethod(
                "wallet"
              )
            }
          />

          <PaymentMethod
            active={
              method ===
              "transfer"
            }
            icon={
              <Landmark
                size={20}
              />
            }
            title="تحويل"
            onClick={() =>
              setMethod(
                "transfer"
              )
            }
          />
        </div>

        <label className="finance-form-field">
          <span>
            ملاحظات
          </span>

          <textarea
            value={
              notes
            }
            onChange={(
              event
            ) =>
              setNotes(
                event
                  .target
                  .value
              )
            }
            placeholder="ملاحظات اختيارية..."
          />
        </label>

        <button
          className="confirm-payment"
          onClick={
            onConfirm
          }
          disabled={
            saving
          }
        >
          {saving ? (
            <>
              <LoaderCircle
                className="finance-spinner"
                size={17}
              />

              جاري التحصيل
            </>
          ) : (
            <>
              <Check
                size={17}
              />

              تأكيد استلام{" "}
              {money(
                amount
              )}{" "}
              ج.م
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   EXPENSE MODAL
========================================================= */

function ExpenseModal({
  expense,
  setExpense,
  saving,
  onClose,
  onSave,
}) {
  const update = (
    field,
    value
  ) => {
    setExpense(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  };

  return (
    <div className="finance-modal-layer">
      <button
        className="finance-modal-overlay"
        onClick={
          onClose
        }
        aria-label="إغلاق"
      />

      <div className="expense-window expense-window-v2">
        <header>
          <div>
            <span>
              EXPENSE
            </span>

            <h2>
              تسجيل مصروف
            </h2>
          </div>

          <button
            onClick={
              onClose
            }
          >
            <X
              size={18}
            />
          </button>
        </header>

        <label className="finance-form-field">
          <span>
            وصف المصروف
          </span>

          <input
            value={
              expense.title
            }
            onChange={(
              event
            ) =>
              update(
                "title",
                event
                  .target
                  .value
              )
            }
            placeholder="مثال: مستلزمات طبية"
          />
        </label>

        <label className="finance-form-field">
          <span>
            التصنيف
          </span>

          <select
            value={
              expense.category
            }
            onChange={(
              event
            ) =>
              update(
                "category",
                event
                  .target
                  .value
              )
            }
          >
            {Object.entries(
              EXPENSE_CATEGORIES
            ).map(
              ([
                value,
                label,
              ]) => (
                <option
                  key={
                    value
                  }
                  value={
                    value
                  }
                >
                  {label}
                </option>
              )
            )}
          </select>
        </label>

        <label className="finance-form-field">
          <span>
            القيمة
          </span>

          <div className="money-input">
            <input
              type="number"
              min="0"
              step="0.01"
              value={
                expense.amount
              }
              onChange={(
                event
              ) =>
                update(
                  "amount",
                  event
                    .target
                    .value
                )
              }
              placeholder="0"
            />

            <b>
              ج.م
            </b>
          </div>
        </label>

        <label className="finance-form-field">
          <span>
            طريقة الدفع
          </span>

          <select
            value={
              expense.method
            }
            onChange={(
              event
            ) =>
              update(
                "method",
                event
                  .target
                  .value
              )
            }
          >
            {Object.entries(
              PAYMENT_METHODS
            ).map(
              ([
                value,
                label,
              ]) => (
                <option
                  key={
                    value
                  }
                  value={
                    value
                  }
                >
                  {label}
                </option>
              )
            )}
          </select>
        </label>

        <label className="finance-form-field">
          <span>
            ملاحظات
          </span>

          <textarea
            value={
              expense.notes
            }
            onChange={(
              event
            ) =>
              update(
                "notes",
                event
                  .target
                  .value
              )
            }
          />
        </label>

        <button
          className="save-expense"
          onClick={
            onSave
          }
          disabled={
            saving
          }
        >
          {saving ? (
            <>
              <LoaderCircle
                className="finance-spinner"
                size={16}
              />

              جاري الحفظ
            </>
          ) : (
            "تسجيل المصروف"
          )}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   OPEN SHIFT
========================================================= */

function OpenShiftModal({
  value,
  setValue,
  saving,
  onClose,
  onConfirm,
}) {
  return (
    <div className="finance-modal-layer">
      <button
        className="finance-modal-overlay"
        onClick={
          onClose
        }
      />

      <div className="expense-window shift-window">
        <header>
          <div>
            <span>
              OPEN SHIFT
            </span>

            <h2>
              فتح وردية
            </h2>
          </div>

          <button
            onClick={
              onClose
            }
          >
            <X
              size={18}
            />
          </button>
        </header>

        <div className="shift-modal-info">
          <Landmark
            size={22}
          />

          <div>
            <strong>
              رصيد بداية الخزنة
            </strong>

            <span>
              أدخل المبلغ النقدي الموجود في الخزنة قبل بدء التحصيل.
            </span>
          </div>
        </div>

        <label className="finance-form-field">
          <span>
            الرصيد الافتتاحي
          </span>

          <div className="money-input">
            <input
              type="number"
              min="0"
              step="0.01"
              value={
                value
              }
              onChange={(
                event
              ) =>
                setValue(
                  event
                    .target
                    .value
                )
              }
              placeholder="0"
            />

            <b>
              ج.م
            </b>
          </div>
        </label>

        <button
          className="save-expense"
          onClick={
            onConfirm
          }
          disabled={
            saving
          }
        >
          {saving
            ? "جاري فتح الوردية..."
            : "فتح الوردية"}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   CLOSE SHIFT
========================================================= */

function CloseShiftModal({
  shift,
  summary,
  actualCash,
  setActualCash,
  saving,
  onClose,
  onConfirm,
}) {
  const difference =
    Number(
      actualCash || 0
    ) -
    Number(
      summary.expectedCash ||
        0
    );

  return (
    <div className="finance-modal-layer">
      <button
        className="finance-modal-overlay"
        onClick={
          onClose
        }
      />

      <div className="expense-window close-shift-window">
        <header>
          <div>
            <span>
              CLOSE SHIFT
            </span>

            <h2>
              إقفال الوردية
            </h2>
          </div>

          <button
            onClick={
              onClose
            }
          >
            <X
              size={18}
            />
          </button>
        </header>

        <div className="closing-summary">
          <ShiftNumber
            label="رصيد البداية"
            value={
              summary.openingBalance
            }
          />

          <ShiftNumber
            label="تحصيل كاش"
            value={
              summary.cashPayments
            }
          />

          <ShiftNumber
            label="مصروف كاش"
            value={
              summary.cashExpenses
            }
          />

          <ShiftNumber
            label="المتوقع بالخزنة"
            value={
              summary.expectedCash
            }
            strong
          />
        </div>

        <label className="finance-form-field">
          <span>
            الرصيد الفعلي بالخزنة
          </span>

          <div className="money-input">
            <input
              type="number"
              min="0"
              step="0.01"
              value={
                actualCash
              }
              onChange={(
                event
              ) =>
                setActualCash(
                  event
                    .target
                    .value
                )
              }
            />

            <b>
              ج.م
            </b>
          </div>
        </label>

        <div
          className={`shift-difference-box ${
            difference ===
            0
              ? "balanced"
              : difference >
                  0
                ? "extra"
                : "shortage"
          }`}
        >
          <span>
            فرق الخزنة
          </span>

          <strong>
            {difference >
            0
              ? "+"
              : ""}
            {money(
              difference
            )}{" "}
            ج.م
          </strong>
        </div>

        <button
          className="save-expense"
          onClick={
            onConfirm
          }
          disabled={
            saving
          }
        >
          {saving
            ? "جاري الإقفال..."
            : `إقفال ${shift.shiftNumber}`}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   INVOICE DRAWER
========================================================= */

function InvoiceDrawer({
  clinic,
  item,
  payments,
  onClose,
  onPayment,
}) {
  const remaining =
    getRemaining(
      item
    );

  return (
    <div className="invoice-layer">
      <button
        className="invoice-overlay"
        onClick={
          onClose
        }
      />

      <aside className="invoice-panel invoice-panel-v2">
        <header>
          <div>
            <span>
              PAYMENT RECEIPT
            </span>

            <strong>
              {item.invoiceNumber ||
                item.id}
            </strong>
          </div>

          <button
            onClick={
              onClose
            }
          >
            <X
              size={18}
            />
          </button>
        </header>

        <div className="receipt-paper">
          <div className="receipt-brand">
            <strong>
              {clinic?.name ||
                clinic?.profile
                  ?.name ||
                "OMG Clinic"}
            </strong>

            <span>
              بيان مالي
            </span>
          </div>

          <div className="receipt-rule" />

          <ReceiptLine
            label="المريض"
            value={getPatientName(
              item
            )}
          />

          <ReceiptLine
            label="رقم الملف"
            value={getPatientCode(
              item
            )}
          />

          <ReceiptLine
            label="الخدمة"
            value={getServiceName(
              item
            )}
          />

          <ReceiptLine
            label="الطبيب"
            value={getDoctorName(
              item
            )}
          />

          <ReceiptLine
            label="تاريخ الفاتورة"
            value={`${formatDate(
              item.createdAt
            )} - ${formatTime(
              item.createdAt
            )}`}
          />

          <div className="receipt-total">
            <span>
              إجمالي الفاتورة
            </span>

            <strong>
              {money(
                item.amount
              )}{" "}
              ج.م
            </strong>
          </div>

          <div className="receipt-payment">
            <span>
              تم تحصيله
            </span>

            <strong>
              {money(
                item.paid
              )}{" "}
              ج.م
            </strong>
          </div>

          {remaining >
            0 && (
            <div className="receipt-remaining">
              <span>
                المتبقي
              </span>

              <strong>
                {money(
                  remaining
                )}{" "}
                ج.م
              </strong>
            </div>
          )}

          <div className="receipt-rule" />

          <div className="receipt-payments-title">
            سجل الدفعات
          </div>

          {payments.length ===
          0 ? (
            <span className="no-payment-text">
              لم يتم تسجيل دفعات بعد.
            </span>
          ) : (
            payments.map(
              (payment) => (
                <div
                  className="receipt-payment-history"
                  key={
                    payment.id
                  }
                >
                  <span>
                    <strong>
                      {payment.receiptNumber}
                    </strong>

                    <small>
                      {formatDate(
                        payment.paidAt
                      )}{" "}
                      •{" "}
                      {PAYMENT_METHODS[
                        payment.method
                      ] ||
                        payment.methodLabel}
                    </small>
                  </span>

                  <b>
                    {money(
                      payment.amount
                    )}{" "}
                    ج.م
                  </b>
                </div>
              )
            )
          )}
        </div>

        <div className="invoice-actions">
          {remaining >
            0 && (
            <button
              className="invoice-collect-button"
              onClick={
                onPayment
              }
            >
              <CircleDollarSign
                size={16}
              />

              تحصيل دفعة
            </button>
          )}

          <button
            className="print-receipt"
            onClick={() =>
              window.print()
            }
          >
            <Printer
              size={16}
            />

            طباعة
          </button>
        </div>
      </aside>
    </div>
  );
}

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function FinanceKpi({
  icon: Icon,
  label,
  value,
  hint,
}) {
  return (
    <div className="finance-kpi">
      <div>
        <Icon
          size={18}
        />
      </div>

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <small>
        {hint}
      </small>
    </div>
  );
}

function PanelHeading({
  title,
  subtitle,
  action = null,
}) {
  return (
    <div className="finance-panel-heading">
      <div>
        <strong>
          {title}
        </strong>

        <span>
          {subtitle}
        </span>
      </div>

      {action}
    </div>
  );
}

function StatusSummary({
  label,
  value,
  type,
}) {
  return (
    <div className="status-summary-line">
      <span
        className={`status-dot ${type}`}
      />

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function MoneyCell({
  value,
  danger = false,
}) {
  return (
    <div
      className={`finance-amount ${
        danger
          ? "danger"
          : ""
      }`}
    >
      <strong>
        {money(
          value
        )}
      </strong>

      <span>
        ج.م
      </span>
    </div>
  );
}

function FinanceStatus({
  status,
}) {
  const map = {
    paid: [
      "تم الدفع",
      "paid",
    ],

    partial: [
      "دفع جزئي",
      "partial",
    ],

    unpaid: [
      "لم يدفع",
      "unpaid",
    ],

    cancelled: [
      "ملغي",
      "cancelled",
    ],
  };

  const item =
    map[status] ||
    map.unpaid;

  return (
    <span
      className={`finance-status ${item[1]}`}
    >
      {item[0]}
    </span>
  );
}

function PaymentMethod({
  active,
  icon,
  title,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`payment-method ${
        active
          ? "active"
          : ""
      }`}
      onClick={
        onClick
      }
    >
      {icon}

      <span>
        {title}
      </span>

      {active && (
        <Check
          size={14}
        />
      )}
    </button>
  );
}

function PaymentIcon({
  method,
}) {
  if (
    method === "cash"
  ) {
    return (
      <Banknote
        size={17}
      />
    );
  }

  if (
    method === "card"
  ) {
    return (
      <CreditCard
        size={17}
      />
    );
  }

  if (
    method ===
    "wallet"
  ) {
    return (
      <Wallet
        size={17}
      />
    );
  }

  return (
    <Landmark
      size={17}
    />
  );
}

function ShiftNumber({
  label,
  value,
  strong = false,
}) {
  return (
    <div
      className={`shift-number ${
        strong
          ? "strong"
          : ""
      }`}
    >
      <span>
        {label}
      </span>

      <strong>
        {money(
          value
        )}{" "}
        ج.م
      </strong>
    </div>
  );
}

function ReceiptLine({
  label,
  value,
}) {
  return (
    <div className="receipt-line">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function FinanceEmpty({
  title,
  text,
}) {
  return (
    <div className="finance-empty">
      <Receipt
        size={28}
      />

      <strong>
        {title}
      </strong>

      <span>
        {text}
      </span>
    </div>
  );
}

function EmptyMini({
  text,
}) {
  return (
    <div className="finance-empty-mini">
      {text}
    </div>
  );
}