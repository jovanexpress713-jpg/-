import { Router, type Request, type Response } from "express";
import { requireProviderKey } from "../auth/middleware";
import { config } from "../config";
import { gpsAdapter, type GPSPosition } from "../services/gpsProviderAdapter";
import { db } from "../db";

const router = Router();

// Telemetry read guard: provider API key, or an authenticated operator with gps.view
const guardRead = requireProviderKey(config.gpsProviderApiKey, "gps.view");
// Telemetry ingestion guard: provider API key, or an authorized operator with gps.configure
const guardIngest = requireProviderKey(config.gpsProviderApiKey, "gps.configure");

// GET /api/dev/gps - Status & Active Telemetry Feed
router.get("/", guardRead, (_req: Request, res: Response) => {
  return res.json({
    status: "ONLINE",
    mode: "DEVELOPMENT_AVL_SIMULATION_GATEWAY",
    provider: "EJAZ_DEVELOPMENT_AVL_GATEWAY",
    version: "2026.1-DEV",
    notice: "This is a development telemetry gateway conforming to the production AVL hardware API specification.",
    configuredEndpoint: config.gpsProviderEndpoint,
    telemetry: gpsAdapter.getStatus(),
    availableEndpoints: [
      { method: "GET", path: "/api/dev/gps", description: "Gateway status & telemetry overview" },
      { method: "GET", path: "/api/dev/gps/devices", description: "List of simulated telematics hardware devices" },
      { method: "GET", path: "/api/dev/gps/telemetry/:deviceId", description: "Get latest telemetry for specific device" },
      { method: "POST", path: "/api/dev/gps", description: "Ingest hardware telemetry push (AVL specification)" },
    ],
  });
});

// GET /api/dev/gps/devices - List devices
router.get("/devices", guardRead, async (_req: Request, res: Response) => {
  const devices = await gpsAdapter.getDevices();
  return res.json({ devices });
});

// GET /api/dev/gps/telemetry/:deviceId
router.get("/telemetry/:deviceId", guardRead, async (req: Request, res: Response) => {
  const deviceId = String(req.params.deviceId);
  const pos = await gpsAdapter.getLatestPosition(deviceId);
  if (!pos) {
    return res.status(404).json({ error: "Device not found in telemetry registry", deviceId });
  }
  return res.json({ telemetry: pos });
});

// POST /api/dev/gps - Telemetry Push (Standard AVL Packet)
router.post("/", guardIngest, (req: Request, res: Response) => {
  const { vehicleId, deviceId, tripId, latitude, longitude, speed, heading, altitude, accuracy, ignition } = req.body;

  if (!deviceId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      error: "Invalid AVL packet. deviceId, latitude, and longitude are required.",
    });
  }

  const packet: GPSPosition = {
    vehicleId: vehicleId || "DEV-V-AUTO",
    deviceId,
    tripId,
    latitude: Number(latitude),
    longitude: Number(longitude),
    speed: Number(speed ?? 0),
    heading: Number(heading ?? 0),
    altitude: altitude ? Number(altitude) : 550,
    accuracy: accuracy ? Number(accuracy) : 3.0,
    ignition: Boolean(ignition ?? true),
    provider: "EJAZ_DEV_AVL_ADAPTER",
    timestamp: new Date().toISOString(),
    status: "ONLINE",
  };

  gpsAdapter.recordTelemetry(packet);

  // Update trip current position if associated
  if (tripId) {
    const trip = db.trips.get(tripId);
    if (trip) {
      trip.currentLat = packet.latitude;
      trip.currentLng = packet.longitude;
      trip.currentSpeed = packet.speed;
      trip.currentHeading = packet.heading;
      trip.updatedAt = packet.timestamp;
    }
  }

  return res.status(201).json({
    message: "AVL Telemetry packet ingested successfully into development gateway",
    packet,
  });
});

export default router;
