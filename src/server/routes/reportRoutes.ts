import { Router, type Response } from "express";
import { db } from "../db";
import { authenticate, requirePermission, type AuthenticatedRequest } from "../auth/middleware";
import { getAllFinancials } from "../services/financeService";

const router = Router();

// GET /api/reports/operational-summary
router.get("/operational-summary", authenticate, requirePermission("reports.view"), (_req: AuthenticatedRequest, res: Response) => {
  const trips = Array.from(db.trips.values());
  const vehicles = Array.from(db.vehicles.values());
  const drivers = Array.from(db.drivers.values());
  const financials = getAllFinancials();

  const activeTrips = trips.filter((t) => ["ASSIGNED", "HEADING_TO_LOADING", "ARRIVED_LOADING", "LOADED", "IN_TRANSIT", "ARRIVED_DESTINATION"].includes(t.status));
  const completedTrips = trips.filter((t) => ["DELIVERED", "SETTLEMENT_PENDING", "FINANCIAL_REVIEW", "PARTIALLY_PAID", "PAID", "COMPLETED"].includes(t.status));
  const cancelledTrips = trips.filter((t) => t.status === "CANCELLED");

  const totalTonnageMoved = trips.reduce((acc, t) => acc + t.cargoWeightTons, 0);
  const totalFleetCapacity = vehicles.reduce((acc, v) => acc + v.maxLoadTons, 0);
  const utilizationRate = Math.min(100, Math.round((totalTonnageMoved / (totalFleetCapacity || 1)) * 100));

  /**
   * On-time delivery is measured, never asserted. Only trips that actually
   * arrived carry an `actualArrival` stamp, so the rate is computed over that
   * population alone; when nothing has been delivered yet the metric is
   * reported as `null` ("لا توجد بيانات بعد") instead of a fabricated 96.8%.
   */
  const arrived = trips.filter((t) => !!t.actualArrival && !!t.estimatedArrival);
  const onTime = arrived.filter(
    (t) => new Date(t.actualArrival as string).getTime() <= new Date(t.estimatedArrival).getTime()
  );
  const onTimeRate = arrived.length > 0
    ? Math.round((onTime.length / arrived.length) * 1000) / 10
    : null;

  const totalExpenses = financials.reduce(
    (acc, f) => acc + f.driverFee + f.fuelCost + f.tollFees + f.otherExpenses,
    0
  );

  return res.json({
    metrics: {
      totalTrips: trips.length,
      activeTripsCount: activeTrips.length,
      completedTripsCount: completedTrips.length,
      cancelledTripsCount: cancelledTrips.length,
      fleetCount: vehicles.length,
      activeVehiclesCount: vehicles.filter((v) => v.status === "in_trip" || v.status === "active").length,
      driversCount: drivers.length,
      utilizationRatePercent: utilizationRate,
      onTimeDeliveryRatePercent: onTimeRate,
      /** How many delivered trips that rate was measured over. */
      onTimeSampleSize: arrived.length,
      unpricedTripsCount: trips.filter((t) => !t.tripPrice || t.tripPrice <= 0).length,
      totalGrossRevenueSar: financials.reduce((acc, f) => acc + f.freightPrice, 0),
      totalExpensesSar: totalExpenses,
      totalNetRevenueSar: financials.reduce((acc, f) => acc + f.netRevenue, 0),
      totalPaidSar: financials.reduce((acc, f) => acc + f.paidAmount, 0),
      totalBalanceDueSar: financials.reduce((acc, f) => acc + f.balanceDue, 0),
    },
    tripsBreakdownByStatus: trips.reduce((acc: Record<string, number>, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {}),
  });
});

export default router;
