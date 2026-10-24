import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../settings";
import { apiClient, getAuthToken } from "../services/apiClient";
import { useFleetStore } from "../state/fleetStore";
import { IconMenu, IconTracking, IconTruck, IconSearch, IconCargo, IconDriver, IconArrowRight } from "./Icons";
import { statusGroup } from "./overview/shared";
import { CapacityTruck } from "./CapacityTruck";

interface Props {
  userName?: string;
  onOpenSidebar?: () => void;
  onOpenTripDetails?: (tripId: string) => void;
  onOpenTracking?: () => void;
  onOpenMaintenance?: () => void;
}
type GpsState = "checking" | "configured" | "unconfigured" | "unavailable";
type StatusFilter = "all" | "pending" | "transit" | "delivered" | "cancelled";

function greeting(t: (en: string, ar: string) => string) {
  const h = new Date().getHours();
  if (h < 12) return t("Good morning", "صباح الخير");
  if (h < 18) return t("Good afternoon", "مساء الخير");
  return t("Good evening", "مساء النور");
}
function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(Number.isFinite(n) ? n : 0);
}
function StatusPill({ status, t }: { status: string; t: (en: string, ar: string) => string }) {
  const group = statusGroup(status as any);
  const label = group === "transit" ? t("On the road", "على الطريق") : group === "delivered" ? t("Delivered", "تم التسليم") : group === "cancelled" ? t("Cancelled", "ملغاة") : t("Preparing", "قيد التجهيز");
  const tone = group === "transit" ? "ej-pill-live" : group === "delivered" ? "ej-pill-done" : group === "cancelled" ? "ej-pill-off" : "ej-pill-wait";
  return <span className={`ej-status-pill ${tone}`}><span />{label}</span>;
}

