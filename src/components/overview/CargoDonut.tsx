import { useState } from "react";
import { cn } from "../../utils/cn";
import { useSettings } from "../../settings";
import type { Trip } from "../../state/fleetStore";
import { CARGO_LABEL, useCountUp } from "./shared";

const COLORS = ["var(--color-brand)", "var(--color-status-active)", "var(--color-status-waiting)", "var(--color-text-secondary)"];
const TYPES = ["flatbed", "reefer", "dry", "curtain"];

export function CargoDonut({ trips }: { trips: Trip[] }) {
  const { t } = useSettings();
  const [hover, setHover] = useState<number | null>(null);

  const segments = TYPES.map((type, i) => ({
    type,
    color: COLORS[i],
    tons: trips.filter((tr) => tr.cargoType === type).reduce((s, tr) => s + tr.cargoWeightTons, 0),
  }));
  const total = segments.reduce((s, x) => s + x.tons, 0);
  const shownTotal = useCountUp(hover === null ? total : segments[hover].tons);

  const r = 62;
  const c = 2 * Math.PI * r;
  const gap = total > 0 ? 6 : 0;
  let offset = 0;

  return (
    <section className="card animate-fade-up flex flex-col p-5" style={{ animationDelay: "120ms" }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-page-title font-semibold text-text-primary">{t("Cargo Mix", "توزيع الحمولات")}</h2>
          <p className="mt-0.5 text-label-lg text-text-muted">{t("Tonnage by trailer type", "الأطنان حسب نوع المقطورة")}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col items-center gap-5 sm:flex-row">
        <ul className="w-full flex-1 space-y-2">
          {segments.map((s, i) => (
            <li key={s.type}>
              <button
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-start text-label-lg transition-colors",
                  hover === i ? "bg-surface-4 text-text-primary" : "text-text-secondary",
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                <span className="flex-1">{t(CARGO_LABEL[s.type][0], CARGO_LABEL[s.type][1])}</span>
                <span className="tabular-nums font-semibold">{s.tons.toFixed(1)} t</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="relative h-[160px] w-[160px] shrink-0">
          <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img" aria-label={t("Cargo tonnage donut chart", "مخطط دائري للأطنان")}>
            <circle cx="80" cy="80" r={r} fill="none" stroke="var(--color-surface-5)" strokeWidth="14" />
            {segments.map((s, i) => {
              const len = total > 0 ? (s.tons / total) * c : 0;
              const dash = Math.max(0, len - gap);
              const el = (
                <circle
                  key={s.type}
                  cx="80"
                  cy="80"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hover === i ? 18 : 14}
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${c}`}
                  strokeDashoffset={-offset}
                  className="transition-all duration-500 ease-out"
                  style={{ opacity: hover === null || hover === i ? 1 : 0.35 }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              );
              offset += len;
              return el;
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-label text-text-muted">
                {hover === null ? t("Total load", "إجمالي الحمولة") : t(CARGO_LABEL[segments[hover].type][0], CARGO_LABEL[segments[hover].type][1])}
              </div>
              <div className="text-hero-sm font-semibold tabular-nums text-text-primary">{shownTotal.toFixed(1)}</div>
              <div className="text-label text-text-muted">{t("tons", "طن")}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
