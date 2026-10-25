import { useMemo, useState } from "react";
import type { Vehicle } from "../data/types";
import { getVehicleTypeMeta, normalizeVehicleType } from "../data/vehicleTypes";
import { useSettings } from "../settings";
import { Vehicle3DViewer } from "./Vehicle3DViewer";
import { StatusChip } from "./StatusChip";
import { TruckTypeAvatar } from "./TruckTypeIcon";
import {
  IconArrowRight,
  IconCheck,
  IconPin,
  IconRepair,
  IconRotate360,
  IconTracking,
} from "./Icons";

interface RealityCommandDeckProps {
  vehicles: Vehicle[];
  selectedId: string;
  onSelect: (id: string) => void;
  onNav: (key: string) => void;
  onToast: (text: string, sub?: string) => void;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function Metric({ label, value, hint, tone = "neutral" }: { label: string; value: string | number; hint: string; tone?: "neutral" | "active" | "warning" }) {
  const toneClass = tone === "active" ? "text-status-active" : tone === "warning" ? "text-status-waiting" : "text-text-primary";
  return (
    <div className="min-w-0 rounded-panel border border-border-subtle bg-surface-1/80 p-3 backdrop-blur-sm">
      <div className="truncate text-micro font-semibold uppercase tracking-[0.14em] text-text-muted">{label}</div>
      <div className={`mt-1 text-hero-sm font-bold tabular-nums ${toneClass}`}>{value}</div>
      <div className="mt-1 truncate text-micro text-text-secondary">{hint}</div>
    </div>
  );
}

function ProgressRing({ value, label, caption }: { value: number; label: string; caption: string }) {
  const pct = clampPercent(value);
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;
  return (
    <div className="flex items-center gap-3 rounded-panel border border-border-subtle bg-surface-1 p-3">
      <div className="relative h-[82px] w-[82px] shrink-0">
        <svg viewBox="0 0 82 82" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="41" cy="41" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-surface-4" />
          <circle cx="41" cy="41" r={radius} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${dash} ${circumference - dash}`} className="text-brand transition-[stroke-dasharray] duration-700" />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums text-text-primary">{Math.round(pct)}%</span>
      </div>
      <div className="min-w-0"><div className="text-label font-semibold text-text-primary">{label}</div><div className="mt-1 text-micro leading-5 text-text-muted">{caption}</div></div>
    </div>
  );
}

export function RealityCommandDeck({ vehicles, selectedId, onSelect, onNav, onToast }: RealityCommandDeckProps) {
  const { t } = useSettings();
  const [focusType, setFocusType] = useState<"all" | "curtain" | "dry" | "reefer" | "flatbed">("all");
  const selected = vehicles.find((v) => v.id === selectedId) ?? vehicles[0];
  const active = vehicles.filter((v) => v.status === "active");
  const maintenance = vehicles.filter((v) => v.status === "inactive");
  const utilization = vehicles.length ? vehicles.reduce((sum, v) => sum + (v.maxLoad > 0 ? v.load / v.maxLoad : 0), 0) / vehicles.length * 100 : 0;
  const fuel = vehicles.length ? vehicles.reduce((sum, v) => sum + (Number(v.fuel) || 0), 0) / vehicles.length : 0;
  const visibleVehicles = useMemo(() => focusType === "all" ? vehicles : vehicles.filter((v) => normalizeVehicleType(v.body) === focusType), [focusType, vehicles]);
  const routeVehicles = [...visibleVehicles].sort((a, b) => Number(b.progress) - Number(a.progress)).slice(0, 6);

  if (!selected) {
    return (
      <div className="grid min-h-[360px] place-items-center rounded-panel border border-border-subtle bg-surface-1 p-8 text-center">
        <div><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-3 text-text-muted"><IconTracking size={22} /></div><h2 className="mt-4 text-section-title font-bold text-text-primary">{t("Fleet is ready for your first vehicle", "الأسطول جاهز لإضافة أول شاحنة")}</h2><p className="mt-2 max-w-sm text-label-lg leading-6 text-text-muted">{t("Add a vehicle to unlock the reality command deck.", "أضف شاحنة لفتح مركز القيادة المرئي للأسطول.")}</p><button onClick={() => onNav("fleet")} className="btn-primary mt-5">{t("Open fleet", "فتح الأسطول")}</button></div>
      </div>
    );
  }

  const selectedMeta = getVehicleTypeMeta(selected.body);
  const selectedLoad = selected.maxLoad > 0 ? selected.load / selected.maxLoad * 100 : 0;
  const selectedFuel = Number(selected.fuel) || 0;

  return (
    <div className="space-y-4 pb-2">
      <section className="relative overflow-hidden rounded-panel border border-border-subtle bg-surface-1">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,rgba(255,138,0,0.12),transparent_36%),linear-gradient(120deg,transparent,rgba(255,255,255,0.025))]" />
        <div className="relative grid min-h-[430px] lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="relative min-h-[330px] overflow-hidden border-b border-border-subtle lg:border-b-0 lg:border-e">
            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 p-4"><div><div className="flex items-center gap-2 text-micro font-bold uppercase tracking-[0.16em] text-brand"><span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />{t("Reality vehicle view", "المشهد الواقعي للمركبة")}</div><div className="mt-1 text-label text-text-muted">{t("Interactive 3D · 360° · live-ready", "ثلاثي الأبعاد · دوران 360° · جاهز للبيانات الحية")}</div></div><button onClick={() => onToast(t("360° vehicle view", "عرض المركبة 360°"), `${selected.plate} · ${selectedMeta.arabicName}`)} className="flex min-h-11 items-center gap-2 rounded-full border border-border-subtle bg-surface-1/80 px-3 text-label font-semibold text-text-secondary backdrop-blur hover:text-text-primary"><IconRotate360 size={16} /><span>{t("Rotate", "دوران")}</span></button></div>
            <div className="absolute inset-0 pt-10"><Vehicle3DViewer vehicleType={selected.body} vehicleModel={selected.model} vehiclePlate={selected.plate} vehicle={{ id: selected.id, body: selected.body, customImage: selected.customImage }} previewMode={false} height="100%" compact={false} showControls={true} /></div>
            <div className="pointer-events-none absolute bottom-3 start-3 end-3 z-10 flex flex-wrap items-end justify-between gap-2"><div className="rounded-panel border border-border-subtle bg-surface-1/85 px-3 py-2 backdrop-blur-md"><div className="text-micro text-text-muted">{t("Selected unit", "المركبة المحددة")}</div><div className="mt-0.5 font-mono text-sm font-bold text-text-primary">{selected.plate}</div><div className="text-micro text-text-secondary">{selectedMeta.arabicName} · {selected.model}</div></div><div className="rounded-full border border-status-active/20 bg-status-active/10 px-3 py-1.5 text-micro font-semibold text-status-active">{selected.status === "active" ? t("Operating", "تعمل الآن") : t("Status monitored", "الحالة تحت المراقبة")}</div></div>
          </div>

          <aside className="flex flex-col p-4 lg:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-micro font-bold uppercase tracking-[0.14em] text-text-muted">{t("Vehicle telemetry", "بيانات المركبة")}</div><h2 className="mt-1 truncate text-xl font-bold text-text-primary">{selected.driver.name}</h2><p className="mt-1 truncate text-label text-text-secondary">{selected.from} → {selected.to}</p></div><TruckTypeAvatar truckType={selected.body} size={46} iconSize={23} showBadge /></div>
            <div className="mt-5 grid grid-cols-2 gap-2"><Metric label={t("Speed", "السرعة")} value={`${selected.speed} km/h`} hint={t("current trip", "في الرحلة الحالية")} tone="active" /><Metric label={t("Fuel", "الوقود")} value={`${Math.round(selectedFuel)}%`} hint={t("estimated level", "المستوى المقدر")} tone={selectedFuel < 25 ? "warning" : "neutral"} /><Metric label={t("Load", "الحمولة")} value={`${Math.round(selectedLoad)}%`} hint={`${selected.load} / ${selected.maxLoad} t`} /><Metric label={t("Remaining", "المتبقي")} value={`${Math.round(selected.milesLeft)} mi`} hint={t("route distance", "مسافة المسار")} /></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><ProgressRing value={selectedFuel} label={t("Fuel health", "حالة الوقود")} caption={t("Monitor before the next service point.", "راقب المستوى قبل نقطة الخدمة التالية.")} /><ProgressRing value={100 - clampPercent(selectedLoad)} label={t("Capacity headroom", "المساحة المتبقية")} caption={t("Available payload capacity.", "السعة المتبقية للحمولة.")} /></div>
            <div className="mt-auto grid grid-cols-2 gap-2 pt-4"><button onClick={() => onNav("tracking")} className="btn-primary flex min-h-11 items-center justify-center gap-2"><IconPin size={16} /> {t("Open tracking", "فتح التتبع")}</button><button onClick={() => onNav("repair")} className="btn-secondary flex min-h-11 items-center justify-center gap-2"><IconRepair size={16} /> {t("Maintenance", "الصيانة")}</button></div>
          </aside>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label={t("Fleet", "الأسطول")} value={vehicles.length} hint={t("registered units", "مركبات مسجلة")} /><Metric label={t("On route", "على الطريق")} value={active.length} hint={t("operating now", "تعمل الآن")} tone="active" /><Metric label={t("Utilization", "الاستغلال")} value={`${Math.round(utilization)}%`} hint={t("average payload", "متوسط الحمولة")} /><Metric label={t("Attention", "تحتاج متابعة")} value={maintenance.length} hint={t("maintenance or inactive", "صيانة أو متوقفة")} tone={maintenance.length ? "warning" : "neutral"} /></section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="rounded-panel border border-border-subtle bg-surface-1 p-4 lg:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-micro font-bold uppercase tracking-[0.14em] text-text-muted">{t("Fleet movement", "حركة الأسطول")}</div><h3 className="mt-1 text-section-title font-bold text-text-primary">{t("Routes at a glance", "المسارات أمامك مباشرة")}</h3></div><button onClick={() => onNav("tracking")} className="text-label font-semibold text-brand hover:opacity-80">{t("Open live center", "فتح مركز العمليات")}</button></div>
          <div className="mt-4 flex flex-wrap gap-2">{(["all", "curtain", "dry", "reefer", "flatbed"] as const).map((type) => <button key={type} onClick={() => setFocusType(type)} className={`min-h-10 rounded-full border px-3 text-label font-semibold transition-colors ${focusType === type ? "border-brand bg-brand text-on-brand" : "border-border-subtle bg-surface-2 text-text-secondary hover:text-text-primary"}`}>{type === "all" ? t("All", "الكل") : getVehicleTypeMeta(type).arabicName}</button>)}</div>
          <div className="mt-4 space-y-2">{routeVehicles.map((v) => { const meta = getVehicleTypeMeta(v.body); const routePct = clampPercent(Number(v.progress)); return <button key={v.id} onClick={() => { onSelect(v.id); onToast(t("Vehicle selected", "تم اختيار المركبة"), v.plate); }} className={`group flex w-full items-center gap-3 rounded-panel border p-3 text-start transition-all hover:bg-surface-2 ${v.id === selected.id ? "border-brand/40 bg-brand/5" : "border-border-subtle bg-surface-1"}`}><TruckTypeAvatar truckType={v.body} size={40} iconSize={20} showBadge /><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="font-mono text-label font-bold text-text-primary">{v.plate}</span><StatusChip status={v.status} /></span><span className="mt-1 block truncate text-micro text-text-muted">{v.from} → {v.to} · {meta.arabicName}</span><span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-4"><span className="block h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${routePct}%` }} /></span></span><IconArrowRight size={16} className="shrink-0 text-text-muted transition-transform group-hover:-translate-x-0.5" /></button>; })}</div>
        </div>

        <div className="space-y-3"><div className="rounded-panel border border-border-subtle bg-surface-1 p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-micro font-bold uppercase tracking-[0.14em] text-text-muted">{t("Fleet health", "صحة الأسطول")}</div><h3 className="mt-1 text-section-title font-bold text-text-primary">{t("Operational pulse", "نبض التشغيل")}</h3></div><IconCheck size={18} className="text-status-active" /></div><div className="mt-4 space-y-3">{[[t("Fuel readiness", "جاهزية الوقود"), fuel], [t("Payload efficiency", "كفاءة الحمولة"), utilization], [t("Availability", "التوفر"), vehicles.length ? active.length / vehicles.length * 100 : 0]].map(([label, value]) => <div key={String(label)}><div className="mb-1 flex items-center justify-between gap-3 text-micro"><span className="text-text-secondary">{label}</span><span className="font-bold tabular-nums text-text-primary">{Math.round(Number(value))}%</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-4"><div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${clampPercent(Number(value))}%` }} /></div></div>)}</div></div>
          <div className="rounded-panel border border-border-subtle bg-surface-1 p-4"><div className="text-micro font-bold uppercase tracking-[0.14em] text-text-muted">{t("Next actions", "الإجراءات التالية")}</div><div className="mt-3 grid gap-2"><button onClick={() => onNav("fleet")} className="flex min-h-11 items-center justify-between rounded-inner bg-surface-2 px-3 text-label font-semibold text-text-secondary hover:text-text-primary"><span>{t("Manage fleet assets", "إدارة أصول الأسطول")}</span><IconArrowRight size={15} /></button><button onClick={() => onNav("drivers")} className="flex min-h-11 items-center justify-between rounded-inner bg-surface-2 px-3 text-label font-semibold text-text-secondary hover:text-text-primary"><span>{t("Review driver assignments", "مراجعة تكليفات السائقين")}</span><IconArrowRight size={15} /></button><button onClick={() => onNav("reports")} className="flex min-h-11 items-center justify-between rounded-inner bg-surface-2 px-3 text-label font-semibold text-text-secondary hover:text-text-primary"><span>{t("Open operations reports", "فتح تقارير التشغيل")}</span><IconArrowRight size={15} /></button></div></div>
        </div>
      </section>
    </div>
  );
}
