import { useMemo } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import type { Trip } from "../state/fleetStore";
import {
  IconPin,
} from "./Icons";

interface Operational3DSceneProps {
  trip: Trip;
  className?: string;
}

export function Operational3DScene({ trip, className }: Operational3DSceneProps) {
  const { t } = useSettings();

  // Determine authoritative operational state derived purely from backend trip status
  const sceneState = useMemo(() => {
    switch (trip.status) {
      case "loading":
      case "planning":
        return {
          key: "LOADING",
          titleAr: "مشهد ساحة التحميل المركزية والوزن",
          titleEn: "Central Yard Loading & Axle Weighing Scene",
          stageAr: "جاري رص وتأمين الشحنة ومطابقة الأوزان",
          stageEn: "Pallet loading, strap tie-down & weighbridge check",
          badgeColor: "#FF7A00",
          iconColor: "text-brand",
        };
      case "arrived":
        return {
          key: "AT_PORT",
          titleAr: "مشهد وصول الميناء / رصيف البضائع",
          titleEn: "Port Terminal & Cargo Berth Arrival Scene",
          stageAr: "وصول بوابة الميناء وإنهاء الفحص الجمركي",
          stageEn: "Gate clearance & customs inspection completed",
          badgeColor: "#2F80FF",
          iconColor: "text-accent-2",
        };
      case "delivered":
      case "completed":
        return {
          key: "DELIVERED",
          titleAr: "مشهد تسليم الشحنة وتوقيع بوليصة الاستلام",
          titleEn: "Cargo Handover & Recipient Sign-off Scene",
          stageAr: "تم التفريغ وتوثيق إثبات التسليم الإلكتروني POD",
          stageEn: "Cargo unloaded and digital POD signed",
          badgeColor: "#2FD08A",
          iconColor: "text-status-active",
        };
      case "cancelled":
        return {
          key: "CANCELLED",
          titleAr: "مشهد تجميد الحركة - رحلة ملغاة",
          titleEn: "Operation Suspended - Cancelled Trip",
          stageAr: "تم إيقاف حركة المركبة وإلغاء أمر التكليف",
          stageEn: "Vehicle halted; dispatch order formally cancelled",
          badgeColor: "#FF5A6E",
          iconColor: "text-status-danger",
        };
      case "on_road":
      default:
        return {
          key: "IN_TRANSIT",
          titleAr: "مشهد السفر المباشر على الطريق السريع",
          titleEn: "Live Highway Express Transit Scene",
          stageAr: `إبحار بسرعة ${trip.speedKmH} كم/س عبر الممر اللوجستي`,
          stageEn: `Cruising at ${trip.speedKmH} km/h along logistics artery`,
          badgeColor: "#2FD08A",
          iconColor: "text-status-active",
        };
    }
  }, [trip.status, trip.speedKmH]);

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-[14px] bg-[#060F1E] border border-border-subtle p-5 flex flex-col justify-between select-none text-white",
        className
      )}
    >
      {/* 3D Perspective Grid Background */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(47, 128, 255, 0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(47, 128, 255, 0.25) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          transform: "perspective(300px) rotateX(25deg)",
          transformOrigin: "bottom center",
        }}
      />

      {/* Top Banner */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-3 w-3 rounded-full animate-ping"
            style={{ backgroundColor: sceneState.badgeColor }}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[14px] text-white tracking-wide">
                {t(sceneState.titleEn, sceneState.titleAr)}
              </span>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                style={{ backgroundColor: `${sceneState.badgeColor}22`, color: sceneState.badgeColor }}
              >
                {sceneState.key}
              </span>
            </div>
            <div className="text-[11.5px] text-white/60 mt-0.5">
              {t(sceneState.stageEn, sceneState.stageAr)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-[8px] bg-navy px-3 py-1.5 border border-white/10 text-[11px] tabular-nums">
          <span className="text-brand font-semibold">{trip.tripNumber}</span>
          <span className="text-white/40">·</span>
          <span>{trip.cargoType}</span>
          <span className="text-white/40">·</span>
          <span>{trip.cargoWeightTons} t</span>
        </div>
      </div>

      {/* Center 3D Isometric Animated Visual Stage */}
      <div className="relative z-10 flex-1 flex items-center justify-center py-6">
        <div className="relative flex flex-col items-center">
          {/* Isometric Shadow */}
          <div className="h-10 w-64 rounded-full bg-black/60 blur-md translate-y-8" />

          {/* Isometric Truck Visualization */}
          <div className="relative z-10 transition-transform duration-500 hover:scale-105">
            <svg width="220" height="110" viewBox="0 0 220 110" fill="none" className="drop-shadow-2xl">
              {/* Ground road marker */}
              <path d="M10 95 L210 95" stroke="#294160" strokeWidth="3" strokeDasharray="8 6" />

              {/* Trailer Box */}
              <rect x="25" y="25" width="115" height="52" rx="4" fill="#0D1B2F" stroke="#294160" strokeWidth="2.5" />
              <rect x="30" y="30" width="105" height="42" rx="2" fill="#122238" />

              {/* EJAZ Brand Decal on Trailer */}
              <text x="82" y="56" fill="#FF7A00" fontSize="14" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
                EJAZ إيجاز
              </text>
              <line x1="45" y1="62" x2="120" y2="62" stroke="#FF7A00" strokeWidth="1.5" strokeOpacity="0.6" />

              {/* Tractor Cabin */}
              <path d="M142 42 L168 42 L185 62 L185 77 L142 77 Z" fill="#FF7A00" stroke="#0A1931" strokeWidth="2" />
              {/* Cabin Windshield */}
              <path d="M165 46 L178 60 L158 60 L158 46 Z" fill="#0A1931" />
              {/* Headlights */}
              <circle cx="183" cy="72" r="3" fill="#FFFFFF" />

              {/* Heavy Duty Wheels */}
              <circle cx="45" cy="79" r="10" fill="#050C1A" stroke="#46566F" strokeWidth="2.5" />
              <circle cx="70" cy="79" r="10" fill="#050C1A" stroke="#46566F" strokeWidth="2.5" />
              <circle cx="120" cy="79" r="10" fill="#050C1A" stroke="#46566F" strokeWidth="2.5" />
              <circle cx="170" cy="79" r="10" fill="#050C1A" stroke="#46566F" strokeWidth="2.5" />
              {/* Wheel Rims */}
              <circle cx="45" cy="79" r="4" fill="#FF7A00" />
              <circle cx="70" cy="79" r="4" fill="#FF7A00" />
              <circle cx="120" cy="79" r="4" fill="#FF7A00" />
              <circle cx="170" cy="79" r="4" fill="#FF7A00" />
            </svg>
          </div>

          {/* Operational Floating Status Badge */}
          <div className="mt-4 flex items-center gap-2 rounded-full bg-navy/90 px-4 py-1.5 border border-white/10 text-[12px] font-semibold text-white/90 backdrop-blur-md">
            <IconPin size={14} className="text-brand" />
            <span>{trip.originCity}</span>
            <span className="text-brand">→</span>
            <span>{trip.destinationCity}</span>
            <span className="text-white/40">|</span>
            <span className="text-status-active tabular-nums">{trip.speedKmH} {t("km/h", "كم/س")}</span>
          </div>
        </div>
      </div>

      {/* Bottom Operational Telemetry Deck */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-3 border-t border-white/10 text-[11.5px]">
        <div className="rounded-[8px] bg-surface-2 p-2.5 border border-white/5">
          <div className="text-white/50 text-[10px]">{t("Corridor", "الممر اللوجستي")}</div>
          <div className="font-semibold text-white truncate mt-0.5">{trip.corridorKey}</div>
        </div>
        <div className="rounded-[8px] bg-surface-2 p-2.5 border border-white/5">
          <div className="text-white/50 text-[10px]">{t("Cargo Load", "حمولة البضاعة")}</div>
          <div className="font-semibold text-brand tabular-nums mt-0.5">{trip.cargoWeightTons} / {trip.maxCapacityTons} طن</div>
        </div>
        <div className="rounded-[8px] bg-surface-2 p-2.5 border border-white/5">
          <div className="text-white/50 text-[10px]">{t("Est. Remaining", "المسافة المتبقية")}</div>
          <div className="font-semibold text-status-active tabular-nums mt-0.5">{trip.distanceRemainingKm} كم ({trip.etaMinutes} د)</div>
        </div>
        <div className="rounded-[8px] bg-surface-2 p-2.5 border border-white/5">
          <div className="text-white/50 text-[10px]">{t("Next Station", "المحطة التالية")}</div>
          <div className="font-semibold text-white truncate mt-0.5">{trip.nextWaypointAr}</div>
        </div>
      </div>
    </div>
  );
}
