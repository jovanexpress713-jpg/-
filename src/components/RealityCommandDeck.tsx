import { useMemo, useState } from "react";
import type { Vehicle } from "../data/types";
import { getVehicleTypeMeta, normalizeVehicleType, type CanonicalVehicleTypeId } from "../data/vehicleTypes";
import { buildFleetIndicatorSnapshot } from "../data/interactiveIndicators";
import { useSettings } from "../settings";
import { PhotoFleetHero } from "./PhotoFleetHero";

interface RealityCommandDeckProps {
  vehicles: Vehicle[];
  selectedId: string;
  onSelect: (id: string) => void;
  onNav: (key: string) => void;
  onToast: (text: string, sub?: string) => void;
}

type FocusType = "all" | CanonicalVehicleTypeId;

const FILTERS: Array<{ id: FocusType; ar: string; en: string }> = [
  { id: "all", ar: "الكل", en: "All" },
  { id: "curtain", ar: "ستارة", en: "Curtainsider" },
  { id: "dry", ar: "جاف", en: "Dry" },
  { id: "reefer", ar: "براد", en: "Refrigerated" },
  { id: "flatbed", ar: "سطحة", en: "Flatbed" },
];

function Metric({ label, value, hint, warning = false }: { label: string; value: string | number; hint: string; warning?: boolean }) {
  return (
    <div className={`rounded-panel border p-3 ${warning ? "border-status-waiting/30 bg-status-waiting/5" : "border-border-subtle bg-surface-1"}`}>
      <div className="truncate text-micro font-semibold uppercase tracking-[.13em] text-text-muted">{label}</div>
      <div className={`mt-1 text-hero-sm font-black tabular-nums ${warning ? "text-status-waiting" : "text-text-primary"}`}>{value}</div>
      <div className="mt-1 truncate text-micro text-text-secondary">{hint}</div>
    </div>
  );
}

