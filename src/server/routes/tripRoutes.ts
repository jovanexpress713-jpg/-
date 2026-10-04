import { Router, type Response } from "express";
import { db, type TripEntity, type TripEventEntity } from "../db";
import {
  authenticate,
  requirePermission,
  canAccessTrip,
  type AuthenticatedRequest,
} from "../auth/middleware";
import { generateTripNumber } from "../services/tripNumberGenerator";
import {
  validateTransition,
  availableTransitions,
  canCancelTrip,
  type TripLifecycleStatus,
  STATUS_LABELS,
} from "../services/tripLifecycleService";
import { advanceTripStatus } from "../services/tripStatusWriter";
import { hasPermission } from "../auth/middleware";
import { initTripFinancials, getTripFinancials, repriceTripFinancials, serializeFinancials } from "../services/financeService";
import { logAuditEvent } from "../services/auditService";
import { dispatchNotification } from "../services/notificationService";
import { resolveQuote } from "../services/tariffService";
import { computeRoadDistance } from "../services/cityRegistry";

const router = Router();

/** Trip fields that are financial data, not operational data. */
const FINANCIAL_TRIP_FIELDS = ["tripPrice", "currency", "priceStatus", "tariffId"] as const;

/**
 * Strips the financial side of a trip for a caller who does not hold
 * `finance.view`.
 *
 * Separating the money from the operation is a permission decision, not a UI
 * one: an operations manager may run a shipment end to end without ever seeing
 * its price, margin or settlement. The field is removed from the payload, so no
 * client can read it out of a response it was never meant to receive.
 */
function scrubFinancial<T extends Record<string, any>>(trip: T, canViewFinance: boolean): T {
  if (canViewFinance) return trip;
  const copy: Record<string, any> = { ...trip };
  for (const field of FINANCIAL_TRIP_FIELDS) delete copy[field];
  copy.financialsRedacted = true;
  return copy as T;
}


// GET /api/trips
router.get("/", authenticate, requirePermission("trips.view"), (req: AuthenticatedRequest, res: Response) => {
  const { status, vehicleId, driverId, customerId } = req.query;
  let list = Array.from(db.trips.values());

  // Object-level scoping: clients and drivers only ever see trips they are entitled to.
  if (req.user?.role === "CUSTOMER") {
    const scopedCustomerId = req.user.customerId;
    list = list.filter((t) => !!scopedCustomerId && t.customerId === scopedCustomerId);
  } else if (req.user?.role === "DRIVER") {
    list = list.filter((t) => canAccessTrip(req.user, t));
  } else if (req.user?.role === "BROKER" || req.user?.role === "REPRESENTATIVE" || req.user?.role === "CUSTOMS_BROKER") {
    list = list.filter((t) => canAccessTrip(req.user, t));
  }

  if (status && typeof status === "string") {
    list = list.filter((t) => t.status === status);
  }
  if (vehicleId && typeof vehicleId === "string") {
    list = list.filter((t) => t.vehicleId === vehicleId);
  }
  if (driverId && typeof driverId === "string") {
    list = list.filter((t) => t.driverId === driverId);
  }
  if (customerId && typeof customerId === "string") {
    list = list.filter((t) => t.customerId === customerId);
  }

  // Sort by createdAt descending
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const canViewFinance = hasPermission(req.user?.role, "finance.view", req.user?.permissions);

  return res.json({
    total: list.length,
    financialsVisible: canViewFinance,
    trips: list.map((t) => scrubFinancial(t, canViewFinance)),
  });
});

