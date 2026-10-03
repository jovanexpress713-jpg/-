import { Router, type Response } from "express";
import fs from "fs";
import path from "path";
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

/**
 * The central identity is persisted to `data/branding.json` so a published logo
 * and identity survive server restarts and redeploys (the uploaded logo file
 * itself lives under `public/uploads/branding/`).
 */
const BRANDING_CONFIG_PATH = path.resolve(process.cwd(), "data/branding.json");

function loadBranding(): void {
  try {
    if (fs.existsSync(BRANDING_CONFIG_PATH)) {
      const saved = JSON.parse(fs.readFileSync(BRANDING_CONFIG_PATH, "utf8")) as Partial<BrandingConfig>;
      activeBranding = { ...activeBranding, ...saved };
    }
  } catch (err) {
    console.warn("[Branding] could not load saved branding config:", err);
  }
}

function persistBranding(): void {
  try {
    fs.mkdirSync(path.dirname(BRANDING_CONFIG_PATH), { recursive: true });
    fs.writeFileSync(BRANDING_CONFIG_PATH, JSON.stringify(activeBranding, null, 2), "utf8");
  } catch (err) {
    console.warn("[Branding] could not persist branding config:", err);
  }
}

loadBranding();

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
  persistBranding();

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

const BRANDING_ROLES = ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER", "SYSTEM_ADMIN"];
const MAX_LOGO_BYTES = 4 * 1024 * 1024;
const ALLOWED_LOGO_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};
const LOGO_FIELD_BY_VARIANT: Record<string, keyof BrandingConfig> = {
  master: "logoUrl",
  header: "headerLogoUrl",
  login: "loginLogoUrl",
  report: "reportLogoUrl",
};

function brandingUploadDir(): string {
  return path.resolve(process.cwd(), "public/uploads/branding");
}

/**
 * PUT /api/branding/logo — upload a logo image file from the device (base64) and
 * publish it for a surface. Stored byte-for-byte under `public/uploads/branding/`,
 * so the original upload is preserved and served statically.
 */
router.put("/logo", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userRole = req.user?.role || "";
  if (!BRANDING_ROLES.includes(userRole)) {
    return res.status(403).json({ error: "Access denied. Only authorized administrators can change the logo." });
  }

  const { data, fileName, variant = "master" } = req.body || {};
  const field = LOGO_FIELD_BY_VARIANT[String(variant)];
  if (!field) return res.status(400).json({ error: `Unknown logo variant '${variant}'` });
  if (!data) return res.status(400).json({ error: "data (base64 image) is required" });

  const cleaned = String(data).includes(",") ? String(data).slice(String(data).indexOf(",") + 1) : String(data);
  const buffer = Buffer.from(cleaned, "base64");
  if (!buffer.length) return res.status(400).json({ error: "Empty image payload" });
  if (buffer.length > MAX_LOGO_BYTES) {
    return res.status(413).json({ error: `Logo exceeds the ${Math.round(MAX_LOGO_BYTES / 1024 / 1024)}MB limit` });
  }

  const ext = (path.extname(fileName || "") || ".png").toLowerCase();
  if (!ALLOWED_LOGO_EXT[ext]) {
    return res.status(415).json({ error: `Unsupported logo format '${ext}'. Allowed: ${Object.keys(ALLOWED_LOGO_EXT).join(", ")}` });
  }

  const dir = brandingUploadDir();
  fs.mkdirSync(dir, { recursive: true });

  const url = `/uploads/branding/${String(variant)}${ext}`;
  const filePath = path.join(dir, `${String(variant)}${ext}`);

  // Remove any previously stored file for this variant (any extension).
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith(`${String(variant)}.`)) fs.unlinkSync(path.join(dir, file));
  }
  fs.writeFileSync(filePath, buffer);

  const prev = { ...activeBranding };
  (activeBranding as any)[field] = url;
  activeBranding = { ...activeBranding, updatedAt: new Date().toISOString(), updatedBy: req.user?.fullName || "Administrator" };
  persistBranding();

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "BRANDING_LOGO_UPLOADED",
    entity: "system_branding",
    entityId: String(variant),
    oldValues: { [field]: prev[field] },
    newValues: { [field]: url, fileName },
  });

  return res.json({ message: "Logo uploaded and published", url, branding: activeBranding });
});

export default router;
