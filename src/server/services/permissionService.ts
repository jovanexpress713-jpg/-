/**
 * EJAZ Transport — Dynamic Permission Registry (RBAC)
 * ─────────────────────────────────────────────────────────────────────────
 * One authority for the question «may this role do / see this?».
 *
 *   User → Role → Permissions → what is visible and what is callable.
 *
 * Nothing is decided by `if (role === "ACCOUNTANT")` anywhere in the product.
 * The catalogue below describes the whole surface (sections → pages →
 * functions), the DEFAULT map is what a fresh install grants, and the OVERRIDE
 * map is what the system administrator changed from «إدارة الأدوار والصلاحيات».
 * The override map is persisted, audited, and re-read on every request — so a
 * change applies without touching code and without a redeploy.
 *
 * Enforcement is server-side: hiding a button is presentation, `hasPermission`
 * is the protection.
 */

import fs from "fs";
import path from "path";
import { logAuditEvent, getAuditLogs, type AuditRecord } from "./auditService";

/* ── Actions the platform actually performs ─────────────────────────────── */

export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "assign",
  "transition",
  "export",
  "print",
  "upload",
  "download",
  "track",
  "settle",
  "pay",
  "review",
  "manage",
  "request",
  "configure",
  "record",
  "cancel",
  "reopen",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const ACTION_LABELS: Record<PermissionAction, { ar: string; en: string }> = {
  view: { ar: "عرض", en: "View" },
  create: { ar: "إضافة", en: "Create" },
  edit: { ar: "تعديل", en: "Edit" },
  delete: { ar: "حذف", en: "Delete" },
  approve: { ar: "اعتماد", en: "Approve" },
  assign: { ar: "تعيين", en: "Assign" },
  transition: { ar: "تحديث الحالة", en: "Update status" },
  export: { ar: "تصدير", en: "Export" },
  print: { ar: "طباعة", en: "Print" },
  upload: { ar: "رفع", en: "Upload" },
  download: { ar: "تنزيل", en: "Download" },
  track: { ar: "تتبع", en: "Track" },
  settle: { ar: "تسوية", en: "Settle" },
  pay: { ar: "تحصيل", en: "Collect payment" },
  review: { ar: "مراجعة", en: "Review" },
  manage: { ar: "إدارة", en: "Manage" },
  request: { ar: "طلب", en: "Request" },
  configure: { ar: "ضبط", en: "Configure" },
  record: { ar: "تسجيل", en: "Record" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  reopen: { ar: "إعادة فتح", en: "Reopen" },
};

/* ── The catalogue: sections → pages → functions ────────────────────────── */

export interface CatalogFunction {
  /** The permission key, e.g. `trips.edit`. */
  key: string;
  action: PermissionAction;
  labelAr: string;
  labelEn: string;
}

export interface CatalogPage {
  /** Console section key — the same key the sidebar navigates by. */
  id: string;
  sectionId: string;
  labelAr: string;
  labelEn: string;
  hintAr?: string;
  hintEn?: string;
  /** Permission that grants the page itself. Absent page permission = visible. */
  viewKey?: string;
  functions: CatalogFunction[];
}

export interface CatalogSection {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: string;
}

export const PERMISSION_CATALOG_SECTIONS: CatalogSection[] = [
  { id: "operations", labelAr: "العمليات", labelEn: "Operations", icon: "dashboard" },
  { id: "fleet", labelAr: "الأسطول", labelEn: "Fleet", icon: "truck" },
  { id: "finance", labelAr: "المالية", labelEn: "Finance", icon: "report" },
  { id: "insights", labelAr: "التقارير والتحليلات", labelEn: "Reports & insights", icon: "analysis" },
  { id: "administration", labelAr: "الإدارة", labelEn: "Administration", icon: "lock" },
];

const fn = (
  resource: string,
  action: PermissionAction,
  labelAr: string,
  labelEn: string
): CatalogFunction => ({ key: `${resource}.${action}`, action, labelAr, labelEn });

export const PERMISSION_CATALOG_PAGES: CatalogPage[] = [
  /* ── Operations ─────────────────────────────────────────────────────── */
  {
    id: "overview",
    sectionId: "operations",
    labelAr: "نظرة عامة",
    labelEn: "Executive overview",
    hintAr: "مؤشرات الأداء وملخص التشغيل",
    hintEn: "KPIs and the operational summary",
    viewKey: "overview.view",
    functions: [fn("overview", "view", "عرض النظرة العامة", "View the overview")],
  },
  {
    id: "tracking",
    sectionId: "operations",
    labelAr: "التتبع المباشر",
    labelEn: "Live tracking",
    hintAr: "خريطة الأسطول ومركز العمليات الحي",
    hintEn: "Fleet map and the live operations centre",
    viewKey: "gps.view",
    functions: [
      fn("gps", "view", "عرض التتبع", "View tracking"),
      fn("gps", "configure", "ضبط مزوّد GPS", "Configure the GPS provider"),
    ],
  },
  {
    id: "trips",
    sectionId: "operations",
    labelAr: "الرحلات",
    labelEn: "Trips",
    hintAr: "دورة حياة الرحلة من الإنشاء إلى الإغلاق",
    hintEn: "The trip lifecycle from creation to closure",
    viewKey: "trips.view",
    functions: [
      fn("trips", "view", "عرض الرحلات", "View trips"),
      fn("trips", "create", "إضافة رحلة", "Create a trip"),
      fn("trips", "edit", "تعديل رحلة", "Edit a trip"),
      fn("trips", "delete", "حذف رحلة", "Delete a trip"),
      fn("trips", "assign", "تعيين سائق وشاحنة", "Assign driver & vehicle"),
      fn("trips", "transition", "تحديث حالة الرحلة", "Update the trip status"),
      fn("trips", "approve", "اعتماد طلب رحلة", "Approve a trip request"),
      fn("trips", "cancel", "إلغاء رحلة", "Cancel a trip"),
      fn("trips", "reopen", "إعادة فتح رحلة", "Reopen a trip"),
      fn("trips", "request", "طلب رحلة (السائق)", "Request a trip (driver)"),
      fn("trips", "track", "تتبع رحلة", "Track a trip"),
    ],
  },
  {
    id: "shipments",
    sectionId: "operations",
    labelAr: "الشحنات وطلبات النقل",
    labelEn: "Shipments & transport requests",
    viewKey: "trips.view",
    functions: [
      fn("documents", "view", "عرض المستندات وبوليصة الشحن", "View documents & waybill"),
      fn("documents", "upload", "رفع مستندات", "Upload documents"),
      fn("documents", "download", "تنزيل مستندات", "Download documents"),
      fn("pod", "view", "عرض إثبات التسليم", "View proof of delivery"),
      fn("pod", "create", "تسجيل إثبات تسليم", "Record proof of delivery"),
    ],
  },
  {
    id: "tariffs",
    sectionId: "operations",
    labelAr: "التعرفة والأسعار",
    labelEn: "Tariffs & pricing",
    viewKey: "tariffs.view",
    functions: [
      fn("tariffs", "view", "عرض دفتر التعرفة", "View the tariff book"),
      fn("tariffs", "manage", "إدارة التعرفة", "Manage tariffs"),
    ],
  },

  /* ── Fleet ──────────────────────────────────────────────────────────── */
  {
    id: "fleet",
    sectionId: "fleet",
    labelAr: "الشاحنات",
    labelEn: "Trucks",
    hintAr: "الأسطول وأنواع الشاحنات الأربعة المعتمدة",
    hintEn: "The fleet and the four approved truck categories",
    viewKey: "vehicles.view",
    functions: [
      fn("vehicles", "view", "عرض الأسطول", "View the fleet"),
      fn("vehicles", "create", "إضافة شاحنة", "Add a truck"),
      fn("vehicles", "edit", "تعديل بيانات شاحنة", "Edit a truck"),
      fn("vehicles", "assign", "تعيين كابتن للشاحنة", "Assign a captain"),
      fn("vehicles", "delete", "إخراج شاحنة من الأسطول", "Retire a truck"),
    ],
  },
  {
    id: "vehicle-assets",
    sectionId: "fleet",
    labelAr: "أصول المركبات",
    labelEn: "Vehicle assets",
    hintAr: "الصور والمجسمات الرسمية لكل فئة",
    hintEn: "Official imagery and 3D models per category",
    viewKey: "vehicles.view",
    functions: [
      fn("assets", "view", "عرض الأصول", "View assets"),
      fn("assets", "upload", "نشر صورة أو مجسم رسمي", "Publish an official image or model"),
    ],
  },
  {
    id: "drivers",
    sectionId: "fleet",
    labelAr: "السائقون",
    labelEn: "Drivers",
    viewKey: "drivers.view",
    functions: [
      fn("drivers", "view", "عرض السائقين", "View drivers"),
      fn("drivers", "create", "إضافة سائق", "Add a driver"),
      fn("drivers", "edit", "تعديل بيانات سائق", "Edit a driver"),
      fn("drivers", "delete", "إيقاف سائق", "Suspend a driver"),
    ],
  },
  {
    id: "registrations",
    sectionId: "fleet",
    labelAr: "طلبات التسجيل",
    labelEn: "Registration requests",
    hintAr: "مراجعة واعتماد حسابات السائقين والعملاء",
    hintEn: "Review and approve driver & client accounts",
    viewKey: "registrations.view",
    functions: [
      fn("registrations", "view", "عرض طلبات التسجيل", "View registration requests"),
      fn("registrations", "review", "مراجعة واعتماد الطلبات", "Review & approve requests"),
    ],
  },
  {
    id: "customers",
    sectionId: "fleet",
    labelAr: "العملاء",
    labelEn: "Customers",
    viewKey: "customers.view",
    functions: [
      fn("customers", "view", "عرض العملاء", "View customers"),
      fn("customers", "create", "إضافة عميل", "Add a customer"),
      fn("customers", "manage", "إدارة حسابات العملاء", "Manage customer accounts"),
    ],
  },

  /* ── Finance ────────────────────────────────────────────────────────── */
  {
    id: "finance",
    sectionId: "finance",
    labelAr: "الفواتير والتسويات",
    labelEn: "Invoices & settlements",
    hintAr: "الإيرادات والمصروفات والعمولات والمدفوعات",
    hintEn: "Revenue, expenses, commissions and payments",
    viewKey: "finance.view",
    functions: [
      fn("finance", "view", "عرض البيانات المالية", "View financial data"),
      fn("finance", "create", "إنشاء فاتورة", "Create an invoice"),
      fn("finance", "settle", "تسوية رحلة", "Settle a trip"),
      fn("finance", "pay", "تسجيل دفعة", "Record a payment"),
      fn("finance", "approve", "اعتماد تسوية", "Approve a settlement"),
      fn("invoices", "view", "عرض الفواتير", "View invoices"),
      fn("payments", "record", "تسجيل مدفوعات", "Record payments"),
    ],
  },
  {
    id: "claims",
    sectionId: "finance",
    labelAr: "المطالبات",
    labelEn: "Claims",
    viewKey: "claims.view",
    functions: [
      fn("claims", "view", "عرض المطالبات", "View claims"),
      fn("claims", "create", "تسجيل مطالبة", "Raise a claim"),
      fn("claims", "manage", "مراجعة المطالبات", "Review claims"),
    ],
  },

  /* ── Insights ───────────────────────────────────────────────────────── */
  {
    id: "reports",
    sectionId: "insights",
    labelAr: "التقارير",
    labelEn: "Reports",
    viewKey: "reports.view",
    functions: [
      fn("reports", "view", "عرض التقارير", "View reports"),
      fn("reports", "export", "تصدير Excel / CSV", "Export Excel / CSV"),
      fn("reports", "print", "طباعة / PDF", "Print / PDF"),
    ],
  },
  {
    id: "audit",
    sectionId: "insights",
    labelAr: "سجل العمليات",
    labelEn: "Audit trail",
    viewKey: "audit.view",
    functions: [fn("audit", "view", "عرض سجل العمليات", "View the audit trail")],
  },

  /* ── Administration ─────────────────────────────────────────────────── */
  {
    id: "permissions",
    sectionId: "administration",
    labelAr: "إدارة الأدوار والصلاحيات",
    labelEn: "Roles & permissions",
    hintAr: "التحكم الكامل فيما يظهر لكل دور",
    hintEn: "Full control over what each role sees",
    viewKey: "permissions.manage",
    functions: [fn("permissions", "manage", "إدارة صلاحيات الأدوار", "Manage role permissions")],
  },
  {
    id: "users",
    sectionId: "administration",
    labelAr: "المستخدمون",
    labelEn: "Users",
    viewKey: "users.manage",
    functions: [
      fn("users", "view", "عرض المستخدمين", "View users"),
      fn("users", "manage", "إدارة المستخدمين", "Manage users"),
    ],
  },
  {
    id: "settings",
    sectionId: "administration",
    labelAr: "إعدادات النظام",
    labelEn: "System settings",
    viewKey: "settings.manage",
    functions: [fn("settings", "manage", "إدارة إعدادات النظام", "Manage system settings")],
  },
  {
    id: "branding",
    sectionId: "administration",
    labelAr: "هوية المؤسسة",
    labelEn: "Establishment identity",
    viewKey: "branding.manage",
    functions: [fn("branding", "manage", "إدارة الهوية البصرية", "Manage the visual identity")],
  },
];

/** Every permission key the catalogue knows about. */
export const CATALOG_PERMISSION_KEYS: string[] = Array.from(
  new Set(PERMISSION_CATALOG_PAGES.flatMap((p) => p.functions.map((f) => f.key)))
);

/* ── Roles ──────────────────────────────────────────────────────────────── */

export interface RoleDefinition {
  id: string;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  /** Core roles are the five the organisation runs on; the rest are operational. */
  core: boolean;
  /** Locked roles cannot be edited (the administrator can never be locked out). */
  locked?: boolean;
}

export const ROLES: RoleDefinition[] = [
  {
    id: "SUPER_ADMIN",
    labelAr: "مدير النظام",
    labelEn: "System administrator",
    descriptionAr: "صلاحية كاملة على كل الأقسام، وهو المسؤول عن إدارة صلاحيات بقية الأدوار.",
    descriptionEn: "Full access to every section, and the owner of role permissions.",
    core: true,
    locked: true,
  },
  {
    id: "OPERATIONS_MANAGER",
    labelAr: "مدير العمليات",
    labelEn: "Operations manager",
    descriptionAr: "الرحلات والسائقون والشاحنات وطلبات النقل.",
    descriptionEn: "Trips, drivers, trucks and transport requests.",
    core: true,
  },
  {
    id: "ACCOUNTANT",
    labelAr: "المحاسب المالي",
    labelEn: "Financial accountant",
    descriptionAr: "الفواتير والتسويات المالية ومراجعة المطالبات.",
    descriptionEn: "Invoices, financial settlements and claims review.",
    core: true,
  },
  {
    id: "DRIVER",
    labelAr: "السائق الميداني",
    labelEn: "Field driver",
    descriptionAr: "رحلاته المسندة إليه، تنفيذها، وإثبات التسليم.",
    descriptionEn: "His assigned trips, their execution and proof of delivery.",
    core: true,
  },
  {
    id: "CUSTOMER",
    labelAr: "العميل",
    labelEn: "Customer",
    descriptionAr: "شحناته فقط، مع التتبع وبوليصة الشحن.",
    descriptionEn: "Only his own shipments, with tracking and the waybill.",
    core: true,
  },
  {
    id: "GENERAL_MANAGER",
    labelAr: "المدير العام",
    labelEn: "General manager",
    descriptionAr: "إشراف تنفيذي على التشغيل والمالية دون إدارة الصلاحيات.",
    descriptionEn: "Executive oversight of operations and finance, without permission control.",
    core: false,
  },
  {
    id: "DISPATCHER",
    labelAr: "موظف الترحيل",
    labelEn: "Dispatcher",
    descriptionAr: "إسناد الرحلات ومتابعة التنفيذ.",
    descriptionEn: "Assigning trips and following their execution.",
    core: false,
  },
  {
    id: "WAREHOUSE",
    labelAr: "أمين المستودع",
    labelEn: "Warehouse keeper",
    descriptionAr: "تسجيل التحميل ومستندات الشحن.",
    descriptionEn: "Recording loading and shipping documents.",
    core: false,
  },
  {
    id: "BROKER",
    labelAr: "وسيط الشحن",
    labelEn: "Freight broker",
    descriptionAr: "إنشاء طلبات النقل ومتابعة العملاء.",
    descriptionEn: "Creating transport requests and following up with customers.",
    core: false,
  },
  {
    id: "CUSTOMS_BROKER",
    labelAr: "مخلّص جمركي",
    labelEn: "Customs broker",
    descriptionAr: "رفع المستندات الجمركية للرحلات.",
    descriptionEn: "Uploading customs documents for trips.",
    core: false,
  },
  {
    id: "REPRESENTATIVE",
    labelAr: "مندوب",
    labelEn: "Representative",
    descriptionAr: "اطلاع على الرحلات والمستندات فقط.",
    descriptionEn: "Read-only access to trips and documents.",
    core: false,
  },
];

export const ROLE_IDS = ROLES.map((r) => r.id);

/**
 * DEFAULT grants — what a fresh install gives each role.
 *
 * Principle of least privilege: a role receives only what its job needs. Note
 * in particular that OPERATIONS_MANAGER holds no financial permission and no
 * permission control, and that DRIVER / CUSTOMER hold nothing beyond their own
 * work.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  GENERAL_MANAGER: [
    "overview.view",
    "trips.view", "trips.approve", "trips.cancel", "trips.reopen", "trips.assign", "trips.track",
    "finance.view", "finance.approve", "finance.settle", "claims.view", "claims.manage",
    "tariffs.view", "tariffs.manage",
    "customers.view", "customers.create", "customers.manage",
    "notifications.view", "pod.view",
    "vehicles.view", "drivers.view", "drivers.create",
    "gps.view",
    "reports.view", "reports.export", "reports.print", "audit.view",
    "settings.manage", "registrations.view", "registrations.review",
    "users.view",
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
    "registrations.view", "registrations.review",
    "assets.view",
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
    "pod.create", "pod.view",
    "documents.upload", "documents.view",
    "gps.view", "notifications.view",
  ],
  CUSTOMER: [
    "trips.view", "trips.create", "trips.track",
    "documents.view", "documents.download",
    "claims.create", "claims.view",
    "invoices.view", "notifications.view", "pod.view",
  ],
  DISPATCHER: [
    "overview.view",
    "trips.view", "trips.create", "trips.edit", "trips.assign", "trips.transition", "trips.track",
    "tariffs.view",
    "vehicles.view", "vehicles.assign", "drivers.view", "gps.view",
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

/* ── Runtime overrides (persisted) ──────────────────────────────────────── */

interface OverrideFile {
  version: number;
  updatedAt: string;
  overrides: Record<string, string[]>;
}

const STORE_PATH = path.resolve(process.cwd(), "data", "role-permissions.json");

/** Bumped on every save so a signed-in client can detect a change and refetch. */
let registryVersion = 1;
let overrides: Record<string, string[]> = {};
let loaded = false;

function loadOverrides(): void {
  if (loaded) return;
  loaded = true;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as OverrideFile;
      if (raw && typeof raw === "object" && raw.overrides) {
        // Only keys the catalogue knows about survive a restart — a stale file
        // can never grant a permission the platform does not have.
        const known = new Set(CATALOG_PERMISSION_KEYS);
        const legacy = new Set(Object.values(DEFAULT_ROLE_PERMISSIONS).flat());
        overrides = {};
        for (const [role, list] of Object.entries(raw.overrides)) {
          if (!Array.isArray(list)) continue;
          overrides[role] = Array.from(
            new Set(list.filter((k) => typeof k === "string" && (known.has(k) || legacy.has(k) || k === "*")))
          );
        }
        registryVersion = Number(raw.version) || 1;
      }
    }
  } catch {
    overrides = {};
  }
}