// GET /api/client/trips - Trips specifically belonging to the authenticated client
router.get("/client/trips", authenticate, requirePermission("trips.view"), (req: AuthenticatedRequest, res: Response) => {
  const customerId = req.user?.customerId;
  const userRole = req.user?.role;
  let list = Array.from(db.trips.values());

  // If customer role, strictly scope by customerId
  if (userRole === "CUSTOMER" && customerId) {
    list = list.filter((t) => t.customerId === customerId);
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const clientCanViewFinance = hasPermission(req.user?.role, "finance.view", req.user?.permissions);
  return res.json({
    total: list.length,
    financialsVisible: clientCanViewFinance,
    trips: list.map((t) => scrubFinancial(t, clientCanViewFinance)),
  });
});

// GET /api/driver/trips - Trips for driver with tab support (all | available | confirmed | active | completed)
router.get("/driver/trips", authenticate, requirePermission("trips.view"), (req: AuthenticatedRequest, res: Response) => {
  const driverId = req.user?.driverId || req.user?.userId || "";
  const userRole = req.user?.role;
  const tab = (req.query.tab as string) || "all";
  let allTrips = Array.from(db.trips.values());

  let filtered = allTrips;

  if (tab === "available") {
    // Available trips: unassigned or open for driver requests (declined ones stay hidden)
    filtered = allTrips.filter(
      (t) =>
        !t.declinedDriverIds?.includes(driverId) &&
        (t.status === "DRAFT_CREATED" ||
          t.status === "PENDING_APPROVAL" ||
          t.status === "REOPENED" ||
          !t.driverId ||
          t.driverId === "unassigned" ||
          (t.status === "CONFIRMED" && !t.driverId))
    );
  } else if (tab === "confirmed") {
    // Confirmed/assigned to this driver
    filtered = allTrips.filter(
      (t) =>
        (t.driverId === driverId || t.additionalDriverId === driverId) &&
        (t.status === "ASSIGNED" || t.status === "CONFIRMED")
    );
  } else if (tab === "active") {
    // In progress
    const activeStates = ["HEADING_TO_LOADING", "ARRIVED_LOADING", "LOADED", "IN_TRANSIT", "ARRIVED_DESTINATION"];
    filtered = allTrips.filter(
      (t) =>
        (t.driverId === driverId || t.additionalDriverId === driverId) &&
        activeStates.includes(t.status)
    );
  } else if (tab === "completed") {
    // Completed
    const completedStates = ["DELIVERED", "SETTLEMENT_PENDING", "FINANCIAL_REVIEW", "PARTIALLY_PAID", "PAID", "COMPLETED"];
    filtered = allTrips.filter(
      (t) =>
        (t.driverId === driverId || t.additionalDriverId === driverId) &&
        completedStates.includes(t.status)
    );
  } else {
    // "all": Trips assigned to driver OR available (declined ones stay hidden)
    if (userRole === "DRIVER") {
      filtered = allTrips.filter(
        (t) =>
          t.driverId === driverId ||
          t.additionalDriverId === driverId ||
          (!t.declinedDriverIds?.includes(driverId) &&
            (t.status === "DRAFT_CREATED" ||
              t.status === "PENDING_APPROVAL" ||
              t.status === "REOPENED" ||
              !t.driverId))
      );
    }
  }

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const driverCanViewFinance = hasPermission(req.user?.role, "finance.view", req.user?.permissions);
  return res.json({
    total: filtered.length,
    financialsVisible: driverCanViewFinance,
    tab,
    trips: filtered.map((t) => scrubFinancial(t, driverCanViewFinance)),
  });
});

// POST /api/driver/trips/:id/request - Driver requests an available trip
router.post("/driver/trips/:id/request", authenticate, requirePermission("trips.request", "trips.assign"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  if (req.user?.role !== "DRIVER" && req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Only a driver can request a trip", code: "FORBIDDEN" });
  }

  if (trip.driverRequestStatus === "PENDING") {
    return res.status(409).json({ error: "A driver request is already pending for this trip", code: "REQUEST_ALREADY_PENDING" });
  }

  const { notes } = req.body;
  const driverId = req.user?.driverId || req.user?.userId || "d1";
  const driverName = req.user?.fullName || "السائق";

  trip.requestedByDriverId = driverId;
  trip.requestedByDriverName = driverName;
  trip.driverRequestStatus = "PENDING";
  trip.driverRequestNotes = notes;
  trip.updatedAt = new Date().toISOString();

  // Record event
  const reqEvent: TripEventEntity = {
    id: `ev-${Date.now()}`,
    tripId: trip.id,
    eventType: "TRIP_REQUESTED_BY_DRIVER",
    fromStatus: trip.status,
    toStatus: trip.status,
    actorId: req.user?.userId,
    actorName: driverName,
    actorRole: "DRIVER",
    notes: `طلب السائق ${driverName} تولي قيادة الرحلة. ملاحظات: ${notes || "لا توجد"}`,
    timestamp: new Date().toISOString(),
  };
  db.tripEvents.push(reqEvent);

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: driverName,
    actorRole: "DRIVER",
    action: "TRIP_REQUESTED_BY_DRIVER",
    entity: "trips",
    entityId: trip.id,
    tripId: trip.id,
    newValues: { requestedByDriverId: driverId, requestedByDriverName: driverName, notes },
  });

  dispatchNotification({
    targetRole: "OPERATIONS_MANAGER",
    titleAr: `طلب رحلة جديد من السائق ${driverName}`,
    titleEn: `Trip Request from Driver ${driverName}`,
    messageAr: `طلب السائق تولي الرحلة ${trip.tripNumber} (${trip.originCity} ➔ ${trip.destinationCity})`,
    messageEn: `Driver requested trip ${trip.tripNumber}`,
    type: "INFO",
    entityType: "trip",
    entityId: trip.id,
    tripId: trip.id,
  });

  return res.json({
    message: "Trip requested successfully and sent to Operations for approval",
    trip,
  });
});

// POST /api/driver/trips/:id/decline - Driver declines an available trip
// The trip stays in the system untouched; it simply stops being offered to this
// driver. Existing conditions apply: only genuinely open trips can be declined.
router.post("/driver/trips/:id/decline", authenticate, requirePermission("trips.request", "trips.assign"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  if (req.user?.role !== "DRIVER" && req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Only a driver can decline a trip", code: "FORBIDDEN" });
  }

  const driverId = req.user?.driverId || req.user?.userId || "";
  const isOpen =
    !trip.driverId ||
    trip.driverId === "unassigned" ||
    ["DRAFT_CREATED", "PENDING_APPROVAL", "CONFIRMED", "REOPENED"].includes(trip.status);
  if (!isOpen) {
    return res.status(409).json({
      error: "هذه الرحلة لم تعد متاحة للرفض — تم إسنادها أو دخلت مرحلة تنفيذية",
      code: "TRIP_NOT_OPEN",
    });
  }
  if (trip.requestedByDriverId === driverId && trip.driverRequestStatus === "PENDING") {
    return res.status(409).json({
      error: "لديك طلب معلّق على هذه الرحلة — لا يمكن رفضها أثناء انتظار الموافقة",
      code: "REQUEST_ALREADY_PENDING",
    });
  }
  if (trip.declinedDriverIds?.includes(driverId)) {
    return res.status(409).json({ error: "سبق رفض هذه الرحلة من قبلك", code: "ALREADY_DECLINED" });
  }

  trip.declinedDriverIds = [...(trip.declinedDriverIds || []), driverId];
  trip.updatedAt = new Date().toISOString();

  const { reason } = req.body || {};
  db.tripEvents.push({
    id: `ev-${Date.now()}`,
    tripId: trip.id,
    eventType: "TRIP_DECLINED_BY_DRIVER",
    fromStatus: trip.status,
    toStatus: trip.status,
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: "DRIVER",
    notes: `رفض السائق ${req.user?.fullName || driverId} الرحلة المتاحة${reason ? `. السبب: ${reason}` : ""}`,
    timestamp: new Date().toISOString(),
  });

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: "DRIVER",
    action: "TRIP_DECLINED_BY_DRIVER",
    entity: "trips",
    entityId: trip.id,
    tripId: trip.id,
    newValues: { declinedDriverIds: trip.declinedDriverIds, reason },
  });

  return res.json({ message: "Trip declined — it will no longer appear in your available list", trip });
});

