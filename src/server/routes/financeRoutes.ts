import { Router, type Response } from "express";
import { db } from "../db";
import {
  authenticate,
  requirePermission,
  canAccessTrip,
  hasPermission,
  type AuthenticatedRequest,
} from "../auth/middleware";
import {
  getAllFinancials,
  getTripFinancials,
  updateTripFinancials,
  recordTripPayment,
  cancelTripPayment,
  serializeFinancials,
  tripExpenses,
} from "../services/financeService";
import { logAuditEvent } from "../services/auditService";

const router = Router();

function enrichWithTrip(fin: ReturnType<typeof serializeFinancials>) {
  const trip = db.trips.get(fin.tripId);
  const vehicle = trip?.vehicleId ? db.vehicles.get(trip.vehicleId) : undefined;
  return {
    ...fin,
    revenue: fin.freightPrice,
    driverCommission: fin.driverFee,
    netProfit: fin.netRevenue,
    settlementApprovalStatus: fin.settlementWorkflowStatus,
    customerId: trip?.customerId || "",
    customerName: trip?.customerName || "—",
    driverId: trip?.driverId || "",
    driverName: trip?.driverName || "—",
    vehicleId: trip?.vehicleId || "",
    vehiclePlate: vehicle?.plate || trip?.vehicleId || "—",
    originCity: trip?.originCity || "—",
    destinationCity: trip?.destinationCity || "—",
    tripStatus: trip?.status || "UNKNOWN",
  };
}

function scopedFinancialsFor(req: AuthenticatedRequest) {
  return getAllFinancials()
    .filter((f) => {
      const trip = db.trips.get(f.tripId);
      if (!trip) return req.user?.role === "SUPER_ADMIN" || req.user?.role === "ACCOUNTANT" || req.user?.role === "GENERAL_MANAGER";
      return canAccessTrip(req.user, trip);
    })
    .map(serializeFinancials)
    .map(enrichWithTrip);
}

/**
 * GET /api/finance/trips
 */
router.get(
  "/trips",
  authenticate,
  requirePermission("finance.view"),
  (req: AuthenticatedRequest, res: Response) => {
    const list = scopedFinancialsFor(req);
    const summary = {
      totalGrossFreight: list.reduce((acc, f) => acc + f.freightPrice, 0),
      totalRevenue: list.reduce((acc, f) => acc + f.freightPrice, 0),
      totalDriverFees: list.reduce((acc, f) => acc + f.driverFee, 0),
      totalDriverCommissions: list.reduce((acc, f) => acc + f.driverFee, 0),
      totalOtherCommissions: list.reduce((acc, f) => acc + (f.otherCommissions || 0), 0),
      totalFuelCosts: list.reduce((acc, f) => acc + f.fuelCost, 0),
      totalTollFees: list.reduce((acc, f) => acc + f.tollFees, 0),
      totalOtherExpenses: list.reduce((acc, f) => acc + f.otherExpenses, 0),
      totalExpenses: list.reduce((acc, f) => acc + tripExpenses(f), 0),
      totalNetMargin: list.reduce((acc, f) => acc + f.netRevenue, 0),
      totalNetProfit: list.reduce((acc, f) => acc + f.netRevenue, 0),
      totalVat15: list.reduce((acc, f) => acc + f.taxVat, 0),
      totalPaid: list.reduce((acc, f) => acc + f.paidAmount, 0),
      totalBalanceDue: list.reduce((acc, f) => acc + f.balanceDue, 0),
      unpricedTrips: list.filter((f) => f.freightPrice <= 0).length,
      approvedSettlements: list.filter(
        (f) => f.settlementWorkflowStatus === "APPROVED" || f.settlementWorkflowStatus === "PAID"
      ).length,
      pendingReviews: list.filter(
        (f) => f.reviewStatus === "PENDING_REVIEW" || f.reviewStatus === "IN_REVIEW"
      ).length,
    };

    return res.json({ summary, count: list.length, financials: list, trips: list, records: list });
  }
);

// GET /api/finance/trips/:tripId
router.get(
  "/trips/:tripId",
  authenticate,
  requirePermission("finance.view"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const fin = getTripFinancials(tripId);
    if (!fin) {
      return res.status(404).json({ error: "Financial record not found for this trip" });
    }
    const trip = db.trips.get(tripId);
    if (trip && !canAccessTrip(req.user, trip)) {
      return res.status(403).json({ error: "Access denied outside your data scope", code: "OUT_OF_DATA_SCOPE" });
    }
    return res.json({ financial: enrichWithTrip(serializeFinancials(fin)) });
  }
);