export function RealityCommandDeck({ vehicles, selectedId, onSelect, onNav }: RealityCommandDeckProps) {
  const { t } = useSettings();
  const [focusType, setFocusType] = useState<FocusType>("all");
  const selected = vehicles.find((vehicle) => vehicle.id === selectedId) ?? vehicles[0];

  const filtered = useMemo(
    () => focusType === "all" ? vehicles : vehicles.filter((vehicle) => normalizeVehicleType(vehicle.body) === focusType),
    [focusType, vehicles],
  );

  const fleetStats = useMemo(() => {
    const snapshots = vehicles.map(buildFleetIndicatorSnapshot);
    const moving = vehicles.filter((vehicle) => vehicle.status === "active" && Number(vehicle.speed) > 0).length;
    const attention = snapshots.filter((snapshot) => snapshot.attentionCount > 0).length;
    const utilization = snapshots.length ? snapshots.reduce((sum, snapshot) => sum + snapshot.utilizationPercent, 0) / snapshots.length : 0;
    return { moving, attention, utilization };
  }, [vehicles]);

  if (!selected) {
    return (
      <div className="grid min-h-[360px] place-items-center rounded-panel border border-border-subtle bg-surface-1 p-8 text-center">
        <div>
          <h2 className="text-section-title font-bold text-text-primary">{t("Fleet is ready", "الأسطول جاهز")}</h2>
          <p className="mt-2 text-label-lg text-text-muted">{t("Add a vehicle to open the photo command center.", "أضف شاحنة لفتح مركز القيادة بالصور.")}</p>
          <button type="button" onClick={() => onNav("fleet")} className="btn-primary mt-5 min-h-11 px-5">{t("Open fleet", "فتح الأسطول")}</button>
        </div>
      </div>
    );
  }

  const selectedMeta = getVehicleTypeMeta(selected.body);

  return (
    <div className="space-y-4 pb-3">
      <PhotoFleetHero vehicle={selected} onNav={onNav} />

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Metric label={t("Fleet", "الأسطول")} value={vehicles.length} hint={t("registered vehicles", "مركبات مسجلة")} />
        <Metric label={t("Moving", "متحركة")} value={fleetStats.moving} hint={t("active vehicles", "مركبات نشطة")} />
        <Metric label={t("Utilization", "الاستغلال")} value={`${Math.round(fleetStats.utilization)}%`} hint={t("average recorded load", "متوسط الحمولة المسجلة")} />
        <Metric label={t("Attention", "تحتاج متابعة")} value={fleetStats.attention} hint={t("recorded warnings", "تنبيهات مسجلة")} warning={fleetStats.attention > 0} />
      </section>

      <section className="rounded-panel border border-border-subtle bg-surface-1 p-4 lg:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-micro font-bold uppercase tracking-[.14em] text-text-muted">{t("Fleet photo library", "مكتبة صور الأسطول")}</div>
            <h2 className="mt-1 text-section-title font-bold text-text-primary">{t("Choose a vehicle and inspect its indicators", "اختر الشاحنة وافحص مؤشراتك التفاعلية")}</h2>
            <p className="mt-1 text-label text-text-secondary">{t("Photos are the primary view now. 3D assets stay disconnected until the real models are supplied.", "الصور هي الواجهة الأساسية الآن. النماذج ثلاثية الأبعاد تبقى غير مفعلة حتى تزويد الأصول الحقيقية.")}</p>
          </div>
          <button type="button" onClick={() => onNav("fleet")} className="min-h-10 rounded-full border border-border-subtle bg-surface-2 px-4 text-label font-semibold text-text-secondary hover:border-brand/30">{t("Manage fleet", "إدارة الأسطول")}</button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setFocusType(filter.id)}
              className={`min-h-10 rounded-full border px-3 text-label font-semibold transition ${focusType === filter.id ? "border-brand bg-brand text-on-brand" : "border-border-subtle bg-surface-2 text-text-secondary hover:border-brand/30"}`}
            >
              {t(filter.en, filter.ar)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-4 rounded-panel border border-dashed border-border-subtle p-8 text-center text-label text-text-muted">{t("No vehicles in this category.", "لا توجد مركبات في هذه الفئة.")}</div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((vehicle) => {
              const type = normalizeVehicleType(vehicle.body);
              const meta = getVehicleTypeMeta(type);
              const snapshot = buildFleetIndicatorSnapshot(vehicle);
              const isSelected = vehicle.id === selected.id;
              const image = vehicle.customImage || meta.officialImage;
              return (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => onSelect(vehicle.id)}
                  className={`group overflow-hidden rounded-panel border text-start transition duration-200 ${isSelected ? "border-brand/50 bg-brand/5 ring-1 ring-brand/20" : "border-border-subtle bg-surface-2 hover:-translate-y-0.5 hover:border-brand/30"}`}
                >
                  <div className="relative h-40 overflow-hidden bg-[#101722]">
                    <img src={image} alt={`${vehicle.brand} ${vehicle.model} — ${meta.arabicName}`} loading="lazy" className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.03]" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
                      <div className="text-micro font-semibold text-white/65">{meta.englishName}</div>
                      <div className="text-label-lg font-bold text-white">{vehicle.brand} {vehicle.model}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 p-3">
                    <div><div className="text-micro text-text-muted">{t("Speed", "السرعة")}</div><div className="text-label font-bold tabular-nums text-text-primary">{snapshot.indicators[0].value}</div></div>
                    <div><div className="text-micro text-text-muted">{t("Load", "الحمولة")}</div><div className="text-label font-bold tabular-nums text-text-primary">{snapshot.indicators[2].value}</div></div>
                    <div><div className="text-micro text-text-muted">{t("Fuel", "الوقود")}</div><div className={`text-label font-bold tabular-nums ${snapshot.indicators[1].tone === "warning" ? "text-status-waiting" : "text-text-primary"}`}>{snapshot.indicators[1].value}</div></div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border-subtle px-3 py-2 text-micro text-text-secondary">
                    <span>{vehicle.plate}</span>
                    <span>{snapshot.indicators[3].value}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-panel border border-border-subtle bg-surface-1 p-4 lg:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-micro font-bold uppercase tracking-[.14em] text-text-muted">{t("Selected vehicle", "المركبة المحددة")}</div>
            <h3 className="mt-1 text-section-title font-bold text-text-primary">{selected.brand} {selected.model} · {selected.plate}</h3>
            <p className="mt-1 text-label text-text-secondary">{selected.from} → {selected.to} · {selectedMeta.arabicName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNav("tracking")} className="btn-primary min-h-11 px-4">{t("Tracking", "التتبع")}</button>
            <button type="button" onClick={() => onNav("repair")} className="btn-secondary min-h-11 px-4">{t("Maintenance", "الصيانة")}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
