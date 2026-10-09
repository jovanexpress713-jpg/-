import { useSettings } from "../settings";
import { CapacityTruck } from "./CapacityTruck";
import { useCountUp } from "./overview/shared";

/**
 * Spec §3 — the details-panel capacity readout.
 *
 * Deliberately thin: the truck geometry, the fill thresholds and the 90%+
 * alarm all live in `<CapacityTruck>`, which this and the overview card share.
 * Duplicating the SVG here is how the two screens used to drift apart.
 */
export function CapacityGauge({ load, maxLoad }: { load: number; maxLoad: number }) {
  const { t } = useSettings();
  const pct = maxLoad > 0 ? (load / maxLoad) * 100 : 0;
  /* Spec §6 — 400ms count-up. */
  const shown = useCountUp(pct, 400);
  const free = Math.max(0, maxLoad - load);

  const stats: [string, string][] = [
    [t("Payload", "الحمولة"), `${load.toFixed(1)} ${t("t", "طن")}`],
    [t("Free space", "المساحة الحرة"), `${free.toFixed(1)} ${t("t", "طن")}`],
    [t("Max load", "أقصى حمولة"), `${maxLoad.toFixed(1)} ${t("t", "طن")}`],
  ];

  return (
    <div className="card">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="label-sm">{t("Current Truck Capacity", "سعة الشاحنة الحالية")}</span>
        <span className="badge badge-brand">
          {load.toFixed(1)} / {maxLoad.toFixed(0)} {t("t", "طن")}
        </span>
      </div>

      <CapacityTruck pct={shown} />

      <dl className="mt-3 grid grid-cols-3 gap-2">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-inner bg-surface-2 p-2.5">
            <dt className="label-sm">{k}</dt>
            <dd className="num mt-1.5 text-page-title">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
