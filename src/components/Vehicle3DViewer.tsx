import { useEffect, useState } from "react";
import { APPROVED_VEHICLE_TYPES_LIST, normalizeVehicleType, type CanonicalVehicleTypeId } from "../data/vehicleTypes";
import { useVehicleAssets } from "../state/vehicleAssetStore";
import { useSettings } from "../settings";
import { CanonicalVehicle3DViewer } from "./CanonicalVehicle3DViewer";

const MAX_LIVE_WEBGL_CONTEXTS = 6;
let liveContexts = 0;

export function claimWebGLContext(): boolean {
  if (liveContexts >= MAX_LIVE_WEBGL_CONTEXTS) return false;
  liveContexts += 1;
  return true;
}

export function releaseWebGLContext(): void {
  liveContexts = Math.max(0, liveContexts - 1);
}

interface Vehicle3DViewerProps {
  vehicleType?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  vehicle?: { id?: string; body?: string | null; customImage?: string | null } | null;
  previewMode?: boolean;
  onTypeChange?: (newType: CanonicalVehicleTypeId) => void;
  className?: string;
  compact?: boolean;
  showControls?: boolean;
  height?: string | number;
}

export function Vehicle3DViewer({
  vehicleType = "curtain",
  vehiclePlate,
  vehicle,
  previewMode = false,
  onTypeChange,
  className,
  compact = false,
  height = "100%",
}: Vehicle3DViewerProps) {
  const { t } = useSettings();
  const { vehicleImage } = useVehicleAssets();
  const [activeType, setActiveType] = useState<CanonicalVehicleTypeId>(() => normalizeVehicleType(vehicle?.body ?? vehicleType));

  useEffect(() => {
    setActiveType(normalizeVehicleType(vehicle?.body ?? vehicleType));
  }, [vehicle?.body, vehicleType]);

  // Resolve the exact vehicle asset first, including an operator-uploaded photo.
  const vehiclePhotoSrc = vehicle ? vehicleImage(vehicle as any) : undefined;

  const selectType = (type: CanonicalVehicleTypeId) => {
    setActiveType(type);
    onTypeChange?.(type);
  };

  return (
    <div className={`relative h-full min-h-0 ${className ?? ""}`}>
      <CanonicalVehicle3DViewer
        vehicleType={activeType}
        vehiclePlate={vehiclePlate}
        vehicle={vehicle}
        src={vehiclePhotoSrc}
        height={height}
        compact={compact}
      />
      {previewMode && (
        <div className="absolute inset-x-3 bottom-3 z-30 flex flex-wrap justify-center gap-1.5 rounded-2xl border border-border-subtle bg-surface-1/85 p-2 backdrop-blur-md">
          {APPROVED_VEHICLE_TYPES_LIST.map((meta) => {
            const selected = normalizeVehicleType(meta.id) === activeType;
            return (
              <button
                key={meta.id}
                type="button"
                onClick={() => selectType(meta.id)}
                className={`min-h-9 rounded-full px-3 text-micro font-bold transition ${selected ? "bg-brand text-on-brand" : "bg-surface-2 text-text-secondary hover:bg-surface-3"}`}
              >
                {t(meta.englishName, meta.arabicName)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
