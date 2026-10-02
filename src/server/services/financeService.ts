/**
 * EJAZ Transport — Finance & Settlement Engine
 * Manages freight pricing, invoices, tax (VAT 15%), fuel costs, driver fees, and settlements.
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
}

const financialsStore = new Map<string, TripFinancials>();

export function initTripFinancials(tripId: string, tripNumber: string, freightPrice: number): TripFinancials {
  const driverFee = Math.round(freightPrice * 0.22); // 22% driver commission standard
  const fuelCost = Math.round(freightPrice * 0.28);  // 28% estimated fuel standard
  const tollFees = 120;
  const taxVat = Math.round(freightPrice * 0.15);   // 15% VAT
  const netRevenue = freightPrice - driverFee - fuelCost - tollFees;

  const fin: TripFinancials = {
    tripId,
    tripNumber,
    freightPrice,
    driverFee,
    fuelCost,
    tollFees,
    otherExpenses: 0,
    taxVat,
    netRevenue,
    invoiceNumber: `INV-${tripNumber.replace("EJ-", "")}`,
    invoiceStatus: "DRAFT",
    settlementStatus: "UNSETTLED",
    paymentStatus: "UNPAID",
    paidAmount: 0,
  };

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
  // Recalculate net
  updated.netRevenue = updated.freightPrice - updated.driverFee - updated.fuelCost - updated.tollFees - updated.otherExpenses;
  financialsStore.set(tripId, updated);
  return updated;
}

export function getAllFinancials(): TripFinancials[] {
  return Array.from(financialsStore.values());
}
