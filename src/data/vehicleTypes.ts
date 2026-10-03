/**
 * EJAZ Transport — Central Vehicle Type System
 * Strictly 4 Approved Fleet Categories:
 * 1. Flatbed (سطحة)
 * 2. Refrigerated (براد)
 * 3. Dry (جاف)
 * 4. Curtainsider (ستارة)
 *
 * All modules (Web Console, Mobile App, Backend, 3D Engine, GPS, Reports)
 * must resolve through this single source of truth.
 */

export type CanonicalVehicleTypeId = "flatbed" | "reefer" | "dry" | "curtain";
export type CanonicalVehicleTypeAr = "سطحة" | "براد" | "جاف" | "ستارة";

export interface VehicleTypeMeta {
  id: CanonicalVehicleTypeId;
  arabicName: CanonicalVehicleTypeAr;
  englishName: string;
  categoryCode: string;
  officialImage: string;
  glbPath: string;
  descriptionAr: string;
  descriptionEn: string;
  maxPayloadTons: number;
  typicalCargoAr: string;
  typicalCargoEn: string;
  accentColor: string;
  badgeBg: string;
  featuresAr: string[];
  featuresEn: string[];
}

export const APPROVED_VEHICLE_TYPES: Record<CanonicalVehicleTypeId, VehicleTypeMeta> = {
  flatbed: {
    id: "flatbed",
    arabicName: "سطحة",
    englishName: "Flatbed",
    categoryCode: "EJ-FLAT",
    officialImage: "/images/trucks/official/official-flatbed.png",
    glbPath: "/models/trucks/flatbed.glb",
    descriptionAr: "شاحنة مسطحة ثقيلة مخصصة لنقل الحديد، المعدات الإنشائية، والكتل الصناعية الثقيلة مع نقاط تثبيت معتمدة.",
    descriptionEn: "Heavy-duty flatbed trailer engineered for structural steel, machinery, and oversize industrial consignments.",
    maxPayloadTons: 32.0,
    typicalCargoAr: "حديد تسليح، كتل خرسانية، معدات بترولية وإنشائية",
    typicalCargoEn: "Rebar, machinery, coils, precast concrete & industrial modules",
    accentColor: "#F5B73C",
    badgeBg: "rgba(245, 183, 60, 0.16)",
    featuresAr: ["سطح فولاذي مقاوم للانزلاق", "ركائز تثبيت جانبية هيدروليكية", "أحزمة سحب عالية المتانة معتمدة"],
    featuresEn: ["Anti-skid reinforced deck", "Heavy tie-down stake pockets", "Certified high-tensile ratchet lashing"],
  },
  reefer: {
    id: "reefer",
    arabicName: "براد",
    englishName: "Refrigerated",
    categoryCode: "EJ-REEF",
    officialImage: "/images/trucks/official/official-reefer.png",
    glbPath: "/models/trucks/refrigerated.glb",
    descriptionAr: "شاحنة تبريد وتجميد معزولة حراريًا مع حساسات IoT لمراقبة درجات الحرارة لحظيًا لضمان سلامة الأغذية والأدوية.",
    descriptionEn: "Multi-temperature insulated refrigerated trailer with continuous IoT telemetry for cold-chain integrity.",
    maxPayloadTons: 24.0,
    typicalCargoAr: "منتجات ألبان طازجة، لحوم وأسماك مجمدة، أدوية ومستحضرات طبية",
    typicalCargoEn: "Dairy products, frozen meats, pharmaceuticals & temperature-sensitive foods",
    accentColor: "#2F80FF",
    badgeBg: "rgba(47, 128, 255, 0.16)",
    featuresAr: ["وحدة تبريد Carrier/ThermoKing", "عوازل بولي يوريثان حرارية سماكة 80 مم", "حساسات حرارة ورطوبة سحابية دقيقة"],
    featuresEn: ["ThermoKing independent cooling unit", "80mm high-density polyurethane insulation", "Dual-zone IoT temperature loggers"],
  },
  dry: {
    id: "dry",
    arabicName: "جاف",
    englishName: "Dry",
    categoryCode: "EJ-DRY",
    officialImage: "/images/trucks/official/official-dry.png",
    glbPath: "/models/trucks/dry.glb",
    descriptionAr: "صندوق جاف مغلق بالكامل ومحكم الإغلاق لحماية البضائع المعبأة والسلع الاستهلاكية والإلكترونيات من الرطوبة والغبار.",
    descriptionEn: "Fully enclosed dry box trailer protecting palletized general merchandise and high-value cargo from elements.",
    maxPayloadTons: 26.0,
    typicalCargoAr: "أجهزة كهربائية، أطعمة مجففة ومعلبات، ملابس ومواد تغليف",
    typicalCargoEn: "FMCG, electronics, packaged dry foods, retail consumer goods",
    accentColor: "#2FD08A",
    badgeBg: "rgba(47, 208, 138, 0.16)",
    featuresAr: ["جدران مركبة صلبة مضادة للصدمات", "أقفال أمنية رقمية مع أختام جمركية", "نظام تهوية لمنع تكثف الرطوبة"],
    featuresEn: ["Composite impact-resistant side panels", "Dual cam-lock security doors with tamper seals", "Anti-condensation ventilation system"],
  },
  curtain: {
    id: "curtain",
    arabicName: "ستارة",
    englishName: "Curtainsider",
    categoryCode: "EJ-CURT",
    officialImage: "/images/trucks/official/official-curtain.png",
    glbPath: "/models/trucks/curtainsider.glb",
    descriptionAr: "شاحنة ستائر جانبية قابلة للفتح السريع تتيح التحميل والتفريغ الجانبي بالرافعات الشوكية للبضائع العامة والباليتات.",
    descriptionEn: "Curtainsider trailer offering rapid side-forklift access for fast turnaround of palletized freight.",
    maxPayloadTons: 25.0,
    typicalCargoAr: "بضائع باليتات قياسية، سلع تجارية، كراتين ومواد بناء خفيفة",
    typicalCargoEn: "Standard euro/industrial pallets, commercial goods, paper & beverage packs",
    accentColor: "#FF7A00",
    badgeBg: "rgba(255, 122, 0, 0.16)",
    featuresAr: ["قماش PVC صناعي مقوى مقاوم للعوامل الجوية", "سكة سحب جانبية سلسة للتحميل السريع", "أعمدة وسطية قابلة للإزالة للقطع الطويلة"],
    featuresEn: ["Weatherproof high-density PVC curtain", "Smooth roller-bearing tensioning runners", "Removable middle pillars for oversize loading"],
  },
};

