import type { Request, Response, NextFunction } from "express";
import { verifyToken, type TokenPayload } from "./jwt";
import { statusForUser } from "../services/registrationService";
import { db } from "../db";
import {
  getCityRegionId,
  isTripInRegion,
  isTripInRegionId,
  normalizeRegionId,
  regionLabelForId,
} from "../services/cityRegistry";
import { logAuditEvent } from "../services/auditService";
import {
  DEFAULT_ROLE_PERMISSIONS,
  hasPermission as registryHasPermission,
  canManagePermissions,
  effectivePermissionsFor,
  getEffectiveDataScope,
  getUserOverride,
  type DataScope,
} from "../services/permissionService";

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

/**
 * Factory defaults, re-exported for compatibility.
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = DEFAULT_ROLE_PERMISSIONS;

export type RegionalResource = "trips" | "customers" | "drivers";

type RegionalEntity = {
  id?: string;
  regionId?: string;
  region?: string;
  city?: string;
  originCity?: string;
  destinationCity?: string;
  customerId?: string;
  driverId?: string;
  additionalDriverId?: string;
};

/**
 * The representative's scope is resolved from the live database record only.
 * A region claim in an old/stale JWT must never restore or widen access.
 */
export function getRepresentativeRegionId(user: TokenPayload | undefined): string | null {
  if (!user?.userId || user.role !== "REPRESENTATIVE") return null;
  const account = db.users.get(user.userId);
  if (!account || !account.isActive || account.role !== "REPRESENTATIVE") return null;
  return normalizeRegionId(account.regionId);
}

function hasStoredRegion(entity: RegionalEntity): boolean {
  const raw = entity.regionId ?? entity.region;
  return raw !== undefined && raw !== null && String(raw).trim() !== "";
}

function storedRegionId(entity: RegionalEntity): string | null {
  if (!hasStoredRegion(entity)) return null;
  return normalizeRegionId(String(entity.regionId ?? entity.region));
}

function inferredResourceRegionIds(resource: RegionalResource, entity: RegionalEntity): Set<string> {
  const stored = storedRegionId(entity);
  if (hasStoredRegion(entity)) return stored ? new Set([stored]) : new Set();

  if (resource === "trips") {
    const inferred = new Set<string>();
    const origin = getCityRegionId(entity.originCity);
    const destination = getCityRegionId(entity.destinationCity);
    if (origin) inferred.add(origin);
    if (destination) inferred.add(destination);
    return inferred;
  }

  // Legacy customer/driver rows can be mapped by their registered city while
  // the region_id migration is rolled out. If neither region_id nor a known
  // home city exists, fail closed instead of inferring access from trips.
  const cityRegion = getCityRegionId(entity.city);
  return cityRegion ? new Set([cityRegion]) : new Set();
}

/** True only when a representative can access this region-owned entity. */
export function canAccessRegionalEntity(
  user: TokenPayload | undefined,
  resource: RegionalResource,
  entity: RegionalEntity
): boolean {
  if (user?.role !== "REPRESENTATIVE") return true;
  const assignedRegionId = getRepresentativeRegionId(user);
  if (!assignedRegionId) return false;
  return inferredResourceRegionIds(resource, entity).has(assignedRegionId);
}

/** Scope a collection without emitting a denial for every row hidden from a list. */
export function filterRegionalEntities<T extends RegionalEntity>(
  user: TokenPayload | undefined,
  resource: RegionalResource,
  entities: T[]
): T[] {
  if (user?.role !== "REPRESENTATIVE") return entities;
  return entities.filter((entity) => canAccessRegionalEntity(user, resource, entity));
}

function attemptedOperation(req: AuthenticatedRequest): string {
  if (req.method === "GET" || req.method === "HEAD") return "READ";
  if (req.method === "POST") return req.params?.id ? "UPDATE_OR_OPERATION" : "CREATE";
  if (req.method === "PUT" || req.method === "PATCH") return "UPDATE";
  if (req.method === "DELETE") return "DELETE";
  return req.method;
}

/** Log a blocked cross-region attempt and return a consistent 403 response. */
export function denyRegionalAccess(
  req: AuthenticatedRequest,
  res: Response,
  details: {
    resource: RegionalResource;
    entityId?: string;
    targetRegionId?: string | null;
    reason?: string;
  }
) {
  const assignedRegionId = getRepresentativeRegionId(req.user);
  const entityId = String(details.entityId || req.params?.id || "collection");
  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "REGION_ACCESS_DENIED",
    entity: details.resource,
    entityId,
    ipAddress: req.ip,
    oldValues: {
      assignedRegionId,
      targetRegionId: details.targetRegionId || undefined,
      method: req.method,
      path: req.originalUrl,
      operation: attemptedOperation(req),
    },
    reason: details.reason || "Representative attempted to access data outside the assigned region",
  });

  return res.status(403).json({
    error: "لا تملك صلاحية الوصول إلى بيانات خارج منطقتك المسندة",
    code: "REGION_ACCESS_DENIED",
  });
}

