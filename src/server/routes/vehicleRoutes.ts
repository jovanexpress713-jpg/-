import { Router, type Response } from "express";
import { db, type VehicleEntity } from "../db";
import { authenticate, requirePermission, type AuthenticatedRequest } from "../auth/middleware";
import { logAuditEvent } from "../services/auditService";
import { getPublicRegistry, removeVehicleImage } from "../services/vehicleAssetRegistry";

const router = Router();

const OFFICIAL_TYPES = ["براد", "سطحة", "جاف", "ستارة"];

/** Canonical category ids for the 4 approved Arabic fleet types. */
const OFFICIAL_TYPE_IDS: Record<string, string> = {
  "سطحة": "flatbed",
  "براد": "reefer",
  "جاف": "dry",
  "ستارة": "curtain",
};

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
router.get("/", authenticate, requirePermission("vehicles.view"), (req: AuthenticatedRequest, res: Response) => {
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
router.get("/:id", authenticate, requirePermission("vehicles.view"), (req: AuthenticatedRequest, res: Response) => {
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
router.post("/", authenticate, requirePermission("vehicles.create", "vehicles.edit"), (req: AuthenticatedRequest, res: Response) => {
  const { plate, type, model, brand, hp, year, maxLoadTons, cab, customImage, registrationExpiry, insuranceExpiry, inspectionExpiry } = req.body;

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
    brand: brand || "Mercedes-Benz",
    hp: hp ? Number(hp) : 530,
    year: Number(year),
    cab: cab || "Standard Cab",
    customImage: typeof customImage === "string" && customImage.trim() ? customImage.trim() : undefined,
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

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "VEHICLE_CREATED",
    entity: "vehicles",
    entityId: id,
    newValues: { plate, type, model, brand: newVehicle.brand, year: newVehicle.year },
  });

  return res.status(201).json({ message: "Vehicle added successfully", vehicle: newVehicle });
});

/**
 * PATCH /api/vehicles/:id — edit a fleet unit.
 * Changing the body type automatically re-binds the unit to that category's
 * official image and official 3D model through the central asset registry, so a
 * flatbed converted to a refrigerated unit never keeps the flatbed assets.
 */
router.patch("/:id", authenticate, requirePermission("vehicles.edit"), (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const vehicle = db.vehicles.get(id);
  if (!vehicle) {
    return res.status(404).json({ error: "Vehicle not found" });
  }

  const { plate, type, model, brand, hp, year, cab, maxLoadTons, status, registrationExpiry, insuranceExpiry, inspectionExpiry, assignedDriverId, customImage } = req.body || {};

  if (type !== undefined && !OFFICIAL_TYPES.includes(type)) {
    return res.status(400).json({
      error: `Invalid vehicle type '${type}'. Authorized EJAZ fleet types: ${OFFICIAL_TYPES.join(", ")}`,
    });
  }

  const previous = { type: vehicle.type, plate: vehicle.plate, status: vehicle.status, model: vehicle.model };
  const typeChanged = type !== undefined && type !== vehicle.type;

  if (plate !== undefined) vehicle.plate = plate;
  if (type !== undefined) vehicle.type = type;
  if (model !== undefined) vehicle.model = model;
  if (brand !== undefined) vehicle.brand = brand;
  if (hp !== undefined) vehicle.hp = Number(hp);
  if (year !== undefined) vehicle.year = Number(year);
  if (cab !== undefined) vehicle.cab = cab;
  if (maxLoadTons !== undefined) vehicle.maxLoadTons = Number(maxLoadTons);
  if (status !== undefined) vehicle.status = status;
  if (registrationExpiry !== undefined) vehicle.registrationExpiry = registrationExpiry;
  if (insuranceExpiry !== undefined) vehicle.insuranceExpiry = insuranceExpiry;
  if (inspectionExpiry !== undefined) vehicle.inspectionExpiry = inspectionExpiry;
  /**
   * Captain assignment is a TWO-WAY link. Writing only the vehicle side left
   * the previous captain still pointing at this truck and the new captain still
   * pointing at his old one, so the drivers screen, the fleet screen and the
   * trip assignment list disagreed about who drives what.
   */
  const previousDriverId = vehicle.assignedDriverId;
  if (assignedDriverId !== undefined) {
    const nextDriverId = assignedDriverId ? String(assignedDriverId) : undefined;

    if (nextDriverId && !db.drivers.has(nextDriverId)) {
      return res.status(404).json({ error: `Driver '${nextDriverId}' does not exist`, code: "DRIVER_NOT_FOUND" });
    }

    // Release the truck from whoever held it before.
    if (previousDriverId && previousDriverId !== nextDriverId) {
      const previousDriver = db.drivers.get(previousDriverId);
      if (previousDriver && previousDriver.assignedVehicleId === id) {
        previousDriver.assignedVehicleId = undefined;
        if (previousDriver.status === "on_trip") previousDriver.status = "available";
      }
    }

    // Release the new captain from his previous truck.
    if (nextDriverId) {
      const nextDriver = db.drivers.get(nextDriverId);
      if (nextDriver) {
        const oldVehicleId = nextDriver.assignedVehicleId;
        if (oldVehicleId && oldVehicleId !== id) {
          const oldVehicle = db.vehicles.get(oldVehicleId);
          if (oldVehicle && oldVehicle.assignedDriverId === nextDriverId) {
            oldVehicle.assignedDriverId = undefined;
          }
        }
        nextDriver.assignedVehicleId = id;
      }
    }

    vehicle.assignedDriverId = nextDriverId;
  }

  if (customImage === null || customImage === "") {
    // A per-vehicle photograph is removed together with its published file.
    removeVehicleImage(id);
    vehicle.customImage = undefined;
  } else if (typeof customImage === "string") {
    vehicle.customImage = customImage.trim() || undefined;
  }

  // Re-bind the category assets whenever the body type changes.
  const registryAsset = getPublicRegistry().types.find((t) => t.type === OFFICIAL_TYPE_IDS[vehicle.type]) || null;

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: typeChanged ? "VEHICLE_TYPE_CHANGED" : "VEHICLE_UPDATED",
    entity: "vehicles",
    entityId: id,
    oldValues: previous,
    newValues: {
      type: vehicle.type,
      plate: vehicle.plate,
      status: vehicle.status,
      model: vehicle.model,
      customImage: vehicle.customImage,
      assignedDriverId: vehicle.assignedDriverId,
    },
    reason: typeChanged ? `Vehicle category re-bound from '${previous.type}' to '${vehicle.type}'` : undefined,
  });

  return res.json({
    message: typeChanged
      ? `Vehicle updated. The official '${vehicle.type}' image and 3D model are now bound to this unit.`
      : "Vehicle updated successfully",
    vehicle,
    assetRebind: typeChanged
      ? {
          type: vehicle.type,
          typeId: OFFICIAL_TYPE_IDS[vehicle.type],
          officialImage: registryAsset?.officialImage ?? null,
          imageSource: registryAsset?.imageSource ?? null,
          model: registryAsset?.model ?? null,
        }
      : undefined,
  });
});

export default router;