export const APPROVED_VEHICLE_TYPES_LIST: VehicleTypeMeta[] = [
  APPROVED_VEHICLE_TYPES.flatbed,
  APPROVED_VEHICLE_TYPES.reefer,
  APPROVED_VEHICLE_TYPES.dry,
  APPROVED_VEHICLE_TYPES.curtain,
];

/**
 * Baseline official imagery for the 4 approved categories.
 * These are the shipped defaults; the server-side Vehicle Asset Registry
 * supersedes them the moment an official asset is published, and every screen
 * resolves through that registry so the app and the console stay identical.
 */
export const DEFAULT_VEHICLE_IMAGES: Record<
  CanonicalVehicleTypeId,
  { ar: string; en: string; code: string; image: string; modelPath: string }
> = {
  flatbed: {
    ar: "سطحة",
    en: "Flatbed",
    code: "EJ-FLAT",
    image: "/images/trucks/official/official-flatbed.png",
    modelPath: "/models/trucks/flatbed.glb",
  },
  reefer: {
    ar: "براد",
    en: "Refrigerated",
    code: "EJ-REEF",
    image: "/images/trucks/official/official-reefer.png",
    modelPath: "/models/trucks/refrigerated.glb",
  },
  dry: {
    ar: "جاف",
    en: "Dry Van",
    code: "EJ-DRY",
    image: "/images/trucks/official/official-dry.png",
    modelPath: "/models/trucks/dry.glb",
  },
  curtain: {
    ar: "ستارة",
    en: "Curtainsider",
    code: "EJ-CURT",
    image: "/images/trucks/official/official-curtain.png",
    modelPath: "/models/trucks/curtainsider.glb",
  },
};