function persistOverrides(): void {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    const payload: OverrideFile = {
      version: registryVersion,
      updatedAt: new Date().toISOString(),
      overrides,
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(payload, null, 2), "utf-8");
  } catch {
    /* In-memory only — the change still applies for this process. */
  }
}

/* ── Resolution ─────────────────────────────────────────────────────────── */

export function isRoleKnown(role: string): boolean {
  return ROLE_IDS.includes(role);
}

export function roleDefinition(role: string): RoleDefinition | undefined {
  return ROLES.find((r) => r.id === role);
}

/** The permissions a role has right now (override if edited, default otherwise). */
export function getRolePermissions(role: string): string[] {
  loadOverrides();
  if (role === "SUPER_ADMIN") return ["*"];
  if (overrides[role]) return overrides[role];
  return DEFAULT_ROLE_PERMISSIONS[role] || [];
}

export function getDefaultRolePermissions(role: string): string[] {
  if (role === "SUPER_ADMIN") return ["*"];
  return DEFAULT_ROLE_PERMISSIONS[role] || [];
}

export function roleIsCustomized(role: string): boolean {
  loadOverrides();
  return Object.prototype.hasOwnProperty.call(overrides, role);
}

/** The single permission check used by every route guard. */
export function hasPermission(role: string | undefined, permission: string): boolean {
  if (!role) return false;
  const list = getRolePermissions(role);
  if (list.includes("*")) return true;
  return list.includes(permission);
}