/** Reject representative access when their DB assignment is absent or invalid. */
function regionalResourceForRequest(req: AuthenticatedRequest): RegionalResource | null {
  const path = String(req.originalUrl || req.path || "").split("?")[0];
  if (/^\/api\/(?:client\/|driver\/)?trips(?:\/|$)/.test(path)) return "trips";
  if (/^\/api\/customers(?:\/|$)/.test(path)) return "customers";
  if (/^\/api\/drivers(?:\/|$)/.test(path)) return "drivers";
  return null;
}

function logRepresentativeAuthorizationDenial(req: AuthenticatedRequest, reason: string, context: Record<string, unknown> = {}) {
  if (req.user?.role !== "REPRESENTATIVE") return;
  const resource = regionalResourceForRequest(req);
  if (!resource) return;
  logAuditEvent({
    actorId: req.user.userId,
    actorName: req.user.fullName,
    actorRole: req.user.role,
    action: "AUTHORIZATION_DENIED",
    entity: resource,
    entityId: String(req.params?.id || "collection"),
    ipAddress: req.ip,
    oldValues: {
      assignedRegionId: getRepresentativeRegionId(req.user),
      method: req.method,
      path: req.originalUrl,
      ...context,
    },
    reason,
  });
}

export function requireRepresentativeRegionAssignment(resource: RegionalResource) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== "REPRESENTATIVE") return next();

    const assignedRegionId = getRepresentativeRegionId(req.user);
    if (!assignedRegionId) {
      return denyRegionalAccess(req, res, {
        resource,
        reason: "Representative account has no valid region assignment in the database",
      });
    }

    // Region selectors are untrusted input. A representative may only query or
    // submit the region assigned to their account; create handlers set it
    // server-side when no selector is supplied.
    const requestedRegions = [
      req.query?.regionId,
      req.query?.region,
      (req.body as any)?.regionId,
      (req.body as any)?.region,
    ].filter((value) => value !== undefined && value !== null && String(value).trim() !== "");
    const mismatchedRegion = requestedRegions.find((value) => normalizeRegionId(String(value)) !== assignedRegionId);
    if (mismatchedRegion !== undefined) {
      return denyRegionalAccess(req, res, {
        resource,
        targetRegionId: normalizeRegionId(String(mismatchedRegion)),
        reason: "Representative supplied a region selector that does not match the database assignment",
      });
    }

    const body = req.body as any;
    if (resource === "customers" || resource === "drivers") {
      const requestedCity = body?.city ?? body?.fields?.city;
      if (requestedCity !== undefined && String(requestedCity).trim()) {
        const cityRegionId = getCityRegionId(String(requestedCity));
        if (cityRegionId !== assignedRegionId) {
          return denyRegionalAccess(req, res, {
            resource,
            entityId: String(req.params?.id || "new"),
            targetRegionId: cityRegionId,
            reason: `Representative attempted a ${resource} operation with a city outside the assigned region`,
          });
        }
      }
    }
    if (resource === "trips" && body?.originCity && body?.destinationCity) {
      const originCity = String(body.originCity);
      const destinationCity = String(body.destinationCity);
      if (!isTripInRegionId({ originCity, destinationCity }, assignedRegionId)) {
        return denyRegionalAccess(req, res, {
          resource,
          entityId: String(req.params?.id || "new"),
          targetRegionId: getCityRegionId(originCity) || getCityRegionId(destinationCity),
          reason: "Representative attempted a trip operation whose route is outside the assigned region",
        });
      }
    }

    req.user.regionId = assignedRegionId;
    req.user.region = regionLabelForId(assignedRegionId) || undefined;
    return next();
  };
}

function syncLiveUserMetadata(payload: TokenPayload, userRecord: NonNullable<ReturnType<typeof db.users.get>>) {
  payload.role = userRecord.role;
  payload.fullName = userRecord.fullName || payload.fullName;

  const databaseRegionId = normalizeRegionId(
    userRecord.role === "REPRESENTATIVE" ? userRecord.regionId : userRecord.regionId ?? userRecord.region
  );
  payload.regionId = databaseRegionId || undefined;
  payload.region =
    userRecord.role === "REPRESENTATIVE"
      ? databaseRegionId
        ? regionLabelForId(databaseRegionId) || undefined
        : undefined
      : userRecord.region || (databaseRegionId ? regionLabelForId(databaseRegionId) || undefined : undefined);
}

