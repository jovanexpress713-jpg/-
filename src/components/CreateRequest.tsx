import { useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { BODY_TYPES, BRANDS, PARTNERS, docsFor } from "../data/catalog";
import type { BodyType, Brand, RequestKind, Vehicle } from "../data/types";
import { IconClose } from "./Icons";
import { TruckTypeIcon } from "./TruckTypeIcon";

export const DRIVER_POOL = [
  { name: "Ali Al-Shammari", phone: "+966 55 901 4472", initials: "AS", rating: 4.8, trips: 212 },
  { name: "Bilal Ahmad", phone: "+966 56 774 1180", initials: "BA", rating: 4.6, trips: 143 },
  { name: "Rashid Khan", phone: "+966 59 220 6684", initials: "RK", rating: 4.7, trips: 98 },
];

const HP: Record<Brand, number> = {
  "Mercedes-Benz": 510,
  Volvo: 500,
  Scania: 500,
  MAN: 510,
  DAF: 480,
  Iveco: 570,
};

interface Props {
  initialKind: RequestKind;
  onClose: () => void;
  onCreate: (v: Vehicle) => void;
}

export function CreateRequest({ initialKind, onClose, onCreate }: Props) {
  const { t } = useSettings();
  const [kind, setKind] = useState<RequestKind>(initialKind);
  const [brand, setBrand] = useState<Brand>("Mercedes-Benz");
  const [model, setModel] = useState(BRANDS[0].models[0]);
  const [body, setBody] = useState<BodyType>("curtain");
  const [partner, setPartner] = useState(PARTNERS[0]);
  const [from, setFrom] = useState("Riyadh");
  const [to, setTo] = useState("Jeddah");
  const [loadPct, setLoadPct] = useState(62);

  const KINDS: [RequestKind, string, string][] = [
    ["truck", "Truck", "شاحنة"],
    ["cargo", "Cargo", "شحنة"],
    ["repair", "Repair", "صيانة"],
    ["driver", "Driver", "سائق"],
    ["report", "Report", "تقرير"],
  ];

  const submit = () => {
    const prefix = BRANDS.find((b) => b.id === brand)!.prefix;
    const maxLoad = 25;
    const d = DRIVER_POOL[Math.floor(Math.random() * DRIVER_POOL.length)];
    const v: Vehicle = {
      id: `n${Date.now()}`,
      shipment: `${prefix}-${Math.floor(100000000 + Math.random() * 899999999)}`,
      brand,
      model,
      cab: t("New assignment", "مهمة جديدة"),
      body,
      status: "active",
      hp: HP[brand],
      odometer: 12000 + Math.floor(Math.random() * 90000),
      year: 2024,
      plate: `NEW ${Math.floor(1000 + Math.random() * 8999)}`,
      fuel: 100,
      engineTemp: 90,
      boxTemp: body === "reefer" ? -18 : undefined,
      load: +((maxLoad * loadPct) / 100).toFixed(1),
      maxLoad,
      speed: 82,
      etaMinutes: 240,
      milesLeft: 1420,
      progress: 2,
      driver: d,
      partner,
      from: from || "Riyadh",
      to: to || "Jeddah",
      stops: [
        { name: from || "Riyadh", place: t("Loaded", "تم التحميل"), done: true },
        { name: t("Transit hub", "محطة عبور"), place: t("In transit", "في الطريق"), done: false },
        { name: to || "Jeddah", place: t("Scheduled", "مجدولة"), done: false },
      ],
      route: "r1",
      photos: [0, 1, 2],
      comments: [
        {
          from: "me",
          text: t(
            "New request created, please confirm pickup.",
            "تم إنشاء الطلب، يرجى تأكيد الاستلام.",
          ),
          time: "09:00",
        },
      ],
      docs: docsFor(body).map((name) => ({
        name,
        meta: t("PDF · pending", "PDF · بانتظار المراجعة"),
        state: "idle" as const,
      })),
    };
    onCreate(v);
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up scroll-thin max-h-[90vh] w-full max-w-[580px] overflow-y-auto rounded-panel bg-surface-3 p-5"
        style={{
          boxShadow:
            "0 40px 90px -30px color-mix(in oklab, var(--color-brand) 35%, transparent), 0 0 0 1px var(--color-border-subtle)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-headline font-medium text-text-primary">
              {t("Create new Request", "إنشاء طلب جديد")}
            </h3>
            <p className="mt-0.5 text-label-lg text-text-muted">
              {t(
                "Dispatch a vehicle to the fleet and start tracking instantly.",
                "أضف مركبة إلى الأسطول وابدأ التتبع فورًا.",
              )}
            </p>
          </div>
          <button onClick={onClose} className="btn-icon" aria-label={t("Close", "إغلاق")}>
            <IconClose size={16} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <Label>{t("Request type", "نوع الطلب")}</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {KINDS.map(([id, en, ar]) => (
                <button
                  key={id}
                  onClick={() => setKind(id)}
                  className={cn("chip", kind === id && "chip-on")}
                >
                  {t(en, ar)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("Brand", "الماركة")}</Label>
              <select
                value={brand}
                onChange={(e) => {
                  const b = e.target.value as Brand;
                  setBrand(b);
                  setModel(BRANDS.find((x) => x.id === b)!.models[0]);
                }}
                className="field mt-1.5"
              >
                {BRANDS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t("Model", "الموديل")}</Label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="field mt-1.5"
              >
                {BRANDS.find((b) => b.id === brand)!.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label>{t("Body type", "نوع الهيكل")}</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {BODY_TYPES.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBody(b.id)}
                  className={cn("chip flex items-center gap-1.5", body === b.id && "chip-on")}
                >
                  <TruckTypeIcon truckType={b.id} size={15} />
                  <span>{t(b.label[0], b.label[1])}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>{t("Partner", "الشريك")}</Label>
            <select
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
              className="field mt-1.5"
            >
              {PARTNERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("Loading address", "عنوان التحميل")}</Label>
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="field mt-1.5"
                placeholder={t("Riyadh · Gate 3", "الرياض · البوابة ٣")}
              />
            </div>
            <div>
              <Label>{t("Unloading address", "عنوان التفريغ")}</Label>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="field mt-1.5"
                placeholder={t("Jeddah · Terminal 12", "جدة · الرصيف ١٢")}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>{t("Load ratio", "نسبة الحمولة")}</Label>
              <span className="text-label-lg font-medium tabular-nums text-brand">{loadPct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={loadPct}
              onChange={(e) => setLoadPct(+e.target.value)}
              className="range mt-3"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">
            {t("Cancel", "إلغاء")}
          </button>
          <button onClick={submit} className="btn-primary px-5 flex items-center gap-2">
            <TruckTypeIcon truckType={body} size={16} />
            <span>{t("Create request", "إنشاء الطلب")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-label tracking-wide text-text-muted uppercase">{children}</span>
  );
}
