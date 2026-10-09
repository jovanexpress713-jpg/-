import { useMemo, useState } from "react";
import { cn } from "../../utils/cn";
import { useSettings } from "../../settings";
import type { Driver } from "../../data/types";
import type { Trip } from "../../state/fleetStore";
import { IconSearch, IconUpload } from "../Icons";
import { TruckTypeAvatar, TruckTypeBadge } from "../TruckTypeIcon";
import { CARGO_LABEL, GROUP_TONE, STATUS_LABEL, formatEta, statusGroup, type StatusGroup } from "./shared";

interface Props {
  trips: Trip[];
  drivers: Driver[];
  selectedId: string;
  group: StatusGroup | "all";
  onGroup: (g: StatusGroup | "all") => void;
  onSelect: (id: string) => void;
  onToast: (text: string, sub?: string) => void;
}

export function ActivitiesTable({ trips, drivers, selectedId, group, onGroup, onSelect, onToast }: Props) {
  const { t } = useSettings();
  const [query, setQuery] = useState("");
  const [cargo, setCargo] = useState("all");

  const driverName = (id: string) => drivers.find((d) => d.id === id)?.name ?? "—";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips.filter((tr) => {
      if (group !== "all" && statusGroup(tr.status) !== group) return false;
      if (cargo !== "all" && tr.cargoType !== cargo) return false;
      if (!q) return true;
      return `${tr.tripNumber} ${tr.shipper} ${tr.consignee} ${tr.originCity} ${tr.destinationCity} ${driverName(tr.driverId)}`
        .toLowerCase()
        .includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips, drivers, query, group, cargo]);

  const exportCsv = () => {
    const header = ["Trip", "Shipper", "Driver", "Route", "Cargo", "Tons", "Progress %", "Status"];
    const lines = rows.map((tr) =>
      [tr.tripNumber, tr.shipper, driverName(tr.driverId), `${tr.originCity} - ${tr.destinationCity}`, tr.cargoType, tr.cargoWeightTons, tr.progressPct, tr.status]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shipments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast(t("Export ready", "تم التصدير"), t(`${rows.length} shipments exported to CSV`, `تم تصدير ${rows.length} شحنة بصيغة CSV`));
  };

  return (
    <section className="card animate-fade-up overflow-hidden p-0" style={{ animationDelay: "300ms" }}>
      <div className="flex flex-wrap items-center gap-3 px-5 pt-5 pb-4">
        <h2 className="me-auto text-page-title font-semibold text-text-primary">{t("Activities", "النشاطات")}</h2>

        <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-full border border-border-subtle bg-surface-2 px-3 py-2 sm:max-w-[280px]">
          <IconSearch size={14} />
          <span className="sr-only">{t("Search orders", "ابحث في الطلبات")}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search order, driver, city…", "ابحث برقم الطلب أو السائق أو المدينة…")}
            className="w-full bg-transparent text-label-lg text-text-primary outline-none placeholder:text-text-muted"
          />
        </label>

        <select
          aria-label={t("Status filter", "فلتر الحالة")}
          value={group}
          onChange={(e) => onGroup(e.target.value as StatusGroup | "all")}
          className="rounded-full border border-border-subtle bg-surface-2 px-3 py-2 text-label-lg text-text-secondary outline-none"
        >
          <option value="all">{t("All Status", "كل الحالات")}</option>
          <option value="pending">{t("Pending", "قيد التجهيز")}</option>
          <option value="transit">{t("In Transit", "على الطريق")}</option>
          <option value="delivered">{t("Delivered", "تم التسليم")}</option>
          <option value="cancelled">{t("Cancelled", "ملغاة")}</option>
        </select>

        <select
          aria-label={t("Cargo filter", "فلتر نوع الحمولة")}
          value={cargo}
          onChange={(e) => setCargo(e.target.value)}
          className="rounded-full border border-border-subtle bg-surface-2 px-3 py-2 text-label-lg text-text-secondary outline-none"
        >
          <option value="all">{t("All Types", "كل الأنواع")}</option>
          {Object.entries(CARGO_LABEL).map(([id, l]) => (
            <option key={id} value={id}>
              {t(l[0], l[1])}
            </option>
          ))}
        </select>

        <button onClick={exportCsv} className="btn-ghost gap-1.5 px-3 text-label-lg">
          <IconUpload size={14} />
          {t("Export", "تصدير")}
        </button>
      </div>

      <div className="scroll-thin overflow-x-auto">
        <table className="w-full text-label-lg" style={{ minWidth: 820 }}>
          <thead>
            <tr className="bg-surface-4 text-start text-label text-text-muted">
              {[t("Order ID", "رقم الطلب"), t("Shipper", "الشاحن"), t("Driver", "السائق"), t("Route", "المسار"), t("Load", "الحمولة"), t("Progress", "التقدم"), t("ETA", "الوصول"), t("Status", "الحالة")].map((h) => (
                <th key={h} scope="col" className="px-5 py-3 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-text-muted">
                  {t("No shipments match these filters.", "لا توجد شحنات تطابق الفلاتر.")}
                </td>
              </tr>
            )}
            {rows.map((tr, i) => {
              const g = statusGroup(tr.status);
              const sel = tr.id === selectedId;
              return (
                <tr
                  key={tr.id}
                  onClick={() => onSelect(tr.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(tr.id)}
                  tabIndex={0}
                  aria-selected={sel}
                  style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                  className={cn(
                    "animate-fade-up cursor-pointer border-t border-border-subtle transition-colors outline-none hover:bg-surface-3 focus-visible:bg-surface-3",
                    sel && "bg-brand/8",
                  )}
                >
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2 font-semibold tabular-nums text-text-primary">
                      {sel && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                      <TruckTypeAvatar truckType={tr.cargoType} size={28} iconSize={15} showBadge />
                      <span>{tr.tripNumber}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-text-secondary">
                    <span className="rounded-full bg-surface-4 px-2.5 py-1 text-label">{tr.shipper}</span>
                  </td>
                  <td className="px-5 py-3 text-text-primary">{driverName(tr.driverId)}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-text-secondary">
                    {tr.originCity} → {tr.destinationCity}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-text-secondary whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <TruckTypeBadge truckType={tr.cargoType} size={12} />
                      <span className="text-label text-text-muted">{tr.cargoWeightTons.toFixed(1)} t</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-5">
                        <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${tr.progressPct}%` }} />
                      </div>
                      <span className="tabular-nums text-text-muted">{Math.round(tr.progressPct)}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap tabular-nums text-text-secondary">{formatEta(tr.etaMinutes, t)}</td>
                  <td className="px-5 py-3">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label font-semibold whitespace-nowrap", GROUP_TONE[g])}>
                      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", g === "transit" && "animate-pulse-dot")} />
                      {t(STATUS_LABEL[tr.status][0], STATUS_LABEL[tr.status][1])}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
