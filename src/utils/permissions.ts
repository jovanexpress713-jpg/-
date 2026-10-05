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
  | "REPRESENTATIVE"
  | (string & {});

export type DataScope = "OWN" | "ASSIGNED" | "BRANCH" | "REGION" | "TEAM" | "ALL";

export interface SessionUser {
  id?: string;
  email?: string;
  fullName?: string;
  phone?: string;
  role?: string;
  permissions?: string[];
  dataScope?: DataScope;
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
  | "trips.reject"
  | "trips.cancel"
  | "trips.reopen"
  | "trips.request"
  | "trips.track"
  | "trips.export"
  | "trips.print"
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
  | "customers.edit"
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
  | "finance.postapprove"
  | "finance.delete"
  | "revenue.edit"
  | "expenses.edit"
  | "commissions.edit"
  | "invoices.view"
  | "invoices.create"
  | "invoices.edit"
  | "invoices.approve"
  | "invoices.reject"
  | "invoices.issue"
  | "invoices.cancel"
  | "invoices.print"
  | "invoices.download"
  | "settlements.view"
  | "settlements.create"
  | "settlements.edit"
  | "settlements.approve"
  | "settlements.reject"
  | "settlements.reopen"
  | "settlements.export"
  | "settlements.print"
  | "payments.view"
  | "payments.record"
  | "payments.edit"
  | "payments.cancel"
  | "payments.receive"
  | "review.view"
  | "review.perform"
  | "review.approve"
  | "review.reject"
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
  | "documents.verify"
  | "pod.view"
  | "pod.create"
  | "pod.verify"
  | "gps.view"
  | "gps.configure"
  | "notifications.view"
  | "assistant.act"
  | (string & {});

/** Canonical uppercase alias map mirrored from the server registry. */
export const PERMISSION_ALIASES: Record<string, string> = {
  VIEW_OVERVIEW: "overview.view",
  VIEW_TRIPS: "trips.view",
  CREATE_TRIP: "trips.create",
  EDIT_TRIP: "trips.edit",
  DELETE_TRIP: "trips.delete",
  ASSIGN_DRIVER: "trips.assign",
  CHANGE_DRIVER: "trips.assign",
  ASSIGN_TRUCK: "trips.assign",
  CHANGE_TRUCK: "trips.assign",
  TRANSITION_TRIP: "trips.transition",
  APPROVE_TRIP: "trips.approve",
  REJECT_TRIP: "trips.reject",
  CANCEL_TRIP: "trips.cancel",
  REOPEN_TRIP: "trips.reopen",
  EXPORT_TRIPS: "trips.export",
  PRINT_TRIPS: "trips.print",
  TRACK_TRIP: "trips.track",
  REQUEST_TRIP: "trips.request",

  VIEW_FLEET: "vehicles.view",
  VIEW_VEHICLES: "vehicles.view",
  CREATE_VEHICLE: "vehicles.create",
  EDIT_VEHICLE: "vehicles.edit",
  DELETE_VEHICLE: "vehicles.delete",
  ASSIGN_VEHICLE: "vehicles.assign",

  VIEW_DRIVERS: "drivers.view",
  CREATE_DRIVER: "drivers.create",
  EDIT_DRIVER: "drivers.edit",
  DELETE_DRIVER: "drivers.delete",

  VIEW_CUSTOMERS: "customers.view",
  CREATE_CUSTOMER: "customers.create",
  EDIT_CUSTOMER: "customers.edit",
  MANAGE_CUSTOMERS: "customers.manage",
  VIEW_CUSTOMER_FINANCIAL_DATA: "finance.view",

  VIEW_FINANCE: "finance.view",
  VIEW_FINANCIAL_DATA: "finance.view",
  EDIT_REVENUE: "revenue.edit",
  EDIT_EXPENSES: "expenses.edit",
  EDIT_COMMISSION: "commissions.edit",
  EDIT_AMOUNT_AFTER_APPROVAL: "finance.postapprove",
  DELETE_FINANCIAL_DOCUMENT: "finance.delete",

  VIEW_INVOICES: "invoices.view",
  CREATE_INVOICE: "invoices.create",
  EDIT_INVOICE: "invoices.edit",
  APPROVE_INVOICE: "invoices.approve",
  REJECT_INVOICE: "invoices.reject",
  ISSUE_INVOICE: "invoices.issue",
  CANCEL_INVOICE: "invoices.cancel",
  PRINT_INVOICE: "invoices.print",
  DOWNLOAD_INVOICE: "invoices.download",

  VIEW_SETTLEMENTS: "settlements.view",
  CREATE_SETTLEMENT: "settlements.create",
  EDIT_SETTLEMENT: "settlements.edit",
  APPROVE_SETTLEMENT: "settlements.approve",
  REJECT_SETTLEMENT: "settlements.reject",
  REOPEN_SETTLEMENT: "settlements.reopen",
  EXPORT_SETTLEMENTS: "settlements.export",
  PRINT_SETTLEMENTS: "settlements.print",

  VIEW_PAYMENTS: "payments.view",
  RECORD_PAYMENT: "payments.record",
  EDIT_PAYMENT: "payments.edit",
  CANCEL_PAYMENT: "payments.cancel",
  RECEIVE_PAYMENT: "payments.receive",

  VIEW_FINANCIAL_REVIEW: "review.view",
  PERFORM_FINANCIAL_REVIEW: "review.perform",
  APPROVE_FINANCIAL_REVIEW: "review.approve",
  REJECT_FINANCIAL_REVIEW: "review.reject",

  VIEW_CLAIMS: "claims.view",
  CREATE_CLAIM: "claims.create",
  MANAGE_CLAIMS: "claims.manage",

  VIEW_REPORTS: "reports.view",
  EXPORT_REPORTS: "reports.export",
  PRINT_REPORTS: "reports.print",

  VIEW_AUDIT: "audit.view",
  VIEW_DOCUMENTS: "documents.view",
  UPLOAD_DOCUMENTS: "documents.upload",
  DOWNLOAD_DOCUMENTS: "documents.download",
  VERIFY_DOCUMENTS: "documents.verify",

  VIEW_POD: "pod.view",
  CREATE_POD: "pod.create",
  VERIFY_POD: "pod.verify",

  VIEW_GPS: "gps.view",
  CONFIGURE_GPS: "gps.configure",

  VIEW_USERS: "users.view",
  MANAGE_USERS: "users.manage",
  MANAGE_ROLES: "permissions.manage",
  MANAGE_PERMISSIONS: "permissions.manage",
  MANAGE_SETTINGS: "settings.manage",
  MANAGE_BRANDING: "branding.manage",
};

export function normalizePermissionKey(key: string): string {
  const trimmed = String(key || "").trim();
  if (!trimmed) return "";
  if (PERMISSION_ALIASES[trimmed]) return PERMISSION_ALIASES[trimmed];
  if (PERMISSION_ALIASES[trimmed.toUpperCase()]) return PERMISSION_ALIASES[trimmed.toUpperCase()];
  return trimmed;
}

/**
 * Factory grants — mirror of the server's DEFAULT_ROLE_PERMISSIONS.
 * Kept in sync by `tests/permissions.test.ts`, which fails if the two drift.
 */
export const DEFAULT_CLIENT_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  GENERAL_MANAGER: [
    "overview.view",
    "trips.view", "trips.approve", "trips.reject", "trips.cancel", "trips.reopen", "trips.assign", "trips.track", "trips.export", "trips.print",
    "finance.view", "finance.approve", "finance.settle",
    "invoices.view", "invoices.approve", "invoices.print", "invoices.download",
    "settlements.view", "settlements.approve", "settlements.reopen", "settlements.export", "settlements.print",
    "payments.view",
    "review.view", "review.perform", "review.approve", "review.reject",
    "claims.view", "claims.manage",
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
    "trips.cancel", "trips.approve", "trips.reject", "trips.track", "trips.request", "trips.export", "trips.print",
    "tariffs.view", "tariffs.manage",
    "claims.view", "claims.manage",
    "customers.view", "customers.create", "customers.edit", "customers.manage",
    "notifications.view", "pod.view", "pod.create", "pod.verify",
    "vehicles.view", "vehicles.create", "vehicles.edit", "vehicles.assign",
    "drivers.view", "drivers.create", "drivers.edit",
    "gps.view", "documents.view", "documents.upload", "documents.download", "documents.verify",
    "registrations.view", "registrations.review", "assets.view",
  ],
  ACCOUNTANT: [
    "finance.view", "finance.create", "finance.approve", "finance.settle", "finance.pay",
    "invoices.view", "invoices.create", "invoices.edit", "invoices.approve", "invoices.issue", "invoices.print", "invoices.download",
    "settlements.view", "settlements.create", "settlements.edit", "settlements.approve", "settlements.export", "settlements.print",
    "payments.view", "payments.record", "payments.receive",
    "review.view", "review.perform",
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
    "invoices.view", "invoices.download", "invoices.print",
    "notifications.view", "pod.view",
  ],
  CLIENT: [
    "trips.view", "trips.create", "trips.track",
    "documents.view", "documents.download",
    "claims.create", "claims.view",
    "invoices.view", "invoices.download", "invoices.print",
    "notifications.view", "pod.view",
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

  { id: "finance", sectionId: "finance", titleKey: "nav.finance", hintKey: "nav.finance", viewKey: "finance.view" },
  { id: "reports", sectionId: "finance", titleKey: "nav.reports", hintKey: "nav.insights", viewKey: "reports.view" },
  { id: "analysis", sectionId: "insights", titleKey: "nav.analysis", hintKey: "nav.insights", viewKey: "reports.view" },
  { id: "history", sectionId: "insights", titleKey: "nav.history", hintKey: "nav.insights", viewKey: "audit.view" },

  { id: "chats", sectionId: "operations", titleKey: "nav.chats", hintKey: "nav.operations", viewKey: "trips.view" },
  { id: "permissions", sectionId: "identity", titleKey: "settings.systemRoles", hintKey: "nav.identity", viewKey: "permissions.manage" },
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
  const canonical = normalizePermissionKey(capability);
  if (Array.isArray(user.permissions)) {
    if (user.permissions.includes("*")) return true;
    if (user.permissions.includes(canonical) || user.permissions.includes(capability)) return true;
  }
  const granted = DEFAULT_CLIENT_PERMISSIONS[user.role || ""];
  if (!granted) return false;
  return granted.includes("*") || granted.includes(canonical) || granted.includes(capability);
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
  const canonical = normalizePermissionKey(capability);
  if (granted === "*") return true;
  return Array.isArray(granted) && (granted.includes(canonical) || granted.includes(capability));
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
  "settlements.reopen",
  "finance.postapprove",
  "finance.delete",
  "revenue.edit",
];
