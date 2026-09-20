import {
  get,
  onValue,
  push,
  ref,
  runTransaction,
  set,
  update,
} from "firebase/database";

import { database } from "../config/firebase";

/* =========================================================
   CONSTANTS
========================================================= */

export const PAYMENT_METHODS = {
  cash: "نقدي",
  card: "بطاقة",
  wallet: "محفظة",
  transfer: "تحويل بنكي",
};

export const EXPENSE_CATEGORIES = {
  medical_supplies: "مستلزمات طبية",
  salaries: "مرتبات",
  rent: "إيجار",
  utilities: "مرافق",
  maintenance: "صيانة",
  marketing: "تسويق",
  cleaning: "نظافة",
  transportation: "انتقالات",
  other: "أخرى",
};

export const TRANSACTION_STATUSES = {
  paid: "تم الدفع",
  partial: "دفع جزئي",
  unpaid: "غير مدفوع",
  cancelled: "ملغي",
  refunded: "مسترد",
};

/* =========================================================
   BASIC HELPERS
========================================================= */

function cleanText(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function roundMoney(value) {
  return Math.round(
    (numberValue(value) + Number.EPSILON) * 100
  ) / 100;
}

function timestampValue(value) {
  if (!value) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}

function startOfDayTimestamp(date = new Date()) {
  const target = new Date(date);

  target.setHours(0, 0, 0, 0);

  return target.getTime();
}

function endOfDayTimestamp(date = new Date()) {
  const target = new Date(date);

  target.setHours(23, 59, 59, 999);

  return target.getTime();
}

function startOfMonthTimestamp(date = new Date()) {
  const target = new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
    0,
    0,
    0,
    0
  );

  return target.getTime();
}

function endOfMonthTimestamp(date = new Date()) {
  const target = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  return target.getTime();
}

function getTransactionStatus({
  amount,
  paid,
}) {
  const total = roundMoney(amount);
  const collected = roundMoney(paid);

  if (collected <= 0) {
    return "unpaid";
  }

  if (collected < total) {
    return "partial";
  }

  return "paid";
}

function sortNewest(items) {
  return [...items].sort(
    (a, b) =>
      timestampValue(
        b.createdAt ||
          b.paidAt ||
          b.date
      ) -
      timestampValue(
        a.createdAt ||
          a.paidAt ||
          a.date
      )
  );
}

function objectToArray(value) {
  if (!value) {
    return [];
  }

  return Object.entries(value).map(
    ([id, item]) => ({
      id,
      ...item,
    })
  );
}

function isBetween(
  value,
  startDate,
  endDate
) {
  const timestamp =
    timestampValue(value);

  if (!timestamp) {
    return false;
  }

  if (
    startDate &&
    timestamp < startDate
  ) {
    return false;
  }

  if (
    endDate &&
    timestamp > endDate
  ) {
    return false;
  }

  return true;
}

/* =========================================================
   COUNTERS
========================================================= */

async function getNextCounter(
  clinicId,
  counterName
) {
  const counterRef = ref(
    database,
    `clinics/${clinicId}/finance/counters/${counterName}`
  );

  const result =
    await runTransaction(
      counterRef,
      (currentValue) =>
        numberValue(currentValue) + 1
    );

  return numberValue(
    result.snapshot.val()
  );
}

function formatCounter(
  prefix,
  number
) {
  return `${prefix}-${String(
    number
  ).padStart(6, "0")}`;
}

/* =========================================================
   SUBSCRIPTIONS
========================================================= */

export function subscribeFinanceTransactions(
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
      `clinics/${clinicId}/finance/transactions`
    ),
    (snapshot) => {
      callback?.(
        sortNewest(
          objectToArray(
            snapshot.val()
          )
        )
      );
    },
    (error) => {
      console.error(
        "Finance transactions error:",
        error
      );

      onError?.(error);
    }
  );
}

export function subscribeFinanceExpenses(
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
      `clinics/${clinicId}/finance/expenses`
    ),
    (snapshot) => {
      callback?.(
        sortNewest(
          objectToArray(
            snapshot.val()
          )
        )
      );
    },
    (error) => {
      console.error(
        "Finance expenses error:",
        error
      );

      onError?.(error);
    }
  );
}

export function subscribeFinancePayments(
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
      `clinics/${clinicId}/finance/payments`
    ),
    (snapshot) => {
      callback?.(
        sortNewest(
          objectToArray(
            snapshot.val()
          )
        )
      );
    },
    (error) => {
      console.error(
        "Finance payments error:",
        error
      );

      onError?.(error);
    }
  );
}

export function subscribeFinanceShifts(
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
      `clinics/${clinicId}/finance/shifts`
    ),
    (snapshot) => {
      callback?.(
        sortNewest(
          objectToArray(
            snapshot.val()
          )
        )
      );
    },
    (error) => {
      console.error(
        "Finance shifts error:",
        error
      );

      onError?.(error);
    }
  );
}

