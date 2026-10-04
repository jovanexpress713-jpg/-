import { Router, type Response } from "express";
import { db } from "../db";
import {
  authenticate,
  requirePermission,
  type AuthenticatedRequest,
} from "../auth/middleware";
import {
  validateTariffInput,
  findTariffConflict,
  resolveQuote,
  type TariffEntity,
  type TariffChangeRecord,
  type QuoteRequestEntity,
} from "../services/tariffService";
import { normalizeVehicleType } from "../../data/vehicleTypes";
import { computeRoadDistance, listCities, normalizeCityName } from "../services/cityRegistry";
import { logAuditEvent } from "../services/auditService";
import { dispatchNotification } from "../services/notificationService";

const router = Router();

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function serializeTariff(t: TariffEntity) {
  return t;
}

function pushHistory(rec: Omit<TariffChangeRecord, "id" | "timestamp">) {
  const record: TariffChangeRecord = {
    id: nextId("th"),
    ...rec,
    timestamp: new Date().toISOString(),
  };
  db.tariffHistory.unshift(record);
  return record;
}

// GET /api/tariffs — list + filter the tariff book
router.get("/", authenticate, requirePermission("tariffs.view"), (req: AuthenticatedRequest, res: Response) => {
  const { truckType, origin, destination, status, q } = req.query as Record<string, string | undefined>;
  let list = Array.from(db.tariffs.values());

  if (truckType) {
    const norm = normalizeVehicleType(truckType);
    list = list.filter((t) => normalizeVehicleType(t.truckType) === norm);
  }
  if (origin) list = list.filter((t) => normalizeCityName(t.originCity) === normalizeCityName(origin));
  if (destination) list = list.filter((t) => normalizeCityName(t.destinationCity) === normalizeCityName(destination));
  if (status) list = list.filter((t) => t.status === String(status).toUpperCase());
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter(
      (t) =>
        t.originCity.includes(String(q)) ||
        t.destinationCity.includes(String(q)) ||
        t.truckType.includes(String(q)) ||
        String(t.price).toLowerCase().includes(needle) ||
        String(t.currency).toLowerCase().includes(needle)
    );
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json({ total: list.length, tariffs: list.map(serializeTariff) });
});

// GET /api/tariffs/cities — city registry for the origin/destination selectors
router.get("/cities", authenticate, requirePermission("tariffs.view"), (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ cities: listCities() });
});

// GET /api/tariffs/quote — resolve the live price for a route + weight + type
// Accessible to clients (they need it while building a shipment request).
router.get("/quote", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { truckType, origin, destination, weightTons, date } = req.query as Record<string, string | undefined>;
  if (!truckType || !origin || !destination || !weightTons) {
    return res.status(400).json({ error: "truckType, origin, destination and weightTons are required", code: "QUOTE_MISSING_FIELDS" });
  }

  const result = resolveQuote(Array.from(db.tariffs.values()), {
    truckType,
    originCity: origin,
    destinationCity: destination,
    weightTons: Number(weightTons),
    at: date,
  });

  return res.json(result);
});

// GET /api/tariffs/quote-requests — the control-room queue of client quote asks
router.get("/quote-requests", authenticate, requirePermission("tariffs.view"), (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.query as Record<string, string | undefined>;
  let list = Array.from(db.quoteRequests.values());
  if (status) list = list.filter((r) => r.status === String(status).toUpperCase());
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json({ total: list.length, quoteRequests: list });
});

// POST /api/tariffs/quote-requests — client asks for a quote when no tariff matches
router.post("/quote-requests", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { truckType, originCity, destinationCity, weightTons, note } = req.body || {};
  if (!truckType || !originCity || !destinationCity || !weightTons) {
    return res.status(400).json({ error: "truckType, originCity, destinationCity and weightTons are required", code: "QUOTE_REQUEST_MISSING_FIELDS" });
  }

  const distance = computeRoadDistance(originCity, destinationCity);
  const rec: QuoteRequestEntity = {
    id: nextId("qr"),
    truckType: String(truckType),
    originCity: String(originCity),
    destinationCity: String(destinationCity),
    weightTons: Number(weightTons),
    distanceKm: distance.distanceKm,
    status: "OPEN",
    requestedById: req.user?.userId,
    requestedByName: req.user?.fullName,
    customerId: req.user?.customerId,
    note: note ? String(note) : undefined,
    createdAt: new Date().toISOString(),
  };
  db.quoteRequests.set(rec.id, rec);

  dispatchNotification({
    targetRole: "OPERATIONS_MANAGER",
    titleAr: "طلب عرض سعر جديد بدون تعرفة",
    titleEn: "New quote request (no matching tariff)",
    messageAr: `${rec.originCity} ← ${rec.destinationCity} · ${rec.truckType} · ${rec.weightTons} طن`,
    messageEn: `${rec.originCity} → ${rec.destinationCity} · ${rec.truckType} · ${rec.weightTons} t`,
    type: "INFO",
    entityType: "quoteRequest",
    entityId: rec.id,
  });

  return res.status(201).json({ message: "Quote request submitted to the control room", quoteRequest: rec });
});

