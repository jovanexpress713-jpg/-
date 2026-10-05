/**
 * Client-side capability model.
 *
 * Two layers, one direction of truth:
 *
 *  1. `DEFAULT_CLIENT_PERMISSIONS` — the factory grants, mirrored from the
 *     server registry (`src/server/services/permissionService.ts`). Used ONLY as
 *     the offline/pre-hydration fallback so the shell is never blank.
 *  2. `usePermissions()` (state/permissionStore) — the LIVE grant fetched from
 *     `/api/permissions/me`. Every screen, menu, tab and button asks it.
 *
 * The server re-checks every permission on every request; nothing here is a
 * security boundary, it only decides what is rendered.
 */

export type ApiRole =
  | "SUPER_ADMIN"
  | "GENERAL_MANAGER"
  | "OPERATIONS_MANAGER"
  | "DISPATCHER"
  | "ACCOUNTANT"
  | "DRIVER"
  | "CUSTOMER"
  | "CLIENT"
  | "WAREHOUSE"
  | "BROKER"
  | "CUSTOMS_BROKER"
  | "REPRESENTATIVE";

export interface SessionUser {
  id?: string;
  email?: string;
  fullName?: string;
  phone?: string;
  role?: string;
  permissions?: string[];
  accountApproved?: boolean;
  driverId?: string;
  customerId?: string;
  preferredLanguage?: string;
}

/** Capabilities the console asks about (superset of the server's strings). */
export type Capability =
  | "overview.view"
  | "trips.view"
  | "trips.create"
  | "trips.edit"
  | "trips.delete"
  | "trips.assign"
  | "trips.transition"
  | "trips.approve"
  | "trips.cancel"
  | "trips.reopen"
  | "trips.request"
  | "trips.track"
  | "trips.manage"
  | "vehicles.view"
  | "vehicles.create"
  | "vehicles.edit"
  | "vehicles.assign"
  | "vehicles.delete"
  | "vehicles.manage"
  | "assets.view"
  | "assets.upload"
  | "drivers.view"
  | "drivers.create"
  | "drivers.edit"
  | "drivers.delete"
  | "drivers.manage"
  | "customers.view"
  | "customers.create"
  | "customers.manage"
  | "tariffs.view"
  | "tariffs.manage"
  | "registrations.view"
  | "registrations.review"
  | "finance.view"
  | "finance.create"
  | "finance.settle"
  | "finance.pay"
  | "finance.approve"
  | "invoices.view"
  | "payments.record"
  | "claims.view"
  | "claims.create"
  | "claims.manage"
  | "reports.view"
  | "reports.export"
  | "reports.print"
  | "audit.view"
  | "permissions.manage"
  | "users.view"
  | "users.manage"
  | "settings.manage"
  | "branding.manage"
  | "documents.view"
  | "documents.upload"
  | "documents.download"
  | "pod.view"
  | "pod.create"
  | "gps.view"
  | "gps.configure"
  | "notifications.view"
  | "assistant.act"
  | (string & {});

/**
 * Factory grants — mirror of the server's DEFAULT_ROLE_PERMISSIONS.
 * Kept in sync by `tests/permissions.test.ts`, which fails if the two drift.
 */
