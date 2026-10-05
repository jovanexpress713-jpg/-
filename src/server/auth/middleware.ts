import type { Request, Response, NextFunction } from "express";
import { verifyToken, type TokenPayload } from "./jwt";
import { statusForUser } from "../services/registrationService";
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

  req.user = payload;
  next();
}

export function optionalAuthenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
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
  }
): boolean {
  if (!user || !accountIsApproved(user)) return false;
  if (user.role === "SUPER_ADMIN") return true;

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
  if (scope === "OWN") {
    if (user.customerId && trip.customerId === user.customerId) return true;
    if (trip.createdBy && trip.createdBy === user.userId) return true;
    // Broker / staff who haven't created any specific trip yet see trips if no createdBy restriction
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
  if (scope === "REGION" && uo?.allowedRegions && uo.allowedRegions.length > 0) {
    const cities = `${trip.originCity || ""} ${trip.destinationCity || ""}`;
    return uo.allowedRegions.some((r) => cities.includes(r));
  }

  return true;
}

export { canManagePermissions, effectivePermissionsFor, getEffectiveDataScope };
