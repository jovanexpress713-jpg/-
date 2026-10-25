import { getCanonicalVehicleModel } from "../src/data/canonicalVehicleModels";
import type { CanonicalVehicleTypeId } from "../src/data/vehicleTypes";

const expected: Record<CanonicalVehicleTypeId, string> = {
  curtain: "/models/ejaz/ejaz-curtain-canonical.obj",
  dry: "/models/ejaz/ejaz-dry-canonical.obj",
  reefer: "/models/ejaz/ejaz-reefer-canonical.obj",
  flatbed: "/models/ejaz/ejaz-flatbed-canonical.obj",
};

export function runCanonicalVehicleModelTests() {
  const types = Object.keys(expected) as CanonicalVehicleTypeId[];
  if (types.length !== 4) throw new Error("EJAZ must expose exactly four canonical vehicle types");

  types.forEach((type) => {
    const model = getCanonicalVehicleModel(type);
    if (model.url !== expected[type]) throw new Error(`${type}: unexpected canonical model URL`);
    if (model.format !== "obj") throw new Error(`${type}: canonical model must remain OBJ`);
    if (model.source !== "EJAZ_CANONICAL") throw new Error(`${type}: canonical provenance was changed`);
    if (!model.url.startsWith("/models/ejaz/")) throw new Error(`${type}: model escaped the EJAZ asset namespace`);
  });

  const fallback = getCanonicalVehicleModel("curtain");
  if (!fallback.labelAr.includes("EJAZ")) throw new Error("canonical model must be explicitly branded as EJAZ-owned");
  if (fallback.labelAr.includes("Volvo") || fallback.labelAr.includes("Mercedes")) {
    throw new Error("canonical model must not claim manufacturer ownership");
  }

  console.log("  ✓ canonical vehicle model mapping + provenance");
}
