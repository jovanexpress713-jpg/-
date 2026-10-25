import type { CanonicalVehicleTypeId } from "./vehicleTypes";

/**
 * Reference-image descriptors only.
 * 3D models must be licensed GLB/GLTF files published through the vehicle asset registry.
 * Procedural OBJ geometry is intentionally not a fallback.
 */
export interface CanonicalVehicleModelDescriptor {
  type: CanonicalVehicleTypeId;
  url: string;
  labelAr: string;
  labelEn: string;
  source: "OFFICIAL_REFERENCE_PHOTO";
  format: "image";
  scale: number;
  rotationY: number;
  yOffset: number;
}

const IMAGE_BY_TYPE: Record<CanonicalVehicleTypeId, string> = {
  curtain: "/images/trucks/official/official-curtain.png",
  dry: "/images/trucks/official/official-dry.png",
  reefer: "/images/trucks/official/official-reefer.png",
  flatbed: "/images/trucks/official/official-flatbed.png",
};

export const CANONICAL_VEHICLE_MODELS: Record<CanonicalVehicleTypeId, CanonicalVehicleModelDescriptor> = {
  curtain: { type: "curtain", url: IMAGE_BY_TYPE.curtain, labelAr: "ستارة — صورة مرجعية", labelEn: "Curtainsider — reference photo", source: "OFFICIAL_REFERENCE_PHOTO", format: "image", scale: 1, rotationY: 0, yOffset: 0 },
  dry: { type: "dry", url: IMAGE_BY_TYPE.dry, labelAr: "جاف — صورة مرجعية", labelEn: "Dry van — reference photo", source: "OFFICIAL_REFERENCE_PHOTO", format: "image", scale: 1, rotationY: 0, yOffset: 0 },
  reefer: { type: "reefer", url: IMAGE_BY_TYPE.reefer, labelAr: "براد — صورة مرجعية", labelEn: "Reefer — reference photo", source: "OFFICIAL_REFERENCE_PHOTO", format: "image", scale: 1, rotationY: 0, yOffset: 0 },
  flatbed: { type: "flatbed", url: IMAGE_BY_TYPE.flatbed, labelAr: "سطحة — صورة مرجعية", labelEn: "Flatbed — reference photo", source: "OFFICIAL_REFERENCE_PHOTO", format: "image", scale: 1, rotationY: 0, yOffset: 0 },
};

export function getCanonicalVehicleModel(type: CanonicalVehicleTypeId): CanonicalVehicleModelDescriptor {
  return CANONICAL_VEHICLE_MODELS[type] ?? CANONICAL_VEHICLE_MODELS.curtain;
}
