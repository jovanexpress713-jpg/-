import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import type { Vehicle } from "../data/types";

export type RealityEnvironmentMode = "auto" | "desert" | "rain" | "night";

interface RealityEnvironmentProps {
  vehicle: Vehicle;
  children: React.ReactNode;
}

function modeFromVehicle(vehicle: Vehicle): Exclude<RealityEnvironmentMode, "auto"> {
  if (vehicle.status === "inactive") return "night";
  if (Number(vehicle.speed) <= 0) return "desert";
  return "desert";
}

export function RealityEnvironment({ vehicle, children }: RealityEnvironmentProps) {
  const { t } = useSettings();
  const [mode, setMode] = useState<RealityEnvironmentMode>("auto");
  const effectiveMode = mode === "auto" ? modeFromVehicle(vehicle) : mode;
  const isSimulation = mode !== "auto";

  const labels = useMemo(() => ({
    auto: t("Live / data-driven", "حي / حسب البيانات"),
    desert: t("Desert road", "طريق صحراوي"),
    rain: t("Rain", "أجواء ممطرة"),
    night: t("Night drive", "قيادة ليلية"),
  }), [t]);

  return (
    <div className="relative isolate min-w-0 overflow-hidden">
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 transition-all duration-700",
          effectiveMode === "desert" && "bg-[radial-gradient(circle_at_65%_12%,rgba(245,158,11,.16),transparent_34%),linear-gradient(180deg,rgba(245,158,11,.06),transparent_42%)]",
          effectiveMode === "rain" && "bg-[linear-gradient(180deg,rgba(59,130,246,.12),transparent_58%)]",
          effectiveMode === "night" && "bg-[radial-gradient(circle_at_50%_5%,rgba(99,102,241,.15),transparent_36%),linear-gradient(180deg,rgba(15,23,42,.35),transparent 60%)]",
        )}
      />

      {effectiveMode === "rain" && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-30">
          <div className="ejaz-rain ejaz-rain-a" />
          <div className="ejaz-rain ejaz-rain-b" />
          <div className="ejaz-rain ejaz-rain-c" />
        </div>
      )}

      {effectiveMode === "desert" && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-24 bg-[linear-gradient(180deg,transparent,rgba(217,119,6,.08))]" />
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-1/80 p-2 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2 px-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-brand shadow-[0_0_14px_rgba(255,138,0,.65)]" />
          <div className="min-w-0">
            <div className="truncate text-micro font-bold uppercase tracking-[.14em] text-text-muted">EJAZ Reality Environment</div>
            <div className="truncate text-label font-semibold text-text-primary">{labels[mode]}</div>
          </div>
          {isSimulation && <span className="rounded-full border border-status-waiting/20 bg-status-waiting/10 px-2 py-1 text-[10px] font-bold text-status-waiting">{t("SIMULATION", "محاكاة")}</span>}
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto p-0.5">
          {(Object.keys(labels) as RealityEnvironmentMode[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                "min-h-9 shrink-0 rounded-full px-3 text-micro font-bold transition-all",
                mode === id ? "bg-brand text-on-brand" : "bg-surface-2 text-text-secondary hover:text-text-primary",
              )}
            >
              {labels[id]}
            </button>
          ))}
        </div>
      </div>

      {children}
    </div>
  );
}
