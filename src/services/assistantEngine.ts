/**
 * EJAZ Transport — assistant engine (§16–§23).
 *
 * The assistant is a *context* engine, not a chat toy: every answer is derived
 * from the live store (trips, trucks, drivers, alerts) filtered through the
 * signed-in user's permissions, the console persona they are previewing, the
 * page they are on and the trip they have open.
 *
 * Rules enforced here (and covered by tests/assistant.test.ts):
 *   1. No answer may expose data outside the viewer's permission scope.
 *   2. Detection is deterministic — the same store state always yields the same
 *      incident list, ordered by severity.
 *   3. Suggested actions are only offered when the viewer may actually perform
 *      them; sensitive ones return `requiresConfirm`.
 *   4. Every returned string is an i18n key + params, so Arabic, English and
 *      Urdu render from one source of truth.
 */
import type { I18nKey } from "../localization/i18n";
import type { SessionUser } from "../utils/permissions";
import { can, canPersona, isDriverRole, isClientRole, type Capability } from "../utils/permissions";
import {
  detectIssues,
  isVisibleTo,
  severityRank,
  type AlertViewer,
  type DetectedIssue,
  type RoutedAlert,
  type TripSignal,
} from "./smartAlerts";

export type { DetectedIssue };

export interface AssistantTrip extends TripSignal {
  cargoWeightTons?: number;
  maxCapacityTons?: number;
  plate?: string;
  driverName?: string;
  driverPhone?: string;
  lastEventAr?: string;
  lastEventEn?: string;
}

export interface AssistantTruck {
  id: string;
  plate: string;
  body: string;
  status: string;
  driverName?: string;
}

export interface AssistantDriver {
  id?: string;
  name: string;
  phone: string;
  rating: number;
  trips: number;
}

export interface AssistantContextInput {
  user: SessionUser | null;
  /** Console persona currently previewed: admin | driver | shipper | owner. */
  persona: string;
  /** Console section key (or "mobile"). */
  page: string;
  trips: AssistantTrip[];
  trucks: AssistantTruck[];
  drivers: AssistantDriver[];
  alerts: RoutedAlert[];
  selectedTripId?: string;
  /** True when the API layer reported a connectivity failure. */
  apiUnreachable?: boolean;
  /** Documents the console knows are about to lapse. */
  expiringDocuments?: { id: string; label: string; daysLeft: number }[];
}

export type AssistantScope = "admin" | "driver" | "client" | "owner";

export interface AssistantContext {
  viewer: AlertViewer;
  scope: AssistantScope;
  user: SessionUser | null;
  page: string;
  /** Trips the viewer is allowed to see. */
  trips: AssistantTrip[];
  trucks: AssistantTruck[];
  drivers: AssistantDriver[];
  alerts: RoutedAlert[];
  focusTrip?: AssistantTrip;
  issues: DetectedIssue[];
  capabilities: {
    viewTrips: boolean;
    manageTrips: boolean;
    viewFleet: boolean;
    viewDrivers: boolean;
    viewFinance: boolean;
    viewReports: boolean;
    act: boolean;
  };
}

function scopeOf(user: SessionUser | null, persona: string): AssistantScope {
  const apiRole = user?.role;
  if (persona === "driver" || isDriverRole(apiRole)) return "driver";
  if (persona === "shipper" || isClientRole(apiRole)) return "client";
  if (persona === "owner") return "owner";
  return "admin";
}

export const OWNER_LABEL_KEY: Record<string, I18nKey> = {
  operations: "assistant.ownerOps",
  dispatcher: "assistant.ownerDispatcher",
  driver: "assistant.ownerDriver",
  maintenance: "assistant.ownerMaintenance",
  it: "assistant.ownerIT",
  client: "assistant.ownerClient",
};

