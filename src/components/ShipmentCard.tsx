import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { imageFor } from "../data/catalog";
import type { Vehicle } from "../data/types";
import type { Live } from "../hooks";
import { formatCountdown } from "../hooks";
import { StatusChip } from "./StatusChip";
import { TruckImage } from "./TruckImage";
import { IconPin } from "./Icons";

interface Props {
  v: Vehicle;
  live: Live;
  selected: boolean;
  index: number;
  onSelect: () => void;
}

export function ShipmentCard({ v, live, selected, index, onSelect }: Props) {
  const { t } = useSettings();
  const done = v.stops.filter((s) => s.done).length;

  return (
    <button
      onClick={onSelect}
      style={{ animationDelay: `${index * 45}ms` }}
      className={cn(
        "animate-fade-up group relative h-[252px] overflow-hidden rounded-[8px] bg-surface-3 p-4 text-start transition-all duration-300 hover:bg-surface-4",
        selected && "selected-ring bg-surface-4",
      )}
    >
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div>
          <div className="text-[15px] font-medium tabular-nums text-text-primary">{v.shipment}</div>
          <div className="mt-1 text-[11px] text-text-muted">
            {v.model} · {v.cab}
          </div>
        </div>
        <StatusChip status={v.status} />
      </div>

      <div className="relative z-10 mt-3 flex gap-3">
        <div className="w-[168px] shrink-0 rounded-[8px] bg-surface-2/70 p-3 backdrop-blur-sm">
          <div className="text-[10.5px] tracking-wide text-text-muted uppercase">
            {v.status === "inactive"
              ? t("Standing", "متوقفة")
              : t("Arriving in", "الوصول خلال")}
          </div>
          <div
            className={cn(
              "mt-0.5 text-[17px] font-medium tabular-nums",
              v.status === "inactive" ? "text-text-muted" : "text-text-primary",
            )}
          >
            {v.status === "inactive" ? "—:—:—" : formatCountdown(live.etaSeconds)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] tabular-nums text-text-secondary">
            <span>
              {Math.round(live.miles).toLocaleString()} {t("mi left", "ميل متبقي")}
            </span>
            <span className="text-text-muted">·</span>
            <span>{Math.round(live.speed)} {t("km/h", "كم/س")}</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] tracking-wide text-text-muted uppercase">
            {t("Stops", "المحطات")} {done}/{v.stops.length}
          </div>
          <div className="mt-2 space-y-1.5">
            {v.stops.slice(0, 3).map((s, i) => (
              <div key={s.name} className="relative flex items-center gap-2 ps-3">
                {i < Math.min(3, v.stops.length) - 1 && (
                  <span
                    className={cn(
                      "absolute top-3 start-0 h-3 w-[2px] -translate-x-1/2 rounded-full rtl:translate-x-1/2",
                      s.done ? "bg-brand" : "bg-surface-6",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "absolute top-1.5 start-0 h-[6px] w-[6px] -translate-x-1/2 rounded-full rtl:translate-x-1/2",
                    s.done ? "bg-brand" : "bg-surface-6",
                  )}
                />
                <span
                  className={cn(
                    "truncate text-[11px]",
                    s.done ? "text-text-secondary" : "text-text-muted",
                  )}
                >
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-3 inline-flex max-w-full items-center gap-1.5 rounded-[6px] bg-surface-0/55 px-2 py-1 text-[10.5px] text-text-secondary backdrop-blur-sm">
        <IconPin size={13} className="shrink-0 text-brand" />
        <span className="truncate">
          {v.from} → {v.to}
        </span>
        <span className="text-text-muted">·</span>
        <span className="truncate">{v.partner}</span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[128px] overflow-hidden bg-black">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-transparent" />
        <TruckImage
          src={imageFor(v.brand, v.body)}
          alt={`${v.brand} ${v.model}`}
          className="absolute bottom-[-12px] left-1/2 w-[86%] -translate-x-1/2 opacity-95 transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </div>
    </button>
  );
}
