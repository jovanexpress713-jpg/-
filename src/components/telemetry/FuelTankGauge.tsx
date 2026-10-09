import React from "react";
import { IconFuel } from "../Icons";

interface FuelTankGaugeProps {
  fuelVal: number;
  tankCapacityLiters?: number;
  tone: {
    bg: string;
    text: string;
    border: string;
    label: string;
  };
  t: (en: string, ar: string, ur?: string) => string;
}

export const FuelTankGauge: React.FC<FuelTankGaugeProps> = ({
  fuelVal,
  tankCapacityLiters = 600,
  tone,
  t,
}) => {
  const clampedVal = Math.max(0, Math.min(100, Math.round(fuelVal)));
  const liters = Math.round((clampedVal / 100) * tankCapacityLiters);
  const rangeKm = Math.round(clampedVal * 8.5);

  // Dynamic fuel theme colors based on remaining quantity
  const isLow = clampedVal <= 20;
  const isMed = clampedVal > 20 && clampedVal <= 45;

  const fluidGradient = isLow
    ? "from-red-600/90 via-red-500/80 to-rose-400/90"
    : isMed
    ? "from-amber-600/90 via-amber-500/80 to-yellow-400/90"
    : "from-emerald-600/90 via-emerald-500/80 to-teal-400/90";

  const waveFill = isLow ? "#ef4444" : isMed ? "#f59e0b" : "#10b981";
  const waveSecondaryFill = isLow ? "#f87171" : isMed ? "#fbbf24" : "#34d399";
  const waveCrestStroke = isLow ? "#fca5a5" : isMed ? "#fde68a" : "#a7f3d0";
  const glowShadow = isLow
    ? "shadow-[0_0_20px_rgba(239,68,68,0.35)]"
    : isMed
    ? "shadow-[0_0_20px_rgba(245,158,11,0.35)]"
    : "shadow-[0_0_20px_rgba(16,185,129,0.35)]";

  return (
    <div className="flex flex-col justify-between rounded-inner border border-border-subtle/80 bg-surface-1/80 p-3.5 backdrop-blur-sm transition-all hover:border-brand/40">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`grid h-8 w-8 place-items-center rounded-control ${tone.bg} ${tone.text}`}>
            <IconFuel size={17} />
          </span>
          <div>
            <span className="block text-label font-medium text-text-secondary">
              {t("Fuel Tank Level", "خزان الوقود (تانكي متحرك)", "ایندھن کا ٹینک")}
            </span>
            <span className="block text-micro text-text-muted">
              {t("Range ~", "المدى التقديري ~", "تخمینہ فاصلہ ~")}{rangeKm} {t("km", "كم", "کلومیٹر")}
            </span>
          </div>
        </div>

        {/* Live percentage badge */}
        <div className="text-end">
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-section-title font-bold tabular-nums text-text-primary">
              {clampedVal}
            </span>
            <span className="text-micro font-semibold text-text-muted">%</span>
          </div>
          <span className={`inline-block rounded-micro border px-1.5 py-0.5 text-micro font-semibold ${tone.bg} ${tone.text} ${tone.border}`}>
            {tone.label}
          </span>
        </div>
      </div>

      {/* Heavy-Duty Commercial Fuel Tank Container */}
      <div className="relative my-3 flex flex-col justify-end">
        {/* Tank filler neck & cap on the top */}
        <div className="absolute -top-2 left-6 z-10 flex flex-col items-center">
          <div className="h-1 w-4 rounded-t-micro border-t border-x border-border-subtle bg-surface-4" />
          <div className="h-1 w-6 rounded-micro border border-border-subtle bg-surface-5 shadow-sm" />
        </div>

        {/* The Tank Body */}
        <div
          className={`relative h-28 w-full overflow-hidden rounded-panel border-2 border-border-subtle/90 bg-surface-2/90 shadow-inner ${glowShadow}`}
        >
          {/* Internal Chamber Grid / Graduation lines */}
          <div className="absolute inset-0 z-10 flex flex-col justify-between px-3 py-2 pointer-events-none">
            <div className="flex items-center justify-between border-b border-dashed border-text-muted/15 pb-0.5 text-micro text-text-muted/70">
              <span className="font-semibold">F (100%)</span>
              <span className="tabular-nums font-mono">{tankCapacityLiters}L</span>
            </div>
            <div className="flex items-center justify-between border-b border-dashed border-text-muted/15 pb-0.5 text-micro text-text-muted/60">
              <span>3/4 (75%)</span>
              <span className="tabular-nums font-mono">{Math.round(tankCapacityLiters * 0.75)}L</span>
            </div>
            <div className="flex items-center justify-between border-b border-dashed border-text-muted/15 pb-0.5 text-micro text-text-muted/60">
              <span>1/2 (50%)</span>
              <span className="tabular-nums font-mono">{Math.round(tankCapacityLiters * 0.5)}L</span>
            </div>
            <div className="flex items-center justify-between border-b border-dashed border-text-muted/15 pb-0.5 text-micro text-text-muted/60">
              <span>1/4 (25%)</span>
              <span className="tabular-nums font-mono">{Math.round(tankCapacityLiters * 0.25)}L</span>
            </div>
            <div className="flex items-center justify-between pt-0.5 text-micro text-text-muted/70">
              <span className="font-semibold text-status-danger/80">E (0%)</span>
              <span className="tabular-nums font-mono">0L</span>
            </div>
          </div>

          {/* Heavy Duty Mounting Straps / Chassis Brackets */}
          <div className="absolute left-[26%] top-0 bottom-0 z-20 w-3 border-x border-border-subtle/80 bg-surface-4/85 shadow-sm pointer-events-none">
            <div className="h-1.5 w-full border-b border-border-subtle bg-surface-6" />
            <div className="absolute bottom-0 h-1.5 w-full border-t border-border-subtle bg-surface-6" />
          </div>
          <div className="absolute right-[26%] top-0 bottom-0 z-20 w-3 border-x border-border-subtle/80 bg-surface-4/85 shadow-sm pointer-events-none">
            <div className="h-1.5 w-full border-b border-border-subtle bg-surface-6" />
            <div className="absolute bottom-0 h-1.5 w-full border-t border-border-subtle bg-surface-6" />
          </div>

          {/* Metallic brushed chamber highlight overlay */}
          <div className="absolute inset-0 z-15 bg-gradient-to-b from-white/5 via-transparent to-black/30 pointer-events-none" />

          {/* Liquid Fuel Fill with dynamic height */}
          <div
            className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t ${fluidGradient} transition-all duration-700 ease-out`}
            style={{ height: `${Math.max(5, clampedVal)}%` }}
          >
            {/* Animated Sloshing Waves on the liquid surface */}
            <div className="absolute -top-3.5 inset-x-0 h-4 overflow-hidden pointer-events-none">
              <svg
                viewBox="0 0 500 24"
                preserveAspectRatio="none"
                className="h-full w-[200%] overflow-visible"
              >
                {/* Primary drifting liquid wave */}
                <path
                  d="M 0 14 Q 62.5 4 125 14 T 250 14 T 375 14 T 500 14 L 500 24 L 0 24 Z"
                  fill={waveFill}
                  opacity="0.8"
                  className="capacity-water-wave"
                />
                {/* Secondary highlight ripple wave */}
                <path
                  d="M 0 16 Q 62.5 8 125 16 T 250 16 T 375 16 T 500 16 L 500 24 L 0 24 Z"
                  fill={waveSecondaryFill}
                  opacity="0.45"
                  className="capacity-water-wave capacity-water-wave-highlight"
                />
                {/* Surface crest stroke line */}
                <path
                  d="M 0 14 Q 62.5 4 125 14 T 250 14 T 375 14 T 500 14"
                  fill="none"
                  stroke={waveCrestStroke}
                  strokeWidth="2.5"
                  opacity="0.9"
                  className="capacity-water-wave"
                />
              </svg>
            </div>

            {/* Micro-bubbles floating up through the fuel fluid */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <span className="fuel-bubble absolute bottom-1 left-[18%] h-1.5 w-1.5 rounded-full bg-white/70" />
              <span className="fuel-bubble fuel-bubble-delay-1 absolute bottom-2 left-[52%] h-2 w-2 rounded-full bg-white/60" />
              <span className="fuel-bubble fuel-bubble-delay-2 absolute bottom-1 left-[82%] h-1.5 w-1.5 rounded-full bg-white/70" />
              <span className="fuel-bubble absolute bottom-3 left-[36%] h-1 w-1 rounded-full bg-white/80" />
            </div>
          </div>

          {/* Centered High-Contrast Glass Readout */}
          <div className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 rounded-control border border-white/20 bg-surface-0/80 px-3.5 py-1.5 shadow-lg backdrop-blur-md">
              <span className="grid h-5 w-5 place-items-center rounded-micro bg-surface-3 text-text-primary">
                <IconFuel size={13} />
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-section-title font-black tabular-nums tracking-tight text-text-primary">
                  {clampedVal}%
                </span>
                <span className="text-micro font-semibold text-text-muted">
                  ({liters} {t("L", "لتر", "لیٹر")})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Summary Rail */}
      <div className="flex items-center justify-between text-micro text-text-muted">
        <span className="tabular-nums font-mono">
          {t("Current Volume: ", "الحجم الفعلي: ", "موجودہ مقدار: ")}
          <strong className="font-semibold text-text-secondary">{liters} / {tankCapacityLiters} {t("L", "لتر", "لیٹر")}</strong>
        </span>
        <span className="font-medium text-text-secondary">
          {clampedVal > 50
            ? t("Full Tank State", "تانكي ممتلئ بحالة ممتازة", "مکمل ایندھن")
            : clampedVal > 20
            ? t("Adequate Fuel", "مستوى تشغيلي طبيعي", "مناسب ایندھن")
            : t("Refuel Suggested", "يُوصى بالتزود بالوقود", "ایندھن کی ضرورت")}
        </span>
      </div>
    </div>
  );
};
