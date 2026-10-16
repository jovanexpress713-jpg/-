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
import { SAUDI_REGIONS, normalizeRegion, isTripInRegion } from "../services/cityRegistry";
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
  canCreateTrips?: boolean;
  canEditTrips?: boolean;
  canTrackTrips?: boolean;
  canManageCustomers?: boolean;
  canManageDrivers?: boolean;
  canEnterCustomPrice?: boolean;
  canRequestPriceApproval?: boolean;
  canCancelTrips?: boolean;
  canReopenTrips?: boolean;
  canAssignTrips?: boolean;
}

/**
 * Maps granular operational booleans to canonical catalog permission keys.
 */
function mapFlagsToCatalog(perms: RepresentativePermissionsInput): { allow: string[]; deny: string[] } {
  const allow: string[] = ["trips.view", "documents.view", "notifications.view"];
  const deny: string[] = [];

  const check = (granted: boolean | undefined, keys: string[]) => {
    if (granted === true) {
      for (const k of keys) {
        if (!allow.includes(k)) allow.push(k);
      }
    } else if (granted === false) {
      for (const k of keys) {
        if (!deny.includes(k)) deny.push(k);
      }
    }
  };

  check(perms.canCreateTrips, ["trips.create"]);
  check(perms.canEditTrips, ["trips.edit"]);
  check(perms.canTrackTrips, ["trips.track"]);
  check(perms.canManageCustomers, ["customers.view", "customers.create", "customers.edit"]);
  check(perms.canManageDrivers, ["drivers.view", "drivers.create", "drivers.edit"]);
  check(perms.canEnterCustomPrice, ["tariffs.create"]);
  check(perms.canRequestPriceApproval, ["tariffs.request"]);
  check(perms.canCancelTrips, ["trips.cancel"]);
  check(perms.canReopenTrips, ["trips.reopen"]);
  check(perms.canAssignTrips, ["trips.assign"]);

  return { allow, deny };
}

/**
 * Derives the boolean capability flags for a representative given their ID and role.
 */
function deriveRepresentativePermissions(userId: string, role = "REPRESENTATIVE"): RepresentativePermissionsInput {
  const effective = new Set(getEffectivePermissionList(role, userId));
  return {
    canCreateTrips: effective.has("trips.create"),
    canEditTrips: effective.has("trips.edit"),
    canTrackTrips: effective.has("trips.track") || effective.has("trips.view"),
    canManageCustomers: effective.has("customers.create") || effective.has("customers.edit"),
    canManageDrivers: effective.has("drivers.create") || effective.has("drivers.edit"),
    canEnterCustomPrice: effective.has("tariffs.create"),
    canRequestPriceApproval: effective.has("tariffs.request"),
    canCancelTrips: effective.has("trips.cancel"),
    canReopenTrips: effective.has("trips.reopen"),
    canAssignTrips: effective.has("trips.assign"),
  };
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

  const targetRegion = normalizeRegion(region);
  if (!targetRegion) {
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
    region: targetRegion,
    passwordHash,
    isActive: true,
    createdAt: now,
  };

  db.users.set(newId, newRep);

  // Configure operational capabilities
  const { allow, deny } = mapFlagsToCatalog(permissions || {
    canCreateTrips: true,
    canEditTrips: true,
    canTrackTrips: true,
    canManageCustomers: true,
    canEnterCustomPrice: true,
    canRequestPriceApproval: true,
  });

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
    const validRegion = normalizeRegion(region);
    if (!validRegion) {
      return res.status(400).json({
        error: `المنطقة غير صحيحة. المناطق الرسمية الخمس المعتمدة هي: ${SAUDI_REGIONS.join("، ")}`,
        code: "INVALID_REGION",
      });
    }
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
