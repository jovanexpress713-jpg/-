import type { I18nKey } from "../localization/i18n";

/**
 * EJAZ Transport — Smart alerting engine (§15, §21).
 *
 * Pure, dependency-free decision logic shared by three consumers:
 *   • the alerts center (what does this user see, and may they act on it?),
 *   • the fleet store (deduplication, cooldown, escalation, acknowledgement),
 *   • the AI assistant (automatic issue detection with cause/impact/owner).
 *
 * Being pure means every rule below is unit-testable without a DOM, and the
 * routing policy lives in exactly one place instead of being re-implemented per
 * component.
 */

export type AlertType =
  | "delay"
  | "off_route"
  | "idle"
  | "temp"
  | "doc_expiry"
  | "speed"
  | "utilization"
  | "gps"
  | "api"
  | "sync"
  | "auth"
  | "system";

/** Canonical five-level severity ladder required by the spec. */
export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const SEVERITY_LADDER: Severity[] = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function severityRank(severity: Severity): number {
  return SEVERITY_LADDER.indexOf(severity);
}

/** Legacy three-level severities still stored in browser state. */
export function normalizeSeverity(input: string | undefined): Severity {
  switch ((input || "").toLowerCase()) {
    case "critical":
      return "CRITICAL";
    case "warning":
      return "HIGH";
    case "info":
      return "INFO";
    case "low":
      return "LOW";
    case "medium":
      return "MEDIUM";
    case "high":
      return "HIGH";
    default:
      return "INFO";
  }
}

/** Who is accountable for a class of problem — drives notification targeting. */
export type OwnerRole = "operations" | "dispatcher" | "driver" | "maintenance" | "it" | "client";

export const OWNER_BY_TYPE: Record<AlertType, OwnerRole> = {
  delay: "operations",
  off_route: "dispatcher",
  idle: "dispatcher",
  temp: "operations",
  doc_expiry: "maintenance",
  speed: "dispatcher",
  utilization: "operations",
  gps: "it",
  api: "it",
  sync: "it",
  auth: "it",
  system: "it",
};

