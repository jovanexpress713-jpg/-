import { useCallback, useEffect, useState } from "react";
import { cn } from "./utils/cn";
import { SettingsProvider, useSettings } from "./settings";
import { FleetStoreProvider, useFleetStore } from "./state/fleetStore";
import { VehicleAssetProvider, useVehicleAssets } from "./state/vehicleAssetStore";
import { BrandingProvider } from "./state/brandingStore";
import { ToastProvider } from "./components/Toast";
import { WebConsole } from "./components/WebConsole";
import { ConsoleAuthGate, FALLBACK_DEMO_ACCOUNTS } from "./components/ConsoleAuthGate";
import { MobileApp } from "./mobile/MobileApp";
import { apiClient, setAuthToken, getAuthToken } from "./services/apiClient";
import { BrandLogo } from "./components/Logo";
import { AIAssistant } from "./components/AIAssistant";
import { AlertsCenter } from "./components/AlertsCenter";
import { GlobalSearch } from "./components/GlobalSearch";
import { IconBolt, IconBell, IconTruck, IconProfile, IconDashboard, IconChevron } from "./components/Icons";

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

const DEFAULT_PRESENTATION_USER = {
  id: "u-admin",
  email: "admin@ejaz.sa",
  fullName: "فهد بن عبد العزيز السبيعي",
  phone: "+966501112233",
  role: "SUPER_ADMIN",
  permissions: ["*"],
  accountApproved: true,
};

