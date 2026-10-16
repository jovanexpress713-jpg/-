/**
 * EJAZ Transport — Regional Representatives Management API
 * ─────────────────────────────────────────────────────────────────────────────
 * Empowers the Operations Manager to administer the five independent Saudi
 * regional representatives: account lifecycle, region assignments, operational
 * permissions matrix, regional trip audit, and operational change history.
 */

import { Router, type Response } from "express";
import { db, type UserEntity } from "../db";
import { authenticate, requireRole, type AuthenticatedRequest } from "../auth/middleware";
import { hashPassword } from "../auth/jwt";
import {
  SAUDI_REGIONS,
  isTripInRegion,
  normalizeRegionId,
  regionLabelForId,
} from "../services/cityRegistry";
import {
  getUserOverride,
  setUserOverride,
  getEffectivePermissionList,
} from "../services/permissionService";
import { logAuditEvent, getAuditLogs } from "../services/auditService";

const router = Router();

// Allowed roles: Operations Manager & Super Admin (executive oversight)
const requireOpsOrAdmin = requireRole("OPERATIONS_MANAGER", "SUPER_ADMIN", "GENERAL_MANAGER");
const requireOpsOrAdminMutate = requireRole("OPERATIONS_MANAGER", "SUPER_ADMIN");

export interface RepresentativePermissionsInput {
  // 1. إدارة الرحلات
  canViewTrips?: boolean;
  canCreateTrips?: boolean;
  canEditTrips?: boolean;
  canAssignTrips?: boolean;
  canTransitionTrips?: boolean;
  canTrackTrips?: boolean;
  canCancelTrips?: boolean;
  canReopenTrips?: boolean;
  canReassignTrips?: boolean;
  canDeleteTrips?: boolean;

  // 2. إدارة العملاء
  canViewCustomers?: boolean;
  canCreateCustomers?: boolean;
  canEditCustomers?: boolean;
  canDeleteCustomers?: boolean;

  // 3. إدارة السائقين والشاحنات
  canViewDrivers?: boolean;
  canCreateDrivers?: boolean;
  canEditDrivers?: boolean;
  canToggleDriverStatus?: boolean;
  canViewVehicles?: boolean;
  canManageVehicles?: boolean;

  // 4. التسعير والتعرفة
  canViewTariffs?: boolean;
  canEnterCustomPrice?: boolean;
  canEditPrice?: boolean;
  canRequestPriceApproval?: boolean;
  canApprovePrice?: boolean;
  canManageTariffs?: boolean;

  // 5. الصلاحيات التشغيلية الإضافية
  canViewReports?: boolean;
  canViewTripHistory?: boolean;
  canAddNotes?: boolean;
  canUploadDocuments?: boolean;
  canExportData?: boolean;
}

export const DEFAULT_REPRESENTATIVE_PERMISSIONS: RepresentativePermissionsInput = {
  // Trips: view, create, edit, transition, track (Least Privilege)
  canViewTrips: true,
  canCreateTrips: true,
  canEditTrips: true,
  canAssignTrips: false,
  canTransitionTrips: true,
  canTrackTrips: true,
  canCancelTrips: false,
  canReopenTrips: false,
  canReassignTrips: false,
  canDeleteTrips: false,

  // Customers: view, create, edit
  canViewCustomers: true,
  canCreateCustomers: true,
  canEditCustomers: true,
  canDeleteCustomers: false,

  // Drivers & Vehicles: view, create drivers, view vehicles
  canViewDrivers: true,
  canCreateDrivers: true,
  canEditDrivers: false,
  canToggleDriverStatus: false,
  canViewVehicles: true,
  canManageVehicles: false,

  // Pricing: view tariffs, enter custom price, request approval
  canViewTariffs: true,
  canEnterCustomPrice: true,
  canEditPrice: false,
  canRequestPriceApproval: true,
  canApprovePrice: false,
  canManageTariffs: false,

  // Additional: trip history, notes, upload documents
  canViewReports: false,
  canViewTripHistory: true,
  canAddNotes: true,
  canUploadDocuments: true,
  canExportData: false,
};

/**
 * Maps granular operational booleans to canonical catalog permission keys.
 */
