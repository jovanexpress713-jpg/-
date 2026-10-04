import { useEffect, useState } from "react";
import { cn } from "../../utils/cn";
import { useSettings } from "../../settings";
import type { Trip } from "../../state/fleetStore";
import { statusGroup } from "./shared";

/** Spec §4.6 threshold marker. */
const THRESHOLD = 85;
/** Rolling sparkline depth. */
const HISTORY = 16;

/**
 * Spec §4.6 — Route efficiency.
 *
 * The one card in the product with a full orange fill; everything else stays
 * navy so this is the only thing that shouts.
 *
 * The figure is computed, not decorative. Efficiency is schedule adherence:
 * the speed the vehicle is actually making against the speed it would need to
 * hold the stated ETA.
 *
 *   required = distanceRemaining / (etaMinutes / 60)
 *   efficiency = currentSpeed / required, capped at 100
 *
 * 100% means "at this speed the ETA holds exactly"; below that, the remaining
 * distance needs more speed than the truck is making. A delivered trip scores
 * 100%.
 */
export function routeEfficiency(trip: Trip): number {
  if (statusGroup(trip.status) === "delivered") return 100;
  if (trip.etaMinutes <= 0 || trip.distanceRemainingKm <= 0) return 100;
  const required = trip.distanceRemainingKm / (trip.etaMinutes / 60);
  if (required <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((trip.speedKmH / required) * 100)));
}

/** Spec §4.6 — the small orange curve inside the card. */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="h-8" />;
  const w = 100;
  const h = 32;
  const step = w / (points.length - 1);
  const y = (v: number) => h - (Math.max(0, Math.min(100, v)) / 100) * h;
  const line = points.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-8 w-full" aria-hidden="true">
      <path d={area} fill="rgba(255,255,255,0.18)" />
      <path d={line} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function RouteEfficiency({ trip }: { trip: Trip }) {
  const { t } = useSettings();
  const value = routeEfficiency(trip);
  const [history, setHistory] = useState<number[]>([value]);

  /* Roll the reading forward so the curve shows a real trend rather than a
     static decoration. Sampled slowly — this is a trend, not telemetry. */
  useEffect(() => {
    setHistory([routeEfficiency(trip)]);
    const id = window.setInterval(() => {
      setHistory((prev) => [...prev.slice(-(HISTORY - 1)), routeEfficiency(trip)]);
    }, 4000);
    return () => window.clearInterval(id);
  }, [trip.id, trip.speedKmH, trip.etaMinutes, trip.distanceRemainingKm, trip.status]);

  const healthy = value >= THRESHOLD;

  return (
    <section className="card-accent card-in" style={{ animationDelay: "calc(var(--ds-stagger) * 3)" }}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-on-orange">
          {t("Route efficiency", "كفاءة المسار")}
        </h2>
        <span
          className={cn(
            "pill shrink-0",
            healthy ? "bg-white/20 text-on-orange" : "bg-status-danger/25 text-on-orange",
          )}
        >
          {healthy ? t("On plan", "ضمن الخطة") : t("Needs attention", "يحتاج متابعة")}
        </span>
      </div>

      <div className="num mt-2 text-[36px] leading-none text-on-orange">{value}%</div>

      {/* Spec §4.6 — the threshold rule under the figure. */}
      <div className="mt-2 h-[3px] w-[52%] rounded-full bg-white/70" />

      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-on-orange/85">
        <span aria-hidden="true">★</span>
        <span>
          {t("Threshold", "الحد المستهدف")} ({THRESHOLD}%)
        </span>
      </div>

      <div className="mt-3">
        <Sparkline points={history} />
      </div>
    </section>
  );
}
