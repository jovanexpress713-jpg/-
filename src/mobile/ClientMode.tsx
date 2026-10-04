import { useState, useEffect } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { apiClient } from "../services/apiClient";
import type { Trip } from "../state/fleetStore";
import { InteractiveMap } from "../components/InteractiveMap";
import { normalizeVehicleType } from "../data/vehicleTypes";
import { TruckTypeAvatar, TruckTypeBadge } from "../components/TruckTypeIcon";
import { statusMeta } from "../data/tripStatusMeta";
import { MobileNotificationsList, useMobileNotifications, MobileSection, MobileRow } from "./MobileShared";
import { MobileUserManagement } from "./MobileUserManagement";
import {
  IconHome,
  IconOrders,
  IconPin,
  IconProfile,
  IconSearch,
  IconDoc,
  IconBell,
  IconPlus,
  IconPhone,
  IconCheck,
} from "../components/Icons";

/**
 * تطبيق العميل (§14) — independent client interface over the shared backend.
 *
 * Navigation: الرئيسية · رحلاتي · التتبع · الإشعارات · حسابي (§30).
 * Trip data comes from the live API (`/api/client/trips`) — nothing on the
 * screen is invented (§32). «إضافة سائق / إضافة عميل» live in «إدارة
 * المستخدمين» behind the real capabilities (§15, §16), never in the header.
 */
interface ClientModeProps {
  user: any;
  onLogout: () => void;
  onOpenSettings?: () => void;
  /** Bumped by the header bell — switches to the notifications tab. */
  notificationsSignal?: number;
}

type ClientTab = "home" | "trips" | "track" | "notifications" | "account" | "request" | "docs";

