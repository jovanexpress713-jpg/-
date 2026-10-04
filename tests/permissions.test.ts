import assert from "assert";
import http from "http";
import type { AddressInfo } from "net";
import { createServerApp } from "../src/server/app";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_CATALOG_PAGES,
  ROLES,
  getRolePermissions,
  hasPermission as registryHas,
  resetRolePermissions,
  setRolePermissions,
  visiblePagesFor,
  visibleSectionsFor,
  getRegistryVersion,
} from "../src/server/services/permissionService";
import { DEFAULT_CLIENT_PERMISSIONS } from "../src/utils/permissions";

/**
 * EJAZ Transport — Dynamic RBAC tests.
 *
 * Proves the permission system is a system, not a convention:
 *  • the catalogue, the defaults and the client mirror stay in step;
 *  • only the system administrator can read or change grants;
 *  • a saved change alters what the API allows — immediately, no redeploy;
 *  • a locked role cannot be restricted (nobody can be locked out);
 *  • every change is audited with its before/after diff;
 *  • financial data is withheld from roles without `finance.view`;
 *  • object-level scoping holds for clients and drivers.
 */

let server: http.Server | null = null;
let baseUrl = "";

const TEARDOWN_ACTOR = { userId: "rbac-suite", fullName: "RBAC suite", role: "SUPER_ADMIN" };

async function startServer(): Promise<string> {
  const app = createServerApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const { port } = server!.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

async function api(
  method: string,
  path: string,
  options: { token?: string | null; body?: any } = {}
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep raw */
  }
  return { status: res.status, body };
}

async function login(email: string, password: string) {
  const res = await api("POST", "/api/auth/login", { body: { email, password } });
  assert.strictEqual(res.status, 200, `sign-in for ${email}: ${JSON.stringify(res.body)}`);
  return { token: res.body.token as string, user: res.body.user };
}

/**
 * Mounts the real <Sidebar> in jsdom and returns everything it rendered.
 *
 * The grant comes from the live `/api/permissions/me` for the signed-in role —
 * the exact payload the console boots from — so a change saved through the admin
 * screen is what this renders, not a hand-written permission list.
 */
async function mountInJsdom(
  render: (deps: any) => any
): Promise<{ text: string; host: any }> {
  const { JSDOM, VirtualConsole } = await import("jsdom");
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", () => {});
  const dom = new JSDOM(`<!doctype html><html lang="ar" dir="rtl"><body></body></html>`, {
    url: "http://localhost/",
    pretendToBeVisual: true,
    virtualConsole,
  });

  const g = globalThis as any;
  const define = (key: string, value: unknown) =>
    Object.defineProperty(g, key, { value, writable: true, configurable: true });
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
  const { FleetStoreProvider } = await import("../src/state/fleetStore");
  const { PermissionProvider } = await import("../src/state/permissionStore");

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host as any);
  const node = await render({ React, SettingsProvider, FleetStoreProvider, PermissionProvider, dom });

  await act(async () => {
    root.render(node);
  });

  const text = host.textContent ?? "";
  return { text, host, unmount: () => act(async () => root.unmount()), close: () => dom.window.close() } as any;
}

/** Builds the exact `initial` grant the console boots from, for a signed-in role. */
async function grantFor(token: string) {
  const me = await api("GET", "/api/permissions/me", { token });
  assert.strictEqual(me.status, 200);
  return {
    role: me.body.role,
    wildcard: !!me.body.wildcard,
    permissions: me.body.permissions as string[],
    pages: me.body.pages as string[],
    sections: me.body.sections as string[],
    version: me.body.version as number,
    canManagePermissions: !!me.body.canManagePermissions,
  };
}

/** Renders the real <Sidebar> exactly as the signed-in role would see it. */
async function renderSidebar(token: string): Promise<string> {
  const initial = await grantFor(token);
  const { Sidebar } = await import("../src/components/Sidebar");
  const mounted = await mountInJsdom(({ React, SettingsProvider, FleetStoreProvider, PermissionProvider }) => {
    return React.createElement(
      SettingsProvider,
      null,
      React.createElement(
        FleetStoreProvider,
        null,
        React.createElement(
          PermissionProvider,
          { initial },
          React.createElement(Sidebar, {
            active: "trips",
            onSelect: () => {},
            counts: { trucks: 4, cargos: 2, repair: 1, drivers: 3, reports: 6 },
            onCreate: () => {},
          })
        )
      )
    );
  });
  const text = mounted.text;
  await mounted.unmount();
  mounted.close();
  return text;
}

