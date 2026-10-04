import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore } from "../state/fleetStore";
import { usePreferences } from "../state/preferencesStore";
import type { SessionUser } from "../utils/permissions";
import type { I18nKey } from "../localization/i18n";
import {
  canActOn,
  isVisibleTo,
  toRoutedAlert,
  type AlertType,
  type RoutedAlert,
  type Severity,
} from "../services/smartAlerts";
import { useToast } from "./Toast";
import { IconArrowRight, IconBell, IconBolt, IconCheck, IconClose } from "./Icons";

/**
 * مركز الإشعارات الذكية (§15, §21)
 *
 * Every row answers the six questions the brief requires — what happened, its
 * type, its severity, when it fired, why it fired and what the owner must do —
 * and the list itself is *routed*: an alert only reaches the persona/role that
 * owns it (see `smartAlerts.isVisibleTo`). Unhandled alerts can be escalated one
 * severity step to the next owner, and every acknowledgement is stamped on the
 * record and written to the audit log.
 */

interface AlertsCenterProps {
  isOpen: boolean;
  onClose: () => void;
  /** Signed-in user — decides which alerts are routed to this session. */
  user?: SessionUser | null;
  onSelectTrip?: (tripId: string) => void;
}

const SEVERITY_KEY: Record<Severity, I18nKey> = {
  INFO: "severity.info",
  LOW: "severity.low",
  MEDIUM: "severity.medium",
  HIGH: "severity.high",
  CRITICAL: "severity.critical",
};

const TYPE_KEY: Record<AlertType, I18nKey> = {
  delay: "alertType.delay",
  off_route: "alertType.off_route",
  idle: "alertType.idle",
  temp: "alertType.temp",
  doc_expiry: "alertType.doc_expiry",
  speed: "alertType.speed",
  utilization: "alertType.utilization",
  gps: "alertType.gps",
  api: "alertType.api",
  sync: "alertType.sync",
  auth: "alertType.auth",
  system: "alertType.system",
};

const FILTERS: { id: "all" | Severity; key: I18nKey }[] = [
  { id: "all", key: "alerts.all" },
  { id: "CRITICAL", key: "severity.critical" },
  { id: "HIGH", key: "severity.high" },
  { id: "MEDIUM", key: "severity.medium" },
  { id: "LOW", key: "severity.low" },
  { id: "INFO", key: "severity.info" },
];

