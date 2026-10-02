import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import type { Vehicle } from "../data/types";
import { liveOf, useElapsed, useTicker } from "../hooks";
import {
  IconArrowRight,
  IconDoc,
  IconDriver,
  IconOrders,
  IconPhone,
  IconProfile,
  IconStar,
} from "../components/Icons";

function TabBar({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  const { t } = useSettings();
  const items: [string, string, typeof IconOrders][] = [
    ["home", t("Home", "الرئيسية"), IconOrders],
    ["orders", t("Orders", "الطلبات"), IconProfile],
    ["profile", t("Profile", "حسابي"), IconDriver],
  ];
  return (
    <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-navy px-2 py-2">
      {items.map(([id, label, Icon]) => (
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
  );
}

export function OrdersScreen({
  vehicles,
  onOpen,
  tab,
  onTab,
}: {
  vehicles: Vehicle[];
  onOpen: (id: string) => void;
  tab: string;
  onTab: (t: string) => void;
}) {
  const { t } = useSettings();
  const now = useTicker(1000);
  const elapsed = useElapsed(now);

  return (
    <div className="relative h-full w-full overflow-hidden bg-paper text-navy">
      <div className="scroll-thin absolute inset-0 overflow-y-auto pb-24">
        <div className="px-5 pt-14 pb-4">
          <h1 className="text-[22px] font-medium">{t("Orders", "الطلبات")}</h1>
          <p className="mt-0.5 text-[11.5px] text-navy/55">
            {t(
              `${vehicles.length} shipments under your account`,
              `${vehicles.length} شحنة تحت حسابك`,
            )}
          </p>
        </div>

        <div className="space-y-2.5 px-4">
          {vehicles.slice(0, 8).map((v) => {
            const live = liveOf(v, elapsed);
            return (
              <button
                key={v.id}
                onClick={() => onOpen(v.id)}
                className="w-full rounded-[16px] bg-navy/8 p-3.5 text-start transition-all duration-200 active:scale-[0.98]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold tabular-nums">{v.shipment}</span>
                  <span
                    className={cn(
                      "rounded-[5px] px-2 py-1 text-[10px] font-semibold",
                      v.status === "active" && "bg-status-active/20 text-status-active",
                      v.status === "waiting" && "bg-status-waiting/20 text-status-waiting",
                      v.status === "inactive" && "bg-status-inactive/20 text-status-inactive",
                    )}
                  >
                    {v.status === "active"
                      ? t("On Route", "على الطريق")
                      : v.status === "waiting"
                        ? t("Waiting", "في الانتظار")
                        : t("Inactive", "متوقفة")}
                  </span>
                </div>
                <div className="mt-1 text-[11.5px] text-navy/60">
                  {v.from} → {v.to} · {v.model}
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy/10">
                    <span
                      className="block h-full rounded-full bg-accent-2"
                      style={{ width: `${live.progress}%` }}
                    />
                  </span>
                  <span className="text-[10.5px] tabular-nums text-navy/50">
                    {Math.round(live.progress)}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <TabBar tab={tab} onTab={onTab} />
    </div>
  );
}

export function ProfileScreen({
  vehicles,
  tab,
  onTab,
}: {
  vehicles: Vehicle[];
  tab: string;
  onTab: (t: string) => void;
}) {
  const { t } = useSettings();
  const rows: [string, string, React.ReactNode][] = [
    [t("Documents", "المستندات"), t("12 files", "١٢ ملفًا"), <IconDoc size={16} key="a" />],
    [t("My orders", "طلباتي"), `${vehicles.length} ${t("active", "نشط")}`, <IconOrders size={16} key="b" />],
    [t("Drivers", "السائقون"), t("Contact list", "قائمة التواصل"), <IconDriver size={16} key="c" />],
    [t("Support", "الدعم"), t("24/7 · 920 000 111", "٢٤/٧ · ٩٢٠٠٠٠١١١"), <IconPhone size={16} key="d" />],
  ];

  return (
    <div className="relative h-full w-full overflow-hidden bg-paper text-navy">
      <div className="scroll-thin absolute inset-0 overflow-y-auto pb-24">
        <div className="flex flex-col items-center px-5 pt-16 pb-6">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-brand/15 text-[22px] font-semibold text-brand">
            NF
          </span>
          <div className="mt-3 text-[17px] font-medium">{t("Noura Al-Faisal", "نورة الفيصل")}</div>
          <div className="text-[11.5px] text-navy/55">noura@rajhi-logistics.sa</div>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-navy/8 px-3 py-1.5 text-[11px]">
            <IconStar size={12} className="text-status-waiting" />
            {t("Gold partner · since 2022", "شريك ذهبي · منذ ٢٠٢٢")}
          </div>
        </div>

        <div className="mx-4 grid grid-cols-3 gap-2.5">
          {[
            [t("Shipments", "الشحنات"), vehicles.length],
            [t("On Route", "على الطريق"), vehicles.filter((x) => x.status === "active").length],
            [t("Delivered", "تم التسليم"), 148],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-[14px] bg-navy/8 p-3 text-center">
              <div className="text-[19px] font-semibold tabular-nums">{v}</div>
              <div className="mt-0.5 text-[10px] text-navy/55">{k}</div>
            </div>
          ))}
        </div>

        <div className="mx-4 mt-4 overflow-hidden rounded-[16px] bg-navy/8">
          {rows.map(([label, meta, icon]) => (
            <button
              key={label}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors duration-200 active:bg-navy/12"
            >
              <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-navy text-white">
                {icon}
              </span>
              <span className="flex-1 text-[12.5px] font-medium">{label}</span>
              <span className="text-[10.5px] text-navy/50">{meta}</span>
              <IconArrowRight size={15} className="text-navy/35" />
            </button>
          ))}
        </div>

        <div className="mx-4 mt-4 rounded-[16px] bg-navy p-4 text-white">
          <div className="text-[12.5px] font-medium">
            {t("Need a new truck? 🚚", "تحتاج شاحنة جديدة؟ 🚚")}
          </div>
          <div className="mt-1 text-[11px] text-white/65">
            {t(
              "Request a vehicle in under a minute from the EJAZ console.",
              "اطلب مركبة في أقل من دقيقة من لوحة إيجاز.",
            )}
          </div>
          <button className="mt-3 rounded-full bg-accent-2 px-4 py-2 text-[11.5px] font-semibold text-white transition-transform duration-200 active:scale-95">
            {t("Create request", "إنشاء طلب")}
          </button>
        </div>
      </div>

      <TabBar tab={tab} onTab={onTab} />
    </div>
  );
}
