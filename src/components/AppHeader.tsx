import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useBranding } from "../state/brandingStore";
import { useFleetStore, type Trip } from "../state/fleetStore";
import { usePermissions } from "../state/permissionStore";
import { BrandEmblem } from "./Logo";
import { GlobalSearch } from "./GlobalSearch";
import { AccountMenu } from "./AccountMenu";
import type { SettingsTab } from "./SettingsCenter";
import type { SessionUser } from "../utils/permissions";
import {
  IconBell,
  IconMenu,
  IconSearch,
  IconClose,
  IconRepair,
  IconTruck,
  IconDoc,
  IconProfile,
} from "./Icons";
import { PageExportMenu, type PageExportProgress } from "./PageExportMenu";
import { getVehicleTypeMeta } from "../data/vehicleTypes";

/**
 * Premium Operational Application Bar — EJAZ Transport Establishment.
 *
 * Implements the executive luxury navy & gold design reference:
 *   • Deep luxury navy background (#050D1D) with subtle warm gold/amber rim & glow
 *   • RTL layout from Right to Left:
 *       1. Main Menu button [☰] (far right)
 *       2. Establishment Identity (Emblem + «مؤسسة إيجاز للنقليات» + «شريكك في نقل أعمالك»)
 *       3. Global Search field (center) with instant autocomplete & navigation
 *       4. Action Tools: Camera (Page Export), Tools (Wrench / Settings), Bell (Notifications)
 *       5. Personal Account Profile (Golden ring avatar, full name, role, chevron)
 *   • Fully responsive on desktop, tablet, and mobile with zero horizontal scroll
 *   • Strict adherence to canonical design scale tokens and logical RTL properties
 */