// POST /api/tariffs/quote-requests/:id/resolve — control room closes a quote ask
router.post("/quote-requests/:id/resolve", authenticate, requirePermission("tariffs.manage"), (req: AuthenticatedRequest, res: Response) => {
  const rec = db.quoteRequests.get(String(req.params.id));
  if (!rec) return res.status(404).json({ error: "Quote request not found", code: "NOT_FOUND" });
  if (rec.status !== "OPEN") return res.status(400).json({ error: "Quote request is already resolved", code: "ALREADY_RESOLVED" });

  rec.status = "RESOLVED";
  rec.resolution = req.body?.resolution ? String(req.body.resolution) : "تم إنشاء التعرفة المناسبة";
  rec.resolvedAt = new Date().toISOString();

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "QUOTE_REQUEST_RESOLVED",
    entity: "quoteRequests",
    entityId: rec.id,
    newValues: { resolution: rec.resolution },
  });

  return res.json({ message: "Quote request resolved", quoteRequest: rec });
});

// GET /api/tariffs/:id — single tariff with its change history
router.get("/:id", authenticate, requirePermission("tariffs.view"), (req: AuthenticatedRequest, res: Response) => {
  const t = db.tariffs.get(String(req.params.id));
  if (!t) return res.status(404).json({ error: "Tariff not found", code: "NOT_FOUND" });
  const history = db.tariffHistory.filter((h) => h.tariffId === t.id);
  return res.json({ tariff: t, history });
});

// POST /api/tariffs — create a tariff (with conflict prevention)
router.post("/", authenticate, requirePermission("tariffs.manage"), (req: AuthenticatedRequest, res: Response) => {
  const valid = validateTariffInput(req.body || {});
  if (!valid.ok) {
    return res.status(400).json({ error: valid.errorAr, errorEn: valid.errorEn, code: "TARIFF_VALIDATION_FAILED" });
  }

  const all = Array.from(db.tariffs.values());
  if (valid.value.status === "ACTIVE") {
    const conflict = findTariffConflict(all, valid.value);
    if (conflict) {
      return res.status(409).json({
        error: conflict.reasonAr,
        errorEn: conflict.reasonEn,
        code: "TARIFF_CONFLICT",
        conflictingTariff: conflict.conflictingTariff,
      });
    }
  }

  const now = new Date().toISOString();
  const tariff: TariffEntity = {
    id: nextId("tariff"),
    ...valid.value,
    createdBy: req.user?.userId || "system",
    createdAt: now,
    updatedAt: now,
  };
  db.tariffs.set(tariff.id, tariff);

  pushHistory({
    tariffId: tariff.id,
    userId: req.user?.userId,
    userName: req.user?.fullName || "النظام",
    userRole: req.user?.role,
    action: "CREATED",
    oldPrice: undefined,
    newPrice: tariff.price,
    newValues: { ...tariff },
    reason: req.body?.reason ? String(req.body.reason) : undefined,
  });

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "TARIFF_CREATED",
    entity: "tariffs",
    entityId: tariff.id,
    newValues: { tariff },
  });

  return res.status(201).json({ message: "Tariff created", tariff });
});

