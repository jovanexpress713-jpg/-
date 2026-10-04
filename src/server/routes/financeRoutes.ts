import { Router, type Response } from "express";
import { db } from "../db";
import { authenticate, requirePermission, type AuthenticatedRequest } from "../auth/middleware";
import {
  getAllFinancials,
  getTripFinancials,
  updateTripFinancials,
  serializeFinancials,
  tripExpenses,
} from "../services/financeService";
import { logAuditEvent } from "../services/auditService";

const router = Router();

/**
 * GET /api/finance/trips
 *
 * Every row carries the derived `expenses` total (driver fee + fuel + tolls +
 * other), so the control-room report, the CSV export and the executive overview
 * all read the same number instead of each inventing its own.
 */
router.get("/trips", authenticate, requirePermission("finance.view"), (_req: AuthenticatedRequest, res: Response) => {
  const list = getAllFinancials().map(serializeFinancials);
  const summary = {
    totalGrossFreight: list.reduce((acc, f) => acc + f.freightPrice, 0),
    totalDriverFees: list.reduce((acc, f) => acc + f.driverFee, 0),
    totalFuelCosts: list.reduce((acc, f) => acc + f.fuelCost, 0),
    totalTollFees: list.reduce((acc, f) => acc + f.tollFees, 0),
    totalOtherExpenses: list.reduce((acc, f) => acc + f.otherExpenses, 0),
    totalExpenses: list.reduce((acc, f) => acc + tripExpenses(f), 0),
    totalNetMargin: list.reduce((acc, f) => acc + f.netRevenue, 0),
    totalVat15: list.reduce((acc, f) => acc + f.taxVat, 0),
    totalPaid: list.reduce((acc, f) => acc + f.paidAmount, 0),
    totalBalanceDue: list.reduce((acc, f) => acc + f.balanceDue, 0),
    unpricedTrips: list.filter((f) => f.freightPrice <= 0).length,
  };

  return res.json({ summary, count: list.length, financials: list, trips: list });
});

// GET /api/finance/trips/:tripId
router.get("/trips/:tripId", authenticate, requirePermission("finance.view"), (req: AuthenticatedRequest, res: Response) => {
  const fin = getTripFinancials(String(req.params.tripId));
  if (!fin) {
    return res.status(404).json({ error: "Financial record not found for this trip" });
  }
  return res.json({ financial: serializeFinancials(fin) });
});

/**
 * POST /api/finance/trips/:tripId/expenses — record a real cost line against a
 * trip (toll, maintenance, detention, …). It lands on the trip's financial
 * record, so the margin, the invoice balance and the reports move together.
 */
router.post(
  "/trips/:tripId/expenses",
  authenticate,
  requirePermission("finance.settle"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const trip = db.trips.get(tripId);
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    const current = getTripFinancials(tripId);
    if (!current) return res.status(404).json({ error: "Financial record not found for this trip" });

    const { category, amount, tollFees, otherExpenses, notes } = req.body || {};
    const delta = Number(amount);
    if (!Number.isFinite(delta) || delta < 0) {
      return res.status(400).json({ error: "A non-negative numeric amount is required", code: "INVALID_AMOUNT" });
    }

    const isToll = String(category || "").toUpperCase() === "TOLL";
    const updated = updateTripFinancials(tripId, {
      tollFees: current.tollFees + (isToll ? delta : Number(tollFees) || 0),
      otherExpenses: current.otherExpenses + (isToll ? 0 : delta || Number(otherExpenses) || 0),
    });

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "TRIP_EXPENSE_RECORDED",
      entity: "finance",
      entityId: tripId,
      tripId,
      newValues: { category: isToll ? "TOLL" : "OTHER", amount: delta, notes },
    });

    return res.json({ message: "Expense recorded against the trip", financial: serializeFinancials(updated!) });
  }
);

// POST /api/finance/settle
router.post("/settle", authenticate, requirePermission("finance.settle"), (req: AuthenticatedRequest, res: Response) => {
  const { tripId, paidAmount, settlementStatus } = req.body;
  if (!tripId) {
    return res.status(400).json({ error: "tripId is required" });
  }

  const trip = db.trips.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  const SETTLEABLE_STATES = ["DELIVERED", "SETTLEMENT_PENDING", "FINANCIAL_REVIEW", "PARTIALLY_PAID", "PAID"];
  if (!SETTLEABLE_STATES.includes(trip.status)) {
    return res.status(422).json({
      error: `Financial settlement is not permitted while the trip is in '${trip.status}'. The shipment must be delivered first.`,
      code: "SETTLEMENT_NOT_ALLOWED",
      currentStatus: trip.status,
    });
  }

  const current = getTripFinancials(tripId);
  if (!current) {
    return res.status(404).json({ error: "Financial record not found for this trip", code: "FINANCIALS_MISSING" });
  }
  if (current.freightPrice <= 0) {
    return res.status(422).json({
      error: "This trip has no authoritative price yet. Apply a tariff first — a settlement can never be recorded against an unpriced shipment.",
      code: "TRIP_UNPRICED",
    });
  }

  const paid = Number(paidAmount || 0);
  if (!Number.isFinite(paid) || paid < 0) {
    return res.status(400).json({ error: "paidAmount must be a non-negative number", code: "INVALID_AMOUNT" });
  }
  const due = current.freightPrice + current.taxVat;
  if (paid > due) {
    return res.status(422).json({
      error: `Payment of ${paid} exceeds the outstanding balance of ${due}.`,
      code: "OVERPAYMENT",
      balanceDue: current.balanceDue,
    });
  }

  /* `paymentStatus` is derived from the money, never asserted by the caller. */
  const derivedPaymentStatus = paid <= 0 ? "UNPAID" : paid >= due ? "PAID" : "PARTIALLY_PAID";

  const updated = updateTripFinancials(tripId, {
    paidAmount: paid,
    settlementStatus: settlementStatus || (derivedPaymentStatus === "PAID" ? "SETTLED" : "SETTLEMENT_PENDING"),
    paymentStatus: derivedPaymentStatus,
    invoiceStatus: derivedPaymentStatus === "PAID" ? "PAID" : "ISSUED",
  });

  logAuditEvent({
    actorId: req.user?.userId,
    actorName: req.user?.fullName,
    actorRole: req.user?.role,
    action: "TRIP_FINANCIAL_SETTLEMENT",
    entity: "finance",
    entityId: tripId,
    tripId,
    oldValues: { paidAmount: current.paidAmount, paymentStatus: current.paymentStatus },
    newValues: { paidAmount: paid, settlementStatus: updated?.settlementStatus, paymentStatus: derivedPaymentStatus },
  });

  return res.json({ message: "Trip financial settlement recorded", financial: serializeFinancials(updated!) });
});

export default router;
