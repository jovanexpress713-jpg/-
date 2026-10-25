import { useMemo, useState } from "react";
import type { Vehicle } from "../data/types";
import { getVehicleTypeMeta, normalizeVehicleType } from "../data/vehicleTypes";
import { buildFleetIndicatorSnapshot, type FleetIndicatorKey } from "../data/interactiveIndicators";
import { getPhotoIndicatorPosition } from "../data/photoIndicatorLayout";
import { useSettings } from "../settings";

interface PhotoFleetHeroProps {
  vehicle: Vehicle;
  onNav: (key: string) => void;
}

const PHOTO_BY_TYPE = {
  curtain: "/images/trucks/official/official-curtain.png",
  dry: "/images/trucks/official/official-dry.png",
  reefer: "/images/trucks/official/official-reefer.png",
  flatbed: "/images/trucks/official/official-flatbed.png",
} as const;

const KEY_LABELS: Record<FleetIndicatorKey, { ar: string; en: string }> = {
  speed: { ar: "السرعة", en: "Speed" },
  fuel: { ar: "الوقود", en: "Fuel" },
  load: { ar: "الحمولة", en: "Load" },
  eta: { ar: "الوصول", en: "ETA" },
  engine: { ar: "المحرك", en: "Engine" },
  distance: { ar: "المسافة", en: "Distance" },
};