/** Console personas + API roles that receive a given alert class. */
const AUDIENCE_BY_TYPE: Record<AlertType, { personas: string[]; apiRoles: string[] }> = {
  delay: {
    personas: ["admin"],
    apiRoles: ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER", "DISPATCHER"],
  },
  off_route: {
    personas: ["admin"],
    apiRoles: ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER", "DISPATCHER"],
  },
  idle: { personas: ["admin"], apiRoles: ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER"] },
  temp: { personas: ["admin"], apiRoles: ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER"] },
  doc_expiry: { personas: ["admin", "owner"], apiRoles: ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER"] },
  speed: { personas: ["admin"], apiRoles: ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER"] },
  utilization: { personas: ["admin", "owner"], apiRoles: ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER"] },
  gps: { personas: ["admin"], apiRoles: ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER", "DISPATCHER"] },
  api: { personas: ["admin"], apiRoles: ["SUPER_ADMIN", "GENERAL_MANAGER"] },
  sync: { personas: ["admin"], apiRoles: ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER"] },
  auth: { personas: ["admin"], apiRoles: ["SUPER_ADMIN", "GENERAL_MANAGER"] },
  system: { personas: ["admin"], apiRoles: ["SUPER_ADMIN", "GENERAL_MANAGER"] },
};

export interface AlertViewer {
  persona: string;         // console persona: admin | driver | shipper | owner
  apiRole?: string;        // token role: SUPER_ADMIN | DRIVER | CUSTOMER | …
  permissions?: string[];
  userId?: string;
  driverId?: string;
}

export interface RoutedAlert {
  id: string;
  type: AlertType;
  severity: Severity;
  owner: OwnerRole;
  tripId?: string;
  truckId?: string;
  driverId?: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  /** Why the alert fired (shown on the card as «سبب التنبيه»). */
  reasonAr?: string;
  reasonEn?: string;
  /** What the owner must do (shown as «الإجراء المطلوب»). */
  actionAr?: string;
  actionEn?: string;
  timestamp: string;
  detectedAt?: number;
  resolved: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  escalated?: boolean;
  escalatedTo?: OwnerRole;
  escalatedAt?: string;
  /** Telemetry/API/detector origin — surfaced as a small chip. */
  source?: "telemetry" | "ops" | "assistant" | "system";
  /** Stable identity used to suppress duplicates. */
  dedupeKey?: string;
}

export function ownerFor(type: AlertType): OwnerRole {
  return OWNER_BY_TYPE[type] ?? "operations";
}

export function audienceFor(type: AlertType) {
  return AUDIENCE_BY_TYPE[type] ?? { personas: ["admin"], apiRoles: ["SUPER_ADMIN"] };
}

const FULL_ACCESS = (viewer: AlertViewer) =>
  !!(viewer.apiRole && ["SUPER_ADMIN", "GENERAL_MANAGER"].includes(viewer.apiRole)) ||
  (Array.isArray(viewer.permissions) && viewer.permissions.includes("*"));

/**
 * May this viewer see this alert? Nothing is ever broadcast.
 *
 * Order matters: field identities are checked first so previewing the driver or
 * client persona can never fall through to the console stream. When the token
 * carries an API role, that role decides; the console persona is only a UI
 * preview and is honoured solely for offline/demo sessions without a role.
 */
export function isVisibleTo(alert: RoutedAlert, viewer: AlertViewer): boolean {
  if (viewer.persona === "driver" || viewer.apiRole === "DRIVER") {
    return alert.driverId !== undefined && alert.driverId === viewer.driverId;
  }
  if (viewer.persona === "shipper" || viewer.apiRole === "CUSTOMER" || viewer.apiRole === "CLIENT") {
    return false; // clients get their own notification stream, never console alerts
  }

  if (FULL_ACCESS(viewer)) return true;

  const audience = audienceFor(alert.type);
  if (viewer.apiRole) return audience.apiRoles.includes(viewer.apiRole);
  return audience.personas.includes(viewer.persona);
}

/**
 * Only the responsible role may acknowledge/escalate; drivers ack their own
 * assignment, clients never act, owners oversee but do not operate.
 */
export function canActOn(alert: RoutedAlert, viewer: AlertViewer): boolean {
  if (alert.resolved) return false;

  if (viewer.persona === "driver" || viewer.apiRole === "DRIVER") {
    return alert.driverId !== undefined && alert.driverId === viewer.driverId;
  }
  if (viewer.persona === "shipper" || viewer.apiRole === "CUSTOMER" || viewer.apiRole === "CLIENT") {
    return false;
  }
  if (!isVisibleTo(alert, viewer)) return false;
  if (FULL_ACCESS(viewer)) return true;
  if (viewer.apiRole) return audienceFor(alert.type).apiRoles.includes(viewer.apiRole);
  return viewer.persona === "admin" || viewer.persona === "owner";
}

/** Deterministic identity for an incident, so repeats collapse into one row. */
export function dedupeKeyOf(alert: Pick<RoutedAlert, "type" | "tripId" | "truckId">): string {
  return [alert.type, alert.tripId ?? "-", alert.truckId ?? "-"].join("|");
}

export const DEFAULT_COOLDOWN_MS = 10 * 60 * 1000;

export interface ThrottleState {
  dedupeKey: string;
  detectedAt: number;
  severity: Severity;
}

/**
 * Should a newly detected incident be suppressed?
 * A duplicate inside the cooldown window is suppressed unless it escalated to a
 * higher severity — a worsening problem is always worth surfacing.
 */
export function shouldThrottle(
  existing: ThrottleState[],
  candidate: Pick<RoutedAlert, "type" | "tripId" | "truckId" | "severity">,
  now: number,
  cooldownMs = DEFAULT_COOLDOWN_MS,
): boolean {
  const key = dedupeKeyOf(candidate);
  const previous = existing.find((e) => e.dedupeKey === key);
  if (!previous) return false;
  if (severityRank(candidate.severity) > severityRank(previous.severity)) return false;
  return now - previous.detectedAt < cooldownMs;
}

/** Escalation ladder: one step up, capped at CRITICAL. */
export function nextSeverity(severity: Severity): Severity {
  const index = severityRank(severity);
  return SEVERITY_LADDER[Math.min(index + 1, SEVERITY_LADDER.length - 1)];
}

/** Who an alert is escalated to once the owner has not acted. */
export function escalateTargetOf(alert: RoutedAlert): OwnerRole {
  if (alert.owner === "dispatcher" || alert.owner === "driver") return "operations";
  if (alert.owner === "maintenance") return "operations";
  if (alert.owner === "operations") return "it";
  return "operations";
}

/* ── Automatic operational issue detection (§20) ─────────────────────────── */

export interface TripSignal {
  id: string;
  tripNumber: string;
  status: string;
  driverId?: string;
  truckId?: string;
  progressPct?: number;
  distanceRemainingKm?: number;
  speedKmH?: number;
  etaMinutes?: number;
  isDelayed?: boolean;
  reeferTempC?: number;
  targetTempC?: number;
  originCity: string;
  destinationCity: string;
  shipper?: string;
  consignee?: string;
  /** Age of the last lifecycle write, in minutes (optional signal). */
  minutesSinceStatusUpdate?: number;
  /** Age of the last GPS fix, in minutes (optional signal). */
  minutesSinceGpsFix?: number;
}

export interface DetectedIssue {
  id: string;
  type: AlertType;
  severity: Severity;
  owner: OwnerRole;
  tripId?: string;
  truckId?: string;
  driverId?: string;
  /** i18n keys describing the incident — rendered as the six-field card. */
  keys: {
    title: I18nKey;
    cause: I18nKey;
    impact: I18nKey;
    action: I18nKey;
    next: I18nKey;
  };
  signals: Record<string, string | number>;
}

/** Key bundle per detected incident — the six-field card (§20). */
const ISSUE_KEYS: Record<string, DetectedIssue["keys"]> = {
  delay: {
    title: "assistant.issue.delay.title",
    cause: "assistant.issue.delay.cause",
    impact: "assistant.issue.delay.impact",
    action: "assistant.issue.delay.action",
    next: "assistant.issue.delay.next",
  },
  stalled: {
    title: "assistant.issue.stalled.title",
    cause: "assistant.issue.stalled.cause",
    impact: "assistant.issue.stalled.impact",
    action: "assistant.issue.stalled.action",
    next: "assistant.issue.stalled.next",
  },
  status: {
    title: "assistant.issue.status.title",
    cause: "assistant.issue.status.cause",
    impact: "assistant.issue.status.impact",
    action: "assistant.issue.status.action",
    next: "assistant.issue.status.next",
  },
  gps: {
    title: "assistant.issue.gps.title",
    cause: "assistant.issue.gps.cause",
    impact: "assistant.issue.gps.impact",
    action: "assistant.issue.gps.action",
    next: "assistant.issue.gps.next",
  },
  temp: {
    title: "assistant.issue.temp.title",
    cause: "assistant.issue.temp.cause",
    impact: "assistant.issue.temp.impact",
    action: "assistant.issue.temp.action",
    next: "assistant.issue.temp.next",
  },
  utilization: {
    title: "assistant.issue.utilization.title",
    cause: "assistant.issue.utilization.cause",
    impact: "assistant.issue.utilization.impact",
    action: "assistant.issue.utilization.action",
    next: "assistant.issue.utilization.next",
  },
  api: {
    title: "assistant.issue.api.title",
    cause: "assistant.issue.api.cause",
    impact: "assistant.issue.api.impact",
    action: "assistant.issue.api.action",
    next: "assistant.issue.api.next",
  },
  notification: {
    title: "assistant.issue.notification.title",
    cause: "assistant.issue.notification.cause",
    impact: "assistant.issue.notification.impact",
    action: "assistant.issue.notification.action",
    next: "assistant.issue.notification.next",
  },
  sync: {
    title: "assistant.issue.sync.title",
    cause: "assistant.issue.sync.cause",
    impact: "assistant.issue.sync.impact",
    action: "assistant.issue.sync.action",
    next: "assistant.issue.sync.next",
  },
  docs: {
    title: "assistant.issue.docs.title",
    cause: "assistant.issue.docs.cause",
    impact: "assistant.issue.docs.impact",
    action: "assistant.issue.docs.action",
    next: "assistant.issue.docs.next",
  },
  system: {
    title: "assistant.issue.system.title",
    cause: "assistant.issue.system.cause",
    impact: "assistant.issue.system.impact",
    action: "assistant.issue.system.action",
    next: "assistant.issue.system.next",
  },
};

export interface DetectionInput {
  trips: TripSignal[];
  /** Utilization signal: available trucks that carry no trip. */
  idleTrucks?: { id: string; plate: string }[];
  /** True when the backend API is unreachable from the console. */
  apiUnreachable?: boolean;
  /** Documents expiring within this many days are surfaced. */
  expiringDocuments?: { id: string; label: string; daysLeft: number }[];
  /** Notification deliveries that failed (ids come from the notification log). */
  failedNotifications?: { id: string; reason?: string }[];
}

/**
 * Detect the operational problems the system can prove from its own data.
 * Ordering is by severity so the assistant always leads with what hurts most.
 */
export function detectIssues(input: DetectionInput): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  for (const trip of input.trips || []) {
    if (trip.status === "delivered" || trip.status === "cancelled" || trip.status === "completed") continue;

    /* 1 — Delayed trip. */
    if (trip.isDelayed) {
      issues.push({
        id: `delay:${trip.id}`,
        type: "delay",
        severity: "HIGH",
        owner: "operations",
        tripId: trip.id,
        truckId: trip.truckId,
        driverId: trip.driverId,
        keys: ISSUE_KEYS.delay,
        signals: {
          trip: trip.tripNumber,
          remaining: Math.round(trip.distanceRemainingKm ?? 0),
          eta: Math.round(trip.etaMinutes ?? 0),
        },
      });
    }

    /* 2 — Stalled: on the road but not moving for a long time. */
    const stalled =
      trip.status === "on_road" &&
      (trip.speedKmH ?? 0) <= 2 &&
      (trip.minutesSinceGpsFix ?? 0) >= 25;
    if (stalled) {
      issues.push({
        id: `stalled:${trip.id}`,
        type: "idle",
        severity: "CRITICAL",
        owner: "dispatcher",
        tripId: trip.id,
        truckId: trip.truckId,
        driverId: trip.driverId,
        keys: ISSUE_KEYS.stalled,
        signals: { trip: trip.tripNumber, minutes: Math.round(trip.minutesSinceGpsFix ?? 0) },
      });
    }

    /* 3 — Stale lifecycle status. */
    if ((trip.minutesSinceStatusUpdate ?? 0) >= 180) {
      issues.push({
        id: `status:${trip.id}`,
        type: "sync",
        severity: "MEDIUM",
        owner: "operations",
        tripId: trip.id,
        truckId: trip.truckId,
        driverId: trip.driverId,
        keys: ISSUE_KEYS.status,
        signals: { trip: trip.tripNumber, minutes: Math.round(trip.minutesSinceStatusUpdate ?? 0) },
      });
    }

    /* 4 — Telemetry gap. */
    if ((trip.minutesSinceGpsFix ?? 0) >= 90) {
      issues.push({
        id: `gps:${trip.id}`,
        type: "gps",
        severity: "HIGH",
        owner: "it",
        tripId: trip.id,
        truckId: trip.truckId,
        driverId: trip.driverId,
        keys: ISSUE_KEYS.gps,
        signals: { trip: trip.tripNumber, minutes: Math.round(trip.minutesSinceGpsFix ?? 0) },
      });
    }

    /* 5 — Cold-chain excursion. */
    if (
      typeof trip.reeferTempC === "number" &&
      typeof trip.targetTempC === "number" &&
      Math.abs(trip.reeferTempC - trip.targetTempC) >= 1.5
    ) {
      issues.push({
        id: `temp:${trip.id}`,
        type: "temp",
        severity: "HIGH",
        owner: "operations",
        tripId: trip.id,
        truckId: trip.truckId,
        driverId: trip.driverId,
        keys: ISSUE_KEYS.temp,
        signals: {
          trip: trip.tripNumber,
          reading: trip.reeferTempC,
          target: trip.targetTempC,
        },
      });
    }
  }

  /* 6 — Available capacity nobody assigned. */
  if ((input.idleTrucks?.length ?? 0) >= 2) {
    issues.push({
      id: "utilization:yard",
      type: "utilization",
      severity: "LOW",
      owner: "operations",
      keys: ISSUE_KEYS.utilization,
      signals: { count: input.idleTrucks?.length ?? 0 },
    });
  }

  /* 7 — Backend unreachable. */
  if (input.apiUnreachable) {
    issues.push({
      id: "api:unreachable",
      type: "api",
      severity: "CRITICAL",
      owner: "it",
      keys: ISSUE_KEYS.api,
      signals: {},
    });
  }

  /* 8 — Failed notification deliveries. */
  for (const failed of input.failedNotifications || []) {
    issues.push({
      id: `notification:${failed.id}`,
      type: "system",
      severity: "MEDIUM",
      owner: "it",
      keys: ISSUE_KEYS.notification,
      signals: { id: failed.id, reason: failed.reason ?? "unknown" },
    });
  }

  /* 9 — Documents about to lapse. */
  for (const doc of input.expiringDocuments || []) {
    if (doc.daysLeft > 14) continue;
    issues.push({
      id: `doc:${doc.id}`,
      type: "doc_expiry",
      severity: doc.daysLeft <= 3 ? "HIGH" : "MEDIUM",
      owner: "maintenance",
      keys: ISSUE_KEYS.docs,
      signals: { label: doc.label, days: doc.daysLeft },
    });
  }

  return issues.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

/** The routed alerts a given session may see — the single entry point for lists
 *  and badge counts, so a number can never exceed what the panel shows. */
export function visibleAlertsFor(alerts: RoutedAlert[], viewer: AlertViewer): RoutedAlert[] {
  return alerts.filter((alert) => isVisibleTo(alert, viewer));
}

/**
 * Adapter for the alerts the console already stores (`SmartAlert` in
 * fleetStore). Older records carry only a three-level severity, so the adapter
 * fills the canonical fields rather than forcing a data migration.
 */
export interface LegacyAlertShape {
  id: string;
  type: string;
  severity: string;
  severityLevel?: string;
  owner?: string;
  tripId?: string;
  truckId?: string;
  driverId?: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  reasonAr?: string;
  reasonEn?: string;
  actionAr?: string;
  actionEn?: string;
  timestamp: string;
  resolved: boolean;
  source?: string;
  dedupeKey?: string;
  detectedAt?: number;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  escalated?: boolean;
  escalatedTo?: string;
  escalatedAt?: string;
}

export function toRoutedAlert(raw: LegacyAlertShape): RoutedAlert {
  const type = (raw.type as AlertType) ?? "system";
  const severity = normalizeSeverity(raw.severityLevel ?? raw.severity);
  return {
    id: raw.id,
    type,
    severity,
    owner: (raw.owner as OwnerRole) ?? ownerFor(type),
    tripId: raw.tripId,
    truckId: raw.truckId,
    driverId: raw.driverId,
    titleAr: raw.titleAr,
    titleEn: raw.titleEn,
    descAr: raw.descAr,
    descEn: raw.descEn,
    reasonAr: raw.reasonAr,
    reasonEn: raw.reasonEn,
    actionAr: raw.actionAr,
    actionEn: raw.actionEn,
    timestamp: raw.timestamp,
    resolved: raw.resolved,
    source: (raw.source as RoutedAlert["source"]) ?? "telemetry",
    dedupeKey: raw.dedupeKey ?? dedupeKeyOf({ type, tripId: raw.tripId, truckId: raw.truckId }),
    detectedAt: raw.detectedAt ?? Date.now(),
    acknowledgedBy: raw.acknowledgedBy,
    acknowledgedAt: raw.acknowledgedAt,
    escalated: raw.escalated,
    escalatedTo: raw.escalatedTo as OwnerRole | undefined,
    escalatedAt: raw.escalatedAt,
  };
}
