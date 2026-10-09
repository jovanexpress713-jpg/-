import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { BRANDS, PARTNERS } from "../data/catalog";
import type { Vehicle } from "../data/types";
import { liveOf, useElapsed, useTicker } from "../hooks";
import { ShipmentCard } from "./ShipmentCard";
import {
  AnalysisView,
  CargosView,
  ChatsView,
  DashboardView,
  DriversView,
  FleetStrip,
  HistoryView,
  PartnersView,
  RepairView,
  ReportsView,
  TrucksView,
} from "./views";
import { IconMenu, IconSearch, IconTracking, IconClose } from "./Icons";

interface Props {
  vehicles: Vehicle[];
  selectedId: string;
  activeNav: string;
  onSelect: (id: string) => void;
  onNav: (key: string) => void;
  onToast: (text: string, sub?: string) => void;
  onOpenSidebar: () => void;
  resetKey: number;
}

type StatusTab = "all" | "active" | "inactive";

export function Dashboard({
  vehicles,
  selectedId,
  activeNav,
  onSelect,
  onNav,
  onToast,
  onOpenSidebar,
  resetKey,
}: Props) {
  const { t } = useSettings();
  const now = useTicker(1000);
  const elapsed = useElapsed(now);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [brands, setBrands] = useState<Set<string>>(new Set());
  const [partners, setPartners] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<StatusTab>("all");

  useEffect(() => {
    setQuery("");
    setBrands(new Set());
    setPartners(new Set());
    setTab("all");
  }, [resetKey]);

  const toggle = (set: Set<string>, v: string, apply: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    apply(next);
  };

  const matches = (v: Vehicle, skipBrand = false, skipPartner = false) => {
    if (tab === "active" && v.status !== "active") return false;
    if (tab === "inactive" && v.status !== "inactive") return false;
    if (!skipBrand && brands.size > 0 && !brands.has(v.brand)) return false;
    if (!skipPartner && partners.size > 0 && !partners.has(v.partner)) return false;
    if (query) {
      const hay =
        `${v.shipment} ${v.brand} ${v.model} ${v.partner} ${v.from} ${v.to} ${v.driver.name} ${v.plate} ${v.cab}`.toLowerCase();
      if (!hay.includes(query.toLowerCase())) return false;
    }
    return true;
  };

  const filtered = useMemo(
    () => vehicles.filter((v) => matches(v)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vehicles, query, brands, partners, tab],
  );

  const brandCounts = BRANDS.filter((b) => vehicles.some((v) => v.brand === b.id)).map((b) => ({
    ...b,
    n: vehicles.filter((v) => matches(v, true, true) && v.brand === b.id).length,
  }));

  const partnerCounts = PARTNERS.filter((p) => vehicles.some((v) => v.partner === p)).map((p) => ({
    name: p,
    n: vehicles.filter((v) => matches(v, false, true) && v.partner === p).length,
  }));

  const reset = () => {
    setQuery("");
    setBrands(new Set());
    setPartners(new Set());
    setTab("all");
    onToast(t("Filters reset", "تمت إعادة ضبط الفلاتر"), t("Showing all shipments", "عرض جميع الشحنات"));
  };

  const viewProps = {
    vehicles,
    onSelect: (id: string) => {
      onSelect(id);
      onNav("tracking");
    },
    onPartner: (p: string) => {
      setPartners(new Set([p]));
      onNav("tracking");
    },
    onToast,
  };

  const TITLES: Record<string, [string, string]> = {
    dashboard: ["Dashboard", "اللوحة الرئيسية"],
    chats: ["Chats", "المحادثات"],
    partners: ["Partners", "الشركاء"],
    tracking: ["Tracking", "التتبع"],
    requests: ["Requests", "الطلبات"],
    analysis: ["Analysis", "التحليلات"],
    history: ["History", "السجل"],
    trucks: ["Trucks", "الشاحنات"],
    cargos: ["Cargos", "الشحنات"],
    repair: ["Repair", "الصيانة"],
    drivers: ["Drivers", "السائقون"],
    reports: ["Reports", "التقارير"],
  };

  const renderView = () => {
    switch (activeNav) {
      case "dashboard": return <DashboardView {...viewProps} />;
      case "chats": return <ChatsView {...viewProps} />;
      case "partners": return <PartnersView {...viewProps} />;
      case "analysis": return <AnalysisView {...viewProps} />;
      case "history": return <HistoryView {...viewProps} />;
      case "trucks": return <TrucksView {...viewProps} />;
      case "cargos": return <CargosView {...viewProps} />;
      case "repair": return <RepairView {...viewProps} />;
      case "drivers": return <DriversView {...viewProps} />;
      case "reports": return <ReportsView {...viewProps} />;
      default: return null;
    }
  };

  const isTracking = activeNav === "tracking" || activeNav === "requests";
  const title = TITLES[activeNav] ?? TITLES.tracking;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-surface-0">
      <header className="flex items-center gap-3 border-b border-border-subtle px-4 py-4 lg:px-5">
        <button onClick={onOpenSidebar} className="btn-icon lg:hidden" aria-label={t("Menu", "القائمة")}>
          <IconMenu size={17} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-hero leading-tight font-medium text-text-primary">
            {t(title[0], title[1])}
          </h1>
          <p className="mt-0.5 text-label-lg text-text-muted">
            {isTracking
              ? t(
                  `${filtered.length} of ${vehicles.length} shipments · live telemetry`,
                  `${filtered.length} من ${vehicles.length} شحنة · بيانات حية`,
                )
              : t("Fleet control · EJAZ Transport", "إدارة الأسطول · مؤسسة إيجاز للنقليات")}
          </p>
        </div>

        <div
          className={cn(
            "flex items-center gap-2 rounded-full bg-surface-2 transition-all duration-300",
            searching ? "px-3 py-1.5" : "p-1.5",
          )}
        >
          {searching && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                "Search shipment, driver, plate…",
                "ابحث برقم الشحنة أو السائق أو اللوحة…",
              )}
              className="w-[170px] bg-transparent text-body outline-none xl:w-[230px]"
            />
          )}
          <button
            onClick={() => {
              setSearching((s) => !s);
              if (searching) setQuery("");
            }}
            className="btn-icon-sm bg-transparent"
            aria-label={t("Search", "بحث")}
          >
            {searching ? <IconClose size={15} /> : <IconSearch size={16} />}
          </button>
        </div>
      </header>

      {isTracking ? (
        <>
          <div className="scroll-thin max-h-[248px] space-y-3 overflow-y-auto border-b border-border-subtle px-4 py-4 lg:px-5">
            <div>
              <div className="mb-2 text-label tracking-wide text-text-muted uppercase">
                {t("Filter by Brand", "الفلترة حسب الماركة")}
              </div>
              <div className="flex flex-wrap gap-2">
                {brandCounts.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => toggle(brands, b.id, setBrands)}
                    className={cn("chip", brands.has(b.id) && "chip-on")}
                  >
                    {b.id}
                    <span className="chip-count">{b.n}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-label tracking-wide text-text-muted uppercase">
                {t("Filter by Partners", "الفلترة حسب الشريك")}
              </div>
              <div className="flex flex-wrap gap-2">
                {partnerCounts.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => toggle(partners, p.name, setPartners)}
                    className={cn("chip", partners.has(p.name) && "chip-on")}
                  >
                    {p.name}
                    <span className="chip-count">{p.n}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-label tracking-wide text-text-muted uppercase">
                  {t("Show", "عرض")}
                </span>
                <div className="flex gap-1 rounded-full bg-surface-2 p-1">
                  {(
                    [
                      ["all", t("All", "الكل")],
                      ["active", t("Active", "نشط")],
                      ["inactive", t("Inactive", "متوقف")],
                    ] as [StatusTab, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      className={cn(
                        "rounded-full px-3 py-1 text-label-lg transition-all duration-200 active:scale-95",
                        tab === id
                          ? "bg-brand font-semibold text-on-brand"
                          : "text-text-secondary hover:text-text-primary",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {(brands.size > 0 || partners.size > 0 || query || tab !== "all") && (
                <button onClick={reset} className="text-label-lg text-brand hover:opacity-80">
                  {t("Reset filters", "إعادة ضبط الفلاتر")}
                </button>
              )}
            </div>
          </div>

          <div className="scroll-thin flex-1 overflow-y-auto p-4">
            {filtered.length === 0 ? (
              <div className="animate-fade-up grid h-full place-items-center">
                <div className="max-w-[340px] text-center">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-3 text-text-muted">
                    <IconTracking size={22} />
                  </span>
                  <h3 className="mt-4 text-section-title font-medium text-text-primary">
                    {t("No shipments found", "لا توجد شحنات مطابقة")}
                  </h3>
                  <p className="mt-1 text-label-lg text-text-muted">
                    {t(
                      "Nothing matches the current brand, partner or status filters.",
                      "لا يوجد ما يطابق الفلاتر الحالية للماركة أو الشريك أو الحالة.",
                    )}
                  </p>
                  <button onClick={reset} className="btn-primary mt-4 px-5">
                    {t("Reset filters", "إعادة ضبط الفلاتر")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(292px,100%),1fr))] gap-3">
                {filtered.map((v, i) => (
                  <ShipmentCard
                    key={v.id}
                    v={v}
                    live={liveOf(v, elapsed)}
                    selected={v.id === selectedId}
                    index={i}
                    onSelect={() => onSelect(v.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="scroll-thin flex-1 overflow-y-auto p-4">
          {renderView()}
          <div className="mt-3">
            <FleetStrip
              vehicles={vehicles}
              onSelect={(id) => {
                onSelect(id);
                onNav("tracking");
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
