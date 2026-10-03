import { useMemo, useState } from "react";
import type { RequestKind, Vehicle } from "../data/types";
import { useSettings } from "../settings";
import { liveOf, useElapsed, useTicker } from "../hooks";
import { useFleetStore } from "../state/fleetStore";
import { IconMenu } from "./Icons";
import { Sidebar, type NavCounts } from "./Sidebar";
import { Dashboard } from "./Dashboard";
import { DetailsPanel } from "./DetailsPanel";
import { CreateRequest } from "./CreateRequest";
import { RoleSwitcher } from "./RoleSwitcher";
import { DriverPortal } from "./DriverPortal";
import { ShipperPortal } from "./ShipperPortal";
import { OwnerPortal } from "./OwnerPortal";
import { TripsManager } from "./TripsManager";
import { ShipmentsManager } from "./ShipmentsManager";
import { FleetManager } from "./FleetManager";
import { VehicleAssetsManager } from "./VehicleAssetsManager";
import { RegistrationRequestsManager } from "./RegistrationRequestsManager";
import { LiveOperationsCenter } from "./LiveOperationsCenter";
import { AnalyticsReports } from "./AnalyticsReports";
import { AIAssistant } from "./AIAssistant";
import { AlertsCenter } from "./AlertsCenter";
import { BrandingSettings } from "./BrandingSettings";
import { useToast } from "./Toast";

/**
 * Console section titles for the mobile section bar. The dashboard renders its
 * own header (with its own menu button), so it is deliberately absent here.
 */
const SECTION_TITLES: Record<string, [string, string]> = {
  operations: ["Operations Center", "مركز العمليات"],
  trips: ["Trips", "الرحلات"],
  shipments: ["Shipments", "الشحنات"],
  fleet: ["Fleet (4 Types)", "الأسطول (٤ أنواع)"],
  "vehicle-assets": ["Vehicle Assets", "أصول المركبات"],
  drivers: ["Drivers", "السائقون"],
  registrations: ["Registration Requests", "طلبات التسجيل"],
  tracking: ["Live Map", "الخريطة المباشرة"],
  reports: ["Reports & Audit", "التقارير والتدقيق"],
  history: ["History", "السجل"],
  analysis: ["Analysis", "التحليلات"],
  trucks: ["Trucks", "الشاحنات"],
  cargos: ["Cargos", "الشحنات"],
  repair: ["Repair", "الصيانة"],
};

