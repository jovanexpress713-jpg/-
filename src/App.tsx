import { useCallback, useEffect, useState } from "react";
import { cn } from "./utils/cn";
import { SettingsProvider, useSettings } from "./settings";
import { FleetStoreProvider, useFleetStore } from "./state/fleetStore";
import { VehicleAssetProvider, useVehicleAssets } from "./state/vehicleAssetStore";
import { ToastProvider } from "./components/Toast";
import { WebConsole } from "./components/WebConsole";
import { ConsoleAuthGate } from "./components/ConsoleAuthGate";
import { MobileApp } from "./mobile/MobileApp";
import { apiClient, setAuthToken, getAuthToken } from "./services/apiClient";
import { BrandLogo } from "./components/Logo";
import { AIAssistant } from "./components/AIAssistant";
import { AlertsCenter } from "./components/AlertsCenter";
import { GlobalSearch } from "./components/GlobalSearch";
import { IconBolt, IconBell } from "./components/Icons";

type Project = "web" | "mobile";

const IconSun = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
  </svg>
);

const IconMoon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 14.4A8.2 8.2 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4z" />
  </svg>
);

const IconGlobe = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="8" />
    <path d="M4 12h16" />
    <path d="M12 4c2.2 2.2 3.2 5 3.2 8s-1 5.8-3.2 8c-2.2-2.2-3.2-5-3.2-8s1-5.8 3.2-8z" />
  </svg>
);

const STAFF_ROLES = [
  "SUPER_ADMIN",
  "GENERAL_MANAGER",
  "OPERATIONS_MANAGER",
  "DISPATCHER",
  "ACCOUNTANT",
  "WAREHOUSE",
  "BROKER",
  "CUSTOMS_BROKER",
  "REPRESENTATIVE",
];