/** Renders the real <WebConsole> — the surface that carries the persona bar. */
async function renderConsole(token: string): Promise<string> {
  const initial = await grantFor(token);
  const { WebConsole } = await import("../src/components/WebConsole");
  const mounted = await mountInJsdom(({ React, SettingsProvider, FleetStoreProvider, PermissionProvider }) => {
    return React.createElement(
      SettingsProvider,
      null,
      React.createElement(
        FleetStoreProvider,
        null,
        React.createElement(
          PermissionProvider,
          { initial },
          React.createElement(WebConsole, { page: "trips", onPageChange: () => {} })
        )
      )
    );
  });
  const text = mounted.text;
  await mounted.unmount();
  mounted.close();
  return text;
}

/**
 * The account menu must not carry identity-switching tools for an employee.
 *
 * «التطبيقات» opens the client or driver interface and «معاينة شاشة تسجيل
 * الدخول» renders the sign-in surface; both let a signed-in user step into
 * another identity, so for a role that may not switch accounts they are absent
 * from the menu rather than disabled inside it.
 */
async function renderAccountMenu(token: string): Promise<string> {
  const initial = await grantFor(token);
  const { AccountMenu } = await import("../src/components/AccountMenu");
  const mounted = await mountInJsdom(({ React, SettingsProvider, PermissionProvider }) =>
    React.createElement(
      SettingsProvider,
      null,
      React.createElement(
        PermissionProvider,
        { initial },
        React.createElement(AccountMenu, {
          user: { fullName: "فحص", role: initial.role },
          onOpenSettings: () => {},
          onOpenAssistant: () => {},
          onOpenMobileApp: () => {},
          onPreviewLogin: () => {},
          onLogout: () => {},
        })
      )
    )
  );

  /* The rows only exist once the menu is opened, so open it first. */
  const doc = mounted.host.ownerDocument;
  const trigger = doc.querySelector("button") as HTMLButtonElement | null;
  assert.ok(trigger, "the account menu renders its trigger");
  await trigger!.dispatchEvent(
    new (doc.defaultView as any).MouseEvent("click", { bubbles: true, cancelable: true })
  );
  await new Promise((r) => setTimeout(r, 20));

  const text = mounted.host.textContent ?? "";
  await mounted.unmount();
  mounted.close();
  return text;
}

async function runAccountMenuTests(adminToken: string, opsToken: string) {
  const APPS = "التطبيقات";
  const PREVIEW = "معاينة شاشة تسجيل الدخول";

  const asAdmin = await renderAccountMenu(adminToken);
  assert.ok(asAdmin.includes(APPS), "the administrator keeps the app launcher");
  assert.ok(asAdmin.includes(PREVIEW), "and the sign-in preview");

  const asOps = await renderAccountMenu(opsToken);
  assert.ok(!asOps.includes(APPS), "an operations manager is not offered another identity to open");
  assert.ok(!asOps.includes(PREVIEW), "nor the sign-in preview");
}

/**
 * «نمط التجربة» must not exist for an ordinary employee.
 *
 * The persona bar swaps the console into another identity's portal, so if it
 * renders for everyone then a driver or a client is one click away from the
 * operations console — regardless of what the registry says they may see.
 */
async function runPersonaBarTests(adminToken: string, opsToken: string) {
  const PERSONA_LABEL = "نمط التجربة";

  const asAdmin = await renderConsole(adminToken);
  assert.ok(asAdmin.includes(PERSONA_LABEL), "the administrator keeps the persona bar");

  const asOps = await renderConsole(opsToken);
  assert.ok(
    !asOps.includes(PERSONA_LABEL),
    "an operations manager must not be offered another identity to switch into"
  );
}

/**
 * The sign-in form must let the visitor choose.
 *
 * It used to ship pre-filled with the system administrator's credentials and to
 * sign the visitor in as him when submitted empty — so nobody ever picked an
 * account. Both are asserted away here.
 */
