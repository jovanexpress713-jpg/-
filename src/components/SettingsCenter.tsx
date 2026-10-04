import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import type { I18nKey } from "../localization/i18n";
import { usePreferences } from "../state/preferencesStore";
import { can, canSwitchAccounts, type SessionUser } from "../utils/permissions";
import { LanguageList } from "./AccountMenu";
import { useToast } from "./Toast";
import {
  IconArrowRight,
  IconBell,
  IconBolt,
  IconCheck,
  IconClose,
  IconDoc,
  IconGlobe,
  IconInfo,
  IconProfile,
  IconStar,
} from "./Icons";

/**
 * Settings center (§3, §11, §26).
 *
 * One organised surface instead of scattered header toggles:
 *   • My account   — the signed-in identity, role and effective permissions.
 *   • Preferences  — language (flag + name + ✓) and light/dark appearance.
 *   • Notifications— which classes of alert may reach this user.
 *   • Assistant    — context, suggestions and audit behaviour.
 *   • Help         — support channels, shortcuts and the platform version.
 *
 * Nothing here re-implements business logic: it reads the session user, writes
 * the language/theme through `settings.tsx` and the rest through the preferences
 * store, so the whole product reacts instantly and the choice survives reloads.
 */

export type SettingsTab = "profile" | "preferences" | "notifications" | "assistant" | "help";

/** One entry per settings section — label comes from the central key registry. */
const TABS: { id: SettingsTab; labelKey: I18nKey; icon: typeof IconProfile }[] = [
  { id: "profile", labelKey: "settings.tabProfile", icon: IconProfile },
  { id: "preferences", labelKey: "settings.tabPreferences", icon: IconStar },
  { id: "notifications", labelKey: "settings.tabNotifications", icon: IconBell },
  { id: "assistant", labelKey: "settings.tabAssistant", icon: IconBolt },
  { id: "help", labelKey: "settings.tabHelp", icon: IconInfo },
];

