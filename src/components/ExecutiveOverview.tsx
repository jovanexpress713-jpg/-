import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../settings";
import { apiClient, getAuthToken } from "../services/apiClient";
import { useFleetStore } from "../state/fleetStore";
import { useToast } from "./Toast";
import { CapacityTruck } from "./CapacityTruck";
import { TruckTypeIcon } from "./TruckTypeIcon";
import { IconMenu, IconTracking, IconTruck, IconCheck, IconSearch, IconSnowflake, IconChevron } from "./Icons";
import { KpiCards } from "./overview/KpiCards";
import { CargoDonut } from "./overview/CargoDonut";
import { TripBars } from "./overview/TripBars";
import { ActivitiesTable } from "./overview/ActivitiesTable";
import { statusGroup } from "./overview/shared";
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
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-inner ${tone}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-label text-text-muted">{label}</span>
        <span className="mt-0.5 block text-hero-sm font-bold leading-none tabular-nums text-text-primary">{value.toLocaleString()}</span>
        <span className="mt-1 block truncate text-micro text-text-muted">{hint}</span>
      </span>
    </Tag>
  );
}

export function ExecutiveOverview({ userName, onOpenSidebar, onOpenTripDetails, onOpenTracking }: Props) {
  const { t } = useSettings();
  const toast = useToast();
  const { trips, trucks, drivers, selectedTripId, selectTrip, selectTruck } = useFleetStore();
  const [group, setGroup] = useState<"all" | "pending" | "transit" | "delivered" | "cancelled">("all");
  const [cargo, setCargo] = useState<CargoFilter>("all");
  const [customer, setCustomer] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [gpsState, setGpsState] = useState<GpsState>("checking");
  const [truckTypesExpanded, setTruckTypesExpanded] = useState(false);

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
  const loadPercent = selected && selected.maxCapacityTons > 0
    ? Math.max(0, Math.min(100, (selected.cargoWeightTons / selected.maxCapacityTons) * 100))
    : 0;
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
        <div className="mx-auto grid min-h-[55vh] max-w-5xl place-items-center rounded-panel border border-dashed border-border-subtle p-8 text-center">
          <div><span className="mx-auto grid h-12 w-12 place-items-center rounded-panel bg-surface-3 text-brand"><IconTruck size={22} /></span>
            <h1 className="mt-4 text-headline leading-7 font-semibold text-text-primary">{t("No trips to display", "لا توجد رحلات لعرضها")}</h1>
            <p className="mt-2 text-card-title leading-5 text-text-muted">{t("Trips will appear here when available to your account.", "ستظهر الرحلات هنا عند توفرها لحسابك.")}</p>
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
              <p className="text-body text-text-secondary">{greeting(t)}{userName ? `، ${userName}` : ""}</p>
              <h1 className="mt-1 text-hero font-bold leading-tight text-text-primary sm:text-metric">{t("Logistics Dashboard", "لوحة الخدمات اللوجستية")}</h1>
              <p className="mt-1 text-label text-text-muted">{t("Operations overview · EJAZ Transport Establishment", "نظرة تشغيلية · مؤسسة إيجاز للنقليات")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 min-w-[220px] items-center gap-2 rounded-inner border border-border-subtle bg-surface-2 px-3 text-text-muted focus-within:border-brand/60">
              <IconSearch size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search trips, customers, drivers…", "ابحث برحلة أو عميل أو سائق…")} className="min-w-0 flex-1 bg-transparent text-label-lg text-text-primary outline-none placeholder:text-text-muted" />
            </label>
            <button onClick={onOpenTracking} className="btn-ghost h-10 gap-2 rounded-inner px-3 text-label" disabled={!onOpenTracking}>
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
            <div className="relative flex min-h-[510px] flex-col overflow-hidden bg-[radial-gradient(ellipse_at_50%_45%,color-mix(in_srgb,var(--color-brand)_7%,transparent),transparent_60%)] px-5 py-5 sm:min-h-[590px] sm:px-8 sm:py-6">
              <div className="flex items-start justify-between gap-4" dir="ltr">
                <strong className="pt-0.5 text-start text-page-title font-bold tabular-nums text-text-primary sm:text-section-title">
                  {selected.cargoWeightTons.toLocaleString()} / {selected.maxCapacityTons} {t("tons", "طن")}
                </strong>
                <h2 className="pt-0.5 text-end text-section-title font-bold text-text-primary sm:text-hero-sm" dir="rtl">{t("Truck load capacity", "حمولة الشاحنة")}</h2>
              </div>

              <div className="flex flex-1 items-center justify-center py-3 sm:py-4">
                <CapacityTruck
                  key={`hero-${selected.id}`}
                  pct={loadPercent}
                  countUp
                  truckType={selected.cargoType}
                  vehicle={trucks.find((item) => item.id === selected.truckId)}
                  className="w-full max-w-[810px] drop-shadow-[0_22px_26px_rgba(0,0,0,.22)]"
                  label={t(`Truck load ${Math.round(loadPercent)} percent of ${selected.maxCapacityTons} tonnes`, `حمولة الشاحنة ${Math.round(loadPercent)} بالمئة من ${selected.maxCapacityTons} طن`)}
                />
              </div>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-2" dir="ltr">
                <button onClick={() => onOpenTripDetails?.(selected.id)} className="btn-primary min-h-[54px] rounded-inner px-7 py-3 text-card-title font-bold sm:min-h-[60px] sm:px-8 sm:text-page-title">
                  {t("Trip details", "تفاصيل الرحلة")}
                </button>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-body sm:gap-x-8 sm:text-page-title" dir="ltr">
                  <span className="flex items-center gap-2 whitespace-nowrap"><span className="text-text-muted">ETA</span><strong className="font-semibold text-text-primary">{selected.etaMinutes > 0 ? `${Math.floor(selected.etaMinutes / 60)}h ${String(selected.etaMinutes % 60).padStart(2, "0")}m` : "—"}</strong></span>
                  <span className="flex items-center gap-2 whitespace-nowrap"><span className="text-text-muted" dir="rtl">{t("Distance", "المسافة")}</span><strong className="font-semibold tabular-nums text-text-primary">{Math.round(selected.distanceTotalKm).toLocaleString()} {t("km", "كم")}</strong></span>
                </div>
              </div>
            </div>
          ) : <div className="p-8 text-center text-card-title leading-5 text-text-muted">{t("No trips match the selected filters.", "لا توجد رحلات تطابق الفلاتر المحددة.")}</div>}
        </section>

        <section className="card p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-4" dir="ltr">
            <span className="pt-1 text-label font-medium text-text-secondary" dir="rtl">{APPROVED_VEHICLE_TYPES_LIST.length} {t("approved types", "أنواع معتمدة")}</span>
            <div className="text-end" dir="rtl">
              <button
                type="button"
                onClick={() => setTruckTypesExpanded((expanded) => !expanded)}
                aria-expanded={truckTypesExpanded}
                aria-controls="executive-truck-type-cards"
                aria-label={truckTypesExpanded ? t("Hide truck types", "إخفاء أنواع الشاحنات") : t("Show truck types", "عرض أنواع الشاحنات")}
                className="inline-flex cursor-pointer items-center gap-1.5 text-section-title font-bold text-text-primary transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 sm:text-hero-sm"
              >
                {t("Truck load capacity", "حمولة الشاحنة")}
                <IconChevron size={17} className={`transition-transform duration-200 ${truckTypesExpanded ? "rotate-180" : ""}`} />
              </button>
              <p className="mt-1 text-micro text-text-muted sm:text-label-lg">{t("Four approved types · select one to filter trips and focus its assigned truck.", "أربعة أنواع معتمدة · اختر نوعاً لتصفية الرحلات والتركيز على شاحنتك.")}</p>
            </div>
          </div>
          <div id="executive-truck-type-cards" className={truckTypesExpanded ? "block" : "hidden"}>
            <div className="grid grid-cols-2 gap-3">
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
              }} aria-pressed={active} className={`group min-w-0 overflow-hidden rounded-inner border p-2.5 text-start transition hover:border-brand/55 sm:p-3 ${active ? "border-brand/60 bg-brand/5 ring-1 ring-brand/15" : "border-border-subtle bg-surface-2/50"}`}>
                <div className="relative overflow-hidden rounded-chip bg-surface-2/70 p-1">
                  <CapacityTruck
                    pct={typeLoadPercent}
                    countUp={Boolean(matchingTrip)}
                    truckType={meta.id}
                    className="w-full transition-transform duration-300 group-hover:scale-[1.02]"
                    label={t(meta.englishName, meta.arabicName)}
                  />
                  <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center transition-transform duration-200 group-hover:scale-110" style={{ color: meta.accentColor }} title={t(meta.englishName, meta.arabicName)} aria-label={t(meta.englishName, meta.arabicName)} role="img">
                    {meta.id === "reefer" ? <IconSnowflake size={26} /> : <TruckTypeIcon truckType={meta.id} size={25} />}
                  </span>
                </div>
                <div className="mt-2 flex min-w-0 items-center justify-between gap-2" dir="ltr">
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: meta.accentColor }} aria-hidden="true" />
                  <span className="truncate text-page-title font-bold text-text-primary sm:text-section-title" dir="rtl">{t(meta.englishName, meta.arabicName)}</span>
                </div>
                <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-micro text-text-muted sm:text-label" dir="ltr">
                  <span className="truncate" dir="rtl">{count} {t("vehicles", "مركبة")}{vehicle?.plate ? ` · ${vehicle.plate}` : ""}</span>
                  {matchingTrip
                    ? <strong className="shrink-0 tabular-nums text-text-primary" dir="ltr">{matchingTrip.cargoWeightTons.toLocaleString()} / {matchingTrip.maxCapacityTons} · {Math.round(typeLoadPercent)}%</strong>
                    : <span className="shrink-0 text-text-muted">—</span>}
                </div>
              </button>;
              })}
            </div>
          </div>
        </section>

        <section className="card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-card-title font-semibold text-text-primary">{t("Operations & fleet snapshot", "لمحة التشغيل والأسطول")}</h2><p className="mt-0.5 text-micro text-text-muted">{t("Counts are calculated from the records currently available to you.", "المؤشرات محسوبة من السجلات المتاحة لحسابك حالياً.")}</p></div>
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-inner bg-surface-2 p-1" role="group" aria-label={t("Cargo type filters", "فلاتر نوع الشاحنة")}>
              {cargoOptions.map((option) => <button key={option.id} onClick={() => setCargo(option.id)} aria-pressed={cargo === option.id} className={`shrink-0 rounded-chip px-2.5 py-1.5 text-micro transition ${cargo === option.id ? "bg-brand font-semibold text-on-brand" : "text-text-secondary hover:text-text-primary"}`}>{option.label}</button>)}
            </div>
          </div>
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <label className="min-w-0 text-micro text-text-muted">{t("Trip status", "حالة الرحلة")}
              <select value={group} onChange={(event) => setGroup(event.target.value as typeof group)} className="mt-1 block h-9 w-full rounded-chip border border-border-subtle bg-surface-2 px-2.5 text-label text-text-primary outline-none focus:border-brand/60">
                <option value="all">{t("All statuses", "كل الحالات")}</option>
                <option value="pending">{t("Pending", "قيد التجهيز")}</option>
                <option value="transit">{t("In transit", "على الطريق")}</option>
                <option value="delivered">{t("Delivered", "تم التسليم")}</option>
                <option value="cancelled">{t("Cancelled", "ملغاة")}</option>
              </select>
            </label>
            <label className="min-w-0 text-micro text-text-muted">{t("Customer", "العميل")}
              <select value={customer} onChange={(event) => setCustomer(event.target.value)} className="mt-1 block h-9 w-full rounded-chip border border-border-subtle bg-surface-2 px-2.5 text-label text-text-primary outline-none focus:border-brand/60">
                <option value="all">{t("All customers", "كل العملاء")}</option>
                {Array.from(new Set(trips.map((trip) => trip.shipper).filter(Boolean))).sort().map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-micro text-text-muted">{t("Driver", "السائق")}
              <select value={driverFilter} onChange={(event) => setDriverFilter(event.target.value)} className="mt-1 block h-9 w-full rounded-chip border border-border-subtle bg-surface-2 px-2.5 text-label text-text-primary outline-none focus:border-brand/60">
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-4 sm:px-5"><div><h2 className="text-card-title font-semibold text-text-primary">{t("Trips & activity", "الرحلات والنشاط")}</h2><p className="mt-0.5 text-micro text-text-muted">{filteredTrips.length} {t("matching records", "سجل مطابق للفلاتر")}</p></div><div className="flex items-center gap-2 text-micro text-text-muted"><span className={`h-2 w-2 rounded-full ${gpsState === "configured" ? "bg-status-active" : "bg-status-waiting"}`} />{gpsState === "configured" ? t("Provider configured; live positions are shown only when a device feed is available.", "المزود مهيأ؛ لا تظهر المواقع إلا عند توفر بيانات جهاز فعلية.") : t("Live locations unavailable until a GPS provider is configured.", "المواقع المباشرة غير متاحة حتى تهيئة مزود GPS.")}</div></div>
          <ActivitiesTable trips={filteredTrips} drivers={drivers} selectedId={selected?.id ?? ""} group={group} onGroup={(next) => setGroup(next)} onSelect={handleSelect} onToast={onToast} />
        </section>
      </div>
    </div>
  );
}