async function runAuthGateTests() {
  const { ConsoleAuthGate } = await import("../src/components/ConsoleAuthGate");
  let authenticated: any = null;

  const mounted = await mountInJsdom(({ React, SettingsProvider }) =>
    React.createElement(SettingsProvider, null, React.createElement(ConsoleAuthGate, {
      onAuthenticated: (user: any) => {
        authenticated = user;
      },
    }))
  );

  const doc = mounted.host.ownerDocument;
  const email = doc.querySelector('input[autocomplete="username"]') as HTMLInputElement | null;
  const password = doc.querySelector('input[autocomplete="current-password"]') as HTMLInputElement | null;

  assert.ok(email && password, "the sign-in form renders its two fields");
  assert.strictEqual(email!.value, "", "no account is pre-selected for the visitor");
  assert.strictEqual(password!.value, "", "and no password is pre-filled");

  /* Submitting an empty form must ask for credentials, not sign anybody in. */
  const form = doc.querySelector("form");
  assert.ok(form, "the form is present");
  await form!.dispatchEvent(
    new (mounted.host.ownerDocument.defaultView as any).Event("submit", { bubbles: true, cancelable: true })
  );
  await new Promise((r) => setTimeout(r, 30));
  assert.strictEqual(authenticated, null, "an empty form never signs the visitor in as the administrator");

  /* The visitor chooses a role; nothing enters the control room for him. */
  const gateText = mounted.text;
  assert.ok(
    !gateText.includes("دخول مباشر للوحة التحكم والإدارة"),
    "there is no one-click entry hardcoded to the system administrator"
  );
  assert.ok(
    gateText.includes("اختر الحساب للدخول"),
    "the sign-in surface offers an explicit choice of account"
  );
  for (const role of ["مدير النظام", "مدير العمليات", "المحاسب المالي", "حساب السائق", "حساب العميل"]) {
    assert.ok(gateText.includes(role), `the role list offers ${role}`);
  }

  await mounted.unmount();
  mounted.close();
}

/** The Arabic labels the sidebar renders, taken from the live i18n table. */
async function navLabels() {
  const { MESSAGES } = await import("../src/localization/i18n");
  const pick = (key: keyof typeof MESSAGES) => (MESSAGES[key] as { ar: string }).ar;
  return {
    trips: pick("nav.trips"),
    fleet: pick("nav.fleet"),
    fleetGroup: pick("nav.fleetGroup"),
    drivers: pick("nav.drivers"),
  };
}

async function runSidebarVisibilityTests(adminToken: string, opsToken: string) {
  const label = await navLabels();
  const defaults = DEFAULT_ROLE_PERMISSIONS.OPERATIONS_MANAGER;
  const save = (permissions: string[]) =>
    api("PUT", "/api/permissions/roles/OPERATIONS_MANAGER", {
      token: adminToken,
      body: { permissions, reason: "فحص واجهة الشريط الجانبي" },
    });

  /* Show page: the full default grant renders the fleet entry. */
  await save(defaults);
  const full = await renderSidebar(opsToken);
  assert.ok(full.includes(label.fleet), "the fleet entry is in the sidebar by default");
  assert.ok(full.includes(label.trips), "and so is trips");

  /* Hide page: revoking vehicles.view removes the entry from the rendered nav. */
  await save(defaults.filter((k) => !k.startsWith("vehicles.")));
  const withoutFleet = await renderSidebar(opsToken);
  assert.ok(!withoutFleet.includes(label.fleet), "the fleet entry disappears from the sidebar");
  assert.ok(withoutFleet.includes(label.trips), "unrelated entries are untouched");
  assert.ok(
    !/لا تملك|غير مسموح|permission denied|not authorized/i.test(withoutFleet),
    "the sidebar hides the entry instead of printing a denial"
  );

  /* Hide section: revoking every page in a section removes the section itself. */
  const fleetSectionKeys = ["vehicles.view", "drivers.view", "registrations.view", "customers.view"];
  await save(defaults.filter((k) => !fleetSectionKeys.includes(k)));
  const withoutSection = await renderSidebar(opsToken);
  assert.ok(!withoutSection.includes(label.fleetGroup), "the whole section heading is gone");
  assert.ok(!withoutSection.includes(label.drivers), "and its child pages with it");
  assert.ok(withoutSection.includes(label.trips), "other sections still render");

  await save(defaults);
}