export function mapFlagsToCatalog(perms: RepresentativePermissionsInput): { allow: string[]; deny: string[] } {
  const allow: string[] = ["notifications.view", "documents.view"];
  const deny: string[] = [];

  const check = (granted: boolean | undefined, keys: string[]) => {
    if (granted === true) {
      for (const k of keys) {
        if (!allow.includes(k)) allow.push(k);
        const idx = deny.indexOf(k);
        if (idx !== -1) deny.splice(idx, 1);
      }
    } else if (granted === false) {
      for (const k of keys) {
        if (!deny.includes(k)) deny.push(k);
        const idx = allow.indexOf(k);
        if (idx !== -1) allow.splice(idx, 1);
      }
    }
  };

  // 1. Trips
  check(perms.canViewTrips, ["trips.view"]);
  check(perms.canCreateTrips, ["trips.create"]);
  check(perms.canEditTrips, ["trips.edit"]);
  check(perms.canAssignTrips, ["trips.assign"]);
  check(perms.canTransitionTrips, ["trips.transition"]);
  check(perms.canTrackTrips, ["trips.track"]);
  check(perms.canCancelTrips, ["trips.cancel"]);
  check(perms.canReopenTrips, ["trips.reopen"]);
  check(perms.canReassignTrips, ["trips.reassign"]);
  check(perms.canDeleteTrips, ["trips.delete"]);

  // 2. Customers
  check(perms.canViewCustomers, ["customers.view"]);
  check(perms.canCreateCustomers, ["customers.create"]);
  check(perms.canEditCustomers, ["customers.edit"]);
  check(perms.canDeleteCustomers, ["customers.delete", "customers.manage"]);

  // 3. Drivers & Vehicles
  check(perms.canViewDrivers, ["drivers.view"]);
  check(perms.canCreateDrivers, ["drivers.create"]);
  check(perms.canEditDrivers, ["drivers.edit"]);
  check(perms.canToggleDriverStatus, ["drivers.toggle_status", "drivers.manage"]);
  check(perms.canViewVehicles, ["vehicles.view"]);
  check(perms.canManageVehicles, ["vehicles.create", "vehicles.edit"]);

  // 4. Pricing & Tariffs
  check(perms.canViewTariffs, ["tariffs.view"]);
  check(perms.canEnterCustomPrice, ["tariffs.create"]);
  check(perms.canEditPrice, ["pricing.edit"]);
  check(perms.canRequestPriceApproval, ["tariffs.request"]);
  check(perms.canApprovePrice, ["tariffs.approve"]);
  check(perms.canManageTariffs, ["tariffs.manage"]);

  // 5. Additional Operational Permissions
  check(perms.canViewReports, ["reports.view"]);
  check(perms.canViewTripHistory, ["audit.view"]);
  check(perms.canAddNotes, ["trips.notes"]);
  check(perms.canUploadDocuments, ["documents.upload"]);
  check(perms.canExportData, ["trips.export", "reports.export", "data.export"]);

  return { allow, deny };
}

/**
 * Derives the boolean capability flags for a representative given their ID and role.
 */
export function deriveRepresentativePermissions(userId: string, role = "REPRESENTATIVE"): RepresentativePermissionsInput {
  const effective = new Set(getEffectivePermissionList(role, userId));
  return {
    canViewTrips: effective.has("trips.view"),
    canCreateTrips: effective.has("trips.create"),
    canEditTrips: effective.has("trips.edit"),
    canAssignTrips: effective.has("trips.assign"),
    canTransitionTrips: effective.has("trips.transition"),
    canTrackTrips: effective.has("trips.track") || effective.has("trips.view"),
    canCancelTrips: effective.has("trips.cancel"),
    canReopenTrips: effective.has("trips.reopen"),
    canReassignTrips: effective.has("trips.reassign") || effective.has("trips.assign"),
    canDeleteTrips: effective.has("trips.delete"),

    canViewCustomers: effective.has("customers.view"),
    canCreateCustomers: effective.has("customers.create"),
    canEditCustomers: effective.has("customers.edit"),
    canDeleteCustomers: effective.has("customers.delete"),

    canViewDrivers: effective.has("drivers.view"),
    canCreateDrivers: effective.has("drivers.create"),
    canEditDrivers: effective.has("drivers.edit"),
    canToggleDriverStatus: effective.has("drivers.toggle_status"),
    canViewVehicles: effective.has("vehicles.view"),
    canManageVehicles: effective.has("vehicles.create") || effective.has("vehicles.edit"),

    canViewTariffs: effective.has("tariffs.view"),
    canEnterCustomPrice: effective.has("tariffs.create"),
    canEditPrice: effective.has("pricing.edit"),
    canRequestPriceApproval: effective.has("tariffs.request"),
    canApprovePrice: effective.has("tariffs.approve"),
    canManageTariffs: effective.has("tariffs.manage"),

    canViewReports: effective.has("reports.view"),
    canViewTripHistory: effective.has("audit.view"),
    canAddNotes: effective.has("trips.notes") || effective.has("trips.edit"),
    canUploadDocuments: effective.has("documents.upload"),
    canExportData: effective.has("trips.export") || effective.has("reports.export") || effective.has("data.export"),
  };
}

