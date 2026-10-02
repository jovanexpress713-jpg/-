import { useState, useEffect } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { PhoneFrame } from "./PhoneFrame";
import { LoginScreen } from "./LoginScreen";
import { ClientMode } from "./ClientMode";
import { DriverMode } from "./DriverMode";
import { SplashScreen } from "./SplashScreen";
import { apiClient, setAuthToken } from "../services/apiClient";
import { IconTruck, IconProfile } from "../components/Icons";

export function MobileApp() {
  const { t } = useSettings();
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem("ejaz_current_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeMode, setActiveMode] = useState<"client" | "driver">("client");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showSplash] = useState(false);

  // Sync current user to local cache
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem("ejaz_current_user", JSON.stringify(currentUser));
        if (currentUser.role === "DRIVER") {
          setActiveMode("driver");
        } else {
          setActiveMode("client");
        }
      } else {
        localStorage.removeItem("ejaz_current_user");
      }
    } catch {
      /* ignore */
    }
  }, [currentUser]);

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    if (user.role === "DRIVER") {
      setActiveMode("driver");
    } else {
      setActiveMode("client");
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    apiClient.auth.logout().catch(() => {});
  };

  // Render internal screen inside the Android frame
  const renderAppContent = () => {
    if (showSplash) {
      return <SplashScreen replayKey={1} />;
    }

    if (!currentUser) {
      return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    }

    if (activeMode === "driver") {
      return <DriverMode user={currentUser} onLogout={handleLogout} />;
    }

    return <ClientMode user={currentUser} onLogout={handleLogout} />;
  };

  return (
    <div className="dotted-light scroll-thin h-full overflow-y-auto bg-paper">
      <div className="mx-auto max-w-[1180px] px-4 py-6">
        {/* Top Operational Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-navy/10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-navy px-3 py-1 text-[10.5px] font-semibold tracking-wider text-accent-2 uppercase">
              {t("Android Multi-Role Application", "تطبيق أندرويد موحد متعدد الأدوار")}
            </div>
            <h1 className="mt-1 text-[20px] font-bold text-navy">
              {t("EJAZ One Android App: Client + Driver + Tracking", "تطبيق إيجاز أندرويد الموحد: العميل + السائق + التتبع الحي")}
            </h1>
          </div>

          {/* Quick Controls Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {currentUser && (
              <div className="flex items-center gap-1.5 rounded-full bg-navy/5 p-1 border border-navy/10 text-[11px]">
                <button
                  onClick={() => setActiveMode("client")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 transition-all font-semibold",
                    activeMode === "client" ? "bg-accent-2 text-white shadow-sm" : "text-navy/70 hover:text-navy"
                  )}
                >
                  <IconProfile size={13} />
                  <span>{t("Client Mode", "وضع العميل")}</span>
                </button>

                <button
                  onClick={() => setActiveMode("driver")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 transition-all font-semibold",
                    activeMode === "driver" ? "bg-brand text-on-brand shadow-sm" : "text-navy/70 hover:text-navy"
                  )}
                >
                  <IconTruck size={13} />
                  <span>{t("Driver Mode", "وضع السائق")}</span>
                </button>
              </div>
            )}

            <button
              onClick={() => setIsFullScreen((v) => !v)}
              className="rounded-full bg-navy px-3.5 py-1.5 text-[11.5px] font-semibold text-white shadow hover:bg-brand hover:text-navy transition-all"
            >
              {isFullScreen ? t("Framed Device", "إطار الهاتف") : t("Full View", "تكبير العرض")}
            </button>
          </div>
        </div>

        {/* Device Container */}
        <div className="mt-6 flex justify-center items-center">
          <div
            className={cn(
              "transition-all duration-300",
              isFullScreen ? "w-full max-w-[420px] h-[780px]" : "w-[305px] h-[640px]"
            )}
          >
            <PhoneFrame
              glow
              tone="dark"
              className={cn("w-full h-full", isFullScreen && "rounded-[32px] p-[5px]")}
            >
              {renderAppContent()}
            </PhoneFrame>
          </div>
        </div>
      </div>
    </div>
  );
}
