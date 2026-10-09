import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore } from "../state/fleetStore";
import { BODY_TYPES } from "../data/catalog";
import { TruckImage } from "./TruckImage";

export function OwnerPortal() {
  const { t } = useSettings();
  const { trucks } = useFleetStore();

  const totalOdometer = trucks.reduce((acc, tk) => acc + tk.odometer, 0);
  const activeCount = trucks.filter((tk) => tk.status === "active").length;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface-0 p-4 lg:p-6 space-y-6">
      {/* Top Banner */}
      <div className="card p-5 border border-border-subtle bg-gradient-to-r from-surface-2 to-surface-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-headline font-bold text-text-primary">
                {t("Fleet Asset Owner & Investor Dashboard", "لوحة إدارة واستثمار أصول الشاحنات")}
              </h2>
              <span className="badge bg-brand/20 text-brand text-label">
                {trucks.length} {t("Heavy Assets", "شاحنات ثقيلة")}
              </span>
            </div>
            <p className="text-label-lg text-text-muted mt-0.5">
              {t(
                "Capital efficiency, fleet maintenance schedules, revenue per kilometer, and asset lifecycle",
                "عائد الأصول الرأسمالية، كفاءة التشغيل بالطن/كم، وجداول الصيانة الدورية للأسطول"
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="badge bg-status-active/20 text-status-active py-1.5 px-3 font-semibold text-label-lg">
              {activeCount} {t("Units Generating Revenue", "شاحنة في طور التشغيل المباشر")}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4 border border-border-subtle">
          <span className="text-label text-text-muted uppercase tracking-wider block">
            {t("Est. Monthly Fleet Revenue", "العائد الشهري التقديري")}
          </span>
          <span className="text-hero-sm font-bold text-brand tabular-nums block mt-1">
            ٤٨٢,٠٠٠ {t("SAR", "ر.س")}
          </span>
          <span className="text-label text-status-active font-semibold block mt-1">
            +١٤.٢٪ {t("vs last month", "عن الشهر السابق")}
          </span>
        </div>

        <div className="card p-4 border border-border-subtle">
          <span className="text-label text-text-muted uppercase tracking-wider block">
            {t("Total Logged Mileage", "إجمالي المسافات المقطوعة")}
          </span>
          <span className="text-hero-sm font-bold text-text-primary tabular-nums block mt-1">
            {totalOdometer.toLocaleString()} {t("km", "كم")}
          </span>
          <span className="text-label text-text-secondary block mt-1">
            {t("Across 14 Prime Movers", "على ١٤ شاحنة ومقطورة")}
          </span>
        </div>

        <div className="card p-4 border border-border-subtle">
          <span className="text-label text-text-muted uppercase tracking-wider block">
            {t("Fleet Utilization Rate", "معدل تشغيل الشاحنات")}
          </span>
          <span className="text-hero-sm font-bold text-status-active tabular-nums block mt-1">
            ٨٩.٢٪
          </span>
          <span className="text-label text-text-muted block mt-1">
            {t("Target: 85%", "المستهدف: ٨٥٪")}
          </span>
        </div>

        <div className="card p-4 border border-border-subtle">
          <span className="text-label text-text-muted uppercase tracking-wider block">
            {t("Maintenance Compliance", "الالتزام ببرامج الصيانة")}
          </span>
          <span className="text-hero-sm font-bold text-text-primary tabular-nums block mt-1">
            ٩٧.٨٪
          </span>
          <span className="text-label text-status-active font-semibold block mt-1">
            {t("Zero safety violations", "صفر مخالفات تشغيلية")}
          </span>
        </div>
      </div>

      {/* Asset Table with 3D truck renders */}
      <div className="card p-5 border border-border-subtle space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-page-title font-bold text-text-primary">
              {t("Commercial Heavy Vehicles Portfolio", "سجل المركبات والأصول اللوجستية")}
            </h4>
            <p className="text-label text-text-muted">
              {t("Real Mercedes-Benz, Volvo, Scania, and MAN prime movers in service", "شاحنات مرسيدس وفولفو وسكانيا ومان العاملة في المملكة العربية السعودية")}
            </p>
          </div>
          <span className="text-label-lg font-bold text-brand">
            {trucks.length} {t("Registered Trucks", "شاحنة مسجلة")}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-body">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted text-label uppercase">
                <th className="pb-3 text-start">{t("Truck & Model", "الموديل والشاحنة")}</th>
                <th className="pb-3 text-start">{t("Plate & Cab", "اللوحة ونوع الكابينة")}</th>
                <th className="pb-3 text-center">{t("Body Type", "نوع الهيكل")}</th>
                <th className="pb-3 text-center">{t("Engine Power", "القوة")}</th>
                <th className="pb-3 text-center">{t("Odometer", "العداد")}</th>
                <th className="pb-3 text-center">{t("Fuel Tank", "الوقود")}</th>
                <th className="pb-3 text-end">{t("Operating Status", "الحالة التشغيلية")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/70">
              {trucks.map((tk) => {
                const b = BODY_TYPES.find((x) => x.id === tk.body);
                return (
                  <tr key={tk.id} className="hover:bg-surface-3/50 transition-colors">
                    <td className="py-3 flex items-center gap-3">
                      <span className="block h-10 w-16 overflow-hidden rounded-micro bg-black p-0.5 shrink-0">
                        <TruckImage
                          vehicle={tk as any}
                          alt={tk.model}
                          className="h-full w-full object-contain"
                        />
                      </span>
                      <div>
                        <span className="font-bold text-text-primary block">
                          {tk.brand} {tk.model}
                        </span>
                        <span className="text-label text-text-muted">{tk.year}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="font-mono font-bold text-text-primary block">{tk.plate}</span>
                      <span className="text-label text-text-muted">{tk.cab}</span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="badge bg-surface-5 text-text-secondary text-label">
                        {b ? t(b.label[0], b.label[1]) : tk.body}
                      </span>
                    </td>
                    <td className="py-3 text-center font-bold tabular-nums text-text-primary">
                      {tk.hp} {t("hp", "حصان")}
                    </td>
                    <td className="py-3 text-center font-medium tabular-nums text-text-secondary">
                      {tk.odometer.toLocaleString()} {t("km", "كم")}
                    </td>
                    <td className="py-3 text-center">
                      <div className="inline-flex items-center gap-1.5 font-bold tabular-nums text-text-primary">
                        <span>{tk.fuel}%</span>
                        <div className="w-10 h-1.5 rounded-full bg-surface-5 overflow-hidden inline-block">
                          <div
                            className="h-full bg-brand rounded-full"
                            style={{ width: `${tk.fuel}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-end">
                      <span
                        className={cn(
                          "badge text-label",
                          tk.status === "active"
                            ? "bg-status-active/20 text-status-active font-bold"
                            : tk.status === "waiting"
                            ? "bg-status-waiting/20 text-status-waiting"
                            : "bg-surface-5 text-text-muted"
                        )}
                      >
                        {tk.status === "active"
                          ? t("Active on Road", "نشطة على الطريق")
                          : tk.status === "waiting"
                          ? t("In Terminal", "في المحطة")
                          : t("Workshop Idle", "ورشة وتوقف")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
