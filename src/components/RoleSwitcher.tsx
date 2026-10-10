import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore, type Role } from "../state/fleetStore";
import {
  IconDriver,
  IconProfile,
  IconTruck,
  IconLayers,
} from "./Icons";

export function RoleSwitcher() {
  const { t } = useSettings();
  const { currentRole, setRole, trips, isSimulating, toggleSimulation } = useFleetStore();

  const ROLES: {
    id: Role;
    labelAr: string;
    labelEn: string;
    icon: typeof IconDriver;
    descAr: string;
    descEn: string;
  }[] = [
    {
      id: "admin",
      labelAr: "مدير العمليات",
      labelEn: "Fleet Admin",
      icon: IconLayers,
      descAr: "تحكم شامل بالأسطول والخرائط والرحلات",
      descEn: "Full control over fleet, trips, & analytics",
    },
    {
      id: "driver",
      labelAr: "بوابة السائق",
      labelEn: "Driver Portal",
      icon: IconDriver,
      descAr: "واجهة السائق الميدانية وإثبات التسليم",
      descEn: "Field driver workflow & POD delivery",
    },
    {
      id: "shipper",
      labelAr: "بوابة العميل",
      labelEn: "Shipper Portal",
      icon: IconProfile,
      descAr: "تتبع شحنة العميل والبوليصة ودرجة الحرارة",
      descEn: "Customer live freight tracking & waybill",
    },
    {
      id: "owner",
      labelAr: "مالك الأسطول",
      labelEn: "Fleet Owner",
      icon: IconTruck,
      descAr: "عائد الشاحنات والصيانة ومعدل الاستغلال",
      descEn: "Asset utilization, revenue & maintenance",
    },
  ];

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] bg-[#060e1d]/85 backdrop-blur-xl px-3.5 py-1.5 text-label-lg shadow-sm transition-colors">
      {/* Role Selector Pills */}
      <div className="scroll-x flex min-w-0 items-center gap-1.5 py-0.5">
        <span className="me-2 hidden shrink-0 text-micro font-extrabold uppercase tracking-wider text-text-muted sm:inline">
          {t("Persona Mode:", "نمط التجربة:")}
        </span>

        {ROLES.map((r) => {
          const isActive = currentRole === r.id;
          const Icon = r.icon;
          return (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-label font-bold transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/80",
                isActive
                  ? "bg-gradient-to-r from-brand to-orange-soft text-on-brand shadow-md shadow-brand/35 ring-1 ring-brand/60 scale-[1.02]"
                  : "bg-surface-2/60 text-text-secondary hover:bg-white/[0.08] hover:text-text-primary border border-white/[0.06]"
              )}
              title={t(r.descEn, r.descAr)}
            >
              <Icon size={14} className={isActive ? "text-on-brand" : "text-text-muted"} />
              <span>{t(r.labelEn, r.labelAr)}</span>
              {isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Live Simulation Controls & Indicator */}
      <div className="ms-auto flex shrink-0 items-center gap-2.5">
        <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-surface-2/60 backdrop-blur-md px-2.5 py-1">
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                "absolute inset-0 rounded-full animate-ping",
                isSimulating ? "bg-status-active" : "bg-status-waiting"
              )}
            />
            <span
              className={cn(
                "relative h-2 w-2 rounded-full",
                isSimulating ? "bg-status-active" : "bg-status-waiting"
              )}
            />
          </span>
          <span className="text-label text-text-muted tabular-nums">
            {isSimulating
              ? t("Route demo moving · not live GPS", "حركة استعراضية للمسار · لا تتبع GPS حقيقي")
              : t("Route demo paused", "الحركة الاستعراضية متوقفة")}
          </span>
        </div>

        <button
          onClick={toggleSimulation}
          className="btn-ghost text-label py-1 px-3 rounded-full border border-white/[0.08] hover:border-brand hover:text-brand hover:bg-brand/10 transition-colors backdrop-blur-sm"
        >
          {isSimulating ? t("Pause demo", "إيقاف العرض") : t("Resume demo", "استئناف العرض")}
        </button>

        <span className="hidden text-text-muted lg:inline">|</span>

        <span className="hidden text-label text-text-muted tabular-nums lg:inline">
          {trips.length} {t("active trips synced", "رحلات متزامنة")}
        </span>
      </div>
    </div>
  );
}
