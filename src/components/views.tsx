import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { BODY_TYPES, PHOTO_REPORTS } from "../data/catalog";
import type { Vehicle } from "../data/types";
import {
  IconArrowRight,
  IconCheck,
  IconPin,
  IconRepair,
  IconStar,
} from "./Icons";
import { StatusChip } from "./StatusChip";
import { TruckImage } from "./TruckImage";
import { TruckTypeAvatar } from "./TruckTypeIcon";
import { getVehicleTypeMeta } from "../data/vehicleTypes";

interface ViewProps {
  vehicles: Vehicle[];
  onSelect: (id: string) => void;
  onPartner: (p: string) => void;
  onToast: (text: string, sub?: string) => void;
}

function Panel({
  title,
  hint,
  children,
  action,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="animate-fade-up card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-section-title font-medium text-text-primary">{title}</h3>
          {hint && <p className="mt-0.5 text-label text-text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function DashboardView({ vehicles, onSelect, onToast }: ViewProps) {
  const { t } = useSettings();
  const active = vehicles.filter((v) => v.status === "active");
  const waiting = vehicles.filter((v) => v.status === "waiting");
  const util =
    vehicles.reduce((s, v) => s + (v.load / v.maxLoad) * 100, 0) / (vehicles.length || 1);
  const miles = vehicles.reduce((s, v) => s + v.milesLeft, 0);

  const stats: [string, string, string | number, string][] = [
    [t("Total shipments", "إجمالي الشحنات"), t("across 6 brands", "ضمن ٦ ماركات"), vehicles.length, ""],
    [t("On Route", "على الطريق"), t("live telemetry", "بيانات مباشرة"), active.length, ""],
    [t("Waiting", "في الانتظار"), t("yard & paperwork", "الساحة والإجراءات"), waiting.length, ""],
    [t("Fleet utilisation", "استغلال الأسطول"), t("payload average", "متوسط الحمولة"), `${util.toFixed(0)}%`, ""],
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map(([k, s, v], i) => (
          <button
            key={k}
            onClick={() => onToast(k, `${v} · ${s}`)}
            style={{ animationDelay: `${i * 45}ms` }}
            className="animate-fade-up card p-4 text-start transition-all duration-200 hover:bg-surface-4 active:scale-[0.98]"
          >
            <div className="text-label tracking-wide text-text-muted uppercase">{k}</div>
            <div className="mt-2 text-hero leading-none font-medium tabular-nums text-text-primary">
              {v}
            </div>
            <div className="mt-2 text-label text-text-secondary">{s}</div>
          </button>
        ))}
      </div>

      <Panel
        title={t("Latest activity", "آخر الأنشطة")}
        hint={t(
          `${miles.toLocaleString()} miles still to run`,
          `ما زال يتبقى ${miles.toLocaleString()} ميل`,
        )}
      >
        <div className="space-y-1">
          {vehicles.slice(0, 5).map((v) => (
            <button
              key={v.id}
              onClick={() => onSelect(v.id)}
              className="flex w-full items-center gap-3 rounded-chip px-2 py-2.5 text-start transition-colors duration-200 hover:bg-surface-4"
            >
              <TruckTypeAvatar truckType={v.body} size={36} iconSize={18} showBadge />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body tabular-nums text-text-primary">
                  {v.shipment} · {getVehicleTypeMeta(v.body).arabicName}
                </span>
                <span className="block truncate text-label text-text-muted">
                  {v.from} → {v.to} · {v.partner}
                </span>
              </span>
              <StatusChip status={v.status} />
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function ChatsView({ vehicles, onSelect, onToast }: ViewProps) {
  const { t } = useSettings();
  const threads = vehicles.filter((v) => v.comments.length > 0).slice(0, 8);
  return (
    <Panel
      title={t("Chats", "المحادثات")}
      hint={t("Driver channels · replies under 2 minutes", "قنوات السائقين · الرد خلال دقيقتين")}
    >
      <div className="space-y-1">
        {threads.map((v) => {
          const last = v.comments[v.comments.length - 1];
          return (
            <button
              key={v.id}
              onClick={() => {
                onSelect(v.id);
                onToast(t("Opened thread", "تم فتح المحادثة"), v.driver.name);
              }}
              className="flex w-full items-center gap-3 rounded-chip px-2 py-2.5 text-start transition-colors duration-200 hover:bg-surface-4"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-5 text-label font-semibold text-text-primary">
                {v.driver.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-body font-medium text-text-primary">
                    {v.driver.name}
                  </span>
                  <span className="text-label tabular-nums text-text-muted">{last.time}</span>
                </span>
                <span className="block truncate text-label text-text-muted">{last.text}</span>
              </span>
              <span className="badge bg-brand/15 text-brand">{v.shipment.slice(0, 2)}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

export function PartnersView({ vehicles, onPartner, onToast }: ViewProps) {
  const { t } = useSettings();
  const groups = new Map<string, Vehicle[]>();
  vehicles.forEach((v) => {
    const list = groups.get(v.partner) ?? [];
    list.push(v);
    groups.set(v.partner, list);
  });

  return (
    <div className="grid grid-cols-2 gap-3">
      {[...groups.entries()].map(([name, list], i) => (
        <button
          key={name}
          onClick={() => {
            onPartner(name);
            onToast(t("Filtered by partner", "تمت الفلترة حسب الشريك"), name);
          }}
          style={{ animationDelay: `${i * 45}ms` }}
          className="animate-fade-up card p-4 text-start transition-all duration-200 hover:bg-surface-4 active:scale-[0.98]"
        >
          <div className="flex items-start justify-between">
            <span className="grid h-9 w-9 place-items-center rounded-chip bg-surface-4 text-label font-semibold text-brand">
              {name.slice(0, 2).toUpperCase()}
            </span>
            <span className="badge bg-surface-5 text-text-secondary">{list.length}</span>
          </div>
          <div className="mt-3 text-card-title font-medium text-text-primary">{name}</div>
          <div className="mt-1 text-label tabular-nums text-text-muted">
            {list.reduce((s, v) => s + v.load, 0).toFixed(1)} {t("t payload", "طن حمولة")} ·{" "}
            {list.filter((v) => v.status === "active").length} {t("on route", "على الطريق")}
          </div>
        </button>
      ))}
    </div>
  );
}

export function AnalysisView({ vehicles }: ViewProps) {
  const { t } = useSettings();
  const rows = BODY_TYPES.map((b) => {
    const list = vehicles.filter((v) => v.body === b.id);
    const util = list.length
      ? list.reduce((s, v) => s + (v.load / v.maxLoad) * 100, 0) / list.length
      : 0;
    return { ...b, count: list.length, util };
  });
  const max = Math.max(...rows.map((r) => r.util), 1);

  return (
    <div className="space-y-3">
      <Panel
        title={t("Utilisation by body type", "الاستغلال حسب نوع الهيكل")}
        hint={t("Average payload fill across the fleet", "متوسط تعبئة الحمولة عبر الأسطول")}
      >
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3">
              <span className="w-[124px] shrink-0 truncate text-label-lg text-text-secondary">
                {t(r.label[0], r.label[1])}
              </span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-4">
                <span
                  className="stripes block h-full rounded-full transition-[width] duration-1000 ease-out"
                  style={{ width: `${(r.util / max) * 100}%` }}
                />
              </span>
              <span className="w-14 text-end text-label-lg tabular-nums text-text-primary">
                {r.util.toFixed(0)}%
              </span>
              <span className="w-8 text-end text-label tabular-nums text-text-muted">
                {r.count}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-3 gap-3">
        {[
          [t("On-time rate", "نسبة الالتزام"), "92%"],
          [
            t("Avg. fuel", "متوسط الوقود"),
            `${(vehicles.reduce((s, v) => s + v.fuel, 0) / vehicles.length).toFixed(0)}%`,
          ],
          [t("Fleet size", "حجم الأسطول"), vehicles.length],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <div className="text-label tracking-wide text-text-muted uppercase">{k}</div>
            <div className="mt-2 text-hero-sm font-medium tabular-nums text-text-primary">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HistoryView({ vehicles, onSelect }: ViewProps) {
  const { t } = useSettings();
  const events = vehicles.slice(0, 9).map((v, i) => ({
    id: v.id,
    time: `${String(7 + i).padStart(2, "0")}:${String((i * 11) % 60).padStart(2, "0")}`,
    title: v.stops[0].name,
    state: v.status,
    sub: `${v.from} → ${v.to} · ${v.partner}`,
  }));

  return (
    <Panel
      title={t("History", "السجل")}
      hint={t("Last 24 hours of fleet events", "أحداث الأسطول خلال ٢٤ ساعة")}
    >
      <div className="relative space-y-4 ps-5">
        <span className="absolute top-1 bottom-1 start-[5px] w-px bg-border-subtle" />
        {events.map((e) => (
          <button
            key={e.id}
            onClick={() => onSelect(e.id)}
            className="relative block w-full text-start transition-opacity duration-200 hover:opacity-80"
          >
            <span className="absolute top-1.5 -start-5 h-[11px] w-[11px] rounded-full border-2 border-surface-3 bg-brand" />
            <div className="flex items-baseline gap-2">
              <span className="text-label tabular-nums text-text-muted">{e.time}</span>
              <span className="text-body text-text-primary">
                {t(
                  e.state === "active"
                    ? `${e.title} · departed`
                    : e.state === "waiting"
                      ? `${e.title} · waiting`
                      : `${e.title} · parked`,
                  e.state === "active"
                    ? `${e.title} · غادرت`
                    : e.state === "waiting"
                      ? `${e.title} · في الانتظار`
                      : `${e.title} · متوقفة`,
                )}
              </span>
            </div>
            <div className="text-label text-text-muted">{e.sub}</div>
          </button>
        ))}
      </div>
    </Panel>
  );
}

export function TrucksView({ vehicles, onSelect }: ViewProps) {
  const { t } = useSettings();
  return (
    <Panel title={t("Trucks", "الشاحنات")} hint={t(`${vehicles.length} vehicles in the fleet`, `${vehicles.length} مركبة في الأسطول`)}>
      <div className="space-y-1.5">
        {vehicles.map((v) => {
          const meta = getVehicleTypeMeta(v.body);
          return (
            <button
              key={v.id}
              onClick={() => onSelect(v.id)}
              className="flex w-full items-center gap-3.5 rounded-inner p-2.5 text-start transition-colors duration-200 hover:bg-surface-4 border border-border-subtle/40 bg-surface-2/40"
            >
              {/* Circular Avatar matching user's reference */}
              <TruckTypeAvatar truckType={v.body} size={44} iconSize={22} showBadge />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-card-title text-text-primary truncate">
                    {v.brand} {v.model}
                  </span>
                  <span className="font-mono text-label-lg font-bold text-brand tabular-nums shrink-0">
                    {v.plate}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-label text-text-muted">
                  <span className="font-semibold text-text-secondary">{meta.arabicName} ({meta.englishName})</span>
                  <span>·</span>
                  <span className="truncate">{v.partner}</span>
                  <span>·</span>
                  <span className="tabular-nums font-mono">{v.load} / {v.maxLoad} {t("tons", "طن")}</span>
                </div>
              </div>
              <StatusChip status={v.status} />
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

export function CargosView({ vehicles, onSelect }: ViewProps) {
  const { t } = useSettings();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {vehicles.map((v, i) => {
        const meta = getVehicleTypeMeta(v.body);
        return (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            style={{ animationDelay: `${i * 45}ms` }}
            className="animate-fade-up card p-3.5 text-start transition-all duration-200 hover:bg-surface-4 active:scale-[0.98] flex flex-col justify-between"
          >
            <div className="flex items-start gap-3">
              {/* Circular Truck Type Avatar */}
              <TruckTypeAvatar truckType={v.body} size={42} iconSize={22} showBadge />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body font-mono font-bold text-text-primary tabular-nums">
                    {v.shipment}
                  </span>
                  <StatusChip status={v.status} />
                </div>
                <div className="mt-0.5 text-label-lg text-text-muted font-medium truncate">
                  {v.partner} · <span style={{ color: meta.accentColor }}>{meta.arabicName}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-border-subtle pt-2">
              <div className="flex items-center justify-between text-label tabular-nums text-text-secondary">
                <span>
                  {v.load} / {v.maxLoad} {t("t", "طن")}
                </span>
                <span className="font-bold font-mono" style={{ color: meta.accentColor }}>
                  {((v.load / v.maxLoad) * 100).toFixed(0)}%
                </span>
              </div>
              <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-surface-4">
                <span
                  className="stripes block h-full rounded-full"
                  style={{ width: `${(v.load / v.maxLoad) * 100}%`, backgroundColor: meta.accentColor }}
                />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function RepairView({ vehicles, onSelect, onToast }: ViewProps) {
  const { t } = useSettings();
  const list = vehicles.filter((v) => v.status !== "active");
  return (
    <Panel
      title={t("Repair & Maintenance", "الصيانة والورشة")}
      hint={t(`${list.length} vehicles off the road`, `${list.length} مركبة خارج الخدمة`)}
      action={
        <button
          onClick={() => onToast(t("Service request sent", "تم إرسال طلب الصيانة"), t("Workshop · Riyadh Yard", "الورشة · ساحة الرياض"))}
          className="btn-ghost"
        >
          <IconRepair size={15} />
          {t("Schedule", "جدولة")}
        </button>
      }
    >
      <div className="space-y-1.5">
        {list.map((v) => {
          const meta = getVehicleTypeMeta(v.body);
          return (
            <button
              key={v.id}
              onClick={() => onSelect(v.id)}
              className="flex w-full items-center gap-3.5 rounded-inner p-2.5 text-start transition-colors duration-200 hover:bg-surface-4 border border-border-subtle/40 bg-surface-2/40"
            >
              <TruckTypeAvatar truckType={v.body} size={42} iconSize={22} showBadge />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="block truncate text-body font-bold text-text-primary">
                    {v.shipment} · {v.plate}
                  </span>
                  <span className="font-semibold text-label" style={{ color: meta.accentColor }}>
                    {meta.arabicName}
                  </span>
                </div>
                <span className="block truncate text-label text-text-muted mt-0.5">
                  {v.stops[v.stops.length - 1]?.place || "الورشة المركزية"} · {v.model}
                </span>
              </div>
              <StatusChip status={v.status} />
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

export function DriversView({ vehicles, onSelect }: ViewProps) {
  const { t } = useSettings();
  return (
    <div className="grid grid-cols-2 gap-3">
      {vehicles.map((v, i) => (
        <button
          key={v.id}
          onClick={() => onSelect(v.id)}
          style={{ animationDelay: `${i * 45}ms` }}
          className="animate-fade-up card flex items-center gap-3 p-4 text-start transition-all duration-200 hover:bg-surface-4 active:scale-[0.98]"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-5 text-label-lg font-semibold text-text-primary">
            {v.driver.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-medium text-text-primary">
              {v.driver.name}
            </span>
            <span className="block truncate text-label tabular-nums text-text-muted">
              {v.driver.phone}
            </span>
            <span className="mt-1 flex items-center gap-1 text-label tabular-nums text-status-waiting">
              <IconStar size={11} />
              {v.driver.rating} · {v.driver.trips} {t("trips", "رحلة")}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function ReportsView({ onToast }: ViewProps) {
  const { t } = useSettings();
  return (
    <Panel
      title={t("Reports", "التقارير")}
      hint={t("Cargo photo reports from the field", "تقارير صور الشحنات من الميدان")}
      action={
        <button
          onClick={() => onToast(t("Report exported", "تم تصدير التقرير"), "PDF · 2.4 MB")}
          className="btn-ghost"
        >
          {t("Export", "تصدير")}
        </button>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {PHOTO_REPORTS.map((p) => (
          <div
            key={p.src}
            className="relative aspect-[4/3] overflow-hidden rounded-chip bg-surface-2"
          >
            <img src={p.src} alt={p.ar} className="h-full w-full object-cover" />
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
            <span className="pointer-events-none absolute inset-x-1.5 bottom-1.5 text-start text-label leading-tight text-white">
              {t(p.en, p.ar)}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function FleetStrip({
  vehicles,
  onSelect,
}: {
  vehicles: Vehicle[];
  onSelect: (id: string) => void;
}) {
  const { t } = useSettings();
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
        <IconPin size={15} className="text-brand" />
        <span className="text-label tracking-wide text-text-muted uppercase">
          {t(`Live fleet · ${vehicles.length} units`, `الأسطول الحي · ${vehicles.length} وحدة`)}
        </span>
      </div>
      <div className="scroll-thin flex gap-3 overflow-x-auto p-3">
        {vehicles.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            className="group w-[150px] shrink-0 rounded-chip bg-surface-2 p-2.5 text-start transition-all duration-200 hover:bg-surface-4 active:scale-95"
          >
            <span className="block overflow-hidden rounded-micro bg-black px-1">
              <TruckImage
                vehicle={v}
                alt=""
                className="h-10 w-full object-contain transition-transform duration-500 group-hover:scale-105"
              />
            </span>
            <div className="mt-1 truncate text-label tabular-nums text-text-primary">
              {v.shipment}
            </div>
            <div className="truncate text-micro text-text-muted">{v.model}</div>
            <div className="mt-1.5">
              <StatusChip status={v.status} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function RowLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-label-lg text-brand transition-opacity duration-200 hover:opacity-80"
    >
      {label}
      <IconArrowRight size={13} />
    </button>
  );
}

export function MiniCheck({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "grid h-5 w-5 place-items-center rounded-full",
        ok ? "bg-status-active/15 text-status-active" : "bg-surface-5 text-text-muted",
      )}
    >
      <IconCheck size={12} />
    </span>
  );
}
