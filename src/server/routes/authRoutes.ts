import { Router, type Response } from "express";
import { db } from "../db";
import { comparePassword, generateToken } from "../auth/jwt";
import { statusForUser, REGISTRATION_STATUS_AR } from "../services/registrationService";
import { authenticate, type AuthenticatedRequest } from "../auth/middleware";
import {
  getRolePermissions,
  getEffectivePermissionList,
  getEffectiveDataScope,
  isRoleEnabled,
} from "../services/permissionService";
import { logAuditEvent } from "../services/auditService";
import { config } from "../config";

const router = Router();

// POST /api/auth/login
/**
 * An account created through a registration request only receives the privileges
 * of its account type after the administration approves it. Until then the user
 * can still sign in to follow the request status — nothing more.
 */
function resolveAccountAccess(user: {
  id: string;
  email: string;
  role: string;
  registrationId?: string;
  registrationStatus?: string;
}) {
  const isApplicantRole = user.role === "DRIVER" || user.role === "CUSTOMER";
  const registration = isApplicantRole ? statusForUser({ userId: user.id, email: user.email }) : null;
  const approved = !isApplicantRole
    ? true
    : registration
      ? registration.approved
      : !user.registrationId || user.registrationStatus === "APPROVED";
  const base =
    user.role === "SUPER_ADMIN"
      ? getRolePermissions("SUPER_ADMIN")
      : getEffectivePermissionList(user.role, user.id);
  const dataScope = getEffectiveDataScope({ userId: user.id, role: user.role });
  return {
    registration,
    approved,
    dataScope,
    roleEnabled: isRoleEnabled(user.role),
    permissions: approved ? base : ["registration.status_own"],
  };
}

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

  // Authoritative check: bcrypt hash comparison against the stored credential.
  let isMatch = await comparePassword(password, user.passwordHash);

  // Optional, explicitly opted-in demo credentials (ENABLE_DEMO_ACCOUNTS=true).
  // These are bound to the exact demo accounts and never act as a master key.
  if (!isMatch && config.enableDemoAccounts) {
    const demoCredentials: Record<string, string> = {
      "client@ejaz.sa": "Ejaz@2026Client",
      "driver@ejaz.sa": "Ejaz@2026Driver",
      "fahad.driver@ejaz.sa": "Ejaz@2026Driver",
      "admin@ejaz.sa": "Ejaz@2026Admin",
    };
    const expected = demoCredentials[user.email.toLowerCase()];
    if (expected && password === expected && !user.passwordHash) {
      isMatch = true;
    }
  }

  if (!isMatch) {
    return res.status(401).json({ error: "Invalid credentials", code: "INVALID_CREDENTIALS" });
  }

  const access = resolveAccountAccess(user);
  const permissions = access.permissions;
  const token = generateToken({
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    driverId: user.driverId,
    customerId: user.customerId,
    regionId: user.regionId,
    region: user.region,
    permissions,
    registrationId: access.registration?.request.id ?? user.registrationId,
    registrationStatus: access.registration?.status ?? user.registrationStatus,
    accountApproved: access.approved,
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
      regionId: user.regionId,
      region: user.region,
      driverId: user.driverId,
      customerId: user.customerId,
      permissions,
      // Registration/approval state: the app shows «جاري معالجة طلبك» while the
      // request is under review instead of the full account functions.
      registrationId: access.registration?.request.id ?? user.registrationId,
      registrationStatus: access.registration?.status ?? user.registrationStatus,
      registrationStatusAr: access.registration ? REGISTRATION_STATUS_AR[access.registration.status] : undefined,
      accountApproved: access.approved,
    },
  });
});

// GET /api/auth/me
router.get("/me", authenticate, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = db.users.get(req.user.userId);
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "User record not found or account inactive", code: "ACCOUNT_INACTIVE" });
  }

  const access = resolveAccountAccess(user);
  return res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    regionId: user.regionId,
    region: user.region,
    driverId: user.driverId,
    customerId: user.customerId,
    permissions: access.permissions,
    registrationId: access.registration?.request.id ?? user.registrationId,
    registrationStatus: access.registration?.status ?? user.registrationStatus,
    registrationStatusAr: access.registration ? REGISTRATION_STATUS_AR[access.registration.status] : undefined,
    accountApproved: access.approved,
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
  const isEnabled = config.enableDemoAccounts;
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
      {
        key: "ops",
        role: "OPERATIONS_MANAGER",
        titleAr: "تجربة حساب مدير العمليات",
        titleEn: "Demo Operations Manager",
        email: "ops@ejaz.sa",
        password: "Ejaz@2026Admin",
        descAr: "إدارة الرحلات والسائقين والأسطول وطلبات النقل",
      },
      {
        key: "accountant",
        role: "ACCOUNTANT",
        titleAr: "تجربة حساب المحاسب المالي",
        titleEn: "Demo Accountant",
        email: "finance@ejaz.sa",
        password: "Ejaz@2026Admin",
        descAr: "مراجعة القيود والفواتير والتسويات المالية",
      },
      {
        key: "rep-central",
        role: "REPRESENTATIVE",
        titleAr: "ممثّل المنطقة الوسطى",
        titleEn: "Central Region Representative",
        email: "rep.central@ejaz.sa",
        password: "Ejaz@2026Admin",
        descAr: "حساب تجريبي بصلاحيات النطاق الإقليمي للمنطقة الوسطى",
      },
      {
        key: "rep-west",
        role: "REPRESENTATIVE",
        titleAr: "ممثّل المنطقة الغربية",
        titleEn: "Western Region Representative",
        email: "rep.west@ejaz.sa",
        password: "Ejaz@2026Admin",
        descAr: "حساب تجريبي بصلاحيات النطاق الإقليمي للمنطقة الغربية",
      },
      {
        key: "rep-east",
        role: "REPRESENTATIVE",
        titleAr: "ممثّل المنطقة الشرقية",
        titleEn: "Eastern Region Representative",
        email: "rep.east@ejaz.sa",
        password: "Ejaz@2026Admin",
        descAr: "حساب تجريبي بصلاحيات النطاق الإقليمي للمنطقة الشرقية",
      },
      {
        key: "rep-south",
        role: "REPRESENTATIVE",
        titleAr: "ممثّل المنطقة الجنوبية",
        titleEn: "Southern Region Representative",
        email: "rep.south@ejaz.sa",
        password: "Ejaz@2026Admin",
        descAr: "حساب تجريبي بصلاحيات النطاق الإقليمي للمنطقة الجنوبية",
      },
      {
        key: "rep-north",
        role: "REPRESENTATIVE",
        titleAr: "ممثّل المنطقة الشمالية",
        titleEn: "Northern Region Representative",
        email: "rep.north@ejaz.sa",
        password: "Ejaz@2026Admin",
        descAr: "حساب تجريبي بصلاحيات النطاق الإقليمي للمنطقة الشمالية",
      },
    ],
  });
});

export default router;
