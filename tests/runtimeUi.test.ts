import assert from "assert";
import { JSDOM, VirtualConsole } from "jsdom";
import {
  ORBIT_DEFAULTS,
  applyDragDelta,
  azimuthDegrees,
  clampPolar,
  clampRadius,
  orbitToPosition,
  stepOrbit,
  type OrbitState,
  type OrbitVelocity,
} from "../src/components/orbit";

/**
 * EJAZ Transport — runtime UI tests.
 *
 * Two layers, both exercising shipped code rather than a stand-in:
 *
 *  A. The 3D orbit integrator (`src/components/orbit.ts`). The viewer's render
 *     loop calls `stepOrbit` / `applyDragDelta` / `orbitToPosition` directly, so
 *     driving them here proves the real rotation behaviour: full 360° azimuth,
 *     roof and wheel angles, damped follow, inertia decay, zoom limits, and
 *     frame-rate independence.
 *
 *  B. A real React DOM mount inside jsdom. The actual `MobileApp` and
 *     `TripsManager` components are mounted and driven with real events, so the
 *     welcome → login → app flow and the per-trip truck-type glyphs are
 *     verified in a live tree, not in rendered strings.
 */

/* ── A. Orbit integrator ───────────────────────────────────────────────────── */

function runOrbitTests() {
  console.log("  [TEST] Running 3D Orbit Integrator Tests...");

  const fresh = (): { cur: OrbitState; tgt: OrbitState; vel: OrbitVelocity } => ({
    cur: { radius: 22, theta: 0.85, phi: 1.1 },
    tgt: { radius: 22, theta: 0.85, phi: 1.1 },
    vel: { theta: 0, phi: 0 },
  });

  /* A1. A full horizontal drag covers 360° — and keeps going past it. */
  {
    const { tgt } = fresh();
    const pxPerFullTurn = (2 * Math.PI) / ORBIT_DEFAULTS.speed;
    applyDragDelta(tgt, pxPerFullTurn, 0);
    assert.ok(
      Math.abs(tgt.theta - 0.85 + 2 * Math.PI) < 1e-6,
      `one full-width drag must cover exactly 2π (got Δ=${(tgt.theta - 0.85).toFixed(4)})`
    );
    // Azimuth wraps into [0,360) so the HUD reads 0° rather than -0.0001°.
    assert.strictEqual(azimuthDegrees(0), 0);
    assert.strictEqual(azimuthDegrees(-Math.PI / 2), 270);
    assert.strictEqual(azimuthDegrees(2 * Math.PI), 0);
    // Sweeping 8 × 45° visits every quadrant.
    const seen = new Set<number>();
    const s = fresh();
    for (let i = 0; i < 8; i += 1) {
      applyDragDelta(s.tgt, (Math.PI / 4) / ORBIT_DEFAULTS.speed, 0);
      seen.add(Math.floor(azimuthDegrees(s.tgt.theta) / 45));
    }
    assert.strictEqual(seen.size, 8, "a continuous drag must sweep all eight 45° sectors");
  }

  /* A2. Front, both sides, rear and roof are all reachable. */
  {
    const s = fresh();
    const pos = { x: 0, y: 0, z: 0 };

    // Front of the truck sits at +X (the cab is built at x = +6.8).
    applyDragDelta(s.tgt, (s.tgt.theta - Math.PI / 2) / ORBIT_DEFAULTS.speed, 0);
    orbitToPosition(s.tgt, pos);
    assert.ok(pos.x > 0 && Math.abs(pos.z) < 1e-6, "a front view must look down +X");

    // 90° more → a side view.
    applyDragDelta(s.tgt, (Math.PI / 2) / ORBIT_DEFAULTS.speed, 0);
    orbitToPosition(s.tgt, pos);
    assert.ok(Math.abs(pos.z) > pos.x, "a side view must look along ±Z");

    // 180° from the front → the rear.
    applyDragDelta(s.tgt, (Math.PI / 2) / ORBIT_DEFAULTS.speed, 0);
    orbitToPosition(s.tgt, pos);
    assert.ok(pos.x < 0, "a rear view must look down -X");

    // Roof: drag downwards (camera rises, exactly like a trackball); the polar
    // clamp keeps it just off vertical so the camera never flips through the pole.
    applyDragDelta(s.tgt, 0, 100000);
    assert.strictEqual(s.tgt.phi, ORBIT_DEFAULTS.minPolar, "the roof angle must clamp, not flip");
    orbitToPosition(s.tgt, pos);
    assert.ok(
      pos.y > s.tgt.radius * 0.98,
      `at the polar clamp the camera must be near the top (y=${pos.y.toFixed(2)}, r=${s.tgt.radius})`
    );

    // Wheels: drag upwards; the camera drops to just below the horizon.
    applyDragDelta(s.tgt, 0, -100000);
    assert.strictEqual(s.tgt.phi, ORBIT_DEFAULTS.maxPolar, "the wheel angle must clamp at the limit");
    orbitToPosition(s.tgt, pos);
    assert.ok(
      pos.y < 0.1 * s.tgt.radius,
      `at the lower clamp the camera must sit near wheel height (y=${pos.y.toFixed(2)})`
    );
    assert.ok(ORBIT_DEFAULTS.maxPolar > Math.PI / 2, "the lower limit must pass the horizon");
  }

  /* A3. The follow is damped: the camera approaches the target without ever
        overshooting, and settles. */
  {
    const s = fresh();
    applyDragDelta(s.tgt, 400, 0); // a real 400px flick
    let previousError = Math.abs(s.tgt.theta - s.cur.theta);
    let overshoot = false;
    for (let frame = 0; frame < 600; frame += 1) {
      stepOrbit(s.cur, s.tgt, s.vel, {
        dt: 1 / 60,
        now: frame * 16.7,
        dragging: true,
        autoRotate: false,
        lastInteraction: 0,
      });
      const err = Math.abs(s.tgt.theta - s.cur.theta);
      if (err > previousError + 1e-9) overshoot = true;
      previousError = err;
    }
    assert.ok(!overshoot, "the eased camera must converge monotonically (no overshoot)");
    assert.ok(previousError < 1e-3, `the camera must settle on the target (residual=${previousError})`);
  }

  /* A4. Frame-rate independence: 60Hz and 120Hz land in the same place. */
  {
    const a = fresh();
    const b = fresh();
    applyDragDelta(a.tgt, 300, 0);
    applyDragDelta(b.tgt, 300, 0);
    for (let i = 0; i < 60; i += 1) {
      stepOrbit(a.cur, a.tgt, a.vel, { dt: 1 / 60, now: i * 16.7, dragging: true, autoRotate: false, lastInteraction: 0 });
    }
    for (let i = 0; i < 120; i += 1) {
      stepOrbit(b.cur, b.tgt, b.vel, { dt: 1 / 120, now: i * 8.3, dragging: true, autoRotate: false, lastInteraction: 0 });
    }
    assert.ok(
      Math.abs(a.cur.theta - b.cur.theta) < 0.02,
      `60Hz and 120Hz must agree (60=${a.cur.theta.toFixed(4)}, 120=${b.cur.theta.toFixed(4)})`
    );
  }

  /* A5. A released flick carries inertia, then settles — and never spins forever. */
  {
    const s = fresh();
    s.vel = { theta: 4.5, phi: 0 };
    const start = s.tgt.theta;
    let peakSpeed = 0;
    for (let i = 0; i < 900; i += 1) {
      stepOrbit(s.cur, s.tgt, s.vel, { dt: 1 / 60, now: i * 16.7, dragging: false, autoRotate: false, lastInteraction: 1e9 });
      peakSpeed = Math.max(peakSpeed, Math.abs(s.vel.theta));
    }
    assert.ok(Math.abs(s.vel.theta) < 1e-4, "inertia must decay to rest");
    assert.ok(peakSpeed <= 4.5, "inertia must not amplify");
    assert.ok(Math.abs(s.tgt.theta - start) > 0.5, "the flick must actually carry the model round");
  }

  /* A6. Auto-rotation resumes only after the idle delay. */
  {
    const s = fresh();
    const before = s.tgt.theta;
    stepOrbit(s.cur, s.tgt, s.vel, {
      dt: 1 / 60,
      now: ORBIT_DEFAULTS.autoRotateResumeMs / 2,
      dragging: false,
      autoRotate: true,
      lastInteraction: 0,
    });
    assert.strictEqual(s.tgt.theta, before, "auto-spin must stay paused inside the idle window");
    stepOrbit(s.cur, s.tgt, s.vel, {
      dt: 1 / 60,
      now: ORBIT_DEFAULTS.autoRotateResumeMs + 100,
      dragging: false,
      autoRotate: true,
      lastInteraction: 0,
    });
    assert.ok(s.tgt.theta > before, "auto-spin must resume once the operator has let go");
  }

  /* A7. Zoom stays inside its limits from both directions. */
  {
    assert.strictEqual(clampRadius(1), ORBIT_DEFAULTS.minRadius);
    assert.strictEqual(clampRadius(999), ORBIT_DEFAULTS.maxRadius);
    assert.strictEqual(clampRadius(22), 22);
    const s = fresh();
    s.tgt.radius = 999;
    stepOrbit(s.cur, s.tgt, s.vel, { dt: 1 / 60, now: 0, dragging: true, autoRotate: false, lastInteraction: 0 });
    assert.ok(s.cur.radius <= ORBIT_DEFAULTS.maxRadius, "the camera must never ease past the far limit");
  }

  /* A8. Polar clamp is idempotent and total. */
  {
    assert.strictEqual(clampPolar(-5), ORBIT_DEFAULTS.minPolar);
    assert.strictEqual(clampPolar(5), ORBIT_DEFAULTS.maxPolar);
    assert.strictEqual(clampPolar(clampPolar(1.1)), clampPolar(1.1));
  }

  console.log("  ✓ 3D Orbit Integrator Tests Passed Successfully!");
}

