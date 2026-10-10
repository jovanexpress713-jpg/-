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

  // Center (120, 110), Radius = 78
  const cx = 120;
  const cy = 110;
  const radius = 78;

  // Arc length approx 313.1
  const arcLength = 313.1;
  const filledDash = (speedPct / 100) * arcLength;

  // Speed tick marks around the speedometer clock dial
  const ticks = [0, 20, 40, 60, 80, 90, 100, 120];

  // Dynamic telemetry calculations
  const isMoving = clampedSpeed > 0;
  const isOverLimit = clampedSpeed > 90;
  const simulatedRpm = isMoving ? Math.round(1100 + clampedSpeed * 8.5) : 650;
  const gear = isMoving ? (clampedSpeed > 80 ? "D8" : clampedSpeed > 60 ? "D7" : clampedSpeed > 40 ? "D5" : "D3") : "N";
  const ecoScore = isMoving ? (isOverLimit ? 68 : clampedSpeed > 75 ? 94 : 88) : 99;

  return (
    <div className="flex flex-col justify-between rounded-panel border border-border-subtle/80 bg-surface-1/90 p-4 shadow-lg backdrop-blur-md transition-all hover:border-brand/40">
      {/* Top Header with Live Radar Status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={`telemetry-live-glow grid h-9 w-9 place-items-center rounded-control shadow-md ${tone.bg} ${tone.text}`}>
            <IconGauge size={19} />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="block text-card-title font-bold text-text-primary">
                {t("Digital Cockpit Speedometer", "ساعة السرعة الرقمية (عداد ديناميكي ذكي)", "گاڑی کا سپیڈومیٹر")}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-micro border px-1.5 py-0.5 text-micro font-semibold ${
                isOverLimit
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                  : isMoving
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-border-subtle bg-surface-3 text-text-muted"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isOverLimit ? "bg-rose-400 animate-ping" : isMoving ? "bg-emerald-400 telemetry-live-glow" : "bg-text-muted"}`} />
                {isOverLimit ? t("ALERT", "تنبيه", "انتباہ") : isMoving ? t("RADAR ON", "رادار نشط", "رڈار آن") : t("PARKED", "وقوف", "پارک")}
              </span>
            </div>
            <span className="block text-micro font-medium text-text-muted">
              {t("Highway limit: 90 km/h", "الحد النظامي الأقصى: ٩٠ كم/س", "قانونی حد: 90 کلومیٹر")}
              {" · "}
              {t("GPS Calibrated", "معايرة دقيقة عبر GPS", "جی پی ایس ہم آہنگ")}
            </span>
          </div>
        </div>

        {/* Live Speed Badge */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-baseline justify-end gap-1 rounded-control bg-surface-2/80 px-2.5 py-1">
            <span className="text-section-title font-black tabular-nums text-text-primary">
              {clampedSpeed}
            </span>
            <span className="text-micro font-bold text-text-muted">
              {t("km/h", "كم/س", "کلومیٹر/گھنٹہ")}
            </span>
          </div>
          <span className={`inline-block rounded-micro border px-2 py-0.5 text-micro font-semibold shadow-xs ${tone.bg} ${tone.text} ${tone.border}`}>
            {tone.label}
          </span>
        </div>
      </div>

      {/* Clock-Style Speedometer SVG Dial Container */}
      <div className="relative my-2 flex h-36 items-center justify-center overflow-hidden">
        <svg
          viewBox="0 0 240 152"
          className="h-full w-full max-w-[280px] select-none overflow-visible"
        >
          <defs>
            {/* Speed track gradient */}
            <linearGradient id="speedDialGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#22c55e" />
              <stop offset="75%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>

            {/* Glowing neon aura filter */}
            <filter id="needleGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f97316" floodOpacity="0.85" />
            </filter>

            <filter id="arcGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Hub metallic gradient */}
            <radialGradient id="hubMetallic" cx="45%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="55%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#090d16" />
            </radialGradient>
          </defs>

          {/* Background Concentric Arc Track */}
          <path
            d="M 45 142 A 78 78 0 1 1 195 142"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            className="text-surface-3/70"
          />

          {/* Dynamic Active Colored Speed Arc with Glowing Filter */}
          <path
            d="M 45 142 A 78 78 0 1 1 195 142"
            fill="none"
            stroke="url(#speedDialGrad)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${filledDash} ${arcLength}`}
            filter="url(#arcGlow)"
            style={{
              transition: "stroke-dasharray 0.8s cubic-bezier(0.34, 1.35, 0.64, 1)",
            }}
          />

          {/* 3D Glass Lens Reflection Arc across top half */}
          <path
            d="M 54 130 A 70 70 0 0 1 186 130"
            fill="none"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="2"
            strokeLinecap="round"
            pointerEvents="none"
          />

          {/* Radial Tick Marks and Numbers */}
          {ticks.map((tVal) => {
            const angleDeg = -115 + (tVal / speedMax) * 230;
            const angleRad = ((angleDeg - 90) * Math.PI) / 180;
            const isLimit = tVal === 90;
            const isMajor = tVal === 0 || tVal === 60 || tVal === 120 || isLimit;

            const rInner = isLimit ? radius - 16 : isMajor ? radius - 14 : radius - 9;
            const rOuter = radius - 3;
            const x1 = cx + rInner * Math.cos(angleRad);
            const y1 = cy + rInner * Math.sin(angleRad);
            const x2 = cx + rOuter * Math.cos(angleRad);
            const y2 = cy + rOuter * Math.sin(angleRad);

            // Label coordinate
            const rLabel = radius - 25;
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
                  strokeWidth={isLimit ? "3" : isMajor ? "2" : "1"}
                  className={isLimit ? "" : isMajor ? "text-text-secondary" : "text-text-muted/40"}
                />
                {(isMajor || tVal === 20 || tVal === 40 || tVal === 80 || tVal === 100) && (
                  <text
                    x={xLabel}
                    y={yLabel}
                    fontSize="8.5"
                    fontWeight={isLimit ? "800" : "600"}
                    textAnchor="middle"
                    fill={isLimit ? "#ef4444" : "var(--color-text-muted)"}
                    className="font-mono select-none"
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
              className="fill-text-primary text-hero-sm font-black tabular-nums tracking-tight select-none"
              style={{ fontSize: "24px", fontWeight: "900", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }}
            >
              {clampedSpeed}
            </text>
            <text
              x="0"
              y="11"
              textAnchor="middle"
              className="fill-text-muted text-micro font-bold select-none"
              style={{ fontSize: "8.5px", letterSpacing: "0.5px" }}
            >
              {t("KM/H", "كم/ساعة", "کلومیٹر/گھنٹہ")}
            </text>
          </g>

          {/* Dynamic Animated Cockpit Needle */}
          <g
            style={{
              transform: `rotate(${needleAngle}deg)`,
              transformOrigin: `${cx}px ${cy}px`,
              transition: "transform 0.8s cubic-bezier(0.34, 1.35, 0.64, 1)",
            }}
          >
            {/* Tapered Aerodynamic Needle Blade */}
            <polygon
              points={`${cx - 2.8},${cy} ${cx + 2.8},${cy} ${cx + 0.8},${cy - 68} ${cx - 0.8},${cy - 68}`}
              fill="var(--color-brand)"
              filter="url(#needleGlow)"
            />
            {/* Glowing Pointer Tip */}
            <circle cx={cx} cy={cy - 68} r="2.8" fill="#ff6b1a" />
            {/* Counterbalance tail */}
            <polygon
              points={`${cx - 3.2},${cy} ${cx + 3.2},${cy} ${cx},${cy + 15}`}
              fill="var(--color-brand-soft)"
              opacity="0.8"
            />
          </g>

          {/* Center Metallic Hub & Glowing Core */}
          <circle cx={cx} cy={cy} r="15" fill="url(#hubMetallic)" stroke="#64748b" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r="9.5" fill="var(--color-surface-4)" />
          <circle
            cx={cx}
            cy={cy}
            r="5"
            fill={clampedSpeed > 0 ? "var(--color-brand)" : "var(--color-text-muted)"}
            className="speedometer-pulse"
          />
        </svg>
      </div>

      {/* Cockpit Smart Telemetry Sensors Grid */}
      <div className="my-2 grid grid-cols-3 gap-2 rounded-control border border-border-subtle/60 bg-surface-2/60 p-2">
        <div className="text-start">
          <span className="block text-micro font-medium text-text-muted">
            {t("Engine RPM", "دوران المحرك", "انجن آر پی ایم")}
          </span>
          <div className="mt-0.5 flex items-center gap-1.5">
            <div className="flex h-3 items-end gap-0.5">
              <span className="tachometer-bar-pulse w-1 rounded-full bg-emerald-400" style={{ height: "65%" }} />
              <span className="tachometer-bar-pulse w-1 rounded-full bg-emerald-400" style={{ height: "85%", animationDelay: "0.2s" }} />
              <span className="tachometer-bar-pulse w-1 rounded-full bg-emerald-400" style={{ height: "50%", animationDelay: "0.4s" }} />
            </div>
            <span className="text-label font-bold tabular-nums text-text-primary">
              {simulatedRpm.toLocaleString()} <span className="text-micro font-normal text-text-muted">RPM</span>
            </span>
          </div>
        </div>
        <div className="text-center border-x border-border-subtle/50 px-1">
          <span className="block text-micro font-medium text-text-muted">
            {t("Active Gear", "ناقل الحركة", "گیئر")}
          </span>
          <span className="mt-0.5 inline-block rounded-micro bg-brand/15 px-2 py-0.5 text-label font-black text-brand">
            {gear}
          </span>
        </div>
        <div className="text-end">
          <span className="block text-micro font-medium text-text-muted">
            {t("Eco Efficiency", "كفاءة القيادة", "ماحول دوست سکور")}
          </span>
          <span className="mt-0.5 block text-label font-bold text-emerald-400">
            {ecoScore}% <span className="text-micro font-normal text-text-muted">Score</span>
          </span>
        </div>
      </div>

      {/* Bottom Summary Rail */}
      <div className="flex items-center justify-between text-micro text-text-muted">
        <span className="flex items-center gap-1.5 font-medium">
          <span
            className={`h-2 w-2 rounded-full ${
              clampedSpeed === 0
                ? "bg-text-muted"
                : isOverLimit
                ? "bg-status-danger animate-ping"
                : "bg-status-active telemetry-live-glow"
            }`}
          />
          {clampedSpeed === 0
            ? t("Vehicle Parked", "المركبة متوقفة بأمان", "گاڑی پارک ہے")
            : isOverLimit
            ? t("Speed Exceeded", "تجاوز السرعة المحددة", "حد سے زیادہ رفتار")
            : t("Cruising Smoothly", "حركة سير نظامية ومستقرة", "معمول کی رفتار")}
        </span>
        <span className="tabular-nums font-mono font-semibold text-text-secondary">
          {t("Safety Threshold: 90", "الحد الآمن: ٩٠ كم/س", "حفاظتی حد: 90")}
        </span>
      </div>
    </div>
  );
};
