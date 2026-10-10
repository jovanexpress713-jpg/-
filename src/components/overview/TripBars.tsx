import { useMemo, useState } from "react";
import { cn } from "../../utils/cn";
import { useSettings } from "../../settings";
import type { Trip } from "../../state/fleetStore";
import { loadPct, STATUS_LABEL } from "./shared";
import { TruckTypeAvatar } from "../TruckTypeIcon";
import { IconTracking } from "../Icons";

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

  const rows = useMemo(() => {
    return trips.slice(0, 8).map((tr) => {
      const value =
        metric === "progress" ? tr.progressPct : metric === "distance" ? tr.distanceCoveredKm : loadPct(tr);
      return { tr, value };
    });
  }, [trips, metric]);

  const max = useMemo(() => {
    if (metric === "distance") {
      const rawMax = Math.max(10, ...rows.map((r) => r.value));
      return Math.ceil(rawMax / 100) * 100 || 100;
    }
    return 100;
  }, [rows, metric]);

  const unit = metric === "distance" ? ` ${t("km", "كم")}` : "%";

  const totalKm = useMemo(() => trips.reduce((s, tr) => s + tr.distanceCoveredKm, 0), [trips]);
  const avgValue = useMemo(() => {
    if (!rows.length) return 0;
    return rows.reduce((s, r) => s + r.value, 0) / rows.length;
  }, [rows]);

  const topRow = useMemo(() => {
    if (!rows.length) return null;
    return [...rows].sort((a, b) => b.value - a.value)[0];
  }, [rows]);

  const METRICS: { id: Metric; label: string; unitLabel: string }[] = [
    { id: "progress", label: t("Progress", "التقدم", "پیش رفت"), unitLabel: "%" },
    { id: "distance", label: t("Distance", "المسافة", "فاصلہ"), unitLabel: t("km", "كم", "کلومیٹر") },
    { id: "load", label: t("Payload", "الحمولة", "لوڈ"), unitLabel: "%" },
  ];

  // Active tooltip target (either hovered trip or currently selected trip)
  const activeHoverTarget = useMemo(() => {
    const targetId = hover ?? selectedId;
    return rows.find((r) => r.tr.id === targetId) ?? null;
  }, [hover, selectedId, rows]);

  return (
    <section className="card animate-fade-up relative flex flex-col overflow-hidden p-4 sm:p-5" style={{ animationDelay: "180ms" }}>
      {/* Background ambient radial glow */}
      <div className="pointer-events-none absolute -start-16 -top-16 h-48 w-48 rounded-full bg-sky-500/5 blur-3xl" />

      {/* Header with Title, Live Status & Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-page-title font-semibold text-text-primary">
              {t("Shipment Statistic", "إحصائيات وتحليلات الرحلات", "ٹرپ شماریات")}
            </h2>
            <span className="flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-micro font-medium text-sky-400">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
              {t("Telemetry Active", "مراقبة حية", "براہ راست نگرانی")}
            </span>
          </div>
          <p className="mt-0.5 text-label-lg text-text-muted">
            {metric === "distance"
              ? t(
                  `${Math.round(totalKm).toLocaleString()} km covered across active trips`,
                  `${Math.round(totalKm).toLocaleString("ar")} كم مقطوعة عبر الرحلات الجارية`,
                  `${Math.round(totalKm).toLocaleString()} کلومیٹر فعال ٹرپس میں طے شدہ`,
                )
              : metric === "progress"
              ? t(
                  `Fleet average completion rate: ${Math.round(avgValue)}%`,
                  `متوسط نسبة إنجاز الأسطول: ${Math.round(avgValue)}%`,
                  `بیڑے کی اوسط پیش رفت: ${Math.round(avgValue)}%`,
                )
              : t(
                  `Average payload utilization: ${Math.round(avgValue)}%`,
                  `متوسط إشغال حمولة الشاحنات: ${Math.round(avgValue)}%`,
                  `اوسط لوڈ استعمال: ${Math.round(avgValue)}%`,
                )}
          </p>
        </div>

        {/* Tab Controls */}
        <div role="tablist" className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface-2/90 p-1 backdrop-blur-sm">
          {METRICS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={metric === id}
              onClick={() => setMetric(id)}
              className={cn(
                "rounded-full px-3 py-1 text-label font-medium transition-all duration-200",
                metric === id
                  ? "bg-brand font-semibold text-on-brand shadow-xs"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Active Trip HUD Card Inspector */}
      {activeHoverTarget && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-inner border border-brand/35 bg-surface-2/90 px-3 py-2 text-micro shadow-sm backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="shrink-0">
              <TruckTypeAvatar truckType={activeHoverTarget.tr.cargoType} size={28} iconSize={15} showBadge={false} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                <span>#{activeHoverTarget.tr.tripNumber}</span>
                <span className="text-text-muted">·</span>
                <span className="truncate text-text-secondary">{activeHoverTarget.tr.shipper} ➔ {activeHoverTarget.tr.destination}</span>
              </div>
              <div className="text-text-muted">
                {t("Status:", "الحالة:", "حالت:")}{" "}
                <span className="font-medium text-brand">
                  {t(STATUS_LABEL[activeHoverTarget.tr.status]?.[0] ?? activeHoverTarget.tr.status, STATUS_LABEL[activeHoverTarget.tr.status]?.[1] ?? activeHoverTarget.tr.status)}
                </span>
                {activeHoverTarget.tr.driverName ? ` · ${activeHoverTarget.tr.driverName}` : ""}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-end">
            <div className="text-page-title font-bold tabular-nums text-brand drop-shadow-xs">
              {Math.round(activeHoverTarget.value).toLocaleString()}{unit}
            </div>
            <div className="text-micro text-text-muted">
              {t("Click to focus", "انقر للتركيز على الشاحنة", "ٹرک پر فوکس کرنے کے لیے کلک کریں")}
            </div>
          </div>
        </div>
      )}

      {/* Futuristic Interactive Chart Canvas */}
      <div className="relative mt-4 flex h-[210px] flex-1 flex-col justify-end">
        {/* Y-Axis Reference Guidelines */}
        <div className="pointer-events-none absolute inset-x-0 bottom-8 top-0 flex flex-col justify-between opacity-35">
          {[100, 75, 50, 25, 0].map((pct) => (
            <div key={pct} className="relative flex w-full items-center border-b border-dashed border-border-subtle/50">
              <span className="absolute -start-1 -top-2.5 font-mono text-micro tabular-nums text-text-muted">
                {metric === "distance" ? Math.round((pct / 100) * max) : pct}%
              </span>
            </div>
          ))}
        </div>

        {/* Dynamic Fleet Benchmark Average Line */}
        {avgValue > 0 && max > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 transition-all duration-500 ease-out"
            style={{ bottom: `calc(32px + ${(avgValue / max) * 150}px)` }}
          >
            <div className="relative flex w-full items-center">
              <div className="w-full border-t border-dashed border-amber-400/70 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
              <span className="absolute end-0 -top-3 rounded-control border border-amber-400/40 bg-surface-1/95 px-1.5 py-0.5 text-micro font-semibold text-amber-400 shadow-xs">
                {t("Avg", "المتوسط", "اوسط")}: {Math.round(avgValue)}{unit}
              </span>
            </div>
          </div>
        )}

        {/* Interactive Column Pillars */}
        <div className="relative z-20 flex h-[165px] items-end justify-between gap-1 sm:gap-2.5">
          {rows.map(({ tr, value }, i) => {
            const h = Math.max(8, Math.min(100, (value / max) * 100));
            const isSel = tr.id === selectedId;
            const isHover = hover === tr.id;

            // Column gradients depending on metric
            const gradClass =
              metric === "distance"
                ? "bg-gradient-to-t from-blue-700 via-sky-500 to-cyan-300"
                : metric === "load"
                ? "bg-gradient-to-t from-emerald-700 via-teal-500 to-emerald-300"
                : "bg-gradient-to-t from-orange-600 via-brand to-amber-300";

            return (
              <button
                key={tr.id}
                type="button"
                onClick={() => onSelect(tr.id)}
                onMouseEnter={() => setHover(tr.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(tr.id)}
                onBlur={() => setHover(null)}
                aria-label={`${tr.tripNumber}: ${Math.round(value)}${unit}`}
                className="group relative flex h-full flex-1 flex-col items-center justify-end focus:outline-none"
              >
                {/* Floating Micro Badge on Top of Bar */}
                {(isHover || isSel) && (
                  <span className="animate-fade-in absolute -top-7 z-30 flex items-center gap-1 rounded-control border border-brand/40 bg-surface-1 px-2 py-0.5 text-micro font-bold tabular-nums text-brand shadow-md">
                    <span>{Math.round(value).toLocaleString()}{unit}</span>
                  </span>
                )}

                {/* Vertical Ambient Light Beam on hover */}
                {isHover && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0 rounded-inner bg-brand/5 blur-xs" />
                )}

                {/* Cyber Cylindrical Tube */}
                <div
                  className={cn(
                    "relative flex w-full max-w-[22px] flex-1 items-end overflow-hidden rounded-full border transition-all duration-300 sm:max-w-[26px]",
                    isSel
                      ? "border-brand bg-brand/10 shadow-[0_0_15px_rgba(255,107,26,0.3)] ring-2 ring-brand/40"
                      : isHover
                      ? "border-border-strong bg-surface-3 shadow-md"
                      : "border-border-subtle/60 bg-surface-3/60",
                  )}
                >
                  {/* Internal Bar Fill */}
                  <div
                    className={cn(
                      "relative w-full origin-bottom rounded-full transition-all duration-500 ease-out",
                      gradClass,
                    )}
                    style={{
                      height: `${h}%`,
                      animationDelay: `${i * 50}ms`,
                    }}
                  >
                    {/* Glowing LED Cap at top of bar */}
                    <div className="absolute inset-x-0 top-0 h-1.5 rounded-full bg-white/95 shadow-[0_0_8px_#ffffff]" />
                  </div>
                </div>

                {/* Base Marker & Identification */}
                <div className="mt-2 flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-all duration-200",
                      isSel ? "h-2 w-2 bg-brand shadow-[0_0_6px_var(--color-brand)] animate-pulse" : isHover ? "bg-brand-soft" : "bg-surface-6",
                    )}
                  />
                  <span
                    className={cn(
                      "truncate font-mono text-[11px] tabular-nums transition-colors",
                      isSel ? "font-bold text-brand" : isHover ? "font-semibold text-text-primary" : "text-text-muted",
                    )}
                  >
                    #{tr.tripNumber.slice(-4)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary Footer Telemetry Rail */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle/60 pt-3 text-micro text-text-muted">
        {topRow && (
          <div className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand/15 text-brand">
              <IconTracking size={10} />
            </span>
            <span>
              {t("Top Active Trip:", "الرحلة الأعلى أداءً:", "بہترین فعال ٹرپ:")}{" "}
              <strong className="text-text-primary">
                #{topRow.tr.tripNumber} ({Math.round(topRow.value)}{unit})
              </strong>
            </span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <span>
            {t("Fleet Average:", "متوسط الأسطول:", "بیڑے کی اوسط:")}{" "}
            <strong className="text-text-secondary">{Math.round(avgValue)}{unit}</strong>
          </span>
          <span className="text-border-subtle">|</span>
          <span>
            {t("Active Visible:", "الرحلات المعروضة:", "دستیاب ٹرپس:")}{" "}
            <strong className="text-text-primary">{rows.length}</strong>
          </span>
        </div>
      </div>
    </section>
  );
}