export const DEFAULT_CLIENT_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  GENERAL_MANAGER: [
    "overview.view",
    "trips.view", "trips.approve", "trips.cancel", "trips.reopen", "trips.assign", "trips.track",
    "finance.view", "finance.approve", "finance.settle", "claims.view", "claims.manage",
    "tariffs.view", "tariffs.manage",
    "customers.view", "customers.create", "customers.manage",
    "notifications.view", "pod.view",
    "vehicles.view", "drivers.view", "drivers.create", "gps.view",
    "reports.view", "reports.export", "reports.print", "audit.view",
    "settings.manage", "registrations.view", "registrations.review", "users.view",
  ],
  OPERATIONS_MANAGER: [
    "overview.view",
    "trips.view", "trips.create", "trips.edit", "trips.assign", "trips.transition",
    "trips.cancel", "trips.approve", "trips.track", "trips.request",
    "tariffs.view", "tariffs.manage",
    "claims.view", "claims.manage",
    "customers.view", "customers.create", "customers.manage",
    "notifications.view", "pod.view", "pod.create",
    "vehicles.view", "vehicles.create", "vehicles.edit", "vehicles.assign",
    "drivers.view", "drivers.create", "drivers.edit",
    "gps.view", "documents.view", "documents.upload", "documents.download",
    "registrations.view", "registrations.review", "assets.view",
  ],
  ACCOUNTANT: [
    "finance.view", "finance.create", "finance.approve", "finance.settle", "finance.pay",
    "invoices.view", "payments.record",
    "tariffs.view", "tariffs.manage",
    "claims.view", "claims.manage",
    "trips.view", "customers.view", "notifications.view", "pod.view",
    "reports.view", "reports.export", "reports.print", "audit.view",
  ],
  DRIVER: [
    "trips.view", "trips.transition", "trips.request", "trips.track",
    "pod.create", "pod.view", "documents.upload", "documents.view",
    "gps.view", "notifications.view",
  ],
  CUSTOMER: [
    "trips.view", "trips.create", "trips.track",
    "documents.view", "documents.download",
    "claims.create", "claims.view",
    "invoices.view", "notifications.view", "pod.view",
  ],
  CLIENT: [
    "trips.view", "trips.create", "trips.track",
    "documents.view", "documents.download",
    "claims.create", "claims.view",
    "invoices.view", "notifications.view", "pod.view",
  ],
  DISPATCHER: [
    "overview.view",
    "trips.view", "trips.create", "trips.edit", "trips.assign", "trips.transition", "trips.track",
    "tariffs.view", "vehicles.view", "vehicles.assign", "drivers.view", "gps.view",
    "documents.view", "documents.upload", "customers.view", "notifications.view", "pod.view",
  ],
  WAREHOUSE: [
    "trips.view", "loading.record", "documents.view", "documents.upload",
    "notifications.view", "pod.view", "pod.create",
  ],
  BROKER: [
    "trips.view", "trips.create", "documents.view", "customers.view", "customers.create",
    "notifications.view",
  ],
  CUSTOMS_BROKER: ["trips.view", "documents.upload", "documents.view", "notifications.view"],
  REPRESENTATIVE: ["trips.view", "documents.view", "notifications.view"],
};

/* ── The navigation registry ──────────────────────────────────────────────
 * One table describes every console page: which section it belongs to, its
 * i18n labels, and the permission that makes it visible. The sidebar, the page
 * router, the global search and the settings shortcuts all read this — so a
 * permission change hides a page everywhere at once.
 */

export interface NavPage {
  id: string;
  sectionId: string;
  titleKey: string;
  hintKey?: string;
  /** Permission required to see the page at all. */
  viewKey: string;
}

export const NAV_SECTIONS: { id: string; labelKey: string }[] = [
  { id: "operations", labelKey: "nav.operations" },
  { id: "fleet", labelKey: "nav.fleetGroup" },
  { id: "finance", labelKey: "nav.finance" },
  { id: "insights", labelKey: "nav.insights" },
  { id: "identity", labelKey: "nav.identity" },
];

