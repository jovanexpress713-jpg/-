/**
 * Client-side capability model.
 *
 * Mirrors the server's `ROLE_PERMISSIONS` (src/server/auth/middleware.ts) so the
 * console, the account menu and the AI assistant all answer the same question —
 * "may this user do / see this?" — before a request is ever sent. The server
 * remains the authority: every protected endpoint re-checks the token.
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
  | "trips.view"
  | "trips.manage"
  | "trips.transition"
  | "trips.request"
  | "vehicles.view"
  | "vehicles.manage"
  | "drivers.view"
  | "drivers.manage"
  | "registrations.review"
  | "branding.manage"
  | "settings.manage"
  | "reports.view"
  | "audit.view"
  | "finance.view"
  | "notifications.view"
  | "gps.view"
  | "assistant.act";

const ROLE_CAPABILITIES: Record<string, Capability[] | "*"> = {
  SUPER_ADMIN: "*",
  GENERAL_MANAGER: [
    "trips.view", "trips.manage", "vehicles.view", "drivers.view", "registrations.review",
    "branding.manage", "settings.manage", "reports.view", "audit.view", "finance.view",
    "notifications.view", "gps.view", "assistant.act",
  ],
  OPERATIONS_MANAGER: [
    "trips.view", "trips.manage", "trips.transition", "vehicles.view", "vehicles.manage",
    "drivers.view", "drivers.manage", "registrations.review", "reports.view", "audit.view",
    "notifications.view", "gps.view", "assistant.act",
  ],
  DISPATCHER: [
    "trips.view", "trips.manage", "trips.transition", "vehicles.view", "drivers.view",
    "gps.view", "notifications.view", "assistant.act",
  ],
  ACCOUNTANT: [
    "trips.view", "finance.view", "reports.view", "notifications.view", "audit.view",
  ],
  WAREHOUSE: ["trips.view", "trips.transition", "notifications.view"],
  DRIVER: ["trips.view", "trips.transition", "trips.request", "gps.view", "notifications.view"],
  CUSTOMER: ["trips.view", "notifications.view"],
  CLIENT: ["trips.view", "notifications.view"],
  BROKER: ["trips.view", "notifications.view"],
  CUSTOMS_BROKER: ["trips.view", "notifications.view"],
  REPRESENTATIVE: ["trips.view", "notifications.view"],
};

/** Console personas (the role switch inside the control room). */
const PERSONA_CAPABILITIES: Record<string, Capability[] | "*"> = {
  admin: "*",
  driver: ROLE_CAPABILITIES.DRIVER,
  shipper: ROLE_CAPABILITIES.CUSTOMER,
  owner: ["trips.view", "vehicles.view", "reports.view", "notifications.view", "finance.view"],
};

export function isDriverRole(role?: string) {
  return role === "DRIVER";
}
export function isClientRole(role?: string) {
  return role === "CUSTOMER" || role === "CLIENT";
}
export function isStaffRole(role?: string) {
  return !!role && !isDriverRole(role) && !isClientRole(role);
}

export function can(user: SessionUser | null | undefined, capability: Capability): boolean {
  if (!user) return false;
  if (Array.isArray(user.permissions) && user.permissions.includes("*")) return true;
  if (Array.isArray(user.permissions) && user.permissions.includes(capability)) return true;

  const granted = ROLE_CAPABILITIES[user.role || ""];
  if (granted === "*") return true;
  return Array.isArray(granted) && granted.includes(capability);
}

export function canPersona(persona: string, capability: Capability): boolean {
  const granted = PERSONA_CAPABILITIES[persona];
  if (granted === "*") return true;
  return Array.isArray(granted) && granted.includes(capability);
}

/**
 * Demo/role switching is a Super Admin (and explicit-permission) affordance only:
 * an operations user must never be able to hop into another identity.
 */
export function canSwitchAccounts(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN") return true;
  return Array.isArray(user.permissions) && user.permissions.includes("accounts.switch");
}

/** Which console surfaces a persona is allowed to open. */
export function personaSections(persona: string): string[] {
  const base = ["overview", "operations", "trips", "shipments", "tracking", "settings"];
  if (persona === "driver") return ["trips", "tracking", "settings"];
  if (persona === "shipper") return ["shipments", "tracking", "settings"];
  if (persona === "owner") return ["overview", "fleet", "reports", "settings"];
  return [...base, "fleet", "vehicle-assets", "drivers", "registrations", "reports", "analysis", "history", "chats", "branding"];
}

/** Sensitive actions the assistant must confirm before executing. */
export const SENSITIVE_ACTIONS: Capability[] = ["trips.manage", "vehicles.manage", "branding.manage", "settings.manage"];
