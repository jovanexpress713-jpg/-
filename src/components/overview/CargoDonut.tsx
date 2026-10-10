import { useMemo, useState } from "react";
import { cn } from "../../utils/cn";
import { useSettings } from "../../settings";
import type { Trip } from "../../state/fleetStore";
import { CARGO_LABEL, useCountUp } from "./shared";
import { TruckTypeAvatar } from "../TruckTypeIcon";

interface CargoSegment {
  type: string;
  gradId: string;
  glowColor: string;
  primaryColor: string;
  tons: number;
  tripCount: number;
  percentage: number;
}

const SEGMENT_CONFIG = [
  {
    type: "flatbed",
    gradId: "donut-grad-flatbed",
    glowColor: "rgba(16, 185, 129, 0.4)",
    primaryColor: "#10b981",
    stops: ["#059669", "#10b981", "#34d399"],
  },
  {
    type: "reefer",
    gradId: "donut-grad-reefer",
    glowColor: "rgba(14, 165, 233, 0.4)",
    primaryColor: "#0ea5e9",
    stops: ["#0284c7", "#0ea5e9", "#38bdf8"],
  },
  {
    type: "dry",
    gradId: "donut-grad-dry",
    glowColor: "rgba(245, 158, 11, 0.4)",
    primaryColor: "#f59e0b",
    stops: ["#d97706", "#f59e0b", "#fbbf24"],
  },
  {
    type: "curtain",
    gradId: "donut-grad-curtain",
    glowColor: "rgba(139, 92, 246, 0.4)",
    primaryColor: "#8b5cf6",
    stops: ["#7c3aed", "#8b5cf6", "#c084fc"],
  },
];