export const NAV_PAGES: NavPage[] = [
  { id: "overview", sectionId: "operations", titleKey: "nav.overview", hintKey: "nav.operations", viewKey: "overview.view" },
  { id: "operations", sectionId: "operations", titleKey: "nav.operationsCenter", hintKey: "nav.tracking", viewKey: "gps.view" },
  { id: "trips", sectionId: "operations", titleKey: "nav.trips", hintKey: "nav.operations", viewKey: "trips.view" },
  { id: "shipments", sectionId: "operations", titleKey: "nav.shipments", hintKey: "nav.operations", viewKey: "trips.view" },
  { id: "tariffs", sectionId: "operations", titleKey: "nav.tariffs", hintKey: "nav.tariffsHint", viewKey: "tariffs.view" },
  { id: "tracking", sectionId: "operations", titleKey: "nav.tracking", hintKey: "nav.operations", viewKey: "gps.view" },

  { id: "fleet", sectionId: "fleet", titleKey: "nav.fleet", hintKey: "nav.fleetGroup", viewKey: "vehicles.view" },
  { id: "vehicle-assets", sectionId: "fleet", titleKey: "nav.vehicleAssets", hintKey: "nav.fleetGroup", viewKey: "vehicles.view" },
  { id: "drivers", sectionId: "fleet", titleKey: "nav.drivers", hintKey: "nav.fleetGroup", viewKey: "drivers.view" },
  { id: "customers", sectionId: "fleet", titleKey: "nav.customers", hintKey: "nav.customersHint", viewKey: "customers.view" },
  { id: "registrations", sectionId: "fleet", titleKey: "nav.registrations", hintKey: "nav.fleetGroup", viewKey: "registrations.view" },

  { id: "reports", sectionId: "finance", titleKey: "nav.reports", hintKey: "nav.insights", viewKey: "reports.view" },
  { id: "analysis", sectionId: "insights", titleKey: "nav.analysis", hintKey: "nav.insights", viewKey: "reports.view" },
  { id: "history", sectionId: "insights", titleKey: "nav.history", hintKey: "nav.insights", viewKey: "audit.view" },

  { id: "chats", sectionId: "operations", titleKey: "nav.chats", hintKey: "nav.operations", viewKey: "trips.view" },
  { id: "settings", sectionId: "identity", titleKey: "nav.settings", hintKey: "nav.identity", viewKey: "notifications.view" },
  { id: "branding", sectionId: "identity", titleKey: "nav.branding", hintKey: "nav.identity", viewKey: "branding.manage" },
];

/** Legacy aliases the console can still be addressed by. */
export const NAV_ALIASES: Record<string, string> = {
  trucks: "fleet",
  repair: "fleet",
  cargos: "shipments",
  dashboard: "overview",
};

export function resolveNavPage(id: string): NavPage | undefined {
  const canonical = NAV_ALIASES[id] ?? id;
  return NAV_PAGES.find((p) => p.id === canonical);
}

export function isDriverRole(role?: string) {
  return role === "DRIVER";
}
export function isClientRole(role?: string) {
  return role === "CUSTOMER" || role === "CLIENT";
}
export function isStaffRole(role?: string) {
  return !!role && !isDriverRole(role) && !isClientRole(role);
}

/**
 * Static fallback check.
 *
 * Prefer `usePermissions().can()` — it reflects what the administrator has
 * actually granted. This function answers from the session's own permission
 * list (minted by the server at sign-in) and falls back to the factory map, so
 * code that only has the session object still behaves sensibly.
 */
export function can(user: SessionUser | null | undefined, capability: Capability): boolean {
  if (!user) return false;
  if (Array.isArray(user.permissions)) {
    if (user.permissions.includes("*")) return true;
    if (user.permissions.includes(capability)) return true;
  }
  const granted = DEFAULT_CLIENT_PERMISSIONS[user.role || ""];
  if (!granted) return false;
  return granted.includes("*") || granted.includes(capability);
}

/** Console personas (the role switch inside the control room). */
const PERSONA_CAPABILITIES: Record<string, string[] | "*"> = {
  admin: "*",
  driver: DEFAULT_CLIENT_PERMISSIONS.DRIVER,
  shipper: DEFAULT_CLIENT_PERMISSIONS.CUSTOMER,
  owner: ["trips.view", "vehicles.view", "reports.view", "notifications.view", "finance.view"],
};

export function canPersona(persona: string, capability: Capability): boolean {
  const granted = PERSONA_CAPABILITIES[persona];
  if (granted === "*") return true;
  return Array.isArray(granted) && granted.includes(capability);
}

/**
 * Demo/role switching is a Super Admin (and explicit-permission) affordance
 * only: an operations user must never be able to hop into another identity.
 */
export function canSwitchAccounts(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN") return true;
  return Array.isArray(user.permissions) && user.permissions.includes("accounts.switch");
}

/** Sensitive actions the assistant must confirm before executing. */
export const SENSITIVE_ACTIONS: Capability[] = [
  "trips.edit",
  "trips.delete",
  "vehicles.edit",
  "vehicles.delete",
  "branding.manage",
  "settings.manage",
  "permissions.manage",
];
