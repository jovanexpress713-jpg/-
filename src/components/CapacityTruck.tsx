import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { useVehicleAssets } from "../state/vehicleAssetStore";
import { normalizeVehicleType, type CanonicalVehicleTypeId } from "../data/vehicleTypes";
import { useSettings } from "../settings";
import type { Vehicle } from "../data/types";

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

// Cargo anchors are normalized to the source-image plane (not CSS pixels),
// so each mask scales with its own official photograph at every card size.
const SOURCE_PLANE = { width: 1536, height: 1024 } as const;
type Point = readonly [number, number];
interface GaugeAnchors {
  corners: readonly [Point, Point, Point, Point];
  top: number;
  bottom: number;
  centerX: number;
  amplitude: number;
  deck?: boolean;
}
const TYPE_GAUGE_ANCHORS: Record<CanonicalVehicleTypeId, GaugeAnchors> = {
  flatbed: {
    corners: [[702 / 1536, 627 / 1024], [1450 / 1536, 649 / 1024], [1450 / 1536, 665 / 1024], [710 / 1536, 644 / 1024]],
    top: 627 / 1024, bottom: 665 / 1024, centerX: 1080 / 1536, amplitude: 4 / 1024, deck: true,
  },
  reefer: {
    corners: [[804 / 1536, 226 / 1024], [1442 / 1536, 452 / 1024], [1442 / 1536, 675 / 1024], [804 / 1536, 660 / 1024]],
    top: 226 / 1024, bottom: 675 / 1024, centerX: 1120 / 1536, amplitude: 16 / 1024,
  },
  dry: {
    corners: [[696 / 1536, 222 / 1024], [1438 / 1536, 458 / 1024], [1438 / 1536, 665 / 1024], [710 / 1536, 645 / 1024]],
    top: 222 / 1024, bottom: 665 / 1024, centerX: 1067 / 1536, amplitude: 16 / 1024,
  },
  curtain: {
    corners: [[696 / 1536, 243 / 1024], [1444 / 1536, 449 / 1024], [1444 / 1536, 608 / 1024], [710 / 1536, 614 / 1024]],
    top: 243 / 1024, bottom: 614 / 1024, centerX: 1070 / 1536, amplitude: 16 / 1024,
  },
};
function formatCoord(value: number) {
  return Number(value.toFixed(2)).toString();
}
function materializeGaugeShape(anchors: GaugeAnchors) {
  const points: readonly [Point, Point, Point, Point] = [
    [anchors.corners[0][0] * SOURCE_PLANE.width, anchors.corners[0][1] * SOURCE_PLANE.height],
    [anchors.corners[1][0] * SOURCE_PLANE.width, anchors.corners[1][1] * SOURCE_PLANE.height],
    [anchors.corners[2][0] * SOURCE_PLANE.width, anchors.corners[2][1] * SOURCE_PLANE.height],
    [anchors.corners[3][0] * SOURCE_PLANE.width, anchors.corners[3][1] * SOURCE_PLANE.height],
  ];
  const [first, ...rest] = points;
  const clip = `M ${formatCoord(first[0])} ${formatCoord(first[1])} ${rest.map(([x, y]) => `L ${formatCoord(x)} ${formatCoord(y)}`).join(" ")} Z`;
  return {
    clip,
    top: anchors.top * SOURCE_PLANE.height,
    bottom: anchors.bottom * SOURCE_PLANE.height,
    centerX: anchors.centerX * SOURCE_PLANE.width,
    amplitude: anchors.amplitude * SOURCE_PLANE.height,
    deck: anchors.deck,
    deckStart: anchors.deck ? anchors.corners[0][0] * SOURCE_PLANE.width : 0,
    deckEnd: anchors.deck ? anchors.corners[1][0] * SOURCE_PLANE.width : 0,
    deckStartY: anchors.deck ? anchors.corners[0][1] * SOURCE_PLANE.height : 0,
    deckEndY: anchors.deck ? anchors.corners[1][1] * SOURCE_PLANE.height : 0,
    points,
  };
}

