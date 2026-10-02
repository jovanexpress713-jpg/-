import { useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import type { Vehicle } from "../data/types";
import { formatCountdown, liveOf, useElapsed, useTicker } from "../hooks";
import { MapPanel } from "../components/MapPanel";
import {
  IconArrowRight,
  IconBell,
  IconHome,
  IconOrders,
  IconPin,
  IconProfile,
  IconScan,
  IconSearch,
  IconTruck,
} from "../components/Icons";

interface Props {
  vehicles: Vehicle[];
  currentId: string;
  onOpen: (id: string) => void;
  onScan: () => void;
  tab: string;
  onTab: (t: string) => void;
}

export function HomeScreen({ vehicles, currentId, onOpen, onScan, tab, onTab }: Props) {
  const { t } = useSettings();
  const [q, setQ] = useState("");
  const now = useTicker(1000);
  const elapsed = useElapsed(now);
  const current = vehicles.find((v) => v.id === currentId) ?? vehicles[0];
  const live = liveOf(current, elapsed);

  const recent = vehicles
    .filter((v) => v.id !== current.id)
    .filter((v) => !q || v.shipment.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 4);

  const TABS: [string, string, typeof IconHome][] = [
    ["home", t("Home", "الرئيسية"), IconHome],
    ["orders", t("Orders", "الطلبات"), IconOrders],
    ["profile", t("Profile", "حسابي"), IconProfile],
  ];

  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-0">
      <div className="scroll-thin absolute inset-0 overflow-y-auto pb-24">
        <div className="px-5 pt-14 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand/20 text-[12px] font-semibold text-brand">
                NF
              </span>
              <div>
                <div className="text-[10.5px] text-text-muted">{t("Good morning", "صباح الخير")}</div>
                <div className="text-[13px] font-medium text-text-primary">
                  {t("Noura Al-Faisal", "نورة الفيصل")}
                </div>
              </div>
            </div>
            <button className="relative grid h-9 w-9 place-items-center rounded-full bg-surface-3 text-text-secondary transition-all duration-200 active:scale-90">
              <IconBell size={16} />
              <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-brand" />
            </button>
          </div>

          <h1 className="mt-6 text-[21px] leading-tight font-medium text-text-primary">
            {t("Track your Shipment", "تتبّع شحنتك")}
          </h1>

          <div className="mt-4 flex items-center gap-2.5">
            <div className="flex h-11 flex-1 items-center gap-2 rounded-[14px] bg-surface-2 px-3.5">
              <IconSearch size={16} className="shrink-0 text-text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("Shipment ID", "رقم الشحنة")}
                className="w-full bg-transparent text-[12.5px] text-text-primary outline-none"
              />
            </div>
            <button
              onClick={onScan}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-paper text-navy transition-all duration-200 hover:scale-105 active:scale-90"
              aria-label="Scan"
            >
              <IconScan size={19} />
            </button>
          </div>
        </div>

        <div className="relative rounded-t-[26px] bg-paper px-4 pt-2.5 pb-6 text-navy">
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-navy/15" />

          <div className="rounded-[18px] bg-navy p-4 text-white">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] tracking-[0.14em] text-white/55 uppercase">
                {t("Current Shipment", "الشحنة الحالية")}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-status-active">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-current" />
                {t("On Route", "على الطريق")}
              </span>
            </div>
            <div className="mt-2 text-[17px] font-semibold tabular-nums">{current.shipment}</div>
            <div className="text-[11.5px] text-white/65">
              {current.brand} {current.model} · {current.cab}
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-white/70">
              <IconPin size={13} className="text-brand" />
              {t("Near", "بالقرب من")} {current.stops[Math.min(1, current.stops.length - 1)].name} ·{" "}
              {Math.round(live.miles)} {t("mi to go", "ميل متبقي")}
            </div>

            <div className="mt-3 overflow-hidden rounded-[12px]">
              <MapPanel
                from={current.from}
                to={current.to}
                progress={live.progress}
                accent
                compact
                className="h-[92px]"
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-[10.5px] tabular-nums">
              <span className="text-white/55">{t("Arriving in", "الوصول خلال")}</span>
              <span className="font-semibold">{formatCountdown(live.etaSeconds)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-accent-2 transition-[width] duration-1000"
                style={{ width: `${live.progress}%` }}
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <span className="text-[13px] font-medium text-navy">
              {t("Recent Shipments", "الشحنات الأخيرة")}
            </span>
            <button className="text-[11px] text-accent-2">{t("See all", "عرض الكل")}</button>
          </div>

          <div className="mt-2 space-y-1.5">
            {recent.map((v) => (
              <button
                key={v.id}
                onClick={() => onOpen(v.id)}
                className="flex w-full items-center gap-3 rounded-[14px] bg-navy/8 p-2.5 text-start transition-all duration-200 active:scale-[0.98]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-navy text-white">
                  <IconTruck size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium tabular-nums text-navy">
                    {v.from} → {v.to}
                  </span>
                  <span className="block truncate text-[10.5px] tabular-nums text-navy/55">
                    {v.shipment} · {v.model}
                  </span>
                </span>
                <IconArrowRight size={15} className="shrink-0 text-navy/40" />
              </button>
            ))}
            {recent.length === 0 && (
              <div className="rounded-[14px] bg-navy/8 p-4 text-center text-[11px] text-navy/55">
                {t(`No shipment matches “${q}”`, `لا توجد شحنة مطابقة لـ “${q}”`)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-navy px-2 py-2">
        {TABS.map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => onTab(id)}
            className={cn(
              "grid h-9 w-12 place-items-center rounded-full transition-all duration-200 active:scale-90",
              tab === id ? "bg-accent-2/20 text-accent-2" : "text-white/45",
            )}
            aria-label={label}
          >
            <Icon size={17} />
          </button>
        ))}
      </div>
    </div>
  );
}
