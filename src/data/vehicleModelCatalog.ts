export interface VehicleModelSlot {
  id: string;
  nameAr: string;
  nameEn: string;
  bodyType: "curtain" | "dry" | "reefer" | "flatbed";
  assetUrl: string | null;
  status: "AWAITING_ASSET" | "READY";
}

/**
 * The eight truck designs are reserved as real-asset slots.
 * No placeholder 3D URLs are invented; a slot becomes READY only after its
 * actual GLB/GLTF asset is published through the vehicle asset registry.
 */
export const VEHICLE_MODEL_SLOTS: readonly VehicleModelSlot[] = [
  { id: "ejaz-truck-01", nameAr: "شاحنة 01", nameEn: "Truck 01", bodyType: "curtain", assetUrl: null, status: "AWAITING_ASSET" },
  { id: "ejaz-truck-02", nameAr: "شاحنة 02", nameEn: "Truck 02", bodyType: "dry", assetUrl: null, status: "AWAITING_ASSET" },
  { id: "ejaz-truck-03", nameAr: "شاحنة 03", nameEn: "Truck 03", bodyType: "reefer", assetUrl: null, status: "AWAITING_ASSET" },
  { id: "ejaz-truck-04", nameAr: "شاحنة 04", nameEn: "Truck 04", bodyType: "flatbed", assetUrl: null, status: "AWAITING_ASSET" },
  { id: "ejaz-truck-05", nameAr: "شاحنة 05", nameEn: "Truck 05", bodyType: "curtain", assetUrl: null, status: "AWAITING_ASSET" },
  { id: "ejaz-truck-06", nameAr: "شاحنة 06", nameEn: "Truck 06", bodyType: "dry", assetUrl: null, status: "AWAITING_ASSET" },
  { id: "ejaz-truck-07", nameAr: "شاحنة 07", nameEn: "Truck 07", bodyType: "reefer", assetUrl: null, status: "AWAITING_ASSET" },
  { id: "ejaz-truck-08", nameAr: "شاحنة 08", nameEn: "Truck 08", bodyType: "flatbed", assetUrl: null, status: "AWAITING_ASSET" },
] as const;

export function getVehicleModelSlot(id: string): VehicleModelSlot | undefined {
  return VEHICLE_MODEL_SLOTS.find((slot) => slot.id === id);
}

export function readyVehicleModelSlots(): VehicleModelSlot[] {
  return VEHICLE_MODEL_SLOTS.filter((slot) => slot.status === "READY" && Boolean(slot.assetUrl));
}