function perspectiveWavePath(
  points: readonly [Point, Point, Point, Point],
  p: number,
  amplitude: number,
  phase = 0,
  yOffset = 0
) {
  const hFront = points[3][1] - points[0][1];
  const hRear = points[2][1] - points[1][1];
  const yFront = points[3][1] - (hFront * p) / 100 + yOffset;
  const yRear = points[2][1] - (hRear * p) / 100 + yOffset;

  const xStart = Math.min(points[0][0], points[3][0]) - 60;
  const xEnd = Math.max(points[1][0], points[2][0]) + 60;
  const dx = xEnd - xStart;

  const steps = 12;
  const stepX = dx / steps;
  let d = `M ${formatCoord(xStart)} ${formatCoord(yFront)}`;

  for (let i = 0; i < steps; i++) {
    const x0 = xStart + i * stepX;
    const x1 = x0 + stepX;
    const t0 = (x0 - xStart) / dx;
    const t1 = (x1 - xStart) / dx;
    const lineY0 = yFront + t0 * (yRear - yFront);
    const lineY1 = yFront + t1 * (yRear - yFront);

    const wave0 = Math.sin((i + phase) * 1.4) * amplitude;
    const wave1 = Math.sin((i + 1 + phase) * 1.4) * amplitude;

    const cp1x = x0 + stepX * 0.35;
    const cp1y = lineY0 + wave0;
    const cp2x = x0 + stepX * 0.65;
    const cp2y = lineY1 + wave1;
    const destX = x1;
    const destY = lineY1 + wave1;

    d += ` C ${formatCoord(cp1x)} ${formatCoord(cp1y)}, ${formatCoord(cp2x)} ${formatCoord(cp2y)}, ${formatCoord(destX)} ${formatCoord(destY)}`;
  }

  const bottomMax = Math.max(points[2][1], points[3][1]) + 80;
  d += ` L ${formatCoord(xEnd)} ${formatCoord(bottomMax)} L ${formatCoord(xStart)} ${formatCoord(bottomMax)} Z`;
  return d;
}

function perspectiveCrestPath(
  points: readonly [Point, Point, Point, Point],
  p: number,
  amplitude: number
) {
  const hFront = points[3][1] - points[0][1];
  const hRear = points[2][1] - points[1][1];
  const yFront = points[3][1] - (hFront * p) / 100;
  const yRear = points[2][1] - (hRear * p) / 100;

  const xStart = Math.min(points[0][0], points[3][0]) - 60;
  const xEnd = Math.max(points[1][0], points[2][0]) + 60;
  const dx = xEnd - xStart;

  const steps = 12;
  const stepX = dx / steps;
  let d = `M ${formatCoord(xStart)} ${formatCoord(yFront)}`;

  for (let i = 0; i < steps; i++) {
    const x0 = xStart + i * stepX;
    const x1 = x0 + stepX;
    const t0 = (x0 - xStart) / dx;
    const t1 = (x1 - xStart) / dx;
    const lineY0 = yFront + t0 * (yRear - yFront);
    const lineY1 = yFront + t1 * (yRear - yFront);

    const wave0 = Math.sin(i * 1.4) * amplitude;
    const wave1 = Math.sin((i + 1) * 1.4) * amplitude;

    const cp1x = x0 + stepX * 0.35;
    const cp1y = lineY0 + wave0;
    const cp2x = x0 + stepX * 0.65;
    const cp2y = lineY1 + wave1;
    const destX = x1;
    const destY = lineY1 + wave1;

    d += ` C ${formatCoord(cp1x)} ${formatCoord(cp1y)}, ${formatCoord(cp2x)} ${formatCoord(cp2y)}, ${formatCoord(destX)} ${formatCoord(destY)}`;
  }
  return d;
}

function perspectiveLiquidPolygon(
  points: readonly [Point, Point, Point, Point],
  p: number
) {
  const hFront = points[3][1] - points[0][1];
  const hRear = points[2][1] - points[1][1];
  const yFront = points[3][1] - (hFront * p) / 100;
  const yRear = points[2][1] - (hRear * p) / 100;

  const xStart = Math.min(points[0][0], points[3][0]) - 60;
  const xEnd = Math.max(points[1][0], points[2][0]) + 60;
  const bottomMax = Math.max(points[2][1], points[3][1]) + 80;

  return `${formatCoord(xStart)},${formatCoord(yFront)} ${formatCoord(xEnd)},${formatCoord(yRear)} ${formatCoord(xEnd)},${formatCoord(bottomMax)} ${formatCoord(xStart)},${formatCoord(bottomMax)}`;
}

function waterAreaPath(y: number, bottom: number, amplitude = 28) {
  let d = `M -160 ${y}`;
  for (let x = -160; x < 1696; x += 128) {
    d += ` C ${x + 32} ${y - amplitude}, ${x + 96} ${y + amplitude}, ${x + 128} ${y}`;
  }
  return `${d} L 1696 ${bottom + 24} L -160 ${bottom + 24} Z`;
}

interface Props {
  /** Current load as a percentage of max capacity, 0–100. */
  pct: number;
  className?: string;
  /** Accessible name; defaults to a percentage readout. */
  label?: string;
  /** Animate from zero to the supplied value when mounted or when it changes. */
  countUp?: boolean;
  /** Approved EJAZ cargo body; selects its official image and trailer shape. */
  truckType?: CanonicalVehicleTypeId | string;
  /** Assigned vehicle for per-vehicle published imagery. */
  vehicle?: Pick<Vehicle, "id" | "body" | "customImage"> | null;
}

