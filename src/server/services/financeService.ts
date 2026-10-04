/**
 * EJAZ Transport — Finance & Settlement Engine
 * Manages freight pricing, invoices, tax (VAT 15%), fuel costs, driver fees, and settlements.
 *
 * RULE — no invented money:
 *  • A cost line is either measured (entered against the trip) or a documented
 *    percentage of the authoritative freight price. There is no default toll,
 *    no default surcharge and no rounding trick.
 *  • An unpriced trip (price awaiting a company quote) carries no invoice and
 *    no negative margin; it is re-priced through `repriceTrip` the moment a
 *    real tariff is applied, and only then do costs derive from it.
 */

export interface TripFinancials {
  tripId: string;
  tripNumber: string;
  freightPrice: number;
  driverFee: number;
  fuelCost: number;
  tollFees: number;
  otherExpenses: number;
  taxVat: number; // 15% in KSA
  netRevenue: number;
  invoiceNumber?: string;
  invoiceStatus: "DRAFT" | "ISSUED" | "SENT" | "PAID" | "OVERDUE";
  settlementStatus: "UNSETTLED" | "SETTLEMENT_PENDING" | "SETTLED";
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  paidAmount: number;
  /** How the price was resolved. `PENDING_QUOTE` means the trip is not billable yet. */
  priceStatus?: "TARIFF" | "PENDING_QUOTE" | "UNPRICED";
  /** Tariff the price was resolved from, so every figure traces to its source. */
  tariffId?: string;
  currency: string;
  /** Outstanding balance = freight price (VAT inclusive) − what has been paid. */
  balanceDue: number;
}

/** Standard driver commission share of the freight price. */
export const DRIVER_COMMISSION_RATE = 0.22;
/** Standard estimated fuel share of the freight price. */
export const FUEL_COST_RATE = 0.28;
/** KSA VAT rate. */
export const VAT_RATE = 0.15;

const financialsStore = new Map<string, TripFinancials>();

function computeNet(f: Pick<TripFinancials, "freightPrice" | "driverFee" | "fuelCost" | "tollFees" | "otherExpenses">): number {
  return f.freightPrice - f.driverFee - f.fuelCost - f.tollFees - f.otherExpenses;
}

function computeBalance(f: Pick<TripFinancials, "freightPrice" | "taxVat" | "paidAmount">): number {
  return Math.max(0, f.freightPrice + f.taxVat - f.paidAmount);
}

/** Total measured/derived cost lines of a trip — the single "expenses" figure. */
export function tripExpenses(f: Pick<TripFinancials, "driverFee" | "fuelCost" | "tollFees" | "otherExpenses">): number {
  return f.driverFee + f.fuelCost + f.tollFees + f.otherExpenses;
}

/**
 * Creates (or replaces) the financial record of a trip from its authoritative
 * freight price. Costs are percentages of that price only; when the price is
 * still awaiting a company quote nothing is invented.
 */
export function initTripFinancials(
  tripId: string,
  tripNumber: string,
  freightPrice: number,
  meta?: { priceStatus?: TripFinancials["priceStatus"]; tariffId?: string; currency?: string }
): TripFinancials {
  const price = Number(freightPrice) || 0;
  const priced = price > 0;
  const driverFee = Math.round(price * DRIVER_COMMISSION_RATE);
  const fuelCost = Math.round(price * FUEL_COST_RATE);
  const taxVat = Math.round(price * VAT_RATE);

  const fin: TripFinancials = {
    tripId,
    tripNumber,
    freightPrice: price,
    driverFee,
    fuelCost,
    tollFees: 0,
    otherExpenses: 0,
    taxVat,
    netRevenue: computeNet({ freightPrice: price, driverFee, fuelCost, tollFees: 0, otherExpenses: 0 }),
    // No invoice exists for a trip that has not been priced yet.
    invoiceNumber: priced ? `INV-${tripNumber.replace("EJ-", "")}` : undefined,
    invoiceStatus: "DRAFT",
    settlementStatus: "UNSETTLED",
    paymentStatus: "UNPAID",
    paidAmount: 0,
    priceStatus: meta?.priceStatus ?? (priced ? "TARIFF" : "PENDING_QUOTE"),
    tariffId: meta?.tariffId,
    currency: meta?.currency || "SAR",
    balanceDue: 0,
  };
  fin.balanceDue = computeBalance(fin);

  financialsStore.set(tripId, fin);
  return fin;
}

export function getTripFinancials(tripId: string): TripFinancials | undefined {
  return financialsStore.get(tripId);
}

export function updateTripFinancials(tripId: string, updates: Partial<TripFinancials>): TripFinancials | null {
  const existing = financialsStore.get(tripId);
  if (!existing) return null;

  const updated: TripFinancials = { ...existing, ...updates };
  updated.freightPrice = Number(updated.freightPrice) || 0;
  updated.driverFee = Number(updated.driverFee) || 0;
  updated.fuelCost = Number(updated.fuelCost) || 0;
  updated.tollFees = Number(updated.tollFees) || 0;
  updated.otherExpenses = Number(updated.otherExpenses) || 0;
  updated.taxVat = Number(updated.taxVat) || 0;
  updated.paidAmount = Number(updated.paidAmount) || 0;

  updated.netRevenue = computeNet(updated);
  updated.balanceDue = computeBalance(updated);

  // A partial payment is a partial payment — never silently reported as paid.
  if (updates.paidAmount !== undefined) {
    const due = updated.freightPrice + updated.taxVat;
    updated.paymentStatus =
      updated.paidAmount <= 0 ? "UNPAID" : updated.paidAmount >= due ? "PAID" : "PARTIALLY_PAID";
  }

  financialsStore.set(tripId, updated);
  return updated;
}

/**
 * Re-prices a trip from an authoritative tariff. Re-derives every cost line from
 * the new price so a quote resolved later still produces a coherent invoice
 * instead of leaving the trip at zero forever.
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

export function getAllFinancials(): TripFinancials[] {
  return Array.from(financialsStore.values());
}

/** Serializes a record for the API, always carrying the derived `expenses` total. */
export function serializeFinancials(f: TripFinancials) {
  return { ...f, expenses: tripExpenses(f) };
}
