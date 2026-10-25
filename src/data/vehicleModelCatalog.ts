export type TractorVariant = "mercedes" | "volvo";
export type TrailerVariant = "curtain" | "dry" | "reefer" | "flatbed";

export interface VehicleModelSlot {
  id: string;
  nameAr: string;
  nameEn: string;
  bodyType: TrailerVariant;
  tractor: TractorVariant;
  trailer: TrailerVariant;
  tractorModelPath: string;
  trailerModelPath: string;
  assetUrl: string | null;
  status: "AWAITING_ASSET" | "READY";
  notesAr: string;
}

const TRACTOR_MODEL_PATHS: Record<TractorVariant, string> = {
  mercedes: "/models/trucks/ejaz_mercedes_inspired_tractor.glb",
  volvo: "/models/trucks/ejaz_volvo_inspired_tractor.glb",
};

const TRAILER_MODEL_PATHS: Record<TrailerVariant, string> = {
  curtain: "/models/trucks/ejaz_trailer_curtain_side.glb",
  dry: "/models/trucks/ejaz_trailer_dry_box.glb",
  reefer: "/models/trucks/ejaz_trailer_reefer.glb",
  flatbed: "/models/trucks/ejaz_trailer_flatbed.glb",
};

/**
 * The eight EJAZ fleet designs are the 2×4 combinations already prepared by
 * the product design: Mercedes-inspired or Volvo-inspired tractor × one of
 * the four trailer bodies. A design is not marked READY until its real GLB/
 * GLTF is published and verified. No fake 3D URL is invented here.
 *
 * The six component paths below are the exact filenames in the supplied asset
 * package. They intentionally remain AWAITING_ASSET until those binaries are
 * actually published into public/models/trucks and verified by CI/runtime.
 */
export const VEHICLE_MODEL_SLOTS: readonly VehicleModelSlot[] = [
  { id: "ejaz-mercedes-curtain", nameAr: "مرسيدس + ستارة", nameEn: "Mercedes + Curtainsider", bodyType: "curtain", tractor: "mercedes", trailer: "curtain", tractorModelPath: TRACTOR_MODEL_PATHS.mercedes, trailerModelPath: TRAILER_MODEL_PATHS.curtain, assetUrl: null, status: "AWAITING_ASSET", notesAr: "تركيبة مرسيدس مع مقطورة ستارة" },
  { id: "ejaz-mercedes-dry", nameAr: "مرسيدس + جاف", nameEn: "Mercedes + Dry Box", bodyType: "dry", tractor: "mercedes", trailer: "dry", tractorModelPath: TRACTOR_MODEL_PATHS.mercedes, trailerModelPath: TRAILER_MODEL_PATHS.dry, assetUrl: null, status: "AWAITING_ASSET", notesAr: "تركيبة مرسيدس مع صندوق جاف" },
  { id: "ejaz-mercedes-reefer", nameAr: "مرسيدس + براد", nameEn: "Mercedes + Reefer", bodyType: "reefer", tractor: "mercedes", trailer: "reefer", tractorModelPath: TRACTOR_MODEL_PATHS.mercedes, trailerModelPath: TRAILER_MODEL_PATHS.reefer, assetUrl: null, status: "AWAITING_ASSET", notesAr: "تركيبة مرسيدس مع مقطورة تبريد" },
  { id: "ejaz-mercedes-flatbed", nameAr: "مرسيدس + سطحة", nameEn: "Mercedes + Flatbed", bodyType: "flatbed", tractor: "mercedes", trailer: "flatbed", tractorModelPath: TRACTOR_MODEL_PATHS.mercedes, trailerModelPath: TRAILER_MODEL_PATHS.flatbed, assetUrl: null, status: "AWAITING_ASSET", notesAr: "تركيبة مرسيدس مع سطحة" },
  { id: "ejaz-volvo-curtain", nameAr: "فولفو + ستارة", nameEn: "Volvo + Curtainsider", bodyType: "curtain", tractor: "volvo", trailer: "curtain", tractorModelPath: TRACTOR_MODEL_PATHS.volvo, trailerModelPath: TRAILER_MODEL_PATHS.curtain, assetUrl: null, status: "AWAITING_ASSET", notesAr: "تركيبة فولفو مع مقطورة ستارة" },
  { id: "ejaz-volvo-dry", nameAr: "فولفو + جاف", nameEn: "Volvo + Dry Box", bodyType: "dry", tractor: "volvo", trailer: "dry", tractorModelPath: TRACTOR_MODEL_PATHS.volvo, trailerModelPath: TRAILER_MODEL_PATHS.dry, assetUrl: null, status: "AWAITING_ASSET", notesAr: "تركيبة فولفو مع صندوق جاف" },
  { id: "ejaz-volvo-reefer", nameAr: "فولفو + براد", nameEn: "Volvo + Reefer", bodyType: "reefer", tractor: "volvo", trailer: "reefer", tractorModelPath: TRACTOR_MODEL_PATHS.volvo, trailerModelPath: TRAILER_MODEL_PATHS.reefer, assetUrl: null, status: "AWAITING_ASSET", notesAr: "تركيبة فولفو مع مقطورة تبريد" },
  { id: "ejaz-volvo-flatbed", nameAr: "فولفو + سطحة", nameEn: "Volvo + Flatbed", bodyType: "flatbed", tractor: "volvo", trailer: "flatbed", tractorModelPath: TRACTOR_MODEL_PATHS.volvo, trailerModelPath: TRAILER_MODEL_PATHS.flatbed, assetUrl: null, status: "AWAITING_ASSET", notesAr: "تركيبة فولفو مع سطحة" },
] as const;

export function getVehicleModelSlot(id: string): VehicleModelSlot | undefined {
  return VEHICLE_MODEL_SLOTS.find((slot) => slot.id === id);
}

export function getVehicleModelSlotForComposition(
  tractor: TractorVariant,
  trailer: TrailerVariant,
): VehicleModelSlot | undefined {
  return VEHICLE_MODEL_SLOTS.find((slot) => slot.tractor === tractor && slot.trailer === trailer);
}

export function readyVehicleModelSlots(): VehicleModelSlot[] {
  return VEHICLE_MODEL_SLOTS.filter((slot) => slot.status === "READY" && Boolean(slot.assetUrl));
}
