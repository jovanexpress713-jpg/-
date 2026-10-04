import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings, type Lang } from "../settings";
import { LANGUAGE_OPTIONS } from "../localization/i18n";
import { canSwitchAccounts, type SessionUser } from "../utils/permissions";
import { FALLBACK_DEMO_ACCOUNTS, type DemoAccount } from "./ConsoleAuthGate";
import {
  IconArrowRight,
  IconBolt,
  IconCheck,
  IconChevron,
  IconCopy,
  IconDashboard,
  IconDoc,
  IconGlobe,
  IconProfile,
  IconTruck,
} from "./Icons";

/**
 * Account menu — the single place for everything secondary (§3, §10, §26).
 *
 * Language, appearance (light/dark), settings, help, role switching and sign-out
 * used to be six separate header buttons competing for one row. They now live
 * here, grouped and permission-gated, so the header carries only the four
 * operational affordances: search, assistant, notifications, account.
 *
 * The language rows always show 🌐 + flag + native name + ✓ on the active one —
 * never a flag alone, and never an ambiguous "EN/عربي" abbreviation.
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
  user: SessionUser | null;
  /** Active workspace: the control room console or the driver/client mobile app. */
  view?: "web" | "mobile";
  onViewChange?: (view: "web" | "mobile") => void;
  onOpenSettings: (tab?: "profile" | "preferences" | "notifications" | "assistant" | "help") => void;
  onOpenAssistant: () => void;
  onSwitchDemoAccount: (acc: DemoAccount) => void;
  onPreviewLogin: () => void;
  onLogout: () => void;
  className?: string;
}

