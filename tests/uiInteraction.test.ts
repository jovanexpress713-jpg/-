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
  assert.match(rendered.flatbed, /M2 12\.6h11v2\.4H2z/, "flatbed must draw an open deck slab");
  assert.match(rendered.reefer, /M12 3v18|6\.4 8\.9v4/, "reefer must draw a cooling glyph");
  assert.match(rendered.curtain, /M2 8\.2h11/, "curtainsider must draw its roller top rail");
  assert.match(rendered.dry, /M4\.6 6\.6v8\.2/, "dry van must draw its rear door line");

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
    /<TruckTypeIcon[\s\S]{0,120}?truckType=\{tr\.cargoType\}/,
    "the trip card must resolve its icon from the trip's own cargoType"
  );
  assert.match(
    shipmentsManager,
    /<TruckTypeIcon[\s\S]{0,120}?truckType=\{tr\.cargoType\}/,
    "the shipment card must resolve its icon from the trip's own cargoType"
  );
  assert.match(
    liveOps,
    /<TruckTypeIcon[\s\S]{0,120}?truckType=\{tr\.cargoType\}/,
    "the operations trip strip must resolve its icon from the trip's own cargoType"
  );

  /* ── 3. 3D interaction contract ────────────────────────────────────────── */
  const viewer = read("src", "components", "Vehicle3DViewer.tsx");

  // Mouse AND touch go through one Pointer Events path on the canvas.
  assert.match(viewer, /onPointerDown=\{handlePointerDown\}/, "the canvas must handle pointer down");
  assert.match(viewer, /onPointerMove=\{handlePointerMove\}/, "the canvas must handle pointer move");
  assert.match(viewer, /onPointerUp=\{handlePointerUp\}/, "the canvas must handle pointer up");
  assert.match(viewer, /setPointerCapture/, "the drag must capture the pointer so it survives leaving the canvas");
  assert.match(viewer, /touch-none/, "the canvas must opt out of browser touch scrolling");

  // The four existing models are mounted by default — no opt-in button needed.
  assert.match(viewer, /const mountCanonical = \(\) => \{/, "the canonical model mount must exist");
  assert.match(viewer, /buildTruckModel\(activeType\)/, "the viewer must build the project's own model");
  assert.ok(
    !/setAllowIllustrative\(true\)/.test(viewer),
    "3D must not sit behind an opt-in 'illustrative geometry' button"
  );

  // Full 360° azimuth plus a polar sweep that reaches the roof and the wheels.
  // The tuning now lives in the shared orbit module the render loop imports.
  const orbit = read("src", "components", "orbit.ts");
  assert.match(viewer, /from "\.\/orbit"/, "the viewer must use the shared orbit integrator");
  assert.match(orbit, /minPolar: 0\.16/, "the roof angle must be reachable");
  assert.match(orbit, /maxPolar: 1\.62/, "the wheel angle must be reachable");
  assert.ok(
    !/Math\.PI \/ 2 - 0\.08/.test(viewer),
    "the old clamped polar range must be gone"
  );
  // Azimuth is unclamped (it wraps), which is what makes 360° possible.
  assert.ok(
    !/theta\s*=\s*Math\.max\(/.test(viewer),
    "the azimuth must stay unclamped so a full turn is possible"
  );

  // Smoothness: the render loop drives the shared damped integrator.
  assert.match(viewer, /stepOrbit\(orbitRef\.current, targetOrbitRef\.current, orbitVelocityRef\.current/, "the loop must step the eased orbit");
  assert.match(viewer, /applyDragDelta\(targetOrbitRef\.current, dx, dy\)/, "drag must feed the shared integrator");
  assert.match(viewer, /orbitToPosition\(orbitRef\.current, camera\.position\)/, "the camera must be placed from the orbit state");
  assert.match(orbit, /1 - Math\.exp\(-o\.follow \* dt\)/, "the follow must be frame-rate independent");
  assert.match(orbit, /Math\.exp\(-o\.friction \* dt\)/, "inertia must decay smoothly");

  // No fidelity reduction while interacting. Assert on real code, not prose:
  // an actual THREE.LOD instance or an addLevel() call would drop geometry.
  assert.ok(
    !/new\s+THREE\.LOD|\.addLevel\s*\(/.test(viewer),
    "aggressive LOD is not allowed — no THREE.LOD or addLevel() in the viewer"
  );
  assert.ok(
    !/setPixelRatio\s*\(\s*1\s*\)|pixelRatio\s*=\s*1(?![0-9.])/.test(viewer),
    "the renderer must never be pinned to 1x density"
  );
  assert.match(viewer, /antialias: true/, "anti-aliasing must stay enabled");
  assert.match(viewer, /Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/, "pixel density must stay retina-class");
  assert.match(viewer, /PCFSoftShadowMap/, "shadows must be soft");
  assert.match(viewer, /ShadowMaterial/, "the contact shadow must not alter the truck's materials");

  // Wheel zoom uses a non-passive listener (React's onWheel cannot preventDefault).
  assert.match(
    viewer,
    /addEventListener\("wheel", handleNativeWheel, \{ passive: false \}\)/,
    "wheel zoom must be attached non-passively to avoid the passive-listener console warning"
  );
  assert.ok(!/onWheel=\{handleWheel\}/.test(viewer), "the passive React wheel handler must be gone");

  // Rendering pauses off-screen / when hidden — scheduling only, never quality.
  assert.match(viewer, /IntersectionObserver/, "off-screen viewers must pause their loop");
  assert.match(viewer, /visibilitychange/, "hidden tabs must pause their loop");

  // The shared WebGL budget keeps a full fleet grid from losing contexts.
  assert.match(viewer, /MAX_LIVE_WEBGL_CONTEXTS/, "a WebGL context budget must exist");
  assert.match(viewer, /releaseWebGLContext\(\)/, "a viewer must release its slot on unmount");

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
  assert.match(splashHtml, /EJAZ/, "the welcome screen must keep the EJAZ identity");
  assert.match(splashHtml, /مؤسسة إيجاز للنقليات/, "the welcome screen must keep the Arabic identity");
  assert.ok(
    !/الترحيب/.test(splashHtml),
    "the welcome screen must not contain a الترحيب control"
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
