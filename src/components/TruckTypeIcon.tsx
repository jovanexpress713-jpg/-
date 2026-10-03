import type { ComponentType } from "react";
import { cn } from "../utils/cn";
import {
  getVehicleTypeMeta,
  normalizeVehicleType,
  type CanonicalVehicleTypeId,
} from "../data/vehicleTypes";
import {
  IconTruck,
  IconTruckCurtain,
  IconTruckDry,
  IconTruckFlatbed,
  IconTruckReefer,
} from "./Icons";

/**
 * EJAZ Transport — Canonical truck category glyph resolver.
 *
 * One component, one source of truth. Any screen that knows a truck category
 * (a trip's `cargoType`, a vehicle's `body`, a raw legacy string, an Arabic
 * label) renders the exact same silhouette for that category. The value is
 * pushed through `normalizeVehicleType`, so legacy and Arabic inputs resolve
 * safely and no call site ever has to guess.
 *
 * Extending the fleet: add the new category to `data/vehicleTypes.ts` and drop
 * one entry into `TRUCK_TYPE_ICONS`. Nothing else has to change — every screen
 * that renders `TruckTypeIcon` picks it up automatically.
 */

export interface TruckTypeGlyphProps {
  size?: number;
  className?: string;
}

type TruckTypeGlyph = ComponentType<TruckTypeGlyphProps>;

/**
 * Category → glyph registry. Deliberately a `Record` over the canonical id so
 * the compiler fails the build the moment a fifth category is approved without
 * an assigned silhouette.
 */
export const TRUCK_TYPE_ICONS: Record<CanonicalVehicleTypeId, TruckTypeGlyph> = {
  flatbed: IconTruckFlatbed,
  reefer: IconTruckReefer,
  dry: IconTruckDry,
  curtain: IconTruckCurtain,
};

/** Resolves any truck-type input to its glyph component (never null). */
export function resolveTruckTypeGlyph(truckType?: string | null): TruckTypeGlyph {
  return TRUCK_TYPE_ICONS[normalizeVehicleType(truckType)];
}

export interface TruckTypeIconProps extends TruckTypeGlyphProps {
  /**
   * The raw category value as it exists in the data — `trip.cargoType`,
   * `vehicle.body`, or any legacy/Arabic variant. Normalized internally.
   */
  truckType?: string | null;
  /** Accessible name; defaults to the category's Arabic name. */
  title?: string;
}

/**
 * Renders the vector silhouette that matches `truckType`.
 * Never a generic truck icon — each of the four categories is distinct.
 */
export function TruckTypeIcon({ truckType, size = 16, className, title }: TruckTypeIconProps) {
  const Glyph = resolveTruckTypeGlyph(truckType);
  const meta = getVehicleTypeMeta(truckType);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      title={title ?? `${meta.arabicName} — ${meta.englishName}`}
      aria-label={title ?? `${meta.arabicName} — ${meta.englishName}`}
      role="img"
    >
      <Glyph size={size} />
    </span>
  );
}

export interface TruckTypeBadgeProps {
  truckType?: string | null;
  size?: number;
  className?: string;
  /** Renders the Arabic category name next to the glyph. */
  withLabel?: boolean;
  /** Tints the badge with the category's own accent colour. */
  accent?: boolean;
}

/**
 * Glyph + Arabic category name, tinted with that category's existing accent
 * colour from `data/vehicleTypes.ts`. No new colours, no new data.
 */
export function TruckTypeBadge({
  truckType,
  size = 15,
  className,
  withLabel = true,
  accent = true,
}: TruckTypeBadgeProps) {
  const meta = getVehicleTypeMeta(truckType);
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10.5px] font-bold",
        !accent && "border-border-subtle bg-surface-3 text-text-secondary",
        className,
      )}
      style={
        accent
          ? {
              backgroundColor: meta.badgeBg,
              color: meta.accentColor,
              borderColor: `${meta.accentColor}44`,
            }
          : undefined
      }
      title={`${meta.arabicName} — ${meta.englishName}`}
    >
      <TruckTypeIcon truckType={truckType} size={size} />
      {withLabel && <span className="truncate">{meta.arabicName}</span>}
    </span>
  );
}

/**
 * Compact inline pair — glyph + category name — for card headers where a full
 * badge would compete with the existing status chip.
 */
export function TruckTypeInline({
  truckType,
  size = 15,
  className,
}: {
  truckType?: string | null;
  size?: number;
  className?: string;
}) {
  const meta = getVehicleTypeMeta(truckType);
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
      style={{ color: meta.accentColor }}
      title={`${meta.arabicName} — ${meta.englishName}`}
    >
      <TruckTypeIcon truckType={truckType} size={size} />
      <span className="truncate text-[11.5px] font-bold">{meta.arabicName}</span>
    </span>
  );
}

/**
 * Generic truck glyph kept as the explicit fallback for screens that describe
 * the fleet as a whole rather than one category.
 */
export const FleetGlyph: TruckTypeGlyph = IconTruck;
