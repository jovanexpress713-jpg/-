import { useState, useEffect } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { LANGUAGE_OPTIONS } from "../localization/i18n";
import { LanguageList } from "../components/AccountMenu";
import { LoginScreen } from "./LoginScreen";
import { RegistrationScreen, RegistrationStatusScreen } from "./RegistrationFlow";
import { ClientMode } from "./ClientMode";
import { DriverMode } from "./DriverMode";
import { SplashScreen } from "./SplashScreen";
import { apiClient, setAuthToken, getAuthToken } from "../services/apiClient";
import { IconGlobe, IconTruck, IconProfile } from "../components/Icons";
import { ErrorBoundary } from "../components/ErrorBoundary";

type ScreenFlow = "welcome" | "login" | "register" | "app";

const DEMO_DRIVER_USER = {
  id: "u-driver",
  email: "driver@ejaz.sa",
  fullName: "فهد الشمري (كابتن أسطول)",
  phone: "+966551234567",
  role: "DRIVER",
  driverId: "d1",
  accountApproved: true,
};

const DEMO_CLIENT_USER = {
  id: "u-client",
  email: "client@ejaz.sa",
  fullName: "شركة سدافكو للأغذية والمشروبات",
  phone: "+966112223344",
  role: "CUSTOMER",
  customerId: "cust-1",
  accountApproved: true,
};

