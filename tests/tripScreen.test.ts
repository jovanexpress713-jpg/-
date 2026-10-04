import assert from "assert";
import http from "http";
import type { AddressInfo } from "net";
import { createServerApp } from "../src/server/app";

/**
 * EJAZ Transport — Phase 2: Trips Screen & role-scoped trip lists.
 * Verifies the trips served to each surface come from the database (no mock
 * layer), tabs map to the real lifecycle, prices come from the tariff engine,
 * drivers accept/decline under the existing conditions, and role scoping
 * never leaks a trip the user is not entitled to.
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

export async function runTripScreenTests() {
  console.log("  [TEST] Running Phase 2 Trips Screen & Role Scoping Tests...");
  baseUrl = await startServer();

  const admin = await login("admin@ejaz.sa", "Ejaz@2026Admin");
  const client = await login("client@ejaz.sa", "Ejaz@2026Client");
  const driver = await login("driver@ejaz.sa", "Ejaz@2026Driver"); // د1
  const driver2 = await login("salem.driver@ejaz.sa", "Ejaz@2026Driver"); // د2
  assert(admin && client && driver && driver2, "sessions required");

  // ── 1. Real trips come from the database (seeded baseline, not mocks) ────
  const all = await api("GET", "/api/trips", { token: admin });
  assert.strictEqual(all.status, 200);
  assert(all.body.total >= 3, "baseline trips exist in the database");
  assert(all.body.trips.every((tr: any) => /^EJ-\d{4}-\d{6}$/.test(tr.tripNumber)), "every trip carries a unified number");

  // ── 2. Price on the screen comes from the Phase 1 tariff engine ──────────
  const tariff = await api("POST", "/api/tariffs", {
    token: admin,
    body: {
      truckType: "جاف", originCity: "الدمام", destinationCity: "الرياض",
      minDistanceKm: 0, maxDistanceKm: null, minWeight: 0, maxWeight: null,
      weightUnit: "TON", price: 2750, currency: "SAR", status: "ACTIVE", validFrom: "2026-01-01",
    },
  });
  assert.strictEqual(tariff.status, 201);

  const pricedTrip = await api("POST", "/api/trips", {
    token: admin,
    body: {
      originCity: "الدمام", destinationCity: "الرياض",
      cargoDescription: "بضائع معلبة", cargoType: "جاف", cargoWeightTons: 14,
      customerId: "cust-2",
    },
  });
  assert.strictEqual(pricedTrip.status, 201);
  assert.strictEqual(pricedTrip.body.trip.tripPrice, 2750, "screen price must equal the tariff price");
  assert.strictEqual(pricedTrip.body.trip.tariffId, tariff.body.tariff.id);

  const listed = await api("GET", "/api/trips", { token: admin });
  const found = listed.body.trips.find((tr: any) => tr.id === pricedTrip.body.trip.id);
  assert(found, "newly created trip appears in the trips list automatically");
  assert.strictEqual(found.tripPrice, 2750, "list shows the tariff-resolved price");
  assert.strictEqual(found.priceStatus, "TARIFF");

  // ── 3. Tabs map to real lifecycle states (driver surface) ────────────────
  const available = await api("GET", "/api/driver/trips?tab=available", { token: driver });
  assert.strictEqual(available.status, 200);
  assert(
    available.body.trips.every((tr: any) =>
      ["DRAFT_CREATED", "PENDING_APPROVAL", "REOPENED", "CONFIRMED"].includes(tr.status) || !tr.driverId || tr.driverId === "unassigned"
    ),
    "available tab only shows open trips"
  );

  const active = await api("GET", "/api/driver/trips?tab=active", { token: driver });
  assert(
    active.body.trips.every((tr: any) => tr.driverId === "d1" || tr.additionalDriverId === "d1"),
    "active tab only shows this driver's trips"
  );

  const completed = await api("GET", "/api/driver/trips?tab=completed", { token: driver });
  assert.strictEqual(completed.status, 200);

  // ── 4. Accept a trip — existing condition: request → operations approve ──
  const openTrip = available.body.trips.find((tr: any) => !tr.driverId || tr.driverId === "unassigned" || tr.status === "DRAFT_CREATED");
  if (openTrip) {
    const req = await api("POST", `/api/driver/trips/${openTrip.id}/request`, { token: driver, body: { notes: "متاح وأرغب بتولي الرحلة" } });
    assert.strictEqual(req.status, 200, `driver accepts an available trip: ${JSON.stringify(req.body)}`);
    assert.strictEqual(req.body.trip.driverRequestStatus, "PENDING");

    const approve = await api("POST", `/api/trips/${openTrip.id}/approve-request`, { token: admin });
    assert.strictEqual(approve.status, 200);
    assert.strictEqual(approve.body.trip.driverId, "d1", "approved request assigns the trip to the requesting driver");
    assert.strictEqual(approve.body.trip.tripNumber, openTrip.tripNumber, "approval never changes the trip number");
  }

  // ── 5. Decline a trip — it disappears from the decliner's available list ─
  // Create a fresh open trip so the decline flow always has a subject.
  const freshOpen = await api("POST", "/api/trips", {
    token: admin,
    body: {
      originCity: "الرياض", destinationCity: "بريدة",
      cargoDescription: "شحنة متاحة للسائقين", cargoType: "سطحة", cargoWeightTons: 20,
      customerId: "cust-3",
    },
  });
  assert.strictEqual(freshOpen.status, 201);

  const available2 = await api("GET", "/api/driver/trips?tab=available", { token: driver2 });
  const toDecline = available2.body.trips.find((tr: any) => tr.id === freshOpen.body.trip.id)
    || available2.body.trips.find((tr: any) => !tr.declinedDriverIds?.includes("d2"));
  assert(toDecline, "an open trip exists for declining");

  const decline = await api("POST", `/api/driver/trips/${toDecline.id}/decline`, { token: driver2, body: { reason: "خارج نطاق عملي المعتاد" } });
  assert.strictEqual(decline.status, 200, `decline works: ${JSON.stringify(decline.body)}`);

  const afterDecline = await api("GET", "/api/driver/trips?tab=available", { token: driver2 });
  assert(!afterDecline.body.trips.some((tr: any) => tr.id === toDecline.id), "declined trip leaves the driver's available list");

  const adminView = await api("GET", "/api/trips", { token: admin });
  assert(adminView.body.trips.some((tr: any) => tr.id === toDecline.id), "the trip itself is untouched — still visible to operations");

  const reDecline = await api("POST", `/api/driver/trips/${toDecline.id}/decline`, { token: driver2 });
  assert.strictEqual(reDecline.status, 409, "declining twice is rejected");

  // Declining an executing trip is refused
  const inTransit = (await api("GET", "/api/trips", { token: admin })).body.trips.find((tr: any) => tr.status === "IN_TRANSIT" && tr.driverId);
  if (inTransit) {
    const declineActive = await api("POST", `/api/driver/trips/${inTransit.id}/decline`, { token: driver2 });
    assert.strictEqual(declineActive.status, 409, "executing trips cannot be declined");
  }

  // ── 6. Client scoping — only own trips, no other customer's data ─────────
  const clientTrips = await api("GET", "/api/client/trips", { token: client });
  assert(clientTrips.body.trips.every((tr: any) => tr.customerId === "cust-1"), "client sees only their own trips");

  const otherCustomerTrip = all.body.trips.find((tr: any) => tr.customerId !== "cust-1");
  if (otherCustomerTrip) {
    const peek = await api("GET", `/api/trips/${otherCustomerTrip.id}`, { token: client });
    assert.strictEqual(peek.status, 403, "client cannot open another customer's trip");
  }

  // Driver scoping — an in-transit trip of another driver is off-limits
  const someoneElsesTrip = all.body.trips.find((tr: any) => tr.status === "IN_TRANSIT" && tr.driverId && tr.driverId !== "d2");
  if (someoneElsesTrip) {
    const peek = await api("GET", `/api/trips/${someoneElsesTrip.id}`, { token: driver2 });
    assert.strictEqual(peek.status, 403, "driver cannot open another driver's executing trip");
  }

  // ── 7. No mock data — every served trip exists in the DB with an audit trail
  const anyTrip = all.body.trips[0];
  const file = await api("GET", `/api/trips/${anyTrip.id}`, { token: admin });
  assert.strictEqual(file.status, 200);
  assert(file.body.trip && file.body.events !== undefined && file.body.financials, "trip file assembles DB data (trip + events + financials)");

  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
  console.log("  ✓ Phase 2 Trips Screen & Role Scoping Tests Passed Successfully!");
}