/**
 * POST /api/finance/trips/:tripId/expenses — record a real cost line against a trip
 */
router.post(
  "/trips/:tripId/expenses",
  authenticate,
  requirePermission("finance.settle", "expenses.edit"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const trip = db.trips.get(tripId);
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    const current = getTripFinancials(tripId);
    if (!current) return res.status(404).json({ error: "Financial record not found for this trip" });

    // §16 & §19: Prevent modifying expenses on an approved settlement without post-approval / reopen rights
    const isLocked =
      current.settlementWorkflowStatus === "APPROVED" || current.settlementWorkflowStatus === "PAID";
    if (
      isLocked &&
      !hasPermission(req.user?.role, "finance.postapprove", undefined, req.user?.userId) &&
      !hasPermission(req.user?.role, "settlements.reopen", undefined, req.user?.userId)
    ) {
      return res.status(409).json({
        error: "Settlement is already approved. Reopen the settlement (REOPEN_SETTLEMENT) before modifying expenses.",
        code: "SETTLEMENT_LOCKED",
      });
    }

    const { category, amount, tollFees, otherExpenses, notes } = req.body || {};
    const delta = Number(amount);
    if (!Number.isFinite(delta) || delta < 0) {
      return res.status(400).json({ error: "A non-negative numeric amount is required", code: "INVALID_AMOUNT" });
    }

    const isToll = String(category || "").toUpperCase() === "TOLL";
    const updated = updateTripFinancials(
      tripId,
      {
        tollFees: current.tollFees + (isToll ? delta : Number(tollFees) || 0),
        otherExpenses: current.otherExpenses + (isToll ? 0 : delta || Number(otherExpenses) || 0),
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
        action: "TRIP_EXPENSE_RECORDED",
        reason: notes,
      }
    );

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "TRIP_EXPENSE_RECORDED",
      entity: "finance",
      entityId: tripId,
      tripId,
      oldValues: { tollFees: current.tollFees, otherExpenses: current.otherExpenses },
      newValues: { category: isToll ? "TOLL" : "OTHER", amount: delta, notes },
      reason: notes,
    });

    return res.json({ message: "Expense recorded against the trip", financial: enrichWithTrip(serializeFinancials(updated!)) });
  }
);

// POST /api/finance/settle
router.post(
  "/settle",
  authenticate,
  requirePermission("finance.settle", "settlements.create", "settlements.approve"),
  (req: AuthenticatedRequest, res: Response) => {
    const { tripId, paidAmount, settlementStatus, notes } = req.body || {};
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
        error:
          "This trip has no authoritative price yet. Apply a tariff first — a settlement can never be recorded against an unpriced shipment.",
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

    const derivedPaymentStatus = paid <= 0 ? "UNPAID" : paid >= due ? "PAID" : "PARTIALLY_PAID";
    const derivedWorkflowStatus =
      derivedPaymentStatus === "PAID"
        ? "PAID"
        : derivedPaymentStatus === "PARTIALLY_PAID"
          ? "PARTIALLY_PAID"
          : "PENDING_REVIEW";

    const updated = updateTripFinancials(
      tripId,
      {
        paidAmount: paid,
        settlementStatus: settlementStatus || (derivedPaymentStatus === "PAID" ? "SETTLED" : "SETTLEMENT_PENDING"),
        settlementWorkflowStatus: derivedWorkflowStatus,
        paymentStatus: derivedPaymentStatus,
        invoiceStatus: derivedPaymentStatus === "PAID" ? "PAID" : "ISSUED",
        settlementNotes: notes ?? current.settlementNotes,
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
        action: "TRIP_FINANCIAL_SETTLEMENT",
        reason: notes,
      }
    );

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "TRIP_FINANCIAL_SETTLEMENT",
      entity: "finance",
      entityId: tripId,
      tripId,
      oldValues: { paidAmount: current.paidAmount, paymentStatus: current.paymentStatus },
      newValues: {
        paidAmount: paid,
        settlementStatus: updated?.settlementStatus,
        settlementWorkflowStatus: updated?.settlementWorkflowStatus,
        paymentStatus: derivedPaymentStatus,
      },
      reason: notes,
    });

    return res.json({
      message: "Trip financial settlement recorded",
      financial: enrichWithTrip(serializeFinancials(updated!)),
    });
  }
);

