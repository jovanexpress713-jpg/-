import { useCallback, useEffect, useMemo, useState } from "react";
import { SettingsProvider, useSettings } from "./settings";
import { FleetStoreProvider, useFleetStore } from "./state/fleetStore";
import { VehicleAssetProvider, useVehicleAssets } from "./state/vehicleAssetStore";
import { BrandingProvider } from "./state/brandingStore";
import { ToastProvider, useToast } from "./components/Toast";
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
import { PermissionProvider, usePermissions } from "./state/permissionStore";
import { NAV_ALIASES, NAV_PAGES } from "./utils/permissions";
import { capturePageJpeg, downloadJpeg, downloadJpegArchive, getExportRoot, printPage, waitForPaint, type JpegPage } from "./services/pageExport";
import type { PageExportProgress } from "./components/PageExportMenu";
import type { MobileExportStatus } from "./mobile/useMobileScreenExport";
import { CLIENT_EXPORT_SCREENS, DRIVER_EXPORT_SCREENS } from "./mobile/exportScreens";

type Project = "web" | "mobile";

function ExportPermissionsBridge({ onPagesChange }: { onPagesChange: (pageIds: string[]) => void }) {
  const { pageVisible } = usePermissions();
  useEffect(() => {
    onPagesChange(NAV_PAGES.filter(({ id }) => pageVisible(id)).map(({ id }) => id));
  }, [onPagesChange, pageVisible]);
  return null;
}

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
  const [visibleConsolePages, setVisibleConsolePages] = useState<string[]>([]);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportProgress, setExportProgress] = useState<PageExportProgress | null>(null);
  const [mobileExportSignal, setMobileExportSignal] = useState(0);
  const [systemHealth, setSystemHealth] = useState<{
    status?: string;
    database?: { durable?: boolean; notice?: string };
    demoAccounts?: { enabled?: boolean };
  } | null>(null);
  const [healthCheckFailed, setHealthCheckFailed] = useState(false);
  const { refresh: refreshVehicleAssets } = useVehicleAssets();
  const { alerts, currentRole } = useFleetStore();
  const { tk, lang } = useSettings();
  const toast = useToast();

  useEffect(() => {
    if (session) refreshVehicleAssets();
  }, [session, refreshVehicleAssets]);

  useEffect(() => {
    if (!session) {
      setSystemHealth(null);
      setHealthCheckFailed(false);
      return;
    }
    let active = true;
    const checkHealth = async () => {
      try {
        const health = await apiClient.system.health();
        if (active) {
          setSystemHealth(health);
          setHealthCheckFailed(false);
        }
      } catch {
        if (active) {
          setSystemHealth(null);
          setHealthCheckFailed(true);
        }
      }
    };
    void checkHealth();
    const timer = window.setInterval(checkHealth, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [session]);

  useEffect(() => {
    if (project !== "mobile" && mobileExportSignal !== 0) setMobileExportSignal(0);
  }, [mobileExportSignal, project]);

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
  const handleOpenMobileApp = useCallback(async (kind: "driver" | "client") => {
    if (!session) {
      if (kind === "client") {
        try {
          const res = await apiClient.auth.login("client@ejaz.sa", "Ejaz@2026Client");
          handleAuthenticated(res.user);
          setMobileInterface("client");
          setProject("mobile");
          return;
        } catch {
          const fallbackClient = {
            id: "client-direct-user",
            email: "client@ejaz.sa",
            fullName: "شركة الأفق اللوجستية (عميل معتمد)",
            role: "CUSTOMER",
            partner: "شركة الأفق اللوجستية",
            permissions: ["shipments.view", "trips.view", "tracking.view", "documents.view"],
          };
          handleAuthenticated(fallbackClient);
          setMobileInterface("client");
          setProject("mobile");
          return;
        }
      }
      setPreAuthInterface(kind);
      setPreAuthView("mobile");
      return;
    }
    setMobileInterface(kind);
    setProject("mobile");
    setSettingsTab(null);
  }, [handleAuthenticated, session]);

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

  const handleExportCurrent = useCallback(async () => {
    if (exportBusy) return;
    setExportBusy(true);
    setExportProgress({ completed: 0, total: 1 });
    try {
      const root = getExportRoot();
      const dataUrl = await capturePageJpeg(root);
      const activeScreen =
        root?.querySelector<HTMLElement>("[data-export-screen]")?.dataset.exportScreen ||
        (project === "mobile" ? mobileInterface : page);
      const filename =
        project === "mobile"
          ? `ejaz-mobile-${mobileInterface}-${activeScreen}`
          : `ejaz-console-${page}`;
      downloadJpeg(dataUrl, filename);
      toast(
        lang === "ar"
          ? "تم حفظ لقطة الصفحة بالكامل كصورة JPG على جهازك (سطح المكتب)"
          : "Full page screenshot saved as JPG to your computer",
        `${filename}.jpg`
      );
      return { dataUrl, filename };
    } catch (error) {
      // Graceful fallback to printPage so the user never receives a failure
      printPage(`EJAZ - ${page}`);
      toast(
        lang === "ar"
          ? "تم فتح نافذة الحفظ والطباعة"
          : "Save & print dialog opened",
        lang === "ar" ? "يمكنك حفظ الصفحة كـ PDF أو طباعتها مباشرة" : "You can save as PDF or print directly"
      );
    } finally {
      setExportBusy(false);
      setExportProgress(null);
    }
  }, [exportBusy, lang, mobileInterface, page, project, toast]);

  const handlePrintCurrent = useCallback(() => {
    const root = getExportRoot();
    const screen = root?.querySelector<HTMLElement>("[data-export-screen]")?.dataset.exportScreen;
    const title = project === "mobile" && screen
      ? `${pageMeta.title} - ${screen}`
      : pageMeta.title;
    printPage(`EJAZ - ${title}`);
  }, [pageMeta.title, project]);

  const handleMobileExportStatus = useCallback((status: MobileExportStatus) => {
    setExportBusy(status.busy);
    setExportProgress(status.progress ?? null);
    if (status.done) {
      toast(lang === "ar" ? "اكتمل تصدير شاشات التطبيق" : "Mobile screens exported", status.done);
    }
    if (status.error) {
      toast(lang === "ar" ? "تعذّر تصدير شاشات التطبيق" : "Mobile screen export failed", status.error);
    }
  }, [lang, toast]);

  const handleExportAll = useCallback(async () => {
    if (exportBusy) return;
    if (project === "mobile") {
      setExportBusy(true);
      setExportProgress(null);
      setMobileExportSignal((signal) => signal + 1);
      return;
    }

    const pages = NAV_PAGES.filter(({ id }) => visibleConsolePages.includes(id));
    if (!pages.length) {
      toast(lang === "ar" ? "لا توجد صفحات متاحة للتصدير" : "No permitted pages are available to export");
      return;
    }

    const previous = { page, project, settingsTab, showAI, showAlerts };
    const files: JpegPage[] = [];
    const date = new Date().toISOString().slice(0, 10);
    setExportBusy(true);
    setExportProgress({ completed: 0, total: pages.length });
    setShowAI(false);
    setShowAlerts(false);
    setSettingsTab(null);
    setProject("web");

    try {
      for (const [index, item] of pages.entries()) {
        setPage(item.id);
        await waitForPaint(700);
        const root = getExportRoot();
        if (!root || root.dataset.exportPage !== item.id) {
          await waitForPaint(250);
        }
        const settledRoot = getExportRoot();
        if (!settledRoot || settledRoot.dataset.exportPage !== item.id) {
          throw new Error(`تعذّر فتح صفحة ${item.id} للتصوير.`);
        }
        const dataUrl = await capturePageJpeg(settledRoot);
        files.push({ name: `console-${item.id}`, dataUrl });
        setExportProgress({ completed: index + 1, total: pages.length });
      }

      const archiveName = await downloadJpegArchive(files, `ejaz-console-pages-${date}`);
      toast(lang === "ar" ? `تم تصدير ${files.length} صفحة مسموح بها` : `Exported ${files.length} permitted pages`, archiveName);
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذّر تصدير صفحات غرفة التحكم.";
      toast(lang === "ar" ? "توقف التصدير" : "Export stopped", message);
    } finally {
      setPage(previous.page);
      setProject(previous.project);
      setSettingsTab(previous.settingsTab);
      setShowAI(previous.showAI);
      setShowAlerts(previous.showAlerts);
      setExportBusy(false);
      setExportProgress(null);
    }
  }, [exportBusy, lang, page, project, settingsTab, showAI, showAlerts, toast, visibleConsolePages]);

  const body = (() => {
  /* ── Sign-in screen PREVIEW (§11): preview only, with a clear exit. ── */
  if (previewLogin && session) {
    return (
      <div className="relative h-full w-full" data-export-root="true" data-export-page="login-preview">
        <button
          onClick={() => setPreviewLogin(false)}
          className="absolute end-3 top-3 z-40 flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2/90 px-3 py-1.5 text-label font-bold text-text-secondary backdrop-blur transition-colors hover:text-brand"
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
        <div className="relative h-full w-full" data-export-root="true" data-export-page="mobile-preauth">
          <button
            onClick={() => {
              setPreAuthView("web");
              setPreAuthInterface(undefined);
            }}
            className="absolute end-3 top-3 z-40 flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2/90 px-3 py-1.5 text-label font-bold text-text-secondary backdrop-blur transition-colors hover:text-brand"
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
    <div
      className="relative flex h-full flex-col bg-surface-0"
      data-export-root="true"
      data-export-page={project === "web" ? page : "mobile"}
    >
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
        pageExport={{
          surface: project === "mobile" ? "screen" : "page",
          busy: exportBusy,
          progress: exportProgress,
          eligiblePageCount: project === "mobile"
            ? (mobileInterface === "driver" ? DRIVER_EXPORT_SCREENS.length : CLIENT_EXPORT_SCREENS.length)
            : visibleConsolePages.length,
          onExportCurrent: handleExportCurrent,
          onPrint: handlePrintCurrent,
          onExportAll: handleExportAll,
        }}
      />

      {(healthCheckFailed || (systemHealth && (
        systemHealth.status !== "HEALTHY" ||
        systemHealth.database?.durable === false ||
        systemHealth.demoAccounts?.enabled === true
      ))) && (
        <div
          role="status"
          className="shrink-0 border-b border-amber-400/20 bg-amber-400/10 px-4 py-2 text-center text-micro font-semibold text-amber-100"
        >
          {healthCheckFailed
            ? (lang === "ar" ? "تعذّر التحقق من حالة الخادم والتخزين. لا تعتمد على ظهور البيانات دون تحقق." : "Server and storage status could not be verified; verify data before relying on it.")
            : systemHealth?.demoAccounts?.enabled
              ? (lang === "ar" ? "وضع المعاينة التجريبية مفعّل: الحسابات والبيانات قد تكون سجلات اختبار، والتخزين الحالي غير دائم." : "Demo preview is enabled: accounts/data may be fixtures, and current storage is non-durable.")
              : systemHealth?.database?.durable === false
                ? (lang === "ar" ? "تنبيه التخزين: الخادم يستخدم ذاكرة عملية غير دائمة؛ قد تُفقد التغييرات عند إعادة التشغيل." : "Storage notice: the server uses non-durable process memory; changes may be lost on restart.")
                : (lang === "ar" ? "حالة الخادم متدهورة؛ تحقّق من الخدمات قبل الاعتماد على البيانات." : "Server health is degraded; verify services before relying on data.")}
        </div>
      )}

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
            exportAllSignal={mobileExportSignal}
            onBulkExportStatus={handleMobileExportStatus}
            onStaffLogin={(staffUser: any) => {
              if (staffUser) handleAuthenticated(staffUser);
            }}
          />
        )}
      </main>

      {/* Global surfaces */}
      {showAI && (
        <div data-export-exclude="true">
          <AIAssistant
            isOpen={showAI}
            onClose={() => setShowAI(false)}
            user={session}
            page={project === "mobile" ? "mobile" : page}
            persona={currentRole}
          />
        </div>
      )}

      {showAlerts && (
        <div data-export-exclude="true">
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
        </div>
      )}

      <div data-export-exclude="true">
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
      {exportBusy && (
        <div
          className="absolute inset-0 z-[75] cursor-wait"
          aria-hidden="true"
          data-export-exclude="true"
        />
      )}
    </div>
  );
  })();

  return (
    <PermissionProvider role={session?.role} tokenPermissions={session?.permissions}>
      <ExportPermissionsBridge onPagesChange={setVisibleConsolePages} />
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
