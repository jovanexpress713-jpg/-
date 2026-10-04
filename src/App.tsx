import { useCallback, useEffect, useMemo, useState } from "react";
import { SettingsProvider, useSettings } from "./settings";
import { FleetStoreProvider, useFleetStore } from "./state/fleetStore";
import { VehicleAssetProvider, useVehicleAssets } from "./state/vehicleAssetStore";
import { BrandingProvider } from "./state/brandingStore";
import { ToastProvider } from "./components/Toast";
import { WebConsole, SECTION_KEYS } from "./components/WebConsole";
import { ConsoleAuthGate, type DemoAccount } from "./components/ConsoleAuthGate";
import { MobileApp } from "./mobile/MobileApp";
import { apiClient, setAuthToken, getAuthToken } from "./services/apiClient";
import { AppHeader } from "./components/AppHeader";
import { SettingsCenter, type SettingsTab } from "./components/SettingsCenter";
import { AIAssistant } from "./components/AIAssistant";
import { AlertsCenter } from "./components/AlertsCenter";
import { toRoutedAlert, visibleAlertsFor } from "./services/smartAlerts";
import { IconArrowRight } from "./components/Icons";

type Project = "web" | "mobile";

const DEFAULT_PRESENTATION_USER = {
  id: "u-admin",
  email: "admin@ejaz.sa",
  fullName: "فهد بن عبد العزيز السبيعي",
  phone: "+966501112233",
  role: "SUPER_ADMIN",
  permissions: ["*"],
  accountApproved: true,
};

/**
 * Application shell.
 *
 * Layout contract (v2): ONE sticky application header (58px) owns the brand, the
 * current page title, search, notifications, the assistant and the account menu.
 * Secondary controls — language, appearance, settings, help, demo accounts,
 * workspace switch and sign-out — live inside the account menu / settings center.
 * Nothing else may add a second bar to the header row.
 */