/* ============================================================================
 * §16 — FINANCIAL SETTLEMENTS ENDPOINTS
 * ========================================================================== */

router.get(
  "/settlements",
  authenticate,
  requirePermission("settlements.view", "finance.view"),
  (req: AuthenticatedRequest, res: Response) => {
    const settlements = scopedFinancialsFor(req);
    return res.json({ count: settlements.length, settlements });
  }
);

router.get(
  "/settlements/:tripId",
  authenticate,
  requirePermission("settlements.view", "finance.view"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const fin = getTripFinancials(tripId);
    if (!fin) return res.status(404).json({ error: "Settlement not found" });
    const trip = db.trips.get(tripId);
    if (trip && !canAccessTrip(req.user, trip)) {
      return res.status(403).json({ error: "Access denied outside your data scope", code: "OUT_OF_DATA_SCOPE" });
    }
    return res.json({ settlement: enrichWithTrip(serializeFinancials(fin)) });
  }
);

/**
 * POST /api/finance/settlements — Create or update a trip settlement (§16)
 * Enforces immutability after approval unless reopened or holding finance.postapprove.
 */
router.post(
  "/settlements",
  authenticate,
  requirePermission("settlements.create", "settlements.edit", "finance.settle"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.body?.tripId || "");
    if (!tripId) return res.status(400).json({ error: "tripId is required" });
    const current = getTripFinancials(tripId);
    if (!current) return res.status(404).json({ error: "Settlement record not found" });

    const isApproved =
      current.settlementWorkflowStatus === "APPROVED" || current.settlementWorkflowStatus === "PAID";
    const canEditAfterApproval = hasPermission(
      req.user?.role,
      "finance.postapprove",
      undefined,
      req.user?.userId
    );
    if (isApproved && !canEditAfterApproval) {
      return res.status(409).json({
        error:
          "Cannot modify an approved settlement without reopening it first (REOPEN_SETTLEMENT) or holding post-approval edit permission.",
        code: "SETTLEMENT_LOCKED",
      });
    }

    const { paidAmount, notes, settlementNotes, reason } = req.body || {};
    const nextPaid = paidAmount !== undefined ? Number(paidAmount) : current.paidAmount;
    const updated = updateTripFinancials(
      tripId,
      {
        paidAmount: nextPaid,
        settlementStatus: nextPaid >= current.freightPrice && current.freightPrice > 0 ? "SETTLED" : "SETTLEMENT_PENDING",
        settlementNotes: (notes ?? settlementNotes ?? current.settlementNotes) || "",
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
        action: "SETTLEMENT_MODIFIED",
        reason: reason || notes || settlementNotes,
      }
    );

    return res.json({
      message: "Settlement updated",
      settlement: enrichWithTrip(serializeFinancials(updated!)),
    });
  }
);

/**
 * PUT /api/finance/settlements/:tripId — Edit settlement figures / notes (§16, §19)
 * Enforces immutability after approval unless reopened, and checks granular permissions
 * (`revenue.edit`, `expenses.edit`, `commissions.edit`).
 */