export function CapacityTruck({ pct, className, label, countUp = false, truckType, vehicle }: Props) {
  const uid = useId().replace(/:/g, "");
  const { t } = useSettings();
  const { typeImage } = useVehicleAssets();
  const rawType = truckType ?? vehicle?.body;
  const selectedType = rawType ? normalizeVehicleType(rawType) : null;
  // The meter always uses the official image of the selected cargo body, not
  // a per-vehicle override that could belong to a different body shape.
  const typeSpecificSrc = selectedType ? typeImage(selectedType) : null;
  const targetPct = Math.max(0, Math.min(100, pct));
  const currentPctRef = useRef(countUp ? 0 : targetPct);
  const [animatedPct, setAnimatedPct] = useState(countUp ? 0 : targetPct);
  const [arrivalGlow, setArrivalGlow] = useState(false);

  useEffect(() => {
    if (!countUp) {
      currentPctRef.current = targetPct;
      setAnimatedPct(targetPct);
      return;
    }

    const startPct = currentPctRef.current;
    setArrivalGlow(false);
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      currentPctRef.current = targetPct;
      setAnimatedPct(targetPct);
      return;
    }

    const start = Date.now();
    const duration = 1050;
    let frame = 0;
    let glowTimer = 0;
    const step = () => {
      const progress = Math.min(1, Math.max(0, (Date.now() - start) / duration));
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextPct = startPct + (targetPct - startPct) * eased;
      currentPctRef.current = nextPct;
      setAnimatedPct(nextPct);
      if (progress < 1) {
        frame = window.requestAnimationFrame(step);
      } else {
        setArrivalGlow(true);
        glowTimer = window.setTimeout(() => setArrivalGlow(false), 620);
      }
    };
    frame = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(glowTimer);
    };
  }, [countUp, targetPct]);

  const p = Math.max(0, Math.min(100, animatedPct));
  const fillH = capacityFillHeight(p);
  const fillY = OVERLAY.y + OVERLAY.h - fillH;
  const textX = OVERLAY.x + OVERLAY.w / 2;
  const textY = fillY + fillH / 2;
  /* Scale to the liquid height so the figure fits even at low percentages. */
  const fontSize = Math.max(40, Math.min(118, Math.min(fillH, OVERLAY.w) * 0.42));
  const showText = p >= 6;
  const wavePath = waterAreaPath(fillY, OVERLAY.y + OVERLAY.h, 22);
  const secondWavePath = waterAreaPath(fillY + 9, OVERLAY.y + OVERLAY.h, 14);

  if (selectedType && typeSpecificSrc) {
    const shape = materializeGaugeShape(TYPE_GAUGE_ANCHORS[selectedType]);

    if (shape.deck) {
      const deckFillWidth = (shape.deckEnd - shape.deckStart) * p / 100;
      const deckFillY = shape.deckStartY + (shape.deckEndY - shape.deckStartY) * p / 100;
      return (
        <svg viewBox="0 120 1536 760" className={cn("w-full", className)} role="img" aria-label={label ?? `${Math.round(p)}%`}>
          <defs>
            <linearGradient id={`typed-load-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#55a8ff" />
              <stop offset="100%" stopColor="#1559d6" />
            </linearGradient>
            <clipPath id={`typed-clip-${uid}`} clipPathUnits="userSpaceOnUse"><path d={shape.clip} /></clipPath>
            <filter id={`deck-glow-${uid}`} x="-30%" y="-250%" width="160%" height="600%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <image href={typeSpecificSrc} x="0" y="0" width={SOURCE_PLANE.width} height={SOURCE_PLANE.height} preserveAspectRatio="none" />
          <g clipPath={`url(#typed-clip-${uid})`}>
            <rect x={shape.deckStart} y={shape.top - 18} width={deckFillWidth} height={shape.bottom - shape.top + 36} fill={`url(#typed-load-${uid})`} opacity=".82" />
          </g>
          <path d={shape.clip} fill="none" stroke="#9cb0c6" strokeWidth="2" opacity=".72" />
          {p > 0 && <path d={`M ${shape.deckStart} ${shape.deckStartY + 2} L ${shape.deckStart + deckFillWidth} ${deckFillY + 2}`} fill="none" stroke="#b9e3ff" strokeWidth="3" opacity=".85" filter={arrivalGlow ? `url(#deck-glow-${uid})` : undefined} />}
          {showText && <text x={shape.centerX} y={shape.top - 24} textAnchor="middle" dominantBaseline="central" fill="#fff" style={{ fontFamily: "var(--font-mono)", fontSize: 58, fontWeight: 800, filter: "drop-shadow(0 1px 5px rgba(0,0,0,.72))" }}>{Math.round(p)}%</text>}
        </svg>
      );
    }

    const hFront = shape.points[3][1] - shape.points[0][1];
    const hRear = shape.points[2][1] - shape.points[1][1];
    const tCenter = Math.max(0, Math.min(1, (shape.centerX - shape.points[3][0]) / (shape.points[2][0] - shape.points[3][0])));
    const floorAtCenter = shape.points[3][1] + tCenter * (shape.points[2][1] - shape.points[3][1]);
    const waterYFront = shape.points[3][1] - (hFront * p) / 100;
    const waterYRear = shape.points[2][1] - (hRear * p) / 100;
    const waterAtCenter = waterYFront + tCenter * (waterYRear - waterYFront);
    const liquidCenterY = (floorAtCenter + waterAtCenter) / 2;

    const liquidPolygon = perspectiveLiquidPolygon(shape.points, p);
    const typeWave = perspectiveWavePath(shape.points, p, shape.amplitude, 0, 0);
    const typeWaveSecondary = perspectiveWavePath(shape.points, p, shape.amplitude * 0.65, 1.4, shape.amplitude * 0.5);
    const typeWaveCrest = perspectiveCrestPath(shape.points, p, shape.amplitude);

    const typeTextSize = Math.max(26, Math.min(104, (floorAtCenter - waterAtCenter) * 0.38));
    const typeTextY = p >= 16 ? liquidCenterY : waterAtCenter - 32;
    const captionY = typeTextY + typeTextSize * 0.58;
    const hasLoadCaption = selectedType === "reefer" || selectedType === "curtain";
    return (
      <svg viewBox="0 120 1536 760" className={cn("w-full", className)} role="img" aria-label={label ?? `${Math.round(p)}%`}>
        <defs>
          <linearGradient id={`typed-load-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#55a8ff" />
            <stop offset="100%" stopColor="#1559d6" />
          </linearGradient>
          <clipPath id={`typed-clip-${uid}`} clipPathUnits="userSpaceOnUse"><path d={shape.clip} /></clipPath>
          <filter id={`typed-water-glow-${uid}`} x="-20%" y="-80%" width="140%" height="260%">
            <feGaussianBlur stdDeviation="4" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <image href={typeSpecificSrc} x="0" y="0" width={SOURCE_PLANE.width} height={SOURCE_PLANE.height} preserveAspectRatio="none" />
        <g clipPath={`url(#typed-clip-${uid})`}>
          <path d={shape.clip} fill="#061323" opacity=".1" />
          <polygon points={liquidPolygon} fill={`url(#typed-load-${uid})`} opacity=".72" />
          {p > 0 && <>
            <path d={typeWave} fill="#59a9ff" opacity=".38" className="capacity-water-wave" />
            <path d={typeWaveSecondary} fill="#b4dcff" opacity=".22" className="capacity-water-wave capacity-water-wave-highlight" />
            <path d={typeWaveCrest} fill="none" stroke="#e0f2fe" strokeWidth="4.5" opacity=".9" className="capacity-water-wave capacity-water-wave-highlight" filter={`url(#typed-water-glow-${uid})`} />
          </>}
        </g>
        <path d={shape.clip} fill="none" stroke="#d3e5f4" strokeWidth="2.5" opacity=".7" />
        {showText && <>
          <text x={shape.centerX} y={typeTextY} textAnchor="middle" dominantBaseline="central" fill="#fff" style={{ fontFamily: "var(--font-mono)", fontSize: typeTextSize, fontWeight: 800, filter: "drop-shadow(0 2px 8px rgba(0,0,0,.75))" }}>{Math.round(p)}%</text>
          {hasLoadCaption && <text x={shape.centerX} y={captionY} textAnchor="middle" dominantBaseline="central" fill="#e8f5ff" opacity=".9" style={{ fontFamily: "var(--font-sans)", fontSize: Math.max(22, typeTextSize * 0.44), fontWeight: 600, filter: "drop-shadow(0 1px 4px rgba(0,0,0,.6))" }}>{t("of load", "من الحمولة")}</text>}
        </>}
      </svg>
    );
  }

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

        <filter id={`crest-glow-${uid}`} x="-10%" y="-60%" width="120%" height="220%">
          <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor="#93c5fd" floodOpacity="0.75" />
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
          <path d={wavePath} fill="#77baff" opacity={0.5} className="capacity-water-wave" />
          <path d={secondWavePath} fill="#9ed4ff" opacity={0.24} className="capacity-water-wave capacity-water-wave-highlight" />
          <path d={wavePath} fill="none" stroke="#e0f2fe" strokeWidth={7.5} opacity={0.88} className="capacity-water-wave capacity-water-wave-highlight" filter={`url(#crest-glow-${uid})`} />
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
