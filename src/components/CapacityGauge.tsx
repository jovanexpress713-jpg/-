import { useId } from "react";
import { useCountUp } from "../hooks";
import { useSettings } from "../settings";

export function CapacityGauge({ load, maxLoad }: { load: number; maxLoad: number }) {
  const { t } = useSettings();
  const uid = useId().replace(/:/g, "");
  const pct = useCountUp((load / maxLoad) * 100, 1300);
  const free = Math.max(0, maxLoad - load);

  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] tracking-wide text-text-muted uppercase">
          {t("Current Truck Capacity", "سعة الشاحنة الحالية")}
        </span>
        <span className="badge bg-brand/15 text-brand">
          {load.toFixed(1)} / {maxLoad.toFixed(0)} {t("t", "طن")}
        </span>
      </div>

      <svg viewBox="0 0 340 128" className="w-full">
        <defs>
          <clipPath id={`box-${uid}`}>
            <rect x="70" y="20" width="232" height="76" rx="5" />
          </clipPath>
        </defs>

        <g clipPath={`url(#box-${uid})`}>
          <rect
            x="70"
            y={20 + 76 * (1 - pct / 100)}
            width="232"
            height={76 * (pct / 100)}
            fill="none"
            className="stripes animate-stripes"
          />
        </g>

        <rect x="140" y="36" width="92" height="44" rx="10" className="fill-navy" opacity="0.82" />
        <text
          x="186"
          y="66"
          textAnchor="middle"
          className="fill-white font-semibold tabular-nums"
          style={{ fontSize: 26, letterSpacing: "-0.02em" }}
        >
          {pct.toFixed(0)}%
        </text>

        <g
          fill="none"
          className="stroke-surface-6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="70" y="20" width="232" height="76" rx="5" />
          <path d="M8 96V58C8 48 14 44 24 44l18 1 14 15v36" />
          <path d="M24 44v-6h16" />
          <path d="M64 96v-9h6" />
        </g>
        <g className="fill-surface-4 stroke-surface-6" strokeWidth="2">
          <circle cx="26" cy="103" r="10" />
          <circle cx="56" cy="103" r="10" />
          <circle cx="182" cy="103" r="10" />
          <circle cx="268" cy="103" r="10" />
        </g>
        <g className="fill-surface-6">
          <circle cx="26" cy="103" r="3.4" />
          <circle cx="56" cy="103" r="3.4" />
          <circle cx="182" cy="103" r="3.4" />
          <circle cx="268" cy="103" r="3.4" />
        </g>
        <line x1="0" y1="116" x2="340" y2="116" className="stroke-border-subtle" strokeWidth="1.4" />
      </svg>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          {
            k: t("Payload", "الحمولة"),
            v: `${load.toFixed(1)} ${t("t", "طن")}`,
            icon: <IconWeight key="w" />,
          },
          {
            k: t("Free space", "المساحة الحرة"),
            v: `${free.toFixed(1)} ${t("t", "طن")}`,
            icon: <IconCargo key="c" />,
          },
          {
            k: t("Max load", "أقصى حمولة"),
            v: `${maxLoad.toFixed(1)} ${t("t", "طن")}`,
            icon: <IconLayers key="l" />,
          },
        ].map((s) => (
          <div key={s.k} className="rounded-[8px] bg-surface-2 p-2.5">
            <div className="flex items-center gap-1.5 text-text-muted">
              {s.icon}
              <span className="text-[10.5px]">{s.k}</span>
            </div>
            <div className="mt-1.5 text-[15px] font-medium tabular-nums text-text-primary">
              {s.v}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const base: React.SVGProps<SVGSVGElement> = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function IconWeight() {
  return (
    <svg {...base}>
      <path d="M4 8.5h16L21.5 20h-19z" />
      <path d="M9 8.5a3 3 0 0 1 6 0" />
    </svg>
  );
}

function IconCargo() {
  return (
    <svg {...base}>
      <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
      <path d="M3 7l9 4 9-4" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg {...base}>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m4.5 12.5 7.5 4.2 7.5-4.2" />
    </svg>
  );
}
