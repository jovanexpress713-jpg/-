import assert from "assert";
import http from "http";
import type { AddressInfo } from "net";
import { createServerApp } from "../src/server/app";

/**
 * EJAZ Transport — FINAL INTEGRATION across Phases 1 + 2 + 3.
 * One end-to-end business flow exercising every phase together:
 *   Phase 1  the company publishes a tariff → the client's shipment resolves
 *            its price dynamically from the tariff book (no hardcoded price).
 *   Phase 2  the trip appears on the trips screen with its real status/price,
 *            a driver accepts it, operations approves the assignment.
 *   Phase 3  the truck breaks down mid-route → driver + vehicle are replaced
 *            inside the SAME trip; the unified number never changes and the
 *            full timeline/assignment history survives.
 */

let server: http.Server | null = null;
let baseUrl = "";

async function startServer(): Promise<string> {
  const app = createServerApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const { port } = server!.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

async function api(
  method: string,
  path: string,
  options: { token?: string | null; body?: any } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* raw */ }
  return { status: res.status, body };
}

async function login(email: string, password: string) {
  const res = await api("POST", "/api/auth/login", { body: { email, password } });
  return res.body?.token as string;
}

export async function runIntegrationTests() {
  console.log("  [TEST] Running Final Cross-Phase Integration Tests...");
  baseUrl = await startServer();

  const admin = await login("admin@ejaz.sa", "Ejaz@2026Admin");
  const client = await login("client@ejaz.sa", "Ejaz@2026Client");
  const driver2 = await login("salem.driver@ejaz.sa", "Ejaz@2026Driver"); // د2
  assert(admin && client && driver2, "sessions required");

  // ── PHASE 1 · the company publishes a tariff ─────────────────────────────
  const tariff = await api("POST", "/api/tariffs", {
    token: admin,
    body: {
      truckType: "براد", originCity: "تبوك", destinationCity: "نجران",
      minDistanceKm: 0, maxDistanceKm: null, minWeight: 0, maxWeight: null,
      weightUnit: "TON", price: 7400, currency: "SAR", status: "ACTIVE", validFrom: "2026-01-01",
    },
  });
  assert.strictEqual(tariff.status, 201, "company tariff published");

  // The client resolves the live quote before ordering — dynamic, not typed.
  const quote = await api("GET", "/api/tariffs/quote?truckType=براد&origin=تبوك&destination=نجران&weightTons=15", { token: client });
  assert.strictEqual(quote.body.available, true, "quote matches the published tariff");
  assert.strictEqual(quote.body.price, 7400, "client sees the exact tariff price");

  // ── PHASE 1 → 2 · client orders; the trip is created with the tariff price
  const order = await api("POST", "/api/trips", {
    token: client,
    body: {
      originCity: "تبوك", destinationCity: "نجران",
      cargoDescription: "منتجات مبردة — تكامل المراحل",
      cargoType: "براد", cargoWeightTons: 15,
      customerId: "cust-1", tariffId: quote.body.tariff.id,
    },
  });
  assert.strictEqual(order.status, 201, "client order accepted");
  const trip = order.body.trip;
  const NUMBER = trip.tripNumber;
  assert(/^EJ-\d{4}-\d{6}$/.test(NUMBER), "unified number assigned at creation");
  assert.strictEqual(trip.tripPrice, 7400, "trip price = tariff price (no hardcoded number)");
  assert.strictEqual(trip.priceStatus, "TARIFF");
  assert.strictEqual(trip.tariffId, tariff.body.tariff.id);

  // ── PHASE 2 · the trip appears on the trips screen with its price ────────
  const screen = await api("GET", "/api/trips", { token: admin });
  const onScreen = screen.body.trips.find((tr: any) => tr.id === trip.id);
  assert(onScreen, "created trip appears on the trips screen automatically");
  assert.strictEqual(onScreen.tripPrice, 7400, "screen shows the tariff-resolved price");
  assert.strictEqual(onScreen.tripNumber, NUMBER);

  // The client sees it scoped to their own account
  const clientList = await api("GET", "/api/client/trips", { token: client });
  assert(clientList.body.trips.some((tr: any) => tr.id === trip.id), "client sees their own trip");

  // ── PHASE 2 · driver accepts, operations approves ────────────────────────
  // Move the trip to an open state so the driver can request it.
  await api("POST", `/api/trips/${trip.id}/transition`, { token: admin, body: { targetStatus: "PENDING_APPROVAL" } });
  await api("POST", `/api/trips/${trip.id}/transition`, { token: admin, body: { targetStatus: "CONFIRMED" } });

  const request = await api("POST", `/api/driver/trips/${trip.id}/request`, { token: driver2, body: { notes: "أرغب بتولي الرحلة" } });
  assert.strictEqual(request.status, 200, "driver accepts the available trip");
  const approval = await api("POST", `/api/trips/${trip.id}/approve-request`, { token: admin });
  assert.strictEqual(approval.status, 200);
  assert.strictEqual(approval.body.trip.driverId, "d2", "driver assigned");
  assert.strictEqual(approval.body.trip.tripNumber, NUMBER, "number unchanged through assignment");

  // Advance to in-transit so a breakdown replacement is realistic.
  const heading = await api("POST", `/api/trips/${trip.id}/transition`, { token: admin, body: { targetStatus: "HEADING_TO_LOADING" } });
  assert.strictEqual(heading.status, 200, "trip advanced to heading-to-loading");

  // ── PHASE 3 · breakdown → replace driver + vehicle in the SAME trip ──────
  const swap = await api("POST", `/api/trips/${trip.id}/replace-assignment`, {
    token: admin,
    body: { newDriverId: "d3", newVehicleId: "v2", reason: "عطل مفاجئ — استبدال المركبة والسائق" },
  });
  assert.strictEqual(swap.status, 200, "combined replacement succeeds");

  const file = (await api("GET", `/api/trips/${trip.id}`, { token: admin })).body;
  assert.strictEqual(file.trip.tripNumber, NUMBER, "PHASE 3: number survives the breakdown swap");
  assert.strictEqual(file.trip.driverId, "d3");
  assert.strictEqual(file.trip.vehicleId, "v2");
  assert.strictEqual(file.trip.driverHistory.length, 1, "driver replacement recorded");
  assert.strictEqual(file.trip.vehicleHistory.length, 1, "vehicle replacement recorded");
  assert.strictEqual(file.trip.driverHistory[0].newDriverName, "ماجد البلوي");

  // Timeline keeps the whole story under one number
  const events = file.events.map((e: any) => e.eventType);
  assert(events.includes("TRIP_CREATED"), "timeline has creation");
  assert(events.includes("TRIP_REQUESTED_BY_DRIVER"), "timeline has driver acceptance");
  assert(events.includes("DRIVER_REQUEST_APPROVED"), "timeline has approval");
  assert(events.includes("DRIVER_AND_VEHICLE_REPLACED"), "timeline has the breakdown swap");

  // Financials remain bound to the same unified number & tariff price
  assert.strictEqual(file.financials.tripNumber, NUMBER, "financials share the unified number");
  assert.strictEqual(file.financials.freightPrice, 7400, "financials carry the tariff price end-to-end");

  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
  console.log("  ✓ Final Cross-Phase Integration Tests Passed Successfully!");
}