router.put(
  "/settlements/:tripId",
  authenticate,
  requirePermission("settlements.edit", "finance.settle", "revenue.edit", "expenses.edit", "commissions.edit"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const current = getTripFinancials(tripId);
    if (!current) return res.status(404).json({ error: "Settlement record not found" });

    const isApproved =
      current.settlementWorkflowStatus === "APPROVED" || current.settlementWorkflowStatus === "PAID";
    const canEditAfterApproval = hasPermission(
      req.user?.role,
      "finance.postapprove",
      undefined,
      req.user?.userId
    );
    if (isApproved && !canEditAfterApproval) {
      return res.status(409).json({
        error:
          "Cannot modify an approved settlement without reopening it first (REOPEN_SETTLEMENT) or holding post-approval edit permission.",
        code: "SETTLEMENT_LOCKED",
      });
    }

    const { freightPrice, driverFee, otherCommissions, fuelCost, tollFees, otherExpenses, settlementNotes, reason } =
      req.body || {};

    // §19 — Granular sensitive permission checks
    if (freightPrice !== undefined && Number(freightPrice) !== current.freightPrice) {
      if (!hasPermission(req.user?.role, "revenue.edit", undefined, req.user?.userId)) {
        return res.status(403).json({
          error: "Missing sensitive permission: revenue.edit (EDIT_REVENUE)",
          code: "INSUFFICIENT_PERMISSIONS",
        });
      }
    }

    if (
      (fuelCost !== undefined && Number(fuelCost) !== current.fuelCost) ||
      (tollFees !== undefined && Number(tollFees) !== current.tollFees) ||
      (otherExpenses !== undefined && Number(otherExpenses) !== current.otherExpenses)
    ) {
      if (!hasPermission(req.user?.role, "expenses.edit", undefined, req.user?.userId)) {
        return res.status(403).json({
          error: "Missing sensitive permission: expenses.edit (EDIT_EXPENSES)",
          code: "INSUFFICIENT_PERMISSIONS",
        });
      }
    }

    if (
      (driverFee !== undefined && Number(driverFee) !== current.driverFee) ||
      (otherCommissions !== undefined && Number(otherCommissions) !== current.otherCommissions)
    ) {
      if (!hasPermission(req.user?.role, "commissions.edit", undefined, req.user?.userId)) {
        return res.status(403).json({
          error: "Missing sensitive permission: commissions.edit (EDIT_COMMISSION)",
          code: "INSUFFICIENT_PERMISSIONS",
        });
      }
    }

    const nextFreight = freightPrice !== undefined ? Number(freightPrice) : current.freightPrice;
    const nextVat = freightPrice !== undefined ? Math.round(nextFreight * 0.15) : current.taxVat;

    const updated = updateTripFinancials(
      tripId,
      {
        freightPrice: nextFreight,
        taxVat: nextVat,
        driverFee: driverFee !== undefined ? Number(driverFee) : current.driverFee,
        otherCommissions: otherCommissions !== undefined ? Number(otherCommissions) : current.otherCommissions,
        fuelCost: fuelCost !== undefined ? Number(fuelCost) : current.fuelCost,
        tollFees: tollFees !== undefined ? Number(tollFees) : current.tollFees,
        otherExpenses: otherExpenses !== undefined ? Number(otherExpenses) : current.otherExpenses,
        settlementNotes: settlementNotes !== undefined ? String(settlementNotes) : current.settlementNotes,
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
        action: "SETTLEMENT_MODIFIED",
        reason: reason || settlementNotes,
      }
    );

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "SETTLEMENT_MODIFIED",
      entity: "finance",
      entityId: tripId,
      tripId,
      oldValues: {
        freightPrice: current.freightPrice,
        driverFee: current.driverFee,
        otherCommissions: current.otherCommissions,
        fuelCost: current.fuelCost,
        tollFees: current.tollFees,
        otherExpenses: current.otherExpenses,
      },
      newValues: {
        freightPrice: updated?.freightPrice,
        driverFee: updated?.driverFee,
        otherCommissions: updated?.otherCommissions,
        fuelCost: updated?.fuelCost,
        tollFees: updated?.tollFees,
        otherExpenses: updated?.otherExpenses,
      },
      reason: reason || settlementNotes,
    });

    return res.json({
      message: "Settlement updated",
      settlement: enrichWithTrip(serializeFinancials(updated!)),
    });
  }
);

/** POST /api/finance/settlements/:tripId/submit — Move settlement to PENDING_REVIEW */
router.post(
  "/settlements/:tripId/submit",
  authenticate,
  requirePermission("settlements.create", "settlements.edit", "finance.settle"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const current = getTripFinancials(tripId);
    if (!current) return res.status(404).json({ error: "Settlement not found" });

    const updated = updateTripFinancials(
      tripId,
      {
        settlementWorkflowStatus: "PENDING_REVIEW",
        settlementStatus: "SETTLEMENT_PENDING",
        settlementCreatedBy: req.user?.userId,
        settlementCreatedByName: req.user?.fullName,
        settlementDate: new Date().toISOString(),
        settlementNotes: req.body?.notes ?? current.settlementNotes,
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
        action: "SETTLEMENT_SUBMITTED_FOR_REVIEW",
        reason: req.body?.notes,
      }
    );

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "SETTLEMENT_SUBMITTED_FOR_REVIEW",
      entity: "finance",
      entityId: tripId,
      tripId,
      oldValues: { status: current.settlementWorkflowStatus },
      newValues: { status: "PENDING_REVIEW" },
      reason: req.body?.notes,
    });

    return res.json({
      message: "Settlement submitted for review",
      settlement: enrichWithTrip(serializeFinancials(updated!)),
    });
  }
);