export function CargoDonut({ trips }: { trips: Trip[] }) {
  const { t } = useSettings();
  const [hover, setHover] = useState<number | null>(null);
  const [metricMode, setMetricMode] = useState<"tons" | "trips">("tons");

  const segments: CargoSegment[] = useMemo(() => {
    const raw = SEGMENT_CONFIG.map((cfg) => {
      const matching = trips.filter((tr) => tr.cargoType === cfg.type);
      const tons = matching.reduce((sum, tr) => sum + tr.cargoWeightTons, 0);
      const tripCount = matching.length;
      return {
        type: cfg.type,
        gradId: cfg.gradId,
        glowColor: cfg.glowColor,
        primaryColor: cfg.primaryColor,
        tons,
        tripCount,
        percentage: 0,
      };
    });

    const totalVal = raw.reduce((sum, s) => sum + (metricMode === "tons" ? s.tons : s.tripCount), 0);
    return raw.map((s) => ({
      ...s,
      percentage: totalVal > 0 ? ((metricMode === "tons" ? s.tons : s.tripCount) / totalVal) * 100 : 0,
    }));
  }, [trips, metricMode]);

  const totalTons = useMemo(() => segments.reduce((sum, x) => sum + x.tons, 0), [segments]);
  const totalTrips = useMemo(() => segments.reduce((sum, x) => sum + x.tripCount, 0), [segments]);

  const activeValue = useMemo(() => {
    if (hover === null) {
      return metricMode === "tons" ? totalTons : totalTrips;
    }
    return metricMode === "tons" ? segments[hover].tons : segments[hover].tripCount;
  }, [hover, metricMode, totalTons, totalTrips, segments]);

  const shownValue = useCountUp(activeValue);

  // Dominant category
  const dominantSegment = useMemo(() => {
    return [...segments].sort((a, b) => (metricMode === "tons" ? b.tons - a.tons : b.tripCount - a.tripCount))[0];
  }, [segments, metricMode]);

  // SVG Geometry
  const r = 70;
  const c = 2 * Math.PI * r;
  const currentTotal = metricMode === "tons" ? totalTons : totalTrips;
  const gap = currentTotal > 0 ? 5 : 0;
  let offset = 0;

  return (
    <section className="card animate-fade-up relative flex flex-col overflow-hidden p-4 sm:p-5" style={{ animationDelay: "120ms" }}>
      {/* Background ambient radial glow */}
      <div className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-brand/5 blur-3xl" />

      {/* Header with Title and Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-page-title font-semibold text-text-primary">{t("Cargo Mix", "توزيع الحمولات", "سامان کی تقسیم")}</h2>
            <span className="flex items-center gap-1 rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-micro font-medium text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
              {t("Live Payload", "حمولة حية", "براہ راست لوڈ")}
            </span>
          </div>
          <p className="mt-0.5 text-label-lg text-text-muted">
            {metricMode === "tons"
              ? t("Tonnage distribution by trailer type", "توزيع أوزان الأطنان حسب نوع المقطورة", "ٹریلر کی قسم کے لحاظ سے ٹن کا پھیلاؤ")
              : t("Shipment count by trailer type", "توزيع عدد الرحلات حسب نوع المقطورة", "ٹریلر کے لحاظ سے ٹرپس کی تعداد")}
          </p>
        </div>

        {/* High-tech pill switcher */}
        <div role="tablist" className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface-2/90 p-1 backdrop-blur-sm">
          <button
            type="button"
            role="tab"
            aria-selected={metricMode === "tons"}
            onClick={() => setMetricMode("tons")}
            className={cn(
              "rounded-full px-3 py-1 text-label font-medium transition-all duration-200",
              metricMode === "tons"
                ? "bg-brand font-semibold text-on-brand shadow-xs"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {t("Tonnage", "الأطنان", "وزن")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={metricMode === "trips"}
            onClick={() => setMetricMode("trips")}
            className={cn(
              "rounded-full px-3 py-1 text-label font-medium transition-all duration-200",
              metricMode === "trips"
                ? "bg-brand font-semibold text-on-brand shadow-xs"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {t("Trips", "الرحلات", "ٹرپس")}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-4 flex flex-1 flex-col items-center justify-between gap-6 sm:flex-row">
        {/* Category Cards (Interactive Legend) */}
        <ul className="w-full flex-1 space-y-2.5">
          {segments.map((s, i) => {
            const isHover = hover === i;
            const labelPair = CARGO_LABEL[s.type] ?? [s.type, s.type];
            return (
              <li key={s.type}>
                <button
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className={cn(
                    "group relative flex w-full items-center gap-3 rounded-inner border p-2.5 text-start transition-all duration-200",
                    isHover
                      ? "border-brand/50 bg-surface-3/90 shadow-md ring-1 ring-brand/20 translate-x-0.5"
                      : "border-border-subtle/70 bg-surface-2/60 hover:border-border-subtle hover:bg-surface-2",
                  )}
                >
                  {/* Category Avatar */}
                  <span className="shrink-0 transition-transform duration-200 group-hover:scale-105">
                    <TruckTypeAvatar truckType={s.type} size={34} iconSize={18} showBadge={false} />
                  </span>

                  {/* Name and Micro Bar */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-label-lg font-medium text-text-primary">
                        {t(labelPair[0], labelPair[1])}
                      </span>
                      <span className="tabular-nums text-label font-bold text-text-primary">
                        {metricMode === "tons" ? `${s.tons.toFixed(1)} ${t("t", "طن")}` : `${s.tripCount} ${t("trips", "رحلة")}`}
                      </span>
                    </div>

                    {/* Progress track */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-4">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${Math.max(4, s.percentage)}%`,
                            backgroundColor: s.primaryColor,
                            boxShadow: isHover ? `0 0 8px ${s.primaryColor}` : "none",
                          }}
                        />
                      </div>
                      <span className="shrink-0 tabular-nums text-micro font-semibold text-text-muted">
                        {s.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Modern Interactive High-Tech Donut Chart SVG */}
        <div className="relative h-[200px] w-[200px] shrink-0 sm:h-[220px] sm:w-[220px]">
          <svg
            viewBox="0 0 200 200"
            className="h-full w-full"
            role="img"
            aria-label={t("Cargo tonnage donut chart", "مخطط دائري متطور للأطنان", "کارگو ٹن ڈونٹ چارٹ")}
          >
            <defs>
              {/* Gradient definitions for each cargo category */}
              {SEGMENT_CONFIG.map((cfg) => (
                <linearGradient key={cfg.gradId} id={cfg.gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={cfg.stops[0]} />
                  <stop offset="50%" stopColor={cfg.stops[1]} />
                  <stop offset="100%" stopColor={cfg.stops[2]} />
                </linearGradient>
              ))}

              {/* Glow filter for active segment */}
              <filter id="cyber-donut-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              {/* Radial background for center hub */}
              <radialGradient id="center-hub-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--color-surface-3)" stopOpacity="0.9" />
                <stop offset="100%" stopColor="var(--color-surface-1)" stopOpacity="0.95" />
              </radialGradient>
            </defs>

            {/* Outer Aerospace / Radar Telemetry Dial Ticks */}
            <g className="opacity-40">
              {Array.from({ length: 36 }).map((_, i) => {
                const angle = (i * 10 * Math.PI) / 180;
                const isCardinal = i % 9 === 0;
                const r1 = 94;
                const r2 = isCardinal ? 87 : 90;
                const x1 = 100 + r1 * Math.cos(angle);
                const y1 = 100 + r1 * Math.sin(angle);
                const x2 = 100 + r2 * Math.cos(angle);
                const y2 = 100 + r2 * Math.sin(angle);
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isCardinal ? "var(--color-brand)" : "var(--color-border-soft)"}
                    strokeWidth={isCardinal ? 1.5 : 1}
                  />
                );
              })}
            </g>

            {/* Inner guideline circular track */}
            <circle
              cx="100"
              cy="100"
              r="84"
              fill="none"
              stroke="var(--color-border-soft)"
              strokeWidth="0.75"
              strokeDasharray="3 3"
              className="opacity-50"
            />

            {/* Background Arc Track */}
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke="var(--color-surface-4)"
              strokeWidth="14"
              className="opacity-60"
            />

            {/* Interactive Segments */}
            <g className="-rotate-90 origin-[100px_100px]">
              {segments.map((s, i) => {
                const val = metricMode === "tons" ? s.tons : s.tripCount;
                const len = currentTotal > 0 ? (val / currentTotal) * c : 0;
                const dash = Math.max(0, len - gap);
                const isHover = hover === i;
                const el = (
                  <circle
                    key={s.type}
                    cx="100"
                    cy="100"
                    r={r}
                    fill="none"
                    stroke={`url(#${s.gradId})`}
                    strokeWidth={isHover ? 20 : 14}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${c}`}
                    strokeDashoffset={-offset}
                    filter={isHover ? "url(#cyber-donut-glow)" : undefined}
                    className="cursor-pointer transition-all duration-300 ease-out"
                    style={{
                      opacity: hover === null || isHover ? 1 : 0.35,
                      transformOrigin: "100px 100px",
                    }}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                );
                offset += len;
                return el;
              })}
            </g>

            {/* Center Hub Outer Ring */}
            <circle
              cx="100"
              cy="100"
              r="54"
              fill="url(#center-hub-grad)"
              stroke="var(--color-border-subtle)"
              strokeWidth="1.5"
              className="shadow-inner"
            />
          </svg>

          {/* Interactive Floating Center Hub Display */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div className="flex flex-col items-center justify-center px-2">
              <div className="flex items-center gap-1 text-micro font-medium text-text-muted">
                {hover !== null && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: segments[hover].primaryColor }}
                  />
                )}
                <span>
                  {hover === null
                    ? t("Total load", "إجمالي الأسطول", "کل سامان")
                    : t(CARGO_LABEL[segments[hover].type][0], CARGO_LABEL[segments[hover].type][1])}
                </span>
              </div>
              <div className="mt-0.5 text-hero-sm font-bold tabular-nums text-text-primary drop-shadow-xs">
                {shownValue.toFixed(metricMode === "tons" ? 1 : 0)}
              </div>
              <div className="text-micro font-semibold text-text-muted">
                {hover === null
                  ? metricMode === "tons" ? t("tons", "طن", "ٹن") : t("trips", "رحلة", "ٹرپس")
                  : `${segments[hover].percentage.toFixed(1)}%`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dominant Fleet Category Telemetry Footer */}
      {dominantSegment && currentTotal > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle/60 pt-3 text-micro text-text-muted">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dominantSegment.primaryColor }} />
            <span>
              {t("Highest Capacity Segment:", "الفئة الأكثر تشغيلاً:", "سب سے زیادہ گنجائش:")}{" "}
              <strong className="text-text-primary">
                {t(CARGO_LABEL[dominantSegment.type][0], CARGO_LABEL[dominantSegment.type][1])} ({dominantSegment.percentage.toFixed(0)}%)
              </strong>
            </span>
          </div>
          <span className="tabular-nums font-medium text-text-secondary">
            {t("Fleet Total:", "إجمالي الأسطول:", "کل بیڑا:")} {totalTons.toFixed(1)} {t("tons", "طن")} · {totalTrips} {t("trips", "رحلة")}
          </span>
        </div>
      )}
    </section>
  );
}

