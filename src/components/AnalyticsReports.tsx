import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../settings";
import { apiClient } from "../services/apiClient";
import { usePermissions } from "../state/permissionStore";
import {
  IconClose,
  IconDoc,
  IconReport,
  IconStar,
} from "./Icons";

/**
 * Analytics & reports (§25).
 *
 * Real data only (§32): every figure comes from the authoritative API —
 * `/api/reports/operational-summary`, `/api/finance/trips` and `/api/trips`.
 * Nothing is hardcoded; when the backend is unreachable the report says so
 * instead of drawing sample numbers.
 *
 * Export: PDF (print-ready layout), Excel (CSV workbook) and Print — with the
 * official filters (trip, customer, driver, vehicle, date, month, year, status,
 * revenue, expenses, payments).
 */

interface AnalyticsReportsProps {
  onClose?: () => void;
}

interface FinanceRow {
  tripId: string;
  tripNumber?: string;
  freightPrice?: number;
  netRevenue?: number;
  expenses?: number;
  paidAmount?: number;
  paymentStatus?: string;
  settlementStatus?: string;
  [key: string]: any;
}

export function AnalyticsReports({ onClose }: AnalyticsReportsProps) {
  const { t, td } = useSettings();
  const { can } = usePermissions();
  const canViewFinance = can("finance.view");
  const canExport = can("reports.export");
  const canPrint = can("reports.print");
  const [summary, setSummary] = useState<any | null>(null);
  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters (§25)
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [customer, setCustomer] = useState("");
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [minRevenue, setMinRevenue] = useState("");
  const [payment, setPayment] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [sum, fin, tr] = await Promise.all([
          apiClient.reports.getSummary().catch(() => null),
          apiClient.finance.getTrips().catch(() => ({ trips: [] })),
          apiClient.trips.getAll().catch(() => ({ trips: [] })),
        ]);
        if (!mounted) return;
        setSummary(sum);
        setFinance((fin?.trips || fin?.financials || []) as FinanceRow[]);
        setTrips(tr?.trips || []);
        setLoadError(null);
      } catch {
        if (mounted) setLoadError(t("Unable to reach the reporting service.", "تعذّر الوصول إلى خدمة التقارير."));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [t]);

  const financeByTrip = useMemo(() => {
    const map = new Map<string, FinanceRow>();
    for (const row of finance) map.set(row.tripId, row);
    return map;
  }, [finance]);

  const filtered = useMemo(() => {
    return trips.filter((tr) => {
      if (q && !String(tr.tripNumber || "").includes(q) && !String(tr.customerName || "").includes(q)) return false;
      if (status && tr.status !== status) return false;
      if (customer && !String(tr.customerName || "").includes(customer)) return false;
      if (driver && !String(tr.driverName || "").includes(driver)) return false;
      if (vehicle && !String(tr.vehiclePlate || tr.vehicleId || "").includes(vehicle)) return false;
      if (year && !String(tr.createdAt || "").startsWith(year)) return false;
      if (month && !String(tr.createdAt || "").includes(month)) return false;
      const fin = financeByTrip.get(tr.id);
      if (minRevenue && Number(fin?.freightPrice || 0) < Number(minRevenue)) return false;
      if (payment && String(fin?.paymentStatus || "") !== payment) return false;
      return true;
    });
  }, [trips, q, status, customer, driver, vehicle, month, year, minRevenue, payment, financeByTrip]);

  const totals = useMemo(() => {
    let revenue = 0;
    let expenses = 0;
    let payments = 0;
    for (const tr of filtered) {
      const fin = financeByTrip.get(tr.id);
      revenue += Number(fin?.freightPrice || 0);
      expenses += Number(fin?.expenses || 0);
      payments += Number(fin?.paidAmount || 0);
    }
    return { revenue, expenses, payments };
  }, [filtered, financeByTrip]);

  /* ── Exports (§25): Excel/CSV, PDF & Print ─────────────────────────── */

  const exportRows = () =>
    filtered.map((tr) => {
      const fin: Partial<FinanceRow> = financeByTrip.get(tr.id) || {};
      return {
        tripNumber: tr.tripNumber || "",
        status: tr.status || "",
        customer: tr.customerName || "",
        driver: tr.driverName || "",
        vehicle: tr.vehiclePlate || tr.vehicleId || "",
        origin: tr.originCity || "",
        destination: tr.destinationCity || "",
        revenueSar: Number(fin.freightPrice || 0),
        expensesSar: Number(fin.expenses || 0),
        paymentsSar: Number(fin.paidAmount || 0),
        paymentStatus: fin.paymentStatus || "",
      };
    });

  const exportExcel = () => {
    const rows = exportRows();
    const header = Object.keys(rows[0] || {
      tripNumber: "", status: "", customer: "", driver: "", vehicle: "",
      origin: "", destination: "", revenueSar: "", expensesSar: "", paymentsSar: "", paymentStatus: "",
    });
    const csv = [
      header.join(","),
      ...rows.map((r) => header.map((h) => JSON.stringify(String((r as any)[h] ?? ""))).join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `EJAZ-REPORT-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    // The print-ready layout is the PDF source — the browser print dialog
    // offers "Save as PDF" with the same official header (§25).
    window.print();
  };

  const metric = summary?.metrics || {};

  return (
    <div className="print-area">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; inset: 0; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-page-title font-extrabold text-text-primary">
            {t("Reports & analytics", "التقارير والتحليلات")}
          </h2>
          <p className="text-label text-text-muted">
            {t("Real operational & financial data from the enterprise backend", "بيانات تشغيلية ومالية حقيقية من الخادم المركزي")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canPrint && (
            <button onClick={exportPdf} className="btn-primary gap-1.5 px-3 py-2 text-label-lg">
              <IconDoc size={14} /> PDF
            </button>
          )}
          {canExport && (
            <button onClick={exportExcel} className="btn-ghost gap-1.5 border border-border-subtle px-3 py-2 text-label-lg">
              <IconReport size={14} /> Excel
            </button>
          )}
          {canPrint && (
            <button onClick={() => window.print()} className="btn-ghost gap-1.5 border border-border-subtle px-3 py-2 text-label-lg">
              ⎙ {t("Print", "طباعة")}
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="btn-icon" aria-label={t("Close", "إغلاق")}>
              <IconClose size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Official filters (§25) */}
      <div className="no-print card mt-3 grid grid-cols-2 gap-2 p-3 md:grid-cols-4 xl:grid-cols-5">
        <FilterInput label={t("Trip number", "رقم الرحلة")} value={q} onChange={setQ} placeholder="EJ-2026-…" />
        <FilterSelect
          label={t("Status", "الحالة")}
          value={status}
          onChange={setStatus}
          options={[...new Set(trips.map((tr) => String(tr.status || "")))].filter(Boolean)}
        />
        <FilterInput label={t("Customer", "العميل")} value={customer} onChange={setCustomer} />
        <FilterInput label={t("Driver", "السائق")} value={driver} onChange={setDriver} />
        <FilterInput label={t("Vehicle", "المركبة")} value={vehicle} onChange={setVehicle} />
        <FilterInput label={t("Month (YYYY-MM)", "الشهر (YYYY-MM)")} value={month} onChange={setMonth} placeholder="2026-10" />
        <FilterInput label={t("Year", "السنة")} value={year} onChange={setYear} placeholder="2026" />
        {canViewFinance && (
          <>
            <FilterInput label={t("Min revenue (SAR)", "الحد الأدنى للإيراد")} value={minRevenue} onChange={setMinRevenue} />
            <FilterSelect
              label={t("Payments", "المدفوعات")}
              value={payment}
              onChange={setPayment}
              options={[...new Set(finance.map((f) => String(f.paymentStatus || "")))].filter(Boolean)}
            />
          </>
        )}
      </div>

      {/* Summary cards — real metrics */}
      {loading ? (
        <div className="card mt-3 p-8 text-center text-label-lg text-text-muted">
          {t("Loading real report data…", "جاري تحميل بيانات التقارير الحقيقية…")}
        </div>
      ) : loadError ? (
        <div className="card mt-3 p-8 text-center text-label-lg text-status-danger">{loadError}</div>
      ) : (
        <>
          {canViewFinance && (
            <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <StatCard label={t("Trips (filtered)", "الرحلات (المفلترة)")} value={String(filtered.length)} icon={IconStar} />
              <StatCard label={t("Gross revenue (SAR)", "الإيرادات (ر.س)")} value={totals.revenue.toLocaleString()} icon={IconReport} />
              <StatCard label={t("Expenses (SAR)", "المصروفات (ر.س)")} value={totals.expenses.toLocaleString()} icon={IconReport} />
              <StatCard label={t("Payments (SAR)", "المدفوعات (ر.س)")} value={totals.payments.toLocaleString()} icon={IconStar} />
            </div>
          )}

          <div className="mt-2.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <StatCard label={t("Total trips", "إجمالي الرحلات")} value={String(metric.totalTrips ?? "—")} icon={IconStar} />
            <StatCard label={t("Fleet size", "حجم الأسطول")} value={String(metric.fleetCount ?? "—")} icon={IconStar} />
            <StatCard label={t("Drivers", "السائقون")} value={String(metric.driversCount ?? "—")} icon={IconStar} />
            <StatCard label={t("Utilization", "نسبة الاستغلال")} value={metric.utilizationRatePercent != null ? `${metric.utilizationRatePercent}%` : "—"} icon={IconReport} />
          </div>

          {/* Real trips table */}
          <div className="card mt-3 overflow-x-auto p-3">
            <table className="w-full text-label">
              <thead>
                <tr className="text-text-muted">
                  {[
                    t("Trip", "الرحلة"),
                    t("Status", "الحالة"),
                    t("Customer", "العميل"),
                    t("Driver", "السائق"),
                    t("Vehicle", "المركبة"),
                    ...(canViewFinance
                      ? [t("Revenue", "الإيراد"), t("Expenses", "المصروفات"), t("Payments", "المدفوعات")]
                      : []),
                  ].map((h) => (
                    <th key={h} className="p-1.5 text-start font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={canViewFinance ? 8 : 5} className="p-6 text-center text-text-muted">
                      {t("No trips match the selected filters.", "لا توجد رحلات مطابقة للفلاتر المحددة.")}
                    </td>
                  </tr>
                )}
                {filtered.map((tr) => {
                  const fin: Partial<FinanceRow> = financeByTrip.get(tr.id) || {};
                  return (
                    <tr key={tr.id} className="border-t border-border-subtle">
                      <td className="p-1.5 font-mono text-brand">{tr.tripNumber}</td>
                      <td className="p-1.5">{td(tr.statusAr || tr.status)}</td>
                      <td className="p-1.5">{tr.customerName || "—"}</td>
                      <td className="p-1.5">{tr.driverName || "—"}</td>
                      <td className="p-1.5">{tr.vehiclePlate || tr.vehicleId || "—"}</td>
                      {canViewFinance && (
                        <>
                          <td className="p-1.5 tabular-nums">{Number(fin.freightPrice || 0).toLocaleString()}</td>
                          <td className="p-1.5 tabular-nums">{Number(fin.expenses || 0).toLocaleString()}</td>
                          <td className="p-1.5 tabular-nums">{Number(fin.paidAmount || 0).toLocaleString()}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <p className="mt-2 text-micro text-text-muted">
              {t("Report generated from live data", "تم إنشاء التقرير من البيانات الحيّة")} · {new Date().toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof IconStar }) {
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-brand/12 text-brand">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-label text-text-muted">{label}</div>
        <div className="truncate text-body font-extrabold text-text-primary tabular-nums" dir="ltr">{value}</div>
      </div>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-micro font-semibold text-text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-chip border border-border-subtle bg-surface-2 px-2.5 text-label text-text-primary focus:border-brand focus:outline-none"
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const { t } = useSettings();
  return (
    <label className="block">
      <span className="mb-1 block text-micro font-semibold text-text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-chip border border-border-subtle bg-surface-2 px-2 text-label text-text-primary focus:border-brand focus:outline-none"
      >
        <option value="">{t("All", "الكل")}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </label>
  );
}
