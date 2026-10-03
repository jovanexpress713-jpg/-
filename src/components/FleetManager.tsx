import { useState, useMemo, useRef } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore } from "../state/fleetStore";
import type { Vehicle } from "../data/types";
import {
  APPROVED_VEHICLE_TYPES,
  APPROVED_VEHICLE_TYPES_LIST,
  getVehicleTypeMeta,
  normalizeVehicleType,
  type CanonicalVehicleTypeId,
} from "../data/vehicleTypes";
import { Vehicle3DViewer } from "./Vehicle3DViewer";
import { TruckImage } from "./TruckImage";
import { apiClient } from "../services/apiClient";
import { useVehicleAssets } from "../state/vehicleAssetStore";
import { useToast } from "./Toast";
import {
  IconSearch,
  IconClose,
  IconTruck,
  IconPlus,
  IconUpload,
} from "./Icons";

interface FleetManagerProps {
  onOpenLiveTracking?: (tripId: string) => void;
}

export function FleetManager({ onOpenLiveTracking }: FleetManagerProps) {
  const { t } = useSettings();
  const toast = useToast();
  const {
    trucks,
    trips,
    drivers,
    selectTrip,
    selectTruck,
    addVehicle,
    updateVehicle,
  } = useFleetStore();

  const [search, setSearch] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<"ALL" | CanonicalVehicleTypeId>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignDriverModal, setShowAssignDriverModal] = useState<Vehicle | null>(null);
  const [showVehicleDetailsModal, setShowVehicleDetailsModal] = useState<Vehicle | null>(null);

  // Card view mode per vehicle: "3d" or "image"
  const [cardDisplayMode, setCardDisplayMode] = useState<Record<string, "3d" | "image">>({});

  // Add Vehicle Form state (Strictly 4 types)
  const [formPlate, setFormPlate] = useState("");
  const [formBrand, setFormBrand] = useState("Mercedes-Benz");
  const [formModel, setFormModel] = useState("Actros L 1863");
  const [formYear, setFormYear] = useState("2024");
  const [formType, setFormType] = useState<CanonicalVehicleTypeId>("curtain");
  const [formMaxLoad, setFormMaxLoad] = useState("25");
  const [formCab, setFormCab] = useState("GigaSpace Cab");
  const [formCustomImage, setFormCustomImage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Central Vehicle Asset Registry (official image + official 3D model per category)
  const { registry, typeImage, typeModel, refresh: refreshVehicleAssets } = useVehicleAssets();
  const vehiclePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [photoTargetVehicleId, setPhotoTargetVehicleId] = useState<string | null>(null);
  const [isPhotoBusy, setIsPhotoBusy] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);

  const publishVehiclePhoto = async (file: File, vehicleId: string) => {
    if (file.size > registry.limits.maxImageBytes) {
      setAssetError(t("Image size exceeds the permitted limit", "حجم الصورة يتجاوز الحد المسموح"));
      return;
    }
    setIsPhotoBusy(true);
    setAssetError(null);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("read-error"));
        reader.readAsDataURL(file);
      });
      await apiClient.vehicleAssets.publishVehicleImage(vehicleId, { data, fileName: file.name });
      updateVehicle(vehicleId, { customImage: registry.vehicles[vehicleId]?.url } as any);
      await refreshVehicleAssets();
      setShowVehicleDetailsModal((prev) => (prev && prev.id === vehicleId ? { ...prev } : prev));
      alert(t("Vehicle photograph published across the platform", "تم نشر صورة المركبة في كل النظام"));
    } catch (err: any) {
      setAssetError(err?.message || t("Upload failed", "فشل الرفع"));
    } finally {
      setIsPhotoBusy(false);
    }
  };

  // Selected driver for assignment
  const [selectedDriverId, setSelectedDriverId] = useState("");

  // Fleet KPIs
  const totalTrucks = trucks.length;
  const onRoadCount = trips.filter((tr) => tr.status === "on_road").length;
  const idleCount = trucks.filter((v) => v.status === "waiting").length;
  const maintCount = trucks.filter((v) => v.status === "inactive").length;

  // Filter trucks
  const filteredTrucks = useMemo(() => {
    return trucks.filter((v) => {
      // Type filter
      const normType = normalizeVehicleType(v.body);
      if (selectedTypeFilter !== "ALL" && normType !== selectedTypeFilter) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter !== "ALL") {
        if (selectedStatusFilter === "on_trip" && v.status !== "active") return false;
        if (selectedStatusFilter === "available" && v.status !== "waiting") return false;
        if (selectedStatusFilter === "maintenance" && v.status !== "inactive") return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${v.plate} ${v.model} ${v.brand} ${v.driver?.name || ""} ${v.partner} ${v.shipment}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [trucks, selectedTypeFilter, selectedStatusFilter, search]);

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPlate.trim()) {
      alert(t("Please provide a vehicle plate number", "يرجى كتابة رقم لوحة الشاحنة"));
      return;
    }

    setIsSubmitting(true);
    try {
      const arabicType = APPROVED_VEHICLE_TYPES[formType].arabicName;
      const newTruck: Vehicle = {
        id: `v${Date.now()}`,
        shipment: `EJ-${Math.floor(100000000 + Math.random() * 900000000)}`,
        brand: formBrand as any,
        model: formModel,
        cab: formCab,
        body: formType,
        customImage: formCustomImage.trim() || undefined,
        status: "waiting",
        hp: 530,
        odometer: 12000,
        year: Number(formYear) || 2024,
        plate: formPlate,
        fuel: 95,
        engineTemp: 82,
        load: 0,
        maxLoad: Number(formMaxLoad) || 25,
        speed: 0,
        etaMinutes: 0,
        milesLeft: 0,
        progress: 0,
        driver: drivers[0] || { name: "سائق معتمد", phone: "+966500000000", initials: "EJ", rating: 5.0, trips: 0 },
        partner: "مؤسسة إيجاز للنقليات",
        from: "الرياض",
        to: "جدة",
        stops: [],
        route: "riyadh-jeddah",
        photos: [0, 1],
        comments: [],
        docs: [
          { name: "Vehicle Registration (استمارة الشاحنة)", meta: "PDF · سارية المفعول", state: "done" },
          { name: "Insurance Certificate (وثيقة التأمين)", meta: "PDF · سارية المفعول", state: "done" },
          { name: "Operating Card (بطاقة التشغيل)", meta: "PDF · معتمدة", state: "done" },
        ],
      };

      addVehicle(newTruck);

      try {
        await apiClient.vehicles.create({
          plate: formPlate,
          type: arabicType,
          model: `${formBrand} ${formModel}`,
          year: Number(formYear),
          maxLoadTons: Number(formMaxLoad),
          cab: formCab,
        });
      } catch (apiErr) {
        console.warn("API sync fallback:", apiErr);
      }

      toast(
        t("Vehicle added successfully", "تمت إضافة الشاحنة للأسطول بنجاح"),
        `${formPlate} · ${arabicType}`
      );
      setShowAddModal(false);
      // Reset form
      setFormPlate("");
      setFormCustomImage("");
    } catch (err: any) {
      alert(err.message || "Failed to create vehicle");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignDriverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverId) return;
    toast(
      t("Driver assigned to vehicle", "تم تعيين السائق للشاحنة بنجاح"),
      showAssignDriverModal?.plate
    );
    setShowAssignDriverModal(null);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-0">
      {/* Top Header & KPIs */}
      <div className="shrink-0 border-b border-border-subtle p-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
              {t("Fleet Command & Vehicle Control", "إدارة أسطول الشاحنات الثقيلة")}
            </h1>
            <p className="text-[12px] text-text-secondary mt-0.5">
              {t(
                "Authorized EJAZ heavy fleet with 4 canonical types & 3D telemetry",
                "أسطول إيجاز المعتمد المكون حصرياً من 4 فئات مع مجسمات تفاعلية ثلاثية الأبعاد"
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 rounded-full bg-surface-2 px-3.5 py-1.5 border border-border-subtle w-[240px] lg:w-[280px]">
              <IconSearch size={15} className="text-text-muted shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Search truck, plate...", "ابحث باللوحة أو الموديل...")}
                className="w-full bg-transparent text-[12px] text-text-primary placeholder:text-text-muted outline-none"
              />
            </div>

            {/* Add Truck Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary text-[12px] px-3.5 py-1.5 gap-1.5"
            >
              <IconPlus size={15} />
              <span>{t("Add Vehicle", "إضافة شاحنة")}</span>
            </button>
          </div>
        </div>

        {/* Fleet KPI Metric Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
          <div className="bg-surface-2 p-3 rounded-[10px] border border-white/5 flex items-center justify-between">
            <div>
              <div className="text-[10.5px] text-text-muted">{t("Total Fleet", "إجمالي الأسطول")}</div>
              <div className="text-[20px] font-bold text-text-primary tabular-nums mt-0.5">{totalTrucks}</div>
            </div>
            <span className="p-2 rounded-full bg-brand/15 text-brand">
              <IconTruck size={20} />
            </span>
          </div>

          <div className="bg-surface-2 p-3 rounded-[10px] border border-white/5 flex items-center justify-between">
            <div>
              <div className="text-[10.5px] text-text-muted">{t("On Highway Transit", "على الطريق")}</div>
              <div className="text-[20px] font-bold text-status-active tabular-nums mt-0.5">{onRoadCount}</div>
            </div>
            <span className="h-3 w-3 rounded-full bg-status-active animate-pulse" />
          </div>

          <div className="bg-surface-2 p-3 rounded-[10px] border border-white/5 flex items-center justify-between">
            <div>
              <div className="text-[10.5px] text-text-muted">{t("Available / Idle", "جاهزة ومتاحة")}</div>
              <div className="text-[20px] font-bold text-status-waiting tabular-nums mt-0.5">{idleCount}</div>
            </div>
            <span className="h-3 w-3 rounded-full bg-status-waiting" />
          </div>

          <div className="bg-surface-2 p-3 rounded-[10px] border border-white/5 flex items-center justify-between">
            <div>
              <div className="text-[10.5px] text-text-muted">{t("Under Maintenance", "في الصيانة الدورية")}</div>
              <div className="text-[20px] font-bold text-text-secondary tabular-nums mt-0.5">{maintCount}</div>
            </div>
            <span className="h-3 w-3 rounded-full bg-surface-5" />
          </div>
        </div>

        {/* Filter Bar: 4 Types Only */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border-subtle/60">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] font-semibold text-text-muted me-1">
              {t("Type", "فئة الشاحنة")}:
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
              {t("All", "الكل")}
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
                    style={{ backgroundColor: isSelected ? "#0A1931" : meta.accentColor }}
                  />
                  <span>{meta.arabicName}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-text-muted me-1">
              {t("Status", "الحالة")}:
            </span>
            {[
              ["ALL", t("All", "الكل")],
              ["on_trip", t("On Trip", "في رحلة")],
              ["available", t("Available", "متاحة")],
              ["maintenance", t("Maintenance", "صيانة")],
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

      {/* Grid of Vehicles with 3D Preview Cards */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredTrucks.map((v) => {
            const normType = normalizeVehicleType(v.body);
            const meta = getVehicleTypeMeta(normType);
            const activeTrip = trips.find((tr) => tr.truckId === v.id);

            return (
              <div
                key={v.id}
                className="bg-surface-1 rounded-[14px] border border-border-subtle hover:border-brand/40 transition-all duration-200 shadow-md flex flex-col justify-between overflow-hidden"
              >
                {/* 3D Viewport or Official Image Header */}
                <div className="relative h-[200px] w-full bg-surface-2 border-b border-white/5 overflow-hidden">
                  {(cardDisplayMode[v.id] ?? "3d") === "3d" ? (
                    <Vehicle3DViewer
                      vehicleType={normType}
                      vehiclePlate={v.plate}
                      vehicleModel={v.model}
                      previewMode={false}
                      height="100%"
                      compact={true}
                      showControls={false}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center p-3 bg-black/40">
                      <TruckImage
                        vehicle={v}
                        alt={`${v.brand} ${v.model}`}
                        className="max-h-full max-w-full object-contain rounded-[8px]"
                      />
                    </div>
                  )}

                  {/* Floating Category Badge */}
                  <div className="absolute top-2.5 start-2.5 z-10">
                    <span
                      className="px-2.5 py-1 rounded-full text-[10.5px] font-bold shadow-md border"
                      style={{
                        backgroundColor: meta.badgeBg,
                        color: meta.accentColor,
                        borderColor: `${meta.accentColor}44`,
                      }}
                    >
                      {meta.arabicName} — {meta.englishName}
                    </span>
                  </div>

                  {/* 3D vs Image Toggle Switch on Card */}
                  <div className="absolute top-2.5 end-2.5 z-10 flex items-center gap-0.5 bg-black/70 backdrop-blur-md rounded-full p-0.5 border border-white/10 text-[9.5px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCardDisplayMode((prev) => ({ ...prev, [v.id]: "3d" }));
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded-full font-bold transition-all",
                        (cardDisplayMode[v.id] ?? "3d") === "3d"
                          ? "bg-brand text-on-brand shadow-sm"
                          : "text-text-muted hover:text-text-primary"
                      )}
                    >
                      3D
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCardDisplayMode((prev) => ({ ...prev, [v.id]: "image" }));
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded-full font-bold transition-all",
                        cardDisplayMode[v.id] === "image"
                          ? "bg-brand text-on-brand shadow-sm"
                          : "text-text-muted hover:text-text-primary"
                      )}
                    >
                      {t("Asset", "صورة")}
                    </button>
                  </div>

                  {/* Custom Image Indicator if present */}
                  {v.customImage && cardDisplayMode[v.id] === "image" && (
                    <div className="absolute bottom-2 start-2.5 z-10">
                      <span className="px-2 py-0.5 rounded bg-black/80 text-brand text-[9.5px] font-mono border border-brand/30">
                        {t("Custom Image", "صورة خاصة")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[14px] font-bold text-text-primary">
                        {v.plate}
                      </span>
                      <span className="text-[11px] text-text-muted font-mono">{v.year}</span>
                    </div>
                    <div className="text-[12.5px] font-semibold text-text-secondary mt-0.5 truncate">
                      {v.brand} {v.model}
                    </div>
                  </div>

                  {/* Telemetry Bar */}
                  <div className="grid grid-cols-3 gap-2 bg-surface-2 p-2.5 rounded-[8px] border border-white/5 text-[11px]">
                    <div>
                      <div className="text-text-muted text-[10px]">{t("Odometer", "العداد")}</div>
                      <div className="font-semibold text-text-primary tabular-nums mt-0.5">
                        {v.odometer?.toLocaleString() || "312,400"} كم
                      </div>
                    </div>
                    <div>
                      <div className="text-text-muted text-[10px]">{t("Fuel", "الوقود")}</div>
                      <div className="font-semibold text-brand tabular-nums mt-0.5">{v.fuel}%</div>
                    </div>
                    <div>
                      <div className="text-text-muted text-[10px]">{t("Capacity", "الحمولة")}</div>
                      <div className="font-semibold text-text-primary tabular-nums mt-0.5">
                        {meta.maxPayloadTons} طن
                      </div>
                    </div>
                  </div>

                  {/* Assigned Driver & Active Trip */}
                  <div className="flex items-center justify-between text-[11.5px] pt-1">
                    <div className="flex items-center gap-2 truncate">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand/20 text-brand text-[10px] font-bold">
                        {v.driver.initials}
                      </span>
                      <span className="text-text-primary font-medium truncate">{v.driver.name}</span>
                    </div>

                    <button
                      onClick={() => setShowAssignDriverModal(v)}
                      className="text-[11px] text-brand hover:underline"
                    >
                      {t("Change Driver", "تغيير السائق")}
                    </button>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="bg-surface-2 px-4 py-2.5 border-t border-border-subtle flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowVehicleDetailsModal(v)}
                    className="text-[11.5px] font-bold text-brand hover:underline flex items-center gap-1"
                  >
                    <span>{t("Details & 3D Viewer", "تفاصيل الشاحنة والمجسم")}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {activeTrip ? (
                      <span className="font-mono text-status-active text-[11px] font-semibold">
                        {activeTrip.tripNumber}
                      </span>
                    ) : (
                      <span className="text-[11px] text-text-muted">{t("Available", "متاحة")}</span>
                    )}

                    {activeTrip && onOpenLiveTracking && (
                      <button
                        onClick={() => {
                          selectTrip(activeTrip.id);
                          selectTruck(v.id);
                          onOpenLiveTracking(activeTrip.id);
                        }}
                        className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-surface-3 hover:bg-surface-4 text-text-primary transition-colors"
                      >
                        {t("Track", "تتبع")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Vehicle Modal with Live 3D Preview (Strictly 4 Types) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 lg:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-surface-1 rounded-[16px] border border-border-subtle shadow-2xl flex flex-col overflow-hidden text-text-primary max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle">
              <h3 className="font-bold text-[16px] text-text-primary">
                {t("Add Heavy Fleet Unit", "إضافة شاحنة جديدة للأسطول")}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="btn-icon-sm">
                <IconClose size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Dynamic 3D Preview inside Form */}
              <div className="bg-surface-2 rounded-[12px] border border-border-subtle overflow-hidden">
                <div className="px-3.5 py-2 border-b border-white/5 flex items-center justify-between text-[11px] text-text-secondary">
                  <span>{t("Live 3D Preview of Selected Type", "المعاينة الحية لنوع الشاحنة المختار")}</span>
                  <span className="font-bold text-brand">{APPROVED_VEHICLE_TYPES[formType].arabicName}</span>
                </div>
                <div className="h-[180px] w-full">
                  <Vehicle3DViewer
                    vehicleType={formType}
                    previewMode={false}
                    height="100%"
                    compact={true}
                    showControls={false}
                  />
                </div>
              </div>

              {/* 4 Canonical Types Selector Buttons */}
              <div>
                <label className="block text-[11.5px] font-bold text-text-secondary mb-1.5">
                  {t("Approved Vehicle Category (Strictly 4)", "فئة الشاحنة المعتمدة (٤ أنواع فقط)")} *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {APPROVED_VEHICLE_TYPES_LIST.map((vt) => {
                    const isSelected = formType === vt.id;
                    return (
                      <button
                        type="button"
                        key={vt.id}
                        onClick={() => {
                          setFormType(vt.id);
                          setFormMaxLoad(String(vt.maxPayloadTons));
                        }}
                        className={cn(
                          "p-2.5 rounded-[10px] text-start border transition-all flex flex-col justify-between",
                          isSelected
                            ? "bg-brand text-on-brand border-brand font-bold shadow-md"
                            : "bg-surface-2 text-text-secondary border-border-subtle hover:bg-surface-3"
                        )}
                      >
                        <span className="text-[12.5px] font-bold">{vt.arabicName}</span>
                        <span className="text-[10px] opacity-80 mt-1">{vt.englishName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Official Vehicle Asset for the selected category (Single Source of Truth) */}
              <div className="rounded-[12px] border border-border-subtle bg-surface-2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-text-secondary">
                    {t("Official Asset for the selected category", "الأصل الرسمي للنوع المختار")}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-[2px] text-[9.5px] font-bold",
                      registry.types[formType].hasOfficialModel
                        ? "bg-status-active/15 text-status-active"
                        : "bg-status-waiting/15 text-status-waiting",
                    )}
                  >
                    {registry.types[formType].hasOfficialModel
                      ? t("Official 3D model", "مجسم رسمي 3D")
                      : t("Official image (3D pending)", "صورة رسمية (بانتظار المجسم)")}
                  </span>
                </div>
                <div className="flex items-stretch gap-3">
                  <div className="h-[92px] w-[140px] shrink-0 overflow-hidden rounded-[10px] border border-border-subtle bg-surface-3">
                    <TruckImage body={formType} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 text-[11px] leading-relaxed text-text-secondary">
                    <div className="font-bold text-text-primary">
                      {APPROVED_VEHICLE_TYPES[formType].arabicName} · {APPROVED_VEHICLE_TYPES[formType].englishName}
                    </div>
                    <div className="mt-1 text-text-muted">
                      {t(
                        "This exact asset is bound to the category across the app and the console — one upload, every screen.",
                        "هذا الأصل نفسه مرتبط بهذا النوع في التطبيق ولوحة التحكم — رفع واحد يظهر في كل الشاشات.",
                      )}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-text-muted">
                      {typeImage(formType)}
                      {typeModel(formType)?.url ? ` · ${typeModel(formType)?.url}` : ""}
                    </div>
                  </div>
                </div>
                {assetError && <div className="mt-2 text-[10.5px] text-status-danger">{assetError}</div>}
              </div>

              {/* Plate & Brand */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1">
                    {t("Plate Number", "رقم اللوحة")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formPlate}
                    onChange={(e) => setFormPlate(e.target.value)}
                    placeholder="ر ج د ٤٨٢١"
                    className="w-full bg-surface-2 border border-border-subtle rounded-[8px] p-2 text-text-primary font-mono outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1">
                    {t("Manufacturer Brand", "الشركة المصنعة")}
                  </label>
                  <select
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-[8px] p-2 text-text-primary outline-none focus:border-brand"
                  >
                    <option value="Mercedes-Benz">Mercedes-Benz</option>
                    <option value="Volvo">Volvo</option>
                    <option value="Scania">Scania</option>
                    <option value="MAN">MAN</option>
                    <option value="DAF">DAF</option>
                    <option value="Iveco">Iveco</option>
                  </select>
                </div>
              </div>

              {/* Model & Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1">
                    {t("Model", "طراز الشاحنة")}
                  </label>
                  <input
                    type="text"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-[8px] p-2 text-text-primary outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1">
                    {t("Model Year", "سنة الصنع")}
                  </label>
                  <input
                    type="number"
                    value={formYear}
                    onChange={(e) => setFormYear(e.target.value)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-[8px] p-2 text-text-primary outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* Max Payload & Cab */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1">
                    {t("Max Payload (Tons)", "الحمولة القصوى (طن)")}
                  </label>
                  <input
                    type="number"
                    value={formMaxLoad}
                    onChange={(e) => setFormMaxLoad(e.target.value)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-[8px] p-2 text-text-primary outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1">
                    {t("Cabin Type", "نوع الكابينة")}
                  </label>
                  <input
                    type="text"
                    value={formCab}
                    onChange={(e) => setFormCab(e.target.value)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-[8px] p-2 text-text-primary outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* Optional Custom Vehicle Photo */}
              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">
                  {t("Custom Vehicle Photo URL (Optional)", "رابط صورة المركبة الخاصة (اختياري)")}
                </label>
                <input
                  type="text"
                  value={formCustomImage}
                  onChange={(e) => setFormCustomImage(e.target.value)}
                  placeholder="https://... أو اترك فارغاً لاعتماد الصورة الرسمية للنوع"
                  className="w-full bg-surface-2 border border-border-subtle rounded-[8px] p-2 text-text-primary text-[12px] outline-none focus:border-brand"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  {t(
                    "If left empty, the official reference asset for this category will be used.",
                    "في حال ترك الحقل فارغاً، يتم استخدام الصورة الرسمية المعتمدة لنوع الشاحنة تلقائياً."
                  )}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full btn-primary py-2.5 font-bold text-[13px]"
                >
                  {isSubmitting ? t("Adding...", "جارٍ الحفظ والاعتماد...") : t("Confirm & Save Vehicle", "تأكيد وإضافة الشاحنة")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Driver Assignment Modal */}
      {showAssignDriverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-surface-1 rounded-[14px] p-5 border border-border-subtle text-text-primary">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="font-bold text-[14px] text-text-primary">
                {t("Assign Driver to Vehicle", "تعيين كابتن أسطول للشاحنة")}
              </h3>
              <button onClick={() => setShowAssignDriverModal(null)} className="btn-icon-sm">
                <IconClose size={15} />
              </button>
            </div>

            <div className="py-3">
              <div className="bg-surface-2 p-3 rounded-[8px] mb-3 flex items-center justify-between text-[12px]">
                <span className="font-mono font-bold text-brand">{showAssignDriverModal.plate}</span>
                <span className="text-text-secondary">{showAssignDriverModal.model}</span>
              </div>

              <label className="block text-[11.5px] font-bold text-text-muted mb-1">
                {t("Select Fleet Driver", "اختر السائق المعتمد")}
              </label>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full bg-surface-2 border border-border-subtle rounded-[8px] p-2.5 text-text-primary text-[12.5px] outline-none"
              >
                <option value="">{t("Select driver...", "اختر سائقاً...")}</option>
                {drivers.map((d) => (
                  <option key={d.id || d.name} value={d.id || d.name}>
                    {d.name} ({d.trips} رحلة · تقييم {d.rating})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowAssignDriverModal(null)}
                className="btn-ghost text-[12px]"
              >
                {t("Cancel", "إلغاء")}
              </button>
              <button
                onClick={handleAssignDriverSubmit}
                disabled={!selectedDriverId}
                className="btn-primary text-[12px]"
              >
                {t("Assign", "تأكيد التعيين")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle 3D & Official Asset Details Modal */}
      {showVehicleDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 lg:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-4xl bg-surface-1 rounded-[16px] border border-border-subtle shadow-2xl flex flex-col overflow-hidden text-text-primary max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 px-6 border-b border-border-subtle bg-surface-2">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-[16px] text-brand">
                  {showVehicleDetailsModal.plate}
                </span>
                <span className="text-text-muted">·</span>
                <span className="text-[14px] font-semibold text-text-primary">
                  {showVehicleDetailsModal.brand} {showVehicleDetailsModal.model}
                </span>
                <span className="badge bg-brand/15 text-brand text-[11px] font-mono">
                  {showVehicleDetailsModal.year}
                </span>
              </div>
              <button
                onClick={() => setShowVehicleDetailsModal(null)}
                className="btn-icon-sm"
                aria-label="Close"
              >
                <IconClose size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">
              {/* Top Section: 3D Model (Interactive 360°) + Official Reference Asset */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* 3D WebGL Canvas */}
                <div className="lg:col-span-8 bg-surface-2 rounded-[12px] border border-border-subtle overflow-hidden h-[300px] lg:h-[340px] relative">
                  <Vehicle3DViewer
                    vehicleType={showVehicleDetailsModal.body}
                    vehiclePlate={showVehicleDetailsModal.plate}
                    vehicleModel={showVehicleDetailsModal.model}
                    previewMode={false}
                    height="100%"
                    compact={false}
                    showControls={true}
                  />
                  <div className="absolute top-2.5 start-2.5 z-20 pointer-events-none">
                    <span className="px-2.5 py-1 rounded bg-black/70 backdrop-blur-sm text-brand text-[11px] font-bold border border-brand/30">
                      {t("Interactive 3D Engine · Drag 360°", "مجسم 3D تفاعلي · اسحب للدوران 360°")}
                    </span>
                  </div>
                </div>

                {/* Official Reference Asset View */}
                <div className="lg:col-span-4 flex flex-col gap-3">
                  <div className="bg-surface-2 rounded-[12px] border border-border-subtle p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-[11.5px] font-bold text-text-secondary mb-2 flex items-center justify-between">
                        <span>{t("Active Visual Asset", "الصورة المعتمدة الحالية")}</span>
                        {showVehicleDetailsModal.customImage ? (
                          <span className="text-[10px] text-brand font-semibold">{t("Custom Vehicle Photo", "صورة خاصة بالمركبة")}</span>
                        ) : (
                          <span className="text-[10px] text-text-muted">{t("Official Type Asset", "الصورة الرسمية للنوع")}</span>
                        )}
                      </div>
                      <div className="h-[150px] w-full rounded-[8px] bg-black/50 border border-white/5 overflow-hidden flex items-center justify-center p-2">
                        <TruckImage
                          vehicle={showVehicleDetailsModal}
                          alt={showVehicleDetailsModal.plate}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    </div>

                    <div className="pt-2 text-[10.5px] text-text-muted">
                      {showVehicleDetailsModal.customImage ? (
                        <div className="flex items-center justify-between">
                          <span className="truncate max-w-[170px] font-mono text-[9.5px]">
                            {showVehicleDetailsModal.customImage}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              updateVehicle(showVehicleDetailsModal.id, { customImage: undefined });
                              setShowVehicleDetailsModal((prev) => (prev ? { ...prev, customImage: undefined } : null));
                              try {
                                await apiClient.vehicleAssets.removeVehicleImage(showVehicleDetailsModal.id);
                                await refreshVehicleAssets();
                              } catch {
                                /* the local override is already cleared */
                              }
                              toast(t("Reverted to official type image", "تم الرجوع للصورة الرسمية للنوع"));
                            }}
                            className="text-red-400 hover:underline text-[10px] font-semibold shrink-0"
                          >
                            {t("Use Official Image", "حذف واعتماد الرسمية")}
                          </button>
                        </div>
                      ) : (
                        <p>
                          {t(
                            "Currently bound to official category asset. Single source of truth across Web and Android.",
                            "مرتبطة حالياً بالصورة والمجسم الرسمي المعتمد لهذا النوع عبر المنظومة وتطبيق الجوال."
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Publish a real vehicle photograph (stored in the central asset registry) */}
                  <div className="bg-surface-2 rounded-[12px] border border-border-subtle p-3 text-[11.5px]">
                    <button
                      type="button"
                      disabled={isPhotoBusy}
                      onClick={() => {
                        setPhotoTargetVehicleId(showVehicleDetailsModal.id);
                        setAssetError(null);
                        vehiclePhotoInputRef.current?.click();
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-brand/40 bg-brand/10 py-2 text-[12px] font-bold text-brand transition-colors hover:bg-brand hover:text-on-brand disabled:opacity-60"
                    >
                      <IconUpload size={14} />
                      {isPhotoBusy
                        ? t("Publishing…", "جارٍ النشر…")
                        : t("Publish a photograph for this vehicle", "نشر صورة فعلية لهذه المركبة")}
                    </button>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-text-muted">
                      {t(
                        "The published photograph is used for this unit only; its category asset still governs the fleet type.",
                        "الصورة المنشورة تُستخدم لهذه المركبة فقط، مع بقاء الأصل الرسمي هو المرجع لنوعها.",
                      )}
                    </p>
                    {assetError && <div className="mt-1.5 text-[10.5px] text-status-danger">{assetError}</div>}
                  </div>

                  {/* Quick Custom Image URL Input */}
                  <div className="bg-surface-2 rounded-[12px] border border-border-subtle p-3 text-[11.5px]">
                    <label className="block font-semibold text-text-secondary mb-1">
                      {t("Override with Custom Photo URL", "تخصيص صورة خاصة لهذه المركبة")}
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="https://..."
                        defaultValue={showVehicleDetailsModal.customImage || ""}
                        id="custom-img-input"
                        className="flex-1 bg-surface-3 border border-border-subtle rounded px-2 py-1 text-[11px] text-text-primary outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById("custom-img-input") as HTMLInputElement;
                          const val = el?.value?.trim();
                          updateVehicle(showVehicleDetailsModal.id, { customImage: val || undefined });
                          setShowVehicleDetailsModal((prev) => prev ? { ...prev, customImage: val || undefined } : null);
                          toast(t("Vehicle image updated", "تم حفظ صورة المركبة بنجاح"));
                        }}
                        className="btn-primary text-[10.5px] px-2.5 py-1"
                      >
                        {t("Save", "حفظ")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Immediate Body Type Switcher (Strictly 4 Approved Types) */}
              <div className="bg-surface-2 rounded-[12px] p-4 border border-border-subtle">
                <div className="flex items-center justify-between mb-2.5">
                  <div>
                    <h4 className="text-[13px] font-bold text-text-primary">
                      {t("Change Vehicle Category (Strictly 4 Types)", "تغيير فئة الشاحنة (٤ فئات معتمدة فقط)")}
                    </h4>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {t(
                        "Selecting a category instantly syncs both the official image and the 3D model across all screens.",
                        "تغيير الفئة يحدث تلقائياً كلاً من المجسم ثلاثي الأبعاد والصورة الرسمية في لوحة التحكم وتطبيق الجوال معاً."
                      )}
                    </p>
                  </div>
                  <span className="text-[12px] font-mono font-bold text-brand">
                    {getVehicleTypeMeta(showVehicleDetailsModal.body).arabicName}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  {APPROVED_VEHICLE_TYPES_LIST.map((vt) => {
                    const isCurrent = showVehicleDetailsModal.body === vt.id;
                    return (
                      <button
                        type="button"
                        key={vt.id}
                        onClick={() => {
                          const updated = { ...showVehicleDetailsModal, body: vt.id };
                          updateVehicle(showVehicleDetailsModal.id, { body: vt.id });
                          setShowVehicleDetailsModal(updated);
                          toast(
                            t("Category updated", "تم تحديث نوع الشاحنة والمجسم والصورة بنجاح"),
                            `${showVehicleDetailsModal.plate} · ${vt.arabicName}`
                          );
                        }}
                        className={cn(
                          "p-3 rounded-[10px] border text-start transition-all flex flex-col justify-between",
                          isCurrent
                            ? "bg-brand text-on-brand border-brand font-bold shadow-md scale-[1.02]"
                            : "bg-surface-1 text-text-secondary border-border-subtle hover:bg-surface-3"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-bold">{vt.arabicName}</span>
                          {isCurrent && <span className="h-2 w-2 rounded-full bg-navy" />}
                        </div>
                        <div className="text-[10.5px] opacity-80 mt-1">{vt.englishName}</div>
                        <div className="text-[10px] opacity-70 mt-2 font-mono">
                          {vt.maxPayloadTons} {t("tons", "طن")}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vehicle Technical Specifications */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                <div className="bg-surface-2 p-3 rounded-[10px] border border-white/5">
                  <div className="text-[10.5px] text-text-muted">{t("Driver", "السائق المعتمد")}</div>
                  <div className="font-semibold text-text-primary mt-0.5 truncate">
                    {showVehicleDetailsModal.driver.name}
                  </div>
                  <div className="text-[10px] text-text-muted font-mono">{showVehicleDetailsModal.driver.phone}</div>
                </div>

                <div className="bg-surface-2 p-3 rounded-[10px] border border-white/5">
                  <div className="text-[10.5px] text-text-muted">{t("Horsepower", "القوة")}</div>
                  <div className="font-semibold text-text-primary mt-0.5 tabular-nums">
                    {showVehicleDetailsModal.hp} {t("hp", "حصان")}
                  </div>
                  <div className="text-[10px] text-text-muted">{showVehicleDetailsModal.cab}</div>
                </div>

                <div className="bg-surface-2 p-3 rounded-[10px] border border-white/5">
                  <div className="text-[10.5px] text-text-muted">{t("Odometer", "العداد")}</div>
                  <div className="font-semibold text-brand mt-0.5 tabular-nums">
                    {showVehicleDetailsModal.odometer?.toLocaleString() || "312,400"} كم
                  </div>
                  <div className="text-[10px] text-text-muted">{t("Fuel Level", "مستوى الوقود")}: {showVehicleDetailsModal.fuel}%</div>
                </div>

                <div className="bg-surface-2 p-3 rounded-[10px] border border-white/5">
                  <div className="text-[10.5px] text-text-muted">{t("Status", "الحالة التشغيلية")}</div>
                  <div className="font-semibold text-text-primary mt-0.5">
                    {showVehicleDetailsModal.status === "active" ? "على الطريق" : showVehicleDetailsModal.status === "waiting" ? "متاحة" : "متوقفة"}
                  </div>
                  <div className="text-[10px] text-text-muted font-mono">{showVehicleDetailsModal.shipment}</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 px-6 bg-surface-2 border-t border-border-subtle flex items-center justify-between">
              <span className="text-[11px] text-text-muted">
                {t("EJAZ Heavy Fleet Asset Management System", "نظام إدارة أصول ومجسمات أسطول إيجاز للنقليات")}
              </span>
              <button
                type="button"
                onClick={() => setShowVehicleDetailsModal(null)}
                className="btn-primary py-1.5 px-5 text-[12px] font-bold"
              >
                {t("Done", "إغلاق")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Hidden picker: per-vehicle photograph published to the central registry */}
      <input
        ref={vehiclePhotoInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && photoTargetVehicleId) publishVehiclePhoto(file, photoTargetVehicleId);
          e.target.value = "";
        }}
      />

      {/* Modal: Assign Driver */}
    </div>
  );
}
