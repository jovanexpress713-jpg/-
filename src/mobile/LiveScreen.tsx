import { useEffect, useState } from "react";
import { useSettings } from "../settings";
import { AERIAL_NIGHT } from "../data/catalog";
import type { Vehicle } from "../data/types";
import { liveOf, useElapsed, useTicker } from "../hooks";
import {
  IconArrowLeft,
  IconInfo,
  IconPin,
  IconStraight,
  IconTurnLeft,
  IconTurnRight,
} from "../components/Icons";

export function LiveScreen({
  v,
  onBack,
  onInfo,
}: {
  v: Vehicle;
  onBack: () => void;
  onInfo: () => void;
}) {
  const { t } = useSettings();
  const now = useTicker(1000);
  const elapsed = useElapsed(now);
  const live = liveOf(v, elapsed);
  const [unit, setUnit] = useState<"km/h" | "mph">("km/h");
  const [move, setMove] = useState(0);

  const MOVES: [typeof IconTurnLeft, string, string][] = [
    [IconTurnLeft, "Turn left", "اتجه يسارًا"],
    [IconStraight, "Go straight", "واصل للأمام"],
    [IconTurnRight, "Turn right", "اتجه يمينًا"],
  ];

  useEffect(() => {
    const id = window.setInterval(() => setMove((m) => (m + 1) % MOVES.length), 6000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speed = unit === "km/h" ? live.speed : live.speed * 0.6214;
  const dist = Math.max(40, 900 - (elapsed % 45) * 18);
  const [Icon, en, ar] = MOVES[move];

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <img
        src={AERIAL_NIGHT}
        alt=""
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-95"
      />
      <div className="absolute inset-x-0 top-0 h-[52%] bg-gradient-to-b from-black/90 via-black/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/95 via-black/45 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-black/70 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-black/50 to-transparent" />

      <div className="relative z-10 flex h-full flex-col px-5 pt-14 pb-16">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all duration-200 active:scale-90"
            aria-label="Back"
          >
            <IconArrowLeft size={17} />
          </button>
          <div className="flex-1">
            <div className="text-[10.5px] tracking-[0.14em] text-white/55 uppercase">
              {t("Tracking", "تتبع")}
            </div>
            <div className="text-[13px] font-semibold tabular-nums text-white">{v.shipment}</div>
          </div>
          <button
            onClick={onInfo}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all duration-200 active:scale-90"
            aria-label="Info"
          >
            <IconInfo size={17} />
          </button>
        </div>

        <div className="flex-1" />

        <div className="mx-auto flex items-center gap-3 rounded-full bg-white/10 px-4 py-2.5 backdrop-blur-xl">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-2 text-white">
            <Icon size={16} />
          </span>
          <span className="text-[12.5px] font-medium text-white">{t(en, ar)}</span>
          <span className="text-[11.5px] tabular-nums text-white/60">
            {t("in", "بعد")} {Math.round(dist)} {t("m", "م")}
          </span>
        </div>

        <div className="mt-7 flex items-end justify-between">
          <div className="max-w-[52%]">
            <div className="flex items-center gap-1.5 text-white/60">
              <IconPin size={13} className="text-accent-2" />
              <span className="text-[10.5px] tracking-[0.14em] uppercase">
                {t("Current", "الموقع الحالي")}
              </span>
            </div>
            <div className="mt-1 text-[13px] font-medium text-white">
              {v.stops[Math.min(1, v.stops.length - 1)].name}
            </div>
            <div className="text-[11px] text-white/55">
              {v.brand} {v.model} · {v.cab}
            </div>
          </div>

          <button
            onClick={() => setUnit((u) => (u === "km/h" ? "mph" : "km/h"))}
            className="text-end transition-transform duration-200 active:scale-95"
            title={t("Tap to switch unit", "اضغط لتغيير الوحدة")}
          >
            <div className="text-[64px] leading-none font-semibold tabular-nums text-white">
              {Math.round(speed)}
            </div>
            <div className="mt-1 text-[11px] tracking-[0.16em] text-white/55 uppercase">
              {unit} ⇅
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
