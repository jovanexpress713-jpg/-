import { useState, useEffect } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { LOGIN_BACKDROP } from "../data/catalog";
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
  /** Opens the formal registration-request flow (reviewed by the administration). */
  onRegister?: (type: "DRIVER" | "CUSTOMER") => void;
}

interface DemoAccount {
  key: "client" | "driver" | "admin";
  role: "CLIENT" | "DRIVER" | "ADMIN";
  titleAr: string;
  titleEn: string;
  email: string;
  password: string;
  descAr: string;
  fullName: string;
  driverId?: string;
  customerId?: string;
}

const OFFICIAL_DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: "client",
    role: "CLIENT",
    titleAr: "تجربة حساب العميل",
    titleEn: "Demo Client",
    email: "client@ejaz.sa",
    password: "Ejaz@2026Client",
    fullName: "شركة سدافكو للأغذية والمشروبات (عميل)",
    customerId: "cust-1",
    descAr: "متابعة الشحنات والرحلات، والتتبع المباشر، ومستندات بوليصة الشحن وإثبات التسليم POD",
  },
  {
    key: "driver",
    role: "DRIVER",
    titleAr: "تجربة حساب السائق",
    titleEn: "Demo Driver",
    email: "driver@ejaz.sa",
    password: "Ejaz@2026Driver",
    fullName: "فهد الشمري (كابتن أسطول)",
    driverId: "d1",
    descAr: "عرض وطلب الرحلات المتاحة، تنفيذ مراحل الرحلة، وإثبات التسليم الميداني",
  },
  {
    key: "admin",
    role: "ADMIN",
    titleAr: "تجربة حساب الإدارة",
    titleEn: "Demo Admin",
    email: "admin@ejaz.sa",
    password: "Ejaz@2026Admin",
    fullName: "فهد بن عبد العزيز السبيعي",
    descAr: "لوحة التحكم المركزية، إدارة الأسطول والشاحنات، واعتماد طلبات السائقين",
  },
];

function buildOfflineMobileUser(account: DemoAccount) {
  const canonicalRole =
    account.role === "ADMIN"
      ? "SUPER_ADMIN"
      : account.role === "CLIENT"
        ? "CUSTOMER"
        : "DRIVER";
  return {
    id: `u-${account.key}`,
    email: account.email,
    fullName: account.fullName,
    phone: "+966551234567",
    role: canonicalRole,
    driverId: account.driverId,
    customerId: account.customerId,
    permissions: ["*"],
    accountApproved: true,
  };
}