// Seed initial overrides for existing 5 representatives
const SEEDED_REP_IDS = ["u-rep-north", "u-rep-east", "u-rep-west", "u-rep-south", "u-rep-central"];
for (const id of SEEDED_REP_IDS) {
  const existing = getUserOverride(id);
  const user = db.users.get(id);
  const reg = user?.region || "المنطقة الوسطى";
  if (!existing || !existing.allowedRegions?.length || (!existing.allow?.length && !existing.deny?.length)) {
    const { allow, deny } = mapFlagsToCatalog(DEFAULT_REPRESENTATIVE_PERMISSIONS);
    setUserOverride(
      id,
      {
        allow,
        deny,
        dataScope: "REGION",
        allowedRegions: [reg],
      },
      { userId: "system", fullName: "System Initializer", role: "SUPER_ADMIN" },
      "Seeded least-privilege permissions for regional representative"
    );
  }
}

/**
 * Computes live operational trip statistics for a representative.
 */
function computeRepMetrics(rep: UserEntity) {
  const repRegion = rep.region || "";
  const allTrips = Array.from(db.trips.values());
  const scopedTrips = allTrips.filter((t) => {
    if (t.createdBy === rep.id) return true;
    if (repRegion && isTripInRegion(t, repRegion)) return true;
    return false;
  });

  const activeStatuses = [
    "DRAFT_CREATED",
    "PENDING_APPROVAL",
    "CONFIRMED",
    "ASSIGNED",
    "HEADING_TO_LOADING",
    "ARRIVED_LOADING",
    "LOADED",
    "IN_TRANSIT",
    "ARRIVED_DESTINATION",
  ];

  return {
    totalTrips: scopedTrips.length,
    activeTrips: scopedTrips.filter((t) => activeStatuses.includes(t.status)).length,
    deliveredTrips: scopedTrips.filter((t) => t.status === "DELIVERED" || t.status === "COMPLETED").length,
    pendingPriceTrips: scopedTrips.filter((t) => t.priceStatus === "PENDING_APPROVAL" || t.priceApprovalRequired).length,
  };
}

/**
 * GET /api/representatives — List all regional representatives with operational metrics.
 */
router.get("/", authenticate, requireOpsOrAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const reps = Array.from(db.users.values()).filter(
    (u) => u.role === "REPRESENTATIVE" || (u.region && u.role !== "SUPER_ADMIN" && u.role !== "GENERAL_MANAGER")
  );

  const formatted = reps.map((rep) => ({
    id: rep.id,
    fullName: rep.fullName,
    email: rep.email,
    phone: rep.phone,
    role: rep.role,
    regionId: normalizeRegionId(rep.regionId ?? rep.region),
    region: rep.region || "المنطقة الوسطى",
    isActive: rep.isActive,
    createdAt: rep.createdAt,
    permissions: deriveRepresentativePermissions(rep.id, rep.role),
    metrics: computeRepMetrics(rep),
  }));

  return res.json({
    total: formatted.length,
    regions: SAUDI_REGIONS,
    representatives: formatted,
  });
});

/**
 * GET /api/representatives/:id — Get detailed info for a single representative.
 */
router.get("/:id", authenticate, requireOpsOrAdmin, (req: AuthenticatedRequest, res: Response) => {
  const rep = db.users.get(String(req.params.id));
  if (!rep) {
    return res.status(404).json({ error: "Representative not found", code: "NOT_FOUND" });
  }

  const uo = getUserOverride(rep.id);
  return res.json({
    representative: {
      id: rep.id,
      fullName: rep.fullName,
      email: rep.email,
      phone: rep.phone,
      role: rep.role,
      regionId: normalizeRegionId(rep.regionId ?? rep.region),
      region: rep.region || "المنطقة الوسطى",
      isActive: rep.isActive,
      createdAt: rep.createdAt,
      permissions: deriveRepresentativePermissions(rep.id, rep.role),
      override: uo,
      metrics: computeRepMetrics(rep),
    },
  });
});

