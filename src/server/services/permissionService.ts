/**
 * EJAZ Transport — Dynamic Permission Registry (RBAC + User Overrides + Data Scope)
 * ─────────────────────────────────────────────────────────────────────────────────
 * Central authority for:
 *   USER → ROLE → PERMISSIONS (Allow / Deny / Inherited / Temporary / Enabled)
 *   → DATA SCOPE → NAVIGATION → PAGE ACCESS → SECTION ACCESS → ACTION ACCESS
 *   → API AUTHORIZATION → AUDIT LOG
 *
 * Enforcement is server-side: hiding a button is presentation, `hasPermission` /
 * `hasUserPermission` is the protection.
 */

import fs from "fs";
import path from "path";
import { logAuditEvent, getAuditLogs, type AuditRecord } from "./auditService";

/* ── Actions the platform performs (§5) ─────────────────────────────────── */

export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "reject",
  "assign",
  "transition",
  "export",
  "print",
  "upload",
  "download",
  "track",
  "settle",
  "pay",
  "receive",
  "verify",
  "review",
  "manage",
  "request",
  "configure",
  "record",
  "cancel",
  "reopen",
  "issue",
  "perform",
  "postapprove",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const ACTION_LABELS: Record<PermissionAction, { ar: string; en: string }> = {
  view: { ar: "عرض", en: "View" },
  create: { ar: "إنشاء / إضافة", en: "Create" },
  edit: { ar: "تعديل", en: "Edit" },
  delete: { ar: "حذف", en: "Delete" },
  approve: { ar: "اعتماد", en: "Approve" },
  reject: { ar: "رفض", en: "Reject" },
  assign: { ar: "تعيين", en: "Assign" },
  transition: { ar: "تحديث الحالة", en: "Update status" },
  export: { ar: "تصدير", en: "Export" },
  print: { ar: "طباعة", en: "Print" },
  upload: { ar: "رفع", en: "Upload" },
  download: { ar: "تنزيل", en: "Download" },
  track: { ar: "تتبع", en: "Track" },
  settle: { ar: "تسوية", en: "Settle" },
  pay: { ar: "دفع / تحصيل", en: "Pay / Collect" },
  receive: { ar: "استلام", en: "Receive" },
  verify: { ar: "تحقق", en: "Verify" },
  review: { ar: "مراجعة", en: "Review" },
  manage: { ar: "إدارة", en: "Manage" },
  request: { ar: "طلب", en: "Request" },
  configure: { ar: "ضبط وتهيئة", en: "Configure" },
  record: { ar: "تسجيل", en: "Record" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  reopen: { ar: "إعادة فتح", en: "Reopen" },
  issue: { ar: "إصدار", en: "Issue" },
  perform: { ar: "تنفيذ المراجعة", en: "Perform review" },
  postapprove: { ar: "تعديل بعد الاعتماد", en: "Edit after approval" },
};

/* ── Data Scope (§8) & Access Levels (§14) ──────────────────────────────── */

export const DATA_SCOPES = ["OWN", "ASSIGNED", "BRANCH", "REGION", "TEAM", "ALL"] as const;
export type DataScope = (typeof DATA_SCOPES)[number];

export const DATA_SCOPE_LABELS: Record<DataScope, { ar: string; en: string; descAr: string; descEn: string }> = {
  OWN: {
    ar: "بياناته فقط (OWN)",
    en: "Own records only (OWN)",
    descAr: "يرى المستخدم السجلات التي أنشأها أو المرتبطة بحسابه المباشر فقط.",
    descEn: "User sees only records they created or directly own.",
  },
  ASSIGNED: {
    ar: "المسند إليه فقط (ASSIGNED)",
    en: "Assigned records only (ASSIGNED)",
    descAr: "يرى المستخدم الرحلات والشاحنات والمهام المسندة إليه فقط.",
    descEn: "User sees only trips, vehicles and tasks assigned to them.",
  },
  BRANCH: {
    ar: "نطاق الفرع (BRANCH)",
    en: "Branch scope (BRANCH)",
    descAr: "يرى المستخدم عمليات ورحلات فرعه المحدد فقط.",
    descEn: "User sees operations and trips belonging to their branch.",
  },
  REGION: {
    ar: "نطاق المنطقة (REGION)",
    en: "Regional scope (REGION)",
    descAr: "يرى المستخدم عمليات ورحلات المنطقة الجغرافية المحددة له.",
    descEn: "User sees operations and trips within their assigned region.",
  },
  TEAM: {
    ar: "نطاق الفريق (TEAM)",
    en: "Team scope (TEAM)",
    descAr: "يرى المستخدم عمليات فريقه التشغيلي.",
    descEn: "User sees operations belonging to their operational team.",
  },
  ALL: {
    ar: "كامل النظام (ALL)",
    en: "Entire system (ALL)",
    descAr: "وصول شامل لجميع السجلات عبر كافة الفروع والمناطق ضمن الصلاحيات الممنوحة.",
    descEn: "Access across all branches and regions within granted permissions.",
  },
};

export const ACCESS_LEVELS = ["NONE", "VIEW", "OPERATE", "MANAGE", "ADMIN"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, { ar: string; en: string }> = {
  NONE: { ar: "بلا وصول (NONE)", en: "No Access (NONE)" },
  VIEW: { ar: "مشاهدة فقط (VIEW)", en: "View Only (VIEW)" },
  OPERATE: { ar: "تشغيل وتنفيذ (OPERATE)", en: "Operate (OPERATE)" },
  MANAGE: { ar: "إدارة واعتماد (MANAGE)", en: "Manage & Approve (MANAGE)" },
  ADMIN: { ar: "تحكم كامل (ADMIN)", en: "Full Admin (ADMIN)" },
};

/* ── Canonical Permission Aliases (§5, §6, §7, §16, §18, §19) ───────────── */

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

/* ── The catalogue: sections → pages → functions ────────────────────────── */

export interface CatalogFunction {
  /** The permission key, e.g. `trips.edit`. Always `resource.action`. */
  key: string;
  action: PermissionAction;
  labelAr: string;
  labelEn: string;
  /** Optional uppercase code for display in the matrix, e.g. `EDIT_TRIP`. */
  code?: string;
  /** Marks sensitive financial or administrative operations (§19). */
  sensitive?: boolean;
}

export interface CatalogPage {
  /** Console section key — the same key the sidebar navigates by. */
  id: string;
  sectionId: string;
  labelAr: string;
  labelEn: string;
  hintAr?: string;
  hintEn?: string;
  /** Permission that grants the page itself. */
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
  { id: "operations", labelAr: "العمليات والرحلات", labelEn: "Operations & Trips", icon: "dashboard" },
  { id: "fleet", labelAr: "الأسطول والسائقون والعملاء", labelEn: "Fleet, Drivers & Customers", icon: "truck" },
  { id: "finance", labelAr: "المالية والفواتير والتسويات", labelEn: "Finance, Invoices & Settlements", icon: "report" },
  { id: "insights", labelAr: "التقارير وسجل التدقيق", labelEn: "Reports & Audit Trail", icon: "analysis" },
  { id: "administration", labelAr: "الإدارة والصلاحيات والنظام", labelEn: "Administration & RBAC", icon: "lock" },
];

const fn = (
  resource: string,
  action: PermissionAction,
  labelAr: string,
  labelEn: string,
  opts?: { code?: string; sensitive?: boolean }
): CatalogFunction => ({
  key: `${resource}.${action}`,
  action,
  labelAr,
  labelEn,
  ...(opts || {}),
});

export const PERMISSION_CATALOG_PAGES: CatalogPage[] = [
  /* ── Operations ─────────────────────────────────────────────────────── */
  {
    id: "overview",
    sectionId: "operations",
    labelAr: "نظرة عامة",
    labelEn: "Executive overview",
    hintAr: "مؤشرات الأداء وملخص التشغيل الديناميكي حسب الدور",
    hintEn: "Dynamic KPIs and operational summary by role",
    viewKey: "overview.view",
    functions: [fn("overview", "view", "عرض النظرة العامة", "View the overview", { code: "VIEW_OVERVIEW" })],
  },
  {
    id: "tracking",
    sectionId: "operations",
    labelAr: "التتبع المباشر ومركز العمليات",
    labelEn: "Live tracking & operations center",
    hintAr: "خريطة الأسطول ومركز العمليات الحي",
    hintEn: "Fleet map and the live operations centre",
    viewKey: "gps.view",
    functions: [
      fn("gps", "view", "عرض التتبع المباشر", "View live tracking", { code: "VIEW_GPS" }),
      fn("gps", "configure", "ضبط مزوّد GPS", "Configure the GPS provider", { code: "CONFIGURE_GPS", sensitive: true }),
    ],
  },
  {
    id: "trips",
    sectionId: "operations",
    labelAr: "الرحلات",
    labelEn: "Trips",
    hintAr: "دورة حياة الرحلة من الإنشاء إلى الإغلاق والتعيين والتصدير",
    hintEn: "The trip lifecycle from creation to closure, assignment and export",
    viewKey: "trips.view",
    functions: [
      fn("trips", "view", "عرض الرحلات", "View trips", { code: "VIEW_TRIPS" }),
      fn("trips", "create", "إنشاء رحلة", "Create a trip", { code: "CREATE_TRIP" }),
      fn("trips", "edit", "تعديل رحلة", "Edit a trip", { code: "EDIT_TRIP" }),
      fn("trips", "delete", "حذف رحلة", "Delete a trip", { code: "DELETE_TRIP", sensitive: true }),
      fn("trips", "assign", "تعيين/تغيير سائق وشاحنة", "Assign/change driver & vehicle", { code: "ASSIGN_DRIVER" }),
      fn("trips", "transition", "تحديث حالة الرحلة", "Update the trip status", { code: "TRANSITION_TRIP" }),
      fn("trips", "approve", "اعتماد رحلة", "Approve a trip", { code: "APPROVE_TRIP" }),
      fn("trips", "reject", "رفض طلب رحلة", "Reject a trip request", { code: "REJECT_TRIP" }),
      fn("trips", "cancel", "إلغاء رحلة", "Cancel a trip", { code: "CANCEL_TRIP", sensitive: true }),
      fn("trips", "reopen", "إعادة فتح رحلة", "Reopen a trip", { code: "REOPEN_TRIP", sensitive: true }),
      fn("trips", "request", "طلب رحلة (السائق)", "Request a trip (driver)", { code: "REQUEST_TRIP" }),
      fn("trips", "track", "تتبع رحلة", "Track a trip", { code: "TRACK_TRIP" }),
      fn("trips", "export", "تصدير الرحلات", "Export trips", { code: "EXPORT_TRIPS" }),
      fn("trips", "print", "طباعة تفاصيل الرحلة", "Print trip details", { code: "PRINT_TRIPS" }),
    ],
  },
  {
    id: "shipments",
    sectionId: "operations",
    labelAr: "الشحنات والمستندات وإثبات التسليم",
    labelEn: "Shipments, documents & POD",
    hintAr: "بوليصات الشحن وإثبات التسليم والتحميل",
    hintEn: "Waybills, proof of delivery and loading operations",
    viewKey: "trips.view",
    functions: [
      fn("documents", "view", "عرض المستندات وبوليصة الشحن", "View documents & waybill", { code: "VIEW_DOCUMENTS" }),
      fn("documents", "upload", "رفع مستندات", "Upload documents", { code: "UPLOAD_DOCUMENTS" }),
      fn("documents", "download", "تنزيل مستندات", "Download documents", { code: "DOWNLOAD_DOCUMENTS" }),
      fn("documents", "verify", "التحقق من المستندات", "Verify documents", { code: "VERIFY_DOCUMENTS" }),
      fn("pod", "view", "عرض إثبات التسليم", "View proof of delivery", { code: "VIEW_POD" }),
      fn("pod", "create", "تسجيل إثبات تسليم", "Record proof of delivery", { code: "CREATE_POD" }),
      fn("pod", "verify", "اعتماد إثبات التسليم", "Verify proof of delivery", { code: "VERIFY_POD" }),
      fn("loading", "record", "تسجيل عمليات التحميل والتفريغ", "Record loading & unloading", { code: "RECORD_LOADING" }),
    ],
  },
  {
    id: "tariffs",
    sectionId: "operations",
    labelAr: "التعرفة والأسعار",
    labelEn: "Tariffs & pricing",
    hintAr: "دفتر التعرفة الرسمي وعروض الأسعار",
    hintEn: "Official rate card and quote pricing",
    viewKey: "tariffs.view",
    functions: [
      fn("tariffs", "view", "عرض دفتر التعرفة", "View the tariff book", { code: "VIEW_TARIFFS" }),
      fn("tariffs", "manage", "إدارة وتعديل التعرفة", "Manage tariffs", { code: "MANAGE_TARIFFS", sensitive: true }),
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
      fn("vehicles", "view", "عرض الأسطول", "View the fleet", { code: "VIEW_VEHICLES" }),
      fn("vehicles", "create", "إضافة شاحنة", "Add a truck", { code: "CREATE_VEHICLE" }),
      fn("vehicles", "edit", "تعديل بيانات شاحنة", "Edit a truck", { code: "EDIT_VEHICLE" }),
      fn("vehicles", "assign", "تعيين كابتن للشاحنة", "Assign a captain", { code: "ASSIGN_VEHICLE" }),
      fn("vehicles", "delete", "إخراج شاحنة من الأسطول", "Retire a truck", { code: "DELETE_VEHICLE", sensitive: true }),
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
    hintAr: "سجل الكباتن والرخص والتعيينات",
    hintEn: "Driver registry, licenses and assignments",
    viewKey: "drivers.view",
    functions: [
      fn("drivers", "view", "عرض السائقين", "View drivers", { code: "VIEW_DRIVERS" }),
      fn("drivers", "create", "إضافة سائق", "Add a driver", { code: "CREATE_DRIVER" }),
      fn("drivers", "edit", "تعديل بيانات سائق", "Edit a driver", { code: "EDIT_DRIVER" }),
      fn("drivers", "delete", "إيقاف سائق", "Suspend a driver", { code: "DELETE_DRIVER", sensitive: true }),
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
    labelAr: "العملاء والتجار",
    labelEn: "Customers & merchants",
    hintAr: "سجل الشركات والعملاء والعقود",
    hintEn: "Customer profiles, commercial registrations and contracts",
    viewKey: "customers.view",
    functions: [
      fn("customers", "view", "عرض العملاء", "View customers", { code: "VIEW_CUSTOMERS" }),
      fn("customers", "create", "إضافة عميل", "Add a customer", { code: "CREATE_CUSTOMER" }),
      fn("customers", "edit", "تعديل بيانات عميل", "Edit customer profile", { code: "EDIT_CUSTOMER" }),
      fn("customers", "manage", "إدارة حسابات العملاء", "Manage customer accounts", { code: "MANAGE_CUSTOMERS" }),
    ],
  },

  /* ── Finance (§15–§19) ──────────────────────────────────────────────── */
  {
    id: "finance",
    sectionId: "finance",
    labelAr: "الإدارة المالية والتسويات والفواتير",
    labelEn: "Financial center, invoices & settlements",
    hintAr: "الإيرادات والمصروفات والعمولات والفواتير والتسويات والمراجعة المالية",
    hintEn: "Revenue, expenses, commissions, invoices, settlements and financial review",
    viewKey: "finance.view",
    functions: [
      fn("finance", "view", "عرض البيانات المالية", "View financial data", { code: "VIEW_FINANCE" }),
      fn("finance", "create", "إنشاء فاتورة", "Create an invoice", { code: "CREATE_INVOICE" }),
      fn("finance", "settle", "تسوية رحلة", "Settle a trip", { code: "CREATE_SETTLEMENT" }),
      fn("finance", "pay", "تسجيل دفعة", "Record a payment", { code: "RECORD_PAYMENT" }),
      fn("finance", "approve", "اعتماد تسوية", "Approve a settlement", { code: "APPROVE_SETTLEMENT", sensitive: true }),
      fn("finance", "postapprove", "تعديل مبلغ بعد الاعتماد", "Edit amount after approval", { code: "EDIT_AMOUNT_AFTER_APPROVAL", sensitive: true }),
      fn("finance", "delete", "حذف مستند مالي", "Delete financial document", { code: "DELETE_FINANCIAL_DOCUMENT", sensitive: true }),
      fn("revenue", "edit", "تعديل الإيرادات", "Edit revenue", { code: "EDIT_REVENUE", sensitive: true }),
      fn("expenses", "edit", "تعديل المصروفات", "Edit expenses", { code: "EDIT_EXPENSES", sensitive: true }),
      fn("commissions", "edit", "تعديل عمولة السائق والعمولات", "Edit commissions", { code: "EDIT_COMMISSION", sensitive: true }),
      fn("invoices", "view", "عرض الفواتير", "View invoices", { code: "VIEW_INVOICES" }),
      fn("invoices", "create", "إنشاء فاتورة جديدة", "Create invoice", { code: "CREATE_INVOICE" }),
      fn("invoices", "edit", "تعديل فاتورة قبل الاعتماد", "Edit invoice before approval", { code: "EDIT_INVOICE" }),
      fn("invoices", "approve", "اعتماد الفاتورة", "Approve invoice", { code: "APPROVE_INVOICE", sensitive: true }),
      fn("invoices", "reject", "رفض الفاتورة", "Reject invoice", { code: "REJECT_INVOICE" }),
      fn("invoices", "issue", "إصدار الفاتورة الضريبية", "Issue tax invoice", { code: "ISSUE_INVOICE" }),
      fn("invoices", "cancel", "إلغاء فاتورة", "Cancel invoice", { code: "CANCEL_INVOICE", sensitive: true }),
      fn("invoices", "print", "طباعة فاتورة / PDF", "Print / PDF invoice", { code: "PRINT_INVOICE" }),
      fn("invoices", "download", "تنزيل الفاتورة", "Download invoice", { code: "DOWNLOAD_INVOICE" }),
      fn("settlements", "view", "عرض التسويات المالية", "View settlements", { code: "VIEW_SETTLEMENTS" }),
      fn("settlements", "create", "إنشاء تسوية مالية", "Create settlement", { code: "CREATE_SETTLEMENT" }),
      fn("settlements", "edit", "تعديل التسوية قبل الاعتماد", "Edit settlement before approval", { code: "EDIT_SETTLEMENT" }),
      fn("settlements", "approve", "اعتماد التسوية المالية", "Approve settlement", { code: "APPROVE_SETTLEMENT", sensitive: true }),
      fn("settlements", "reject", "رفض التسوية المالية", "Reject settlement", { code: "REJECT_SETTLEMENT" }),
      fn("settlements", "reopen", "إعادة فتح تسوية معتمدة", "Reopen approved settlement", { code: "REOPEN_SETTLEMENT", sensitive: true }),
      fn("settlements", "export", "تصدير التسويات المالية", "Export settlements", { code: "EXPORT_SETTLEMENTS" }),
      fn("settlements", "print", "طباعة التسوية المالية", "Print settlement", { code: "PRINT_SETTLEMENTS" }),
      fn("payments", "view", "عرض المدفوعات والمقبوضات", "View payments & receivables", { code: "VIEW_PAYMENTS" }),
      fn("payments", "record", "تسجيل دفعة مالية", "Record payment", { code: "RECORD_PAYMENT", sensitive: true }),
      fn("payments", "edit", "تعديل دفعة مالية", "Edit payment", { code: "EDIT_PAYMENT", sensitive: true }),
      fn("payments", "cancel", "إلغاء دفعة مالية", "Cancel payment", { code: "CANCEL_PAYMENT", sensitive: true }),
      fn("payments", "receive", "تأكيد استلام دفعة", "Confirm payment receipt", { code: "RECEIVE_PAYMENT" }),
      fn("review", "view", "عرض المراجعة المالية", "View financial review", { code: "VIEW_FINANCIAL_REVIEW" }),
      fn("review", "perform", "إجراء المراجعة المالية", "Perform financial review", { code: "PERFORM_FINANCIAL_REVIEW" }),
      fn("review", "approve", "اعتماد المراجعة المالية", "Approve financial review", { code: "APPROVE_FINANCIAL_REVIEW", sensitive: true }),
      fn("review", "reject", "رفض المراجعة المالية", "Reject financial review", { code: "REJECT_FINANCIAL_REVIEW", sensitive: true }),
    ],
  },
  {
    id: "claims",
    sectionId: "finance",
    labelAr: "المطالبات والتعويضات",
    labelEn: "Claims & incidents",
    viewKey: "claims.view",
    functions: [
      fn("claims", "view", "عرض المطالبات", "View claims", { code: "VIEW_CLAIMS" }),
      fn("claims", "create", "تسجيل مطالبة", "Raise a claim", { code: "CREATE_CLAIM" }),
      fn("claims", "manage", "مراجعة واعتماد المطالبات", "Review & settle claims", { code: "MANAGE_CLAIMS" }),
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
      fn("reports", "view", "عرض التقارير", "View reports", { code: "VIEW_REPORTS" }),
      fn("reports", "export", "تصدير Excel / CSV", "Export Excel / CSV", { code: "EXPORT_REPORTS" }),
      fn("reports", "print", "طباعة / PDF", "Print / PDF", { code: "PRINT_REPORTS" }),
    ],
  },
  {
    id: "audit",
    sectionId: "insights",
    labelAr: "سجل العمليات والتدقيق",
    labelEn: "Audit trail",
    viewKey: "audit.view",
    functions: [fn("audit", "view", "عرض سجل العمليات", "View the audit trail", { code: "VIEW_AUDIT" })],
  },

  /* ── Administration ─────────────────────────────────────────────────── */
  {
    id: "permissions",
    sectionId: "administration",
    labelAr: "إدارة الأدوار والصلاحيات",
    labelEn: "Roles & permissions",
    hintAr: "التحكم الكامل في الأدوار والمصفوفة وصلاحيات المستخدمين ونطاق البيانات",
    hintEn: "Full control over roles, permission matrix, user overrides and data scope",
    viewKey: "permissions.manage",
    functions: [
      fn("permissions", "manage", "إدارة صلاحيات الأدوار والمستخدمين", "Manage role & user permissions", {
        code: "MANAGE_PERMISSIONS",
        sensitive: true,
      }),
    ],
  },
  {
    id: "users",
    sectionId: "administration",
    labelAr: "المستخدمون",
    labelEn: "Users",
    viewKey: "users.manage",
    functions: [
      fn("users", "view", "عرض المستخدمين", "View users", { code: "VIEW_USERS" }),
      fn("users", "manage", "إدارة المستخدمين", "Manage users", { code: "MANAGE_USERS", sensitive: true }),
    ],
  },
  {
    id: "settings",
    sectionId: "administration",
    labelAr: "إعدادات النظام",
    labelEn: "System settings",
    viewKey: "settings.manage",
    functions: [
      fn("settings", "manage", "إدارة إعدادات النظام", "Manage system settings", { code: "MANAGE_SETTINGS" }),
      fn("notifications", "view", "عرض الإشعارات والتنبيهات", "View notifications & alerts"),
    ],
  },
  {
    id: "branding",
    sectionId: "administration",
    labelAr: "هوية المؤسسة",
    labelEn: "Establishment identity",
    viewKey: "branding.manage",
    functions: [fn("branding", "manage", "إدارة الهوية البصرية", "Manage the visual identity", { code: "MANAGE_BRANDING" })],
  },
];

/** Every permission key the catalogue knows about. */
export const CATALOG_PERMISSION_KEYS: string[] = Array.from(
  new Set(PERMISSION_CATALOG_PAGES.flatMap((p) => p.functions.map((f) => f.key)))
);

/* ── Roles (§3) ─────────────────────────────────────────────────────────── */

export interface RoleDefinition {
  id: string;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  /** Core roles are the five the organisation runs on; the rest are operational. */
  core: boolean;
  /** Locked roles cannot be edited or disabled (the administrator can never be locked out). */
  locked?: boolean;
  /** Custom roles created by Super Admin can be deleted when no users are assigned. */
  custom?: boolean;
  /** Whether the role is currently active. */
  enabled?: boolean;
  /** Default data scope for this role. */
  dataScope?: DataScope;
}

export const ROLES: RoleDefinition[] = [
  {
    id: "SUPER_ADMIN",
    labelAr: "مدير النظام (Super Admin)",
    labelEn: "Super Admin / System Administrator",
    descriptionAr: "صلاحية كاملة على كل الأقسام، وهو المسؤول عن إدارة صلاحيات بقية الأدوار والمستخدمين.",
    descriptionEn: "Full access to every section, and the owner of role & user permissions.",
    core: true,
    locked: true,
    enabled: true,
    dataScope: "ALL",
  },
  {
    id: "OPERATIONS_MANAGER",
    labelAr: "مدير العمليات",
    labelEn: "Operations Manager",
    descriptionAr: "الرحلات والسائقون والشاحنات وطلبات النقل ومتابعة التشغيل.",
    descriptionEn: "Trips, drivers, trucks and transport requests.",
    core: true,
    enabled: true,
    dataScope: "ALL",
  },
  {
    id: "ACCOUNTANT",
    labelAr: "المحاسب المالي",
    labelEn: "Accountant",
    descriptionAr: "الفواتير والتسويات المالية والمدفوعات ومراجعة المطالبات.",
    descriptionEn: "Invoices, financial settlements, payments and claims review.",
    core: true,
    enabled: true,
    dataScope: "ALL",
  },
  {
    id: "DRIVER",
    labelAr: "السائق الميداني",
    labelEn: "Driver",
    descriptionAr: "رحلاته المسندة إليه، تنفيذها، وإثبات التسليم.",
    descriptionEn: "His assigned trips, their execution and proof of delivery.",
    core: true,
    enabled: true,
    dataScope: "ASSIGNED",
  },
  {
    id: "CUSTOMER",
    labelAr: "العميل / التاجر",
    labelEn: "Customer / Merchant",
    descriptionAr: "شحناته فقط، مع التتبع وبوليصة الشحن والفواتير الخاصة به.",
    descriptionEn: "Only his own shipments, with tracking, waybill and own invoices.",
    core: true,
    enabled: true,
    dataScope: "OWN",
  },
  {
    id: "GENERAL_MANAGER",
    labelAr: "المدير العام",
    labelEn: "General Manager",
    descriptionAr: "إشراف تنفيذي على التشغيل والمالية واعتماد المراجعات دون إدارة الصلاحيات.",
    descriptionEn: "Executive oversight of operations and finance, without permission control.",
    core: false,
    enabled: true,
    dataScope: "ALL",
  },
  {
    id: "DISPATCHER",
    labelAr: "موظف الترحيل",
    labelEn: "Dispatcher",
    descriptionAr: "إسناد الرحلات ومتابعة التنفيذ وحركة الشاحنات.",
    descriptionEn: "Assigning trips and following their execution.",
    core: false,
    enabled: true,
    dataScope: "ALL",
  },
  {
    id: "WAREHOUSE",
    labelAr: "أمين المستودع",
    labelEn: "Warehouse",
    descriptionAr: "تسجيل التحميل والتفريغ ومستندات الشحن وإثبات التسليم.",
    descriptionEn: "Recording loading, unloading and shipping documents.",
    core: false,
    enabled: true,
    dataScope: "BRANCH",
  },
  {
    id: "BROKER",
    labelAr: "وسيط الشحن",
    labelEn: "Broker",
    descriptionAr: "إنشاء طلبات النقل ومتابعة العملاء.",
    descriptionEn: "Creating transport requests and following up with customers.",
    core: false,
    enabled: true,
    dataScope: "OWN",
  },
  {
    id: "CUSTOMS_BROKER",
    labelAr: "مخلّص جمركي",
    labelEn: "Customs Broker",
    descriptionAr: "رفع المستندات الجمركية للرحلات وتخليص البضائع.",
    descriptionEn: "Uploading customs documents for trips.",
    core: false,
    enabled: true,
    dataScope: "ASSIGNED",
  },
  {
    id: "REPRESENTATIVE",
    labelAr: "مندوب",
    labelEn: "Representative",
    descriptionAr: "اطلاع ميداني على الرحلات والمستندات فقط.",
    descriptionEn: "Read-only field access to trips and documents.",
    core: false,
    enabled: true,
    dataScope: "REGION",
  },
];

export const ROLE_IDS = ROLES.map((r) => r.id);

export const DEFAULT_ROLE_DATA_SCOPES: Record<string, DataScope> = {
  SUPER_ADMIN: "ALL",
  GENERAL_MANAGER: "ALL",
  OPERATIONS_MANAGER: "ALL",
  ACCOUNTANT: "ALL",
  DISPATCHER: "ALL",
  DRIVER: "ASSIGNED",
  CUSTOMER: "OWN",
  CLIENT: "OWN",
  WAREHOUSE: "BRANCH",
  BROKER: "OWN",
  CUSTOMS_BROKER: "ASSIGNED",
  REPRESENTATIVE: "REGION",
};

/**
 * DEFAULT grants — what a fresh install gives each role.
 *
 * Principle of least privilege: a role receives only what its job needs.
 * Operations Manager holds no financial permission and no permission control;
 * Accountant holds financial operations (view/create/edit/approve invoices,
 * view/create/approve settlements, view/record payments) but NOT sensitive
 * post-approval overrides (`settlements.reopen`, `finance.postapprove`,
 * `finance.delete`, `revenue.edit`) nor fleet/driver assignment (`trips.delete`,
 * `trips.assign`, `vehicles.edit`).
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
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
    "vehicles.view", "drivers.view", "drivers.create",
    "gps.view",
    "reports.view", "reports.export", "reports.print", "audit.view",
    "settings.manage", "registrations.view", "registrations.review",
    "users.view",
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
    "registrations.view", "registrations.review",
    "assets.view",
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
    "pod.create", "pod.view",
    "documents.upload", "documents.view",
    "gps.view", "notifications.view",
  ],
  CUSTOMER: [
    "trips.view", "trips.create", "trips.track",
    "documents.view", "documents.download",
    "claims.create", "claims.view",
    "invoices.view", "invoices.download", "invoices.print",
    "notifications.view", "pod.view",
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

/* ── User Overrides, Temporary Grants & Disabled Permissions (§9–§13) ───── */

export interface UserPermissionOverride {
  userId: string;
  /** Explicitly granted permissions for this individual user. */
  allow: string[];
  /** Explicitly denied permissions for this user (overrides Role & Allow). */
  deny: string[];
  /** Optional individual data scope override. */
  dataScope?: DataScope;
  allowedBranches?: string[];
  allowedRegions?: string[];
  allowedCustomerIds?: string[];
  allowedVehicleIds?: string[];
  updatedAt: string;
  updatedBy?: string;
}

export interface TemporaryPermissionGrant {
  id: string;
  targetType: "USER" | "ROLE";
  targetId: string;
  permission: string;
  validFrom: string;
  validTo: string;
  reason?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  revokedAt?: string;
}

/* ── Runtime overrides (persisted) ──────────────────────────────────────── */

interface OverrideFile {
  version: number;
  updatedAt: string;
  overrides: Record<string, string[]>;
  roleDataScopes?: Record<string, DataScope>;
  disabledRoles?: string[];
  customRoles?: RoleDefinition[];
  roleMetaOverrides?: Record<string, Partial<RoleDefinition>>;
  userOverrides?: Record<string, UserPermissionOverride>;
  disabledPermissions?: string[];
  temporaryGrants?: TemporaryPermissionGrant[];
  hiddenPages?: Record<string, string[]>;
}

const STORE_PATH = path.resolve(process.cwd(), "data", "role-permissions.json");

let registryVersion = 1;
let overrides: Record<string, string[]> = {};
let roleDataScopes: Record<string, DataScope> = {};
let disabledRoles = new Set<string>();
let customRoles: RoleDefinition[] = [];
let roleMetaOverrides: Record<string, Partial<RoleDefinition>> = {};
let userOverrides: Record<string, UserPermissionOverride> = {};
let disabledPermissions = new Set<string>();
let temporaryGrants: TemporaryPermissionGrant[] = [];
let hiddenPagesByRole: Record<string, string[]> = {};
let loaded = false;

function knownPermissionSet(): Set<string> {
  return new Set([
    ...CATALOG_PERMISSION_KEYS,
    ...Object.values(DEFAULT_ROLE_PERMISSIONS).flat(),
    ...Object.values(PERMISSION_ALIASES),
  ]);
}

function loadOverrides(): void {
  if (loaded) return;
  loaded = true;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as OverrideFile;
      if (raw && typeof raw === "object") {
        const known = knownPermissionSet();
        overrides = {};
        if (raw.overrides) {
          for (const [role, list] of Object.entries(raw.overrides)) {
            if (!Array.isArray(list)) continue;
            overrides[role] = Array.from(
              new Set(
                list
                  .map((k) => (typeof k === "string" ? normalizePermissionKey(k) : ""))
                  .filter((k) => k && (known.has(k) || k === "*"))
              )
            );
          }
        }
        roleDataScopes = raw.roleDataScopes || {};
        disabledRoles = new Set((raw.disabledRoles || []).filter((r) => r !== "SUPER_ADMIN"));
        customRoles = Array.isArray(raw.customRoles) ? raw.customRoles : [];
        roleMetaOverrides = raw.roleMetaOverrides || {};
        userOverrides = raw.userOverrides || {};
        disabledPermissions = new Set(raw.disabledPermissions || []);
        temporaryGrants = Array.isArray(raw.temporaryGrants) ? raw.temporaryGrants : [];
        hiddenPagesByRole = raw.hiddenPages || {};
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
      roleDataScopes,
      disabledRoles: Array.from(disabledRoles),
      customRoles,
      roleMetaOverrides,
      userOverrides,
      disabledPermissions: Array.from(disabledPermissions),
      temporaryGrants,
      hiddenPages: hiddenPagesByRole,
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(payload, null, 2), "utf-8");
  } catch {
    /* In-memory only — the change still applies for this process. */
  }
}

/* ── Role Resolution & Management (§3) ──────────────────────────────────── */

export function getAllRoles(): RoleDefinition[] {
  loadOverrides();
  const base = ROLES.map((r) => {
    const meta = roleMetaOverrides[r.id] || {};
    return {
      ...r,
      ...meta,
      id: r.id,
      core: r.core,
      locked: r.locked,
      enabled: r.locked ? true : !disabledRoles.has(r.id),
      dataScope: roleDataScopes[r.id] || r.dataScope || DEFAULT_ROLE_DATA_SCOPES[r.id] || "OWN",
    };
  });
  const custom = customRoles.map((r) => ({
    ...r,
    custom: true,
    enabled: !disabledRoles.has(r.id),
    dataScope: roleDataScopes[r.id] || r.dataScope || "OWN",
  }));
  return [...base, ...custom];
}

export function isRoleKnown(role: string): boolean {
  loadOverrides();
  if (ROLE_IDS.includes(role)) return true;
  return customRoles.some((r) => r.id === role);
}

export function isRoleEnabled(role: string): boolean {
  loadOverrides();
  if (role === "SUPER_ADMIN") return true;
  return !disabledRoles.has(role);
}

export function roleDefinition(role: string): RoleDefinition | undefined {
  return getAllRoles().find((r) => r.id === role);
}

export function getRoleDataScope(role: string): DataScope {
  loadOverrides();
  if (role === "SUPER_ADMIN") return "ALL";
  return roleDataScopes[role] || DEFAULT_ROLE_DATA_SCOPES[role] || "OWN";
}

/** The permissions a role has right now (override if edited, default otherwise). */
export function getRolePermissions(role: string): string[] {
  loadOverrides();
  if (role === "SUPER_ADMIN") return ["*"];
  if (disabledRoles.has(role)) return [];
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

/* ── Global Permission Enable / Disable (§12) ───────────────────────────── */

export function isPermissionEnabled(permission: string): boolean {
  loadOverrides();
  const canonical = normalizePermissionKey(permission);
  if (canonical === "permissions.manage") return true; // never lock out permission admin
  return !disabledPermissions.has(canonical);
}

export function getDisabledPermissions(): string[] {
  loadOverrides();
  return Array.from(disabledPermissions);
}

export function setPermissionEnabled(
  permission: string,
  enabled: boolean,
  actor: { userId?: string; fullName?: string; role?: string },
  reason?: string
): { ok: boolean; error?: string; disabledPermissions?: string[]; version?: number } {
  loadOverrides();
  const canonical = normalizePermissionKey(permission);
  if (canonical === "permissions.manage" && !enabled) {
    return { ok: false, error: "Cannot disable permissions.manage" };
  }
  const before = Array.from(disabledPermissions);
  if (enabled) disabledPermissions.delete(canonical);
  else disabledPermissions.add(canonical);
  registryVersion += 1;
  persistOverrides();

  logAuditEvent({
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    action: enabled ? "PERMISSION_ENABLED" : "PERMISSION_DISABLED",
    entity: "permissions",
    entityId: canonical,
    oldValues: { disabledPermissions: before },
    newValues: { permission: canonical, enabled, disabledPermissions: Array.from(disabledPermissions) },
    reason,
  });

  return { ok: true, disabledPermissions: Array.from(disabledPermissions), version: registryVersion };
}

/* ── Temporary Permissions (§13) ────────────────────────────────────────── */

export function getTemporaryPermissions(includeExpired = false, now: Date = new Date()): TemporaryPermissionGrant[] {
  loadOverrides();
  if (includeExpired) return [...temporaryGrants];
  const ts = now.getTime();
  return temporaryGrants.filter((g) => {
    if (g.revokedAt) return false;
    const from = Date.parse(g.validFrom);
    const to = Date.parse(g.validTo);
    return (!Number.isFinite(from) || ts >= from) && (!Number.isFinite(to) || ts <= to);
  });
}

export function activeTemporaryPermissionsFor(role?: string, userId?: string, now: Date = new Date()): string[] {
  const active = getTemporaryPermissions(false, now);
  const out = new Set<string>();
  for (const g of active) {
    if (g.targetType === "ROLE" && role && g.targetId === role) {
      out.add(normalizePermissionKey(g.permission));
    }
    if (g.targetType === "USER" && userId && g.targetId === userId) {
      out.add(normalizePermissionKey(g.permission));
    }
  }
  return Array.from(out);
}

export function grantTemporaryPermission(
  input: {
    targetType: "USER" | "ROLE";
    targetId: string;
    permission: string;
    validFrom: string;
    validTo: string;
    reason?: string;
  },
  actor: { userId?: string; fullName?: string; role?: string }
): { ok: boolean; error?: string; grant?: TemporaryPermissionGrant; version?: number } {
  loadOverrides();
  const canonical = normalizePermissionKey(input.permission);
  const known = knownPermissionSet();
  if (!known.has(canonical)) {
    return { ok: false, error: `Unknown permission '${input.permission}'` };
  }
  const fromMs = Date.parse(input.validFrom);
  const toMs = Date.parse(input.validTo);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    return { ok: false, error: "validTo must be a valid date after validFrom" };
  }

  const grant: TemporaryPermissionGrant = {
    id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    targetType: input.targetType === "USER" ? "USER" : "ROLE",
    targetId: String(input.targetId),
    permission: canonical,
    validFrom: new Date(fromMs).toISOString(),
    validTo: new Date(toMs).toISOString(),
    reason: input.reason,
    createdBy: actor.userId,
    createdByName: actor.fullName,
    createdAt: new Date().toISOString(),
  };

  temporaryGrants.unshift(grant);
  registryVersion += 1;
  persistOverrides();

  logAuditEvent({
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    action: "TEMPORARY_PERMISSION_GRANTED",
    entity: "permissions",
    entityId: grant.targetId,
    oldValues: {},
    newValues: grant,
    reason: input.reason,
  });

  return { ok: true, grant, version: registryVersion };
}

export function revokeTemporaryPermission(
  grantId: string,
  actor: { userId?: string; fullName?: string; role?: string },
  reason?: string
): { ok: boolean; error?: string; version?: number } {
  loadOverrides();
  const target = temporaryGrants.find((g) => g.id === grantId);
  if (!target) return { ok: false, error: "Temporary permission grant not found" };
  target.revokedAt = new Date().toISOString();
  registryVersion += 1;
  persistOverrides();

  logAuditEvent({
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    action: "TEMPORARY_PERMISSION_REVOKED",
    entity: "permissions",
    entityId: target.targetId,
    oldValues: { permission: target.permission, validTo: target.validTo },
    newValues: { revokedAt: target.revokedAt },
    reason,
  });

  return { ok: true, version: registryVersion };
}

/* ── Individual User Overrides: Allow / Deny / Inherited + Data Scope (§9, §10) */

export function getUserOverride(userId: string): UserPermissionOverride {
  loadOverrides();
  return (
    userOverrides[userId] || {
      userId,
      allow: [],
      deny: [],
      updatedAt: new Date(0).toISOString(),
    }
  );
}

export function getAllUserOverrides(): UserPermissionOverride[] {
  loadOverrides();
  return Object.values(userOverrides);
}

export function setUserOverride(
  userId: string,
  update: {
    allow?: string[];
    deny?: string[];
    dataScope?: DataScope;
    allowedBranches?: string[];
    allowedRegions?: string[];
    allowedCustomerIds?: string[];
    allowedVehicleIds?: string[];
  },
  actor: { userId?: string; fullName?: string; role?: string },
  reason?: string
): { ok: boolean; error?: string; override?: UserPermissionOverride; version?: number } {
  loadOverrides();
  if (!userId) return { ok: false, error: "userId is required" };
  if (userId === "u-admin") {
    return { ok: false, error: "Primary SUPER_ADMIN user cannot be restricted" };
  }

  const known = knownPermissionSet();
  const cleanList = (arr?: string[]) =>
    Array.from(
      new Set(
        (arr || [])
          .map((k) => normalizePermissionKey(k))
          .filter((k) => k && k !== "*" && known.has(k))
      )
    );

  const before = userOverrides[userId] || { userId, allow: [], deny: [], updatedAt: "" };
  const allow = update.allow !== undefined ? cleanList(update.allow) : before.allow;
  // DENY always takes precedence over ALLOW: if a key is in deny, remove from allow
  const deny = update.deny !== undefined ? cleanList(update.deny) : before.deny;
  const filteredAllow = allow.filter((k) => !deny.includes(k));

  const next: UserPermissionOverride = {
    userId,
    allow: filteredAllow,
    deny,
    dataScope: update.dataScope !== undefined ? update.dataScope : before.dataScope,
    allowedBranches: update.allowedBranches !== undefined ? update.allowedBranches : before.allowedBranches,
    allowedRegions: update.allowedRegions !== undefined ? update.allowedRegions : before.allowedRegions,
    allowedCustomerIds: update.allowedCustomerIds !== undefined ? update.allowedCustomerIds : before.allowedCustomerIds,
    allowedVehicleIds: update.allowedVehicleIds !== undefined ? update.allowedVehicleIds : before.allowedVehicleIds,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.userId,
  };

  userOverrides[userId] = next;
  registryVersion += 1;
  persistOverrides();

  logAuditEvent({
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    action: "USER_PERMISSIONS_UPDATED",
    entity: "permissions",
    entityId: userId,
    oldValues: before,
    newValues: next,
    reason,
  });

  return { ok: true, override: next, version: registryVersion };
}

export function clearUserOverride(
  userId: string,
  actor: { userId?: string; fullName?: string; role?: string },
  reason?: string
): { ok: boolean; version?: number } {
  loadOverrides();
  const before = userOverrides[userId];
  delete userOverrides[userId];
  registryVersion += 1;
  persistOverrides();

  logAuditEvent({
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    action: "USER_PERMISSIONS_RESET",
    entity: "permissions",
    entityId: userId,
    oldValues: before || {},
    newValues: { inheritedOnly: true },
    reason,
  });

  return { ok: true, version: registryVersion };
}

/* ── Permission Evaluation (§1, §9, §10, §12, §13) ──────────────────────── */

/** Role-level permission check (used when no user context is passed). */
export function hasPermission(role: string | undefined, permission: string, userId?: string, now?: Date): boolean {
  if (!role) return false;
  loadOverrides();
  if (role === "SUPER_ADMIN") return true;
  if (!isRoleEnabled(role)) return false;

  const canonical = normalizePermissionKey(permission);
  if (!isPermissionEnabled(canonical)) return false;

  if (userId) {
    const uo = userOverrides[userId];
    if (uo) {
      if (uo.deny.includes(canonical)) return false;
      if (uo.allow.includes(canonical)) return true;
    }
  }

  const temp = activeTemporaryPermissionsFor(role, userId, now);
  if (temp.includes(canonical)) return true;

  const list = getRolePermissions(role);
  if (list.includes("*")) return true;
  return list.includes(canonical);
}

/** Full user-aware permission check with Allow / Deny / Temporary / Role precedence. */
export function hasUserPermission(
  user: { userId?: string; id?: string; role?: string } | undefined | null,
  permission: string,
  now?: Date
): boolean {
  if (!user || !user.role) return false;
  return hasPermission(user.role, permission, user.userId || user.id, now);
}

/** Effective permissions list for a role + optional userId. */
export function getEffectivePermissionList(role: string | undefined, userId?: string, now?: Date): string[] {
  if (!role) return [];
  loadOverrides();
  if (role === "SUPER_ADMIN") return [...CATALOG_PERMISSION_KEYS];
  if (!isRoleEnabled(role)) return [];

  const base = new Set<string>(getRolePermissions(role));
  if (base.has("*")) {
    CATALOG_PERMISSION_KEYS.forEach((k) => base.add(k));
    base.delete("*");
  }

  // Add active temporary permissions
  for (const t of activeTemporaryPermissionsFor(role, userId, now)) {
    base.add(t);
  }

  // Apply user-level allow & deny overrides
  if (userId && userOverrides[userId]) {
    const uo = userOverrides[userId];
    for (const a of uo.allow) base.add(a);
    for (const d of uo.deny) base.delete(d);
  }

  // Filter out globally disabled permissions
  for (const disabled of disabledPermissions) {
    if (disabled !== "permissions.manage") base.delete(disabled);
  }

  // Enforce page-level downward visibility: if a page's viewKey is not granted
  // or the page is explicitly hidden for this role, drop its child functions
  // unless explicitly granted via user allow override.
  const hiddenForRole = new Set(hiddenPagesByRole[role] || []);
  for (const page of PERMISSION_CATALOG_PAGES) {
    if (hiddenForRole.has(page.id)) {
      if (page.viewKey) base.delete(page.viewKey);
      for (const f of page.functions) base.delete(f.key);
    }
  }

  return Array.from(base);
}

export function getEffectiveDataScope(user: { userId?: string; id?: string; role?: string } | undefined | null): DataScope {
  if (!user || !user.role) return "OWN";
  loadOverrides();
  if (user.role === "SUPER_ADMIN") return "ALL";
  const uid = user.userId || user.id;
  if (uid && userOverrides[uid]?.dataScope) {
    return userOverrides[uid].dataScope!;
  }
  return getRoleDataScope(user.role);
}

/** True when the role may administer permissions at all. */
export function canManagePermissions(role: string | undefined, userId?: string): boolean {
  return role === "SUPER_ADMIN" || hasPermission(role, "permissions.manage", userId);
}

/** Page-level visibility for a role (and optional userId). */
export function visiblePagesFor(role: string | undefined, userId?: string): string[] {
  if (!role) return [];
  loadOverrides();
  if (role === "SUPER_ADMIN") return PERMISSION_CATALOG_PAGES.map((p) => p.id);
  if (!isRoleEnabled(role)) return [];
  const hidden = new Set(hiddenPagesByRole[role] || []);
  return PERMISSION_CATALOG_PAGES.filter(
    (page) => !hidden.has(page.id) && (!page.viewKey || hasPermission(role, page.viewKey, userId))
  ).map((p) => p.id);
}

/** Section-level visibility: a section is visible when any of its pages is. */
export function visibleSectionsFor(role: string | undefined, userId?: string): string[] {
  const pages = new Set(visiblePagesFor(role, userId));
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
  dataScope: DataScope;
  userOverride?: UserPermissionOverride;
  temporaryPermissions: string[];
  disabledPermissions: string[];
  version: number;
}

export function effectivePermissionsFor(role: string | undefined, userId?: string): EffectivePermissions {
  loadOverrides();
  const list = getRolePermissions(role || "");
  const wildcard = role === "SUPER_ADMIN" || list.includes("*");
  const effectiveList = wildcard ? CATALOG_PERMISSION_KEYS : getEffectivePermissionList(role, userId);
  return {
    role: role || "GUEST",
    wildcard,
    permissions: effectiveList,
    pages: visiblePagesFor(role, userId),
    sections: visibleSectionsFor(role, userId),
    dataScope: getEffectiveDataScope({ role, userId }),
    userOverride: userId ? userOverrides[userId] : undefined,
    temporaryPermissions: activeTemporaryPermissionsFor(role, userId),
    disabledPermissions: Array.from(disabledPermissions),
    version: registryVersion,
  };
}

/* ── Access Level Evaluation (§14) ──────────────────────────────────────── */

export function getModuleAccessLevel(role: string, sectionId: string): AccessLevel {
  loadOverrides();
  if (role === "SUPER_ADMIN") return "ADMIN";
  const perms = new Set(getRolePermissions(role));
  const sectionPages = PERMISSION_CATALOG_PAGES.filter((p) => p.sectionId === sectionId);
  const allFns = sectionPages.flatMap((p) => p.functions);
  if (!allFns.length) return "NONE";

  const grantedFns = allFns.filter((f) => perms.has(f.key));
  if (grantedFns.length === 0) return "NONE";
  if (grantedFns.length === allFns.length) return "ADMIN";

  const hasManageOrApprove = grantedFns.some((f) =>
    ["manage", "approve", "reopen", "delete", "postapprove"].includes(f.action)
  );
  if (hasManageOrApprove) return "MANAGE";

  const hasOperate = grantedFns.some((f) =>
    ["create", "edit", "assign", "transition", "settle", "pay", "record", "upload", "perform", "export"].includes(
      f.action
    )
  );
  if (hasOperate) return "OPERATE";

  return "VIEW";
}

export function keysForModuleAccessLevel(sectionId: string, level: AccessLevel): string[] {
  const sectionPages = PERMISSION_CATALOG_PAGES.filter((p) => p.sectionId === sectionId);
  const allFns = sectionPages.flatMap((p) => p.functions);
  if (level === "NONE") return [];
  if (level === "VIEW") {
    return allFns.filter((f) => ["view", "track", "download", "print"].includes(f.action)).map((f) => f.key);
  }
  if (level === "OPERATE") {
    return allFns
      .filter((f) =>
        [
          "view",
          "track",
          "download",
          "print",
          "create",
          "edit",
          "assign",
          "transition",
          "upload",
          "request",
          "record",
          "pay",
          "receive",
          "perform",
          "export",
        ].includes(f.action)
      )
      .map((f) => f.key);
  }
  if (level === "MANAGE") {
    return allFns
      .filter((f) => !f.sensitive || ["approve", "settle", "manage", "cancel", "verify", "issue"].includes(f.action))
      .map((f) => f.key);
  }
  return allFns.map((f) => f.key);
}

/* ── Administration & Role Mutations ────────────────────────────────────── */

export interface SaveResult {
  ok: boolean;
  error?: string;
  code?: string;
  role?: string;
  permissions?: string[];
  added?: string[];
  removed?: string[];
  dataScope?: DataScope;
  version?: number;
}

/** Validates a candidate permission list against the catalogue. */
export function validatePermissionList(list: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(list)) return { ok: false, error: "permissions must be an array of permission keys" };
  const known = knownPermissionSet();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") return { ok: false, error: "every permission must be a string key" };
    if (item === "*") continue; // the wildcard is reserved for SUPER_ADMIN
    const canonical = normalizePermissionKey(item);
    if (!known.has(canonical)) {
      return { ok: false, error: `Unknown permission '${item}' — it is not part of the platform catalogue` };
    }
    if (!out.includes(canonical)) out.push(canonical);
  }
  return { ok: true, value: out };
}

/**
 * Saves the permission set of a role.
 */
export function setRolePermissions(
  role: string,
  permissions: unknown,
  actor: { userId?: string; fullName?: string; role?: string },
  reason?: string,
  dataScope?: DataScope
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
  const beforeScope = getRoleDataScope(role);
  const after = valid.value;

  // Downward consistency: a hidden page takes its functions with it.
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
  if (dataScope && DATA_SCOPES.includes(dataScope)) {
    roleDataScopes[role] = dataScope;
  }
  registryVersion += 1;
  persistOverrides();

  logAuditEvent({
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    action: "ROLE_PERMISSIONS_UPDATED",
    entity: "permissions",
    entityId: role,
    oldValues: { role, permissions: before, dataScope: beforeScope },
    newValues: { role, permissions: after, added, removed, dataScope: getRoleDataScope(role) },
    reason,
  });

  return {
    ok: true,
    role,
    permissions: after,
    added,
    removed,
    dataScope: getRoleDataScope(role),
    version: registryVersion,
  };
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
  delete roleDataScopes[role];
  delete hiddenPagesByRole[role];
  disabledRoles.delete(role);
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
    dataScope: getRoleDataScope(role),
    version: registryVersion,
  };
}

