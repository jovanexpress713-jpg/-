/**
 * EJAZ Transport — Tariff & Pricing Engine
 *
 * A price is NEVER a fixed global number: it is resolved from the company's
 * tariff book by (truck type + route + distance band + weight band + validity
 * window). This service owns validation, conflict prevention and matching.
 * The storage itself lives in the central database layer (`db.tariffs`).
 */

import { normalizeVehicleType, APPROVED_VEHICLE_TYPES_LIST, type CanonicalVehicleTypeAr } from "../../data/vehicleTypes";
import { computeRoadDistance, normalizeCityName, resolveCity } from "./cityRegistry";

export const OFFICIAL_TRUCK_TYPES_AR: CanonicalVehicleTypeAr[] = ["براد", "سطحة", "جاف", "ستارة"];

export type WeightUnit = "TON" | "KG";
export type TariffStatus = "ACTIVE" | "INACTIVE";

export interface TariffEntity {
  id: string;
  truckType: CanonicalVehicleTypeAr;
  originCity: string; // canonical Arabic city name
  destinationCity: string;
  minDistanceKm: number;
  /** null = no upper bound (open-ended band). */
  maxDistanceKm: number | null;
  minWeight: number;
  maxWeight: number | null;
  weightUnit: WeightUnit;
  price: number;
  currency: string;
  status: TariffStatus;
  /** Inclusive validity window (ISO date strings). */
  validFrom: string;
  validTo: string | null;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TariffChangeRecord {
  id: string;
  tariffId: string;
  userId?: string;
  userName: string;
  userRole?: string;
  action: "CREATED" | "UPDATED" | "DEACTIVATED" | "ACTIVATED";
  oldPrice?: number;
  newPrice?: number;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason?: string;
  timestamp: string;
}

export interface QuoteRequestEntity {
  id: string;
  truckType: string;
  originCity: string;
  destinationCity: string;
  weightTons: number;
  distanceKm: number | null;
  status: "OPEN" | "RESOLVED" | "CLOSED";
  requestedById?: string;
  requestedByName?: string;
  customerId?: string;
  note?: string;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface TariffInput {
  truckType?: string;
  originCity?: string;
  destinationCity?: string;
  minDistanceKm?: number | string;
  maxDistanceKm?: number | string | null;
  minWeight?: number | string;
  maxWeight?: number | string | null;
  weightUnit?: string;
  price?: number | string;
  currency?: string;
  status?: string;
  validFrom?: string;
  validTo?: string | null;
  notes?: string;
}

/** Converts a weight expressed in the tariff's unit into tons. */
export function toTons(value: number, unit: WeightUnit): number {
  return unit === "KG" ? value / 1000 : value;
}

/** Band boundaries of a tariff expressed in tons, for matching & conflict checks. */
function weightBandTons(t: Pick<TariffEntity, "minWeight" | "maxWeight" | "weightUnit">): { min: number; max: number | null } {
  return { min: toTons(t.minWeight, t.weightUnit), max: t.maxWeight === null ? null : toTons(t.maxWeight, t.weightUnit) };
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

/**
 * Validates a tariff payload. Returns a normalized entity fragment or a clear
 * Arabic/English error (400-class) explaining exactly what is wrong.
 */
export function validateTariffInput(input: TariffInput): { ok: true; value: Omit<TariffEntity, "id" | "createdBy" | "createdAt" | "updatedAt"> } | { ok: false; errorAr: string; errorEn: string } {
  const fail = (errorAr: string, errorEn: string) => ({ ok: false as const, errorAr, errorEn });

  // Strict allow-list: ONLY the 4 official categories (no legacy remapping —
  // a «قلاب» or «صهريج» must be rejected, never silently converted).
  const rawType = String(input.truckType || "").trim();
  const typeMeta = APPROVED_VEHICLE_TYPES_LIST.find(
    (m) =>
      m.arabicName === rawType ||
      m.id === rawType.toLowerCase() ||
      m.englishName.toLowerCase() === rawType.toLowerCase()
  );
  if (!rawType || !typeMeta) {
    return fail(
      `نوع الشاحنة «${input.truckType || ""}» غير معتمد. الأنواع المسموحة فقط: ${OFFICIAL_TRUCK_TYPES_AR.join("، ")}`,
      `Truck type “${input.truckType || ""}” is not approved. Allowed: ${OFFICIAL_TRUCK_TYPES_AR.join(", ")}`
    );
  }

  const origin = resolveCity(input.originCity);
  if (!origin) {
    return fail(
      `مدينة/منطقة الانطلاق «${input.originCity || ""}» غير موجودة في سجل المدن المعتمد`,
      `Origin city “${input.originCity || ""}” is not in the official city registry`
    );
  }
  const destination = resolveCity(input.destinationCity);
  if (!destination) {
    return fail(
      `مدينة/منطقة الوصول «${input.destinationCity || ""}» غير موجودة في سجل المدن المعتمد`,
      `Destination city “${input.destinationCity || ""}” is not in the official city registry`
    );
  }
  if (origin.id === destination.id) {
    return fail("مدينة الانطلاق والوصول متطابقتان — التعرفة تتطلب مسارًا بين مدينتين مختلفتين", "Origin and destination resolve to the same city — a tariff needs a real corridor");
  }

  const minDistanceKm = Number(input.minDistanceKm);
  const maxDistanceKm = input.maxDistanceKm === null || input.maxDistanceKm === undefined || input.maxDistanceKm === "" ? null : Number(input.maxDistanceKm);
  if (!Number.isFinite(minDistanceKm) || minDistanceKm < 0) {
    return fail("الحد الأدنى للمسافة يجب أن يكون رقمًا موجبًا أو صفرًا", "Minimum distance must be a non-negative number");
  }
  if (maxDistanceKm !== null && (!Number.isFinite(maxDistanceKm) || maxDistanceKm <= minDistanceKm)) {
    return fail("الحد الأعلى للمسافة يجب أن يكون أكبر من الحد الأدنى", "Maximum distance must be greater than the minimum");
  }

  const weightUnit: WeightUnit = String(input.weightUnit || "TON").toUpperCase() === "KG" ? "KG" : "TON";
  const minWeight = Number(input.minWeight);
  const maxWeight = input.maxWeight === null || input.maxWeight === undefined || input.maxWeight === "" ? null : Number(input.maxWeight);
  if (!Number.isFinite(minWeight) || minWeight < 0) {
    return fail("الحد الأدنى للوزن يجب أن يكون رقمًا موجبًا أو صفرًا", "Minimum weight must be a non-negative number");
  }
  if (maxWeight !== null && (!Number.isFinite(maxWeight) || maxWeight <= minWeight)) {
    return fail("الحد الأعلى للوزن يجب أن يكون أكبر من الحد الأدنى", "Maximum weight must be greater than the minimum");
  }

  const price = Number(input.price);
  if (!Number.isFinite(price) || price <= 0) {
    return fail("السعر يجب أن يكون رقمًا موجبًا", "Price must be a positive number");
  }

  const currency = String(input.currency || "SAR").toUpperCase();
  const status: TariffStatus = String(input.status || "ACTIVE").toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";

  const validFrom = input.validFrom ? String(input.validFrom) : new Date().toISOString().slice(0, 10);
  if (!isValidDate(validFrom)) {
    return fail("تاريخ بداية السعر غير صالح", "The tariff start date is invalid");
  }
  const validTo = input.validTo ? String(input.validTo) : null;
  if (validTo !== null && (!isValidDate(validTo) || new Date(validTo).getTime() < new Date(validFrom).getTime())) {
    return fail("تاريخ نهاية السعر يجب أن يكون بعد تاريخ البداية", "The tariff end date must be after its start date");
  }

  return {
    ok: true,
    value: {
      truckType: typeMeta.arabicName,
      originCity: origin.ar,
      destinationCity: destination.ar,
      minDistanceKm,
      maxDistanceKm,
      minWeight,
      maxWeight,
      weightUnit,
      price,
      currency,
      status,
      validFrom,
      validTo,
      notes: input.notes ? String(input.notes).trim() : undefined,
    },
  };
}

/**
 * Band convention (matches the spec wording «أكثر من ٥ إلى ١٠ طن»):
 * the LOWER bound is exclusive (except 0 = "from zero") and the UPPER bound is
 * inclusive — so adjacent bands like 0–5 and 5–10 never overlap.
 */
export function bandContains(min: number, max: number | null, value: number): boolean {
  const aboveMin = min === 0 ? value >= 0 : value > min;
  const belowMax = max === null || value <= max;
  return aboveMin && belowMax;
}

/** Overlap test between two (min, max] bands (null max = ∞). */
function rangesOverlap(aMin: number, aMax: number | null, bMin: number, bMax: number | null): boolean {
  const aMaxEff = aMax === null ? Infinity : aMax;
  const bMaxEff = bMax === null ? Infinity : bMax;
  return aMaxEff > bMin && bMaxEff > aMin;
}

function dateWindowsOverlap(aFrom: string, aTo: string | null, bFrom: string, bTo: string | null): boolean {
  const aFromT = new Date(aFrom).getTime();
  const aToT = aTo ? new Date(aTo).getTime() : Infinity;
  const bFromT = new Date(bFrom).getTime();
  const bToT = bTo ? new Date(bTo).getTime() : Infinity;
  return aFromT <= bToT && bFromT <= aToT;
}

export interface TariffConflict {
  conflictingTariff: TariffEntity;
  reasonAr: string;
  reasonEn: string;
}

/**
 * Conflict rule (§4): no two ACTIVE tariffs may produce more than one price
 * for the same (type + route + distance band + weight band + time window).
 * INACTIVE tariffs are dormant — they are re-checked when reactivated.
 */
export function findTariffConflict(
  all: TariffEntity[],
  candidate: Pick<TariffEntity, "truckType" | "originCity" | "destinationCity" | "minDistanceKm" | "maxDistanceKm" | "minWeight" | "maxWeight" | "weightUnit" | "validFrom" | "validTo">,
  excludeId?: string
): TariffConflict | null {
  const candWeight = weightBandTons(candidate);
  for (const t of all) {
    if (excludeId && t.id === excludeId) continue;
    if (t.status !== "ACTIVE") continue;
    if (t.truckType !== candidate.truckType) continue;
    if (normalizeCityName(t.originCity) !== normalizeCityName(candidate.originCity)) continue;
    if (normalizeCityName(t.destinationCity) !== normalizeCityName(candidate.destinationCity)) continue;
    if (!rangesOverlap(t.minDistanceKm, t.maxDistanceKm, candidate.minDistanceKm, candidate.maxDistanceKm)) continue;
    const tw = weightBandTons(t);
    if (!rangesOverlap(tw.min, tw.max, candWeight.min, candWeight.max)) continue;
    if (!dateWindowsOverlap(t.validFrom, t.validTo, candidate.validFrom, candidate.validTo)) continue;

    return {
      conflictingTariff: t,
      reasonAr:
        `تعارض مع تعرفة قائمة نشطة (${t.id}): نفس النوع «${t.truckType}» والمسار ${t.originCity} ← ${t.destinationCity} ` +
        `مع تداخل في نطاق المسافة (${t.minDistanceKm}–${t.maxDistanceKm ?? "∞"} كم) والوزن (${t.minWeight}–${t.maxWeight ?? "∞"} ${t.weightUnit === "KG" ? "كجم" : "طن"}) والفترة الزمنية. ` +
        `أوقف التعرفة القديمة أولًا أو عدّل النطاقات.`,
      reasonEn:
        `Conflicts with active tariff ${t.id}: same type “${t.truckType}” and route ${t.originCity}→${t.destinationCity} ` +
        `with overlapping distance (${t.minDistanceKm}–${t.maxDistanceKm ?? "∞"} km), weight (${t.minWeight}–${t.maxWeight ?? "∞"} ${t.weightUnit}) and validity window.`,
    };
  }
  return null;
}

export interface QuoteQuery {
  truckType: string;
  originCity: string;
  destinationCity: string;
  weightTons: number;
  /** Optional explicit date for the validity check (defaults to now). */
  at?: string;
}

export interface QuoteResult {
  available: boolean;
  distanceResolvable: boolean;
  distanceKm: number | null;
  distanceReasonAr?: string;
  distanceReasonEn?: string;
  tariff?: TariffEntity;
  price?: number;
  currency?: string;
  matchedWeightTons?: number;
  candidates?: number;
}

/**
 * Dynamic price resolution (§5-§7): (type + route + computed distance + weight)
 * → exactly one active tariff, or an honest "no tariff" answer. Never invents.
 */
export function resolveQuote(all: TariffEntity[], query: QuoteQuery): QuoteResult {
  const distance = computeRoadDistance(query.originCity, query.destinationCity);
  if (!distance.resolvable || distance.distanceKm === null) {
    return { available: false, distanceResolvable: false, distanceKm: null, distanceReasonAr: distance.reasonAr, distanceReasonEn: distance.reasonEn };
  }

  const typeNorm = normalizeVehicleType(query.truckType || "");
  const weightTons = Number(query.weightTons) || 0;
  const at = query.at ? new Date(query.at).getTime() : Date.now();

  const candidates = all.filter((t) => {
    if (t.status !== "ACTIVE") return false;
    if (normalizeVehicleType(t.truckType) !== typeNorm) return false;
    if (normalizeCityName(t.originCity) !== normalizeCityName(distance.originCity!.ar)) return false;
    if (normalizeCityName(t.destinationCity) !== normalizeCityName(distance.destinationCity!.ar)) return false;
    if (!bandContains(t.minDistanceKm, t.maxDistanceKm, distance.distanceKm!)) return false;
    const band = weightBandTons(t);
    if (!bandContains(band.min, band.max, weightTons)) return false;
    const fromT = new Date(t.validFrom).getTime();
    const toT = t.validTo ? new Date(t.validTo).getTime() : Infinity;
    return at >= fromT && at <= toT;
  });

  if (candidates.length === 0) {
    return { available: false, distanceResolvable: true, distanceKm: distance.distanceKm, candidates: 0 };
  }

  // Deterministic pick when bands are strictly managed: the narrowest distance
  // band wins, then the narrowest weight band — the most specific tariff.
  const span = (min: number, max: number | null) => (max === null ? Infinity : max - min);
  candidates.sort((a, b) => {
    const da = span(a.minDistanceKm, a.maxDistanceKm) - span(b.minDistanceKm, b.maxDistanceKm);
    if (da !== 0) return da;
    const wa = weightBandTons(a);
    const wb = weightBandTons(b);
    return span(wa.min, wa.max) - span(wb.min, wb.max);
  });

  const tariff = candidates[0];
  return {
    available: true,
    distanceResolvable: true,
    distanceKm: distance.distanceKm,
    tariff,
    price: tariff.price,
    currency: tariff.currency,
    matchedWeightTons: weightTons,
    candidates: candidates.length,
  };
}
