import { useId, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { CITIES, KSA_OUTLINE, pointAt, project } from "../data/routes";
import { IconLayers, IconNavigate, IconPin, IconZoomIn, IconZoomOut } from "./Icons";
import { LOAD_BLUE } from "./CapacityTruck";

/**
 * RouteMap — the lower half of the tracking component.
 *
 * Wide landscape (2.2 : 1), dark navigation styling, with the electric-blue
 * route as the strongest element on the canvas.
 *
 * The route is built from the trip's real terminals. The whole map is then
 * rotated so the origin sits at the bottom and the destination at the top —
 * heading-up orientation, which is why the route reads vertically through the
 * frame the way the reference does, regardless of which corridor is selected.
 */

interface Props {
  fromCity: string;
  toCity: string;
  /** 0–100 along the route. */
  progressPct: number;
  /** Corridor key, so the curve shape is stable per route. */
  corridorKey?: string;
  className?: string;
}

export const VIEW = { w: 1100, h: 500 } as const; // 2.2 : 1
const PAD = 74;

/** Deterministic small hash so a corridor always bends the same way. */
function seedOf(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) % 1000;
  return h;
}

/**
 * Builds the road-like polyline between two terminals: the real endpoints plus
 * three intermediate points bowed off the straight line, so the route has
 * natural direction changes instead of being a ruler stroke.
 */
export function buildRoutePoints(
  from: [number, number],
  to: [number, number],
  seed: number,
): [number, number][] {
  const [x1, y1] = project(from[0], from[1]);
  const [x2, y2] = project(to[0], to[1]);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  /* Unit normal, for the lateral bows. */
  const nx = -dy / len;
  const ny = dx / len;
  const bows = [0.1, -0.13, 0.07].map((b, i) => b * (0.75 + ((seed >> (i * 3)) % 9) / 18));

  return [
    [x1, y1],
    ...bows.map((b, i) => {
      const t = (i + 1) / 4;
      return [x1 + dx * t + nx * len * b, y1 + dy * t + ny * len * b] as [number, number];
    }),
    [x2, y2],
  ];
}

/**
 * Rotates the route so it runs bottom→top, then scales and centres it.
 * Returns the transformed points and the heading angle in degrees, which the
 * truck marker reuses so it points along the road.
 */
export function fitRouteVertical(
  points: [number, number][],
  view = VIEW,
  pad = PAD,
): { pts: [number, number][]; rotation: number } {
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const theta = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  /* Aim the origin→destination vector straight up (−90°). */
  const rotation = -90 - theta;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;

  const rotated = points.map(([x, y]) => {
    const px = x - mx;
    const py = y - my;
    return [px * cos - py * sin, px * sin + py * cos] as [number, number];
  });

  const xs = rotated.map((p) => p[0]);
  const ys = rotated.map((p) => p[1]);
  const w = Math.max(1, Math.max(...xs) - Math.min(...xs));
  const h = Math.max(1, Math.max(...ys) - Math.min(...ys));
  const scale = Math.min((view.w - pad * 2) / w, (view.h - pad * 2) / h);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;

  return {
    pts: rotated.map(
      ([x, y]) =>
        [(x - cx) * scale + view.w / 2, (y - cy) * scale + view.h / 2] as [number, number],
    ),
    rotation,
  };
}

/** Catmull-Rom → cubic Bézier, so the polyline renders as a smooth road. */
export function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

/** A miniature of the same truck drawn above, so the two read as one vehicle. */
function TruckGlyph({ size = 20 }: { size?: number }) {
  return (
    <g transform={`scale(${size / 34})`}>
      <rect x="-17" y="-6.5" width="34" height="9" rx="2" fill="#ffffff" />
      <rect x="4" y="-8" width="13" height="12" rx="1.6" fill="#ffffff" />
      <rect x="5.4" y="-6.6" width="6" height="5" rx="1" fill="#1b2230" />
      <circle cx="-9" cy="4.5" r="3.4" fill="#10141d" />
      <circle cx="9" cy="4.5" r="3.4" fill="#10141d" />
    </g>
  );
}

const MAP_LABELS: [string, number, number][] = [
  ["Riyadh", 24.7136, 46.6753],
  ["Jeddah", 21.4858, 39.1925],
  ["Makkah", 21.3891, 39.8579],
  ["Madinah", 24.5247, 39.6125],
  ["Dammam", 26.4207, 50.0888],
  ["Taif", 21.2703, 40.4158],
];