export function AlertsCenter({ isOpen, onClose, user = null, onSelectTrip }: AlertsCenterProps) {
  const { t, tk, td } = useSettings();
  const toast = useToast();
  const { prefs } = usePreferences();
  const { alerts, resolveAlert, escalateAlert, selectTrip, currentRole, recordAuditLog } = useFleetStore();
  const [filter, setFilter] = useState<"all" | Severity>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const viewer = useMemo(
    () => ({
      persona: currentRole,
      apiRole: user?.role,
      permissions: user?.permissions,
      userId: user?.id,
      driverId: user?.driverId,
    }),
    [currentRole, user],
  );

  /** Routing + preference filtering — nothing is broadcast to everyone. */
  const routed = useMemo(() => {
    return alerts
      .map(toRoutedAlert)
      .filter((a) => isVisibleTo(a, viewer))
      .filter((a) => {
        if (a.resolved) return true;
        if (a.severity === "CRITICAL" && !prefs.notifyCritical) return false;
        if (a.type === "doc_expiry" && !prefs.notifyDocs) return false;
        if (a.type !== "doc_expiry" && a.severity !== "CRITICAL" && !prefs.notifyOps) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
        const order: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
        return order.indexOf(a.severity) - order.indexOf(b.severity);
      });
  }, [alerts, viewer, prefs]);

  const unread = routed.filter((a) => !a.resolved);
  const filtered = filter === "all" ? routed : routed.filter((a) => a.severity === filter);

  if (!isOpen) return null;

  const handleAck = (alert: RoutedAlert) => {
    if (!canActOn(alert, viewer)) {
      toast(tk("alerts.denied"), tk("alerts.center"));
      return;
    }
    setBusy(alert.id);
    resolveAlert(alert.id);
    /* Traceable: who acknowledged what, straight into the audit ledger (§22). */
    recordAuditLog(
      `معالجة تنبيه (${alert.type}) بواسطة ${user?.fullName || "user"}`,
      `Alert acknowledged (${alert.type}) by ${user?.fullName || "user"}`,
      alert.tripId,
      alert.titleEn,
    );
    toast(tk("alerts.ackToast"), t(alert.titleEn, alert.titleAr));
    setBusy(null);
  };

  const handleEscalate = (alert: RoutedAlert) => {
    if (!canActOn(alert, viewer)) {
      toast(tk("alerts.denied"), tk("alerts.center"));
      return;
    }
    escalateAlert(alert.id, user?.fullName || "user");
    toast(tk("alerts.escalateToast"), t(alert.titleEn, alert.titleAr));
  };

  const severityTone = (severity: Severity) =>
    severity === "CRITICAL"
      ? "text-status-danger"
      : severity === "HIGH"
        ? "text-status-waiting"
        : severity === "MEDIUM"
          ? "text-status-info"
          : "text-text-muted";

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[90] grid place-items-center bg-black/80 p-3 backdrop-blur-md sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={tk("alerts.center")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up flex max-h-[90vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[20px] border border-border-subtle bg-surface-1 shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-subtle p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-status-danger/15 text-status-danger">
              <IconBell size={18} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-[var(--type-page-title)] font-extrabold text-text-primary">
                  {tk("alerts.center")}
                </h3>
                {unread.length > 0 && (
                  <span className="pill bg-status-danger/15 text-status-danger">
                    {unread.length} {tk("alerts.unread")}
                  </span>
                )}
              </div>
              <p className="truncate text-[11px] text-text-muted">{tk("alerts.subtitle")}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon shrink-0" aria-label={tk("common.close")}>
            <IconClose size={16} />
          </button>
        </div>

        {/* Severity filter */}
        <div className="scroll-x shrink-0 gap-1.5 border-b border-border-subtle p-2.5">
          <div className="flex gap-1.5">
            {FILTERS.map((f) => {
              const count = f.id === "all" ? routed.length : routed.filter((a) => a.severity === f.id).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors",
                    filter === f.id
                      ? "bg-brand text-on-brand"
                      : "bg-surface-2 text-text-secondary hover:bg-surface-3",
                  )}
                >
                  {tk(f.key)}
                  <span className="num text-[10px] opacity-80">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div className="scroll-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3.5">
          {filtered.map((alert) => {
            const actionable = canActOn(alert, viewer);
            return (
              <article
                key={alert.id}
                className={cn(
                  "card p-3.5",
                  alert.resolved && "opacity-60",
                  !alert.resolved && alert.severity === "CRITICAL" && "border-status-danger/40",
                  !alert.resolved && alert.severity === "HIGH" && "border-status-waiting/40",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        alert.resolved
                          ? "bg-status-active"
                          : alert.severity === "CRITICAL"
                            ? "animate-pulse-dot bg-status-danger text-status-danger"
                            : alert.severity === "HIGH"
                              ? "bg-status-waiting"
                              : "bg-status-info",
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="card-title">{t(alert.titleEn, alert.titleAr)}</span>
                        <span className={cn("pill bg-surface-4", severityTone(alert.severity))}>
                          {tk(SEVERITY_KEY[alert.severity])}
                        </span>
                        <span className="pill bg-surface-4 text-text-muted">
                          {tk(TYPE_KEY[alert.type] ?? "alertType.system")}
                        </span>
                        {alert.escalated && (
                          <span className="pill bg-status-danger/15 text-status-danger">
                            <IconBolt size={11} /> {tk("alerts.escalated")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">
                        {t(alert.descEn, alert.descAr)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="num text-[11px] text-text-muted">{td(alert.timestamp)}</span>
                    {alert.resolved && (
                      <span className="pill pill-success">
                        <IconCheck size={11} /> {tk("alerts.resolved")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Reason + required action — the two fields operators act on. */}
                {(alert.reasonAr || alert.actionAr || alert.reasonEn || alert.actionEn) && (
                  <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {(alert.reasonAr || alert.reasonEn) && (
                      <div className="rounded-[10px] bg-surface-2 px-2.5 py-2">
                        <div className="text-[10px] font-semibold text-text-muted">
                          {tk("alerts.reason")}
                        </div>
                        <div className="mt-0.5 text-[11.5px] leading-relaxed text-text-secondary">
                          {t(alert.reasonEn ?? "", alert.reasonAr ?? "")}
                        </div>
                      </div>
                    )}
                    {(alert.actionAr || alert.actionEn) && (
                      <div className="rounded-[10px] bg-surface-2 px-2.5 py-2">
                        <div className="text-[10px] font-semibold text-text-muted">
                          {tk("alerts.action")}
                        </div>
                        <div className="mt-0.5 text-[11.5px] leading-relaxed text-text-secondary">
                          {t(alert.actionEn ?? "", alert.actionAr ?? "")}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
                  <span className="text-[10.5px] text-text-muted">
                    {tk("alerts.owner")}:{" "}
                    {tk(`alertOwner.${alert.owner}` as I18nKey, {})}
                    {alert.acknowledgedAt && ` · ${tk("alerts.ackBy")} ${alert.acknowledgedAt.slice(11, 16)}`}
                  </span>
                  <div className="flex items-center gap-2">
                    {alert.tripId && (
                      <button
                        onClick={() => {
                          selectTrip(alert.tripId!);
                          onSelectTrip?.(alert.tripId!);
                          onClose();
                        }}
                        className="btn-ghost py-1 px-3 text-[11px]"
                      >
                        {tk("alerts.inspectTrip")}
                        <IconArrowRight size={12} className="rtl:rotate-180" />
                      </button>
                    )}
                    {!alert.resolved && (
                      <>
                        <button
                          onClick={() => handleEscalate(alert)}
                          disabled={!actionable}
                          title={actionable ? undefined : tk("alerts.denied")}
                          className="btn-ghost py-1 px-3 text-[11px] disabled:opacity-40"
                        >
                          <IconBolt size={12} /> {tk("alerts.escalate")}
                        </button>
                        <button
                          onClick={() => handleAck(alert)}
                          disabled={!actionable || busy === alert.id}
                          title={actionable ? undefined : tk("alerts.denied")}
                          className="btn-primary py-1 px-3 text-[11px] disabled:opacity-40"
                        >
                          <IconCheck size={12} /> {tk("alerts.ack")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {filtered.length === 0 && (
            <div className="rounded-[14px] border border-border-subtle bg-surface-2 p-8 text-center">
              <IconCheck size={20} className="mx-auto text-status-active" />
              <p className="mt-2 text-[12.5px] font-semibold text-text-primary">{tk("alerts.empty")}</p>
              <p className="mt-1 text-[11px] text-text-muted">{tk("alerts.emptyHint")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
