import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../settings";
import { apiClient, getAuthToken } from "../services/apiClient";
import { useFleetStore, type Trip } from "../state/fleetStore";
import { useToast } from "./Toast";
import { TruckImage } from "./TruckImage";
import { CapacityTruck } from "./CapacityTruck";
import { TruckTypeBadge } from "./TruckTypeIcon";
import { IconMenu, IconTracking, IconTruck, IconCheck, IconSearch, IconGauge, IconFuel, IconThermo } from "./Icons";
import { KpiCards } from "./overview/KpiCards";
import { CargoDonut } from "./overview/CargoDonut";
import { TripBars } from "./overview/TripBars";
import { ActivitiesTable } from "./overview/ActivitiesTable";
import { statusGroup, STATUS_LABEL } from "./overview/shared";
import { APPROVED_VEHICLE_TYPES_LIST, normalizeVehicleType } from "../data/vehicleTypes";

interface Props {
  userName?: string;
  onOpenSidebar?: () => void;
  onOpenTripDetails?: (tripId: string) => void;
  onOpenTracking?: () => void;
  onOpenMaintenance?: () => void;
}

type GpsState = "checking" | "configured" | "unconfigured" | "unavailable";
type CargoFilter = "all" | "flatbed" | "reefer" | "dry" | "curtain";

function greeting(t: (en: string, ar: string) => string) {
  const h = new Date().getHours();
  if (h < 12) return t("Good morning", "صباح الخير");
  if (h < 18) return t("Good afternoon", "مساء الخير");
  return t("Good evening", "مساء النور");
}

function tripStatusLabel(trip: Trip, t: (en: string, ar: string) => string) {
  const entry = STATUS_LABEL[trip.status];
  return t(entry[0], entry[1]);
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone,
  onClick,
  active = false,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
  tone: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={`ej-overview-metric card flex min-w-0 items-center gap-3 p-4 text-start transition hover:border-brand/40 ${active ? "border-brand/60 ring-1 ring-brand/20" : ""}`}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] text-text-muted">{label}</span>
        <span className="mt-0.5 block text-[23px] font-bold leading-none tabular-nums text-text-primary">{value.toLocaleString()}</span>
        <span className="mt-1 block truncate text-[10px] text-text-muted">{hint}</span>
      </span>
    </Tag>
  );
}

function SpeedDial({ value, t }: { value: number | null; t: (en: string, ar: string) => string }) {
  const maximum = 160;
  const normalized = value === null ? 0 : Math.max(0, Math.min(100, (value / maximum) * 100));
  return <div className="min-w-0 rounded-lg bg-surface-2/80 px-2 py-1.5 text-center">
    <svg viewBox="0 0 160 94" className="mx-auto h-12 w-full max-w-[104px]" role="img" aria-label={value === null ? t("Speed unavailable without GPS", "السرعة غير متاحة دون GPS") : `${Math.round(value)} km/h`}>
      <path d="M14 82 A66 66 0 0 1 146 82" fill="none" stroke="var(--color-surface-5)" strokeWidth="9" strokeLinecap="round" />
      <path d="M14 82 A66 66 0 0 1 146 82" fill="none" stroke="var(--color-brand)" strokeWidth="9" strokeLinecap="round" pathLength="100" strokeDasharray={`${normalized} 100`} />
      {value !== null && <line x1="80" y1="82" x2="80" y2="30" stroke="var(--color-text-primary)" strokeWidth="2" strokeLinecap="round" transform={`rotate(${-90 + normalized * 1.8} 80 82)`} />}
      <circle cx="80" cy="82" r="4" fill="var(--color-brand)" />
    </svg>
    <div className="-mt-1 text-[12px] font-bold tabular-nums text-text-primary">{value === null ? "—" : Math.round(value)} <span className="text-[8px] font-medium text-text-muted">km/h</span></div>
    <div className="mt-0.5 flex items-center justify-center gap-1 text-[8px] text-text-muted"><IconGauge size={10} />{t("Speed", "السرعة")}</div>
  </div>;
}

