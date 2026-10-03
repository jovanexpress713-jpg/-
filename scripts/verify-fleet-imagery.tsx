/**
 * Verification harness for the fleet imagery single-source-of-truth fix.
 *
 * Renders the real Owner Portal (fleet register), the live fleet strip and a
 * shipment card to static HTML with react-dom/server and reports the exact
 * <img src> each vehicle resolves to — proving that the four official
 * photographs replaced the legacy per-brand stock images.
 */

// Minimal browser globals the stores expect before any module is evaluated.
(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
(globalThis as any).window = globalThis;
(globalThis as any).document = { cookie: "" };

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsProvider } from "../src/settings";
import { FleetStoreProvider } from "../src/state/fleetStore";
import { OwnerPortal } from "../src/components/OwnerPortal";
import { FleetStrip } from "../src/components/views";
import { LoginScreen } from "../src/mobile/LoginScreen";
import { VehicleAssetsManager } from "../src/components/VehicleAssetsManager";
import { ToastProvider } from "../src/components/Toast";
import { FLEET } from "../src/data/fleet";
import { imageFor } from "../src/data/catalog";
import { resolveVehicleImage } from "../src/data/vehicleTypes";

const wrap = (node: React.ReactElement) =>
  renderToStaticMarkup(
    <SettingsProvider>
      <FleetStoreProvider>{node}</FleetStoreProvider>
    </SettingsProvider>
  );

const imgs = (html: string) =>
  [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);

console.log("=== owner portal: fleet register images ===");
const portalImgs = imgs(wrap(<OwnerPortal />)).filter((s) => /trucks/.test(s));
console.log("count:", portalImgs.length);
console.log("unique:", [...new Set(portalImgs)].sort().join("\n        "));

console.log("\n=== live fleet strip images ===");
const stripImgs = imgs(wrap(<FleetStrip vehicles={FLEET.slice(0, 4)} onSelect={() => {}} />)).filter((s) => /trucks/.test(s));
console.log(stripImgs.join("\n"));

console.log("\n=== mobile app login backdrop ===");
const loginImgs = imgs(wrap(<LoginScreen onLoginSuccess={() => {}} />)).filter((s) => /images/.test(s));
console.log(loginImgs.join("\n"));

console.log("\n=== dashboard photo control (vehicle assets screen) ===");
const managerHtml = renderToStaticMarkup(
  <SettingsProvider>
    <FleetStoreProvider>
      <ToastProvider>
        <VehicleAssetsManager />
      </ToastProvider>
    </FleetStoreProvider>
  </SettingsProvider>
);
const uploadButtons = (managerHtml.match(/>(رفع|تبديل)</g) || []).length;
const photoRows = (managerHtml.match(/title="نشر صورة لهذه المركبة"/g) || []).length;
const searchBoxes = (managerHtml.match(/ابحث باللوحة أو الموديل أو النوع/g) || []).length;
console.log("vehicle rows with an upload control :", photoRows, "of", FLEET.length, "trucks");
console.log("upload buttons rendered             :", uploadButtons);
console.log("search box                          :", searchBoxes ? "present" : "MISSING");

console.log("\n=== per-vehicle resolution (imageFor + resolveVehicleImage) ===");
let legacy = 0;
for (const v of FLEET) {
  const a = imageFor(v.brand, v.body);
  const b = resolveVehicleImage({ body: v.body as any });
  if (/scania|mb-|volvo-container|\.jpg/.test(a + b)) legacy++;
  console.log(`${v.plate.padEnd(12)} ${String(v.body).padEnd(9)} imageFor=${a}  resolve=${b}`);
}
console.log("\nlegacy jpg references remaining:", legacy);

const ok =
  photoRows === FLEET.length &&
  uploadButtons >= FLEET.length &&
  searchBoxes === 1 &&
  loginImgs.length > 0 &&
  loginImgs.every((s) => /official-flatbed-login\.(png|webp)$/.test(s)) &&
  portalImgs.length > 0 &&
  portalImgs.every((s) => s.includes("/images/trucks/official/official-")) &&
  legacy === 0;
console.log(ok ? "\n✅ ALL FLEET IMAGERY RESOLVES TO THE OFFICIAL PHOTOGRAPHS" : "\n❌ STILL RESOLVING LEGACY IMAGES");
process.exit(ok ? 0 : 1);