// POST /api/trips/:id/approve-request - Admin approves driver trip request
router.post("/:id/approve-request", authenticate, requirePermission("trips.approve"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  if (!trip.requestedByDriverId) {
    return res.status(400).json({ error: "No pending driver request for this trip" });
  }

  const assignedDriver = db.drivers.get(trip.requestedByDriverId) || {
    id: trip.requestedByDriverId,
    fullName: trip.requestedByDriverName || "السائق المعتمد",
    phone: "+966551234567",
  };

  trip.driverId = assignedDriver.id;
  trip.driverName = assignedDriver.fullName;
  trip.driverPhone = (assignedDriver as any).phone || trip.driverPhone;
  trip.driverRequestStatus = "APPROVED";
  trip.status = "ASSIGNED";
  trip.updatedAt = new Date().toISOString();

  db.tripEvents.push({
    id: `ev-${Date.now()}`,
    tripId: trip.id,
    eventType: "DRIVER_REQUEST_APPROVED",
    fromStatus: trip.status,
    toStatus: "ASSIGNED",
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    notes: `تمت موافقة الإدارة على إسناد الرحلة للسائق ${assignedDriver.fullName}`,
    timestamp: new Date().toISOString(),
  });

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "TRIP_REQUEST_APPROVED",
    entity: "trips",
    entityId: trip.id,
    tripId: trip.id,
    newValues: { driverId: trip.driverId, driverName: trip.driverName, status: "ASSIGNED" },
  });

  dispatchNotification({
    targetRole: "DRIVER",
    userId: trip.driverId,
    titleAr: `تمت الموافقة على طلبك للرحلة ${trip.tripNumber}!`,
    titleEn: `Trip Request Approved: ${trip.tripNumber}`,
    messageAr: `وافقت الإدارة على إسناد الرحلة إليك. يرجى التوجه لموقع التحميل في ${trip.originCity}`,
    messageEn: `Your request for trip ${trip.tripNumber} has been approved`,
    type: "SUCCESS",
    entityType: "trip",
    entityId: trip.id,
    tripId: trip.id,
  });

  return res.json({ message: "Driver request approved and trip assigned", trip });
});

// POST /api/trips/:id/reject-request - Admin rejects driver trip request
router.post("/:id/reject-request", authenticate, requirePermission("trips.approve"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  const { reason } = req.body;
  const requestedDriverId = trip.requestedByDriverId;
  const requestedDriverName = trip.requestedByDriverName;

  trip.requestedByDriverId = undefined;
  trip.requestedByDriverName = undefined;
  trip.driverRequestStatus = "REJECTED";
  trip.updatedAt = new Date().toISOString();

  db.tripEvents.push({
    id: `ev-${Date.now()}`,
    tripId: trip.id,
    eventType: "DRIVER_REQUEST_REJECTED",
    fromStatus: trip.status,
    toStatus: trip.status,
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    notes: `تم رفض طلب السائق ${requestedDriverName}. السبب: ${reason || "ظروف تشغيلية"}`,
    timestamp: new Date().toISOString(),
  });

  if (requestedDriverId) {
    dispatchNotification({
      targetRole: "DRIVER",
      userId: requestedDriverId,
      titleAr: `اعتذار عن قبول طلب الرحلة ${trip.tripNumber}`,
      titleEn: `Trip Request Declined: ${trip.tripNumber}`,
      messageAr: `نعتذر، لم يتم قبول طلب الرحلة بسبب: ${reason || "أولويات تشغيلية"}`,
      messageEn: `Your request for trip ${trip.tripNumber} was declined`,
      type: "WARNING",
      entityType: "trip",
      entityId: trip.id,
      tripId: trip.id,
    });
  }

  return res.json({ message: "Driver request rejected", trip });
});


