import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { BODY_TYPES, PHOTO_REPORTS } from "../data/catalog";
import type { Comment, DocState, Vehicle } from "../data/types";
import type { Live } from "../hooks";
import { formatCountdown, useCountUp } from "../hooks";
import { StatusChip } from "./StatusChip";
import { CapacityGauge } from "./CapacityGauge";
import { MapPanel } from "./MapPanel";
import { Gallery } from "./Gallery";
import { useToast } from "./Toast";
import { Vehicle3DViewer } from "./Vehicle3DViewer";
import { getVehicleTypeMeta } from "../data/vehicleTypes";
import {
  IconArrowRight,
  IconCheck,
  IconClose,
  IconDoc,
  IconFuel,
  IconGauge,
  IconMessage,
  IconPhone,
  IconPin,
  IconStar,
  IconThermo,
  IconWeight,
} from "./Icons";

type Tab = "overview" | "vehicle" | "documents" | "comments";

const REPLIES: [string, string][] = [
  ["Copy that, ETA unchanged.", "تم الاستلام، الموعد كما هو."],
  ["Load is secured, straps checked.", "الحمولة مثبّتة والحمالات مفحوصة."],
  ["Stopping for fuel in 20 minutes.", "سأتوقف للوقود خلال ٢٠ دقيقة."],
  ["Temperature holding steady.", "درجة الحرارة ثابتة."],
  ["Approaching the next hub now.", "اقتربت من المحطة التالية."],
];

function Ring({
  value,
  label,
  suffix,
  icon,
}: {
  value: number;
  label: string;
  suffix: string;
  icon: React.ReactNode;
}) {
  const pct = useCountUp(value, 1200);
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-[58px] w-[58px]">
        <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90">
          <circle cx="24" cy="24" r={r} className="stroke-surface-5" strokeWidth="3" fill="none" />
          <circle
            cx="24"
            cy="24"
            r={r}
            className="stroke-brand"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            style={{
              strokeDasharray: c,
              strokeDashoffset: c * (1 - Math.min(100, pct) / 100),
            }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-text-secondary">{icon}</span>
      </div>
      <div className="text-center">
        <div className="text-[13px] font-medium tabular-nums text-text-primary">
          {Math.round(pct)}
          {suffix}
        </div>
        <div className="text-[10.5px] text-text-muted">{label}</div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[8px] bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-text-muted">
        {icon}
        <span className="text-[10.5px] tracking-wide uppercase">{label}</span>
      </div>
      <div className="mt-1.5 text-[15px] font-medium tabular-nums text-text-primary">{value}</div>
    </div>
  );
}

