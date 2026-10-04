import { useCallback, useEffect, useMemo, useState } from "react";
import { SettingsProvider, useSettings } from "./settings";
import { FleetStoreProvider, useFleetStore } from "./state/fleetStore";
import { VehicleAssetProvider, useVehicleAssets } from "./state/vehicleAssetStore";
import { BrandingProvider } from "./state/brandingStore";
import { ToastProvider } from "./components/Toast";
import { WebConsole, SECTION_KEYS } from "./components/WebConsole";
import { ConsoleAuthGate } from "./components/ConsoleAuthGate";
import { MobileApp } from "./mobile/MobileApp";
import { apiClient, setAuthToken, getAuthToken } from "./services/apiClient";
import { AppHeader } from "./components/AppHeader";
import { SettingsCenter, type SettingsTab } from "./components/SettingsCenter";
import { AIAssistant } from "./components/AIAssistant";
import { AlertsCenter } from "./components/AlertsCenter";
import { toRoutedAlert, visibleAlertsFor } from "./services/smartAlerts";
import { IconArrowRight } from "./components/Icons";
import { PermissionProvider } from "./state/permissionStore";
import { NAV_ALIASES } from "./utils/permissions";

type Project = "web" | "mobile";

/**
 * Application shell.
 *
 * Layout contract (v3): ONE sticky application header (58px) owns the brand,
 * the current page title, search, notifications, the assistant and the account
 * menu. The account menu lists exactly (§6): حسابي · الإعدادات · تطبيقات
 * الجوال · معاينة شاشة تسجيل الدخول · مساعد إيجاز الذكي · المساعدة والدعم ·
 * تسجيل الخروج — no duplicated language/theme/account panels.
 *
 * The console, the driver app and the client app are three surfaces over ONE
 * backend/database/auth/RBAC (§1). There is no demo identity baked in: a
 * session exists only after a real sign-in (or a clearly-labelled demo account
 * chosen at the gate).
 */
function Shell() {
  const [session, setSession] = useState<any | null>(null);
  const [preAuthView, setPreAuthView] = useState<Project>("web");
  const [preAuthInterface, setPreAuthInterface] = useState<"driver" | "client" | undefined>(undefined);
  const [project, setProject] = useState<Project>("web");
  const [mobileInterface, setMobileInterface] = useState<"driver" | "client">("driver");
  const [previewLogin, setPreviewLogin] = useState(false);
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
   * Restore a real stored session silently (§33 «تسجيل الدخول» is the entry
   * point; a returning operator with a valid token resumes where they left).
   */
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      if (!getAuthToken()) return;
      try {
        const me = await apiClient.auth.me();
        if (!cancelled && me?.role) {
          window.dispatchEvent(new CustomEvent("ejaz:user-signed-in", { detail: me }));
          setSession(me);
          refreshVehicleAssets();
        }
      } catch {
        setAuthToken(null);
      }
    };
    restore();
    return () => {
      cancelled = true;
    };
  }, [refreshVehicleAssets]);

  const handleAuthenticated = useCallback((user: any) => {
    setSession(user);
    setPreAuthView("web");
    setPreviewLogin(false);
    setProject("web");
    /* The saved per-user language follows the account (§12). */
    if (user) window.dispatchEvent(new CustomEvent("ejaz:user-signed-in", { detail: user }));
  }, []);

  /** «تطبيقات الجوال» (§12): each button opens its own app interface. */
  const handleOpenMobileApp = useCallback((kind: "driver" | "client") => {
    if (!session) {
      setPreAuthInterface(kind);
      setPreAuthView("mobile");
      return;
    }
    setMobileInterface(kind);
    setProject("mobile");
    setSettingsTab(null);
  }, [session]);

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
    setPreviewLogin(false);
  }, []);

  /**
   * Search results and settings shortcuts navigate the console to the matching
   * section. A section the role cannot see is never entered — the caller is sent
   * to its own landing page instead of a "no permission" message.
   */
  const handleNavigate = useCallback((targetView: string) => {
    setProject("web");
    const canonical = NAV_ALIASES[targetView] ?? targetView;
    setPage(canonical in SECTION_KEYS ? canonical : "overview");
  }, []);

  /** «إعدادات النظام» jumps to the existing console sections (§8). */
  const handleSystemNavigate = useCallback((section: string) => {
    setSettingsTab(null);
    handleNavigate(section);
  }, [handleNavigate]);

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
      return {
        title: mobileInterface === "driver" ? tk("settings.appsDriver") : tk("settings.appsClient"),
        hint: tk("header.viewLabel"),
      };
    }
    const entry = SECTION_KEYS[page] ?? SECTION_KEYS.overview;
    return {
      title: tk(entry.title),
      hint: entry.hint ? tk(entry.hint) : undefined,
    };
  }, [page, project, mobileInterface, tk]);

  const body = (() => {
  /* ── Sign-in screen PREVIEW (§11): preview only, with a clear exit. ── */
  if (previewLogin && session) {
    return (
      <div className="relative h-full w-full">
        <button
          onClick={() => setPreviewLogin(false)}
          className="absolute end-3 top-3 z-40 flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2/90 px-3 py-1.5 text-[11px] font-bold text-text-secondary backdrop-blur transition-colors hover:text-brand"
        >
          <IconArrowRight size={13} className="rtl:rotate-180" />
          {tk("common.back")}
        </button>
        <ConsoleAuthGate onAuthenticated={() => {}} previewMode />
      </div>
    );
  }

  if (!session) {
    if (preAuthView === "mobile") {
      return (
        <div className="relative h-full w-full">
          <button
            onClick={() => {
              setPreAuthView("web");
              setPreAuthInterface(undefined);
            }}
            className="absolute end-3 top-3 z-40 flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2/90 px-3 py-1.5 text-[11px] font-bold text-text-secondary backdrop-blur transition-colors hover:text-brand"
          >
            <IconArrowRight size={13} className="rtl:rotate-180" />
            {tk("login.back")}
          </button>
          <MobileApp onStaffLogin={handleAuthenticated} forcedInterface={preAuthInterface} />
        </div>
      );
    }

    return (
      <ConsoleAuthGate
        onAuthenticated={handleAuthenticated}
        onOpenMobileApp={handleOpenMobileApp}
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
        onOpenSettings={(tab) => setSettingsTab(tab ?? "account")}
        onPreviewLogin={() => setPreviewLogin(true)}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
        onOpenMobileApp={handleOpenMobileApp}
      />

      <main className="min-h-0 flex-1 overflow-hidden">
        {project === "web" ? (
          <WebConsole
            page={page}
            onPageChange={setPage}
            openSidebarSignal={sidebarSignal}
            onOpenSettings={(tab) => setSettingsTab(tab ?? "account")}
          />
        ) : (
          <MobileApp
            bypassAuthUser={session}
            forcedInterface={mobileInterface}
            onLogout={handleLogout}
            onStaffLogin={(staffUser: any) => {
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
        initialTab={settingsTab ?? "account"}
        onClose={() => setSettingsTab(null)}
        user={session}
        onOpenAssistant={() => setShowAI(true)}
        onOpenMobileApp={handleOpenMobileApp}
        onPreviewLogin={() => setPreviewLogin(true)}
        onNavigate={handleSystemNavigate}
      />
    </div>
  );
  })();

  return (
    <PermissionProvider role={session?.role} tokenPermissions={session?.permissions}>
      {body}
    </PermissionProvider>
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
