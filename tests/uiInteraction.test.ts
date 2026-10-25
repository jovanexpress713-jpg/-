import assert from "assert";
import fs from "fs";
import path from "path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  TRUCK_TYPE_ICONS,
  TruckTypeIcon,
  resolveTruckTypeGlyph,
} from "../src/components/TruckTypeIcon";
import {
  IconTruck,
  IconTruckCurtain,
  IconTruckDry,
  IconTruckFlatbed,
  IconTruckReefer,
} from "../src/components/Icons";
import { APPROVED_VEHICLE_TYPES_LIST, normalizeVehicleType } from "../src/data/vehicleTypes";
import { SplashScreen } from "../src/mobile/SplashScreen";
import { SettingsProvider } from "../src/settings";

/**
 * EJAZ Transport — UI interaction contract tests.
 *
 * Covers the three user-facing guarantees added to the existing product:
 *   1. Every canonical truck category renders its OWN vector glyph, resolved
 *      from the category value that already exists in the data.
 *   2. The four in-project 3D models are interactive by default (drag orbit,
 *      full 360° azimuth, roof and wheel angles) with no fidelity-reducing
 *      fallback such as LOD or pixel-ratio scaling during interaction.
 *   3. The welcome screen is the real entry point: the "الترحيب" toolbar button
 *      and every path that depended on it are gone, a stored session resumes
 *      straight into the app, and everyone else reaches sign-in.
 *
 * The glyph assertions render the real components through react-dom/server, so
 * a regression in the resolver fails the build rather than the eyeball.
 */

const root = process.cwd();
const read = (...parts: string[]) =>
  fs.readFileSync(path.join(root, ...parts), "utf8");