/** POST /api/finance/settlements/:tripId/approve — Approve settlement (§16, §19) */
router.post(
  "/settlements/:tripId/approve",
  authenticate,
  requirePermission("settlements.approve", "finance.approve"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const current = getTripFinancials(tripId);
    if (!current) return res.status(404).json({ error: "Settlement not found" });
    if (current.freightPrice <= 0) {
      return res.status(422).json({ error: "Cannot approve an unpriced settlement", code: "TRIP_UNPRICED" });
    }

    const now = new Date().toISOString();
    const nextWorkflow =
      current.paymentStatus === "PAID"
        ? "PAID"
        : current.paymentStatus === "PARTIALLY_PAID"
          ? "PARTIALLY_PAID"
          : "APPROVED";

    const updated = updateTripFinancials(
      tripId,
      {
        settlementWorkflowStatus: nextWorkflow,
        settlementStatus: "SETTLED",
        settlementApprovedBy: req.user?.userId,
        settlementApprovedByName: req.user?.fullName,
        settlementApprovedAt: now,
        settlementNotes: req.body?.notes ?? current.settlementNotes,
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
        action: "SETTLEMENT_APPROVED",
        reason: req.body?.notes,
      }
    );

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "SETTLEMENT_APPROVED",
      entity: "finance",
      entityId: tripId,
      tripId,
      oldValues: { status: current.settlementWorkflowStatus },
      newValues: { status: nextWorkflow, approvedBy: req.user?.fullName, approvedAt: now },
      reason: req.body?.notes,
    });

    return res.json({
      message: "Settlement approved",
      settlement: enrichWithTrip(serializeFinancials(updated!)),
    });
  }
);

/** POST /api/finance/settlements/:tripId/reject — Reject settlement (§16) */
router.post(
  "/settlements/:tripId/reject",
  authenticate,
  requirePermission("settlements.reject", "settlements.approve"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const current = getTripFinancials(tripId);
    if (!current) return res.status(404).json({ error: "Settlement not found" });

    const reason = String(req.body?.reason || req.body?.notes || "Rejected during review");
    const updated = updateTripFinancials(
      tripId,
      {
        settlementWorkflowStatus: "REJECTED",
        settlementStatus: "UNSETTLED",
        settlementNotes: reason,
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
        action: "SETTLEMENT_REJECTED",
        reason,
      }
    );

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "SETTLEMENT_REJECTED",
      entity: "finance",
      entityId: tripId,
      tripId,
      oldValues: { status: current.settlementWorkflowStatus },
      newValues: { status: "REJECTED" },
      reason,
    });

    return res.json({
      message: "Settlement rejected",
      settlement: enrichWithTrip(serializeFinancials(updated!)),
    });
  }
);

/**
 * POST /api/finance/settlements/:tripId/reopen — Reopen an approved settlement (§16, §19)
 * Strictly requires `settlements.reopen` (`REOPEN_SETTLEMENT`) and logs to Audit Log.
 */
router.post(
  "/settlements/:tripId/reopen",
  authenticate,
  requirePermission("settlements.reopen"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const current = getTripFinancials(tripId);
    if (!current) return res.status(404).json({ error: "Settlement not found" });

    const reason = String(req.body?.reason || "").trim();
    if (!reason) {
      return res.status(400).json({
        error: "A formal reason is required to reopen an approved settlement",
        code: "REASON_REQUIRED",
      });
    }

    const now = new Date().toISOString();
    const updated = updateTripFinancials(
      tripId,
      {
        settlementWorkflowStatus: "REOPENED",
        settlementStatus: "SETTLEMENT_PENDING",
        settlementReopenedBy: req.user?.userId,
        settlementReopenedByName: req.user?.fullName,
        settlementReopenedAt: now,
        settlementReopenReason: reason,
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
        action: "SETTLEMENT_REOPENED",
        reason,
      }
    );

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "SETTLEMENT_REOPENED",
      entity: "finance",
      entityId: tripId,
      tripId,
      oldValues: { status: current.settlementWorkflowStatus },
      newValues: { status: "REOPENED", reopenedBy: req.user?.fullName, reopenedAt: now },
      reason,
    });

    return res.json({
      message: "Settlement reopened for modification",
      settlement: enrichWithTrip(serializeFinancials(updated!)),
    });
  }
);

/* ============================================================================
 * §17 — INVOICES ENDPOINTS
 * ========================================================================== */

