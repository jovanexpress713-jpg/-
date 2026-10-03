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

export interface TruckTypeAvatarProps {
  /** Raw category string or canonical id (flatbed, reefer, dry, curtain, or Arabic equivalents) */
  truckType?: string | null;
  /** Outer circle diameter in pixels, defaults to 40 */
  size?: number;
  /** Inner vector icon size in pixels, defaults to 20 */
  iconSize?: number;
  /** Optional class overrides */
  className?: string;
  /** Shows the category initial badge on the corner (س for سطحة, ب for براد, ج for جاف, ت for ستارة) */
  showBadge?: boolean;
}

/**
 * Circular avatar icon representing the 4 heavy truck categories:
 * - سطحة (Flatbed): Amber badge with flatbed trailer icon
 * - براد (Reefer): Ice Blue badge with insulated refrigerated box & snowflake icon
 * - جاف (Dry Van): Emerald Green badge with enclosed dry cargo box icon
 * - ستارة (Curtainsider): Deep Orange badge with side curtain rail icon
 *
 * Modeled directly on the user-requested circular avatar badge pattern.
 */
export function TruckTypeAvatar({
  truckType,
  size = 40,
  iconSize = 20,
  className,
  showBadge = false,
}: TruckTypeAvatarProps) {
  const normType = normalizeVehicleType(truckType);
  const meta = getVehicleTypeMeta(normType);

  // Dedicated solid vibrant backgrounds matching user's reference avatars
  const BG_COLORS: Record<CanonicalVehicleTypeId, string> = {
    flatbed: "#D97706", // Amber / سطحة
    reefer: "#0284C7",  // Ice Blue / براد
    dry: "#059669",     // Emerald Teal / جاف
    curtain: "#EA580C", // Deep Orange / ستارة
  };

  const INITIALS: Record<CanonicalVehicleTypeId, string> = {
    flatbed: "س", // سطحة
    reefer: "ب",  // براد
    dry: "ج",     // جاف
    curtain: "ت", // ستارة
  };

  const bg = BG_COLORS[normType] || BG_COLORS.curtain;
  const initial = INITIALS[normType] || "ش";

  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full flex items-center justify-center text-white shadow-sm transition-transform duration-200 select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
      }}
      title={`${meta.arabicName} — ${meta.englishName}`}
    >
      <TruckTypeIcon truckType={truckType} size={iconSize} className="text-white" />
      {showBadge && (
        <span
          className="absolute -bottom-0.5 -end-0.5 grid h-4 w-4 place-items-center rounded-full bg-surface-1 text-[9px] font-extrabold text-white border border-surface-0 shadow-sm"
          style={{ color: bg }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}

export interface TruckTypeLegendProps {
  selected?: CanonicalVehicleTypeId | "ALL";
  onSelect?: (type: CanonicalVehicleTypeId | "ALL") => void;
  showAllOption?: boolean;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Visual 4-truck-type category bar with official icons and Saudi logistics colors:
 * سطحة (Flatbed) · براد (Reefer) · جاف (Dry) · ستارة (Curtain)
 */
export function TruckTypeLegend({
  selected,
  onSelect,
  showAllOption = true,
  className,
  size = "md",
}: TruckTypeLegendProps) {
  const types: CanonicalVehicleTypeId[] = ["flatbed", "reefer", "dry", "curtain"];
  const isSm = size === "sm";

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {showAllOption && (
        <button
          type="button"
          onClick={() => onSelect?.("ALL")}
          className={cn(
            "rounded-full font-bold transition-all flex items-center gap-1.5 border",
            isSm ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]",
            selected === "ALL" || !selected
              ? "bg-brand text-on-brand border-brand shadow-sm"
              : "bg-surface-2 text-text-secondary border-border-subtle hover:text-text-primary hover:border-brand/40"
          )}
        >
          <FleetGlyph size={isSm ? 13 : 15} />
          <span>الكل (٤ فئات)</span>
        </button>
      )}

      {types.map((t) => {
        const isSelected = selected === t;
        const meta = getVehicleTypeMeta(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => onSelect?.(t)}
            className={cn(
              "rounded-full font-bold transition-all flex items-center gap-1.5 border select-none",
              isSm ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]",
              isSelected
                ? "bg-brand text-on-brand border-brand shadow-sm scale-102"
                : "bg-surface-2 text-text-secondary border-border-subtle hover:text-text-primary hover:border-brand/40"
            )}
            style={
              !isSelected
                ? {
                    color: meta.accentColor,
                    borderColor: `${meta.accentColor}33`,
                  }
                : undefined
            }
          >
            <TruckTypeIcon truckType={t} size={isSm ? 14 : 16} className="shrink-0" />
            <span className="shrink-0">{meta.arabicName}</span>
          </button>
        );
      })}
    </div>
  );
}

