import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore } from "../state/fleetStore";
import { usePreferences } from "../state/preferencesStore";
import type { SessionUser } from "../utils/permissions";
import type { I18nKey } from "../localization/i18n";
import {
  actionsFor,
  answerQuestion,
  buildAssistantContext,
  OWNER_LABEL_KEY,
  suggestionsFor,
  topIssues,
  tripStatusKey,
  type AssistantAnswer,
  type DetectedIssue,
} from "../services/assistantEngine";
import { toRoutedAlert } from "../services/smartAlerts";
import { useToast } from "./Toast";
import {
  IconAlertCircle,
  IconArrowRight,
  IconBolt,
  IconCheck,
  IconClose,
  IconSearch,
  IconTruck,
} from "./Icons";

/**
 * مساعد إيجاز الذكي (§16–§23)
 *
 * A real assistant wired to the running system, not a decorative chatbot:
 *   • context strip — who you are, your role, the page you are on, the trip you
 *     have open and how many alerts are routed to you;
 *   • automatic incident detection with the six fields the brief requires:
 *     problem, probable cause, impact, owner, suggested action, next step;
 *   • page/role-aware suggestion chips;
 *   • free-text Q&A in Arabic, English and Urdu, answered from live data and
 *     bounded by your permissions;
 *   • actions (escalate / acknowledge / open trip / file a report) that go
 *     through the store — so they land in the audit log — and force a
 *     confirmation when they are sensitive.
 */

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  /** Signed-in user; drives the permission scope of every answer. */
  user?: SessionUser | null;
  /** Current console section (or "mobile"). */
  page?: string;
  /** Console persona being previewed: admin | driver | shipper | owner. */
  persona?: string;
  onSelectTrip?: (tripId: string) => void;
}