export async function runPermissionTests() {
  console.log("  [TEST] Running Dynamic RBAC & Permission Registry Tests...");
  baseUrl = await startServer();

  /*
   * Start from the factory state. A run that died mid-suite leaves its
   * revocations in `data/role-permissions.json`, and the registry loads that at
   * boot — so without this the next run would inherit the last run's grants and
   * fail on an assertion that is really about the defaults.
   */
  for (const role of ROLES.filter((r) => !r.locked).map((r) => r.id)) {
    resetRolePermissions(role, TEARDOWN_ACTOR, "suite setup");
  }

  /* ── 1. The client mirror never drifts from the server registry ───────── */
  for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
    const serverSet = new Set(DEFAULT_ROLE_PERMISSIONS[role]);
    const clientSet = new Set(DEFAULT_CLIENT_PERMISSIONS[role] || []);
    for (const key of serverSet) {
      assert.ok(clientSet.has(key), `client mirror is missing ${role}.${key}`);
    }
  }

  /* Every catalogue page resolves to a real permission key, and every page the
     console can navigate to is described in the catalogue. */
  for (const page of PERMISSION_CATALOG_PAGES) {
    assert.ok(page.viewKey, `page ${page.id} must declare the permission that reveals it`);
    assert.ok(page.functions.length > 0, `page ${page.id} must declare at least one function`);
    for (const f of page.functions) {
      assert.match(f.key, /^[a-z]+\.[a-z]+$/, `permission key ${f.key} must be resource.action`);
    }
  }

  /* ── 2. Least privilege in the factory defaults ───────────────────────── */
  assert.ok(!registryHas("OPERATIONS_MANAGER", "finance.view"), "operations must not see money by default");
  assert.ok(!registryHas("OPERATIONS_MANAGER", "permissions.manage"), "operations must not manage permissions");
  assert.ok(!registryHas("ACCOUNTANT", "vehicles.edit"), "the accountant must not edit the fleet");
  assert.ok(!registryHas("DRIVER", "finance.view"), "a driver must not see financial data");
  assert.ok(!registryHas("DRIVER", "users.manage"), "a driver must not manage users");
  assert.ok(!registryHas("CUSTOMER", "drivers.view"), "a client must not see the driver registry");
  assert.ok(!registryHas("CUSTOMER", "finance.settle"), "a client must not settle invoices");
  assert.ok(registryHas("SUPER_ADMIN", "anything.at.all"), "the administrator holds the wildcard");

  /* ── 3. Page / section visibility follows the grant ───────────────────── */
  const opsPages = visiblePagesFor("OPERATIONS_MANAGER");
  assert.ok(opsPages.includes("trips"), "operations sees trips");
  assert.ok(opsPages.includes("fleet"), "operations sees the fleet");
  assert.ok(!opsPages.includes("permissions"), "operations never sees the permissions screen");
  assert.ok(!visibleSectionsFor("OPERATIONS_MANAGER").includes("administration"), "no administration section");

  const acctPages = visiblePagesFor("ACCOUNTANT");
  assert.ok(acctPages.includes("finance"), "the accountant sees finance");
  assert.ok(!acctPages.includes("fleet"), "the accountant does not see the fleet");

  const driverPages = visiblePagesFor("DRIVER");
  assert.ok(driverPages.includes("trips"), "a driver sees their trips");
  assert.ok(!driverPages.includes("drivers"), "a driver does not see the driver registry");
  assert.ok(!driverPages.includes("reports"), "a driver does not see the reports");

  const clientPages = visiblePagesFor("CUSTOMER");
  assert.ok(clientPages.includes("shipments"), "a client sees their shipments");
  assert.ok(!clientPages.includes("drivers"), "a client does not see the driver registry");

  /* ── 4. Sessions ─────────────────────────────────────────────────────── */
  const admin = await login("admin@ejaz.sa", "Ejaz@2026Admin");
  const ops = await login("ops@ejaz.sa", "Ejaz@2026Admin");
  const accountant = await login("finance@ejaz.sa", "Ejaz@2026Admin");
  const driver = await login("driver@ejaz.sa", "Ejaz@2026Driver");
  const client = await login("client@ejaz.sa", "Ejaz@2026Client");
  assert.strictEqual(admin.user.role, "SUPER_ADMIN");
  assert.strictEqual(ops.user.role, "OPERATIONS_MANAGER");
  assert.strictEqual(accountant.user.role, "ACCOUNTANT");

  /* ── 5. /me answers per role ─────────────────────────────────────────── */
  const meAdmin = await api("GET", "/api/permissions/me", { token: admin.token });
  assert.strictEqual(meAdmin.status, 200);
  assert.strictEqual(meAdmin.body.wildcard, true, "the administrator holds the wildcard");
  assert.strictEqual(meAdmin.body.canManagePermissions, true);

  const meOps = await api("GET", "/api/permissions/me", { token: ops.token });
  assert.strictEqual(meOps.body.canManagePermissions, false, "operations cannot manage permissions");
  assert.ok(!meOps.body.permissions.includes("finance.view"), "operations carries no financial permission");

  const meDriver = await api("GET", "/api/permissions/me", { token: driver.token });
  assert.ok(!meDriver.body.pages.includes("drivers"), "the driver's page list excludes the driver registry");

  /* ── 6. Administration endpoints are administrator-only ──────────────── */
  for (const [label, session] of [
    ["operations", ops.token],
    ["accountant", accountant.token],
    ["driver", driver.token],
    ["client", client.token],
  ] as const) {
    const cat = await api("GET", "/api/permissions/catalog", { token: session });
    assert.strictEqual(cat.status, 403, `${label} must not read the permission catalogue`);
    const roles = await api("GET", "/api/permissions/roles", { token: session });
    assert.strictEqual(roles.status, 403, `${label} must not read the role list`);
    const save = await api("PUT", "/api/permissions/roles/DRIVER", {
      token: session,
      body: { permissions: ["*"] },
    });
    assert.strictEqual(save.status, 403, `${label} must not be able to grant permissions`);
  }

  const anon = await api("GET", "/api/permissions/catalog");
  assert.strictEqual(anon.status, 401, "the catalogue requires a session");

  /* ── 7. The administrator reads the catalogue and the roles ──────────── */
  const catalog = await api("GET", "/api/permissions/catalog", { token: admin.token });
  assert.strictEqual(catalog.status, 200);
  assert.ok(catalog.body.sections.length >= 5, "the catalogue describes every section");
  assert.ok(catalog.body.pages.length >= 15, "the catalogue describes every page");
  assert.strictEqual(catalog.body.roles.length, ROLES.length);

  const roleList = await api("GET", "/api/permissions/roles", { token: admin.token });
  assert.strictEqual(roleList.status, 200);
  const coreIds = roleList.body.roles.filter((r: any) => r.core).map((r: any) => r.id);
  for (const expected of ["SUPER_ADMIN", "OPERATIONS_MANAGER", "ACCOUNTANT", "DRIVER", "CUSTOMER"]) {
    assert.ok(coreIds.includes(expected), `${expected} is one of the five core roles`);
  }

  /* ── 8. The administrator's own role is locked ───────────────────────── */
  const lockSelf = await api("PUT", "/api/permissions/roles/SUPER_ADMIN", {
    token: admin.token,
    body: { permissions: [] },
  });
  assert.strictEqual(lockSelf.status, 409, "the administrator can never be restricted");
  assert.strictEqual(lockSelf.body.code, "ROLE_LOCKED");

  /* ── 9. Unknown permissions and roles are refused ────────────────────── */
  const bogus = await api("PUT", "/api/permissions/roles/OPERATIONS_MANAGER", {
    token: admin.token,
    body: { permissions: ["trips.view", "made.up"] },
  });
  assert.strictEqual(bogus.status, 400, "an unknown permission key must be refused");

  const noRole = await api("PUT", "/api/permissions/roles/NOT_A_ROLE", {
    token: admin.token,
    body: { permissions: [] },
  });
  assert.strictEqual(noRole.status, 404);

  /* ── 10. Revoking a page hides it AND blocks the API ─────────────────── */
  const beforeFleet = await api("GET", "/api/vehicles", { token: ops.token });
  assert.strictEqual(beforeFleet.status, 200, "operations may read the fleet by default");

  const versionBefore = getRegistryVersion();
  const revoke = await api("PUT", "/api/permissions/roles/OPERATIONS_MANAGER", {
    token: admin.token,
    body: {
      permissions: getRolePermissions("OPERATIONS_MANAGER").filter((k) => !k.startsWith("vehicles.")),
      reason: "إخفاء الأسطول عن مدير العمليات للاختبار",
    },
  });
  assert.strictEqual(revoke.status, 200, `revoking vehicles.*: ${JSON.stringify(revoke.body)}`);
  assert.ok(revoke.body.removed.includes("vehicles.view"), "the diff reports what was removed");
  assert.ok(getRegistryVersion() > versionBefore, "the registry version moves on save");

  const afterFleet = await api("GET", "/api/vehicles", { token: ops.token });
  assert.strictEqual(afterFleet.status, 403, "the API refuses the fleet once the permission is gone");

  const meAfter = await api("GET", "/api/permissions/me", { token: ops.token });
  assert.ok(!meAfter.body.pages.includes("fleet"), "the fleet page disappears from the role's page list");
  assert.ok(!meAfter.body.pages.includes("vehicle-assets"), "and every page that depended on it");
  assert.ok(meAfter.body.pages.includes("trips"), "unrelated pages are untouched");

  /* A function-level revocation: keep the page, drop the edit. */
  const revokeEdit = await api("PUT", "/api/permissions/roles/OPERATIONS_MANAGER", {
    token: admin.token,
    body: {
      permissions: getRolePermissions("OPERATIONS_MANAGER").filter((k) => k !== "trips.edit"),
      reason: "منع تعديل الرحلة مع الإبقاء على العرض",
    },
  });
  assert.strictEqual(revokeEdit.status, 200);
  const meEdit = await api("GET", "/api/permissions/me", { token: ops.token });
  assert.ok(meEdit.body.permissions.includes("trips.view"), "viewing the trip survives");
  assert.ok(!meEdit.body.permissions.includes("trips.edit"), "editing it does not");
  assert.ok(meEdit.body.pages.includes("trips"), "the page itself stays visible");

  /* ── 11. Granting it back restores access ────────────────────────────── */
  const restore = await api("PUT", "/api/permissions/roles/OPERATIONS_MANAGER", {
    token: admin.token,
    body: { permissions: DEFAULT_ROLE_PERMISSIONS.OPERATIONS_MANAGER },
    reason: "إعادة الصلاحيات",
  });
  assert.strictEqual(restore.status, 200);
  const fleetAgain = await api("GET", "/api/vehicles", { token: ops.token });
  assert.strictEqual(fleetAgain.status, 200, "access returns as soon as the permission is granted again");

  /* ── 12. Every change is audited with its before/after ───────────────── */
  const audit = await api("GET", "/api/permissions/audit", { token: admin.token });
  assert.strictEqual(audit.status, 200);
  const entries = audit.body.entries.filter((e: any) => e.entityId === "OPERATIONS_MANAGER");
  assert.ok(entries.length >= 3, "each save produced an audit entry");
  const times = entries.map((e: any) => Date.parse(e.timestamp));
  assert.ok(
    times.every((t: number, i: number) => i === 0 || t <= times[i - 1]),
    "the change log is newest first — the administrator must see the latest change, not the oldest"
  );
  const first = entries[0];
  assert.ok(first.actorName, "the audit names the administrator who acted");
  assert.ok(Array.isArray(first.oldValues?.permissions), "the audit keeps the previous grant");
  assert.ok(Array.isArray(first.newValues?.permissions), "the audit keeps the new grant");
  assert.ok(first.timestamp, "the audit is timestamped");

  const auditDenied = await api("GET", "/api/permissions/audit", { token: ops.token });
  assert.strictEqual(auditDenied.status, 403, "the change log is administrator-only");

  /* ── 13. Reset returns to the factory defaults ───────────────────────── */
  await api("PUT", "/api/permissions/roles/ACCOUNTANT", {
    token: admin.token,
    body: { permissions: ["finance.view"] },
  });
  const stripped = await api("GET", "/api/permissions/me", { token: accountant.token });
  assert.ok(!stripped.body.permissions.includes("finance.settle"), "the accountant lost settlement");

  const reset = await api("POST", "/api/permissions/roles/ACCOUNTANT/reset", { token: admin.token });
  assert.strictEqual(reset.status, 200);
  const afterReset = await api("GET", "/api/permissions/me", { token: accountant.token });
  assert.ok(afterReset.body.permissions.includes("finance.settle"), "the reset restores the default grant");

  /* ── 14. Financial data is withheld, not merely hidden ───────────────── */
  const opsTrips = await api("GET", "/api/trips", { token: ops.token });
  assert.strictEqual(opsTrips.body.financialsVisible, false, "operations is told the money is withheld");
  for (const trip of opsTrips.body.trips) {
    assert.strictEqual(trip.tripPrice, undefined, "no trip price reaches a role without finance.view");
    assert.strictEqual(trip.financialsRedacted, true, "the payload says it was redacted");
  }

  const acctTrips = await api("GET", "/api/trips", { token: accountant.token });
  assert.strictEqual(acctTrips.body.financialsVisible, true);
  assert.ok(
    acctTrips.body.trips.some((t: any) => typeof t.tripPrice === "number"),
    "the accountant does receive trip prices"
  );

  /* ── 15. Object-level scoping holds ──────────────────────────────────── */
  const allTrips = await api("GET", "/api/trips", { token: admin.token });
  const foreign = allTrips.body.trips.find((t: any) => t.customerId !== "cust-1");
  if (foreign) {
    const peek = await api("GET", `/api/trips/${foreign.id}`, { token: client.token });
    assert.strictEqual(peek.status, 403, "a client cannot open another customer's shipment");
    const byNumber = await api("GET", `/api/trips/${foreign.tripNumber}`, { token: client.token });
    assert.strictEqual(byNumber.status, 403, "nor by guessing its trip number");
  }
  const clientOwn = await api("GET", "/api/client/trips", { token: client.token });
  assert.ok(
    clientOwn.body.trips.every((t: any) => t.customerId === "cust-1"),
    "the client list contains only their own shipments"
  );

  const driverOwn = await api("GET", "/api/driver/trips", { token: driver.token });
  assert.strictEqual(driverOwn.status, 200, "the driver list is reachable");

  /* ── 16. A role cannot escalate itself ───────────────────────────────── */
  const selfEscalate = await api("PUT", "/api/permissions/roles/OPERATIONS_MANAGER", {
    token: ops.token,
    body: { permissions: ["*"] },
  });
  assert.strictEqual(selfEscalate.status, 403, "operations cannot grant itself anything");

  /* ── 17. The real console actually hides what was revoked ──────────────
     Server-side denial is necessary but not sufficient: the brief requires the
     entry to be absent from the sidebar entirely, never shown with a "you don't
     have permission" note. This mounts the real <Sidebar> in jsdom with the real
     `/me` answer the console would receive, so the same code path the user sees
     is the one under test. */
  await runSidebarVisibilityTests(admin.token, ops.token);
  await runPersonaBarTests(admin.token, ops.token);
  await runAccountMenuTests(admin.token, ops.token);
  await runAuthGateTests();

  /* ── 18. Restore the registry so later suites see the factory state ──── */
  for (const role of ROLES.filter((r) => !r.locked).map((r) => r.id)) {
    resetRolePermissions(role, TEARDOWN_ACTOR, "test teardown");
  }
  assert.deepStrictEqual(
    getRolePermissions("OPERATIONS_MANAGER").sort(),
    DEFAULT_ROLE_PERMISSIONS.OPERATIONS_MANAGER.slice().sort(),
    "teardown restores the factory defaults"
  );
  const versionProbe = await api("GET", "/api/permissions/changes", { token: ops.token });
  assert.strictEqual(versionProbe.status, 200);
  assert.ok(versionProbe.body.version >= 1, "the version probe answers for any signed-in user");

  /* The unit-level API agrees with the HTTP surface. */
  const saved = setRolePermissions(
    "DRIVER",
    ["trips.view", "pod.create"],
    { userId: "u-admin", fullName: "مدير النظام", role: "SUPER_ADMIN" },
    "unit check"
  );
  assert.ok(saved.ok);
  assert.ok(saved.added!.length + saved.removed!.length > 0, "the diff is reported");
  assert.strictEqual(registryHas("DRIVER", "finance.view"), false);
  resetRolePermissions("DRIVER", TEARDOWN_ACTOR, "unit teardown");
  assert.deepStrictEqual(
    getRolePermissions("DRIVER").sort(),
    DEFAULT_ROLE_PERMISSIONS.DRIVER.slice().sort()
  );

  await new Promise<void>((resolve) => server!.close(() => resolve()));
  console.log("  ✓ Dynamic RBAC & Permission Registry Tests Passed Successfully!");
}