router.get(
  "/invoices",
  authenticate,
  requirePermission("invoices.view", "finance.view"),
  (req: AuthenticatedRequest, res: Response) => {
    const invoices = scopedFinancialsFor(req).filter((f) => f.invoiceNumber || f.freightPrice > 0);
    return res.json({ count: invoices.length, invoices });
  }
);

router.post(
  "/invoices",
  authenticate,
  requirePermission("invoices.create", "finance.create"),
  (req: AuthenticatedRequest, res: Response) => {
    const { tripId, notes } = req.body || {};
    if (!tripId) return res.status(400).json({ error: "tripId is required" });
    const current = getTripFinancials(String(tripId));
    if (!current) return res.status(404).json({ error: "Trip financial record not found" });
    if (current.freightPrice <= 0) {
      return res.status(422).json({ error: "Cannot generate invoice for an unpriced trip", code: "TRIP_UNPRICED" });
    }

    const invoiceNumber = current.invoiceNumber || `INV-${current.tripNumber.replace("EJ-", "")}`;
    const updated = updateTripFinancials(
      String(tripId),
      {
        invoiceNumber,
        invoiceStatus: current.invoiceStatus === "CANCELLED" ? "DRAFT" : current.invoiceStatus || "DRAFT",
        invoiceNotes: notes ?? current.invoiceNotes,
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
        action: "INVOICE_CREATED",
        reason: notes,
      }
    );

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "INVOICE_CREATED",
      entity: "finance",
      entityId: String(tripId),
      tripId: String(tripId),
      newValues: { invoiceNumber, invoiceStatus: updated?.invoiceStatus },
      reason: notes,
    });

    return res.status(201).json({
      message: "Invoice created",
      invoice: enrichWithTrip(serializeFinancials(updated!)),
    });
  }
);

router.put(
  "/invoices/:tripId",
  authenticate,
  requirePermission("invoices.edit"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const current = getTripFinancials(tripId);
    if (!current) return res.status(404).json({ error: "Invoice not found" });

    const lockedStatuses = ["APPROVED", "ISSUED", "PARTIALLY_PAID", "PAID"];
    if (
      lockedStatuses.includes(current.invoiceStatus) &&
      !hasPermission(req.user?.role, "finance.postapprove", undefined, req.user?.userId)
    ) {
      return res.status(409).json({
        error: "Invoice cannot be edited after approval/issuance without post-approval permission",
        code: "INVOICE_LOCKED",
      });
    }

    const { freightPrice, invoiceNotes, invoiceStatus } = req.body || {};
    if (freightPrice !== undefined && Number(freightPrice) !== current.freightPrice) {
      if (!hasPermission(req.user?.role, "revenue.edit", undefined, req.user?.userId)) {
        return res.status(403).json({
          error: "Editing invoice freight amount requires revenue.edit permission",
          code: "INSUFFICIENT_PERMISSIONS",
        });
      }
    }

    const nextPrice = freightPrice !== undefined ? Number(freightPrice) : current.freightPrice;
    const updated = updateTripFinancials(
      tripId,
      {
        freightPrice: nextPrice,
        taxVat: Math.round(nextPrice * 0.15),
        invoiceNotes: invoiceNotes !== undefined ? String(invoiceNotes) : current.invoiceNotes,
        invoiceStatus: invoiceStatus || current.invoiceStatus,
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
        action: "INVOICE_UPDATED",
        reason: invoiceNotes,
      }
    );

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "INVOICE_UPDATED",
      entity: "finance",
      entityId: tripId,
      tripId,
      oldValues: { freightPrice: current.freightPrice, invoiceStatus: current.invoiceStatus },
      newValues: { freightPrice: updated?.freightPrice, invoiceStatus: updated?.invoiceStatus },
      reason: invoiceNotes,
    });

    return res.json({ message: "Invoice updated", invoice: enrichWithTrip(serializeFinancials(updated!)) });
  }
);

router.post(
  "/invoices/:tripId/approve",
  authenticate,
  requirePermission("invoices.approve", "finance.approve"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const current = getTripFinancials(tripId);
    if (!current) return res.status(404).json({ error: "Invoice not found" });

    const now = new Date().toISOString();
    const updated = updateTripFinancials(
      tripId,
      {
        invoiceStatus: "APPROVED",
        invoiceApprovedBy: req.user?.userId,
        invoiceApprovedByName: req.user?.fullName,
        invoiceApprovedAt: now,
        invoiceNotes: req.body?.notes ?? current.invoiceNotes,
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
        action: "INVOICE_APPROVED",
        reason: req.body?.notes,
      }
    );

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "INVOICE_APPROVED",
      entity: "finance",
      entityId: tripId,
      tripId,
      oldValues: { invoiceStatus: current.invoiceStatus },
      newValues: { invoiceStatus: "APPROVED", approvedBy: req.user?.fullName },
      reason: req.body?.notes,
    });

    return res.json({ message: "Invoice approved", invoice: enrichWithTrip(serializeFinancials(updated!)) });
  }
);

