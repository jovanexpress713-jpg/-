import { useEffect, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { LANGUAGE_OPTIONS } from "../localization/i18n";
import { LanguageList } from "./AccountMenu";
import { BrandLogo } from "./Logo";
import { apiClient, setAuthToken, getAuthToken } from "../services/apiClient";
import { IconLock, IconProfile, IconEye, IconEyeOff, IconAlertCircle, IconTruck } from "./Icons";

/**
 * EJAZ Transport — Control Room Authentication Gate
 * Supports both real backend JWT authentication and 1-click password-free
 * presentation/demo access so clients can preview all roles seamlessly.
 */

export interface DemoAccount {
  key: string;
  role: string;
  titleAr: string;
  titleEn: string;
  email: string;
  password: string;
  descAr: string;
  descEn?: string;
  fullName?: string;
  driverId?: string;
  customerId?: string;
}

export const FALLBACK_DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: "admin",
    role: "SUPER_ADMIN",
    titleAr: "مدير النظام (الإدارة الشاملة)",
    titleEn: "Super Admin",
    email: "admin@ejaz.sa",
    password: "Ejaz@2026Admin",
    fullName: "فهد بن عبد العزيز السبيعي",
    descAr: "التحكم الكامل بمنظومة إيجاز: الأسطول، الرحلات، المالية، التدقيق",
    descEn: "Full control of the EJAZ platform: fleet, trips, finance, audit",
  },
  {
    key: "ops",
    role: "OPERATIONS_MANAGER",
    titleAr: "مدير العمليات",
    titleEn: "Operations Manager",
    email: "ops@ejaz.sa",
    password: "Ejaz@2026Admin",
    fullName: "سلطان بن حمد العتيبي",
    descAr: "إدارة الرحلات والسائقين والشاحنات وطلبات النقل",
    descEn: "Trips, drivers, vehicles and transport requests",
  },
  {
    key: "accountant",
    role: "ACCOUNTANT",
    titleAr: "المحاسب المالي",
    titleEn: "Accountant",
    email: "finance@ejaz.sa",
    password: "Ejaz@2026Admin",
    fullName: "عمر بن إبراهيم القحطاني",
    descAr: "الفواتير والتسويات المالية ومراجعة المطالبات",
    descEn: "Invoices, settlements and claims review",
  },
  {
    key: "driver",
    role: "DRIVER",
    titleAr: "حساب السائق الميداني",
    titleEn: "Driver",
    email: "driver@ejaz.sa",
    password: "Ejaz@2026Driver",
    fullName: "فهد الشمري (كابتن أسطول)",
    driverId: "d1",
    descAr: "بوابة السائق الميدانية وتنفيذ الرحلات وإثبات التسليم",
    descEn: "Field driver portal, trip execution and POD",
  },
  {
    key: "client",
    role: "CUSTOMER",
    titleAr: "حساب العميل (سدافكو)",
    titleEn: "Client Portal",
    email: "client@ejaz.sa",
    password: "Ejaz@2026Client",
    fullName: "شركة سدافكو للأغذية والمشروبات",
    customerId: "cust-1",
    descAr: "بوابة العميل لمتابعة الشحنات والتتبع المباشر وبوليصة الشحن",
    descEn: "Client portal: shipments, live tracking and waybill",
  },
];

function buildOfflineUser(acc: DemoAccount) {
  const normalizedRole =
    acc.role === "ADMIN"
      ? "SUPER_ADMIN"
      : acc.role === "CLIENT"
        ? "CUSTOMER"
        : acc.role;
  return {
    id: `u-${acc.key}`,
    email: acc.email,
    fullName: acc.fullName || acc.titleAr,
    phone: "+966501112233",
    role: normalizedRole,
    driverId: acc.driverId || (normalizedRole === "DRIVER" ? "d1" : undefined),
    customerId: acc.customerId || (normalizedRole === "CUSTOMER" ? "cust-1" : undefined),
    permissions: ["*"],
    accountApproved: true,
  };
}

