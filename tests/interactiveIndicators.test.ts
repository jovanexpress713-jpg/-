import assert from "node:assert/strict";
import type { Vehicle } from "../src/data/types";
import { buildFleetIndicatorSnapshot } from "../src/data/interactiveIndicators";

const vehicle: Vehicle = {
  id: "indicator-1",
  shipment: "SHP-1",
  brand: "Mercedes-Benz",
  model: "Actros",
  cab: "4x2",
  body: "curtain",
  status: "active",
  hp: 450,
  odometer: 120000,
  year: 2024,
  plate: "TEST-1",
  fuel: 74.6,
  engineTemp: 92.4,
  load: 7.5,
  maxLoad: 10,
  speed: 81.4,
  etaMinutes: 142,
  milesLeft: 88.8,
  progress: 64.2,
  driver: { name: "Test Driver", phone: "000", initials: "TD", rating: 5, trips: 10 },
  partner: "EJAZ",
  from: "A",
  to: "B",
  stops: [],
  route: "A-B",
  photos: [],
  comments: [],
  docs: [],
};

export function runInteractiveIndicatorTests() {
  const snapshot = buildFleetIndicatorSnapshot(vehicle);
  assert.equal(snapshot.vehicleId, "indicator-1");
  assert.equal(snapshot.indicators.length, 6);
  assert.equal(snapshot.indicators.find((item) => item.key === "speed")?.value, "81 km/h");
  assert.equal(snapshot.indicators.find((item) => item.key === "fuel")?.value, "75%");
  assert.equal(snapshot.indicators.find((item) => item.key === "load")?.value, "75%");
  assert.equal(snapshot.indicators.find((item) => item.key === "eta")?.value, "2س 22د");
  assert.equal(snapshot.attentionCount, 0);
  assert.equal(Math.round(snapshot.utilizationPercent), 75);

  const warning = buildFleetIndicatorSnapshot({ ...vehicle, fuel: 12, engineTemp: 111, status: "inactive" });
  assert.equal(warning.attentionCount, 1);
  assert.equal(warning.indicators.find((item) => item.key === "fuel")?.tone, "warning");
  assert.equal(warning.indicators.find((item) => item.key === "engine")?.tone, "warning");
}
