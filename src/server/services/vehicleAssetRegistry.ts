/**
 * EJAZ Transport — Official Vehicle Asset Registry (Single Source of Truth)
 *
 * Every vehicle image and 3D model in the platform is catalogued here:
 *   • 4 canonical fleet categories (سطحة / براد / جاف / ستارة)
 *   • one OFFICIAL reference image per category
 *   • one OFFICIAL GLB/GLTF model per category
 *   • optional per-vehicle custom image (falls back to the category asset)
 *
 * The Android application, the admin control room, the fleet registry, trip
 * screens and shipment screens all resolve their imagery through this registry,
 * so a single upload propagates everywhere at once.
 *
 * Assets are stored as real files under `public/uploads/vehicle-assets/` and the
 * catalogue itself is persisted as JSON, which keeps the original upload untouched
 * and lets the registry survive restarts.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

export type VehicleAssetTypeId = "flatbed" | "reefer" | "dry" | "curtain";

export const VEHICLE_ASSET_TYPES: VehicleAssetTypeId[] = ["flatbed", "reefer", "dry", "curtain"];

export const VEHICLE_ASSET_TYPE_META: Record<VehicleAssetTypeId, { ar: string; en: string; code: string }> = {
  flatbed: { ar: "سطحة", en: "Flatbed", code: "EJ-FLAT" },
  reefer: { ar: "براد", en: "Refrigerated", code: "EJ-REEF" },
  dry: { ar: "جاف", en: "Dry Van", code: "EJ-DRY" },
  curtain: { ar: "ستارة", en: "Curtainsider", code: "EJ-CURT" },
};

/** Baseline official assets shipped with the project (used until an upload supersedes them). */
export const DEFAULT_TYPE_IMAGES: Record<VehicleAssetTypeId, string> = {
  flatbed: "/images/trucks/official/official-flatbed.png",
  reefer: "/images/trucks/official/official-reefer.png",
  dry: "/images/trucks/official/official-dry.png",
  curtain: "/images/trucks/official/official-curtain.png",
};

export interface VehicleModelAsset {
  /** Public URL of the uploaded GLB/GLTF, or null when no model has been provisioned. */
  url: string | null;
  format: "glb" | "gltf" | null;
  source: "NONE" | "OFFICIAL_UPLOAD";
  fileName?: string;
  sizeBytes?: number;
  sha256?: string;
  /** Presentation transform applied by the viewer so the model frame matches the platform. */
  scale: number;
  rotationY: number;
  yOffset: number;
  /** Optional explicit camera framing for the trailer bed / cab. */
  cameraRadius?: number;
  updatedAt?: string;
}

export interface VehicleTypeAsset {
  type: VehicleAssetTypeId;
  officialImage: string;
  imageSource: "DEFAULT" | "OFFICIAL_UPLOAD";
  originalImage?: string;
  imageFileName?: string;
  imageUpdatedAt?: string;
  model: VehicleModelAsset;
  notesAr?: string;
}

export interface VehicleAssetRegistry {
  version: number;
  updatedAt: string;
  types: Record<VehicleAssetTypeId, VehicleTypeAsset>;
  vehicles: Record<string, { url: string; originalFileName?: string; updatedAt: string }>;
}

/**
 * Storage locations. Overridable so automated tests can run against an
 * isolated sandbox and never touch the published production assets.
 */
function resolveUploadRoot(): string {
  return process.env.VEHICLE_ASSET_UPLOAD_ROOT
    ? path.resolve(process.env.VEHICLE_ASSET_UPLOAD_ROOT)
    : path.resolve(process.cwd(), "public/uploads/vehicle-assets");
}

function resolveManifestPath(): string {
  return process.env.VEHICLE_ASSET_MANIFEST_PATH
    ? path.resolve(process.env.VEHICLE_ASSET_MANIFEST_PATH)
    : path.resolve(process.cwd(), "data/vehicle-asset-registry.json");
}

const PUBLIC_PREFIX = "/uploads/vehicle-assets";

/** Public mount root (`/uploads`) that the static handler must serve. */
export function getUploadsServeRoot(): string {
  return path.dirname(resolveUploadRoot());
}

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_MODEL_BYTES = 24 * 1024 * 1024;

const ALLOWED_IMAGE_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

function emptyModel(): VehicleModelAsset {
  return { url: null, format: null, source: "NONE", scale: 1, rotationY: 0, yOffset: 0 };
}

