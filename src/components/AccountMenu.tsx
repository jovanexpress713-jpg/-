import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings, type Lang } from "../settings";
import { LANGUAGE_OPTIONS } from "../localization/i18n";
import {
  IconArrowRight,
  IconBolt,
  IconCheck,
  IconGlobe,
  IconDoc,
  IconLock,
  IconProfile,
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
              <span className="text-[15px] leading-none">{option.flag}</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {tk(option.labelKey)}
                </span>
                {!compact && (
                  <span className="block truncate text-[10.5px] text-text-muted">
                    {tk(option.hintKey)}
                  </span>
                )}
              </span>
            </span>
            {active && (
              <span className="flex shrink-0 items-center gap-1 text-[10.5px] font-bold text-brand">
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
}

export function AccountMenu({
  user,
  onOpenSettings,
  onOpenAssistant,
  onOpenMobileApp,
  onPreviewLogin,
  onLogout,
  className,
}: AccountMenuProps) {
  const { tk, lang } = useSettings();
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

  /**
   * Avatar initials. An Arabic name cannot be abbreviated into a Latin session
   * («فه» would be the only Arabic fragment on an English screen), so outside
   * the Arabic session the initials come from the Latin part of the name or,
   * failing that, from the e-mail handle.
   */
  const initials = (() => {
    const name = (user?.fullName || "").trim();
    const latin = name.match(/[A-Za-z]+/g)?.join("") ?? "";
    if (latin.length >= 2) return latin.slice(0, 2).toUpperCase();
    if (latin.length === 1) return (latin + (user?.email?.[0] ?? "")).toUpperCase();
    if (lang === "ar") return (name || user?.email || "EJ").slice(0, 2);
    const handle = (user?.email ?? "").split("@")[0];
    return (handle.slice(0, 2) || "EJ").toUpperCase();
  })();

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={tk("header.account")}
        className={cn(
          "flex h-9 items-center gap-2 rounded-full border border-border-subtle bg-surface-2 ps-1.5 pe-2 transition-colors hover:border-brand/60",
          open && "border-brand/70",
        )}
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[10px] font-bold text-brand">
          {initials}
        </span>
        <span className="hidden max-w-[110px] truncate text-[11.5px] font-bold text-text-primary sm:block">
          {user?.fullName || user?.email || tk("app.shortName")}
        </span>
        <IconChevronInline />
      </button>

      {open && (
        <div
          role="menu"
          className="menu-pop absolute end-0 z-[70] mt-2 w-[286px] max-w-[92vw] overflow-hidden p-2"
        >
          {panel === "root" && (
            <>
              {/* Identity block */}
              <div className="mb-1.5 rounded-[10px] bg-surface-2 p-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/15 text-[12px] font-bold text-brand">
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-text-primary">
                      {user?.fullName || tk("app.shortName")}
                    </div>
                    <div className="truncate text-[10.5px] text-text-muted" dir="ltr">
                      {user?.email || "—"}
                    </div>
                  </div>
                  <span className="pill pill-success shrink-0">{tk("account.sessionActive")}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px] text-text-muted">
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

              {/* تطبيقات الجوال (§12) */}
              <button type="button" className="menu-row" onClick={() => setPanel("apps")}>
                <IconTruck size={16} className="shrink-0" />
                <span className="flex-1 text-start">{tk("settings.tabApps")}</span>
                <span className="text-[10px] text-text-muted">2</span>
                <IconArrowRight size={13} className="shrink-0 text-text-muted rtl:rotate-180" />
              </button>

              <div className="my-1.5 border-t border-border-subtle" />

              {/* معاينة شاشة تسجيل الدخول (§11) — preview only */}
              <button type="button" className="menu-row" onClick={() => { setOpen(false); onPreviewLogin(); }}>
                <IconLock size={16} className="shrink-0" />
                <span className="flex-1 text-start">{tk("account.previewLogin")}</span>
              </button>

              {/* مساعد إيجاز الذكي */}
              <button type="button" className="menu-row" onClick={() => { setOpen(false); onOpenAssistant(); }}>
                <IconBolt size={16} className="shrink-0 text-brand" />
                <span className="flex-1 text-start">{tk("nav.ai")}</span>
              </button>

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

          {panel === "apps" && (
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
              <p className="mb-2 px-1 text-[10.5px] leading-relaxed text-text-muted">
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
                  <span className="block text-[10px] text-text-muted">{tk("settings.appsHint")}</span>
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
                  <span className="block text-[10px] text-text-muted">{tk("settings.appsHint")}</span>
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
