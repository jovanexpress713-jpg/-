import assert from "node:assert/strict";
import { VEHICLE_MODEL_SLOTS, readyVehicleModelSlots, getVehicleModelSlot } from "../src/data/vehicleModelCatalog";

export function runVehicleModelCatalogTests() {
  assert.equal(VEHICLE_MODEL_SLOTS.length, 8);
  assert.equal(new Set(VEHICLE_MODEL_SLOTS.map((slot) => slot.id)).size, 8);
  assert.equal(readyVehicleModelSlots().length, 0);
  assert.equal(getVehicleModelSlot("ejaz-truck-08")?.bodyType, "flatbed");
  assert.ok(VEHICLE_MODEL_SLOTS.every((slot) => slot.assetUrl === null && slot.status === "AWAITING_ASSET"));
}
