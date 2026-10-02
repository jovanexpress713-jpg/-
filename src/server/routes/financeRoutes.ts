import { Router, type Response } from "express";
import { db } from "../db";
import { authenticate, optionalAuthenticate, type AuthenticatedRequest } from "../auth/middleware";
import { getAllFinancials, getTripFinancials, updateTripFinancials } from "../services/financeService";
import { logAuditEvent } from "../services/auditService";

const router = Router();

// GET /api/finance/trips
router.get("/trips", optionalAuthenticate, (_req: AuthenticatedRequest, res: Response) => {
  const list = getAllFinancials();
  const summary = {
    totalGrossFreight: list.reduce((acc, f) => acc + f.freightPrice, 0),
    totalDriverFees: list.reduce((acc, f) => acc + f.driverFee, 0),
    totalFuelCosts: list.reduce((acc, f) => acc + f.fuelCost, 0),
    totalNetMargin: list.reduce((acc, f) => acc + f.netRevenue, 0),
    totalVat15: list.reduce((acc, f) => acc + f.taxVat, 0),
  };

  return res.json({ summary, count: list.length, financials: list });
});

// GET /api/finance/trips/:tripId
router.get("/trips/:tripId", (req: AuthenticatedRequest, res: Response) => {
  const fin = getTripFinancials(String(req.params.tripId));
  if (!fin) {
    return res.status(404).json({ error: "Financial record not found for this trip" });
  }
  return res.json({ financial: fin });
});

// POST /api/finance/settle
router.post("/settle", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { tripId, paidAmount, settlementStatus, paymentStatus } = req.body;
  if (!tripId) {
    return res.status(400).json({ error: "tripId is required" });
  }

  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  const updated = updateTripFinancials(tripId, {
    paidAmount: Number(paidAmount || 0),
    settlementStatus: settlementStatus || "SETTLED",
    paymentStatus: paymentStatus || "PAID",
    invoiceStatus: "PAID",
  });

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "TRIP_FINANCIAL_SETTLEMENT",
    entity: "finance",
    entityId: tripId,
    tripId,
    newValues: { paidAmount, settlementStatus, paymentStatus },
  });

  return res.json({ message: "Trip financial settlement recorded", financial: updated });
});

export default router;