export function DetailsPanel({
  v,
  live,
  onClose,
}: {
  v: Vehicle;
  live: Live;
  onClose?: () => void;
}) {
  const { t } = useSettings();
  const [tab, setTab] = useState<Tab>("overview");
  const [docs, setDocs] = useState<DocState[]>(v.docs);
  const [msgs, setMsgs] = useState<Comment[]>(v.comments);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const toast = useToast();

  useEffect(() => {
    setTab("overview");
    setDocs(v.docs.map((d) => ({ ...d })));
    setMsgs(v.comments);
  }, [v.id, v.docs, v.comments]);

  const bodyLabel = BODY_TYPES.find((b) => b.id === v.body)?.label ?? v.body;
  const photos = useMemo(
    () => v.photos.map((i) => PHOTO_REPORTS[i]).filter(Boolean),
    [v.photos],
  );

  const TABS: [Tab, string, string][] = [
    ["overview", "Overview", "نظرة عامة"],
    ["vehicle", "Vehicle Info", "بيانات المركبة"],
    ["documents", "Documents", "المستندات"],
    ["comments", "Comments", "المحادثة"],
  ];

  const syncDoc = (i: number) => {
    setDocs((d) => d.map((doc, idx) => (idx === i ? { ...doc, state: "loading" } : doc)));
    window.setTimeout(() => {
      setDocs((d) => d.map((doc, idx) => (idx === i ? { ...doc, state: "done" } : doc)));
      toast(t("Document synced", "تمت مزامنة المستند"), docs[i]?.name);
    }, 1200);
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setMsgs((m) => [...m, { from: "me", text, time }]);
    setDraft("");
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      const r = REPLIES[Math.floor(Math.random() * REPLIES.length)];
      setMsgs((m) => [...m, { from: "driver", text: t(r[0], r[1]), time }]);
    }, 2200);
  };

  return (
    <div className="flex h-full flex-col bg-surface-2">
      <div className="border-b border-border-subtle px-5 pt-5 pb-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-[26px] leading-tight font-medium tabular-nums text-text-primary">
                {v.shipment}
              </h2>
              <StatusChip status={v.status} />
            </div>
            <p className="mt-1 text-[12px] text-text-muted">
              {v.brand} {v.model} · {bodyLabel} · {v.hp} {t("hp", "حصان")}
            </p>
          </div>
          {onClose && (
            <button onClick={onClose} className="btn-icon xl:hidden" aria-label="Close">
              <IconClose size={16} />
            </button>
          )}
        </div>

        <div className="relative mt-4 flex">
          {TABS.map(([id, en, ar]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "relative flex-1 pb-2.5 text-[12.5px] transition-colors duration-200",
                tab === id ? "text-text-primary" : "text-text-muted hover:text-text-secondary",
              )}
            >
              {t(en, ar)}
            </button>
          ))}
          <span
            className="absolute bottom-0 h-[2px] rounded-full bg-brand transition-all duration-300 ease-out glow-brand"
            style={{
              width: `${100 / TABS.length}%`,
              insetInlineStart: `${(TABS.findIndex(([id]) => id === tab) * 100) / TABS.length}%`,
            }}
          />
        </div>
      </div>

      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4">
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              <Stat
                label={t("ETA", "الوصول")}
                value={v.status === "inactive" ? "—" : formatCountdown(live.etaSeconds)}
                icon={<IconGauge size={13} />}
              />
              <Stat
                label={t("Distance", "المسافة")}
                value={`${Math.round(live.miles).toLocaleString()} ${t("mi", "ميل")}`}
                icon={<IconPin size={13} />}
              />
              <Stat
                label={t("Speed", "السرعة")}
                value={`${Math.round(live.speed)} ${t("km/h", "كم/س")}`}
                icon={<IconArrowRight size={13} />}
              />
              <Stat
                label={t("Stops", "المحطات")}
                value={`${v.stops.filter((s) => s.done).length}/${v.stops.length}`}
                icon={<IconWeight size={13} />}
              />
            </div>

            <CapacityGauge load={v.load} maxLoad={v.maxLoad} />

            <MapPanel
              from={v.from}
              to={v.to}
              progress={live.progress}
              className="h-[248px]"
            />

            <div className="card flex items-center gap-3 p-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-5 text-[13px] font-semibold text-text-primary">
                {v.driver.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium text-text-primary">
                  {v.driver.name}
                </div>
                <div className="flex items-center gap-1.5 truncate text-[11px] tabular-nums text-text-muted">
                  <span>{v.driver.phone}</span>
                  <span>·</span>
                  <span>
                    {v.driver.trips} {t("trips", "رحلة")}
                  </span>
                  <span className="inline-flex items-center gap-1 text-status-waiting">
                    <IconStar size={11} />
                    {v.driver.rating}
                  </span>
                </div>
              </div>
              <button
                onClick={() => toast(t("Connecting call…", "جارٍ الاتصال…"), v.driver.name)}
                className="btn-icon"
                aria-label="Call driver"
              >
                <IconPhone size={16} />
              </button>
              <button
                onClick={() => setTab("comments")}
                className="btn-icon"
                aria-label="Message driver"
              >
                <IconMessage size={16} />
              </button>
            </div>

            <Gallery items={photos} />
          </>
        )}

        {tab === "vehicle" && (
          <>
            <div className="relative overflow-hidden rounded-[12px] bg-surface-1 border border-border-subtle p-3">
              <div className="h-[210px] w-full rounded-[8px] overflow-hidden bg-surface-2 border border-white/5">
                <Vehicle3DViewer
                  vehicleType={v.body}
                  vehiclePlate={v.plate}
                  previewMode={false}
                  height="100%"
                  compact={true}
                />
              </div>
              <div className="relative flex items-end justify-between mt-3 px-1">
                <div>
                  <div className="text-[17px] font-bold text-text-primary">{v.model}</div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    {v.brand} · {v.cab} · <span className="text-brand font-semibold">{getVehicleTypeMeta(v.body).arabicName}</span>
                  </div>
                </div>
                <span className="badge bg-brand/15 text-brand">{v.year}</span>
              </div>
            </div>

            <div className="card flex items-center justify-around p-4">
              <Ring value={v.fuel} label={t("Fuel", "الوقود")} suffix="%" icon={<IconFuel size={18} />} />
              <Ring
                value={Math.min(100, v.engineTemp)}
                label={t("Engine", "المحرك")}
                suffix="°"
                icon={<IconThermo size={18} />}
              />
              {v.boxTemp !== undefined ? (
                <Ring
                  value={Math.min(100, Math.abs(v.boxTemp) * 4)}
                  label={t("Box temp", "حرارة الصندوق")}
                  suffix="°"
                  icon={<IconThermo size={18} />}
                />
              ) : (
                <Ring
                  value={(v.load / v.maxLoad) * 100}
                  label={t("Load", "الحمولة")}
                  suffix="%"
                  icon={<IconWeight size={18} />}
                />
              )}
            </div>

            <div className="card divide-y divide-border-subtle px-4">
              {(
                [
                  [t("Body type", "نوع الهيكل"), bodyLabel],
                  [t("Engine power", "قوة المحرك"), `${v.hp} ${t("hp", "حصان")}`],
                  [t("Odometer", "عداد المسافة"), `${v.odometer.toLocaleString()} ${t("km", "كم")}`],
                  [t("Plate", "رقم اللوحة"), v.plate],
                  [t("Fuel level", "مستوى الوقود"), `${v.fuel}%`],
                  [t("Engine temp", "حرارة المحرك"), `${v.engineTemp} °C`],
                  ...(v.boxTemp !== undefined
                    ? [[t("Box temp", "حرارة الصندوق"), `${v.boxTemp} °C`]]
                    : []),
                  [t("Payload", "الحمولة"), `${v.load} ${t("t", "طن")} / ${v.maxLoad} ${t("t", "طن")}`],
                  [t("Owner", "الجهة المالكة"), v.partner],
                ] as [string, string][]
              ).map(([k, val]) => (
                <div key={k} className="flex items-center justify-between py-2.5">
                  <span className="text-[12px] text-text-muted">{k}</span>
                  <span className="text-[12.5px] tabular-nums text-text-primary">{val}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "documents" && (
          <div className="space-y-2">
            {docs.map((d, i) => (
              <div key={d.name} className="card flex items-center gap-3 p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-surface-4 text-text-secondary">
                  <IconDoc size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-text-primary">{d.name}</div>
                  <div className="truncate text-[10.5px] tabular-nums text-text-muted">{d.meta}</div>
                </div>
                <button
                  onClick={() => syncDoc(i)}
                  disabled={d.state !== "idle"}
                  className={cn(
                    "btn h-8 w-8",
                    d.state === "done"
                      ? "bg-status-active/15 text-status-active"
                      : "btn-icon-sm bg-surface-4",
                  )}
                  aria-label={`Sync ${d.name}`}
                >
                  {d.state === "loading" && (
                    <svg
                      className="animate-spin"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    >
                      <path d="M12 3a9 9 0 1 0 9 9" />
                    </svg>
                  )}
                  {d.state === "done" && <IconCheck size={15} />}
                  {d.state === "idle" && <IconArrowRight size={15} />}
                </button>
              </div>
            ))}
            <p className="px-1 pt-1 text-[10.5px] text-text-muted">
              {t(
                "Documents refresh automatically every 15 minutes.",
                "تُحدَّث المستندات تلقائيًا كل ١٥ دقيقة.",
              )}
            </p>
          </div>
        )}

        {tab === "comments" && (
          <div className="flex min-h-[420px] flex-col">
            <div className="scroll-thin flex-1 space-y-3 overflow-y-auto">
              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[78%] rounded-[12px] px-3 py-2",
                      m.from === "me"
                        ? "bg-brand text-on-brand"
                        : "bg-surface-4 text-text-primary",
                    )}
                  >
                    <div className="text-[12.5px] leading-snug">{m.text}</div>
                    <div
                      className={cn(
                        "mt-1 text-[10px] tabular-nums",
                        m.from === "me" ? "text-on-brand/60" : "text-text-muted",
                      )}
                    >
                      {m.time}
                    </div>
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-[12px] bg-surface-4 px-3 py-2.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted"
                        style={{ animationDelay: `${i * 120}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={t(
                  `Message ${v.driver.name.split(" ")[0]}…`,
                  `راسل ${v.driver.name.split(" ")[0]}…`,
                )}
                className="field"
              />
              <button onClick={send} className="btn-primary h-10 px-4">
                {t("Send", "إرسال")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
