import { useState, useEffect, useRef } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore, type Trip } from "../state/fleetStore";
import { apiClient } from "../services/apiClient";
import { InteractiveMap } from "../components/InteractiveMap";
import { normalizeVehicleType } from "../data/vehicleTypes";
import {
  IconHome,
  IconPin,
  IconProfile,
  IconTruck,
  IconCheck,
  IconBolt,
  IconStraight,
  IconOrders,
} from "../components/Icons";

interface DriverModeProps {
  user: any;
  onLogout: () => void;
}

export function DriverMode({ user, onLogout }: DriverModeProps) {
  const { t } = useSettings();
  const { trips, updateTripStatus } = useFleetStore();
  const [activeTab, setActiveTab] = useState<"home" | "trips" | "trip" | "gps" | "pod" | "profile">("home");
  const [tripsSubTab, setTripsSubTab] = useState<"all" | "available" | "confirmed" | "active" | "completed">("all");
  const [driverTrips, setDriverTrips] = useState<any[]>([]);
  const [currentTrip, setCurrentTrip] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Real Device GPS Telemetry state
  const [isGpsBroadcasting, setIsGpsBroadcasting] = useState(false);
  const [gpsTelemetry, setGpsTelemetry] = useState<{
    latitude: number;
    longitude: number;
    speed: number;
    accuracy: number;
    heading: number;
    timestamp: string;
  } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Proof of Delivery form state
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("تم الاستلام بحالة ممتازة ومطابقة للمواصفات");
  const [signatureDone, setSignatureDone] = useState(false);

  // Fetch driver assigned trips from backend API
  useEffect(() => {
    let isMounted = true;
    async function loadDriverTrips() {
      try {
        const res = await apiClient.trips.getDriverTrips(tripsSubTab);
        if (isMounted && res?.trips) {
          setDriverTrips(res.trips);
          if (!currentTrip && res.trips.length > 0 && tripsSubTab !== "available") {
            setCurrentTrip(res.trips[0]);
          }
        }
      } catch (err) {
        console.warn("[DriverMode] Store trips fallback", err);
        if (isMounted) {
          setDriverTrips(trips);
          if (!currentTrip && trips.length > 0) {
            setCurrentTrip(trips[0]);
          }
        }
      }
    }
    loadDriverTrips();
    return () => {
      isMounted = false;
    };
  }, [trips, tripsSubTab]);

  const handleRequestTrip = async (tripId: string) => {
    setIsSubmitting(true);
    setActionSuccessMsg(null);
    try {
      await apiClient.trips.requestTrip(tripId, `طلب الرحلة بواسطة السائق ${user?.fullName || "فهد الشمري"}`);
      setActionSuccessMsg(t("Trip requested successfully! Sent to Operations for approval.", "تم إرسال طلب الرحلة لغرفة العمليات للموافقة بنجاح!"));
      const res = await apiClient.trips.getDriverTrips(tripsSubTab);
      if (res?.trips) setDriverTrips(res.trips);
    } catch (err: any) {
      alert(err.message || "فشل إرسال طلب الرحلة");
    } finally {
      setIsSubmitting(false);
    }
  };

  const active = currentTrip || driverTrips[0] || trips[0];

  // Helper mapped store trip
  const mappedTrip: Trip = {
    id: active?.id || "trip-1",
    tripNumber: active?.tripNumber || "EJ-2026-000125",
    truckId: active?.vehicleId || "v1",
    driverId: active?.driverId || "d1",
    shipper: active?.customerName || "شركة سدافكو للأغذية",
    consignee: active?.deliveryAddress || "ميناء جدة الإسلامي",
    originCity: active?.originCity || "الرياض",
    originTerminal: active?.pickupAddress || "المستودع المركزي",
    destinationCity: active?.destinationCity || "جدة",
    destinationTerminal: active?.deliveryAddress || "ميناء جدة رصيف ٧",
    corridorKey: active?.corridorKey || "riyadh-jeddah",
    cargoType: normalizeVehicleType(active?.cargoType),
    cargoWeightTons: Number(active?.cargoWeightTons || 19.8),
    maxCapacityTons: Number(active?.maxCapacityTons || 25),
    status: active?.status === "IN_TRANSIT" ? "on_road" : active?.status === "DELIVERED" ? "delivered" : "ready",
    progressPct: active?.status === "IN_TRANSIT" ? 48 : 0,
    speedKmH: Number(active?.currentSpeed || 85),
    headingDeg: Number(active?.currentHeading || 255),
    currentLat: Number(active?.currentLat || 24.7136),
    currentLng: Number(active?.currentLng || 46.6753),
    distanceTotalKm: 948,
    distanceCoveredKm: 420,
    distanceRemainingKm: 528,
    etaMinutes: 210,
    nextWaypointAr: "محطة ميزان القويعية",
    nextWaypointEn: "Al Quwayiyah Weighbridge",
    createdAt: active?.createdAt || "الآن",
    qrCodeToken: `EJAZ-${active?.tripNumber || "EJ-2026-000125"}`,
    timeline: [],
  };

  // Real Device Geolocation watcher
  const toggleGpsBroadcast = () => {
    if (isGpsBroadcasting) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsGpsBroadcasting(false);
      setGpsError(null);
    } else {
      if (!("geolocation" in navigator)) {
        setGpsError(t("Geolocation not supported on this device", "ميزة تحديد المواقع غير مدعومة في هذا الجهاز"));
        return;
      }

      setIsGpsBroadcasting(true);
      setGpsError(null);

      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const spd = Math.round((pos.coords.speed || 0) * 3.6); // convert m/s to km/h
          const heading = Math.round(pos.coords.heading || 0);
          const acc = Math.round(pos.coords.accuracy || 10);

          setGpsTelemetry({
            latitude: lat,
            longitude: lng,
            speed: spd,
            accuracy: acc,
            heading,
            timestamp: new Date().toLocaleTimeString("ar-SA"),
          });

          // Ingest telemetry into authoritative backend
          try {
            await apiClient.gps.recordTelemetry({
              vehicleId: active?.vehicleId || "v1",
              deviceId: `DEVICE-${user?.id || "d1"}`,
              tripId: active?.id,
              latitude: lat,
              longitude: lng,
              speed: spd,
              heading,
              accuracy: acc,
              ignition: true,
              provider: "DRIVER_DEVICE_GPS",
            });
          } catch (e) {
            console.warn("[DriverMode] Telemetry send failed:", e);
          }
        },
        (err) => {
          setGpsError(err.message || t("GPS permission denied", "تم رفض إذن الوصول للموقع"));
          setIsGpsBroadcasting(false);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    }
  };

  // Cleanup geolocation on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Execute canonical state transition
  const handleTransitionAction = async (targetStatus: string, actionLabelAr: string) => {
    if (!active?.id) return;
    setIsSubmitting(true);
    setActionSuccessMsg(null);

    try {
      const res = await apiClient.trips.transition(active.id, {
        targetStatus,
        notes: `تم الإجراء بواسطة السائق ${user?.fullName || "فهد الشمري"}: ${actionLabelAr}`,
        reason: actionLabelAr,
        latitude: gpsTelemetry?.latitude || active.currentLat,
        longitude: gpsTelemetry?.longitude || active.currentLng,
      });

      if (res?.trip) {
        setCurrentTrip(res.trip);
        updateTripStatus(active.id, targetStatus === "IN_TRANSIT" ? "on_road" : targetStatus === "DELIVERED" ? "delivered" : "ready", actionLabelAr);
        setActionSuccessMsg(`تم تحديث حالة الرحلة بنجاح إلى: ${actionLabelAr}`);
      }
    } catch (err: any) {
      alert(err.message || "فشل تنفيذ انتقال الحالة");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Proof of Delivery (POD)
  const handleSubmitPOD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active?.id || !recipientName) {
      alert("يرجى إدخال اسم المستلم وتأكيد التوقيع");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.pod.create({
        tripId: active.id,
        recipientName,
        recipientPhone,
        notes: deliveryNotes,
        signatureUrl: "SIGNED_DIGITALLY_ON_DRIVER_GLASS",
        latitude: gpsTelemetry?.latitude || active.currentLat,
        longitude: gpsTelemetry?.longitude || active.currentLng,
      });

      // Update trip state to delivered
      await handleTransitionAction("DELIVERED", "تم إثبات التسليم وتوقيع المستلم");
      setActionSuccessMsg("تم توثيق إثبات التسليم (POD) وإغلاق الرحلة بنجاح!");
      setActiveTab("home");
    } catch (err: any) {
      alert(err.message || "فشل تسجيل إثبات التسليم");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-0 text-white flex flex-col justify-between select-none">
      {/* Scrollable Content Container */}
      <div className="scroll-thin flex-1 overflow-y-auto pb-24">
        {/* Driver Shift Header */}
        <div className="px-5 pt-12 pb-4 bg-gradient-to-b from-navy via-navy to-surface-0 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand/20 text-[13px] font-bold text-brand border border-brand/30">
                {user?.fullName?.slice(0, 2) || "DR"}
              </span>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted">
                  {t("Driver Terminal", "بوابة السائق الميدانية")}
                </div>
                <div className="text-[14px] font-bold text-white truncate max-w-[190px]">
                  {user?.fullName || "فهد الشمري (كابتن أسطول)"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold border border-white/10">
              <span className="text-brand font-bold">★ 4.95</span>
              <span className="text-white/40">·</span>
              <span className="text-status-active">مناوب</span>
            </div>
          </div>

          {/* Assigned Truck Badge */}
          <div className="mt-3.5 flex items-center justify-between rounded-[12px] bg-surface-2 p-2.5 border border-border-subtle text-[11px]">
            <div className="flex items-center gap-2 truncate">
              <IconTruck size={16} className="text-brand shrink-0" />
              <span className="text-text-muted">{t("Assigned Vehicle:", "الشاحنة المكلفة:")}</span>
              <span className="font-bold text-white truncate">ر ج د ٤٨٢١ (براد ألماني)</span>
            </div>
            <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[9.5px] font-bold text-brand uppercase">
              {active?.cargoType || "براد"}
            </span>
          </div>
        </div>

        {/* Action feedback message */}
        {actionSuccessMsg && (
          <div className="mx-5 mt-3 rounded-[12px] bg-status-active/15 border border-status-active/30 p-3 text-[11.5px] text-status-active font-semibold text-center animate-fade-in flex items-center justify-center gap-2">
            <IconCheck size={16} />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* TAB 1: DRIVER HOME */}
        {activeTab === "home" && (
          <div className="px-5 py-4 space-y-4 animate-fade-in">
            {/* Active Assignment Card */}
            {active ? (
              <div className="rounded-[18px] bg-gradient-to-br from-navy via-surface-1 to-surface-2 p-4 border border-border-subtle shadow-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">{t("Active Assignment", "مهمة النقل الحالية")}</span>
                    <div className="text-[15px] font-bold text-brand">{active.tripNumber}</div>
                  </div>
                  <span className="rounded-full bg-status-active/15 border border-status-active/30 px-2.5 py-0.5 text-[10.5px] font-bold text-status-active">
                    {active.status}
                  </span>
                </div>

                {/* Route Points */}
                <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                  <div className="rounded-[10px] bg-surface-0/60 p-2 border border-white/5">
                    <div className="text-[10px] text-text-muted">{t("Loading Terminal", "نقطة التحميل")}</div>
                    <div className="font-bold text-white mt-0.5 truncate">{active.originCity}</div>
                  </div>
                  <div className="rounded-[10px] bg-surface-0/60 p-2 border border-white/5">
                    <div className="text-[10px] text-text-muted">{t("Destination Discharge", "وجهة التفريغ")}</div>
                    <div className="font-bold text-white mt-0.5 truncate">{active.destinationCity}</div>
                  </div>
                </div>

                {/* Cargo spec */}
                <div className="flex items-center justify-between text-[11px] text-text-secondary pt-1">
                  <span>{t("Cargo:", "الحمولة:")} <strong className="text-white">{active.cargoDescription || "ألبان طازجة مبردة"}</strong></span>
                  <span className="text-brand font-bold tabular-nums">{active.cargoWeightTons || 19.8} طن</span>
                </div>

                {/* Button to current trip actions */}
                <button
                  onClick={() => setActiveTab("trip")}
                  className="w-full flex h-10 items-center justify-center gap-2 rounded-[12px] bg-brand text-on-brand text-[12.5px] font-bold shadow-md hover:brightness-110 active:scale-95 transition-all"
                >
                  <IconStraight size={16} />
                  <span>{t("Open Trip Actions & Roadmap", "تنفيذ إجراءات الرحلة والمسار")}</span>
                </button>
              </div>
            ) : (
              <div className="rounded-[16px] bg-surface-1 p-6 text-center text-text-muted border border-border-subtle">
                {t("No active trip currently assigned to you", "لا توجد رحلة مسندة إليك حالياً")}
              </div>
            )}

            {/* Live GPS Broadcast Widget */}
            <div className="rounded-[16px] bg-surface-1 p-4 border border-border-subtle space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12.5px] font-bold text-white">{t("Field Driver GPS Broadcast", "بث موقع الجهاز الميداني")}</div>
                  <div className="text-[10.5px] text-text-muted">
                    {isGpsBroadcasting ? t("Live device location transmitting", "جاري بث الموقع الحقيقي للمركز والعميل") : t("GPS telemetry paused", "البث الميداني متوقف")}
                  </div>
                </div>
                <button
                  onClick={toggleGpsBroadcast}
                  className={cn(
                    "px-3 py-1.5 rounded-[10px] text-[11.5px] font-bold transition-all active:scale-95",
                    isGpsBroadcasting
                      ? "bg-status-danger text-white shadow-lg shadow-status-danger/30"
                      : "bg-brand text-on-brand shadow-lg shadow-brand/25"
                  )}
                >
                  {isGpsBroadcasting ? t("Stop GPS", "إيقاف البث") : t("Start GPS", "تفعيل البث")}
                </button>
              </div>

              {gpsTelemetry && (
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] rounded-[10px] bg-surface-2 p-2.5 border border-white/5 tabular-nums">
                  <div>
                    <span className="text-text-muted block">السرعة</span>
                    <strong className="text-status-active text-[12px]">{gpsTelemetry.speed} كم/س</strong>
                  </div>
                  <div>
                    <span className="text-text-muted block">الدقة</span>
                    <strong className="text-white text-[12px]">±{gpsTelemetry.accuracy}م</strong>
                  </div>
                  <div>
                    <span className="text-text-muted block">آخر إرسال</span>
                    <strong className="text-brand text-[12px]">{gpsTelemetry.timestamp}</strong>
                  </div>
                </div>
              )}

              {gpsError && (
                <div className="text-[10.5px] text-status-danger bg-status-danger/10 p-2 rounded-[8px] border border-status-danger/20">
                  {gpsError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DRIVER TRIPS (All | Available | Confirmed | Active | Completed) */}
        {activeTab === "trips" && (
          <div className="px-5 py-4 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <div>
                <span className="text-[10px] text-text-muted uppercase tracking-wider">
                  {t("Driver Fleet Schedule", "جدول رحلات السائق والمهام")}
                </span>
                <h2 className="text-[16px] font-bold text-white">
                  {t("Trips & Available Dispatch", "الرحلات وعروض النقل المتاحة")}
                </h2>
              </div>
              <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-[10.5px] font-bold text-brand tabular-nums">
                {driverTrips.length} {t("Trips", "رحلة")}
              </span>
            </div>

            {/* 5-Filter Segment Control: الكل | متاحة | مؤكدة | جارية | مكتملة */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scroll-thin text-[11px] font-semibold">
              {[
                ["all", t("All", "الكل")],
                ["available", t("Available", "متاحة")],
                ["confirmed", t("Confirmed", "مؤكدة")],
                ["active", t("Active", "جارية")],
                ["completed", t("Completed", "مكتملة")],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTripsSubTab(key as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-full whitespace-nowrap transition-all duration-200 active:scale-95",
                    tripsSubTab === key
                      ? "bg-brand text-on-brand font-bold shadow-md shadow-brand/20"
                      : "bg-surface-2 text-text-muted hover:text-white border border-white/5"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Trips List */}
            {driverTrips.length === 0 ? (
              <div className="rounded-[16px] bg-surface-1 p-8 text-center text-text-muted border border-border-subtle">
                <IconTruck size={28} className="mx-auto mb-2 text-text-muted/40" />
                <div className="text-[12px] font-semibold text-white">
                  {tripsSubTab === "available"
                    ? t("No open trips currently available for request", "لا توجد رحلات متاحة للطلب حالياً")
                    : t("No trips found in this category", "لا توجد رحلات في هذا القسم")}
                </div>
                <p className="text-[10.5px] text-text-muted mt-1">
                  {t("Check back shortly or contact Operations Dispatch", "يمكنك متابعة التحديثات الميدانية أو مراجعة غرفة العمليات")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {driverTrips.map((tr) => {
                  const isAvailable =
                    tr.status === "DRAFT_CREATED" ||
                    tr.status === "PENDING_APPROVAL" ||
                    !tr.driverId ||
                    tr.driverId === "unassigned";

                  const isRequestedByMe =
                    tr.requestedByDriverId === user?.driverId ||
                    tr.requestedByDriverId === user?.id ||
                    tr.driverRequestStatus === "PENDING";

                  return (
                    <div
                      key={tr.id}
                      className="rounded-[16px] bg-surface-1 p-4 border border-border-subtle shadow-lg space-y-3 transition-all hover:border-brand/30"
                    >
                      {/* Top Bar */}
                      <div className="flex items-center justify-between pb-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="text-[13.5px] font-bold text-brand">{tr.tripNumber}</span>
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[9.5px] font-bold text-text-muted uppercase">
                            {tr.cargoType || "ستارة"}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                            tr.status === "IN_TRANSIT"
                              ? "bg-status-active/15 text-status-active border border-status-active/30"
                              : tr.status === "DELIVERED" || tr.status === "COMPLETED"
                              ? "bg-accent-2/15 text-accent-2 border border-accent-2/30"
                              : "bg-status-waiting/15 text-status-waiting border border-status-waiting/30"
                          )}
                        >
                          {tr.status}
                        </span>
                      </div>

                      {/* Route */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-[10px] bg-surface-2 p-2">
                          <span className="text-[9.5px] text-text-muted block">{t("Origin", "الانطلاق")}</span>
                          <strong className="text-white truncate block mt-0.5">{tr.originCity}</strong>
                        </div>
                        <div className="rounded-[10px] bg-surface-2 p-2">
                          <span className="text-[9.5px] text-text-muted block">{t("Destination", "الوجهة")}</span>
                          <strong className="text-white truncate block mt-0.5">{tr.destinationCity}</strong>
                        </div>
                      </div>

                      {/* Cargo, Vehicle & Price */}
                      <div className="flex items-center justify-between text-[11px] text-text-secondary pt-1">
                        <span>
                          {t("Cargo:", "الحمولة:")} <strong className="text-white">{tr.cargoDescription || tr.cargoType}</strong>
                        </span>
                        {tr.tripPrice && (
                          <span className="text-status-active font-bold tabular-nums">
                            {Number(tr.tripPrice).toLocaleString("ar-SA")} {t("SAR", "ر.س")}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="pt-1">
                        {isAvailable ? (
                          isRequestedByMe ? (
                            <div className="w-full py-2 rounded-[10px] bg-status-waiting/20 border border-status-waiting/40 text-status-waiting text-center font-bold text-[11.5px] flex items-center justify-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-status-waiting animate-pulse" />
                              <span>{t("Request Pending Operations Review", "الطلب قيد مراجعة غرفة العمليات")}</span>
                            </div>
                          ) : (
                            <button
                              disabled={isSubmitting}
                              onClick={() => handleRequestTrip(tr.id)}
                              className="w-full h-10 rounded-[12px] bg-brand text-on-brand font-bold text-[12px] shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                              <IconTruck size={15} />
                              <span>{t("Request Trip Assignment", "طلب الرحلة")}</span>
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => {
                              setCurrentTrip(tr);
                              setActiveTab("trip");
                            }}
                            className="w-full h-9 rounded-[10px] bg-surface-2 text-white hover:bg-surface-3 font-semibold text-[11.5px] border border-white/10 transition-colors flex items-center justify-center gap-2"
                          >
                            <IconStraight size={14} />
                            <span>{t("Open Trip Actions & Roadmap", "عرض مسار وإجراءات الرحلة")}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CURRENT TRIP & SEQUENTIAL ACTIONS */}
        {activeTab === "trip" && (
          <div className="px-5 py-4 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <div>
                <span className="text-[10.5px] text-text-muted uppercase">{t("Trip Control", "التحكم في مراحل الرحلة")}</span>
                <div className="text-[15px] font-bold text-brand">{active?.tripNumber || "EJ-2026-000125"}</div>
              </div>
              <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-[10.5px] font-bold text-brand">
                {active?.status || "CONFIRMED"}
              </span>
            </div>

            {/* Step-by-Step Action Controller */}
            <div className="rounded-[16px] bg-surface-1 p-4 border border-border-subtle space-y-3">
              <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
                <IconBolt size={15} className="text-brand" />
                <span>{t("Current Stage & Authorized Actions", "المرحلة التشغيلية الحالية والإجراء المتاح")}</span>
              </h3>

              <div className="rounded-[12px] bg-surface-2 p-3 text-[11.5px] leading-relaxed border border-white/5">
                <span className="text-text-muted">{t("Current Status:", "الحالة الحالية:")} </span>
                <strong className="text-status-active font-semibold">{active?.status}</strong>
              </div>

              {/* Dynamic Authorized Button based on Canonical State */}
              <div className="pt-1">
                {(!active?.status || active?.status === "CONFIRMED" || active?.status === "ASSIGNED") && (
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleTransitionAction("HEADING_TO_LOADING", "بدء التوجه لموقع التحميل")}
                    className="w-full h-11 rounded-[12px] bg-brand text-on-brand font-bold text-[13px] shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>1. {t("Start Heading to Loading Bay", "بدء التوجه لموقع التحميل")}</span>
                  </button>
                )}

                {active?.status === "HEADING_TO_LOADING" && (
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleTransitionAction("ARRIVED_LOADING", "تأكيد الوصول لساحة التحميل")}
                    className="w-full h-11 rounded-[12px] bg-brand text-on-brand font-bold text-[13px] shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>2. {t("Confirm Arrived at Loading Bay", "تأكيد الوصول لموقع التحميل")}</span>
                  </button>
                )}

                {active?.status === "ARRIVED_LOADING" && (
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleTransitionAction("LOADED", "تأكيد إتمام التحميل ومطابقة الحمولة")}
                    className="w-full h-11 rounded-[12px] bg-brand text-on-brand font-bold text-[13px] shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>3. {t("Confirm Cargo Loaded & Strapped", "تأكيد إتمام التحميل وإصدار البوليصة")}</span>
                  </button>
                )}

                {active?.status === "LOADED" && (
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleTransitionAction("IN_TRANSIT", "الانطلاق على الطريق السريع")}
                    className="w-full h-11 rounded-[12px] bg-status-active text-navy font-bold text-[13px] shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>4. {t("Depart & Start Highway Transit", "الانطلاق وبدء مسار السفر (على الطريق)")}</span>
                  </button>
                )}

                {active?.status === "IN_TRANSIT" && (
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleTransitionAction("ARRIVED_DESTINATION", "تأكيد الوصول لوجهة التفريغ")}
                    className="w-full h-11 rounded-[12px] bg-accent-2 text-white font-bold text-[13px] shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>5. {t("Confirm Arrived at Destination", "تأكيد الوصول لوجهة التفريغ")}</span>
                  </button>
                )}

                {active?.status === "ARRIVED_DESTINATION" && (
                  <button
                    disabled={isSubmitting}
                    onClick={() => setActiveTab("pod")}
                    className="w-full h-11 rounded-[12px] bg-status-active text-navy font-bold text-[13px] shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>6. {t("Proceed to Delivery & Sign POD", "إثبات التسليم وتوقيع المستلم (POD)")}</span>
                  </button>
                )}

                {(active?.status === "DELIVERED" || active?.status === "COMPLETED") && (
                  <div className="rounded-[12px] bg-status-active/20 border border-status-active/40 p-3 text-center text-status-active font-bold text-[12.5px]">
                    ✓ {t("Trip Delivered & Completed Successfully", "تم تسليم الشحنة وإتمام الرحلة بنجاح")}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: NAVIGATION & MAP */}
        {activeTab === "gps" && (
          <div className="h-full flex flex-col p-4 animate-fade-in space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-text-muted uppercase">{t("Driver Route Navigation", "ملاحة المسار والموقع الميداني")}</span>
                <div className="text-[14px] font-bold text-white">{active?.originCity} → {active?.destinationCity}</div>
              </div>
              <button
                onClick={toggleGpsBroadcast}
                className={cn(
                  "px-3 py-1 rounded-[8px] text-[11px] font-bold",
                  isGpsBroadcasting ? "bg-status-danger text-white" : "bg-brand text-on-brand"
                )}
              >
                {isGpsBroadcasting ? "إيقاف GPS" : "تشغيل GPS"}
              </button>
            </div>

            {/* Embedded Live Map Component */}
            <div className="h-[340px] w-full rounded-[16px] overflow-hidden border border-border-subtle shadow-xl">
              <InteractiveMap trip={mappedTrip} compact showCardOverlay={false} />
            </div>
          </div>
        )}

        {/* TAB 4: PROOF OF DELIVERY (POD) */}
        {activeTab === "pod" && (
          <form onSubmit={handleSubmitPOD} className="px-5 py-4 space-y-3.5 animate-fade-in">
            <h2 className="text-[15px] font-bold text-white">{t("Proof of Delivery (POD)", "توثيق إثبات التسليم الرسمي")}</h2>
            <p className="text-[11.5px] text-text-muted leading-relaxed">
              {t("Enter recipient info and capture digital sign-off for", "أدخل بيانات المستلم وتأكيد التوقيع الإلكتروني للشحنة")}{" "}
              <strong className="text-brand">{active?.tripNumber}</strong>
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">اسم المستلم الرسمي *</label>
              <input
                type="text"
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="مثال: طارق منصور"
                className="w-full h-10 rounded-[10px] bg-surface-2 px-3 text-[12.5px] text-white border border-border-subtle outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">رقم هاتف المستلم</label>
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="+966 5X XXX XXXX"
                className="w-full h-10 rounded-[10px] bg-surface-2 px-3 text-[12.5px] text-white border border-border-subtle outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">ملاحظات حالة البضاعة</label>
              <textarea
                rows={2}
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                className="w-full rounded-[10px] bg-surface-2 p-2.5 text-[11.5px] text-white border border-border-subtle outline-none resize-none"
              />
            </div>

            {/* Digital Signature Confirmation Pad */}
            <div className="rounded-[12px] bg-surface-1 p-3 border border-border-subtle space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-white">توقيع المستلم الإلكتروني *</span>
                <span className="text-[10px] text-brand">معتمد بالبصمة الرقمية</span>
              </div>
              <div
                onClick={() => setSignatureDone(true)}
                className={cn(
                  "h-20 w-full rounded-[10px] border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors",
                  signatureDone
                    ? "border-status-active bg-status-active/10 text-status-active font-bold text-[12px]"
                    : "border-border-subtle bg-surface-2 text-text-muted text-[11px]"
                )}
              >
                {signatureDone ? "✓ تم تسجيل التوقيع الرقمي بنجاح" : "اضغط هنا لتسجيل توقيع المستلم على الشاشة"}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !signatureDone || !recipientName}
              className="w-full h-11 rounded-[12px] bg-status-active text-navy font-bold text-[13px] shadow-lg shadow-status-active/25 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? "جاري التوثيق..." : "اعتماد وتسجيل إثبات التسليم (Confirm Delivery)"}
            </button>
          </form>
        )}

        {/* TAB 5: DRIVER PROFILE */}
        {activeTab === "profile" && (
          <div className="px-5 py-4 space-y-4 animate-fade-in">
            <h2 className="text-[15px] font-bold text-white">{t("Driver Profile", "الملف الشخصي للسائق")}</h2>

            <div className="rounded-[16px] bg-surface-1 p-4 border border-border-subtle space-y-3 text-[12px]">
              <div className="flex items-center gap-3 pb-3 border-b border-white/5">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-brand/20 text-[15px] font-bold text-brand">
                  {user?.fullName?.slice(0, 2) || "DR"}
                </span>
                <div>
                  <div className="font-bold text-[14px] text-white">{user?.fullName || "فهد الشمري"}</div>
                  <div className="text-[11px] text-text-muted">{user?.phone || "+966 55 123 4567"}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-text-muted">رقم الرخصة المعتمد:</span>
                <span className="font-mono text-white">DL-SA-91823 (نقل ثقيل)</span>
              </div>

              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-text-muted">صلاحية رخصة القيادة:</span>
                <span className="text-status-active font-semibold">سارية حتى 2028-06-14</span>
              </div>

              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-text-muted">التقييم التشغيلي:</span>
                <span className="text-brand font-bold">★ 4.95 (184 رحلة ناجحة)</span>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="w-full flex h-11 items-center justify-center gap-2 rounded-[12px] bg-status-danger/15 border border-status-danger/30 text-status-danger font-bold text-[12.5px] hover:bg-status-danger hover:text-white transition-all"
            >
              <span>{t("Sign Out from Driver Account", "تسجيل الخروج من حساب السائق")}</span>
            </button>
          </div>
        )}
      </div>

      {/* Modern Bottom Navigation Bar */}
      <div className="absolute bottom-3 inset-x-4 z-40 flex items-center justify-around rounded-[18px] bg-navy/95 border border-white/10 px-2 py-2 shadow-2xl backdrop-blur-xl">
        {[
          ["home", t("Shift", "الرئيسية"), IconHome],
          ["trips", t("Trips", "الرحلات"), IconOrders],
          ["trip", t("Actions", "الإجراءات"), IconStraight],
          ["gps", t("Route", "الملاحة"), IconPin],
          ["profile", t("Profile", "حسابي"), IconProfile],
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
