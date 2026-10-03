import { useState, useEffect } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore, type Trip } from "../state/fleetStore";
import { apiClient } from "../services/apiClient";
import { InteractiveMap } from "../components/InteractiveMap";
import { normalizeVehicleType } from "../data/vehicleTypes";
import { TruckTypeIcon, TruckTypeAvatar, TruckTypeBadge } from "../components/TruckTypeIcon";
import {
  IconHome,
  IconOrders,
  IconPin,
  IconProfile,
  IconSearch,
  IconDoc,
} from "../components/Icons";

interface ClientModeProps {
  user: any;
  onLogout: () => void;
}

export function ClientMode({ user, onLogout }: ClientModeProps) {
  const { t } = useSettings();
  const { trips } = useFleetStore();
  const [activeTab, setActiveTab] = useState<"home" | "trips" | "track" | "docs" | "profile">("home");
  const [clientTrips, setClientTrips] = useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [, setIsLoading] = useState(false);

  // Fetch client trips from backend API
  useEffect(() => {
    let isMounted = true;
    async function loadClientData() {
      setIsLoading(true);
      try {
        const res = await apiClient.trips.getClientTrips();
        if (isMounted && res?.trips) {
          setClientTrips(res.trips);
          if (!selectedTrip && res.trips.length > 0) {
            setSelectedTrip(res.trips[0]);
          }
        }
      } catch (err) {
        console.warn("[ClientMode] Using store trips fallback", err);
        if (isMounted) {
          setClientTrips(trips);
          if (!selectedTrip && trips.length > 0) {
            setSelectedTrip(trips[0]);
          }
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadClientData();
    return () => {
      isMounted = false;
    };
  }, [trips]);

  // Current active trip to display
  const activeTrip = selectedTrip || clientTrips[0] || trips[0];

  // Helper mapping to Trip store interface
  const mappedActiveTrip: Trip = {
    id: activeTrip?.id || "trip-1",
    tripNumber: activeTrip?.tripNumber || "EJ-2026-000125",
    truckId: activeTrip?.vehicleId || "v1",
    driverId: activeTrip?.driverId || "d1",
    shipper: activeTrip?.customerName || user?.fullName || "شركة سدافكو للأغذية",
    consignee: activeTrip?.deliveryAddress || "ميناء جدة الإسلامي",
    originCity: activeTrip?.originCity || "الرياض",
    originTerminal: activeTrip?.pickupAddress || "المستودع المركزي",
    destinationCity: activeTrip?.destinationCity || "جدة",
    destinationTerminal: activeTrip?.deliveryAddress || "ميناء جدة رصيف ٧",
    corridorKey: activeTrip?.corridorKey || "riyadh-jeddah",
    cargoType: normalizeVehicleType(activeTrip?.cargoType),
    cargoWeightTons: Number(activeTrip?.cargoWeightTons || 20),
    maxCapacityTons: Number(activeTrip?.maxCapacityTons || 25),
    status: activeTrip?.status === "IN_TRANSIT" ? "on_road" : activeTrip?.status === "DELIVERED" ? "delivered" : "ready",
    progressPct: activeTrip?.status === "IN_TRANSIT" ? 48 : 0,
    speedKmH: Number(activeTrip?.currentSpeed || 85),
    headingDeg: Number(activeTrip?.currentHeading || 255),
    currentLat: Number(activeTrip?.currentLat || 24.7136),
    currentLng: Number(activeTrip?.currentLng || 46.6753),
    distanceTotalKm: 948,
    distanceCoveredKm: 420,
    distanceRemainingKm: 528,
    etaMinutes: 210,
    nextWaypointAr: "محطة ميزان القويعية",
    nextWaypointEn: "Al Quwayiyah Weighbridge",
    createdAt: activeTrip?.createdAt || "الآن",
    qrCodeToken: `EJAZ-${activeTrip?.tripNumber || "EJ-2026-000125"}`,
    timeline: [],
  };

  const filteredTrips = clientTrips.filter(
    (tr) =>
      !searchQuery ||
      tr.tripNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tr.originCity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tr.destinationCity?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-0 text-white flex flex-col justify-between select-none">
      {/* Scrollable Content Container */}
      <div className="scroll-thin flex-1 overflow-y-auto pb-24">
        {/* Top Header */}
        <div className="px-5 pt-12 pb-4 bg-gradient-to-b from-navy to-surface-0 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-2/20 text-[13px] font-bold text-accent-2 border border-accent-2/30">
                {user?.fullName?.slice(0, 2) || "CL"}
              </span>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted">
                  {t("Client Portal", "بوابة العميل الرسمية")}
                </div>
                <div className="text-[13.5px] font-bold text-white truncate max-w-[190px]">
                  {user?.fullName || "شركة سدافكو للأغذية"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-status-active/15 border border-status-active/30 px-2.5 py-0.5 text-[10px] font-bold text-status-active">
                {clientTrips.length} {t("Active Trips", "شحنة")}
              </span>
            </div>
          </div>

          {/* Quick Search */}
          <div className="mt-4 flex items-center gap-2 rounded-[12px] bg-surface-2 px-3 py-2 border border-border-subtle focus-within:border-brand transition-colors">
            <IconSearch size={15} className="text-text-muted shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("Search by Trip Number (e.g. EJ-2026-000125)...", "ابحث برقم الرحلة (EJ-2026-XXXXXX)...")}
              className="w-full bg-transparent text-[11.5px] text-white outline-none"
            />
          </div>
        </div>

        {/* TAB 1: HOME SCREEN */}
        {activeTab === "home" && (
          <div className="px-5 py-4 space-y-4 animate-fade-in">
            {/* Active Shipment Hero Card */}
            {activeTrip ? (
              <div className="rounded-[18px] bg-gradient-to-br from-navy via-surface-1 to-surface-2 p-4 border border-border-subtle shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="rounded-full bg-brand/20 border border-brand/40 px-2.5 py-0.5 text-[10.5px] font-bold text-brand">
                    {activeTrip.tripNumber}
                  </span>
                  <span className="text-[11px] font-semibold text-status-active flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-status-active animate-pulse" />
                    {activeTrip.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
                  <div>
                    <div className="text-[10px] text-text-muted">{t("From (Loading)", "نقطة التحميل")}</div>
                    <div className="font-semibold text-white truncate mt-0.5">{activeTrip.originCity}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted">{t("To (Delivery)", "نقطة التفريغ")}</div>
                    <div className="font-semibold text-white truncate mt-0.5">{activeTrip.destinationCity}</div>
                  </div>
                </div>

                {/* Cargo Details */}
                <div className="mt-3 rounded-[10px] bg-surface-0/60 p-2.5 text-[11px] border border-white/5 flex items-center justify-between">
                  <div className="truncate max-w-[65%]">
                    <span className="text-text-muted">{t("Cargo:", "الشحنة:")} </span>
                    <span className="text-white font-medium">{activeTrip.cargoDescription || "بضائع غذائية مجففة"}</span>
                  </div>
                  <div className="text-brand font-bold tabular-nums">
                    {activeTrip.cargoWeightTons || 20} t ({activeTrip.cargoType || "ستارة"})
                  </div>
                </div>

                {/* Carrier Truck & Driver */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-text-secondary">
                  <div className="flex items-center gap-1.5 truncate">
                    <TruckTypeIcon truckType={activeTrip.cargoType} size={15} className="text-brand shrink-0" />
                    <span className="truncate">{activeTrip.driverName || "فهد الشمري"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TruckTypeBadge truckType={activeTrip.cargoType} size={11} />
                    <span className="font-mono text-white/80">{activeTrip.vehiclePlate || "ر ج د ٤٨٢١"}</span>
                  </div>
                </div>

                {/* Action button */}
                <button
                  onClick={() => setActiveTab("track")}
                  className="mt-4 w-full flex h-10 items-center justify-center gap-2 rounded-[12px] bg-brand text-on-brand text-[12px] font-bold shadow-md hover:brightness-110 active:scale-95 transition-all"
                >
                  <IconPin size={15} />
                  <span>{t("Track Live Location Now", "تتبع موقع الشحنة مباشرة")}</span>
                </button>
              </div>
            ) : (
              <div className="rounded-[16px] bg-surface-1 p-6 text-center text-text-muted border border-border-subtle">
                {t("No active shipments under your account", "لا توجد شحنات نشطة حالياً تحت حسابك")}
              </div>
            )}

            {/* Recent Trips Header */}
            <div className="flex items-center justify-between pt-2">
              <h2 className="text-[14px] font-bold text-white">{t("My Shipments", "شحناتي الأخيرة")}</h2>
              <button onClick={() => setActiveTab("trips")} className="text-[11px] font-semibold text-brand hover:underline">
                {t("View All", "عرض الكل")} ({clientTrips.length})
              </button>
            </div>

            {/* Trips List Preview */}
            <div className="space-y-2.5">
              {filteredTrips.slice(0, 3).map((tr) => (
                <div
                  key={tr.id}
                  onClick={() => {
                    setSelectedTrip(tr);
                    setActiveTab("track");
                  }}
                  className="rounded-[14px] bg-surface-1 p-3.5 border border-border-subtle hover:border-brand/50 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[11.5px]">
                    <div className="flex items-center gap-2">
                      <TruckTypeAvatar truckType={tr.cargoType} size={28} iconSize={14} showBadge />
                      <span className="font-bold text-brand">{tr.tripNumber}</span>
                    </div>
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-text-secondary">
                      {tr.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[11.5px] text-white">
                    {tr.originCity} → {tr.destinationCity}
                  </div>
                  <div className="mt-1 text-[10px] text-text-muted flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <TruckTypeBadge truckType={tr.cargoType} size={11} />
                      <span>{tr.cargoWeightTons} طن</span>
                    </span>
                    <span className="text-accent-2 font-medium">{t("Track", "تتبع")} ↗</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: MY TRIPS SCREEN */}
        {activeTab === "trips" && (
          <div className="px-5 py-4 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <h2 className="text-[15px] font-bold text-white">{t("All Customer Trips", "جميع رحلات العميل")}</h2>
              <span className="text-[11px] text-text-muted">{filteredTrips.length} {t("Trips", "رحلة")}</span>
            </div>

            {filteredTrips.map((tr) => (
              <div
                key={tr.id}
                className="rounded-[14px] bg-surface-1 p-3.5 border border-border-subtle hover:border-brand/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TruckTypeAvatar truckType={tr.cargoType} size={30} iconSize={16} showBadge />
                    <span className="font-bold text-[12px] text-brand tracking-wide">{tr.tripNumber}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TruckTypeBadge truckType={tr.cargoType} size={11} />
                    <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-[10px] font-bold text-brand">
                      {tr.status}
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-[12px] font-semibold text-white">
                  {tr.originCity} ➔ {tr.destinationCity}
                </div>
                <div className="text-[11px] text-text-muted mt-0.5 truncate">
                  {tr.cargoDescription || "بضائع غذائية مجففة ومبردة"}
                </div>

                <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                  <span className="text-text-secondary">
                    {t("Driver:", "السائق:")} <strong className="text-white">{tr.driverName || "فهد الشمري"}</strong>
                  </span>
                  <button
                    onClick={() => {
                      setSelectedTrip(tr);
                      setActiveTab("track");
                    }}
                    className="rounded-[8px] bg-surface-2 px-3 py-1 text-accent-2 hover:bg-brand hover:text-navy font-bold text-[10.5px] transition-all"
                  >
                    {t("Open Tracking", "عرض التتبع")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: REAL TRACKING SCREEN */}
        {activeTab === "track" && (
          <div className="h-full flex flex-col p-4 animate-fade-in space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-text-muted uppercase tracking-wider">{t("Live GPS Tracking", "التتبع المباشر للرحلة")}</span>
                <div className="text-[14px] font-bold text-brand">{activeTrip?.tripNumber || "EJ-2026-000125"}</div>
              </div>
              <div className="text-end">
                <span className="rounded-full bg-status-active/15 border border-status-active/30 px-2.5 py-0.5 text-[10.5px] font-bold text-status-active">
                  {activeTrip?.status || "IN_TRANSIT"}
                </span>
                <div className="text-[9.5px] text-text-muted mt-0.5">
                  {t("Updated 20s ago", "آخر تحديث: قبل ٢٠ ثانية")}
                </div>
              </div>
            </div>

            {/* Embedded Live Map Component */}
            <div className="h-[320px] w-full rounded-[16px] overflow-hidden border border-border-subtle shadow-xl">
              <InteractiveMap trip={mappedActiveTrip} compact showCardOverlay={false} />
            </div>

            {/* Real GPS Status Banner */}
            <div className="rounded-[12px] bg-surface-1 p-3 border border-border-subtle text-[11.5px] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">{t("Vehicle & Plate:", "الشاحنة واللوحة:")}</span>
                <span className="font-semibold text-white">{activeTrip?.vehiclePlate || "ر ج د ٤٨٢١ (ستارة)"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">{t("Telemetry Status:", "حالة إشارة التتبع:")}</span>
                <span className="font-semibold text-status-active flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-status-active animate-pulse" />
                  {t("GPS Telemetry Online", "إشارة GPS متصلة ونشطة")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">{t("Corridor & Speed:", "المسار والسرعة:")}</span>
                <span className="font-bold text-brand tabular-nums">{activeTrip?.currentSpeed || 85} كم/س (طريق الرياض - جدة)</span>
              </div>
            </div>

            {/* Lifecycle Milestone Step Progress */}
            <div className="rounded-[12px] bg-surface-1 p-3 border border-border-subtle">
              <div className="text-[10.5px] text-text-muted uppercase font-bold mb-2">{t("Trip Progress", "مراحل الرحلة")}</div>
              <div className="grid grid-cols-4 gap-1 text-center text-[9.5px]">
                <div className="p-1.5 rounded bg-brand/20 text-brand font-bold">1. تأكيد</div>
                <div className="p-1.5 rounded bg-brand/20 text-brand font-bold">2. تحميل</div>
                <div className="p-1.5 rounded bg-status-active/20 text-status-active font-bold animate-pulse">3. على الطريق</div>
                <div className="p-1.5 rounded bg-surface-2 text-text-muted">4. تسليم</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DOCUMENTS & POD SCREEN */}
        {activeTab === "docs" && (
          <div className="px-5 py-4 space-y-3.5 animate-fade-in">
            <h2 className="text-[15px] font-bold text-white">{t("Shipment Documents & POD", "مستندات الشحنة وإثبات التسليم")}</h2>
            <p className="text-[11.5px] text-text-muted">
              {t("Official electronically signed documentation for", "المستندات الرسمية المعتمدة إلكترونياً للرحلة")}{" "}
              <strong className="text-brand">{activeTrip?.tripNumber}</strong>
            </p>

            {/* Electronic BOL */}
            <div className="rounded-[14px] bg-surface-1 p-3.5 border border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-accent-2/15 text-accent-2">
                  <IconDoc size={18} />
                </div>
                <div>
                  <div className="text-[12px] font-bold text-white">{t("Electronic Waybill (BOL)", "بوليصة الشحن الرسمية")}</div>
                  <div className="text-[10px] text-text-muted">PDF · 245 KB · معتمدة من هيئة النقل</div>
                </div>
              </div>
              <span className="rounded-full bg-status-active/20 px-2 py-0.5 text-[9.5px] font-bold text-status-active">
                {t("Verified", "محققة")}
              </span>
            </div>

            {/* Proof of Delivery Card */}
            <div className="rounded-[16px] bg-surface-1 p-4 border border-border-subtle space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-brand">{t("Proof of Delivery (POD)", "إثبات التسليم الرقمي")}</span>
                <span className="font-mono text-[11px] text-accent-2">POD-849201</span>
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                {t(
                  "Received in good condition matching SASO standards. Digital signature and confirmation code verified.",
                  "تم الاستلام بحالة ممتازة ومطابقة للمواصفات. تم توثيق التوقيع الإلكتروني وكود التأكيد."
                )}
              </p>
              <div className="rounded-[10px] bg-surface-2 p-2.5 text-[10.5px] flex items-center justify-between">
                <span>{t("Recipient:", "المستلم:")} <strong className="text-white">طارق منصور (سدافكو)</strong></span>
                <span className="text-status-active font-bold">✓ {t("Signed Digitally", "موقع رقمياً")}</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PROFILE & ACCOUNT */}
        {activeTab === "profile" && (
          <div className="px-5 py-4 space-y-4 animate-fade-in">
            <h2 className="text-[15px] font-bold text-white">{t("Client Account", "الملف التعريفي للعميل")}</h2>

            <div className="rounded-[16px] bg-surface-1 p-4 border border-border-subtle space-y-3 text-[12px]">
              <div className="flex items-center gap-3 pb-3 border-b border-white/5">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-2/20 text-[15px] font-bold text-accent-2">
                  {user?.fullName?.slice(0, 2) || "CL"}
                </span>
                <div>
                  <div className="font-bold text-[14px] text-white">{user?.fullName || "شركة سدافكو للأغذية"}</div>
                  <div className="text-[11px] text-text-muted">{user?.email}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-text-muted">{t("Commercial Reg (CR):", "السجل التجاري:")}</span>
                <span className="font-mono text-white">1010198421</span>
              </div>

              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-text-muted">{t("VAT Tax Number:", "الرقم الضريبي:")}</span>
                <span className="font-mono text-white">300184920100003</span>
              </div>

              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-text-muted">{t("System Role:", "الدور في النظام:")}</span>
                <span className="rounded-full bg-accent-2/15 text-accent-2 px-2.5 py-0.5 text-[10px] font-bold">
                  CLIENT / CUSTOMER
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="w-full flex h-11 items-center justify-center gap-2 rounded-[12px] bg-status-danger/15 border border-status-danger/30 text-status-danger font-bold text-[12.5px] hover:bg-status-danger hover:text-white transition-all"
            >
              <span>{t("Sign Out from Client Account", "تسجيل الخروج من حساب العميل")}</span>
            </button>
          </div>
        )}
      </div>

      {/* Modern Bottom Navigation Bar */}
      <div className="absolute bottom-3 inset-x-4 z-40 flex items-center justify-around rounded-[18px] bg-navy/95 border border-white/10 px-2 py-2 shadow-2xl backdrop-blur-xl">
        {[
          ["home", t("Home", "الرئيسية"), IconHome],
          ["trips", t("Trips", "رحلاتي"), IconOrders],
          ["track", t("Track", "التتبع"), IconPin],
          ["docs", t("Docs", "المستندات"), IconDoc],
          ["profile", t("Account", "حسابي"), IconProfile],
        ].map(([id, label, IconComponent]: any) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex flex-col items-center gap-1 py-1 px-2.5 rounded-[10px] transition-all duration-200 active:scale-95",
              activeTab === id ? "text-brand font-bold" : "text-white/50 hover:text-white"
            )}
          >
            <IconComponent size={18} />
            <span className="text-[9.5px]">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