export function ExecutiveOverview({ userName, onOpenSidebar, onOpenTripDetails, onOpenTracking, onOpenMaintenance }: Props) {
  const { t } = useSettings();
  const toast = useToast();
  const { trips, trucks, drivers, selectedTripId, selectTrip, selectTruck } = useFleetStore();
  const [group, setGroup] = useState<"all" | "pending" | "transit" | "delivered" | "cancelled">("all");
  const [cargo, setCargo] = useState<CargoFilter>("all");
  const [customer, setCustomer] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [gpsState, setGpsState] = useState<GpsState>("checking");

  useEffect(() => {
    let alive = true;
    if (!getAuthToken()) {
      setGpsState("unavailable");
      return;
    }
    apiClient.gps.getStatus().then((result: any) => {
      if (alive) setGpsState(result?.configured && !result?.isDevelopment ? "configured" : "unconfigured");
    }).catch(() => {
      if (alive) setGpsState("unavailable");
    });
    return () => { alive = false; };
  }, []);

  const filteredTrips = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return trips.filter((trip) => {
      if (group !== "all" && statusGroup(trip.status) !== group) return false;
      if (cargo !== "all" && trip.cargoType !== cargo) return false;
      if (customer !== "all" && trip.shipper !== customer) return false;
      if (driverFilter !== "all" && trip.driverId !== driverFilter) return false;
      if (!needle) return true;
      const truck = trucks.find((item) => item.id === trip.truckId);
      const driver = drivers.find((item) => item.id === trip.driverId);
      return [trip.tripNumber, trip.shipper, trip.consignee, trip.originCity, trip.destinationCity, driver?.name, truck?.plate]
        .filter(Boolean).join(" ").toLocaleLowerCase().includes(needle);
    });
  }, [trips, trucks, drivers, group, cargo, customer, driverFilter, query]);

  const selected = filteredTrips.find((trip) => trip.id === selectedTripId) ?? filteredTrips[0];
  const truck = selected ? trucks.find((item) => item.id === selected.truckId) : undefined;
  const driver = selected ? drivers.find((item) => item.id === selected.driverId) : undefined;
  const loadPercent = selected && selected.maxCapacityTons > 0
    ? Math.max(0, Math.min(100, (selected.cargoWeightTons / selected.maxCapacityTons) * 100))
    : 0;
  const speedValue = gpsState === "configured" && selected && Number.isFinite(selected.speedKmH)
    ? selected.speedKmH
    : null;
  const onToast = (text: string, sub?: string) => toast(text, sub);

  const handleSelect = (id: string) => {
    selectTrip(id);
    const trip = trips.find((item) => item.id === id);
    if (trip) selectTruck(trip.truckId);
  };

  const filterGroup = (next: typeof group) => setGroup((current) => current === next ? "all" : next);
  const cargoOptions: { id: CargoFilter; label: string }[] = [
    { id: "all", label: t("All cargo", "كل الأنواع") },
    { id: "reefer", label: t("Refrigerated", "براد") },
    { id: "flatbed", label: t("Flatbed", "سطحة") },
    { id: "dry", label: t("Dry van", "جاف") },
    { id: "curtain", label: t("Curtainsider", "ستارة") },
  ];

  if (!trips.length) {
    return (
      <div className="scroll-thin h-full overflow-y-auto bg-surface-0 p-5 lg:p-8">
        <div className="mx-auto grid min-h-[55vh] max-w-5xl place-items-center rounded-2xl border border-dashed border-border-subtle p-8 text-center">
          <div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface-3 text-brand"><IconTruck size={22} /></span>
            <h1 className="mt-4 text-xl font-semibold text-text-primary">{t("No trips to display", "لا توجد رحلات لعرضها")}</h1>
            <p className="mt-2 text-sm text-text-muted">{t("Trips will appear here when available to your account.", "ستظهر الرحلات هنا عند توفرها لحسابك.")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ej-overview scroll-thin h-full overflow-y-auto bg-surface-0">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-5 p-4 sm:p-5 xl:p-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {onOpenSidebar && <button onClick={onOpenSidebar} className="btn-icon mt-1 lg:hidden" aria-label={t("Menu", "القائمة")}><IconMenu size={17} /></button>}
            <div className="min-w-0">
              <p className="text-[13px] text-text-secondary">{greeting(t)}{userName ? `، ${userName}` : ""}</p>
              <h1 className="mt-1 text-[25px] font-bold leading-tight text-text-primary sm:text-[30px]">{t("Logistics Dashboard", "لوحة الخدمات اللوجستية")}</h1>
              <p className="mt-1 text-[11px] text-text-muted">{t("Operations overview · EJAZ Transport Establishment", "نظرة تشغيلية · مؤسسة إيجاز للنقليات")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 min-w-[220px] items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-3 text-text-muted focus-within:border-brand/60">
              <IconSearch size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search trips, customers, drivers…", "ابحث برحلة أو عميل أو سائق…")} className="min-w-0 flex-1 bg-transparent text-[12px] text-text-primary outline-none placeholder:text-text-muted" />
            </label>
            <button onClick={onOpenTracking} className="btn-ghost h-10 gap-2 rounded-xl px-3 text-[11px]" disabled={!onOpenTracking}>
              <span className={`h-2 w-2 rounded-full ${gpsState === "configured" ? "bg-status-active" : "bg-status-waiting"}`} />
              {gpsState === "checking" ? t("Checking GPS…", "جارٍ التحقق من GPS…") : gpsState === "configured" ? t("GPS provider connected", "مزود GPS متصل") : gpsState === "unconfigured" ? t("Tracking not configured", "خدمة التتبع غير مهيأة") : t("GPS status unavailable", "حالة GPS غير متاحة")}
            </button>
          </div>
        </header>

        <section aria-label={t("Operations summary", "ملخص العمليات")} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard label={t("Trips in view", "الرحلات المعروضة")} value={filteredTrips.length} hint={t("Current filters", "وفق الفلاتر الحالية")} icon={<IconTracking size={18} />} tone="bg-brand/12 text-brand" onClick={() => filterGroup("all")} active={group === "all"} />
          <MetricCard label={t("In transit", "على الطريق")} value={filteredTrips.filter((trip) => statusGroup(trip.status) === "transit").length} hint={t("Trips currently underway", "الرحلات الجارية ضمن النتائج")} icon={<IconTracking size={18} />} tone="bg-status-info/12 text-status-info" onClick={() => filterGroup("transit")} active={group === "transit"} />
          <MetricCard label={t("Fleet vehicles", "مركبات الأسطول")} value={trucks.length} hint={t("Registered vehicles", "المركبات المسجلة")} icon={<IconTruck size={18} />} tone="bg-status-waiting/12 text-status-waiting" onClick={() => onToast(t("Fleet inventory", "مخزون الأسطول"), t("Open Fleet from the navigation menu.", "افتح الأسطول من قائمة التنقل."))} />
          <MetricCard label={t("Drivers", "السائقون")} value={drivers.length} hint={t("Available driver records", "سجلات السائقين المتاحة")} icon={<IconCheck size={18} />} tone="bg-status-active/12 text-status-active" onClick={() => onToast(t("Driver records", "سجلات السائقين"), t("Open Drivers from the navigation menu.", "افتح السائقين من قائمة التنقل."))} />
        </section>

        <section className="card overflow-hidden border border-border-subtle p-0">
          {selected ? (
            <div className="grid min-h-[300px] lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
              <div className="relative flex min-h-[230px] items-center justify-center overflow-hidden bg-surface-2 px-5 py-6 sm:px-8">
                <div className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(circle at 50% 48%, color-mix(in srgb, var(--color-brand) 11%, transparent), transparent 58%)" }} />
                <div className="absolute start-5 top-5 z-10 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border-subtle bg-surface-1/90 px-3 py-1.5 text-[11px] font-semibold text-text-primary">#{selected.tripNumber}</span>
                  <span className="rounded-full bg-brand/12 px-3 py-1.5 text-[10px] font-semibold text-brand">{tripStatusLabel(selected, t)}</span>
                </div>
                <TruckImage body={selected.cargoType} alt={truck ? `${truck.brand} ${truck.model}` : t("EJAZ fleet truck", "شاحنة أسطول إيجاز")} loading="eager" className="relative z-[1] h-[190px] w-full max-w-[680px] object-contain drop-shadow-[0_22px_26px_rgba(0,0,0,.2)] sm:h-[230px]" />
                {truck && <div className="absolute bottom-8 end-4 z-20 hidden w-[252px] rounded-xl border border-border-subtle bg-surface-1/95 p-3 shadow-xl backdrop-blur-sm sm:block">
                  <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-[9px] text-text-muted"><IconFuel size={12} />{t("Fuel level", "مستوى الوقود")}</span><strong className="text-[11px] tabular-nums text-text-primary">{truck.fuel}%</strong></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-5"><div className={`h-full rounded-full transition-[width] duration-500 ${truck.fuel <= 20 ? "bg-status-danger" : "bg-status-active"}`} style={{ width: `${Math.max(0, Math.min(100, truck.fuel))}%` }} /></div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <SpeedDial value={speedValue} t={t} />
                    <div className="rounded-lg bg-surface-2/80 px-2 py-1.5 text-center"><IconThermo size={14} className="mx-auto text-brand" /><div className="mt-0.5 text-[12px] font-bold tabular-nums text-text-primary">{truck.engineTemp}°C</div><div className="mt-0.5 text-[8px] text-text-muted">{t("Engine temperature", "حرارة المحرك")}</div></div>
                  </div>
                  {truck.boxTemp !== undefined && <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-surface-2/80 px-2 py-1.5"><span className="text-[9px] text-text-muted">{t("Cargo temperature", "حرارة الحمولة")}</span><strong className="text-[10px] tabular-nums text-text-primary">{truck.boxTemp} °C</strong></div>}
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-border-subtle pt-2"><span className="text-[9px] text-text-muted">{t("Vehicle status", "حالة المركبة")}</span><strong className={`text-[10px] ${truck.status === "active" ? "text-status-active" : "text-status-waiting"}`}>{truck.status === "active" ? t("Active", "نشطة") : truck.status === "waiting" ? t("Waiting", "بالانتظار") : t("Inactive", "متوقفة")}</strong></div>
                  <button onClick={onOpenMaintenance} className="mt-2 w-full border-t border-border-subtle pt-2 text-start text-[10px] font-semibold text-brand hover:text-brand-soft">{t("Maintenance & repairs", "الصيانة والإصلاحات")} →</button>
                </div>}
                <div className="absolute inset-x-8 bottom-5 h-px bg-gradient-to-r from-transparent via-border-strong to-transparent" />
                {truck && <div className="absolute bottom-2 z-10 rounded-full border border-border-subtle bg-surface-1/90 px-3 py-1 text-[10px] text-text-secondary">{truck.brand} · {truck.model}</div>}
              </div>
              <div className="flex min-w-0 flex-col justify-between p-5 sm:p-6">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-brand">{t("Selected trip", "الرحلة المحددة")}</p><h2 className="mt-1 text-xl font-bold text-text-primary">{selected.originCity}<span className="mx-2 text-brand">→</span>{selected.destinationCity}</h2></div>
                    {selected.cargoType && <TruckTypeBadge truckType={selected.cargoType} size={13} />}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border-subtle py-4 text-[11px]">
                    <div><span className="block text-text-muted">{t("Customer", "العميل")}</span><span className="mt-1 block truncate font-semibold text-text-primary">{selected.shipper || "—"}</span></div>
                    <div><span className="block text-text-muted">{t("Driver", "السائق")}</span><span className="mt-1 block truncate font-semibold text-text-primary">{driver?.name || "—"}</span></div>
                    <div><span className="block text-text-muted">{t("Pickup", "التحميل")}</span><span className="mt-1 block truncate text-text-secondary">{selected.originTerminal || selected.originCity}</span></div>
                    <div><span className="block text-text-muted">{t("Delivery", "التفريغ")}</span><span className="mt-1 block truncate text-text-secondary">{selected.destinationTerminal || selected.destinationCity}</span></div>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3"><div><span className="text-[10px] text-text-muted">{t("Route progress", "تقدم المسار")}</span><div className="mt-1 text-lg font-bold tabular-nums text-text-primary">{Math.round(selected.progressPct)}%</div></div><div className="text-end"><span className="text-[10px] text-text-muted">{t("Distance remaining", "المسافة المتبقية")}</span><div className="mt-1 text-[13px] font-semibold tabular-nums text-text-primary">{Math.round(selected.distanceRemainingKm).toLocaleString()} {t("km", "كم")}</div></div></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-5" role="progressbar" aria-valuenow={Math.round(selected.progressPct)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, selected.progressPct))}%` }} /></div>
                  <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-text-muted"><span>{selected.originCity}</span><span className="h-px flex-1 border-t border-dashed border-border-strong" /><span>{selected.destinationCity}</span></div>
                  <div className="mt-4 rounded-xl border border-border-subtle bg-surface-2/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-text-secondary">{t("Truck load capacity", "حمولة الشاحنة")}</span>
                      <span className="text-[11px] font-bold tabular-nums text-text-primary">{selected.cargoWeightTons.toLocaleString()} / {selected.maxCapacityTons} {t("tons", "طن")}</span>
                    </div>
                    <CapacityTruck
                      key={selected.id}
                      pct={loadPercent}
                      countUp
                      truckType={selected.cargoType}
                      vehicle={truck}
                      className="mt-2 w-full motion-safe:animate-truck-bob motion-reduce:animate-none"
                      label={t(`Truck load ${Math.round(loadPercent)} percent of ${selected.maxCapacityTons} tonnes`, `حمولة الشاحنة ${Math.round(loadPercent)} بالمئة من ${selected.maxCapacityTons} طن`)}
                    />
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-4 text-[10px]"><span><span className="text-text-muted">{t("Distance", "المسافة")}</span><strong className="ms-1.5 text-text-primary">{Math.round(selected.distanceTotalKm).toLocaleString()} {t("km", "كم")}</strong></span><span><span className="text-text-muted">ETA</span><strong className="ms-1.5 text-text-primary">{selected.etaMinutes > 0 ? `${Math.floor(selected.etaMinutes / 60)}h ${selected.etaMinutes % 60}m` : "—"}</strong></span></div>
                  <button onClick={() => onOpenTripDetails?.(selected.id)} className="btn-primary rounded-lg px-4 py-2 text-[11px]">{t("Trip details", "تفاصيل الرحلة")}</button>
                </div>
              </div>
            </div>
          ) : <div className="p-8 text-center text-sm text-text-muted">{t("No trips match the selected filters.", "لا توجد رحلات تطابق الفلاتر المحددة.")}</div>}
        </section>

        <section className="card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[14px] font-semibold text-text-primary">{t("Truck load capacity", "حمولة الشاحنة")}</h2><p className="mt-0.5 text-[10px] text-text-muted">{t("Four approved types · select one to filter trips and focus its assigned truck.", "أربعة أنواع معتمدة · اختر نوعاً لتصفية الرحلات والتركيز على شاحنته.")}</p></div><span className="rounded-full bg-surface-3 px-2.5 py-1 text-[10px] font-semibold text-text-secondary">{APPROVED_VEHICLE_TYPES_LIST.length} {t("approved types", "أنواع معتمدة")}</span></div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {APPROVED_VEHICLE_TYPES_LIST.map((meta) => {
              const vehicle = trucks.find((item) => normalizeVehicleType(item.body) === meta.id);
              const matchingTypeTrips = trips.filter((trip) => normalizeVehicleType(trip.cargoType) === meta.id);
              const matchingTrip = matchingTypeTrips.find((trip) => trip.cargoWeightTons > 0 && (!vehicle || trip.truckId === vehicle.id))
                ?? matchingTypeTrips.find((trip) => trip.cargoWeightTons > 0)
                ?? matchingTypeTrips.find((trip) => !vehicle || trip.truckId === vehicle.id)
                ?? matchingTypeTrips[0];
              const count = trucks.filter((item) => normalizeVehicleType(item.body) === meta.id).length;
              const typeLoadPercent = matchingTrip && matchingTrip.maxCapacityTons > 0
                ? Math.max(0, Math.min(100, matchingTrip.cargoWeightTons / matchingTrip.maxCapacityTons * 100))
                : 0;
              const active = cargo === meta.id;
              return <button key={meta.id} onClick={() => {
                setCargo(meta.id);
                setGroup("all");
                setCustomer("all");
                setDriverFilter("all");
                setQuery("");
                if (matchingTrip) handleSelect(matchingTrip.id);
              }} aria-pressed={active} className={`group min-w-0 overflow-hidden rounded-xl border p-2.5 text-start transition hover:border-brand/55 ${active ? "border-brand/60 bg-brand/5 ring-1 ring-brand/15" : "border-border-subtle bg-surface-2/50"}`}>
                <div className="overflow-hidden rounded-lg bg-surface-2/70 p-1">
                  <CapacityTruck
                    pct={typeLoadPercent}
                    countUp={Boolean(matchingTrip)}
                    truckType={meta.id}
                    className="w-full transition-transform duration-300 group-hover:scale-[1.02]"
                    label={t(meta.englishName, meta.arabicName)}
                  />
                </div>
                <div className="mt-2 flex min-w-0 items-center justify-between gap-1"><span className="truncate text-[11px] font-bold text-text-primary">{t(meta.englishName, meta.arabicName)}</span><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.accentColor }} /></div>
                <div className="mt-0.5 flex min-w-0 items-center justify-between gap-1 text-[9px] text-text-muted">
                  <span className="truncate">{count} {t("vehicles", "مركبة")}{vehicle?.plate ? ` · ${vehicle.plate}` : ""}</span>
                  {matchingTrip && <strong className="shrink-0 tabular-nums text-text-primary">{matchingTrip.cargoWeightTons.toLocaleString()} / {matchingTrip.maxCapacityTons} {t("tons", "طن")} · {Math.round(typeLoadPercent)}%</strong>}
                </div>
              </button>;
            })}
          </div>
        </section>

        <section className="card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-[14px] font-semibold text-text-primary">{t("Operations & fleet snapshot", "لمحة التشغيل والأسطول")}</h2><p className="mt-0.5 text-[10px] text-text-muted">{t("Counts are calculated from the records currently available to you.", "المؤشرات محسوبة من السجلات المتاحة لحسابك حالياً.")}</p></div>
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1" role="group" aria-label={t("Cargo type filters", "فلاتر نوع الشاحنة")}>
              {cargoOptions.map((option) => <button key={option.id} onClick={() => setCargo(option.id)} aria-pressed={cargo === option.id} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] transition ${cargo === option.id ? "bg-brand font-semibold text-on-brand" : "text-text-secondary hover:text-text-primary"}`}>{option.label}</button>)}
            </div>
          </div>
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <label className="min-w-0 text-[10px] text-text-muted">{t("Trip status", "حالة الرحلة")}
              <select value={group} onChange={(event) => setGroup(event.target.value as typeof group)} className="mt-1 block h-9 w-full rounded-lg border border-border-subtle bg-surface-2 px-2.5 text-[11px] text-text-primary outline-none focus:border-brand/60">
                <option value="all">{t("All statuses", "كل الحالات")}</option>
                <option value="pending">{t("Pending", "قيد التجهيز")}</option>
                <option value="transit">{t("In transit", "على الطريق")}</option>
                <option value="delivered">{t("Delivered", "تم التسليم")}</option>
                <option value="cancelled">{t("Cancelled", "ملغاة")}</option>
              </select>
            </label>
            <label className="min-w-0 text-[10px] text-text-muted">{t("Customer", "العميل")}
              <select value={customer} onChange={(event) => setCustomer(event.target.value)} className="mt-1 block h-9 w-full rounded-lg border border-border-subtle bg-surface-2 px-2.5 text-[11px] text-text-primary outline-none focus:border-brand/60">
                <option value="all">{t("All customers", "كل العملاء")}</option>
                {Array.from(new Set(trips.map((trip) => trip.shipper).filter(Boolean))).sort().map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-[10px] text-text-muted">{t("Driver", "السائق")}
              <select value={driverFilter} onChange={(event) => setDriverFilter(event.target.value)} className="mt-1 block h-9 w-full rounded-lg border border-border-subtle bg-surface-2 px-2.5 text-[11px] text-text-primary outline-none focus:border-brand/60">
                <option value="all">{t("All drivers", "كل السائقين")}</option>
                {drivers.filter((person) => trips.some((trip) => trip.driverId === person.id)).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
          </div>
          <KpiCards trips={filteredTrips} activeGroup={group} onGroup={filterGroup} />
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <CargoDonut trips={filteredTrips} />
          <TripBars trips={filteredTrips} selectedId={selected?.id ?? ""} onSelect={handleSelect} />
        </div>

        <section className="card overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-4 sm:px-5"><div><h2 className="text-[14px] font-semibold text-text-primary">{t("Trips & activity", "الرحلات والنشاط")}</h2><p className="mt-0.5 text-[10px] text-text-muted">{filteredTrips.length} {t("matching records", "سجل مطابق للفلاتر")}</p></div><div className="flex items-center gap-2 text-[10px] text-text-muted"><span className={`h-2 w-2 rounded-full ${gpsState === "configured" ? "bg-status-active" : "bg-status-waiting"}`} />{gpsState === "configured" ? t("Provider configured; live positions are shown only when a device feed is available.", "المزود مهيأ؛ لا تظهر المواقع إلا عند توفر بيانات جهاز فعلية.") : t("Live locations unavailable until a GPS provider is configured.", "المواقع المباشرة غير متاحة حتى تهيئة مزود GPS.")}</div></div>
          <ActivitiesTable trips={filteredTrips} drivers={drivers} selectedId={selected?.id ?? ""} group={group} onGroup={(next) => setGroup(next)} onSelect={handleSelect} onToast={onToast} />
        </section>
      </div>
    </div>
  );
}