// GET /api/trips/:id
router.get("/:id", authenticate, requirePermission("trips.view"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const trip = db.trips.get(tripId) || Array.from(db.trips.values()).find((t) => t.tripNumber === tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  const vehicle = db.vehicles.get(trip.vehicleId);
  const driver = db.drivers.get(trip.driverId);
  /* Object-level authorization: listing is scoped and so is reading. A client
     may only open a shipment that belongs to them, a driver only a trip
     assigned to them (or still open for requests) — guessing another party's
     trip number or id is refused here, not merely hidden in the UI. */
  if (!canAccessTrip(req.user, trip)) {
    return res.status(403).json({ error: "You are not authorized to access this trip", code: "TRIP_ACCESS_DENIED" });
  }

  const customer = db.customers.get(trip.customerId);
  const events = db.tripEvents.filter((e) => e.tripId === trip.id);
  const financials = getTripFinancials(trip.id);
  const documents = Array.from(db.documents.values()).filter((d) => d.tripId === trip.id);
  const pod = Array.from(db.podRecords.values()).filter((p) => p.tripId === trip.id);
  const claims = Array.from(db.claims.values()).filter((c) => c.tripId === trip.id);

  const role = req.user?.role || "GUEST";
  const currentStatus = trip.status as TripLifecycleStatus;
  const canViewFinance = hasPermission(req.user?.role, "finance.view", req.user?.permissions);

  return res.json({
    trip: scrubFinancial(trip, canViewFinance),
    vehicle,
    driver,
    customer,
    events,
    /* Carries the derived `expenses` total so this screen and the finance
       screen can never disagree about what a trip cost — and is omitted
       entirely for a caller without `finance.view`. */
    financials: canViewFinance ? (financials ? serializeFinancials(financials) : null) : null,
    financialsVisible: canViewFinance,
    documents,
    pod,
    claims,
    statusMeta: STATUS_LABELS[currentStatus] || { ar: trip.status, en: trip.status, badgeColor: "#FF6B1A" },
    /* The legal next steps for THIS role — the console renders its milestone
       buttons from this instead of guessing. */
    nextStates: availableTransitions(currentStatus, role, trip).map((st) => ({
      status: st,
      labelAr: STATUS_LABELS[st]?.ar,
      labelEn: STATUS_LABELS[st]?.en,
    })),
    cancellable: canCancelTrip(currentStatus, role).allowed,
  });
});

// POST /api/trips - Create new shipment request
router.post("/", authenticate, requirePermission("trips.create"), (req: AuthenticatedRequest, res: Response) => {
  const {
    originCity,
    destinationCity,
    pickupAddress,
    deliveryAddress,
    cargoDescription,
    cargoType,
    cargoWeightTons,
    maxCapacityTons,
    temperatureRequired,
    tariffId,
    corridorKey,
    customerId,
    vehicleId,
    driverId,
  } = req.body;

  if (!originCity || !destinationCity || !cargoDescription || !cargoType || !cargoWeightTons) {
    return res.status(400).json({ error: "Missing required trip shipment fields" });
  }

  // Verify cargoType is one of the 4 official types
  const validTypes = ["براد", "سطحة", "جاف", "ستارة"];
  if (!validTypes.includes(cargoType)) {
    return res.status(400).json({
      error: `Invalid vehicle cargo type '${cargoType}'. Official types allowed: ${validTypes.join(", ")}`,
    });
  }

  // Generate Authoritative Trip Number from Backend
  const tripNumber = generateTripNumber(new Date().getFullYear());
  const tripId = `trip-${Date.now()}`;

  const customer = customerId ? db.customers.get(customerId) : undefined;
  const driver = driverId ? db.drivers.get(driverId) : undefined;

  // ── Dynamic pricing (Phase 1 tariff engine) ─────────────────────────────
  // The price is NEVER hardcoded. It is resolved from the company's tariff
  // book by (truck type + route + system distance + weight). If no tariff
  // matches, the trip is created awaiting a company quote — no invented price.
  const distance = computeRoadDistance(originCity, destinationCity);
  const quote = resolveQuote(Array.from(db.tariffs.values()), {
    truckType: cargoType,
    originCity,
    destinationCity,
    weightTons: Number(cargoWeightTons),
  });

  let resolvedPrice: number;
  let resolvedTariffId: string | undefined;
  let resolvedCurrency = "SAR";
  let priceStatus: TripEntity["priceStatus"];

  if (quote.available && quote.tariff) {
    resolvedPrice = quote.price!;
    resolvedTariffId = quote.tariff.id;
    resolvedCurrency = quote.tariff.currency;
    priceStatus = "TARIFF";
  } else {
    // Explicit price only accepted when it is backed by a real tariff record.
    const explicitTariff = tariffId ? db.tariffs.get(String(tariffId)) : undefined;
    if (explicitTariff && explicitTariff.status === "ACTIVE") {
      resolvedPrice = explicitTariff.price;
      resolvedTariffId = explicitTariff.id;
      resolvedCurrency = explicitTariff.currency;
      priceStatus = "TARIFF";
    } else {
      resolvedPrice = 0;
      priceStatus = distance.resolvable ? "PENDING_QUOTE" : "UNPRICED";
    }
  }

  const newTrip: TripEntity = {
    id: tripId,
    tripNumber,
    status: "DRAFT_CREATED",
    customerId: customerId || "cust-1",
    customerName: customer?.name || "شركة سدافكو للأغذية والمشروبات",
    vehicleId: vehicleId || "v1",
    driverId: driverId || "d1",
    driverName: driver?.fullName || "فهد الشمري",
    driverPhone: driver?.phone || "+966551234567",
    originCity,
    destinationCity,
    pickupAddress: pickupAddress || originCity,
    deliveryAddress: deliveryAddress || destinationCity,
    cargoDescription,
    cargoType,
    cargoWeightTons: Number(cargoWeightTons),
    maxCapacityTons: Number(maxCapacityTons || 25),
    temperatureRequired: cargoType === "براد" ? Number(temperatureRequired || -18) : undefined,
    corridorKey: corridorKey || "riyadh-jeddah",
    currentLat: 24.7136,
    currentLng: 46.6753,
    currentSpeed: 0,
    currentHeading: 0,
    departureTime: new Date().toISOString(),
    estimatedArrival: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    tripPrice: resolvedPrice,
    currency: resolvedCurrency,
    priceStatus,
    tariffId: resolvedTariffId,
    distanceKm: quote.distanceKm ?? distance.distanceKm,
    createdBy: req.user?.userId || "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.trips.set(tripId, newTrip);
  initTripFinancials(tripId, tripNumber, newTrip.tripPrice, {
    priceStatus,
    tariffId: resolvedTariffId,
    currency: resolvedCurrency,
  });

  // Record initial creation event
  const createEvent: TripEventEntity = {
    id: `ev-${Date.now()}`,
    tripId,
    eventType: "TRIP_CREATED",
    fromStatus: undefined,
    toStatus: "DRAFT_CREATED",
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    notes:
      priceStatus === "TARIFF"
        ? `تم إنشاء الشحنة وحجز الرقم الموحد ${tripNumber} — السعر ${resolvedPrice} ${resolvedCurrency} من التعرفة المعتمدة (${resolvedTariffId})`
        : `تم إنشاء الشحنة وحجز الرقم الموحد ${tripNumber} — لا توجد تعرفة مطابقة حاليًا والرحلة بانتظار عرض سعر من الشركة`,
    metadata: { tripPrice: resolvedPrice, currency: resolvedCurrency, priceStatus, tariffId: resolvedTariffId, distanceKm: newTrip.distanceKm },
    timestamp: new Date().toISOString(),
  };
  db.tripEvents.push(createEvent);

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "TRIP_CREATED",
    entity: "trips",
    entityId: tripId,
    tripId,
    newValues: { tripNumber, originCity, destinationCity, cargoType, cargoWeightTons },
  });

  dispatchNotification({
    targetRole: "OPERATIONS_MANAGER",
    titleAr: "شحنة جديدة بانتظار الاعتماد",
    titleEn: "New Shipment Awaiting Approval",
    messageAr:
      priceStatus === "TARIFF"
        ? `طلب نقل جديد ${tripNumber}: ${originCity} ← ${destinationCity} · السعر المعتمد ${resolvedPrice} ${resolvedCurrency} من التعرفة`
        : `طلب نقل جديد ${tripNumber}: ${originCity} ← ${destinationCity} · لا توجد تعرفة مطابقة — يتطلب عرض سعر`,
    messageEn: `New trip order ${tripNumber} created from ${originCity} to ${destinationCity}`,
    type: "INFO",
    entityType: "trip",
    entityId: tripId,
    tripId,
  });

  return res.status(201).json({
    message: "Trip created successfully",
    trip: newTrip,
  });
});

// POST /api/trips/:id/transition - Authoritative State Machine Transition
/**
 * POST /api/trips/:id/price — apply the authoritative price to a trip.
 *
 * A trip created without a matching tariff stays «بانتظار عرض سعر». Until a
 * price exists there is no invoice, no cost derivation and no settlement — the
 * money is never invented. This endpoint closes that loop: the price MUST come
 * from an ACTIVE tariff record (or from a live quote resolved against the
 * tariff book), and applying it re-derives every cost line of the trip's
 * financial record so the invoice, the margin and the reports move together.
 */
