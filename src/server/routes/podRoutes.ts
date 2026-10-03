import { Router, type Response } from "express";
import { db, type PODRecordEntity, type TripEventEntity } from "../db";
import { authenticate, requirePermission, canAccessTrip, type AuthenticatedRequest } from "../auth/middleware";
import { logAuditEvent } from "../services/auditService";
import { dispatchNotification } from "../services/notificationService";
import { validateTransition, type TripLifecycleStatus } from "../services/tripLifecycleService";

const router = Router();

// GET /api/pod/:tripId
router.get("/:tripId", authenticate, requirePermission("pod.view", "trips.view"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.tripId);
  const trip = db.trips.get(tripId);
  if (trip && !canAccessTrip(req.user, trip)) {
    return res.status(403).json({ error: "You are not authorized to access this delivery record", code: "TRIP_ACCESS_DENIED" });
  }

  const pod = db.podRecords.get(tripId);
  if (!pod) {
    return res.status(404).json({ error: "POD not found for this trip" });
  }
  return res.json({ pod });
});

// POST /api/pod
router.post("/", authenticate, requirePermission("pod.create"), (req: AuthenticatedRequest, res: Response) => {
  const body = req.body || {};
  const tripId = body.tripId;
  // Accept both the canonical POD contract and common client aliases.
  const recipientName = body.recipientName || body.receiverName;
  const recipientPhone = body.recipientPhone;
  const recipientNationalId = body.recipientNationalId;
  const signatureUrl = body.signatureUrl || body.signatureDataUrl;
  const photoUrls = body.photoUrls || body.photos;
  const { latitude, longitude, notes } = body;

  if (!tripId || !recipientName) {
    return res.status(400).json({ error: "tripId and recipientName are required for POD" });
  }

  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  if (!canAccessTrip(req.user, trip)) {
    return res.status(403).json({ error: "You are not authorized to record delivery for this trip", code: "TRIP_ACCESS_DENIED" });
  }

  if (db.podRecords.has(tripId)) {
    return res.status(409).json({ error: "A proof of delivery is already recorded for this trip", code: "POD_ALREADY_EXISTS" });
  }

  const confirmationCode = `POD-${Math.floor(100000 + Math.random() * 900000)}`;
  const record: PODRecordEntity = {
    id: `pod-${Date.now()}`,
    tripId,
    recipientName,
    recipientPhone: recipientPhone || "",
    recipientNationalId: recipientNationalId || "",
    signatureUrl: signatureUrl || "SIGNED_DIGITALLY",
    photoUrls: photoUrls || [],
    latitude: Number(latitude || trip.currentLat),
    longitude: Number(longitude || trip.currentLng),
    confirmationCode,
    notes: notes || "تم استلام الشحنة بحالة جيدة ومطابقة للشروط",
    receivedAt: new Date().toISOString(),
  };

  // The canonical state machine must authorize moving the trip to DELIVERED.
  // Proof of delivery can only be recorded once the truck has reached the destination.
  if (trip.status !== "DELIVERED") {
    const validation = validateTransition(
      trip.status as TripLifecycleStatus,
      "DELIVERED",
      req.user?.role || "GUEST",
      trip,
      notes
    );

    if (!validation.isValid) {
      return res.status(422).json({
        error: validation.error,
        code: "INVALID_TRANSITION",
        currentStatus: trip.status,
        targetStatus: "DELIVERED",
      });
    }

    const oldStatus = trip.status;
    trip.status = "DELIVERED";
    trip.actualArrival = new Date().toISOString();
    trip.updatedAt = new Date().toISOString();

    const event: TripEventEntity = {
      id: `ev-${Date.now()}`,
      tripId: trip.id,
      eventType: "STATUS_TRANSITION",
      fromStatus: oldStatus,
      toStatus: "DELIVERED",
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      notes: notes || "تم إثبات التسليم وتوقيع المستلم (POD)",
      latitude: Number(latitude || trip.currentLat),
      longitude: Number(longitude || trip.currentLng),
      timestamp: new Date().toISOString(),
    };
    db.tripEvents.push(event);
  }

  db.podRecords.set(tripId, record);

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "POD_RECORD_CREATED",
    entity: "pod_records",
    entityId: record.id,
    tripId,
    newValues: { recipientName, confirmationCode },
  });

  dispatchNotification({
    targetRole: "ALL",
    titleAr: `تم إثبات تسليم الشحنة ${trip.tripNumber}`,
    titleEn: `POD Verified: ${trip.tripNumber}`,
    messageAr: `تم توقيع إثبات التسليم بواسطة ${recipientName} برقم تأكيد ${confirmationCode}`,
    messageEn: `POD confirmed by ${recipientName} with confirmation code ${confirmationCode}`,
    type: "SUCCESS",
    entityType: "trip",
    entityId: tripId,
    tripId,
  });

  return res.status(201).json({ message: "Proof of Delivery recorded", pod: record });
});

export default router;
