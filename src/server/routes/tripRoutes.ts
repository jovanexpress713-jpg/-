import { Router, type Response } from "express";
import { db, type TripEntity, type TripEventEntity } from "../db";
import { authenticate, optionalAuthenticate, type AuthenticatedRequest } from "../auth/middleware";
import { generateTripNumber } from "../services/tripNumberGenerator";
import { validateTransition, type TripLifecycleStatus, STATUS_LABELS } from "../services/tripLifecycleService";
import { initTripFinancials, getTripFinancials } from "../services/financeService";
import { logAuditEvent } from "../services/auditService";
import { dispatchNotification } from "../services/notificationService";

const router = Router();

// GET /api/trips
router.get("/", optionalAuthenticate, (req: AuthenticatedRequest, res: Response) => {
  const { status, vehicleId, driverId, customerId } = req.query;
  let list = Array.from(db.trips.values());

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

  return res.json({
    total: list.length,
    trips: list,
  });
});

// GET /api/client/trips - Trips specifically belonging to the authenticated client
router.get("/client/trips", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const customerId = req.user?.customerId;
  const userRole = req.user?.role;
  let list = Array.from(db.trips.values());

  // If customer role, strictly scope by customerId
  if (userRole === "CUSTOMER" && customerId) {
    list = list.filter((t) => t.customerId === customerId);
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json({ total: list.length, trips: list });
});

// GET /api/driver/trips - Trips for driver with tab support (all | available | confirmed | active | completed)
router.get("/driver/trips", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const driverId = req.user?.driverId || req.user?.userId;
  const userRole = req.user?.role;
  const tab = (req.query.tab as string) || "all";
  let allTrips = Array.from(db.trips.values());

  let filtered = allTrips;

  if (tab === "available") {
    // Available trips: unassigned or open for driver requests
    filtered = allTrips.filter(
      (t) =>
        t.status === "DRAFT_CREATED" ||
        t.status === "PENDING_APPROVAL" ||
        !t.driverId ||
        t.driverId === "unassigned" ||
        (t.status === "CONFIRMED" && !t.driverId)
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
    // "all": Trips assigned to driver OR available
    if (userRole === "DRIVER") {
      filtered = allTrips.filter(
        (t) =>
          t.driverId === driverId ||
          t.additionalDriverId === driverId ||
          t.status === "DRAFT_CREATED" ||
          t.status === "PENDING_APPROVAL" ||
          !t.driverId
      );
    }
  }

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json({ total: filtered.length, trips: filtered, tab });
});