router.post("/:id/price", authenticate, requirePermission("tariffs.manage", "finance.view"), (req: AuthenticatedRequest, res: Response) => {
  const trip = db.trips.get(String(req.params.id));
  if (!trip) return res.status(404).json({ error: "Trip not found" });

  const { tariffId, price, notes } = req.body || {};

  let resolvedPrice = Number(price);
  let resolvedTariffId: string | undefined = tariffId ? String(tariffId) : undefined;
  let resolvedCurrency = trip.currency || "SAR";

  const tariff = resolvedTariffId ? db.tariffs.get(resolvedTariffId) : undefined;
  if (tariff && tariff.status === "ACTIVE") {
    // The tariff book is authoritative over any typed amount.
    resolvedPrice = Number(tariff.price);
    resolvedCurrency = tariff.currency || resolvedCurrency;
  } else if (!Number.isFinite(resolvedPrice) || resolvedPrice <= 0) {
    // No tariff supplied: the quote must be resolved against the tariff book.
    const quote = resolveQuote(Array.from(db.tariffs.values()), {
      truckType: trip.cargoType,
      originCity: trip.originCity,
      destinationCity: trip.destinationCity,
      weightTons: trip.cargoWeightTons,
    });
    if (!quote.available || !quote.tariff) {
      return res.status(422).json({
        error: "No active tariff matches this shipment. Create the tariff first — a trip price can never be typed in without a tariff behind it.",
        code: "NO_TARIFF_MATCH",
      });
    }
    resolvedPrice = Number(quote.price);
    resolvedTariffId = quote.tariff.id;
    resolvedCurrency = quote.tariff.currency || resolvedCurrency;
  }

  /**
   * The price stays editable while nothing has been billed against it — a
   * shipment may well be delivered while its quote is still pending. It locks
   * the moment money has been collected or an invoice has gone out, because
   * changing it then would silently rewrite a document the customer holds.
   */
  const existingFinancials = getTripFinancials(trip.id);
  const priceLocked =
    !!existingFinancials &&
    (existingFinancials.paidAmount > 0 || ["SENT", "PAID", "OVERDUE"].includes(existingFinancials.invoiceStatus));
  if (priceLocked) {
    return res.status(422).json({
      error: `The price of ${trip.tripNumber} can no longer be changed: ${existingFinancials!.paidAmount > 0 ? "a payment has already been recorded" : "the invoice has already been issued"}. Adjust it through the financial review flow instead.`,
      code: "PRICE_LOCKED",
      currentStatus: trip.status,
      paidAmount: existingFinancials!.paidAmount,
      invoiceStatus: existingFinancials!.invoiceStatus,
    });
  }

  const previousPrice = trip.tripPrice;
  trip.tripPrice = resolvedPrice;
  trip.currency = resolvedCurrency;
  trip.priceStatus = "TARIFF";
  trip.tariffId = resolvedTariffId;
  trip.updatedAt = new Date().toISOString();

  const financial = repriceTripFinancials(trip.id, resolvedPrice, {
    tariffId: resolvedTariffId,
    currency: resolvedCurrency,
    priceStatus: "TARIFF",
  });

  db.tripEvents.push({
    id: `ev-${Date.now()}-price`,
    tripId: trip.id,
    eventType: "TRIP_PRICED",
    fromStatus: trip.status,
    toStatus: trip.status,
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    notes: `تم اعتماد سعر الرحلة ${resolvedPrice} ${resolvedCurrency} من التعرفة (${resolvedTariffId || "quote"})`,
    metadata: { previousPrice, resolvedPrice, resolvedTariffId, resolvedCurrency },
    timestamp: new Date().toISOString(),
  });

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "TRIP_PRICED",
    entity: "trips",
    entityId: trip.id,
    tripId: trip.id,
    oldValues: { tripPrice: previousPrice, priceStatus: "PENDING_QUOTE" },
    newValues: { tripPrice: resolvedPrice, tariffId: resolvedTariffId, currency: resolvedCurrency },
    reason: notes,
  });

  return res.json({
    message: `Trip priced at ${resolvedPrice} ${resolvedCurrency} from tariff ${resolvedTariffId || "quote"}`,
    trip,
    financial: financial ? serializeFinancials(financial) : null,
  });
});

router.post("/:id/transition", authenticate, requirePermission("trips.transition"), (req: AuthenticatedRequest, res: Response) => {
  const trip = db.trips.get(String(req.params.id));
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  if (!canAccessTrip(req.user, trip)) {
    return res.status(403).json({ error: "You are not authorized to transition this trip", code: "TRIP_ACCESS_DENIED" });
  }

  const { targetStatus, notes, latitude, longitude, reason } = req.body;
  if (!targetStatus) {
    return res.status(400).json({ error: "targetStatus is required" });
  }

  const oldStatus = trip.status;

  /**
   * The state machine stays the authority: the request is planned hop by hop
   * and every hop is validated for this role. A dispatch milestone such as
   * «بدء الانطلاق» therefore walks CONFIRMED → ASSIGNED → HEADING_TO_LOADING →
   * ARRIVED_LOADING → LOADED → IN_TRANSIT instead of jumping, and the response
   * reports the whole chain so the operator sees exactly what was written.
   */
  const result = advanceTripStatus(
    trip,
    targetStatus as TripLifecycleStatus,
    { userId: req.user?.userId, fullName: req.user?.fullName, role: req.user?.role },
    { notes, reason, latitude, longitude }
  );

  if (!result.ok) {
    return res.status(422).json({
      error: result.error,
      code: result.code || "INVALID_TRANSITION",
      currentStatus: oldStatus,
      targetStatus,
      /** Legal next steps for this role, so the UI can offer a valid action. */
      availableNext: availableTransitions(oldStatus as TripLifecycleStatus, req.user?.role || "GUEST", trip),
    });
  }

  return res.json({
    message: result.applied.length > 1
      ? `Advanced through ${result.applied.length} lifecycle steps to ${targetStatus}`
      : "Transition successful",
    trip,
    event: result.applied.length ? db.tripEvents.filter((e) => e.tripId === trip.id).slice(-1)[0] : null,
    appliedTransitions: result.applied,
    fromStatus: oldStatus,
  });
});

/**
 * GET /api/trips/:id/next-states — the legal next steps of a trip for the
 * calling role. The console uses it to enable/disable its milestone buttons
 * instead of letting an operator click into a 422.
 */
router.get("/:id/next-states", authenticate, requirePermission("trips.view"), (req: AuthenticatedRequest, res: Response) => {
  const trip = db.trips.get(String(req.params.id));
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  if (!canAccessTrip(req.user, trip)) {
    return res.status(403).json({ error: "You are not authorized to view this trip", code: "TRIP_ACCESS_DENIED" });
  }

  const role = req.user?.role || "GUEST";
  const current = trip.status as TripLifecycleStatus;
  const next = availableTransitions(current, role, trip);
  const cancellable = canCancelTrip(current, role).allowed;

  return res.json({
    tripId: trip.id,
    currentStatus: current,
    currentLabelAr: STATUS_LABELS[current]?.ar,
    currentLabelEn: STATUS_LABELS[current]?.en,
    nextStates: next.map((s) => ({
      status: s,
      labelAr: STATUS_LABELS[s]?.ar,
      labelEn: STATUS_LABELS[s]?.en,
    })),
    cancellable,
  });
});

