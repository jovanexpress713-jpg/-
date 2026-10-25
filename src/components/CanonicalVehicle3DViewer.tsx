import { useState } from "react";
import { normalizeVehicleType } from "../data/vehicleTypes";
import { buildFleetIndicatorSnapshot, type FleetIndicatorKey } from "../data/interactiveIndicators";
import { getPhotoIndicatorPosition } from "../data/photoIndicatorLayout";
import { TruckImage } from "./TruckImage";

/**
 * EJAZ photo-first vehicle view.
 * Never render generated/procedural geometry as if it were a real truck.
 * A licensed GLB/GLTF can be enabled later through the vehicle asset registry.
 */
export interface CanonicalVehicle3DViewerProps {
  vehicleType?: string;
  vehiclePlate?: string;
  vehicle?: {
    id?: string;
    body?: string | null;
    customImage?: string | null;
    speed?: number;
    fuel?: number;
    load?: number;
    maxLoad?: number;
    etaMinutes?: number;
    engineTemp?: number;
    milesLeft?: number;
    status?: "active" | "waiting" | "inactive" | string;
  } | null;
  src?: string;
  className?: string;
  height?: string | number;
  autoRotate?: boolean;
  compact?: boolean;
}

const indicatorLabel = (key: FleetIndicatorKey) => ({
  speed: "السرعة",
  fuel: "الوقود",
  load: "الحمولة",
  eta: "الوصول",
  engine: "المحرك",
  distance: "المسافة",
}[key]);

export function CanonicalVehicle3DViewer({
  vehicleType = "curtain",
  vehiclePlate,
  vehicle,
  src,
  className = "",
  height = "100%",
}: CanonicalVehicle3DViewerProps) {
  const type = normalizeVehicleType(vehicle?.body ?? vehicleType);
  const [activeIndicator, setActiveIndicator] = useState<FleetIndicatorKey | null>(null);
  const hasIndicatorData = Boolean(
    vehicle &&
    typeof vehicle.speed === "number" &&
    typeof vehicle.fuel === "number" &&
    typeof vehicle.load === "number" &&
    typeof vehicle.maxLoad === "number" &&
    typeof vehicle.etaMinutes === "number" &&
    typeof vehicle.engineTemp === "number" &&
    typeof vehicle.milesLeft === "number",
  );
  const snapshot = hasIndicatorData ? buildFleetIndicatorSnapshot(vehicle as Parameters<typeof buildFleetIndicatorSnapshot>[0]) : null;
  const active = snapshot?.indicators.find((item) => item.key === activeIndicator) ?? null;

  return (
    <div
      className={`relative overflow-hidden rounded-[inherit] bg-surface-2 ${className}`}
      style={{ height }}
      data-vehicle-render-mode="reference-photograph"
    >
      <TruckImage
        vehicle={vehicle ?? undefined}
        src={src}
        body={type}
        alt={vehiclePlate ? `إيجاز للنقليات — ${vehiclePlate}` : "شاحنة إيجاز للنقليات"}
        className="h-full w-full object-contain p-4 sm:p-8"
        loading="eager"
      />
      <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
        <span className="rounded-full border border-border-subtle bg-surface-1/90 px-3 py-1.5 text-micro font-bold text-text-primary backdrop-blur">
          EJAZ · صورة مرجعية
        </span>
        <span className="rounded-full border border-border-subtle bg-surface-1/90 px-3 py-1.5 text-micro font-semibold text-text-secondary backdrop-blur">
          {type === "curtain" ? "ستارة" : type === "dry" ? "جاف" : type === "reefer" ? "براد" : "سطحة"}
        </span>
      </div>

      {snapshot && (
        <div className="absolute inset-0 z-20" aria-label="مؤشرات المركبة التفاعلية">
          {snapshot.indicators.map((indicator) => {
            const position = getPhotoIndicatorPosition(indicator.key);
            const selected = indicator.key === activeIndicator;
            const tone = indicator.tone === "warning" ? "border-status-waiting/60 bg-status-waiting/15" : indicator.tone === "active" ? "border-status-active/60 bg-status-active/15" : "border-border-subtle/80 bg-surface-1/90";
            return (
              <button
                key={indicator.key}
                type="button"
                onClick={() => setActiveIndicator(selected ? null : indicator.key)}
                aria-pressed={selected}
                aria-label={`${indicatorLabel(indicator.key)}: ${indicator.value}`}
                className={`absolute min-h-11 max-w-[145px] rounded-2xl border px-3 py-2 text-start shadow-lg backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:border-brand/60 hover:bg-surface-1 ${tone} ${selected ? "ring-2 ring-brand/70" : ""}`}
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  transform: position.anchor === "right" ? "translate(-100%, -50%)" : "translate(0, -50%)",
                }}
              >
                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{indicatorLabel(indicator.key)}</span>
                <span className="mt-0.5 block whitespace-nowrap text-label font-extrabold tabular-nums text-text-primary">{indicator.value}</span>
              </button>
            );
          })}
          {active && (
            <div className="absolute inset-x-3 bottom-3 mx-auto max-w-sm rounded-2xl border border-brand/30 bg-surface-1/95 p-3 shadow-xl backdrop-blur-md" role="status">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-micro font-bold uppercase tracking-[0.12em] text-brand">{indicatorLabel(active.key)}</div>
                  <div className="mt-1 text-section-title font-bold tabular-nums text-text-primary">{active.value}</div>
                  <div className="mt-1 text-micro text-text-secondary">{active.hintAr}</div>
                </div>
                <button type="button" onClick={() => setActiveIndicator(null)} className="min-h-9 rounded-full border border-border-subtle px-3 text-micro font-semibold text-text-secondary hover:bg-surface-2" aria-label="إغلاق تفاصيل المؤشر">إغلاق</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="absolute inset-x-3 bottom-3 flex justify-center">
        {!active && (
          <span className="rounded-full border border-border-subtle bg-surface-1/90 px-3 py-1.5 text-micro text-text-secondary backdrop-blur">
            {snapshot ? "اضغط على أي مؤشر لعرض التفاصيل" : "صورة المركبة المسجلة أو الصورة الرسمية للفئة"}
          </span>
        )}
      </div>
    </div>
  );
}
