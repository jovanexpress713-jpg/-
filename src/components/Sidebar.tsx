import { useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { BrandLogo } from "./Logo";
import {
  IconAnalysis,
  IconCargo,
  IconChat,
  IconChevron,
  IconDashboard,
  IconDriver,
  IconHistory,
  IconPlus,
  IconRepair,
  IconReport,
  IconRequests,
  IconTracking,
  IconTruck,
  IconBolt,
  IconLayers,
} from "./Icons";
import type { RequestKind } from "../data/types";

export interface NavCounts {
  trucks: number;
  cargos: number;
  repair: number;
  drivers: number;
  reports: number;
}

interface Props {
  active: string;
  onSelect: (key: string) => void;
  counts: NavCounts;
  onCreate: (kind: RequestKind) => void;
}

export function Sidebar({ active, onSelect, counts, onCreate }: Props) {
  const { t } = useSettings();
  const [openRequests, setOpenRequests] = useState(true);
  const [openAnalysis, setOpenAnalysis] = useState(false);

  const row = (key: string, label: string, Icon: typeof IconTruck) => {
    const isActive = active === key;
    return (
      <button
        key={key}
        onClick={() => onSelect(key)}
        className={cn("nav-item w-full", isActive && "bg-brand/12 text-text-primary")}
      >
        {isActive && (
          <span className="absolute top-1/2 start-0 h-6 w-[3px] -translate-y-1/2 rounded-full bg-brand glow-brand" />
        )}
        <Icon size={17} className={isActive ? "text-brand" : ""} />
        <span className="flex-1 text-start">{label}</span>
      </button>
    );
  };

  const QUICK: { kind: RequestKind; label: string; icon: typeof IconTruck }[] = [
    { kind: "truck", label: t("Truck", "شاحنة"), icon: IconTruck },
    { kind: "cargo", label: t("Cargo", "شحنة"), icon: IconCargo },
    { kind: "repair", label: t("Repair", "صيانة"), icon: IconRepair },
    { kind: "driver", label: t("Driver", "سائق"), icon: IconDriver },
    { kind: "report", label: t("Report", "تقرير"), icon: IconReport },
  ];

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-e border-border-subtle bg-surface-1 px-4 py-5">
      <div className="px-1">
        <BrandLogo size={32} sub={t("Since 2022", "منذ ٢٠٢٢")} />
      </div>

      <nav className="scroll-thin mt-7 flex-1 space-y-1 overflow-y-auto px-1">
        {row("operations", t("Operations Center", "الرئيسية (مركز العمليات)"), IconDashboard)}
        {row("trips", t("Trips", "الرحلات"), IconTruck)}
        {row("shipments", t("Shipments", "الشحنات"), IconCargo)}
        {row("fleet", t("Fleet (4 Types)", "الأسطول (٤ أنواع)"), IconTruck)}
        {row("drivers", t("Drivers", "السائقون"), IconDriver)}
        {row("tracking", t("Live Map", "الخريطة المباشرة"), IconTracking)}
        {row("reports", t("Reports & Audit", "التقارير والتدقيق"), IconReport)}
        {row("alerts", t("Live Smart Alerts", "التنبيهات المباشرة"), IconBolt)}
        {row("chats", t("Chats & Dispatch", "المحادثات والتوجيه"), IconChat)}
        {row("branding", t("Settings & Identity", "الإعدادات والهوية"), IconLayers)}
        {row("ai", t("AI Logistics Assistant", "مساعد إيجاز الذكي"), IconBolt)}

        <div>
          <button
            onClick={() => setOpenRequests((v) => !v)}
            className={cn("nav-item w-full")}
          >
            <IconRequests size={17} />
            <span className="flex-1 text-start">{t("Requests", "الطلبات")}</span>
            <IconChevron
              size={15}
              className={cn("transition-transform duration-300", openRequests ? "rotate-180" : "")}
            />
          </button>
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-out",
              openRequests ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="overflow-hidden">
              <div className="mt-1 ms-[22px] space-y-0.5 border-s border-border-subtle ps-3">
                {[
                  { key: "trucks", label: t("Trucks", "الشاحنات"), Icon: IconTruck, n: counts.trucks },
                  { key: "cargos", label: t("Cargos", "الشحنات"), Icon: IconCargo, n: counts.cargos },
                  { key: "repair", label: t("Repair", "الصيانة"), Icon: IconRepair, n: counts.repair },
                  { key: "drivers", label: t("Drivers", "السائقون"), Icon: IconDriver, n: counts.drivers },
                  { key: "reports", label: t("Reports", "التقارير"), Icon: IconReport, n: counts.reports },
                ].map(({ key, label, Icon, n }) => {
                  const isActive = active === key;
                  return (
                    <button
                      key={key}
                      onClick={() => onSelect(key)}
                      className={cn(
                        "nav-item w-full py-[7px] text-[12.5px]",
                        isActive && "bg-brand/12 text-text-primary",
                      )}
                    >
                      {isActive && (
                        <span className="absolute top-1/2 start-0 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand glow-brand" />
                      )}
                      <Icon size={15} className={isActive ? "text-brand" : ""} />
                      <span className="flex-1 text-start">{label}</span>
                      <span className="badge bg-surface-4 text-text-muted tabular-nums">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div>
          <button
            onClick={() => setOpenAnalysis((v) => !v)}
            className={cn("nav-item w-full")}
          >
            <IconAnalysis size={17} />
            <span className="flex-1 text-start">{t("Analysis", "التحليلات")}</span>
            <IconChevron
              size={15}
              className={cn("transition-transform duration-300", openAnalysis ? "rotate-180" : "")}
            />
          </button>
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-out",
              openAnalysis ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="overflow-hidden">
              <div className="mt-1 ms-[22px] space-y-0.5 border-s border-border-subtle ps-3">
                {[
                  t("Utilisation", "نسبة الاستغلال"),
                  t("Fuel burn", "استهلاك الوقود"),
                  t("On-time rate", "نسبة الالتزام بالوقت"),
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => onSelect("analysis")}
                    className="nav-item w-full py-[7px] text-[12.5px]"
                  >
                    <span className="flex-1 text-start">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {row("history", t("History", "السجل"), IconHistory)}
      </nav>

      <div className="group relative mt-4">
        <div className="pointer-events-none absolute -top-9 inset-x-0 flex justify-center opacity-0 transition-all duration-300 group-hover:pointer-events-auto group-hover:-top-11 group-hover:opacity-100">
          <div className="flex items-center gap-1 rounded-[12px] bg-surface-4 p-1.5">
            {QUICK.map(({ kind, label, icon: Icon }) => (
              <button
                key={kind}
                title={label}
                onClick={() => onCreate(kind)}
                className="btn-icon-sm h-8 w-8 bg-transparent hover:bg-brand hover:text-on-brand"
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onCreate("truck")}
          className="flex w-full items-center gap-3 rounded-[8px] border border-dashed border-border-subtle p-3 text-start transition-all duration-200 hover:border-brand active:scale-[0.98]"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-on-brand transition-transform duration-300 group-hover:rotate-90">
            <IconPlus size={18} />
          </span>
          <span>
            <span className="block text-[13px] font-medium text-text-primary">
              {t("Create new Request", "إنشاء طلب جديد")}
            </span>
            <span className="block text-[10.5px] text-text-muted">
              {t("Dispatch, repair or report", "تشغيل، صيانة أو تقرير")}
            </span>
          </span>
        </button>
      </div>
    </aside>
  );
}