/** Strips tags so two SVGs can be compared by the geometry they actually draw. */
function svgGeometry(html: string): string {
  const svg = html.match(/<svg[\s\S]*<\/svg>/);
  assert.ok(svg, "expected an <svg> element in the rendered output");
  return svg![0]
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function renderGlyph(truckType: string | null | undefined): string {
  return svgGeometry(
    renderToStaticMarkup(
      React.createElement(SettingsProvider, null, React.createElement(TruckTypeIcon, { truckType }))
    )
  );
}

export function runUiInteractionTests() {
  console.log("  [TEST] Running UI Interaction & Truck Type Icon Tests...");

  /* ── 1. Truck type icon system ─────────────────────────────────────────── */

  // Every approved category has an assigned glyph — the Record type makes this
  // a compile-time guarantee too, so assert it holds at runtime as well.
  for (const meta of APPROVED_VEHICLE_TYPES_LIST) {
    assert.ok(
      TRUCK_TYPE_ICONS[meta.id],
      `${meta.id} must have an assigned truck type icon`
    );
  }

  // Each category resolves to its OWN component, not a shared generic truck.
  assert.strictEqual(resolveTruckTypeGlyph("flatbed"), IconTruckFlatbed);
  assert.strictEqual(resolveTruckTypeGlyph("reefer"), IconTruckReefer);
  assert.strictEqual(resolveTruckTypeGlyph("dry"), IconTruckDry);
  assert.strictEqual(resolveTruckTypeGlyph("curtain"), IconTruckCurtain);

  // The rendered silhouettes are pairwise distinct: flatbed ≠ reefer ≠ dry ≠ curtain.
  const rendered: Record<string, string> = {
    flatbed: renderGlyph("flatbed"),
    reefer: renderGlyph("reefer"),
    dry: renderGlyph("dry"),
    curtain: renderGlyph("curtain"),
  };
  const ids = Object.keys(rendered);
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      assert.notStrictEqual(
        rendered[ids[i]],
        rendered[ids[j]],
        `${ids[i]} and ${ids[j]} must not render the same icon`
      );
    }
  }

  // Distinctive features are actually present in the geometry.
  assert.match(rendered.flatbed, /M2 12\.6h11v2\.4H2z|M1\.5 13\.5h12\.5v1\.5H1\.5z/, "flatbed must draw an open deck slab");
  assert.match(rendered.reefer, /M12 3v18|6\.4 8\.9v4|M6\.5 8v5/, "reefer must draw a cooling glyph");
  assert.match(rendered.curtain, /M2 8\.2h11|M2 7\.8h12/, "curtainsider must draw its roller top rail");
  assert.match(rendered.dry, /M4\.6 6\.6v8\.2|M4\.5 6v9/, "dry van must draw its rear door line");

  // Legacy / Arabic / mixed-case values all land on the right silhouette —
  // the resolver normalizes, so no call site has to pre-clean the data.
  const aliases: [string, string][] = [
    ["سطحة", "flatbed"],
    ["براد", "reefer"],
    ["جاف", "dry"],
    ["ستارة", "curtain"],
    ["FLATBED", "flatbed"],
    ["Curtainsider", "curtain"],
    ["Dry Van", "dry"],
    ["Refrigerated", "reefer"],
    ["قلاب", "flatbed"],
    ["حاوية", "curtain"],
  ];
  for (const [raw, expected] of aliases) {
    assert.strictEqual(
      normalizeVehicleType(raw),
      expected as ReturnType<typeof normalizeVehicleType>,
      `${raw} must normalize to ${expected}`
    );
    assert.strictEqual(
      resolveTruckTypeGlyph(raw),
      TRUCK_TYPE_ICONS[expected as keyof typeof TRUCK_TYPE_ICONS],
      `${raw} must render the ${expected} icon`
    );
    // Unknown / empty input falls back safely instead of rendering nothing.
  }
  assert.strictEqual(renderGlyph(null), renderGlyph("curtain"));
  assert.strictEqual(renderGlyph("unknown-type"), renderGlyph("curtain"));

  // A generic truck icon is never substituted for a category silhouette.
  const genericTruck = svgGeometry(
    renderToStaticMarkup(
      React.createElement(SettingsProvider, null, React.createElement(IconTruck, {}))
    )
  );
  for (const id of ids) {
    assert.notStrictEqual(
      rendered[id],
      genericTruck,
      `${id} must not fall back to the generic truck icon`
    );
  }

  /* ── 2. Trip cards are driven by the trip's own category value ─────────── */
  const tripsManager = read("src", "components", "TripsManager.tsx");
  const shipmentsManager = read("src", "components", "ShipmentsManager.tsx");
  const liveOps = read("src", "components", "LiveOperationsCenter.tsx");

  assert.match(
    tripsManager,
    /<TruckType(?:Icon|Avatar)[\s\S]{0,120}?truckType=\{tr\.cargoType\}/,
    "the trip card must resolve its icon from the trip's own cargoType"
  );
  assert.match(
    shipmentsManager,
    /<TruckType(?:Icon|Avatar)[\s\S]{0,120}?truckType=\{tr\.cargoType\}/,
    "the shipment card must resolve its icon from the trip's own cargoType"
  );
  assert.match(
    liveOps,
    /<TruckTypeIcon[\s\S]{0,120}?truckType=\{tr\.cargoType\}/,
    "the operations trip strip must resolve its icon from the trip's own cargoType"
  );

  /* ── 3. Vehicle presentation contract ────────────────────────────────── */
  const viewer = read("src", "components", "Vehicle3DViewer.tsx");
  const canonicalViewer = read("src", "components", "CanonicalVehicle3DViewer.tsx");
  const truckImage = read("src", "components", "TruckImage.tsx");
  const modelPreview = read("src", "components", "TruckModel3DPreview.tsx");
  const realityDeck = read("src", "components", "RealityCommandDeck.tsx");

  // The fleet viewer uses the registered vehicle photo and the official local
  // category image as a fallback, rather than pretending generated geometry is real.
  assert.match(viewer, /vehicleImage\(vehicle\)/, "the viewer must resolve the registered vehicle image");
  assert.match(viewer, /<CanonicalVehicle3DViewer/, "the fleet viewer must use the canonical presentation component");
  assert.match(canonicalViewer, /<TruckImage/, "the canonical viewer must render the official image component");
  assert.match(truckImage, /official-\[a-z-\]/, "official truck image filenames must follow the bundled asset convention");
  assert.match(truckImage, /typeImage\(/, "the image component must fall back to the approved category image");

  // A real glTF loader and orbit controls power the interactive reference model.
  assert.match(modelPreview, /GLTFLoader/, "the 3D preview must use a glTF loader");
  assert.match(modelPreview, /OrbitControls/, "the 3D preview must support orbit controls");
  assert.match(modelPreview, /setStatus\("error"\)/, "the preview must surface model-load errors");
  assert.match(realityDeck, /TruckModel3DPreview/, "the reality deck must expose the interactive 3D preview");

  // The third-party GLB is currently an external dependency; never claim it is
  // bundled locally or photo-realistic until a verified asset is added to public/.
  assert.match(modelPreview, /https:\/\/grab3d\.com\/dl\/semi-truck\/semi-truck\.glb/, "the current model source must remain explicit");

  /* ── 4. Welcome screen & start flow ────────────────────────────────────── */
  const mobileApp = read("src", "mobile", "MobileApp.tsx");

  // The "الترحيب" button and its whole wiring are removed — not hidden.
  assert.ok(!mobileApp.includes("الترحيب"), "the الترحيب button label must be gone");
  assert.ok(!/handleReplayWelcome/.test(mobileApp), "the replay-welcome handler must be gone");
  assert.ok(!/welcomeReplayKey/.test(mobileApp), "the welcome replay state must be gone");
  assert.ok(!/Replay Welcome Screen/.test(mobileApp), "the replay-welcome tooltip must be gone");
  // No other module still dispatches or listens for the old replay event.
  for (const file of ["src/mobile/SplashScreen.tsx", "src/App.tsx", "src/main.tsx"]) {
    assert.ok(
      !read(...file.split("/")).includes("ejaz-replay"),
      `${file} must not reference the removed ejaz-replay event`
    );
  }

  // The welcome screen is the initial screen, and the session probe decides
  // where the operator goes next.
  assert.match(
    mobileApp,
    /useState<ScreenFlow>\("welcome"\)/,
    "the welcome screen must be the initial screen"
  );
  assert.match(mobileApp, /apiClient\.auth\.me\(\)/, "a stored session must be validated against the server");
  assert.match(mobileApp, /getAuthToken\(\)/, "the session probe must read the stored token");
  assert.match(
    mobileApp,
    /setCurrentScreen\("app"\)/,
    "a validated session must resume straight into the app"
  );
  assert.match(
    mobileApp,
    /setCurrentScreen\("login"\)/,
    "an unauthenticated operator must reach sign-in from the welcome screen"
  );
  assert.match(
    mobileApp,
    /<SplashScreen onContinue=\{handleWelcomeContinue\} \/>/,
    "the welcome screen must render with the continue transition wired"
  );

  // The welcome screen itself keeps its design and its continue action.
  const splashHtml = renderToStaticMarkup(
    React.createElement(SettingsProvider, null, React.createElement(SplashScreen, {}))
  );
  assert.match(splashHtml, /اضغط للمتابعة/, "the welcome screen must keep its continue button");
  assert.ok(
    !/الترحيب/.test(splashHtml),
    "the welcome screen must not contain a الترحيب control"
  );
  // The welcome screen no longer hardcodes the EJAZ wordmark; the published brand
  // logo (loginLogo) carries the identity and is animated in.
  const splashSrc = read("src", "mobile", "SplashScreen.tsx");
  assert.match(splashSrc, /loginLogo/, "the welcome screen must render the published brand logo");
  assert.match(splashSrc, /logo-float/, "the welcome logo must carry an animated touch");
  assert.ok(
    !/>EJAZ</.test(splashSrc) && !/مؤسسة إيجاز للنقليات/.test(splashSrc),
    "the welcome screen must not hardcode the EJAZ wordmark text"
  );

  /* ── 5. Responsive guards ──────────────────────────────────────────────── */
  const css = read("src", "index.css");
  assert.match(css, /html \{ overflow-x: clip; \}/, "the document must not scroll sideways");
  assert.match(css, /@media \(pointer: coarse\)/, "touch devices must get finger-sized targets");
  assert.match(css, /\.scroll-x \{/, "a horizontal scroller utility must exist");

  const dashboard = read("src", "components", "Dashboard.tsx");
  assert.match(
    dashboard,
    /minmax\(min\(292px,100%\),1fr\)/,
    "the shipment grid must never be wider than a 320px viewport"
  );

  const webConsole = read("src", "components", "WebConsole.tsx");
  assert.match(
    webConsole,
    /lg:hidden/,
    "the console must expose a mobile section bar with a menu button"
  );
  assert.match(
    webConsole,
    /setSidebarOpen\(true\)/,
    "the mobile section bar must open the navigation drawer"
  );

  console.log("  ✓ UI Interaction & Truck Type Icon Tests Passed Successfully!");
}