/** True when the role may administer permissions at all. */
export function canManagePermissions(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || hasPermission(role, "permissions.manage");
}

/** Page-level visibility for a role — the console hides anything not visible. */
export function visiblePagesFor(role: string | undefined): string[] {
  if (!role) return [];
  return PERMISSION_CATALOG_PAGES.filter((page) => !page.viewKey || hasPermission(role, page.viewKey)).map(
    (p) => p.id
  );
}

/** Section-level visibility: a section is visible when any of its pages is. */
export function visibleSectionsFor(role: string | undefined): string[] {
  const pages = new Set(visiblePagesFor(role));
  return PERMISSION_CATALOG_SECTIONS.filter((s) =>
    PERMISSION_CATALOG_PAGES.some((p) => p.sectionId === s.id && pages.has(p.id))
  ).map((s) => s.id);
}

export interface EffectivePermissions {
  role: string;
  wildcard: boolean;
  permissions: string[];
  pages: string[];
  sections: string[];
  version: number;
}

export function effectivePermissionsFor(role: string | undefined): EffectivePermissions {
  loadOverrides();
  const list = getRolePermissions(role || "");
  const wildcard = list.includes("*");
  return {
    role: role || "GUEST",
    wildcard,
    permissions: wildcard ? CATALOG_PERMISSION_KEYS : list,
    pages: visiblePagesFor(role),
    sections: visibleSectionsFor(role),
    version: registryVersion,
  };
}

