import { useState, useMemo } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore } from "../state/fleetStore";
import { useToast } from "./Toast";
import { TruckTypeIcon } from "./TruckTypeIcon";
import { getVehicleTypeMeta, normalizeVehicleType } from "../data/vehicleTypes";
import {
  IconDriver,
  IconSearch,
  IconStar,
  IconCheck,
  IconArrowRight,
  IconClose,
} from "./Icons";

interface DriversManagerProps {
  onOpenTrip?: (tripId: string) => void;
  onOpenTruck?: (truckId: string) => void;
}

type DriverStatusFilter = "ALL" | "on_trip" | "available" | "rest" | "leave";

interface EnrichedDriver {
  id: string;
  name: string;
  phone: string;
  initials: string;
  rating: number;
  trips: number;
  status: "on_trip" | "available" | "rest" | "leave";
  assignedTruckId?: string;
  license: string;
}

export function DriversManager({ onOpenTrip, onOpenTruck }: DriversManagerProps) {
  const { t, td } = useSettings();
  const toast = useToast();
  const { drivers, trucks, trips, selectTrip, selectTruck } = useFleetStore();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DriverStatusFilter>("ALL");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [showCallModal, setShowCallModal] = useState<EnrichedDriver | null>(null);

  // Status mapping and translations
  const STATUS_CONFIG: Record<string, { labelAr: string; labelEn: string; color: string; bg: string }> = {
    on_trip: {
      labelAr: "في رحلة نشطة",
      labelEn: "On Active Trip",
      color: "var(--color-status-active)",
      bg: "rgba(47, 208, 138, 0.12)",
    },
    available: {
      labelAr: "متاح للتكليف",
      labelEn: "Available",
      color: "var(--color-brand)",
      bg: "rgba(255, 122, 0, 0.12)",
    },
    rest: {
      labelAr: "فترة راحة نظامية",
      labelEn: "Mandatory Rest",
      color: "var(--color-status-waiting)",
      bg: "rgba(245, 183, 60, 0.12)",
    },
    leave: {
      labelAr: "إجازة دورية",
      labelEn: "On Leave",
      color: "var(--color-text-muted)",
      bg: "rgba(132, 148, 173, 0.12)",
    },
  };

  // Harmonize drivers with fleet state
  const enrichedDrivers: EnrichedDriver[] = useMemo(() => {
    return drivers.map((d, index) => {
      const driverId = d.id || `d${index + 1}`;
      const activeTrip = trips.find((tr) => tr.driverId === driverId && tr.status === "on_road");
      let status: "on_trip" | "available" | "rest" | "leave" = "available";
      if (activeTrip) {
        status = "on_trip";
      } else if (index % 5 === 2) {
        status = "rest";
      } else if (index % 5 === 4) {
        status = "leave";
      }

      const assignedTruck = trucks.find((v) => v.driver?.name === d.name || v.id === activeTrip?.truckId);

      return {
        id: driverId,
        name: d.name,
        phone: d.phone,
        initials: d.initials,
        rating: d.rating,
        trips: d.trips,
        status,
        assignedTruckId: assignedTruck?.id,
        license: `DL-SA-${(10000 + (index * 7919) % 89999).toString()}`,
      };
    });
  }, [drivers, trips, trucks]);

  const filteredDrivers = useMemo(() => {
    return enrichedDrivers.filter((driver) => {
      if (statusFilter !== "ALL" && driver.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = driver.name.toLowerCase().includes(q);
        const matchesPhone = driver.phone.toLowerCase().includes(q);
        const matchesId = driver.id.toLowerCase().includes(q);
        const matchesLicense = driver.license.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesId && !matchesLicense) return false;
      }
      return true;
    });
  }, [enrichedDrivers, statusFilter, search]);

  const selectedDriver = enrichedDrivers.find((d) => d.id === selectedDriverId) || filteredDrivers[0];
  const assignedTruck = trucks.find((v) => v.id === selectedDriver?.assignedTruckId);
  const currentTrip = trips.find((tr) => tr.driverId === selectedDriver?.id && tr.status === "on_road");

  // Summary counts
  const totalCount = enrichedDrivers.length;
  const onTripCount = enrichedDrivers.filter((d) => d.status === "on_trip").length;
  const availableCount = enrichedDrivers.filter((d) => d.status === "available").length;
  const restCount = enrichedDrivers.filter((d) => d.status === "rest" || d.status === "leave").length;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-0">
      {/* Top Header */}
      <header className="shrink-0 border-b border-border-subtle bg-surface-1 px-4 py-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-brand/12 text-brand">
                <IconDriver size={18} />
              </span>
              <h1 className="text-[20px] font-bold text-text-primary lg:text-[22px]">
                {t("Fleet Drivers & Crew Control", "سجل وإدارة كباتن الأسطول")}
              </h1>
            </div>
            <p className="mt-1 text-[12px] text-text-secondary">
              {t(
                "Driver allocation, regulatory certifications, and live road dispatch status",
                "إدارة السائقين المعتمدين، الرخص المهنية، والجاهزية الميدانية للرحلات",
              )}
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <div className="flex items-center gap-1.5 rounded-[8px] border border-border-subtle bg-surface-2 px-3 py-1.5 font-mono tabular-nums">
              <span className="text-text-muted">{t("Total Drivers", "إجمالي الكباتن")}:</span>
              <span className="font-bold text-text-primary">{totalCount}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-[8px] border border-border-subtle bg-surface-2 px-3 py-1.5 font-mono tabular-nums">
              <span className="h-2 w-2 rounded-full bg-status-active" />
              <span className="text-text-muted">{t("On Highway", "على الطريق")}:</span>
              <span className="font-bold text-status-active">{onTripCount}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-[8px] border border-border-subtle bg-surface-2 px-3 py-1.5 font-mono tabular-nums">
              <span className="h-2 w-2 rounded-full bg-brand" />
              <span className="text-text-muted">{t("Available", "متاح")}:</span>
              <span className="font-bold text-brand">{availableCount}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-[8px] border border-border-subtle bg-surface-2 px-3 py-1.5 font-mono tabular-nums">
              <span className="h-2 w-2 rounded-full bg-status-waiting" />
              <span className="text-text-muted">{t("Rest / Leave", "راحة/إجازة")}:</span>
              <span className="font-bold text-status-waiting">{restCount}</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {/* Segmented Filter */}
          <div className="flex flex-wrap items-center gap-1 rounded-[10px] bg-surface-2 p-1 border border-border-subtle">
            {(
              [
                ["ALL", t("All Crew", "الكل")],
                ["on_trip", t("On Road", "في رحلة")],
                ["available", t("Available", "متاح")],
                ["rest", t("Rest", "راحة")],
                ["leave", t("Leave", "إجازة")],
              ] as [DriverStatusFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={cn(
                  "rounded-[7px] px-3 py-1.5 text-[11.5px] font-semibold transition-all",
                  statusFilter === key
                    ? "bg-surface-4 text-text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Search by driver name, phone, license...", "ابحث بالاسم، الجوال، أو رقم الرخصة...")}
              className="w-full rounded-[8px] border border-border-subtle bg-surface-2 px-3 py-1.5 ps-9 text-[12px] text-text-primary placeholder:text-text-muted outline-none focus:border-brand"
            />
            <span className="absolute start-3 top-1/2 -translate-y-1/2 text-text-muted">
              <IconSearch size={14} />
            </span>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <IconClose size={13} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Split View */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Column: Driver Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 scroll-thin">
          {filteredDrivers.length === 0 ? (
            <div className="grid h-64 place-items-center rounded-[12px] border border-dashed border-border-subtle p-8 text-center">
              <div>
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-text-muted">
                  <IconDriver size={22} />
                </span>
                <p className="mt-3 text-[14px] font-semibold text-text-primary">
                  {t("No drivers found matching your search", "لم يتم العثور على سائقين مطابقين للبحث")}
                </p>
                <p className="mt-1 text-[12px] text-text-muted">
                  {t("Try clearing your search query or adjusting filters", "جرب إعادة ضبط الفلاتر أو تغيير نص البحث")}
                </p>
                <button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                  }}
                  className="btn-ghost mt-3 text-[12px]"
                >
                  {t("Reset filters", "إعادة ضبط الفلاتر")}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredDrivers.map((driver) => {
                const isSelected = selectedDriver?.id === driver.id;
                const statusCfg = STATUS_CONFIG[driver.status] || STATUS_CONFIG.available;
                const truck = trucks.find((v) => v.id === driver.assignedTruckId);
                const activeTr = trips.find((tr) => tr.driverId === driver.id && tr.status === "on_road");

                return (
                  <div
                    key={driver.id}
                    onClick={() => setSelectedDriverId(driver.id)}
                    className={cn(
                      "cursor-pointer rounded-[12px] border p-4 transition-all duration-200 text-start flex flex-col justify-between",
                      isSelected
                        ? "border-brand bg-brand/5 shadow-md"
                        : "border-border-subtle bg-surface-1 hover:border-border-subtle hover:bg-surface-2",
                    )}
                  >
                    <div>
                      {/* Driver Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-3 font-mono text-[13px] font-bold text-text-primary border border-border-subtle">
                            {driver.initials}
                          </span>
                          <div>
                            <div className="text-[14px] font-bold text-text-primary leading-tight">
                              {driver.name}
                            </div>
                            <div className="mt-0.5 font-mono text-[11px] text-text-muted tabular-nums">
                              {driver.phone}
                            </div>
                          </div>
                        </div>

                        {/* Status Label */}
                        <div
                          className="rounded-[6px] px-2 py-0.5 text-[10.5px] font-bold"
                          style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}
                        >
                          {t(statusCfg.labelEn, statusCfg.labelAr)}
                        </div>
                      </div>

                      {/* Driver Info Rows */}
                      <div className="mt-3 space-y-1.5 border-t border-border-subtle pt-2.5 text-[11.5px]">
                        {/* Assigned Truck */}
                        <div className="flex items-center justify-between text-text-secondary">
                          <span className="text-text-muted">{t("Assigned Truck", "الشاحنة المخصصة")}:</span>
                          {truck ? (
                            <span className="flex items-center gap-1.5 font-semibold text-text-primary">
                              <TruckTypeIcon truckType={truck.body} size={14} />
                              <span className="font-mono text-[11px]">{truck.plate}</span>
                            </span>
                          ) : (
                            <span className="text-text-muted italic">{t("Unassigned", "غير مخصص")}</span>
                          )}
                        </div>

                        {/* Professional License */}
                        <div className="flex items-center justify-between text-text-secondary">
                          <span className="text-text-muted">{t("License Number", "رقم الرخصة المهنية")}:</span>
                          <span className="font-mono text-[11px] text-text-primary tabular-nums">
                            {driver.license}
                          </span>
                        </div>

                        {/* Performance & Completed Trips */}
                        <div className="flex items-center justify-between text-text-secondary">
                          <span className="text-text-muted">{t("Rating & Trips", "التقييم والرحلات")}:</span>
                          <span className="flex items-center gap-2 font-mono tabular-nums">
                            <span className="flex items-center gap-0.5 text-status-waiting font-bold">
                              <IconStar size={11} />
                              <span>{driver.rating.toFixed(2)}</span>
                            </span>
                            <span className="text-text-muted">·</span>
                            <span className="text-text-primary">{driver.trips} {t("trips", "رحلة")}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Active Trip Banner if currently on highway */}
                    {activeTr && (
                      <div className="mt-3 rounded-[8px] bg-surface-3 p-2 border border-border-subtle">
                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="font-bold text-status-active flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-status-active animate-pulse" />
                            <span>{t("In Transit", "على الطريق")}</span>
                          </span>
                          <span className="font-mono text-brand font-semibold">{activeTr.tripNumber}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-text-secondary truncate">
                          {td(activeTr.originCity)} → {td(activeTr.destinationCity)}
                        </div>
                      </div>
                    )}

                    {/* Card Actions */}
                    <div className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCallModal(driver);
                        }}
                        className="btn-ghost flex-1 py-1 text-[11px]"
                      >
                        {t("Contact Driver", "اتصال بالسائق")}
                      </button>
                      {activeTr && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenTrip) {
                              selectTrip(activeTr.id);
                              onOpenTrip(activeTr.id);
                            }
                          }}
                          className="btn-primary py-1 px-2.5 text-[11px]"
                          title={t("Open Trip Details", "فتح تفاصيل الرحلة")}
                        >
                          <IconArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Driver Detailed Profile (Desktop Only) */}
        {selectedDriver && (
          <aside className="hidden w-[360px] shrink-0 border-s border-border-subtle bg-surface-1 overflow-y-auto p-5 xl:block scroll-thin">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                {t("Driver Profile & Logistics Card", "بطاقة السائق الميدانية")}
              </span>
              <div
                className="rounded-[6px] px-2 py-0.5 text-[10.5px] font-bold"
                style={{
                  color: STATUS_CONFIG[selectedDriver.status]?.color,
                  backgroundColor: STATUS_CONFIG[selectedDriver.status]?.bg,
                }}
              >
                {t(STATUS_CONFIG[selectedDriver.status]?.labelEn, STATUS_CONFIG[selectedDriver.status]?.labelAr)}
              </div>
            </div>

            {/* Profile Header */}
            <div className="mt-4 flex flex-col items-center text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-surface-3 font-mono text-[18px] font-bold text-text-primary border-2 border-brand/30 shadow-md">
                {selectedDriver.initials}
              </span>
              <h2 className="mt-2 text-[17px] font-bold text-text-primary">
                {selectedDriver.name}
              </h2>
              <div className="mt-0.5 font-mono text-[12px] text-text-muted tabular-nums">
                {selectedDriver.phone}
              </div>
              <div className="mt-2 flex items-center gap-1 rounded-full bg-status-waiting/10 px-3 py-1 text-[11px] font-bold text-status-waiting">
                <IconStar size={12} />
                <span>{selectedDriver.rating.toFixed(2)} / 5.00</span>
                <span className="text-text-muted">·</span>
                <span className="text-text-secondary">{selectedDriver.trips} {t("completed trips", "رحلة منجزة")}</span>
              </div>
            </div>

            {/* Regulatory & Safety Checklist */}
            <div className="mt-5 rounded-[10px] bg-surface-2 p-3.5 border border-border-subtle space-y-2.5">
              <div className="text-[11.5px] font-bold text-text-primary border-b border-border-subtle pb-1.5">
                {t("Regulatory & Transport Authority Compliance", "الامتثال والتراخيص النظامية")}
              </div>
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-text-muted">{t("National ID / Iqama", "الهوية الوطنية / الإقامة")}:</span>
                <span className="font-mono text-text-primary tabular-nums">1082918273</span>
              </div>
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-text-muted">{t("Heavy Transport License", "رخصة نقل ثقيل عمومي")}:</span>
                <span className="font-mono text-text-primary tabular-nums">{selectedDriver.license}</span>
              </div>
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-text-muted">{t("License Expiry Date", "تاريخ انتهاء الرخصة")}:</span>
                <span className="font-mono text-status-active tabular-nums">2028-06-14 (سارية)</span>
              </div>
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-text-muted">{t("Medical Fitness", "الفحص الطبي المهني")}:</span>
                <span className="text-status-active font-semibold flex items-center gap-1">
                  <IconCheck size={12} />
                  <span>{t("Verified & Valid", "معتمد ومطابق")}</span>
                </span>
              </div>
            </div>

            {/* Assigned Vehicle Section */}
            <div className="mt-4 rounded-[10px] bg-surface-2 p-3.5 border border-border-subtle">
              <div className="text-[11.5px] font-bold text-text-primary border-b border-border-subtle pb-1.5">
                {t("Assigned Heavy Vehicle", "الشاحنة المخصصة للسائق")}
              </div>
              {assignedTruck ? (
                <div className="mt-2.5 space-y-2 text-[11.5px]">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">{t("Plate Number", "رقم اللوحة")}:</span>
                    <span className="font-mono font-bold text-brand">{assignedTruck.plate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">{t("Vehicle Category", "فئة الشاحنة")}:</span>
                    <span className="flex items-center gap-1 font-semibold text-text-primary">
                      <TruckTypeIcon truckType={assignedTruck.body} size={14} />
                      <span>{getVehicleTypeMeta(normalizeVehicleType(assignedTruck.body)).arabicName}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">{t("Model & Power", "الموديل والقوة")}:</span>
                    <span className="text-text-primary">{assignedTruck.model} ({assignedTruck.hp || 510} HP)</span>
                  </div>
                  {onOpenTruck && (
                    <button
                      onClick={() => {
                        selectTruck(assignedTruck.id);
                        onOpenTruck(assignedTruck.id);
                      }}
                      className="btn-ghost w-full mt-2 py-1 text-[11px]"
                    >
                      {t("View Vehicle in Fleet Manager", "عرض الشاحنة في مدير الأسطول")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-2 text-[11.5px] text-text-muted italic text-center py-2">
                  {t("No truck currently assigned to this driver", "لا توجد شاحنة مخصصة لهذا السائق حالياً")}
                </div>
              )}
            </div>

            {/* Current Active Trip if any */}
            {currentTrip && (
              <div className="mt-4 rounded-[10px] bg-surface-2 p-3.5 border border-border-subtle">
                <div className="flex items-center justify-between border-b border-border-subtle pb-1.5">
                  <span className="text-[11.5px] font-bold text-text-primary">
                    {t("Active Highway Trip", "الرحلة الجارية")}
                  </span>
                  <span className="font-mono text-brand font-bold text-[11px]">{currentTrip.tripNumber}</span>
                </div>
                <div className="mt-2 space-y-1.5 text-[11.5px]">
                  <div className="text-text-secondary">
                    {td(currentTrip.originCity)} → {td(currentTrip.destinationCity)}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-text-muted tabular-nums">
                    <span>{t("Progress", "الإنجاز")}: {currentTrip.progressPct}%</span>
                    <span>{currentTrip.speedKmH} {t("km/h", "كم/س")}</span>
                  </div>
                  {onOpenTrip && (
                    <button
                      onClick={() => {
                        selectTrip(currentTrip.id);
                        onOpenTrip(currentTrip.id);
                      }}
                      className="btn-primary w-full mt-2 py-1.5 text-[11.5px]"
                    >
                      <span>{t("Track Live Trip", "تتبع مسار الرحلة مباشرة")}</span>
                      <IconArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Call / Contact Modal */}
      {showCallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-[14px] bg-surface-1 p-5 border border-border-subtle shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-[15px] font-bold text-text-primary">
                {t("Contact Driver", "الاتصال الميداني بالسائق")}
              </h3>
              <button
                onClick={() => setShowCallModal(null)}
                className="btn-icon-sm"
              >
                <IconClose size={15} />
              </button>
            </div>

            <div className="mt-4 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand/15 font-mono text-[16px] font-bold text-brand">
                {showCallModal.initials}
              </span>
              <div className="mt-2 text-[16px] font-bold text-text-primary">
                {showCallModal.name}
              </div>
              <div className="font-mono text-[13px] text-text-secondary mt-0.5 tabular-nums">
                {showCallModal.phone}
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <a
                href={`tel:${showCallModal.phone}`}
                onClick={() => {
                  toast(t("Direct call initiated", "جاري الاتصال المباشر بالسائق"), showCallModal.phone);
                  setShowCallModal(null);
                }}
                className="btn-primary w-full py-2.5 text-center text-[12.5px]"
              >
                {t("Call Cellular Phone", "اتصال هاتفي مباشر")}
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(showCallModal.phone);
                  toast(t("Phone number copied to clipboard", "تم نسخ رقم الجوال بنجاح"), showCallModal.phone);
                  setShowCallModal(null);
                }}
                className="btn-ghost w-full py-2 text-[12px]"
              >
                {t("Copy Phone Number", "نسخ رقم الهاتف")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