function defaultRegistry(): VehicleAssetRegistry {
  const types = {} as Record<VehicleAssetTypeId, VehicleTypeAsset>;
  for (const type of VEHICLE_ASSET_TYPES) {
    types[type] = {
      type,
      officialImage: DEFAULT_TYPE_IMAGES[type],
      imageSource: "DEFAULT",
      model: emptyModel(),
    };
  }
  return { version: 1, updatedAt: new Date().toISOString(), types, vehicles: {} };
}

function ensureDirs() {
  fs.mkdirSync(resolveUploadRoot(), { recursive: true });
  fs.mkdirSync(path.dirname(resolveManifestPath()), { recursive: true });
}

let cache: VehicleAssetRegistry | null = null;

function readManifest(): VehicleAssetRegistry {
  if (cache) return cache;
  ensureDirs();
  try {
    if (fs.existsSync(resolveManifestPath())) {
      const parsed = JSON.parse(fs.readFileSync(resolveManifestPath(), "utf8")) as VehicleAssetRegistry;
      const base = defaultRegistry();
      // Merge defensively so a hand-edited or older manifest cannot break the API.
      const merged: VehicleAssetRegistry = {
        version: parsed.version || base.version,
        updatedAt: parsed.updatedAt || base.updatedAt,
        types: base.types,
        vehicles: parsed.vehicles || {},
      };
      for (const type of VEHICLE_ASSET_TYPES) {
        const incoming = parsed.types?.[type];
        if (!incoming) continue;
        merged.types[type] = {
          ...merged.types[type],
          ...incoming,
          type,
          model: { ...emptyModel(), ...(incoming.model || {}) },
        };
        // Drop stale references whose files were removed from disk.
        if (merged.types[type].imageSource === "OFFICIAL_UPLOAD" && !assetExists(merged.types[type].officialImage)) {
          merged.types[type].officialImage = DEFAULT_TYPE_IMAGES[type];
          merged.types[type].imageSource = "DEFAULT";
        }
        const modelUrl = merged.types[type].model.url;
        if (modelUrl && !assetExists(modelUrl)) {
          merged.types[type].model = emptyModel();
        }
      }
      cache = merged;
      return merged;
    }
  } catch (err) {
    console.warn("[VehicleAssetRegistry] Manifest unreadable, using defaults:", (err as Error).message);
  }
  cache = defaultRegistry();
  return cache;
}

function assetExists(url: string): boolean {
  if (!url.startsWith(PUBLIC_PREFIX)) return true; // baseline assets live under /images
  const rel = url.slice(PUBLIC_PREFIX.length).replace(/^\//, "");
  return fs.existsSync(path.join(resolveUploadRoot(), rel));
}

function writeManifest(registry: VehicleAssetRegistry) {
  ensureDirs();
  registry.updatedAt = new Date().toISOString();
  fs.writeFileSync(resolveManifestPath(), JSON.stringify(registry, null, 2), "utf8");
  cache = registry;
}

export function getRegistry(): VehicleAssetRegistry {
  return readManifest();
}

/** Clears the in-process manifest cache (used by tests and after external edits). */
export function resetRegistryCache() {
  cache = null;
}

/** Lightweight payload for the UI layers (no filesystem details). */
export function getPublicRegistry() {
  const reg = readManifest();
  return {
    version: reg.version,
    updatedAt: reg.updatedAt,
    types: VEHICLE_ASSET_TYPES.map((type) => ({
      type,
      arabicName: VEHICLE_ASSET_TYPE_META[type].ar,
      englishName: VEHICLE_ASSET_TYPE_META[type].en,
      categoryCode: VEHICLE_ASSET_TYPE_META[type].code,
      officialImage: reg.types[type].officialImage,
      imageSource: reg.types[type].imageSource,
      imageFileName: reg.types[type].imageFileName,
      imageUpdatedAt: reg.types[type].imageUpdatedAt,
      originalImage: reg.types[type].originalImage,
      hasOfficialImage: reg.types[type].imageSource === "OFFICIAL_UPLOAD",
      model: reg.types[type].model,
      hasOfficialModel: reg.types[type].model.source === "OFFICIAL_UPLOAD" && !!reg.types[type].model.url,
      notesAr: reg.types[type].notesAr,
    })),
    vehicles: reg.vehicles,
  };
}

export type PublicVehicleAssetRegistry = ReturnType<typeof getPublicRegistry>;

function decodeBase64Payload(dataUrlOrBase64: string): Buffer {
  const cleaned = dataUrlOrBase64.includes(",") ? dataUrlOrBase64.slice(dataUrlOrBase64.indexOf(",") + 1) : dataUrlOrBase64;
  return Buffer.from(cleaned, "base64");
}

function assertType(type: string): VehicleAssetTypeId {
  if (!VEHICLE_ASSET_TYPES.includes(type as VehicleAssetTypeId)) {
    throw Object.assign(new Error(`Unknown vehicle type '${type}'. Approved types: ${VEHICLE_ASSET_TYPES.join(", ")}`), {
      code: "INVALID_TYPE",
      status: 400,
    });
  }
  return type as VehicleAssetTypeId;
}

/**
 * Stores the official reference image for a fleet category.
 * The uploaded original is preserved byte-for-byte at `original.<ext>` and the
 * exact same bytes back the public `official.<ext>` asset — no re-encoding,
 * no substitution, no generated placeholder.
 */
export function saveTypeImage(type: string, payload: {
  data: string;
  fileName?: string;
  notesAr?: string;
}): VehicleTypeAsset {
  const typeId = assertType(type);
  const buffer = decodeBase64Payload(payload.data);
  if (!buffer.length) throw Object.assign(new Error("Empty image payload"), { status: 400, code: "EMPTY_PAYLOAD" });
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error(`Image exceeds the ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB limit`), {
      status: 413,
      code: "IMAGE_TOO_LARGE",
    });
  }

  const ext = (path.extname(payload.fileName || "") || ".png").toLowerCase();
  if (!ALLOWED_IMAGE_EXT[ext]) {
    throw Object.assign(new Error(`Unsupported image format '${ext}'. Allowed: ${Object.keys(ALLOWED_IMAGE_EXT).join(", ")}`), {
      status: 415,
      code: "UNSUPPORTED_FORMAT",
    });
  }

  const dir = path.join(resolveUploadRoot(), typeId);
  fs.mkdirSync(dir, { recursive: true });

  // Clear previously stored official binaries for this category.
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith("official.") || file.startsWith("original.")) {
      fs.unlinkSync(path.join(dir, file));
    }
  }

  fs.writeFileSync(path.join(dir, `original${ext}`), buffer);
  fs.writeFileSync(path.join(dir, `official${ext}`), buffer);

  const registry = readManifest();
  const entry = registry.types[typeId];
  entry.officialImage = `${PUBLIC_PREFIX}/${typeId}/official${ext}`;
  entry.originalImage = `${PUBLIC_PREFIX}/${typeId}/original${ext}`;
  entry.imageSource = "OFFICIAL_UPLOAD";
  entry.imageFileName = payload.fileName || `official${ext}`;
  entry.imageUpdatedAt = new Date().toISOString();
  if (payload.notesAr) entry.notesAr = payload.notesAr;
  writeManifest(registry);
  return entry;
}

