import assert from "assert";
import fs from "fs";
import path from "path";
import { FLEET } from "../src/data/fleet";
import { imageFor } from "../src/data/catalog";
import {
  APPROVED_VEHICLE_TYPES,
  DEFAULT_VEHICLE_IMAGES,
  getVehicleOfficialImage,
  resolveVehicleImage,
} from "../src/data/vehicleTypes";
import { DEFAULT_TYPE_IMAGES } from "../src/server/services/vehicleAssetRegistry";

/**
 * EJAZ Transport — Fleet Imagery Single Source of Truth tests.
 *
 * Guards the correction of a reported defect: the fleet registers and vehicle
 * cards displayed legacy per-brand studio renders (Scania/Volvo/Mercedes stock
 * photos) instead of the four official photographs of the actual EJAZ fleet.
 *
 * The rule enforced here: every vehicle resolves to the official photograph of
 * its approved category — one category, one photograph, in the app and in the
 * console alike — unless the vehicle carries an explicit custom photo uploaded
 * by an operator.
 */

const root = process.cwd();

const LEGACY_TRUCK_IMAGE = /\b(mb-curtain|mb-reefer|volvo-tanker|volvo-container|scania-flatbed|scania-tipper)\.jpg/;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

export function runFleetImageryTests() {
  console.log("  [TEST] Running Fleet Imagery Single Source of Truth Tests...");

  /* 1. Every approved category resolves to its official photograph. */
  const expected: Record<string, string> = {
    flatbed: "/images/trucks/official/official-flatbed.png",
    reefer: "/images/trucks/official/official-reefer.png",
    dry: "/images/trucks/official/official-dry.png",
    curtain: "/images/trucks/official/official-curtain.png",
  };
  for (const [type, file] of Object.entries(expected)) {
    assert.strictEqual(getVehicleOfficialImage(type), file, `${type} must use its official photograph`);
    assert.strictEqual(APPROVED_VEHICLE_TYPES[type as keyof typeof APPROVED_VEHICLE_TYPES].officialImage, file);
    assert.strictEqual(DEFAULT_VEHICLE_IMAGES[type as keyof typeof DEFAULT_VEHICLE_IMAGES].image, file);
    assert.strictEqual(DEFAULT_TYPE_IMAGES[type as keyof typeof DEFAULT_TYPE_IMAGES], file);
  }

  /* 2. The legacy brand-based resolver no longer returns stock renders. */
  for (const vehicle of FLEET) {
    const resolved = imageFor(vehicle.brand, vehicle.body);
    assert.strictEqual(
      resolved,
      expected[vehicle.body as string] ?? expected.curtain,
      `${vehicle.plate} (${vehicle.body}) resolved to ${resolved}`
    );
    assert.ok(!LEGACY_TRUCK_IMAGE.test(resolved), `${vehicle.plate} still resolves a legacy truck render`);
  }

  /* 3. A custom photo uploaded by the operator still wins over the category asset. */
  assert.strictEqual(
    resolveVehicleImage({ body: "flatbed", customImage: "/uploads/vehicle-assets/custom.png" }),
    "/uploads/vehicle-assets/custom.png",
    "an explicit custom vehicle photo must override the official category photograph"
  );
  assert.strictEqual(resolveVehicleImage({ body: "flatbed" }), expected.flatbed);

  /* 4. The mobile login screen shows an official EJAZ photograph, never the
        retired stock truck backdrop that came with the original project. */
  const loginScreen = fs.readFileSync(path.join(root, "src", "mobile", "LoginScreen.tsx"), "utf8");
  const catalogSource = fs.readFileSync(path.join(root, "src", "data", "catalog.ts"), "utf8");
  assert.match(
    catalogSource,
    /export const LOGIN_BACKDROP = "\/images\/trucks\/official\/official-\w+-login\.(png|webp)"/,
    "the login backdrop must be a crop of an official photograph"
  );
  assert.match(loginScreen, /src=\{LOGIN_BACKDROP\}/, "the login screen must render the official backdrop");
  assert.ok(!loginScreen.includes("actros_login_bg"), "the retired stock truck backdrop must not be referenced");
  const backdrop = path.join(root, "public", "images", "trucks", "official", "official-flatbed-login.png");
  assert.ok(fs.existsSync(backdrop), "the published login backdrop crop must exist");
  // A pure crop of the official asset: pixels are 1:1, derived from the 1536x1024 original.
  const png = fs.readFileSync(backdrop);
  assert.strictEqual(png.readUInt32BE(16), 512, "login backdrop width must be a 1:1 crop");
  assert.strictEqual(png.readUInt32BE(20), 1024, "login backdrop height must be a 1:1 crop");

  /* 5. The control panel exposes a per-vehicle photograph uploader that applies
        the new photograph immediately, on the fleet card and in the 3D viewport. */
  const fleetManager = fs.readFileSync(path.join(root, "src", "components", "FleetManager.tsx"), "utf8");
  const assetsManager = fs.readFileSync(path.join(root, "src", "components", "VehicleAssetsManager.tsx"), "utf8");
  const viewer = fs.readFileSync(path.join(root, "src", "components", "Vehicle3DViewer.tsx"), "utf8");

  assert.match(fleetManager, /تغيير الصورة/, "every vehicle card must offer a photo upload control");
  assert.match(
    fleetManager,
    /apiClient\.vehicleAssets\.publishVehicleImage\(/,
    "the card control must publish through the central asset registry"
  );
  assert.match(fleetManager, /await refreshVehicleAssets\(\)/, "the console must refresh instantly after publishing");
  assert.match(fleetManager, /cardDropProps/, "a photograph must be droppable straight onto a vehicle card");
  assert.match(
    fleetManager,
    /<Vehicle3DViewer[\s\S]{0,320}?vehicle=\{v as any\}/,
    "the 3D viewport must follow the vehicle's own photograph"
  );

  assert.ok(!/\.slice\(0,\s*8\)/.test(assetsManager), "the assets screen must list every truck, not the first eight");
  assert.match(assetsManager, /filteredVehicles/, "the assets screen must let the operator find any truck");
  assert.match(assetsManager, /ابحث باللوحة أو الموديل أو النوع/, "the assets screen must offer a search field");
  assert.match(assetsManager, /handleImagePicked\(file, target\)/, "a drop must target the exact vehicle it landed on");

  assert.match(viewer, /vehicle\?:\s*\{/, "the 3D viewer must accept the bound vehicle");
  assert.match(viewer, /const vehiclePhotoSrc = vehicle \? vehicleImage\(vehicle\)/, "the viewer must resolve the vehicle photograph");

  /* 6. No module may reference the retired stock renders as vehicle imagery. */
  const offenders: string[] = [];
  for (const file of sourceFiles(path.join(process.cwd(), "src"))) {
    const content = fs.readFileSync(file, "utf8");
    content.split("\n").forEach((line, i) => {
      if (LEGACY_TRUCK_IMAGE.test(line) && !/^\s*(\*|\/\/|\/\*)/.test(line.trim())) {
        offenders.push(`${path.relative(process.cwd(), file)}:${i + 1}`);
      }
    });
  }
  assert.deepStrictEqual(offenders, [], `legacy truck renders are still referenced at: ${offenders.join(", ")}`);

  console.log("  ✓ Fleet Imagery Single Source of Truth Tests Passed Successfully!");
}
