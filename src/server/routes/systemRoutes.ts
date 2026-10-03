import { Router, type Request, type Response } from "express";
import { config } from "../config";
import { db } from "../db";
import { gpsAdapter } from "../services/gpsProviderAdapter";

const router = Router();

// GET /api/health
router.get("/health", (_req: Request, res: Response) => {
  const dbStatus = db.getStatus();
  const gpsStatus = gpsAdapter.getStatus();
  const isMapsDev = Boolean(
    config.googleMapsApiKey &&
      (config.googleMapsApiKey.includes("DEV") || config.googleMapsApiKey.includes("TEMP"))
  );

  return res.json({
    status: "HEALTHY",
    service: "EJAZ Transport Enterprise Logistics Core",
    version: "1.0.0-PROD",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    database: dbStatus,
    telemetry: gpsStatus,
    maps: {
      configured: Boolean(config.googleMapsApiKey),
      mode: isMapsDev ? "DEVELOPMENT_ADAPTER" : "PRODUCTION",
      isDevelopment: isMapsDev,
      notice: isMapsDev
        ? "Maps Development Adapter active with live GPS overlay. Replace GOOGLE_MAPS_API_KEY with production key for official Google Maps API billing."
        : "Production Google Maps integration active.",
    },
  });
});

// GET /api/system/maps-config
router.get("/maps-config", (_req: Request, res: Response) => {
  const isMapsDev = Boolean(
    !config.googleMapsApiKey ||
      config.googleMapsApiKey.includes("DEV") ||
      config.googleMapsApiKey.includes("TEMP")
  );

  return res.json({
    configured: Boolean(config.googleMapsApiKey),
    isDevelopment: isMapsDev,
    mode: isMapsDev ? "DEVELOPMENT_ADAPTER" : "PRODUCTION",
    provider: "Google Maps Platform",
    hasApiKey: Boolean(config.googleMapsApiKey),
  });
});

export default router;
