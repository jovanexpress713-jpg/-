import { useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import {
  CITIES,
  KSA_OUTLINE,
  haversineKm,
  pathFrom,
  pointAt,
  project,
} from "../data/routes";
import { IconLayers, IconZoomIn, IconZoomOut } from "./Icons";
import { normalizeVehicleType, getVehicleTypeMeta } from "../data/vehicleTypes";
import { TruckTypeIcon } from "./TruckTypeIcon";

interface Props {
  from: string;
  to: string;
  progress: number;
  truckType?: string | null;
  accent?: boolean;
  className?: string;
  compact?: boolean;
}

const LABELLED: [string, number, number][] = [
  ["Riyadh", 24.7136, 46.6753],
  ["Jeddah", 21.4858, 39.1925],
  ["Dammam", 26.4207, 50.0888],
  ["Makkah", 21.3891, 39.8579],
  ["Madinah", 24.5247, 39.6125],
  ["Tabuk", 28.3835, 36.5667],
  ["Abha", 18.2167, 42.5],
  ["Hail", 27.5167, 41.7],
  ["Jubail", 27.0046, 50.1029],
  ["NEOM", 28.0, 35.4],
];

export function MapPanel({
  from,
  to,
  progress,
  truckType,
  accent = false,
  className,
  compact = false,
}: Props) {
  const { t, dir } = useSettings();
  const [zoom, setZoom] = useState(1);
  const [layer, setLayer] = useState<"vector" | "google">("vector");
  const [googleReady, setGoogleReady] = useState(false);

  const canonicalType = truckType ? normalizeVehicleType(truckType) : "curtain";
  const typeMeta = getVehicleTypeMeta(canonicalType);

  const a = CITIES[from] ?? CITIES.Riyadh;
  const b = CITIES[to] ?? CITIES.Jeddah;
  const [x1, y1] = project(a[0], a[1]);
  const [x2, y2] = project(b[0], b[1]);

  // gentle arc between the two real terminals
  const mid: [number, number] = [(x1 + x2) / 2 + (y2 - y1) * 0.14, (y1 + y2) / 2 - (x2 - x1) * 0.14];
  const points: [number, number][] = [
    [x1, y1],
    mid,
    [x2, y2],
  ];
  const routePath = `M${x1} ${y1} Q${mid[0]} ${mid[1]} ${x2} ${y2}`;
  const sample = (u: number) => {
    const p = pointAt(points, u);
    return p;
  };
  const marker = sample(Math.max(0.01, Math.min(0.99, progress / 100)));

  const km = haversineKm(a, b);
  const mi = km * 0.621371;
  const stroke = accent ? "var(--color-accent-2)" : "var(--color-brand)";

  return (
    <div className={cn("relative overflow-hidden rounded-[8px] bg-surface-1", className)}>
      {layer === "google" ? (
        <div className="relative h-full w-full">
          {!googleReady && (
            <div className="absolute inset-0 grid place-items-center text-[11px] text-text-muted">
              {t("Loading Google Maps…", "جارٍ تحميل خرائط جوجل…")}
            </div>
          )}
          <iframe
            title="Google Maps"
            src={`https://maps.google.com/maps?q=${a[0]},${a[1]}&z=6&output=embed`}
            onLoad={() => setGoogleReady(true)}
            className="h-full w-full border-0"
            style={{ filter: "saturate(0.85) contrast(1.05)" }}
            referrerPolicy="no-referrer-when-downgrade"
            loading="lazy"
          />
        </div>
      ) : (
        <svg
          viewBox="0 0 400 260"
          className="h-full w-full transition-transform duration-500 ease-out"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
          preserveAspectRatio="xMidYMid slice"
        >
          {/* sea */}
          <rect x="0" y="0" width="400" height="260" className="fill-surface-1" />

          {/* land */}
          <path
            d={`${pathFrom(KSA_OUTLINE.map(([lng, lat]) => project(lat, lng)))} Z`}
            className="fill-surface-3 stroke-surface-5"
            strokeWidth="1.4"
          />

          {/* graticule */}
          <g className="stroke-border-subtle" strokeWidth="0.5" opacity="0.7">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <line key={`v${i}`} x1={i * 57} y1="0" x2={i * 57} y2="260" />
            ))}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <line key={`h${i}`} x1="0" y1={i * 52} x2="400" y2={i * 52} />
            ))}
          </g>

          {/* cities */}
          {LABELLED.map(([name, lat, lng]) => {
            const [cx, cy] = project(lat, lng);
            const isEnd = name === from || name === to;
            return (
              <g key={name}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isEnd ? 4 : 2.4}
                  fill={isEnd ? stroke : "var(--color-surface-6)"}
                />
                <text
                  x={cx + 6}
                  y={cy + 3.2}
                  fontSize="7"
                  letterSpacing="0.6"
                  className="fill-text-secondary"
                  style={{ fontWeight: isEnd ? 700 : 500 }}
                >
                  {name}
                </text>
              </g>
            );
          })}

          {/* corridor */}
          <path
            d={routePath}
            fill="none"
            stroke="var(--color-surface-6)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeDasharray="5 7"
          />
          <path
            d={routePath}
            fill="none"
            stroke={stroke}
            strokeWidth="3.4"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`${Math.max(0.001, progress / 100)} 1`}
            style={{ filter: `drop-shadow(0 0 6px ${stroke})` }}
          />

          {/* live unit with category silhouette */}
          <g transform={`translate(${marker.x} ${marker.y})`}>
            <circle r="14" fill={stroke} opacity="0.22" />
            <circle r="9.5" fill={stroke} />
            <g transform="translate(-5.5 -3.8) scale(0.46)">
              {canonicalType === "flatbed" ? (
                <>
                  <path
                    d="M14 9h3.2l2.8 3v3h-6z M14 7.5v7.5 M1.5 13.5h12.5v1.5H1.5z M3.5 13.5v-3.5 M7 13.5v-3.5 M10.5 13.5v-3.5 M3.5 10h7"
                    stroke="var(--color-on-brand)"
                    strokeWidth="3.2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="6" cy="17.5" r="1.9" fill="var(--color-on-brand)" />
                  <circle cx="17.5" cy="17.5" r="1.9" fill="var(--color-on-brand)" />
                </>
              ) : canonicalType === "reefer" ? (
                <>
                  <rect x="2" y="6" width="12" height="9" rx="1.2" stroke="var(--color-on-brand)" strokeWidth="3.2" fill="none" />
                  <path
                    d="M14 9h3.2l2.8 3v3h-6z M11 6V3.8h3V6 M6.5 8v5 M4 10.5h5"
                    stroke="var(--color-on-brand)"
                    strokeWidth="3.2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="6" cy="17.5" r="1.9" fill="var(--color-on-brand)" />
                  <circle cx="17.5" cy="17.5" r="1.9" fill="var(--color-on-brand)" />
                </>
              ) : canonicalType === "dry" ? (
                <>
                  <rect x="2" y="6" width="12" height="9" rx="1.2" stroke="var(--color-on-brand)" strokeWidth="3.2" fill="none" />
                  <path
                    d="M14 9h3.2l2.8 3v3h-6z M4.5 6v9 M6.5 9h5.5 M6.5 12h5.5"
                    stroke="var(--color-on-brand)"
                    strokeWidth="3.2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="6" cy="17.5" r="1.9" fill="var(--color-on-brand)" />
                  <circle cx="17.5" cy="17.5" r="1.9" fill="var(--color-on-brand)" />
                </>
              ) : (
                <>
                  <rect x="2" y="6" width="12" height="9" rx="1.2" stroke="var(--color-on-brand)" strokeWidth="3.2" fill="none" />
                  <path
                    d="M14 9h3.2l2.8 3v3h-6z M2 7.8h12 M2 13.5h12 M5 7.8v5.7 M8 7.8v5.7 M11 7.8v5.7"
                    stroke="var(--color-on-brand)"
                    strokeWidth="3.2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="6" cy="17.5" r="1.9" fill="var(--color-on-brand)" />
                  <circle cx="17.5" cy="17.5" r="1.9" fill="var(--color-on-brand)" />
                </>
              )}
            </g>
          </g>
        </svg>
      )}

      {/* route chip with canonical vehicle type */}
      <div
        className={cn(
          "pointer-events-none absolute top-3 flex items-center gap-2 rounded-full bg-navy/85 px-3 py-1.5 text-[10.5px] text-white backdrop-blur-md border border-white/10 shadow-sm",
          dir === "rtl" ? "right-3" : "left-3",
        )}
      >
        <TruckTypeIcon truckType={canonicalType} size={14} className="text-brand shrink-0" />
        <span className="font-semibold text-brand">{typeMeta.arabicName}</span>
        <span className="text-white/40">·</span>
        <span className="text-white/90">{from}</span>
        <span style={{ color: stroke }}>→</span>
        <span className="font-medium">{to}</span>
        <span className="text-white/50 tabular-nums">
          · {Math.round(km).toLocaleString()} km
        </span>
      </div>

      <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
        {!compact && (
          <>
            <button
              onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.2).toFixed(2)))}
              className="btn-icon-sm bg-navy/70 text-white backdrop-blur-md"
              aria-label="Zoom in"
            >
              <IconZoomIn size={14} />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(1, +(z - 0.2).toFixed(2)))}
              className="btn-icon-sm bg-navy/70 text-white backdrop-blur-md"
              aria-label="Zoom out"
            >
              <IconZoomOut size={14} />
            </button>
          </>
        )}
        <button
          onClick={() => setLayer((l) => (l === "vector" ? "google" : "vector"))}
          className="btn-icon-sm bg-navy/70 text-white backdrop-blur-md"
          aria-label="Map layer"
          title={t("Switch to Google Maps", "التبديل إلى خرائط جوجل")}
        >
          <IconLayers size={14} />
        </button>
      </div>

      <a
        href={`https://www.google.com/maps?q=${marker.x === 0 ? a[0] : a[0]},${a[1]}`}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "absolute bottom-3 rounded-full bg-navy/70 px-3 py-1.5 text-[10px] text-white backdrop-blur-md transition-opacity duration-200 hover:opacity-85",
          dir === "rtl" ? "left-3" : "right-3",
        )}
      >
        {t("Open in Google Maps", "فتح في خرائط جوجل")}
      </a>
    </div>
  );
}
