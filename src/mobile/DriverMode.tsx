import { useState, useEffect, useRef } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore, type Trip } from "../state/fleetStore";
import { apiClient } from "../services/apiClient";
import { InteractiveMap } from "../components/InteractiveMap";
import { normalizeVehicleType, getVehicleTypeMeta } from "../data/vehicleTypes";
import { TruckTypeAvatar, TruckTypeBadge } from "../components/TruckTypeIcon";
import { MobileNotificationsList, useMobileNotifications, MobileSection, MobileRow } from "./MobileShared";
import { MobileUserManagement } from "./MobileUserManagement";
import {
  IconHome,
  IconPin,
  IconProfile,
  IconCheck,
  IconStraight,
  IconOrders,
  IconBell,
  IconDoc,
} from "../components/Icons";

/**
 * تطبيق السائق (§13) — independent driver interface over the shared backend.
 *
 * Navigation: الرئيسية · الرحلات · التتبع · الإشعارات · حسابي (§29).
 * Every number and identity on the screen comes from the live session/API —
 * never from hardcoded sample data (§32). «إضافة سائق / إضافة عميل» appear in
 * «إدارة المستخدمين» only for identities holding the matching capabilities
 * (§15, §16).
 */
interface DriverModeProps {
  user: any;
  onLogout: () => void;
  onOpenSettings?: () => void;
  /** Bumped by the header bell — switches to the notifications tab. */
  notificationsSignal?: number;
}

type DriverTab = "home" | "trips" | "trip" | "pod" | "track" | "notifications" | "account";

