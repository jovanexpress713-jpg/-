import { useState, useEffect } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { BrandLogo } from "../components/Logo";
import { apiClient, setAuthToken } from "../services/apiClient";
import {
  IconLock,
  IconProfile,
  IconEye,
  IconEyeOff,
  IconTruck,
  IconDashboard,
  IconAlertCircle,
  IconClose,
  IconKey,
} from "../components/Icons";

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

interface DemoAccount {
  key: "client" | "driver" | "admin";
  role: "CLIENT" | "DRIVER" | "ADMIN";
  titleAr: string;
  titleEn: string;
  email: string;
  password: string;
  descAr: string;
}

const OFFICIAL_DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: "client",
    role: "CLIENT",
    titleAr: "تجربة حساب العميل",
    titleEn: "Demo Client",
    email: "client@ejaz.sa",
    password: "Ejaz@2026Client",
    descAr: "متابعة الشحنات والرحلات، والتتبع المباشر، ومستندات بوليصة الشحن وإثبات التسليم POD",
  },
  {
    key: "driver",
    role: "DRIVER",
    titleAr: "تجربة حساب السائق",
    titleEn: "Demo Driver",
    email: "driver@ejaz.sa",
    password: "Ejaz@2026Driver",
    descAr: "عرض وطلب الرحلات المتاحة، تنفيذ مراحل الرحلة، وإثبات التسليم الميداني",
  },
  {
    key: "admin",
    role: "ADMIN",
    titleAr: "تجربة حساب الإدارة",
    titleEn: "Demo Admin",
    email: "admin@ejaz.sa",
    password: "Ejaz@2026Admin",
    descAr: "لوحة التحكم المركزية، إدارة الأسطول والشاحنات، واعتماد طلبات السائقين",
  },
];

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { t, lang } = useSettings();

  // Inputs & Credentials
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [activeDemoKey, setActiveDemoKey] = useState<string | null>(null);

  // Check demo accounts feature flag safely without throwing if import.meta.env is undefined
  const isDemoEnabled = (() => {
    try {
      if (typeof import.meta !== "undefined" && import.meta && (import.meta as any).env) {
        const env = (import.meta as any).env;
        return Boolean(env.DEV || env.VITE_ENABLE_DEMO_ACCOUNTS === "true" || env.VITE_ENABLE_DEMO_ACCOUNTS !== "false");
      }
      return true;
    } catch {
      return true;
    }
  })();

  // Load remembered username on mount
  useEffect(() => {
    try {
      const savedRemember = localStorage.getItem("ejaz_remember_me");
      const savedUser = localStorage.getItem("ejaz_remember_username");
      if (savedRemember === "true" && savedUser) {
        setUsername(savedUser);
        setRememberMe(true);
      } else if (!username) {
        // Initial default suggestion for swift onboarding in dev
        setUsername("client@ejaz.sa");
      }
    } catch {
      // Safe fallback
      if (!username) setUsername("client@ejaz.sa");
    }
  }, []);

  // Real authentication submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg(
        t(
          "Please enter your username/email and password",
          "يرجى إدخال اسم المستخدم وكلمة المرور"
        )
      );
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await apiClient.auth.login(username.trim(), password);
      if (res?.token && res?.user) {
        // Handle "Remember Me"
        try {
          if (rememberMe) {
            localStorage.setItem("ejaz_remember_me", "true");
            localStorage.setItem("ejaz_remember_username", username.trim());
          } else {
            localStorage.removeItem("ejaz_remember_me");
            localStorage.removeItem("ejaz_remember_username");
          }
        } catch {
          /* ignore */
        }

        setAuthToken(res.token);
        onLoginSuccess(res.user);
      } else {
        setErrorMsg(
          t(
            "Invalid username or password. Please verify your credentials.",
            "بيانات تسجيل الدخول غير صحيحة. يرجى التأكد من اسم المستخدم وكلمة المرور."
          )
        );
      }
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          t(
            "Authentication failed. Please check server connectivity.",
            "فشل تسجيل الدخول. يرجى التحقق من اتصال الخادم وبيانات الدخول."
          )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Demo account selection: auto-fills fields without bypassing authentication
  const handleSelectDemo = (account: DemoAccount) => {
    setUsername(account.email);
    setPassword(account.password);
    setActiveDemoKey(account.key);
    setErrorMsg(null);
    setShowDemoModal(false);
  };

  // Switch Account / Clear fields
  const handleSwitchAccount = () => {
    setUsername("");
    setPassword("");
    setActiveDemoKey(null);
    setErrorMsg(null);
  };

  return (
    <div className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-[#070b14] text-white select-none flex flex-col justify-between">
      {/* 1. Cinematic Full-Screen Background: Luxury Mercedes-Benz Actros Truck */}
      <div className="absolute inset-0 h-full w-full overflow-hidden select-none pointer-events-none z-0">
        <img
          src="/images/actros_login_bg.jpg"
          alt="Mercedes-Benz Actros Heavy Freight Truck"
          className="h-full w-full object-cover object-top sm:object-center transform scale-100 transition-transform duration-700"
          referrerPolicy="no-referrer"
          loading="eager"
        />
        {/* Cinematic Multi-Layer Dark Gradient & Contrast Overlays */}
        {/* Top subtle vignette for header contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#070b14]/65 via-[#070b14]/30 to-[#070b14]/95" />
        {/* Bottom smooth dark wash ensuring crystal clear form readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-[#070b14]/80 to-transparent" />
        {/* Subtle warm amber/orange ambient reflections */}
        <div className="absolute top-1/4 -end-12 h-64 w-64 rounded-full bg-brand/15 blur-3xl" />
        <div className="absolute bottom-16 -start-12 h-56 w-56 rounded-full bg-blue-600/10 blur-3xl" />
      </div>

      {/* 2. Top Header & Welcome Section */}
      <div className="relative z-10 w-full px-6 pt-7 pb-2 flex flex-col items-center text-center">
        {/* Official EJAZ Logo Lockup (Unchanged proportions and Arabic typography) */}
        <div className="flex flex-col items-center">
          <BrandLogo size={42} showSub={false} />
        </div>

        {/* 4. Strong Welcome Message */}
        <div className="mt-4 space-y-1">
          <h1 className="text-[20px] font-bold text-white tracking-tight leading-snug">
            <span>{lang === "ar" ? "مرحبًا بك في " : "Welcome to "}</span>
            <span className="text-brand font-extrabold">{t("EJAZ", "إيجاز")}</span>
            <span>{lang === "ar" ? " للنقليات" : " Transport"}</span>
          </h1>
          <p className="text-[12.5px] font-medium text-amber-200/80 tracking-wide">
            {t("Your Cargo.. Our Responsibility", "نقلكم .. مسؤوليتنا")}
          </p>
        </div>
      </div>

      {/* 3. Main Form Container */}
      <div className="relative z-10 w-full max-w-[390px] mx-auto px-6 py-2 flex-1 flex flex-col justify-center">
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Authentication Error Feedback Banner */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-xl bg-status-danger/15 border border-status-danger/35 p-3 text-[11.5px] text-red-200 animate-fade-in shadow-md">
              <IconAlertCircle size={17} className="text-status-danger shrink-0 mt-0.5" />
              <div className="leading-relaxed flex-1 text-start">{errorMsg}</div>
            </div>
          )}

          {/* Active Demo Account Pill Indicator */}
          {activeDemoKey && isDemoEnabled && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-brand/15 border border-brand/30 text-[11px] text-amber-300">
              <span className="flex items-center gap-1.5 font-medium">
                <IconKey size={13} className="text-brand shrink-0" />
                <span>
                  {activeDemoKey === "client" && "تم تحديد: حساب العميل التجريبي"}
                  {activeDemoKey === "driver" && "تم تحديد: حساب السائق التجريبي"}
                  {activeDemoKey === "admin" && "تم تحديد: حساب الإدارة التجريبي"}
                </span>
              </span>
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="text-[10px] text-text-muted hover:text-white underline underline-offset-2"
              >
                {t("Clear", "إلغاء")}
              </button>
            </div>
          )}

          {/* 5. Username / Email Field */}
          <div>
            <label className="block text-[11.5px] font-semibold text-slate-300 mb-1 text-start">
              {t("Username / Email", "اسم المستخدم")}
            </label>
            <div className="group relative flex h-12 items-center rounded-xl bg-[#0e1626]/90 px-3.5 border border-slate-700/60 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all shadow-sm">
              <IconProfile
                size={17}
                className="text-slate-400 group-focus-within:text-brand transition-colors shrink-0"
              />
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (activeDemoKey) setActiveDemoKey(null);
                }}
                placeholder={t("Username", "اسم المستخدم")}
                required
                dir="rtl"
                className="w-full bg-transparent px-2.5 text-[13.5px] text-white placeholder-slate-500 outline-none text-start"
                autoComplete="username"
              />
            </div>
          </div>

          {/* 6. Password Field */}
          <div>
            <label className="block text-[11.5px] font-semibold text-slate-300 mb-1 text-start">
              {t("Password", "كلمة المرور")}
            </label>
            <div className="group relative flex h-12 items-center rounded-xl bg-[#0e1626]/90 px-3.5 border border-slate-700/60 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all shadow-sm">
              <IconLock
                size={17}
                className="text-slate-400 group-focus-within:text-brand transition-colors shrink-0"
              />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (activeDemoKey) setActiveDemoKey(null);
                }}
                placeholder={t("Password", "كلمة المرور")}
                required
                dir="rtl"
                className="w-full bg-transparent px-2.5 text-[13.5px] text-white placeholder-slate-500 outline-none text-start font-mono"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                className="p-1 text-slate-400 hover:text-white transition-colors focus:outline-none"
              >
                {showPassword ? <IconEyeOff size={17} /> : <IconEye size={17} />}
              </button>
            </div>
          </div>

          {/* 7 & 8. Remember Me & Forgot Password */}
          <div className="flex items-center justify-between text-[11.5px] pt-0.5">
            {/* Functional Remember Me */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-surface-2 text-brand focus:ring-brand/20 accent-brand cursor-pointer"
              />
              <span className="font-medium">{t("Remember me", "تذكرني")}</span>
            </label>

            {/* Functional Forgot Password */}
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-slate-400 hover:text-brand transition-colors font-medium hover:underline underline-offset-4"
            >
              {t("Forgot password?", "نسيت كلمة المرور؟")}
            </button>
          </div>

          {/* 9. Sign In Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-brand text-on-brand font-bold text-[14px] shadow-lg shadow-brand/25 transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-on-brand border-t-transparent animate-spin" />
                <span>{t("Verifying credentials…", "جاري التحقق من الهوية…")}</span>
              </span>
            ) : (
              <span>{t("Sign In", "تسجيل الدخول")}</span>
            )}
          </button>

          {/* 10 & 12. Switch Account & Demo Accounts Row */}
          <div className="pt-2 flex items-center justify-between text-[11.5px] border-t border-slate-800/80">
            {/* 10. Switch Account */}
            <button
              type="button"
              onClick={handleSwitchAccount}
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 font-medium"
            >
              <span>{t("Sign in with another account", "الدخول بحساب آخر")}</span>
            </button>

            {/* 12. Demo Accounts Trigger */}
            {isDemoEnabled && (
              <button
                type="button"
                onClick={() => setShowDemoModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-surface-2/90 border border-slate-700/70 px-2.5 py-1 text-amber-400 hover:text-amber-300 hover:bg-surface-2 transition-all font-semibold active:scale-95"
              >
                <IconKey size={13} className="text-brand" />
                <span>{t("Demo Accounts", "الحسابات التجريبية")}</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Footer System Line */}
      <div className="relative z-10 py-3 text-center text-[10.5px] text-slate-500 border-t border-slate-900">
        <span>{t("EJAZ Enterprise Logistics Platform V1.0-PROD", "مؤسسة إيجاز للنقليات · منظومة إدارة الأسطول الموحدة")}</span>
      </div>

      {/* 12. Demo Accounts Modal / Panel */}
      {showDemoModal && isDemoEnabled && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm rounded-2xl bg-[#0c1424] border border-slate-700 p-5 shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/20 text-brand">
                  <IconKey size={16} />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-white">
                    {t("Demo Accounts", "الحسابات التجريبية")}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {t("Environment: Development / Testing Only", "مخصصة لبيئة التطوير والاختبار فقط")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <IconClose size={16} />
              </button>
            </div>

            {/* Accounts List */}
            <div className="space-y-2">
              {OFFICIAL_DEMO_ACCOUNTS.map((acc) => {
                const isSelected = username === acc.email;
                return (
                  <button
                    key={acc.key}
                    type="button"
                    onClick={() => handleSelectDemo(acc)}
                    className={cn(
                      "w-full rounded-xl border p-3 text-start transition-all relative",
                      isSelected
                        ? "bg-brand/15 border-brand ring-1 ring-brand/30 shadow-md"
                        : "bg-[#111c30] border-slate-800 hover:border-slate-700 hover:bg-[#15233c]"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {acc.role === "CLIENT" && <IconProfile size={15} className="text-accent-2" />}
                        {acc.role === "DRIVER" && <IconTruck size={15} className="text-brand" />}
                        {acc.role === "ADMIN" && <IconDashboard size={15} className="text-emerald-400" />}
                        <span className="text-[12.5px] font-bold text-white">
                          {acc.titleAr}
                        </span>
                      </div>
                      <span className="rounded px-1.5 py-0.5 text-[9.5px] font-bold tracking-wider uppercase bg-slate-800 text-slate-300">
                        {acc.role}
                      </span>
                    </div>

                    <div className="mt-1 text-[11px] text-brand/90 font-mono" dir="ltr">
                      {acc.email}
                    </div>

                    <p className="mt-1 text-[10.5px] text-slate-400 leading-snug">
                      {acc.descAr}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Note & Action */}
            <div className="text-[10px] text-slate-400 bg-slate-900/60 rounded-lg p-2.5 leading-relaxed text-start border border-slate-800">
              {t(
                "Selecting an account will pre-fill credentials. You will then click Sign In to authenticate through the real system.",
                "اختيار الحساب يقوم بتعبئة البيانات تلقائيًا، ثم يمكنك الضغط على «تسجيل الدخول» لإتمام تدفق المصادقة الحقيقي."
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. Forgot Password Corporate Assistance Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm rounded-2xl bg-[#0c1424] border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/20 text-brand">
                  <IconLock size={16} />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-white">
                    {t("Reset Password", "استعادة كلمة المرور")}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {t("EJAZ Enterprise Security", "منظومة إيجاز لأمن المعلومات")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <IconClose size={16} />
              </button>
            </div>

            <div className="space-y-3 text-[12px] text-slate-300 leading-relaxed text-start">
              <p>
                {t(
                  "To protect enterprise freight and fleet operations data, password resets require verification by the system administrator or your fleet manager.",
                  "لحماية بيانات عمليات النقل والأسطول، تتطلب إعادة تعيين كلمة المرور التحقق من قبل مسؤول النظام أو إدارة الحركة والعمليات."
                )}
              </p>
              <div className="rounded-xl bg-[#111c30] p-3 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-white text-[12px]">
                  {t("Technical Support Desk:", "الدعم الفني لإيجاز للنقليات:")}
                </div>
                <div className="text-brand font-mono text-[12px]" dir="ltr">
                  support@ejaz.sa
                </div>
                <div className="text-slate-400 text-[11px]" dir="ltr">
                  +966 11 222 3344 (Ext. 102)
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="w-full h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-[12px] transition-colors"
            >
              {t("Close", "إغلاق")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
