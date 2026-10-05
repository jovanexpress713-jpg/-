/**
 * EJAZ Transport — Enterprise Finance, Invoices, Settlements, Payments & Financial Review Engine
 * ───────────────────────────────────────────────────────────────────────────────────────────────
 * Manages freight pricing, invoices, tax (VAT 15%), fuel costs, driver commissions,
 * other commissions, payments, receivables, settlements, and financial reviews.
 */

export interface FinancialAuditEntry {
  id: string;
  action: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason?: string;
  timestamp: string;
}

export interface PaymentRecord {
  id: string;
  paymentNumber: string;
  tripId: string;
  tripNumber: string;
  invoiceNumber?: string;
  amount: number;
  currency: string;
  method: "BANK_TRANSFER" | "SADAD" | "CHEQUE" | "CASH";
  reference?: string;
  status: "CONFIRMED" | "CANCELLED";
  notes?: string;
  recordedBy?: string;
  recordedByName?: string;
  recordedAt: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export type CanonicalSettlementWorkflowStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "REJECTED"
  | "REOPENED";

export type CanonicalInvoiceStatus =
  | "DRAFT"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "ISSUED"
  | "SENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export type FinancialReviewStatus =
  | "NOT_STARTED"
  | "PENDING_REVIEW"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED";

export interface TripFinancials {
  tripId: string;
  tripNumber: string;
  freightPrice: number;
  driverFee: number;
  otherCommissions: number;
  fuelCost: number;
  tollFees: number;
  otherExpenses: number;
  taxVat: number; // 15% in KSA
  netRevenue: number;
  invoiceNumber?: string;
  invoiceStatus: CanonicalInvoiceStatus;
  invoiceIssuedAt?: string;
  invoiceApprovedBy?: string;
  invoiceApprovedByName?: string;
  invoiceApprovedAt?: string;
  invoiceNotes?: string;
  settlementNumber?: string;
  settlementStatus: "UNSETTLED" | "SETTLEMENT_PENDING" | "SETTLED";
  /** Canonical 7-state settlement workflow (§16): DRAFT | PENDING_REVIEW | APPROVED | PARTIALLY_PAID | PAID | REJECTED | REOPENED */
  settlementWorkflowStatus: CanonicalSettlementWorkflowStatus;
  settlementDate?: string;
  settlementCreatedBy?: string;
  settlementCreatedByName?: string;
  settlementApprovedBy?: string;
  settlementApprovedByName?: string;
  settlementApprovedAt?: string;
  settlementReopenedBy?: string;
  settlementReopenedByName?: string;
  settlementReopenedAt?: string;
  settlementReopenReason?: string;
  settlementNotes?: string;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  paidAmount: number;
  payments: PaymentRecord[];
  reviewStatus: FinancialReviewStatus;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewApprovedBy?: string;
  reviewApprovedByName?: string;
  reviewApprovedAt?: string;
  reviewNotes?: string;
  priceStatus?: "TARIFF" | "PENDING_QUOTE" | "UNPRICED";
  tariffId?: string;
  currency: string;
  /** Outstanding balance = freight price (VAT inclusive) − what has been paid. */
  balanceDue: number;
  auditHistory: FinancialAuditEntry[];
}

/** Standard driver commission share of the freight price. */
export const DRIVER_COMMISSION_RATE = 0.22;
/** Standard estimated fuel share of the freight price. */
export const FUEL_COST_RATE = 0.28;
/** KSA VAT rate. */
export const VAT_RATE = 0.15;

const financialsStore = new Map<string, TripFinancials>();

function computeNet(
  f: Pick<
    TripFinancials,
    "freightPrice" | "driverFee" | "otherCommissions" | "fuelCost" | "tollFees" | "otherExpenses"
  >
): number {
  return (
    f.freightPrice -
    f.driverFee -
    (Number(f.otherCommissions) || 0) -
    f.fuelCost -
    f.tollFees -
    f.otherExpenses
  );
}

function computeBalance(f: Pick<TripFinancials, "freightPrice" | "taxVat" | "paidAmount">): number {
  return Math.max(0, f.freightPrice + f.taxVat - f.paidAmount);
}

/** Total measured/derived cost lines of a trip — the single "expenses" figure. */
export function tripExpenses(
  f: Pick<TripFinancials, "driverFee" | "fuelCost" | "tollFees" | "otherExpenses"> & {
    otherCommissions?: number;
  }
): number {
  return f.driverFee + (Number(f.otherCommissions) || 0) + f.fuelCost + f.tollFees + f.otherExpenses;
}

function appendHistory(
  fin: TripFinancials,
  entry: Omit<FinancialAuditEntry, "id" | "timestamp">
): void {
  fin.auditHistory = fin.auditHistory || [];
  fin.auditHistory.unshift({
    id: `fa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
}

/**
 * Creates (or replaces) the financial record of a trip from its authoritative
 * freight price.
 */
export function initTripFinancials(
  tripId: string,
  tripNumber: string,
  freightPrice: number,
  meta?: {
    priceStatus?: TripFinancials["priceStatus"];
    tariffId?: string;
    currency?: string;
    createdBy?: string;
    createdByName?: string;
  }
): TripFinancials {
  const price = Number(freightPrice) || 0;
  const priced = price > 0;
  const driverFee = Math.round(price * DRIVER_COMMISSION_RATE);
  const fuelCost = Math.round(price * FUEL_COST_RATE);
  const taxVat = Math.round(price * VAT_RATE);
  const now = new Date().toISOString();

  const fin: TripFinancials = {
    tripId,
    tripNumber,
    freightPrice: price,
    driverFee,
    otherCommissions: 0,
    fuelCost,
    tollFees: 0,
    otherExpenses: 0,
    taxVat,
    netRevenue: computeNet({
      freightPrice: price,
      driverFee,
      otherCommissions: 0,
      fuelCost,
      tollFees: 0,
      otherExpenses: 0,
    }),
    invoiceNumber: priced ? `INV-${tripNumber.replace("EJ-", "")}` : undefined,
    invoiceStatus: "DRAFT",
    settlementNumber: priced ? `STL-${tripNumber.replace("EJ-", "")}` : undefined,
    settlementStatus: "UNSETTLED",
    settlementWorkflowStatus: "DRAFT",
    settlementDate: now,
    settlementCreatedBy: meta?.createdBy || "u-accountant",
    settlementCreatedByName: meta?.createdByName || "عمر بن إبراهيم القحطاني",
    paymentStatus: "UNPAID",
    paidAmount: 0,
    payments: [],
    reviewStatus: priced ? "PENDING_REVIEW" : "NOT_STARTED",
    priceStatus: meta?.priceStatus ?? (priced ? "TARIFF" : "PENDING_QUOTE"),
    tariffId: meta?.tariffId,
    currency: meta?.currency || "SAR",
    balanceDue: 0,
    auditHistory: [
      {
        id: `fa-init-${tripId}`,
        action: "FINANCIAL_RECORD_INITIALIZED",
        actorId: meta?.createdBy || "system",
        actorName: meta?.createdByName || "النظام المركزي",
        actorRole: "SYSTEM",
        newValues: { freightPrice: price, taxVat, driverFee, fuelCost },
        timestamp: now,
      },
    ],
  };
  fin.balanceDue = computeBalance(fin);

  financialsStore.set(tripId, fin);
  return fin;
}

export function getTripFinancials(tripId: string): TripFinancials | undefined {
  return financialsStore.get(tripId);
}

export function updateTripFinancials(
  tripId: string,
  updates: Partial<TripFinancials>,
  actor?: { userId?: string; fullName?: string; role?: string; reason?: string; action?: string }
): TripFinancials | null {
  const existing = financialsStore.get(tripId);
  if (!existing) return null;

  const updated: TripFinancials = {
    ...existing,
    ...updates,
    payments: updates.payments ?? existing.payments ?? [],
    auditHistory: [...(existing.auditHistory || [])],
  };
  updated.freightPrice = Number(updated.freightPrice) || 0;
  updated.driverFee = Number(updated.driverFee) || 0;
  updated.otherCommissions = Number(updated.otherCommissions) || 0;
  updated.fuelCost = Number(updated.fuelCost) || 0;
  updated.tollFees = Number(updated.tollFees) || 0;
  updated.otherExpenses = Number(updated.otherExpenses) || 0;
  updated.taxVat = Number(updated.taxVat) || 0;
  updated.paidAmount = Number(updated.paidAmount) || 0;

  updated.netRevenue = computeNet(updated);
  updated.balanceDue = computeBalance(updated);

  if (updates.paidAmount !== undefined) {
    const due = updated.freightPrice + updated.taxVat;
    updated.paymentStatus =
      updated.paidAmount <= 0 ? "UNPAID" : updated.paidAmount >= due ? "PAID" : "PARTIALLY_PAID";
  }

  // Keep canonical settlementWorkflowStatus in sync if legacy settlementStatus was updated
  if (updates.settlementStatus && !updates.settlementWorkflowStatus) {
    if (updates.settlementStatus === "SETTLED") {
      updated.settlementWorkflowStatus =
        updated.paymentStatus === "PAID"
          ? "PAID"
          : updated.paymentStatus === "PARTIALLY_PAID"
            ? "PARTIALLY_PAID"
            : "APPROVED";
    } else if (updates.settlementStatus === "SETTLEMENT_PENDING") {
      if (updated.settlementWorkflowStatus === "DRAFT") {
        updated.settlementWorkflowStatus =
          updated.paymentStatus === "PARTIALLY_PAID" ? "PARTIALLY_PAID" : "PENDING_REVIEW";
      }
    }
  }

  if (actor) {
    appendHistory(updated, {
      action: actor.action || "FINANCIAL_RECORD_UPDATED",
      actorId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      oldValues: {
        freightPrice: existing.freightPrice,
        driverFee: existing.driverFee,
        otherCommissions: existing.otherCommissions,
        tollFees: existing.tollFees,
        otherExpenses: existing.otherExpenses,
        paidAmount: existing.paidAmount,
        invoiceStatus: existing.invoiceStatus,
        settlementWorkflowStatus: existing.settlementWorkflowStatus,
      },
      newValues: updates as Record<string, unknown>,
      reason: actor.reason,
    });
  }

  financialsStore.set(tripId, updated);
  return updated;
}

/**
 * Re-prices a trip from an authoritative tariff.
 */
export function repriceTripFinancials(
  tripId: string,
  freightPrice: number,
  meta: { tariffId?: string; currency?: string; priceStatus?: TripFinancials["priceStatus"] } = {}
): TripFinancials | null {
  const existing = financialsStore.get(tripId);
  if (!existing) return null;

  const price = Number(freightPrice) || 0;
  const priced = price > 0;
  const updated: TripFinancials = {
    ...existing,
    freightPrice: price,
    driverFee: Math.round(price * DRIVER_COMMISSION_RATE),
    fuelCost: Math.round(price * FUEL_COST_RATE),
    taxVat: Math.round(price * VAT_RATE),
    invoiceNumber: priced ? existing.invoiceNumber || `INV-${existing.tripNumber.replace("EJ-", "")}` : undefined,
    settlementNumber: priced
      ? existing.settlementNumber || `STL-${existing.tripNumber.replace("EJ-", "")}`
      : undefined,
    tariffId: meta.tariffId ?? existing.tariffId,
    currency: meta.currency || existing.currency,
    priceStatus: meta.priceStatus ?? (priced ? "TARIFF" : "PENDING_QUOTE"),
  };
  updated.netRevenue = computeNet(updated);
  updated.balanceDue = computeBalance(updated);
  updated.paymentStatus =
    updated.paidAmount <= 0 ? "UNPAID" : updated.paidAmount >= price + updated.taxVat ? "PAID" : "PARTIALLY_PAID";

  financialsStore.set(tripId, updated);
  return updated;
}

/**
 * Records a formal payment against a trip/invoice/settlement (§15, §17, §19).
 */
export function recordTripPayment(
  tripId: string,
  input: {
    amount: number;
    method?: PaymentRecord["method"];
    reference?: string;
    notes?: string;
  },
  actor: { userId?: string; fullName?: string; role?: string }
): { ok: boolean; error?: string; code?: string; payment?: PaymentRecord; financial?: TripFinancials } {
  const existing = financialsStore.get(tripId);
  if (!existing) {
    return { ok: false, error: "Financial record not found for this trip", code: "FINANCIALS_MISSING" };
  }
  if (existing.freightPrice <= 0) {
    return { ok: false, error: "Cannot record payment on an unpriced trip", code: "TRIP_UNPRICED" };
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "A positive payment amount is required", code: "INVALID_AMOUNT" };
  }

  const totalDue = existing.freightPrice + existing.taxVat;
  const newPaidTotal = existing.paidAmount + amount;
  if (newPaidTotal > totalDue) {
    return {
      ok: false,
      error: `Payment of ${amount} exceeds remaining balance of ${existing.balanceDue}`,
      code: "OVERPAYMENT",
    };
  }

  const seq = (existing.payments?.length || 0) + 1;
  const payment: PaymentRecord = {
    id: `pay-${tripId}-${seq}-${Date.now()}`,
    paymentNumber: `PAY-${existing.tripNumber.replace("EJ-", "")}-${String(seq).padStart(2, "0")}`,
    tripId,
    tripNumber: existing.tripNumber,
    invoiceNumber: existing.invoiceNumber,
    amount,
    currency: existing.currency || "SAR",
    method: input.method || "BANK_TRANSFER",
    reference: input.reference || `REF-${Date.now().toString().slice(-6)}`,
    status: "CONFIRMED",
    notes: input.notes,
    recordedBy: actor.userId,
    recordedByName: actor.fullName,
    recordedAt: new Date().toISOString(),
  };

  const payments = [payment, ...(existing.payments || [])];
  const paymentStatus: TripFinancials["paymentStatus"] =
    newPaidTotal >= totalDue ? "PAID" : "PARTIALLY_PAID";
  const invoiceStatus: CanonicalInvoiceStatus =
    paymentStatus === "PAID" ? "PAID" : "PARTIALLY_PAID";
  const settlementWorkflowStatus: CanonicalSettlementWorkflowStatus =
    paymentStatus === "PAID"
      ? "PAID"
      : existing.settlementWorkflowStatus === "APPROVED"
        ? "PARTIALLY_PAID"
        : existing.settlementWorkflowStatus;

  const updated = updateTripFinancials(
    tripId,
    {
      paidAmount: newPaidTotal,
      payments,
      paymentStatus,
      invoiceStatus,
      settlementStatus: paymentStatus === "PAID" ? "SETTLED" : "SETTLEMENT_PENDING",
      settlementWorkflowStatus,
    },
    {
      ...actor,
      action: "PAYMENT_RECORDED",
      reason: input.notes || `Payment ${payment.paymentNumber} (${amount} SAR)`,
    }
  )!;

  return { ok: true, payment, financial: updated };
}

/**
 * Cancels a recorded payment (§19 — requires `payments.cancel`).
 */
export function cancelTripPayment(
  tripId: string,
  paymentId: string,
  actor: { userId?: string; fullName?: string; role?: string },
  reason?: string
): { ok: boolean; error?: string; code?: string; financial?: TripFinancials } {
  const existing = financialsStore.get(tripId);
  if (!existing) return { ok: false, error: "Financial record not found", code: "FINANCIALS_MISSING" };

  const payments = [...(existing.payments || [])];
  const target = payments.find((p) => p.id === paymentId);
  if (!target) return { ok: false, error: "Payment not found", code: "PAYMENT_NOT_FOUND" };
  if (target.status === "CANCELLED") {
    return { ok: false, error: "Payment is already cancelled", code: "ALREADY_CANCELLED" };
  }

  target.status = "CANCELLED";
  target.cancelledBy = actor.userId;
  target.cancelledAt = new Date().toISOString();
  target.cancelReason = reason;

  const confirmedPaid = payments
    .filter((p) => p.status === "CONFIRMED")
    .reduce((sum, p) => sum + p.amount, 0);
  const totalDue = existing.freightPrice + existing.taxVat;
  const paymentStatus: TripFinancials["paymentStatus"] =
    confirmedPaid <= 0 ? "UNPAID" : confirmedPaid >= totalDue ? "PAID" : "PARTIALLY_PAID";

  const updated = updateTripFinancials(
    tripId,
    {
      paidAmount: confirmedPaid,
      payments,
      paymentStatus,
      invoiceStatus: paymentStatus === "PAID" ? "PAID" : confirmedPaid > 0 ? "PARTIALLY_PAID" : "ISSUED",
    },
    {
      ...actor,
      action: "PAYMENT_CANCELLED",
      reason: reason || `Cancelled payment ${target.paymentNumber}`,
    }
  )!;

  return { ok: true, financial: updated };
}

export function getAllFinancials(): TripFinancials[] {
  return Array.from(financialsStore.values());
}

/** Serializes a record for the API, always carrying the derived `expenses` and `totalDue` totals. */
export function serializeFinancials(f: TripFinancials) {
  const expenses = tripExpenses(f);
  const totalDue = f.freightPrice + f.taxVat;
  return {
    ...f,
    expenses,
    totalDue,
    amountDue: totalDue,
    remainingAmount: f.balanceDue,
    driverCommission: f.driverFee,
  };
}
