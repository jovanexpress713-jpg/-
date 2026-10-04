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
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle bg-surface-1 px-3 py-2 text-[12px]">
      {/* Role Selector Pills */}
      <div className="scroll-x flex min-w-0 items-center gap-1.5 py-0.5">
        <span className="me-1.5 hidden shrink-0 text-[10.5px] font-bold uppercase tracking-wider text-text-muted sm:inline">
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
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95",
                isActive
                  ? "bg-brand text-on-brand shadow-sm font-bold"
                  : "bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary"
              )}
              title={t(r.descEn, r.descAr)}
            >
              <Icon size={13} />
              <span>{t(r.labelEn, r.labelAr)}</span>
            </button>
          );
        })}
      </div>

      {/* Live Simulation Controls & Indicator */}
      <div className="ms-auto flex shrink-0 items-center gap-2.5">
        <div className="flex items-center gap-2">
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
          <span className="text-[11px] text-text-muted tabular-nums">
            {isSimulating
              ? t("Live GPS Engine Running", "محرك التتبع المباشر نشط")
              : t("Simulation Paused", "المحاكاة متوقفة مؤقتاً")}
          </span>
        </div>

        <button
          onClick={toggleSimulation}
          className="btn-ghost text-[10.5px] py-1 px-2.5 rounded-full border border-border-subtle hover:border-brand"
        >
          {isSimulating ? t("Pause GPS", "إيقاف مؤقت") : t("Resume GPS", "استئناف الحركة")}
        </button>

        <span className="hidden text-text-muted lg:inline">|</span>

        <span className="hidden text-[11px] text-text-muted lg:inline">
          {trips.length} {t("active trips synced", "رحلات متزامنة")}
        </span>
      </div>
    </div>
  );
}
