import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings, type Lang } from "../settings";
import { LANGUAGE_OPTIONS } from "../localization/i18n";
import { usePermissions } from "../state/permissionStore";
import {
  IconArrowRight,
  IconBolt,
  IconCheck,
  IconGlobe,
  IconDoc,
  IconLock,
  IconProfile,
  IconSettings,
  IconTruck,
} from "./Icons";

/**
 * Account menu — the console's single secondary menu (§6).
 *
 * Root rows are exactly the organised list:
 *   حسابي · الإعدادات · تطبيقات الجوال · معاينة شاشة تسجيل الدخول ·
 *   مساعد إيجاز الذكي · المساعدة والدعم · تسجيل الخروج
 *
 * Language, appearance, notifications and account data are NOT duplicated
 * here — «الإعدادات» opens the settings center where they live once (§27).
 * «معاينة شاشة تسجيل الدخول» is a preview-only surface (§11), and the two
 * mobile apps get separate, explicit launchers (§12).
 */

export function LanguageList({
  onSelect,
  compact = false,
}: {
  onSelect?: (lang: Lang) => void;
  compact?: boolean;
}) {
  const { lang, setLang, tk } = useSettings();
  return (
    <div className="space-y-1">
      {LANGUAGE_OPTIONS.map((option) => {
        const active = lang === option.code;
        return (
          <button
            key={option.code}
            type="button"
            onClick={() => {
              setLang(option.code);
              onSelect?.(option.code);
            }}
            aria-current={active ? "true" : undefined}
            className={cn("menu-row justify-between", active && "menu-row-on")}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <IconGlobe size={15} className="shrink-0 text-text-muted" />
              <span className="text-page-title leading-none">{option.flag}</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {tk(option.labelKey)}
                </span>
                {!compact && (
                  <span className="block truncate text-label text-text-muted">
                    {tk(option.hintKey)}
                  </span>
                )}
              </span>
            </span>
            {active && (
              <span className="flex shrink-0 items-center gap-1 text-label font-bold text-brand">
                <IconCheck size={13} />
                {tk("language.current")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Operational role names mapped to standard localized executive titles. */
export function getLocalizedRoleLabel(role?: string, lang?: string): string {
  if (lang === "en") {
    switch (role) {
      case "SUPER_ADMIN":
        return "System Admin";
      case "GENERAL_MANAGER":
        return "General Manager";
      case "OPERATIONS_MANAGER":
        return "Operations Manager";
      case "DISPATCHER":
        return "Dispatcher";
      case "ACCOUNTANT":
        return "Accountant";
      case "DRIVER":
        return "Fleet Captain";
      case "CUSTOMER":
      case "CLIENT":
        return "Client";
      case "REPRESENTATIVE":
        return "Representative";
      case "WAREHOUSE":
        return "Warehouse";
      case "BROKER":
        return "Broker";
      case "CUSTOMS_BROKER":
        return "Customs Broker";
      default:
        return role || "Admin";
    }
  }

  if (lang === "ur") {
    switch (role) {
      case "SUPER_ADMIN":
        return "سسٹم ایڈمن";
      case "GENERAL_MANAGER":
        return "جنرل مینیجر";
      case "OPERATIONS_MANAGER":
        return "آپریشنز مینیجر";
      case "DISPATCHER":
        return "ڈسپیچر";
      case "ACCOUNTANT":
        return "اکاؤنٹنٹ";
      case "DRIVER":
        return "ڈرائیور";
      case "CUSTOMER":
      case "CLIENT":
        return "کلائنٹ";
      case "REPRESENTATIVE":
        return "نمائندہ";
      case "WAREHOUSE":
        return "گودام نگران";
      case "BROKER":
        return "بروکر";
      case "CUSTOMS_BROKER":
        return "کسٹمز کلیئرنس";
      default:
        return role || "ایڈمن";
    }
  }

  switch (role) {
    case "SUPER_ADMIN":
      return "مدير النظام";
    case "GENERAL_MANAGER":
      return "المدير العام";
    case "OPERATIONS_MANAGER":
      return "مدير العمليات";
    case "DISPATCHER":
      return "مرحّل العمليات";
    case "ACCOUNTANT":
      return "المحاسب المالي";
    case "DRIVER":
      return "كابتن أسطول";
    case "CUSTOMER":
    case "CLIENT":
      return "عميل معتمد";
    case "REPRESENTATIVE":
      return "ممثل إقليمي";
    case "WAREHOUSE":
      return "مشرف المستودع";
    case "BROKER":
      return "وسيط نقل";
    case "CUSTOMS_BROKER":
      return "مخلّص جمركي";
    default:
      return role || "مدير النظام";
  }
}

export function getArabicRoleLabel(role?: string): string {
  return getLocalizedRoleLabel(role, "ar");
}

interface AccountMenuProps {
  user: any;
  onOpenSettings: (tab?: "account" | "app" | "apps" | "loginPreview" | "system" | "help") => void;
  onOpenAssistant: () => void;
  /** Open one mobile app in its own interface (§12). */
  onOpenMobileApp: (kind: "driver" | "client") => void;
  /** Preview the sign-in screen — preview only (§11). */
  onPreviewLogin: () => void;
  onLogout: () => void;
  className?: string;
  variant?: "default" | "premium";
}

export function AccountMenu({
  user,
  onOpenSettings,
  onOpenAssistant,
  onOpenMobileApp,
  onPreviewLogin,
  onLogout,
  className,
  variant = "premium",
}: AccountMenuProps) {
  const { tk, lang } = useSettings();
  const { can, wildcard, role } = usePermissions();

  /**
   * Identity-switching and demo affordances.
   *
   * «تطبيقات الجوال» opens the client or driver interface and «معاينة شاشة تسجيل
   * الدخول» renders the sign-in surface — both are administrative/demo tools. For
   * an ordinary employee they are not disabled or greyed out, they simply are not
   * here: an item a role may not use must not exist in its menu at all.
   */
  const maySwitchAccounts = wildcard || role === "SUPER_ADMIN" || can("accounts.switch");
  const mayUseAssistant = can("assistant.act") || can("notifications.view");

  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"root" | "apps">("root");
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setPanel("root");
  }, [open]);

  /** Role names are operational identifiers — they stay untranslated on purpose. */
  const roleLabel = (role?: string) => {
    switch (role) {
      case "CUSTOMER":
      case "CLIENT":
        return "CLIENT";
      default:
        return role || "—";
    }
  };


  return (
    <div ref={ref} className={cn("relative", className)}>
      {variant === "premium" ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          title={user?.fullName || tk("header.account")}
          className={cn(
            "flex items-center gap-2 rounded-full border border-white/10 bg-[#08152c]/85 py-1 ps-1 pe-2.5 backdrop-blur-md transition-all hover:border-orange-500/60 hover:bg-[#0c1f40] focus-visible:ring-2 focus-visible:ring-orange-500/40 active:scale-95 group shadow-sm",
            open && "border-orange-500/80 bg-orange-500/10 shadow-[0_0_12px_rgba(249,115,22,0.25)]"
          )}
        >
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-orange-500/75 bg-[#09152b] text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.35)] transition-transform group-hover:scale-105"
            title={user?.fullName || tk("settings.tabSystem")}
          >
            <IconProfile size={17} className="text-orange-400" />
          </span>
          <div className="hidden min-w-0 flex-col items-start leading-tight sm:flex text-start">
            <span className="truncate text-body font-bold text-text-primary max-w-[120px] lg:max-w-[150px]">
              {user?.fullName || tk("app.shortName")}
            </span>
            <span className="truncate text-label font-semibold text-orange-400 max-w-[120px] lg:max-w-[150px]">
              {getLocalizedRoleLabel(user?.role, lang)}
            </span>
          </div>
          <svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            className={cn("shrink-0 text-orange-400/80 transition-transform duration-200", open && "rotate-180")}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          title={tk("header.account")}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-full border border-white/[0.08] bg-surface-2/70 px-2 backdrop-blur-md transition-all hover:border-brand/60 hover:bg-surface-2",
            open && "border-brand/70 bg-brand/10 shadow-sm shadow-brand/20",
          )}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/20 text-brand shadow-sm" title={user?.fullName || tk("settings.tabSystem")}>
            <IconSettings size={14} className="text-brand transition-transform hover:rotate-45" />
          </span>
          <span className="text-label-lg font-bold text-text-primary px-0.5">
            {tk("settings.tabSystem")}
          </span>
          <IconChevronInline />
        </button>
      )}

      {open && (
        <div
          role="menu"
          className="menu-pop absolute end-0 z-[70] mt-2 w-[286px] max-w-[92vw] overflow-hidden p-2"
        >
          {panel === "root" && (
            <>
              {/* Identity block */}
              <div className="mb-1.5 rounded-control bg-surface-2/80 border border-white/[0.06] p-2.5 backdrop-blur-sm">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-orange-500/40 bg-orange-500/15 text-orange-400 shadow-sm">
                    <IconProfile size={18} className="text-orange-400" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body font-bold text-text-primary">
                      {user?.fullName || tk("app.shortName")}
                    </div>
                    <div className="truncate text-label text-text-muted" dir="ltr">
                      {user?.email || "—"}
                    </div>
                  </div>
                  <span className="pill pill-success shrink-0">{tk("account.sessionActive")}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-label text-text-muted">
                  <span className="truncate">
                    {tk("account.role")}: <span className="font-bold text-text-secondary">{roleLabel(user?.role)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        navigator.clipboard?.writeText(user?.email || "");
                      } catch {
                        /* clipboard unavailable */
                      }
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1400);
                    }}
                    className="flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-text-muted transition-colors hover:text-brand"
                  >
                    {copied ? <IconCheck size={12} /> : <IconCopyInline />}
                    {copied ? tk("account.copied") : tk("account.copyEmail")}
                  </button>
                </div>
              </div>

              {/* حسابي (§7) */}
              <button type="button" className="menu-row" onClick={() => { setOpen(false); onOpenSettings("account"); }}>
                <IconProfile size={16} className="shrink-0" />
                <span className="flex-1 text-start">{tk("account.myAccount")}</span>
                <IconArrowRight size={13} className="shrink-0 text-text-muted rtl:rotate-180" />
              </button>

              {/* الإعدادات (§5) */}
              <button type="button" className="menu-row" onClick={() => { setOpen(false); onOpenSettings("app"); }}>
                <IconDoc size={16} className="shrink-0" />
                <span className="flex-1 text-start">{tk("account.settings")}</span>
                <IconArrowRight size={13} className="shrink-0 text-text-muted rtl:rotate-180" />
              </button>

              {/* تطبيقات الجوال (§12) — لمن يملك تبديل الهوية فقط */}
              {maySwitchAccounts && (
                <button type="button" className="menu-row" onClick={() => setPanel("apps")}>
                  <IconTruck size={16} className="shrink-0" />
                  <span className="flex-1 text-start">{tk("settings.tabApps")}</span>
                  <span className="text-micro text-text-muted">2</span>
                  <IconArrowRight size={13} className="shrink-0 text-text-muted rtl:rotate-180" />
                </button>
              )}

              <div className="my-1.5 border-t border-border-subtle" />

              {/* معاينة شاشة تسجيل الدخول (§11) — preview only */}
              {maySwitchAccounts && (
                <button type="button" className="menu-row" onClick={() => { setOpen(false); onPreviewLogin(); }}>
                  <IconLock size={16} className="shrink-0" />
                  <span className="flex-1 text-start">{tk("account.previewLogin")}</span>
                </button>
              )}

              {/* مساعد إيجاز الذكي */}
              {mayUseAssistant && (
                <button type="button" className="menu-row" onClick={() => { setOpen(false); onOpenAssistant(); }}>
                  <IconBolt size={16} className="shrink-0 text-brand" />
                  <span className="flex-1 text-start">{tk("nav.ai")}</span>
                </button>
              )}

              {/* المساعدة والدعم */}
              <button type="button" className="menu-row" onClick={() => { setOpen(false); onOpenSettings("help"); }}>
                <IconDoc size={16} className="shrink-0" />
                <span className="flex-1 text-start">{tk("account.help")}</span>
              </button>

              <div className="my-1.5 border-t border-border-subtle" />

              <button
                type="button"
                className="menu-row text-status-danger hover:bg-status-danger/10 hover:text-status-danger"
                onClick={() => { setOpen(false); onLogout(); }}
              >
                <IconArrowRight size={16} className="shrink-0 rtl:rotate-180" />
                <span className="flex-1 text-start font-semibold">{tk("account.logout")}</span>
              </button>
            </>
          )}

          {panel === "apps" && maySwitchAccounts && (
            <div>
              <div className="mb-1.5 flex items-center gap-2 border-b border-border-subtle pb-1.5">
                <button
                  type="button"
                  onClick={() => setPanel("root")}
                  className="btn-icon-sm shrink-0"
                  aria-label={tk("common.back")}
                  title={tk("common.back")}
                >
                  <IconArrowRight size={14} className="rtl:rotate-180" />
                </button>
                <span className="menu-label">{tk("settings.tabApps")}</span>
              </div>
              <p className="mb-2 px-1 text-label leading-relaxed text-text-muted">
                {tk("settings.appsHint")}
              </p>
              <button
                type="button"
                onClick={() => { setOpen(false); onOpenMobileApp("client"); }}
                className="menu-row"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-2/15 text-accent-2">
                  <IconProfile size={15} />
                </span>
                <span className="flex-1 text-start">
                  <span className="block font-semibold">{tk("settings.appsClient")}</span>
                  <span className="block text-micro text-text-muted">{tk("settings.appsHint")}</span>
                </span>
                <IconArrowRight size={13} className="shrink-0 text-text-muted rtl:rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); onOpenMobileApp("driver"); }}
                className="menu-row"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                  <IconTruck size={15} />
                </span>
                <span className="flex-1 text-start">
                  <span className="block font-semibold">{tk("settings.appsDriver")}</span>
                  <span className="block text-micro text-text-muted">{tk("settings.appsHint")}</span>
                </span>
                <IconArrowRight size={13} className="shrink-0 text-text-muted rtl:rotate-180" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Inline chevron — kept tiny so the menu row stays balanced. */
function IconChevronInline() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="shrink-0 text-text-muted rtl:rotate-180">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function IconCopyInline() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={9} y={9} width={11} height={11} rx={2} />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}