function Shell() {
  /** Presentation mode opens as Super Admin so the control room is inspectable. */
  const [session, setSession] = useState<any | null>(DEFAULT_PRESENTATION_USER);
  const [preAuthView, setPreAuthView] = useState<Project>("web");
  const [project, setProject] = useState<Project>("web");
  const [page, setPage] = useState("overview");
  const [sidebarSignal, setSidebarSignal] = useState(0);
  const [showAI, setShowAI] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const { refresh: refreshVehicleAssets } = useVehicleAssets();
  const { alerts, currentRole } = useFleetStore();
  const { tk } = useSettings();

  useEffect(() => {
    if (session) refreshVehicleAssets();
  }, [session, refreshVehicleAssets]);

  /**
   * Silently provision a real backend JWT for the presentation session so every
   * protected API endpoint (/api/trips, /api/vehicle-assets, /api/registrations,
   * …) works when the Express server is running, and the console stays usable
   * with local state when it is not.
   */
  useEffect(() => {
    let cancelled = false;
    const ensureBackendSession = async () => {
      try {
        if (getAuthToken()) {
          const me = await apiClient.auth.me();
          if (!cancelled && me?.role) {
            window.dispatchEvent(new CustomEvent("ejaz:user-signed-in", { detail: me }));
            setSession(me);
            refreshVehicleAssets();
            return;
          }
        }
      } catch {
        setAuthToken(null);
      }

      try {
        const res = await apiClient.auth.login("admin@ejaz.sa", "Ejaz@2026Admin");
        if (!cancelled && res?.token) {
          setAuthToken(res.token);
          if (res.user) {
            window.dispatchEvent(new CustomEvent("ejaz:user-signed-in", { detail: res.user }));
            setSession(res.user);
          }
          refreshVehicleAssets();
        }
      } catch {
        /* Static hosting or offline preview: keep DEFAULT_PRESENTATION_USER active */
      }
    };
    ensureBackendSession();
    return () => {
      cancelled = true;
    };
  }, [refreshVehicleAssets]);

  const handleAuthenticated = useCallback((user: any) => {
    setSession(user || DEFAULT_PRESENTATION_USER);
    setPreAuthView("web");
    setProject("web");
    /* The saved per-user language follows the account (§12). */
    if (user) window.dispatchEvent(new CustomEvent("ejaz:user-signed-in", { detail: user }));
  }, []);

  const handleSwitchDemoAccount = useCallback(async (acc: DemoAccount, targetProject?: Project) => {
    const fallbackUser = {
      id: `u-${acc.key}`,
      email: acc.email,
      fullName: acc.fullName || acc.titleAr,
      phone: "+966501112233",
      role: acc.role,
      driverId: acc.driverId,
      customerId: acc.customerId,
      permissions: ["*"],
      accountApproved: true,
    };
    setSession(fallbackUser);
    const isDriver = acc.role === "DRIVER";
    const isClient = acc.role === "CUSTOMER" || acc.role === "CLIENT";
    setProject(targetProject ?? (isDriver || isClient ? "mobile" : "web"));
    try {
      const res = await apiClient.auth.login(acc.email, acc.password);
      if (res?.token && res?.user) {
        setAuthToken(res.token);
        window.dispatchEvent(new CustomEvent("ejaz:user-signed-in", { detail: res.user }));
        setSession(res.user);
      }
    } catch {
      /* keep fallbackUser when static/offline */
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await apiClient.auth.logout();
    } catch {
      /* session may already be gone */
    }
    setAuthToken(null);
    try {
      localStorage.removeItem("ejaz_current_user");
    } catch {
      /* ignore */
    }
    setSession(null);
    setPreAuthView("web");
    setProject("web");
  }, []);

  /** Search results navigate the console to the matching section. */
  const handleNavigate = useCallback((targetView: string) => {
    setProject("web");
    setPage(targetView in SECTION_KEYS ? targetView : "shipments");
  }, []);

  /**
   * The badge counts what this session is actually responsible for: the alerts
   * routed to the current role/permission profile that nobody has acknowledged
   * yet. An operator never sees a colleague's queue, and never a number they
   * cannot open (§15, §21).
   */
  const unreadAlerts = useMemo(
    () =>
      visibleAlertsFor(alerts.map(toRoutedAlert), {
        persona: currentRole,
        apiRole: session?.role,
        permissions: session?.permissions,
        userId: session?.id,
        driverId: session?.driverId,
      }).filter((a) => !a.resolved && !a.acknowledgedAt).length,
    [alerts, currentRole, session],
  );

  const pageMeta = useMemo(() => {
    if (project === "mobile") {
      return { title: tk("header.viewMobile"), hint: tk("header.viewLabel") };
    }
    const entry = SECTION_KEYS[page] ?? SECTION_KEYS.overview;
    return {
      title: tk(entry.title),
      hint: entry.hint ? tk(entry.hint) : undefined,
    };
  }, [page, project, tk]);

  if (!session) {
    if (preAuthView === "mobile") {
      return (
        <div className="relative h-full w-full">
          <button
            onClick={() => setPreAuthView("web")}
            className="absolute end-3 top-3 z-40 flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2/90 px-3 py-1.5 text-[11px] font-bold text-text-secondary backdrop-blur transition-colors hover:text-brand"
          >
            <IconArrowRight size={13} className="rtl:rotate-180" />
            {tk("login.back")}
          </button>
          <MobileApp onStaffLogin={handleAuthenticated} />
        </div>
      );
    }

    return (
      <ConsoleAuthGate
        onAuthenticated={handleAuthenticated}
        onOpenMobileApp={() => setPreAuthView("mobile")}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-surface-0">
      <AppHeader
        user={session}
        pageTitle={pageMeta.title}
        pageHint={pageMeta.hint}
        unreadAlerts={unreadAlerts}
        showMenuButton={project === "web"}
        onOpenSidebar={() => setSidebarSignal((n) => n + 1)}
        onOpenAssistant={() => setShowAI(true)}
        onOpenAlerts={() => setShowAlerts(true)}
        onOpenSettings={(tab) => setSettingsTab(tab ?? "profile")}
        onSwitchDemoAccount={(acc) => handleSwitchDemoAccount(acc)}
        onPreviewLogin={handleLogout}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
        view={project}
        onViewChange={setProject}
      />

      <main className="min-h-0 flex-1 overflow-hidden">
        {project === "web" ? (
          <WebConsole
            page={page}
            onPageChange={setPage}
            openSidebarSignal={sidebarSignal}
            onOpenSettings={(tab) => setSettingsTab(tab ?? "preferences")}
          />
        ) : (
          <MobileApp
            bypassAuthUser={session}
            onStaffLogin={(staffUser: any) => {
              setProject("web");
              if (staffUser) handleAuthenticated(staffUser);
            }}
          />
        )}
      </main>

      {/* Global surfaces */}
      {showAI && (
        <AIAssistant
          isOpen={showAI}
          onClose={() => setShowAI(false)}
          user={session}
          page={project === "mobile" ? "mobile" : page}
          persona={currentRole}
        />
      )}

      {showAlerts && (
        <AlertsCenter
          isOpen={showAlerts}
          onClose={() => setShowAlerts(false)}
          user={session}
          onSelectTrip={(tripId) => {
            setProject("web");
            setPage("tracking");
            void tripId;
          }}
        />
      )}

      <SettingsCenter
        isOpen={settingsTab !== null}
        initialTab={settingsTab ?? "profile"}
        onClose={() => setSettingsTab(null)}
        user={session}
        onOpenAssistant={() => setShowAI(true)}
      />
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <BrandingProvider>
        <VehicleAssetProvider>
          <FleetStoreProvider>
            <ToastProvider>
              <Shell />
            </ToastProvider>
          </FleetStoreProvider>
        </VehicleAssetProvider>
      </BrandingProvider>
    </SettingsProvider>
  );
}