function TopBar({
  user,
  onLogout,
  onStaffLogin,
}: {
  user: any;
  onLogout: () => void;
  onStaffLogin: (user: any) => void;
}) {
  const { t, lang, setLang, theme, setTheme } = useSettings();
  const { alerts, trips } = useFleetStore();
  const isStaff = STAFF_ROLES.includes(user?.role);
  const [project, setProject] = useState<Project>(() => (isStaff ? "web" : "mobile"));
  const [showAI, setShowAI] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const unreadAlerts = alerts.filter((a) => !a.resolved).length;
  const activeTripsCount = trips.filter((tr) => tr.status === "on_road").length;

  return (
    <div className="flex h-full flex-col bg-surface-0">
      <header className="flex h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-3 py-2 lg:px-5">
        <BrandLogo
          size={36}
          sub={t("Heavy Fleet & Logistics Control", "إدارة أسطول النقل الثقيل والرحلات")}
        />

        {/* Global Search Bar (Section 25) */}
        <div className="hidden md:flex flex-1 max-w-xs xl:max-w-md mx-2">
          <GlobalSearch
            onNavigate={(_targetView) => {
              if (project !== "web") setProject("web");
            }}
          />
        </div>

        {/* Project Switcher: Web Console vs Mobile App */}
        <div className="order-3 flex items-center gap-1 rounded-full bg-surface-2 p-1 md:order-2 border border-border-subtle">
          {(
            [
              ["web", t("Web Dashboard", "لوحة التحكم")],
              ["mobile", t("Mobile App", "تطبيق الجوال")],
            ] as [Project, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setProject(id)}
              className={cn(
                "rounded-full px-4 py-1.5 text-[12px] font-semibold transition-all duration-200 active:scale-95",
                project === id
                  ? "bg-brand text-on-brand shadow-md"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Top Controls */}
        <div className="order-2 flex items-center gap-2 md:order-3">
          {/* AI Assistant Quick Trigger */}
          <button
            onClick={() => setShowAI(true)}
            className="btn-ghost gap-1.5 px-3 border border-brand/30 text-brand hover:bg-brand hover:text-on-brand transition-all"
            title={t("Open AI Logistics Assistant", "فتح مساعد إيجاز الذكي")}
          >
            <IconBolt size={15} />
            <span className="text-[11.5px] font-bold">
              {t("AI Assistant", "المساعد الذكي")}
            </span>
          </button>

          {/* Smart Alerts Quick Trigger */}
          <button
            onClick={() => setShowAlerts(true)}
            className="btn-icon relative"
            title={t("Live Smart Alerts", "التنبيهات المباشرة")}
            aria-label="Alerts"
          >
            <IconBell size={16} />
            {unreadAlerts > 0 && (
              <span className="absolute -top-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-status-danger text-[9px] font-extrabold text-white animate-pulse">
                {unreadAlerts}
              </span>
            )}
          </button>

          {/* 3-Language Switcher (العربية · English · اردو) */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu((v) => !v)}
              className="btn-icon gap-1 px-2.5"
              title={t("Switch language (العربية / English / اردو)", "تغيير اللغة (العربية / English / اردو)", "زبان تبدیل کریں")}
            >
              <IconGlobe />
              <span className="text-[11px] font-bold">
                {lang === "ar" ? "عربي" : lang === "ur" ? "اردو" : "EN"}
              </span>
            </button>

            {showLangMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowLangMenu(false)}
                />
                <div className="absolute end-0 top-full mt-1.5 z-50 min-w-[130px] rounded-[10px] bg-surface-2 p-1.5 shadow-xl border border-border-subtle animate-fade-in text-[12px]">
                  <div className="px-2 py-1 text-[10px] font-semibold text-text-muted border-b border-white/5 uppercase">
                    {t("Select Language", "اختر اللغة", "زبان منتخب کریں")}
                  </div>
                  <button
                    onClick={() => {
                      setLang("ar");
                      setShowLangMenu(false);
                    }}
                    className={cn(
                      "w-full text-start px-2.5 py-1.5 rounded-[6px] transition-colors flex items-center justify-between mt-1",
                      lang === "ar" ? "bg-brand text-on-brand font-bold" : "text-text-primary hover:bg-surface-3"
                    )}
                  >
                    <span>العربية</span>
                    {lang === "ar" && <span className="text-[10px]">✓</span>}
                  </button>
                  <button
                    onClick={() => {
                      setLang("en");
                      setShowLangMenu(false);
                    }}
                    className={cn(
                      "w-full text-start px-2.5 py-1.5 rounded-[6px] transition-colors flex items-center justify-between",
                      lang === "en" ? "bg-brand text-on-brand font-bold" : "text-text-primary hover:bg-surface-3"
                    )}
                  >
                    <span>English</span>
                    {lang === "en" && <span className="text-[10px]">✓</span>}
                  </button>
                  <button
                    onClick={() => {
                      setLang("ur");
                      setShowLangMenu(false);
                    }}
                    className={cn(
                      "w-full text-start px-2.5 py-1.5 rounded-[6px] transition-colors flex items-center justify-between",
                      lang === "ur" ? "bg-brand text-on-brand font-bold" : "text-text-primary hover:bg-surface-3"
                    )}
                  >
                    <span>اردو</span>
                    {lang === "ur" && <span className="text-[10px]">✓</span>}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Theme Switcher */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="btn-icon"
            title={t("Toggle day / night", "الوضع النهاري / الليلي")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>

          {/* Authenticated Operator */}
          <div className="hidden items-center gap-2 rounded-full border border-border-subtle bg-surface-2 py-1.5 pe-2 ps-3 xl:flex">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-brand/15 text-[10px] font-bold text-brand">
              {(user?.fullName || "EJ").slice(0, 2)}
            </span>
            <div className="leading-tight">
              <div className="max-w-[130px] truncate text-[11.5px] font-bold text-text-primary">{user?.fullName}</div>
              <div className="text-[9.5px] font-semibold uppercase tracking-wide text-text-muted">{user?.role}</div>
            </div>
            <button
              onClick={onLogout}
              className="btn-ghost ms-1 px-2 py-1 text-[10.5px] font-bold text-status-danger hover:bg-status-danger/10"
              title={t("Sign out", "تسجيل الخروج")}
            >
              {t("Sign out", "خروج")}
            </button>
          </div>

          {/* Live Fleet Counter Pill */}
          <span className="hidden items-center gap-1.5 rounded-full bg-status-active/12 px-3 py-1.5 text-[11px] font-semibold text-status-active lg:inline-flex border border-status-active/20">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-current" />
            {activeTripsCount} {t("trucks on road", "شاحنة على الطريق")}
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="min-h-0 flex-1 overflow-hidden">
        {project === "web" ? (
          isStaff ? (
            <WebConsole />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-surface-0 px-4">
              <div className="max-w-md rounded-[18px] border border-border-subtle bg-surface-1 p-8 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-status-waiting/15 text-status-waiting">
                  <IconBolt size={20} />
                </div>
                <h2 className="text-[15px] font-extrabold text-text-primary">
                  {t("Control Room access requires a staff role", "لوحة التحكم مخصصة للأدوار الوظيفية")}
                </h2>
                <p className="mt-2 text-[12.5px] leading-relaxed text-text-secondary">
                  {t(
                    "Your account is scoped to the driver/client mobile experience. Switch to the mobile app to continue, or sign in with an operations account.",
                    "حسابك مخصص لتطبيق السائق والعميل على الجوال. انتقل إلى تطبيق الجوال للمتابعة، أو سجّل الدخول بحساب تشغيلي.",
                  )}
                </p>
                <button onClick={() => setProject("mobile")} className="btn-primary mx-auto mt-4 px-4 py-2 text-[12.5px]">
                  {t("Open the mobile app", "فتح تطبيق الجوال")}
                </button>
              </div>
            </div>
          )
        ) : (
          <MobileApp
            onStaffLogin={(staffUser: any) => {
              setProject("web");
              if (staffUser) onStaffLogin(staffUser);
            }}
          />
        )}
      </main>

      {/* Global Modals */}
      {showAI && <AIAssistant isOpen={showAI} onClose={() => setShowAI(false)} />}
      {showAlerts && <AlertsCenter isOpen={showAlerts} onClose={() => setShowAlerts(false)} />}
    </div>
  );
}

function Shell() {
  const [session, setSession] = useState<any | null>(null);
  const [checking, setChecking] = useState(true);
  const [preAuthView, setPreAuthView] = useState<"web" | "mobile">("web");
  const { refresh: refreshVehicleAssets } = useVehicleAssets();

  /**
   * The asset registry is a protected resource, so the initial load (before
   * sign-in) is rejected by design. Reload it the moment a session exists so
   * the freshly published official images and models go live without a refresh.
   */
  useEffect(() => {
    if (session) refreshVehicleAssets();
  }, [session, refreshVehicleAssets]);

  // Restore an authenticated session on load so refreshes keep the operator signed in
  useEffect(() => {
    const bootstrap = async () => {
      if (!getAuthToken()) {
        setChecking(false);
        return;
      }
      try {
        const me = await apiClient.auth.me();
        setSession(me);
      } catch {
        setAuthToken(null);
      } finally {
        setChecking(false);
      }
    };
    bootstrap();
  }, []);

  const handleAuthenticated = useCallback((user: any) => {
    setSession(user);
    setPreAuthView(STAFF_ROLES.includes(user?.role) ? "web" : "mobile");
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
  }, []);

  if (checking) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-0">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-text-muted">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-brand" />
          جارٍ التحقق من الجلسة…
        </div>
      </div>
    );
  }

  // Unauthenticated: the control room is gated, while the driver/client mobile
  // experience keeps its own welcome + login journey.
  if (!session) {
    if (preAuthView === "mobile") {
      return (
        <div className="relative h-full w-full">
          <button
            onClick={() => setPreAuthView("web")}
            className="absolute end-3 top-3 z-40 rounded-full border border-border-subtle bg-surface-2/90 px-3 py-1.5 text-[11px] font-bold text-text-secondary backdrop-blur transition-colors hover:text-brand"
          >
            العودة إلى غرفة التحكم
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
    <FleetStoreProvider>
      <ToastProvider>
        <TopBar user={session} onLogout={handleLogout} onStaffLogin={handleAuthenticated} />
      </ToastProvider>
    </FleetStoreProvider>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <VehicleAssetProvider>
        <Shell />
      </VehicleAssetProvider>
    </SettingsProvider>
  );
}
