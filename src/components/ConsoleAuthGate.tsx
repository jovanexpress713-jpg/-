import { useEffect, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { BrandLogo } from "./Logo";
import { apiClient, setAuthToken, getAuthToken } from "../services/apiClient";
import { IconLock, IconProfile, IconEye, IconEyeOff, IconAlertCircle, IconTruck } from "./Icons";

/**
 * EJAZ Transport — Control Room Authentication Gate
 * The unified admin control panel is a protected surface: every operational
 * endpoint it consumes is guarded by JWT + RBAC on the server.
 */

interface DemoAccount {
  key: string;
  role: string;
  titleAr: string;
  titleEn: string;
  email: string;
  password: string;
  descAr: string;
}

const FALLBACK_DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: "admin",
    role: "SUPER_ADMIN",
    titleAr: "مدير النظام",
    titleEn: "Super Admin",
    email: "admin@ejaz.sa",
    password: "Ejaz@2026Admin",
    descAr: "التحكم الكامل بمنظومة إيجاز: الأسطول، الرحلات، المالية، التدقيق",
  },
  {
    key: "ops",
    role: "OPERATIONS_MANAGER",
    titleAr: "مدير العمليات",
    titleEn: "Operations Manager",
    email: "ops@ejaz.sa",
    password: "Ejaz@2026Admin",
    descAr: "إدارة الرحلات والسائقين والشاحنات وطلبات النقل",
  },
  {
    key: "accountant",
    role: "ACCOUNTANT",
    titleAr: "المحاسب",
    titleEn: "Accountant",
    email: "finance@ejaz.sa",
    password: "Ejaz@2026Admin",
    descAr: "الفواتير والتسويات المالية ومراجعة المطالبات",
  },
  {
    key: "driver",
    role: "DRIVER",
    titleAr: "السائق",
    titleEn: "Driver",
    email: "driver@ejaz.sa",
    password: "Ejaz@2026Driver",
    descAr: "بوابة السائق الميدانية (تُفتح تلقائياً على تطبيق الجوال)",
  },
];

export function ConsoleAuthGate({
  onAuthenticated,
  onOpenMobileApp,
}: {
  onAuthenticated: (user: any) => void;
  onOpenMobileApp?: () => void;
}) {
  const { t } = useSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>(FALLBACK_DEMO_ACCOUNTS);

  useEffect(() => {
    // Restore an existing session silently so operators are not logged out on refresh
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

    apiClient.auth
      .getDemoAccounts()
      .then((res) => {
        if (res?.enabled && res.accounts?.length) {
          setDemoAccounts(res.accounts as DemoAccount[]);
        }
      })
      .catch(() => {
        /* keep fallback list */
      });
  }, [onAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(t("Please enter your email and password", "يرجى إدخال البريد الإلكتروني وكلمة المرور"));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.auth.login(email.trim(), password);
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err: any) {
      setError(
        err?.message && !String(err.message).startsWith("HTTP")
          ? err.message
          : t(
              "Invalid credentials. Please verify your email and password.",
              "بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.",
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

      <div className="relative z-10 grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Identity panel */}
        <div className="hidden flex-col justify-between rounded-[20px] border border-border-subtle bg-surface-1 p-8 lg:flex">
          <BrandLogo size={48} sub={t("Heavy Fleet & Logistics Control", "إدارة أسطول النقل الثقيل والرحلات")} />

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
            <BrandLogo size={40} sub={t("Control Room", "غرفة التحكم")} />
          </div>

          <h1 className="text-lg font-extrabold text-text-primary">
            {t("Control Room Sign-in", "تسجيل الدخول لغرفة التحكم")}
          </h1>
          <p className="mt-1 text-[12px] text-text-secondary">
            {t("Authenticate to access the operational console.", "سجّل الدخول للوصول إلى لوحة التحكم التشغيلية.")}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] font-semibold text-text-secondary">
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
                  className="w-full rounded-[12px] border border-border-subtle bg-surface-2 py-2.5 pe-3 ps-9 text-[13px] text-text-primary outline-none transition-colors focus:border-brand/60"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11.5px] font-semibold text-text-secondary">
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
                  className="w-full rounded-[12px] border border-border-subtle bg-surface-2 py-2.5 pe-10 ps-9 text-[13px] text-text-primary outline-none transition-colors focus:border-brand/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 end-2 flex items-center px-2 text-text-muted hover:text-text-primary"
                  aria-label="Toggle password visibility"
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
                "flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-brand text-[13px] font-bold text-on-brand transition-all hover:brightness-110 active:scale-[0.99]",
                isSubmitting && "cursor-wait opacity-70",
              )}
            >
              <IconTruck size={16} />
              {isSubmitting
                ? t("Authenticating…", "جارٍ التحقق…")
                : t("Sign in to Control Room", "الدخول إلى غرفة التحكم")}
            </button>
          </form>

          {onOpenMobileApp && (
            <button
              type="button"
              onClick={onOpenMobileApp}
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-[12px] border border-border-subtle bg-surface-2 text-[12.5px] font-bold text-text-primary transition-colors hover:border-brand/40 hover:text-brand"
            >
              <IconTruck size={15} />
              {t("Open the driver / client mobile app", "الدخول إلى تطبيق السائق والعميل")}
            </button>
          )}

          <div className="mt-6 border-t border-border-subtle pt-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                {t("Provisioned Access Profiles", "حسابات الوصول الجاهزة")}
              </span>
              <span className="text-[10.5px] text-text-muted">{t("tap to fill", "اضغط للتعبئة")}</span>
            </div>
            <div className="grid gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.key}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                    setError(null);
                  }}
                  className={cn(
                    "rounded-[12px] border p-3 text-start transition-all hover:border-brand/40 hover:bg-surface-2",
                    email === acc.email ? "border-brand/50 bg-surface-2" : "border-border-subtle",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-bold text-text-primary">
                      {t(acc.titleEn, acc.titleAr)}
                    </span>
                    <span className="rounded-full bg-brand/12 px-2 py-0.5 text-[9.5px] font-bold text-brand">
                      {acc.role}
                    </span>
                  </div>
                  <div className="mt-1 text-[10.5px] leading-relaxed text-text-muted">{acc.descAr}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