// POST /api/trips/:id/cancel
router.post("/:id/cancel", authenticate, requirePermission("trips.cancel"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  const { reason } = req.body;
  if (!reason || reason.trim().length < 5) {
    return res.status(400).json({ error: "Cancellation requires a detailed reason (minimum 5 characters)" });
  }

  const userRole = req.user?.role || "";
  const validation = validateTransition(trip.status as TripLifecycleStatus, "CANCELLED", userRole, trip, reason);
  if (!validation.isValid) {
    return res.status(422).json({ error: validation.error });
  }

  const oldStatus = trip.status;
  trip.status = "CANCELLED";
  trip.cancellationReason = reason;
  trip.updatedAt = new Date().toISOString();

  // Free assigned vehicle if not already running
  const vehicle = db.vehicles.get(trip.vehicleId);
  if (vehicle && vehicle.status === "in_trip") {
    vehicle.status = "idle";
  }

  const cancelEvent: TripEventEntity = {
    id: `ev-${Date.now()}`,
    tripId: trip.id,
    eventType: "TRIP_CANCELLED",
    fromStatus: oldStatus,
    toStatus: "CANCELLED",
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    notes: `تم إلغاء الرحلة. سبب الإلغاء: ${reason}`,
    timestamp: new Date().toISOString(),
  };
  db.tripEvents.push(cancelEvent);

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "TRIP_CANCELLED",
    entity: "trips",
    entityId: trip.id,
    tripId: trip.id,
    oldValues: { status: oldStatus },
    newValues: { status: "CANCELLED", reason },
    reason,
  });

  return res.json({
    message: "Trip cancelled successfully",
    trip,
  });
});

// POST /api/trips/:id/reopen
router.post("/:id/reopen", authenticate, requirePermission("trips.reopen"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  if (trip.status !== "CANCELLED") {
    return res.status(400).json({ error: "Only cancelled trips can be reopened." });
  }

  const { reason } = req.body;
  if (!reason || reason.trim().length < 5) {
    return res.status(400).json({ error: "Reopening requires a clear operational justification" });
  }

  const allowedRoles = ["SUPER_ADMIN", "GENERAL_MANAGER"];
  if (!allowedRoles.includes(req.user?.role || "")) {
    return res.status(403).json({ error: "Access denied. Only Super Admin or General Manager can reopen cancelled trips." });
  }

  trip.status = "REOPENED";
  trip.reopeningReason = reason;
  trip.updatedAt = new Date().toISOString();

  const reopenEvent: TripEventEntity = {
    id: `ev-${Date.now()}`,
    tripId: trip.id,
    eventType: "TRIP_REOPENED",
    fromStatus: "CANCELLED",
    toStatus: "REOPENED",
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    notes: `تمت إعادة فتح الرحلة من قبل الإدارة العليا. المبرر: ${reason}`,
    timestamp: new Date().toISOString(),
  };
  db.tripEvents.push(reopenEvent);

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "TRIP_REOPENED",
    entity: "trips",
    entityId: trip.id,
    tripId: trip.id,
    oldValues: { status: "CANCELLED" },
    newValues: { status: "REOPENED", reason },
    reason,
  });

  return res.json({
    message: "Trip reopened successfully for review",
    trip,
  });
});

// GET /api/trips/:id/events
router.get("/:id/events", authenticate, requirePermission("trips.view"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const events = db.tripEvents.filter((e) => e.tripId === tripId);
  return res.json({ events });
});

// GET /api/trips/:id/tracking
router.get("/:id/tracking", authenticate, requirePermission("trips.view"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const trip = db.trips.get(tripId) || Array.from(db.trips.values()).find((t) => t.tripNumber === tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  if (!canAccessTrip(req.user, trip)) {
    return res.status(403).json({ error: "You are not authorized to track this trip", code: "TRIP_ACCESS_DENIED" });
  }

  const vehicle = db.vehicles.get(trip.vehicleId);
  const driver = db.drivers.get(trip.driverId);

  // Return clean tracking payload
  return res.json({
    tripId: trip.id,
    tripNumber: trip.tripNumber,
    status: trip.status,
    originCity: trip.originCity,
    destinationCity: trip.destinationCity,
    pickupAddress: trip.pickupAddress,
    deliveryAddress: trip.deliveryAddress,
    corridorKey: trip.corridorKey,
    currentLat: trip.currentLat,
    currentLng: trip.currentLng,
    currentSpeed: trip.currentSpeed,
    currentHeading: trip.currentHeading,
    departureTime: trip.departureTime,
    estimatedArrival: trip.estimatedArrival,
    vehicle: vehicle
      ? {
          id: vehicle.id,
          plate: vehicle.plate,
          type: vehicle.type,
          model: vehicle.model,
          gpsDeviceId: vehicle.gpsDeviceId,
          fuelLevel: vehicle.fuelLevel,
          engineTemp: vehicle.engineTemp,
        }
      : null,
    driver: driver
      ? {
          id: driver.id,
          fullName: driver.fullName,
          phone: driver.phone,
          rating: driver.rating,
        }
      : null,
    gpsStatus: vehicle?.gpsDeviceId ? "ONLINE" : "CONFIGURATION_REQUIRED",
    lastGpsUpdate: trip.updatedAt,
  });
});

// POST /api/trips/:id/assign-driver
router.post("/:id/assign-driver", authenticate, requirePermission("trips.assign"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  const { driverId, additionalDriverId } = req.body;
  if (!driverId) {
    return res.status(400).json({ error: "driverId is required" });
  }

  const driver = db.drivers.get(driverId);
  if (!driver) {
    return res.status(404).json({ error: "Driver not found" });
  }

  // Check driver license expiration
  const isLicenseExpired = new Date(driver.licenseExpiry).getTime() < Date.now();
  if (isLicenseExpired) {
    return res.status(400).json({ error: "Cannot assign driver: Driver license has expired." });
  }

  const prevDriverName = trip.driverName;
  trip.driverId = driver.id;
  trip.driverName = driver.fullName;
  trip.driverPhone = driver.phone;

  if (additionalDriverId) {
    const addDriver = db.drivers.get(additionalDriverId);
    if (addDriver) {
      trip.additionalDriverId = addDriver.id;
      trip.additionalDriverName = addDriver.fullName;
    }
  }

  trip.updatedAt = new Date().toISOString();
  if (trip.status === "CONFIRMED" || trip.status === "PENDING_APPROVAL") {
    trip.status = "ASSIGNED";
  }

  // Create event
  db.tripEvents.push({
    id: `ev-${Date.now()}`,
    tripId: trip.id,
    eventType: "DRIVER_ASSIGNED",
    fromStatus: trip.status,
    toStatus: trip.status,
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    notes: `تم تعيين السائق ${driver.fullName} للرحلة`,
    timestamp: new Date().toISOString(),
  });

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "TRIP_DRIVER_ASSIGNED",
    entity: "trips",
    entityId: trip.id,
    tripId: trip.id,
    oldValues: { driverName: prevDriverName },
    newValues: { driverId: driver.id, driverName: driver.fullName, additionalDriverId: trip.additionalDriverId },
  });

  dispatchNotification({
    targetRole: "DRIVER",
    userId: driver.id,
    titleAr: `تم تكليفك برحلة جديدة ${trip.tripNumber}`,
    titleEn: `Assigned to Trip ${trip.tripNumber}`,
    messageAr: `تم تعيينك لقيادة الرحلة من ${trip.originCity} إلى ${trip.destinationCity}`,
    messageEn: `You have been assigned to trip ${trip.tripNumber}`,
    type: "INFO",
    entityType: "trip",
    entityId: trip.id,
    tripId: trip.id,
  });

  return res.json({ message: "Driver assigned successfully", trip });
});

