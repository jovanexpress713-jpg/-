import assert from "assert";
import http from "http";
import type { AddressInfo } from "net";
import { createServerApp } from "../src/server/app";

/**
 * EJAZ Transport — Live API authorization & lifecycle guard tests.
 * Boots the real Express application on an ephemeral port and exercises the
 * authorization surface end to end. These tests intentionally fail if the
 * platform is ever reopened to anonymous or over-privileged access.
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
  options: { token?: string | null; body?: any; apiKey?: string } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.apiKey) headers["x-api-key"] = options.apiKey;

  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  return { status: res.status, body };
}

async function login(email: string, password: string) {
  const res = await api("POST", "/api/auth/login", { body: { email, password } });
  return { status: res.status, token: res.body?.token as string | undefined, user: res.body?.user };
}

export async function runApiSecurityTests() {
  console.log("  [TEST] Running API Authorization & Lifecycle Guard Tests...");
  baseUrl = await startServer();

  try {
    // ------------------------------------------------------------------
    // 1. Anonymous access must be rejected on every operational endpoint
    // ------------------------------------------------------------------
    const protectedGets = [
      "/api/trips",
      "/api/vehicles",
      "/api/drivers",
      "/api/customers",
      "/api/finance/trips",
      "/api/reports/operational-summary",
      "/api/claims",
      "/api/notifications",
      "/api/audit",
      "/api/gps/status",
      "/api/dev/gps",
    ];

    for (const endpoint of protectedGets) {
      const res = await api("GET", endpoint);
      assert.strictEqual(res.status, 401, `Anonymous GET ${endpoint} must return 401, received ${res.status}`);
    }

    const ingest = await api("POST", "/api/dev/gps", {
      body: { deviceId: "AVL-UNAUTHORIZED", latitude: 24.7, longitude: 46.6 },
    });
    assert.strictEqual(ingest.status, 401, "Anonymous AVL telemetry ingestion must be rejected");

    // ------------------------------------------------------------------
    // 2. Credential handling: no master/backdoor password, hashes enforced
    // ------------------------------------------------------------------
    for (const email of ["admin@ejaz.sa", "driver@ejaz.sa", "client@ejaz.sa"]) {
      const backdoor = await api("POST", "/api/auth/login", {
        body: { email, password: "Ejaz@2026!" },
      });
      assert.strictEqual(backdoor.status, 401, `Universal password must not authenticate '${email}'`);
    }

    const wrongPassword = await api("POST", "/api/auth/login", {
      body: { email: "admin@ejaz.sa", password: "not-the-password" },
    });
    assert.strictEqual(wrongPassword.status, 401, "Invalid credentials must be rejected");

    // ------------------------------------------------------------------
    // 3. Legitimate authentication still works
    // ------------------------------------------------------------------
    const admin = await login("admin@ejaz.sa", "Ejaz@2026Admin");
    assert.strictEqual(admin.status, 200, "SUPER_ADMIN must be able to authenticate");
    assert.ok(admin.token, "Login must issue a JWT");

    const driver = await login("driver@ejaz.sa", "Ejaz@2026Driver");
    assert.strictEqual(driver.status, 200, "DRIVER must be able to authenticate");

    const client = await login("client@ejaz.sa", "Ejaz@2026Client");
    assert.strictEqual(client.status, 200, "CUSTOMER must be able to authenticate");

    const accountant = await login("finance@ejaz.sa", "Ejaz@2026Admin");
    assert.strictEqual(accountant.status, 200, "ACCOUNTANT must be able to authenticate");

    // ------------------------------------------------------------------
    // 4. RBAC: unauthorized roles are denied, authorized roles are allowed
    // ------------------------------------------------------------------
    const driverDenied = [
      { method: "POST", path: "/api/trips", body: { originCity: "أ", destinationCity: "ب", cargoDescription: "x", cargoType: "جاف", cargoWeightTons: 5 } },
      { method: "GET", path: "/api/finance/trips" },
      { method: "GET", path: "/api/audit" },
      { method: "GET", path: "/api/vehicles" },
      { method: "POST", path: "/api/vehicles", body: { plate: "ت ت ت ١", type: "جاف", model: "X", year: 2026, maxLoadTons: 20 } },
      { method: "GET", path: "/api/customers" },
    ];

    for (const probe of driverDenied) {
      const res = await api(probe.method, probe.path, { token: driver.token, body: (probe as any).body });
      assert.strictEqual(res.status, 403, `DRIVER ${probe.method} ${probe.path} must be 403, received ${res.status}`);
    }

    const driverAllowed = await api("GET", "/api/trips", { token: driver.token });
    assert.strictEqual(driverAllowed.status, 200, "DRIVER must be able to list entitled trips");

    const clientFinance = await api("GET", "/api/finance/trips", { token: client.token });
    assert.strictEqual(clientFinance.status, 403, "CUSTOMER must not read the finance ledger");

    const clientDrivers = await api("GET", "/api/drivers", { token: client.token });
    assert.strictEqual(clientDrivers.status, 403, "CUSTOMER must not read the driver registry");

    const accountantFinance = await api("GET", "/api/finance/trips", { token: accountant.token });
    assert.strictEqual(accountantFinance.status, 200, "ACCOUNTANT must read the finance ledger");

    const accountantCreateTrip = await api("POST", "/api/trips", {
      token: accountant.token,
      body: { originCity: "أ", destinationCity: "ب", cargoDescription: "x", cargoType: "جاف", cargoWeightTons: 5 },
    });
    assert.strictEqual(accountantCreateTrip.status, 403, "ACCOUNTANT must not create trips");

    // ------------------------------------------------------------------
    // 5. Object-level scoping: a customer only sees their own shipments
    // ------------------------------------------------------------------
    const clientList = await api("GET", "/api/client/trips", { token: client.token });
    assert.strictEqual(clientList.status, 200, "CUSTOMER must be able to list their shipments");
    for (const trip of clientList.body?.trips || []) {
      assert.strictEqual(trip.customerId, "cust-1", "Customer must never receive another client's shipment");
    }

    // ------------------------------------------------------------------
    // 6. Canonical lifecycle: full chain plus business-rule guards
    // ------------------------------------------------------------------
    const created = await api("POST", "/api/trips", {
      token: admin.token,
      body: {
        originCity: "الرياض",
        destinationCity: "جدة",
        cargoDescription: "اختبار آلي لضوابط دورة الحياة",
        cargoType: "براد",
        cargoWeightTons: 20,
        tripPrice: 5000,
        vehicleId: "v2",
        driverId: "d2",
      },
    });
    assert.strictEqual(created.status, 201, "SUPER_ADMIN must be able to create a trip");
    const tripId: string = created.body.trip.id;
    assert.match(created.body.trip.tripNumber, /^EJ-\d{4}-\d{6}$/, "Trip number must follow the EJ-YYYY-XXXXXX convention");

    const earlyPod = await api("POST", "/api/pod", { token: admin.token, body: { tripId, recipientName: "تسليم مبكر" } });
    assert.strictEqual(earlyPod.status, 422, "POD must be rejected before the trip reaches the destination");

    const earlySettlement = await api("POST", "/api/finance/settle", { token: admin.token, body: { tripId, paidAmount: 5000 } });
    assert.strictEqual(earlySettlement.status, 422, "Financial settlement must be rejected before delivery");

    const chain = [
      "PENDING_APPROVAL",
      "CONFIRMED",
      "ASSIGNED",
      "HEADING_TO_LOADING",
      "ARRIVED_LOADING",
      "LOADED",
      "IN_TRANSIT",
      "ARRIVED_DESTINATION",
    ];
    for (const target of chain) {
      const step = await api("POST", `/api/trips/${tripId}/transition`, { token: admin.token, body: { targetStatus: target, notes: "آلي" } });
      assert.strictEqual(step.status, 200, `Transition to ${target} must succeed, received ${step.status}: ${step.body?.error || ""}`);
    }

    const illegalJump = await api("POST", `/api/trips/${tripId}/transition`, { token: admin.token, body: { targetStatus: "DRAFT_CREATED" } });
    assert.strictEqual(illegalJump.status, 422, "Illegal state jumps must be rejected by the state machine");

    const pod = await api("POST", "/api/pod", {
      token: admin.token,
      body: { tripId, recipientName: "مندوب الاستلام", signatureUrl: "SIGNED_DIGITALLY" },
    });
    assert.strictEqual(pod.status, 201, "POD must be accepted once the trip is at the destination");

    const afterPod = await api("GET", `/api/trips/${tripId}`, { token: admin.token });
    assert.strictEqual(afterPod.body.trip.status, "DELIVERED", "Recording a POD must transition the trip to DELIVERED");

    const duplicatePod = await api("POST", "/api/pod", { token: admin.token, body: { tripId, recipientName: "مكرر" } });
    assert.strictEqual(duplicatePod.status, 409, "Duplicate POD records must be rejected");

    // ── An unpriced shipment can never be settled ────────────────────────
    // This corridor is deliberately outside the company's rate card, so the
    // trip is created «بانتظار عرض سعر» with no invoice behind it.
    const unserved = await api("POST", "/api/trips", {
      token: admin.token,
      body: {
        originCity: "عرعر",
        destinationCity: "الباحة",
        cargoDescription: "مسار خارج دفتر التعرفة",
        cargoType: "جاف",
        cargoWeightTons: 12,
        vehicleId: "v2",
        driverId: "d2",
      },
    });
    assert.strictEqual(unserved.status, 201, "creating the unserved-corridor trip");
    assert.strictEqual(unserved.body.trip.priceStatus, "PENDING_QUOTE", "an unserved corridor must not invent a price");
    assert.strictEqual(unserved.body.trip.tripPrice, 0);

    for (const target of ["PENDING_APPROVAL", "CONFIRMED", "ASSIGNED", "HEADING_TO_LOADING", "ARRIVED_LOADING", "LOADED", "IN_TRANSIT", "ARRIVED_DESTINATION", "DELIVERED"]) {
      await api("POST", `/api/trips/${unserved.body.trip.id}/transition`, { token: admin.token, body: { targetStatus: target, notes: "آلي" } });
    }
    const unpricedSettlement = await api("POST", "/api/finance/settle", { token: admin.token, body: { tripId: unserved.body.trip.id, paidAmount: 5000 } });
    assert.strictEqual(
      unpricedSettlement.status,
      422,
      "Settling a trip with no authoritative price must be rejected, got " +
        unpricedSettlement.status + ": " + (unpricedSettlement.body?.error || "")
    );
    assert.strictEqual(unpricedSettlement.body.code, "TRIP_UNPRICED");

    // With no matching tariff the system refuses to invent a price…
    const noTariff = await api("POST", `/api/trips/${unserved.body.trip.id}/price`, { token: admin.token, body: { notes: "بلا تعرفة" } });
    assert.strictEqual(noTariff.status, 422, "Pricing without a matching tariff must be refused");

    // …so the tariff is created first, and the price is then derived from it.
    const tariff = await api("POST", "/api/tariffs", {
      token: admin.token,
      body: {
        truckType: "جاف",
        originCity: "عرعر",
        destinationCity: "الباحة",
        minDistanceKm: 0,
        maxDistanceKm: null,
        minWeight: 0,
        maxWeight: 30,
        weightUnit: "TON",
        price: 4200,
        currency: "SAR",
        status: "ACTIVE",
        validFrom: "2026-01-01",
        validTo: null,
        reason: "تعرفة مسار عرعر - الباحة للاختبار",
      },
    });
    assert.strictEqual(tariff.status, 201, "Creating the corridor tariff must succeed: " + (tariff.body?.error || ""));

    const priced = await api("POST", `/api/trips/${unserved.body.trip.id}/price`, {
      token: admin.token,
      body: { tariffId: tariff.body.tariff.id, notes: "اعتماد السعر" },
    });
    assert.strictEqual(priced.status, 200, "Pricing a trip from the tariff book must succeed: " + (priced.body?.error || ""));
    assert.strictEqual(
      priced.body.trip.tripPrice,
      tariff.body.tariff.price,
      "The trip price must be exactly the tariff price — never a typed-in figure"
    );
    assert.strictEqual(priced.body.financial.invoiceNumber, `INV-${priced.body.trip.tripNumber.replace("EJ-", "")}`,
      "The invoice exists only once the trip has an authoritative price");

    // The main trip was priced from the rate card at creation time.
    assert(created.body.trip.tripPrice > 0, "A corridor inside the rate card is priced automatically at creation");
    assert.strictEqual(created.body.trip.priceStatus, "TARIFF");

    const settlement = await api("POST", "/api/finance/settle", { token: admin.token, body: { tripId, paidAmount: created.body.trip.tripPrice } });
    assert.strictEqual(settlement.status, 200, "Settlement must succeed after delivery: " + (settlement.body?.error || ""));
    assert.strictEqual(
      settlement.body.financial.paymentStatus,
      "PARTIALLY_PAID",
      "Paying the net freight leaves the 15% VAT outstanding, so the trip is partially paid"
    );
    assert.strictEqual(
      settlement.body.financial.balanceDue,
      settlement.body.financial.taxVat,
      "The outstanding balance must equal the VAT that has not been collected"
    );

    // A real cost line moves the margin of the same trip.
    const expense = await api("POST", `/api/finance/trips/${tripId}/expenses`, {
      token: admin.token,
      body: { category: "TOLL", amount: 150, notes: "رسوم طريق" },
    });
    assert.strictEqual(expense.status, 200, "Recording a toll must succeed: " + (expense.body?.error || ""));
    assert.strictEqual(expense.body.financial.tollFees, 150);
    assert.strictEqual(
      expense.body.financial.expenses,
      expense.body.financial.driverFee + expense.body.financial.fuelCost + 150,
      "The reported expenses total must equal the sum of its cost lines"
    );

    // ------------------------------------------------------------------
    // 7. Driver request → operations approval flow (mobile app contract)
    // ------------------------------------------------------------------
    const requestTrip = await api("POST", "/api/trips", {
      token: admin.token,
      body: {
        originCity: "جدة",
        destinationCity: "أبها",
        cargoDescription: "طلب رحلة آلي",
        cargoType: "جاف",
        cargoWeightTons: 10,
        driverId: "unassigned",
      },
    });
    const requestTripId: string = requestTrip.body.trip.id;
    await api("POST", `/api/trips/${requestTripId}/transition`, { token: admin.token, body: { targetStatus: "PENDING_APPROVAL" } });
    await api("POST", `/api/trips/${requestTripId}/transition`, { token: admin.token, body: { targetStatus: "CONFIRMED" } });

    const driverRequest = await api("POST", `/api/driver/trips/${requestTripId}/request`, {
      token: driver.token,
      body: { notes: "جاهز للتحميل" },
    });
    assert.strictEqual(driverRequest.status, 200, "DRIVER must be able to request an available trip");

    const approval = await api("POST", `/api/trips/${requestTripId}/approve-request`, { token: admin.token, body: {} });
    assert.strictEqual(approval.status, 200, "Operations must be able to approve a driver request");

    const approvedTrip = await api("GET", `/api/trips/${requestTripId}`, { token: admin.token });
    assert.strictEqual(approvedTrip.body.trip.driverRequestStatus, "APPROVED", "Approved request status must persist");

    // ------------------------------------------------------------------
    // 8. Audit trail is tamper-evident and populated for sensitive actions
    // ------------------------------------------------------------------
    const audit = await api("GET", "/api/audit", { token: admin.token });
    assert.strictEqual(audit.status, 200, "SUPER_ADMIN must be able to read the audit log");
    const actions = (audit.body.logs || []).map((l: any) => l.action);
    assert.ok(actions.includes("TRIP_CREATED"), "Trip creation must be recorded in the audit log");
    assert.ok(actions.includes("POD_RECORD_CREATED"), "POD recording must be recorded in the audit log");
    assert.ok(actions.includes("USER_LOGIN_SUCCESS"), "Authentication events must be recorded in the audit log");

    console.log("  ✓ API Authorization & Lifecycle Guard Tests Passed Successfully!");
  } finally {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    server = null;
  }
}
