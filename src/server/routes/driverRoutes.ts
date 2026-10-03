import { Router, type Response } from "express";
import { db, type DriverEntity } from "../db";
import { authenticate, requirePermission, type AuthenticatedRequest } from "../auth/middleware";

const router = Router();

function checkLicenseExpiry(dateStr: string) {
  const target = new Date(dateStr).getTime();
  const diffDays = Math.ceil((target - Date.now()) / (1000 * 3600 * 24));
  return {
    isExpired: diffDays < 0,
    daysRemaining: diffDays,
  };
}

// GET /api/drivers
router.get("/", authenticate, requirePermission("drivers.view"), (_req: AuthenticatedRequest, res: Response) => {
  const list = Array.from(db.drivers.values()).map((d) => {
    const licCheck = checkLicenseExpiry(d.licenseExpiry);
    const vehicle = d.assignedVehicleId ? db.vehicles.get(d.assignedVehicleId) : undefined;
    return {
      ...d,
      assignedVehicle: vehicle ? { id: vehicle.id, plate: vehicle.plate, model: vehicle.model } : null,
      licenseAudit: {
        expiry: d.licenseExpiry,
        ...licCheck,
        eligibleToDrive: !licCheck.isExpired && d.status !== "suspended",
      },
    };
  });

  return res.json({ total: list.length, drivers: list });
});

// GET /api/drivers/:id
router.get("/:id", authenticate, requirePermission("drivers.view"), (req: AuthenticatedRequest, res: Response) => {
  const driverId = String(req.params.id);
  const driver = db.drivers.get(driverId);
  if (!driver) {
    return res.status(404).json({ error: "Driver not found" });
  }

  const licCheck = checkLicenseExpiry(driver.licenseExpiry);
  const vehicle = driver.assignedVehicleId ? db.vehicles.get(driver.assignedVehicleId) : undefined;
  const recentTrips = Array.from(db.trips.values()).filter((t) => t.driverId === driver.id);

  return res.json({
    driver,
    vehicle,
    recentTrips,
    licenseAudit: {
      expiry: driver.licenseExpiry,
      ...licCheck,
      eligibleToDrive: !licCheck.isExpired && driver.status !== "suspended",
    },
  });
});

// POST /api/drivers
router.post("/", authenticate, requirePermission("drivers.create", "drivers.edit"), (req: AuthenticatedRequest, res: Response) => {
  const { fullName, phone, nationalId, licenseNumber, licenseExpiry, assignedVehicleId } = req.body;
  if (!fullName || !phone || !nationalId || !licenseNumber || !licenseExpiry) {
    return res.status(400).json({ error: "Missing required driver profile fields" });
  }

  const id = `d-${Date.now()}`;
  const newDriver: DriverEntity = {
    id,
    fullName,
    phone,
    nationalId,
    licenseNumber,
    licenseExpiry,
    assignedVehicleId,
    status: "available",
    rating: 5.0,
    totalTrips: 0,
  };

  db.drivers.set(id, newDriver);
  return res.status(201).json({ message: "Driver registered successfully", driver: newDriver });
});

export default router;