/**
 * Validates that a buffer really is a GLB/GLTF asset before it is published.
 * The file extension is never trusted: only the binary glTF magic or a parsed
 * glTF 2.0 JSON header is accepted, so an arbitrary upload cannot masquerade
 * as a vehicle model.
 */
function detectModelFormat(buffer: Buffer, fileName = ""): "glb" | "gltf" | null {
  // Binary glTF container: magic "glTF" + version + declared length.
  if (buffer.length >= 20 && buffer.subarray(0, 4).toString("ascii") === "glTF") {
    const version = buffer.readUInt32LE(4);
    const declaredLength = buffer.readUInt32LE(8);
    if (version === 2 && declaredLength === buffer.length) return "glb";
  }

  // JSON glTF 2.0 document.
  const head = buffer.subarray(0, 512).toString("utf8").trimStart();
  if (head.startsWith("{")) {
    try {
      const parsed = JSON.parse(buffer.toString("utf8"));
      if (parsed?.asset && typeof parsed.asset.version === "string" && parsed.asset.version.startsWith("2")) {
        return "gltf";
      }
    } catch {
      /* malformed JSON: treat as invalid */
    }
  }

  void fileName;
  return null;
}

/** Stores the official GLB/GLTF model for a fleet category. */
export function saveTypeModel(type: string, payload: {
  data: string;
  fileName?: string;
  scale?: number;
  rotationY?: number;
  yOffset?: number;
  cameraRadius?: number;
}): VehicleTypeAsset {
  const typeId = assertType(type);
  const buffer = decodeBase64Payload(payload.data);
  if (!buffer.length) throw Object.assign(new Error("Empty model payload"), { status: 400, code: "EMPTY_PAYLOAD" });
  if (buffer.length > MAX_MODEL_BYTES) {
    throw Object.assign(new Error(`Model exceeds the ${Math.round(MAX_MODEL_BYTES / 1024 / 1024)}MB limit`), {
      status: 413,
      code: "MODEL_TOO_LARGE",
    });
  }

  const format = detectModelFormat(buffer, payload.fileName);
  if (!format) {
    throw Object.assign(
      new Error("Invalid 3D asset. A binary GLB (magic 'glTF') or a glTF 2.0 JSON file is required."),
      { status: 415, code: "INVALID_MODEL" },
    );
  }

  const dir = path.join(resolveUploadRoot(), typeId);
  fs.mkdirSync(dir, { recursive: true });
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith("model.")) fs.unlinkSync(path.join(dir, file));
  }

  const target = `model.${format}`;
  fs.writeFileSync(path.join(dir, target), buffer);

  const registry = readManifest();
  const entry = registry.types[typeId];
  entry.model = {
    url: `${PUBLIC_PREFIX}/${typeId}/${target}`,
    format,
    source: "OFFICIAL_UPLOAD",
    fileName: payload.fileName || target,
    sizeBytes: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    scale: payload.scale ?? entry.model.scale ?? 1,
    rotationY: payload.rotationY ?? entry.model.rotationY ?? 0,
    yOffset: payload.yOffset ?? entry.model.yOffset ?? 0,
    cameraRadius: payload.cameraRadius ?? entry.model.cameraRadius,
    updatedAt: new Date().toISOString(),
  };
  writeManifest(registry);
  return entry;
}

