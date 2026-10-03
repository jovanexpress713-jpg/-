import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore, type Trip } from "../state/fleetStore";
import { getVehicleTypeMeta } from "../data/vehicleTypes";
import {
  IconSearch,
  IconClose,
  IconTruck,
  IconDoc,
  IconProfile,
} from "./Icons";

interface GlobalSearchProps {
  onNavigate: (targetView: string, entityId?: string) => void;
  className?: string;
}

export function GlobalSearch({ onNavigate, className }: GlobalSearchProps) {
  const { t } = useSettings();
  const { trips, trucks, drivers, selectTrip, selectTruck } = useFleetStore();

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Aggregated Search Results
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { trips: [], shipments: [], trucks: [], drivers: [] };

    const matchingTrips = trips
      .filter(
        (tr) =>
          tr.tripNumber.toLowerCase().includes(q) ||
          tr.originCity.toLowerCase().includes(q) ||
          tr.destinationCity.toLowerCase().includes(q)
      )
      .slice(0, 4);

    const matchingShipments = trips
      .filter(
        (tr) =>
          tr.qrCodeToken.toLowerCase().includes(q) ||
          tr.shipper.toLowerCase().includes(q) ||
          tr.consignee.toLowerCase().includes(q)
      )
      .slice(0, 4);

    const matchingTrucks = trucks
      .filter(
        (v) =>
          v.plate.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          v.brand.toLowerCase().includes(q) ||
          v.partner.toLowerCase().includes(q)
      )
      .slice(0, 4);

    const matchingDrivers = drivers
      .filter((d) => d.name.toLowerCase().includes(q) || d.phone.includes(q))
      .slice(0, 3);

    return {
      trips: matchingTrips,
      shipments: matchingShipments,
      trucks: matchingTrucks,
      drivers: matchingDrivers,
    };
  }, [query, trips, trucks, drivers]);

  const totalResults =
    results.trips.length +
    results.shipments.length +
    results.trucks.length +
    results.drivers.length;

  const handleSelectTrip = (tr: Trip) => {
    selectTrip(tr.id);
    selectTruck(tr.truckId);
    onNavigate("trips", tr.id);
    setIsOpen(false);
    setQuery("");
  };

  const handleSelectShipment = (tr: Trip) => {
    selectTrip(tr.id);
    selectTruck(tr.truckId);
    onNavigate("shipments", tr.id);
    setIsOpen(false);
    setQuery("");
  };

  const handleSelectTruck = (truckId: string) => {
    selectTruck(truckId);
    const matchingTrip = trips.find((t) => t.truckId === truckId);
    if (matchingTrip) selectTrip(matchingTrip.id);
    onNavigate("fleet", truckId);
    setIsOpen(false);
    setQuery("");
  };

  const handleSelectDriver = (driverId: string) => {
    onNavigate("drivers", driverId);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className={cn("relative w-full max-w-md", className)}>
      {/* Search Input Box */}
      <div className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 border border-border-subtle focus-within:border-brand/50 transition-colors">
        <IconSearch size={15} className="text-text-muted shrink-0" />
        <input
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder={t(
            "Search Trip, Shipment, Truck, Driver...",
            "بحث موحد: رقم الرحلة، الشحنة، اللوحة، السائق..."
          )}
          className="w-full bg-transparent text-[12px] text-text-primary placeholder:text-text-muted outline-none"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="text-text-muted hover:text-text-primary"
          >
            <IconClose size={13} />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && query.trim() && (
        <div className="absolute top-full mt-2 inset-x-0 z-50 rounded-[14px] bg-surface-1/95 backdrop-blur-md p-2 shadow-2xl border border-border-subtle max-h-[380px] overflow-y-auto text-[12px] animate-fade-in">
          {totalResults === 0 ? (
            <div className="p-4 text-center text-text-muted text-[11.5px]">
              {t("No matching results found for", "لا توجد نتائج مطابقة لـ")} "{query}"
            </div>
          ) : (
            <div className="space-y-2">
              {/* Trips */}
              {results.trips.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                    {t("Trips", "الرحلات")}
                  </div>
                  {results.trips.map((tr) => (
                    <button
                      key={tr.id}
                      onClick={() => handleSelectTrip(tr)}
                      className="w-full p-2 rounded-[8px] hover:bg-surface-2 flex items-center justify-between text-start transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-[6px] bg-brand/15 text-brand">
                          <IconTruck size={14} />
                        </span>
                        <div>
                          <div className="font-mono font-bold text-text-primary">
                            {tr.tripNumber}
                          </div>
                          <div className="text-[10.5px] text-text-muted">
                            {tr.originCity} → {tr.destinationCity}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-status-active">
                        {tr.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Shipments */}
              {results.shipments.length > 0 && (
                <div className="border-t border-white/5 pt-1.5">
                  <div className="px-2 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                    {t("Shipments", "الشحنات")}
                  </div>
                  {results.shipments.map((tr) => (
                    <button
                      key={`sh-${tr.id}`}
                      onClick={() => handleSelectShipment(tr)}
                      className="w-full p-2 rounded-[8px] hover:bg-surface-2 flex items-center justify-between text-start transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-[6px] bg-accent-2/15 text-accent-2">
                          <IconDoc size={14} />
                        </span>
                        <div>
                          <div className="font-mono font-bold text-text-primary">
                            {tr.qrCodeToken || `SH-${tr.tripNumber}`}
                          </div>
                          <div className="text-[10.5px] text-text-muted truncate max-w-[200px]">
                            {tr.shipper}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-brand font-bold">
                        {getVehicleTypeMeta(tr.cargoType).arabicName}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Trucks */}
              {results.trucks.length > 0 && (
                <div className="border-t border-white/5 pt-1.5">
                  <div className="px-2 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                    {t("Vehicles & Fleet", "الأسطول والشاحنات")}
                  </div>
                  {results.trucks.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => handleSelectTruck(v.id)}
                      className="w-full p-2 rounded-[8px] hover:bg-surface-2 flex items-center justify-between text-start transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-[6px] bg-surface-3 text-text-secondary">
                          <IconTruck size={14} />
                        </span>
                        <div>
                          <div className="font-mono font-bold text-text-primary">{v.plate}</div>
                          <div className="text-[10.5px] text-text-muted truncate">
                            {v.brand} {v.model}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-text-muted font-mono">{v.body}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Drivers */}
              {results.drivers.length > 0 && (
                <div className="border-t border-white/5 pt-1.5">
                  <div className="px-2 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                    {t("Drivers", "السائقون")}
                  </div>
                  {results.drivers.map((d) => (
                    <button
                      key={d.name}
                      onClick={() => handleSelectDriver(d.name)}
                      className="w-full p-2 rounded-[8px] hover:bg-surface-2 flex items-center justify-between text-start transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-[6px] bg-status-active/15 text-status-active">
                          <IconProfile size={14} />
                        </span>
                        <div>
                          <div className="font-semibold text-text-primary">{d.name}</div>
                          <div className="text-[10.5px] text-text-muted font-mono">{d.phone}</div>
                        </div>
                      </div>
                      <span className="text-[10px] text-text-muted">⭐ {d.rating}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