// POST /api/trips/:id/replace-driver
router.post("/:id/replace-driver", authenticate, requirePermission("trips.assign"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  const { newDriverId, reason } = req.body;
  if (!newDriverId || !reason || reason.trim().length < 4) {
    return res.status(400).json({ error: "newDriverId and a clear reason are required to replace driver" });
  }

  const newDriver = db.drivers.get(newDriverId);
  if (!newDriver) {
    return res.status(404).json({ error: "New driver not found" });
  }

  const oldDriverId = trip.driverId;
  const oldDriverName = trip.driverName;

  // Preserve history — previous + replacement + acting user + reason + time
  if (!trip.driverHistory) trip.driverHistory = [];
  trip.driverHistory.push({
    driverId: oldDriverId,
    driverName: oldDriverName,
    newDriverId: newDriver.id,
    newDriverName: newDriver.fullName,
    replacedBy: req.user?.fullName || "إدارة العمليات",
    reason,
    timestamp: new Date().toISOString(),
  });

  trip.driverId = newDriver.id;
  trip.driverName = newDriver.fullName;
  trip.driverPhone = newDriver.phone;
  trip.updatedAt = new Date().toISOString();

  // Record replacement event
  db.tripEvents.push({
    id: `ev-${Date.now()}`,
    tripId: trip.id,
    eventType: "DRIVER_REPLACED",
    fromStatus: trip.status,
    toStatus: trip.status,
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    notes: `تم استبدال السائق (${oldDriverName} ➔ ${newDriver.fullName}). السبب: ${reason}`,
    timestamp: new Date().toISOString(),
  });

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "TRIP_DRIVER_REPLACED",
    entity: "trips",
    entityId: trip.id,
    tripId: trip.id,
    oldValues: { driverId: oldDriverId, driverName: oldDriverName },
    newValues: { driverId: newDriver.id, driverName: newDriver.fullName, reason },
    reason,
  });

  dispatchNotification({
    targetRole: "ALL",
    titleAr: `استبدال سائق الرحلة ${trip.tripNumber}`,
    titleEn: `Driver Replaced for Trip ${trip.tripNumber}`,
    messageAr: `تم استبدال السائق بالسائق الجديد ${newDriver.fullName} بسبب: ${reason}`,
    messageEn: `Driver replaced with ${newDriver.fullName}: ${reason}`,
    type: "WARNING",
    entityType: "trip",
    entityId: trip.id,
    tripId: trip.id,
  });

  return res.json({ message: "Driver replaced successfully", trip, driverHistory: trip.driverHistory });
});

// POST /api/trips/:id/assign-vehicle
router.post("/:id/assign-vehicle", authenticate, requirePermission("trips.assign"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  const { vehicleId } = req.body;
  if (!vehicleId) {
    return res.status(400).json({ error: "vehicleId is required" });
  }

  const vehicle = db.vehicles.get(vehicleId);
  if (!vehicle) {
    return res.status(404).json({ error: "Vehicle not found" });
  }

  const prevVehicleId = trip.vehicleId;
  trip.vehicleId = vehicle.id;
  trip.updatedAt = new Date().toISOString();

  if (trip.status === "CONFIRMED" || trip.status === "PENDING_APPROVAL") {
    trip.status = "ASSIGNED";
  }

  db.tripEvents.push({
    id: `ev-${Date.now()}`,
    tripId: trip.id,
    eventType: "VEHICLE_ASSIGNED",
    fromStatus: trip.status,
    toStatus: trip.status,
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    notes: `تم تعيين الشاحنة لوحة ${vehicle.plate} (${vehicle.type}) للرحلة`,
    timestamp: new Date().toISOString(),
  });

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "TRIP_VEHICLE_ASSIGNED",
    entity: "trips",
    entityId: trip.id,
    tripId: trip.id,
    oldValues: { vehicleId: prevVehicleId },
    newValues: { vehicleId: vehicle.id, plate: vehicle.plate, type: vehicle.type },
  });

  return res.json({ message: "Vehicle assigned successfully", trip, vehicle });
});