export function buildAssistantContext(input: AssistantContextInput): AssistantContext {
  const scope = scopeOf(input.user, input.persona);
  const viewer: AlertViewer = {
    persona: input.persona,
    apiRole: input.user?.role,
    permissions: input.user?.permissions,
    userId: input.user?.id,
    driverId: input.user?.driverId,
  };

  /* ── Permission filtering happens BEFORE anything is computed ─────────── */
  let trips = input.trips;
  if (scope === "driver") {
    trips = trips.filter((t) => !viewer.driverId || t.driverId === viewer.driverId);
  }

  /* A signed-in token decides; the persona is only consulted for the offline
     demo session, so previewing another role never widens the real permissions. */
  const allowed = (capability: Capability) =>
    input.user ? can(input.user, capability) : canPersona(input.persona, capability);

  const canViewTrips =
    scope === "admin" ||
    scope === "owner" ||
    allowed("trips.view");
  const canManageTrips = allowed("trips.manage") && scope === "admin";
  const canViewFleet = allowed("vehicles.view") && scope !== "client";
  const canViewDrivers = allowed("drivers.view") && scope === "admin";
  const canViewFinance = allowed("finance.view") && scope !== "driver" && scope !== "client";
  const canViewReports = allowed("reports.view") && scope !== "driver" && scope !== "client";

  /* "Can this viewer act from the assistant?" is answered per role, not by one
     blanket flag: a driver may act on their own trip, a client may file a report,
     the operations team may dispatch. */
  const canAct =
    scope === "driver"
      ? allowed("trips.transition")
      : scope === "client"
        ? allowed("trips.request")
        : allowed("assistant.act") || allowed("trips.manage") || allowed("settings.manage");

  const alerts = input.alerts.filter((a) => isVisibleTo(a, viewer));
  const trucks = canViewFleet ? input.trucks : [];
  const drivers = canViewDrivers ? input.drivers : [];

  const focusTrip =
    (input.selectedTripId ? trips.find((t) => t.id === input.selectedTripId) : undefined) ??
    trips[0] ??
    undefined;

  const idleTrucks =
    scope === "admin"
      ? input.trucks.filter((t) => t.status !== "active").map((t) => ({ id: t.id, plate: t.plate }))
      : [];

  const issues = canViewTrips
    ? detectIssues({
        trips,
        idleTrucks,
        apiUnreachable: input.apiUnreachable,
        expiringDocuments: input.expiringDocuments,
      })
    : [];

  return {
    viewer,
    scope,
    user: input.user,
    page: input.page,
    trips,
    trucks,
    drivers,
    alerts,
    focusTrip,
    issues,
    capabilities: {
      viewTrips: canViewTrips,
      manageTrips: canManageTrips,
      viewFleet: canViewFleet,
      viewDrivers: canViewDrivers,
      viewFinance: canViewFinance,
      viewReports: canViewReports,
      act: canAct,
    },
  };
}

/* ── Contextual suggestions (§23) ────────────────────────────────────────── */

export interface Suggestion {
  id: string;
  labelKey: I18nKey;
  /** Optional question the chip submits when it is not a pure information read. */
  ask?: boolean;
}

