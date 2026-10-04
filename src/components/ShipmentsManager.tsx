import { useState, useMemo } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore, type Trip, type TripStatus } from "../state/fleetStore";
import {
  APPROVED_VEHICLE_TYPES,
  getVehicleTypeMeta,
  normalizeVehicleType,
  type CanonicalVehicleTypeId,
} from "../data/vehicleTypes";
import { Vehicle3DViewer } from "./Vehicle3DViewer";
import { TruckTypeIcon, TruckTypeAvatar } from "./TruckTypeIcon";
import {
  IconSearch,
  IconClose,
  IconTruck,
  IconDoc,
  IconArrowRight,
} from "./Icons";

interface ShipmentsManagerProps {
  onOpenTrip?: (tripId: string) => void;
  onOpenTruck?: (truckId: string) => void;
  onOpenLiveMap?: (tripId: string) => void;
}

export function ShipmentsManager({
  onOpenTrip,
  onOpenTruck,
  onOpenLiveMap,
}: ShipmentsManagerProps) {
  const { t } = useSettings();
  const { trips, trucks, drivers, selectTrip, selectTruck } = useFleetStore();

  const [search, setSearch] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<"ALL" | CanonicalVehicleTypeId>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [selectedShipmentTrip, setSelectedShipmentTrip] = useState<Trip | null>(null);
  const [showPodModal, setShowPodModal] = useState(false);

  // Filtered trips representing shipments
  const filteredShipments = useMemo(() => {
    return trips.filter((tr) => {
      // Type filter (strictly 4 types)
      const normType = normalizeVehicleType(tr.cargoType);
      if (selectedTypeFilter !== "ALL" && normType !== selectedTypeFilter) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter !== "ALL") {
        if (selectedStatusFilter === "on_road" && tr.status !== "on_road") return false;
        if (selectedStatusFilter === "loading" && tr.status !== "loading") return false;
        if (selectedStatusFilter === "delivered" && tr.status !== "delivered" && tr.status !== "completed") return false;
      }

      // Search query filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const truck = trucks.find((v) => v.id === tr.truckId);
        const driver = drivers.find((d) => d.id === tr.driverId);
        const hay = `
          ${tr.tripNumber} ${tr.qrCodeToken} ${tr.shipper} ${tr.consignee}
          ${tr.originCity} ${tr.destinationCity} ${truck?.plate || ""}
          ${truck?.model || ""} ${driver?.name || ""}
        `.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [trips, trucks, drivers, selectedTypeFilter, selectedStatusFilter, search]);

  const getStatusBadge = (status: TripStatus) => {
    switch (status) {
      case "on_road":
        return {
          labelAr: "على الطريق",
          labelEn: "In Transit",
          color: "bg-status-active/15 text-status-active border-status-active/30",
        };
      case "loading":
        return {
          labelAr: "جاري التحميل",
          labelEn: "Loading",
          color: "bg-status-waiting/15 text-status-waiting border-status-waiting/30",
        };
      case "delivered":
      case "completed":
        return {
          labelAr: "تم التسليم",
          labelEn: "Delivered",
          color: "bg-accent-2/15 text-accent-2 border-accent-2/30",
        };
      default:
        return {
          labelAr: "مجدولة / تخطيط",
          labelEn: "Scheduled",
          color: "bg-surface-4 text-text-secondary border-border-subtle",
        };
    }
  };

  const handleOpenDetails = (tr: Trip) => {
    setSelectedShipmentTrip(tr);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-0">
      {/* Header with Title and Global Search */}
      <div className="shrink-0 border-b border-border-subtle p-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
              {t("Enterprise Shipments Control", "مركز إدارة الشحنات اللوجستية")}
            </h1>
            <p className="text-[12px] text-text-secondary mt-0.5">
              {t(
                `Tracking ${filteredShipments.length} active consignments across Saudi corridors`,
                `متابعة وتدقيق ${filteredShipments.length} شحنة نشطة عبر الممرات اللوجستية بالمملكة`
              )}
            </p>
          </div>

          {/* Quick Search */}
          <div className="flex items-center gap-2 rounded-full bg-surface-2 px-3.5 py-1.5 border border-border-subtle w-full sm:w-[320px]">
            <IconSearch size={16} className="text-text-muted shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                "Search shipment, trip, customer, plate...",
                "ابحث برقم الشحنة، الرحلة، العميل، اللوحة..."
              )}
              className="w-full bg-transparent text-[12.5px] text-text-primary placeholder:text-text-muted outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-text-muted hover:text-text-primary"
              >
                <IconClose size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Toolbar: 4 Vehicle Types Only + Canonical Status */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border-subtle/60">
          {/* 4 Approved Vehicle Types */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] font-semibold text-text-muted me-1">
              {t("Type", "النوع")}:
            </span>
            <button
              onClick={() => setSelectedTypeFilter("ALL")}
              className={cn(
                "px-3 py-1 rounded-full text-[11.5px] font-semibold transition-colors",
                selectedTypeFilter === "ALL"
                  ? "bg-brand text-on-brand shadow-sm"
                  : "bg-surface-2 text-text-secondary hover:text-text-primary"
              )}
            >
              {t("All Types", "الكل")}
            </button>
            {(["flatbed", "reefer", "dry", "curtain"] as CanonicalVehicleTypeId[]).map((tid) => {
              const meta = APPROVED_VEHICLE_TYPES[tid];
              const isSelected = selectedTypeFilter === tid;
              return (
                <button
                  key={tid}
                  onClick={() => setSelectedTypeFilter(tid)}
                  className={cn(
                    "px-3 py-1 rounded-full text-[11.5px] font-semibold transition-colors flex items-center gap-1.5 border",
                    isSelected
                      ? "bg-brand text-on-brand border-brand font-bold shadow-sm"
                      : "bg-surface-2 text-text-secondary border-border-subtle hover:text-text-primary"
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: isSelected ? "var(--color-navy)" : meta.accentColor }}
                  />
                  <span>{meta.arabicName}</span>
                </button>
              );
            })}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-text-muted me-1">
              {t("Status", "الحالة")}:
            </span>
            {[
              ["ALL", t("All", "الكل")],
              ["on_road", t("On Road", "على الطريق")],
              ["loading", t("Loading", "قيد التحميل")],
              ["delivered", t("Delivered", "تم التسليم")],
            ].map(([st, label]) => (
              <button
                key={st}
                onClick={() => setSelectedStatusFilter(st)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
                  selectedStatusFilter === st
                    ? "bg-surface-4 text-text-primary border border-border-subtle"
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area: High-Density Shipments Grid */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {filteredShipments.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center p-6 bg-surface-1 rounded-[14px] border border-border-subtle">
            <IconTruck size={36} className="text-text-muted mb-2" />
            <h3 className="text-[14px] font-semibold text-text-primary">
              {t("No shipments found", "لا توجد شحنات مطابقة")}
            </h3>
            <p className="text-[12px] text-text-muted mt-1 max-w-sm">
              {t(
                "Try adjusting your search criteria or resetting the 4-type vehicle filters.",
                "يرجى تعديل معايير البحث أو اختيار أحد أنواع الشاحنات الأربعة المعتمدة."
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredShipments.map((tr) => {
              const truck = trucks.find((v) => v.id === tr.truckId) || trucks[0];
              const driver = drivers.find((d) => d.id === tr.driverId) || drivers[0];
              const normType = normalizeVehicleType(tr.cargoType);
              const meta = getVehicleTypeMeta(normType);
              const statusBadge = getStatusBadge(tr.status);

              return (
                <div
                  key={tr.id}
                  className="bg-surface-1 rounded-[12px] border border-border-subtle hover:border-brand/40 transition-all duration-200 shadow-sm flex flex-col justify-between overflow-hidden"
                >
                  {/* Card Header with prominent Truck Type Avatar */}
                  <div className="p-4 border-b border-white/5 flex items-start gap-3">
                    <TruckTypeAvatar truckType={tr.cargoType} size={42} iconSize={22} showBadge />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[13px] text-brand">
                            {tr.qrCodeToken || `SH-${tr.tripNumber}`}
                          </span>
                          <span className="text-text-muted text-[11px]">·</span>
                          <span className="font-mono text-[11px] text-text-secondary">
                            {tr.tripNumber}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[10px] font-bold border",
                            statusBadge.color
                          )}
                        >
                          {statusBadge.labelAr}
                        </span>
                      </div>

                      <div className="mt-1 text-[13px] font-semibold text-text-primary truncate">
                        {tr.shipper}
                      </div>
                    </div>
                  </div>

                  {/* Card Body: Route, Vehicle, Cargo, Driver */}
                  <div className="p-4 space-y-3 text-[12px]">
                    {/* Origin -> Destination Route */}
                    <div className="flex items-center justify-between gap-2 bg-surface-2 p-2 rounded-[8px] border border-white/5">
                      <div className="truncate">
                        <div className="text-[10px] text-text-muted">{t("From", "من")}</div>
                        <div className="font-semibold text-text-primary truncate">{tr.originCity}</div>
                      </div>
                      <span className="text-brand font-bold">→</span>
                      <div className="truncate text-end">
                        <div className="text-[10px] text-text-muted">{t("To", "إلى")}</div>
                        <div className="font-semibold text-text-primary truncate">{tr.destinationCity}</div>
                      </div>
                    </div>

                    {/* Vehicle & 4-Type Badge */}
                    <div className="flex items-center justify-between gap-2 text-[11.5px]">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] font-bold text-[10.5px]"
                          style={{
                            backgroundColor: meta.badgeBg,
                            color: meta.accentColor,
                          }}
                        >
                          <TruckTypeIcon truckType={tr.cargoType} size={14} />
                          {meta.arabicName}
                        </span>
                        <span className="font-mono text-text-primary">{truck.plate}</span>
                      </div>
                      <div className="text-text-muted text-[11px] tabular-nums">
                        {tr.cargoWeightTons} / {tr.maxCapacityTons} {t("tons", "طن")}
                      </div>
                    </div>

                    {/* Driver & Telemetry */}
                    <div className="flex items-center justify-between text-[11px] text-text-secondary border-t border-white/5 pt-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="h-2 w-2 rounded-full bg-status-active" />
                        <span className="truncate">{driver.name}</span>
                      </div>
                      {tr.speedKmH > 0 && (
                        <div className="tabular-nums font-bold text-status-active">
                          {tr.speedKmH} {t("km/h", "كم/س")}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="bg-surface-2 px-4 py-2.5 border-t border-border-subtle flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenDetails(tr)}
                      className="text-brand hover:underline text-[11.5px] font-semibold"
                    >
                      {t("Shipment Details & 3D", "تفاصيل الشحنة والمجسم")}
                    </button>
                    <div className="flex items-center gap-1.5">
                      {onOpenTrip && (
                        <button
                          onClick={() => {
                            selectTrip(tr.id);
                            onOpenTrip(tr.id);
                          }}
                          className="p-1 rounded-[6px] bg-surface-3 hover:bg-surface-4 text-text-secondary hover:text-text-primary transition-colors text-[10.5px] px-2 font-medium"
                          title={t("Trip Manager", "إدارة الرحلة")}
                        >
                          {t("Trip", "الرحلة")}
                        </button>
                      )}
                      {onOpenTruck && (
                        <button
                          onClick={() => {
                            selectTruck(tr.truckId);
                            onOpenTruck(tr.truckId);
                          }}
                          className="p-1 rounded-[6px] bg-surface-3 hover:bg-surface-4 text-text-secondary hover:text-text-primary transition-colors text-[10.5px] px-2 font-medium"
                          title={t("Fleet Manager", "إدارة الأسطول")}
                        >
                          {t("Truck", "الشاحنة")}
                        </button>
                      )}
                      {onOpenLiveMap && (
                        <button
                          onClick={() => {
                            selectTrip(tr.id);
                            selectTruck(tr.truckId);
                            onOpenLiveMap(tr.id);
                          }}
                          className="p-1 rounded-[6px] bg-surface-3 hover:bg-surface-4 text-text-secondary hover:text-text-primary transition-colors text-[10.5px] px-2 font-medium"
                          title={t("Track on Live Map", "تتبع على الخريطة")}
                        >
                          {t("Map", "الخريطة")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Shipment Details Hierarchy Modal: Shipment -> Trip -> Vehicle 3D -> Driver -> GPS -> Timeline -> POD */}
      {selectedShipmentTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 lg:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-surface-1 rounded-[16px] border border-border-subtle shadow-2xl flex flex-col overflow-hidden text-text-primary">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 lg:px-6 border-b border-border-subtle">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[15px] text-brand">
                    {selectedShipmentTrip.qrCodeToken || `SH-${selectedShipmentTrip.tripNumber}`}
                  </span>
                  <span className="text-text-muted">·</span>
                  <span className="font-mono text-[13px] text-text-secondary">
                    {selectedShipmentTrip.tripNumber}
                  </span>
                </div>
                <div className="text-[12px] text-text-secondary mt-0.5">
                  {selectedShipmentTrip.shipper} → {selectedShipmentTrip.consignee}
                </div>
              </div>
              <button
                onClick={() => setSelectedShipmentTrip(null)}
                className="btn-icon-sm"
                aria-label="Close"
              >
                <IconClose size={16} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
              {/* 1. 3D Vehicle Showcase (Real Vehicle Mode) */}
              <div className="bg-surface-2 rounded-[14px] border border-border-subtle overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-text-secondary">
                    {t("3D Verified Vehicle Model", "مجسم المركبة ثلاثي الأبعاد المعتمد")}
                  </span>
                  <span className="text-[11px] font-mono text-brand">
                    {getVehicleTypeMeta(selectedShipmentTrip.cargoType).arabicName}
                  </span>
                </div>
                <div className="h-[260px] w-full">
                  <Vehicle3DViewer
                    vehicleType={selectedShipmentTrip.cargoType}
                    previewMode={false}
                    height="100%"
                    compact={true}
                  />
                </div>
              </div>

              {/* 2. Shipment & Route Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px]">
                <div className="bg-surface-2 p-4 rounded-[10px] border border-white/5 space-y-2.5">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wide">
                    {t("Pickup & Loading Point", "نقطة التحميل والاستلام")}
                  </div>
                  <div className="font-semibold text-text-primary">
                    {selectedShipmentTrip.originCity}
                  </div>
                  <div className="text-text-secondary text-[11.5px]">
                    {selectedShipmentTrip.originTerminal}
                  </div>
                  <div className="text-[10.5px] text-text-muted">
                    {t("Departure", "وقت المغادرة")}: {selectedShipmentTrip.departureTime || "اليوم ٠٧:١٥ ص"}
                  </div>
                </div>

                <div className="bg-surface-2 p-4 rounded-[10px] border border-white/5 space-y-2.5">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wide">
                    {t("Delivery Point & Consignee", "نقطة التسليم والتفريغ")}
                  </div>
                  <div className="font-semibold text-text-primary">
                    {selectedShipmentTrip.destinationCity}
                  </div>
                  <div className="text-text-secondary text-[11.5px]">
                    {selectedShipmentTrip.destinationTerminal}
                  </div>
                  <div className="text-[10.5px] text-text-muted">
                    {t("Est. Arrival", "الوصول المقدر")}: {selectedShipmentTrip.etaMinutes} {t("minutes", "دقيقة")}
                  </div>
                </div>
              </div>

              {/* 3. Canonical Trip Timeline (Section 9) */}
              <div className="bg-surface-2 p-4 rounded-[12px] border border-white/5">
                <div className="text-[12px] font-bold text-text-primary mb-3">
                  {t("Shipment & Trip Lifecycle Timeline", "المخطط الزمني لمراحل الشحنة والرحلة")}
                </div>

                {/* Canonical Statuses only */}
                <div className="relative ps-6 space-y-4 text-[11.5px]">
                  <span className="absolute top-2 bottom-2 start-[7px] w-0.5 bg-border-subtle" />

                  {[
                    { step: "Trip Created", labelAr: "إنشاء أمر الرحلة والشحنة", state: "done" },
                    { step: "Driver Assigned", labelAr: "إسناد وتكليف السائق المعتمد", state: "done" },
                    { step: "Truck Assigned", labelAr: "تخصيص الشاحنة ومطابقة الوزن", state: "done" },
                    { step: "Loading", labelAr: "اكتمال التحميل والربط الآمن", state: "done" },
                    { step: "In Transit", labelAr: "الإبحار المباشر عبر الممر اللوجستي", state: selectedShipmentTrip.status === "on_road" ? "current" : "done" },
                    { step: "Arrived at Destination", labelAr: "الوصول إلى بوابة الوجهة النهائية", state: "pending" },
                    { step: "Unloading", labelAr: "التفريغ وفحص سلامة الحاويات", state: "pending" },
                    { step: "Delivered", labelAr: "التسليم وتوقيع بوليصة POD", state: "pending" },
                    { step: "Completed", labelAr: "إغلاق الرحلة وتأكيد القيود المالية", state: "pending" },
                  ].map((node, idx) => (
                    <div key={idx} className="relative flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "absolute -start-6 h-3.5 w-3.5 rounded-full border-2",
                          node.state === "done"
                            ? "bg-status-active border-surface-2"
                            : node.state === "current"
                            ? "bg-brand border-white animate-pulse"
                            : "bg-surface-4 border-surface-2"
                        )}
                      />
                      <span
                        className={cn(
                          node.state === "current"
                            ? "font-bold text-brand"
                            : node.state === "done"
                            ? "text-text-primary"
                            : "text-text-muted"
                        )}
                      >
                        {node.labelAr}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">
                        {node.state === "done" ? "✓" : node.state === "current" ? "● الآن" : "○"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Electronic POD & Documents */}
              <div className="bg-surface-2 p-4 rounded-[12px] border border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-bold text-text-primary">
                    {t("Electronic POD & Consignment Docs", "إثبات التسليم الإلكتروني (POD) والوثائق")}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    {t("Digital Bill of Lading, Weight Ticket & Inspection Certificate", "بوليصة شحن رقمية، بطاقة وزن، وشهادة فحص الشاحنة")}
                  </div>
                </div>
                <button
                  onClick={() => setShowPodModal(true)}
                  className="btn-primary text-[11.5px] px-3.5 py-1.5"
                >
                  <IconDoc size={14} />
                  <span>{t("View POD & Documents", "عرض الوثائق و POD")}</span>
                </button>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-border-subtle bg-surface-2 flex items-center justify-between">
              <button
                onClick={() => setSelectedShipmentTrip(null)}
                className="btn-ghost text-[12px]"
              >
                {t("Close", "إغلاق")}
              </button>

              <div className="flex items-center gap-2">
                {onOpenLiveMap && (
                  <button
                    onClick={() => {
                      const tr = selectedShipmentTrip;
                      setSelectedShipmentTrip(null);
                      selectTrip(tr.id);
                      selectTruck(tr.truckId);
                      onOpenLiveMap(tr.id);
                    }}
                    className="btn-primary text-[12px] px-4"
                  >
                    <span>{t("Track on Live Map", "تتبع المركبة على الخريطة")}</span>
                    <IconArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simple POD Viewer Modal */}
      {showPodModal && selectedShipmentTrip && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-surface-1 rounded-[14px] p-5 border border-border-subtle text-text-primary">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="font-bold text-[14px] text-brand">
                {t("Official Electronic Proof of Delivery (POD)", "إثبات التسليم الإلكتروني الرسمي (POD)")}
              </h3>
              <button onClick={() => setShowPodModal(false)} className="btn-icon-sm">
                <IconClose size={15} />
              </button>
            </div>
            <div className="py-4 space-y-3 text-[12px]">
              <div className="bg-surface-2 p-3 rounded-[8px] space-y-1">
                <div className="text-[10.5px] text-text-muted">{t("Consignment ID", "رقم الشحنة")}</div>
                <div className="font-mono font-bold text-text-primary">{selectedShipmentTrip.qrCodeToken}</div>
              </div>
              <div className="bg-surface-2 p-3 rounded-[8px] space-y-1">
                <div className="text-[10.5px] text-text-muted">{t("Approved Vehicle Category", "فئة المركبة المعتمدة")}</div>
                <div className="font-bold text-brand">{getVehicleTypeMeta(selectedShipmentTrip.cargoType).arabicName}</div>
              </div>
              <div className="bg-surface-2 p-3 rounded-[8px] space-y-1">
                <div className="text-[10.5px] text-text-muted">{t("Security Seal Code", "رمز الختم الجمركي المعتمد")}</div>
                <div className="font-mono text-status-active font-bold">EJAZ-SEAL-2026-9941</div>
              </div>
            </div>
            <button
              onClick={() => setShowPodModal(false)}
              className="w-full btn-primary py-2 text-[12px] font-bold mt-2"
            >
              {t("Done", "تم")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
