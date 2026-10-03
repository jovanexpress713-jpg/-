import { Router, type Response } from "express";
import { authenticate, requirePermission, type AuthenticatedRequest } from "../auth/middleware";
import { logAuditEvent } from "../services/auditService";
import {
  VEHICLE_ASSET_LIMITS,
  VEHICLE_ASSET_TYPES,
  getPublicRegistry,
  removeTypeModel,
  removeVehicleImage,
  saveTypeImage,
  saveTypeModel,
  saveVehicleImage,
  updateModelTransform,
} from "../services/vehicleAssetRegistry";
import { db } from "../db";

const router = Router();

function handleError(res: Response, err: any) {
  const status = err?.status || 500;
  if (status >= 500) console.error("[VehicleAssets]", err);
  return res.status(status).json({ error: err?.message || "Vehicle asset operation failed", code: err?.code });
}

// GET /api/vehicle-assets — the shared catalogue consumed by the app and the console
router.get("/", authenticate, (_req: AuthenticatedRequest, res: Response) => {
  return res.json({
    registry: getPublicRegistry(),
    limits: {
      maxImageBytes: VEHICLE_ASSET_LIMITS.MAX_IMAGE_BYTES,
      maxModelBytes: VEHICLE_ASSET_LIMITS.MAX_MODEL_BYTES,
      allowedTypes: VEHICLE_ASSET_TYPES,
    },
  });
});

// PUT /api/vehicle-assets/:type/image — publish the OFFICIAL reference image
router.put("/:type/image", authenticate, requirePermission("settings.manage", "vehicles.edit"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, fileName, notesAr } = req.body || {};
    if (!data) return res.status(400).json({ error: "data (base64 image) is required" });

    const entry = saveTypeImage(String(req.params.type), { data, fileName, notesAr });

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "VEHICLE_TYPE_IMAGE_PUBLISHED",
      entity: "vehicle_assets",
      entityId: String(req.params.type),
      newValues: { officialImage: entry.officialImage, fileName: entry.imageFileName },
    });

    return res.json({ message: "Official vehicle image published", type: String(req.params.type), asset: entry });
  } catch (err) {
    return handleError(res, err);
  }
});

// PUT /api/vehicle-assets/:type/model — publish the OFFICIAL GLB/GLTF model
router.put("/:type/model", authenticate, requirePermission("settings.manage", "vehicles.edit"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, fileName, scale, rotationY, yOffset, cameraRadius } = req.body || {};
    if (!data) return res.status(400).json({ error: "data (base64 GLB/GLTF) is required" });

    const entry = saveTypeModel(String(req.params.type), { data, fileName, scale, rotationY, yOffset, cameraRadius });

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "VEHICLE_TYPE_MODEL_PUBLISHED",
      entity: "vehicle_assets",
      entityId: String(req.params.type),
      newValues: { url: entry.model.url, format: entry.model.format, sizeBytes: entry.model.sizeBytes, sha256: entry.model.sha256 },
    });

    return res.json({ message: "Official 3D model published", type: String(req.params.type), asset: entry });
  } catch (err) {
    return handleError(res, err);
  }
});

// PATCH /api/vehicle-assets/:type/model — viewer framing for the published model
router.patch("/:type/model", authenticate, requirePermission("settings.manage", "vehicles.edit"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { scale, rotationY, yOffset, cameraRadius } = req.body || {};
    const entry = updateModelTransform(String(req.params.type), { scale, rotationY, yOffset, cameraRadius });
    return res.json({ message: "Model transform updated", type: String(req.params.type), asset: entry });
  } catch (err) {
    return handleError(res, err);
  }
});

// DELETE /api/vehicle-assets/:type/model — withdraw a model (viewer returns to the official reference photo)
router.delete("/:type/model", authenticate, requirePermission("settings.manage"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const entry = removeTypeModel(String(req.params.type));
    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "VEHICLE_TYPE_MODEL_WITHDRAWN",
      entity: "vehicle_assets",
      entityId: String(req.params.type),
    });
    return res.json({ message: "Official 3D model withdrawn", type: String(req.params.type), asset: entry });
  } catch (err) {
    return handleError(res, err);
  }
});

// PUT /api/vehicle-assets/vehicle/:vehicleId/image — per-vehicle photograph
router.put("/vehicle/:vehicleId/image", authenticate, requirePermission("vehicles.edit", "trips.assign", "settings.manage"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, fileName } = req.body || {};
    if (!data) return res.status(400).json({ error: "data (base64 image) is required" });

    const vehicleId = String(req.params.vehicleId);
    const entry = saveVehicleImage(vehicleId, { data, fileName });

    const vehicle = db.vehicles.get(vehicleId);
    if (vehicle) {
      (vehicle as any).customImage = entry.url;
    }

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "VEHICLE_CUSTOM_IMAGE_PUBLISHED",
      entity: "vehicles",
      entityId: vehicleId,
      newValues: { url: entry.url },
    });

    return res.json({ message: "Vehicle image published", vehicleId, image: entry });
  } catch (err) {
    return handleError(res, err);
  }
});

// DELETE /api/vehicle-assets/vehicle/:vehicleId/image — revert to the official category asset
router.delete("/vehicle/:vehicleId/image", authenticate, requirePermission("vehicles.edit", "trips.assign", "settings.manage"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const vehicleId = String(req.params.vehicleId);
    removeVehicleImage(vehicleId);

    const vehicle = db.vehicles.get(vehicleId);
    if (vehicle) {
      (vehicle as any).customImage = undefined;
    }

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "VEHICLE_CUSTOM_IMAGE_REMOVED",
      entity: "vehicles",
      entityId: vehicleId,
    });

    return res.json({ message: "Vehicle image removed; official category asset restored", vehicleId });
  } catch (err) {
    return handleError(res, err);
  }
});

export default router;