// POST /api/driver/trips/:id/request - Driver requests an available trip
router.post("/driver/trips/:id/request", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
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

// POST /api/trips/:id/approve-request - Admin approves driver trip request
router.post("/:id/approve-request", authenticate, (req: AuthenticatedRequest, res: Response) => {
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
router.post("/:id/reject-request", authenticate, (req: AuthenticatedRequest, res: Response) => {
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
router.get("/:id", optionalAuthenticate, (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const trip = db.trips.get(tripId) || Array.from(db.trips.values()).find((t) => t.tripNumber === tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  const vehicle = db.vehicles.get(trip.vehicleId);
  const driver = db.drivers.get(trip.driverId);
  const customer = db.customers.get(trip.customerId);
  const events = db.tripEvents.filter((e) => e.tripId === trip.id);
  const financials = getTripFinancials(trip.id);
  const documents = Array.from(db.documents.values()).filter((d) => d.tripId === trip.id);

  return res.json({
    trip,
    vehicle,
    driver,
    customer,
    events,
    financials,
    documents,
    statusMeta: STATUS_LABELS[trip.status as TripLifecycleStatus] || { ar: trip.status, en: trip.status, badgeColor: "#FF7A00" },
  });
});

// POST /api/trips - Create new shipment request
router.post("/", authenticate, (req: AuthenticatedRequest, res: Response) => {
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
    tripPrice,
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
    tripPrice: Number(tripPrice || 4500),
    createdBy: req.user?.userId || "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.trips.set(tripId, newTrip);
  initTripFinancials(tripId, tripNumber, newTrip.tripPrice);

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
    notes: `تم إنشاء الشحنة بنجاح وحجز الرقم المرجعي الموحد ${tripNumber}`,
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
    messageAr: `تم إنشاء طلب نقل جديد رقم ${tripNumber} من ${originCity} إلى ${destinationCity}`,
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
router.post("/:id/transition", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const trip = db.trips.get(String(req.params.id));
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  const { targetStatus, notes, latitude, longitude, reason } = req.body;
  if (!targetStatus) {
    return res.status(400).json({ error: "targetStatus is required" });
  }

  const userRole = req.user?.role || "GUEST";
  const validation = validateTransition(
    trip.status as TripLifecycleStatus,
    targetStatus as TripLifecycleStatus,
    userRole,
    trip,
    reason || notes
  );

  if (!validation.isValid) {
    return res.status(422).json({
      error: validation.error,
      code: "INVALID_TRANSITION",
      currentStatus: trip.status,
      targetStatus,
    });
  }

  const oldStatus = trip.status;
  trip.status = targetStatus;
  trip.updatedAt = new Date().toISOString();

  // If vehicle reached loading or delivery, update coordinates
  if (latitude && longitude) {
    trip.currentLat = latitude;
    trip.currentLng = longitude;
  }

  // Create authoritative event record
  const event: TripEventEntity = {
    id: `ev-${Date.now()}`,
    tripId: trip.id,
    eventType: "STATUS_TRANSITION",
    fromStatus: oldStatus,
    toStatus: targetStatus,
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    notes: notes || reason || `Transitioned from ${oldStatus} to ${targetStatus}`,
    latitude: latitude || trip.currentLat,
    longitude: longitude || trip.currentLng,
    timestamp: new Date().toISOString(),
  };
  db.tripEvents.push(event);

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "TRIP_STATUS_TRANSITION",
    entity: "trips",
    entityId: trip.id,
    tripId: trip.id,
    oldValues: { status: oldStatus },
    newValues: { status: targetStatus, notes },
    reason,
  });

  dispatchNotification({
    targetRole: "ALL",
    titleAr: `تحديث مسار الرحلة ${trip.tripNumber}`,
    titleEn: `Trip Status Update: ${trip.tripNumber}`,
    messageAr: `تم تحديث حالة الرحلة إلى: ${STATUS_LABELS[targetStatus as TripLifecycleStatus]?.ar || targetStatus}`,
    messageEn: `Trip transitioned to: ${STATUS_LABELS[targetStatus as TripLifecycleStatus]?.en || targetStatus}`,
    type: "SUCCESS",
    entityType: "trip",
    entityId: trip.id,
    tripId: trip.id,
  });

  return res.json({
    message: "Transition successful",
    trip,
    event,
  });
});

// POST /api/trips/:id/cancel
router.post("/:id/cancel", authenticate, (req: AuthenticatedRequest, res: Response) => {
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
router.post("/:id/reopen", authenticate, (req: AuthenticatedRequest, res: Response) => {
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
router.get("/:id/events", (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const events = db.tripEvents.filter((e) => e.tripId === tripId);
  return res.json({ events });
});

// GET /api/trips/:id/tracking
router.get("/:id/tracking", optionalAuthenticate, (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.id);
  const trip = db.trips.get(tripId) || Array.from(db.trips.values()).find((t) => t.tripNumber === tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
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
router.post("/:id/assign-driver", authenticate, (req: AuthenticatedRequest, res: Response) => {
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
router.post("/:id/replace-driver", authenticate, (req: AuthenticatedRequest, res: Response) => {
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

  // Preserve history
  if (!trip.driverHistory) trip.driverHistory = [];
  trip.driverHistory.push({
    driverId: trip.driverId,
    driverName: trip.driverName,
    replacedBy: req.user?.fullName || "إدارة العمليات",
    reason,
    timestamp: new Date().toISOString(),
  });

  const oldDriverId = trip.driverId;
  const oldDriverName = trip.driverName;

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
router.post("/:id/assign-vehicle", authenticate, (req: AuthenticatedRequest, res: Response) => {
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
router.post("/:id/replace-vehicle", authenticate, (req: AuthenticatedRequest, res: Response) => {
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

  // Preserve history
  if (!trip.vehicleHistory) trip.vehicleHistory = [];
  const oldVehicle = db.vehicles.get(trip.vehicleId);
  trip.vehicleHistory.push({
    vehicleId: trip.vehicleId,
    plate: oldVehicle?.plate || trip.vehicleId,
    replacedBy: req.user?.fullName || "إدارة العمليات",
    reason,
    timestamp: new Date().toISOString(),
  });

  const oldVehicleId = trip.vehicleId;
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

export default router;
