import fs from "fs";
import path from "path";
import { getCanonicalVehicleModel } from "../src/data/canonicalVehicleModels";
import type { CanonicalVehicleTypeId } from "../src/data/vehicleTypes";

/**
 * Canonical vehicle descriptors — current contract.
 *
 * The console no longer ships procedural OBJ geometry: after the
 * "Remove procedural truck geometry; require real photo or licensed model"
 * change, the canonical descriptor for each body type is the *official
 * reference photo* published through the fleet asset registry, and any 3D
 * model must be a licensed GLB/GLTF registered per vehicle. This test pins the
 * descriptor contract (photo namespace, provenance, branding) and proves the
 * referenced files actually exist in `public/`.
 */
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
    if (model.type !== type) throw new Error(`${type}: descriptor must describe its own type`);
    if (model.url !== expected[type]) throw new Error(`${type}: unexpected canonical asset URL`);
    if (model.format !== "image") throw new Error(`${type}: canonical descriptor must be an image, not ${model.format}`);
    if (model.source !== "OFFICIAL_REFERENCE_PHOTO") {
      throw new Error(`${type}: canonical provenance must be the official reference photo`);
    }
    if (!model.url.startsWith("/images/trucks/official/")) {
      throw new Error(`${type}: asset escaped the official fleet-photo namespace`);
    }
    if (/\.obj$/i.test(model.url)) {
      throw new Error(`${type}: procedural OBJ geometry is not an acceptable canonical asset`);
    }

    const onDisk = path.join(process.cwd(), "public", model.url.replace(/^\//, ""));
    if (!fs.existsSync(onDisk)) throw new Error(`${type}: canonical asset is missing from public/ (${model.url})`);
    if (fs.statSync(onDisk).size < 1_000) throw new Error(`${type}: canonical asset looks truncated`);

    if (!model.labelAr.trim() || !model.labelEn.trim()) throw new Error(`${type}: descriptor needs both labels`);
    if (!model.labelAr.includes("صورة مرجعية")) {
      throw new Error(`${type}: Arabic label must state it is a reference photo, not a 3D model`);
    }
    if (/Volvo|Mercedes|MAN\b|Scania/i.test(`${model.labelAr} ${model.labelEn}`)) {
      throw new Error(`${type}: canonical descriptor must not claim manufacturer ownership`);
    }
  });

  const fallback = getCanonicalVehicleModel("curtain");
  if (fallback.type !== "curtain") throw new Error("unknown type must fall back to the curtain descriptor");

  console.log("  ✓ canonical vehicle descriptor mapping + provenance + on-disk assets");
}