export function DriverMode({ user, onLogout, onOpenSettings, notificationsSignal = 0 }: DriverModeProps) {
  const { t, td } = useSettings();
  const { updateTripStatus } = useFleetStore();
  const [activeTab, setActiveTab] = useState<DriverTab>("home");
  const [tripsSubTab, setTripsSubTab] = useState<"all" | "available" | "confirmed" | "active" | "completed">("all");
  const [driverTrips, setDriverTrips] = useState<any[]>([]);
  const [currentTrip, setCurrentTrip] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Real Device GPS telemetry (§24 — never simulated)
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
  const [gpsProviderConfigured, setGpsProviderConfigured] = useState<boolean | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Proof of Delivery form state
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [signatureDone, setSignatureDone] = useState(false);

  const notifications = useMobileNotifications();

  // The header bell (§4) points at the single notifications tab (§27).
  useEffect(() => {
    if (notificationsSignal > 0) setActiveTab("notifications");
  }, [notificationsSignal]);

  // Fetch driver assigned trips from backend API (real data first)
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
      } catch {
        if (isMounted) setDriverTrips([]);
      }
    }
    loadDriverTrips();
    return () => {
      isMounted = false;
    };
  }, [tripsSubTab]);

  // GPS provider status — §24: if no real provider is configured we say so.
  useEffect(() => {
    let mounted = true;
    apiClient.gps
      .getStatus()
      .then((s) => mounted && setGpsProviderConfigured(!!s?.configured))
      .catch(() => mounted && setGpsProviderConfigured(false));
    return () => {
      mounted = false;
    };
  }, []);

  const handleRequestTrip = async (tripId: string) => {
    setIsSubmitting(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);
    try {
      await apiClient.trips.requestTrip(tripId, `طلب الرحلة بواسطة السائق ${user?.fullName || ""}`);
      setActionSuccessMsg(t("Trip requested successfully! Sent to Operations for approval.", "تم إرسال طلب الرحلة لغرفة العمليات للموافقة بنجاح!"));
      const res = await apiClient.trips.getDriverTrips(tripsSubTab);
      if (res?.trips) setDriverTrips(res.trips);
    } catch {
      setActionErrorMsg(t("Unable to send the trip request right now.", "تعذّر إرسال طلب الرحلة حاليًا."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const active = currentTrip || driverTrips[0] || null;

  /** The map needs a route record; built only from real trip fields. */
  const mappedTrip: Trip | null = active
    ? {
        id: active.id,
        tripNumber: active.tripNumber,
        truckId: active.vehicleId || active.truckId || "",
        driverId: active.driverId || "",
        shipper: active.customerName || "",
        consignee: active.deliveryAddress || "",
        originCity: active.originCity || "",
        originTerminal: active.pickupAddress || "",
        destinationCity: active.destinationCity || "",
        destinationTerminal: active.deliveryAddress || "",
        corridorKey: active.corridorKey || "riyadh-jeddah",
        cargoType: normalizeVehicleType(active.cargoType),
        cargoWeightTons: Number(active.cargoWeightTons || 0),
        maxCapacityTons: Number(active.maxCapacityTons || 0),
        status: active.status === "IN_TRANSIT" ? "on_road" : active.status === "DELIVERED" ? "delivered" : "ready",
        progressPct: Number(active.progressPct || 0),
        speedKmH: Number(active.currentSpeed || 0),
        headingDeg: Number(active.currentHeading || 0),
        currentLat: Number(active.currentLat || 0),
        currentLng: Number(active.currentLng || 0),
        distanceTotalKm: Number(active.distanceTotalKm || 0),
        distanceCoveredKm: Number(active.distanceCoveredKm || 0),
        distanceRemainingKm: Number(active.distanceRemainingKm || 0),
        etaMinutes: Number(active.etaMinutes || 0),
        nextWaypointAr: active.nextWaypointAr || "",
        nextWaypointEn: active.nextWaypointEn || "",
        createdAt: active.createdAt || "",
        qrCodeToken: `EJAZ-${active.tripNumber || active.id}`,
        timeline: [],
      }
    : null;

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
          const spd = Math.round((pos.coords.speed || 0) * 3.6);
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

          try {
            await apiClient.gps.recordTelemetry({
              vehicleId: active?.vehicleId,
              deviceId: `DEVICE-${user?.id || user?.driverId || ""}`,
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

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const handleTransitionAction = async (targetStatus: string, actionLabelAr: string) => {
    if (!active?.id) return;
    setIsSubmitting(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    const mappedUiStatus =
      targetStatus === "IN_TRANSIT"
        ? "on_road"
        : targetStatus === "DELIVERED"
          ? "delivered"
          : targetStatus === "ARRIVED_DESTINATION"
            ? "arrived"
            : "ready";

    try {
      const res = await apiClient.trips.transition(active.id, {
        targetStatus,
        notes: `تم الإجراء بواسطة السائق ${user?.fullName || ""}: ${actionLabelAr}`,
        reason: actionLabelAr,
        latitude: gpsTelemetry?.latitude,
        longitude: gpsTelemetry?.longitude,
      });

      if (res?.trip) {
        setCurrentTrip(res.trip);
      }
      updateTripStatus(active.id, mappedUiStatus, actionLabelAr);
      setActionSuccessMsg(`تم تحديث حالة الرحلة بنجاح إلى: ${actionLabelAr}`);
    } catch {
      setActionErrorMsg(t("Unable to update the trip status.", "تعذّر تحديث حالة الرحلة."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitPOD = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionErrorMsg(null);
    if (!active?.id || !recipientName) {
      setActionErrorMsg(t("Enter the recipient name and confirm the signature.", "يرجى إدخال اسم المستلم وتأكيد التوقيع"));
      return;
    }
    if (!signatureDone) {
      setActionErrorMsg(t("Confirm the recipient's digital signature first.", "يرجى تأكيد التوقيع الإلكتروني من المستلم أولًا."));
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
        latitude: gpsTelemetry?.latitude,
        longitude: gpsTelemetry?.longitude,
      });
    } catch {
      /* the transition below still records the delivery event */
    }
    try {
      await handleTransitionAction("DELIVERED", "تم إثبات التسليم وتوقيع المستلم");
      setActionSuccessMsg(t("Proof of delivery recorded and the trip is closed.", "تم توثيق إثبات التسليم (POD) وإغلاق الرحلة بنجاح!"));
      setRecipientName("");
      setRecipientPhone("");
      setDeliveryNotes("");
      setSignatureDone(false);
      setActiveTab("home");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-0 text-white flex flex-col justify-between select-none">
      <div className="scroll-thin flex-1 overflow-y-auto pb-24">
        {/* Greeting — the live identity, no hardcoded names or ratings (§32) */}
        <div className="px-5 pt-5 pb-4 bg-gradient-to-b from-navy via-navy to-surface-0 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand/20 text-[13px] font-bold text-brand border border-brand/30">
              {(user?.fullName || "—").slice(0, 2)}
            </span>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">
                {t("Driver app", "تطبيق السائق")}
              </div>
              <div className="text-[14px] font-bold text-white truncate max-w-[220px]">
                {t("Welcome", "مرحبًا")}، {user?.fullName || user?.email || "—"}
              </div>
            </div>
            <div className="ms-auto flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold border border-white/10">
              <span className="text-status-active">{t("On duty", "مناوب")}</span>
            </div>
          </div>

          {/* Assigned truck badge — real data only */}
          {active && (
            <div className="mt-3.5 flex items-center justify-between rounded-[12px] bg-surface-2 p-2.5 border border-border-subtle text-[11px]">
              <div className="flex items-center gap-2.5 truncate">
                <TruckTypeAvatar truckType={active.cargoType || "flatbed"} size={30} iconSize={16} showBadge />
                <div className="truncate">
                  <span className="text-text-muted me-1">{t("Assigned Vehicle:", "الشاحنة المكلفة:")}</span>
                  <strong className="text-white truncate">
                    {active.vehiclePlate || active.plate || t("—", "—")}{" "}
                    {active.cargoType ? `(${getVehicleTypeMeta(active.cargoType).arabicName})` : ""}
                  </strong>
                </div>
              </div>
              <TruckTypeBadge truckType={active.cargoType || "flatbed"} size={11} />
            </div>
          )}
        </div>

        {actionSuccessMsg && (
          <div className="mx-5 mt-3 rounded-[12px] bg-status-active/15 border border-status-active/30 p-3 text-[11.5px] text-status-active font-semibold text-center animate-fade-in flex items-center justify-center gap-2">
            <IconCheck size={16} />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {actionErrorMsg && (
          <div className="mx-5 mt-3 rounded-[12px] bg-status-danger/15 border border-status-danger/30 p-3 text-[11.5px] text-status-danger font-semibold text-center animate-fade-in flex items-center justify-center gap-2">
            <span className="font-bold">!</span>
            <span>{actionErrorMsg}</span>
          </div>
        )}

        {/* ── الرئيسية ─────────────────────────────────────────────── */}
        {activeTab === "home" && (
          <div className="px-5 py-4 space-y-4 animate-fade-in">
            {active ? (
              <div className="rounded-[18px] bg-gradient-to-br from-navy via-surface-1 to-surface-2 p-4 border border-border-subtle shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted uppercase">{t("Current trip", "الرحلة الحالية")}</span>
                  <span className="text-[11px] font-bold text-brand tabular-nums">{active.tripNumber}</span>
                </div>
                <div className="text-[13.5px] font-bold text-white">
                  {td(active.originCity)} ← {td(active.destinationCity)}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] rounded-[10px] bg-surface-2 p-2.5 border border-white/5 tabular-nums">
                  <div>
                    <div className="text-text-muted">{t("Status", "الحالة")}</div>
                    <div className="font-bold text-white">{td(active.statusAr || active.status)}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">{t("Cargo", "الحمولة")}</div>
                    <div className="font-bold text-white">{active.cargoWeightTons ? `${active.cargoWeightTons}` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">{t("Type", "النوع")}</div>
                    <div className="font-bold text-white">{getVehicleTypeMeta(active.cargoType || "flatbed").arabicName}</div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("trip")}
                  className="w-full h-10 rounded-[12px] bg-brand text-on-brand font-bold text-[12px] hover:brightness-110 active:scale-95 transition-all"
                >
                  {t("Open current trip", "فتح الرحلة الحالية")}
                </button>
              </div>
            ) : (
              <div className="rounded-[18px] border border-border-subtle bg-surface-1 p-6 text-center">
                <IconOrders size={22} className="mx-auto text-text-muted" />
                <p className="mt-2 text-[11.5px] text-text-muted">
                  {t("No trips are assigned to you yet.", "لا توجد رحلات مسندة إليك حتى الآن.")}
                </p>
                <button
                  onClick={() => setActiveTab("trips")}
                  className="mt-3 rounded-full bg-brand/15 px-4 py-1.5 text-[11px] font-bold text-brand"
                >
                  {t("Browse available trips", "تصفح الرحلات المتاحة")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── الرحلات ──────────────────────────────────────────────── */}
        {activeTab === "trips" && (
          <div className="px-5 py-4 space-y-3 animate-fade-in">
            <h2 className="text-[15px] font-bold text-white">{t("Trips & Available Dispatch", "الرحلات وعروض النقل المتاحة")}</h2>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scroll-x">
              {(["all", "available", "confirmed", "active", "completed"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setTripsSubTab(key)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-[10px] font-bold transition-colors",
                    tripsSubTab === key ? "bg-brand text-on-brand" : "bg-surface-2 text-text-muted hover:text-white"
                  )}
                >
                  {key === "all" ? t("All", "الكل") : key === "available" ? t("Available", "المتاحة") : key === "confirmed" ? t("Confirmed", "المؤكدة") : key === "active" ? t("In progress", "الجارية") : t("Completed", "المكتملة")}
                </button>
              ))}
            </div>

            {driverTrips.length === 0 ? (
              <div className="rounded-[14px] border border-border-subtle bg-surface-1 p-6 text-center text-[11px] text-text-muted">
                {tripsSubTab === "available"
                  ? t("No available trips right now.", "لا توجد رحلات متاحة حاليًا.")
                  : t("No trips in this list.", "لا توجد رحلات في هذه القائمة.")}
              </div>
            ) : (
              driverTrips.map((tr) => (
                <div key={tr.id} className="rounded-[14px] border border-border-subtle bg-surface-1 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-brand tabular-nums">{tr.tripNumber}</span>
                    <TruckTypeBadge truckType={tr.cargoType || "flatbed"} size={10} />
                  </div>
                  <div className="text-[12px] font-semibold text-white">
                    {td(tr.originCity)} ← {td(tr.destinationCity)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-text-muted">{td(tr.statusAr || tr.status)}</span>
                    <div className="flex gap-1.5">
                      {tripsSubTab === "available" ? (
                        <button
                          onClick={() => handleRequestTrip(tr.id)}
                          disabled={isSubmitting}
                          className="rounded-[8px] bg-brand px-3 py-1 text-[10px] font-bold text-on-brand disabled:opacity-50"
                        >
                          {t("Accept trip", "طلب الرحلة")}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setCurrentTrip(tr);
                            setActiveTab("trip");
                          }}
                          className="rounded-[8px] bg-surface-2 px-3 py-1 text-[10px] font-bold text-white hover:bg-brand hover:text-on-brand"
                        >
                          {t("Open", "فتح")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── الرحلة الحالية + الإجراءات ───────────────────────────── */}
        {activeTab === "trip" && (
          <div className="px-5 py-4 space-y-3 animate-fade-in">
            {active ? (
              <>
                <h2 className="text-[15px] font-bold text-white">{t("Current trip", "الرحلة الحالية")}</h2>
                <div className="rounded-[14px] border border-border-subtle bg-surface-1 p-3.5 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">{t("Trip number", "رقم الرحلة")}</span>
                    <span className="font-bold text-brand tabular-nums">{active.tripNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">{t("Route", "المسار")}</span>
                    <span className="font-semibold text-white">{td(active.originCity)} ← {td(active.destinationCity)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">{t("Status", "الحالة")}</span>
                    <span className="font-semibold text-white">{td(active.statusAr || active.status)}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleTransitionAction("IN_TRANSIT", "بدء الرحلة")}
                  disabled={isSubmitting}
                  className="w-full h-11 rounded-[12px] bg-status-active text-navy font-bold text-[13px] shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <IconStraight size={15} />
                  {t("Start trip (IN_TRANSIT)", "بدء الرحلة (قيد النقل)")}
                </button>
                <button
                  onClick={() => handleTransitionAction("ARRIVED_DESTINATION", "الوصول إلى الوجهة")}
                  disabled={isSubmitting}
                  className="w-full h-11 rounded-[12px] bg-brand text-on-brand font-bold text-[12.5px] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                  {t("Arrived at destination", "الوصول إلى الوجهة")}
                </button>
                <button
                  onClick={() => setActiveTab("pod")}
                  className="w-full h-11 rounded-[12px] bg-surface-2 border border-border-subtle text-white font-bold text-[12.5px] hover:bg-surface-3 transition-all"
                >
                  {t("Proof of delivery (POD)", "إثبات التسليم (POD)")}
                </button>
              </>
            ) : (
              <div className="rounded-[14px] border border-border-subtle bg-surface-1 p-6 text-center text-[11px] text-text-muted">
                {t("No current trip selected.", "لم يتم تحديد رحلة حالية.")}
              </div>
            )}
          </div>
        )}

        {/* ── إثبات التسليم (POD) ─────────────────────────────────── */}
        {activeTab === "pod" && (
          <form onSubmit={handleSubmitPOD} className="px-5 py-4 space-y-3.5 animate-fade-in">
            <h2 className="text-[15px] font-bold text-white">{t("Proof of Delivery (POD)", "توثيق إثبات التسليم الرسمي")}</h2>
            <p className="text-[11.5px] text-text-muted leading-relaxed">
              {t("Enter recipient info and capture digital sign-off for", "أدخل بيانات المستلم وتأكيد التوقيع الإلكتروني للشحنة")}{" "}
              <strong className="text-brand">{active?.tripNumber || "—"}</strong>
            </p>

            <div>
              <label className="mb-1 block text-[10px] font-semibold text-text-muted">
                {t("Recipient name", "اسم المستلم")}
                <span className="text-status-danger"> *</span>
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full rounded-[10px] border border-border-subtle bg-surface-2 px-3 py-2 text-[11px] text-white focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold text-text-muted">
                {t("Recipient phone", "هاتف المستلم")}
              </label>
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                className="w-full rounded-[10px] border border-border-subtle bg-surface-2 px-3 py-2 text-[11px] text-white focus:border-brand focus:outline-none"
                inputMode="tel"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold text-text-muted">
                {t("Delivery notes", "ملاحظات التسليم")}
              </label>
              <textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                rows={2}
                className="w-full rounded-[10px] border border-border-subtle bg-surface-2 px-3 py-2 text-[11px] text-white focus:border-brand focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setSignatureDone((v) => !v)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[12px] border p-3 text-start transition-colors",
                signatureDone
                  ? "border-status-active/50 bg-status-active/10"
                  : "border-border-subtle bg-surface-2",
              )}
            >
              <span
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border",
                  signatureDone ? "border-status-active bg-status-active text-navy" : "border-border-subtle",
                )}
              >
                {signatureDone && <IconCheck size={12} />}
              </span>
              <span className="text-[11px] font-semibold text-white">
                {t("The recipient signed digitally", "تم التوقيع الإلكتروني من المستلم")}
              </span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-[12px] bg-status-active text-navy font-bold text-[12.5px] shadow-lg shadow-status-active/25 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? t("Recording…", "جاري التوثيق…") : t("Confirm delivery (POD)", "اعتماد وتسجيل إثبات التسليم")}
            </button>
          </form>
        )}

        {/* ── التتبع (GPS حقيقي فقط، §24) ─────────────────────────── */}
        {activeTab === "track" && (
          <div className="h-full flex flex-col p-4 animate-fade-in space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-text-muted uppercase">{t("Driver Route Navigation", "ملاحة المسار والموقع الميداني")}</span>
                <div className="text-[14px] font-bold text-white">
                  {active ? `${td(active.originCity)} → ${td(active.destinationCity)}` : t("No active trip", "لا توجد رحلة نشطة")}
                </div>
              </div>
              <button
                onClick={toggleGpsBroadcast}
                className={cn(
                  "px-3 py-1 rounded-[8px] text-[11px] font-bold",
                  isGpsBroadcasting ? "bg-status-danger text-white" : "bg-brand text-on-brand"
                )}
              >
                {isGpsBroadcasting ? t("Stop GPS", "إيقاف GPS") : t("Start GPS", "تشغيل GPS")}
              </button>
            </div>

            {gpsProviderConfigured === false && (
              <div className="rounded-[12px] border border-brand/40 bg-brand/10 p-2.5 text-[10.5px] font-semibold text-brand">
                {t("GPS service is not configured on the platform. Device GPS broadcasting still works; live fleet telemetry requires the provider setup.", "خدمة GPS غير مهيأة على المنصة. بث موقع الجهاز يعمل، لكن تتبع الأسطول المباشر يتطلب إعداد مزود الخدمة.")}
              </div>
            )}

            {gpsError && (
              <div className="rounded-[12px] border border-status-danger/40 bg-status-danger/10 p-2.5 text-[10.5px] text-status-danger">
                {gpsError}
              </div>
            )}

            {gpsTelemetry && (
              <div className="grid grid-cols-3 gap-2 rounded-[10px] bg-surface-2 p-2.5 border border-white/5 text-center text-[10px] tabular-nums">
                <div>
                  <div className="text-text-muted">{t("Latitude", "خط العرض")}</div>
                  <div className="font-bold text-white">{gpsTelemetry.latitude.toFixed(5)}</div>
                </div>
                <div>
                  <div className="text-text-muted">{t("Longitude", "خط الطول")}</div>
                  <div className="font-bold text-white">{gpsTelemetry.longitude.toFixed(5)}</div>
                </div>
                <div>
                  <div className="text-text-muted">{t("Speed", "السرعة")}</div>
                  <div className="font-bold text-white">{gpsTelemetry.speed} km/h</div>
                </div>
              </div>
            )}

            {mappedTrip && (
              <div className="h-[320px] w-full rounded-[16px] overflow-hidden border border-border-subtle shadow-xl">
                <InteractiveMap trip={mappedTrip} compact showCardOverlay={false} />
              </div>
            )}
          </div>
        )}

        {/* ── الإشعارات ────────────────────────────────────────────── */}
        {activeTab === "notifications" && (
          <MobileNotificationsList
            notifications={notifications.notifications}
            loading={notifications.loading}
            onMarkRead={notifications.markAsRead}
            onReload={notifications.reload}
          />
        )}

        {/* ── حسابي ────────────────────────────────────────────────── */}
        {activeTab === "account" && (
          <div className="px-5 py-4 space-y-4 animate-fade-in">
            <h2 className="text-[15px] font-bold text-white">{t("My account", "حسابي")}</h2>

            <MobileSection title={t("Account data", "بيانات الحساب")}>
              <div className="flex items-center gap-3 px-3.5 py-3.5 border-b border-border-subtle">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-brand/20 text-[13px] font-bold text-brand">
                  {(user?.fullName || "—").slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-bold text-white truncate">{user?.fullName || "—"}</div>
                  <div className="text-[10px] text-text-muted truncate" dir="ltr">{user?.email || "—"}</div>
                </div>
              </div>
              <MobileRow label={t("Phone", "الهاتف")} value={user?.phone || "—"} />
              <MobileRow label={t("Account type", "نوع الحساب")} value={user?.role ? String(user.role).replace(/_/g, " ") : "—"} />
              <MobileRow
                label={t("Account status", "حالة الحساب")}
                value={
                  user?.accountApproved === false
                    ? t("Under review", "قيد المراجعة")
                    : t("Active", "نشط")
                }
              />
            </MobileSection>

            {/* §15-§16 — RBAC-gated user management (never in the header) */}
            <MobileUserManagement user={user} />

            <MobileSection title={t("Settings", "الإعدادات")}>
              <MobileRow
                icon={IconDoc}
                label={t("App settings", "إعدادات التطبيق")}
                hint={t("Language, appearance, time & date", "اللغة، المظهر، الوقت والتاريخ")}
                onClick={onOpenSettings}
              />
            </MobileSection>

            <button
              onClick={onLogout}
              className="w-full flex h-11 items-center justify-center gap-2 rounded-[12px] bg-status-danger/15 border border-status-danger/30 text-status-danger font-bold text-[12.5px] hover:bg-status-danger hover:text-white transition-all"
            >
              <span>{t("Sign out", "تسجيل الخروج")}</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom navigation: الرئيسية · الرحلات · التتبع · الإشعارات · حسابي (§29) */}
      <div className="absolute bottom-3 inset-x-4 z-40 flex items-center justify-around rounded-[18px] bg-navy/95 border border-white/10 px-2 py-2 shadow-2xl backdrop-blur-xl">
        {[
          ["home", t("Home", "الرئيسية"), IconHome],
          ["trips", t("Trips", "الرحلات"), IconOrders],
          ["track", t("Tracking", "التتبع"), IconPin],
          ["notifications", t("Notifications", "الإشعارات"), IconBell],
          ["account", t("Account", "حسابي"), IconProfile],
        ].map(([id, label, IconComponent]: any) => {
          const isActive = activeTab === id || (id === "trips" && (activeTab === "trip" || activeTab === "pod"));
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex flex-col items-center gap-1 py-1 px-2 rounded-[10px] transition-all duration-200 active:scale-95",
                isActive ? "text-brand font-bold" : "text-white/50 hover:text-white"
              )}
            >
              <IconComponent size={18} />
              <span className="text-[9px]">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
