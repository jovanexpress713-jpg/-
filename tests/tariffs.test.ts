import assert from "assert";
import http from "http";
import type { AddressInfo } from "net";
import { createServerApp } from "../src/server/app";

/**
 * EJAZ Transport — Phase 1: Tariff & Pricing Engine test suite.
 * Boots the real Express application and exercises the full pricing flow:
 * create / edit / stop / reactivate / history / conflict prevention /
 * dynamic quote resolution / no-invented-price guarantee / quote requests.
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

export async function runTariffTests() {
  console.log("  [TEST] Running Phase 1 Tariff & Pricing Engine Tests...");
  baseUrl = await startServer();

  const admin = await login("admin@ejaz.sa", "Ejaz@2026Admin");
  const client = await login("client@ejaz.sa", "Ejaz@2026Client");
  const driver = await login("driver@ejaz.sa", "Ejaz@2026Driver");
  assert(admin, "admin session required");
  assert(client, "client session required");
  assert(driver, "driver session required");

  const specTariff = {
    truckType: "ستارة",
    originCity: "جدة",
    destinationCity: "الرياض",
    minDistanceKm: 900,
    maxDistanceKm: 1000,
    weightUnit: "TON",
    currency: "SAR",
    status: "ACTIVE",
    validFrom: "2026-01-01",
    validTo: null,
  };

  // ── 1. Add tariffs (the company enters prices manually) ─────────────────
  const t1 = await api("POST", "/api/tariffs", {
    token: admin,
    body: { ...specTariff, minWeight: 0, maxWeight: 5, price: 5000 },
  });
  assert.strictEqual(t1.status, 201, `create 0-5t tariff: ${JSON.stringify(t1.body)}`);
  const tariffA = t1.body.tariff;

  const t2 = await api("POST", "/api/tariffs", {
    token: admin,
    body: { ...specTariff, minWeight: 5, maxWeight: 10, price: 5500 },
  });
  assert.strictEqual(t2.status, 201, "create 5-10t tariff");
  const tariffB = t2.body.tariff;

  const t3 = await api("POST", "/api/tariffs", {
    token: admin,
    body: { ...specTariff, truckType: "براد", minWeight: 0, maxWeight: 5, price: 6000 },
  });
  assert.strictEqual(t3.status, 201, "create reefer tariff");

  // ── 2. Conflict prevention (same type+route+distance+weight+window) ─────
  const conflict = await api("POST", "/api/tariffs", {
    token: admin,
    body: { ...specTariff, minWeight: 3, maxWeight: 8, price: 5200 },
  });
  assert.strictEqual(conflict.status, 409, "overlapping tariff must be rejected");
  assert.strictEqual(conflict.body.code, "TARIFF_CONFLICT");
  assert(String(conflict.body.error).length > 10, "conflict message must explain the reason");

  // Unapproved fifth truck type must be rejected outright
  const badType = await api("POST", "/api/tariffs", {
    token: admin,
    body: { ...specTariff, truckType: "قلاب", price: 4000 },
  });
  assert.strictEqual(badType.status, 400, "fifth truck type must be rejected");

  // ── 3. Persistence & retrieval ───────────────────────────────────────────
  const list = await api("GET", "/api/tariffs", { token: admin });
  assert.strictEqual(list.status, 200);
  assert(list.body.total >= 3, "tariffs persisted in the database");

  const single = await api("GET", `/api/tariffs/${tariffA.id}`, { token: admin });
  assert.strictEqual(single.status, 200);
  assert.strictEqual(single.body.tariff.price, 5000);

  // ── 4. Distance engine: Jeddah→Riyadh resolves inside the 900–1000 band ─
  const quote8 = await api("GET", "/api/tariffs/quote?truckType=ستارة&origin=جدة&destination=الرياض&weightTons=8", { token: client });
  assert.strictEqual(quote8.status, 200);
  assert.strictEqual(quote8.body.distanceResolvable, true, "system distance must resolve");
  assert(quote8.body.distanceKm >= 900 && quote8.body.distanceKm <= 1000, `distance ${quote8.body.distanceKm} must fall inside the band`);

  // ── 5. Dynamic price: weight 8t → 5500; weight 3t → 5000; reefer → 6000 ─
  assert.strictEqual(quote8.body.available, true, "quote must match a tariff");
  assert.strictEqual(quote8.body.price, 5500, "8t curtain Jeddah→Riyadh must price 5500");
  assert.strictEqual(quote8.body.tariff.id, tariffB.id);

  const quote3 = await api("GET", "/api/tariffs/quote?truckType=ستارة&origin=جدة&destination=الرياض&weightTons=3", { token: client });
  assert.strictEqual(quote3.body.price, 5000, "3t curtain must price 5000 (price changes with weight)");

  const quoteReefer = await api("GET", "/api/tariffs/quote?truckType=براد&origin=جدة&destination=الرياض&weightTons=3", { token: client });
  assert.strictEqual(quoteReefer.body.price, 6000, "reefer must price 6000 (price changes with truck type)");

  // Route outside the company's rate card → honest "no price"
  const quoteNo = await api("GET", "/api/tariffs/quote?truckType=ستارة&origin=سكاكا&destination=نجران&weightTons=8", { token: client });
  assert.strictEqual(quoteNo.body.available, false, "no invented price when no tariff matches");
  assert(quoteNo.body.price === undefined, "price must not exist without a tariff");

  // A corridor inside the shipped rate card resolves without any manual entry.
  const quoteSeeded = await api("GET", "/api/tariffs/quote?truckType=براد&origin=الرياض&destination=جدة&weightTons=18", { token: client });
  assert.strictEqual(quoteSeeded.body.available, true, "the official rate card must price the main corridors");
  assert(quoteSeeded.body.price > 0, "a rate-card corridor must resolve a real positive price");

  // Unknown city → not resolvable, still no invented price
  const quoteBad = await api("GET", "/api/tariffs/quote?truckType=ستارة&origin=أطلانطس&destination=الرياض&weightTons=8", { token: client });
  assert.strictEqual(quoteBad.body.distanceResolvable, false);
  assert.strictEqual(quoteBad.body.available, false);

  // ── 6. Quote request when no tariff matches (client → control room) ──────
  const qr = await api("POST", "/api/tariffs/quote-requests", {
    token: client,
    body: { truckType: "ستارة", originCity: "سكاكا", destinationCity: "نجران", weightTons: 8 },
  });
  assert.strictEqual(qr.status, 201, "quote request must be accepted");
  const qrList = await api("GET", "/api/tariffs/quote-requests?status=OPEN", { token: admin });
  assert(qrList.body.quoteRequests.some((r: any) => r.id === qr.body.quoteRequest.id), "quote request visible in control room");

  // ── 7. Edit tariff → history records who/when/old/new/reason ─────────────
  const upd = await api("PUT", `/api/tariffs/${tariffB.id}`, {
    token: admin,
    body: { price: 5700, reason: "تحديث موسمي لتكلفة الوقود" },
  });
  assert.strictEqual(upd.status, 200);
  assert.strictEqual(upd.body.tariff.price, 5700);

  const hist = await api("GET", `/api/tariffs/${tariffB.id}`, { token: admin });
  const updRec = hist.body.history.find((h: any) => h.action === "UPDATED");
  assert(updRec, "update must be recorded in history");
  assert.strictEqual(updRec.oldPrice, 5500, "history keeps the old price");
  assert.strictEqual(updRec.newPrice, 5700, "history keeps the new price");
  assert(updRec.userName, "history records the user");
  assert(updRec.timestamp, "history records the date/time");
  assert.strictEqual(updRec.reason, "تحديث موسمي لتكلفة الوقود");

  // The new price is what resolves now
  const quoteAfter = await api("GET", "/api/tariffs/quote?truckType=ستارة&origin=جدة&destination=الرياض&weightTons=8", { token: client });
  assert.strictEqual(quoteAfter.body.price, 5700, "edited price must resolve dynamically");

  // ── 8. Stop tariff → excluded from matching; reactivate → back ───────────
  const deact = await api("POST", `/api/tariffs/${tariffB.id}/deactivate`, { token: admin });
  assert.strictEqual(deact.status, 200);
  const quoteDeact = await api("GET", "/api/tariffs/quote?truckType=ستارة&origin=جدة&destination=الرياض&weightTons=8", { token: client });
  assert.strictEqual(quoteDeact.body.available, false, "stopped tariff must not price trips");

  const react = await api("POST", `/api/tariffs/${tariffB.id}/activate`, { token: admin });
  assert.strictEqual(react.status, 200);
  const quoteReact = await api("GET", "/api/tariffs/quote?truckType=ستارة&origin=جدة&destination=الرياض&weightTons=8", { token: client });
  assert.strictEqual(quoteReact.body.available, true, "reactivated tariff must price trips again");

  // ── 9. Trip creation: price comes from the tariff book, never hardcoded ──
  const trip = await api("POST", "/api/trips", {
    token: client,
    body: {
      originCity: "جدة",
      destinationCity: "الرياض",
      cargoDescription: "بضائع عامة معبأة",
      cargoType: "ستارة",
      cargoWeightTons: 8,
      customerId: "cust-1",
    },
  });
  assert.strictEqual(trip.status, 201, `trip creation: ${JSON.stringify(trip.body)}`);
  assert.strictEqual(trip.body.trip.tripPrice, 5700, "trip price must equal the matched tariff price");
  assert.strictEqual(trip.body.trip.priceStatus, "TARIFF");
  assert.strictEqual(trip.body.trip.tariffId, tariffB.id, "trip must link to its tariff");
  assert(trip.body.trip.distanceKm >= 900 && trip.body.trip.distanceKm <= 1000, "trip stores system distance");

  // A trip on an unpriced route is created with ZERO price + PENDING_QUOTE — never invented
  const tripNo = await api("POST", "/api/trips", {
    token: client,
    body: {
      originCity: "سكاكا",
      destinationCity: "نجران",
      cargoDescription: "شحنة تجريبية بدون تعرفة",
      cargoType: "جاف",
      cargoWeightTons: 12,
      customerId: "cust-1",
    },
  });
  assert.strictEqual(tripNo.status, 201);
  assert.strictEqual(tripNo.body.trip.tripPrice, 0, "no tariff ⇒ no invented price");
  assert.strictEqual(tripNo.body.trip.priceStatus, "PENDING_QUOTE");

  // ── 10. RBAC: pricing is company-managed ─────────────────────────────────
  const forbiddenC = await api("POST", "/api/tariffs", { token: client, body: { ...specTariff, price: 1 } });
  assert.strictEqual(forbiddenC.status, 403, "clients cannot manage tariffs");
  const forbiddenD = await api("POST", "/api/tariffs", { token: driver, body: { ...specTariff, price: 1 } });
  assert.strictEqual(forbiddenD.status, 403, "drivers cannot manage tariffs");
  const anon = await api("GET", "/api/tariffs");
  assert.strictEqual(anon.status, 401, "anonymous cannot read tariffs");
  // Clients CAN resolve a quote (needed while building a shipment request)
  const clientQuote = await api("GET", "/api/tariffs/quote?truckType=ستارة&origin=جدة&destination=الرياض&weightTons=3", { token: client });
  assert.strictEqual(clientQuote.status, 200, "clients may resolve quotes");

  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
  console.log("  ✓ Phase 1 Tariff & Pricing Engine Tests Passed Successfully!");
}
