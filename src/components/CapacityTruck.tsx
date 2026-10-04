import { useEffect, useId, useState } from "react";
import { cn } from "../utils/cn";

/**
 * CapacityTruck — the photographic truck the user supplied, with the load
 * percentage painted ON TOP of it.
 *
 * The vehicle is a real photograph (white cab-over tractor + long white box
 * trailer, facing LEFT) keyed out of a chroma backdrop. Every constant below
 * was MEASURED from that asset's pixels (see scripts in git history), not
 * eyeballed, and is exported so the test suite can assert the proportions.
 *
 * The trailer box itself is a liquid-style capacity meter: the blue level rises
 * from the floor, its waterline ripples continuously, and the animated figure
 * settles at the true trip percentage.
 */

/* ── Photographic asset ────────────────────────────────────────────────── */

/** The keyed-out photograph of the reference truck. */
export const TRUCK_IMG = "/images/trucks/official/capacity-truck-left.png";

/** Native pixel size of the asset. */
export const IMG = { w: 1408, h: 768 } as const;

/** The visible crop: trims the empty sky/floor of the photograph. */
export const VIEWBOX = { x: 0, y: 140, w: 1408, h: 520 } as const;

/* ── Measured geometry (asset pixel space) ─────────────────────────────── */

/** Whole-vehicle bounding box: 1256 × 416 ≈ 3.02 : 1. */
export const TRUCK = { x: 82, y: 188, w: 1256, h: 416 } as const;

/**
 * Cabin (tractor unit): the left 24.2% of the vehicle, roof fairing included.
 * The trailer starts where the cabin ends, so the truck faces LEFT.
 */
export const CABIN = {
  x: TRUCK.x,
  w: 304,
  top: 190,
  bottom: TRUCK.y + TRUCK.h,
  h: TRUCK.y + TRUCK.h - 190,
} as const;

/**
 * The white cargo box — the capacity meter. 75.2% of the vehicle length,
 * 3.1× the cabin, 68.8% of the vehicle height.
 */
export const TRAILER = { x: 386, y: 193, w: 944, h: 286 } as const;

/**
 * Capacity overlay: inset 12px inside the trailer (91.6% of its height) so
 * the fill never leaks past the box, and its floor (y 467) stays above the
 * wheel tops (y ≈ 478) so it never covers a wheel.
 */
export const OVERLAY = {
  x: TRAILER.x + 12,
  y: TRAILER.y + 12,
  w: TRAILER.w - 24,
  h: TRAILER.h - 24,
} as const;

/**
 * The four measured wheels — deliberately NOT evenly spaced: one front wheel
 * under the cab, one drive wheel behind the fuel tank, and a closely grouped
 * dual axle at the trailer rear. All share one ground baseline (cy ≈ 542).
 */
export const WHEELS: {
  cx: number;
  cy: number;
  d: number;
  role: "front" | "drive" | "trailer";
}[] = [
  { cx: 231, cy: 541, d: 127, role: "front" },
  { cx: 563, cy: 543, d: 118, role: "drive" },
  { cx: 1008, cy: 543, d: 116, role: "trailer" },
  { cx: 1133, cy: 543, d: 116, role: "trailer" },
];

/** Front-wheel diameter and the shared wheel baseline, for the test suite. */
export const WHEEL_D = 127;
export const WHEEL_CY = 542;

/* ── Capacity fill ─────────────────────────────────────────────────────── */

/**
 * Legacy horizontal fill math retained for existing callers. The visible meter
 * now uses capacityFillHeight to represent liquid rising from the trailer floor.
 */
export function capacityFillWidth(pct: number, overlayWidth = OVERLAY.w): number {
  const p = Math.max(0, Math.min(100, pct));
  return (overlayWidth * p) / 100;
}

/** Liquid level height for the tank-like, bottom-up capacity fill. */
export function capacityFillHeight(pct: number, overlayHeight = OVERLAY.h): number {
  const p = Math.max(0, Math.min(100, pct));
  return (overlayHeight * p) / 100;
}

/** Centreline of the current liquid surface column. */
export function capacityTextVerticalCentre(pct: number, overlayHeight = OVERLAY.h): number {
  const height = capacityFillHeight(pct, overlayHeight);
  return OVERLAY.y + OVERLAY.h - height / 2;
}

/** Centre of the legacy horizontal fill calculation, kept for callers/tests. */
export function capacityTextCentre(pct: number, overlayWidth = OVERLAY.w): number {
  return OVERLAY.x + capacityFillWidth(pct, overlayWidth) / 2;
}

/** Electric blue from the reconstruction spec; subtle gradient, not flat. */
export const LOAD_BLUE = { from: "#2f67ff", to: "#245bff" } as const;
/** Unused cargo space veil — mid grey over the white box, never black/white. */
export const LOAD_EMPTY = "#4a5468";

interface Props {
  /** Current load as a percentage of max capacity, 0–100. */
  pct: number;
  className?: string;
  /** Accessible name; defaults to a percentage readout. */
  label?: string;
  /** Animate from zero to the supplied value when mounted or when it changes. */
  countUp?: boolean;
}

