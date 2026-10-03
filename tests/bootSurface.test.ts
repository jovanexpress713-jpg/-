import assert from "assert";
import fs from "fs";
import path from "path";

/**
 * EJAZ Transport — Boot Surface / Blank-Screen Guard tests.
 *
 * A production incident showed that when the application fails to start, a
 * visitor sees a blank white page with no explanation. The boot surface in
 * `index.html` plus the `main.tsx` wiring guarantee that a visible loading
 * state is always present until React mounts, and that any startup failure is
 * reported on screen (with a retry action and the failing module) instead of
 * failing silently.
 *
 * These assertions are intentionally static: they protect the contract even if
 * the runtime is never exercised in CI.
 */

const root = process.cwd();
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const mainTsx = fs.readFileSync(path.join(root, "src", "main.tsx"), "utf8");
const errorBoundaryTsx = fs.readFileSync(
  path.join(root, "src", "components", "ErrorBoundary.tsx"),
  "utf8"
);

export function runBootSurfaceTests() {
  console.log("  [TEST] Running Boot Surface / Blank-Screen Guard Tests...");

  /* 1. The document still exposes the React mount point. */
  assert.ok(/\<div id="root"\>\<\/div\>/.test(indexHtml), "index.html must keep the #root mount point");

  /* 2. A loading surface is always visible before the application mounts. */
  assert.match(indexHtml, /id="ejaz-boot"/, "index.html must render the boot surface");
  assert.match(indexHtml, /مؤسسة إيجاز للنقليات/, "the boot surface must carry the EJAZ identity");
  assert.match(
    indexHtml,
    /id="ejaz-boot"[\s\S]{0,400}?position:\s*fixed/,
    "the boot surface must be styled inline so it renders before the stylesheet loads"
  );

  /* 3. The startup guard exposes hide/fail and reports real failures. */
  assert.match(indexHtml, /window\.__EJAZ_BOOT__\s*=/, "index.html must define the __EJAZ_BOOT__ guard");
  assert.match(indexHtml, /hide:\s*function/, "the guard must expose hide()");
  assert.match(indexHtml, /fail:\s*function/, "the guard must expose fail()");

  /* 4. Both fatal paths are captured: script/module errors, rejected promises
        (a failed dynamic import), and a watchdog for a silent non-mount. */
  assert.match(indexHtml, /addEventListener\(\s*"error"/, "startup must listen for script/module load errors");
  assert.match(
    indexHtml,
    /addEventListener\(\s*"unhandledrejection"/,
    "startup must listen for unhandled promise rejections"
  );
  assert.match(indexHtml, /setTimeout\(/, "startup must run a mount watchdog timer");
  assert.match(indexHtml, /id="ejaz-boot-error"/, "the failure overlay must have its own container");
  assert.match(
    indexHtml,
    /إعادة المحاولة · Retry/,
    "the failure overlay must offer a retry action"
  );

  /* 5. The entry point hides the boot surface once the app has mounted, and
        hands any render crash to the overlay. */
  assert.match(
    mainTsx,
    /__EJAZ_BOOT__\?\.hide\(\)/,
    "main.tsx must remove the boot surface after the application mounts"
  );
  assert.match(
    mainTsx,
    /<ErrorBoundary\s+onError=/,
    "main.tsx must forward render crashes from ErrorBoundary to the overlay"
  );
  assert.match(
    errorBoundaryTsx,
    /this\.props\.onError\?\.\(/,
    "ErrorBoundary must invoke the onError prop inside componentDidCatch"
  );

  /* 6. The overlay never swallows the reason — a blank screen is never silent. */
  assert.match(
    indexHtml,
    /detail && detail\.stack \? detail\.stack : detail/,
    "the overlay must render the underlying error detail"
  );

  console.log("  ✓ Boot Surface / Blank-Screen Guard Tests Passed Successfully!");
}
