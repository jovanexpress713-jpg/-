import { useEffect, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { LANGUAGE_OPTIONS } from "../localization/i18n";
import { LanguageList } from "./AccountMenu";
import { BrandLogo } from "./Logo";
import { apiClient, setAuthToken, getAuthToken } from "../services/apiClient";
import { IconLock, IconProfile, IconEye, IconEyeOff, IconAlertCircle, IconTruck } from "./Icons";
import { PageExportMenu } from "./PageExportMenu";
import { capturePageJpeg, downloadJpeg, printPage } from "../services/pageExport";
import { signInWithGoogle } from "../services/cloudStore";

/**
 * EJAZ Transport — Control Room Authentication Gate
 * Authenticates only through the backend. Optional one-click demo credentials
 * are listed only when the server explicitly enables demo accounts.
 */

interface DemoAccount {
  key: string;
  role: string;
  titleAr: string;
  titleEn: string;
  email: string;
  password: string;
  descAr: string;
  descEn?: string;
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
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const handleExportLogin = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const root =
        document.querySelector<HTMLElement>("[data-export-root='true']") ||
        document.getElementById("root");
      const dataUrl = await capturePageJpeg(root);
      downloadJpeg(dataUrl, "ejaz-auth-login");
      return { dataUrl, filename: "ejaz-auth-login" };
    } catch {
      printPage(t("EJAZ Transport - Sign In", "مؤسسة إيجاز للنقليات - تسجيل الدخول"));
    } finally {
      setExportBusy(false);
    }
  };

  const handlePrintLogin = () => {
    printPage(t("EJAZ Transport - Sign In", "مؤسسة إيجاز للنقليات - تسجيل الدخول"));
  };

  useEffect(() => {
    if (previewMode) return;
    let active = true;
    apiClient.auth.getDemoAccounts()
      .then((response) => {
        if (active) setDemoAccounts(response.enabled ? response.accounts : []);
      })
      .catch(() => {
        if (active) setDemoAccounts([]);
      });
    return () => {
      active = false;
    };
  }, [previewMode]);

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

  const completeLogin = (user: any, token: string) => {
    if (previewMode) return;
    if (!token || !user?.role) throw new Error("The authentication server returned an invalid session.");
    setAuthToken(token);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Demo sign-in is unavailable.", "الدخول التجريبي غير متاح."));
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleGoogleSignIn = async () => {
    if (previewMode) {
      setError(t("Preview mode — sign-in is disabled.", "وضع المعاينة — تسجيل الدخول معطّل."));
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const { firebaseUser, profile } = await signInWithGoogle();
      const userSession = {
        id: profile.uid,
        email: profile.email,
        fullName: profile.displayName || firebaseUser.displayName || "مستخدم Google",
        role: profile.role || "OPERATIONS_MANAGER",
        photoURL: profile.photoURL || firebaseUser.photoURL,
        provider: "firebase_google",
      };
      completeLogin(userSession, `firebase_token_${firebaseUser.uid}`);
    } catch (err: any) {
      console.error("Firebase Auth Google Sign-in error:", err);
      setError(
        err?.message ||
          t("Google sign-in failed. Please try again.", "فشل تسجيل الدخول عبر Google. يرجى المحاولة مرة أخرى.")
      );
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
      setError(
        t(
          "Enter your authorized work email and password.",
          "أدخل بريد العمل وكلمة المرور المعتمدين لحسابك.",
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
      setError(
        err?.message && !String(err.message).startsWith("HTTP")
          ? err.message
          : t(
              "Authentication failed. Check your credentials and server connectivity.",
              "فشل تسجيل الدخول. تحقق من بياناتك واتصال الخادم.",
            ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-y-auto bg-surface-0 px-4 py-8"
      data-export-root="true"
      data-export-page="login"
      data-export-screen="auth-login"
    >
      {/* Brand backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -start-24 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute -bottom-32 -end-16 h-96 w-96 rounded-full bg-brand/5 blur-3xl" />
      </div>

      {/* Screen export / capture button — available immediately upon opening the app */}
      <div className="absolute start-4 top-4 z-30" data-export-exclude="true">
        <PageExportMenu
          surface="page"
          busy={exportBusy}
          onExportCurrent={handleExportLogin}
          onPrint={handlePrintLogin}
          onExportAll={handleExportLogin}
        />
      </div>

      {/* Language — reachable before signing in, in all three languages (hidden per user selection) */}
      <div className="hidden absolute end-4 top-4 z-20">
        <button
          type="button"
          onClick={() => setShowLangMenu((v) => !v)}
          className="hidden flex h-9 items-center gap-2 rounded-full border border-border-subtle bg-surface-1/90 px-3 text-label-lg font-semibold text-text-secondary backdrop-blur transition-colors hover:border-brand/60 hover:text-text-primary"
          aria-haspopup="listbox"
          aria-expanded={showLangMenu}
          title={tk("language.choose")}
        >
          <span className="text-card-title leading-none">{activeLanguage?.flag}</span>
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
        <div className="hidden flex-col justify-between rounded-card border border-border-subtle bg-surface-1 p-8 lg:flex">
          <div>
            <BrandLogo size={46} sub={tk("app.subtitle")} />
            <p className="tagline mt-2.5">{tk("app.tagline")}</p>
          </div>

          <div className="space-y-4">
            <h2 className="text-hero-sm leading-8 font-extrabold text-text-primary">
              {t("Unified Operations Control Room", "غرفة التحكم التشغيلي الموحدة")}
            </h2>
            <p className="text-body leading-relaxed text-text-secondary">
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
                <div key={stat.label} className="rounded-inner border border-border-subtle bg-surface-2 p-3 text-center">
                  <div className="text-headline leading-7 font-extrabold text-brand tabular-nums">{stat.value}</div>
                  <div className="mt-0.5 text-label font-semibold text-text-muted">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-label text-text-muted">
            {t(
              "Authorized personnel only. Every sign-in is recorded in the audit log.",
              "الدخول للمصرح لهم فقط. كل عملية دخول تُسجَّل في سجل التدقيق.",
            )}
          </p>
        </div>

        {/* Credentials panel */}
        <div className="scroll-thin max-h-[94vh] overflow-y-auto rounded-card border border-border-subtle bg-surface-1 p-4 sm:p-6 lg:p-8">
          <div className="mb-6 lg:hidden">
            <BrandLogo size={38} sub={tk("app.subtitle")} />
            <p className="tagline mt-2">{tk("app.tagline")}</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-section-title leading-7 font-extrabold text-text-primary">
                {previewMode
                  ? t("Sign-in screen preview", "معاينة شاشة تسجيل الدخول")
                  : t("Control Room Sign-in", "تسجيل الدخول لغرفة التحكم")}
              </h1>
              <p className="mt-1 text-label-lg text-text-secondary">
                {previewMode
                  ? t("Preview only — sign-in and app entry are disabled.", "معاينة فقط — تسجيل الدخول ودخول التطبيقات معطّلة.")
                  : demoAccounts.length > 0
                    ? t("Server-enabled demo accounts are available below.", "الحسابات التجريبية المفعّلة من الخادم متاحة أدناه.")
                    : t("Sign in with your authorized work credentials.", "سجّل الدخول ببيانات العمل المعتمدة لحسابك.")}
              </p>
            </div>
          </div>

          {!previewMode && demoAccounts.length > 0 && (
          <div className="mt-5 border-t border-border-subtle pt-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-label font-bold uppercase tracking-wider text-brand">
                {t(
                  "Choose a server-enabled demo account",
                  "اختر حسابًا تجريبيًا مفعّلًا من الخادم",
                )}
              </span>
              <span className="text-label font-semibold text-status-active">
                {t("Backend sign-in", "دخول عبر الخادم")}
              </span>
            </div>
            <div className="scroll-thin grid max-h-[34vh] grid-cols-1 gap-1.5 overflow-y-auto overscroll-contain sm:grid-cols-2">
              {demoAccounts.map((acc) => {
                const isClient = acc.key === "client";
                return (
                  <button
                    key={acc.key}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleQuickDemoLogin(acc)}
                    className={cn(
                      "min-w-0 rounded-inner border p-2.5 text-start transition-all hover:border-brand hover:bg-surface-2 active:scale-[0.99]",
                      email === acc.email ? "border-brand/60 bg-surface-2" : "border-border-subtle",
                      isClient && "border-accent-2/40 bg-accent-2/5 hover:border-accent-2"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-body font-bold text-text-primary">
                        {t(acc.titleEn, acc.titleAr)}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-micro font-bold",
                          isClient
                            ? "bg-accent-2/20 text-accent-2"
                            : "bg-brand/15 text-brand"
                        )}
                      >
                        {isClient ? t("No password required →", "بدون كلمة سر ←") : t("Enter Now →", "دخول فوري ←")}
                      </span>
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-micro leading-relaxed text-text-muted">
                      {acc.descEn ? t(acc.descEn, acc.descAr) : acc.descAr}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* Mobile apps — two separate, explicit launchers (§12). Never in the preview (§11). */}
          {!previewMode && onOpenMobileApp && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onOpenMobileApp("client")}
                className="flex h-10 items-center justify-center gap-2 rounded-inner border border-accent-2/40 bg-accent-2/10 text-label-lg font-bold text-accent-2 transition-colors hover:bg-accent-2 hover:text-white"
                title={t("Open client sign-in", "فتح تسجيل دخول العميل")}
              >
                <IconProfile size={15} />
                {t("Open the client app", "فتح تطبيق العميل")}
              </button>
              <button
                type="button"
                onClick={() => onOpenMobileApp("driver")}
                className="flex h-10 items-center justify-center gap-2 rounded-inner border border-brand/40 bg-brand/10 text-label-lg font-bold text-brand transition-colors hover:bg-brand hover:text-on-brand"
              >
                <IconTruck size={15} />
                {t("Open the driver app", "فتح تطبيق السائق")}
              </button>
            </div>
          )}

          {/* Google Sign-in with Firebase Auth */}
          {!previewMode && (
            <div className="mt-5 border-t border-border-subtle pt-4">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleGoogleSignIn}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-inner border border-white/15 bg-white/5 hover:bg-white/10 text-body font-bold text-text-primary transition-all active:scale-[0.99] shadow-sm hover:border-white/30"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>{t("Sign in with Google (Firebase)", "تسجيل الدخول عبر Google (Firebase)")}</span>
              </button>

              <div className="relative my-4 flex items-center justify-center">
                <div className="w-full border-t border-border-subtle" />
                <span className="absolute bg-surface-1 px-3 text-micro font-bold uppercase tracking-wider text-text-muted">
                  {t("Or enter credentials", "أو بالبريد وكلمة المرور")}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="text-label font-semibold text-text-muted">
              {t("Sign in manually with credentials:", "تسجيل الدخول بالبريد وكلمة المرور:")}
            </div>
            <label className="block">
              <span className="mb-1 block text-label font-semibold text-text-secondary">
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
                  className="w-full rounded-inner border border-border-subtle bg-surface-2 py-2 pe-3 ps-9 text-body text-text-primary outline-none transition-colors focus:border-brand/60"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-label font-semibold text-text-secondary">
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
                  className="w-full rounded-inner border border-border-subtle bg-surface-2 py-2 pe-10 ps-9 text-body text-text-primary outline-none transition-colors focus:border-brand/60"
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
              <div className="flex items-start gap-2 rounded-inner border border-status-danger/30 bg-status-danger/10 p-3 text-label-lg text-status-danger">
                <IconAlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "flex h-10 w-full items-center justify-center gap-2 rounded-inner bg-brand text-body font-bold text-on-brand transition-all hover:brightness-110 active:scale-[0.99]",
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