export function AccountMenu({
  user,
  view,
  onViewChange,
  onOpenSettings,
  onOpenAssistant,
  onSwitchDemoAccount,
  onPreviewLogin,
  onLogout,
  className,
}: AccountMenuProps) {
  const { t, tk, theme, setTheme, lang } = useSettings();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"root" | "language" | "appearance" | "accounts">("root");
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
        <IconChevron size={12} className="shrink-0 text-text-muted" />
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
                    {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                    {copied ? tk("account.copied") : tk("account.copyEmail")}
                  </button>
                </div>
              </div>

              <button type="button" className="menu-row" onClick={() => { setOpen(false); onOpenSettings("profile"); }}>
                <IconProfile size={16} className="shrink-0" />
                <span className="flex-1 text-start">{tk("account.myAccount")}</span>
                <IconArrowRight size={13} className="shrink-0 text-text-muted rtl:rotate-180" />
              </button>

              <button type="button" className="menu-row" onClick={() => { setOpen(false); onOpenSettings("preferences"); }}>
                <IconDoc size={16} className="shrink-0" />
                <span className="flex-1 text-start">{tk("account.settings")}</span>
                <IconArrowRight size={13} className="shrink-0 text-text-muted rtl:rotate-180" />
              </button>

              <div className="my-1.5 border-t border-border-subtle" />

              <button type="button" className="menu-row" onClick={() => setPanel("language")}>
                <IconGlobe size={16} className="shrink-0" />
                <span className="flex-1 text-start">{tk("account.language")}</span>
                <span className="flex items-center gap-1.5 text-text-muted">
                  <span className="text-[13px] leading-none">
                    {LANGUAGE_OPTIONS.find((o) => o.code === lang)?.flag}
                  </span>
                  <IconChevron size={12} className="rtl:rotate-180" />
                </span>
              </button>

              <button type="button" className="menu-row" onClick={() => setPanel("appearance")}>
                <IconBolt size={16} className="shrink-0" />
                <span className="flex-1 text-start">{tk("account.appearance")}</span>
                <span className="text-[10.5px] font-semibold text-text-muted">
                  {theme === "dark" ? tk("theme.dark") : tk("theme.light")}
                </span>
                <IconChevron size={12} className="text-text-muted rtl:rotate-180" />
              </button>

              {canSwitchAccounts(user) && (
                <button type="button" className="menu-row" onClick={() => setPanel("accounts")}>
                  <IconDashboard size={16} className="shrink-0" />
                  <span className="flex-1 text-start">{tk("account.switchAccount")}</span>
                  <IconChevron size={12} className="text-text-muted rtl:rotate-180" />
                </button>
              )}

              <button type="button" className="menu-row" onClick={() => { setOpen(false); onOpenAssistant(); }}>
                <IconBolt size={16} className="shrink-0 text-brand" />
                <span className="flex-1 text-start">{tk("nav.ai")}</span>
              </button>

              <button type="button" className="menu-row" onClick={() => { setOpen(false); onOpenSettings("help"); }}>
                <IconDoc size={16} className="shrink-0" />
                <span className="flex-1 text-start">{tk("account.help")}</span>
              </button>

              <div className="my-1.5 border-t border-border-subtle" />

              <button
                type="button"
                className="menu-row"
                onClick={() => { setOpen(false); onPreviewLogin(); }}
              >
                <IconProfile size={16} className="shrink-0" />
                <span className="flex-1 text-start">{tk("account.previewLogin")}</span>
              </button>

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

          {panel === "language" && (
            <SettingsPanelShell title={tk("language.choose")} onBack={() => setPanel("root")}>
              <LanguageList onSelect={() => setOpen(false)} />
            </SettingsPanelShell>
          )}

          {panel === "appearance" && (
            <SettingsPanelShell title={tk("account.appearance")} onBack={() => setPanel("root")}>
              {(
                [
                  { id: "light" as const, label: tk("theme.light"), hint: tk("theme.lightHint") },
                  { id: "dark" as const, label: tk("theme.dark"), hint: tk("theme.darkHint") },
                ]
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTheme(option.id)}
                  className={cn("menu-row justify-between", theme === option.id && "menu-row-on")}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{option.label}</span>
                    <span className="block truncate text-[10.5px] text-text-muted">{option.hint}</span>
                  </span>
                  {theme === option.id && <IconCheck size={14} className="shrink-0 text-brand" />}
                </button>
              ))}
            </SettingsPanelShell>
          )}

          {panel === "accounts" && (
            <SettingsPanelShell title={tk("account.switchAccount")} onBack={() => setPanel("root")}>
              {view && onViewChange && (
                <div className="mb-2">
                  <span className="menu-label px-1">{tk("header.viewLabel")}</span>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: "web" as const, label: tk("header.viewControl") },
                        { id: "mobile" as const, label: tk("header.viewMobile") },
                      ]
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          onViewChange(option.id);
                        }}
                        className={cn(
                          "rounded-[10px] px-2 py-2 text-[11px] font-semibold transition-colors",
                          view === option.id
                            ? "bg-brand text-on-brand"
                            : "bg-surface-2 text-text-secondary hover:bg-surface-3",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="my-2 border-t border-border-subtle" />
                </div>
              )}
              <p className="mb-1.5 px-1 text-[10.5px] leading-relaxed text-text-muted">
                {tk("account.switchHint")}
              </p>
              <div className="max-h-[46vh] space-y-1 overflow-y-auto scroll-thin">
                {FALLBACK_DEMO_ACCOUNTS.map((acc) => {
                  const isDriver = acc.role === "DRIVER";
                  const isClient = acc.role === "CUSTOMER";
                  const active = user?.email === acc.email;
                  return (
                    <button
                      key={acc.key}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onSwitchDemoAccount(acc);
                      }}
                      className={cn("menu-row items-start", active && "menu-row-on")}
                    >
                      <span className="mt-0.5 shrink-0">
                        {isDriver ? (
                          <IconTruck size={15} className="text-brand" />
                        ) : isClient ? (
                          <IconProfile size={15} className="text-accent-2" />
                        ) : (
                          <IconDashboard size={15} className="text-status-active" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold text-text-primary">
                          {t(acc.titleEn, acc.titleAr)}
                        </span>
                        <span className="block truncate text-[10px] text-text-muted">
                          {acc.descEn ? t(acc.descEn, acc.descAr) : acc.descAr}
                        </span>
                      </span>
                      {active && <IconCheck size={14} className="mt-0.5 shrink-0 text-brand" />}
                    </button>
                  );
                })}
              </div>
            </SettingsPanelShell>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsPanelShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const { tk } = useSettings();
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 border-b border-border-subtle pb-1.5">
        <button
          type="button"
          onClick={onBack}
          className="btn-icon-sm shrink-0"
          aria-label={tk("common.back")}
          title={tk("common.back")}
        >
          <IconArrowRight size={14} className="rtl:rotate-180" />
        </button>
        <span className="menu-label">{title}</span>
      </div>
      <div className="max-h-[60vh] space-y-1 overflow-y-auto scroll-thin pt-0.5">{children}</div>
    </div>
  );
}
