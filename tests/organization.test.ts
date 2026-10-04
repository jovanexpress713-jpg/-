import assert from "assert";
import fs from "fs";
import path from "path";

/**
 * Organization & app-separation contracts (§1-§16, §17-§26, §32-§33).
 *
 * Static/contract checks (no live server): mobile header separation, account
 * menu §6 rows, RBAC on create endpoints, dedup codes, the four approved truck
 * types, trip-number generator, honest GPS states, report exports, and the
 * single-backend rule (§12).
 */

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const files = (...ps: string[]) => ps.map((p) => read(p));

export async function runOrganizationTests(): Promise<void> {
  console.log("  [TEST] Running Organization & App Separation Tests...");

  // ── 1. Mobile header separation (§3) ─────────────────────────────────
  const [appShell, driverShell, clientShell, sharedShell] = files(
    "src/mobile/MobileApp.tsx",
    "src/mobile/DriverMode.tsx",
    "src/mobile/ClientMode.tsx",
    "src/mobile/MobileShared.tsx",
  );
  const mobileShell = [appShell, driverShell, clientShell, sharedShell].join("\n");

  // The shell header owns no clock — timestamps only exist as POD/audit
  // record data (`timestamp:`), never as a live header clock.
  assert.ok(!appShell.includes("toLocaleTimeString"), "mobile shell must hide the clock");
  for (const src of [driverShell, clientShell, sharedShell]) {
    for (const line of src.split("\n")) {
      if (line.includes("toLocaleTimeString")) {
        assert.ok(line.includes("timestamp"), `live clock forbidden in the mobile shell: ${line.trim()}`);
      }
    }
  }
  for (const forbidden of ["LanguageList", "ThemeSwitcher", "RoleSwitcher", "user-switcher"]) {
    assert.ok(!mobileShell.includes(forbidden), `mobile shell must not contain ${forbidden}`);
  }

  // ── 2. Dashboard account menu rows (§6) ──────────────────────────────
  const menu = read("src/components/AccountMenu.tsx");
  for (const row of ["حسابي", "الإعدادات", "مساعد إيجاز الذكي", "المساعدة والدعم", "تسجيل الخروج"]) {
    assert.ok(menu.includes(row), `account menu is missing the row «${row}»`);
  }

  // «دخول لوحة التحكم» must NOT exist anywhere in the dashboard shell
  for (const src of files("src/App.tsx", "src/components/AppHeader.tsx", "src/components/ConsoleAuthGate.tsx")) {
    assert.ok(!src.includes("دخول لوحة التحكم"), "no «دخول لوحة التحكم» button may exist");
  }

  // login preview is a preview-only surface: the settings tab opens it, and
  // ConsoleAuthGate in previewMode hides every entry button (§11)
  const settingsCenter = read("src/components/SettingsCenter.tsx");
  const consoleGate = read("src/components/ConsoleAuthGate.tsx");
  assert.ok(settingsCenter.includes("loginPreview"), "settings must expose the login preview tab");
  assert.ok(consoleGate.includes("previewMode"), "the login preview runs in preview mode");
  assert.ok(!/previewMode[\s\S]{0,4000}دخول لوحة التحكم/.test(consoleGate), "the preview shows no entry buttons");
  assert.ok(/\{!previewMode &&/.test(consoleGate), "entry buttons are gated behind previewMode");

  // ── 3. RBAC on create endpoints (§13) ────────────────────────────────
  const driversRoute = read("src/server/routes/driverRoutes.ts");
  const customersRoute = read("src/server/routes/customerRoutes.ts");
  assert.ok(/requirePermission\("drivers\.create"\)/.test(driversRoute), "POST /api/drivers requires drivers.create");
  assert.ok(
    /requirePermission\("customers\.create", "customers\.manage"\)/.test(customersRoute),
    "POST /api/customers requires customers.create|customers.manage",
  );

  // ── 4. Dedup (§19) + lifecycle (§21) ─────────────────────────────────
  const reg = read("src/server/services/registrationService.ts");
  for (const code of [
    "PHONE_ALREADY_REGISTERED",
    "EMAIL_ALREADY_REGISTERED",
    "NATIONAL_ID_ALREADY_REGISTERED",
    "COMMERCIAL_REG_ALREADY_REGISTERED",
  ]) {
    assert.ok(reg.includes(code), `registration service must enforce ${code}`);
  }
  for (const state of ["PENDING_REVIEW", "APPROVED", "REJECTED", "decisionReason"]) {
    assert.ok(reg.includes(state), `registration lifecycle must persist ${state}`);
  }

  // ── 5. Four approved truck types only (§23) ──────────────────────────
  const types = read("src/data/vehicleTypes.ts");
  for (const ar of ["براد", "سطحة", "جاف", "ستارة"]) {
    assert.ok(types.includes(ar), `truck type «${ar}» must exist`);
  }
  const ids = [...types.matchAll(/^\s*id: "(flatbed|reefer|dry|curtain)",/gm)];
  assert.strictEqual(ids.length, 4, `exactly 4 truck types are allowed, found ${ids.length}`);

  // ── 6. Trip number generator (§22) ───────────────────────────────────
  const gen = read("src/server/services/tripNumberGenerator.ts");
  assert.ok(gen.includes("EJ-YYYY-XXXXXX"), "trip numbers follow the EJ-YYYY-XXXXXX format");
  assert.ok(gen.includes("generateTripNumber"), "the generator is the single source for trip numbers");
  assert.ok(/EJ-\\\$\{year\}-\\\$\{seqStr\}/.test(gen.replace(/`/g, "`")) || gen.includes("EJ-${year}-${seqStr}"), "numbering is sequential");

  // ── 7. Honest GPS (§24) — no fake live tracking ──────────────────────
  const [driver, client, live, map, switcher] = files(
    "src/mobile/DriverMode.tsx",
    "src/mobile/ClientMode.tsx",
    "src/components/LiveOperationsCenter.tsx",
    "src/components/InteractiveMap.tsx",
    "src/components/RoleSwitcher.tsx",
  );
  assert.ok(driver.includes("خدمة GPS غير مهيأة"), "driver app shows «خدمة GPS غير مهيأة»");
  assert.ok(client.includes("خدمة GPS غير مهيأة"), "client app shows «خدمة GPS غير مهيأة»");
  assert.ok(live.includes("خدمة GPS غير مهيأة"), "operations center shows «خدمة GPS غير مهيأة»");
  assert.ok(!switcher.includes("Live GPS Engine Running"), "no fake «Live GPS» claim in the console");
  assert.ok(!map.includes("Live GPS"), "no fake «Live GPS» claim on the map");

  // ── 8. Reports: real data + exports + filters (§25) ──────────────────
  const reports = read("src/components/AnalyticsReports.tsx");
  assert.ok(reports.includes("PDF"), "reports export PDF");
  assert.ok(reports.includes("Excel"), "reports export Excel");
  assert.ok(reports.includes("window.print()"), "reports export Print");
  for (const filter of ["Trip number", "Customer", "Driver", "Vehicle", "Month", "Year", "Status", "Min revenue", "Payments"]) {
    assert.ok(reports.includes(filter), `reports filter «${filter}» must exist`);
  }
  assert.ok(reports.includes("apiClient.reports.getSummary()"), "reports read real data from the API");

  // ── 9. Settings: account / app / system + system appearance (§7-§9) ──
  for (const tab of ['"account"', '"app"', '"system"']) {
    assert.ok(settingsCenter.includes(tab), `settings center must include the ${tab} tab`);
  }
  const appSettings = read("src/mobile/MobileAppSettings.tsx");
  assert.ok(appSettings.includes("system"), "appearance supports light / dark / system");

  // ── 10. Single backend / auth / RBAC (§12) ───────────────────────────
  assert.ok(fs.existsSync(path.join(root, "src", "server", "auth", "middleware.ts")), "one shared auth layer");
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : [full];
    });
  const suspicious = walk(path.join(root, "src")).filter((f) =>
    /\/(auth|db|database)Store\.ts$|\/firebase|\/supabase|\/prisma/i.test(f),
  );
  assert.deepStrictEqual(suspicious, [], "no second backend / auth / database may exist");

  // ── 11. Add-driver/customer share the same endpoints (§17, §18) ──────
  const [mgmt, regFlow, driversMgr] = files(
    "src/mobile/MobileUserManagement.tsx",
    "src/mobile/RegistrationFlow.tsx",
    "src/components/DriversManager.tsx",
  );
  assert.ok(mgmt.includes("apiClient.drivers.create"), "mobile management uses the shared drivers API");
  assert.ok(mgmt.includes("apiClient.customers.create"), "mobile management uses the shared customers API");
  assert.ok(regFlow.includes("apiClient.registrations"), "the self-registration flow shares the same lifecycle");
  // The review queue exists in exactly ONE place (no duplication, §28/§32)
  const webConsole = read("src/components/WebConsole.tsx");
  assert.ok(webConsole.includes("<RegistrationRequestsManager />"), "the review queue lives in the registrations section");
  assert.ok(!driversMgr.includes("<RegistrationRequestsManager"), "the review queue is not duplicated on the drivers page");

  console.log("  ✅ Organization & App Separation Tests Passed.");
}
