import assert from "assert";
import fs from "fs";
import path from "path";
import { JSDOM, VirtualConsole } from "jsdom";

/**
 * EJAZ Transport — NOVA Logistics design-system tests.
 *
 * Pins the spec (Navy + Orange Edition) against the shipped code. Every
 * assertion here drives real shipped modules or the real stylesheet — no
 * re-implementation of the logic under test.
 *
 *  A. The stylesheet: NOVA literals, the card recipe, motion, and the
 *     contrast floors the palette has to clear.
 *  B. `CapacityTruck` — spec §3, the component the brief calls الأهم.
 *  C. `TruckCapacity` — the overview card that mounts it.
 *  D. `RouteEfficiency` — spec §4.6, the one orange card.
 *  E. `KpiCards` — spec §4.1.
 *  F. `Sidebar` — spec §4.8/§4.9, plus the two defects the visual audit found.
 */

const root = process.cwd();

/* ── Contrast helpers (WCAG 2.1 relative luminance) ──────────────────────── */

function channels(hex: string): number[] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Reads `--name: value;` out of a CSS block. */
function token(css: string, name: string): string {
  const m = css.match(new RegExp(`${name.replace(/-/g, "\\-")}:\\s*([^;]+);`));
  assert.ok(m, `token ${name} must be defined in index.css`);
  return m![1].trim();
}

/* ── A. Stylesheet ───────────────────────────────────────────────────────── */

