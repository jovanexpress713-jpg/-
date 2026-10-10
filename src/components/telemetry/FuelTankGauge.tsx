import React, { useState } from "react";
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
  const [displayUnit, setDisplayUnit] = useState<"percent" | "liters">("percent");
  const clampedVal = Math.max(0, Math.min(100, Math.round(fuelVal)));
  const liters = Math.round((clampedVal / 100) * tankCapacityLiters);
  const rangeKm = Math.round(clampedVal * 8.5);

  // Dynamic fuel theme colors based on remaining quantity
  const isLow = clampedVal <= 20;
  const isMed = clampedVal > 20 && clampedVal <= 45;

  const fluidGradient = isLow
    ? "from-rose-600 via-red-500 to-rose-400"
    : isMed
    ? "from-amber-600 via-amber-500 to-yellow-400"
    : "from-emerald-700 via-emerald-500 to-teal-400";

  const waveFill = isLow ? "#ef4444" : isMed ? "#f59e0b" : "#10b981";
  const waveSecondaryFill = isLow ? "#f87171" : isMed ? "#fbbf24" : "#34d399";
  const waveCrestStroke = isLow ? "#fecaca" : isMed ? "#fef3c7" : "#a7f3d0";
  const glowShadow = isLow
    ? "shadow-[0_0_24px_rgba(239,68,68,0.4)]"
    : isMed
    ? "shadow-[0_0_24px_rgba(245,158,11,0.4)]"
    : "shadow-[0_0_24px_rgba(16,185,129,0.4)]";

  // Telemetry indicators calculated realistically
  const consumptionRate = (28.2 + (100 - clampedVal) * 0.04).toFixed(1);
  const tankTemp = (22 + (clampedVal > 50 ? 2 : 4)).toFixed(0);
  const tankPressure = (1.9 + (clampedVal / 100) * 0.4).toFixed(1);

  return (
    <div className="flex flex-col justify-between rounded-panel border border-border-subtle/80 bg-surface-1/90 p-4 shadow-lg backdrop-blur-md transition-all hover:border-brand/40">
      {/* Top Header with Live Telemetry Sensor Status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={`telemetry-live-glow grid h-9 w-9 place-items-center rounded-control shadow-md ${tone.bg} ${tone.text}`}>
            <IconFuel size={19} />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="block text-card-title font-bold text-text-primary">
                {t("Smart Fuel Telemetry", "خزان الوقود (تانكي هيدروليكي ذكي)", "ایندھن کا ٹینک")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-micro border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-micro font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 telemetry-live-glow" />
                {t("LIVE", "مباشر", "لائیو")}
              </span>
            </div>
            <span className="block text-micro font-medium text-text-muted">
              {t("Est. Range ~ ", "المدى المقدر ~ ", "تخمینہ فاصلہ ~ ")}
              <strong className="font-semibold text-text-secondary tabular-nums">{rangeKm} {t("km", "كم", "کلومیٹر")}</strong>
              {" · "}
              {t("Ultrasonic Sensor Active", "حساس رقمي متصل", "سینسر فعال")}
            </span>
          </div>
        </div>

        {/* Live percentage badge & Unit Switcher */}
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => setDisplayUnit(displayUnit === "percent" ? "liters" : "percent")}
            className="flex items-baseline justify-end gap-1 rounded-control bg-surface-2/80 px-2.5 py-1 transition hover:bg-surface-3"
            title={t("Toggle view mode", "تبديل وحدة القياس", "یونٹ تبدیل کریں")}
          >
            {displayUnit === "percent" ? (
              <>
                <span className="text-section-title font-black tabular-nums text-text-primary">
                  {clampedVal}
                </span>
                <span className="text-micro font-bold text-text-muted">%</span>
              </>
            ) : (
              <>
                <span className="text-section-title font-black tabular-nums text-text-primary">
                  {liters}
                </span>
                <span className="text-micro font-bold text-text-muted">{t("L", "لتر", "لیٹر")}</span>
              </>
            )}
          </button>
          <span className={`inline-block rounded-micro border px-2 py-0.5 text-micro font-semibold shadow-xs ${tone.bg} ${tone.text} ${tone.border}`}>
            {tone.label}
          </span>
        </div>
      </div>

      {/* Heavy-Duty Commercial 3D Fuel Reservoir Chamber */}
      <div className="relative my-3.5 flex flex-col justify-end">
        {/* Top filler neck & pressure safety valve */}
        <div className="absolute -top-2.5 left-8 z-10 flex flex-col items-center">
          <div className="h-1.5 w-4 rounded-t-micro border-t border-x border-border-subtle bg-surface-4" />
          <div className="h-1.5 w-7 rounded-micro border border-border-subtle bg-surface-5 shadow-sm" />
        </div>

        {/* The 3D Cylindrical Tank Body */}
        <div
          className={`relative h-32 w-full overflow-hidden rounded-panel border-2 border-border-subtle/90 bg-surface-2/95 shadow-inner ${glowShadow}`}
        >
          {/* Glass specular glossy reflection highlight along top edge */}
          <div className="absolute inset-x-0 top-0 z-20 h-4 bg-gradient-to-b from-white/20 via-white/5 to-transparent pointer-events-none" />

          {/* Internal Chamber Holographic Grid / Volume graduations */}
          <div className="absolute inset-0 z-10 flex flex-col justify-between px-3.5 py-2.5 pointer-events-none">
            <div className="flex items-center justify-between border-b border-dashed border-text-muted/20 pb-0.5 text-micro text-text-muted/80">
              <span className="flex items-center gap-1 font-semibold text-emerald-400/90">
                <span className="h-1 w-2 rounded-full bg-emerald-400" />
                F (100%)
              </span>
              <span className="tabular-nums font-mono font-medium">{tankCapacityLiters}L</span>
            </div>
            <div className="flex items-center justify-between border-b border-dashed border-text-muted/15 pb-0.5 text-micro text-text-muted/70">
              <span className="flex items-center gap-1">
                <span className="h-1 w-1.5 rounded-full bg-text-muted/60" />
                3/4 (75%)
              </span>
              <span className="tabular-nums font-mono">{Math.round(tankCapacityLiters * 0.75)}L</span>
            </div>
            <div className="flex items-center justify-between border-b border-dashed border-text-muted/15 pb-0.5 text-micro text-text-muted/70">
              <span className="flex items-center gap-1">
                <span className="h-1 w-1.5 rounded-full bg-text-muted/60" />
                1/2 (50%)
              </span>
              <span className="tabular-nums font-mono">{Math.round(tankCapacityLiters * 0.5)}L</span>
            </div>
            <div className="flex items-center justify-between border-b border-dashed border-text-muted/15 pb-0.5 text-micro text-text-muted/70">
              <span className="flex items-center gap-1">
                <span className="h-1 w-1.5 rounded-full bg-text-muted/60" />
                1/4 (25%)
              </span>
              <span className="tabular-nums font-mono">{Math.round(tankCapacityLiters * 0.25)}L</span>
            </div>
            <div className="flex items-center justify-between pt-0.5 text-micro text-text-muted/80">
              <span className="flex items-center gap-1 font-semibold text-rose-400/90">
                <span className="h-1 w-2 rounded-full bg-rose-400" />
                E (0%)
              </span>
              <span className="tabular-nums font-mono font-medium">0L</span>
            </div>
          </div>

          {/* Heavy Duty Metallic Mounting Straps & Rivet Brackets */}
          <div className="absolute left-[24%] top-0 bottom-0 z-20 w-3.5 border-x border-border-subtle/90 bg-surface-4/90 shadow-sm pointer-events-none">
            <div className="h-2 w-full border-b border-border-subtle bg-surface-6" />
            <div className="my-auto mx-auto h-1.5 w-1.5 rounded-full bg-surface-2 border border-border-subtle" />
            <div className="absolute bottom-0 h-2 w-full border-t border-border-subtle bg-surface-6" />
          </div>
          <div className="absolute right-[24%] top-0 bottom-0 z-20 w-3.5 border-x border-border-subtle/90 bg-surface-4/90 shadow-sm pointer-events-none">
            <div className="h-2 w-full border-b border-border-subtle bg-surface-6" />
            <div className="my-auto mx-auto h-1.5 w-1.5 rounded-full bg-surface-2 border border-border-subtle" />
            <div className="absolute bottom-0 h-2 w-full border-t border-border-subtle bg-surface-6" />
          </div>

          {/* Metallic brushed chamber highlight overlay */}
          <div className="absolute inset-0 z-15 bg-gradient-to-b from-white/10 via-transparent to-black/40 pointer-events-none" />

          {/* Real-time Dynamic Liquid Fuel Fill */}
          <div
            className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t ${fluidGradient} transition-all duration-700 ease-out`}
            style={{ height: `${Math.max(6, clampedVal)}%` }}
          >
            {/* Liquid shimmer overlay for dynamic realism */}
            <div className="liquid-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

            {/* Animated Sloshing Dual Waves on the liquid surface */}
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
                  opacity="0.85"
                  className="capacity-water-wave"
                />
                {/* Secondary highlight ripple wave */}
                <path
                  d="M 0 16 Q 62.5 8 125 16 T 250 16 T 375 16 T 500 16 L 500 24 L 0 24 Z"
                  fill={waveSecondaryFill}
                  opacity="0.5"
                  className="capacity-water-wave capacity-water-wave-highlight"
                />
                {/* Surface luminous crest stroke line */}
                <path
                  d="M 0 14 Q 62.5 4 125 14 T 250 14 T 375 14 T 500 14"
                  fill="none"
                  stroke={waveCrestStroke}
                  strokeWidth="3"
                  opacity="0.95"
                  className="capacity-water-wave"
                />
              </svg>
            </div>

            {/* Realistic Micro-bubbles floating continuously through the fluid */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <span className="fuel-bubble absolute bottom-1 left-[15%] h-1.5 w-1.5 rounded-full bg-white/70 shadow-xs" />
              <span className="fuel-bubble fuel-bubble-delay-1 absolute bottom-2 left-[48%] h-2 w-2 rounded-full bg-white/60 shadow-xs" />
              <span className="fuel-bubble fuel-bubble-delay-2 absolute bottom-1 left-[78%] h-1.5 w-1.5 rounded-full bg-white/70 shadow-xs" />
              <span className="fuel-bubble absolute bottom-3 left-[32%] h-1 w-1 rounded-full bg-white/80" />
              <span className="fuel-bubble fuel-bubble-delay-1 absolute bottom-1.5 left-[64%] h-1.5 w-1.5 rounded-full bg-white/70" />
            </div>
          </div>

          {/* Centered High-Contrast Cockpit Glass Readout HUD */}
          <div className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2.5 rounded-inner border border-white/25 bg-surface-0/85 px-4 py-2 shadow-xl backdrop-blur-md">
              <span className="grid h-6 w-6 place-items-center rounded-control bg-surface-3 text-brand">
                <IconFuel size={14} />
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-section-title font-black tabular-nums tracking-tight text-text-primary">
                  {clampedVal}%
                </span>
                <span className="text-micro font-bold text-text-muted">
                  ({liters} {t("L", "لتر", "لیٹر")})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Live Telemetry Sensors Grid */}
      <div className="my-2 grid grid-cols-3 gap-2 rounded-control border border-border-subtle/60 bg-surface-2/60 p-2">
        <div className="text-start">
          <span className="block text-micro font-medium text-text-muted">
            {t("Consumption", "معدل الاستهلاك", "ایندھن کی کھپت")}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-label font-bold tabular-nums text-text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 telemetry-live-glow" />
            {consumptionRate} <span className="text-micro font-normal text-text-muted">L/100km</span>
          </span>
        </div>
        <div className="text-center border-x border-border-subtle/50 px-1">
          <span className="block text-micro font-medium text-text-muted">
            {t("Tank Temp", "حرارة الخزان", "ٹینک درجہ حرارت")}
          </span>
          <span className="mt-0.5 block text-label font-bold tabular-nums text-text-primary">
            {tankTemp}°C <span className="text-micro font-normal text-text-muted">({tankPressure} bar)</span>
          </span>
        </div>
        <div className="text-end">
          <span className="block text-micro font-medium text-text-muted">
            {t("Fuel Spec", "مواصفة الوقود", "ایندھن قسم")}
          </span>
          <span className="mt-0.5 block text-label font-bold text-brand">
            Euro 6 <span className="text-micro font-normal text-text-muted">Clean</span>
          </span>
        </div>
      </div>

      {/* Bottom Summary Rail */}
      <div className="flex items-center justify-between text-micro text-text-muted">
        <span className="tabular-nums font-mono">
          {t("Tank Volume: ", "السعة الفعلية: ", "موجودہ مقدار: ")}
          <strong className="font-semibold text-text-secondary">{liters} / {tankCapacityLiters} {t("L", "لتر", "لیٹر")}</strong>
        </span>
        <span className="font-semibold text-text-secondary">
          {clampedVal > 50
            ? t("Optimal Level · Long Haul Ready", "مستوى مثالي · جاهز للرحلات الطويلة", "مکمل ایندھن")
            : clampedVal > 20
            ? t("Operational · Adequate Range", "مستوى تشغيلي طبيعي · مدى كافٍ", "مناسب ایندھن")
            : t("Low Level · Refuel Recommended", "مستوى منخفض · يُوصى بالتزود", "ایندھن کی ضرورت")}
        </span>
      </div>
    </div>
  );
};