/**
 * POST /api/representatives — Create a new regional representative account.
 */
router.post("/", authenticate, requireOpsOrAdminMutate, async (req: AuthenticatedRequest, res: Response) => {
  const { fullName, email, phone, password, region, permissions } = req.body || {};

  if (!fullName?.trim() || !email?.trim() || !phone?.trim() || !password?.trim()) {
    return res.status(400).json({ error: "الرجاء إدخال كافة البيانات الأساسية المطلوبة (الاسم، البريد، الجوال، كلمة المرور)" });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const existingUser = Array.from(db.users.values()).find((u) => u.email.toLowerCase() === cleanEmail);
  if (existingUser) {
    return res.status(409).json({ error: "البريد الإلكتروني مسجل مسبقاً في النظام", code: "EMAIL_EXISTS" });
  }

  const targetRegionId = normalizeRegionId(region);
  const targetRegion = targetRegionId ? regionLabelForId(targetRegionId) : null;
  if (!targetRegionId || !targetRegion) {
    return res.status(400).json({
      error: `المنطقة غير صحيحة. المناطق الرسمية الخمس المعتمدة هي: ${SAUDI_REGIONS.join("، ")}`,
      code: "INVALID_REGION",
    });
  }

  const passwordHash = await hashPassword(String(password).trim());
  const newId = `u-rep-${Date.now()}`;
  const now = new Date().toISOString();

  const newRep: UserEntity = {
    id: newId,
    email: cleanEmail,
    fullName: String(fullName).trim(),
    phone: String(phone).trim(),
    role: "REPRESENTATIVE",
    regionId: targetRegionId,
    region: targetRegion,
    passwordHash,
    isActive: true,
    createdAt: now,
  };

  db.users.set(newId, newRep);

  // Configure operational capabilities with least privilege defaults
  const effectiveInput: RepresentativePermissionsInput = {
    ...DEFAULT_REPRESENTATIVE_PERMISSIONS,
    ...(permissions || {}),
  };
  const { allow, deny } = mapFlagsToCatalog(effectiveInput);

  setUserOverride(
    newId,
    {
      allow,
      deny,
      dataScope: "REGION",
      allowedRegions: [targetRegion],
    },
    {
      userId: req.user?.userId,
      fullName: req.user?.fullName,
      role: req.user?.role,
    },
    "Initial regional representative permissions configured by Operations Manager"
  );

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "REPRESENTATIVE_CREATED",
    entity: "users",
    entityId: newId,
    newValues: {
      id: newId,
      fullName: newRep.fullName,
      email: newRep.email,
      regionId: targetRegionId,
      region: targetRegion,
      permissions: deriveRepresentativePermissions(newId, "REPRESENTATIVE"),
    },
  });

  return res.status(201).json({
    message: `تم إنشاء حساب ممثّل ${targetRegion} بنجاح`,
    representative: {
      id: newId,
      fullName: newRep.fullName,
      email: newRep.email,
      phone: newRep.phone,
      role: newRep.role,
      regionId: targetRegionId,
      region: targetRegion,
      isActive: true,
      permissions: deriveRepresentativePermissions(newId, "REPRESENTATIVE"),
    },
  });
});

/**
 * PUT /api/representatives/:id — Update representative info, region, or permissions.
 */