function extractToken(req: AuthenticatedRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const t = authHeader.split(" ")[1];
    if (t) return t;
  }
  const custom = req.headers["x-ejaz-token"];
  if (typeof custom === "string" && custom) return custom;
  const q = req.query?.token;
  if (typeof q === "string" && q) return q;
  return null;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired session token", code: "TOKEN_EXPIRED" });
  }

  // Authoritative database check: block deactivated accounts immediately
  const userRecord = db.users.get(payload.userId);
  if (userRecord && !userRecord.isActive) {
    return res.status(403).json({ error: "Account is disabled. Contact system administrator.", code: "ACCOUNT_DISABLED" });
  }

  // Keep role and region claims synced from the database on every request.
  // For representatives, a missing DB assignment deliberately clears the JWT
  // claim rather than falling back to potentially stale token data.
  if (userRecord) syncLiveUserMetadata(payload, userRecord);

  req.user = payload;
  next();
}

export function optionalAuthenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const userRecord = db.users.get(payload.userId);
      if (userRecord && !userRecord.isActive) {
        return next();
      }
      if (userRecord) syncLiveUserMetadata(payload, userRecord);
      req.user = payload;
    }
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
    }

    if (!accountIsApproved(req.user)) {
      return res.status(403).json({
        error: "Account access is pending registration approval",
        code: "ACCOUNT_PENDING_APPROVAL",
      });
    }

    if (req.user.role === "SUPER_ADMIN" || roles.includes(req.user.role)) {
      return next();
    }

    logRepresentativeAuthorizationDenial(req, "Representative is missing the required role", { requiredRoles: roles });
    return res.status(403).json({
      error: `Access denied. Required role: ${roles.join(", ")}`,
      code: "FORBIDDEN",
    });
  };
}

/**
 * The single permission question, answered by the live registry.
 *
 * Evaluates:
 *  1. Role enabled status & global permission enabled status
 *  2. User-level DENY override (highest priority)
 *  3. User-level ALLOW override & active Temporary Permissions
 *  4. Role-level permission (INHERITED)
 */
export function hasPermission(
  role: string | undefined,
  permission: string,
  userPermissions?: string[],
  userId?: string
): boolean {
  if (!role) return false;
  void userPermissions;
  return registryHasPermission(role, permission, userId);
}

function accountIsApproved(user: TokenPayload): boolean {
  if (user.role !== "DRIVER" && user.role !== "CUSTOMER") return true;

  const registration = statusForUser({ userId: user.userId, email: user.email });
  if (registration) return registration.approved;
  if (user.registrationId) return user.registrationStatus === "APPROVED" || user.accountApproved === true;
  return user.accountApproved !== false;
}

function effectiveHasPermission(user: TokenPayload, permission: string): boolean {
  if (permission === "notifications.view") {
    return hasPermission(user.role, permission, user.permissions, user.userId);
  }
  return accountIsApproved(user) && hasPermission(user.role, permission, user.permissions, user.userId);
}

export function requirePermission(...permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
    }

    if (!accountIsApproved(req.user)) {
      const onlyNotifications =
        permissions.length === 1 && permissions[0] === "notifications.view";
      if (!onlyNotifications) {
        return res.status(403).json({
          error: "Account access is pending registration approval",
          code: "ACCOUNT_PENDING_APPROVAL",
        });
      }
    }

    const granted = permissions.some((permission) => effectiveHasPermission(req.user!, permission));
    if (granted) return next();

    logRepresentativeAuthorizationDenial(req, "Representative is missing the required permission", { requiredPermissions: permissions });
    return res.status(403).json({
      error: `Access denied. Missing permission: ${permissions.join(" | ")}`,
      code: "INSUFFICIENT_PERMISSIONS",
    });
  };
}

export function requireProviderKey(configuredKey: string, fallbackPermission = "gps.configure") {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const provided = req.headers["x-api-key"] || req.headers["x-provider-key"];
    const providedKey = Array.isArray(provided) ? provided[0] : provided;

    if (configuredKey) {
      if (providedKey && providedKey === configuredKey) {
        return next();
      }
      return res.status(401).json({
        error: "Invalid or missing GPS provider API key",
        code: "INVALID_PROVIDER_KEY",
      });
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const payload = verifyToken(authHeader.split(" ")[1]);
      if (payload && effectiveHasPermission(payload, fallbackPermission)) {
        req.user = payload;
        return next();
      }
    }

    return res.status(401).json({
      error: "GPS provider API key is not configured on the server. Telemetry access is disabled until credentials are provisioned.",
      code: "PROVIDER_NOT_CONFIGURED",
    });
  };
}