export function SettingsCenter({
  isOpen,
  onClose,
  user,
  initialTab = "profile",
  onOpenAssistant,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: SessionUser | null;
  initialTab?: SettingsTab;
  onOpenAssistant?: () => void;
}) {
  const { tk, lang, theme, setTheme } = useSettings();
  const { prefs, set: setPref, reset } = usePreferences();
  const toast = useToast();
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    if (isOpen) setTab(initialTab);
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) setPref("lastSettingsTab", tab);
  }, [tab, isOpen, setPref]);

  const permissionSummary = useMemo(() => {
    const checks: { capability: Parameters<typeof can>[1]; labelKey: I18nKey }[] = [
      { capability: "trips.view", labelKey: "perm.trips" },
      { capability: "vehicles.manage", labelKey: "perm.fleetManage" },
      { capability: "drivers.view", labelKey: "perm.drivers" },
      { capability: "registrations.review", labelKey: "perm.registrations" },
      { capability: "reports.view", labelKey: "perm.reports" },
      { capability: "finance.view", labelKey: "perm.finance" },
      { capability: "branding.manage", labelKey: "perm.branding" },
      { capability: "settings.manage", labelKey: "perm.settings" },
    ];
    return checks.map((c) => ({ ...c, granted: can(user, c.capability) }));
  }, [user]);

  if (!isOpen) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[95] grid place-items-center bg-black/70 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={tk("settings.title")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up flex max-h-[92vh] w-full max-w-[880px] flex-col overflow-hidden rounded-[20px] border border-border-subtle bg-surface-1 shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-[var(--type-page-title)] font-extrabold text-text-primary">
              {tk("settings.title")}
            </h2>
            <p className="truncate text-[11px] text-text-muted">{tk("settings.subtitle")}</p>
          </div>
          <button onClick={onClose} className="btn-icon shrink-0" aria-label={tk("common.close")}>
            <IconClose size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Tab rail: horizontal scroller on phones, vertical rail on desktop */}
          <div className="scroll-x shrink-0 gap-1.5 border-b border-border-subtle p-2.5 sm:w-[214px] sm:overflow-y-auto sm:border-b-0 sm:border-e sm:p-3">
            <div className="flex gap-1.5 sm:flex-col">
              {TABS.map(({ id, labelKey, icon: Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold transition-colors sm:w-full",
                      active
                        ? "bg-brand text-on-brand shadow-sm"
                        : "text-text-secondary hover:bg-surface-3 hover:text-text-primary",
                    )}
                  >
                    <Icon size={15} className="shrink-0" />
                    <span className="whitespace-nowrap">{tk(labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panels */}
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {tab === "profile" && (
              <section className="space-y-4">
                <PanelHeading title={tk("settings.profileTitle")} hint={tk("settings.profileHint")} />

                <div className="card p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-brand/15 text-[15px] font-bold text-brand">
                      {sessionInitials(user?.fullName, user?.email, lang)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-bold text-text-primary">
                        {user?.fullName || "—"}
                      </div>
                      <div className="truncate text-[11.5px] text-text-muted" dir="ltr">
                        {user?.email || "—"}
                      </div>
                    </div>
                    <span className="pill pill-success">
                      <IconCheck size={12} /> {tk("account.sessionActive")}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <Field label={tk("account.role")} value={user?.role || "—"} />
                    <Field label={tk("account.phone")} value={user?.phone || "—"} ltr />
                    <Field label={tk("account.language")} value={tk(lang === "ar" ? "language.ar" : lang === "en" ? "language.en" : "language.ur")} />
                    <Field label={tk("account.appearance")} value={theme === "dark" ? tk("theme.dark") : tk("theme.light")} />
                  </dl>
                </div>

                <div className="card p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="card-title">{tk("account.permissions")}</span>
                    {Array.isArray(user?.permissions) && user.permissions.includes("*") && (
                      <span className="pill pill-brand">{tk("account.fullPermissions")}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {permissionSummary.map((p) => (
                      <div
                        key={p.labelKey}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-[10px] border px-3 py-2 text-[12px]",
                          p.granted
                            ? "border-status-active/30 bg-status-active/8 text-text-primary"
                            : "border-border-subtle bg-surface-2 text-text-muted",
                        )}
                      >
                        <span className="truncate">{tk(p.labelKey)}</span>
                        <span className="shrink-0">
                          {p.granted ? (
                            <IconCheck size={13} className="text-status-active" />
                          ) : (
                            <IconClose size={13} />
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10.5px] text-text-muted">{tk("account.notAllowed")}</p>
                </div>
              </section>
            )}

            {tab === "preferences" && (
              <section className="space-y-4">
                <PanelHeading title={tk("language.title")} hint={tk("language.choose")} />
                <div className="card p-3">
                  <LanguageList />
                </div>

                <PanelHeading title={tk("settings.tabPreferences")} hint={tk("theme.lightHint")} />
                <div className="card grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                  {(
                    [
                      { id: "light" as const, label: tk("theme.light"), hint: tk("theme.lightHint") },
                      { id: "dark" as const, label: tk("theme.dark"), hint: tk("theme.darkHint") },
                    ]
                  ).map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setTheme(option.id)}
                      className={cn(
                        "flex items-start justify-between gap-3 rounded-[12px] border p-3 text-start transition-colors",
                        theme === option.id
                          ? "border-brand/60 bg-brand/10"
                          : "border-border-subtle bg-surface-2 hover:border-border-focus",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-bold text-text-primary">{option.label}</span>
                        <span className="mt-0.5 block text-[10.5px] leading-relaxed text-text-muted">
                          {option.hint}
                        </span>
                      </span>
                      {theme === option.id && <IconCheck size={15} className="mt-0.5 shrink-0 text-brand" />}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-surface-2 px-3 py-2.5">
                  <span className="text-[10.5px] text-text-muted">{tk("settings.persistence")}</span>
                  <button
                    onClick={() => {
                      reset();
                      setTheme("dark");
                      toast(tk("settings.reset"), tk("settings.saved"));
                    }}
                    className="btn-ghost text-[11px] py-1 px-3"
                  >
                    {tk("settings.reset")}
                  </button>
                </div>
              </section>
            )}

            {tab === "notifications" && (
              <section className="space-y-4">
                <PanelHeading title={tk("settings.notifTitle")} hint={tk("settings.notifHint")} />
                <div className="card divide-y divide-border-subtle p-2">
                  <Toggle
                    label={tk("settings.notifCritical")}
                    hint={tk("severity.critical")}
                    checked={prefs.notifyCritical}
                    onChange={(v) => setPref("notifyCritical", v)}
                  />
                  <Toggle
                    label={tk("settings.notifOps")}
                    hint={tk("alerts.type")}
                    checked={prefs.notifyOps}
                    onChange={(v) => setPref("notifyOps", v)}
                  />
                  <Toggle
                    label={tk("settings.notifDocs")}
                    hint={tk("alertType.doc_expiry")}
                    checked={prefs.notifyDocs}
                    onChange={(v) => setPref("notifyDocs", v)}
                  />
                  <Toggle
                    label={tk("settings.notifDigest")}
                    hint={tk("settings.persistence")}
                    checked={prefs.notifyDigest}
                    onChange={(v) => setPref("notifyDigest", v)}
                  />
                </div>
              </section>
            )}

            {tab === "assistant" && (
              <section className="space-y-4">
                <PanelHeading title={tk("settings.assistantTitle")} hint={tk("assistant.subtitle")} />
                <div className="card divide-y divide-border-subtle p-2">
                  <Toggle
                    label={tk("settings.assistantContext")}
                    hint={tk("assistant.contextPage")}
                    checked={prefs.assistantContext}
                    onChange={(v) => setPref("assistantContext", v)}
                  />
                  <Toggle
                    label={tk("settings.assistantSuggest")}
                    hint={tk("assistant.suggestions")}
                    checked={prefs.assistantSuggestions}
                    onChange={(v) => setPref("assistantSuggestions", v)}
                  />
                  <Toggle
                    label={tk("settings.assistantAudit")}
                    hint={tk("assistant.acted")}
                    checked={prefs.assistantAudit}
                    onChange={(v) => setPref("assistantAudit", v)}
                  />
                </div>
                {onOpenAssistant && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenAssistant();
                    }}
                    className="btn-primary w-full gap-2 py-2.5"
                  >
                    <IconBolt size={15} /> {tk("nav.ai")}
                  </button>
                )}
              </section>
            )}

            {tab === "help" && (
              <section className="space-y-4">
                <PanelHeading title={tk("settings.helpTitle")} hint={tk("settings.subtitle")} />
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <InfoCard label={tk("settings.helpOps")} value="+966 12 000 0000" icon={IconGlobe} />
                  <InfoCard label={tk("settings.helpEmail")} value="ops@ejaz.sa" icon={IconDoc} />
                  <InfoCard label={tk("settings.helpVersion")} value="V1.0-PROD" icon={IconInfo} />
                  <InfoCard
                    label={tk("account.permissions")}
                    value={canSwitchAccounts(user) ? tk("account.fullPermissions") : tk("account.notAllowed")}
                    icon={IconStar}
                  />
                </div>
                <div className="card p-4">
                  <span className="card-title">{tk("settings.helpShortcuts")}</span>
                  <ul className="mt-2.5 space-y-1.5 text-[12px] text-text-secondary">
                    <li className="flex items-center gap-2">
                      <kbd className="rounded border border-border-subtle bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px]">Esc</kbd>
                      {tk("common.close")}
                    </li>
                    <li className="flex items-center gap-2">
                      <kbd className="rounded border border-border-subtle bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px]">Ctrl</kbd>
                      <kbd className="rounded border border-border-subtle bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px]">K</kbd>
                      {tk("common.search")}
                    </li>
                  </ul>
                </div>
                <button onClick={onClose} className="menu-row justify-center border border-border-subtle">
                  <IconArrowRight size={14} className="rtl:rotate-180" />
                  {tk("common.close")}
                </button>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Latin-script initials for a Latin session; Arabic initials otherwise. */
function sessionInitials(name?: string, email?: string, lang: "ar" | "en" | "ur" = "ar") {
  const value = (name || "").trim();
  const latin = value.match(/[A-Za-z]+/g)?.join("") ?? "";
  if (latin.length >= 2) return latin.slice(0, 2).toUpperCase();
  if (lang === "ar") return (value || email || "EJ").slice(0, 2);
  return ((email ?? "").split("@")[0].slice(0, 2) || "EJ").toUpperCase();
}

function PanelHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h3 className="text-[var(--type-card-title)] font-bold text-text-primary">{title}</h3>
      {hint && <p className="mt-0.5 text-[11px] text-text-muted">{hint}</p>}
    </div>
  );
}

function Field({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="rounded-[10px] bg-surface-2 px-3 py-2">
      <dt className="text-[10.5px] font-semibold text-text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-[12.5px] font-semibold text-text-primary" dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-3">
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-semibold text-text-primary">{label}</div>
        {hint && <div className="truncate text-[10.5px] text-text-muted">{hint}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-brand" : "bg-surface-5",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "start-[22px]" : "start-0.5",
          )}
        />
      </button>
    </div>
  );
}

function InfoCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof IconGlobe;
}) {
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-brand/12 text-brand">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[10.5px] text-text-muted">{label}</div>
        <div className="truncate text-[12.5px] font-semibold text-text-primary" dir="ltr">
          {value}
        </div>
      </div>
    </div>
  );
}
