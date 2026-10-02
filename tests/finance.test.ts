import assert from "assert";
import { initTripFinancials, getTripFinancials, updateTripFinancials } from "../src/server/services/financeService";

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

  // 2. Settlement workflow update
  const updated = updateTripFinancials("trip-fin-test", {
    paidAmount: 5000,
    settlementStatus: "SETTLED",
    paymentStatus: "PAID",
    invoiceStatus: "PAID",
  });
  assert(updated !== null, "Updated financials must return object");
  assert.strictEqual(updated?.settlementStatus, "SETTLED");
  assert.strictEqual(updated?.paymentStatus, "PAID");
  assert.strictEqual(updated?.invoiceStatus, "PAID");

  const fetched = getTripFinancials("trip-fin-test");
  assert.strictEqual(fetched?.paidAmount, 5000);

  console.log("  ✓ Finance & Settlement Tests Passed Successfully!");
}