/* =========================================================
   CREATE INVOICE / TRANSACTION
========================================================= */

export async function createFinanceTransaction({
  clinicId,

  patientId,
  patientCode = "",
  patientName = "",
  patientPhone = "",

  doctorId = "",
  doctorName = "",

  visitId = "",
  appointmentId = "",

  serviceType = "كشف",
  serviceName = "",

  amount = 0,

  createdBy = "",
  createdByName = "",

  notes = "",
}) {
  if (!clinicId) {
    throw new Error(
      "Clinic ID is required."
    );
  }

  if (!patientId) {
    throw new Error(
      "Patient ID is required."
    );
  }

  const total =
    roundMoney(amount);

  if (total <= 0) {
    throw new Error(
      "Invoice amount must be greater than zero."
    );
  }

  const transactionId =
    push(
      ref(
        database,
        `clinics/${clinicId}/finance/transactions`
      )
    ).key;

  if (!transactionId) {
    throw new Error(
      "Could not create invoice."
    );
  }

  const invoiceCounter =
    await getNextCounter(
      clinicId,
      "invoice"
    );

  const invoiceNumber =
    formatCounter(
      "INV",
      invoiceCounter
    );

  const timestamp =
    Date.now();

  const transaction = {
    id:
      transactionId,

    invoiceNumber,

    patientId:
      cleanText(patientId),

    patientCode:
      cleanText(patientCode),

    patientName:
      cleanText(patientName),

    patientPhone:
      cleanText(patientPhone),

    doctorId:
      cleanText(doctorId),

    doctorName:
      cleanText(doctorName),

    visitId:
      cleanText(visitId),

    appointmentId:
      cleanText(appointmentId),

    serviceType:
      cleanText(serviceType) ||
      "كشف",

    serviceName:
      cleanText(serviceName),

    amount:
      total,

    paid:
      0,

    remaining:
      total,

    status:
      "unpaid",

    paymentMethod:
      "",

    paymentCount:
      0,

    notes:
      cleanText(notes),

    createdBy:
      cleanText(createdBy),

    createdByName:
      cleanText(
        createdByName
      ),

    createdAt:
      timestamp,

    updatedAt:
      timestamp,

    lastPaymentAt:
      null,

    fullyPaidAt:
      null,

    cancelledAt:
      null,

    cancelledBy:
      "",
  };

  await set(
    ref(
      database,
      `clinics/${clinicId}/finance/transactions/${transactionId}`
    ),
    transaction
  );

  return transaction;
}

/* =========================================================
   GET TRANSACTION
========================================================= */

