import assert from "assert";
import fs from "fs";
import path from "path";

/**
 * EJAZ Transport — branding propagation contract.
 *
 * The settings screen (`Settings & Identity`) must not merely persist the logo to
 * the server: the stored identity has to reach the surfaces that actually render
 * it. These assertions pin that wiring so the logo can never silently become inert
 * again.
 */

const root = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), "utf8");

export function runBrandingTests() {
  console.log("  [TEST] Running Branding Propagation Tests...");

  const logo = read("src", "components", "Logo.tsx");
  const store = read("src", "state", "brandingStore.tsx");
  const app = read("src", "App.tsx");
  const settings = read("src", "components", "BrandingSettings.tsx");
  const sidebar = read("src", "components", "Sidebar.tsx");
  const splash = read("src", "mobile", "SplashScreen.tsx");

  // 1. The settings entry exists in the admin sidebar.
  assert.match(sidebar, /"branding"/, "the sidebar must expose the branding/identity entry");
  // The label is no longer a hard-coded string: it resolves through the central
  // dictionary, so the entry stays «Settings & Identity» in English while the
  // Arabic and Urdu sessions show their own translation of the same key.
  assert.match(sidebar, /nav\.identity/, "the entry must be labelled through the central i18n key");
  const i18n = read("src", "localization", "i18n.ts");
  assert.match(
    i18n,
    /"nav\.identity":\s*\{[^}]*en:\s*"Settings & Identity"/,
    "the entry must be labelled Settings & Identity",
  );

  // 2. The store resolves the custom logo from the saved branding and publishes it.
  assert.match(
    store,
    /headerLogoUrl \|\| branding\.logoUrl|branding\.headerLogoUrl \|\| branding\.logoUrl/,
    "the store must fall back from header logo to the master logo"
  );
  assert.match(store, /loginLogoUrl \|\| branding\.logoUrl/, "the login surface must get its logo");
  assert.match(store, /apiClient\.branding\.get\(\)/, "the store must load the saved branding");

  // 3. The app mounts the provider so every surface sees the branding.
  assert.match(app, /<BrandingProvider>/, "the app must mount BrandingProvider");

  // 4. The emblem renders the custom image when one is published, else the vector.
  assert.match(logo, /useBranding\(\)/, "BrandLogo/BrandEmblem must read the branding store");
  assert.match(logo, /<img/, "the emblem must be able to render the custom logo image");
  assert.match(logo, /EjazEmblem size=\{size\}/, "the vector emblem must remain the fallback");

  // 5. Saving in the settings screen pushes the new identity to live surfaces.
  assert.match(settings, /refreshBranding\(\)/, "a save must refresh the live branding store");

  // 6. The welcome screen swaps in the login logo only when one is published.
  assert.match(splash, /loginLogo/, "the welcome screen must honour the published login logo");

  console.log("  ✓ Branding Propagation Tests Passed Successfully!");
}
