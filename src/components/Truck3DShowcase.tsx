import { Vehicle3DViewer } from "./Vehicle3DViewer";
import { CurtainRig3DViewer } from "./CurtainRig3DViewer";
import { TruckTypeIcon } from "./TruckTypeIcon";

const truckTypes = [
  { id: "flatbed", name: "سطحة", subtitle: "نقل المعدات والحمولات المكشوفة", brand: "Mercedes-Benz Actros" },
  { id: "reefer", name: "براد", subtitle: "نقل الشحنات المبردة", brand: "Volvo FH" },
  { id: "dry", name: "جاف", subtitle: "نقل البضائع داخل صندوق مغلق", brand: "Mercedes-Benz Actros" },
  { id: "curtain", name: "ستارة", subtitle: "تحميل جانبي مرن للبضائع", brand: "Volvo FH" },
] as const;

/**
 * EJAZ fleet showcase. Real published GLBs are used for every card.
 * The curtain card is a real two-GLB coupled rig: tractor + curtainsider trailer.
 */
export function Truck3DShowcase() {
  return (
    <section dir="rtl" className="w-full space-y-5 text-text-primary">
      <header className="overflow-hidden rounded-2xl border border-border-subtle bg-gradient-to-l from-surface-2 via-surface-1 to-[#081321] p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
              <span className="h-2 w-2 rounded-full bg-brand" />
              أسطول إيجاز
            </div>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">استكشف أنواع الشاحنات</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
              اختر نوع الهيكل لعرض المركبة واستعراض تفاصيلها. العرض التفاعلي مبني على ملفات GLB حقيقية، والستارة تظهر كجرار ومقطورة مقترنين فعليًا.
            </p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-surface-1/70 px-4 py-3">
            <div className="text-xs text-text-muted">أنواع الهياكل</div>
            <div className="mt-1 text-2xl font-black text-brand">04</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {truckTypes.map((truck) => (
          <article key={truck.id} className="group overflow-hidden rounded-2xl border border-border-subtle bg-surface-1 shadow-lg transition-all duration-300 hover:border-brand/60 hover:shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
                  <TruckTypeIcon truckType={truck.id} size={24} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-extrabold">{truck.name}</h3>
                  <p className="text-xs text-text-muted">{truck.subtitle}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-border-subtle bg-surface-2 px-3 py-1 text-[11px] font-semibold text-text-secondary">
                {truck.brand}
              </span>
            </div>
            <div className="relative min-h-[260px] bg-[#07111e] sm:min-h-[320px]">
              {truck.id === "curtain" ? (
                <CurtainRig3DViewer height={320} />
              ) : (
                <Vehicle3DViewer
                  vehicleType={truck.id}
                  previewMode={false}
                  compact
                  showControls
                  height={320}
                  className="min-h-[260px] sm:min-h-[320px]"
                />
              )}
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-4 py-3 text-xs">
              <span className="text-text-secondary">معاينة المركبة</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-text-muted">
                <span className="h-2 w-2 rounded-full bg-status-active" />
                {truck.id === "curtain" ? "GLB حقيقي · جرار + مقطورة ستارة" : "GLB حقيقي · 3D تفاعلي"}
              </span>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Truck3DShowcase;