export async function getFinanceTransaction(
  clinicId,
  transactionId
) {
  if (
    !clinicId ||
    !transactionId
  ) {
    return null;
  }

  const snapshot =
    await get(
      ref(
        database,
        `clinics/${clinicId}/finance/transactions/${transactionId}`
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id:
      transactionId,
    ...snapshot.val(),
  };
}

/* =========================================================
   COLLECT PAYMENT
========================================================= */

export async function collectFinancePayment({
  clinicId,
  transactionId,

  amount,

  method = "cash",

  receivedBy = "",
  receivedByName = "",

  notes = "",

  shiftId = "",
}) {
  if (
    !clinicId ||
    !transactionId
  ) {
    throw new Error(
      "Transaction data is required."
    );
  }

  if (
    !PAYMENT_METHODS[method]
  ) {
    throw new Error(
      "Invalid payment method."
    );
  }

  const transaction =
    await getFinanceTransaction(
      clinicId,
      transactionId
    );

  if (!transaction) {
    throw new Error(
      "Invoice not found."
    );
  }

  if (
    transaction.status ===
    "cancelled"
  ) {
    throw new Error(
      "Cancelled invoice cannot receive payment."
    );
  }

  const invoiceAmount =
    roundMoney(
      transaction.amount
    );

  const alreadyPaid =
    roundMoney(
      transaction.paid
    );

  const remaining =
    roundMoney(
      invoiceAmount -
        alreadyPaid
    );

  const paymentAmount =
    roundMoney(amount);

  if (paymentAmount <= 0) {
    throw new Error(
      "Payment amount must be greater than zero."
    );
  }

  if (
    paymentAmount >
    remaining
  ) {
    throw new Error(
      "Payment exceeds remaining invoice balance."
    );
  }

  const paymentId =
    push(
      ref(
        database,
        `clinics/${clinicId}/finance/payments`
      )
    ).key;

  if (!paymentId) {
    throw new Error(
      "Could not create payment."
    );
  }

  const receiptCounter =
    await getNextCounter(
      clinicId,
      "receipt"
    );

  const receiptNumber =
    formatCounter(
      "REC",
      receiptCounter
    );

  const timestamp =
    Date.now();

  const newPaid =
    roundMoney(
      alreadyPaid +
        paymentAmount
    );

  const newRemaining =
    roundMoney(
      invoiceAmount -
        newPaid
    );

  const newStatus =
    getTransactionStatus({
      amount:
        invoiceAmount,
      paid:
        newPaid,
    });

  const payment = {
    id:
      paymentId,

    receiptNumber,

    transactionId,

    invoiceNumber:
      transaction.invoiceNumber ||
      "",

    patientId:
      transaction.patientId ||
      "",

    patientCode:
      transaction.patientCode ||
      "",

    patientName:
      transaction.patientName ||
      "",

    doctorId:
      transaction.doctorId ||
      "",

    doctorName:
      transaction.doctorName ||
      "",

    visitId:
      transaction.visitId ||
      "",

    amount:
      paymentAmount,

    method,

    methodLabel:
      PAYMENT_METHODS[
        method
      ],

    shiftId:
      cleanText(shiftId),

    notes:
      cleanText(notes),

    receivedBy:
      cleanText(
        receivedBy
      ),

    receivedByName:
      cleanText(
        receivedByName
      ),

    createdAt:
      timestamp,

    paidAt:
      timestamp,
  };

  const updates = {
    [`clinics/${clinicId}/finance/payments/${paymentId}`]:
      payment,

    [`clinics/${clinicId}/finance/transactions/${transactionId}/paid`]:
      newPaid,

    [`clinics/${clinicId}/finance/transactions/${transactionId}/remaining`]:
      newRemaining,

    [`clinics/${clinicId}/finance/transactions/${transactionId}/status`]:
      newStatus,

    [`clinics/${clinicId}/finance/transactions/${transactionId}/paymentMethod`]:
      method,

    [`clinics/${clinicId}/finance/transactions/${transactionId}/paymentCount`]:
      numberValue(
        transaction.paymentCount
      ) + 1,

    [`clinics/${clinicId}/finance/transactions/${transactionId}/lastPaymentAt`]:
      timestamp,

    [`clinics/${clinicId}/finance/transactions/${transactionId}/updatedAt`]:
      timestamp,
  };

  if (
    newStatus === "paid"
  ) {
    updates[
      `clinics/${clinicId}/finance/transactions/${transactionId}/fullyPaidAt`
    ] = timestamp;
  }

  await update(
    ref(database),
    updates
  );

  return {
    payment,
    transaction: {
      ...transaction,
      paid:
        newPaid,
      remaining:
        newRemaining,
      status:
        newStatus,
      paymentMethod:
        method,
    },
  };
}

/* =========================================================
   TRANSACTION PAYMENTS
========================================================= */

export async function getTransactionPayments(
  clinicId,
  transactionId
) {
  if (
    !clinicId ||
    !transactionId
  ) {
    return [];
  }

  const snapshot =
    await get(
      ref(
        database,
        `clinics/${clinicId}/finance/payments`
      )
    );

  if (!snapshot.exists()) {
    return [];
  }

  return sortNewest(
    objectToArray(
      snapshot.val()
    ).filter(
      (item) =>
        item.transactionId ===
        transactionId
    )
  );
}

/* =========================================================
   EXPENSES
========================================================= */

export async function createFinanceExpense({
  clinicId,

  title,
  amount,

  category = "other",

  method = "cash",

  notes = "",

  createdBy = "",
  createdByName = "",

  shiftId = "",
}) {
  if (!clinicId) {
    throw new Error(
      "Clinic ID is required."
    );
  }

  if (!cleanText(title)) {
    throw new Error(
      "Expense title is required."
    );
  }

  const expenseAmount =
    roundMoney(amount);

  if (
    expenseAmount <= 0
  ) {
    throw new Error(
      "Expense amount must be greater than zero."
    );
  }

  const expenseId =
    push(
      ref(
        database,
        `clinics/${clinicId}/finance/expenses`
      )
    ).key;

  if (!expenseId) {
    throw new Error(
      "Could not create expense."
    );
  }

  const expenseCounter =
    await getNextCounter(
      clinicId,
      "expense"
    );

  const expenseNumber =
    formatCounter(
      "EXP",
      expenseCounter
    );

  const timestamp =
    Date.now();

  const expense = {
    id:
      expenseId,

    expenseNumber,

    title:
      cleanText(title),

    amount:
      expenseAmount,

    category:
      EXPENSE_CATEGORIES[
        category
      ]
        ? category
        : "other",

    categoryLabel:
      EXPENSE_CATEGORIES[
        category
      ] ||
      EXPENSE_CATEGORIES.other,

    method:
      PAYMENT_METHODS[
        method
      ]
        ? method
        : "cash",

    methodLabel:
      PAYMENT_METHODS[
        method
      ] ||
      PAYMENT_METHODS.cash,

    notes:
      cleanText(notes),

    shiftId:
      cleanText(shiftId),

    createdBy:
      cleanText(
        createdBy
      ),

    createdByName:
      cleanText(
        createdByName
      ),

    createdAt:
      timestamp,

    updatedAt:
      timestamp,
  };

  await set(
    ref(
      database,
      `clinics/${clinicId}/finance/expenses/${expenseId}`
    ),
    expense
  );

  return expense;
}

/* =========================================================
   CANCEL INVOICE
========================================================= */

export async function cancelFinanceTransaction({
  clinicId,
  transactionId,
  cancelledBy = "",
  reason = "",
}) {
  const transaction =
    await getFinanceTransaction(
      clinicId,
      transactionId
    );

  if (!transaction) {
    throw new Error(
      "Invoice not found."
    );
  }

  if (
    numberValue(
      transaction.paid
    ) > 0
  ) {
    throw new Error(
      "Invoice with payments cannot be cancelled directly."
    );
  }

  const timestamp =
    Date.now();

  await update(
    ref(
      database,
      `clinics/${clinicId}/finance/transactions/${transactionId}`
    ),
    {
      status:
        "cancelled",

      cancellationReason:
        cleanText(reason),

      cancelledBy:
        cleanText(
          cancelledBy
        ),

      cancelledAt:
        timestamp,

      updatedAt:
        timestamp,
    }
  );
}

/* =========================================================
   SHIFTS
========================================================= */

export async function getOpenFinanceShift(
  clinicId
) {
  if (!clinicId) {
    return null;
  }

  const snapshot =
    await get(
      ref(
        database,
        `clinics/${clinicId}/finance/shifts`
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  const shifts =
    objectToArray(
      snapshot.val()
    )
      .filter(
        (shift) =>
          shift.status ===
          "open"
      )
      .sort(
        (a, b) =>
          timestampValue(
            b.openedAt
          ) -
          timestampValue(
            a.openedAt
          )
      );

  return shifts[0] || null;
}

export async function openFinanceShift({
  clinicId,

  openingBalance = 0,

  openedBy = "",
  openedByName = "",

  notes = "",
}) {
  if (!clinicId) {
    throw new Error(
      "Clinic ID is required."
    );
  }

  const existing =
    await getOpenFinanceShift(
      clinicId
    );

  if (existing) {
    throw new Error(
      "There is already an open shift."
    );
  }

  const shiftId =
    push(
      ref(
        database,
        `clinics/${clinicId}/finance/shifts`
      )
    ).key;

  if (!shiftId) {
    throw new Error(
      "Could not create shift."
    );
  }

  const shiftCounter =
    await getNextCounter(
      clinicId,
      "shift"
    );

  const shiftNumber =
    formatCounter(
      "SHIFT",
      shiftCounter
    );

  const timestamp =
    Date.now();

  const shift = {
    id:
      shiftId,

    shiftNumber,

    status:
      "open",

    openingBalance:
      roundMoney(
        openingBalance
      ),

    openedBy:
      cleanText(
        openedBy
      ),

    openedByName:
      cleanText(
        openedByName
      ),

    openingNotes:
      cleanText(notes),

    openedAt:
      timestamp,

    closedAt:
      null,

    closedBy:
      "",

    expectedCash:
      0,

    actualCash:
      null,

    difference:
      null,

    cashPayments:
      0,

    cashExpenses:
      0,

    totalPayments:
      0,

    totalExpenses:
      0,

    net:
      0,

    createdAt:
      timestamp,

    updatedAt:
      timestamp,
  };

  await set(
    ref(
      database,
      `clinics/${clinicId}/finance/shifts/${shiftId}`
    ),
    shift
  );

  return shift;
}

/* =========================================================
   SHIFT CALCULATION
========================================================= */

export function calculateShiftSummary({
  shift,
  payments = [],
  expenses = [],
}) {
  if (!shift) {
    return {
      openingBalance: 0,
      totalPayments: 0,
      cashPayments: 0,
      totalExpenses: 0,
      cashExpenses: 0,
      expectedCash: 0,
      net: 0,
      paymentCount: 0,
      expenseCount: 0,
    };
  }

  const shiftPayments =
    payments.filter(
      (item) =>
        item.shiftId ===
        shift.id
    );

  const shiftExpenses =
    expenses.filter(
      (item) =>
        item.shiftId ===
        shift.id
    );

  const totalPayments =
    roundMoney(
      shiftPayments.reduce(
        (sum, item) =>
          sum +
          numberValue(
            item.amount
          ),
        0
      )
    );

  const cashPayments =
    roundMoney(
      shiftPayments
        .filter(
          (item) =>
            item.method ===
            "cash"
        )
        .reduce(
          (sum, item) =>
            sum +
            numberValue(
              item.amount
            ),
          0
        )
    );

  const totalExpenses =
    roundMoney(
      shiftExpenses.reduce(
        (sum, item) =>
          sum +
          numberValue(
            item.amount
          ),
        0
      )
    );

  const cashExpenses =
    roundMoney(
      shiftExpenses
        .filter(
          (item) =>
            item.method ===
            "cash"
        )
        .reduce(
          (sum, item) =>
            sum +
            numberValue(
              item.amount
            ),
          0
        )
    );

  const openingBalance =
    roundMoney(
      shift.openingBalance
    );

  const expectedCash =
    roundMoney(
      openingBalance +
        cashPayments -
        cashExpenses
    );

  const net =
    roundMoney(
      totalPayments -
        totalExpenses
    );

  return {
    openingBalance,

    totalPayments,

    cashPayments,

    totalExpenses,

    cashExpenses,

    expectedCash,

    net,

    paymentCount:
      shiftPayments.length,

    expenseCount:
      shiftExpenses.length,
  };
}

/* =========================================================
   CLOSE SHIFT
========================================================= */

export async function closeFinanceShift({
  clinicId,

  shift,

  payments = [],

  expenses = [],

  actualCash,

  closedBy = "",
  closedByName = "",

  notes = "",
}) {
  if (
    !clinicId ||
    !shift?.id
  ) {
    throw new Error(
      "Shift data is required."
    );
  }

  if (
    shift.status !== "open"
  ) {
    throw new Error(
      "Shift is already closed."
    );
  }

  const summary =
    calculateShiftSummary({
      shift,
      payments,
      expenses,
    });

  const actual =
    roundMoney(
      actualCash
    );

  if (actual < 0) {
    throw new Error(
      "Actual cash cannot be negative."
    );
  }

  const difference =
    roundMoney(
      actual -
        summary.expectedCash
    );

  const timestamp =
    Date.now();

  const closingData = {
    status:
      "closed",

    totalPayments:
      summary.totalPayments,

    cashPayments:
      summary.cashPayments,

    totalExpenses:
      summary.totalExpenses,

    cashExpenses:
      summary.cashExpenses,

    expectedCash:
      summary.expectedCash,

    actualCash:
      actual,

    difference,

    net:
      summary.net,

    paymentCount:
      summary.paymentCount,

    expenseCount:
      summary.expenseCount,

    closedBy:
      cleanText(
        closedBy
      ),

    closedByName:
      cleanText(
        closedByName
      ),

    closingNotes:
      cleanText(notes),

    closedAt:
      timestamp,

    updatedAt:
      timestamp,
  };

  await update(
    ref(
      database,
      `clinics/${clinicId}/finance/shifts/${shift.id}`
    ),
    closingData
  );

  return {
    ...shift,
    ...closingData,
  };
}

/* =========================================================
   DATE RANGE
========================================================= */

export function getFinanceDateRange(
  period,
  customStart = null,
  customEnd = null
) {
  const now =
    new Date();

  if (period === "today") {
    return {
      start:
        startOfDayTimestamp(
          now
        ),
      end:
        endOfDayTimestamp(
          now
        ),
    };
  }

  if (period === "yesterday") {
    const yesterday =
      new Date(now);

    yesterday.setDate(
      yesterday.getDate() - 1
    );

    return {
      start:
        startOfDayTimestamp(
          yesterday
        ),
      end:
        endOfDayTimestamp(
          yesterday
        ),
    };
  }

  if (period === "7days") {
    const start =
      new Date(now);

    start.setDate(
      start.getDate() - 6
    );

    return {
      start:
        startOfDayTimestamp(
          start
        ),
      end:
        endOfDayTimestamp(
          now
        ),
    };
  }

  if (period === "month") {
    return {
      start:
        startOfMonthTimestamp(
          now
        ),
      end:
        endOfMonthTimestamp(
          now
        ),
    };
  }

  if (
    period ===
    "previous-month"
  ) {
    const previous =
      new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );

    return {
      start:
        startOfMonthTimestamp(
          previous
        ),
      end:
        endOfMonthTimestamp(
          previous
        ),
    };
  }

  if (
    period === "custom"
  ) {
    return {
      start:
        customStart
          ? startOfDayTimestamp(
              new Date(
                customStart
              )
            )
          : null,

      end:
        customEnd
          ? endOfDayTimestamp(
              new Date(
                customEnd
              )
            )
          : null,
    };
  }

  return {
    start: null,
    end: null,
  };
}

/* =========================================================
   COMPLETE FINANCE STATISTICS
========================================================= */

export function calculateFinanceStatistics({
  transactions = [],
  payments = [],
  expenses = [],

  startDate = null,
  endDate = null,
}) {
  const periodTransactions =
    transactions.filter(
      (item) =>
        item.status !==
          "cancelled" &&
        isBetween(
          item.createdAt,
          startDate,
          endDate
        )
    );

  const periodPayments =
    payments.filter(
      (item) =>
        isBetween(
          item.paidAt ||
            item.createdAt,
          startDate,
          endDate
        )
    );

  const periodExpenses =
    expenses.filter(
      (item) =>
        isBetween(
          item.createdAt,
          startDate,
          endDate
        )
    );

  /* -------------------------------------------------------
     REVENUE
  ------------------------------------------------------- */

  const invoiced =
    roundMoney(
      periodTransactions.reduce(
        (sum, item) =>
          sum +
          numberValue(
            item.amount
          ),
        0
      )
    );

  const collected =
    roundMoney(
      periodPayments.reduce(
        (sum, item) =>
          sum +
          numberValue(
            item.amount
          ),
        0
      )
    );

  const expensesTotal =
    roundMoney(
      periodExpenses.reduce(
        (sum, item) =>
          sum +
          numberValue(
            item.amount
          ),
        0
      )
    );

  const net =
    roundMoney(
      collected -
        expensesTotal
    );

  /* -------------------------------------------------------
     DEBTS

     المديونية هنا تُحسب من الفواتير التي أُنشئت
     خلال الفترة المختارة.
  ------------------------------------------------------- */

  const debtTransactions =
    periodTransactions.filter(
      (item) =>
        ["unpaid", "partial"].includes(
          item.status
        )
    );

  const outstanding =
    roundMoney(
      debtTransactions.reduce(
        (sum, item) =>
          sum +
          numberValue(
            item.remaining ??
              numberValue(
                item.amount
              ) -
                numberValue(
                  item.paid
                )
          ),
        0
      )
    );

  /* -------------------------------------------------------
     PAYMENT METHODS
  ------------------------------------------------------- */

  const paymentMethods = {
    cash: 0,
    card: 0,
    wallet: 0,
    transfer: 0,
  };

  periodPayments.forEach(
    (payment) => {
      const method =
        payment.method;

      if (
        Object.prototype.hasOwnProperty.call(
          paymentMethods,
          method
        )
      ) {
        paymentMethods[
          method
        ] +=
          numberValue(
            payment.amount
          );
      }
    }
  );

  Object.keys(
    paymentMethods
  ).forEach((key) => {
    paymentMethods[key] =
      roundMoney(
        paymentMethods[key]
      );
  });

  const paymentMethodBreakdown =
    Object.entries(
      paymentMethods
    ).map(
      ([method, amount]) => ({
        method,
        label:
          PAYMENT_METHODS[
            method
          ],
        amount,
        percentage:
          collected > 0
            ? roundMoney(
                (amount /
                  collected) *
                  100
              )
            : 0,
      })
    );

  /* -------------------------------------------------------
     STATUS COUNTS
  ------------------------------------------------------- */

  const invoiceStatus = {
    paid: 0,
    partial: 0,
    unpaid: 0,
  };

  periodTransactions.forEach(
    (item) => {
      if (
        Object.prototype.hasOwnProperty.call(
          invoiceStatus,
          item.status
        )
      ) {
        invoiceStatus[
          item.status
        ] += 1;
      }
    }
  );

  /* -------------------------------------------------------
     DOCTOR STATISTICS
  ------------------------------------------------------- */

  const doctorMap = {};

  periodTransactions.forEach(
    (transaction) => {
      const doctorKey =
        transaction.doctorId ||
        transaction.doctorName ||
        "unknown";

      if (
        !doctorMap[
          doctorKey
        ]
      ) {
        doctorMap[
          doctorKey
        ] = {
          doctorId:
            transaction.doctorId ||
            "",

          doctorName:
            transaction.doctorName ||
            "غير محدد",

          visits: 0,

          invoiced: 0,

          collected: 0,

          outstanding: 0,

          newVisits: 0,

          followUps: 0,
        };
      }

      const doctor =
        doctorMap[
          doctorKey
        ];

      doctor.visits += 1;

      doctor.invoiced +=
        numberValue(
          transaction.amount
        );

      doctor.outstanding +=
        numberValue(
          transaction.remaining
        );

      const service =
        cleanText(
          transaction.serviceType
        );

      if (
        service.includes(
          "إعادة"
        )
      ) {
        doctor.followUps += 1;
      } else {
        doctor.newVisits += 1;
      }
    }
  );

  periodPayments.forEach(
    (payment) => {
      const doctorKey =
        payment.doctorId ||
        payment.doctorName ||
        "unknown";

      if (
        !doctorMap[
          doctorKey
        ]
      ) {
        doctorMap[
          doctorKey
        ] = {
          doctorId:
            payment.doctorId ||
            "",

          doctorName:
            payment.doctorName ||
            "غير محدد",

          visits: 0,

          invoiced: 0,

          collected: 0,

          outstanding: 0,

          newVisits: 0,

          followUps: 0,
        };
      }

      doctorMap[
        doctorKey
      ].collected +=
        numberValue(
          payment.amount
        );
    }
  );

  const doctors =
    Object.values(
      doctorMap
    )
      .map(
        (doctor) => ({
          ...doctor,

          invoiced:
            roundMoney(
              doctor.invoiced
            ),

          collected:
            roundMoney(
              doctor.collected
            ),

          outstanding:
            roundMoney(
              doctor.outstanding
            ),

          averageVisit:
            doctor.visits > 0
              ? roundMoney(
                  doctor.invoiced /
                    doctor.visits
                )
              : 0,
        })
      )
      .sort(
        (a, b) =>
          b.collected -
          a.collected
      );

  /* -------------------------------------------------------
     SERVICES
  ------------------------------------------------------- */

  const serviceMap = {};

  periodTransactions.forEach(
    (transaction) => {
      const service =
        cleanText(
          transaction.serviceType ||
            transaction.serviceName
        ) || "خدمة أخرى";

      if (
        !serviceMap[
          service
        ]
      ) {
        serviceMap[
          service
        ] = {
          name:
            service,

          count:
            0,

          invoiced:
            0,

          paid:
            0,

          outstanding:
            0,
        };
      }

      const current =
        serviceMap[
          service
        ];

      current.count += 1;

      current.invoiced +=
        numberValue(
          transaction.amount
        );

      current.paid +=
        numberValue(
          transaction.paid
        );

      current.outstanding +=
        numberValue(
          transaction.remaining
        );
    }
  );

  const services =
    Object.values(
      serviceMap
    )
      .map(
        (service) => ({
          ...service,

          invoiced:
            roundMoney(
              service.invoiced
            ),

          paid:
            roundMoney(
              service.paid
            ),

          outstanding:
            roundMoney(
              service.outstanding
            ),

          average:
            service.count > 0
              ? roundMoney(
                  service.invoiced /
                    service.count
                )
              : 0,
        })
      )
      .sort(
        (a, b) =>
          b.invoiced -
          a.invoiced
      );

  /* -------------------------------------------------------
     EXPENSE CATEGORIES
  ------------------------------------------------------- */

  const expenseCategoryMap =
    {};

  periodExpenses.forEach(
    (expense) => {
      const category =
        expense.category ||
        "other";

      if (
        !expenseCategoryMap[
          category
        ]
      ) {
        expenseCategoryMap[
          category
        ] = {
          category,

          label:
            EXPENSE_CATEGORIES[
              category
            ] ||
            "أخرى",

          amount:
            0,

          count:
            0,
        };
      }

      expenseCategoryMap[
        category
      ].amount +=
        numberValue(
          expense.amount
        );

      expenseCategoryMap[
        category
      ].count += 1;
    }
  );

  const expenseCategories =
    Object.values(
      expenseCategoryMap
    )
      .map(
        (item) => ({
          ...item,

          amount:
            roundMoney(
              item.amount
            ),

          percentage:
            expensesTotal > 0
              ? roundMoney(
                  (item.amount /
                    expensesTotal) *
                    100
                )
              : 0,
        })
      )
      .sort(
        (a, b) =>
          b.amount -
          a.amount
      );

  /* -------------------------------------------------------
     DAILY BREAKDOWN
  ------------------------------------------------------- */

  const dailyMap = {};

  const ensureDay = (
    timestamp
  ) => {
    if (!timestamp) {
      return null;
    }

    const date =
      new Date(timestamp);

    const key = [
      date.getFullYear(),
      String(
        date.getMonth() + 1
      ).padStart(2, "0"),
      String(
        date.getDate()
      ).padStart(2, "0"),
    ].join("-");

    if (!dailyMap[key]) {
      dailyMap[key] = {
        date: key,
        invoiced: 0,
        collected: 0,
        expenses: 0,
        net: 0,
        invoices: 0,
        payments: 0,
      };
    }

    return dailyMap[key];
  };

  periodTransactions.forEach(
    (item) => {
      const day =
        ensureDay(
          timestampValue(
            item.createdAt
          )
        );

      if (!day) {
        return;
      }

      day.invoiced +=
        numberValue(
          item.amount
        );

      day.invoices += 1;
    }
  );

  periodPayments.forEach(
    (item) => {
      const day =
        ensureDay(
          timestampValue(
            item.paidAt ||
              item.createdAt
          )
        );

      if (!day) {
        return;
      }

      day.collected +=
        numberValue(
          item.amount
        );

      day.payments += 1;
    }
  );

  periodExpenses.forEach(
    (item) => {
      const day =
        ensureDay(
          timestampValue(
            item.createdAt
          )
        );

      if (!day) {
        return;
      }

      day.expenses +=
        numberValue(
          item.amount
        );
    }
  );

  const daily =
    Object.values(
      dailyMap
    )
      .map((day) => ({
        ...day,

        invoiced:
          roundMoney(
            day.invoiced
          ),

        collected:
          roundMoney(
            day.collected
          ),

        expenses:
          roundMoney(
            day.expenses
          ),

        net:
          roundMoney(
            day.collected -
              day.expenses
          ),
      }))
      .sort(
        (a, b) =>
          a.date.localeCompare(
            b.date
          )
      );

  /* -------------------------------------------------------
     EXTRA KPIs
  ------------------------------------------------------- */

  const paidInvoices =
    periodTransactions.filter(
      (item) =>
        item.status ===
        "paid"
    ).length;

  const collectionRate =
    invoiced > 0
      ? roundMoney(
          (collected /
            invoiced) *
            100
        )
      : 0;

  const averageInvoice =
    periodTransactions.length >
    0
      ? roundMoney(
          invoiced /
            periodTransactions.length
        )
      : 0;

  const averagePayment =
    periodPayments.length > 0
      ? roundMoney(
          collected /
            periodPayments.length
        )
      : 0;

  return {
    period: {
      startDate,
      endDate,
    },

    totals: {
      invoiced,
      collected,
      outstanding,
      expenses:
        expensesTotal,
      net,

      invoiceCount:
        periodTransactions.length,

      paymentCount:
        periodPayments.length,

      expenseCount:
        periodExpenses.length,

      paidInvoices,

      partialInvoices:
        invoiceStatus.partial,

      unpaidInvoices:
        invoiceStatus.unpaid,

      collectionRate,

      averageInvoice,

      averagePayment,
    },

    paymentMethods:
      paymentMethodBreakdown,

    invoiceStatus,

    doctors,

    services,

    expenseCategories,

    daily,

    debts:
      debtTransactions
        .map((item) => ({
          ...item,

          remaining:
            roundMoney(
              item.remaining ??
                numberValue(
                  item.amount
                ) -
                  numberValue(
                    item.paid
                  )
            ),
        }))
        .sort(
          (a, b) =>
            b.remaining -
            a.remaining
        ),

    transactions:
      periodTransactions,

    payments:
      periodPayments,

    expenses:
      periodExpenses,
  };
}

/* =========================================================
   ALL-TIME DEBT STATISTICS

   منفصلة عن فلتر الفترة لأن مديونيات العيادة الحالية
   يجب ألا تختفي لمجرد أن الفاتورة من شهر سابق.
========================================================= */

export function calculateCurrentDebts(
  transactions = []
) {
  const debts =
    transactions
      .filter(
        (item) =>
          item.status !==
            "cancelled" &&
          ["partial", "unpaid"].includes(
            item.status
          )
      )
      .map((item) => {
        const amount =
          roundMoney(
            item.amount
          );

        const paid =
          roundMoney(
            item.paid
          );

        const remaining =
          roundMoney(
            item.remaining ??
              amount - paid
          );

        return {
          ...item,
          amount,
          paid,
          remaining,
        };
      })
      .sort(
        (a, b) =>
          b.remaining -
          a.remaining
      );

  return {
    count:
      debts.length,

    total:
      roundMoney(
        debts.reduce(
          (sum, item) =>
            sum +
            item.remaining,
          0
        )
      ),

    totalInvoices:
      roundMoney(
        debts.reduce(
          (sum, item) =>
            sum +
            item.amount,
          0
        )
      ),

    alreadyCollected:
      roundMoney(
        debts.reduce(
          (sum, item) =>
            sum +
            item.paid,
          0
        )
      ),

    items:
      debts,
  };
}

/* =========================================================
   TODAY STATISTICS
========================================================= */

export function calculateTodayFinanceStatistics({
  transactions = [],
  payments = [],
  expenses = [],
}) {
  const range =
    getFinanceDateRange(
      "today"
    );

  return calculateFinanceStatistics({
    transactions,
    payments,
    expenses,
    startDate:
      range.start,
    endDate:
      range.end,
  });
}

/* =========================================================
   MONTH STATISTICS
========================================================= */

export function calculateMonthFinanceStatistics({
  transactions = [],
  payments = [],
  expenses = [],
}) {
  const range =
    getFinanceDateRange(
      "month"
    );

  return calculateFinanceStatistics({
    transactions,
    payments,
    expenses,
    startDate:
      range.start,
    endDate:
      range.end,
  });
}