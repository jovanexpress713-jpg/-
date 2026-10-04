/**
 * EJAZ Transport — Saudi City Registry & Road Distance Engine
 *
 * Single source of truth for the cities the platform knows about and the
 * road distances between them. Coordinates are the real geographic centers of
 * the cities (the same registry already used by the frontend map in
 * `src/data/routes.ts`). The road distance is the great-circle distance
 * scaled by a calibrated road factor (1.12) so Riyadh↔Jeddah resolves to
 * ≈ 948 km — matching the real Highway 40 corridor — and every tariff match
 * works on a deterministic, system-owned distance instead of an invented one.
 */

export interface CityRecord {
  id: string;
  /** Canonical Arabic name (the system's canonical language). */
  ar: string;
  en: string;
  aliases: string[];
  lat: number;
  lng: number;
}

export const ROAD_FACTOR = 1.12;

export const KSA_CITIES: CityRecord[] = [
  { id: "riyadh", ar: "الرياض", en: "Riyadh", aliases: ["الرياض", "رياض"], lat: 24.7136, lng: 46.6753 },
  { id: "jeddah", ar: "جدة", en: "Jeddah", aliases: ["جده", "جدة"], lat: 21.4858, lng: 39.1925 },
  { id: "makkah", ar: "مكة المكرمة", en: "Makkah", aliases: ["مكة", "مكه المكرمة", "مكه", "mecca"], lat: 21.3891, lng: 39.8579 },
  { id: "madinah", ar: "المدينة المنورة", en: "Madinah", aliases: ["المدينة", "المدينه المنورة", "المدينه", "مدينة رسول الله", "medina"], lat: 24.5247, lng: 39.6125 },
  { id: "dammam", ar: "الدمام", en: "Dammam", aliases: ["دمام"], lat: 26.4207, lng: 50.0888 },
  { id: "khobar", ar: "الخبر", en: "Khobar", aliases: ["خبر", "العزيزية"], lat: 26.2172, lng: 50.1971 },
  { id: "dhahran", ar: "الظهران", en: "Dhahran", aliases: ["ظهران"], lat: 26.2361, lng: 50.0393 },
  { id: "jubail", ar: "الجبيل", en: "Jubail", aliases: ["الجبيل الصناعية", "الجبيل الصناعيه", "جبيل"], lat: 27.0046, lng: 50.1029 },
  { id: "khobar-ahsa", ar: "الهفوف", en: "Hofuf", aliases: ["هفوف", "الأحساء", "الاحساء", "المبرز"], lat: 25.3833, lng: 49.5833 },
  { id: "taif", ar: "الطائف", en: "Taif", aliases: ["طايف", "طائف"], lat: 21.2667, lng: 40.4167 },
  { id: "buraydah", ar: "بريدة", en: "Buraydah", aliases: ["بريده", "القصيم", "قصيم"], lat: 26.3283, lng: 43.9667 },
  { id: "hail", ar: "حائل", en: "Hail", aliases: ["هايل"], lat: 27.5167, lng: 41.7 },
  { id: "tabuk", ar: "تبوك", en: "Tabuk", aliases: [], lat: 28.3835, lng: 36.5667 },
  { id: "abha", ar: "أبها", en: "Abha", aliases: ["ابها", "أبها"], lat: 18.2167, lng: 42.5 },
  { id: "khamis", ar: "خميس مشيط", en: "Khamis Mushait", aliases: ["خميس مشيط", "خميس"], lat: 18.3, lng: 42.7333 },
  { id: "yanbu", ar: "ينبع", en: "Yanbu", aliases: ["ينبع الصناعية", "ينبع البحر"], lat: 24.0943, lng: 38.0636 },
  { id: "jazan", ar: "جازان", en: "Jazan", aliases: ["جيزان", "جازان"], lat: 16.8892, lng: 42.5611 },
  { id: "najran", ar: "نجران", en: "Najran", aliases: [], lat: 17.5713, lng: 44.2214 },
  { id: "neom", ar: "نيوم", en: "NEOM", aliases: ["نيوم"], lat: 28.0, lng: 35.4 },
  { id: "kharj", ar: "الخرج", en: "Kharj", aliases: ["خرج", "السيح"], lat: 24.1511, lng: 47.3076 },
  { id: "qaisumah", ar: "القيصومة", en: "Qaisumah", aliases: ["قيصومة", "حفر الباطن", "حفر الباطن"], lat: 28.6753, lng: 48.2578 },
  { id: "arar", ar: "عرعر", en: "Arar", aliases: ["عرعر"], lat: 30.9833, lng: 41.0167 },
  { id: "sakaka", ar: "سكاكا", en: "Sakaka", aliases: ["سكاكا", "الجوف"], lat: 29.9697, lng: 40.2064 },
  { id: "baha", ar: "الباحة", en: "Al Baha", aliases: ["باحة", "الباحة"], lat: 20.0128, lng: 41.4677 },
];

/** Normalizes Arabic/Latin city text for lossless matching. */
export function normalizeCityName(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .replace(/[\u064B-\u0652\u0640]/g, "") // diacritics + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة|ہ/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ئ/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Resolves free text (Arabic or English, with addresses around it) to a known city. */
export function resolveCity(input: string | null | undefined): CityRecord | null {
  const norm = normalizeCityName(input);
  if (!norm) return null;

  for (const city of KSA_CITIES) {
    if (norm === normalizeCityName(city.ar) || norm === normalizeCityName(city.en)) return city;
  }
  // Alias / containment pass: "جدة (الميناء الإسلامي)" still resolves to Jeddah.
  for (const city of KSA_CITIES) {
    const targets = [city.ar, city.en, ...city.aliases].map(normalizeCityName);
    if (targets.some((t) => t && (norm.includes(t) || t.includes(norm)))) return city;
  }
  return null;
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export interface DistanceResult {
  resolvable: boolean;
  distanceKm: number | null;
  originCity?: CityRecord;
  destinationCity?: CityRecord;
  reasonAr?: string;
  reasonEn?: string;
}

/** System-owned distance between two locations. Never invents a number. */
export function computeRoadDistance(origin: string, destination: string): DistanceResult {
  const a = resolveCity(origin);
  const b = resolveCity(destination);
  if (!a || !b) {
    return {
      resolvable: false,
      distanceKm: null,
      reasonAr: !a && !b
        ? "تعذر التعرف على مدينتي الانطلاق والوصول في سجل المدن"
        : !a
          ? `تعذر التعرف على مدينة الانطلاق «${origin}» في سجل المدن`
          : `تعذر التعرف على مدينة الوصول «${destination}» في سجل المدن`,
      reasonEn: `Unable to resolve ${!a && !b ? "both cities" : !a ? `origin “${origin}”` : `destination “${destination}”`} against the city registry`,
    };
  }
  if (a.id === b.id) {
    return { resolvable: true, distanceKm: 0, originCity: a, destinationCity: b };
  }
  const km = haversineKm(a.lat, a.lng, b.lat, b.lng) * ROAD_FACTOR;
  return {
    resolvable: true,
    distanceKm: Math.round(km / 5) * 5,
    originCity: a,
    destinationCity: b,
  };
}

/** Cities exposed to the UI dropdowns (Arabic canonical + English twin). */
export function listCities() {
  return KSA_CITIES.map((c) => ({ id: c.id, ar: c.ar, en: c.en }));
}