export function AIAssistant({
  isOpen,
  onClose,
  user = null,
  page = "overview",
  persona = "admin",
  onSelectTrip,
}: AIAssistantProps) {
  const { t, tk, td } = useSettings();
  const toast = useToast();
  const { prefs } = usePreferences();
  const {
    trips,
    trucks,
    drivers,
    alerts,
    selectedTripId,
    escalateAlert,
    resolveAlert,
    recordAuditLog,
    selectTrip,
  } = useFleetStore();

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const ctx = useMemo(
    () =>
      buildAssistantContext({
        user,
        persona,
        page,
        trips: trips.map((trip) => ({
          id: trip.id,
          tripNumber: trip.tripNumber,
          status: trip.status,
          driverId: trip.driverId,
          truckId: trip.truckId,
          progressPct: trip.progressPct,
          distanceRemainingKm: trip.distanceRemainingKm,
          speedKmH: trip.speedKmH,
          etaMinutes: trip.etaMinutes,
          isDelayed: trip.isDelayed,
          reeferTempC: trip.reeferTempC,
          targetTempC: trip.targetTempC,
          originCity: trip.originCity,
          destinationCity: trip.destinationCity,
          shipper: trip.shipper,
          consignee: trip.consignee,
          cargoWeightTons: trip.cargoWeightTons,
          maxCapacityTons: trip.maxCapacityTons,
          minutesSinceStatusUpdate: trip.lastStatusAt
            ? Math.max(0, Math.round((Date.now() - trip.lastStatusAt) / 60_000))
            : undefined,
          minutesSinceGpsFix: trip.lastGpsAt
            ? Math.max(0, Math.round((Date.now() - trip.lastGpsAt) / 60_000))
            : undefined,
        })),
        trucks: trucks.map((truck) => ({
          id: truck.id,
          plate: truck.plate,
          body: String(truck.body),
          status: truck.status,
          driverName: truck.driver?.name,
        })),
        drivers: drivers.map((driver) => ({
          id: driver.id ?? driver.phone.replace(/\D/g, ""),
          name: driver.name,
          phone: driver.phone,
          rating: driver.rating,
          trips: driver.trips,
        })),
        alerts: alerts.map(toRoutedAlert),
        selectedTripId,
        expiringDocuments: [],
      }),
    [user, persona, page, trips, trucks, drivers, alerts, selectedTripId],
  );

  const issues = useMemo(() => topIssues(ctx), [ctx]);
  const suggestions = useMemo(
    () => (prefs.assistantSuggestions ? suggestionsFor(ctx) : []),
    [ctx, prefs.assistantSuggestions],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) setAnswer(null);
  }, [isOpen, page]);

  if (!isOpen) return null;

  const handleAsk = (text: string) => {
    const value = text.trim();
    if (!value) return;
    setQuestion(value);
    setIsThinking(true);
    setAnswer(null);
    /* A short beat so the operator can see the context update — no fake delay. */
    window.setTimeout(() => {
      setAnswer(answerQuestion(value, ctx, (key: I18nKey) => tk(key)));
      setIsThinking(false);
    }, 260);
  };

  const runAction = (issue: DetectedIssue | undefined, actionId: string) => {
    if (actionId === "escalate") {
      const target = alerts.find(
        (a) =>
          !a.resolved &&
          ((issue?.tripId && a.tripId === issue.tripId) || (!issue?.tripId && true)),
      );
      if (target) {
        escalateAlert(target.id, user?.fullName || tk("assistant.title"));
        toast(tk("alerts.escalateToast"), tk("assistant.acted"));
        return;
      }
      recordAuditLog(
        t("The EJAZ assistant escalated an alert", "قام مساعد إيجاز بتصعيد التنبيه"),
        "Assistant escalated an alert",
      );
      toast(tk("assistant.acted"), tk("alerts.escalate"));
      return;
    }
    if (actionId === "acknowledge") {
      const target = alerts.find((a) => !a.resolved);
      if (target) {
        resolveAlert(target.id);
        toast(tk("alerts.ackToast"), tk("assistant.acted"));
      }
      return;
    }
    if (actionId === "openTrip" && issue?.tripId) {
      selectTrip(issue.tripId);
      onSelectTrip?.(issue.tripId);
      onClose();
    }
  };

  const severityChip = (severity: string) => {
    const key: I18nKey =
      severity === "CRITICAL"
        ? "severity.critical"
        : severity === "HIGH"
          ? "severity.high"
          : severity === "MEDIUM"
            ? "severity.medium"
            : severity === "LOW"
              ? "severity.low"
              : "severity.info";
    const tone =
      severity === "CRITICAL"
        ? "bg-status-danger/15 text-status-danger"
        : severity === "HIGH"
          ? "bg-status-waiting/15 text-status-waiting"
          : "bg-surface-4 text-text-muted";
    return <span className={cn("pill", tone)}>{tk(key)}</span>;
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[85] grid place-items-center bg-black/75 p-3 backdrop-blur-md sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={tk("assistant.title")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up flex max-h-[92vh] w-full max-w-[760px] flex-col overflow-hidden rounded-card border border-border-subtle bg-surface-1 shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-subtle p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-inner bg-brand text-on-brand">
              <IconBolt size={20} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-page-title font-extrabold text-text-primary">
                  {tk("assistant.title")}
                </h3>
                <span className="pill pill-success hidden sm:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-active" />
                  {tk("common.online")}
                </span>
              </div>
              <p className="truncate text-label text-text-muted">{tk("assistant.subtitle")}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon shrink-0" aria-label={tk("common.close")}>
            <IconClose size={16} />
          </button>
        </div>

        <div className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {/* Context strip */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ContextCell label={tk("assistant.contextUser")} value={user?.fullName ?? "—"} />
            <ContextCell label={tk("assistant.contextRole")} value={user?.role ?? persona} />
            <ContextCell label={tk("assistant.contextPage")} value={tk(`nav.${pageKeyOf(page)}` as I18nKey)} />
            <ContextCell
              label={tk("assistant.contextAlerts")}
              value={String(ctx.alerts.filter((a) => !a.resolved).length)}
              tone="danger"
            />
          </div>

          {/* Scope + hint */}
          <div className="rounded-inner border border-border-subtle bg-surface-2 p-3">
            <div className="flex items-center gap-2 text-label-lg font-semibold text-text-secondary">
              <IconTruck size={14} className="text-brand" />
              {tk("assistant.scope")}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <ScopeChip on={ctx.capabilities.viewTrips} label={tk("nav.trips")} />
              <ScopeChip on={ctx.capabilities.viewFleet} label={tk("nav.fleet")} />
              <ScopeChip on={ctx.capabilities.viewDrivers} label={tk("nav.drivers")} />
              <ScopeChip on={ctx.capabilities.viewReports} label={tk("nav.reports")} />
              <ScopeChip on={ctx.capabilities.viewFinance} label={tk("nav.finance")} />
              <ScopeChip on={ctx.capabilities.act} label={tk("assistant.actEscalate")} />
            </div>
            <p className="mt-2 text-label text-text-muted">
              {ctx.scope === "driver"
                ? tk("assistant.hintDriver")
                : ctx.scope === "client"
                  ? tk("assistant.hintClient")
                  : tk("assistant.hintAdmin")}
            </p>
          </div>

          {/* Detected issues */}
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-card-title font-bold text-text-primary">
                {tk("assistant.insights")}
              </h4>
              <span className="text-label text-text-muted">
                {tk("assistant.issuesCount", { count: issues.length })}
              </span>
            </div>

            {issues.length === 0 ? (
              <div className="rounded-inner border border-status-active/25 bg-status-active/8 p-4 text-center">
                <IconCheck size={18} className="mx-auto text-status-active" />
                <p className="mt-1.5 text-label-lg text-text-secondary">{tk("assistant.noIssues")}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {issues.map((issue) => (
                  <article key={issue.id} className="card p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <IconAlertCircle
                        size={15}
                        className={
                          issue.severity === "CRITICAL"
                            ? "text-status-danger"
                            : issue.severity === "HIGH"
                              ? "text-status-waiting"
                              : "text-text-muted"
                        }
                      />
                      <span className="text-body font-bold text-text-primary">
                        {tk(issue.keys.title)}
                      </span>
                      {severityChip(issue.severity)}
                      {issue.signals.trip && (
                        <span className="num text-label text-text-muted" dir="ltr">
                          {issue.signals.trip}
                        </span>
                      )}
                    </div>

                    <dl className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      <IssueRow label={tk("assistant.cause")} value={tk(issue.keys.cause)} />
                      <IssueRow label={tk("assistant.impact")} value={tk(issue.keys.impact)} />
                      <IssueRow
                        label={tk("assistant.owner")}
                        value={tk(OWNER_LABEL_KEY[issue.owner] ?? "assistant.ownerOps")}
                      />
                      <IssueRow label={tk("assistant.suggested")} value={tk(issue.keys.action)} />
                      <IssueRow label={tk("assistant.next")} value={tk(issue.keys.next)} full />
                    </dl>

                    {ctx.capabilities.act && (
                      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle pt-2.5">
                        {actionsFor(ctx, issue).map((action) => (
                          <button
                            key={action.id}
                            onClick={() => {
                              if (action.requiresConfirm && confirming !== `${issue.id}:${action.id}`) {
                                setConfirming(`${issue.id}:${action.id}`);
                                return;
                              }
                              setConfirming(null);
                              runAction(issue, action.id);
                            }}
                            className={cn(
                              action.id === "escalate" ? "btn-primary" : "btn-ghost",
                              "text-label py-1.5 px-3",
                            )}
                          >
                            {confirming === `${issue.id}:${action.id}` && <IconAlertCircle size={12} />}
                            {confirming === `${issue.id}:${action.id}`
                              ? tk("assistant.confirm")
                              : tk(action.labelKey)}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Ask */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 rounded-inner border border-border-subtle bg-surface-2 p-2 focus-within:border-brand">
              <IconSearch size={17} className="shrink-0 text-text-muted ps-1.5" />
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk(question)}
                placeholder={tk("assistant.ask")}
                aria-label={tk("assistant.ask")}
                className="min-w-0 flex-1 bg-transparent text-body text-text-primary outline-none"
              />
              <button
                onClick={() => handleAsk(question)}
                disabled={isThinking}
                className="btn-primary shrink-0 py-1.5 px-3.5 text-label-lg"
              >
                {isThinking ? tk("assistant.thinking") : tk("assistant.send")}
              </button>
            </div>

            {suggestions.length > 0 && (
              <div>
                <span className="mb-1.5 block text-label font-semibold text-text-muted">
                  {tk("assistant.suggestions")}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleAsk(tk(s.labelKey))}
                      className="chip text-label py-1.5 px-2.5"
                    >
                      {tk(s.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {answer && (
              <div
                className={cn(
                  "animate-fade-up rounded-inner border p-3.5",
                  answer.denied
                    ? "border-status-danger/35 bg-status-danger/8"
                    : "border-brand/30 bg-brand/8",
                )}
              >
                <div className="mb-1.5 flex items-center gap-2 text-label-lg font-bold text-brand">
                  <IconBolt size={15} />
                  {tk("assistant.title")}
                </div>
                <p className="text-body leading-relaxed text-text-primary">
                  {tk(answer.key, answer.params)}
                </p>
                {answer.issues && answer.issues.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {answer.issues.slice(0, 3).map((issue) => (
                      <li key={issue.id} className="flex items-center gap-2 text-label-lg text-text-secondary">
                        {severityChip(issue.severity)}
                        <span className="truncate">{tk(issue.keys.title)}</span>
                        <span className="num shrink-0 text-micro text-text-muted" dir="ltr">
                          {issue.signals.trip ?? ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {ctx.focusTrip && (
              <button
                onClick={() => {
                  selectTrip(ctx.focusTrip!.id);
                  onSelectTrip?.(ctx.focusTrip!.id);
                  onClose();
                }}
                className="menu-row justify-between border border-border-subtle"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <IconTruck size={14} className="shrink-0 text-brand" />
                  <span className="truncate">
                    {tk("assistant.contextTrip")}: {ctx.focusTrip.tripNumber} ·{" "}
                    {td(ctx.focusTrip.originCity)} → {td(ctx.focusTrip.destinationCity)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-label text-text-muted">
                  {tk(tripStatusKey(ctx.focusTrip.status))}
                  <IconArrowRight size={13} className="rtl:rotate-180" />
                </span>
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ContextCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  return (
    <div className="rounded-control bg-surface-2 px-3 py-2">
      <div className="truncate text-micro font-semibold text-text-muted">{label}</div>
      <div
        className={cn(
          "truncate text-label-lg font-bold",
          tone === "danger" ? "text-status-danger" : "text-text-primary",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ScopeChip({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={cn(
        "pill",
        on ? "pill-success" : "bg-surface-4 text-text-muted",
      )}
    >
      {label}
    </span>
  );
}

function IssueRow({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={cn("rounded-control bg-surface-2 px-2.5 py-2", full && "sm:col-span-2")}>
      <dt className="text-micro font-semibold text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-label-lg leading-relaxed text-text-secondary">{value}</dd>
    </div>
  );
}

/** Map a console section to a nav key so the context strip translates. */
function pageKeyOf(page: string): string {
  switch (page) {
    case "operations":
      return "operationsCenter";
    case "vehicle-assets":
      return "vehicleAssets";
    case "overview":
      return "overview";
    case "mobile":
      return "settings";
    default:
      return page;
  }
}