// POST /api/trips/:id/replace-vehicle
router.post("/:id/replace-vehicle", authenticate, requirePermission("trips.assign"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  const { newVehicleId, reason } = req.body;
  if (!newVehicleId || !reason || reason.trim().length < 4) {
    return res.status(400).json({ error: "newVehicleId and reason are required to replace vehicle" });
  }

  const newVehicle = db.vehicles.get(newVehicleId);
  if (!newVehicle) {
    return res.status(404).json({ error: "New vehicle not found" });
  }

  // Preserve history — previous + replacement + acting user + reason + time
  const oldVehicle = db.vehicles.get(trip.vehicleId);
  const oldVehicleId = trip.vehicleId;
  if (!trip.vehicleHistory) trip.vehicleHistory = [];
  trip.vehicleHistory.push({
    vehicleId: oldVehicleId,
    plate: oldVehicle?.plate || oldVehicleId,
    newVehicleId: newVehicle.id,
    newPlate: newVehicle.plate,
    replacedBy: req.user?.fullName || "إدارة العمليات",
    reason,
    timestamp: new Date().toISOString(),
  });

  trip.vehicleId = newVehicle.id;
  trip.updatedAt = new Date().toISOString();

  // Record replacement event
  db.tripEvents.push({
    id: `ev-${Date.now()}`,
    tripId: trip.id,
    eventType: "VEHICLE_REPLACED",
    fromStatus: trip.status,
    toStatus: trip.status,
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    notes: `تم استبدال الشاحنة بشاحنة جديدة لوحة ${newVehicle.plate}. السبب: ${reason}`,
    timestamp: new Date().toISOString(),
  });

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "TRIP_VEHICLE_REPLACED",
    entity: "trips",
    entityId: trip.id,
    tripId: trip.id,
    oldValues: { vehicleId: oldVehicleId },
    newValues: { vehicleId: newVehicle.id, plate: newVehicle.plate, reason },
    reason,
  });

  dispatchNotification({
    targetRole: "ALL",
    titleAr: `استبدال شاحنة الرحلة ${trip.tripNumber}`,
    titleEn: `Vehicle Replaced for Trip ${trip.tripNumber}`,
    messageAr: `تم استبدال الشاحنة بالمركبة ${newVehicle.plate} (${newVehicle.type}) بسبب: ${reason}`,
    messageEn: `Vehicle replaced with ${newVehicle.plate} (${newVehicle.type}): ${reason}`,
    type: "WARNING",
    entityType: "trip",
    entityId: trip.id,
    tripId: trip.id,
  });

  return res.json({ message: "Vehicle replaced successfully", trip, vehicleHistory: trip.vehicleHistory });
});

// POST /api/trips/:id/replace-assignment — replace driver AND vehicle together
// One operation inside the SAME trip: no new trip, the unified number never
// changes, both histories and one combined event are recorded.
router.post("/:id/replace-assignment", authenticate, requirePermission("trips.assign"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  const { newDriverId, newVehicleId, reason, latitude, longitude } = req.body || {};
  if (!newDriverId || !newVehicleId || !reason || String(reason).trim().length < 4) {
    return res.status(400).json({ error: "newDriverId, newVehicleId and a clear reason are required to replace both", code: "MISSING_FIELDS" });
  }

  const newDriver = db.drivers.get(newDriverId);
  if (!newDriver) return res.status(404).json({ error: "New driver not found" });
  const newVehicle = db.vehicles.get(newVehicleId);
  if (!newVehicle) return res.status(404).json({ error: "New vehicle not found" });

  const isLicenseExpired = new Date(newDriver.licenseExpiry).getTime() < Date.now();
  if (isLicenseExpired) {
    return res.status(400).json({ error: "Cannot assign replacement driver: licence has expired." });
  }

  const oldDriverId = trip.driverId;
  const oldDriverName = trip.driverName;
  const oldVehicle = db.vehicles.get(trip.vehicleId);
  const oldVehicleId = trip.vehicleId;

  // Preserve both histories inside the same trip record
  // (previous + replacement + acting user + reason + time + location)
  if (!trip.driverHistory) trip.driverHistory = [];
  trip.driverHistory.push({
    driverId: oldDriverId,
    driverName: oldDriverName,
    newDriverId: newDriver.id,
    newDriverName: newDriver.fullName,
    replacedBy: req.user?.fullName || "إدارة العمليات",
    reason,
    timestamp: new Date().toISOString(),
    latitude,
    longitude,
  });
  if (!trip.vehicleHistory) trip.vehicleHistory = [];
  trip.vehicleHistory.push({
    vehicleId: oldVehicleId,
    plate: oldVehicle?.plate || oldVehicleId,
    newVehicleId: newVehicle.id,
    newPlate: newVehicle.plate,
    replacedBy: req.user?.fullName || "إدارة العمليات",
    reason,
    timestamp: new Date().toISOString(),
    latitude,
    longitude,
  });

  trip.driverId = newDriver.id;
  trip.driverName = newDriver.fullName;
  trip.driverPhone = newDriver.phone;
  trip.vehicleId = newVehicle.id;
  trip.updatedAt = new Date().toISOString();

  db.tripEvents.push({
    id: `ev-${Date.now()}`,
    tripId: trip.id,
    eventType: "DRIVER_AND_VEHICLE_REPLACED",
    fromStatus: trip.status,
    toStatus: trip.status,
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    notes: `تم استبدال المركبة والسائق معًا (السائق: ${oldDriverName} ➔ ${newDriver.fullName} · المركبة: ${oldVehicle?.plate || oldVehicleId} ➔ ${newVehicle.plate}). السبب: ${reason}`,
    latitude,
    longitude,
    metadata: { oldDriverId, newDriverId: newDriver.id, oldVehicleId, newVehicleId: newVehicle.id, reason },
    timestamp: new Date().toISOString(),
  });

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "TRIP_DRIVER_AND_VEHICLE_REPLACED",
    entity: "trips",
    entityId: trip.id,
    tripId: trip.id,
    oldValues: { driverId: oldDriverId, driverName: oldDriverName, vehicleId: oldVehicleId },
    newValues: { driverId: newDriver.id, driverName: newDriver.fullName, vehicleId: newVehicle.id, plate: newVehicle.plate, reason },
    reason,
  });

  dispatchNotification({
    targetRole: "ALL",
    titleAr: `استبدال المركبة والسائق للرحلة ${trip.tripNumber}`,
    titleEn: `Driver & Vehicle Replaced for Trip ${trip.tripNumber}`,
    messageAr: `تم استبدال المركبة والسائق داخل نفس الرحلة دون تغيير رقمها الموحد. السبب: ${reason}`,
    messageEn: `Driver and vehicle replaced inside the same trip; unified number unchanged: ${reason}`,
    type: "WARNING",
    entityType: "trip",
    entityId: trip.id,
    tripId: trip.id,
  });

  return res.json({
    message: "Driver and vehicle replaced inside the same trip — unified number unchanged",
    trip,
    driverHistory: trip.driverHistory,
    vehicleHistory: trip.vehicleHistory,
  });
});

export default router;
