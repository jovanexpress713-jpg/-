import type { Request, Response, NextFunction } from "express";
import { verifyToken, type TokenPayload } from "./jwt";
import { statusForUser } from "../services/registrationService";

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  GENERAL_MANAGER: [
    "trips.view", "trips.approve", "trips.cancel", "trips.reopen", "trips.assign",
    "finance.view", "finance.approve", "finance.settle", "claims.view", "claims.manage",
    "customers.view", "customers.create", "customers.manage", "notifications.view", "pod.view",
    "vehicles.view", "drivers.view", "drivers.create", "reports.view", "reports.export", "audit.view", "settings.manage",
    "registrations.view", "registrations.review"
  ],
  OPERATIONS_MANAGER: [
    "trips.view", "trips.create", "trips.assign", "trips.transition", "trips.cancel", "trips.approve",
    "claims.view", "claims.manage", "customers.view", "customers.create", "customers.manage", "notifications.view", "pod.view",
    "vehicles.view", "vehicles.create", "vehicles.edit", "vehicles.assign",
    "drivers.view", "drivers.create", "drivers.edit",
    "gps.view", "gps.configure", "documents.view", "documents.upload",
    "reports.view", "audit.view", "registrations.view", "registrations.review"
  ],
  DISPATCHER: [
    "trips.view", "trips.create", "trips.assign", "trips.transition",
    "vehicles.view", "vehicles.assign", "drivers.view", "gps.view",
    "documents.view", "documents.upload", "customers.view", "notifications.view", "pod.view"
  ],
  ACCOUNTANT: [
    "finance.view", "finance.create", "finance.approve", "finance.settle",
    "trips.view", "claims.view", "customers.view", "notifications.view", "pod.view",
    "invoices.create", "payments.record", "reports.view", "reports.export"
  ],
  DRIVER: [
    "trips.view", "trips.transition", "trips.request", "pod.create", "pod.view",
    "documents.upload", "documents.view", "gps.view", "notifications.view"
  ],
  CUSTOMER: [
    "trips.view", "trips.create", "documents.view", "claims.create", "claims.view",
    "invoices.view", "notifications.view", "pod.view"
  ],
  WAREHOUSE: [
    "trips.view", "loading.record", "documents.view", "documents.upload", "notifications.view", "pod.view"
  ],
  BROKER: [
    "trips.view", "trips.create", "documents.view", "customers.view", "customers.create", "notifications.view"
  ],
  CUSTOMS_BROKER: [
    "trips.view", "documents.upload", "documents.view", "notifications.view"
  ],
  REPRESENTATIVE: [
    "trips.view", "documents.view", "notifications.view"
  ],
};

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

export function hasPermission(role: string | undefined, permission: string): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN") return true;
  const userPerms = ROLE_PERMISSIONS[role] || [];
  return userPerms.includes("*") || userPerms.includes(permission);
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
  return accountIsApproved(user) && hasPermission(user.role, permission);
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

    if (req.user.role === "SUPER_ADMIN") {
      return next();
    }

    // Role permissions stay authoritative, but are evaluated only after the
    // live registration state confirms that an applicant account is approved.
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