function runStylesheetTests() {
  console.log("  [TEST] Running NOVA Stylesheet & Contrast Tests...");

  const css = fs.readFileSync(path.join(root, "src", "index.css"), "utf8");
  const dark = css.slice(0, css.indexOf(':root[data-theme="light"]'));

  /* A1. The spec's literals are present verbatim. */
  const spec: Record<string, string> = {
    "--color-bg-deep": "#050b18",
    "--color-bg-main": "#08152b",
    "--color-bg-card": "#0e2142",
    "--color-bg-card-2": "#12294f",
    "--color-bg-input": "#0b1b37",
    "--color-border-soft": "#1b3663",
    "--color-border-strong": "#254780",
    "--color-orange-primary": "#ff6b1a",
    "--color-orange-soft": "#ff8a3d",
    "--color-orange-glow": "#ffb077",
    "--color-success": "#22c55e",
    "--color-warning": "#ffb020",
    "--color-danger": "#ff3b30",
    "--color-info": "#38bdf8",
    "--color-ai": "#a855f7",
    "--color-text-1": "#f1f5f9",
    "--color-text-2": "#b8c4da",
  };
  for (const [name, want] of Object.entries(spec)) {
    assert.strictEqual(token(dark, name), want, `${name} must be the spec value ${want}`);
  }

  /* A2. Surfaces alias onto the NOVA ladder, so existing call sites re-skin. */
  assert.strictEqual(token(dark, "--color-surface-3"), "var(--color-bg-card)");
  assert.strictEqual(token(dark, "--color-brand"), "var(--color-orange-primary)");
  assert.strictEqual(token(dark, "--color-border-subtle"), "var(--color-border-soft)");

  /* A3. Spec §2 — the card recipe: radius 20 and a real drop shadow.
         The old card had an `inset` ring only, which is why every surface
         looked flat against the navy behind it. */
  /* Slice spans the base rule AND its hover, which is a separate block. */
  const card = css.slice(css.indexOf("  .card {"), css.indexOf("  /* Selected card"));
  assert.match(card, /border-radius: var\(--ds-radius-card\)/, "the card must use the 20px token");
  assert.strictEqual(token(css, "--ds-radius-card"), "20px");
  assert.match(card, /box-shadow: var\(--ds-card-shadow\), var\(--ds-card-inner\)/);
  assert.match(css, /--ds-card-shadow: 0 8px 32px rgb\(0 0 0 \/ 0\.35\)/, "spec §2 shadow");
  assert.match(css, /--ds-card-inner: inset 0 1px 0 rgb\(255 255 255 \/ 0\.03\)/, "spec §2 inner glow");
  assert.match(card, /translateY\(var\(--ds-card-lift\)\)/, "spec §2 hover must lift the card");
  assert.match(css, /--ds-card-glow: 0 0 24px rgb\(255 107 26 \/ 0\.08\)/, "spec §2 orange halo");

  /* A4. The audit found `transition: all` surviving in three primitives even
         though the file documents that only cheap properties may animate. */
  assert.ok(
    !/transition: all/.test(css),
    "no primitive may animate `all` — it reflows layout on hover and focus",
  );

  /* A5. Contrast floors. `--color-text-3` is deliberately NOT the spec's
         #6C7A99: that measures 3.71:1 on the card surface and fails WCAG AA. */
  const muted = token(dark, "--color-text-3");
  const cardBg = token(dark, "--color-bg-card");
  const mutedRatio = contrast(muted, cardBg);
  assert.ok(
    mutedRatio >= 4.5,
    `--color-text-3 (${muted}) on --color-bg-card must clear AA 4.5:1, got ${mutedRatio.toFixed(2)}:1`,
  );
  /* And the deviation is documented, not silent. */
  assert.match(css, /3\.71:1/, "the reason for lifting text-3 must be written down");

  /* A6. White on the bright primary fails even the large-text floor, so the
         token that ~30 `bg-brand text-on-brand` sites resolve through must
         stay navy ink. */
  const onBrand = token(dark, "--color-on-brand");
  const brand = token(dark, "--color-orange-primary");
  assert.ok(
    contrast(onBrand, brand) >= 4.5,
    `--color-on-brand (${onBrand}) on --color-brand must clear AA, got ${contrast(onBrand, brand).toFixed(2)}:1`,
  );
  assert.ok(
    contrast("#ffffff", brand) < 3,
    "white on the bright primary must still be known-bad, or this guard is stale",
  );
  /* The deep orange that DOES carry white text has to clear AA. */
  assert.ok(
    contrast("#ffffff", token(dark, "--color-orange-deep")) >= 4.5,
    "white on --color-orange-deep must clear AA",
  );

  /* A7. Product mandate — «مراعي» (Almarai) is the single typeface of the whole
         product (headings, buttons, menus, tables, forms, dialogs, assistant).
         IBM Plex stays installed underneath as the metrics-compatible fallback. */
  assert.match(css, /--font-sans: "Almarai", "IBM Plex Sans Arabic"/);
  assert.match(css, /--font-mono: "Almarai", "IBM Plex Sans Arabic"/);
  const htmlFonts = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(htmlFonts, /Almarai/, "the Marai webfont must actually be loaded");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /IBM\+Plex\+Sans\+Arabic/, "the webfont must actually be loaded");
  assert.match(html, /IBM\+Plex\+Mono/, "the mono webfont must actually be loaded");

  /* A8. No module may keep a private copy of the old palette. The canvas and
         hand-written SVG surfaces did exactly that, so they went on painting
         the pre-NOVA orange after the tokens moved. `src/utils/palette.ts` is
         exempt: holding the literals as a no-DOM fallback is its whole job. */
  {
    const LEGACY = [
      ["#FF7A00", "pre-NOVA brand orange"],
      ["#2FD08A", "retired status green"],
      ["#2F80FF", "retired secondary blue"],
      ["#EAF0FA", "retired text primary"],
      ["#A7B4C9", "retired text secondary"],
      ["#7E8DA8", "retired text muted"],
    ];
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return walk(full);
        return /\.(ts|tsx|css)$/.test(e.name) ? [full] : [];
      });
    const offenders: string[] = [];
    for (const file of walk(path.join(root, "src"))) {
      if (file.endsWith(path.join("utils", "palette.ts"))) continue;
      const text = fs.readFileSync(file, "utf8");
      for (const [hex, why] of LEGACY) {
        if (text.toUpperCase().includes(hex)) {
          offenders.push(`${path.relative(root, file)} → ${hex} (${why})`);
        }
      }
    }
    assert.deepStrictEqual(
      offenders,
      [],
      `stale palette copies remain:\n      ${offenders.join("\n      ")}`,
    );
  }

  /* A9. Spec §6 motion tokens exist and carry the spec's durations. */
  assert.strictEqual(token(css, "--ds-duration"), "220ms");
  assert.strictEqual(token(css, "--ds-stagger"), "40ms");
  assert.strictEqual(token(css, "--ds-fill"), "600ms");
  assert.strictEqual(token(css, "--ds-count"), "400ms");
  assert.strictEqual(token(css, "--ds-danger-pulse"), "2s");

  console.log("  ✓ NOVA Stylesheet & Contrast Tests Passed Successfully!");
}