export function MobileApp({
  onStaffLogin,
  bypassAuthUser,
}: {
  onStaffLogin?: (user: any) => void;
  bypassAuthUser?: any;
} = {}) {
  const { t, tk, lang, theme, setTheme } = useSettings();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  const [currentScreen, setCurrentScreen] = useState<ScreenFlow>("welcome");
  const [registerType, setRegisterType] = useState<"DRIVER" | "CUSTOMER">("DRIVER");

  useEffect(() => {
    let cancelled = false;

    if (bypassAuthUser) {
      const mobileIdentity =
        bypassAuthUser.role === "DRIVER"
          ? bypassAuthUser
          : bypassAuthUser.role === "CUSTOMER" || bypassAuthUser.role === "CLIENT"
            ? { ...bypassAuthUser, role: "CUSTOMER" }
            : DEMO_DRIVER_USER;
      setCurrentUser(mobileIdentity);
      setCurrentScreen("app");
      setSessionChecked(true);
      return;
    }

    const restore = async () => {
      let cached: any = null;
      try {
        const saved = localStorage.getItem("ejaz_current_user");
        cached = saved ? JSON.parse(saved) : null;
      } catch {
        cached = null;
      }

      if (!getAuthToken() || !cached) {
        if (!cancelled) {
          setCurrentUser(null);
          setSessionChecked(true);
        }
        return;
      }

      if (!cancelled) setCurrentUser(cached);
      try {
        const me = await apiClient.auth.me();
        if (cancelled) return;
        setCurrentUser(me);
        setCurrentScreen("app");
      } catch {
        if (cancelled) return;
        setAuthToken(null);
        try {
          localStorage.removeItem("ejaz_current_user");
        } catch {
          /* ignore */
        }
        setCurrentUser(null);
        setCurrentScreen("login");
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    };

    restore();
    return () => {
      cancelled = true;
    };
  }, [bypassAuthUser]);

  // Sync current user to local cache
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem("ejaz_current_user", JSON.stringify(currentUser));
      } else if (!bypassAuthUser) {
        localStorage.removeItem("ejaz_current_user");
      }
    } catch {
      /* ignore */
    }
  }, [currentUser, bypassAuthUser]);

  const handleLoginSuccess = (user: any) => {
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

    if (onStaffLogin && user?.role && STAFF_ROLES.includes(user.role)) {
      setCurrentUser(user);
      setCurrentScreen("app");
      onStaffLogin(user);
      return;
    }

    setCurrentUser(user);
    setCurrentScreen("app");
  };

  const isApplicantRole = currentUser?.role === "DRIVER" || currentUser?.role === "CUSTOMER";
  const awaitingApproval = isApplicantRole && currentUser?.accountApproved === false;

  const handleLogout = () => {
    if (!bypassAuthUser) {
      setAuthToken(null);
      apiClient.auth.logout().catch(() => {});
    }
    setCurrentUser(null);
    setSessionChecked(true);
    setCurrentScreen("login");
  };

  const handleWelcomeContinue = () => {
    if (currentUser && sessionChecked) {
      setCurrentScreen("app");
    } else {
      setCurrentScreen("login");
    }
  };

  return (
    <div className="h-full w-full bg-surface-0 flex flex-col items-center justify-center overflow-hidden">
      {/* Real Mobile App Viewport Container */}
      <div className="relative h-full w-full max-w-[430px] bg-surface-0 shadow-2xl flex flex-col overflow-hidden border-x border-border-subtle">
        {/* Android Real System Bar & Utility Header */}
        <header className="shrink-0 flex items-center justify-between px-3 py-2 bg-navy border-b border-white/10 text-white text-[11px] select-none z-30 gap-1.5">
          {/* Virtual Status Bar: Time & Quick Mode Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-brand">
              {new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="text-white/40">|</span>
            <span className="text-[10px] text-white/70">EJAZ 5G LTE</span>
            {(bypassAuthUser || currentUser) && (
              <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentUser(DEMO_DRIVER_USER);
                    setCurrentScreen("app");
                  }}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold transition-colors",
                    currentScreen === "app" && currentUser?.role === "DRIVER"
                      ? "bg-brand text-on-brand"
                      : "text-white/80 hover:text-white"
                  )}
                >
                  <IconTruck size={10} />
                  <span>{t("Driver", "سائق")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentUser(DEMO_CLIENT_USER);
                    setCurrentScreen("app");
                  }}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold transition-colors",
                    currentScreen === "app" && currentUser?.role !== "DRIVER"
                      ? "bg-accent-2 text-white"
                      : "text-white/80 hover:text-white"
                  )}
                >
                  <IconProfile size={10} />
                  <span>{t("Client", "عميل")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentScreen("login")}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[9.5px] font-bold transition-colors",
                    currentScreen === "login" || currentScreen === "register"
                      ? "bg-white/25 text-white"
                      : "text-white/70 hover:text-white"
                  )}
                >
                  <span>{t("Sign in", "الدخول")}</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Utility Actions: Language, Theme */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <button
                onClick={() => setLangMenuOpen((v) => !v)}
                className="flex items-center gap-1 rounded-[6px] bg-white/10 px-2 py-0.5 text-[10px] font-bold transition-colors hover:bg-white/20"
                title={tk("language.choose")}
                aria-haspopup="listbox"
                aria-expanded={langMenuOpen}
              >
                <IconGlobe size={11} />
                <span>{LANGUAGE_OPTIONS.find((o) => o.code === lang)?.flag}</span>
                <span>{tk(LANGUAGE_OPTIONS.find((o) => o.code === lang)?.labelKey ?? "language.ar")}</span>
              </button>
              {langMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setLangMenuOpen(false)} />
                  <div className="menu-pop absolute end-0 z-20 mt-1.5 w-[190px] p-1.5 text-text-primary">
                    <LanguageList compact onSelect={() => setLangMenuOpen(false)} />
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="px-2 py-0.5 rounded-[6px] bg-white/10 hover:bg-white/20 text-[10px] font-bold transition-colors"
              title={t("Toggle Theme", "تبديل المظهر")}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </div>
        </header>

        {/* Real App Viewport Screen Content */}
        <main className="relative flex-1 min-h-0 overflow-hidden bg-surface-0">
          {currentScreen === "welcome" && (
            <SplashScreen onContinue={handleWelcomeContinue} />
          )}

          {currentScreen === "login" && (
            <ErrorBoundary fallbackTitle="حدث خطأ في تحميل شاشة تسجيل الدخول">
              <LoginScreen
                onLoginSuccess={handleLoginSuccess}
                onRegister={(kind) => {
                  setRegisterType(kind);
                  setCurrentScreen("register");
                }}
              />
            </ErrorBoundary>
          )}

          {currentScreen === "register" && (
            <ErrorBoundary fallbackTitle="حدث خطأ في تحميل طلب التسجيل">
              <RegistrationScreen
                initialType={registerType}
                onBackToLogin={() => setCurrentScreen("login")}
                onSubmitted={() => setCurrentScreen("login")}
              />
            </ErrorBoundary>
          )}

          {currentScreen === "app" && currentUser && awaitingApproval && (
            <ErrorBoundary fallbackTitle="حدث خطأ في تحميل حالة الطلب">
              <RegistrationStatusScreen
                user={currentUser}
                onLogout={handleLogout}
                onApproved={async () => {
                  try {
                    const me = await apiClient.auth.me();
                    setCurrentUser(me);
                  } catch {
                    /* keep the current session */
                  }
                }}
              />
            </ErrorBoundary>
          )}

          {currentScreen === "app" && currentUser && !awaitingApproval && (
            currentUser.role === "DRIVER" ? (
              <DriverMode user={currentUser} onLogout={handleLogout} />
            ) : (
              <ClientMode user={currentUser} onLogout={handleLogout} />
            )
          )}
        </main>
      </div>
    </div>
  );
}
