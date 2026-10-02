import { Router, type Response } from "express";
import { db, type PODRecordEntity } from "../db";
import { authenticate, optionalAuthenticate, type AuthenticatedRequest } from "../auth/middleware";
import { logAuditEvent } from "../services/auditService";
import { dispatchNotification } from "../services/notificationService";

const router = Router();

// GET /api/pod/:tripId
router.get("/:tripId", optionalAuthenticate, (req: AuthenticatedRequest, res: Response) => {
  const pod = db.podRecords.get(String(req.params.tripId));
  if (!pod) {
    return res.status(404).json({ error: "POD not found for this trip" });
  }
  return res.json({ pod });
});

// POST /api/pod
router.post("/", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { tripId, recipientName, recipientPhone, recipientNationalId, signatureUrl, photoUrls, latitude, longitude, notes } = req.body;

  if (!tripId || !recipientName) {
    return res.status(400).json({ error: "tripId and recipientName are required for POD" });
  }

  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
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

  db.podRecords.set(tripId, record);

  // Auto transition trip to DELIVERED if not already
  if (trip.status !== "DELIVERED") {
    trip.status = "DELIVERED";
    trip.actualArrival = new Date().toISOString();
    trip.updatedAt = new Date().toISOString();
  }

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
