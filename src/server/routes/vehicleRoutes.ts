import { Router, type Response } from "express";
import { db, type VehicleEntity } from "../db";
import { authenticate, optionalAuthenticate, type AuthenticatedRequest } from "../auth/middleware";

const router = Router();

const OFFICIAL_TYPES = ["براد", "سطحة", "جاف", "ستارة"];

function checkDocExpiry(dateStr: string): { isExpired: boolean; daysRemaining: number } {
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  const diffDays = Math.ceil((target - now) / (1000 * 3600 * 24));
  return {
    isExpired: diffDays < 0,
    daysRemaining: diffDays,
  };
}

// GET /api/vehicles
router.get("/", optionalAuthenticate, (req: AuthenticatedRequest, res: Response) => {
  const { type, status } = req.query;
  let list = Array.from(db.vehicles.values());

  if (type && typeof type === "string") {
    list = list.filter((v) => v.type === type);
  }
  if (status && typeof status === "string") {
    list = list.filter((v) => v.status === status);
  }

  // Augment with document expiration statuses
  const augmented = list.map((v) => {
    const regCheck = checkDocExpiry(v.registrationExpiry);
    const insCheck = checkDocExpiry(v.insuranceExpiry);
    const inspCheck = checkDocExpiry(v.inspectionExpiry);

    const hasExpiredDoc = regCheck.isExpired || insCheck.isExpired || inspCheck.isExpired;
    const hasExpiringSoon = regCheck.daysRemaining <= 30 || insCheck.daysRemaining <= 30 || inspCheck.daysRemaining <= 30;

    return {
      ...v,
      documentAudit: {
        registration: { expiry: v.registrationExpiry, ...regCheck },
        insurance: { expiry: v.insuranceExpiry, ...insCheck },
        inspection: { expiry: v.inspectionExpiry, ...inspCheck },
        hasExpiredDoc,
        hasExpiringSoon,
        assignmentEligible: !hasExpiredDoc && v.isActive,
      },
    };
  });

  return res.json({
    total: augmented.length,
    vehicles: augmented,
  });
});

// GET /api/vehicles/:id
router.get("/:id", (req: AuthenticatedRequest, res: Response) => {
  const vehicle = db.vehicles.get(String(req.params.id));
  if (!vehicle) {
    return res.status(404).json({ error: "Vehicle not found" });
  }

  const driver = vehicle.assignedDriverId ? db.drivers.get(vehicle.assignedDriverId) : undefined;
  const regCheck = checkDocExpiry(vehicle.registrationExpiry);
  const insCheck = checkDocExpiry(vehicle.insuranceExpiry);
  const inspCheck = checkDocExpiry(vehicle.inspectionExpiry);

  return res.json({
    vehicle,
    driver,
    documentAudit: {
      registration: { expiry: vehicle.registrationExpiry, ...regCheck },
      insurance: { expiry: vehicle.insuranceExpiry, ...insCheck },
      inspection: { expiry: vehicle.inspectionExpiry, ...inspCheck },
      assignmentEligible: !regCheck.isExpired && !insCheck.isExpired && !inspCheck.isExpired && vehicle.isActive,
    },
  });
});

// POST /api/vehicles
router.post("/", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { plate, type, model, year, maxLoadTons, cab, registrationExpiry, insuranceExpiry, inspectionExpiry } = req.body;

  if (!plate || !type || !model || !year || !maxLoadTons) {
    return res.status(400).json({ error: "Missing required vehicle parameters" });
  }

  if (!OFFICIAL_TYPES.includes(type)) {
    return res.status(400).json({
      error: `Invalid vehicle type '${type}'. Authorized EJAZ fleet types: ${OFFICIAL_TYPES.join(", ")}`,
    });
  }

  const id = `v-${Date.now()}`;
  const newVehicle: VehicleEntity = {
    id,
    plate,
    type,
    model,
    year: Number(year),
    cab: cab || "Standard Cab",
    status: "idle",
    maxLoadTons: Number(maxLoadTons),
    currentLoadTons: 0,
    fuelLevel: 100,
    engineTemp: 85,
    odometerKm: 0,
    gpsDeviceId: `AVL-${plate.replace(/\s+/g, "")}`,
    gpsProvider: "ENTERPRISE_AVL",
    registrationExpiry: registrationExpiry || "2027-01-01",
    insuranceExpiry: insuranceExpiry || "2027-01-01",
    inspectionExpiry: inspectionExpiry || "2027-01-01",
    isActive: true,
  };

  db.vehicles.set(id, newVehicle);
  return res.status(201).json({ message: "Vehicle added successfully", vehicle: newVehicle });
});

export default router;
