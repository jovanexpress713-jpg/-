import { normalizeVehicleType } from "../data/vehicleTypes";
import { TruckImage } from "./TruckImage";

/**
 * EJAZ photo-first vehicle view.
 * Never render generated/procedural geometry as if it were a real truck.
 * A licensed GLB/GLTF can be enabled later through the vehicle asset registry.
 */
export interface CanonicalVehicle3DViewerProps {
  vehicleType?: string;
  vehiclePlate?: string;
  vehicle?: { id?: string; body?: string | null; customImage?: string | null } | null;
  src?: string;
  className?: string;
  height?: string | number;
  autoRotate?: boolean;
  compact?: boolean;
}

export function CanonicalVehicle3DViewer({
  vehicleType = "curtain",
  vehiclePlate,
  vehicle,
  src,
  className = "",
  height = "100%",
}: CanonicalVehicle3DViewerProps) {
  const type = normalizeVehicleType(vehicle?.body ?? vehicleType);

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
      <div className="absolute inset-x-3 bottom-3 flex justify-center">
        <span className="rounded-full border border-border-subtle bg-surface-1/90 px-3 py-1.5 text-micro text-text-secondary backdrop-blur">
          صورة المركبة المسجلة أو الصورة الرسمية للفئة
        </span>
      </div>
    </div>
  );
}