router.post(
  "/invoices/:tripId/issue",
  authenticate,
  requirePermission("invoices.issue", "invoices.approve", "finance.create"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const current = getTripFinancials(tripId);
    if (!current) return res.status(404).json({ error: "Invoice not found" });

    const now = new Date().toISOString();
    const updated = updateTripFinancials(
      tripId,
      {
        invoiceStatus: current.paidAmount > 0 ? "PARTIALLY_PAID" : "ISSUED",
        invoiceIssuedAt: now,
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
        action: "INVOICE_ISSUED",
      }
    );

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "INVOICE_ISSUED",
      entity: "finance",
      entityId: tripId,
      tripId,
      oldValues: { invoiceStatus: current.invoiceStatus },
      newValues: { invoiceStatus: updated?.invoiceStatus, issuedAt: now },
    });

    return res.json({ message: "Invoice issued", invoice: enrichWithTrip(serializeFinancials(updated!)) });
  }
);

router.post(
  "/invoices/:tripId/cancel",
  authenticate,
  requirePermission("invoices.cancel", "finance.delete"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const current = getTripFinancials(tripId);
    if (!current) return res.status(404).json({ error: "Invoice not found" });

    const reason = String(req.body?.reason || "Cancelled by authorized user");
    const updated = updateTripFinancials(
      tripId,
      {
        invoiceStatus: "CANCELLED",
        invoiceNotes: reason,
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
        action: "INVOICE_CANCELLED",
        reason,
      }
    );

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "INVOICE_CANCELLED",
      entity: "finance",
      entityId: tripId,
      tripId,
      oldValues: { invoiceStatus: current.invoiceStatus },
      newValues: { invoiceStatus: "CANCELLED" },
      reason,
    });

    return res.json({ message: "Invoice cancelled", invoice: enrichWithTrip(serializeFinancials(updated!)) });
  }
);

/* ============================================================================
 * §15 & §19 — PAYMENTS ENDPOINTS
 * ========================================================================== */

router.get(
  "/payments",
  authenticate,
  requirePermission("payments.view", "finance.view"),
  (req: AuthenticatedRequest, res: Response) => {
    const list = scopedFinancialsFor(req);
    const payments = list.flatMap((f) =>
      (f.payments || []).map((p) => ({
        ...p,
        customerName: f.customerName,
        driverName: f.driverName,
        balanceDue: f.balanceDue,
      }))
    );
    return res.json({ count: payments.length, payments, receivables: list.filter((f) => f.balanceDue > 0) });
  }
);

router.post(
  "/payments",
  authenticate,
  requirePermission("payments.record", "finance.pay"),
  (req: AuthenticatedRequest, res: Response) => {
    const { tripId, amount, method, reference, notes } = req.body || {};
    if (!tripId) return res.status(400).json({ error: "tripId is required" });

    const result = recordTripPayment(
      String(tripId),
      { amount: Number(amount), method, reference, notes },
      { userId: req.user?.userId, fullName: req.user?.fullName, role: req.user?.role }
    );

    if (!result.ok) {
      const status = result.code === "FINANCIALS_MISSING" ? 404 : result.code === "INVALID_AMOUNT" ? 400 : 422;
      return res.status(status).json({ error: result.error, code: result.code });
    }

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "PAYMENT_RECORDED",
      entity: "finance",
      entityId: String(tripId),
      tripId: String(tripId),
      newValues: { payment: result.payment, paidAmount: result.financial?.paidAmount },
      reason: notes,
    });

    return res.status(201).json({
      message: "Payment recorded",
      payment: result.payment,
      financial: enrichWithTrip(serializeFinancials(result.financial!)),
    });
  }
);

