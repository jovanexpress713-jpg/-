import { useId } from "react";
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
 * The trailer box itself is the capacity meter: the blue fill is anchored at
 * the FRONT of the trailer and grows toward the REAR, and the figure is
 * centred inside the FILLED region — exactly as the brief demands.
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
 * Width of the filled (blue) region for a given percentage. Anchored at the
 * FRONT of the trailer, growing toward the REAR.
 */
export function capacityFillWidth(pct: number, overlayWidth = OVERLAY.w): number {
  const p = Math.max(0, Math.min(100, pct));
  return (overlayWidth * p) / 100;
}

/** Centre of the FILLED region — the figure is centred here, not mid-trailer. */
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
}

export function CapacityTruck({ pct, className, label }: Props) {
  const uid = useId().replace(/:/g, "");
  const p = Math.max(0, Math.min(100, pct));
  const fillW = capacityFillWidth(p);
  const textX = OVERLAY.x + fillW / 2;
  const textY = OVERLAY.y + OVERLAY.h / 2;
  /* The figure scales with the fill so it never outgrows the blue region. */
  const fontSize = Math.max(40, Math.min(118, fillW * 0.42));
  /* Hide the figure when there is no blue to centre it in. */
  const showText = p >= 6;

  return (
    <svg
      viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`}
      className={cn("w-full", className)}
      role="img"
      aria-label={label ?? `${Math.round(p)}%`}
    >
      <defs>
        {/* Spec: electric blue, subtle gradient rather than flat. */}
        <linearGradient id={`load-${uid}`} x1="0" y1="0" x2="1" y2="0.35">
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
        {/* Filled capacity — grows from the FRONT toward the REAR. */}
        <rect
          x={OVERLAY.x}
          y={OVERLAY.y}
          height={OVERLAY.h}
          width={fillW}
          fill={`url(#load-${uid})`}
          opacity={0.93}
          style={{ transition: `width var(--ds-fill, 600ms) ease-out` }}
        />
        {/* Light variation along the fill's leading edge. */}
        <rect
          x={OVERLAY.x + Math.max(0, fillW - 3)}
          y={OVERLAY.y}
          width={3}
          height={OVERLAY.h}
          fill="#ffffff"
          opacity={p > 0 && p < 100 ? 0.35 : 0}
          style={{ transition: `x var(--ds-fill, 600ms) ease-out` }}
        />
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
            transition: `x var(--ds-fill, 600ms) ease-out`,
          }}
        >
          {Math.round(p)}%
        </text>
      )}
    </svg>
  );
}
