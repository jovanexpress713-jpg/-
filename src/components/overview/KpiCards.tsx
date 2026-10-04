import type { ComponentType } from "react";
import { cn } from "../../utils/cn";
import { useSettings } from "../../settings";
import type { Trip } from "../../state/fleetStore";
import { IconCargo, IconCheck, IconTracking, IconTruck } from "../Icons";
import { statusGroup, useCountUp, type StatusGroup } from "./shared";

interface Props {
  trips: Trip[];
  activeGroup: StatusGroup | "all";
  onGroup: (g: StatusGroup | "all") => void;
}

/**
 * Spec §4.1 — KPI card.
 *
 * Label small and muted on top, a mono figure at 32px, a delta line, and a
 * 2px orange rule across 40% of the card's width along the bottom. Entrance is
 * staggered by --ds-stagger (40ms) per spec §6.
 */
function Kpi({
  label,
  value,
  share,
  delta,
  Icon,
  tone,
  active,
  delay,
  onClick,
}: {
  label: string;
  value: number;
  share: number;
  delta: number;
  Icon: ComponentType<{ size?: number }>;
  tone: string;
  active: boolean;
  delay: number;
  onClick: () => void;
}) {
  const shown = useCountUp(value, 400);
  const pct = useCountUp(share, 400);
  const up = delta >= 0;

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "card card-in card-hover group relative overflow-hidden text-start",
        active && "card-selected",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="label-sm">{label}</span>
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", tone)}>
          <Icon size={15} />
        </span>
      </div>

      <div className="num num-lg mt-3">{Math.round(shown)}</div>

      <div className="mt-1.5 flex items-center gap-1.5 text-[12px]">
        <span
          aria-hidden="true"
          className={up ? "text-status-active" : "text-status-danger"}
        >
          {up ? "▲" : "▼"}
        </span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            up ? "text-status-active" : "text-status-danger",
          )}
        >
          {Math.abs(Math.round(delta))}%
        </span>
        <span className="text-text-muted">{Math.round(pct)}%</span>
      </div>

      {/* Spec §4.1 — the 2px rule, 40% of the card width. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute bottom-0 start-0 h-[2px] rounded-full transition-[width] duration-700 ease-out",
          active ? "w-[40%] bg-brand" : "w-[40%] bg-brand/45",
        )}
      />
    </button>
  );
}

export function KpiCards({ trips, activeGroup, onGroup }: Props) {
  const { t } = useSettings();
  const total = trips.length || 1;
  const count = (g: StatusGroup) => trips.filter((tr) => statusGroup(tr.status) === g).length;
  const pending = count("pending");
  const transit = count("transit");
  const delivered = count("delivered");

  const items = [
    {
      key: "all" as const,
      label: t("Total Shipments", "إجمالي الشحنات"),
      value: trips.length,
      share: 100,
      delta: 12,
      Icon: IconCargo,
      tone: "bg-text-primary/10 text-text-primary",
    },
    {
      key: "pending" as const,
      label: t("Pending", "قيد التجهيز"),
      value: pending,
      share: (pending / total) * 100,
      delta: -4,
      Icon: IconTruck,
      tone: "bg-status-waiting/15 text-status-waiting",
    },
    {
      key: "transit" as const,
      label: t("In Transit", "على الطريق"),
      value: transit,
      share: (transit / total) * 100,
      delta: 8,
      Icon: IconTracking,
      tone: "bg-brand/15 text-brand",
    },
    {
      key: "delivered" as const,
      label: t("Delivered", "تم التسليم"),
      value: delivered,
      share: (delivered / total) * 100,
      delta: 17,
      Icon: IconCheck,
      tone: "bg-status-active/15 text-status-active",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map(({ key, ...it }, i) => (
        <Kpi
          key={key}
          {...it}
          /* Spec §6 — 40ms cascade. */
          delay={i * 40}
          active={activeGroup === key}
          onClick={() => onGroup(activeGroup === key ? "all" : key)}
        />
      ))}
    </div>
  );
}