export function ConsoleAuthGate({
  onAuthenticated,
  onOpenMobileApp,
  previewMode = false,
}: {
  onAuthenticated: (user: any) => void;
  /** Split launchers (§12): each button opens its own app interface. */
  onOpenMobileApp?: (kind: "driver" | "client") => void;
  /**
   * «معاينة شاشة تسجيل الدخول» (§11): renders the sign-in surface exactly as
   * an unauthenticated visitor sees it — WITHOUT any entry shortcuts (no direct
   * control-room entry, no demo account buttons, no app launchers) and without
   * actually signing anyone in.
   */
  previewMode?: boolean;
}) {
  const { t, tk, lang } = useSettings();
  const activeLanguage = LANGUAGE_OPTIONS.find((option) => option.code === lang);
  /*
   * Deliberately empty. Pre-filling the administrator's credentials turned the
   * sign-in form into a one-key admin login, so nobody ever actually chose an
   * account — the demo list below is the place to pick one, and a real user types
   * their own.
   */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoAccounts] = useState<DemoAccount[]>(FALLBACK_DEMO_ACCOUNTS);
  const [showLangMenu, setShowLangMenu] = useState(false);

  useEffect(() => {
    if (previewMode) return;
    const restore = async () => {
      if (!getAuthToken()) return;
      try {
        const me = await apiClient.auth.me();
        if (me?.role) onAuthenticated(me);
      } catch {
        setAuthToken(null);
      }
    };
    restore();
  }, [onAuthenticated, previewMode]);

  const completeLogin = (user: any, token?: string) => {
    if (previewMode) return;
    if (token) {
      setAuthToken(token);
    }
    try {
      localStorage.setItem("ejaz_current_user", JSON.stringify(user));
    } catch {
      /* ignore */
    }
    onAuthenticated(user);
  };

  const handleQuickDemoLogin = async (acc: DemoAccount) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.auth.login(acc.email, acc.password);
      completeLogin(res.user, res.token);
    } catch {
      // Fallback for static deployments or when backend is unreachable
      completeLogin(buildOfflineUser(acc));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewMode) {
      setError(t("Preview mode — sign-in is disabled.", "وضع المعاينة — تسجيل الدخول معطّل."));
      return;
    }
    if (!email.trim() || !password) {
      /*
       * Never sign anybody in on their behalf. An empty form used to log the
       * visitor straight in as the system administrator; now it just asks for the
       * credentials, and the demo accounts below remain an explicit choice.
       */
      setError(
        t(
          "Enter your email and password, or pick one of the demo accounts below.",
          "أدخل بريدك الإلكتروني وكلمة المرور، أو اختر أحد الحسابات التجريبية في الأسفل.",
        ),
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.auth.login(email.trim(), password);
      completeLogin(res.user, res.token);
    } catch (err: any) {
      const matchedDemo = FALLBACK_DEMO_ACCOUNTS.find(
        (a) => a.email.toLowerCase() === email.trim().toLowerCase()
      );
      if (matchedDemo) {
        completeLogin(buildOfflineUser(matchedDemo));
        return;
      }
      setError(
        err?.message && !String(err.message).startsWith("HTTP")
          ? err.message
          : t(
              "Invalid credentials. Tap any demo account below for instant access.",
              "بيانات الدخول غير مطابقة. يمكنك الضغط على أي حساب تجريبي بالأسفل للدخول الفوري بدون كلمة مرور.",
            ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-y-auto bg-surface-0 px-4 py-8">
      {/* Brand backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -start-24 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute -bottom-32 -end-16 h-96 w-96 rounded-full bg-brand/5 blur-3xl" />
      </div>

      {/* Language — reachable before signing in, in all three languages. */}
      <div className="absolute end-4 top-4 z-20">
        <button
          type="button"
          onClick={() => setShowLangMenu((v) => !v)}
          className="flex h-9 items-center gap-2 rounded-full border border-border-subtle bg-surface-1/90 px-3 text-[11.5px] font-semibold text-text-secondary backdrop-blur transition-colors hover:border-brand/60 hover:text-text-primary"
          aria-haspopup="listbox"
          aria-expanded={showLangMenu}
          title={tk("language.choose")}
        >
          <span className="text-[14px] leading-none">{activeLanguage?.flag}</span>
          <span>{tk(activeLanguage?.labelKey ?? "language.ar")}</span>
        </button>
        {showLangMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowLangMenu(false)} />
            <div className="menu-pop absolute end-0 z-20 mt-2 w-[236px] p-2">
              <LanguageList onSelect={() => setShowLangMenu(false)} />
            </div>
          </>
        )}
      </div>

      <div className="relative z-10 grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Identity panel */}
        <div className="hidden flex-col justify-between rounded-[20px] border border-border-subtle bg-surface-1 p-8 lg:flex">
          <div>
            <BrandLogo size={46} sub={tk("app.subtitle")} />
            <p className="tagline mt-2.5">{tk("app.tagline")}</p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-extrabold text-text-primary">
              {t("Unified Operations Control Room", "غرفة التحكم التشغيلي الموحدة")}
            </h2>
            <p className="text-[13px] leading-relaxed text-text-secondary">
              {t(
                "One authoritative backend. Live AVL telematics, the 18-state trip lifecycle, digital POD, financial settlement and a tamper-evident audit trail — all behind strict role-based access control.",
                "خادم مركزي واحد موثوق. تتبع لحظي للأجهزة، دورة حياة الرحلة بـ 18 حالة معيارية، إثبات تسليم رقمي، تسويات مالية، وسجل تدقيق غير قابل للتعديل — خلف حماية صارمة للصلاحيات حسب الدور.",
              )}
            </p>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { label: t("Canonical States", "حالات معيارية"), value: "18" },
                { label: t("Official Fleet Types", "أنواع رسمية"), value: "4" },
                { label: t("Governed Roles", "أدوار محكومة"), value: "11" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[14px] border border-border-subtle bg-surface-2 p-3 text-center">
                  <div className="text-xl font-extrabold text-brand tabular-nums">{stat.value}</div>
                  <div className="mt-0.5 text-[10.5px] font-semibold text-text-muted">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-text-muted">
            {t(
              "Authorized personnel only. Every sign-in is recorded in the audit log.",
              "الدخول للمصرح لهم فقط. كل عملية دخول تُسجَّل في سجل التدقيق.",
            )}
          </p>
        </div>

        {/* Credentials panel */}
        <div className="rounded-[20px] border border-border-subtle bg-surface-1 p-6 sm:p-8">
          <div className="mb-6 lg:hidden">
            <BrandLogo size={38} sub={tk("app.subtitle")} />
            <p className="tagline mt-2">{tk("app.tagline")}</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-extrabold text-text-primary">
                {previewMode
                  ? t("Sign-in screen preview", "معاينة شاشة تسجيل الدخول")
                  : t("Control Room Sign-in", "تسجيل الدخول لغرفة التحكم")}
              </h1>
              <p className="mt-1 text-[12px] text-text-secondary">
                {previewMode
                  ? t("Preview only — sign-in and app entry are disabled.", "معاينة فقط — تسجيل الدخول ودخول التطبيقات معطّلة.")
                  : t("Instant preview enabled — click below to enter without password.", "وضع الاستعراض المباشر مفعّل — يمكنك الدخول فورا بدون كلمة مرور.")}
              </p>
            </div>
          </div>

          {!previewMode && (
          <div className="mt-5 border-t border-border-subtle pt-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand">
                {t(
                  "Choose an account to enter (no password)",
                  "اختر الحساب للدخول (بدون كلمة مرور)",
                )}
              </span>
              <span className="text-[10.5px] font-semibold text-status-active">
                {t("Instant Entry", "دخول مباشر بضغطة واحدة")}
              </span>
            </div>
            <div className="grid gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.key}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleQuickDemoLogin(acc)}
                  className={cn(
                    "rounded-[12px] border p-3 text-start transition-all hover:border-brand hover:bg-surface-2 active:scale-[0.99]",
                    email === acc.email ? "border-brand/60 bg-surface-2" : "border-border-subtle",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-bold text-text-primary">
                      {t(acc.titleEn, acc.titleAr)}
                    </span>
                    <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-[10px] font-bold text-brand">
                      {t("Enter Now →", "دخول فوري ←")}
                    </span>
                  </div>
                  <div className="mt-1 text-[10.5px] leading-relaxed text-text-muted">
                    {acc.descEn ? t(acc.descEn, acc.descAr) : acc.descAr}
                  </div>
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Mobile apps — two separate, explicit launchers (§12). Never in the preview (§11). */}
          {!previewMode && onOpenMobileApp && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onOpenMobileApp("client")}
                className="flex h-10 items-center justify-center gap-2 rounded-[12px] border border-accent-2/40 bg-accent-2/10 text-[11.5px] font-bold text-accent-2 transition-colors hover:bg-accent-2 hover:text-white"
              >
                <IconProfile size={15} />
                {t("Open the client app", "فتح تطبيق العميل")}
              </button>
              <button
                type="button"
                onClick={() => onOpenMobileApp("driver")}
                className="flex h-10 items-center justify-center gap-2 rounded-[12px] border border-brand/40 bg-brand/10 text-[11.5px] font-bold text-brand transition-colors hover:bg-brand hover:text-on-brand"
              >
                <IconTruck size={15} />
                {t("Open the driver app", "فتح تطبيق السائق")}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 border-t border-border-subtle pt-4 space-y-3">
            <div className="text-[11px] font-semibold text-text-muted">
              {t("Or sign in manually with credentials:", "أو تسجيل الدخول اليدوي بالبريد وكلمة المرور:")}
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-text-secondary">
                {t("Work Email", "البريد الإلكتروني")}
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-text-muted">
                  <IconProfile size={15} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="admin@ejaz.sa"
                  className="w-full rounded-[12px] border border-border-subtle bg-surface-2 py-2 pe-3 ps-9 text-[12.5px] text-text-primary outline-none transition-colors focus:border-brand/60"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-text-secondary">
                {t("Password", "كلمة المرور")}
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-text-muted">
                  <IconLock size={15} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-[12px] border border-border-subtle bg-surface-2 py-2 pe-10 ps-9 text-[12.5px] text-text-primary outline-none transition-colors focus:border-brand/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 end-2 flex items-center px-2 text-text-muted hover:text-text-primary"
                  aria-label={t("Toggle password visibility", "إظهار كلمة المرور أو إخفاؤها")}
                >
                  {showPassword ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                </button>
              </div>
            </label>

            {error && (
              <div className="flex items-start gap-2 rounded-[12px] border border-status-danger/30 bg-status-danger/10 p-3 text-[12px] text-status-danger">
                <IconAlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "flex h-10 w-full items-center justify-center gap-2 rounded-[12px] bg-brand text-[12.5px] font-bold text-on-brand transition-all hover:brightness-110 active:scale-[0.99]",
                isSubmitting && "cursor-wait opacity-70",
              )}
            >
              <IconTruck size={15} />
              {isSubmitting
                ? t("Authenticating…", "جارٍ التحقق…")
                : t("Sign in to Control Room", "الدخول إلى غرفة التحكم")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
