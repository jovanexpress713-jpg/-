import { useSettings } from "../../settings";
import type { Trip } from "../../state/fleetStore";
import type { Vehicle } from "../../data/types";
import { formatCountdown } from "../../hooks";
import { CapacityTruck } from "../CapacityTruck";
import { RouteMap } from "../RouteMap";
import { IconPencil } from "../Icons";
import { loadPct, useCountUp } from "./shared";

interface Props {
  trip: Trip;
  truck?: Vehicle;
  driverName?: string;
  onChangeRoute?: () => void;
}

const KM_TO_MI = 0.621371;

/**
 * The single live tracking component.
 *
 * Visual hierarchy, in the order the reference reads:
 *   1. Current Truck Capacity
 *   2. the long-haul semi
 *   3. the capacity fill inside its trailer
 *   4. the figure centred inside the filled region
 *   5. the Route header
 *   6. the wide dark map, its blue route, the current truck and the controls
 *
 * The truck and the map are deliberately in ONE section, not two cards — the
 * marker on the map is a miniature of the same vehicle drawn above it.
 */
export function TruckCapacity({ trip, truck, driverName, onChangeRoute }: Props) {
  const { t } = useSettings();
  const pct = loadPct(trip);
  /* Counts up over 400ms, so the fill and the figure move together. */
  const shown = useCountUp(pct, 400);
  const milesLeft = Math.round(trip.distanceRemainingKm * KM_TO_MI);

  return (
    <section className="card card-in flex flex-col gap-5 overflow-hidden">
      {/* ── 1. Heading ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="card-title">{t("Current Truck Capacity", "سعة الشاحنة الحالية")}</h2>
          {driverName && (
            <p className="label-sm mt-1">
              {truck?.plate ?? "—"} · {driverName}
            </p>
          )}
        </div>
        <span className="pill pill-brand shrink-0">#{trip.tripNumber}</span>
      </div>

      {/* ── 2–4. The truck, with its capacity inside the trailer ───────── */}
      <div key={trip.id} className="relative">
        <CapacityTruck
          pct={shown}
          label={t(
            `Truck load ${Math.round(pct)} percent of ${trip.maxCapacityTons} tonnes`,
            `حمولة الشاحنة ${Math.round(pct)} بالمئة من ${trip.maxCapacityTons} طن`,
          )}
        />
        {/* Integrated responsive load HUD over the trailer area. */}
        <div className="pointer-events-none absolute left-[31%] right-[5%] top-[10%] z-10 rounded-xl border border-cyan-300/30 bg-[#061323]/90 p-2 text-white shadow-[0_0_24px_rgba(14,165,233,0.16)] backdrop-blur-sm sm:rounded-2xl sm:p-3" aria-label={t("Integrated load indicator", "مؤشر الحمولة المدمج")}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-micro font-bold tracking-wide text-cyan-200 sm:text-xs">{t("LOAD CAPACITY", "مؤشر الحمولة")}</span>
            <span className={`text-base font-black tabular-nums sm:text-2xl ${shown >= 90 ? "text-rose-300" : shown >= 75 ? "text-amber-300" : "text-emerald-300"}`}>{Math.round(shown)}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full border border-cyan-300/25 bg-slate-800 sm:mt-2 sm:h-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shown)} aria-label={t("Load percentage", "نسبة الحمولة")}>
            <div className={`h-full rounded-full transition-[width] duration-500 ${shown >= 90 ? "bg-gradient-to-r from-amber-400 to-rose-500" : "bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-300"}`} style={{ width: `${Math.max(0, Math.min(100, shown))}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-3 divide-x divide-cyan-200/15 text-center [direction:rtl] sm:mt-3">
            <div className="px-1"><div className="text-micro text-slate-300 sm:text-micro">{t("Current load", "الحمولة الحالية")}</div><div className="mt-0.5 text-micro font-bold tabular-nums sm:text-sm">{(trip.maxCapacityTons * shown / 100).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-micro font-medium text-cyan-200 sm:text-micro">{t("t", "طن")}</span></div></div>
            <div className="px-1"><div className="text-micro text-slate-300 sm:text-micro">{t("Max capacity", "السعة القصوى")}</div><div className="mt-0.5 text-micro font-bold tabular-nums sm:text-sm">{trip.maxCapacityTons.toLocaleString()} <span className="text-micro font-medium text-cyan-200 sm:text-micro">{t("t", "طن")}</span></div></div>
            <div className="px-1"><div className="text-micro text-slate-300 sm:text-micro">{t("Remaining", "المتبقي")}</div><div className="mt-0.5 text-micro font-bold tabular-nums sm:text-sm">{(trip.maxCapacityTons * (100 - shown) / 100).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-micro font-medium text-cyan-200 sm:text-micro">{t("t", "طن")}</span></div></div>
          </div>
        </div>
      </div>

      {/* ── 5–6. Route header, then the map ────────────────────────────── */}
      <div className="border-t border-border-subtle pt-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h3 className="card-title">{t("Route", "المسار")}</h3>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="num text-body text-text-primary">
              {formatCountdown(trip.etaMinutes * 60)}
            </span>
            <span className="num text-body text-text-secondary">
              {milesLeft.toLocaleString()} {t("mi left", "ميل متبقٍ")}
            </span>
            <button
              onClick={onChangeRoute}
              disabled={!onChangeRoute}
              className="inline-flex items-center gap-1.5 text-body font-semibold text-brand transition-colors hover:text-brand-soft disabled:cursor-not-allowed disabled:opacity-45"
            >
              <IconPencil size={14} />
              {t("Change Route", "تغيير المسار")}
            </button>
          </div>
        </div>

        <div className="mt-3">
          <RouteMap
            fromCity={trip.originCity}
            toCity={trip.destinationCity}
            progressPct={trip.progressPct}
            corridorKey={trip.corridorKey}
          />
        </div>
      </div>
    </section>
  );
}