/**
 * Object-level & Data-Scope authorization (§8, §23):
 * Determines which trips/records a given identity is allowed to see or mutate.
 */
export function canAccessTrip(
  user: TokenPayload | undefined,
  trip: {
    customerId?: string;
    driverId?: string;
    additionalDriverId?: string;
    vehicleId?: string;
    status?: string;
    createdBy?: string;
    originCity?: string;
    destinationCity?: string;
    region?: string;
    regionId?: string;
  }
): boolean {
  if (!user || !accountIsApproved(user)) return false;
  if (user.role === "SUPER_ADMIN" || user.role === "GENERAL_MANAGER" || user.role === "OPERATIONS_MANAGER") return true;

  // Representatives are always restricted to the one current region on their
  // database account. Creator status, token claims, user overrides and wider
  // REGION grants must never widen this boundary.
  if (user.role === "REPRESENTATIVE") {
    const assignedRegionId = getRepresentativeRegionId(user);
    if (!assignedRegionId || !isTripInRegionId(trip, assignedRegionId)) return false;

    // A regional trip response also contains its linked customer/driver. Keep
    // those references inside the same boundary instead of leaking out-of-region
    // profiles through a trip payload.
    if (trip.customerId) {
      const customer = db.customers.get(trip.customerId);
      if (!customer || !canAccessRegionalEntity(user, "customers", customer)) return false;
    }
    for (const driverId of [trip.driverId, trip.additionalDriverId]) {
      if (!driverId || driverId === "unassigned") continue;
      const driver = db.drivers.get(driverId);
      if (!driver || !canAccessRegionalEntity(user, "drivers", driver)) return false;
    }
    return true;
  }

  // Check explicit user-level customer/vehicle scope restrictions if configured
  const uo = user.userId ? getUserOverride(user.userId) : undefined;
  if (uo?.allowedCustomerIds && uo.allowedCustomerIds.length > 0 && trip.customerId) {
    if (!uo.allowedCustomerIds.includes(trip.customerId)) return false;
  }
  if (uo?.allowedVehicleIds && uo.allowedVehicleIds.length > 0 && trip.vehicleId) {
    if (!uo.allowedVehicleIds.includes(trip.vehicleId)) return false;
  }

  if (user.role === "CUSTOMER") {
    return !!user.customerId && trip.customerId === user.customerId;
  }

  if (user.role === "DRIVER") {
    const driverId = user.driverId || user.userId;
    const ownsTrip = trip.driverId === driverId || trip.additionalDriverId === driverId;
    const isOpenRequest =
      !trip.driverId ||
      trip.driverId === "unassigned" ||
      trip.status === "DRAFT_CREATED" ||
      trip.status === "PENDING_APPROVAL" ||
      trip.status === "CONFIRMED";
    return ownsTrip || isOpenRequest;
  }

  const scope: DataScope = getEffectiveDataScope({ userId: user.userId, role: user.role });

  // Other REGION data scopes retain their configured region behavior.
  if (scope === "REGION") {
    // Creator can always view what they created
    if (trip.createdBy && trip.createdBy === user.userId) return true;

    if (uo?.allowedRegions && uo.allowedRegions.length > 0) {
      return uo.allowedRegions.some((r) => isTripInRegion(trip, r));
    }
    const userRecord = user.userId ? db.users.get(user.userId) : null;
    const repRegion = userRecord?.region || user.region;
    if (repRegion) {
      return isTripInRegion(trip, repRegion);
    }
    return !trip.createdBy || trip.createdBy === user.userId;
  }

  if (scope === "OWN") {
    if (user.customerId && trip.customerId === user.customerId) return true;
    if (trip.createdBy && trip.createdBy === user.userId) return true;
    if (user.role === "BROKER") return true;
    return !trip.createdBy || trip.createdBy === user.userId;
  }
  if (scope === "ASSIGNED") {
    const driverId = user.driverId || user.userId;
    if (trip.driverId === driverId || trip.additionalDriverId === driverId || trip.createdBy === user.userId) {
      return true;
    }
    if (user.role === "CUSTOMS_BROKER") return true;
    return false;
  }
  if (scope === "BRANCH" && uo?.allowedBranches && uo.allowedBranches.length > 0) {
    const cities = `${trip.originCity || ""} ${trip.destinationCity || ""}`;
    return uo.allowedBranches.some((b) => cities.includes(b));
  }

  return true;
}

export { canManagePermissions, effectivePermissionsFor, getEffectiveDataScope };
