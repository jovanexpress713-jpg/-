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

function Kpi({
  label,
  value,
  share,
  Icon,
  tone,
  active,
  delay,
  onClick,
}: {
  label: string;
  value: number;
  share: number;
  Icon: ComponentType<{ size?: number }>;
  tone: string;
  active: boolean;
  delay: number;
  onClick: () => void;
}) {
  const shown = useCountUp(value);
  const pct = useCountUp(share);
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "group animate-fade-up relative overflow-hidden rounded-[18px] border bg-surface-2 p-4 text-start transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface-3",
        active ? "border-brand/60 shadow-[0_0_0_1px_var(--color-brand)]" : "border-border-subtle",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("grid h-8 w-8 place-items-center rounded-full", tone)}>
          <Icon size={15} />
        </span>
        <span className="text-[12.5px] font-semibold text-text-secondary">{label}</span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-[32px] leading-none font-semibold tabular-nums text-text-primary">
          {Math.round(shown)}
        </span>
        <span className="pb-1 text-[11.5px] font-semibold tabular-nums text-text-muted">
          {Math.round(pct)}%
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-5">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tone.split(" ")[0].replace("/15", ""))}
          style={{ width: `${Math.max(4, share)}%` }}
        />
      </div>
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
    { key: "all" as const, label: t("Total Shipments", "إجمالي الشحنات"), value: trips.length, share: 100, Icon: IconCargo, tone: "bg-text-primary/10 text-text-primary" },
    { key: "pending" as const, label: t("Pending", "قيد التجهيز"), value: pending, share: (pending / total) * 100, Icon: IconTruck, tone: "bg-status-waiting/15 text-status-waiting" },
    { key: "transit" as const, label: t("In Transit", "على الطريق"), value: transit, share: (transit / total) * 100, Icon: IconTracking, tone: "bg-brand/15 text-brand" },
    { key: "delivered" as const, label: t("Delivered", "تم التسليم"), value: delivered, share: (delivered / total) * 100, Icon: IconCheck, tone: "bg-status-active/15 text-status-active" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map(({ key, ...it }, i) => (
        <Kpi
          key={key}
          {...it}
          delay={i * 70}
          active={activeGroup === key}
          onClick={() => onGroup(activeGroup === key ? "all" : key)}
        />
      ))}
    </div>
  );
}
