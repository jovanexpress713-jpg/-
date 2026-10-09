import type { ReactNode } from "react";
import { cn } from "../utils/cn";
import { TruckTypeIcon } from "./TruckTypeIcon";

/**
 * EJAZ Transport — Vehicle specification presentation.
 *
 * One shared renderer for every "truck information" row and tile in the product
 * (details panel, fleet card, asset manager, 3D HUD, mobile modes). The values,
 * units and wording stay exactly as each screen already had them — this only
 * adds the matching vector glyph in front of the label and keeps the rhythm of
 * the existing rows, so no data is renamed, reordered or invented.
 */

export interface SpecRowProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  className?: string;
  valueClassName?: string;
}

/** Label/value line as used by the vehicle info sheet, now with its glyph. */
export function SpecRow({ icon, label, value, className, valueClassName }: SpecRowProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-2.5", className)}>
      <span className="flex min-w-0 items-center gap-2 text-label-lg text-text-muted">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-micro bg-surface-4 text-text-secondary">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span
        className={cn(
          "shrink-0 text-body tabular-nums text-text-primary",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}

export interface SpecTileProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
  valueClassName?: string;
}

/** Statistic card variant (fleet KPI / technical specification grids). */
export function SpecTile({
  icon,
  label,
  value,
  hint,
  className,
  valueClassName,
}: SpecTileProps) {
  return (
    <div className={cn("rounded-control border border-white/5 bg-surface-2 p-3", className)}>
      <div className="flex items-center gap-1.5 text-text-muted">
        <span className="shrink-0 text-brand">{icon}</span>
        <span className="truncate text-label">{label}</span>
      </div>
      <div className={cn("mt-0.5 truncate font-semibold text-text-primary", valueClassName)}>
        {value}
      </div>
      {hint && <div className="truncate text-micro text-text-muted">{hint}</div>}
    </div>
  );
}

/**
 * Inline label/value pair for tight surfaces (3D HUD, mobile headers) where a
 * boxed row would not fit.
 */
export function SpecInline({
  icon,
  label,
  value,
  className,
  valueClassName,
}: Omit<SpecTileProps, "hint">) {
  return (
    <div className={cn("flex items-center justify-between gap-2 text-label", className)}>
      <span className="flex min-w-0 items-center gap-1.5 text-text-muted">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <span className={cn("shrink-0 tabular-nums text-text-primary", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

/** Category line: the canonical glyph plus the type name, used as a spec row. */
export function TruckTypeSpecRow({
  truckType,
  label,
  value,
  className,
  valueClassName,
}: {
  truckType?: string | null;
  label: string;
  value: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <SpecRow
      className={className}
      valueClassName={valueClassName}
      icon={<TruckTypeIcon truckType={truckType} size={14} />}
      label={label}
      value={value}
    />
  );
}
