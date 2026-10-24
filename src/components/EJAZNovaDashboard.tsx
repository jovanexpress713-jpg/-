import { useMemo } from "react";
import type { Vehicle } from "../data/types";
import { Vehicle3DViewer } from "./Vehicle3DViewer";
import { IconTruck, IconCargo, IconDriver, IconTracking, IconReport, IconArrowRight } from "./Icons";

type Props = {
  vehicles: Vehicle[];
  onSelect: (id: string) => void;
  onNav: (key: string) => void;
  onToast: (text: string, sub?: string) => void;
};

const money = (n: number) => new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 0 }).format(n);

function Metric({ label, value, hint, icon, tone }: { label: string; value: string; hint: string; icon: React.ReactNode; tone: string }) {
  return (
    <article className="ej-metric">
      <div className={`ej-metric-icon ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="ej-muted text-sm">{label}</p>
        <p className="mt-2 text-2xl font-extrabold tracking-tight text-white">{value}</p>
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      </div>
    </article>
  );
}

export function EJAZNovaDashboard({ vehicles, onSelect, onNav, onToast }: Props) {
  const stats = useMemo(() => {
    const active = vehicles.filter((v) => v.status === "active").length;
    const idle = vehicles.filter((v) => v.status === "inactive").length;
    const drivers = new Set(vehicles.map((v) => v.driver?.name).filter(Boolean)).size;
    const routes = new Set(vehicles.map((v) => `${v.from}→${v.to}`).filter((v) => v !== "→")).size;
    return { active, idle, drivers, routes };
  }, [vehicles]);
  const featured = vehicles[0];

  return (
    <div className="ej-nova min-h-full overflow-y-auto">
      <style>{`
        .ej-nova{--ej-orange:#ff7138;--ej-ink:#08111f;--ej-panel:#101d30;--ej-line:rgba(166,190,221,.13);background:radial-gradient(ellipse at 82% 0%,rgba(255,113,56,.10),transparent 32%),#08111f;color:#f7f9fc;padding:clamp(16px,2.5vw,32px);font-family:inherit}
        .ej-muted{color:#91a3bc}.ej-panel{background:linear-gradient(145deg,rgba(20,36,57,.96),rgba(13,25,42,.98));border:1px solid var(--ej-line);border-radius:22px;box-shadow:0 14px 38px rgba(0,0,0,.13)}
        .ej-metric{display:flex;gap:14px;align-items:flex-start;min-width:0;padding:19px;border:1px solid var(--ej-line);border-radius:18px;background:rgba(17,31,50,.82);transition:transform .2s,border-color .2s}
        .ej-metric:hover{transform:translateY(-3px);border-color:rgba(255,113,56,.45)}.ej-metric-icon{display:grid;place-items:center;width:44px;height:44px;flex:0 0 44px;border-radius:14px}
        .ej-orange{background:rgba(255,113,56,.15);color:#ff986f}.ej-blue{background:rgba(75,156,255,.15);color:#78b7ff}.ej-green{background:rgba(55,211,155,.13);color:#53d9ab}.ej-violet{background:rgba(174,132,255,.15);color:#c2a3ff}
        .ej-action{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border:1px solid var(--ej-line);border-radius:15px;background:rgba(255,255,255,.025);color:#e9eff8;text-align:right;transition:all .2s}
        .ej-action:hover{background:rgba(255,113,56,.09);border-color:rgba(255,113,56,.4);transform:translateY(-1px)}
        .ej-chip{border:1px solid var(--ej-line);border-radius:999px;padding:7px 11px;font-size:12px;color:#b6c4d8;background:rgba(255,255,255,.035)}
        .ej-hero-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr);gap:18px}
        @media(max-width:850px){.ej-hero-grid{grid-template-columns:1fr}.ej-metric{padding:14px}.ej-metric-icon{width:38px;height:38px;flex-basis:38px}}
      `}</style>

      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="ej-chip">EJAZ / CONTROL CENTER</span>
            <span className="ej-chip"><span className="ml-1 inline-block h-2 w-2 rounded-full bg-emerald-400" /> منصة إدارة الأسطول</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">كل رحلاتك، <span style={{color:"var(--ej-orange)"}}>تحت السيطرة.</span></h1>
          <p className="ej-muted mt-3 max-w-2xl text-sm leading-7">مركز عمليات موحّد لإدارة الشاحنات والسائقين والشحنات — من نقطة الانطلاق حتى التسليم.</p>
        </div>
        <button onClick={() => onNav("cargos")} className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-[#101827] shadow-lg transition hover:brightness-110" style={{background:"var(--ej-orange)"}}>
          <IconCargo size={18}/> إنشاء / متابعة شحنة <IconArrowRight size={16}/>
        </button>
      </div>

      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="إجمالي مركبات الأسطول" value={money(vehicles.length)} hint="حسب سجل المركبات الحالي" icon={<IconTruck size={21}/>} tone="ej-orange"/>
        <Metric label="مركبات نشطة" value={money(stats.active)} hint="حالياً وفق حالة المركبة المسجلة" icon={<IconTracking size={21}/>} tone="ej-green"/>
        <Metric label="مركبات متوقفة" value={money(stats.idle)} hint="تحتاج مراجعة قبل التشغيل" icon={<IconCargo size={21}/>} tone="ej-blue"/>
        <Metric label="السائقون المسجلون على المركبات" value={money(stats.drivers)} hint="أسماء فريدة ضمن سجل الأسطول" icon={<IconDriver size={21}/>} tone="ej-violet"/>
      </section>

      <section className="ej-hero-grid mb-5">
        <article className="ej-panel relative min-h-[340px] overflow-hidden p-5 md:p-7">
          <div className="absolute inset-0 opacity-25" style={{background:"radial-gradient(ellipse at 65% 55%,rgba(255,113,56,.26),transparent 42%),linear-gradient(125deg,transparent 40%,rgba(80,145,220,.10))"}}/>
          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-center justify-between gap-3">
              <div><p className="ej-muted text-xs font-bold tracking-[.18em]">FLEET SPOTLIGHT</p><h2 className="mt-2 text-xl font-bold">الأسطول في لمحة</h2></div>
              <span className="ej-chip">عارض ثلاثي الأبعاد</span>
            </div>
            <div className="mt-2 min-h-[205px] flex-1">
              <Vehicle3DViewer vehicleType={featured?.body || "curtain"} vehicleModel={featured?.model} vehiclePlate={featured?.plate} vehicle={featured ? {id:featured.id,body:featured.body,customImage:featured.customImage} : undefined} compact showControls height={230}/>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div><p className="text-base font-bold">{featured ? `${featured.brand} ${featured.model}` : "لا توجد مركبات مسجلة بعد"}</p><p className="ej-muted mt-1 text-xs">{featured ? `رقم اللوحة: ${featured.plate || "غير مسجل"}` : "أضف أول مركبة لعرض بياناتها هنا"}</p></div>
              <button onClick={() => onNav("trucks")} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold hover:border-orange-400/60">إدارة الأسطول ←</button>
            </div>
          </div>
        </article>

        <article className="ej-panel p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between"><div><p className="ej-muted text-xs font-bold tracking-[.16em]">QUICK ACCESS</p><h2 className="mt-2 text-xl font-bold">الوصول السريع</h2></div><span className="text-xs text-slate-500">تنقّل مباشر</span></div>
          <div className="grid gap-3">
            <button className="ej-action" onClick={() => onNav("cargos")}><span className="flex items-center gap-3"><span className="ej-metric-icon ej-orange"><IconCargo size={19}/></span><span><b className="block text-sm">الشحنات والطلبات</b><small className="ej-muted mt-1 block">إدارة الطلبات وحركة البضائع</small></span></span><IconArrowRight size={17}/></button>
            <button className="ej-action" onClick={() => onNav("trucks")}><span className="flex items-center gap-3"><span className="ej-metric-icon ej-blue"><IconTruck size={19}/></span><span><b className="block text-sm">المركبات والأسطول</b><small className="ej-muted mt-1 block">المركبات والصور والنماذج ثلاثية الأبعاد</small></span></span><IconArrowRight size={17}/></button>
            <button className="ej-action" onClick={() => onNav("drivers")}><span className="flex items-center gap-3"><span className="ej-metric-icon ej-green"><IconDriver size={19}/></span><span><b className="block text-sm">إدارة السائقين</b><small className="ej-muted mt-1 block">بيانات السائقين والارتباط بالمركبات</small></span></span><IconArrowRight size={17}/></button>
            <button className="ej-action" onClick={() => onNav("reports")}><span className="flex items-center gap-3"><span className="ej-metric-icon ej-violet"><IconReport size={19}/></span><span><b className="block text-sm">التقارير والتحليلات</b><small className="ej-muted mt-1 block">استعراض التقارير المتاحة بالنظام</small></span></span><IconArrowRight size={17}/></button>
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="flex items-center justify-between"><span className="ej-muted text-sm">المسارات المختلفة المسجلة</span><b className="text-lg">{money(stats.routes)}</b></div>
            <p className="ej-muted mt-1 text-xs leading-6">عدد تقريبي للمسارات الفريدة المستخرجة من بيانات المركبات، وليس تتبع GPS مباشرًا.</p>
          </div>
        </article>
      </section>

      <section className="ej-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">
          <div><p className="ej-muted text-xs font-bold tracking-[.16em]">FLEET REGISTER</p><h2 className="mt-2 text-xl font-bold">المركبات المسجلة</h2></div>
          <button onClick={() => onNav("trucks")} className="text-sm font-bold" style={{color:"var(--ej-orange)"}}>عرض سجل الأسطول ←</button>
        </div>
        {vehicles.length ? <div className="divide-y divide-white/10">{vehicles.slice(0,5).map((v) => <button key={v.id} onClick={() => {onSelect(v.id); onToast("تم اختيار المركبة", v.plate || v.model);}} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-right transition hover:bg-white/[.035] md:px-5"><span className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-orange-300"><IconTruck size={21}/></span><span className="min-w-0"><b className="block truncate text-sm">{v.brand} {v.model}</b><small className="ej-muted mt-1 block">{v.plate || "لوحة غير مسجلة"} · {v.from || "—"} ← {v.to || "—"}</small></span></span><span className={`rounded-full px-3 py-1 text-xs font-bold ${v.status === "active" ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-400/10 text-slate-300"}`}>{v.status === "active" ? "نشطة" : "متوقفة / غير نشطة"}</span></button>)}</div> : <div className="p-8 text-center"><p className="font-bold">لا توجد مركبات في السجل بعد</p><p className="ej-muted mt-2 text-sm">أضف مركبة من إدارة الأسطول لتبدأ متابعة بياناتها.</p><button onClick={() => onNav("trucks")} className="mt-4 rounded-xl px-4 py-2 text-sm font-bold text-slate-950" style={{background:"var(--ej-orange)"}}>فتح إدارة الأسطول</button></div>}
      </section>
      <p className="ej-muted mt-5 text-center text-xs">إيجاز للنقليات · شريكك المعتمد — شحن أسرع، ثقة أكبر</p>
    </div>
  );
}
