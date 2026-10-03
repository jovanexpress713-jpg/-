import { Router, type Response } from "express";
import { db, type ClaimEntity } from "../db";
import { authenticate, requirePermission, type AuthenticatedRequest } from "../auth/middleware";
import { logAuditEvent } from "../services/auditService";
import { dispatchNotification } from "../services/notificationService";

const router = Router();

// GET /api/claims
router.get("/", authenticate, requirePermission("claims.view"), (req: AuthenticatedRequest, res: Response) => {
  const { tripId, status } = req.query;
  let list = Array.from(db.claims.values());

  if (tripId && typeof tripId === "string") {
    list = list.filter((c) => c.tripId === tripId);
  }
  if (status && typeof status === "string") {
    list = list.filter((c) => c.status === status);
  }

  // Customers only see claims filed against their own shipments
  if (req.user?.role === "CUSTOMER") {
    const customerId = req.user.customerId;
    list = list.filter((c) => {
      const trip = db.trips.get(c.tripId);
      return !!trip && !!customerId && trip.customerId === customerId;
    });
  }

  return res.json({ total: list.length, claims: list });
});

// POST /api/claims
router.post("/", authenticate, requirePermission("claims.create"), (req: AuthenticatedRequest, res: Response) => {
  const { tripId, claimType, description, estimatedAmount, responsibleParty, evidenceUrls } = req.body;

  if (!tripId || !claimType || !description || !responsibleParty) {
    return res.status(400).json({ error: "Missing required claim parameters" });
  }

  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  if (req.user?.role === "CUSTOMER") {
    const customerId = req.user.customerId;
    if (!customerId || trip.customerId !== customerId) {
      return res.status(403).json({ error: "You can only file claims against your own shipments", code: "CLAIM_ACCESS_DENIED" });
    }
  }

  const claimId = `claim-${Date.now()}`;
  const claimNumber = `CLM-${trip.tripNumber.replace("EJ-", "")}-${Math.floor(100 + Math.random() * 900)}`;

  const newClaim: ClaimEntity = {
    id: claimId,
    tripId,
    claimNumber,
    claimType,
    description,
    estimatedAmount: Number(estimatedAmount || 0),
    currency: "SAR",
    responsibleParty,
    evidenceUrls: evidenceUrls || [],
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };

  db.claims.set(claimId, newClaim);

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "CLAIM_FILED",
    entity: "claims",
    entityId: claimId,
    tripId,
    newValues: { claimNumber, claimType, estimatedAmount },
  });

  dispatchNotification({
    targetRole: "ACCOUNTANT",
    titleAr: `تم تسجيل مطالبة مالية للرحلة ${trip.tripNumber}`,
    titleEn: `Claim Filed for Trip ${trip.tripNumber}`,
    messageAr: `مطالبة بقيمة ${estimatedAmount || 0} ر.س بسبب: ${description}`,
    messageEn: `Claim filed for ${estimatedAmount || 0} SAR: ${description}`,
    type: "ALERT",
    entityType: "claim",
    entityId: claimId,
    tripId,
  });

  return res.status(201).json({ message: "Claim registered successfully", claim: newClaim });
});

export default router;
