import { useState, useEffect } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { LoginScreen } from "./LoginScreen";
import { RegistrationScreen, RegistrationStatusScreen } from "./RegistrationFlow";
import { ClientMode } from "./ClientMode";
import { DriverMode } from "./DriverMode";
import { SplashScreen } from "./SplashScreen";
import { apiClient, setAuthToken, getAuthToken } from "../services/apiClient";
import { IconGlobe, IconTruck, IconProfile } from "../components/Icons";
import { ErrorBoundary } from "../components/ErrorBoundary";

type ScreenFlow = "welcome" | "login" | "register" | "app";

export function MobileApp({ onStaffLogin }: { onStaffLogin?: (user: any) => void } = {}) {
  const { t, lang, setLang, theme, setTheme } = useSettings();
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  /**
   * The welcome screen is the real entry point of the application — it is not a
   * destination behind a toolbar button. It renders first, and the session probe
   * below decides where the operator goes next:
   *
   *   no session      → welcome → (tap to continue) → login / register → app
   *   session present → welcome → session validated → app  (no re-login)
   */
  const [currentScreen, setCurrentScreen] = useState<ScreenFlow>("welcome");
  const [registerType, setRegisterType] = useState<"DRIVER" | "CUSTOMER">("DRIVER");

  // Validate a stored session so a signed-in operator is never asked to sign in
  // again. The cached profile is used only to render instantly; the server
  // answer is authoritative and a rejected token clears the local session.
  useEffect(() => {
    let cancelled = false;

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

      // Render from cache immediately, then confirm with the server.
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
  }, []);

  // Sync current user to local cache
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem("ejaz_current_user", JSON.stringify(currentUser));
      } else {
        localStorage.removeItem("ejaz_current_user");
      }
    } catch {
      /* ignore */
    }
  }, [currentUser]);

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

    // Staff identities belong to the unified control room, not the driver/client app
    if (onStaffLogin && user?.role && STAFF_ROLES.includes(user.role)) {
      setCurrentUser(user);
      setCurrentScreen("app");
      onStaffLogin(user);
      return;
    }

    setCurrentUser(user);
    setCurrentScreen("app");
  };

  /**
   * An account created through a registration request only receives the account
   * functions after the administration approves it. Until then the applicant can
   * sign in and follow the request status.
   */
  const isApplicantRole = currentUser?.role === "DRIVER" || currentUser?.role === "CUSTOMER";
  const awaitingApproval = isApplicantRole && currentUser?.accountApproved === false;

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setSessionChecked(true);
    setCurrentScreen("login");
    apiClient.auth.logout().catch(() => {});
  };

  /**
   * "اضغط للمتابعة" is the single transition out of the welcome screen. A
   * validated session goes straight to the app; everyone else reaches sign-in.
   */
  const handleWelcomeContinue = () => {
    if (currentUser && sessionChecked) {
      setCurrentScreen("app");
    } else {
      setCurrentScreen("login");
    }
  };

  return (
    <div className="h-full w-full bg-surface-0 flex flex-col items-center justify-center overflow-hidden">
      {/* Real Mobile App Viewport Container — No fake dotted mockup frame */}
      <div className="relative h-full w-full max-w-[430px] bg-surface-0 shadow-2xl flex flex-col overflow-hidden border-x border-border-subtle">
        {/* Android Real System Bar & Utility Header */}
        <header className="shrink-0 flex items-center justify-between px-4 py-2 bg-navy border-b border-white/10 text-white text-[11px] select-none z-30">
          {/* Virtual Status Bar: Time & Connectivity */}
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-brand">
              {new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="text-white/40">|</span>
            <span className="text-[10px] text-white/70">EJAZ 5G LTE</span>
          </div>

          {/* Quick Utility Actions: Language, Theme, User Role */}
          <div className="flex items-center gap-1.5">
            {/* 3-Language Toggle */}
            <button
              onClick={() => {
                if (lang === "ar") setLang("en");
                else if (lang === "en") setLang("ur");
                else setLang("ar");
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-white/10 hover:bg-white/20 text-[10px] font-bold transition-colors"
              title="تغيير اللغة · Language · زبان"
            >
              <IconGlobe size={11} />
              <span>{lang === "ar" ? "عربي" : lang === "ur" ? "اردو" : "EN"}</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="px-2 py-0.5 rounded-[6px] bg-white/10 hover:bg-white/20 text-[10px] font-bold transition-colors"
              title={t("Toggle Theme", "تبديل المظهر")}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>

            {/* Current Role Indicator */}
            {currentUser && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-[6px] text-[9.5px] font-bold uppercase",
                  currentUser.role === "DRIVER"
                    ? "bg-brand text-on-brand"
                    : "bg-accent-2 text-white"
                )}
              >
                {currentUser.role === "DRIVER" ? (
                  <span className="flex items-center gap-1">
                    <IconTruck size={10} />
                    <span>سائق</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <IconProfile size={10} />
                    <span>عميل</span>
                  </span>
                )}
              </span>
            )}
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
                  // Approved: refresh the session so the account functions unlock.
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