export function RouteMap({ fromCity, toCity, progressPct, corridorKey, className }: Props) {
  const { t } = useSettings();
  const uid = useId().replace(/:/g, "");
  const [zoom, setZoom] = useState(1);

  const a = CITIES[fromCity] ?? CITIES.Riyadh;
  const b = CITIES[toCity] ?? CITIES.Jeddah;
  const seed = seedOf(corridorKey ?? `${fromCity}-${toCity}`);

  const raw = buildRoutePoints(a, b, seed);
  const { pts, rotation } = fitRouteVertical(raw);
  const d = smoothPath(pts);

  const truck = pointAt(pts, Math.max(0, Math.min(100, progressPct)) / 100);
  /* Waypoints sit at fixed fractions of the route, not evenly on the canvas. */
  const waypoints = [0.18, 0.38, 0.62, 0.84].map((u) => pointAt(pts, u));

  /* The map furniture is rotated with the route, so the land mass and the road
     network stay consistent with the heading-up orientation. The anchor is the
     route ORIGIN mapped to its fitted position, so the city labels always sit
     at the correct ends of the route (origin bottom, destination top). */
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const [oax, oay] = raw[0];
  const [ofx, ofy] = pts[0];
  const project_ = (lat: number, lng: number): [number, number] => {
    const [x, y] = project(lat, lng);
    const px = x - oax;
    const py = y - oay;
    const rx = px * cos - py * sin;
    const ry = px * sin + py * cos;
    return [rx + ofx, ry + ofy];
  };

  const controlBtn =
    "grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-white/10 bg-black/55 text-text-secondary backdrop-blur-md transition-colors hover:text-text-primary";

  return (
    <div className={cn("relative w-full overflow-hidden rounded-inner bg-[#0b0f16]", className)}
         style={{ aspectRatio: "2.2 / 1" }}>
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="h-full w-full" role="img"
           aria-label={t(`Route from ${fromCity} to ${toCity}`, `المسار من ${fromCity} إلى ${toCity}`)}>
        <defs>
          <filter id={`route-glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={`marker-${uid}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={LOAD_BLUE.from} stopOpacity="0.55" />
            <stop offset="100%" stopColor={LOAD_BLUE.from} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Very dark charcoal base. */}
        <rect width={VIEW.w} height={VIEW.h} fill="#0b0f16" />

        {/* Zoom scales the map content about its centre; the HTML controls sit
            outside this group so they never move or resize. */}
        <g
          transform={`translate(${VIEW.w / 2} ${VIEW.h / 2}) scale(${zoom}) translate(${-VIEW.w / 2} ${-VIEW.h / 2})`}
          style={{ transition: "transform 180ms ease-out" }}
        >

        {/* Land mass, in the same rotated frame as the route. */}
        <path
          d={smoothPath(KSA_OUTLINE.map(([lng, lat]) => project_(lat, lng))) + " Z"}
          fill="#111722"
          stroke="#1d2634"
          strokeWidth={1.4}
        />

        {/* Road network — minor grid, then brighter major roads. */}
        <g stroke="#1a2130" strokeWidth={1.1} opacity={0.9}>
          {Array.from({ length: 11 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={(i * VIEW.h) / 10} x2={VIEW.w} y2={(i * VIEW.h) / 10} />
          ))}
          {Array.from({ length: 23 }, (_, i) => (
            <line key={`v${i}`} x1={(i * VIEW.w) / 22} y1={0} x2={(i * VIEW.w) / 22} y2={VIEW.h} />
          ))}
        </g>
        <g stroke="#26303f" strokeWidth={2} fill="none" opacity={0.85}>
          {MAP_LABELS.slice(0, 5).map(([, lat, lng], i, arr) => {
            if (i === arr.length - 1) return null;
            const [, nlat, nlng] = arr[i + 1];
            const [x1, y1] = project_(lat, lng);
            const [x2, y2] = project_(nlat, nlng);
            return <path key={`mj${i}`} d={`M${x1} ${y1} Q${(x1 + x2) / 2 + 40} ${(y1 + y2) / 2 - 30} ${x2} ${y2}`} />;
          })}
        </g>

        {/* Muted place labels. */}
        {MAP_LABELS.map(([name, lat, lng]) => {
          const [x, y] = project_(lat, lng);
          if (x < 8 || x > VIEW.w - 8 || y < 12 || y > VIEW.h - 8) return null;
          return (
            <text key={name} x={x + 7} y={y + 4} fill="#5a6478"
                  style={{ fontSize: 13, fontWeight: 500, letterSpacing: "0.02em" }}>
              {name}
            </text>
          );
        })}

        {/* GPS route — the strongest element on the map. */}
        <path d={d} fill="none" stroke={LOAD_BLUE.from} strokeWidth={5} strokeLinecap="round"
              strokeLinejoin="round" filter={`url(#route-glow-${uid})`} opacity={0.35} />
        <path d={d} fill="none" stroke={LOAD_BLUE.from} strokeWidth={5} strokeLinecap="round"
              strokeLinejoin="round" />

        {/* Waypoints — smaller than the truck marker. */}
        {waypoints.map((w, i) => (
          <g key={i}>
            <circle cx={w.x} cy={w.y} r={5.5} fill="#0b0f16" stroke="#9fb6ff" strokeWidth={2} />
          </g>
        ))}

        {/* Current position — the same vehicle shown above the map. */}
        <g transform={`translate(${truck.x} ${truck.y})`}>
          <circle r={26} fill={`url(#marker-${uid})`} />
          <circle r={13} fill={LOAD_BLUE.to} stroke="#ffffff" strokeWidth={2.5} />
          <g transform={`rotate(${truck.angle + 90})`}>
            <TruckGlyph size={16} />
          </g>
        </g>
        </g>
      </svg>

      {/* ── Controls: navigation / pin / layers on the right, zoom below ── */}
      <div className="pointer-events-auto absolute end-3 top-3 flex flex-col gap-1.5">
        <button className={controlBtn} aria-label={t("Recenter on truck", "توسيط على الشاحنة")}>
          <IconNavigate size={17} />
        </button>
        <button className={controlBtn} aria-label={t("Drop pin", "وضع علامة")}>
          <IconPin size={17} />
        </button>
        <button className={controlBtn} aria-label={t("Map layers", "طبقات الخريطة")}>
          <IconLayers size={17} />
        </button>
      </div>

      <div className="pointer-events-auto absolute bottom-3 end-3 flex flex-col gap-1.5">
        <button
          className={controlBtn}
          aria-label={t("Zoom in", "تكبير")}
          onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
        >
          <IconZoomIn size={17} />
        </button>
        <button
          className={controlBtn}
          aria-label={t("Zoom out", "تصغير")}
          onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
        >
          <IconZoomOut size={17} />
        </button>
      </div>
    </div>
  );
}
