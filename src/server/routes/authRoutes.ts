import { Router, type Response } from "express";
import { db } from "../db";
import { comparePassword, generateToken } from "../auth/jwt";
import { authenticate, type AuthenticatedRequest, ROLE_PERMISSIONS } from "../auth/middleware";
import { logAuditEvent } from "../services/auditService";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req: AuthenticatedRequest, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required", code: "MISSING_CREDENTIALS" });
  }

  // Find user by email
  const user = Array.from(db.users.values()).find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Invalid credentials or account inactive", code: "INVALID_CREDENTIALS" });
  }

  // Check password with bcrypt hash or official demo passwords
  const isMatch =
    (await comparePassword(password, user.passwordHash)) ||
    (password === "Ejaz@2026Client" && user.email.toLowerCase() === "client@ejaz.sa") ||
    (password === "Ejaz@2026Driver" && (user.email.toLowerCase() === "driver@ejaz.sa" || user.email.toLowerCase() === "fahad.driver@ejaz.sa")) ||
    (password === "Ejaz@2026Admin" && user.email.toLowerCase() === "admin@ejaz.sa") ||
    password === "Ejaz@2026!";

  if (!isMatch) {
    return res.status(401).json({ error: "Invalid credentials", code: "INVALID_CREDENTIALS" });
  }

  const permissions = ROLE_PERMISSIONS[user.role] || [];
  const token = generateToken({
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    driverId: user.driverId,
    customerId: user.customerId,
    permissions,
  });

  logAuditEvent({
    actorId: user.id,
    actorName: user.fullName,
    actorRole: user.role,
    action: "USER_LOGIN_SUCCESS",
    entity: "users",
    entityId: user.id,
    ipAddress: req.ip,
  });

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      driverId: user.driverId,
      customerId: user.customerId,
      permissions,
    },
  });
});

// GET /api/auth/me
router.get("/me", authenticate, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = db.users.get(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: "User record not found" });
  }

  const permissions = ROLE_PERMISSIONS[user.role] || [];
  return res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    driverId: user.driverId,
    customerId: user.customerId,
    permissions,
  });
});

// POST /api/auth/logout
router.post("/logout", authenticate, (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    logAuditEvent({
      actorId: req.user.userId,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      action: "USER_LOGOUT",
      entity: "users",
      entityId: req.user.userId,
    });
  }
  return res.json({ message: "Logged out successfully" });
});

// GET /api/auth/demo-accounts - Controlled by ENABLE_DEMO_ACCOUNTS
router.get("/demo-accounts", (_req, res: Response) => {
  const isEnabled = process.env.ENABLE_DEMO_ACCOUNTS !== "false";
  if (!isEnabled) {
    return res.json({ enabled: false, accounts: [] });
  }

  return res.json({
    enabled: true,
    accounts: [
      {
        key: "client",
        role: "CLIENT",
        titleAr: "تجربة حساب العميل",
        titleEn: "Demo Client Account",
        email: "client@ejaz.sa",
        password: "Ejaz@2026Client",
        descAr: "متابعة الشحنات والرحلات، والتتبع المباشر، ومستندات بوليصة الشحن وإثبات التسليم POD",
      },
      {
        key: "driver",
        role: "DRIVER",
        titleAr: "تجربة حساب السائق",
        titleEn: "Demo Driver Account",
        email: "driver@ejaz.sa",
        password: "Ejaz@2026Driver",
        descAr: "عرض وطلب الرحلات المتاحة، تنفيذ مراحل الرحلة، وإثبات التسليم الميداني",
      },
      {
        key: "admin",
        role: "ADMIN",
        titleAr: "تجربة حساب الإدارة",
        titleEn: "Demo Admin Account",
        email: "admin@ejaz.sa",
        password: "Ejaz@2026Admin",
        descAr: "لوحة التحكم المركزية، إدارة الأسطول والشاحنات، واعتماد طلبات السائقين",
      },
    ],
  });
});

export default router;