router.post(
  "/payments/:tripId/:paymentId/cancel",
  authenticate,
  requirePermission("payments.cancel"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const paymentId = String(req.params.paymentId);
    const reason = String(req.body?.reason || "Payment cancelled");

    const result = cancelTripPayment(
      tripId,
      paymentId,
      { userId: req.user?.userId, fullName: req.user?.fullName, role: req.user?.role },
      reason
    );

    if (!result.ok) {
      return res.status(400).json({ error: result.error, code: result.code });
    }

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "PAYMENT_CANCELLED",
      entity: "finance",
      entityId: tripId,
      tripId,
      newValues: { paymentId, paidAmount: result.financial?.paidAmount },
      reason,
    });

    return res.json({
      message: "Payment cancelled",
      financial: enrichWithTrip(serializeFinancials(result.financial!)),
    });
  }
);

/* ============================================================================
 * §18 — FINANCIAL REVIEW ENDPOINTS
 * ========================================================================== */

router.get(
  "/reviews",
  authenticate,
  requirePermission("review.view", "finance.view"),
  (req: AuthenticatedRequest, res: Response) => {
    const reviews = scopedFinancialsFor(req);
    return res.json({ count: reviews.length, reviews });
  }
);

router.post(
  "/reviews/:tripId/perform",
  authenticate,
  requirePermission("review.perform"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const current = getTripFinancials(tripId);
    if (!current) return res.status(404).json({ error: "Financial record not found" });

    const now = new Date().toISOString();
    const updated = updateTripFinancials(
      tripId,
      {
        reviewStatus: "IN_REVIEW",
        reviewedBy: req.user?.userId,
        reviewedByName: req.user?.fullName,
        reviewedAt: now,
        reviewNotes: req.body?.notes ?? current.reviewNotes,
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
        action: "FINANCIAL_REVIEW_PERFORMED",
        reason: req.body?.notes,
      }
    );

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "FINANCIAL_REVIEW_PERFORMED",
      entity: "finance",
      entityId: tripId,
      tripId,
      oldValues: { reviewStatus: current.reviewStatus },
      newValues: { reviewStatus: "IN_REVIEW", reviewedBy: req.user?.fullName },
      reason: req.body?.notes,
    });

    return res.json({ message: "Financial review recorded", review: enrichWithTrip(serializeFinancials(updated!)) });
  }
);

router.post(
  "/reviews/:tripId/approve",
  authenticate,
  requirePermission("review.approve"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const current = getTripFinancials(tripId);
    if (!current) return res.status(404).json({ error: "Financial record not found" });

    const now = new Date().toISOString();
    const updated = updateTripFinancials(
      tripId,
      {
        reviewStatus: "APPROVED",
        reviewApprovedBy: req.user?.userId,
        reviewApprovedByName: req.user?.fullName,
        reviewApprovedAt: now,
        reviewNotes: req.body?.notes ?? current.reviewNotes,
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
        action: "FINANCIAL_REVIEW_APPROVED",
        reason: req.body?.notes,
      }
    );

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "FINANCIAL_REVIEW_APPROVED",
      entity: "finance",
      entityId: tripId,
      tripId,
      oldValues: { reviewStatus: current.reviewStatus },
      newValues: { reviewStatus: "APPROVED", approvedBy: req.user?.fullName },
      reason: req.body?.notes,
    });

    return res.json({ message: "Financial review approved", review: enrichWithTrip(serializeFinancials(updated!)) });
  }
);

router.post(
  "/reviews/:tripId/reject",
  authenticate,
  requirePermission("review.reject"),
  (req: AuthenticatedRequest, res: Response) => {
    const tripId = String(req.params.tripId);
    const current = getTripFinancials(tripId);
    if (!current) return res.status(404).json({ error: "Financial record not found" });

    const reason = String(req.body?.reason || req.body?.notes || "Rejected during financial review");
    const updated = updateTripFinancials(
      tripId,
      {
        reviewStatus: "REJECTED",
        reviewNotes: reason,
      },
      {
        userId: req.user?.userId,
        fullName: req.user?.fullName,
        role: req.user?.role,
        action: "FINANCIAL_REVIEW_REJECTED",
        reason,
      }
    );

    logAuditEvent({
      actorId: req.user?.userId,
      actorName: req.user?.fullName,
      actorRole: req.user?.role,
      action: "FINANCIAL_REVIEW_REJECTED",
      entity: "finance",
      entityId: tripId,
      tripId,
      oldValues: { reviewStatus: current.reviewStatus },
      newValues: { reviewStatus: "REJECTED" },
      reason,
    });

    return res.json({ message: "Financial review rejected", review: enrichWithTrip(serializeFinancials(updated!)) });
  }
);

export default router;