export function PhotoFleetHero({ vehicle, onNav }: PhotoFleetHeroProps) {
  const { t } = useSettings();
  const snapshot = useMemo(() => buildFleetIndicatorSnapshot(vehicle), [vehicle]);
  const [selectedKey, setSelectedKey] = useState<FleetIndicatorKey>("load");
  const [imageOpen, setImageOpen] = useState(false);
  const selectedIndicator = snapshot.indicators.find((item) => item.key === selectedKey) ?? snapshot.indicators[0];
  const type = normalizeVehicleType(vehicle.body);
  const meta = getVehicleTypeMeta(type);
  const image = vehicle.customImage || PHOTO_BY_TYPE[type];

  return (
    <section className="overflow-hidden rounded-hero border border-border-subtle bg-surface-1">
      <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,.7fr)]">
        <div className="relative min-h-[390px] overflow-hidden bg-[#0c121b] sm:min-h-[470px]">
          <img src={image} alt={`${vehicle.brand} ${vehicle.model} — ${meta.arabicName}`} className="absolute inset-0 h-full w-full object-contain p-4 sm:p-8" loading="eager" referrerPolicy="no-referrer" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070b12]/85 via-transparent to-[#070b12]/15" />
          <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-2 p-4 sm:p-5">
            <div className="rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-micro font-bold tracking-[.14em] text-white backdrop-blur">EJAZ · LIVE PHOTO CONTROL</div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setImageOpen(true)} className="min-h-10 rounded-full border border-white/15 bg-black/45 px-3 text-micro font-bold text-white backdrop-blur hover:bg-black/65 focus:outline-none focus:ring-2 focus:ring-brand">{t("Expand photo", "تكبير الصورة")}</button>
              <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-micro font-semibold text-emerald-300 backdrop-blur">{vehicle.status === "active" ? t("ACTIVE", "نشطة") : vehicle.status === "waiting" ? t("WAITING", "انتظار") : t("INACTIVE", "غير نشطة")}</div>
            </div>
          </div>

          {snapshot.indicators.map((indicator) => {
            const position = getPhotoIndicatorPosition(indicator.key);
            const selected = indicator.key === selectedKey;
            const warning = indicator.tone === "warning";
            return (
              <button key={indicator.key} type="button" aria-pressed={selected} aria-label={`${KEY_LABELS[indicator.key].ar}: ${indicator.value}`} onClick={() => setSelectedKey(indicator.key)} className={`absolute z-10 min-w-[112px] rounded-2xl border px-3 py-2 text-start shadow-lg backdrop-blur-md transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-brand ${selected ? "border-brand bg-brand/15 ring-1 ring-brand/50" : warning ? "border-status-waiting/50 bg-black/65" : "border-white/15 bg-black/60"}`} style={{ left: `${position.x}%`, top: `${position.y}%`, transform: position.anchor === "right" ? "translateX(-100%)" : undefined }}>
                <span className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.1em] text-white/60">{t(KEY_LABELS[indicator.key].en, KEY_LABELS[indicator.key].ar)}</span><span className={`h-1.5 w-1.5 rounded-full ${warning ? "bg-amber-400" : selected ? "bg-brand" : "bg-emerald-400"}`} /></span>
                <span className="mt-0.5 block text-sm font-black tabular-nums text-white">{indicator.value}</span>
              </button>
            );
          })}

          <div className="absolute inset-x-4 bottom-4 z-10 flex flex-wrap items-end justify-between gap-3 sm:inset-x-5 sm:bottom-5">
            <div className="max-w-[70%] rounded-2xl border border-white/10 bg-black/55 p-3 backdrop-blur-md"><div className="text-micro font-semibold text-white/55">{meta.englishName}</div><div className="mt-0.5 text-section-title font-black text-white">{vehicle.brand} {vehicle.model}</div><div className="mt-1 text-micro text-white/70">{vehicle.plate} · {vehicle.from} → {vehicle.to}</div></div>
            <button type="button" onClick={() => onNav("tracking")} className="min-h-11 rounded-full bg-brand px-4 text-label font-bold text-on-brand shadow-lg transition hover:brightness-110">{t("Open tracking", "فتح التتبع")}</button>
          </div>
        </div>

        <aside className="flex flex-col border-t border-border-subtle bg-surface-1 p-4 sm:p-5 lg:border-t-0 lg:border-s lg:p-6">
          <div className="text-micro font-bold uppercase tracking-[.14em] text-text-muted">{t("Selected indicator", "المؤشر المحدد")}</div>
          <div className="mt-2 rounded-panel border border-brand/20 bg-brand/5 p-4"><div className="text-label font-semibold text-text-secondary">{t(selectedIndicator.labelEn, selectedIndicator.labelAr)}</div><div className="mt-1 text-hero-sm font-black tabular-nums text-text-primary">{selectedIndicator.value}</div><div className="mt-2 text-micro leading-5 text-text-secondary">{t(selectedIndicator.hintEn, selectedIndicator.hintAr)}</div><div className="mt-2 text-[10px] uppercase tracking-[.12em] text-text-muted">{t("Source: saved vehicle record", "المصدر: بيانات المركبة المحفوظة")}</div></div>

          <div className="mt-4 grid grid-cols-2 gap-2">{snapshot.indicators.map((indicator) => <button key={indicator.key} type="button" onClick={() => setSelectedKey(indicator.key)} className={`min-h-12 rounded-xl border px-3 text-start transition ${selectedKey === indicator.key ? "border-brand bg-brand/10" : "border-border-subtle bg-surface-2 hover:border-brand/30"}`}><span className="block text-micro text-text-muted">{t(indicator.labelEn, indicator.labelAr)}</span><span className="mt-0.5 block text-label font-bold tabular-nums text-text-primary">{indicator.value}</span></button>)}</div>

          <div className="mt-auto grid gap-2 pt-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><button type="button" onClick={() => onNav("fleet")} className="min-h-11 rounded-xl border border-border-subtle bg-surface-2 px-3 text-label font-semibold text-text-primary hover:border-brand/30">{t("Fleet", "الأسطول")}</button><button type="button" onClick={() => onNav("repair")} className="min-h-11 rounded-xl border border-border-subtle bg-surface-2 px-3 text-label font-semibold text-text-primary hover:border-brand/30">{t("Maintenance", "الصيانة")}</button></div>
        </aside>
      </div>

      {imageOpen && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t("Vehicle photo", "صورة المركبة")}><div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-hero border border-white/10 bg-[#0b111a]"><div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3"><div className="min-w-0"><div className="truncate text-label font-bold text-white">{vehicle.brand} {vehicle.model}</div><div className="truncate text-micro text-white/60">{vehicle.plate} · {meta.arabicName}</div></div><button type="button" onClick={() => setImageOpen(false)} className="min-h-10 rounded-full border border-white/15 px-4 text-label font-semibold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand">{t("Close", "إغلاق")}</button></div><div className="min-h-0 overflow-auto p-3 sm:p-6"><img src={image} alt={`${vehicle.brand} ${vehicle.model} — ${meta.arabicName}`} className="mx-auto max-h-[76vh] w-full object-contain" /></div></div></div>}
    </section>
  );
}
