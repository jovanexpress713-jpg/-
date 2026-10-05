/**
 * EJAZ Transport — Role, User & Permission Administration API
 * ─────────────────────────────────────────────────────────────────────────
 * Everything the «إدارة الأدوار والصلاحيات» screen needs, and the endpoint every
 * client calls on boot to learn what it is allowed to show.
 */

import { Router, type Response } from "express";
import { db } from "../db";
import { authenticate, requirePermission, type AuthenticatedRequest } from "../auth/middleware";
import {
  getCatalog,
  getAllRoles,
  getRolePermissions,
  getDefaultRolePermissions,
  getRoleDataScope,
  roleIsCustomized,
  roleDefinition,
  isRoleKnown,
  PERMISSION_CATALOG_PAGES,
  effectivePermissionsFor,
  setRolePermissions,
  resetRolePermissions,
  createCustomRole,
  cloneRole,
  updateRoleMeta,
  setRoleStatus,
  deleteCustomRole,
  getModuleAccessLevel,
  keysForModuleAccessLevel,
  getUserOverride,
  setUserOverride,
  clearUserOverride,
  getTemporaryPermissions,
  grantTemporaryPermission,
  revokeTemporaryPermission,
  setPermissionEnabled,
  getDisabledPermissions,
  getPermissionAudit,
  getRegistryVersion,
  type AccessLevel,
  type DataScope,
} from "../services/permissionService";
import { logAuditEvent } from "../services/auditService";

const router = Router();

/** The administrator-only guard. */
const requirePermissionAdmin = requirePermission("permissions.manage");

function actorFrom(req: AuthenticatedRequest) {
  return {
    userId: req.user?.userId,
    fullName: req.user?.fullName,
    role: req.user?.role,
  };
}

/**
 * GET /api/permissions/me — the caller's own effective grant (role + user overrides + temp grants).
 */
router.get("/me", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role;
  const userId = req.user?.userId;
  const effective = effectivePermissionsFor(role, userId);

  return res.json({
    role,
    userId,
    wildcard: effective.wildcard,
    permissions: effective.permissions,
    pages: effective.pages,
    sections: effective.sections,
    dataScope: effective.dataScope,
    userOverride: effective.userOverride,
    temporaryPermissions: effective.temporaryPermissions,
    disabledPermissions: effective.disabledPermissions,
    version: effective.version,
    canManagePermissions: effective.permissions.includes("permissions.manage") || role === "SUPER_ADMIN",
  });
});

/** GET /api/permissions/catalog — the section → page → function tree. */
router.get("/catalog", authenticate, requirePermissionAdmin, (_req: AuthenticatedRequest, res: Response) => {
  return res.json(getCatalog());
});

/** GET /api/permissions/roles — every role with its live and default grants and assigned users. */
router.get("/roles", authenticate, requirePermissionAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const allUsers = Array.from(db.users.values());
  const roles = getAllRoles().map((role) => {
    const linkedUsers = allUsers
      .filter((u) => u.role === role.id)
      .map((u) => ({ id: u.id, fullName: u.fullName, email: u.email, isActive: u.isActive }));
    const perms = getRolePermissions(role.id);
    return {
      ...role,
      permissions: perms,
      defaultPermissions: getDefaultRolePermissions(role.id),
      customized: roleIsCustomized(role.id),
      locked: !!role.locked,
      enabled: role.enabled !== false,
      dataScope: getRoleDataScope(role.id),
      userCount: linkedUsers.length,
      users: linkedUsers,
      pageIds: PERMISSION_CATALOG_PAGES.filter(
        (p) => !p.viewKey || perms.includes("*") || perms.includes(p.viewKey)
      ).map((p) => p.id),
    };
  });

  return res.json({ roles, version: getRegistryVersion() });
});

/** POST /api/permissions/roles — create a new custom role (§3). */
router.post("/roles", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { id, labelAr, labelEn, descriptionAr, descriptionEn, permissions, dataScope } = req.body || {};
  const result = createCustomRole(
    { id, labelAr, labelEn, descriptionAr, descriptionEn, permissions, dataScope },
    actorFrom(req)
  );
  if (!result.ok) {
    const status = result.code === "ROLE_EXISTS" ? 409 : 400;
    return res.status(status).json({ error: result.error, code: result.code });
  }
  return res.status(201).json({ message: "Role created", role: result.role, version: result.version });
});

