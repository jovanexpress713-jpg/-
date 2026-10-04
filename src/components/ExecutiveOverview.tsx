import { useState } from "react";
import { useSettings } from "../settings";
import { useFleetStore } from "../state/fleetStore";
import { useToast } from "./Toast";
import { IconMenu } from "./Icons";
import { KpiCards } from "./overview/KpiCards";
import { CargoDonut } from "./overview/CargoDonut";
import { TripBars } from "./overview/TripBars";
import { TrackingPanel } from "./overview/TrackingPanel";
import { TruckCapacity } from "./overview/TruckCapacity";
import { RouteEfficiency } from "./overview/RouteEfficiency";
import { ActivitiesTable } from "./overview/ActivitiesTable";
import type { StatusGroup } from "./overview/shared";

interface Props {
  userName?: string;
  onOpenSidebar?: () => void;
  onOpenTripDetails?: (tripId: string) => void;
}

function greeting(t: (en: string, ar: string) => string) {
  const h = new Date().getHours();
  if (h < 12) return t("Good morning", "صباح الخير");
  if (h < 18) return t("Good afternoon", "مساء الخير");
  return t("Good evening", "مساء النور");
}

export function ExecutiveOverview({ userName, onOpenSidebar, onOpenTripDetails }: Props) {
  const { t } = useSettings();
  const toast = useToast();
  const { trips, trucks, drivers, selectedTripId, selectTrip, selectTruck, isSimulating, toggleSimulation } = useFleetStore();
  const [group, setGroup] = useState<StatusGroup | "all">("all");

  const selected = trips.find((tr) => tr.id === selectedTripId) ?? trips[0];

  const handleSelect = (id: string) => {
    selectTrip(id);
    const tr = trips.find((x) => x.id === id);
    if (tr) selectTruck(tr.truckId);
  };

  const onToast = (text: string, sub?: string) => toast(text, sub);

  if (!selected) {
    return (
      <div className="grid h-full place-items-center p-6 text-[13px] text-text-muted">
        {t("No shipments yet.", "لا توجد شحنات بعد.")}
      </div>
    );
  }

  const truck = trucks.find((v) => v.id === selected.truckId);
  const driverName = drivers.find((d) => d.id === selected.driverId)?.name;

  return (
    <div className="scroll-thin h-full overflow-y-auto bg-surface-0">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-4 lg:p-6">
        <header className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-start gap-3">
            {onOpenSidebar && (
              <button onClick={onOpenSidebar} className="btn-icon mt-1 lg:hidden" aria-label={t("Menu", "القائمة")}>
                <IconMenu size={17} />
              </button>
            )}
            <div>
              <p className="text-[15px] text-text-secondary">
                {greeting(t)}
                {userName ? `، ${userName}` : ""}
              </p>
              <h1 className="mt-1 text-balance text-[30px] leading-tight font-semibold text-text-primary lg:text-[36px]">
                {t("Logistics Dashboard", "لوحة الخدمات اللوجستية")}
              </h1>
            </div>
          </div>
          <button
            onClick={toggleSimulation}
            aria-pressed={isSimulating}
            className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-2 px-4 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
          >
            <span className={isSimulating ? "h-2 w-2 animate-pulse-dot rounded-full bg-status-active text-status-active" : "h-2 w-2 rounded-full bg-status-inactive"} />
            {isSimulating ? t("Live telemetry on", "البث المباشر يعمل") : t("Live telemetry paused", "البث المباشر متوقف")}
          </button>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-4">
            <KpiCards trips={trips} activeGroup={group} onGroup={setGroup} />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <CargoDonut trips={trips} />
              <TripBars trips={trips} selectedId={selected.id} onSelect={handleSelect} />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <TrackingPanel trip={selected} trips={trips} onSelect={handleSelect} onOpenDetails={onOpenTripDetails} />
            {/* Spec §4.6 — the single orange card in the console. */}
            <RouteEfficiency trip={selected} />
          </div>
        </div>

        <TruckCapacity
          trip={selected}
          truck={truck}
          driverName={driverName}
          onChangeRoute={onOpenTripDetails ? () => onOpenTripDetails(selected.id) : undefined}
        />

        <ActivitiesTable
          trips={trips}
          drivers={drivers}
          selectedId={selected.id}
          group={group}
          onGroup={setGroup}
          onSelect={handleSelect}
          onToast={onToast}
        />
      </div>
    </div>
  );
}
