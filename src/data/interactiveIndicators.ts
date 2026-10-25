import type { Vehicle } from "./types";
import { clampTelemetry, loadPercent, etaLabel } from "./vehicleReality";

export type FleetIndicatorKey = "speed" | "fuel" | "load" | "eta" | "engine" | "distance";
export type FleetIndicatorTone = "neutral" | "active" | "warning";

export interface FleetIndicator {
  key: FleetIndicatorKey;
  labelAr: string;
  labelEn: string;
  value: string;
  rawValue: number | null;
  unit: string;
  hintAr: string;
  hintEn: string;
  tone: FleetIndicatorTone;
  source: "VEHICLE_RECORD";
}

export interface FleetIndicatorSnapshot {
  vehicleId: string;
  indicators: FleetIndicator[];
  attentionCount: number;
  utilizationPercent: number;
}

function finite(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function buildFleetIndicatorSnapshot(vehicle: Vehicle): FleetIndicatorSnapshot {
  const speed = finite(vehicle.speed);
  const fuel = clampTelemetry(finite(vehicle.fuel));
  const load = loadPercent(vehicle);
  const engine = finite(vehicle.engineTemp);
  const distance = Math.max(0, finite(vehicle.milesLeft));
  const moving = vehicle.status === "active" && speed > 0;
  const attention = vehicle.status === "inactive" || fuel < 20 || engine > 105;

  return {
    vehicleId: vehicle.id,
    indicators: [
      {
        key: "speed",
        labelAr: "السرعة",
        labelEn: "Speed",
        value: `${Math.round(speed)} km/h`,
        rawValue: speed,
        unit: "km/h",
        hintAr: moving ? "الشاحنة تتحرك" : "الشاحنة متوقفة",
        hintEn: moving ? "Vehicle moving" : "Vehicle stopped",
        tone: moving ? "active" : "neutral",
        source: "VEHICLE_RECORD",
      },
      {
        key: "fuel",
        labelAr: "الوقود",
        labelEn: "Fuel",
        value: `${Math.round(fuel)}%`,
        rawValue: fuel,
        unit: "%",
        hintAr: fuel < 20 ? "وقود منخفض" : "المستوى الحالي",
        hintEn: fuel < 20 ? "Low fuel" : "Current level",
        tone: fuel < 20 ? "warning" : "neutral",
        source: "VEHICLE_RECORD",
      },
      {
        key: "load",
        labelAr: "الحمولة",
        labelEn: "Load",
        value: `${Math.round(load)}%`,
        rawValue: load,
        unit: "%",
        hintAr: `${vehicle.load} / ${vehicle.maxLoad} طن`,
        hintEn: `${vehicle.load} / ${vehicle.maxLoad} t`,
        tone: load >= 90 ? "warning" : "neutral",
        source: "VEHICLE_RECORD",
      },
      {
        key: "eta",
        labelAr: "الوصول",
        labelEn: "ETA",
        value: etaLabel(finite(vehicle.etaMinutes)),
        rawValue: finite(vehicle.etaMinutes),
        unit: "min",
        hintAr: "وقت الوصول المقدر",
        hintEn: "Estimated arrival",
        tone: "neutral",
        source: "VEHICLE_RECORD",
      },
      {
        key: "engine",
        labelAr: "المحرك",
        labelEn: "Engine",
        value: `${Math.round(engine)}°`,
        rawValue: engine,
        unit: "°",
        hintAr: attention ? "تحتاج متابعة" : "ضمن النطاق الحالي",
        hintEn: attention ? "Attention required" : "Within current range",
        tone: attention ? "warning" : "neutral",
        source: "VEHICLE_RECORD",
      },
      {
        key: "distance",
        labelAr: "المسافة",
        labelEn: "Distance",
        value: `${Math.round(distance)} mi`,
        rawValue: distance,
        unit: "mi",
        hintAr: "المتبقي من المسار",
        hintEn: "Remaining route",
        tone: "neutral",
        source: "VEHICLE_RECORD",
      },
    ],
    attentionCount: attention ? 1 : 0,
    utilizationPercent: load,
  };
}
