import type { Request, Response, NextFunction } from "express";
import { verifyToken, type TokenPayload } from "./jwt";

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  GENERAL_MANAGER: [
    "trips.view", "trips.approve", "trips.cancel", "trips.reopen",
    "finance.view", "finance.approve", "finance.settle",
    "vehicles.view", "drivers.view", "reports.view", "reports.export", "audit.view", "settings.manage"
  ],
  OPERATIONS_MANAGER: [
    "trips.view", "trips.create", "trips.assign", "trips.transition", "trips.cancel",
    "vehicles.view", "vehicles.create", "vehicles.edit", "vehicles.assign",
    "drivers.view", "drivers.create", "drivers.edit",
    "gps.view", "gps.configure", "documents.view", "documents.upload",
    "reports.view", "audit.view"
  ],
  DISPATCHER: [
    "trips.view", "trips.create", "trips.assign", "trips.transition",
    "vehicles.view", "vehicles.assign", "drivers.view", "gps.view",
    "documents.view", "documents.upload"
  ],
  ACCOUNTANT: [
    "finance.view", "finance.create", "finance.approve", "finance.settle",
    "trips.view", "invoices.create", "payments.record", "reports.view", "reports.export"
  ],
  DRIVER: [
    "trips.view", "trips.transition", "pod.create", "documents.upload", "documents.view", "gps.view"
  ],
  CUSTOMER: [
    "trips.view", "trips.create", "documents.view", "claims.create", "invoices.view"
  ],
  WAREHOUSE: [
    "trips.view", "loading.record", "documents.view", "documents.upload"
  ],
  BROKER: [
    "trips.view", "trips.create", "documents.view"
  ],
  CUSTOMS_BROKER: [
    "trips.view", "documents.upload", "documents.view"
  ],
  REPRESENTATIVE: [
    "trips.view", "documents.view"
  ],
};

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired session token", code: "TOKEN_EXPIRED" });
  }

  req.user = payload;
  next();
}

export function optionalAuthenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
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

    if (req.user.role === "SUPER_ADMIN" || roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      error: `Access denied. Required role: ${roles.join(", ")}`,
      code: "FORBIDDEN",
    });
  };
}

export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
    }

    if (req.user.role === "SUPER_ADMIN") {
      return next();
    }

    const userPerms = ROLE_PERMISSIONS[req.user.role] || [];
    if (userPerms.includes("*") || userPerms.includes(permission)) {
      return next();
    }

    return res.status(403).json({
      error: `Access denied. Missing permission: ${permission}`,
      code: "INSUFFICIENT_PERMISSIONS",
    });
  };
}