// PUT /api/tariffs/:id — update a tariff (records old/new price + reason)
router.put("/:id", authenticate, requirePermission("tariffs.manage"), (req: AuthenticatedRequest, res: Response) => {
  const existing = db.tariffs.get(String(req.params.id));
  if (!existing) return res.status(404).json({ error: "Tariff not found", code: "NOT_FOUND" });

  const merged = {
    truckType: req.body?.truckType ?? existing.truckType,
    originCity: req.body?.originCity ?? existing.originCity,
    destinationCity: req.body?.destinationCity ?? existing.destinationCity,
    minDistanceKm: req.body?.minDistanceKm ?? existing.minDistanceKm,
    maxDistanceKm: req.body?.maxDistanceKm === undefined ? existing.maxDistanceKm : req.body?.maxDistanceKm,
    minWeight: req.body?.minWeight ?? existing.minWeight,
    maxWeight: req.body?.maxWeight === undefined ? existing.maxWeight : req.body?.maxWeight,
    weightUnit: req.body?.weightUnit ?? existing.weightUnit,
    price: req.body?.price ?? existing.price,
    currency: req.body?.currency ?? existing.currency,
    status: req.body?.status ?? existing.status,
    validFrom: req.body?.validFrom ?? existing.validFrom,
    validTo: req.body?.validTo === undefined ? existing.validTo : req.body?.validTo,
    notes: req.body?.notes === undefined ? existing.notes : req.body?.notes,
  };

  const valid = validateTariffInput(merged);
  if (!valid.ok) {
    return res.status(400).json({ error: valid.errorAr, errorEn: valid.errorEn, code: "TARIFF_VALIDATION_FAILED" });
  }

  const all = Array.from(db.tariffs.values());
  if (valid.value.status === "ACTIVE") {
    const conflict = findTariffConflict(all, valid.value, existing.id);
    if (conflict) {
      return res.status(409).json({
        error: conflict.reasonAr,
        errorEn: conflict.reasonEn,
        code: "TARIFF_CONFLICT",
        conflictingTariff: conflict.conflictingTariff,
      });
    }
  }

  const oldPrice = existing.price;
  const oldValues = { ...existing };
  const updated: TariffEntity = { ...existing, ...valid.value, updatedAt: new Date().toISOString() };
  db.tariffs.set(updated.id, updated);

  pushHistory({
    tariffId: updated.id,
    userId: req.user?.userId,
    userName: req.user?.fullName || "النظام",
    userRole: req.user?.role,
    action: "UPDATED",
    oldPrice,
    newPrice: updated.price,
    oldValues,
    newValues: { ...updated },
    reason: req.body?.reason ? String(req.body.reason) : undefined,
  });

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "TARIFF_UPDATED",
    entity: "tariffs",
    entityId: updated.id,
    oldValues,
    newValues: { ...updated },
    reason: req.body?.reason,
  });

  return res.json({ message: "Tariff updated", tariff: updated });
});

// POST /api/tariffs/:id/deactivate — stop a tariff
router.post("/:id/deactivate", authenticate, requirePermission("tariffs.manage"), (req: AuthenticatedRequest, res: Response) => {
  const t = db.tariffs.get(String(req.params.id));
  if (!t) return res.status(404).json({ error: "Tariff not found", code: "NOT_FOUND" });
  if (t.status === "INACTIVE") return res.status(400).json({ error: "Tariff is already inactive", code: "ALREADY_INACTIVE" });

  const oldPrice = t.price;
  t.status = "INACTIVE";
  t.updatedAt = new Date().toISOString();

  pushHistory({
    tariffId: t.id,
    userId: req.user?.userId,
    userName: req.user?.fullName || "النظام",
    userRole: req.user?.role,
    action: "DEACTIVATED",
    oldPrice,
    newPrice: t.price,
    oldValues: { status: "ACTIVE" },
    newValues: { status: "INACTIVE" },
    reason: req.body?.reason ? String(req.body.reason) : undefined,
  });
  logAuditEvent({
    actorId: req.user?.userId, actorName: req.user?.fullName, actorRole: req.user?.role,
    action: "TARIFF_DEACTIVATED", entity: "tariffs", entityId: t.id, reason: req.body?.reason,
  });

  return res.json({ message: "Tariff deactivated", tariff: t });
});

// POST /api/tariffs/:id/activate — reactivate a tariff (re-checks conflicts)
router.post("/:id/activate", authenticate, requirePermission("tariffs.manage"), (req: AuthenticatedRequest, res: Response) => {
  const t = db.tariffs.get(String(req.params.id));
  if (!t) return res.status(404).json({ error: "Tariff not found", code: "NOT_FOUND" });
  if (t.status === "ACTIVE") return res.status(400).json({ error: "Tariff is already active", code: "ALREADY_ACTIVE" });

  const conflict = findTariffConflict(Array.from(db.tariffs.values()), t, t.id);
  if (conflict) {
    return res.status(409).json({ error: conflict.reasonAr, errorEn: conflict.reasonEn, code: "TARIFF_CONFLICT", conflictingTariff: conflict.conflictingTariff });
  }

  const oldPrice = t.price;
  t.status = "ACTIVE";
  t.updatedAt = new Date().toISOString();

  pushHistory({
    tariffId: t.id,
    userId: req.user?.userId,
    userName: req.user?.fullName || "النظام",
    userRole: req.user?.role,
    action: "ACTIVATED",
    oldPrice,
    newPrice: t.price,
    oldValues: { status: "INACTIVE" },
    newValues: { status: "ACTIVE" },
    reason: req.body?.reason ? String(req.body.reason) : undefined,
  });
  logAuditEvent({
    actorId: req.user?.userId, actorName: req.user?.fullName, actorRole: req.user?.role,
    action: "TARIFF_ACTIVATED", entity: "tariffs", entityId: t.id, reason: req.body?.reason,
  });

  return res.json({ message: "Tariff reactivated", tariff: t });
});

export default router;
