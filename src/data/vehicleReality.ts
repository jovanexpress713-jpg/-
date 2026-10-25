import type { Vehicle } from "./types";
import type { VehicleAssetRegistryState } from "../state/vehicleAssetStore";
import { getVehicleTypeMeta, normalizeVehicleType } from "./vehicleTypes";

export type RealityModelSource = "OFFICIAL_MODEL" | "REFERENCE_IMAGE" | "UNAVAILABLE";

export interface VehicleRealityAsset {
  bodyType: ReturnType<typeof normalizeVehicleType>;
  bodyLabelAr: string;
  bodyLabelEn: string;
  manufacturer: Vehicle["brand"];
  modelName: string;
  modelUrl: string | null;
  modelSource: RealityModelSource;
  imageUrl: string;
  isOfficialModel: boolean;
}

export function getRealityAsset(vehicle: Vehicle, registry: VehicleAssetRegistryState): VehicleRealityAsset {
  const bodyType = normalizeVehicleType(vehicle.body);
  const meta = getVehicleTypeMeta(bodyType);
  const category = registry.types[bodyType];
  const modelUrl = category?.model?.url || null;
  const imageUrl = vehicle.customImage?.trim() || category?.officialImage || meta.officialImage;
  return {
    bodyType,
    bodyLabelAr: meta.arabicName,
    bodyLabelEn: meta.englishName,
    manufacturer: vehicle.brand,
    modelName: vehicle.model,
    modelUrl,
    modelSource: modelUrl ? "OFFICIAL_MODEL" : imageUrl ? "REFERENCE_IMAGE" : "UNAVAILABLE",
    imageUrl,
    isOfficialModel: Boolean(modelUrl && category?.model?.source === "OFFICIAL_UPLOAD"),
  };
}

export function clampTelemetry(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function loadPercent(vehicle: Vehicle): number {
  return vehicle.maxLoad > 0 ? clampTelemetry((vehicle.load / vehicle.maxLoad) * 100) : 0;
}

export function etaLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "—";
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return hours ? `${hours}س ${mins}د` : `${mins}د`;
}
