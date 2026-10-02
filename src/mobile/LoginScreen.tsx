import { useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { BrandLogo } from "../components/Logo";
import { apiClient, setAuthToken } from "../services/apiClient";
import { IconLock, IconTruck, IconProfile } from "../components/Icons";

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { t } = useSettings();
  const [email, setEmail] = useState("client@ejaz.sa");
  const [password, setPassword] = useState("Ejaz@2026!");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setErrorMsg(t("Please fill in email and password", "يرجى إدخال البريد الإلكتروني وكلمة المرور"));
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await apiClient.auth.login(email.trim(), password);
      if (res?.token && res?.user) {
        setAuthToken(res.token);
        onLoginSuccess(res.user);
      } else {
        setErrorMsg(t("Invalid login credentials", "بيانات الدخول غير صحيحة"));
      }
    } catch (err: any) {
      setErrorMsg(err.message || t("Login failed. Check server connection", "فشل تسجيل الدخول. تأكد من اتصال الخادم"));
    } finally {
      setIsLoading(false);
    }
  };

  const selectDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Ejaz@2026!");
    setErrorMsg(null);
  };

  return (
    <div className="relative h-full w-full overflow-y-auto bg-surface-0 px-6 pt-12 pb-8 flex flex-col justify-between text-white select-none">
      {/* Background Ambience */}
      <div className="pointer-events-none absolute -top-24 -end-24 h-64 w-64 rounded-full bg-brand/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -start-24 h-64 w-64 rounded-full bg-accent-2/15 blur-3xl" />

      {/* Header with EJAZ Logo */}
      <div className="relative z-10 flex flex-col items-center text-center mt-4">
        <BrandLogo size={48} showSub={false} />
        <h1 className="mt-4 text-[22px] font-bold text-white tracking-tight">
          {t("EJAZ Transport", "إيجاز للنقليات")}
        </h1>
        <p className="mt-1 text-[12px] text-text-muted max-w-[240px] leading-relaxed">
          {t(
            "Unified heavy freight & fleet operations platform",
            "المنظومة الموحدة للنقل الثقيل وإدارة الشحنات والأسطول"
          )}
        </p>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="relative z-10 my-auto py-4 space-y-4">
        {errorMsg && (
          <div className="rounded-[12px] bg-status-danger/15 border border-status-danger/30 p-3 text-[11.5px] text-status-danger text-center animate-fade-in">
            {errorMsg}
          </div>
        )}

        {/* Email Field */}
        <div>
          <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 text-start">
            {t("Account Email", "البريد الإلكتروني")}
          </label>
          <div className="flex h-11 items-center gap-2.5 rounded-[12px] bg-surface-2 px-3.5 border border-border-subtle focus-within:border-brand transition-colors">
            <IconProfile size={16} className="text-text-muted shrink-0" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@ejaz.sa"
              required
              className="w-full bg-transparent text-[13px] text-text-primary outline-none"
              autoComplete="username"
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 text-start">
            {t("Password", "كلمة المرور")}
          </label>
          <div className="flex h-11 items-center gap-2.5 rounded-[12px] bg-surface-2 px-3.5 border border-border-subtle focus-within:border-brand transition-colors">
            <IconLock size={16} className="text-text-muted shrink-0" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-transparent text-[13px] text-text-primary outline-none"
              autoComplete="current-password"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 w-full flex h-11 items-center justify-center gap-2 rounded-[12px] bg-brand text-on-brand font-bold text-[13px] shadow-lg shadow-brand/25 transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-on-brand border-t-transparent animate-spin" />
              {t("Verifying credentials…", "جاري التحقق…")}
            </span>
          ) : (
            <span>{t("Sign In to EJAZ", "تسجيل الدخول إلى إيجاز")}</span>
          )}
        </button>

        {/* Quick Demo Credentials Selector */}
        <div className="pt-2">
          <div className="flex items-center gap-2 text-[10.5px] text-text-muted mb-2 justify-center">
            <span className="h-px w-10 bg-border-subtle" />
            <span>{t("Quick Test Accounts", "حسابات تجريبية فورية")}</span>
            <span className="h-px w-10 bg-border-subtle" />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => selectDemoAccount("client@ejaz.sa")}
              className={cn(
                "p-2 rounded-[10px] border text-start transition-all",
                email === "client@ejaz.sa"
                  ? "bg-accent-2/15 border-accent-2 text-accent-2 font-bold"
                  : "bg-surface-2 border-border-subtle text-text-secondary hover:text-white"
              )}
            >
              <div className="flex items-center gap-1.5">
                <IconProfile size={13} />
                <span>{t("Client Account", "حساب العميل")}</span>
              </div>
              <div className="text-[9.5px] opacity-70 mt-0.5 truncate">client@ejaz.sa</div>
            </button>

            <button
              type="button"
              onClick={() => selectDemoAccount("fahad.driver@ejaz.sa")}
              className={cn(
                "p-2 rounded-[10px] border text-start transition-all",
                email === "fahad.driver@ejaz.sa"
                  ? "bg-brand/15 border-brand text-brand font-bold"
                  : "bg-surface-2 border-border-subtle text-text-secondary hover:text-white"
              )}
            >
              <div className="flex items-center gap-1.5">
                <IconTruck size={13} />
                <span>{t("Driver Account", "حساب السائق")}</span>
              </div>
              <div className="text-[9.5px] opacity-70 mt-0.5 truncate">fahad.driver@ejaz.sa</div>
            </button>
          </div>
        </div>
      </form>

      {/* Footer Info */}
      <div className="relative z-10 text-center text-[10px] text-text-muted">
        <span>{t("EJAZ Enterprise Logistics Platform V1.0-PROD", "منظومة إيجاز للنقل اللوجستي المتكامل")}</span>
      </div>
    </div>
  );
}
