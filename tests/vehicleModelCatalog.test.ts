import assert from "node:assert/strict";
import { VEHICLE_MODEL_SLOTS, readyVehicleModelSlots, getVehicleModelSlot, getVehicleModelSlotForComposition } from "../src/data/vehicleModelCatalog";

export function runVehicleModelCatalogTests() {
  assert.equal(VEHICLE_MODEL_SLOTS.length, 8);
  assert.equal(new Set(VEHICLE_MODEL_SLOTS.map((slot) => slot.id)).size, 8);
  assert.equal(readyVehicleModelSlots().length, 0);
  assert.equal(getVehicleModelSlot("ejaz-truck-08")?.bodyType, "flatbed");
  assert.equal(getVehicleModelSlot("ejaz-mercedes-curtain")?.tractor, "mercedes");
  assert.equal(getVehicleModelSlot("ejaz-volvo-reefer")?.trailer, "reefer");
  assert.equal(getVehicleModelSlotForComposition("volvo", "flatbed")?.id, "ejaz-volvo-flatbed");
  assert.equal(getVehicleModelSlotForComposition("mercedes", "dry")?.id, "ejaz-mercedes-dry");
  assert.ok(VEHICLE_MODEL_SLOTS.every((slot) => slot.assetUrl === null && slot.status === "AWAITING_ASSET"));
}