/* ── B–F. Live React mounts ──────────────────────────────────────────────── */

export async function runNovaDesignTests() {
  runStylesheetTests();

  console.log("  [TEST] Running NOVA Component Tests (jsdom)...");

  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", () => {});
  const dom = new JSDOM(`<!doctype html><html lang="ar" dir="rtl"><body></body></html>`, {
    url: "http://localhost/",
    pretendToBeVisual: true,
    virtualConsole,
  });

  const g = globalThis as any;
  const define = (key: string, value: unknown) => {
    Object.defineProperty(g, key, { value, writable: true, configurable: true });
  };
  define("window", dom.window);
  define("document", dom.window.document);
  define("navigator", dom.window.navigator);
  define("localStorage", dom.window.localStorage);
  g.HTMLElement = dom.window.HTMLElement;
  g.Element = dom.window.Element;
  g.Node = dom.window.Node;
  g.Event = dom.window.Event;
  g.MouseEvent = dom.window.MouseEvent;
  g.CustomEvent = dom.window.CustomEvent;
  g.getComputedStyle = dom.window.getComputedStyle;
  g.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 0) as unknown as number;
  g.cancelAnimationFrame = (id: number) => clearTimeout(id);
  g.IS_REACT_ACT_ENVIRONMENT = true;
  g.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  g.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
  dom.window.ResizeObserver = g.ResizeObserver;
  dom.window.IntersectionObserver = g.IntersectionObserver;
  dom.window.matchMedia =
    dom.window.matchMedia ??
    (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }) as any);
  g.matchMedia = dom.window.matchMedia;

  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const { SettingsProvider } = await import("../src/settings");
  const { FleetStoreProvider, useFleetStore } = await import("../src/state/fleetStore");
  const {
    CapacityTruck,
    TRUCK_IMG,
    TRUCK,
    VIEWBOX,
    CABIN,
    TRAILER,
    OVERLAY,
    WHEELS,
    WHEEL_D,
    WHEEL_CY,
    capacityFillWidth,
    capacityTextCentre,
    capacityFillHeight,
    capacityTextVerticalCentre,
  } = await import("../src/components/CapacityTruck");
  const { routeEfficiency } = await import("../src/components/overview/RouteEfficiency");
  const { loadPct } = await import("../src/components/overview/shared");
  const { TruckCapacity } = await import("../src/components/overview/TruckCapacity");
  const { RouteEfficiency } = await import("../src/components/overview/RouteEfficiency");
  const { buildRoutePoints, fitRouteVertical, smoothPath, VIEW } =
    await import("../src/components/RouteMap");
  const { CITIES } = await import("../src/data/routes");
  const { KpiCards } = await import("../src/components/overview/KpiCards");
  const { Sidebar } = await import("../src/components/Sidebar");

  const mount = async (node: React.ReactElement) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const r = createRoot(host);
    await act(async () => {
      r.render(
        React.createElement(
          SettingsProvider,
          null,
          React.createElement(FleetStoreProvider, null, node),
        ),
      );
    });
    return {
      host,
      text: () => host.textContent ?? "",
      query: (sel: string) => [...host.querySelectorAll(sel)],
      one: (sel: string) => host.querySelector(sel),
      unmount: async () => {
        await act(async () => r.unmount());
        host.remove();
      },
    };
  };

  /** Lets the count-up / fill transitions settle before asserting. */
  const settle = async (ms = 700) => {
    await act(async () => {
      await new Promise((res) => setTimeout(res, ms));
    });
  };

  /* ── B. CapacityTruck — the photographic truck + on-top percentage ──── */
  const EPS = 1e-9;
  const inRange = (v: number, lo: number, hi: number) => v >= lo - EPS && v <= hi + EPS;
  {
    /* The asset exists on disk and is a real PNG. */
    const asset = path.join(root, "public", "images", "trucks", "official", "capacity-truck-left.png");
    assert.ok(fs.existsSync(asset), "the photographic truck asset must ship in public/");
    const sig = fs.readFileSync(asset).subarray(0, 8);
    assert.deepStrictEqual(
      [...sig],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      "the asset must be a PNG",
    );
    assert.ok(TRUCK_IMG.endsWith("capacity-truck-left.png"), "component must reference the asset");

    /* Overall proportion: long-haul semi, ≈3.0 : 1. */
    assert.ok(
      inRange(TRUCK.w / TRUCK.h, 2.9, 3.2),
      `truck length:height must be ~3:1 (got ${(TRUCK.w / TRUCK.h).toFixed(2)})`,
    );

    /* 5–7% horizontal breathing room on each side of the viewBox. */
    const breathe = (VIEWBOX.w - TRUCK.w) / 2 / VIEWBOX.w;
    assert.ok(
      inRange(breathe, 0.045, 0.08),
      `breathing room must be ~5–7% (got ${(breathe * 100).toFixed(1)}%)`,
    );

    /* Trailer: 73–77% of length, begins ~24% from the front, dominates cabin. */
    assert.ok(inRange(TRAILER.w / TRUCK.w, 0.73, 0.77), "trailer 73–77% of length");
    assert.ok(
      inRange((TRAILER.x - TRUCK.x) / TRUCK.w, 0.22, 0.26),
      "cabin occupies the left ~24% (truck faces LEFT)",
    );
    assert.ok(inRange(TRAILER.h / TRUCK.h, 0.62, 0.75), "trailer 62–75% of height");
    assert.ok(
      inRange(TRAILER.w / CABIN.w, 3.0, 3.3),
      `trailer must be ~3.1× the cabin (got ${(TRAILER.w / CABIN.w).toFixed(2)})`,
    );

    /* Wheels: four, one shared baseline, heavy arrangement (NOT even). */
    assert.strictEqual(WHEELS.length, 4, "the reference shows four wheels");
    const cys = WHEELS.map((w) => w.cy);
    assert.ok(Math.max(...cys) - Math.min(...cys) <= 6, "all wheels share one baseline");
    assert.ok(inRange(WHEEL_D / TRUCK.h, 0.26, 0.34), "wheel diameter 26–34% of vehicle height");
    const gaps = WHEELS.slice(1).map((w, i) => w.cx - WHEELS[i].cx);
    assert.ok(gaps[2] < gaps[0] && gaps[2] < gaps[1], "the rear dual axle is closely grouped");
    assert.ok(
      gaps[2] < 0.45 * Math.min(gaps[0], gaps[1]),
      "rear group much tighter than the other gaps",
    );

    /* The capacity overlay sits inside the trailer, above the wheel tops. */
    assert.ok(inRange(OVERLAY.h / TRAILER.h, 0.85, 0.95), "overlay 85–95% of trailer height");
    assert.ok(
      OVERLAY.x >= TRAILER.x && OVERLAY.x + OVERLAY.w <= TRAILER.x + TRAILER.w,
      "overlay inside the trailer",
    );
    const wheelTop = WHEEL_CY - WHEEL_D / 2;
    assert.ok(OVERLAY.y + OVERLAY.h <= wheelTop, "overlay must never cover a wheel");
  }

  /* B2. Liquid fill rises from the floor of the trailer like a moving tank. */
  {
    const h59 = capacityFillHeight(59, OVERLAY.h);
    assert.ok(Math.abs(h59 - 0.59 * OVERLAY.h) < 1e-9, "59% liquid fill = 59% of interior height");
    assert.strictEqual(capacityFillHeight(-10, OVERLAY.h), 0, "clamped low");
    assert.strictEqual(capacityFillHeight(140, OVERLAY.h), OVERLAY.h, "clamped high");

    const cy = capacityTextVerticalCentre(59, OVERLAY.h);
    assert.ok(Math.abs(cy - (OVERLAY.y + OVERLAY.h - h59 / 2)) < 1e-9, "percentage is centred inside the liquid level");
    assert.ok(Math.abs(cy - (OVERLAY.y + OVERLAY.h / 2)) > OVERLAY.h * 0.1, "percentage follows the actual fill level");

    /* Legacy helper remains clamped for any older callers. */
    assert.strictEqual(capacityFillWidth(-10, OVERLAY.w), 0);
    assert.strictEqual(capacityFillWidth(140, OVERLAY.w), OVERLAY.w);
    assert.ok(Number.isFinite(capacityTextCentre(59, OVERLAY.w)));
  }

  /* B4. Mounted: the photograph renders, the fill animates, the figure shows. */
  {
    const view = await mount(React.createElement(CapacityTruck, { pct: 59 }));
    assert.ok(view.one("svg"), "the truck must render an SVG");
    const img = view.query("image");
    assert.strictEqual(img.length, 1, "the photographic truck must render");
    assert.ok(
      (img[0].getAttribute("href") ?? "").endsWith("capacity-truck-left.png"),
      "the <image> must point at the shipped asset",
    );
    const texts = view.query("text").map((n) => n.textContent ?? "");
    assert.ok(texts.includes("59%"), `the figure must render (got: ${texts.join(",")})`);
    const fill = view.query("rect").find((n) => /transition: height/.test(n.getAttribute("style") ?? ""));
    assert.ok(fill, "the blue water level must rise with an animated height");
    assert.ok(view.query("path").some((n) => n.getAttribute("class")?.includes("capacity-water-wave")), "moving water ripples must render");
    await view.unmount();
  }

  /* B5. Dashboard mode counts quickly from 0, then stops at the true value. */
  {
    const view = await mount(React.createElement(CapacityTruck, { pct: 89, countUp: true }));
    assert.ok(!view.query("text").map((n) => n.textContent ?? "").includes("89%"), "counter does not jump to the target on first paint");
    await settle(1250);
    const texts = view.query("text").map((n) => n.textContent ?? "");
    assert.ok(texts.includes("89%"), `count-up settles at the actual value (got: ${texts.join(",")})`);
    await view.unmount();
  }

  /* B6. The capacity truck uses the exact official body image for all four EJAZ types. */
  {
    const expectedImages: Record<string, string> = {
      reefer: "official-reefer.png",
      flatbed: "official-flatbed.png",
      dry: "official-dry.png",
      curtain: "official-curtain.png",
    };
    for (const [type, imageName] of Object.entries(expectedImages)) {
      const view = await mount(React.createElement(CapacityTruck, { pct: 63, truckType: type }));
      assert.ok((view.query("image")[0]?.getAttribute("href") ?? "").endsWith(imageName), `${type} meter uses its own approved truck image`);
      assert.ok(view.query("clipPath").length > 0, `${type} liquid overlay is clipped to the vehicle cargo area`);
      await view.unmount();
    }
  }

  /* ── C. TruckCapacity = truck + route in ONE component ───────────────── */
  {
    const view = await mount(
      React.createElement(function Harness() {
        const { trips } = useFleetStore();
        return React.createElement(TruckCapacity, { trip: trips[0] });
      }),
    );
    await settle();

    /* Both the truck and the map render inside the same section. */
    const svgs = view.query("svg");
    assert.ok(svgs.length >= 2, "one truck SVG and one map SVG must co-exist");

    const text = view.text();
    assert.match(text, /سعة الشاحنة الحالية|Current Truck Capacity/, "heading present");
    assert.match(text, /المسار|Route/, "route header present");
    assert.match(text, /ميل متبق|mi left/, "distance-remaining readout present");
    assert.match(text, /تغيير المسار|Change Route/, "change-route affordance present");

    /* The figure inside the truck is the real load, not a placeholder. */
    const inner = view.query("text").map((n) => n.textContent ?? "");
    assert.ok(inner.some((s) => /^\d+%$/.test(s)), `load figure renders (got: ${inner.join(",")})`);
    await view.unmount();
  }

  /* ── C2. RouteMap — wide, dark, and the route runs bottom→top ────────── */
  {
    /* Wide landscape: the reference is ~2.2–2.3 : 1. */
    assert.ok(
      VIEW.w / VIEW.h >= 2.1 && VIEW.w / VIEW.h <= 2.35,
      `map must be ~2.2:1 (got ${(VIEW.w / VIEW.h).toFixed(2)})`,
    );

    for (const [from, to] of [["Riyadh", "Jeddah"], ["Dammam", "Riyadh"], ["Jeddah", "Madinah"]] as const) {
      const raw = buildRoutePoints(CITIES[from], CITIES[to], 7);
      assert.strictEqual(raw.length, 5, "a natural route has 5 anchors, not a straight line");
      const { pts } = fitRouteVertical(raw);
      /* Origin sits toward the bottom, destination toward the top. */
      assert.ok(
        pts[0][1] > pts[pts.length - 1][1],
        `${from}→${to}: the origin must render below the destination`,
      );
      /* And the route actually occupies the vertical extent of the map. */
      const ys = pts.map((q) => q[1]);
      assert.ok(Math.max(...ys) - Math.min(...ys) > VIEW.h * 0.6, "the route must run vertically");
    }

    /* The smoothed path is a real Bézier chain, not a ruler stroke. */
    const d = smoothPath(fitRouteVertical(buildRoutePoints(CITIES.Riyadh, CITIES.Jeddah, 7)).pts);
    assert.ok(d.startsWith("M") && d.includes("C"), "the route must be a curved path");

    /* Live mount: the map renders a route path, a marker and 4 waypoints. */
    const { RouteMap } = await import("../src/components/RouteMap");
    const view = await mount(
      React.createElement(RouteMap, {
        fromCity: "Riyadh",
        toCity: "Jeddah",
        progressPct: 45,
        corridorKey: "riyadh-jeddah",
      }),
    );
    /* The map itself is the one wide SVG; the control buttons add icon SVGs. */
    const mapSvg = view.query("svg").find((n) => (n.getAttribute("viewBox") ?? "").startsWith("0 0 1100"));
    assert.ok(mapSvg, "the wide map SVG must render");
    assert.ok(view.query("path").length >= 3, "route + network paths must render");
    await view.unmount();
  }

  /* ── D. RouteEfficiency — spec §4.6 ─────────────────────────────────── */
  {
    /* D1. The figure is computed from the trip, not hard-coded. */
    const base = {
      id: "t",
      status: "on_road",
      speedKmH: 80,
      etaMinutes: 60,
      distanceRemainingKm: 80,
    } as any;
    /* 80 km/h over 80 km in 60 min → required == actual → 100%. */
    assert.strictEqual(routeEfficiency(base), 100);
    /* Half the needed speed → 50%. */
    assert.strictEqual(routeEfficiency({ ...base, speedKmH: 40 }), 50);
    /* Ahead of schedule caps at 100 rather than reading 200%. */
    assert.strictEqual(routeEfficiency({ ...base, speedKmH: 160 }), 100);
    /* A delivered trip is complete by definition. */
    assert.strictEqual(routeEfficiency({ ...base, status: "delivered", speedKmH: 0 }), 100);
    /* No remaining distance and no ETA must not divide by zero. */
    assert.strictEqual(routeEfficiency({ ...base, etaMinutes: 0, distanceRemainingKm: 0 }), 100);

    /* D2. It is the one card wearing the orange fill. */
    const view = await mount(
      React.createElement(function Harness() {
        const { trips } = useFleetStore();
        return React.createElement(RouteEfficiency, { trip: trips[0] });
      }),
    );
    const accent = view.query(".card-accent");
    assert.strictEqual(accent.length, 1, "spec §4.6 — exactly one orange accent card");
    assert.match(view.text(), /كفاءة المسار|Route efficiency/);
    assert.match(view.text(), /الحد المستهدف|Threshold/);
    assert.match(view.text(), /85%/, "spec §4.6 threshold marker");
    assert.match(view.text(), /\d+%/, "the computed figure must render");
    await view.unmount();
  }

  /* ── E. KpiCards — spec §4.1 ────────────────────────────────────────── */
  {
    const view = await mount(
      React.createElement(function Harness() {
        const { trips } = useFleetStore();
        return React.createElement(KpiCards, {
          trips,
          activeGroup: "all" as const,
          onGroup: () => {},
        });
      }),
    );
    await settle();
    const cards = view.query("button.card");
    assert.strictEqual(cards.length, 4, "spec §8 — four KPI cards");
    /* Spec §4.1 — the 2px rule at 40% of the card width. */
    const rules = view.query("button.card > span[aria-hidden]");
    assert.ok(rules.length >= 4, "each KPI card must carry the bottom rule");
    for (const rule of rules) {
      assert.match(rule.getAttribute("class") ?? "", /h-\[2px\]/, "the rule must be 2px");
      assert.match(rule.getAttribute("class") ?? "", /w-\[40%\]/, "the rule must span 40%");
      assert.match(rule.getAttribute("class") ?? "", /bg-brand/, "the rule must be orange");
    }
    /* Spec §4.1 — the figure is mono, not proportional. */
    assert.ok(view.query(".num.num-lg").length >= 4, "KPI figures must use the mono figure class");
    await view.unmount();
  }

  /* ── F. Sidebar — spec §4.8/§4.9 ────────────────────────────────────── */
  {
    const source = fs.readFileSync(path.join(root, "src", "components", "Sidebar.tsx"), "utf8");

    /* F1. The audit's finding: quick-create was `opacity-0` + `group-hover`
           only, which made it unreachable on touch. */
    assert.ok(
      !/group-hover:opacity-100/.test(source),
      "quick-create must not be hover-only — a touch user can never reach it",
    );
    assert.ok(!/pointer-events-none absolute/.test(source), "the quick-create bar must be in flow");

    /* F2. The audit's finding: three "التحليلات" children all dispatched the
           same `analysis` key — three labels, one behaviour. */
    assert.strictEqual(
      (source.match(/onSelect\("analysis"\)/g) ?? []).length,
      0,
      'no hard-coded onSelect("analysis") may remain',
    );

    /* F3. The branding entry the branding suite pins must survive the rewrite.
           Its label resolves through the central dictionary (nav.identity), which
           is what keeps the three languages in step — no hard-coded English. */
    assert.match(source, /"branding"/);
    assert.match(source, /nav\.identity/);

    /* F4. Live mount: grouping, the active treatment, and count badges. */
    const view = await mount(
      React.createElement(Sidebar, {
        active: "fleet",
        onSelect: () => {},
        counts: { trucks: 36, cargos: 248, repair: 3, drivers: 29, reports: 6 },
        onCreate: () => {},
      }),
    );
    assert.match(view.text(), /التشغيل|Operations/, "spec §4.8 — grouped headings");
    assert.match(view.text(), /الأسطول|Fleet/);
    assert.match(view.text(), /التحليلات|Insights/);

    /* Spec §4.8 — the active entry is a solid orange pill with a halo. */
    const on = view.query(".nav-item-on");
    assert.strictEqual(on.length, 1, "exactly one nav entry may be active");
    assert.strictEqual(on[0].getAttribute("aria-current"), "page");

    /* Spec §4.8 — counts render as orange pills. */
    assert.ok(view.query(".badge.badge-brand").length >= 3, "counts must render as orange badges");

    /* Spec §4.9 — the dashed orange create card. */
    assert.match(source, /border-\[1\.5px\] border-dashed border-brand/, "spec §4.9 dashed border");
    assert.match(source, /bg-brand\/5/, "spec §4.9 tinted background");
    assert.match(view.text(), /إنشاء طلب جديد|Create new Request/);

    /* Rows that open a modal rather than navigate are marked. */
    assert.match(source, /modal: true/, "modal rows must be distinguishable from navigation");
    await view.unmount();
  }

  console.log("  ✓ NOVA Component Tests Passed Successfully!");
}
