import { useState } from "react";
import { cn } from "../../utils/cn";
import { useSettings } from "../../settings";
import type { Trip } from "../../state/fleetStore";
import { loadPct } from "./shared";

type Metric = "progress" | "distance" | "load";

interface Props {
  trips: Trip[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function TripBars({ trips, selectedId, onSelect }: Props) {
  const { t } = useSettings();
  const [metric, setMetric] = useState<Metric>("progress");
  const [hover, setHover] = useState<string | null>(null);

  const rows = trips.slice(0, 8).map((tr) => {
    const value =
      metric === "progress" ? tr.progressPct : metric === "distance" ? tr.distanceCoveredKm : loadPct(tr);
    return { tr, value };
  });
  const max = Math.max(1, ...rows.map((r) => r.value), metric === "distance" ? 0 : 100);
  const unit = metric === "distance" ? " km" : "%";

  const totalKm = trips.reduce((s, tr) => s + tr.distanceCoveredKm, 0);

  const METRICS: [Metric, string][] = [
    ["progress", t("Progress", "التقدم")],
    ["distance", t("Distance", "المسافة")],
    ["load", t("Load", "الحمولة")],
  ];

  return (
    <section className="card animate-fade-up flex flex-col p-5" style={{ animationDelay: "180ms" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-page-title font-semibold text-text-primary">{t("Shipment Statistic", "إحصائيات الرحلات")}</h2>
          <p className="mt-0.5 text-label-lg text-text-muted">
            {t(
              `${Math.round(totalKm).toLocaleString()} km covered across active trips`,
              `${Math.round(totalKm).toLocaleString("ar")} كم مقطوعة عبر الرحلات`,
            )}
          </p>
        </div>
        <div role="tablist" className="flex gap-1 rounded-full bg-surface-4 p-1">
          {METRICS.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={metric === id}
              onClick={() => setMetric(id)}
              className={cn(
                "rounded-full px-3 py-1 text-label-lg transition-all duration-200",
                metric === id ? "bg-brand font-semibold text-on-brand" : "text-text-secondary hover:text-text-primary",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex h-[190px] flex-1 items-end justify-between gap-2" key={metric}>
        {rows.map(({ tr, value }, i) => {
          const h = Math.max(6, (value / max) * 100);
          const isSel = tr.id === selectedId;
          const isHover = hover === tr.id;
          return (
            <button
              key={tr.id}
              onClick={() => onSelect(tr.id)}
              onMouseEnter={() => setHover(tr.id)}
              onMouseLeave={() => setHover(null)}
              aria-label={`${tr.tripNumber}: ${Math.round(value)}${unit}`}
              className="group relative flex h-full flex-1 flex-col items-center justify-end gap-2"
            >
              {(isHover || isSel) && (
                <span className="animate-fade-in absolute -top-1 z-10 rounded-full bg-text-primary px-2 py-0.5 text-label font-semibold whitespace-nowrap text-surface-0 tabular-nums">
                  {Math.round(value).toLocaleString()}
                  {unit}
                </span>
              )}
              <div className="relative flex w-full max-w-[18px] flex-1 items-end">
                <div className="absolute inset-0 rounded-full bg-surface-5/60" />
                <div
                  className={cn(
                    "animate-bar-grow relative w-full origin-bottom rounded-full transition-colors duration-300",
                    isSel ? "bg-brand" : isHover ? "bg-brand-soft" : "bg-text-secondary/45",
                  )}
                  style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
                />
              </div>
              <span className={cn("h-2 w-2 rounded-full transition-colors", isSel ? "bg-brand" : "bg-surface-6")} />
              <span className={cn("max-w-full truncate text-label tabular-nums", isSel ? "font-semibold text-text-primary" : "text-text-muted")}>
                {tr.tripNumber.slice(-4)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
