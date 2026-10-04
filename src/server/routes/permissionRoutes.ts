/**
 * EJAZ Transport — Role & Permission Administration API
 * ─────────────────────────────────────────────────────────────────────────
 * Everything the «إدارة الأدوار والصلاحيات» screen needs, and the endpoint every
 * client calls on boot to learn what it is allowed to show.
 *
 * Guard model
 * ───────────
 * • `GET  /api/permissions/me`      — any signed-in user (reads only their own).
 * • everything else               — `permissions.manage` (the system
 *   administrator). A role cannot read or edit another role's grants, and no
 *   role can grant itself anything: the guard runs before the handler.
 */

import { Router, type Response } from "express";
import { authenticate, requirePermission, type AuthenticatedRequest } from "../auth/middleware";
import {
  getCatalog,
  getRolePermissions,
  getDefaultRolePermissions,
  roleIsCustomized,
  roleDefinition,
  ROLES,
  PERMISSION_CATALOG_PAGES,
  effectivePermissionsFor,
  setRolePermissions,
  resetRolePermissions,
  getPermissionAudit,
  getRegistryVersion,
} from "../services/permissionService";
import { logAuditEvent } from "../services/auditService";

const router = Router();

/** The administrator-only guard. Kept explicit so it reads as a rule, not a detail. */
const requirePermissionAdmin = requirePermission("permissions.manage");

/**
 * GET /api/permissions/me — the caller's own effective grant.
 *
 * The console calls this once per session and drives the sidebar, the page
 * router, the search index and every gated button from the answer. It never
 * receives another role's grants.
 */
router.get("/me", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role;
  const effective = effectivePermissionsFor(role);

  return res.json({
    role,
    wildcard: effective.wildcard,
    permissions: effective.permissions,
    pages: effective.pages,
    sections: effective.sections,
    version: effective.version,
    canManagePermissions: effective.permissions.includes("permissions.manage") || role === "SUPER_ADMIN",
  });
});

/** GET /api/permissions/catalog — the section → page → function tree. */
router.get("/catalog", authenticate, requirePermissionAdmin, (_req: AuthenticatedRequest, res: Response) => {
  return res.json(getCatalog());
});

/** GET /api/permissions/roles — every role with its live and default grants. */
router.get("/roles", authenticate, requirePermissionAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const roles = ROLES.map((role) => ({
    ...role,
    permissions: getRolePermissions(role.id),
    defaultPermissions: getDefaultRolePermissions(role.id),
    customized: roleIsCustomized(role.id),
    locked: !!role.locked,
    pageIds: PERMISSION_CATALOG_PAGES.filter(
      (p) => !p.viewKey || getRolePermissions(role.id).includes("*") || getRolePermissions(role.id).includes(p.viewKey)
    ).map((p) => p.id),
  }));

  return res.json({ roles, version: getRegistryVersion() });
});

/** GET /api/permissions/roles/:role — one role in detail. */
router.get("/roles/:role", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const role = String(req.params.role);
  const def = roleDefinition(role);
  if (!def) return res.status(404).json({ error: "Unknown role", code: "UNKNOWN_ROLE" });

  return res.json({
    role: {
      ...def,
      permissions: getRolePermissions(role),
      defaultPermissions: getDefaultRolePermissions(role),
      customized: roleIsCustomized(role),
      locked: !!def.locked,
    },
    version: getRegistryVersion(),
  });
});

/**
 * PUT /api/permissions/roles/:role — save a role's permissions.
 *
 * The body replaces the grant wholesale; the registry validates every key
 * against the catalogue, refuses to touch a locked role, keeps page/function
 * consistency, bumps the registry version and writes the before/after diff to
 * the audit trail.
 */
router.put("/roles/:role", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const role = String(req.params.role);
  const { permissions, reason } = req.body || {};

  const result = setRolePermissions(
    role,
    permissions,
    { userId: req.user?.userId, fullName: req.user?.fullName, role: req.user?.role },
    reason ? String(reason) : undefined
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
    version: result.version,
  });
});

/** POST /api/permissions/roles/:role/reset — back to factory defaults. */
router.post("/roles/:role/reset", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const role = String(req.params.role);
  const result = resetRolePermissions(
    role,
    { userId: req.user?.userId, fullName: req.user?.fullName, role: req.user?.role },
    req.body?.reason ? String(req.body.reason) : undefined
  );

  if (!result.ok) {
    const status = result.code === "UNKNOWN_ROLE" ? 404 : result.code === "ROLE_LOCKED" ? 409 : 400;
    return res.status(status).json({ error: result.error, code: result.code });
  }

  return res.json({ message: `Default permissions restored for ${role}`, ...result });
});

/** GET /api/permissions/audit — who changed which role, when, from what to what. */
router.get("/audit", authenticate, requirePermissionAdmin, (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  return res.json({ entries: getPermissionAudit(limit) });
});

/**
 * GET /api/permissions/changes — lightweight version probe.
 *
 * A signed-in client polls this cheaply; when `version` moves it refetches
 * `/me`, so an administrator's change reaches open sessions without a sign-out.
 */
router.get("/changes", authenticate, (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ version: getRegistryVersion() });
});

/** POST /api/permissions/audit/probe — records that the administrator opened the screen. */
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