export function suggestionsFor(ctx: AssistantContext): Suggestion[] {
  const list: Suggestion[] = [];

  if (ctx.scope === "driver") {
    list.push(
      { id: "myTrip", labelKey: "assistant.suggest.myTrip", ask: true },
      { id: "eta", labelKey: "assistant.suggest.eta", ask: true },
      { id: "nextStop", labelKey: "assistant.suggest.nextStop", ask: true },
      { id: "report", labelKey: "assistant.suggest.reportProblem", ask: true },
      { id: "contactOps", labelKey: "assistant.suggest.contactOps", ask: true },
    );
    return list;
  }

  if (ctx.scope === "client") {
    list.push(
      { id: "shipment", labelKey: "assistant.suggest.shipmentStatus", ask: true },
      { id: "deliveryDate", labelKey: "assistant.suggest.deliveryDate", ask: true },
      { id: "delayReason", labelKey: "assistant.suggest.delayReason", ask: true },
      { id: "report", labelKey: "assistant.suggest.reportProblem", ask: true },
    );
    return list;
  }

  /* Admin / owner — the suggestions follow the page the operator is on. */
  if (ctx.page === "trips" || ctx.page === "operations" || ctx.page === "tracking") {
    list.push(
      { id: "delayReason", labelKey: "assistant.suggest.delayReason", ask: true },
      { id: "lastDriverUpdate", labelKey: "assistant.suggest.lastDriverUpdate", ask: true },
      { id: "alertAdmin", labelKey: "assistant.suggest.alertAdmin" },
    );
  } else if (ctx.page === "fleet" || ctx.page === "vehicle-assets") {
    list.push(
      { id: "utilization", labelKey: "assistant.suggest.utilization", ask: true },
      { id: "system", labelKey: "assistant.suggest.system", ask: true },
    );
  } else if (ctx.page === "drivers") {
    list.push(
      { id: "drivers", labelKey: "assistant.suggest.drivers", ask: true },
      { id: "report", labelKey: "assistant.suggest.reportProblem", ask: true },
    );
  } else if (ctx.page === "reports" || ctx.page === "analysis" || ctx.page === "history") {
    list.push(
      { id: "operations", labelKey: "assistant.suggest.operations", ask: true },
      { id: "delays", labelKey: "assistant.suggest.delays", ask: true },
    );
  } else if (ctx.page === "settings") {
    list.push(
      { id: "system", labelKey: "assistant.suggest.system", ask: true },
      { id: "openAlerts", labelKey: "assistant.suggest.openAlerts", ask: true },
    );
  }

  list.push(
    { id: "openAlerts", labelKey: "assistant.suggest.openAlerts", ask: true },
    { id: "delays", labelKey: "assistant.suggest.delays", ask: true },
    { id: "operations", labelKey: "assistant.suggest.operations", ask: true },
  );
  return list.slice(0, 5);
}

/* ── Question answering ──────────────────────────────────────────────────── */

export interface AssistantAnswer {
  key: I18nKey;
  params?: Record<string, string | number>;
  /** Incidents this answer is about, so the UI can show the six-field cards. */
  issues?: DetectedIssue[];
  /** The question fell outside the viewer's permissions. */
  denied?: boolean;
}

const KEYWORDS = {
  delay: ["delay", "late", "تأخر", "متأخر", "تاخیر", "دیر"],
  alerts: ["alert", "notification", "تنبيه", "إشعار", "اطلاع", "الرٹ"],
  eta: ["eta", "arrival", "when", "وقت الوصول", "متى", "کب", "آمد"],
  next: ["next", "waypoint", "station", "المحطة التالية", "اقرب نقطة", "اگلا"],
  driver: ["driver", "سائق", "ڈرائیور"],
  truck: ["truck", "vehicle", "plate", "شاحنة", "مركبة", "لوحة", "ٹرک", "گاڑی"],
  shipment: ["shipment", "consignment", "cargo", "شحنة", "بوليصة", "کھیپ", "سامان"],
  trip: ["trip", "رحلة", "ٹرپ"],
  report: ["report", "problem", "issue", "بلاغ", "مشكلة", "عطل", "شکایت", "مسئلہ"],
  contact: ["contact", "call", "operations room", "تواصل", "اتصال", "رابطہ", "کال"],
  help: ["help", "what can you", "capabilities", "مساعدة", "ماذا تستطيع", "مدد", "کیا کر سکتے"],
  system: ["system", "api", "sync", "خطأ", "خلل", "مزامنة", "سيرفر", "سسٹم", "خرابی"],
  summary: ["summary", "summarise", "summarize", "overview", "ملخص", "لخص", "الأداء", "خلاصہ", "کارکردگی"],
  finance: ["finance", "invoice", "revenue", "settlement", "مالية", "فاتورة", "إيراد", "رقم مالية"],
} as const;