export function CapacityTruck({ pct, className, label, countUp = false }: Props) {
  const uid = useId().replace(/:/g, "");
  const targetPct = Math.max(0, Math.min(100, pct));
  const [animatedPct, setAnimatedPct] = useState(countUp ? 0 : targetPct);

  useEffect(() => {
    if (!countUp) {
      setAnimatedPct(targetPct);
      return;
    }

    setAnimatedPct(0);
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setAnimatedPct(targetPct);
      return;
    }

    const start = Date.now();
    const duration = 720;
    let frame = 0;
    const step = () => {
      const progress = Math.min(1, Math.max(0, (Date.now() - start) / duration));
      const eased = 1 - Math.pow(1 - progress, 4);
      setAnimatedPct(targetPct * eased);
      if (progress < 1) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [countUp, targetPct]);

  const p = Math.max(0, Math.min(100, animatedPct));
  const fillH = capacityFillHeight(p);
  const fillY = OVERLAY.y + OVERLAY.h - fillH;
  const textX = OVERLAY.x + OVERLAY.w / 2;
  const textY = fillY + fillH / 2;
  /* Scale to the liquid height so the figure fits even at low percentages. */
  const fontSize = Math.max(40, Math.min(118, Math.min(fillH, OVERLAY.w) * 0.42));
  const showText = p >= 6;
  const wavePath = `M ${OVERLAY.x - 110} ${fillY} C ${OVERLAY.x - 45} ${fillY - 10}, ${OVERLAY.x + 25} ${fillY + 10}, ${OVERLAY.x + 90} ${fillY} S ${OVERLAY.x + 220} ${fillY - 10}, ${OVERLAY.x + 285} ${fillY} S ${OVERLAY.x + 415} ${fillY + 10}, ${OVERLAY.x + 480} ${fillY} S ${OVERLAY.x + 610} ${fillY - 10}, ${OVERLAY.x + 675} ${fillY} S ${OVERLAY.x + 805} ${fillY + 10}, ${OVERLAY.x + 870} ${fillY} L ${OVERLAY.x + OVERLAY.w + 110} ${OVERLAY.y + OVERLAY.h} L ${OVERLAY.x - 110} ${OVERLAY.y + OVERLAY.h} Z`;

  return (
    <svg
      viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`}
      className={cn("w-full", className)}
      role="img"
      aria-label={label ?? `${Math.round(p)}%`}
    >
      <defs>
        {/* Deep-to-light blue vertical gradient makes the load read as liquid. */}
        <linearGradient id={`load-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={LOAD_BLUE.from} />
          <stop offset="100%" stopColor={LOAD_BLUE.to} />
        </linearGradient>

        <filter id={`shadow-${uid}`} x="-10%" y="-60%" width="120%" height="260%">
          <feGaussianBlur stdDeviation="10" />
        </filter>

        {/* Rounded interior so the fill follows the trailer's own shape. */}
        <clipPath id={`clip-${uid}`}>
          <rect x={OVERLAY.x} y={OVERLAY.y} width={OVERLAY.w} height={OVERLAY.h} rx={6} />
        </clipPath>
      </defs>

      {/* ── Ground shadow: subtle, slightly wider than the wheelbase ─────── */}
      <ellipse
        cx={(WHEELS[0].cx + WHEELS[3].cx) / 2}
        cy={TRUCK.y + TRUCK.h + 10}
        rx={(WHEELS[3].cx - WHEELS[0].cx) / 2 + 60}
        ry={13}
        fill="#04070f"
        opacity={0.5}
        filter={`url(#shadow-${uid})`}
      />

      {/* ── The truck itself: the user's photographic asset ─────────────── */}
      <image
        href={TRUCK_IMG}
        x={0}
        y={0}
        width={IMG.w}
        height={IMG.h}
        preserveAspectRatio="none"
      />

      {/* ── Capacity meter painted on top of the trailer box ────────────── */}
      <g clipPath={`url(#clip-${uid})`}>
        {/* Unused capacity — a grey veil over the white box. */}
        <rect
          x={OVERLAY.x}
          y={OVERLAY.y}
          width={OVERLAY.w}
          height={OVERLAY.h}
          fill={LOAD_EMPTY}
          opacity={0.3}
        />
        {/* Water-like blue load rises from the trailer floor. */}
        <rect
          x={OVERLAY.x}
          y={fillY}
          width={OVERLAY.w}
          height={fillH}
          fill={`url(#load-${uid})`}
          opacity={0.94}
          style={{ transition: `height var(--ds-fill, 600ms) ease-out, y var(--ds-fill, 600ms) ease-out` }}
        />
        {/* Two overlapping ripples drift across the waterline. */}
        {p > 0 && <>
          <path d={wavePath} fill="#77baff" opacity={0.48} className="capacity-water-wave" />
          <path d={wavePath} fill="none" stroke="#d8efff" strokeWidth={5} opacity={0.58} className="capacity-water-wave capacity-water-wave-highlight" />
        </>}
      </g>
      {/* Overlay frame. */}
      <rect
        x={OVERLAY.x}
        y={OVERLAY.y}
        width={OVERLAY.w}
        height={OVERLAY.h}
        rx={6}
        fill="none"
        stroke="#0f1522"
        strokeWidth={1.5}
        opacity={0.4}
      />

      {/* ── The figure, centred inside the FILLED region, on top of it ──── */}
      {showText && (
        <text
          x={textX}
          y={textY}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            filter: "drop-shadow(0 3px 14px rgba(0,0,0,0.5))",
            transition: `y var(--ds-fill, 600ms) ease-out`,
          }}
        >
          {Math.round(p)}%
        </text>
      )}
    </svg>
  );
}
