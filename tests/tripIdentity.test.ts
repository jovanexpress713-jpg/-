import assert from "assert";
import http from "http";
import type { AddressInfo } from "net";
import { createServerApp } from "../src/server/app";

/**
 * EJAZ Transport — Phase 3: Unified, immutable trip number.
 * The number is the trip's primary identity: it must survive driver swaps,
 * vehicle swaps, combined swaps, breakdowns, cancellation and reopening —
 * all recorded inside the SAME trip file with full assignment history.
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

export async function runTripIdentityTests() {
  console.log("  [TEST] Running Phase 3 Unified Trip Number Tests...");
  baseUrl = await startServer();

  const admin = await login("admin@ejaz.sa", "Ejaz@2026Admin");
  assert(admin, "admin session required");

  // Create the subject trip
  const created = await api("POST", "/api/trips", {
    token: admin,
    body: {
      originCity: "جدة", destinationCity: "الرياض",
      cargoDescription: "شحنة اختبار ثبات الرقم الموحد",
      cargoType: "ستارة", cargoWeightTons: 9,
      customerId: "cust-1", driverId: "d1", vehicleId: "v1",
    },
  });
  assert.strictEqual(created.status, 201);
  const tripId = created.body.trip.id;
  const NUMBER = created.body.trip.tripNumber;
  assert(/^EJ-\d{4}-\d{6}$/.test(NUMBER), `unified number format: ${NUMBER}`);

  const current = async () => (await api("GET", `/api/trips/${tripId}`, { token: admin })).body;

  // ── 1. Driver replacement keeps the number ───────────────────────────────
  const rd = await api("POST", `/api/trips/${tripId}/replace-driver`, {
    token: admin,
    body: { newDriverId: "d2", reason: "ساعات الراحة النظامية للسائق الأساسي" },
  });
  assert.strictEqual(rd.status, 200);
  let file = await current();
  assert.strictEqual(file.trip.tripNumber, NUMBER, "number unchanged after driver swap");
  assert.strictEqual(file.trip.driverId, "d2");
  assert.strictEqual(file.trip.driverHistory.length, 1, "driver history preserved");
  assert.strictEqual(file.trip.driverHistory[0].driverName, rd.body.trip.driverHistory[0].driverName);
  assert(file.trip.driverHistory[0].timestamp, "history records when");
  assert(file.trip.driverHistory[0].reason.includes("ساعات الراحة"), "history records why");

  // ── 2. Vehicle replacement keeps the number (breakdown scenario) ─────────
  const rv = await api("POST", `/api/trips/${tripId}/replace-vehicle`, {
    token: admin,
    body: { newVehicleId: "v3", reason: "عطل ميكانيكي في الطريق السريع" },
  });
  assert.strictEqual(rv.status, 200);
  file = await current();
  assert.strictEqual(file.trip.tripNumber, NUMBER, "number unchanged after vehicle swap");
  assert.strictEqual(file.trip.vehicleId, "v3");
  assert.strictEqual(file.trip.vehicleHistory.length, 1, "vehicle history preserved");
  assert(file.trip.vehicleHistory[0].plate, "history records the previous plate");
  assert.strictEqual(file.trip.vehicleHistory[0].replacedBy, rv.body.vehicleHistory[0].replacedBy);

  // ── 3. Combined driver + vehicle replacement keeps the number ────────────
  const rb = await api("POST", `/api/trips/${tripId}/replace-assignment`, {
    token: admin,
    body: { newDriverId: "d3", newVehicleId: "v4", reason: "حالة طارئة — استبدال مزدوج" },
  });
  assert.strictEqual(rb.status, 200, `combined replace: ${JSON.stringify(rb.body)}`);
  file = await current();
  assert.strictEqual(file.trip.tripNumber, NUMBER, "number unchanged after combined swap");
  assert.strictEqual(file.trip.driverId, "d3");
  assert.strictEqual(file.trip.vehicleId, "v4");
  assert.strictEqual(file.trip.driverHistory.length, 2, "driver history appends, never overwrites");
  assert.strictEqual(file.trip.vehicleHistory.length, 2, "vehicle history appends, never overwrites");

  // ── 4. Cancellation & reopening keep the number ──────────────────────────
  const cancel = await api("POST", `/api/trips/${tripId}/cancel`, {
    token: admin,
    body: { reason: "إلغاء لظروف تشغيلية طارئة" },
  });
  assert.strictEqual(cancel.status, 200);
  file = await current();
  assert.strictEqual(file.trip.tripNumber, NUMBER, "number unchanged after cancellation");
  assert.strictEqual(file.trip.status, "CANCELLED");

  const reopen = await api("POST", `/api/trips/${tripId}/reopen`, {
    token: admin,
    body: { reason: "إعادة فتح الرحلة بعد زوال الظرف الطارئ" },
  });
  assert.strictEqual(reopen.status, 200);
  file = await current();
  assert.strictEqual(file.trip.tripNumber, NUMBER, "number unchanged after reopening");
  assert.strictEqual(file.trip.status, "REOPENED");

  // ── 5. The timeline keeps every event — nothing is ever deleted ──────────
  const events = file.events.map((e: any) => e.eventType);
  for (const expected of [
    "TRIP_CREATED",
    "DRIVER_REPLACED",
    "VEHICLE_REPLACED",
    "DRIVER_AND_VEHICLE_REPLACED",
    "TRIP_CANCELLED",
    "TRIP_REOPENED",
  ]) {
    assert(events.includes(expected), `timeline must include ${expected}`);
  }
  assert(file.events.length >= 6, "timeline holds the full history");
  const times = file.events.map((e: any) => new Date(e.timestamp).getTime());
  assert(times.every((t: number, i: number) => i === 0 || t >= times[i - 1]), "timeline is chronological");

  // ── 6. The trip file assembles everything under one number ───────────────
  assert.strictEqual(file.financials.tripNumber, NUMBER, "financials bound to the same number");
  assert(Array.isArray(file.pod), "trip file exposes POD records");
  assert(Array.isArray(file.claims), "trip file exposes claims");
  assert(Array.isArray(file.documents), "trip file exposes documents");
  assert(file.statusMeta && file.statusMeta.ar, "trip file carries the status meta");

  // Assignment history answers who/when/why for both dimensions
  const lastDriverSwap = file.trip.driverHistory[1];
  assert.strictEqual(lastDriverSwap.driverId, "d2", "history knows the previous driver");
  assert.strictEqual(lastDriverSwap.newDriverName, "ماجد البلوي", "history knows the new driver");
  assert.strictEqual(lastDriverSwap.replacedBy, "فهد بن عبد العزيز السبيعي", "history records the acting user");
  assert(lastDriverSwap.timestamp && lastDriverSwap.reason, "history records when and why");
  const lastVehicleSwap = file.trip.vehicleHistory[1];
  assert(lastVehicleSwap.plate && lastVehicleSwap.newPlate === "ج ا ف ٧٧١٤", "previous & replacement plates recorded");

  // ── 7. Drivers cannot be swapped by unauthorized roles ───────────────────
  const driver = await login("driver@ejaz.sa", "Ejaz@2026Driver");
  const forbidden = await api("POST", `/api/trips/${tripId}/replace-assignment`, {
    token: driver,
    body: { newDriverId: "d1", newVehicleId: "v1", reason: "محاولة غير مخولة" },
  });
  assert.strictEqual(forbidden.status, 403, "drivers cannot replace assignments");
  file = await current();
  assert.strictEqual(file.trip.tripNumber, NUMBER, "number still intact");

  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
  console.log("  ✓ Phase 3 Unified Trip Number Tests Passed Successfully!");
}
