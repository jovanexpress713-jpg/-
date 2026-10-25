import assert from "assert";
import { buildDefaultRegistry } from "../src/state/vehicleAssetStore";
import { getRealityAsset, clampTelemetry, loadPercent, etaLabel } from "../src/data/vehicleReality";
import type { Vehicle } from "../src/data/types";

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "ar-test",
    shipment: "S-1",
    brand: "Volvo",
    model: "FH",
    cab: "FH",
    body: "curtain",
    status: "active",
    hp: 500,
    odometer: 1000,
    year: 2025,
    plate: "TEST",
    fuel: 70,
    engineTemp: 82,
    load: 18,
    maxLoad: 30,
    speed: 70,
    etaMinutes: 135,
    milesLeft: 120,
    progress: 42,
    driver: { name: "Test Driver", phone: "", initials: "TD", rating: 5, trips: 1 },
    partner: "EJAZ",
    from: "A",
    to: "B",
    stops: [],
    route: "A-B",
    photos: [],
    comments: [],
    docs: [],
    ...overrides,
  };
}

export function runARRealityTests() {
  console.log("  [TEST] Running AR Reality Contract Tests...");
  const registry = buildDefaultRegistry();

  for (const body of ["curtain", "dry", "reefer", "flatbed"] as const) {
    const asset = getRealityAsset(vehicle({ body }), registry);
    assert.strictEqual(asset.bodyType, body);
    assert.strictEqual(asset.isOfficialModel, false, "Default registry must not claim an official 3D model");
    assert.ok(asset.imageUrl, "Every approved body type must have a reference image");
  }

  registry.types.reefer.model = { url: "/uploads/reefer.glb", format: "glb", source: "OFFICIAL_UPLOAD", scale: 1, rotationY: 0, yOffset: 0 };
  const official = getRealityAsset(vehicle({ body: "reefer", brand: "Mercedes-Benz", model: "Actros" }), registry);
  assert.strictEqual(official.isOfficialModel, true);
  assert.strictEqual(official.modelSource, "OFFICIAL_MODEL");

  assert.strictEqual(clampTelemetry(-10), 0);
  assert.strictEqual(clampTelemetry(130), 100);
  assert.strictEqual(loadPercent(vehicle({ load: 15, maxLoad: 30 })), 50);
  assert.strictEqual(loadPercent(vehicle({ load: 10, maxLoad: 0 })), 0);
  assert.strictEqual(etaLabel(135), "2س 15د");
  assert.strictEqual(etaLabel(-1), "—");

  console.log("  ✓ AR Reality Contract Tests Passed Successfully!");
}
