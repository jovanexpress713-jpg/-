import assert from "assert";
import {
  initTripFinancials,
  getTripFinancials,
  updateTripFinancials,
  repriceTripFinancials,
  tripExpenses,
} from "../src/server/services/financeService";

export function runFinanceTests() {
  console.log("  [TEST] Running Finance & Settlement Tests...");

  // 1. Financial initialization with freight pricing, 15% VAT, driver fees
  const fin = initTripFinancials("trip-fin-test", "EJ-2026-009999", 5000);
  assert.strictEqual(fin.freightPrice, 5000);
  assert.strictEqual(fin.taxVat, 750, "15% VAT on 5000 must be 750");
  assert.strictEqual(fin.driverFee, 1100, "22% driver commission on 5000 must be 1100");
  assert.strictEqual(fin.fuelCost, 1400, "28% fuel cost on 5000 must be 1400");
  assert.strictEqual(fin.invoiceStatus, "DRAFT");
  assert.strictEqual(fin.settlementStatus, "UNSETTLED");

  // 1b. No invented cost lines: a priced trip starts with zero tolls and a
  //     net margin that is exactly price − measured/derived costs.
  assert.strictEqual(fin.tollFees, 0, "No toll fee may be invented for a trip");
  assert.strictEqual(tripExpenses(fin), 2500, "expenses = driverFee + fuelCost + tolls + other");
  assert.strictEqual(fin.netRevenue, 2500, "netRevenue must equal freight − expenses");
  assert.strictEqual(fin.invoiceNumber, "INV-2026-009999");
  assert.strictEqual(fin.balanceDue, 5750, "balance due is VAT-inclusive before any payment");

  // 1c. An unpriced trip is not billable and carries no negative margin.
  const unpriced = initTripFinancials("trip-fin-unpriced", "EJ-2026-009998", 0);
  assert.strictEqual(unpriced.netRevenue, 0, "An unpriced trip must not show a negative margin");
  assert.strictEqual(unpriced.invoiceNumber, undefined, "No invoice exists before a price is set");
  assert.strictEqual(unpriced.priceStatus, "PENDING_QUOTE");

  // 1d. Re-pricing from a real tariff re-derives every cost line from it.
  const repriced = repriceTripFinancials("trip-fin-unpriced", 10000, { tariffId: "tar-1", currency: "SAR" });
  assert.strictEqual(repriced?.freightPrice, 10000);
  assert.strictEqual(repriced?.driverFee, 2200, "commission re-derived from the new price");
  assert.strictEqual(repriced?.fuelCost, 2800, "fuel re-derived from the new price");
  assert.strictEqual(repriced?.taxVat, 1500, "VAT re-derived from the new price");
  assert.strictEqual(repriced?.invoiceNumber, "INV-2026-009998", "invoice issued once the trip is priced");
  assert.strictEqual(repriced?.balanceDue, 11500);

  // 2. A partial payment is reported as partial — the caller cannot assert
  //    "PAID" while VAT is still outstanding.
  const partial = updateTripFinancials("trip-fin-test", {
    paidAmount: 5000,
    settlementStatus: "SETTLEMENT_PENDING",
    invoiceStatus: "ISSUED",
  });
  assert(partial !== null, "Updated financials must return object");
  assert.strictEqual(partial?.paymentStatus, "PARTIALLY_PAID", "5000 of 5750 is a partial payment");
  assert.strictEqual(partial?.balanceDue, 750, "the outstanding VAT must remain visible");

  // 2b. Settling the remainder closes the record.
  const updated = updateTripFinancials("trip-fin-test", {
    paidAmount: 5750,
    settlementStatus: "SETTLED",
    invoiceStatus: "PAID",
  });
  assert(updated !== null, "Updated financials must return object");
  assert.strictEqual(updated?.settlementStatus, "SETTLED");
  assert.strictEqual(updated?.paymentStatus, "PAID");
  assert.strictEqual(updated?.invoiceStatus, "PAID");
  assert.strictEqual(updated?.balanceDue, 0);

  // 2c. Recording a real cost line moves the margin of the same trip.
  const withToll = updateTripFinancials("trip-fin-test", { tollFees: 320 });
  assert.strictEqual(tripExpenses(withToll!), 2820);
  assert.strictEqual(withToll?.netRevenue, 2180, "netRevenue must follow the recorded cost");

  const fetched = getTripFinancials("trip-fin-test");
  assert.strictEqual(fetched?.paidAmount, 5750);

  console.log("  ✓ Finance & Settlement Tests Passed Successfully!");
}