/** POST /api/permissions/roles/:role/clone — clone an existing role (§3). */
router.post("/roles/:role/clone", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const sourceRole = String(req.params.role);
  const { id, labelAr, labelEn, descriptionAr, descriptionEn } = req.body || {};
  const result = cloneRole(sourceRole, { id, labelAr, labelEn, descriptionAr, descriptionEn }, actorFrom(req));
  if (!result.ok) {
    const status = result.code === "UNKNOWN_ROLE" ? 404 : result.code === "ROLE_EXISTS" ? 409 : 400;
    return res.status(status).json({ error: result.error, code: result.code });
  }
  return res.status(201).json({ message: "Role cloned", role: result.role, version: result.version });
});

/** PATCH /api/permissions/roles/:role/meta — update role metadata and dataScope (§3, §8). */
router.patch("/roles/:role/meta", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const role = String(req.params.role);
  const { labelAr, labelEn, descriptionAr, descriptionEn, dataScope } = req.body || {};
  const result = updateRoleMeta(role, { labelAr, labelEn, descriptionAr, descriptionEn, dataScope }, actorFrom(req));
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  return res.json({ message: "Role updated", role: result.role, version: result.version });
});

/** POST /api/permissions/roles/:role/status — enable or disable a role (§3). */
router.post("/roles/:role/status", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const role = String(req.params.role);
  const enabled = Boolean(req.body?.enabled);
  const reason = req.body?.reason ? String(req.body.reason) : undefined;
  const result = setRoleStatus(role, enabled, actorFrom(req), reason);
  if (!result.ok) {
    const status = result.code === "UNKNOWN_ROLE" ? 404 : result.code === "ROLE_LOCKED" ? 409 : 400;
    return res.status(status).json({ error: result.error, code: result.code });
  }
  return res.json({ message: `Role ${enabled ? "enabled" : "disabled"}`, role, enabled, version: result.version });
});

/** DELETE /api/permissions/roles/:role — delete a custom role if no users are bound (§3). */
router.delete("/roles/:role", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const role = String(req.params.role);
  const linkedCount = Array.from(db.users.values()).filter((u) => u.role === role).length;
  const result = deleteCustomRole(role, linkedCount, actorFrom(req));
  if (!result.ok) {
    const status =
      result.code === "UNKNOWN_ROLE"
        ? 404
        : result.code === "BUILTIN_ROLE_PROTECTED" || result.code === "ROLE_HAS_USERS"
          ? 409
          : 400;
    return res.status(status).json({ error: result.error, code: result.code });
  }
  return res.json({ message: `Role ${role} deleted`, version: result.version });
});

/** GET /api/permissions/roles/:role — one role in detail. */
router.get("/roles/:role", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const role = String(req.params.role);
  const def = roleDefinition(role);
  if (!def) return res.status(404).json({ error: "Unknown role", code: "UNKNOWN_ROLE" });
  const linkedUsers = Array.from(db.users.values())
    .filter((u) => u.role === role)
    .map((u) => ({ id: u.id, fullName: u.fullName, email: u.email, isActive: u.isActive }));

  return res.json({
    role: {
      ...def,
      permissions: getRolePermissions(role),
      defaultPermissions: getDefaultRolePermissions(role),
      customized: roleIsCustomized(role),
      locked: !!def.locked,
      dataScope: getRoleDataScope(role),
      users: linkedUsers,
    },
    version: getRegistryVersion(),
  });
});

/**
 * PUT /api/permissions/roles/:role — save a role's permissions (and optional dataScope).
 */
router.put("/roles/:role", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const role = String(req.params.role);
  const { permissions, reason, dataScope } = req.body || {};

  const result = setRolePermissions(
    role,
    permissions,
    actorFrom(req),
    reason ? String(reason) : undefined,
    dataScope as DataScope | undefined
  );

  if (!result.ok) {
    const status = result.code === "UNKNOWN_ROLE" ? 404 : result.code === "ROLE_LOCKED" ? 409 : 400;
    return res.status(status).json({ error: result.error, code: result.code });
  }

  return res.json({
    message: `Permissions saved for ${role}`,
    role: result.role,
    permissions: result.permissions,
    added: result.added,
    removed: result.removed,
    dataScope: result.dataScope,
    version: result.version,
  });
});

