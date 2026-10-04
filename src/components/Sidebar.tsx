import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { BrandLogo } from "./Logo";
import {
  IconAnalysis,
  IconCargo,
  IconChat,
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

/**
 * Spec §4.8 — sidebar.
 *
 * Three changes from the previous 15-item flat list:
 *
 *  1. Entries are grouped under three labelled headings with hairline
 *     dividers, so 23 destinations become 4 scannable clusters.
 *  2. The old "الطلبات" subgroup duplicated destinations that already sat at
 *     the top level (`trucks` → `fleet`, `cargos` → `shipments`, `repair` →
 *     `fleet`), and the three "التحليلات" children all dispatched the same
 *     `analysis` key — three labels, one behaviour. Both are gone.
 *  3. The quick-create row used to be `opacity-0` + `group-hover` only, so it
 *     was unreachable on touch. It is now permanently rendered.
 *
 * Rows that open a modal rather than navigate carry a small window glyph, so
 * "moves me" and "opens over this" are no longer visually identical.
 */

/** Legacy keys the console can still hold — highlight their parent instead. */
const KEY_ALIAS: Record<string, string> = {
  trucks: "fleet",
  repair: "fleet",
  cargos: "shipments",
  dashboard: "operations",
};

export function Sidebar({ active, onSelect, counts, onCreate }: Props) {
  const { t } = useSettings();
  const current = KEY_ALIAS[active] ?? active;

  const row = (
    key: string,
    label: string,
    Icon: typeof IconTruck,
    opts: { count?: number; modal?: boolean } = {},
  ) => {
    const isActive = current === key;
    return (
      <button
        key={key}
        onClick={() => onSelect(key)}
        aria-current={isActive ? "page" : undefined}
        className={cn("nav-item w-full", isActive && "nav-item-on")}
      >
        <Icon size={17} className={isActive ? "" : ""} />
        <span className="flex-1 text-start">{label}</span>
        {opts.modal && !isActive && (
          <span
            aria-hidden="true"
            title={t("Opens in a window", "يفتح في نافذة")}
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted/60"
          />
        )}
        {typeof opts.count === "number" && (
          <span className={cn("badge", isActive ? "bg-white/20 text-on-orange" : "badge-brand")}>
            {opts.count}
          </span>
        )}
      </button>
    );
  };

  const heading = (label: string) => (
    <div className="label-sm px-3 pt-4 pb-1.5 first:pt-0 uppercase">{label}</div>
  );

  const QUICK: { kind: RequestKind; label: string; icon: typeof IconTruck }[] = [
    { kind: "truck", label: t("Truck", "شاحنة"), icon: IconTruck },
    { kind: "cargo", label: t("Cargo", "شحنة"), icon: IconCargo },
    { kind: "repair", label: t("Repair", "صيانة"), icon: IconRepair },
    { kind: "driver", label: t("Driver", "سائق"), icon: IconDriver },
    { kind: "report", label: t("Report", "تقرير"), icon: IconReport },
  ];

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-e border-border-subtle bg-surface-1 px-3 py-4">
      <div className="px-2">
        <BrandLogo size={32} sub={t("Since 2022", "منذ ٢٠٢٢")} />
      </div>

      <nav className="scroll-thin mt-5 flex-1 overflow-y-auto px-1 pb-2">
        {heading(t("Operations", "التشغيل"))}
        <div className="space-y-0.5">
          {row("overview", t("Logistics Dashboard", "لوحة المؤشرات"), IconAnalysis)}
          {row("operations", t("Operations Center", "مركز العمليات"), IconDashboard)}
          {row("trips", t("Trips", "الرحلات"), IconTruck)}
          {row("shipments", t("Shipments", "الشحنات"), IconCargo, { count: counts.cargos })}
          {row("tracking", t("Live Map", "الخريطة المباشرة"), IconTracking)}
        </div>

        <div className="my-3 border-t border-border-subtle" />

        {heading(t("Fleet", "الأسطول"))}
        <div className="space-y-0.5">
          {row("fleet", t("Fleet (4 Types)", "الأسطول (٤ أنواع)"), IconTruck, {
            count: counts.trucks,
          })}
          {row("vehicle-assets", t("Vehicle Assets", "أصول المركبات"), IconLayers)}
          {row("drivers", t("Drivers", "السائقون"), IconDriver, { count: counts.drivers })}
          {row("registrations", t("Registration Requests", "طلبات التسجيل"), IconRequests)}
        </div>

        <div className="my-3 border-t border-border-subtle" />

        {heading(t("Insights", "التحليلات"))}
        <div className="space-y-0.5">
          {row("reports", t("Reports & Audit", "التقارير والتدقيق"), IconReport, {
            count: counts.reports,
          })}
          {row("analysis", t("Fleet Analytics", "التحليلات التشغيلية"), IconAnalysis)}
          {row("history", t("Trip Archive", "أرشيف الرحلات"), IconHistory)}
        </div>

        <div className="my-3 border-t border-border-subtle" />

        {heading(t("Settings & Identity", "الإعدادات والهوية"))}
        <div className="space-y-0.5">
          {row("branding", t("Branding", "الهوية"), IconLayers, { modal: true })}
          {row("alerts", t("Live Smart Alerts", "التنبيهات المباشرة"), IconBolt, {
            modal: true,
          })}
          {row("chats", t("Chats & Dispatch", "المحادثات والتوجيه"), IconChat)}
          {row("ai", t("AI Logistics Assistant", "مساعد إيجاز الذكي"), IconBolt, {
            modal: true,
          })}
        </div>
      </nav>

      {/* Spec §4.9 — dashed orange create card, always visible. The five
          quick actions sit above it in the open rather than on hover, so a
          touch user can actually reach them. */}
      <div className="mt-3 shrink-0 space-y-2 border-t border-border-subtle pt-3">
        <div className="flex items-center justify-between gap-1 px-1">
          <span className="label-sm">{t("Quick create", "إنشاء سريع")}</span>
          <div className="flex items-center gap-1">
            {QUICK.map(({ kind, label, icon: Icon }) => (
              <button
                key={kind}
                title={label}
                aria-label={label}
                onClick={() => onCreate(kind)}
                className="btn-icon-sm"
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onCreate("truck")}
          className="group flex w-full items-center gap-3 rounded-panel border-[1.5px] border-dashed border-brand bg-brand/5 p-3 text-start transition-[background-color,border-color,transform] duration-200 hover:bg-brand/10 active:scale-[0.98]"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-on-brand transition-transform duration-300 group-hover:rotate-90">
            <IconPlus size={18} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-brand">
              {t("Create new Request", "إنشاء طلب جديد")}
            </span>
            <span className="block truncate text-[10.5px] text-text-muted">
              {t("Dispatch, repair or report", "تشغيل، صيانة أو تقرير")}
            </span>
          </span>
        </button>
      </div>
    </aside>
  );
}
