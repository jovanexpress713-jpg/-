import { useSettings } from "../../settings";
import type { Trip } from "../../state/fleetStore";
import type { Vehicle } from "../../data/types";
import { CARGO_LABEL, formatEta, loadPct, truckImage, useCountUp } from "./shared";

interface Props {
  trip: Trip;
  truck?: Vehicle;
  driverName?: string;
}

export function TruckCapacity({ trip, truck, driverName }: Props) {
  const { t } = useSettings();
  const pct = loadPct(trip);
  const shown = useCountUp(pct);
  const progress = useCountUp(trip.progressPct);
  const label = CARGO_LABEL[trip.cargoType] ?? CARGO_LABEL.dry;

  const stats: [string, string][] = [
    [t("Truck", "الشاحنة"), truck?.plate ?? "—"],
    [t("Weight", "الوزن"), `${trip.cargoWeightTons.toFixed(1)} / ${trip.maxCapacityTons} t`],
    [t("Speed", "السرعة"), `${Math.round(trip.speedKmH)} km/h`],
    [t("ETA", "الوصول"), formatEta(trip.etaMinutes, t)],
  ];

  return (
    <section className="card animate-fade-up flex flex-col overflow-hidden p-5" style={{ animationDelay: "240ms" }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold text-text-primary">{t("Current Truck Capacity", "سعة الشاحنة الحالية")}</h2>
          <p className="mt-0.5 text-[11.5px] text-text-muted">
            {t(label[0], label[1])} · {driverName ?? t("Unassigned", "غير معين")}
          </p>
        </div>
        <span className="rounded-full bg-surface-4 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-text-secondary">
          #{trip.tripNumber}
        </span>
      </div>

      <div className="relative mt-4 flex items-center justify-center" key={trip.id}>
        <div className="relative w-full max-w-[520px]">
          <img
            src={truckImage(trip.cargoType)}
            alt={t(`${label[0]} truck`, `شاحنة ${label[1]}`)}
            className="animate-truck-bob relative z-0 h-[150px] w-full object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,0.35)]"
          />
          <div className="absolute inset-x-[30%] top-[22%] bottom-[38%] z-10 overflow-hidden rounded-[6px] bg-surface-0/50 ring-1 ring-white/10 backdrop-blur-[1px]">
            <div
              className="h-full bg-[linear-gradient(110deg,var(--color-brand),var(--color-brand-soft))] transition-[width] duration-1000 ease-out"
              style={{ width: `${pct}%` }}
            >
              <div className="animate-stripes h-full w-full bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.12)_0_6px,transparent_6px_11px)] bg-[length:22px_100%]" />
            </div>
            <span className="absolute inset-0 grid place-items-center text-[30px] font-bold tabular-nums text-white drop-shadow">
              {Math.round(shown)}%
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-text-muted">
          <span>{trip.originCity}</span>
          <span className="font-semibold tabular-nums text-text-secondary">{Math.round(progress)}%</span>
          <span>{trip.destinationCity}</span>
        </div>
        <div className="relative h-2 rounded-full bg-surface-5">
          <div className="h-full rounded-full bg-brand transition-[width] duration-1000 ease-out" style={{ width: `${trip.progressPct}%` }} />
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-pulse-dot rounded-full border-2 border-surface-2 bg-brand text-brand transition-[left] duration-1000 ease-out rtl:translate-x-1/2"
            style={{ insetInlineStart: `${trip.progressPct}%` }}
          />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-[12px] bg-surface-4 px-3 py-2">
            <dt className="text-[10.5px] text-text-muted">{k}</dt>
            <dd className="truncate text-[12.5px] font-semibold tabular-nums text-text-primary">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