export function ExecutiveOverview({ userName, onOpenSidebar, onOpenTripDetails, onOpenTracking }: Props) {
  const { t } = useSettings();
  const { trips, trucks, drivers, selectedTripId, selectTrip, selectTruck } = useFleetStore();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [gpsState, setGpsState] = useState<GpsState>("checking");
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    let alive = true;
    if (!getAuthToken()) { setGpsState("unavailable"); return; }
    apiClient.gps.getStatus().then((result: any) => {
      if (alive) setGpsState(result?.configured && !result?.isDevelopment ? "configured" : "unconfigured");
    }).catch(() => { if (alive) setGpsState("unavailable"); });
    return () => { alive = false; };
  }, []);

  const filteredTrips = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return trips.filter((trip) => {
      if (filter !== "all" && statusGroup(trip.status) !== filter) return false;
      if (!needle) return true;
      const truck = trucks.find((v) => v.id === trip.truckId);
      const driver = drivers.find((v) => v.id === trip.driverId);
      return [trip.tripNumber, trip.shipper, trip.consignee, trip.originCity, trip.destinationCity, driver?.name, truck?.plate]
        .filter(Boolean).join(" ").toLocaleLowerCase().includes(needle);
    });
  }, [trips, trucks, drivers, filter, query]);

  const selected = filteredTrips.find((trip) => trip.id === selectedTripId) ?? filteredTrips[0];
  const selectedTruck = selected ? trucks.find((truck) => truck.id === selected.truckId) : undefined;
  const activeTrips = trips.filter((trip) => statusGroup(trip.status) === "transit");
  const deliveredTrips = trips.filter((trip) => statusGroup(trip.status) === "delivered");
  const pendingTrips = trips.filter((trip) => statusGroup(trip.status) === "pending");
  const activeVehicles = trucks.filter((truck) => truck.status === "active").length;
  const loadPercent = selected && selected.maxCapacityTons > 0
    ? Math.max(0, Math.min(100, (selected.cargoWeightTons / selected.maxCapacityTons) * 100)) : 0;

  const openTrip = (trip: typeof trips[number]) => {
    selectTrip(trip.id);
    selectTruck(trip.truckId);
    onOpenTripDetails?.(trip.id);
  };
  const statusOptions: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: t("All trips", "كل الرحلات"), count: trips.length },
    { id: "pending", label: t("Preparing", "قيد التجهيز"), count: pendingTrips.length },
    { id: "transit", label: t("On the road", "على الطريق"), count: activeTrips.length },
    { id: "delivered", label: t("Delivered", "تم التسليم"), count: deliveredTrips.length },
    { id: "cancelled", label: t("Cancelled", "ملغاة"), count: trips.filter((trip) => statusGroup(trip.status) === "cancelled").length },
  ];

  return (
    <main className="ej-v2-overview scroll-thin h-full overflow-y-auto">
      <div className="ej-v2-content">
        <header className="ej-v2-topbar">
          <div className="flex min-w-0 items-start gap-3">
            {onOpenSidebar && <button onClick={onOpenSidebar} className="ej-v2-icon-button lg:hidden" aria-label={t("Open menu", "فتح القائمة")}><IconMenu size={19} /></button>}
            <div className="min-w-0">
              <div className="ej-v2-eyebrow"><span className="ej-v2-live-dot" />{t("EJAZ OPERATIONS CENTER", "مركز عمليات إيجاز")}</div>
              <h1>{t("Your fleet. In focus.", "أسطولك… تحت السيطرة.")}</h1>
              <p>{greeting(t)}{userName ? `، ${userName}` : ""} · {clock.toLocaleDateString(t("en-US", "ar-YE"), { weekday: "long", day: "numeric", month: "long" })}</p>
            </div>
          </div>
          <div className="ej-v2-top-actions">
            <label className="ej-v2-search"><IconSearch size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search trips, customers, drivers…", "ابحث عن رحلة أو عميل أو سائق…")} /><kbd>/</kbd></label>
            <button className="ej-v2-map-button" onClick={onOpenTracking} disabled={!onOpenTracking}><IconTracking size={17} />{t("Tracking", "التتبع")}<span className={gpsState === "configured" ? "ej-v2-dot-good" : "ej-v2-dot-warn"} /></button>
          </div>
        </header>

        <section className="ej-v2-hero">
          <div className="ej-v2-hero-copy">
            <span className="ej-v2-kicker">{t("LIVE OPERATIONS SNAPSHOT", "ملخص التشغيل الحالي")}</span>
            <h2>{t("Every delivery, accounted for.", "كل شحنة… محسوبة بدقة.")}</h2>
            <p>{t("A clear view of trip activity, fleet readiness and cargo movement — in one workspace.", "نظرة واضحة على حركة الرحلات وجاهزية الأسطول وانتقال الشحنات في مساحة عمل واحدة.")}</p>
            <div className="ej-v2-hero-meta">
              <span><span className="ej-v2-live-dot" />{gpsState === "configured" ? t("GPS provider connected", "مزود GPS متصل") : gpsState === "checking" ? t("Checking GPS connection", "يجري التحقق من GPS") : t("GPS feed not connected", "بيانات GPS غير متصلة")}</span>
              <span className="ej-v2-meta-separator" />
              <span>{trips.length} {t("registered trips", "رحلة مسجلة")}</span>
            </div>
          </div>
          <div className="ej-v2-route-art" aria-hidden="true">
            <div className="ej-v2-route-orbit ej-v2-orbit-one" />
            <div className="ej-v2-route-orbit ej-v2-orbit-two" />
            <svg viewBox="0 0 500 220" role="presentation">
              <defs><linearGradient id="ejRouteGradient" x1="0" x2="1"><stop offset="0" stopColor="#ff8a3d" /><stop offset="1" stopColor="#ffd19c" /></linearGradient></defs>
              <path d="M20 155 C80 40, 150 200, 225 100 S355 30, 470 95" fill="none" stroke="url(#ejRouteGradient)" strokeWidth="3" strokeLinecap="round" strokeDasharray="7 10" className="ej-v2-route-dash" />
              <circle cx="20" cy="155" r="7" fill="#ff8a3d" /><circle cx="225" cy="100" r="6" fill="#ff8a3d" /><circle cx="470" cy="95" r="8" fill="#ffd19c" />
              <g transform="translate(172 64)" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"><path d="M4 18h94l20 19v26H4z" fill="#ff8a3d"/><path d="M98 18h20l20 19v26H98z" fill="#f6b26b"/><path d="M106 25h10l13 14h-23z" fill="#17304b"/><path d="M11 27h78v29H11z" fill="#17304b"/><path d="M21 34h58M21 42h58M21 50h58" stroke="#ffb077" strokeWidth="2"/><circle cx="30" cy="66" r="11" fill="#071426"/><circle cx="30" cy="66" r="4" fill="#9daec5"/><circle cx="110" cy="66" r="11" fill="#071426"/><circle cx="110" cy="66" r="4" fill="#9daec5"/></g>
            </svg>
            <div className="ej-v2-route-label ej-v2-route-label-a"><span />{t("Origin", "نقطة الانطلاق")}</div>
            <div className="ej-v2-route-label ej-v2-route-label-b"><span />{t("Destination", "الوجهة")}</div>
          </div>
          <div className="ej-v2-hero-index"><strong>01</strong><span>/</span><span>OPERATIONS</span></div>
        </section>

        <section className="ej-v2-metrics" aria-label={t("Fleet metrics", "مؤشرات الأسطول")}>
          <article className="ej-v2-metric ej-v2-metric-featured"><div className="ej-v2-metric-head"><span>{t("Trips on the road", "رحلات على الطريق")}</span><span className="ej-v2-metric-icon"><IconTracking size={18} /></span></div><strong>{formatNumber(activeTrips.length)}</strong><div className="ej-v2-metric-foot"><span className="ej-v2-mini-bar"><i style={{ width: `${trips.length ? Math.min(100, activeTrips.length / trips.length * 100) : 0}%` }} /></span><span>{t("of all trips", "من إجمالي الرحلات")}</span></div></article>
          <article className="ej-v2-metric"><div className="ej-v2-metric-head"><span>{t("Fleet ready", "مركبات جاهزة")}</span><span className="ej-v2-metric-icon"><IconTruck size={18} /></span></div><strong>{formatNumber(activeVehicles)}<small> / {formatNumber(trucks.length)}</small></strong><div className="ej-v2-metric-foot"><span className="ej-v2-status-mark good" />{t("Vehicles marked active", "مركبة بحالة نشطة")}</div></article>
          <article className="ej-v2-metric"><div className="ej-v2-metric-head"><span>{t("Awaiting dispatch", "بانتظار التشغيل")}</span><span className="ej-v2-metric-icon"><IconCargo size={18} /></span></div><strong>{formatNumber(pendingTrips.length)}</strong><div className="ej-v2-metric-foot"><span className="ej-v2-status-mark wait" />{t("Need operational follow-up", "تحتاج متابعة تشغيلية")}</div></article>
          <article className="ej-v2-metric"><div className="ej-v2-metric-head"><span>{t("Drivers registered", "السائقون المسجلون")}</span><span className="ej-v2-metric-icon"><IconDriver size={18} /></span></div><strong>{formatNumber(drivers.length)}</strong><div className="ej-v2-metric-foot"><span className="ej-v2-status-mark neutral" />{t("In the fleet directory", "في سجل الأسطول")}</div></article>
        </section>

        <div className="ej-v2-work-grid">
          <section className="ej-v2-panel ej-v2-trips-panel">
            <div className="ej-v2-panel-heading"><div><span className="ej-v2-kicker">{t("DISPATCH BOARD", "لوحة التوجيه")}</span><h2>{t("Trip activity", "حركة الرحلات")}</h2><p>{t("Select a trip to inspect its details.", "اختر رحلة لعرض تفاصيلها.")}</p></div><button className="ej-v2-text-action" onClick={() => onOpenTracking?.()}>{t("Open tracking", "فتح التتبع")} <IconArrowRight size={15} /></button></div>
            <div className="ej-v2-filter-row">{statusOptions.map((option) => <button key={option.id} className={filter === option.id ? "active" : ""} onClick={() => setFilter(option.id)}>{option.label}<span>{option.count}</span></button>)}</div>
            <div className="ej-v2-trip-list">
              {filteredTrips.slice(0, 6).map((trip) => {
                const truck = trucks.find((v) => v.id === trip.truckId);
                const driver = drivers.find((v) => v.id === trip.driverId);
                const isSelected = selected?.id === trip.id;
                return <button key={trip.id} className={`ej-v2-trip-row ${isSelected ? "selected" : ""}`} onClick={() => openTrip(trip)}>
                  <span className="ej-v2-trip-code"><IconCargo size={18} /><small>{trip.tripNumber}</small></span>
                  <span className="ej-v2-trip-route"><strong>{trip.originCity || t("Origin pending", "الانطلاق غير محدد")} <i>→</i> {trip.destinationCity || t("Destination pending", "الوجهة غير محددة")}</strong><small>{trip.shipper || t("Customer not specified", "العميل غير محدد")} · {driver?.name || t("Driver not assigned", "لم يعيّن سائق")}</small></span>
                  <span className="ej-v2-trip-vehicle">{truck?.plate || t("Unassigned", "غير مخصص")}</span>
                  <StatusPill status={trip.status} t={t} />
                </button>;
              })}
              {!filteredTrips.length && <div className="ej-v2-empty"><IconSearch size={22} /><strong>{t("No matching trips", "لا توجد رحلات مطابقة")}</strong><span>{t("Try another search or status filter.", "جرّب بحثًا أو حالة مختلفة.")}</span></div>}
            </div>
            {filteredTrips.length > 6 && <div className="ej-v2-list-footer">{t("Showing", "عرض")} 6 {t("of", "من")} {filteredTrips.length} {t("trips", "رحلة")} · {t("Use search to narrow results", "استخدم البحث لتحديد النتائج")}</div>}
          </section>

          <aside className="ej-v2-side-stack">
            <section className="ej-v2-panel ej-v2-truck-capacity-panel">
              <div className="ej-v2-panel-heading"><div><span className="ej-v2-kicker">{t("VISUAL LOAD MONITOR", "مراقبة الحمولة بصريًا")}</span><h2>{t("Truck capacity", "سعة الشاحنة")}</h2><p>{selected ? (selected.tripNumber || t("Selected trip", "الرحلة المحددة")) : t("Choose a trip", "اختر رحلة")}</p></div><span className="ej-v2-panel-icon"><IconTruck size={18} /></span></div>
              {selected ? <>
                <div className="ej-v2-truck-visual"><CapacityTruck pct={loadPercent} countUp truckType={selectedTruck?.body} vehicle={selectedTruck} className="ej-v2-capacity-truck-svg" label={t("Truck load", "حمولة الشاحنة")} /></div>
                <div className="ej-v2-truck-visual-legend"><span><i className="ej-v2-legend-filled" />{t("Loaded", "محمّل")}</span><span><i className="ej-v2-legend-empty" />{t("Available capacity", "السعة المتبقية")}</span></div>
                <div className="ej-v2-truck-visual-stats"><span><small>{t("Cargo weight", "وزن الحمولة")}</small><strong>{formatNumber(selected.cargoWeightTons)} {t("tons", "طن")}</strong></span><span><small>{t("Maximum capacity", "السعة القصوى")}</small><strong>{formatNumber(selected.maxCapacityTons)} {t("tons", "طن")}</strong></span><span><small>{t("Utilization", "نسبة الاستخدام")}</small><strong>{formatNumber(loadPercent)}%</strong></span></div>
              </> : <div className="ej-v2-empty"><IconTruck size={22} /><span>{t("Select a trip to view its truck capacity.", "اختر رحلة لعرض سعة شاحنتها.")}</span></div>}
            </section>
            <section className="ej-v2-panel ej-v2-load-panel">
              <div className="ej-v2-panel-heading"><div><span className="ej-v2-kicker">{t("SELECTED TRIP", "الرحلة المحددة")}</span><h2>{t("Cargo capacity", "سعة الحمولة")}</h2></div><span className="ej-v2-panel-icon"><IconCargo size={18} /></span></div>
              {selected ? <>
                <div className="ej-v2-load-route"><span>{selected.originCity || "—"}</span><i>→</i><span>{selected.destinationCity || "—"}</span></div>
                <div className="ej-v2-load-number"><strong>{formatNumber(loadPercent)}<small>%</small></strong><span>{t("capacity used", "من السعة المستخدمة")}</span></div>
                <div className="ej-v2-capacity-track"><span style={{ width: `${loadPercent}%` }} /></div>
                <div className="ej-v2-capacity-values"><span>{t("Cargo", "الحمولة")}<strong>{formatNumber(selected.cargoWeightTons)} {t("tons", "طن")}</strong></span><span>{t("Maximum", "السعة القصوى")}<strong>{formatNumber(selected.maxCapacityTons)} {t("tons", "طن")}</strong></span></div>
                <div className="ej-v2-load-note"><span className="ej-v2-status-mark neutral" />{t("Calculated from the selected trip record", "محسوبة من بيانات الرحلة المحددة")}</div>
              </> : <div className="ej-v2-empty"><IconCargo size={22} /><span>{t("Select a trip to view cargo capacity.", "اختر رحلة لعرض سعة الحمولة.")}</span></div>}
            </section>
            <section className="ej-v2-panel ej-v2-system-panel">
              <div className="ej-v2-panel-heading"><div><span className="ej-v2-kicker">{t("SYSTEM STATUS", "حالة النظام")}</span><h2>{t("Connection health", "حالة الاتصال")}</h2></div><span className={`ej-v2-connection-icon ${gpsState === "configured" ? "ok" : "warn"}`}><IconTracking size={17} /></span></div>
              <div className="ej-v2-connection-row"><span><i className={gpsState === "configured" ? "good" : "wait"} />{t("GPS provider", "مزود GPS")}</span><strong>{gpsState === "configured" ? t("Connected", "متصل") : gpsState === "checking" ? t("Checking", "جارٍ التحقق") : t("Not configured", "غير مهيأ")}</strong></div>
              <div className="ej-v2-connection-row"><span><i className="good" />{t("Trip records", "سجلات الرحلات")}</span><strong>{t("Available", "متاحة")}</strong></div>
              <p className="ej-v2-system-note">{gpsState === "configured" ? t("The GPS provider is configured. Actual positions appear only when device telemetry is received.", "مزود GPS مهيأ. لا تظهر المواقع الفعلية إلا عند استقبال بيانات الأجهزة.") : t("Live vehicle positions are not shown until a GPS provider is configured and sending data.", "لن تظهر مواقع المركبات مباشرة حتى تتم تهيئة مزود GPS وإرسال البيانات.")}</p>
            </section>
          </aside>
        </div>
        <footer className="ej-v2-footer"><span>© {clock.getFullYear()} EJAZ TRANSPORT</span><span>{t("Operational workspace", "مساحة العمل التشغيلية")} · {t("Records reflect the connected project data", "تعكس السجلات بيانات المشروع المتصلة")}</span></footer>
      </div>
    </main>
  );
}
