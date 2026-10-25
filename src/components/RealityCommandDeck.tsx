import { useMemo, useState } from "react";
import type { Vehicle } from "../data/types";
import { getVehicleTypeMeta, normalizeVehicleType } from "../data/vehicleTypes";
import { getRealityAsset, loadPercent, etaLabel, clampTelemetry } from "../data/vehicleReality";
import { useVehicleAssets } from "../state/vehicleAssetStore";
import { useSettings } from "../settings";
import { Vehicle3DViewer } from "./Vehicle3DViewer";
import { ARTruckExperience } from "./ARTruckExperience";
import { TruckTypeAvatar } from "./TruckTypeIcon";
import { IconPin, IconRepair, IconRotate360, IconTracking } from "./Icons";

interface RealityCommandDeckProps {
  vehicles: Vehicle[];
  selectedId: string;
  onSelect: (id: string) => void;
  onNav: (key: string) => void;
  onToast: (text: string, sub?: string) => void;
}

type FocusType = "all" | "curtain" | "dry" | "reefer" | "flatbed";

function Metric({ label, value, hint, tone = "neutral" }: { label: string; value: string | number; hint: string; tone?: "neutral" | "active" | "warning" }) {
  const toneClass = tone === "active" ? "text-status-active" : tone === "warning" ? "text-status-waiting" : "text-text-primary";
  return <div className="min-w-0 rounded-panel border border-border-subtle bg-surface-1/80 p-3 backdrop-blur-sm"><div className="truncate text-micro font-semibold uppercase tracking-[0.14em] text-text-muted">{label}</div><div className={`mt-1 text-hero-sm font-bold tabular-nums ${toneClass}`}>{value}</div><div className="mt-1 truncate text-micro text-text-secondary">{hint}</div></div>;
}

function ProgressRing({ value, label, caption }: { value: number; label: string; caption: string }) {
  const pct = clampTelemetry(value); const radius = 32; const circumference = 2 * Math.PI * radius; const dash = pct / 100 * circumference;
  return <div className="flex items-center gap-3 rounded-panel border border-border-subtle bg-surface-1 p-3"><div className="relative h-[82px] w-[82px] shrink-0"><svg viewBox="0 0 82 82" className="h-full w-full -rotate-90" aria-hidden="true"><circle cx="41" cy="41" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-surface-4"/><circle cx="41" cy="41" r={radius} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${dash} ${circumference - dash}`} className="text-brand"/></svg><span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums text-text-primary">{Math.round(pct)}%</span></div><div className="min-w-0"><div className="text-label font-semibold text-text-primary">{label}</div><div className="mt-1 text-micro leading-5 text-text-muted">{caption}</div></div></div>;
}