router.put("/:id", authenticate, requireOpsOrAdminMutate, async (req: AuthenticatedRequest, res: Response) => {
  const repId = String(req.params.id);
  const rep = db.users.get(repId);
  if (!rep) {
    return res.status(404).json({ error: "Representative not found", code: "NOT_FOUND" });
  }

  const { fullName, phone, region, password, isActive, permissions, reason } = req.body || {};
  const oldSnapshot = {
    fullName: rep.fullName,
    phone: rep.phone,
    regionId: rep.regionId,
    region: rep.region,
    isActive: rep.isActive,
    permissions: deriveRepresentativePermissions(repId, rep.role),
  };

  if (fullName?.trim()) rep.fullName = String(fullName).trim();
  if (phone?.trim()) rep.phone = String(phone).trim();
  if (password?.trim()) {
    rep.passwordHash = await hashPassword(String(password).trim());
  }

  if (region) {
    const validRegionId = normalizeRegionId(region);
    const validRegion = validRegionId ? regionLabelForId(validRegionId) : null;
    if (!validRegionId || !validRegion) {
      return res.status(400).json({
        error: `المنطقة غير صحيحة. المناطق الرسمية الخمس المعتمدة هي: ${SAUDI_REGIONS.join("، ")}`,
        code: "INVALID_REGION",
      });
    }
    rep.regionId = validRegionId;
    rep.region = validRegion;
  }

  if (typeof isActive === "boolean") {
    rep.isActive = isActive;
  }

  if (permissions) {
    const { allow, deny } = mapFlagsToCatalog(permissions);
    setUserOverride(
      repId,
      {
        allow,
        deny,
        dataScope: "REGION",
        allowedRegions: rep.region ? [rep.region] : undefined,
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
      },
      reason || "Operational permissions updated by Operations Manager"
    );
  }

  const updatedPermissions = deriveRepresentativePermissions(repId, rep.role);

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "REPRESENTATIVE_UPDATED",
    entity: "users",
    entityId: repId,
    oldValues: oldSnapshot,
    newValues: {
      fullName: rep.fullName,
      phone: rep.phone,
      regionId: rep.regionId,
      region: rep.region,
      isActive: rep.isActive,
      permissions: updatedPermissions,
    },
    reason,
  });

  return res.json({
    message: "تم تحديث بيانات وصلاحيات الممثل بنجاح",
    representative: {
      id: rep.id,
      fullName: rep.fullName,
      email: rep.email,
      phone: rep.phone,
      role: rep.role,
      regionId: rep.regionId,
      region: rep.region,
      isActive: rep.isActive,
      permissions: updatedPermissions,
    },
  });
});

/**
 * POST /api/representatives/:id/status — Toggle active / inactive state with operational audit.
 */
router.post("/:id/status", authenticate, requireOpsOrAdminMutate, (req: AuthenticatedRequest, res: Response) => {
  const repId = String(req.params.id);
  const rep = db.users.get(repId);
  if (!rep) {
    return res.status(404).json({ error: "Representative not found", code: "NOT_FOUND" });
  }

  const { enabled, reason } = req.body || {};
  const targetActive = typeof enabled === "boolean" ? enabled : !rep.isActive;
  const oldActive = rep.isActive;
  rep.isActive = targetActive;

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: targetActive ? "REPRESENTATIVE_ACCOUNT_ACTIVATED" : "REPRESENTATIVE_ACCOUNT_DEACTIVATED",
    entity: "users",
    entityId: repId,
    oldValues: { isActive: oldActive },
    newValues: { isActive: targetActive },
    reason: reason || (targetActive ? "تنشيط حساب الممثل" : "تعطيل حساب الممثل مؤقتاً"),
  });

  return res.json({
    message: targetActive ? "تم تفعيل حساب الممثل بنجاح" : "تم تعطيل حساب الممثل وحفظ سجله التشغيلي كاملاً",
    isActive: targetActive,
  });
});

/**
 * GET /api/representatives/:id/trips — Review all trips created by or within this representative's region.
 */
router.get("/:id/trips", authenticate, requireOpsOrAdmin, (req: AuthenticatedRequest, res: Response) => {
  const repId = String(req.params.id);
  const rep = db.users.get(repId);
  if (!rep) {
    return res.status(404).json({ error: "Representative not found", code: "NOT_FOUND" });
  }

  const repRegion = rep.region || "";
  const allTrips = Array.from(db.trips.values());
  const scopedTrips = allTrips
    .filter((t) => {
      if (t.createdBy === repId) return true;
      if (repRegion && isTripInRegion(t, repRegion)) return true;
      return false;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json({
    total: scopedTrips.length,
    representativeId: repId,
    representativeName: rep.fullName,
    region: repRegion,
    trips: scopedTrips,
  });
});

/**
 * GET /api/representatives/:id/audit — Review the audit history for this representative.
 */
router.get("/:id/audit", authenticate, requireOpsOrAdmin, (req: AuthenticatedRequest, res: Response) => {
  const repId = String(req.params.id);
  const logs = getAuditLogs({ entityId: repId, limit: 100 });
  return res.json({
    total: logs.length,
    representativeId: repId,
    audit: logs,
  });
});

export default router;