/** POST /api/permissions/roles/:role/module-level — apply a module access level (§14). */
router.post(
  "/roles/:role/module-level",
  authenticate,
  requirePermissionAdmin,
  (req: AuthenticatedRequest, res: Response) => {
    const role = String(req.params.role);
    const { sectionId, level, reason } = req.body || {};
    const def = roleDefinition(role);
    if (!def) return res.status(404).json({ error: "Unknown role", code: "UNKNOWN_ROLE" });
    if (def.locked) return res.status(409).json({ error: "Locked role cannot be restricted", code: "ROLE_LOCKED" });

    const sectionPages = PERMISSION_CATALOG_PAGES.filter((p) => p.sectionId === sectionId);
    if (!sectionPages.length) return res.status(400).json({ error: "Unknown module/section" });

    const sectionAllKeys = new Set(sectionPages.flatMap((p) => p.functions.map((f) => f.key)));
    const current = getRolePermissions(role).filter((k) => !sectionAllKeys.has(k));
    const nextModuleKeys = keysForModuleAccessLevel(sectionId, level as AccessLevel);
    const merged = Array.from(new Set([...current, ...nextModuleKeys]));

    const result = setRolePermissions(
      role,
      merged,
      actorFrom(req),
      reason || `Module ${sectionId} access level set to ${level}`
    );
    if (!result.ok) return res.status(400).json({ error: result.error, code: result.code });

    return res.json({
      message: `Module ${sectionId} set to ${level} for ${role}`,
      level: getModuleAccessLevel(role, sectionId),
      ...result,
    });
  }
);

/** POST /api/permissions/roles/:role/reset — back to factory defaults. */
router.post("/roles/:role/reset", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const role = String(req.params.role);
  const result = resetRolePermissions(
    role,
    actorFrom(req),
    req.body?.reason ? String(req.body.reason) : undefined
  );

  if (!result.ok) {
    const status = result.code === "UNKNOWN_ROLE" ? 404 : result.code === "ROLE_LOCKED" ? 409 : 400;
    return res.status(status).json({ error: result.error, code: result.code });
  }

  return res.json({ message: `Default permissions restored for ${role}`, ...result });
});

/* ── Individual User Overrides & Role Assignment (§8, §9, §10, §27) ─────── */

/** GET /api/permissions/users — list all users with role, overrides, and effective permissions. */
router.get("/users", authenticate, requirePermissionAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const users = Array.from(db.users.values()).map((u) => {
    const eff = effectivePermissionsFor(u.role, u.id);
    const override = getUserOverride(u.id);
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      role: u.role,
      isActive: u.isActive,
      driverId: u.driverId,
      customerId: u.customerId,
      dataScope: eff.dataScope,
      rolePermissions: getRolePermissions(u.role),
      effectivePermissions: eff.permissions,
      override: {
        allow: override.allow,
        deny: override.deny,
        dataScope: override.dataScope,
        allowedBranches: override.allowedBranches || [],
        allowedRegions: override.allowedRegions || [],
        allowedCustomerIds: override.allowedCustomerIds || [],
        allowedVehicleIds: override.allowedVehicleIds || [],
      },
    };
  });
  return res.json({ users, version: getRegistryVersion() });
});

/** PUT /api/permissions/users/:userId — update user role, active state, allow/deny overrides, or dataScope. */
router.put("/users/:userId", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const userId = String(req.params.userId);
  const user = db.users.get(userId);
  if (!user) return res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });

  const {
    role,
    isActive,
    allow,
    deny,
    dataScope,
    allowedBranches,
    allowedRegions,
    allowedCustomerIds,
    allowedVehicleIds,
    reason,
  } = req.body || {};

  // §27 — Super Admin protection: never allow disabling or demoting the last active SUPER_ADMIN
  const activeAdmins = Array.from(db.users.values()).filter((u) => u.role === "SUPER_ADMIN" && u.isActive);
  if (user.role === "SUPER_ADMIN" && activeAdmins.length <= 1) {
    if ((role && role !== "SUPER_ADMIN") || isActive === false) {
      return res.status(409).json({
        error: "Cannot demote or disable the last active SUPER_ADMIN account",
        code: "LAST_SUPER_ADMIN_PROTECTED",
      });
    }
  }

  // Only an existing SUPER_ADMIN may assign the SUPER_ADMIN role
  if (role === "SUPER_ADMIN" && req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      error: "Only SUPER_ADMIN can assign the SUPER_ADMIN role",
      code: "SUPER_ADMIN_ESCALATION_DENIED",
    });
  }

  if (role && role !== user.role) {
    if (!isRoleKnown(role)) {
      return res.status(400).json({ error: `Unknown role '${role}'`, code: "UNKNOWN_ROLE" });
    }
    const oldRole = user.role;
    user.role = role;
    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "USER_ROLE_CHANGED",
      entity: "permissions",
      entityId: userId,
      oldValues: { role: oldRole },
      newValues: { role },
      reason,
    });
  }

  if (typeof isActive === "boolean" && isActive !== user.isActive) {
    const oldActive = user.isActive;
    user.isActive = isActive;
    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: isActive ? "USER_ACCOUNT_ENABLED" : "USER_ACCOUNT_DISABLED",
      entity: "permissions",
      entityId: userId,
      oldValues: { isActive: oldActive },
      newValues: { isActive },
      reason,
    });
  }

  if (
    allow !== undefined ||
    deny !== undefined ||
    dataScope !== undefined ||
    allowedBranches !== undefined ||
    allowedRegions !== undefined ||
    allowedCustomerIds !== undefined ||
    allowedVehicleIds !== undefined
  ) {
    const result = setUserOverride(
      userId,
      { allow, deny, dataScope, allowedBranches, allowedRegions, allowedCustomerIds, allowedVehicleIds },
      actorFrom(req),
      reason
    );
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
  }

  const eff = effectivePermissionsFor(user.role, user.id);
  return res.json({
    message: "User permissions updated",
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      dataScope: eff.dataScope,
      effectivePermissions: eff.permissions,
      override: getUserOverride(user.id),
    },
    version: getRegistryVersion(),
  });
});