function RealityState({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warn" }) {
  const toneClass = tone === "good" ? "border-status-active/20 bg-status-active/10 text-status-active" : tone === "warn" ? "border-status-waiting/20 bg-status-waiting/10 text-status-waiting" : "border-border-subtle bg-surface-2 text-text-secondary";
  return <div className={`rounded-xl border px-3 py-2 ${toneClass}`}><div className="text-micro uppercase tracking-[0.12em] opacity-70">{label}</div><div className="mt-0.5 text-label font-semibold">{value}</div></div>;
}

export function RealityCommandDeck({ vehicles, selectedId, onSelect, onNav, onToast }: RealityCommandDeckProps) {
  const { t } = useSettings();
  const { registry } = useVehicleAssets();
  const [focusType, setFocusType] = useState<FocusType>("all");
  const [arOpen, setArOpen] = useState(false);
  const selected = vehicles.find((v) => v.id === selectedId) ?? vehicles[0];
  const active = vehicles.filter((v) => v.status === "active");
  const attention = vehicles.filter((v) => v.status === "inactive" || v.fuel < 20 || v.engineTemp > 105);
  const utilization = vehicles.length ? vehicles.reduce((sum, v) => sum + (v.maxLoad > 0 ? v.load / v.maxLoad : 0), 0) / vehicles.length * 100 : 0;
  const visibleVehicles = useMemo(() => focusType === "all" ? vehicles : vehicles.filter((v) => normalizeVehicleType(v.body) === focusType), [focusType, vehicles]);
  const routeVehicles = [...visibleVehicles].sort((a, b) => Number(b.progress) - Number(a.progress)).slice(0, 6);

  if (!selected) return <div className="grid min-h-[360px] place-items-center rounded-panel border border-border-subtle bg-surface-1 p-8 text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-3 text-text-muted"><IconTracking size={22}/></div><h2 className="mt-4 text-section-title font-bold text-text-primary">{t("Fleet is ready", "الأسطول جاهز")}</h2><p className="mt-2 text-label-lg text-text-muted">{t("Add a vehicle to enter the reality command center.", "أضف شاحنة للدخول إلى مركز القيادة الواقعي.")}</p><button onClick={() => onNav("fleet")} className="btn-primary mt-5">{t("Open fleet", "فتح الأسطول")}</button></div></div>;

  const meta = getVehicleTypeMeta(selected.body);
  const reality = getRealityAsset(selected, registry);
  const load = clampTelemetry(loadPercent(selected));
  const fuelLevel = clampTelemetry(Number(selected.fuel));
  const moving = selected.status === "active" && Number(selected.speed) > 0;
  const maintenanceAlert = selected.engineTemp > 105 || selected.fuel < 20;

  return <div className="space-y-4 pb-2">
    {/* Use the selected vehicle’s own registered image, then the matching local fleet asset. */}
    <section className="relative isolate min-h-[230px] overflow-hidden rounded-3xl border border-border-subtle bg-[#101722] sm:min-h-[270px]">
      <img
        src={selected.customImage || ({ curtain: "/images/trucks/official/official-curtain.webp", dry: "/images/trucks/official/official-dry.webp", reefer: "/images/trucks/official/official-reefer.webp", flatbed: "/images/trucks/official/official-flatbed.webp" }[normalizeVehicleType(selected.body)] || "/images/trucks/official/official-curtain.webp")}
        alt={`${selected.brand} ${selected.model} — ${meta.arabicName}`}
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        loading="eager"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#080d15]/95 via-[#080d15]/75 to-[#080d15]/10" />
      <div className="relative flex min-h-[230px] flex-col justify-between gap-5 p-5 sm:min-h-[270px] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-micro font-bold tracking-[0.12em] text-white backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            EJAZ · OPERATIONS
          </span>
          <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-micro font-semibold text-white/80 backdrop-blur">
            {t("Photo library · real transport imagery", "مكتبة الصور · صور نقل حقيقية")}
          </span>
        </div>
        <div className="max-w-[620px]">
          <p className="text-label font-semibold text-[#ffb45c]">{t("Freight. Visibility. Control.", "الشحن. الرؤية. التحكم.")}</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-white sm:text-4xl">
            {t("Every shipment, in focus.", "كل شحنة أمامك بوضوح.")}
          </h2>
          <p className="mt-2 max-w-[500px] text-sm leading-6 text-white/75 sm:text-base">
            {t("Manage your fleet from one operational workspace, with real vehicle photos and honest live-data status.", "أدر أسطولك من مساحة تشغيل واحدة، بصور المركبات الفعلية وحالة بيانات واضحة بلا مؤشرات وهمية.")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => onNav("tracking")} className="min-h-11 rounded-full bg-brand px-5 text-label font-bold text-on-brand shadow-lg transition hover:brightness-110">
              {t("Open live operations", "فتح العمليات")}
            </button>
            <button onClick={() => onNav("cargos")} className="min-h-11 rounded-full border border-white/25 bg-black/25 px-5 text-label font-bold text-white backdrop-blur transition hover:bg-white/10">
              {t("Browse shipments", "استعراض الشحنات")}
            </button>
          </div>
        </div>
      </div>
    </section>
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-micro font-bold uppercase tracking-[0.14em] text-text-muted">{t("Shipment photo library", "مكتبة صور الشحنات")}</div>
          <h2 className="mt-1 text-section-title font-bold text-text-primary">{t("Choose a real vehicle category", "اختر فئة المركبة بالصور")}</h2>
          <p className="mt-1 text-label text-text-secondary">{t("Photographs already stored in the project — no procedural truck drawings.", "صور محفوظة داخل المشروع — دون رسومات هندسية للشاحنات.")}</p>
        </div>
        <button onClick={() => onNav("cargos")} className="text-label font-semibold text-brand">{t("All shipments →", "كل الشحنات ←")}</button>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {([
          { id: "curtain", label: "ستارة", en: "Curtainsider", image: "/images/trucks/official/official-curtain.webp", hint: "نقل البضائع العامة" },
          { id: "dry", label: "جاف", en: "Dry van", image: "/images/trucks/official/official-dry.webp", hint: "شحنات مغلقة" },
          { id: "reefer", label: "براد", en: "Refrigerated", image: "/images/trucks/official/official-reefer.webp", hint: "شحنات مبردة" },
          { id: "flatbed", label: "سطحة", en: "Flatbed", image: "/images/trucks/official/official-flatbed.webp", hint: "معدات وحمولات كبيرة" },
        ] as const).map((item) => (
          <button
            key={item.id}
            onClick={() => { setFocusType(item.id); onNav("tracking"); }}
            className="group relative min-h-[190px] overflow-hidden rounded-2xl border border-border-subtle bg-surface-1 text-start transition duration-300 hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-lg"
          >
            <img src={item.image} alt={item.label} loading="lazy" className="absolute inset-0 h-full w-full object-contain bg-[#111722] p-2 transition duration-500 group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
              <div className="text-micro font-semibold text-white/65">{item.en}</div>
              <div className="mt-0.5 text-lg font-bold text-white">{item.label}</div>
              <div className="mt-1 text-micro text-white/75">{item.hint}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
    {arOpen && <ARTruckExperience vehicle={selected} onClose={() => setArOpen(false)} />}
    <section className="relative overflow-hidden rounded-panel border border-border-subtle bg-surface-1">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,rgba(255,138,0,0.14),transparent_36%),linear-gradient(120deg,transparent,rgba(255,255,255,0.025))]" />
      <div className="relative grid min-h-[470px] lg:grid-cols-[minmax(0,1.3fr)_minmax(330px,0.7fr)]">
        <div className="relative min-h-[360px] overflow-hidden border-b border-border-subtle lg:border-b-0 lg:border-e">
          <div className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-3 p-4"><div><div className="flex items-center gap-2 text-micro font-bold uppercase tracking-[0.16em] text-brand"><span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />{t("Reality Command Center", "مركز القيادة الواقعي")}</div><div className="mt-1 text-label text-text-muted">{selected.brand} {selected.model} · {meta.arabicName}</div></div><div className="flex gap-2"><button onClick={() => setArOpen(true)} disabled={!reality.isOfficialModel || !reality.modelUrl} className="min-h-11 rounded-full border border-brand/30 bg-brand/10 px-4 text-label font-bold text-brand disabled:cursor-not-allowed disabled:opacity-40">AR</button><button onClick={() => onToast(t("360° vehicle view", "عرض المركبة 360°"), selected.plate)} className="flex min-h-11 items-center gap-2 rounded-full border border-border-subtle bg-surface-1/85 px-3 text-label font-semibold text-text-secondary backdrop-blur"><IconRotate360 size={16}/>{t("360°", "360°")}</button></div></div>
          <div className="absolute inset-0 pt-10"><Vehicle3DViewer vehicleType={selected.body} vehicleModel={selected.model} vehiclePlate={selected.plate} vehicle={{ id: selected.id, body: selected.body, customImage: selected.customImage }} previewMode={false} height="100%" compact={false} showControls={true}/></div>
          <div className="absolute bottom-3 start-3 end-3 z-20 grid gap-2 sm:grid-cols-2"><div className="rounded-panel border border-border-subtle bg-surface-1/85 p-3 backdrop-blur-md"><div className="text-micro text-text-muted">{t("Vehicle identity", "هوية الشاحنة")}</div><div className="mt-1 font-mono text-sm font-bold text-text-primary">{selected.plate}</div><div className="text-micro text-text-secondary">{selected.brand} {selected.model} · {meta.arabicName}</div></div><div className="rounded-panel border border-border-subtle bg-surface-1/85 p-3 backdrop-blur-md"><div className="text-micro text-text-muted">{t("Reality status", "حالة الواقع")}</div><div className="mt-1 text-label font-bold text-text-primary">{moving ? t("Moving", "تتحرك") : selected.status === "waiting" ? t("Stopped / waiting", "متوقفة / انتظار") : t("Inactive", "غير نشطة")}</div><div className="text-micro text-text-secondary">{reality.isOfficialModel ? t("Official 3D asset", "نموذج ثلاثي الأبعاد رسمي") : t("Reference / fallback asset", "صورة مرجعية / أصل احتياطي")}</div></div></div>
        </div>
        <aside className="flex flex-col p-4 lg:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-micro font-bold uppercase tracking-[0.14em] text-text-muted">{t("Driver reality", "واقع السائق")}</div><h2 className="mt-1 truncate text-xl font-bold text-text-primary">{selected.driver.name}</h2><p className="mt-1 truncate text-label text-text-secondary">{selected.from} → {selected.to}</p></div><TruckTypeAvatar truckType={selected.body} size={46} iconSize={23} showBadge /></div><div className="mt-5 grid grid-cols-2 gap-2"><Metric label={t("Speed", "السرعة")} value={`${selected.speed} km/h`} hint={moving ? t("vehicle moving", "الشاحنة تتحرك") : t("vehicle stopped", "الشاحنة متوقفة")} tone={moving ? "active" : "neutral"}/><Metric label={t("Fuel", "الوقود")} value={`${Math.round(fuelLevel)}%`} hint={fuelLevel < 20 ? t("low fuel", "وقود منخفض") : t("current level", "المستوى الحالي")} tone={fuelLevel < 20 ? "warning" : "neutral"}/><Metric label={t("Load", "الحمولة")} value={`${Math.round(load)}%`} hint={`${selected.load} / ${selected.maxLoad} t`}/><Metric label={t("ETA", "الوصول")} value={etaLabel(selected.etaMinutes)} hint={t("estimated arrival", "وقت الوصول المقدر")}/></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><ProgressRing value={fuelLevel} label={t("Fuel", "الوقود")} caption={t("Real vehicle field", "بيان المركبة الفعلي")}/><ProgressRing value={100 - load} label={t("Free capacity", "السعة المتبقية")} caption={t("Payload headroom", "المساحة المتبقية للحمولة")}/></div><div className="mt-3 grid grid-cols-2 gap-2"><RealityState label={t("GPS", "GPS")} value={t("Provider state", "حالة المزوّد")} tone={moving ? "good" : "neutral"}/><RealityState label={t("Weather", "الطقس")} value={t("Not connected", "غير متصل")} tone="warn"/></div><div className="mt-3 grid grid-cols-2 gap-2"><Metric label={t("Engine", "المحرك")} value={`${Math.round(selected.engineTemp)}°`} hint={maintenanceAlert ? t("attention required", "تحتاج متابعة") : t("within current range", "ضمن النطاق الحالي")} tone={maintenanceAlert ? "warning" : "neutral"}/><Metric label={t("Distance", "المسافة")} value={`${Math.round(selected.milesLeft)} mi`} hint={t("remaining route", "المتبقي من المسار")}/></div><div className="mt-auto grid grid-cols-2 gap-2 pt-4"><button onClick={() => onNav("tracking")} className="btn-primary flex min-h-11 items-center justify-center gap-2"><IconPin size={16}/>{t("Open tracking", "فتح التتبع")}</button><button onClick={() => onNav("repair")} className="btn-secondary flex min-h-11 items-center justify-center gap-2"><IconRepair size={16}/>{t("Maintenance", "الصيانة")}</button></div></aside>
      </div>
    </section>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label={t("Fleet", "الأسطول")} value={vehicles.length} hint={t("registered units", "مركبات مسجلة")}/><Metric label={t("Moving", "متحركة")} value={active.length} hint={t("active vehicles", "مركبات نشطة")} tone="active"/><Metric label={t("Utilization", "الاستغلال")} value={`${Math.round(utilization)}%`} hint={t("average payload", "متوسط الحمولة")}/><Metric label={t("Attention", "تحتاج متابعة")} value={attention.length} hint={t("fuel / temperature / inactive", "وقود / حرارة / توقف")} tone={attention.length ? "warning" : "neutral"}/></section>
    <section className="rounded-panel border border-border-subtle bg-surface-1 p-4 lg:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-micro font-bold uppercase tracking-[0.14em] text-text-muted">{t("Fleet movement", "حركة الأسطول")}</div><h3 className="mt-1 text-section-title font-bold text-text-primary">{t("Routes at a glance", "المسارات أمامك مباشرة")}</h3></div><button onClick={() => onNav("tracking")} className="text-label font-semibold text-brand">{t("Open live center", "فتح مركز العمليات")}</button></div><div className="mt-4 flex flex-wrap gap-2">{(["all", "curtain", "dry", "reefer", "flatbed"] as const).map((type) => <button key={type} onClick={() => setFocusType(type)} className={`min-h-10 rounded-full border px-3 text-label font-semibold ${focusType === type ? "border-brand bg-brand text-on-brand" : "border-border-subtle bg-surface-2 text-text-secondary"}`}>{type === "all" ? t("All", "الكل") : getVehicleTypeMeta(type).arabicName}</button>)}</div><div className="mt-4 grid gap-2">{routeVehicles.map((vehicle) => { const vehicleMeta = getVehicleTypeMeta(vehicle.body); const progress = clampTelemetry(vehicle.progress); return <button key={vehicle.id} onClick={() => onSelect(vehicle.id)} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-3 text-start transition ${vehicle.id === selected.id ? "border-brand/40 bg-brand/5" : "border-border-subtle bg-surface-2 hover:border-brand/20"}`}><TruckTypeAvatar truckType={vehicle.body} size={42} iconSize={20} showBadge/><span className="min-w-0"><span className="block truncate text-label font-bold text-text-primary">{vehicle.brand} {vehicle.model} · {vehicle.plate}</span><span className="mt-1 block truncate text-micro text-text-secondary">{vehicle.from} → {vehicle.to} · {vehicleMeta.arabicName}</span><span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-4"><span className="block h-full rounded-full bg-brand" style={{ width: `${progress}%` }} /></span></span><span className="text-label font-bold tabular-nums text-text-primary">{Math.round(progress)}%</span></button>; })}</div></section>
  </div>;
}