export function LoginScreen({ onLoginSuccess, onRegister }: LoginScreenProps) {
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

  const isDemoEnabled = true;

  // Load remembered username on mount
  useEffect(() => {
    try {
      const savedRemember = localStorage.getItem("ejaz_remember_me");
      const savedUser = localStorage.getItem("ejaz_remember_username");
      if (savedRemember === "true" && savedUser) {
        setUsername(savedUser);
        setRememberMe(true);
      } else if (!username) {
        setUsername("client@ejaz.sa");
      }
    } catch {
      if (!username) setUsername("client@ejaz.sa");
    }
  }, []);

  const finalizeLogin = (user: any, token?: string) => {
    if (token) {
      setAuthToken(token);
    }
    try {
      localStorage.setItem("ejaz_current_user", JSON.stringify(user));
    } catch {
      /* ignore */
    }
    onLoginSuccess(user);
  };

  // Instant 1-click demo login (works with backend or offline/static)
  const handleSelectDemo = async (account: DemoAccount) => {
    setUsername(account.email);
    setPassword(account.password);
    setActiveDemoKey(account.key);
    setErrorMsg(null);
    setShowDemoModal(false);
    setIsLoading(true);
    try {
      const res = await apiClient.auth.login(account.email, account.password);
      if (res?.token && res?.user) {
        finalizeLogin(res.user, res.token);
      } else {
        finalizeLogin(buildOfflineMobileUser(account));
      }
    } catch {
      finalizeLogin(buildOfflineMobileUser(account));
    } finally {
      setIsLoading(false);
    }
  };

  // Real authentication submission with demo fallback
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      // If password wasn't typed, check if username matches a demo account for instant login
      const matched = OFFICIAL_DEMO_ACCOUNTS.find(
        (a) => a.email.toLowerCase() === username.trim().toLowerCase()
      );
      if (matched) {
        await handleSelectDemo(matched);
        return;
      }
      setErrorMsg(
        t(
          "Please enter your username/email and password",
          "يرجى إدخال اسم المستخدم وكلمة المرور أو اختيار حساب تجريبي للدخول الفوري"
        )
      );
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await apiClient.auth.login(username.trim(), password);
      if (res?.token && res?.user) {
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

        finalizeLogin(res.user, res.token);
      } else {
        setErrorMsg(
          t(
            "Invalid username or password. Please verify your credentials.",
            "بيانات تسجيل الدخول غير صحيحة. يرجى التأكد من اسم المستخدم وكلمة المرور."
          )
        );
      }
    } catch (err: any) {
      const matched = OFFICIAL_DEMO_ACCOUNTS.find(
        (a) => a.email.toLowerCase() === username.trim().toLowerCase()
      );
      if (matched) {
        finalizeLogin(buildOfflineMobileUser(matched));
        return;
      }
      setErrorMsg(
        err.message ||
          t(
            "Authentication failed. Please check server connectivity.",
            "فشل تسجيل الدخول. يرجى اختيار أحد الحسابات التجريبية بالأسفل للدخول الفوري."
          )
      );
    } finally {
      setIsLoading(false);
    }
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
      {/* 1. Cinematic Full-Screen Background: the official EJAZ Actros photograph. */}
      <div className="absolute inset-0 h-full w-full overflow-hidden select-none pointer-events-none z-0">
        <img
          src={LOGIN_BACKDROP}
          alt={t("Mercedes-Benz Actros from the EJAZ Transport fleet", "شاحنة مرسيدس-بنز أكتوس من أسطول مؤسسة إيجاز للنقليات")}
          className="h-full w-full object-cover object-top sm:object-center transform scale-100 transition-transform duration-700"
          referrerPolicy="no-referrer"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#070b14]/65 via-[#070b14]/30 to-[#070b14]/95" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-[#070b14]/80 to-transparent" />
        <div className="absolute top-1/4 -end-12 h-64 w-64 rounded-full bg-brand/15 blur-3xl" />
        <div className="absolute bottom-16 -start-12 h-56 w-56 rounded-full bg-blue-600/10 blur-3xl" />
      </div>

      {/* 2. Top Header */}
      <div className="relative z-10 w-full px-6 pt-6 pb-2 flex flex-col items-center text-center">
        <div className="flex flex-col items-center">
          <BrandLogo size={42} showSub={false} />
        </div>

        <div className="mt-3 space-y-1">
          <h1 className="text-headline font-bold text-white tracking-tight leading-snug">
            <span>{lang === "ar" ? "مرحبًا بك في " : "Sign in to "}</span>
            <span className="text-brand font-extrabold">{t("EJAZ", "إيجاز")}</span>
            <span>{lang === "ar" ? " للنقليات" : " Transport"}</span>
          </h1>
          <p className="text-body font-medium text-amber-200/80 tracking-wide">
            {t("Your Cargo.. Our Responsibility", "نقلكم .. مسؤوليتنا")}
          </p>
        </div>
      </div>

      {/* 3. Main Form Container */}
      <div className="relative z-10 w-full max-w-[390px] mx-auto px-6 py-2 flex-1 flex flex-col justify-center">
        {/* Instant 1-Click Entry Strip (No Password Required) */}
        <div className="mb-3.5 rounded-inner border border-brand/35 bg-[#0e1626]/90 p-2.5 shadow-lg">
          <div className="mb-2 flex items-center justify-between text-label">
            <span className="font-bold text-amber-300">
              {t("Instant Preview (No Password):", "دخول فوري بدون كلمة مرور:")}
            </span>
            <span className="text-emerald-400 font-bold">
              {t("1-Tap Access", "بضغطة واحدة")}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {OFFICIAL_DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.key}
                type="button"
                disabled={isLoading}
                onClick={() => handleSelectDemo(acc)}
                className="flex flex-col items-center justify-center gap-1 rounded-chip border border-slate-700/80 bg-[#131f35] px-2 py-2 text-center transition-all hover:border-brand hover:bg-brand/20 active:scale-95"
              >
                {acc.role === "CLIENT" && <IconProfile size={14} className="text-accent-2" />}
                {acc.role === "DRIVER" && <IconTruck size={14} className="text-brand" />}
                {acc.role === "ADMIN" && <IconDashboard size={14} className="text-emerald-400" />}
                <span className="text-label font-bold text-white">
                  {acc.key === "client"
                    ? t("Client", "واجهة العميل")
                    : acc.key === "driver"
                      ? t("Driver", "واجهة السائق")
                      : t("Admin", "لوحة الإدارة")}
                </span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Authentication Error Feedback Banner */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-inner bg-status-danger/15 border border-status-danger/35 p-3 text-label-lg text-red-200 animate-fade-in shadow-md">
              <IconAlertCircle size={17} className="text-status-danger shrink-0 mt-0.5" />
              <div className="leading-relaxed flex-1 text-start">{errorMsg}</div>
            </div>
          )}

          {/* Active Demo Account Pill Indicator */}
          {activeDemoKey && isDemoEnabled && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-chip bg-brand/15 border border-brand/30 text-label text-amber-300">
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
                className="text-micro text-text-muted hover:text-white underline underline-offset-2"
              >
                {t("Clear", "إلغاء")}
              </button>
            </div>
          )}

          {/* 5. Username / Email Field */}
          <div>
            <label className="block text-label-lg font-semibold text-slate-300 mb-1 text-start">
              {t("Username / Email", "اسم المستخدم")}
            </label>
            <div className="group relative flex h-11 items-center rounded-inner bg-[#0e1626]/90 px-3.5 border border-slate-700/60 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all shadow-sm">
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
                dir="rtl"
                className="w-full bg-transparent px-2.5 text-body text-white placeholder-slate-500 outline-none text-start"
                autoComplete="username"
              />
            </div>
          </div>

          {/* 6. Password Field */}
          <div>
            <label className="block text-label-lg font-semibold text-slate-300 mb-1 text-start">
              {t("Password", "كلمة المرور")}
            </label>
            <div className="group relative flex h-11 items-center rounded-inner bg-[#0e1626]/90 px-3.5 border border-slate-700/60 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all shadow-sm">
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
                dir="rtl"
                className="w-full bg-transparent px-2.5 text-body text-white placeholder-slate-500 outline-none text-start font-mono"
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
          <div className="flex items-center justify-between text-label-lg pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-surface-2 text-brand focus:ring-brand/20 accent-brand cursor-pointer"
              />
              <span className="font-medium">{t("Remember me", "تذكرني")}</span>
            </label>

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
            className="w-full h-11 flex items-center justify-center gap-2 rounded-inner bg-brand text-on-brand font-bold text-card-title shadow-lg shadow-brand/25 transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-1"
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

          {/* 9b. Registration request */}
          {onRegister && (
            <div className="mt-2.5 rounded-inner border border-slate-700/60 bg-[#0e1626]/70 p-2.5">
              <div className="text-label font-bold text-slate-200">
                {t("No account yet?", "لا تملك حسابًا؟")}
              </div>
              <p className="mt-0.5 text-micro leading-relaxed text-slate-400">
                {t(
                  "Submit a formal registration request — the administration reviews it, then your account is activated.",
                  "قدّم طلب تسجيل رسمي — تراجعه الإدارة ثم يتم اعتماد حسابك وتفعيله.",
                )}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onRegister("DRIVER")}
                  className="flex items-center justify-center gap-1.5 rounded-chip border border-brand/40 bg-brand/10 py-1.5 text-label font-bold text-brand transition-colors hover:bg-brand hover:text-on-brand"
                >
                  <IconTruck size={14} />
                  {t("Driver request", "طلب تسجيل سائق")}
                </button>
                <button
                  type="button"
                  onClick={() => onRegister("CUSTOMER")}
                  className="flex items-center justify-center gap-1.5 rounded-chip border border-accent-2/40 bg-accent-2/10 py-1.5 text-label font-bold text-accent-2 transition-colors hover:bg-accent-2 hover:text-white"
                >
                  <IconProfile size={14} />
                  {t("Customer request", "طلب تسجيل عميل")}
                </button>
              </div>
            </div>
          )}

          {/* 10 & 12. Switch Account & Demo Accounts Row */}
          <div className="pt-2 flex items-center justify-between text-label-lg border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleSwitchAccount}
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 font-medium"
            >
              <span>{t("Sign in with another account", "الدخول بحساب آخر")}</span>
            </button>

            {isDemoEnabled && (
              <button
                type="button"
                onClick={() => setShowDemoModal(true)}
                className="flex items-center gap-1.5 rounded-chip bg-surface-2/90 border border-slate-700/70 px-2.5 py-1 text-amber-400 hover:text-amber-300 hover:bg-surface-2 transition-all font-semibold active:scale-95"
              >
                <IconKey size={13} className="text-brand" />
                <span>{t("Demo Accounts", "الحسابات التجريبية")}</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Footer System Line */}
      <div className="relative z-10 py-2.5 text-center text-label text-slate-500 border-t border-slate-900">
        <span>{t("EJAZ Enterprise Logistics Platform V1.0-PROD", "مؤسسة إيجاز للنقليات · منظومة إدارة الأسطول الموحدة")}</span>
      </div>

      {/* 12. Demo Accounts Modal / Panel */}
      {showDemoModal && isDemoEnabled && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm rounded-panel bg-[#0c1424] border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-chip bg-brand/20 text-brand">
                  <IconKey size={16} />
                </div>
                <div>
                  <h3 className="text-card-title font-bold text-white">
                    {t("Demo Accounts", "الحسابات التجريبية")}
                  </h3>
                  <p className="text-micro text-slate-400">
                    {t("Click any account for instant sign-in", "اضغط على أي حساب للدخول الفوري المباشر")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="p-1 rounded-chip text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <IconClose size={16} />
              </button>
            </div>

            <div className="space-y-2">
              {OFFICIAL_DEMO_ACCOUNTS.map((acc) => {
                const isSelected = username === acc.email;
                return (
                  <button
                    key={acc.key}
                    type="button"
                    onClick={() => handleSelectDemo(acc)}
                    className={cn(
                      "w-full rounded-inner border p-3 text-start transition-all relative",
                      isSelected
                        ? "bg-brand/15 border-brand ring-1 ring-brand/30 shadow-md"
                        : "bg-[#111c30] border-slate-800 hover:border-brand hover:bg-[#15233c]"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {acc.role === "CLIENT" && <IconProfile size={15} className="text-accent-2" />}
                        {acc.role === "DRIVER" && <IconTruck size={15} className="text-brand" />}
                        {acc.role === "ADMIN" && <IconDashboard size={15} className="text-emerald-400" />}
                        <span className="text-body font-bold text-white">
                          {acc.titleAr}
                        </span>
                      </div>
                      <span className="rounded px-2 py-0.5 text-micro font-bold tracking-wider uppercase bg-brand/20 text-brand">
                        دخول فوري ←
                      </span>
                    </div>

                    <div className="mt-1 text-label text-brand/90 font-mono" dir="ltr">
                      {acc.email}
                    </div>

                    <p className="mt-1 text-label text-slate-400 leading-snug">
                      {acc.descAr}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="text-micro text-slate-400 bg-slate-900/60 rounded-chip p-2.5 leading-relaxed text-start border border-slate-800">
              {t(
                "Selecting an account signs you in immediately without requiring a password.",
                "الضغط على أي حساب تجريبي يقوم بتسجيل دخولك فوراً وفتح الواجهة المخصصة بدون الحاجة لإدخال كلمة مرور."
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. Forgot Password Corporate Assistance Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm rounded-panel bg-[#0c1424] border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-chip bg-brand/20 text-brand">
                  <IconLock size={16} />
                </div>
                <div>
                  <h3 className="text-card-title font-bold text-white">
                    {t("Reset Password", "استعادة كلمة المرور")}
                  </h3>
                  <p className="text-micro text-slate-400">
                    {t("EJAZ Enterprise Security", "منظومة إيجاز لأمن المعلومات")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1 rounded-chip text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <IconClose size={16} />
              </button>
            </div>

            <div className="space-y-3 text-label-lg text-slate-300 leading-relaxed text-start">
              <p>
                {t(
                  "To protect enterprise freight and fleet operations data, password resets require verification by the system administrator or your fleet manager.",
                  "لحماية بيانات عمليات النقل والأسطول، تتطلب إعادة تعيين كلمة المرور التحقق من قبل مسؤول النظام أو إدارة الحركة والعمليات."
                )}
              </p>
              <div className="rounded-inner bg-[#111c30] p-3 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-white text-label-lg">
                  {t("Technical Support Desk:", "الدعم الفني لإيجاز للنقليات:")}
                </div>
                <div className="text-brand font-mono text-label-lg" dir="ltr">
                  support@ejaz.sa
                </div>
                <div className="text-slate-400 text-label" dir="ltr">
                  +966 11 222 3344 (Ext. 102)
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="w-full h-10 rounded-inner bg-slate-800 hover:bg-slate-700 text-white font-bold text-label-lg transition-colors"
            >
              {t("Close", "إغلاق")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