export function WebConsole() {
  const { t } = useSettings();
  const toast = useToast();
  const {
    trucks,
    trips,
    drivers,
    currentRole,
    selectTrip,
    selectedTruckId,
    selectTruck,
  } = useFleetStore();

  const [nav, setNav] = useState("operations");
  const [modalKind, setModalKind] = useState<RequestKind | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showBrandingModal, setShowBrandingModal] = useState(false);

  const now = useTicker(1000);
  const elapsed = useElapsed(now);

  const selectedVehicle = trucks.find((v) => v.id === selectedTruckId) || trucks[0];

  const counts: NavCounts = useMemo(
    () => ({
      trucks: trucks.length,
      cargos: trips.filter((t) => t.status === "on_road").length,
      repair: trucks.filter((v) => v.status !== "active").length,
      drivers: drivers.length,
      reports: 6,
    }),
    [trucks, trips, drivers]
  );

  const handleSelectTruck = (id: string) => {
    selectTruck(id);
    // Find matching trip if any
    const matchingTrip = trips.find((t) => t.truckId === id);
    if (matchingTrip) selectTrip(matchingTrip.id);
    if (window.innerWidth < 1280) setDetailsOpen(true);
  };

  const handleAddVehicle = (v: Vehicle) => {
    selectTruck(v.id);
    setNav("tracking");
    setResetKey((k) => k + 1);
    setModalKind(null);
    toast("Shipment created", `${v.shipment} · ${v.model}`);
  };

  const handleNavSelect = (key: string) => {
    if (key === "ai") {
      setShowAIModal(true);
      return;
    }
    if (key === "alerts") {
      setShowAlertsModal(true);
      return;
    }
    if (key === "branding") {
      setShowBrandingModal(true);
      return;
    }
    setNav(key);
  };

  // Persona Views
  if (currentRole === "driver") {
    return (
      <div className="flex h-full flex-col min-h-0">
        <RoleSwitcher />
        <div className="flex-1 overflow-hidden min-h-0">
          <DriverPortal />
        </div>
      </div>
    );
  }

  if (currentRole === "shipper") {
    return (
      <div className="flex h-full flex-col min-h-0">
        <RoleSwitcher />
        <div className="flex-1 overflow-hidden min-h-0">
          <ShipperPortal />
        </div>
      </div>
    );
  }

  if (currentRole === "owner") {
    return (
      <div className="flex h-full flex-col min-h-0">
        <RoleSwitcher />
        <div className="flex-1 overflow-hidden min-h-0">
          <OwnerPortal />
        </div>
      </div>
    );
  }

  // Admin / Dispatch View
  return (
    <div className="flex h-full flex-col min-h-0">
      {/* Interactive Role & Persona Bar */}
      <RoleSwitcher />

      {/*
        Mobile section bar. Every console screen stays reachable from a phone:
        the sidebar is a drawer, and this bar is the single, always-present way
        to open it — no screen is left without navigation on a small viewport.
      */}
      {nav !== "dashboard" && (
        <div className="flex shrink-0 items-center gap-2.5 border-b border-border-subtle bg-surface-1 px-3 py-2 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="btn-icon shrink-0"
            aria-label={t("Open navigation menu", "فتح قائمة التنقل")}
          >
            <IconMenu size={17} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-bold text-text-primary">
              {t(
                SECTION_TITLES[nav]?.[0] ?? "Control Room",
                SECTION_TITLES[nav]?.[1] ?? "غرفة التحكم",
              )}
            </div>
          </div>
          <span className="badge shrink-0 bg-surface-4 text-text-muted tabular-nums">
            {counts.trucks}
          </span>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex">
          <Sidebar
            active={nav}
            onSelect={handleNavSelect}
            counts={counts}
            onCreate={(kind) => setModalKind(kind)}
          />
        </div>

        {/* Mobile Sidebar Drawer */}
        {sidebarOpen && (
          <div className="animate-fade-in fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute inset-y-0 start-0 z-10 max-w-[85vw]">
              <Sidebar
                active={nav}
                onSelect={(k) => {
                  handleNavSelect(k);
                  setSidebarOpen(false);
                }}
                counts={counts}
                onCreate={(kind) => {
                  setSidebarOpen(false);
                  setModalKind(kind);
                }}
              />
            </div>
          </div>
        )}

        {/* Dynamic Center Work Area */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          {nav === "operations" || nav === "tracking" ? (
            <LiveOperationsCenter
              onOpenTripDetails={(tripId) => {
                selectTrip(tripId);
                const tr = trips.find((t) => t.id === tripId);
                if (tr) selectTruck(tr.truckId);
                setNav("trips");
              }}
              onOpenShipmentDetails={(tripId) => {
                selectTrip(tripId);
                const tr = trips.find((t) => t.id === tripId);
                if (tr) selectTruck(tr.truckId);
                setNav("shipments");
              }}
            />
          ) : nav === "shipments" ? (
            <ShipmentsManager
              onOpenTrip={(tripId) => {
                selectTrip(tripId);
                const tr = trips.find((t) => t.id === tripId);
                if (tr) selectTruck(tr.truckId);
                setNav("trips");
              }}
              onOpenTruck={(truckId) => {
                selectTruck(truckId);
                setNav("fleet");
              }}
              onOpenLiveMap={(tripId) => {
                selectTrip(tripId);
                setNav("tracking");
              }}
            />
          ) : nav === "fleet" ? (
            <FleetManager
              onOpenLiveTracking={(tripId) => {
                selectTrip(tripId);
                setNav("tracking");
              }}
            />
          ) : nav === "registrations" ? (
            <RegistrationRequestsManager />
          ) : nav === "vehicle-assets" ? (
            <VehicleAssetsManager />
          ) : nav === "trips" ? (
            <TripsManager
              onOpenLiveTracking={(tripId) => {
                selectTrip(tripId);
                const tr = trips.find((t) => t.id === tripId);
                if (tr) selectTruck(tr.truckId);
                setNav("tracking");
              }}
            />
          ) : nav === "reports" ? (
            <AnalyticsReports />
          ) : (
            <Dashboard
              vehicles={trucks}
              selectedId={selectedTruckId}
              activeNav={nav}
              onSelect={handleSelectTruck}
              onNav={setNav}
              onToast={toast}
              onOpenSidebar={() => setSidebarOpen(true)}
              resetKey={resetKey}
            />
          )}
        </div>

        {/* Desktop Details Panel (visible only on traditional dashboard view) */}
        {nav === "dashboard" && (
          <div className="hidden w-[440px] shrink-0 border-s border-border-subtle xl:block 2xl:w-[500px]">
            <DetailsPanel v={selectedVehicle} live={liveOf(selectedVehicle, elapsed)} />
          </div>
        )}

        {/* Mobile Details Drawer */}
        {detailsOpen && (
          <div className="animate-fade-in fixed inset-0 z-50 xl:hidden">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setDetailsOpen(false)}
            />
            <div className="absolute inset-y-0 end-0 w-full max-w-[460px] z-10 shadow-2xl">
              <DetailsPanel
                v={selectedVehicle}
                live={liveOf(selectedVehicle, elapsed)}
                onClose={() => setDetailsOpen(false)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {modalKind && (
        <CreateRequest
          initialKind={modalKind}
          onClose={() => setModalKind(null)}
          onCreate={handleAddVehicle}
        />
      )}

      {showAIModal && (
        <AIAssistant
          isOpen={showAIModal}
          onClose={() => setShowAIModal(false)}
          onSelectTrip={(tripId) => {
            selectTrip(tripId);
            const tr = trips.find((t) => t.id === tripId);
            if (tr) selectTruck(tr.truckId);
            setNav("tracking");
            setShowAIModal(false);
          }}
        />
      )}

      {showAlertsModal && (
        <AlertsCenter
          isOpen={showAlertsModal}
          onClose={() => setShowAlertsModal(false)}
          onSelectTrip={(tripId) => {
            selectTrip(tripId);
            const tr = trips.find((t) => t.id === tripId);
            if (tr) selectTruck(tr.truckId);
            setNav("tracking");
            setShowAlertsModal(false);
          }}
        />
      )}

      {showBrandingModal && (
        <BrandingSettings
          isOpen={showBrandingModal}
          onClose={() => setShowBrandingModal(false)}
        />
      )}
    </div>
  );
}