/**
 * Safe Migration and Normalizer
 * Guarantees that any legacy or external vehicle type string
 * safely maps to one of the 4 canonical types without data loss.
 */
export function normalizeVehicleType(raw: string | null | undefined): CanonicalVehicleTypeId {
  if (!raw) return "curtain";
  const s = String(raw).trim().toLowerCase();

  // 1. Flatbed matches
  if (
    s === "flatbed" ||
    s === "سطحة" ||
    s === "مسطحة" ||
    s === "مسطّحة" ||
    s === "tipper" || // Safe mapping for legacy tippers
    s === "قلاب" ||
    s === "قلّاب" ||
    s.includes("flat") ||
    s.includes("سطح")
  ) {
    return "flatbed";
  }

  // 2. Refrigerated matches
  if (
    s === "reefer" ||
    s === "براد" ||
    s === "ثلاجة" ||
    s === "ثلاجه" ||
    s === "مبرّد" ||
    s === "تبريد" ||
    s === "refrigerated" ||
    s === "chilled" ||
    s.includes("reef") ||
    s.includes("برد") ||
    s.includes("ثلاج") ||
    s.includes("ثلج")
  ) {
    return "reefer";
  }

  // 3. Dry matches
  if (
    s === "dry" ||
    s === "جاف" ||
    s === "مغلق" ||
    s === "box" ||
    s === "dry van" ||
    s === "tanker" || // Safe mapping for legacy tankers
    s === "صهريج" ||
    s === "وقود" ||
    s === "liquids" ||
    s.includes("dry") ||
    s.includes("جاف")
  ) {
    return "dry";
  }

  // 4. Curtainsider matches
  if (
    s === "curtain" ||
    s === "ستارة" ||
    s === "ستائر" ||
    s === "curtainsider" ||
    s === "curtain-sider" ||
    s === "container" || // Safe mapping for container trailers
    s === "حاوية" ||
    s === "حاويات" ||
    s.includes("curt") ||
    s.includes("ستار")
  ) {
    return "curtain";
  }

  // Default fallback to Curtainsider
  return "curtain";
}

/**
 * Translates canonical type ID to Arabic display name
 */
export function getVehicleTypeAr(type: string | null | undefined): CanonicalVehicleTypeAr {
  const norm = normalizeVehicleType(type);
  return APPROVED_VEHICLE_TYPES[norm].arabicName;
}

/**
 * Translates canonical type ID to English display name
 */
export function getVehicleTypeEn(type: string | null | undefined): string {
  const norm = normalizeVehicleType(type);
  return APPROVED_VEHICLE_TYPES[norm].englishName;
}

/**
 * Get full metadata for any type input
 */
export function getVehicleTypeMeta(type: string | null | undefined): VehicleTypeMeta {
  const norm = normalizeVehicleType(type);
  return APPROVED_VEHICLE_TYPES[norm];
}

/**
 * Returns the Official Reference Image for a given vehicle category
 */
export function getVehicleOfficialImage(type: string | null | undefined): string {
  const meta = getVehicleTypeMeta(type);
  return meta.officialImage;
}

/**
 * Resolves the display image for a vehicle:
 * Returns the vehicle's custom image if present,
 * otherwise falls back strictly to the official category image.
 */
export function resolveVehicleImage(vehicle?: {
  body: CanonicalVehicleTypeId;
  customImage?: string | null;
} | null): string {
  if (!vehicle) return APPROVED_VEHICLE_TYPES.curtain.officialImage;
  if (vehicle.customImage && vehicle.customImage.trim().length > 0) {
    return vehicle.customImage;
  }
  return getVehicleOfficialImage(vehicle.body);
}
