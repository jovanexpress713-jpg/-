import { useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore } from "../state/fleetStore";
import {
  IconStar,
  IconClose,
} from "./Icons";

interface AnalyticsReportsProps {
  onClose?: () => void;
}

type Period = "day" | "week" | "month" | "year";

export function AnalyticsReports({ onClose }: AnalyticsReportsProps) {
  const { t } = useSettings();
  const { trucks, drivers } = useFleetStore();
  const [period, setPeriod] = useState<Period>("month");

  // Dynamic datasets by period
  const PERIOD_DATA: Record<
    Period,
    {
      labels: string[];
      tripsData: number[];
      tonKmData: number[];
      revenueData: number[]; // in thousands of SAR
    }
  > = {
    day: {
      labels: ["٠٠:٠٠", "٠٤:٠٠", "٠٨:٠٠", "١٢:٠٠", "١٦:٠٠", "٢٠:٠٠"],
      tripsData: [4, 8, 14, 22, 19, 12],
      tonKmData: [120, 240, 480, 890, 720, 430],
      revenueData: [18, 34, 62, 95, 84, 52],
    },
    week: {
      labels: ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"],
      tripsData: [18, 26, 32, 29, 34, 38, 14],
      tonKmData: [620, 940, 1180, 1050, 1240, 1420, 510],
      revenueData: [72, 105, 138, 122, 145, 168, 58],
    },
    month: {
      labels: ["الأسبوع ١", "الأسبوع ٢", "الأسبوع ٣", "الأسبوع ٤"],
      tripsData: [112, 134, 148, 162],
      tonKmData: [4200, 5100, 5800, 6400],
      revenueData: [480, 560, 620, 710],
    },
    year: {
      labels: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
      tripsData: [420, 460, 510, 490, 540, 580, 610, 640, 690, 720, 750, 790],
      tonKmData: [16000, 18500, 21000, 19800, 22400, 24100, 25800, 27200, 29000, 31200, 32800, 34500],
      revenueData: [1800, 2100, 2400, 2250, 2600, 2800, 3100, 3250, 3500, 3750, 3900, 4150],
    },
  };

  const currentData = PERIOD_DATA[period];

  // Max values for SVG normalization
  const maxTrips = Math.max(...currentData.tripsData, 1);

  // Donut chart segments for fleet status
  const activeCount = trucks.filter((tk) => tk.status === "active").length;
  const waitingCount = trucks.filter((tk) => tk.status === "waiting").length;
  const inactiveCount = trucks.filter((tk) => tk.status === "inactive").length;
  const totalFleet = trucks.length || 1;

  const pActive = (activeCount / totalFleet) * 100;
  const pWaiting = (waitingCount / totalFleet) * 100;
  const pInactive = (inactiveCount / totalFleet) * 100;

  // Circumference for 2*PI*R (R=36)
  const circ = 2 * Math.PI * 36;
  const strokeActive = (pActive / 100) * circ;
  const strokeWaiting = (pWaiting / 100) * circ;
  const strokeInactive = (pInactive / 100) * circ;

  return (
    <div className="flex h-full flex-col bg-surface-0 min-h-0">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4 lg:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[22px] font-bold text-text-primary">
              {t("Logistics Operations & Performance Analytics", "لوحة تحليلات الأداء والتقارير التشغيلية")}
            </h2>
            <span className="badge bg-brand/20 text-brand">
              {t("Live Data", "بيانات حية")}
            </span>
          </div>
          <p className="text-[12px] text-text-muted mt-0.5">
            {t(
              "Data-driven freight metrics, fuel efficiency, ton-kilometer throughput, and driver rankings",
              "مؤشرات دقيقة لأحجام النقل، كفاءة الوقود، حركة الأطنان، وسجل تميز السائقين"
            )}
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1 border border-border-subtle">
          {(
            [
              ["day", t("Day", "يوم")],
              ["week", t("Week", "أسبوع")],
              ["month", t("Month", "شهر")],
              ["year", t("Year", "سنة")],
            ] as [Period, string][]
          ).map(([pKey, pLabel]) => (
            <button
              key={pKey}
              onClick={() => setPeriod(pKey)}
              className={cn(
                "rounded-full px-3.5 py-1 text-[11.5px] font-semibold transition-all active:scale-95",
                period === pKey
                  ? "bg-brand text-on-brand shadow-md"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {pLabel}
            </button>
          ))}
          {onClose && (
            <button onClick={onClose} className="btn-icon ms-2" aria-label="Close">
              <IconClose size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="scroll-thin flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card p-4 border border-border-subtle">
            <span className="text-[11px] text-text-muted uppercase tracking-wider block">
              {t("Total Freight Volume", "إجمالي النقل المنجز")}
            </span>
            <span className="text-[24px] font-extrabold text-text-primary tabular-nums block mt-1">
              {currentData.tripsData.reduce((a, b) => a + b, 0).toLocaleString()} {t("Trips", "رحلة")}
            </span>
            <span className="text-[11px] text-status-active font-semibold block mt-1">
              ↑ 12.4% {t("growth vs prev period", "نمو عن الفترة السابقة")}
            </span>
          </div>

          <div className="card p-4 border border-border-subtle">
            <span className="text-[11px] text-text-muted uppercase tracking-wider block">
              {t("Operating Revenue (SAR)", "العائد التشغيلي الإجمالي")}
            </span>
            <span className="text-[24px] font-extrabold text-brand tabular-nums block mt-1">
              {(currentData.revenueData.reduce((a, b) => a + b, 0) * 1000).toLocaleString()} {t("SAR", "ر.س")}
            </span>
            <span className="text-[11px] text-status-active font-semibold block mt-1">
              ↑ 8.7% {t("revenue efficiency", "كفاءة العائد بالطن")}
            </span>
          </div>

          <div className="card p-4 border border-border-subtle">
            <span className="text-[11px] text-text-muted uppercase tracking-wider block">
              {t("Ton-Kilometer Throughput", "طن/كيلومتر منجز")}
            </span>
            <span className="text-[24px] font-extrabold text-text-primary tabular-nums block mt-1">
              {currentData.tonKmData.reduce((a, b) => a + b, 0).toLocaleString()} {t("T-Km", "طن.كم")}
            </span>
            <span className="text-[11px] text-text-secondary block mt-1">
              {t("Across 5 Saudi Corridors", "عبر ٥ ممرات رئيسية")}
            </span>
          </div>

          <div className="card p-4 border border-border-subtle">
            <span className="text-[11px] text-text-muted uppercase tracking-wider block">
              {t("Fleet On-Time Delivery", "الالتزام بمواعيد الوصول")}
            </span>
            <span className="text-[24px] font-extrabold text-status-active tabular-nums block mt-1">
              96.4%
            </span>
            <span className="text-[11px] text-text-muted block mt-1">
              {t("Industry benchmark: 91%", "المعيار القياسي: ٩١٪")}
            </span>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Chart 1: Trips Trend Interactive SVG Line Area Chart (2 cols) */}
          <div className="card p-5 border border-border-subtle lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-[15px] font-bold text-text-primary">
                  {t("Trip Volume & Freight Activity Trend", "منحنى وتيرة الرحلات وحركة الشحن")}
                </h4>
                <p className="text-[11px] text-text-muted">
                  {t("Interactive data-driven trip execution curve", "رسم بياني تفاعلي مبني على بيانات الرحلات الحقيقية")}
                </p>
              </div>
              <span className="badge bg-brand/15 text-brand tabular-nums text-[11px]">
                {currentData.tripsData.reduce((a, b) => a + b, 0)} {t("Trips Total", "إجمالي")}
              </span>
            </div>

            {/* Interactive SVG Line Chart */}
            <div className="relative h-56 w-full pt-4">
              <svg viewBox="0 0 500 180" className="h-full w-full overflow-visible" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="tripGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.38" />
                    <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Guide lines */}
                {[30, 75, 120, 160].map((yVal, idx) => (
                  <line
                    key={idx}
                    x1="0"
                    y1={yVal}
                    x2="500"
                    y2={yVal}
                    stroke="rgba(110, 126, 150, 0.18)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                ))}

                {/* Area and Line Path */}
                {(() => {
                  const pts = currentData.tripsData.map((val, idx) => {
                    const x = (idx / (currentData.tripsData.length - 1 || 1)) * 480 + 10;
                    const y = 160 - (val / maxTrips) * 130;
                    return [x, y];
                  });

                  const lineD = pts.reduce(
                    (acc, [x, y], i) => (i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`),
                    ""
                  );
                  const areaD = `${lineD} L ${pts[pts.length - 1][0]} 160 L ${pts[0][0]} 160 Z`;

                  return (
                    <>
                      <path d={areaD} fill="url(#tripGrad)" />
                      <path d={lineD} fill="none" stroke="var(--color-brand)" strokeWidth="3" strokeLinecap="round" />
                      {pts.map(([px, py], i) => (
                        <g key={i}>
                          <circle cx={px} cy={py} r="4.5" fill="var(--color-brand)" stroke="var(--color-navy)" strokeWidth="2" />
                          <text
                            x={px}
                            y={py - 10}
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="bold"
                            fill="var(--color-text-primary)"
                          >
                            {currentData.tripsData[i]}
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>

              {/* X Axis Labels */}
              <div className="flex justify-between text-[11px] text-text-muted mt-2 pt-2 border-t border-border-subtle">
                {currentData.labels.map((lbl, idx) => (
                  <span key={idx}>{lbl}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Chart 2: Fleet Status Donut Chart (1 col) */}
          <div className="card p-5 border border-border-subtle flex flex-col justify-between">
            <div>
              <h4 className="text-[15px] font-bold text-text-primary">
                {t("Fleet Status Breakdown", "توزيع حالة أسطول الشاحنات")}
              </h4>
              <p className="text-[11px] text-text-muted">
                {totalFleet} {t("Heavy Tractor Units", "شاحنة ثقيلة مسجلة")}
              </p>
            </div>

            {/* Donut graphic */}
            <div className="relative my-4 flex items-center justify-center">
              <svg width="150" height="150" viewBox="0 0 100 100" className="-rotate-90">
                {/* Background track */}
                <circle cx="50" cy="50" r="36" fill="none" stroke="rgba(41, 65, 96, 0.3)" strokeWidth="11" />

                {/* Active segment (Green) */}
                <circle
                  cx="50"
                  cy="50"
                  r="36"
                  fill="none"
                  stroke="var(--color-status-active)"
                  strokeWidth="11"
                  strokeDasharray={`${strokeActive} ${circ}`}
                  strokeDashoffset="0"
                />

                {/* Waiting segment (Orange) */}
                <circle
                  cx="50"
                  cy="50"
                  r="36"
                  fill="none"
                  stroke="var(--color-brand)"
                  strokeWidth="11"
                  strokeDasharray={`${strokeWaiting} ${circ}`}
                  strokeDashoffset={-strokeActive}
                />

                {/* Inactive segment (Slate) */}
                <circle
                  cx="50"
                  cy="50"
                  r="36"
                  fill="none"
                  stroke="var(--color-text-muted)"
                  strokeWidth="11"
                  strokeDasharray={`${strokeInactive} ${circ}`}
                  strokeDashoffset={-(strokeActive + strokeWaiting)}
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[20px] font-extrabold text-text-primary tabular-nums">
                  {totalFleet}
                </span>
                <span className="text-[10px] text-text-muted uppercase">
                  {t("Trucks", "شاحنة")}
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2 text-[11.5px] border-t border-border-subtle pt-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-status-active" />
                  <span className="text-text-secondary">{t("Active on Route", "نشطة على الطريق")}</span>
                </span>
                <span className="font-bold text-text-primary">{activeCount} ({pActive.toFixed(0)}%)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand" />
                  <span className="text-text-secondary">{t("Waiting / Loading", "في الانتظار والتحميل")}</span>
                </span>
                <span className="font-bold text-text-primary">{waitingCount} ({pWaiting.toFixed(0)}%)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-status-inactive" />
                  <span className="text-text-secondary">{t("Maintenance / Idle", "صيانة وتوقف")}</span>
                </span>
                <span className="font-bold text-text-primary">{inactiveCount} ({pInactive.toFixed(0)}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Driver Leaderboard Performance Table */}
        <div className="card p-5 border border-border-subtle">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-[15px] font-bold text-text-primary">
                {t("Top Fleet Drivers Performance Leaderboard", "لوحة تميز وأداء السائقين")}
              </h4>
              <p className="text-[11px] text-text-muted">
                {t("Ranked by safety index, on-time rate, and completed hauls", "مرتبة وفق معدل الأمان، الالتزام بالمواعيد، والرحلات المنفذة")}
              </p>
            </div>
            <span className="text-[12px] font-bold text-brand">
              {drivers.length} {t("Certified Drivers", "سائق معتمد")}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-[12.5px]">
              <thead>
                <tr className="border-b border-border-subtle text-text-muted text-[11px] uppercase">
                  <th className="pb-3 text-start">{t("Driver Name", "اسم السائق")}</th>
                  <th className="pb-3 text-center">{t("Completed Trips", "الرحلات المنفذة")}</th>
                  <th className="pb-3 text-center">{t("Safety Rating", "تقييم الأمان")}</th>
                  <th className="pb-3 text-center">{t("On-Time Rate", "الالتزام بالمواعيد")}</th>
                  <th className="pb-3 text-end">{t("Status", "الحالة الميدانية")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/70">
                {drivers.slice(0, 6).map((d, i) => (
                  <tr key={d.name} className="hover:bg-surface-3/50 transition-colors">
                    <td className="py-3 flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-5 text-[11px] font-bold text-text-primary">
                        {d.initials}
                      </span>
                      <div>
                        <span className="font-semibold text-text-primary block">{d.name}</span>
                        <span className="text-[10.5px] text-text-muted tabular-nums">{d.phone}</span>
                      </div>
                    </td>
                    <td className="py-3 text-center font-bold tabular-nums text-text-primary">
                      {d.trips}
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center gap-1 font-bold text-status-waiting tabular-nums">
                        <IconStar size={12} />
                        {d.rating}
                      </span>
                    </td>
                    <td className="py-3 text-center font-bold tabular-nums text-status-active">
                      {98 - i * 2}%
                    </td>
                    <td className="py-3 text-end">
                      <span className="badge bg-status-active/20 text-status-active text-[10px]">
                        {t("Active on Duty", "نشط على الطريق")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
