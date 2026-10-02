import { Router, type Request, type Response } from "express";
import { config } from "../config";
import { gpsAdapter } from "../services/gpsProviderAdapter";

const router = Router();

// GET /api/health
router.get("/health", (_req: Request, res: Response) => {
  return res.json({
    status: "HEALTHY",
    service: "EJAZ Transport Enterprise Logistics Core",
    version: "1.0.0-PROD",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    database: config.databaseUrl ? "POSTGRESQL_CONNECTED" : "IN_MEMORY_TRANSACTIONAL_STORE",
    telemetry: gpsAdapter.getStatus(),
  });
});

export default router;
