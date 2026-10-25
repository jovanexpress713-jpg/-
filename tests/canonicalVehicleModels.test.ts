import { getCanonicalVehicleModel } from "../src/data/canonicalVehicleModels";
import type { CanonicalVehicleTypeId } from "../src/data/vehicleTypes";

const expected: Record<CanonicalVehicleTypeId, string> = {
  curtain: "/images/trucks/official/official-curtain.png",
  dry: "/images/trucks/official/official-dry.png",
  reefer: "/images/trucks/official/official-reefer.png",
  flatbed: "/images/trucks/official/official-flatbed.png",
};

export function runCanonicalVehicleModelTests() {
  const types = Object.keys(expected) as CanonicalVehicleTypeId[];
  if (types.length !== 4) throw new Error("EJAZ must expose exactly four canonical vehicle types");

  types.forEach((type) => {
    const model = getCanonicalVehicleModel(type);
    if (model.url !== expected[type]) throw new Error(`${type}: unexpected canonical reference image URL`);
    if (model.format !== "image") throw new Error(`${type}: canonical asset must be an image until a licensed 3D model is registered`);
    if (model.source !== "OFFICIAL_REFERENCE_PHOTO") throw new Error(`${type}: canonical image provenance was changed`);
    if (!model.url.startsWith("/images/trucks/official/")) throw new Error(`${type}: reference image escaped the official truck asset namespace`);
    if (!model.labelAr.includes("صورة مرجعية")) throw new Error(`${type}: reference image must be clearly labeled`);
  });

  const fallback = getCanonicalVehicleModel("curtain");
  if (fallback.labelAr.includes("Volvo") || fallback.labelAr.includes("Mercedes")) {
    throw new Error("canonical reference must not claim manufacturer ownership");
  }

  console.log("  ✓ canonical vehicle reference-image mapping + provenance");
}
