import { Router, type Request, type Response } from "express";
import { config } from "../config";
import { db } from "../db";
import { gpsAdapter } from "../services/gpsProviderAdapter";

const router = Router();

function getMapsStatus() {
  return {
    mode: "BUILT_IN_CANVAS_WITH_EMBED_PREVIEW",
    providerIntegration: "NOT_CONFIGURED",
    googleMapsApiKeyConfigured: Boolean(config.googleMapsApiKey),
    googleMapsApiKeyUsed: false,
    notice:
      "The interactive map is rendered by the application canvas. The Google layer is an external iframe preview; no Google Maps API integration or key validation is performed.",
  };
}

// GET /api/health — availability and persistence are reported separately.
router.get("/health", (_req: Request, res: Response) => {
  const database = db.getStatus();
  const telemetry = gpsAdapter.getStatus();
  const apiAvailable = Boolean(database.ready);
  const persistenceReady = Boolean(database.durable);
  const status = !apiAvailable ? "UNAVAILABLE" : persistenceReady ? "HEALTHY" : "DEGRADED";

  return res.status(apiAvailable ? 200 : 503).json({
    status,
    api: { available: apiAvailable },
    service: "EJAZ Transport Logistics API",
    version: process.env.npm_package_version || "development",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    database,
    telemetry,
    maps: getMapsStatus(),
    demoAccounts: { enabled: config.enableDemoAccounts },
  });
});

// GET /api/system/maps-config
router.get("/maps-config", (_req: Request, res: Response) => {
  const maps = getMapsStatus();
  return res.json({
    ...maps,
    configured: maps.providerIntegration !== "NOT_CONFIGURED",
    isDevelopment: config.nodeEnv !== "production",
    provider: "Built-in canvas renderer and Google Maps iframe preview",
  });
});

export default router;
