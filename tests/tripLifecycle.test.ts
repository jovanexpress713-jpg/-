import assert from "assert";
import { generateTripNumber, parseTripNumber } from "../src/server/services/tripNumberGenerator";
import { validateTransition } from "../src/server/services/tripLifecycleService";

export function runTripLifecycleTests() {
  console.log("  [TEST] Running Trip Lifecycle & State Machine Tests...");

  // 1. Unified Trip Number Generation
  const tripNum1 = generateTripNumber(2026);
  const tripNum2 = generateTripNumber(2026);
  assert(tripNum1.startsWith("EJ-2026-"), "Trip number must start with EJ-2026-");
  assert(tripNum2.startsWith("EJ-2026-"), "Trip number must start with EJ-2026-");
  assert.notStrictEqual(tripNum1, tripNum2, "Trip numbers must be strictly sequential and unique");

  const parsed = parseTripNumber(tripNum1);
  assert(parsed !== null, "Trip number must be parseable");
  assert.strictEqual(parsed?.prefix, "EJ");
  assert.strictEqual(parsed?.year, 2026);

  // 2. Valid Canonical State Transitions
  const testTrip = { vehicle_id: "v1", driver_id: "d1" };

  // DRAFT_CREATED -> PENDING_APPROVAL
  const v1 = validateTransition("DRAFT_CREATED", "PENDING_APPROVAL", "OPERATIONS_MANAGER", testTrip);
  assert.strictEqual(v1.isValid, true, "DRAFT_CREATED -> PENDING_APPROVAL must be valid");

  // PENDING_APPROVAL -> CONFIRMED
  const v2 = validateTransition("PENDING_APPROVAL", "CONFIRMED", "OPERATIONS_MANAGER", testTrip);
  assert.strictEqual(v2.isValid, true, "PENDING_APPROVAL -> CONFIRMED must be valid");

  // CONFIRMED -> ASSIGNED (requires vehicle_id & driver_id)
  const v3 = validateTransition("CONFIRMED", "ASSIGNED", "DISPATCHER", testTrip);
  assert.strictEqual(v3.isValid, true, "CONFIRMED -> ASSIGNED with required fields must be valid");

  // Missing required vehicle assignment
  const v3Fail = validateTransition("CONFIRMED", "ASSIGNED", "DISPATCHER", {});
  assert.strictEqual(v3Fail.isValid, false, "CONFIRMED -> ASSIGNED without vehicle/driver must fail");

  // 3. Illegal Transition (skipping steps)
  const vIllegal = validateTransition("DRAFT_CREATED", "IN_TRANSIT", "DRIVER", testTrip);
  assert.strictEqual(vIllegal.isValid, false, "Jumping directly from DRAFT_CREATED to IN_TRANSIT must be rejected");

  // 4. Role Authorization Checks
  const vDriverUnauthorized = validateTransition("PENDING_APPROVAL", "CONFIRMED", "DRIVER", testTrip);
  assert.strictEqual(vDriverUnauthorized.isValid, false, "DRIVER cannot approve or confirm trip");

  // 5. Trip Cancellation
  const cancelSuccess = validateTransition("IN_TRANSIT", "CANCELLED", "OPERATIONS_MANAGER", testTrip, "Highway landslide road closure");
  assert.strictEqual(cancelSuccess.isValid, true, "Cancellation with valid manager and reason must succeed");

  const cancelNoReason = validateTransition("IN_TRANSIT", "CANCELLED", "OPERATIONS_MANAGER", testTrip, "");
  assert.strictEqual(cancelNoReason.isValid, false, "Cancellation without reason must fail");

  const cancelDelivered = validateTransition("DELIVERED", "CANCELLED", "SUPER_ADMIN", testTrip, "Reason");
  assert.strictEqual(cancelDelivered.isValid, false, "Already delivered trip cannot be cancelled");

  // 6. Trip Reopening
  const reopenSuccess = validateTransition("CANCELLED", "REOPENED", "SUPER_ADMIN", testTrip, "Administrative review cleared route");
  assert.strictEqual(reopenSuccess.isValid, true, "Reopening by SUPER_ADMIN with reason must succeed");

  const reopenUnauthorized = validateTransition("CANCELLED", "REOPENED", "DISPATCHER", testTrip, "Reason");
  assert.strictEqual(reopenUnauthorized.isValid, false, "DISPATCHER cannot reopen cancelled trip");

  console.log("  ✓ Trip Lifecycle & State Machine Tests Passed Successfully!");
}