function matches(question: string, bucket: keyof typeof KEYWORDS): boolean {
  const q = question.toLowerCase();
  return KEYWORDS[bucket].some((k) => q.includes(k.toLowerCase()));
}

const statusKeyOf = (status: string): I18nKey => {
  switch (status) {
    case "on_road":
      return "status.on_road";
    case "waiting":
      return "status.waiting";
    case "loading":
      return "status.loading";
    case "ready":
      return "status.ready";
    case "planning":
      return "status.planning";
    case "arrived":
      return "status.arrived";
    case "delivered":
      return "status.delivered";
    case "cancelled":
      return "status.cancelled";
    case "completed":
      return "status.completed";
    default:
      return "status.inactive";
  }
};

export interface StatusLabel {
  key: I18nKey;
}

/** Exposed for the UI so a trip status renders in the active language. */
export function tripStatusKey(status: string): I18nKey {
  return statusKeyOf(status);
}

/**
 * Answer a free-text question inside the viewer's permissions.
 * The caller renders the returned key with `tk()` and, when `issues` is present,
 * the six-field incident cards.
 */
export function answerQuestion(question: string, ctx: AssistantContext, tk: (key: I18nKey) => string): AssistantAnswer {
  if (!question.trim()) {
    return { key: "assistant.answer.greeting" };
  }

  /* Permission boundary first: nothing else is computed for a denied topic. */
  if (matches(question, "finance") && !ctx.capabilities.viewFinance) {
    return { key: "assistant.answer.denied", denied: true };
  }

  if (matches(question, "report")) {
    const trip = ctx.focusTrip;
    return {
      key: "assistant.answer.reportAck",
      params: {
        trip: trip?.tripNumber ?? "—",
        owner: tk("assistant.ownerOps"),
        id: `RPT-${Date.now().toString().slice(-6)}`,
      },
    };
  }

  if (matches(question, "contact")) {
    return { key: "assistant.answer.nextStep", params: { action: tk("assistant.ownerOps") } };
  }

  if (matches(question, "help")) {
    return { key: "assistant.answer.capability" };
  }

  if (matches(question, "summary")) {
    const late = ctx.trips.filter((t) => t.isDelayed).length;
    return {
      key: "assistant.answer.summary",
      params: {
        trips: ctx.trips.length,
        late,
        idle: Math.max(ctx.trucks.filter((t) => t.status !== "active").length, 0),
        alerts: ctx.alerts.filter((a) => !a.resolved).length,
      },
    };
  }

  if (matches(question, "delay")) {
    const delayed = ctx.issues.filter((i) => i.type === "delay" || i.type === "idle");
    if (delayed.length === 0) return { key: "assistant.answer.noDelays" };
    return {
      key: "assistant.answer.delays",
      params: {
        count: delayed.length,
        list: delayed
          .map((i) => String(i.signals.trip ?? "—"))
          .slice(0, 4)
          .join(" · "),
      },
      issues: delayed,
    };
  }

  if (matches(question, "alerts")) {
    const open = ctx.alerts.filter((a) => !a.resolved);
    if (open.length === 0) return { key: "assistant.answer.noAlerts" };
    return {
      key: "assistant.answer.alerts",
      params: {
        count: open.length,
        list: open
          .slice(0, 3)
          .map((a) => a.titleEn)
          .join(" · "),
      },
    };
  }

  if (matches(question, "shipment")) {
    const trip = ctx.focusTrip;
    if (!trip) return { key: "assistant.answer.noTrip" };
    return {
      key: "assistant.answer.shipment",
      params: {
        shipment: trip.tripNumber,
        client: trip.shipper ?? trip.consignee ?? "—",
        status: tk(statusKeyOf(trip.status)),
        remaining: Math.round(trip.distanceRemainingKm ?? 0),
        destination: trip.destinationCity,
      },
    };
  }

  if (matches(question, "driver")) {
    if (!ctx.capabilities.viewDrivers) {
      return { key: "assistant.answer.denied", denied: true };
    }
    const trip = ctx.focusTrip;
    const driver = ctx.drivers.find((d) => d.id === trip?.driverId) ?? ctx.drivers[0];
    if (!driver) return { key: "assistant.answer.noTrip" };
    return {
      key: "assistant.answer.driver",
      params: {
        name: driver.name,
        trip: trip?.tripNumber ?? "—",
        phone: driver.phone,
        rating: driver.rating,
      },
    };
  }

  if (matches(question, "truck")) {
    if (!ctx.capabilities.viewFleet) {
      return { key: "assistant.answer.denied", denied: true };
    }
    const trip = ctx.focusTrip;
    const truck = ctx.trucks.find((t) => t.id === trip?.truckId) ?? ctx.trucks[0];
    if (!truck) return { key: "assistant.answer.noTrip" };
    return {
      key: "assistant.answer.truck",
      params: {
        plate: truck.plate,
        body: truck.body,
        trip: trip?.tripNumber ?? "—",
        capacity: trip?.maxCapacityTons ?? "—",
        load: trip?.cargoWeightTons ?? "—",
      },
    };
  }

  if (matches(question, "next") || matches(question, "eta") || matches(question, "trip")) {
    const trip = ctx.focusTrip;
    if (!trip) return { key: "assistant.answer.noTrip" };
    return {
      key: "assistant.answer.tripStatus",
      params: {
        trip: trip.tripNumber,
        origin: trip.originCity,
        destination: trip.destinationCity,
        status: tk(statusKeyOf(trip.status)),
        speed: Math.round(trip.speedKmH ?? 0),
        remaining: Math.round(trip.distanceRemainingKm ?? 0),
        eta: Math.round(trip.etaMinutes ?? 0),
      },
    };
  }

  if (matches(question, "system")) {
    const technical = ctx.issues.filter((i) => ["api", "sync", "gps", "system"].includes(i.type));
    if (technical.length === 0) return { key: "assistant.answer.noAlerts" };
    return {
      key: "assistant.answer.nextStep",
      params: { action: tk(technical[0].keys.action) },
      issues: technical,
    };
  }

  /* Default: an operational summary rather than a "I did not understand". */
  return {
    key: "assistant.answer.greeting",
    params: {
      name: ctx.user?.fullName ?? "—",
      role: ctx.user?.role ?? ctx.viewer.persona,
      page: ctx.page,
    },
  };
}

