import React from "react";
import { IconGauge } from "../Icons";

interface SpeedometerGaugeProps {
  speedVal: number;
  speedMax?: number;
  tone: {
    bg: string;
    text: string;
    border: string;
    label: string;
  };
  t: (en: string, ar: string, ur?: string) => string;
}

export const SpeedometerGauge: React.FC<SpeedometerGaugeProps> = ({
  speedVal,
  speedMax = 120,
  tone,
  t,
}) => {
  const clampedSpeed = Math.max(0, Math.min(speedMax, Math.round(speedVal)));
  const speedPct = Math.min(100, Math.round((clampedSpeed / speedMax) * 100));

  // Needle angle sweeps over a 230-degree arc from -115 deg (0 km/h) to +115 deg (120 km/h)
  const needleAngle = -115 + (clampedSpeed / speedMax) * 230;

  // Arc path constants
  // Center (120, 110), Radius = 80
  const cx = 120;
  const cy = 110;
  const radius = 78;

  // Perimeter for strokeDasharray calculation (approx 230 degrees of full circle)
  // full perimeter = 2 * PI * 78 ≈ 490.08
  // arc length = 490.08 * (230 / 360) ≈ 313.1
  const arcLength = 313.1;
  const filledDash = (speedPct / 100) * arcLength;

  // Speed tick marks around the speedometer clock dial
  const ticks = [0, 20, 40, 60, 80, 90, 100, 120];

  return (
    <div className="flex flex-col justify-between rounded-inner border border-border-subtle/80 bg-surface-1/80 p-3.5 backdrop-blur-sm transition-all hover:border-brand/40">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`grid h-8 w-8 place-items-center rounded-control ${tone.bg} ${tone.text}`}>
            <IconGauge size={17} />
          </span>
          <div>
            <span className="block text-label font-medium text-text-secondary">
              {t("Live Speedometer", "ساعة السرعة (عداد ديناميكي)", "گاڑی کا سپیڈومیٹر")}
            </span>
            <span className="block text-micro text-text-muted">
              {t("Highway limit: 90 km/h", "الحد النظامي: ٩٠ كم/س", "قانونی حد: 90 کلومیٹر")}
            </span>
          </div>
        </div>

        {/* Live Speed Badge */}
        <div className="text-end">
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-section-title font-bold tabular-nums text-text-primary">
              {clampedSpeed}
            </span>
            <span className="text-micro font-semibold text-text-muted">
              {t("km/h", "كم/س", "کلومیٹر/گھنٹہ")}
            </span>
          </div>
          <span className={`inline-block rounded-micro border px-1.5 py-0.5 text-micro font-semibold ${tone.bg} ${tone.text} ${tone.border}`}>
            {tone.label}
          </span>
        </div>
      </div>

      {/* Clock-Style Speedometer SVG Dial Container */}
      <div className="relative my-1 flex h-32 items-center justify-center overflow-hidden">
        <svg
          viewBox="0 0 240 148"
          className="h-full w-full max-w-[260px] select-none overflow-visible"
        >
          <defs>
            {/* Speed track gradient */}
            <linearGradient id="speedDialGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#22c55e" />
              <stop offset="78%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>

            {/* Needle glow filter */}
            <filter id="needleGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#ff6b1a" floodOpacity="0.75" />
            </filter>

            {/* Hub metallic gradient */}
            <radialGradient id="hubMetallic" cx="45%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="60%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </radialGradient>
          </defs>

          {/* Background Arc Track */}
          <path
            d="M 45 142 A 78 78 0 1 1 195 142"
            fill="none"
            stroke="currentColor"
            strokeWidth="9"
            strokeLinecap="round"
            className="text-surface-3/80"
          />

          {/* Dynamic Active Colored Speed Arc */}
          <path
            d="M 45 142 A 78 78 0 1 1 195 142"
            fill="none"
            stroke="url(#speedDialGrad)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${filledDash} ${arcLength}`}
            style={{
              transition: "stroke-dasharray 0.8s cubic-bezier(0.34, 1.35, 0.64, 1)",
            }}
          />

          {/* Radial Tick Marks and Numbers */}
          {ticks.map((tVal) => {
            const angleDeg = -115 + (tVal / speedMax) * 230;
            const angleRad = ((angleDeg - 90) * Math.PI) / 180;
            const isLimit = tVal === 90;
            const isMajor = tVal === 0 || tVal === 60 || tVal === 120 || isLimit;

            const rInner = isLimit ? radius - 15 : isMajor ? radius - 13 : radius - 9;
            const rOuter = radius - 3;
            const x1 = cx + rInner * Math.cos(angleRad);
            const y1 = cy + rInner * Math.sin(angleRad);
            const x2 = cx + rOuter * Math.cos(angleRad);
            const y2 = cy + rOuter * Math.sin(angleRad);

            // Label coordinate
            const rLabel = radius - 24;
            const xLabel = cx + rLabel * Math.cos(angleRad);
            const yLabel = cy + rLabel * Math.sin(angleRad) + 3;

            return (
              <g key={tVal}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isLimit ? "#ef4444" : isMajor ? "currentColor" : "currentColor"}
                  strokeWidth={isLimit ? "2.5" : isMajor ? "2" : "1"}
                  className={isLimit ? "" : isMajor ? "text-text-secondary" : "text-text-muted/40"}
                />
                {(isMajor || tVal === 30) && (
                  <text
                    x={xLabel}
                    y={yLabel}
                    fontSize="8"
                    fontWeight={isLimit ? "700" : "600"}
                    textAnchor="middle"
                    fill={isLimit ? "#ef4444" : "var(--color-text-muted)"}
                    className="font-mono"
                  >
                    {tVal}
                  </text>
                )}
              </g>
            );
          })}

          {/* Center Digital Speed Readout (Above Pivot) */}
          <g transform={`translate(${cx}, ${cy - 12})`}>
            <text
              x="0"
              y="0"
              textAnchor="middle"
              className="fill-text-primary text-hero-sm font-black tabular-nums tracking-tight"
              style={{ fontSize: "24px", fontWeight: "900" }}
            >
              {clampedSpeed}
            </text>
            <text
              x="0"
              y="11"
              textAnchor="middle"
              className="fill-text-muted text-micro font-bold"
              style={{ fontSize: "8.5px", letterSpacing: "0.5px" }}
            >
              {t("KM/H", "كم/ساعة", "کلومیٹر/گھنٹہ")}
            </text>
          </g>

          {/* Dynamic Animated Clock Needle */}
          <g
            style={{
              transform: `rotate(${needleAngle}deg)`,
              transformOrigin: `${cx}px ${cy}px`,
              transition: "transform 0.8s cubic-bezier(0.34, 1.35, 0.64, 1)",
            }}
          >
            {/* Tapered Needle Blade */}
            <polygon
              points={`${cx - 2.5},${cy} ${cx + 2.5},${cy} ${cx + 0.8},${cy - 68} ${cx - 0.8},${cy - 68}`}
              fill="var(--color-brand)"
              filter="url(#needleGlow)"
            />
            {/* Glowing Pointer Tip */}
            <circle cx={cx} cy={cy - 68} r="2.5" fill="#ff6b1a" />
            {/* Counterbalance tail */}
            <polygon
              points={`${cx - 3},${cy} ${cx + 3},${cy} ${cx},${cy + 14}`}
              fill="var(--color-brand-soft)"
              opacity="0.8"
            />
          </g>

          {/* Center Metallic Hub & Glowing Core */}
          <circle cx={cx} cy={cy} r="14" fill="url(#hubMetallic)" stroke="#64748b" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r="9" fill="var(--color-surface-4)" />
          <circle
            cx={cx}
            cy={cy}
            r="5"
            fill={clampedSpeed > 0 ? "var(--color-brand)" : "var(--color-text-muted)"}
            className="speedometer-pulse"
          />
        </svg>
      </div>

      {/* Bottom Summary Rail */}
      <div className="flex items-center justify-between text-micro text-text-muted">
        <span className="flex items-center gap-1.5 font-medium">
          <span
            className={`h-2 w-2 rounded-full ${
              clampedSpeed === 0
                ? "bg-text-muted"
                : clampedSpeed > 90
                ? "bg-status-danger animate-ping"
                : "bg-status-active"
            }`}
          />
          {clampedSpeed === 0
            ? t("Vehicle Parked", "المركبة متوقفة", "گاڑی پارک ہے")
            : clampedSpeed > 90
            ? t("Speed Exceeded", "تجاوز السرعة المحددة", "حد سے زیادہ رفتار")
            : t("Cruising Smoothly", "حركة سير نظامية", "معمول کی رفتار")}
        </span>
        <span className="tabular-nums font-mono font-semibold text-text-secondary">
          {t("Safety Limit: 90", "الحد الآمن: ٩٠", "حفاظتی حد: 90")}
        </span>
      </div>
    </div>
  );
};
