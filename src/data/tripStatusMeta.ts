/**
 * Frontend mirror of the backend's canonical 18-state trip lifecycle
 * (`src/server/services/tripLifecycleService.ts`). Labels & colors stay in
 * sync with STATUS_LABELS on the server; the tab grouping maps every state to
 * exactly one console tab without inventing new states (§ Phase 2).
 */

export type CanonicalTripStatus =
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

export interface StatusMeta {
  ar: string;
  en: string;
  badgeColor: string;
}

export const TRIP_STATUS_META: Record<CanonicalTripStatus, StatusMeta> = {
  DRAFT_CREATED: { ar: "مسودة تم إنشاؤها", en: "Draft Created", badgeColor: "#7e8dad" },
  PENDING_APPROVAL: { ar: "بانتظار الاعتماد", en: "Pending Approval", badgeColor: "#f5b73c" },
  CONFIRMED: { ar: "مؤكدة", en: "Confirmed", badgeColor: "#38bdf8" },
  ASSIGNED: { ar: "تم تعيين الشاحنة والسائق", en: "Assigned", badgeColor: "#38bdf8" },
  HEADING_TO_LOADING: { ar: "في الطريق للتحميل", en: "Heading to Loading", badgeColor: "#ffa24d" },
  ARRIVED_LOADING: { ar: "وصل موقع التحميل", en: "Arrived at Loading", badgeColor: "#ff6b1a" },
  LOADED: { ar: "تم التحميل وإصدار البوليصة", en: "Loaded", badgeColor: "#ff6b1a" },
  IN_TRANSIT: { ar: "على الطريق السريع", en: "In Transit", badgeColor: "#22c55e" },
  ARRIVED_DESTINATION: { ar: "وصل وجهة التفريغ", en: "Arrived at Destination", badgeColor: "#12a05f" },
  DELIVERED: { ar: "تم التسليم بنجاح", en: "Delivered", badgeColor: "#22c55e" },
  SETTLEMENT_PENDING: { ar: "بانتظار التسوية المالية", en: "Settlement Pending", badgeColor: "#f5b73c" },
  FINANCIAL_REVIEW: { ar: "مراجعة مالية وفحص الفواتير", en: "Financial Review", badgeColor: "#f5b73c" },
  PARTIALLY_PAID: { ar: "مدفوعة جزئياً", en: "Partially Paid", badgeColor: "#ffa24d" },
  PAID: { ar: "مدفوعة بالكامل", en: "Fully Paid", badgeColor: "#22c55e" },
  COMPLETED: { ar: "مكتملة ومغلقة", en: "Completed", badgeColor: "#22c55e" },
  ARCHIVED: { ar: "مؤرشفة", en: "Archived", badgeColor: "#7e8dad" },
  CANCELLED: { ar: "ملغاة", en: "Cancelled", badgeColor: "#ff5a6e" },
  REOPENED: { ar: "معاد فتحها للمراجعة", en: "Reopened", badgeColor: "#38bdf8" },
};

/** Console tabs — every canonical state belongs to exactly one tab. */
export type TripTab = "all" | "available" | "confirmed" | "active" | "completed";

export const TRIP_TABS: { id: TripTab; ar: string; en: string }[] = [
  { id: "all", ar: "الكل", en: "All" },
  { id: "available", ar: "متاحة", en: "Available" },
  { id: "confirmed", ar: "مؤكدة", en: "Confirmed" },
  { id: "active", ar: "جارية", en: "In Progress" },
  { id: "completed", ar: "مكتملة", en: "Completed" },
];

const TAB_GROUPS: Record<Exclude<TripTab, "all">, CanonicalTripStatus[]> = {
  available: ["DRAFT_CREATED", "PENDING_APPROVAL", "REOPENED"],
  confirmed: ["CONFIRMED", "ASSIGNED"],
  active: ["HEADING_TO_LOADING", "ARRIVED_LOADING", "LOADED", "IN_TRANSIT", "ARRIVED_DESTINATION"],
  completed: ["DELIVERED", "SETTLEMENT_PENDING", "FINANCIAL_REVIEW", "PARTIALLY_PAID", "PAID", "COMPLETED", "ARCHIVED", "CANCELLED"],
};

export function tabOfStatus(status: string | undefined): Exclude<TripTab, "all"> | null {
  if (!status) return null;
  for (const [tab, states] of Object.entries(TAB_GROUPS)) {
    if (states.includes(status as CanonicalTripStatus)) return tab as Exclude<TripTab, "all">;
  }
  return null;
}

export function statusMeta(status: string | undefined): StatusMeta {
  if (status && TRIP_STATUS_META[status as CanonicalTripStatus]) {
    return TRIP_STATUS_META[status as CanonicalTripStatus];
  }
  return { ar: status || "غير معروف", en: status || "Unknown", badgeColor: "#7e8dad" };
}

/** Legacy UI status → closest tab (fallback for records without canonical status). */
export function tabOfLegacyStatus(status: string | undefined): Exclude<TripTab, "all"> | null {
  switch (status) {
    case "new":
    case "planning":
      return "available";
    case "ready":
      return "confirmed";
    case "loading":
    case "on_road":
    case "stopped":
    case "arrived":
      return "active";
    case "delivered":
    case "completed":
    case "cancelled":
      return "completed";
    default:
      return null;
  }
}
