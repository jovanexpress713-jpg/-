import { Router, type Response } from "express";
import { authenticate, type AuthenticatedRequest } from "../auth/middleware";
import { logAuditEvent } from "../services/auditService";
import { dispatchNotification } from "../services/notificationService";

const router = Router();

export interface BrandingConfig {
  officialNameAr: string;
  officialNameEn: string;
  officialNameUr: string;
  taglineAr: string;
  taglineEn: string;
  taglineUr: string;
  logoUrl: string | null;
  primaryColor: string;
  navyColor: string;
  headerLogoUrl: string | null;
  loginLogoUrl: string | null;
  reportLogoUrl: string | null;
  welcomeScreenTitleAr: string;
  welcomeScreenTitleEn: string;
  welcomeScreenTitleUr: string;
  updatedAt: string;
  updatedBy: string;
}

let activeBranding: BrandingConfig = {
  officialNameAr: "مؤسسة إيجاز للنقليات",
  officialNameEn: "EJAZ Transport",
  officialNameUr: "اعجاز ٹرانسپورٹ",
  taglineAr: "إدارة أسطول النقل الثقيل والرحلات",
  taglineEn: "Heavy Fleet & Logistics Control",
  taglineUr: "ہیوی فلیٹ اور لاجسٹکس کنٹرول",
  logoUrl: null, // null defaults to vector EJAZ Emblem
  primaryColor: "#FF7A00",
  navyColor: "#0A1931",
  headerLogoUrl: null,
  loginLogoUrl: null,
  reportLogoUrl: null,
  welcomeScreenTitleAr: "مؤسسة إيجاز للنقليات",
  welcomeScreenTitleEn: "Establishment Ejaz Transport",
  welcomeScreenTitleUr: "اعجاز ٹرانسپورٹ",
  updatedAt: new Date().toISOString(),
  updatedBy: "System Default",
};

// GET /api/branding - Public / Authenticated fetch of central branding
router.get("/", (_req, res: Response) => {
  return res.json({ branding: activeBranding });
});

// PUT /api/branding - Authorized Admin update of central branding
router.put("/", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const allowedRoles = ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER", "SYSTEM_ADMIN"];
  const userRole = req.user?.role || "";
  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ error: "Access denied. Only authorized administrators can update branding configuration." });
  }

  const {
    officialNameAr,
    officialNameEn,
    officialNameUr,
    taglineAr,
    taglineEn,
    taglineUr,
    logoUrl,
    primaryColor,
    navyColor,
    headerLogoUrl,
    loginLogoUrl,
    reportLogoUrl,
    welcomeScreenTitleAr,
    welcomeScreenTitleEn,
    welcomeScreenTitleUr,
  } = req.body;

  const prev = { ...activeBranding };

  activeBranding = {
    ...activeBranding,
    officialNameAr: officialNameAr ?? activeBranding.officialNameAr,
    officialNameEn: officialNameEn ?? activeBranding.officialNameEn,
    officialNameUr: officialNameUr ?? activeBranding.officialNameUr,
    taglineAr: taglineAr ?? activeBranding.taglineAr,
    taglineEn: taglineEn ?? activeBranding.taglineEn,
    taglineUr: taglineUr ?? activeBranding.taglineUr,
    logoUrl: logoUrl !== undefined ? logoUrl : activeBranding.logoUrl,
    primaryColor: primaryColor ?? activeBranding.primaryColor,
    navyColor: navyColor ?? activeBranding.navyColor,
    headerLogoUrl: headerLogoUrl !== undefined ? headerLogoUrl : activeBranding.headerLogoUrl,
    loginLogoUrl: loginLogoUrl !== undefined ? loginLogoUrl : activeBranding.loginLogoUrl,
    reportLogoUrl: reportLogoUrl !== undefined ? reportLogoUrl : activeBranding.reportLogoUrl,
    welcomeScreenTitleAr: welcomeScreenTitleAr ?? activeBranding.welcomeScreenTitleAr,
    welcomeScreenTitleEn: welcomeScreenTitleEn ?? activeBranding.welcomeScreenTitleEn,
    welcomeScreenTitleUr: welcomeScreenTitleUr ?? activeBranding.welcomeScreenTitleUr,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.fullName || "Administrator",
  };

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "BRANDING_UPDATED",
    entity: "system_branding",
    entityId: "central_branding",
    oldValues: prev,
    newValues: activeBranding,
  });

  dispatchNotification({
    targetRole: "ALL",
    titleAr: "تحديث الهوية البصرية الرسمية",
    titleEn: "Central Branding Updated",
    messageAr: `تم تحديث شعار وهوية إيجاز المركزية بواسطة ${req.user?.fullName}`,
    messageEn: `Official branding updated by ${req.user?.fullName}`,
    type: "INFO",
    entityType: "branding",
    entityId: "central_branding",
  });

  return res.json({
    message: "Central branding updated successfully and propagated",
    branding: activeBranding,
  });
});

export default router;
