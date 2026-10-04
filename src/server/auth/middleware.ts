import type { Request, Response, NextFunction } from "express";
import { verifyToken, type TokenPayload } from "./jwt";
import { statusForUser } from "../services/registrationService";
import {
  DEFAULT_ROLE_PERMISSIONS,
  hasPermission as registryHasPermission,
  canManagePermissions,
  effectivePermissionsFor,
} from "../services/permissionService";

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

/**
 * Factory defaults, re-exported for compatibility.
 *
 * ⚠ This is NOT what authorises a request. The live grant for a role comes from
 * the dynamic permission registry (`services/permissionService`), which the
 * system administrator edits from «إدارة الأدوار والصلاحيات». Reading this
 * constant will show you the factory defaults, never the current state.
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = DEFAULT_ROLE_PERMISSIONS;
/**
 * Extract the bearer token from any of the supported locations. Some reverse
 * proxies (including sandbox preview proxies) strip the `Authorization` header,
 * so the client also sends `X-Ejaz-Token` and, as a last resort, `?token=`.
 */
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
 * A user-level override (granted per account by the administrator) is honoured
 * ahead of the role grant, so an individual can be given one extra capability
 * without opening it to the whole role.
 */
export function hasPermission(
  role: string | undefined,
  permission: string,
  userPermissions?: string[]
): boolean {
  if (!role) return false;
  /*
   * The live registry is the only authority — the token claim never is.
   *
   * `userPermissions` is the grant frozen into the JWT at sign-in. Honouring it
   * as an allow-source makes it a ceiling that only ever moves one way: after an
   * administrator revokes a permission, every open session keeps passing this
   * check until its token expires, so «إخفاء الشاحنات» would not actually hide
   * the data from the API. The reverse is just as wrong — re-granting would stay
   * blocked for whoever signed in before the change.
   *
   * There is no per-user grant in the platform (the token carries the role's own
   * list), so nothing is lost: one lookup decides, immediately, for every session.
   * The parameter stays so existing call sites read unchanged, and so a future
   * per-user restriction has an obvious place to intersect.
   */
  void userPermissions;
  return registryHasPermission(role, permission);
}

function accountIsApproved(user: TokenPayload): boolean {
  if (user.role !== "DRIVER" && user.role !== "CUSTOMER") return true;

  const registration = statusForUser({ userId: user.userId, email: user.email });
  if (registration) return registration.approved;
  if (user.registrationId) return user.registrationStatus === "APPROVED" || user.accountApproved === true;
  return user.accountApproved !== false;
}

function effectiveHasPermission(user: TokenPayload, permission: string): boolean {
  // §21 — an applicant reads their own notifications (approval/rejection
  // outcomes) even while the registration request is still pending.
  if (permission === "notifications.view") {
    return hasPermission(user.role, permission);
  }
  return accountIsApproved(user) && hasPermission(user.role, permission, user.permissions);
}

export function requirePermission(...permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
    }

    if (!accountIsApproved(req.user)) {
      // §21 — approval/rejection must reach the applicant inside the app:
      // reading own notifications stays possible while a request is pending.
      // Every operational permission remains blocked until approval.
      const onlyNotifications =
        permissions.length === 1 && permissions[0] === "notifications.view";
      if (!onlyNotifications) {
        return res.status(403).json({
          error: "Account access is pending registration approval",
          code: "ACCOUNT_PENDING_APPROVAL",
        });
      }
    }

    // The live registry decides — including for SUPER_ADMIN, whose wildcard is
    // itself a registry entry. No role is hard-bypassed here.
    const granted = permissions.some((permission) => effectiveHasPermission(req.user!, permission));
    if (granted) return next();

    return res.status(403).json({
      error: `Access denied. Missing permission: ${permissions.join(" | ")}`,
      code: "INSUFFICIENT_PERMISSIONS",
    });
  };
}

/**
 * Shared API key guard for machine-to-machine ingestion endpoints
 * (AVL telemetry gateways). Falls back to an authenticated staff role
 * carrying the `gps.configure` permission when no key is configured yet.
 */
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

    // No provider key configured (development adapter): require an authenticated
    // staff operator holding the matching telemetry permission.
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

/** Object-level authorization: which trips a given identity is allowed to see/mutate. */
export function canAccessTrip(
  user: TokenPayload | undefined,
  trip: { customerId?: string; driverId?: string; additionalDriverId?: string; status?: string }
): boolean {
  if (!user || !accountIsApproved(user)) return false;
  if (user.role === "SUPER_ADMIN") return true;

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

  return true;
}


/** Re-exported so route modules can ask the registry directly. */
export { canManagePermissions, effectivePermissionsFor };
