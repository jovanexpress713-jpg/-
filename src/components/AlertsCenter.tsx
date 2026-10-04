import { useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore, type SmartAlert } from "../state/fleetStore";
import {
  IconClose,
  IconCheck,
  IconBolt,
  IconArrowRight,
} from "./Icons";

interface AlertsCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrip?: (tripId: string) => void;
}

export function AlertsCenter({ isOpen, onClose, onSelectTrip }: AlertsCenterProps) {
  const { t } = useSettings();
  const { alerts, resolveAlert, selectTrip } = useFleetStore();
  const [filterSeverity, setFilterSeverity] = useState<"all" | "critical" | "warning" | "info">("all");

  if (!isOpen) return null;

  const filtered = alerts.filter(
    (a) => filterSeverity === "all" || a.severity === filterSeverity
  );

  const unresolvedCount = alerts.filter((a) => !a.resolved).length;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up scroll-thin relative max-h-[90vh] w-full max-w-[620px] overflow-y-auto rounded-[20px] bg-surface-2 p-6 shadow-2xl border border-border-subtle"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-subtle pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-status-danger/20 text-status-danger">
              <IconBolt size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[18px] font-bold text-text-primary">
                  {t("Smart Telemetry Alerts Center", "مركز التنبيهات المباشرة للأسطول")}
                </h3>
                {unresolvedCount > 0 && (
                  <span className="badge bg-status-danger text-white text-[10.5px]">
                    {unresolvedCount} {t("Active", "نشط")}
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-text-muted mt-0.5">
                {t(
                  "Real-time geofencing, temperature drift, speed limits, and highway alerts",
                  "مراقبة الانحراف عن المسار، التوقف غير المبرر، سلامة التبريد والسرعة القانونية"
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>

        {/* Severity Filter Tabs */}
        <div className="mt-4 flex items-center gap-1.5 rounded-full bg-surface-3 p-1">
          {(
            [
              ["all", t("All Alerts", "جميع التنبيهات")],
              ["critical", t("Critical", "حرج")],
              ["warning", t("Warning", "تحذير")],
              ["info", t("Information", "معلومة")],
            ] as const
          ).map(([sKey, sLabel]) => (
            <button
              key={sKey}
              onClick={() => setFilterSeverity(sKey)}
              className={cn(
                "flex-1 rounded-full py-1.5 text-[11.5px] font-medium transition-all text-center active:scale-95",
                filterSeverity === sKey
                  ? "bg-brand text-on-brand font-bold shadow-md"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {sLabel}
            </button>
          ))}
        </div>

        {/* Alerts List */}
        <div className="mt-4 space-y-3">
          {filtered.map((al: SmartAlert) => {
            const isCritical = al.severity === "critical";
            const isWarning = al.severity === "warning";

            return (
              <div
                key={al.id}
                /* Spec §4.2 — one card recipe; severity is carried by the
                   8px status dot and the pill, not by repainting the card. */
                className={cn(
                  "card",
                  al.resolved && "opacity-55",
                  !al.resolved && isCritical && "border-status-danger/40",
                  !al.resolved && isWarning && "border-status-waiting/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {/* Spec §4.2 — an 8px dot in the status colour. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        al.resolved
                          ? "bg-status-active"
                          : isCritical
                            ? "animate-pulse-dot bg-status-danger text-status-danger"
                            : isWarning
                              ? "bg-status-waiting"
                              : "bg-status-info",
                      )}
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        {/* Spec §4.2 — 14px title. */}
                        <span className="card-title">
                          {t(al.titleEn, al.titleAr)}
                        </span>
                      </div>
                      {/* Spec §4.2 — 12px description. */}
                      <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
                        {t(al.descEn, al.descAr)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {/* Spec §4.2 — 11px timestamp. */}
                    <span className="num text-[11px] text-text-muted">{al.timestamp}</span>
                    {al.resolved && (
                      <span className="pill pill-success">
                        ✓ {t("Resolved", "تمت المعالجة")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!al.resolved && (
                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-border-subtle/50 pt-2.5">
                    {al.tripId && (
                      <button
                        onClick={() => {
                          if (al.tripId) {
                            selectTrip(al.tripId);
                            if (onSelectTrip) onSelectTrip(al.tripId);
                            onClose();
                          }
                        }}
                        className="btn-ghost text-[11px] py-1 px-3"
                      >
                        {t("Inspect Trip", "فحص الرحلة")}
                        <IconArrowRight size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => resolveAlert(al.id)}
                      className="btn-primary text-[11px] py-1 px-3 font-semibold"
                    >
                      <IconCheck size={13} />
                      {t("Acknowledge & Resolve", "معالجة التنبيه")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="rounded-[14px] bg-surface-3 p-8 text-center text-text-muted text-[12.5px]">
              {t("No active alerts matching filter.", "لا توجد تنبيهات تطابق الفلتر المحدد.")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