export function setRoleDataScope(
  role: string,
  dataScope: DataScope,
  actor: { userId?: string; fullName?: string; role?: string },
  reason?: string
): { ok: boolean; error?: string; dataScope?: DataScope; version?: number } {
  loadOverrides();
  if (!isRoleKnown(role)) return { ok: false, error: `Unknown role '${role}'` };
  if (role === "SUPER_ADMIN") return { ok: false, error: "SUPER_ADMIN data scope is locked to ALL" };
  if (!DATA_SCOPES.includes(dataScope)) return { ok: false, error: "Invalid data scope" };

  const before = getRoleDataScope(role);
  roleDataScopes[role] = dataScope;
  registryVersion += 1;
  persistOverrides();

  logAuditEvent({
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    action: "ROLE_DATA_SCOPE_UPDATED",
    entity: "permissions",
    entityId: role,
    oldValues: { dataScope: before },
    newValues: { dataScope },
    reason,
  });

  return { ok: true, dataScope, version: registryVersion };
}

export function createCustomRole(
  input: {
    id: string;
    labelAr: string;
    labelEn: string;
    descriptionAr?: string;
    descriptionEn?: string;
    permissions?: string[];
    dataScope?: DataScope;
  },
  actor: { userId?: string; fullName?: string; role?: string }
): { ok: boolean; error?: string; code?: string; role?: RoleDefinition; version?: number } {
  loadOverrides();
  const id = String(input.id || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");
  if (!id || id.length < 2) {
    return { ok: false, error: "A valid role identifier is required", code: "INVALID_ROLE_ID" };
  }
  if (isRoleKnown(id)) {
    return { ok: false, error: `Role '${id}' already exists`, code: "ROLE_EXISTS" };
  }
  if (!input.labelAr?.trim()) {
    return { ok: false, error: "Role Arabic name is required", code: "MISSING_LABEL" };
  }

  const validPerms = validatePermissionList(input.permissions || []);
  if (!validPerms.ok) {
    return { ok: false, error: validPerms.error, code: "INVALID_PERMISSIONS" };
  }

  const newRole: RoleDefinition = {
    id,
    labelAr: input.labelAr.trim(),
    labelEn: (input.labelEn || input.labelAr).trim(),
    descriptionAr: (input.descriptionAr || "دور مخصص").trim(),
    descriptionEn: (input.descriptionEn || "Custom role").trim(),
    core: false,
    locked: false,
    custom: true,
    enabled: true,
    dataScope: input.dataScope && DATA_SCOPES.includes(input.dataScope) ? input.dataScope : "OWN",
  };

  customRoles.push(newRole);
  overrides[id] = validPerms.value;
  roleDataScopes[id] = newRole.dataScope!;
  registryVersion += 1;
  persistOverrides();

  logAuditEvent({
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    action: "ROLE_CREATED",
    entity: "permissions",
    entityId: id,
    oldValues: {},
    newValues: { role: newRole, permissions: validPerms.value },
  });

  return { ok: true, role: newRole, version: registryVersion };
}

export function cloneRole(
  sourceRoleId: string,
  input: { id: string; labelAr: string; labelEn?: string; descriptionAr?: string; descriptionEn?: string },
  actor: { userId?: string; fullName?: string; role?: string }
): { ok: boolean; error?: string; code?: string; role?: RoleDefinition; version?: number } {
  loadOverrides();
  const source = roleDefinition(sourceRoleId);
  if (!source) return { ok: false, error: "Source role not found", code: "UNKNOWN_ROLE" };
  const perms =
    sourceRoleId === "SUPER_ADMIN" ? [...CATALOG_PERMISSION_KEYS] : [...getRolePermissions(sourceRoleId)];
  const scope = getRoleDataScope(sourceRoleId);
  return createCustomRole(
    {
      id: input.id,
      labelAr: input.labelAr,
      labelEn: input.labelEn || `${source.labelEn} (Copy)`,
      descriptionAr: input.descriptionAr || `نسخة من دور ${source.labelAr}`,
      descriptionEn: input.descriptionEn || `Cloned from ${source.labelEn}`,
      permissions: perms,
      dataScope: scope,
    },
    actor
  );
}

export function updateRoleMeta(
  roleId: string,
  input: { labelAr?: string; labelEn?: string; descriptionAr?: string; descriptionEn?: string; dataScope?: DataScope },
  actor: { userId?: string; fullName?: string; role?: string }
): { ok: boolean; error?: string; role?: RoleDefinition; version?: number } {
  loadOverrides();
  const def = roleDefinition(roleId);
  if (!def) return { ok: false, error: "Role not found" };
  if (def.locked) return { ok: false, error: "Locked role cannot be modified" };

  const customIdx = customRoles.findIndex((r) => r.id === roleId);
  if (customIdx >= 0) {
    customRoles[customIdx] = {
      ...customRoles[customIdx],
      labelAr: input.labelAr?.trim() || customRoles[customIdx].labelAr,
      labelEn: input.labelEn?.trim() || customRoles[customIdx].labelEn,
      descriptionAr: input.descriptionAr?.trim() ?? customRoles[customIdx].descriptionAr,
      descriptionEn: input.descriptionEn?.trim() ?? customRoles[customIdx].descriptionEn,
      dataScope: input.dataScope || customRoles[customIdx].dataScope,
    };
  } else {
    roleMetaOverrides[roleId] = {
      ...roleMetaOverrides[roleId],
      ...(input.labelAr ? { labelAr: input.labelAr.trim() } : {}),
      ...(input.labelEn ? { labelEn: input.labelEn.trim() } : {}),
      ...(input.descriptionAr !== undefined ? { descriptionAr: input.descriptionAr.trim() } : {}),
      ...(input.descriptionEn !== undefined ? { descriptionEn: input.descriptionEn.trim() } : {}),
    };
  }

  if (input.dataScope && DATA_SCOPES.includes(input.dataScope)) {
    roleDataScopes[roleId] = input.dataScope;
  }

  registryVersion += 1;
  persistOverrides();

  const updated = roleDefinition(roleId)!;
  logAuditEvent({
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    action: "ROLE_UPDATED",
    entity: "permissions",
    entityId: roleId,
    oldValues: def,
    newValues: updated,
  });

  return { ok: true, role: updated, version: registryVersion };
}

export function setRoleStatus(
  roleId: string,
  enabled: boolean,
  actor: { userId?: string; fullName?: string; role?: string },
  reason?: string
): { ok: boolean; error?: string; code?: string; enabled?: boolean; version?: number } {
  loadOverrides();
  const def = roleDefinition(roleId);
  if (!def) return { ok: false, error: "Unknown role", code: "UNKNOWN_ROLE" };
  if (def.locked || roleId === "SUPER_ADMIN") {
    return { ok: false, error: "SUPER_ADMIN role cannot be disabled", code: "ROLE_LOCKED" };
  }

  const before = !disabledRoles.has(roleId);
  if (enabled) disabledRoles.delete(roleId);
  else disabledRoles.add(roleId);
  registryVersion += 1;
  persistOverrides();

  logAuditEvent({
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    action: enabled ? "ROLE_ENABLED" : "ROLE_DISABLED",
    entity: "permissions",
    entityId: roleId,
    oldValues: { enabled: before },
    newValues: { enabled },
    reason,
  });

  return { ok: true, enabled, version: registryVersion };
}

export function deleteCustomRole(
  roleId: string,
  linkedUsersCount: number,
  actor: { userId?: string; fullName?: string; role?: string }
): { ok: boolean; error?: string; code?: string; version?: number } {
  loadOverrides();
  const def = roleDefinition(roleId);
  if (!def) return { ok: false, error: "Unknown role", code: "UNKNOWN_ROLE" };
  if (def.locked || def.core || ROLE_IDS.includes(roleId)) {
    return {
      ok: false,
      error: "Built-in system roles cannot be deleted. You may disable or customize them instead.",
      code: "BUILTIN_ROLE_PROTECTED",
    };
  }
  if (linkedUsersCount > 0) {
    return {
      ok: false,
      error: `Cannot delete role '${roleId}' while ${linkedUsersCount} user(s) are assigned to it.`,
      code: "ROLE_HAS_USERS",
    };
  }

  customRoles = customRoles.filter((r) => r.id !== roleId);
  delete overrides[roleId];
  delete roleDataScopes[roleId];
  disabledRoles.delete(roleId);
  registryVersion += 1;
  persistOverrides();

  logAuditEvent({
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    action: "ROLE_DELETED",
    entity: "permissions",
    entityId: roleId,
    oldValues: def,
    newValues: { deleted: true },
  });

  return { ok: true, version: registryVersion };
}

export function getRegistryVersion(): number {
  loadOverrides();
  return registryVersion;
}

/**
 * The permission change log, newest first.
 */
export function getPermissionAudit(limit = 100): AuditRecord[] {
  return getAuditLogs({ entity: "permissions", limit });
}

/** The full catalogue, shaped for the administration screen. */
export function getCatalog() {
  loadOverrides();
  return {
    sections: PERMISSION_CATALOG_SECTIONS,
    pages: PERMISSION_CATALOG_PAGES,
    actions: PERMISSION_ACTIONS.map((a) => ({ id: a, ...ACTION_LABELS[a] })),
    dataScopes: DATA_SCOPES.map((s) => ({ id: s, ...DATA_SCOPE_LABELS[s] })),
    accessLevels: ACCESS_LEVELS.map((l) => ({ id: l, ...ACCESS_LEVEL_LABELS[l] })),
    roles: getAllRoles(),
    defaults: DEFAULT_ROLE_PERMISSIONS,
    disabledPermissions: Array.from(disabledPermissions),
    temporaryGrants: getTemporaryPermissions(true),
    version: getRegistryVersion(),
  };
}