/* ── Administration ─────────────────────────────────────────────────────── */

export interface SaveResult {
  ok: boolean;
  error?: string;
  code?: string;
  role?: string;
  permissions?: string[];
  added?: string[];
  removed?: string[];
  version?: number;
}

/** Validates a candidate permission list against the catalogue. */
export function validatePermissionList(list: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(list)) return { ok: false, error: "permissions must be an array of permission keys" };
  const known = new Set(CATALOG_PERMISSION_KEYS);
  const legacy = new Set(Object.values(DEFAULT_ROLE_PERMISSIONS).flat());
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") return { ok: false, error: "every permission must be a string key" };
    if (item === "*") continue; // the wildcard is reserved for SUPER_ADMIN
    if (!known.has(item) && !legacy.has(item)) {
      return { ok: false, error: `Unknown permission '${item}' — it is not part of the platform catalogue` };
    }
    if (!out.includes(item)) out.push(item);
  }
  return { ok: true, value: out };
}

/**
 * Saves the permission set of a role.
 *
 * Only a caller holding `permissions.manage` reaches this (enforced by the
 * route), and the change is written to the audit trail with its full before /
 * after diff so «من غيّر ماذا ومتى» is always answerable.
 */
export function setRolePermissions(
  role: string,
  permissions: unknown,
  actor: { userId?: string; fullName?: string; role?: string },
  reason?: string
): SaveResult {
  loadOverrides();

  if (!isRoleKnown(role)) {
    return { ok: false, error: `Unknown role '${role}'`, code: "UNKNOWN_ROLE" };
  }
  const def = roleDefinition(role);
  if (def?.locked) {
    return {
      ok: false,
      error: `The permissions of «${def.labelAr}» are fixed: the system administrator can never be restricted, otherwise nobody could restore access.`,
      code: "ROLE_LOCKED",
    };
  }

  const valid = validatePermissionList(permissions);
  if (!valid.ok) return { ok: false, error: valid.error, code: "INVALID_PERMISSIONS" };

  const before = getRolePermissions(role);
  const after = valid.value;

  /*
   * A hidden page takes its functions with it — and the grant is otherwise
   * saved exactly as submitted.
   *
   * Downward only, and deliberately so. Leaving a page's functions granted while
   * its view key is gone would keep that page's API endpoints reachable for a
   * role that can no longer see the page: «إخفاء الشاحنات» would hide the screen
   * and still allow `POST /api/vehicles`. So revoking a view key drops every
   * function that lived inside it, which also keeps the returned diff honest.
   *
   * The opposite direction — silently re-adding a view key because one of its
   * functions was submitted — is not done. It would widen access the
   * administrator just removed, and it makes the save unpredictable: the same
   * list would mean different things depending on what the role happened to hold
   * a moment earlier. What the administrator submits is what applies; if a
   * function is granted without its page, the page simply stays hidden and the
   * function stays unreachable until the page is granted again.
   */
  for (const page of PERMISSION_CATALOG_PAGES) {
    if (!page.viewKey || after.includes(page.viewKey)) continue;
    for (const f of page.functions) {
      const at = after.indexOf(f.key);
      if (at >= 0) after.splice(at, 1);
    }
  }

  const added = after.filter((k) => !before.includes(k));
  const removed = before.filter((k) => !after.includes(k));

  overrides[role] = after;
  registryVersion += 1;
  persistOverrides();

  logAuditEvent({
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    action: "ROLE_PERMISSIONS_UPDATED",
    entity: "permissions",
    entityId: role,
    oldValues: { role, permissions: before },
    newValues: { role, permissions: after, added, removed },
    reason,
  });

  return { ok: true, role, permissions: after, added, removed, version: registryVersion };
}