/** Highest-severity issues first, capped for the panel. */
export function topIssues(ctx: AssistantContext, limit = 4): DetectedIssue[] {
  return [...ctx.issues].sort((a, b) => severityRank(b.severity) - severityRank(a.severity)).slice(0, limit);
}

/** Actions the assistant may offer, with the permission gate attached. */
export interface AssistantAction {
  id: "escalate" | "acknowledge" | "openTrip" | "report";
  labelKey: I18nKey;
  requiresConfirm: boolean;
  capable: boolean;
}

export function actionsFor(ctx: AssistantContext, issue?: DetectedIssue): AssistantAction[] {
  const actions: AssistantAction[] = [];
  if (!ctx.capabilities.act) return actions;

  actions.push({
    id: "escalate",
    labelKey: "assistant.actEscalate",
    requiresConfirm: true,
    capable: true,
  });

  if (issue && (issue.type === "delay" || issue.type === "idle")) {
    actions.push({
      id: "openTrip",
      labelKey: "alerts.inspectTrip",
      requiresConfirm: false,
      capable: true,
    });
  }

  if (ctx.alerts.some((a) => !a.resolved)) {
    actions.push({
      id: "acknowledge",
      labelKey: "alerts.ack",
      requiresConfirm: false,
      capable: true,
    });
  }

  return actions;
}
