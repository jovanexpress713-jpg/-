import { cn } from "../../utils/cn";
import { useSettings } from "../../settings";
import type { Trip } from "../../state/fleetStore";
import { TruckTypeAvatar, TruckTypeBadge } from "../TruckTypeIcon";
import { formatEta, GROUP_TONE, STATUS_LABEL, statusGroup } from "./shared";

interface Props {
  trip: Trip;
  trips: Trip[];
  onSelect: (id: string) => void;
  onOpenDetails?: (id: string) => void;
}

export function TrackingPanel({ trip, trips, onSelect, onOpenDetails }: Props) {
  const { t, lang } = useSettings();
  const ar = lang === "ar";
  const group = statusGroup(trip.status);
  const inTransit = group === "transit";
  const delivered = group === "delivered";

  const steps = [
    { label: ar ? trip.originCity : trip.originCity, sub: trip.originTerminal, state: "done" as const, tag: t("Checked", "تم الفحص") },
    {
      label: ar ? trip.nextWaypointAr : trip.nextWaypointEn,
      sub: t(`${Math.round(trip.distanceCoveredKm)} km covered`, `${Math.round(trip.distanceCoveredKm)} كم مقطوعة`),
      state: delivered ? ("done" as const) : inTransit ? ("current" as const) : ("todo" as const),
      tag: delivered ? t("Passed", "تم العبور") : inTransit ? t("In Transit", "على الطريق") : t("Waiting", "بالانتظار"),
    },
    {
      label: trip.destinationCity,
      sub: trip.destinationTerminal,
      state: delivered ? ("done" as const) : ("todo" as const),
      tag: delivered ? t("Delivered", "تم التسليم") : formatEta(trip.etaMinutes, t),
    },
  ];

  return (
    <section className="card animate-fade-up flex flex-col p-5" style={{ animationDelay: "60ms" }}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-page-title font-semibold text-text-primary">{t("Tracking Delivery", "تتبع التوصيل")}</h2>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label font-semibold", GROUP_TONE[group])}>
          {inTransit && <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-current" />}
          {t(STATUS_LABEL[trip.status][0], STATUS_LABEL[trip.status][1])}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-inner bg-surface-4 px-3 py-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <TruckTypeAvatar truckType={trip.cargoType} size={34} iconSize={18} showBadge />
          <div className="min-w-0">
            <div className="text-label text-text-muted flex items-center gap-1.5">
              <span>{t("Tracking ID", "رقم التتبع")}</span>
              <TruckTypeBadge truckType={trip.cargoType} size={11} withLabel={false} />
            </div>
            <div className="truncate text-body font-semibold tabular-nums text-text-primary">#{trip.tripNumber}</div>
          </div>
        </div>
        <label className="sr-only" htmlFor="tracking-change">{t("Change shipment", "تغيير الشحنة")}</label>
        <select
          id="tracking-change"
          value={trip.id}
          onChange={(e) => onSelect(e.target.value)}
          className="max-w-[120px] cursor-pointer rounded-full border border-border-subtle bg-surface-2 px-2.5 py-1 text-label text-text-secondary outline-none hover:text-text-primary"
        >
          {trips.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.tripNumber}
            </option>
          ))}
        </select>
      </div>

      <ol className="mt-4 flex-1" key={trip.id}>
        {steps.map((s, i) => (
          <li key={i} className="animate-fade-up relative flex gap-3 pb-4 last:pb-0" style={{ animationDelay: `${i * 90}ms` }}>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "absolute start-[5px] top-4 bottom-0 w-px",
                  s.state === "done" ? "bg-brand" : "border-s border-dashed border-surface-7",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2",
                s.state === "done" && "border-brand bg-brand",
                s.state === "current" && "animate-pulse-dot border-brand bg-surface-2 text-brand",
                s.state === "todo" && "border-surface-7 bg-surface-2",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-body font-semibold text-text-primary">{s.label}</span>
              </div>
              <div className="truncate text-label text-text-muted">{s.sub}</div>
              <span
                className={cn(
                  "mt-1 inline-block rounded-full px-2 py-0.5 text-micro font-semibold",
                  s.state === "done" ? "bg-status-active/15 text-status-active" : s.state === "current" ? "bg-brand/15 text-brand" : "bg-surface-5 text-text-muted",
                )}
              >
                {s.tag}
              </span>
            </div>
          </li>
        ))}
      </ol>

      {onOpenDetails && (
        <button onClick={() => onOpenDetails(trip.id)} className="btn-ghost mt-4 w-full justify-center text-label-lg">
          {t("Open trip details", "فتح تفاصيل الرحلة")}
        </button>
      )}
    </section>
  );
}