/** Restores a role to its factory defaults (audited like any other change). */
export function resetRolePermissions(
  role: string,
  actor: { userId?: string; fullName?: string; role?: string },
  reason?: string
): SaveResult {
  loadOverrides();
  if (!isRoleKnown(role)) return { ok: false, error: `Unknown role '${role}'`, code: "UNKNOWN_ROLE" };
  const def = roleDefinition(role);
  if (def?.locked) return { ok: false, error: "This role is locked.", code: "ROLE_LOCKED" };

  const before = getRolePermissions(role);
  delete overrides[role];
  registryVersion += 1;
  persistOverrides();

  const after = getDefaultRolePermissions(role);
  logAuditEvent({
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    action: "ROLE_PERMISSIONS_RESET",
    entity: "permissions",
    entityId: role,
    oldValues: { role, permissions: before },
    newValues: { role, permissions: after },
    reason,
  });

  return {
    ok: true,
    role,
    permissions: after,
    added: after.filter((k) => !before.includes(k)),
    removed: before.filter((k) => !after.includes(k)),
    version: registryVersion,
  };
}

export function getRegistryVersion(): number {
  loadOverrides();
  return registryVersion;
}

/** Permission-change history, newest first. */
/**
 * The permission change log, newest first.
 *
 * Do not "sort" this. `logAuditEvent` writes with `unshift`, so the trail is
 * already most-recent-first and `getAuditLogs`' `slice(0, limit)` already keeps
 * the newest N — the right N for a screen that asks for the last 25 changes.
 * Reversing it here would hand the administrator the OLDEST entries instead, and
 * every change made after the 25th would drop off the log entirely.
 * `tests/permissions.test.ts` asserts the ordering so this cannot regress.
 */
export function getPermissionAudit(limit = 100): AuditRecord[] {
  return getAuditLogs({ entity: "permissions", limit });
}

/** The full catalogue, shaped for the administration screen. */
export function getCatalog() {
  return {
    sections: PERMISSION_CATALOG_SECTIONS,
    pages: PERMISSION_CATALOG_PAGES,
    actions: PERMISSION_ACTIONS.map((a) => ({ id: a, ...ACTION_LABELS[a] })),
    roles: ROLES,
    defaults: DEFAULT_ROLE_PERMISSIONS,
    version: getRegistryVersion(),
  };
}
