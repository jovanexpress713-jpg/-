import { Router, type Response } from "express";
import { gpsAdapter, type GPSPosition } from "../services/gpsProviderAdapter";
import { authenticate, optionalAuthenticate, type AuthenticatedRequest } from "../auth/middleware";
import { db } from "../db";

const router = Router();

// GET /api/gps/status
router.get("/status", optionalAuthenticate, (_req: AuthenticatedRequest, res: Response) => {
  const status = gpsAdapter.getStatus();
  return res.json({
    ...status,
    message: status.configured
      ? "GPS Telemetry Provider active and connected"
      : "EXTERNAL CONFIGURATION REQUIRED: GPS Provider endpoint & API key not configured in environment.",
  });
});

// GET /api/gps/telemetry/:deviceId
router.get("/telemetry/:deviceId", optionalAuthenticate, async (req: AuthenticatedRequest, res: Response) => {
  const deviceId = String(req.params.deviceId);
  const pos = await gpsAdapter.getLatestPosition(deviceId);

  if (!pos) {
    return res.json({
      deviceId,
      status: "CONFIGURATION_REQUIRED",
      provider: "NONE_CONFIGURED",
      message: "No live telemetry feed available for this device. Awaiting external AVL provider configuration.",
      lastKnownPosition: null,
    });
  }

  return res.json({ telemetry: pos });
});

// POST /api/gps/telemetry - Ingest real telemetry from authorized AVL hardware gateway
router.post("/telemetry", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { vehicleId, deviceId, tripId, latitude, longitude, speed, heading, altitude, accuracy, ignition, provider } = req.body;

  if (!vehicleId || !deviceId || latitude === undefined || longitude === undefined || speed === undefined) {
    return res.status(400).json({ error: "Missing required GPS telemetry fields" });
  }

  const record: GPSPosition = {
    vehicleId,
    deviceId,
    tripId,
    latitude: Number(latitude),
    longitude: Number(longitude),
    speed: Number(speed),
    heading: Number(heading || 0),
    altitude: altitude ? Number(altitude) : undefined,
    accuracy: accuracy ? Number(accuracy) : undefined,
    ignition: Boolean(ignition ?? true),
    provider: provider || "EXTERNAL_GATEWAY",
    timestamp: new Date().toISOString(),
    status: "ONLINE",
  };

  gpsAdapter.recordTelemetry(record);

  // Update trip current position if associated
  if (tripId) {
    const trip = db.trips.get(tripId);
    if (trip) {
      trip.currentLat = record.latitude;
      trip.currentLng = record.longitude;
      trip.currentSpeed = record.speed;
      trip.currentHeading = record.heading;
      trip.updatedAt = record.timestamp;
    }
  }

  return res.status(201).json({ message: "Telemetry recorded", telemetry: record });
});

export default router;