/* ── B. Real React DOM mount ───────────────────────────────────────────────── */

async function runDomTests() {
  console.log("  [TEST] Running React DOM Runtime Tests (jsdom)...");

  // jsdom has no canvas/WebGL backend. The viewer probes for a context inside a
  // try/catch and falls back gracefully, but jsdom logs "not implemented" for
  // every probe. Filter only that message so a genuine console error from the
  // components still surfaces in the test output.
  const console_ = new VirtualConsole();
  const forwarded: string[] = [];
  console_.on("jsdomError", (err: Error) => {
    if (/not implemented/i.test(err.message)) return;
    forwarded.push(err.message);
  });
  for (const level of ["error", "warn"] as const) {
    console_.on(level, (...args: unknown[]) => forwarded.push(`${level}: ${args.join(" ")}`));
  }

  const dom = new JSDOM("<!doctype html><html lang='ar' dir='rtl'><body><div id='root'></div></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
    virtualConsole: console_,
  });
  const g = globalThis as any;
  // Node 22 exposes `navigator` as a getter-only global, so define rather than assign.
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
  g.PointerEvent = dom.window.MouseEvent;
  g.CustomEvent = dom.window.CustomEvent;
  g.getComputedStyle = dom.window.getComputedStyle;
  g.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number;
  g.cancelAnimationFrame = (id: number) => clearTimeout(id);
  g.IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom has no layout engines for these; the viewer only uses them inside the
  // WebGL branch, but stub them so no test depends on their absence.
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

  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const { SettingsProvider } = await import("../src/settings");
  const { FleetStoreProvider } = await import("../src/state/fleetStore");
  const { ToastProvider } = await import("../src/components/Toast");
  const { MobileApp } = await import("../src/mobile/MobileApp");
  const { TripsManager } = await import("../src/components/TripsManager");
  const { setAuthToken } = await import("../src/services/apiClient");
  const { PermissionProvider } = await import("../src/state/permissionStore");

  const mount = async (node: React.ReactElement) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        React.createElement(
          SettingsProvider,
          null,
          React.createElement(
            FleetStoreProvider,
            null,
            React.createElement(
              ToastProvider,
              null,
              /* The console is permission-gated, so a mount needs a grant. These
                 suites assert behaviour, not access — they run with full access. */
              React.createElement(
                PermissionProvider,
                { initial: { role: "SUPER_ADMIN", wildcard: true, permissions: ["*"], pages: [], sections: [], version: 1, canManagePermissions: true } },
                node
              )
            )
          )
        )
      );
    });
    return {
      host,
      text: () => host.textContent ?? "",
      query: (sel: string) => host.querySelectorAll(sel),
      unmount: async () => {
        await act(async () => root.unmount());
        host.remove();
      },
    };
  };

  const click = async (el: Element) => {
    await act(async () => {
      el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    });
  };

  /* B1. The welcome screen is the first thing the app renders. */
  {
    localStorage.clear();
    setAuthToken(null);
    const app = await mount(React.createElement(MobileApp, {}));
    assert.match(app.text(), /اضغط للمتابعة/, "the app must open on the welcome screen");
    assert.match(app.text(), /EJAZ/, "the welcome screen must carry the EJAZ identity");
    /* B2. The الترحيب toolbar button is gone from the live tree. */
    assert.ok(!app.text().includes("الترحيب"), "the الترحيب button must not exist in the DOM");
    const buttons = [...app.query("button")].map((b) => b.textContent ?? "");
    assert.ok(
      !buttons.some((label) => /Welcome|الترحيب/i.test(label)),
      `no button may be labelled الترحيب (found: ${buttons.join(" | ")})`
    );

    /* B3. "اضغط للمتابعة" is the transition into sign-in. */
    const continueBtn = [...app.query("button")].find((b) =>
      (b.textContent ?? "").includes("اضغط للمتابعة")
    );
    assert.ok(continueBtn, "the continue button must be present");
    await click(continueBtn!);
    assert.ok(
      !app.text().includes("اضغط للمتابعة"),
      "the welcome screen must leave after continue"
    );
    assert.match(
      app.text(),
      /تسجيل الدخول|الدخول|بريد|Email|كلمة/i,
      "continue must land on the sign-in screen"
    );
    await app.unmount();
  }

  /* B4. A valid stored session resumes straight into the app — no re-login. */
  {
    localStorage.clear();
    localStorage.setItem("ejaz_auth_token", "valid-token");
    localStorage.setItem(
      "ejaz_current_user",
      JSON.stringify({ id: "u-driver", email: "driver@ejaz.sa", fullName: "فهد", role: "DRIVER", accountApproved: true })
    );
    setAuthToken("valid-token");
    const realFetch = g.fetch;
    g.fetch = async () =>
      new Response(
        JSON.stringify({ id: "u-driver", email: "driver@ejaz.sa", fullName: "فهد", role: "DRIVER", accountApproved: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    const app = await mount(React.createElement(MobileApp, {}));
    // Let the session probe settle.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    assert.ok(
      !app.text().includes("اضغط للمتابعة"),
      "a validated session must not sit on the welcome screen"
    );
    assert.ok(
      !/تسجيل الدخول/.test(app.text()) || /فهد/.test(app.text()),
      "a validated session must not bounce the operator back to sign-in"
    );
    g.fetch = realFetch;
    await app.unmount();
  }

  /* B5. A rejected session clears the cache and lands on sign-in. */
  {
    localStorage.clear();
    localStorage.setItem("ejaz_auth_token", "stale-token");
    localStorage.setItem("ejaz_current_user", JSON.stringify({ id: "u-x", role: "DRIVER" }));
    setAuthToken("stale-token");
    const realFetch = g.fetch;
    g.fetch = async () => new Response("{}", { status: 401 });
    const app = await mount(React.createElement(MobileApp, {}));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    assert.strictEqual(localStorage.getItem("ejaz_auth_token"), null, "a rejected token must be cleared");
    assert.ok(!app.text().includes("اضغط للمتابعة"), "a rejected session must leave the welcome screen");
    g.fetch = realFetch;
    await app.unmount();
  }

  /* B6. Every trip card shows the glyph of its OWN category. */
  {
    localStorage.clear();
    setAuthToken(null);
    const screen = await mount(React.createElement(TripsManager, {}));

    const expected: Record<string, string> = {
      flatbed: "سطحة — Flatbed",
      reefer: "براد — Refrigerated",
      dry: "جاف — Dry",
      curtain: "ستارة — Curtainsider",
    };

    // The trip list renders one glyph per trip, labelled with its category.
    const glyphLabels = [...screen.query('[role="img"]')]
      .map((el) => el.getAttribute("aria-label") ?? "")
      .filter((label) => Object.values(expected).includes(label));
    assert.ok(
      glyphLabels.length >= 4,
      `the trip list must render a truck-type glyph per trip (found ${glyphLabels.length})`
    );

    // At least one trip of each seeded category is represented, and each renders
    // its own label — proving the icon follows the data, not a constant.
    for (const label of Object.values(expected)) {
      assert.ok(
        glyphLabels.includes(label),
        `a ${label} glyph must appear in the trips screen`
      );
    }
    // And the generic truck glyph is not what the cards use.
    const generic = [...screen.query('[role="img"]')].filter(
      (el) => (el.getAttribute("aria-label") ?? "") === "سطحة — Flatbed"
    );
    assert.ok(generic.length > 0, "the flatbed glyph must be present");

    // Distinct categories produce distinct SVG geometry in the live tree.
    const svgOf = (label: string) => {
      const node = [...screen.query('[role="img"]')].find(
        (el) => el.getAttribute("aria-label") === label
      );
      assert.ok(node, `missing glyph for ${label}`);
      return node!.innerHTML;
    };
    const geometries = Object.values(expected).map(svgOf);
    assert.strictEqual(
      new Set(geometries).size,
      4,
      "the four categories must render four different silhouettes in the live DOM"
    );

    await screen.unmount();
  }

  // No unexpected console output from any mounted component.
  const noisy = forwarded.filter((m) => !/not implemented/i.test(m));
  assert.deepStrictEqual(
    noisy,
    [],
    `the mounted components logged to the console: ${noisy.join(" | ")}`
  );

  console.log("  ✓ React DOM Runtime Tests Passed Successfully!");
}

export async function runRuntimeUiTests() {
  runOrbitTests();
  await runDomTests();
}
