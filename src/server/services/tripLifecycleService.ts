/**
 * EJAZ Transport — Canonical 18-State Trip Lifecycle Engine
 * Validates state transitions, permissions, reasons, document prerequisites, and triggers audit logs & notifications.
 */

export type TripLifecycleStatus =
  | "DRAFT_CREATED"
  | "PENDING_APPROVAL"
  | "CONFIRMED"
  | "ASSIGNED"
  | "HEADING_TO_LOADING"
  | "ARRIVED_LOADING"
  | "LOADED"
  | "IN_TRANSIT"
  | "ARRIVED_DESTINATION"
  | "DELIVERED"
  | "SETTLEMENT_PENDING"
  | "FINANCIAL_REVIEW"
  | "PARTIALLY_PAID"
  | "PAID"
  | "COMPLETED"
  | "ARCHIVED"
  | "CANCELLED"
  | "REOPENED";

export interface TransitionRule {
  from: TripLifecycleStatus;
  to: TripLifecycleStatus;
  allowedRoles: string[];
  requiredFields?: string[];
  requiresReason?: boolean;
}

export const TRANSITION_MATRIX: TransitionRule[] = [
  { from: "DRAFT_CREATED", to: "PENDING_APPROVAL", allowedRoles: ["SUPER_ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER"] },
  { from: "PENDING_APPROVAL", to: "CONFIRMED", allowedRoles: ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER"] },
  { from: "CONFIRMED", to: "ASSIGNED", allowedRoles: ["SUPER_ADMIN", "OPERATIONS_MANAGER", "DISPATCHER"], requiredFields: ["vehicle_id", "driver_id"] },
  { from: "ASSIGNED", to: "HEADING_TO_LOADING", allowedRoles: ["SUPER_ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "DRIVER"] },
  { from: "HEADING_TO_LOADING", to: "ARRIVED_LOADING", allowedRoles: ["SUPER_ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "DRIVER", "WAREHOUSE"] },
  { from: "ARRIVED_LOADING", to: "LOADED", allowedRoles: ["SUPER_ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "DRIVER", "WAREHOUSE"] },
  { from: "LOADED", to: "IN_TRANSIT", allowedRoles: ["SUPER_ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "DRIVER"] },
  { from: "IN_TRANSIT", to: "ARRIVED_DESTINATION", allowedRoles: ["SUPER_ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "DRIVER"] },
  { from: "ARRIVED_DESTINATION", to: "DELIVERED", allowedRoles: ["SUPER_ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "DRIVER"] },
  { from: "DELIVERED", to: "SETTLEMENT_PENDING", allowedRoles: ["SUPER_ADMIN", "OPERATIONS_MANAGER", "ACCOUNTANT"] },
  { from: "SETTLEMENT_PENDING", to: "FINANCIAL_REVIEW", allowedRoles: ["SUPER_ADMIN", "ACCOUNTANT", "GENERAL_MANAGER"] },
  { from: "FINANCIAL_REVIEW", to: "PARTIALLY_PAID", allowedRoles: ["SUPER_ADMIN", "ACCOUNTANT", "GENERAL_MANAGER"] },
  { from: "FINANCIAL_REVIEW", to: "PAID", allowedRoles: ["SUPER_ADMIN", "ACCOUNTANT", "GENERAL_MANAGER"] },
  { from: "PARTIALLY_PAID", to: "PAID", allowedRoles: ["SUPER_ADMIN", "ACCOUNTANT", "GENERAL_MANAGER"] },
  { from: "PAID", to: "COMPLETED", allowedRoles: ["SUPER_ADMIN", "ACCOUNTANT", "GENERAL_MANAGER"] },
  { from: "COMPLETED", to: "ARCHIVED", allowedRoles: ["SUPER_ADMIN", "GENERAL_MANAGER"] },
  // Reopening
  { from: "CANCELLED", to: "REOPENED", allowedRoles: ["SUPER_ADMIN", "GENERAL_MANAGER"], requiresReason: true },
  { from: "REOPENED", to: "PENDING_APPROVAL", allowedRoles: ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER"] },
  { from: "REOPENED", to: "CONFIRMED", allowedRoles: ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER"] },
];

export const CANCELLABLE_STATES: TripLifecycleStatus[] = [
  "DRAFT_CREATED",
  "PENDING_APPROVAL",
  "CONFIRMED",
  "ASSIGNED",
  "HEADING_TO_LOADING",
  "ARRIVED_LOADING",
  "LOADED",
  "IN_TRANSIT",
  "ARRIVED_DESTINATION",
];

export function validateTransition(
  currentStatus: TripLifecycleStatus,
  targetStatus: TripLifecycleStatus,
  userRole: string,
  tripData: Record<string, any>,
  reason?: string
): { isValid: boolean; error?: string } {
  // Check for cancellation
  if (targetStatus === "CANCELLED") {
    if (!CANCELLABLE_STATES.includes(currentStatus)) {
      return { isValid: false, error: `Cannot cancel trip in status '${currentStatus}'. Trips already delivered or in settlement cannot be cancelled.` };
    }
    const canCancel = ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER"].includes(userRole);
    if (!canCancel) {
      return { isValid: false, error: "Only managers can cancel a trip." };
    }
    if (!reason || reason.trim().length < 5) {
      return { isValid: false, error: "Cancellation requires a valid reason (minimum 5 characters)." };
    }
    return { isValid: true };
  }

  // Check matching transition rule
  const rule = TRANSITION_MATRIX.find((r) => r.from === currentStatus && r.to === targetStatus);
  if (!rule) {
    return { isValid: false, error: `Illegal transition from '${currentStatus}' to '${targetStatus}'.` };
  }

  // Check role authorization
  if (userRole !== "SUPER_ADMIN" && !rule.allowedRoles.includes(userRole)) {
    return { isValid: false, error: `Role '${userRole}' is not authorized to transition trip to '${targetStatus}'.` };
  }

  // Check required data fields
  if (rule.requiredFields) {
    for (const f of rule.requiredFields) {
      if (!tripData[f]) {
        return { isValid: false, error: `Missing required field '${f}' for transition to '${targetStatus}'.` };
      }
    }
  }

  // Check required reason if rule demands it
  if (rule.requiresReason && (!reason || reason.trim().length < 5)) {
    return { isValid: false, error: `Transition to '${targetStatus}' requires an authoritative reason.` };
  }

  return { isValid: true };
}

/** Human-readable Arabic & English labels for all 18 canonical states */
export const STATUS_LABELS: Record<TripLifecycleStatus, { ar: string; en: string; badgeColor: string }> = {
  DRAFT_CREATED: { ar: "مسودة تم إنشاؤها", en: "Draft Created", badgeColor: "#7e8da8" },
  PENDING_APPROVAL: { ar: "بانتظار الاعتماد", en: "Pending Approval", badgeColor: "#f5b73c" },
  CONFIRMED: { ar: "مؤكدة", en: "Confirmed", badgeColor: "#2f80ff" },
  ASSIGNED: { ar: "تم تعيين الشاحنة والسائق", en: "Assigned", badgeColor: "#2f80ff" },
  HEADING_TO_LOADING: { ar: "في الطريق للتحميل", en: "Heading to Loading", badgeColor: "#ffa24d" },
  ARRIVED_LOADING: { ar: "وصل موقع التحميل", en: "Arrived at Loading", badgeColor: "#ff7a00" },
  LOADED: { ar: "تم التحميل وإصدار البوليصة", en: "Loaded", badgeColor: "#ff7a00" },
  IN_TRANSIT: { ar: "على الطريق السريع", en: "In Transit", badgeColor: "#2fd08a" },
  ARRIVED_DESTINATION: { ar: "وصل وجهة التفريغ", en: "Arrived at Destination", badgeColor: "#12a05f" },
  DELIVERED: { ar: "تم التسليم بنجاح", en: "Delivered", badgeColor: "#2fd08a" },
  SETTLEMENT_PENDING: { ar: "بانتظار التسوية المالية", en: "Settlement Pending", badgeColor: "#f5b73c" },
  FINANCIAL_REVIEW: { ar: "مراجعة مالية وفحص الفواتير", en: "Financial Review", badgeColor: "#f5b73c" },
  PARTIALLY_PAID: { ar: "مدفوعة جزئياً", en: "Partially Paid", badgeColor: "#ffa24d" },
  PAID: { ar: "مدفوعة بالكامل", en: "Fully Paid", badgeColor: "#2fd08a" },
  COMPLETED: { ar: "مكتملة ومغلقة", en: "Completed", badgeColor: "#2fd08a" },
  ARCHIVED: { ar: "مؤرشفة", en: "Archived", badgeColor: "#7e8da8" },
  CANCELLED: { ar: "ملغاة", en: "Cancelled", badgeColor: "#ff5a6e" },
  REOPENED: { ar: "معاد فتحها للمراجعة", en: "Reopened", badgeColor: "#2f80ff" },
};
