import type { CanonicalVehicleTypeId } from "./vehicleTypes";

export interface CanonicalVehicleModelDescriptor {
  type: CanonicalVehicleTypeId;
  url: string;
  labelAr: string;
  labelEn: string;
  source: "EJAZ_CANONICAL";
  format: "obj";
  scale: number;
  rotationY: number;
  yOffset: number;
}

export const CANONICAL_VEHICLE_MODELS: Record<CanonicalVehicleTypeId, CanonicalVehicleModelDescriptor> = {
  curtain: {
    type: "curtain",
    url: "/models/ejaz/ejaz-curtain-canonical.obj",
    labelAr: "ستارة — نموذج EJAZ قياسي",
    labelEn: "Curtain — EJAZ canonical model",
    source: "EJAZ_CANONICAL",
    format: "obj",
    scale: 1,
    rotationY: 0,
    yOffset: 1.05,
  },
  dry: {
    type: "dry",
    url: "/models/ejaz/ejaz-dry-canonical.obj",
    labelAr: "جاف — نموذج EJAZ قياسي",
    labelEn: "Dry — EJAZ canonical model",
    source: "EJAZ_CANONICAL",
    format: "obj",
    scale: 1,
    rotationY: 0,
    yOffset: 1.05,
  },
  reefer: {
    type: "reefer",
    url: "/models/ejaz/ejaz-reefer-canonical.obj",
    labelAr: "بارد — نموذج EJAZ قياسي",
    labelEn: "Reefer — EJAZ canonical model",
    source: "EJAZ_CANONICAL",
    format: "obj",
    scale: 1,
    rotationY: 0,
    yOffset: 1.05,
  },
  flatbed: {
    type: "flatbed",
    url: "/models/ejaz/ejaz-flatbed-canonical.obj",
    labelAr: "سطحة — نموذج EJAZ قياسي",
    labelEn: "Flatbed — EJAZ canonical model",
    source: "EJAZ_CANONICAL",
    format: "obj",
    scale: 1,
    rotationY: 0,
    yOffset: 1.05,
  },
};

export function getCanonicalVehicleModel(type: CanonicalVehicleTypeId): CanonicalVehicleModelDescriptor {
  return CANONICAL_VEHICLE_MODELS[type] ?? CANONICAL_VEHICLE_MODELS.curtain;
}