/** POST /api/permissions/users/:userId/reset — clear individual user overrides back to INHERITED. */
router.post(
  "/users/:userId/reset",
  authenticate,
  requirePermissionAdmin,
  (req: AuthenticatedRequest, res: Response) => {
    const userId = String(req.params.userId);
    const result = clearUserOverride(userId, actorFrom(req), req.body?.reason);
    return res.json({ message: "User permissions reset to role defaults", ...result });
  }
);

/* ── Temporary Permissions (§13) & Global Enable/Disable (§12) ──────────── */

/** GET /api/permissions/temporary — list temporary permission grants. */
router.get("/temporary", authenticate, requirePermissionAdmin, (_req: AuthenticatedRequest, res: Response) => {
  return res.json({
    grants: getTemporaryPermissions(true),
    activeGrants: getTemporaryPermissions(false),
    disabledPermissions: getDisabledPermissions(),
    version: getRegistryVersion(),
  });
});

/** POST /api/permissions/temporary — grant a temporary permission. */
router.post("/temporary", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { targetType, targetId, permission, validFrom, validTo, reason } = req.body || {};
  const result = grantTemporaryPermission(
    { targetType, targetId, permission, validFrom, validTo, reason },
    actorFrom(req)
  );
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  return res.status(201).json({ message: "Temporary permission granted", grant: result.grant, version: result.version });
});

/** DELETE /api/permissions/temporary/:id — revoke a temporary permission. */
router.delete("/temporary/:id", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const result = revokeTemporaryPermission(String(req.params.id), actorFrom(req), req.body?.reason);
  if (!result.ok) {
    return res.status(404).json({ error: result.error });
  }
  return res.json({ message: "Temporary permission revoked", version: result.version });
});

/** POST /api/permissions/toggle-global — enable or disable a permission globally (§12). */
router.post("/toggle-global", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { permission, enabled, reason } = req.body || {};
  if (!permission) return res.status(400).json({ error: "permission is required" });
  const result = setPermissionEnabled(String(permission), Boolean(enabled), actorFrom(req), reason);
  if (!result.ok) return res.status(400).json({ error: result.error });
  return res.json({ message: "Permission status updated", ...result });
});

/** POST /api/permissions/keys/:permission/status — enable or disable a permission globally (§12). */
router.post("/keys/:permission/status", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const permission = String(req.params.permission);
  const { enabled, reason } = req.body || {};
  const result = setPermissionEnabled(permission, Boolean(enabled), actorFrom(req), reason);
  if (!result.ok) return res.status(400).json({ error: result.error });
  return res.json({ message: "Permission status updated", ...result });
});

/** GET /api/permissions/audit — who changed which role/user, when, from what to what. */
router.get("/audit", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  return res.json({ entries: getPermissionAudit(limit) });
});

/** GET /api/permissions/changes — lightweight version probe. */
router.get("/changes", authenticate, (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ version: getRegistryVersion() });
});

/** POST /api/permissions/audit/viewed — records that the administrator opened the screen. */
router.post("/audit/viewed", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "ROLE_PERMISSIONS_SCREEN_OPENED",
    entity: "permissions",
    entityId: "console",
  });
  return res.json({ ok: true });
});

export default router;