export function AppHeader({
  user,
  pageTitle: _pageTitle,
  pageHint: _pageHint,
  unreadAlerts,
  onOpenSidebar,
  onOpenAssistant: _onOpenAssistant,
  onOpenAlerts,
  onOpenSettings,
  onPreviewLogin,
  onLogout,
  onNavigate,
  onOpenMobileApp,
  currentSurface = "web",
  onSwitchSurface,
  pageExport,
  showMenuButton = false,
}: {
  user: SessionUser | null;
  pageTitle: string;
  pageHint?: string;
  unreadAlerts: number;
  onOpenSidebar?: () => void;
  onOpenAssistant: () => void;
  onOpenAlerts: () => void;
  onOpenSettings: (tab?: SettingsTab) => void;
  onPreviewLogin: () => void;
  onLogout: () => void;
  onNavigate: (targetView: string, entityId?: string) => void;
  /** Open one mobile app in its own interface (§12). */
  onOpenMobileApp?: (kind: "driver" | "client") => void;
  currentSurface?: "web" | "driver" | "client";
  onSwitchSurface?: (surface: "web" | "driver" | "client") => void;
  pageExport?: {
    surface: "page" | "screen";
    busy: boolean;
    progress: PageExportProgress | null;
    eligiblePageCount: number;
    onExportCurrent: () => void;
    onPrint: () => void;
    onExportAll: () => void;
  };
  showMenuButton?: boolean;
}) {
  const { tk, lang, t, td } = useSettings();
  const { branding } = useBranding();
  const { trips, trucks, drivers, selectTrip, selectTruck } = useFleetStore();
  const { can } = usePermissions();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Close search autocomplete on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchResultsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Aggregated live search results respecting user permissions
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { trips: [], shipments: [], trucks: [], drivers: [] };

    const matchingTrips = can("trips.view")
      ? trips
          .filter(
            (tr) =>
              tr.tripNumber.toLowerCase().includes(q) ||
              tr.originCity.toLowerCase().includes(q) ||
              tr.destinationCity.toLowerCase().includes(q)
          )
          .slice(0, 4)
      : [];

    const matchingShipments = can("shipments.view")
      ? trips
          .filter(
            (tr) =>
              tr.qrCodeToken.toLowerCase().includes(q) ||
              tr.shipper.toLowerCase().includes(q) ||
              tr.consignee.toLowerCase().includes(q)
          )
          .slice(0, 4)
      : [];

    const matchingTrucks = can("vehicles.view")
      ? trucks
          .filter(
            (v) =>
              v.plate.toLowerCase().includes(q) ||
              v.model.toLowerCase().includes(q) ||
              v.brand.toLowerCase().includes(q) ||
              v.partner.toLowerCase().includes(q)
          )
          .slice(0, 4)
      : [];

    const matchingDrivers = can("drivers.view")
      ? drivers
          .filter((d) => d.name.toLowerCase().includes(q) || d.phone.includes(q))
          .slice(0, 3)
      : [];

    return {
      trips: matchingTrips,
      shipments: matchingShipments,
      trucks: matchingTrucks,
      drivers: matchingDrivers,
    };
  }, [searchQuery, trips, trucks, drivers, can]);

  const totalResults =
    searchResults.trips.length +
    searchResults.shipments.length +
    searchResults.trucks.length +
    searchResults.drivers.length;

  const handleSelectTrip = (tr: Trip) => {
    selectTrip(tr.id);
    selectTruck(tr.truckId);
    onNavigate("trips", tr.id);
    setSearchResultsOpen(false);
    setSearchQuery("");
  };

  const handleSelectShipment = (tr: Trip) => {
    selectTrip(tr.id);
    selectTruck(tr.truckId);
    onNavigate("shipments", tr.id);
    setSearchResultsOpen(false);
    setSearchQuery("");
  };

  const handleSelectTruck = (truckId: string) => {
    selectTruck(truckId);
    const matchingTrip = trips.find((t) => t.truckId === truckId);
    if (matchingTrip) selectTrip(matchingTrip.id);
    onNavigate("fleet", truckId);
    setSearchResultsOpen(false);
    setSearchQuery("");
  };

  const handleSelectDriver = (driverId: string) => {
    onNavigate("drivers", driverId);
    setSearchResultsOpen(false);
    setSearchQuery("");
  };

  const brandTitle = lang === "ar" ? (branding.officialNameAr || tk("app.name")) : tk("app.name");
  const brandTagline = lang === "ar" ? "شريكك في نقل أعمالك" : tk("app.tagline");
  const searchPlaceholder =
    lang === "en" ? "Search system..." : lang === "ur" ? "نظام میں تلاش کریں..." : "البحث في النظام...";

  return (
    <header className="app-header sticky top-0 z-[60] shrink-0 px-2 py-1.5 sm:px-3 sm:py-2 transition-colors">
      {/* Luxury Navy & Orange Capsule Bar matching visual reference */}
      <div className="mx-auto flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#071328]/95 px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2 shadow-sm backdrop-blur-xl">
        {/* Right Section (RTL): Menu Toggle + Brand Identity */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {showMenuButton && onOpenSidebar && (
            <button
              onClick={onOpenSidebar}
              className="btn-icon shrink-0 rounded-inner border border-orange-500/35 bg-[#08152c]/90 text-orange-400 hover:text-orange-300 hover:border-orange-500/60 hover:bg-[#0c1f40] shadow-sm shadow-orange-500/15 backdrop-blur-md transition-all active:scale-95 lg:hidden"
              aria-label={tk("nav.openMenu")}
              title={tk("nav.openMenu")}
            >
              <IconMenu size={18} />
            </button>
          )}

          {/* Brand Identity: Official Logo + Name + Tagline */}
          <div className="flex shrink-0 items-center gap-2.5 select-none">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-orange-500/40 bg-gradient-to-br from-orange-500/20 via-[#0a1832] to-[#040a18] p-1 shadow-sm shadow-orange-500/20 backdrop-blur-md transition-transform hover:scale-105">
              <BrandEmblem size={28} variant="header" />
            </div>
            <div className="hidden min-w-0 flex-col leading-tight sm:flex">
              <span className="truncate text-page-title font-extrabold text-white tracking-wide">
                {brandTitle}
              </span>
              <span className="truncate text-label font-bold text-orange-400 tracking-normal">
                {brandTagline}
              </span>
            </div>
          </div>

          {/* Thin subtle vertical divider */}
          <span className="hidden h-7 w-px shrink-0 bg-white/10 lg:block ms-1 me-1" aria-hidden="true" />

          {/* Quick Surface Switcher: Web Console · Driver App · Client App */}
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-white/10 bg-[#060f22]/70 p-0.5">
            <button
              type="button"
              onClick={() => onSwitchSurface?.("web")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1.5 text-label font-semibold transition-colors cursor-pointer",
                currentSurface === "web"
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/30 ring-1 ring-orange-400/50"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/10"
              )}
              title={t("Operations Control Room", "غرفة التحكم التشغيلي")}
            >
              <span>🖥️</span>
              <span className="hidden sm:inline">{t("Control Room", "غرفة التحكم")}</span>
            </button>
            <button
              type="button"
              onClick={() => onSwitchSurface?.("driver")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label font-extrabold transition-all cursor-pointer",
                currentSurface === "driver"
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/30 ring-1 ring-orange-400/50"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/10"
              )}
              title={t("Driver Mobile App", "تطبيق السائق الميداني")}
            >
              <span>🚚</span>
              <span className="hidden sm:inline">{t("Driver App", "تطبيق السائق")}</span>
            </button>
            <button
              type="button"
              onClick={() => onSwitchSurface?.("client")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label font-extrabold transition-all cursor-pointer",
                currentSurface === "client"
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/30 ring-1 ring-orange-400/50"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/10"
              )}
              title={t("Client Mobile App", "تطبيق العميل المعتمد")}
            >
              <span>🏢</span>
              <span className="hidden sm:inline">{t("Client App", "تطبيق العميل")}</span>
            </button>
          </div>
        </div>

        {/* Center Section: Global Search Field */}
        <div
          ref={searchContainerRef}
          className="relative mx-2 hidden flex-1 max-w-md md:block"
        >
          <div className="flex items-center gap-2 rounded-full bg-[#060f22]/90 px-3.5 py-1.5 border border-white/10 hover:border-orange-500/40 focus-within:border-orange-500/70 shadow-[0_2px_14px_rgba(249,115,22,0.15)] transition-all">
            <IconSearch size={16} className="text-orange-400/90 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchResultsOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchResultsOpen(true);
              }}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-label-lg text-text-primary placeholder:text-text-muted outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResultsOpen(false);
                }}
                className="text-text-muted hover:text-text-primary transition-colors"
                aria-label={tk("common.close")}
              >
                <IconClose size={14} />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {searchResultsOpen && searchQuery.trim() && (
            <div
              className="animate-fade-in absolute top-full mt-2 inset-x-0 z-50 rounded-panel bg-[#060e1d]/95 backdrop-blur-2xl p-2 shadow-2xl border border-white/10 max-h-[380px] overflow-y-auto text-label-lg"
              data-export-exclude="true"
            >
              {totalResults === 0 ? (
                <div className="p-4 text-center text-text-muted text-label-lg">
                  {t("No matching results found for", "لا توجد نتائج مطابقة لـ")} "{searchQuery}"
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Trips */}
                  {searchResults.trips.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-micro font-bold text-orange-400/90 uppercase tracking-wider">
                        {t("Trips", "الرحلات")}
                      </div>
                      {searchResults.trips.map((tr) => (
                        <button
                          key={tr.id}
                          onClick={() => handleSelectTrip(tr)}
                          className="w-full p-2 rounded-chip hover:bg-[#0b1b37] flex items-center justify-between text-start transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-micro bg-orange-500/15 text-orange-400">
                              <IconTruck size={14} />
                            </span>
                            <div>
                              <div className="font-mono font-bold text-text-primary">
                                {tr.tripNumber}
                              </div>
                              <div className="text-label text-text-muted">
                                {td(tr.originCity)} → {td(tr.destinationCity)}
                              </div>
                            </div>
                          </div>
                          <span className="text-micro font-mono text-status-active">
                            {tr.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Shipments */}
                  {searchResults.shipments.length > 0 && (
                    <div className="border-t border-white/5 pt-1.5">
                      <div className="px-2 py-1 text-micro font-bold text-orange-400/90 uppercase tracking-wider">
                        {t("Shipments", "الشحنات")}
                      </div>
                      {searchResults.shipments.map((tr) => (
                        <button
                          key={`sh-${tr.id}`}
                          onClick={() => handleSelectShipment(tr)}
                          className="w-full p-2 rounded-chip hover:bg-[#0b1b37] flex items-center justify-between text-start transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-micro bg-sky-400/15 text-sky-300">
                              <IconDoc size={14} />
                            </span>
                            <div>
                              <div className="font-mono font-bold text-text-primary">
                                {tr.qrCodeToken || `SH-${tr.tripNumber}`}
                              </div>
                              <div className="text-label text-text-muted truncate max-w-[200px]">
                                {tr.shipper}
                              </div>
                            </div>
                          </div>
                          <span className="text-micro text-orange-400 font-bold">
                            {getVehicleTypeMeta(tr.cargoType).arabicName}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Trucks */}
                  {searchResults.trucks.length > 0 && (
                    <div className="border-t border-white/5 pt-1.5">
                      <div className="px-2 py-1 text-micro font-bold text-orange-400/90 uppercase tracking-wider">
                        {t("Vehicles & Fleet", "الأسطول والشاحنات")}
                      </div>
                      {searchResults.trucks.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => handleSelectTruck(v.id)}
                          className="w-full p-2 rounded-chip hover:bg-[#0b1b37] flex items-center justify-between text-start transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-micro bg-surface-3 text-text-secondary">
                              <IconTruck size={14} />
                            </span>
                            <div>
                              <div className="font-mono font-bold text-text-primary">{v.plate}</div>
                              <div className="text-label text-text-muted truncate">
                                {v.brand} {v.model}
                              </div>
                            </div>
                          </div>
                          <span className="text-micro text-text-muted font-mono">{v.body}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Drivers */}
                  {searchResults.drivers.length > 0 && (
                    <div className="border-t border-white/5 pt-1.5">
                      <div className="px-2 py-1 text-micro font-bold text-orange-400/90 uppercase tracking-wider">
                        {t("Drivers", "السائقون")}
                      </div>
                      {searchResults.drivers.map((d) => (
                        <button
                          key={d.name}
                          onClick={() => handleSelectDriver(d.name)}
                          className="w-full p-2 rounded-chip hover:bg-[#0b1b37] flex items-center justify-between text-start transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-micro bg-status-active/15 text-status-active">
                              <IconProfile size={14} />
                            </span>
                            <div>
                              <div className="font-semibold text-text-primary">{d.name}</div>
                              <div className="text-label text-text-muted font-mono">{d.phone}</div>
                            </div>
                          </div>
                          <span className="text-micro text-text-muted">⭐ {d.rating}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Left Section (RTL): Tools + Notifications + Personal Account Profile */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          {/* Mobile search toggle button (visible on smaller screens) */}
          <button
            onClick={() => setMobileSearchOpen((v) => !v)}
            className={cn(
              "btn-icon relative shrink-0 rounded-full border border-white/10 bg-[#08152c]/80 text-text-secondary hover:text-text-primary hover:border-orange-500/50 hover:bg-[#0c1f40] backdrop-blur-md transition-all active:scale-95 md:hidden shadow-sm",
              mobileSearchOpen && "border-orange-500/70 text-orange-400 bg-orange-500/10 shadow-orange-500/20"
            )}
            aria-label={tk("common.search")}
            title={tk("common.search")}
          >
            <IconSearch size={16} />
          </button>

          {/* Camera / Screenshot Page Export Tool */}
          {pageExport && (
            <PageExportMenu
              surface={pageExport.surface}
              busy={pageExport.busy}
              progress={pageExport.progress}
              eligiblePageCount={pageExport.eligiblePageCount}
              onExportCurrent={pageExport.onExportCurrent}
              onPrint={pageExport.onPrint}
              onExportAll={pageExport.onExportAll}
              buttonClassName="border border-white/10 hover:border-orange-500/50 bg-[#08152c]/80 hover:bg-[#0c1f40] text-text-secondary hover:text-orange-300 shadow-sm"
            />
          )}

          {/* Tools & Settings / Maintenance Tool */}
          <button
            onClick={() => onOpenSettings("system")}
            className="btn-icon relative shrink-0 rounded-full border border-white/10 hover:border-orange-500/50 bg-[#08152c]/80 hover:bg-[#0c1f40] text-text-secondary hover:text-orange-300 shadow-sm transition-all active:scale-95 group"
            title={tk("nav.settings")}
            aria-label={tk("nav.settings")}
          >
            <IconRepair size={16} className="transition-transform group-hover:rotate-45" />
          </button>

          {/* Notifications Center Bell with Real Unread Badge */}
          <button
            onClick={onOpenAlerts}
            className="btn-icon relative shrink-0 rounded-full border border-white/10 hover:border-orange-500/50 bg-[#08152c]/80 hover:bg-[#0c1f40] text-text-secondary hover:text-orange-300 shadow-sm transition-all active:scale-95 group"
            title={tk("header.notificationsTitle")}
            aria-label={tk("header.notificationsTitle")}
          >
            <IconBell size={16} className="transition-transform group-hover:scale-105" />
            {unreadAlerts > 0 && (
              <span className="num absolute -top-1 -end-1 grid h-4 min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-micro font-extrabold text-white ring-2 ring-[#050D1D] shadow-[0_0_8px_rgba(249,115,22,0.5)]">
                {unreadAlerts > 99 ? "99+" : unreadAlerts}
              </span>
            )}
          </button>

          {/* Personal Account Profile Capsule with Dropdown Menu */}
          <div className="shrink-0" data-export-exclude="true">
            <AccountMenu
              className="shrink-0"
              user={user}
              variant="premium"
              onOpenSettings={onOpenSettings}
              onOpenAssistant={_onOpenAssistant}
              onOpenMobileApp={onOpenMobileApp ?? (() => {})}
              onPreviewLogin={onPreviewLogin}
              onLogout={onLogout}
            />
          </div>
        </div>
      </div>

      {/* Mobile Search Overlay Modal for small screens */}
      {mobileSearchOpen && (
        <div
          className="animate-fade-in absolute inset-x-0 top-full mt-2 border border-white/10 bg-[#050D1D]/95 backdrop-blur-2xl p-3 shadow-2xl rounded-panel mx-2 md:hidden"
          data-export-exclude="true"
        >
          <GlobalSearch
            onNavigate={(view, id) => {
              setMobileSearchOpen(false);
              onNavigate(view, id);
            }}
          />
          <button
            onClick={() => setMobileSearchOpen(false)}
            className="mt-2 w-full rounded-control py-1.5 text-center text-label-lg font-semibold text-text-muted hover:text-text-primary transition-colors"
          >
            {tk("common.close")}
          </button>
        </div>
      )}

      {/* Screen-reader / status line: language + direction, without visual noise. */}
      <span className="sr-only" data-lang={lang}>
        {tk("language.current")}
      </span>
    </header>
  );
}