export function ClientMode({ user, onLogout, onOpenSettings, notificationsSignal = 0 }: ClientModeProps) {
  const { t, td } = useSettings();
  const [activeTab, setActiveTab] = useState<ClientTab>("home");
  const [clientTrips, setClientTrips] = useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [gpsProviderConfigured, setGpsProviderConfigured] = useState<boolean | null>(null);
  const notifications = useMobileNotifications();

  // Trip request form (§14 «طلب رحلة»)
  const [reqForm, setReqForm] = useState({
    originCity: "",
    destinationCity: "",
    pickupAddress: "",
    deliveryAddress: "",
    cargoDescription: "",
    cargoType: "سطحة",
    cargoWeightTons: "",
  });
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqMsg, setReqMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Phase 1 — dynamic tariff quote: the price is resolved live from the
  // company's tariff book as the client fills the form. Never a typed number.
  const [quote, setQuote] = useState<any | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteAskSent, setQuoteAskSent] = useState(false);

  useEffect(() => {
    if (notificationsSignal > 0) setActiveTab("notifications");
  }, [notificationsSignal]);

  // Fetch client trips from backend API (real data first)
  useEffect(() => {
    let isMounted = true;
    async function loadClientData() {
      try {
        const res = await apiClient.trips.getClientTrips();
        if (isMounted && res?.trips) {
          setClientTrips(res.trips);
          if (!selectedTrip && res.trips.length > 0) {
            setSelectedTrip(res.trips[0]);
          }
        }
      } catch {
        if (isMounted) setClientTrips([]);
      }
    }
    loadClientData();
    return () => {
      isMounted = false;
    };
  }, []);

  // GPS provider status — §24: a real provider or an honest "not configured".
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

  // Live tariff quote — re-resolves automatically whenever the client changes
  // the truck type, the route or the weight (§6 dynamic price, no typed price).
  useEffect(() => {
    const ready =
      reqForm.originCity.trim() &&
      reqForm.destinationCity.trim() &&
      reqForm.cargoType &&
      Number(reqForm.cargoWeightTons) > 0;
    if (!ready) {
      setQuote(null);
      setQuoteAskSent(false);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    const timer = setTimeout(() => {
      apiClient.tariffs
        .getQuote({
          truckType: reqForm.cargoType,
          origin: reqForm.originCity,
          destination: reqForm.destinationCity,
          weightTons: String(Number(reqForm.cargoWeightTons)),
        })
        .then((q) => {
          if (!cancelled) {
            setQuote(q);
            setQuoteAskSent(false);
          }
        })
        .catch(() => !cancelled && setQuote(null))
        .finally(() => !cancelled && setQuoteLoading(false));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reqForm.originCity, reqForm.destinationCity, reqForm.cargoType, reqForm.cargoWeightTons]);

  const submitQuoteAsk = async () => {
    try {
      await apiClient.tariffs.submitQuoteRequest({
        truckType: reqForm.cargoType,
        originCity: reqForm.originCity,
        destinationCity: reqForm.destinationCity,
        weightTons: Number(reqForm.cargoWeightTons),
      });
      setQuoteAskSent(true);
    } catch {
      setQuoteAskSent(false);
    }
  };

  const activeTrip = selectedTrip || clientTrips[0] || null;

  /** Route record for the map — built only from real trip fields. */
  const mappedActiveTrip: Trip | null = activeTrip
    ? {
        id: activeTrip.id,
        tripNumber: activeTrip.tripNumber,
        truckId: activeTrip.vehicleId || activeTrip.truckId || "",
        driverId: activeTrip.driverId || "",
        shipper: activeTrip.customerName || user?.fullName || "",
        consignee: activeTrip.deliveryAddress || "",
        originCity: activeTrip.originCity || "",
        originTerminal: activeTrip.pickupAddress || "",
        destinationCity: activeTrip.destinationCity || "",
        destinationTerminal: activeTrip.deliveryAddress || "",
        corridorKey: activeTrip.corridorKey || "riyadh-jeddah",
        cargoType: normalizeVehicleType(activeTrip.cargoType),
        cargoWeightTons: Number(activeTrip.cargoWeightTons || 0),
        maxCapacityTons: Number(activeTrip.maxCapacityTons || 0),
        status: (activeTrip.status === "IN_TRANSIT" ? "on_road" : activeTrip.status === "DELIVERED" ? "delivered" : "ready") as Trip["status"],
        progressPct: Number(activeTrip.progressPct || 0),
        speedKmH: Number(activeTrip.currentSpeed || 0),
        headingDeg: Number(activeTrip.currentHeading || 0),
        currentLat: Number(activeTrip.currentLat || 0),
        currentLng: Number(activeTrip.currentLng || 0),
        distanceTotalKm: Number(activeTrip.distanceTotalKm || 0),
        distanceCoveredKm: Number(activeTrip.distanceCoveredKm || 0),
        distanceRemainingKm: Number(activeTrip.distanceRemainingKm || 0),
        etaMinutes: Number(activeTrip.etaMinutes || 0),
        nextWaypointAr: activeTrip.nextWaypointAr || "",
        nextWaypointEn: activeTrip.nextWaypointEn || "",
        createdAt: activeTrip.createdAt || "",
        qrCodeToken: `EJAZ-${activeTrip.tripNumber || activeTrip.id}`,
        timeline: [],
      }
    : null;

  const filteredTrips = clientTrips.filter(
    (tr) =>
      !searchQuery ||
      tr.tripNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tr.originCity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tr.destinationCity?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /** Canonical lifecycle status → localized human label. */
  const statusLabel = (s: string | undefined) => {
    const m = statusMeta(s);
    return t(m.en, m.ar);
  };

  const submitTripRequest = async () => {
    setReqMsg(null);
    if (
      !reqForm.originCity ||
      !reqForm.destinationCity ||
      !reqForm.cargoDescription ||
      !reqForm.cargoType ||
      !reqForm.cargoWeightTons
    ) {
      setReqMsg({ ok: false, text: t("Please complete the required shipment fields.", "يرجى استكمال حقول الشحنة المطلوبة.") });
      return;
    }
    setReqSubmitting(true);
    try {
      const res = await apiClient.trips.create({
        ...reqForm,
        cargoWeightTons: Number(reqForm.cargoWeightTons),
        customerId: user?.customerId,
        tariffId: quote?.tariff?.id,
        distanceKm: quote?.distanceKm,
      });
      setReqMsg({
        ok: true,
        text:
          t("Trip request created — number", "تم إنشاء طلب الرحلة — الرقم") +
          `: ${res?.trip?.tripNumber || ""} · ` +
          t("status: awaiting operations review", "الحالة: بانتظار مراجعة العمليات"),
      });
      setReqForm({ originCity: "", destinationCity: "", pickupAddress: "", deliveryAddress: "", cargoDescription: "", cargoType: "سطحة", cargoWeightTons: "" });
      const list = await apiClient.trips.getClientTrips();
      if (list?.trips) setClientTrips(list.trips);
    } catch (err: any) {
      setReqMsg({ ok: false, text: String(err?.message || t("Unable to submit the request.", "تعذّر إرسال الطلب.")) });
    } finally {
      setReqSubmitting(false);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-0 text-white flex flex-col justify-between select-none">
      <div className="scroll-thin flex-1 overflow-y-auto pb-24">
        {/* Greeting — the live identity (§32) */}
        <div className="px-5 pt-5 pb-4 bg-gradient-to-b from-navy to-surface-0 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-2/20 text-[13px] font-bold text-accent-2 border border-accent-2/30">
              {(user?.fullName || "—").slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">
                {t("Client app", "تطبيق العميل")}
              </div>
              <div className="text-[13.5px] font-bold text-white truncate max-w-[190px]">
                {user?.fullName || user?.email || "—"}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-status-active/15 border border-status-active/30 px-2.5 py-0.5 text-[10px] font-bold text-status-active">
                {clientTrips.length} {t("Active Trips", "شحنة")}
              </span>
            </div>
          </div>

          {/* Quick search */}
          <div className="mt-4 flex items-center gap-2 rounded-[12px] bg-surface-2 px-3 py-2 border border-border-subtle focus-within:border-brand transition-colors">
            <IconSearch size={15} className="text-text-muted shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("Search by trip number or city…", "ابحث برقم الرحلة أو المدينة…")}
              className="w-full bg-transparent text-[11.5px] text-white outline-none"
            />
          </div>
        </div>

        {/* ── الرئيسية ─────────────────────────────────────────────── */}
        {activeTab === "home" && (
          <div className="px-5 py-4 space-y-4 animate-fade-in">
            {/* طلب رحلة — the primary client action (§14) */}
            <button
              onClick={() => setActiveTab("request")}
              className="w-full flex h-11 items-center justify-center gap-2 rounded-[12px] bg-brand text-on-brand text-[12px] font-bold shadow-md hover:brightness-110 active:scale-95 transition-all"
            >
              <IconPlus size={15} />
              <span>{t("Request a trip", "طلب رحلة")}</span>
            </button>

            {activeTrip ? (
              <div className="rounded-[18px] bg-gradient-to-br from-navy via-surface-1 to-surface-2 p-4 border border-border-subtle shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="rounded-full bg-brand/20 border border-brand/40 px-2.5 py-0.5 text-[10.5px] font-bold text-brand">
                    {activeTrip.tripNumber}
                  </span>
                  <span className="text-[11px] font-semibold text-status-active">
                    {statusLabel(activeTrip.status)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
                  <div>
                    <div className="text-[10px] text-text-muted">{t("From (Loading)", "نقطة التحميل")}</div>
                    <div className="font-semibold text-white truncate mt-0.5">{td(activeTrip.originCity)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted">{t("To (Delivery)", "نقطة التفريغ")}</div>
                    <div className="font-semibold text-white truncate mt-0.5">{td(activeTrip.destinationCity)}</div>
                  </div>
                </div>

                {activeTrip.cargoDescription && (
                  <div className="mt-3 rounded-[10px] bg-surface-0/60 p-2.5 text-[11px] border border-white/5 flex items-center justify-between">
                    <div className="truncate max-w-[65%]">
                      <span className="text-text-muted">{t("Cargo:", "الشحنة:")}</span>
                      <span className="text-white font-medium">{activeTrip.cargoDescription}</span>
                    </div>
                    <div className="text-brand font-bold tabular-nums">
                      {activeTrip.cargoWeightTons ? `${activeTrip.cargoWeightTons} t` : ""}
                    </div>
                  </div>
                )}

                {(activeTrip.driverName || activeTrip.vehiclePlate) && (
                  <div className="mt-3 flex items-center justify-between text-[11px] text-text-secondary">
                    <div className="flex items-center gap-1.5 truncate">
                      <TruckTypeIconSafe truckType={activeTrip.cargoType} />
                      <span className="truncate">{activeTrip.driverName || t("Driver not assigned", "لم يتم إسناد سائق")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TruckTypeBadge truckType={activeTrip.cargoType} size={11} />
                      {activeTrip.vehiclePlate && <span className="font-mono text-white/80">{activeTrip.vehiclePlate}</span>}
                    </div>
                  </div>
                )}

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

            <div className="flex items-center justify-between pt-2">
              <h2 className="text-[14px] font-bold text-white">{t("My Shipments", "شحناتي الأخيرة")}</h2>
              <button onClick={() => setActiveTab("trips")} className="text-[11px] font-semibold text-brand hover:underline">
                {t("View All", "عرض الكل")} ({clientTrips.length})
              </button>
            </div>

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
                      {statusLabel(tr.status)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11.5px] text-white">
                    {td(tr.originCity)} → {td(tr.destinationCity)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── طلب رحلة ─────────────────────────────────────────────── */}
        {activeTab === "request" && (
          <div className="px-5 py-4 space-y-3 animate-fade-in">
            <h2 className="text-[15px] font-bold text-white">{t("Request a trip", "طلب رحلة")}</h2>

            {reqMsg && (
              <div
                className={cn(
                  "rounded-[12px] border p-2.5 text-[10.5px] font-semibold",
                  reqMsg.ok
                    ? "border-status-active/40 bg-status-active/10 text-status-active"
                    : "border-status-danger/40 bg-status-danger/10 text-status-danger",
                )}
              >
                <div className="flex items-start gap-2">
                  {reqMsg.ok && <IconCheck size={14} className="mt-0.5 shrink-0" />}
                  <span>{reqMsg.text}</span>
                </div>
              </div>
            )}

            {[
              { key: "originCity", label: t("Origin city", "مدينة الانطلاق"), required: true },
              { key: "destinationCity", label: t("Destination city", "مدينة الوصول"), required: true },
              { key: "pickupAddress", label: t("Pickup address", "عنوان التحميل"), required: false },
              { key: "deliveryAddress", label: t("Delivery address", "عنوان التفريغ"), required: false },
              { key: "cargoDescription", label: t("Cargo description", "وصف الحمولة"), required: true },
              { key: "cargoWeightTons", label: t("Weight (tons)", "الوزن (طن)"), required: true },
            ].map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-[10px] font-semibold text-text-muted">
                  {f.label}
                  {f.required && <span className="text-status-danger"> *</span>}
                </label>
                <input
                  type={f.key === "cargoWeightTons" ? "number" : "text"}
                  value={(reqForm as any)[f.key]}
                  onChange={(e) => setReqForm((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="w-full rounded-[10px] border border-border-subtle bg-surface-2 px-3 py-2 text-[11px] text-white focus:border-brand focus:outline-none"
                />
              </div>
            ))}

            <div>
              <label className="mb-1 block text-[10px] font-semibold text-text-muted">
                {t("Truck body type", "نوع الشاحنة")}
                <span className="text-status-danger"> *</span>
              </label>
              <select
                value={reqForm.cargoType}
                onChange={(e) => setReqForm((v) => ({ ...v, cargoType: e.target.value }))}
                className="w-full rounded-[10px] border border-border-subtle bg-surface-2 px-3 py-2 text-[11px] text-white focus:border-brand focus:outline-none"
              >
                {["سطحة", "براد", "جاف", "ستارة"].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Live tariff quote — the price comes from the company's tariff
                book, never typed by the client (§5–§7). */}
            {quoteLoading && (
              <div className="rounded-[12px] border border-border-subtle bg-surface-2 p-3 text-[11px] text-text-muted">
                {t("Resolving the matching tariff…", "جارٍ مطابقة التعرفة المناسبة…")}
              </div>
            )}

            {!quoteLoading && quote?.available && (
              <div className="rounded-[12px] border border-status-active/40 bg-status-active/10 p-3 space-y-1 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-semibold text-text-muted uppercase">
                    {t("Matched tariff price", "السعر المطابق من التعرفة")}
                  </span>
                  <IconCheck size={14} className="text-status-active" />
                </div>
                <div className="text-[18px] font-extrabold text-status-active tabular-nums">
                  {Number(quote.price).toLocaleString()} {quote.currency || "SAR"}
                </div>
                <div className="text-[10.5px] text-text-secondary tabular-nums">
                  {t("Route distance", "مسافة المسار")}: {quote.distanceKm} {t("km", "كم")} ·{" "}
                  {quote.matchedWeightTons} {t("tons", "طن")} · {reqForm.cargoType}
                </div>
              </div>
            )}

            {!quoteLoading && quote && !quote.available && quote.distanceResolvable && (
              <div className="rounded-[12px] border border-status-waiting/40 bg-status-waiting/10 p-3 space-y-2 animate-fade-in">
                <div className="text-[11.5px] font-bold text-status-waiting">
                  {t("No tariff is available for this trip right now.", "لا توجد تعرفة متاحة لهذه الرحلة حاليًا.")}
                </div>
                <div className="text-[10.5px] text-text-secondary tabular-nums">
                  {t("Route distance", "مسافة المسار")}: {quote.distanceKm} {t("km", "كم")}
                </div>
                {quoteAskSent ? (
                  <div className="text-[11px] font-semibold text-status-active">
                    ✓ {t("Quote request sent to the control room.", "تم إرسال طلب عرض السعر إلى غرفة التحكم.")}
                  </div>
                ) : (
                  <button
                    onClick={submitQuoteAsk}
                    className="w-full h-9 rounded-[10px] bg-status-waiting/20 border border-status-waiting/50 text-status-waiting text-[11px] font-bold hover:bg-status-waiting hover:text-navy transition-all"
                  >
                    {t("Request a price quote", "طلب عرض سعر")}
                  </button>
                )}
              </div>
            )}

            {!quoteLoading && quote && !quote.available && !quote.distanceResolvable && (
              <div className="rounded-[12px] border border-status-waiting/40 bg-status-waiting/10 p-3 space-y-2 animate-fade-in">
                <div className="text-[11.5px] font-bold text-status-waiting">
                  {t("No tariff is available for this trip right now.", "لا توجد تعرفة متاحة لهذه الرحلة حاليًا.")}
                </div>
                <div className="text-[10.5px] text-text-secondary">
                  {quote.distanceReasonAr || t("The route distance could not be resolved.", "تعذّر تحديد مسافة المسار.")}
                </div>
                {quoteAskSent ? (
                  <div className="text-[11px] font-semibold text-status-active">
                    ✓ {t("Quote request sent to the control room.", "تم إرسال طلب عرض السعر إلى غرفة التحكم.")}
                  </div>
                ) : (
                  <button
                    onClick={submitQuoteAsk}
                    className="w-full h-9 rounded-[10px] bg-status-waiting/20 border border-status-waiting/50 text-status-waiting text-[11px] font-bold hover:bg-status-waiting hover:text-navy transition-all"
                  >
                    {t("Request a price quote", "طلب عرض سعر")}
                  </button>
                )}
              </div>
            )}

            <button
              onClick={submitTripRequest}
              disabled={reqSubmitting}
              className="w-full h-11 rounded-[12px] bg-brand text-on-brand text-[12px] font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {reqSubmitting ? t("Submitting…", "جاري الإرسال…") : t("Submit trip request", "إرسال طلب الرحلة")}
            </button>
          </div>
        )}

        {/* ── رحلاتي ───────────────────────────────────────────────── */}
        {activeTab === "trips" && (
          <div className="px-5 py-4 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <h2 className="text-[15px] font-bold text-white">{t("My trips", "رحلاتي")}</h2>
              <span className="text-[11px] text-text-muted">{filteredTrips.length} {t("Trips", "رحلة")}</span>
            </div>

            {filteredTrips.length === 0 && (
              <div className="rounded-[14px] border border-border-subtle bg-surface-1 p-6 text-center text-[11px] text-text-muted">
                {t("No trips yet.", "لا توجد رحلات حتى الآن.")}
              </div>
            )}

            {filteredTrips.map((tr) => (
              <div key={tr.id} className="rounded-[14px] bg-surface-1 p-3.5 border border-border-subtle hover:border-brand/40 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TruckTypeAvatar truckType={tr.cargoType} size={30} iconSize={16} showBadge />
                    <span className="font-bold text-[12px] text-brand tracking-wide">{tr.tripNumber}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TruckTypeBadge truckType={tr.cargoType} size={11} />
                    <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-[10px] font-bold text-brand">
                      {statusLabel(tr.status)}
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-[12px] font-semibold text-white">
                  {td(tr.originCity)} ➔ {td(tr.destinationCity)}
                </div>
                {tr.cargoDescription && (
                  <div className="text-[11px] text-text-muted mt-0.5 truncate">{tr.cargoDescription}</div>
                )}

                {/* Real trip metrics from the database — incl. the tariff price (§5). */}
                <div className="mt-2 grid grid-cols-3 gap-2 rounded-[10px] bg-surface-2/70 border border-white/5 p-2 text-center text-[10px] tabular-nums">
                  <div>
                    <div className="text-text-muted">{t("Distance", "المسافة")}</div>
                    <div className="font-bold text-white">{tr.distanceKm ? `${tr.distanceKm} ${t("km", "كم")}` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">{t("Weight", "الوزن")}</div>
                    <div className="font-bold text-white">{tr.cargoWeightTons ? `${tr.cargoWeightTons} ${t("t", "طن")}` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">{t("Price", "السعر")}</div>
                    <div className={cn("font-bold", tr.tripPrice > 0 ? "text-status-active" : "text-status-waiting")}>
                      {tr.tripPrice > 0
                        ? `${Number(tr.tripPrice).toLocaleString()} ${tr.currency || "SAR"}`
                        : tr.priceStatus === "PENDING_QUOTE"
                          ? t("Awaiting quote", "بانتظار عرض سعر")
                          : "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                  <span className="text-text-secondary">
                    {t("Driver:", "السائق:")}{" "}
                    <strong className="text-white">{tr.driverName || t("—", "—")}</strong>
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedTrip(tr);
                        setActiveTab("docs");
                      }}
                      className="rounded-[8px] bg-surface-2 px-2.5 py-1 text-white font-bold text-[10px] hover:bg-surface-3 transition-all"
                    >
                      {t("Documents", "المستندات")}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTrip(tr);
                        setActiveTab("track");
                      }}
                      className="rounded-[8px] bg-surface-2 px-2.5 py-1 text-accent-2 hover:bg-brand hover:text-navy font-bold text-[10px] transition-all"
                    >
                      {t("Open Tracking", "عرض التتبع")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── التتبع ───────────────────────────────────────────────── */}
        {activeTab === "track" && (
          <div className="h-full flex flex-col p-4 animate-fade-in space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-text-muted uppercase tracking-wider">{t("Shipment Tracking", "تتبع الشحنة")}</span>
                <div className="text-[14px] font-bold text-brand">{activeTrip?.tripNumber || "—"}</div>
              </div>
              {activeTrip && (
                <div className="text-end">
                  <span className="rounded-full bg-status-active/15 border border-status-active/30 px-2.5 py-0.5 text-[10.5px] font-bold text-status-active">
                    {statusLabel(activeTrip.status)}
                  </span>
                </div>
              )}
            </div>

            {gpsProviderConfigured === false && (
              <div className="rounded-[12px] border border-brand/40 bg-brand/10 p-2.5 text-[10.5px] font-semibold text-brand">
                {t("GPS service is not configured on the platform. Live vehicle telemetry will appear here once the GPS provider is set up.", "خدمة GPS غير مهيأة. سيظهر موقع الشاحنة المباشر هنا فور إعداد مزود خدمة التتبع.")}
              </div>
            )}

            {mappedActiveTrip ? (
              <>
                <div className="h-[320px] w-full rounded-[16px] overflow-hidden border border-border-subtle shadow-xl">
                  <InteractiveMap trip={mappedActiveTrip} compact showCardOverlay={false} />
                </div>

                <div className="rounded-[12px] bg-surface-1 p-3 border border-border-subtle text-[11.5px] space-y-1.5">
                  {(activeTrip?.vehiclePlate || activeTrip?.cargoType) && (
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">{t("Vehicle & Plate:", "الشاحنة واللوحة:")}</span>
                      <span className="font-semibold text-white">
                        {activeTrip?.vehiclePlate || "—"}
                        {activeTrip?.cargoType ? ` (${td(activeTrip.cargoType)})` : ""}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">{t("Telemetry Status:", "حالة إشارة التتبع:")}</span>
                    <span className={cn("font-semibold", gpsProviderConfigured ? "text-status-active" : "text-text-muted")}>
                      {gpsProviderConfigured
                        ? t("GPS Telemetry Online", "إشارة GPS متصلة ونشطة")
                        : t("GPS service is not configured", "خدمة GPS غير مهيأة")}
                    </span>
                  </div>
                  {activeTrip?.driverName && (
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">{t("Driver:", "السائق:")}</span>
                      <span className="font-semibold text-white">{activeTrip.driverName}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-[14px] border border-border-subtle bg-surface-1 p-6 text-center text-[11px] text-text-muted">
                {t("Select a trip to track.", "اختر رحلة للتتبع.")}
              </div>
            )}
          </div>
        )}

        {/* ── المستندات وإثبات التسليم (من رحلاتي) ─────────────────── */}
        {activeTab === "docs" && (
          <div className="px-5 py-4 space-y-3.5 animate-fade-in">
            <h2 className="text-[15px] font-bold text-white">{t("Shipment Documents & POD", "مستندات الشحنة وإثبات التسليم")}</h2>
            <p className="text-[11.5px] text-text-muted">
              {t("Official documentation for trip", "المستندات الرسمية للرحلة")}{" "}
              <strong className="text-brand">{activeTrip?.tripNumber || "—"}</strong>
            </p>

            <MobileSection title={t("Documents", "المستندات")}>
              <MobileRow
                icon={IconDoc}
                label={t("Electronic Waybill (BOL)", "بوليصة الشحن الرسمية")}
                hint={activeTrip?.waybillUrl ? t("Available", "متاحة") : t("Not published yet", "لم تُنشر بعد")}
              />
            </MobileSection>

            <MobileSection title={t("Proof of Delivery (POD)", "إثبات التسليم الرقمي")}>
              {activeTrip?.pod || activeTrip?.status === "DELIVERED" ? (
                <MobileRow
                  icon={IconCheck}
                  label={t("Delivery confirmed", "تم تأكيد التسليم")}
                  hint={activeTrip?.pod?.recipientName ? `${t("Recipient", "المستلم")}: ${activeTrip.pod.recipientName}` : undefined}
                  value={activeTrip?.pod?.id || t("Recorded", "مُوثّق")}
                />
              ) : (
                <MobileRow
                  icon={IconDoc}
                  label={t("Awaiting delivery confirmation", "بانتظار تأكيد التسليم")}
                  hint={t("The driver records the POD at handover", "يوثّق السائق إثبات التسليم عند التسليم")}
                />
              )}
            </MobileSection>
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
                <span className="grid h-11 w-11 place-items-center rounded-full bg-accent-2/20 text-[13px] font-bold text-accent-2">
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

            <MobileSection title={t("Settings & support", "الإعدادات والدعم")}>
              <MobileRow
                icon={IconDoc}
                label={t("App settings", "إعدادات التطبيق")}
                hint={t("Language, appearance, time & date", "اللغة، المظهر، الوقت والتاريخ")}
                onClick={onOpenSettings}
              />
              <MobileRow
                icon={IconPhone}
                label={t("Contact support", "التواصل والدعم")}
                hint={t("Operations desk", "غرفة العمليات")}
                value="+966 12 000 0000"
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

      {/* Bottom navigation: الرئيسية · رحلاتي · التتبع · الإشعارات · حسابي (§30) */}
      <div className="absolute bottom-3 inset-x-4 z-40 flex items-center justify-around rounded-[18px] bg-navy/95 border border-white/10 px-2 py-2 shadow-2xl backdrop-blur-xl">
        {[
          ["home", t("Home", "الرئيسية"), IconHome],
          ["trips", t("My Trips", "رحلاتي"), IconOrders],
          ["track", t("Tracking", "التتبع"), IconPin],
          ["notifications", t("Notifications", "الإشعارات"), IconBell],
          ["account", t("Account", "حسابي"), IconProfile],
        ].map(([id, label, IconComponent]: any) => {
          const isActive = activeTab === id || (id === "trips" && (activeTab === "docs" || activeTab === "request"));
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

/** Small local wrapper so the truck glyph always follows the data. */
function TruckTypeIconSafe({ truckType }: { truckType: string }) {
  return <TruckTypeBadge truckType={truckType} size={11} />;
}