export function removeTypeModel(type: string): VehicleTypeAsset {
  const typeId = assertType(type);
  const dir = path.join(resolveUploadRoot(), typeId);
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (file.startsWith("model.")) fs.unlinkSync(path.join(dir, file));
    }
  }
  const registry = readManifest();
  registry.types[typeId].model = emptyModel();
  writeManifest(registry);
  return registry.types[typeId];
}

/** Viewer framing (scale / yaw / height) so an uploaded model matches the platform frame. */
export function updateModelTransform(type: string, transform: {
  scale?: number;
  rotationY?: number;
  yOffset?: number;
  cameraRadius?: number;
}): VehicleTypeAsset {
  const typeId = assertType(type);
  const registry = readManifest();
  const entry = registry.types[typeId];
  if (typeof transform.scale === "number") entry.model.scale = Math.min(50, Math.max(0.01, transform.scale));
  if (typeof transform.rotationY === "number") entry.model.rotationY = transform.rotationY;
  if (typeof transform.yOffset === "number") entry.model.yOffset = Math.min(20, Math.max(-20, transform.yOffset));
  if (typeof transform.cameraRadius === "number") entry.model.cameraRadius = Math.min(200, Math.max(2, transform.cameraRadius));
  writeManifest(registry);
  return entry;
}

/** Per-vehicle custom photograph (overrides the category image when present). */
export function saveVehicleImage(vehicleId: string, payload: { data: string; fileName?: string }) {
  const id = String(vehicleId || "").trim();
  if (!id) throw Object.assign(new Error("vehicleId is required"), { status: 400, code: "MISSING_VEHICLE_ID" });

  const buffer = decodeBase64Payload(payload.data);
  if (!buffer.length) throw Object.assign(new Error("Empty image payload"), { status: 400, code: "EMPTY_PAYLOAD" });
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error(`Image exceeds the ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB limit`), {
      status: 413,
      code: "IMAGE_TOO_LARGE",
    });
  }

  const ext = (path.extname(payload.fileName || "") || ".png").toLowerCase();
  if (!ALLOWED_IMAGE_EXT[ext]) {
    throw Object.assign(new Error(`Unsupported image format '${ext}'`), { status: 415, code: "UNSUPPORTED_FORMAT" });
  }

  const dir = path.join(resolveUploadRoot(), "vehicles");
  fs.mkdirSync(dir, { recursive: true });
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith(`${safeId}.`)) fs.unlinkSync(path.join(dir, file));
  }

  fs.writeFileSync(path.join(dir, `${safeId}${ext}`), buffer);

  const registry = readManifest();
  registry.vehicles[id] = {
    url: `${PUBLIC_PREFIX}/vehicles/${safeId}${ext}`,
    originalFileName: payload.fileName,
    updatedAt: new Date().toISOString(),
  };
  writeManifest(registry);
  return registry.vehicles[id];
}

export function removeVehicleImage(vehicleId: string) {
  const id = String(vehicleId || "").trim();
  const registry = readManifest();
  const existing = registry.vehicles[id];
  if (existing) {
    const rel = existing.url.replace(`${PUBLIC_PREFIX}/`, "");
    const target = path.join(resolveUploadRoot(), rel);
    if (fs.existsSync(target)) fs.unlinkSync(target);
    delete registry.vehicles[id];
    writeManifest(registry);
  }
  return { success: true };
}

export const VEHICLE_ASSET_LIMITS = { MAX_IMAGE_BYTES, MAX_MODEL_BYTES, PUBLIC_PREFIX };
