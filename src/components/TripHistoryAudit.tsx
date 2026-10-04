import { useState, useMemo } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore, type AuditLog } from "../state/fleetStore";
import { useToast } from "./Toast";
import { TruckTypeIcon } from "./TruckTypeIcon";
import {
  IconHistory,
  IconSearch,
  IconCheck,
  IconDoc,
} from "./Icons";

interface TripHistoryAuditProps {
  onOpenTrip?: (tripId: string) => void;
}

export function TripHistoryAudit({ onOpenTrip }: TripHistoryAuditProps) {
  const { t, td } = useSettings();
  const toast = useToast();
  const { trips, trucks, drivers, auditLogs, selectTrip } = useFleetStore();

  const [activeTab, setActiveTab] = useState<"completed_trips" | "system_audit">("completed_trips");
  const [search, setSearch] = useState("");

  // Completed or arrived trips
  const historyTrips = useMemo(() => {
    return trips.filter((tr) => {
      const isPast = tr.status === "delivered" || tr.status === "completed" || tr.status === "cancelled" || tr.progressPct >= 90;
      if (!isPast) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        tr.tripNumber.toLowerCase().includes(q) ||
        tr.originCity.toLowerCase().includes(q) ||
        tr.destinationCity.toLowerCase().includes(q) ||
        tr.shipper.toLowerCase().includes(q)
      );
    });
  }, [trips, search]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        log.actor.toLowerCase().includes(q) ||
        log.actionAr.toLowerCase().includes(q) ||
        log.actionEn.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        (log.tripNumber && log.tripNumber.toLowerCase().includes(q))
      );
    });
  }, [auditLogs, search]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-0">
      {/* Header */}
      <header className="shrink-0 border-b border-border-subtle bg-surface-1 px-4 py-3.5 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-brand/12 text-brand">
              <IconHistory size={18} />
            </span>
            <div>
              <h1 className="text-[18px] font-bold text-text-primary lg:text-[20px]">
                {t("Trip Archive & Operational Audit Log", "سجل الرحلات المنجزة والتدقيق العملياتي")}
              </h1>
              <p className="text-[11.5px] text-text-secondary">
                {t(
                  "Permanent ledger of delivered shipments, POD confirmations, and security audit records",
                  "السجل التاريخي للشحنات المسلمة، إثباتات التسليم الرقمية، وسجل الحركات والتدقيق",
                )}
              </p>
            </div>
          </div>

          {/* Export Action */}
          <button
            onClick={() => {
              toast(t("Audit trail exported successfully", "تم تصدير سجل التدقيق والأرشيف بنجاح"), "PDF / Excel Ledger");
            }}
            className="btn-ghost py-1.5 px-3 text-[11.5px]"
          >
            <IconDoc size={14} />
            <span>{t("Export Ledger", "تصدير السجل الرسمي")}</span>
          </button>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-[10px] bg-surface-2 p-1 border border-border-subtle">
            <button
              onClick={() => setActiveTab("completed_trips")}
              className={cn(
                "rounded-[7px] px-3.5 py-1.5 text-[11.5px] font-semibold transition-all",
                activeTab === "completed_trips"
                  ? "bg-surface-4 text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {t("Delivered Trips Archive", "أرشيف الرحلات المسلمة")} ({historyTrips.length})
            </button>
            <button
              onClick={() => setActiveTab("system_audit")}
              className={cn(
                "rounded-[7px] px-3.5 py-1.5 text-[11.5px] font-semibold transition-all",
                activeTab === "system_audit"
                  ? "bg-surface-4 text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {t("Security & Operational Audit Log", "سجل التدقيق والعمليات")} ({auditLogs.length})
            </button>
          </div>

          <div className="relative min-w-[220px] flex-1 max-w-xs">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Filter archive or audit trail...", "بحث في الأرشيف وسجل التدقيق...")}
              className="w-full rounded-[8px] border border-border-subtle bg-surface-2 px-3 py-1.5 ps-8 text-[11.5px] text-text-primary placeholder:text-text-muted outline-none focus:border-brand"
            />
            <span className="absolute start-2.5 top-1/2 -translate-y-1/2 text-text-muted">
              <IconSearch size={13} />
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 scroll-thin">
        {activeTab === "completed_trips" ? (
          historyTrips.length === 0 ? (
            <div className="grid h-64 place-items-center rounded-[12px] border border-dashed border-border-subtle p-8 text-center">
              <div>
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-text-muted">
                  <IconHistory size={22} />
                </span>
                <p className="mt-3 text-[14px] font-semibold text-text-primary">
                  {t("No archived trips found matching your criteria", "لا توجد رحلات منجزة مطابقة لمعايير البحث")}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {historyTrips.map((tr) => {
                const truck = trucks.find((v) => v.id === tr.truckId);
                const driver = drivers.find((d) => d.id === tr.driverId);

                return (
                  <div
                    key={tr.id}
                    className="rounded-[12px] border border-border-subtle bg-surface-1 p-4 transition-colors hover:border-brand/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-[8px] bg-status-active/12 text-status-active">
                          <IconCheck size={18} />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[14px] text-text-primary">
                              {tr.tripNumber}
                            </span>
                            <span className="rounded-[4px] bg-status-active/15 px-2 py-0.5 text-[10px] font-bold text-status-active">
                              {t("Delivered & Closed", "تم التسليم والإغلاق")}
                            </span>
                          </div>
                          <div className="text-[11.5px] text-text-muted mt-0.5">
                            {tr.shipper} · {tr.consignee}
                          </div>
                        </div>
                      </div>

                      {onOpenTrip && (
                        <button
                          onClick={() => {
                            selectTrip(tr.id);
                            onOpenTrip(tr.id);
                          }}
                          className="btn-ghost py-1 px-3 text-[11.5px]"
                        >
                          {t("View Waybill & POD", "عرض بوليصة الشحن وإثبات التسليم")}
                        </button>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-[12px] md:grid-cols-4">
                      <div>
                        <div className="text-text-muted text-[10.5px]">{t("Route Corridor", "مسار الرحلة")}</div>
                        <div className="font-semibold text-text-primary mt-0.5">
                          {td(tr.originCity)} → {td(tr.destinationCity)}
                        </div>
                      </div>
                      <div>
                        <div className="text-text-muted text-[10.5px]">{t("Assigned Vehicle", "الشاحنة")}</div>
                        <div className="flex items-center gap-1.5 font-semibold text-text-primary mt-0.5">
                          <TruckTypeIcon truckType={tr.cargoType} size={14} />
                          <span className="font-mono">{truck?.plate || "ر ج د ٤٨٢١"}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-text-muted text-[10.5px]">{t("Captain / Driver", "الكابتن")}</div>
                        <div className="font-semibold text-text-primary mt-0.5">{driver?.name || "فهد الشمري"}</div>
                      </div>
                      <div>
                        <div className="text-text-muted text-[10.5px]">{t("Cargo Weight", "وزن الحمولة")}</div>
                        <div className="font-mono font-semibold text-text-primary mt-0.5 tabular-nums">
                          {tr.cargoWeightTons} {t("Tons", "طن")}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* System Operational Audit Trail */
          <div className="rounded-[12px] border border-border-subtle bg-surface-1 overflow-hidden">
            <div className="border-b border-border-subtle bg-surface-2 px-4 py-3 text-[12px] font-bold text-text-primary">
              {t("System Audit Trail & Security Ledger", "سجل تدقيق العمليات المعتمد")}
            </div>
            <div className="divide-y divide-border-subtle">
              {filteredAuditLogs.map((log: AuditLog) => (
                <div key={log.id} className="p-3.5 hover:bg-surface-2 transition-colors flex items-start justify-between gap-3 text-[12px]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text-primary">{t(log.actionEn, log.actionAr)}</span>
                      {log.tripNumber && (
                        <span className="font-mono text-[11px] text-brand bg-brand/10 px-1.5 py-0.5 rounded">
                          {log.tripNumber}
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-text-secondary">{log.details}</div>
                  </div>
                  <div className="text-end shrink-0">
                    <div className="text-[11px] font-semibold text-text-muted">{log.actor}</div>
                    <div className="font-mono text-[10.5px] text-text-muted tabular-nums mt-0.5">
                      {td(log.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
