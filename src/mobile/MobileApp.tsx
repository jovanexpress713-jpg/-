import { useState, useEffect, useMemo } from "react";
import { useSettings } from "../settings";
import { LoginScreen } from "./LoginScreen";
import { RegistrationScreen, RegistrationStatusScreen } from "./RegistrationFlow";
import { ClientMode } from "./ClientMode";
import { DriverMode } from "./DriverMode";
import { SplashScreen } from "./SplashScreen";
import { MobileAppSettings } from "./MobileAppSettings";
import { useMobileNotifications } from "./MobileShared";
import { apiClient, setAuthToken, getAuthToken } from "../services/apiClient";
import { canSwitchAccounts, isClientRole, isDriverRole, type SessionUser } from "../utils/permissions";
import { BrandLogo } from "../components/Logo";
import { IconBell, IconMenu, IconArrowRight } from "../components/Icons";
import { ErrorBoundary } from "../components/ErrorBoundary";

type ScreenFlow = "welcome" | "login" | "register" | "app";

/**
 * Mobile application shell (§3-§5).
 *
 * Full-screen on phones — no fake device frame, no fake status bar. The header
 * carries ONLY the EJAZ logo, the current page title, notifications and the
 * menu (§4). Clock, platform name, driver/client pills, sign-in, language and
 * theme were removed from here — they live in «إعدادات التطبيق» instead (§5).
 *
 * The driver app and the client app are independent interfaces over the same
 * backend, auth, users, roles and data (§1). `forcedInterface` opens a specific
 * app from the control room's «تطبيقات الجوال» area (§12).
 */
export function MobileApp({
  onStaffLogin,
  bypassAuthUser,
  forcedInterface,
  onLogout,
}: {
  onStaffLogin?: (user: any) => void;
  bypassAuthUser?: any;
  /** Set by the control room: open directly into the driver or client app. */
  forcedInterface?: "driver" | "client";
  /** Delegated sign-out (control-room sessions log out of everything). */
  onLogout?: () => void;
} = {}) {
  const { t } = useSettings();
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  const [currentScreen, setCurrentScreen] = useState<ScreenFlow>("welcome");
  const [registerType, setRegisterType] = useState<"DRIVER" | "CUSTOMER">("DRIVER");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifSignal, setNotifSignal] = useState(0);
  const [interfacePref, setInterfacePref] = useState<"driver" | "client">("driver");
  const { unread } = useMobileNotifications();

  useEffect(() => {
    let cancelled = false;

    if (bypassAuthUser) {
      const identity: SessionUser = bypassAuthUser;
      setCurrentUser(identity);
      if (forcedInterface) setInterfacePref(forcedInterface);
      else if (isClientRole(identity.role)) setInterfacePref("client");
      else setInterfacePref("driver");
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
  }, [bypassAuthUser, forcedInterface]);

  // Sync current user to local cache
  useEffect(() => {
    try {
      if (currentUser && !bypassAuthUser) {
        localStorage.setItem("ejaz_current_user", JSON.stringify(currentUser));
      } else if (!bypassAuthUser) {
        localStorage.removeItem("ejaz_current_user");
      }
    } catch {
      /* ignore */
    }
  }, [currentUser, bypassAuthUser]);

  // Adopt the interface that fits the signed-in identity (§13, §14).
  useEffect(() => {
    if (!currentUser) return;
    if (forcedInterface) {
      setInterfacePref(forcedInterface);
      return;
    }
    if (isDriverRole(currentUser.role)) setInterfacePref("driver");
    else if (isClientRole(currentUser.role)) setInterfacePref("client");
  }, [currentUser, forcedInterface]);

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
    if (onLogout && bypassAuthUser) {
      onLogout();
      return;
    }
    setAuthToken(null);
    apiClient.auth.logout().catch(() => {});
    setCurrentUser(null);
    setSessionChecked(true);
    setCurrentScreen("login");
    setSettingsOpen(false);
  };

  const handleWelcomeContinue = () => {
    if (currentUser && sessionChecked) {
      setCurrentScreen("app");
    } else {
      setCurrentScreen("login");
    }
  };

  /** Multi-role identities pick the interface in settings (§5), never in the header. */
  const maySwitchInterface =
    canSwitchAccounts(currentUser) || !!(currentUser?.driverId && currentUser?.customerId);

  const pageTitle = useMemo(() => {
    if (settingsOpen) return t("App Settings", "إعدادات التطبيق");
    return "";
  }, [settingsOpen, t]);

  const inApp = currentScreen === "app" && currentUser && !awaitingApproval;
  const showChrome = !!currentUser && currentScreen === "app";

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-surface-0">
      {/* Clean app header (§4): logo · title · notifications · menu. */}
      {showChrome && !settingsOpen && (
        <header className="relative z-30 flex shrink-0 items-center gap-2 border-b border-border-subtle bg-navy px-3 py-2 text-white">
          <BrandLogo size={26} showSub={false} />
          {pageTitle ? (
            <h1 className="min-w-0 flex-1 truncate text-body font-bold">{pageTitle}</h1>
          ) : (
            <div className="min-w-0 flex-1" />
          )}
          <button
            type="button"
            onClick={() => {
              setNotifSignal((n) => n + 1);
            }}
            className="relative grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label={t("Notifications", "الإشعارات")}
          >
            <IconBell size={15} />
            {unread > 0 && (
              <span className="absolute end-1 top-1 h-1.5 w-1.5 rounded-full bg-brand" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label={t("App Settings", "إعدادات التطبيق")}
          >
            <IconMenu size={15} />
          </button>
        </header>
      )}

      {/* Settings header with back */}
      {showChrome && settingsOpen && (
        <header className="relative z-30 flex shrink-0 items-center gap-2 border-b border-border-subtle bg-navy px-3 py-2 text-white">
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label={t("Back", "رجوع")}
          >
            <IconArrowRight size={15} className="rtl:rotate-180" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-body font-bold">{pageTitle}</h1>
        </header>
      )}

      <main className="relative min-h-0 flex-1 overflow-hidden bg-surface-0">
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

        {inApp && (
          interfacePref === "driver" ? (
            <DriverMode
              user={currentUser}
              onLogout={handleLogout}
              onOpenSettings={() => setSettingsOpen(true)}
              notificationsSignal={notifSignal}
            />
          ) : (
            <ClientMode
              user={currentUser}
              onLogout={handleLogout}
              onOpenSettings={() => setSettingsOpen(true)}
              notificationsSignal={notifSignal}
            />
          )
        )}

        {/* «إعدادات التطبيق» (§5) — account, language, appearance, time, app info. */}
        {settingsOpen && inApp && (
          <MobileAppSettings
            user={currentUser}
            onClose={() => setSettingsOpen(false)}
            interfacePref={interfacePref}
            onSwitchInterface={
              maySwitchInterface
                ? (next) => {
                    setInterfacePref(next);
                    setSettingsOpen(false);
                  }
                : undefined
            }
            onLogout={handleLogout}
          />
        )}
      </main>
    </div>
  );
}
