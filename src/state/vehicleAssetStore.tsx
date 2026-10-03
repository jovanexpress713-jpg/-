import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_VEHICLE_IMAGES,
  getVehicleOfficialImage,
  normalizeVehicleType,
  type CanonicalVehicleTypeId,
} from "../data/vehicleTypes";
import { apiClient } from "../services/apiClient";

/**
 * EJAZ Transport — Shared Vehicle Asset Store.
 *
 * The Android application, the admin control room, the fleet screens and the
 * trip/shipment screens all read vehicle imagery and 3D models from this single
 * in-memory projection of the server-side registry. Uploading an official asset
 * once therefore updates every surface at the same time.
 */

export interface VehicleModelAsset {
  url: string | null;
  format: "glb" | "gltf" | null;
  source: "NONE" | "OFFICIAL_UPLOAD";
  fileName?: string;
  sizeBytes?: number;
  sha256?: string;
  scale: number;
  rotationY: number;
  yOffset: number;
  cameraRadius?: number;
  updatedAt?: string;
}

export interface VehicleTypeAsset {
  type: CanonicalVehicleTypeId;
  arabicName: string;
  englishName: string;
  categoryCode: string;
  officialImage: string;
  imageSource: "DEFAULT" | "OFFICIAL_UPLOAD";
  imageFileName?: string;
  imageUpdatedAt?: string;
  originalImage?: string;
  hasOfficialImage: boolean;
  model: VehicleModelAsset;
  hasOfficialModel: boolean;
  notesAr?: string;
}

export interface VehicleAssetRegistryState {
  types: Record<CanonicalVehicleTypeId, VehicleTypeAsset>;
  vehicles: Record<string, { url: string; originalFileName?: string; updatedAt: string }>;
  limits: { maxImageBytes: number; maxModelBytes: number };
  updatedAt: string;
  source: "SERVER" | "DEFAULTS";
}

function fallbackModel(): VehicleModelAsset {
  return { url: null, format: null, source: "NONE", scale: 1, rotationY: 0, yOffset: 0 };
}

export function buildDefaultRegistry(): VehicleAssetRegistryState {
  const types = {} as Record<CanonicalVehicleTypeId, VehicleTypeAsset>;
  (["flatbed", "reefer", "dry", "curtain"] as CanonicalVehicleTypeId[]).forEach((type) => {
    types[type] = {
      type,
      arabicName: DEFAULT_VEHICLE_IMAGES[type].ar,
      englishName: DEFAULT_VEHICLE_IMAGES[type].en,
      categoryCode: DEFAULT_VEHICLE_IMAGES[type].code,
      officialImage: DEFAULT_VEHICLE_IMAGES[type].image,
      imageSource: "DEFAULT",
      hasOfficialImage: false,
      model: fallbackModel(),
      hasOfficialModel: false,
    };
  });
  return {
    types,
    vehicles: {},
    limits: { maxImageBytes: 12 * 1024 * 1024, maxModelBytes: 24 * 1024 * 1024 },
    updatedAt: "",
    source: "DEFAULTS",
  };
}

interface VehicleAssetContextValue {
  registry: VehicleAssetRegistryState;
  isLoading: boolean;
  refresh: () => Promise<void>;
  /** Official category image (registry-aware, falls back to the shipped baseline). */
  typeImage: (type: string | null | undefined) => string;
  /** Per-vehicle photograph when published, otherwise the official category image. */
  vehicleImage: (vehicle?: { id?: string; body?: string | null; customImage?: string | null } | null) => string;
  /** Official 3D model descriptor, or null when none has been published yet. */
  typeModel: (type: string | null | undefined) => VehicleModelAsset | null;
}

const DEFAULT_CONTEXT: VehicleAssetContextValue = {
  registry: buildDefaultRegistry(),
  isLoading: false,
  refresh: async () => {},
  typeImage: (type) => getVehicleOfficialImage(type),
  vehicleImage: (vehicle) => {
    if (vehicle?.customImage && vehicle.customImage.trim()) return vehicle.customImage;
    return getVehicleOfficialImage(vehicle?.body);
  },
  typeModel: () => null,
};

const Ctx = createContext<VehicleAssetContextValue>(DEFAULT_CONTEXT);

export function VehicleAssetProvider({ children }: { children: ReactNode }) {
  const [registry, setRegistry] = useState<VehicleAssetRegistryState>(() => buildDefaultRegistry());
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await apiClient.vehicleAssets.getRegistry();
      const incoming = res?.registry;
      if (!incoming?.types?.length) return;

      const merged = buildDefaultRegistry();
      for (const entry of incoming.types) {
        const key = normalizeVehicleType(entry.type);
        merged.types[key] = {
          ...merged.types[key],
          ...entry,
          type: key,
          model: { ...fallbackModel(), ...(entry.model || {}) },
        };
      }
      merged.vehicles = incoming.vehicles || {};
      if (res.limits) merged.limits = res.limits;
      merged.updatedAt = incoming.updatedAt || "";
      merged.source = "SERVER";
      setRegistry(merged);
    } catch {
      // Offline / unauthenticated: the shipped baseline assets remain authoritative.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<VehicleAssetContextValue>(() => {
    const typeImage = (type: string | null | undefined) => {
      const key = normalizeVehicleType(type);
      return registry.types[key]?.officialImage || getVehicleOfficialImage(type);
    };

    const vehicleImage = (vehicle?: { id?: string; body?: string | null; customImage?: string | null } | null) => {
      if (!vehicle) return registry.types.curtain.officialImage;
      const published = vehicle.id ? registry.vehicles[vehicle.id]?.url : undefined;
      if (published) return published;
      if (vehicle.customImage && vehicle.customImage.trim()) return vehicle.customImage;
      return typeImage(vehicle.body);
    };

    const typeModel = (type: string | null | undefined) => {
      const key = normalizeVehicleType(type);
      const model = registry.types[key]?.model;
      return model?.url ? model : null;
    };

    return { registry, isLoading, refresh, typeImage, vehicleImage, typeModel };
  }, [registry, isLoading, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVehicleAssets() {
  return useContext(Ctx);
}