function TopBar({
  user,
  onLogout,
  onStaffLogin,
  onSwitchDemoAccount,
}: {
  user: any;
  onLogout: () => void;
  onStaffLogin: (user: any) => void;
  onSwitchDemoAccount: (acc: (typeof FALLBACK_DEMO_ACCOUNTS)[number], targetProject: Project) => void;
}) {
  const { t, lang, setLang, theme, setTheme } = useSettings();
  const { alerts, trips, setRole } = useFleetStore();
  const [project, setProject] = useState<Project>("web");
  const [showAI, setShowAI] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const unreadAlerts = alerts.filter((a) => !a.resolved).length;
  const activeTripsCount = trips.filter((tr) => tr.status === "on_road").length;

  return (
    <div className="flex h-full flex-col bg-surface-0">
      <header className="flex h-16 shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-border-subtle px-3 py-2 lg:px-5">
        <BrandLogo
          size={40}
          sub={t("Heavy Fleet & Logistics Control", "إدارة أسطول النقل الثقيل والرحلات")}
        />

        {/* Global Search Bar */}
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
              ["web", t("Control Panel & Admin", "لوحة التحكم والإدارة")],
              ["mobile", t("Mobile App (Driver/Client)", "تطبيق الجوال")],
            ] as [Project, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setProject(id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold transition-all duration-200 active:scale-95",
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
            className="btn-ghost gap-1.5 px-2.5 border border-brand/30 text-brand hover:bg-brand hover:text-on-brand transition-all"
            title={t("Open AI Logistics Assistant", "فتح مساعد إيجاز الذكي")}
          >
            <IconBolt size={15} />
            <span className="hidden sm:inline text-[11.5px] font-bold">
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

          {/* 1-Click Account & Role Switcher Menu (No Password Needed) */}
          <div className="relative">
            <button
              onClick={() => setShowAccountMenu((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-brand/35 bg-surface-2 py-1 pe-2.5 ps-2.5 text-start transition-colors hover:border-brand"
              title={t("Switch Demo Account / View", "تبديل الحساب التجريبي ووضع العرض بدون كلمة مرور")}
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-brand/15 text-[10px] font-bold text-brand">
                {(user?.fullName || "EJ").slice(0, 2)}
              </span>
              <div className="hidden sm:block leading-tight">
                <div className="max-w-[115px] truncate text-[11px] font-bold text-text-primary">
                  {user?.fullName || "مدير النظام"}
                </div>
                <div className="text-[9px] font-semibold uppercase tracking-wide text-brand">
                  {t("Switch Account", "تبديل الحساب")}
                </div>
              </div>
              <IconChevron size={12} className="text-text-muted" />
            </button>

            {showAccountMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowAccountMenu(false)}
                />
                <div className="absolute end-0 top-full mt-1.5 z-50 w-[265px] max-w-[90vw] rounded-[14px] bg-surface-1 p-2 shadow-2xl border border-border-subtle animate-fade-in text-[12px]">
                  <div className="px-2.5 py-1.5 text-[10.5px] font-bold text-brand border-b border-border-subtle flex items-center justify-between">
                    <span>{t("Instant Role Switcher", "تبديل فوري للحسابات (بدون رمز)")}</span>
                    <span className="rounded bg-status-active/15 px-1.5 py-0.5 text-[9px] text-status-active">مفعّل</span>
                  </div>

                  <div className="mt-1.5 space-y-1">
                    {FALLBACK_DEMO_ACCOUNTS.map((acc) => {
                      const isDriver = acc.role === "DRIVER";
                      const isClient = acc.role === "CUSTOMER";
                      return (
                        <button
                          key={acc.key}
                          onClick={() => {
                            setShowAccountMenu(false);
                            if (isDriver) {
                              onSwitchDemoAccount(acc, "mobile");
                              setProject("mobile");
                            } else if (isClient) {
                              onSwitchDemoAccount(acc, "mobile");
                              setProject("mobile");
                            } else {
                              setRole("admin");
                              onSwitchDemoAccount(acc, "web");
                              setProject("web");
                            }
                          }}
                          className={cn(
                            "w-full rounded-[10px] px-2.5 py-2 text-start transition-colors flex items-center justify-between gap-2",
                            user?.email === acc.email
                              ? "bg-brand/15 border border-brand/40 text-text-primary"
                              : "hover:bg-surface-2 text-text-secondary hover:text-text-primary"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 font-bold text-[11.5px] text-text-primary">
                              {isDriver ? (
                                <IconTruck size={13} className="text-brand shrink-0" />
                              ) : isClient ? (
                                <IconProfile size={13} className="text-accent-2 shrink-0" />
                              ) : (
                                <IconDashboard size={13} className="text-status-active shrink-0" />
                              )}
                              <span className="truncate">{acc.titleAr}</span>
                            </div>
                            <div className="text-[10px] text-text-muted truncate mt-0.5">
                              {acc.descAr}
                            </div>
                          </div>
                          <span className="shrink-0 text-[9.5px] font-bold text-brand">
                            {isDriver || isClient ? "جوال ←" : "لوحة ←"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2 border-t border-border-subtle pt-1.5">
                    <button
                      onClick={() => {
                        setShowAccountMenu(false);
                        onLogout();
                      }}
                      className="w-full rounded-[8px] px-2.5 py-1.5 text-center text-[11px] font-bold text-text-muted hover:bg-surface-2 hover:text-text-primary transition-colors"
                    >
                      {t("Preview Login Screen", "معاينة شاشة تسجيل الدخول")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Live Fleet Counter */}
          <div className="hidden items-center gap-2 text-[12px] text-text-secondary font-medium xl:flex font-mono tabular-nums">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-status-active" />
            <span>{activeTripsCount} {t("active trucks on road", "شاحنة نشطة على الطريق")}</span>
          </div>
        </div>
      </header>

      {/* Main Container: WebConsole is ALWAYS accessible without role lockouts */}
      <main className="min-h-0 flex-1 overflow-hidden">
        {project === "web" ? (
          <WebConsole />
        ) : (
          <MobileApp
            bypassAuthUser={user}
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
  // Open directly in password-free presentation mode as Super Admin so the
  // client can inspect the Control Room, Administration, and Mobile App immediately.
  const [session, setSession] = useState<any | null>(DEFAULT_PRESENTATION_USER);
  const [preAuthView, setPreAuthView] = useState<"web" | "mobile">("web");
  const { refresh: refreshVehicleAssets } = useVehicleAssets();

  useEffect(() => {
    if (session) refreshVehicleAssets();
  }, [session, refreshVehicleAssets]);

  // Silently provision a real backend JWT for the presentation session so every
  // protected API endpoint (/api/trips, /api/vehicle-assets, /api/registrations, etc.)
  // works seamlessly when the Express server is running, and stays functional
  // with local state when deployed as a static frontend.
  useEffect(() => {
    let cancelled = false;
    const ensureBackendSession = async () => {
      try {
        if (getAuthToken()) {
          const me = await apiClient.auth.me();
          if (!cancelled && me?.role) {
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
          if (res.user) setSession(res.user);
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
  }, []);

  const handleSwitchDemoAccount = useCallback(
    async (acc: (typeof FALLBACK_DEMO_ACCOUNTS)[number], _targetProject: Project) => {
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
      try {
        const res = await apiClient.auth.login(acc.email, acc.password);
        if (res?.token && res?.user) {
          setAuthToken(res.token);
          setSession(res.user);
        }
      } catch {
        /* keep fallbackUser when static/offline */
      }
    },
    []
  );

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
    <TopBar
      user={session}
      onLogout={handleLogout}
      onStaffLogin={handleAuthenticated}
      onSwitchDemoAccount={handleSwitchDemoAccount}
    />
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
