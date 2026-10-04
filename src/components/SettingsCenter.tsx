import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { usePreferences } from "../state/preferencesStore";
import { can, canSwitchAccounts, type SessionUser } from "../utils/permissions";
import { LanguageList } from "./AccountMenu";
import { useToast } from "./Toast";
import { apiClient } from "../services/apiClient";
import { RolePermissionsManager } from "./RolePermissionsManager";
import { usePermissions } from "../state/permissionStore";
import {
  IconArrowRight,
  IconBolt,
  IconCheck,
  IconClose,
  IconDoc,
  IconGlobe,
  IconInfo,
  IconProfile,
  IconStar,
  IconTruck,
  IconDashboard,
  IconHistory,
  IconReport,
  IconLayers,
  IconLock,
} from "./Icons";

/**
 * Settings center (§5-§12, §28).
 *
 * One organised surface, no duplicated controls:
 *   • حسابي            — identity, security & sessions, effective permissions (§7).
 *   • إعدادات التطبيق   — language, appearance (light/dark/system), time & date,
 *                        notifications, assistant, app information (§5).
 *   • التطبيقات        — «تطبيقات الجوال»: separate driver / client launchers (§12).
 *   • معاينة شاشة الدخول — preview ONLY; never contains app/panel entry buttons (§11).
 *   • إعدادات النظام    — identity, users, RBAC, trips, fleet, GPS, finance,
 *                        documents, reports and the audit log (§8-§10).
 *   • المساعدة والدعم   — support channels and shortcuts.
 *
 * Language and appearance live here and ONLY here for the console (§6): the
 * account menu links in, it does not re-implement them.
 */

export type SettingsTab = "account" | "app" | "apps" | "loginPreview" | "system" | "permissions" | "help";

const TABS: { id: SettingsTab; labelEn: string; labelAr: string; icon: typeof IconProfile }[] = [
  { id: "account", labelEn: "My account", labelAr: "حسابي", icon: IconProfile },
  { id: "app", labelEn: "App settings", labelAr: "إعدادات التطبيق", icon: IconStar },
  { id: "apps", labelEn: "Mobile apps", labelAr: "التطبيقات", icon: IconTruck },
  { id: "loginPreview", labelEn: "Sign-in preview", labelAr: "معاينة تسجيل الدخول", icon: IconLock },
  { id: "system", labelEn: "System settings", labelAr: "إعدادات النظام", icon: IconDashboard },
  { id: "permissions", labelEn: "Roles & permissions", labelAr: "الأدوار والصلاحيات", icon: IconLock },
  { id: "help", labelEn: "Help & support", labelAr: "المساعدة والدعم", icon: IconInfo },
];

export function SettingsCenter({
  isOpen,
  onClose,
  user,
  initialTab = "account",
  onOpenAssistant,
  onOpenMobileApp,
  onPreviewLogin,
  onNavigate,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: SessionUser | null;
  initialTab?: SettingsTab;
  onOpenAssistant?: () => void;
  /** Open one mobile app in its own interface (§12). */
  onOpenMobileApp?: (kind: "driver" | "client") => void;
  /** Open the sign-in screen in preview-only mode (§11). */
  onPreviewLogin?: () => void;
  /** Jump to an existing console section (never a duplicate page). */
  onNavigate?: (section: string) => void;
}) {
  const { t, tk, lang, theme, setTheme, resolvedTheme } = useSettings();
  const { prefs, set: setPref, reset } = usePreferences();
  const toast = useToast();
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [gpsStatus, setGpsStatus] = useState<{ configured?: boolean; provider?: string; message?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const maySeeSystem = can(user, "settings.manage") || can(user, "registrations.review") || canSwitchAccounts(user);
      const next =
        initialTab === "system" && !maySeeSystem
          ? "account"
          : initialTab === "permissions" && !isPermissionAdmin
            ? "account"
            : initialTab;
      setTab(next);
    }
  }, [isOpen, initialTab, user]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) setPref("lastSettingsTab", tab as never);
  }, [tab, isOpen, setPref]);

  // Real GPS provider status for «إعدادات النظام» (§24).
  useEffect(() => {
    if (!isOpen || tab !== "system") return;
    let cancelled = false;
    apiClient.gps
      .getStatus()
      .then((s) => !cancelled && setGpsStatus({ configured: !!s?.configured, provider: s?.provider, message: s?.message }))
      .catch(() => !cancelled && setGpsStatus({ configured: false }));
    return () => {
      cancelled = true;
    };
  }, [isOpen, tab]);

  const permissionSummary = useMemo(() => {
    const checks: { capability: Parameters<typeof can>[1]; labelKey: Parameters<typeof tk>[0] }[] = [
      { capability: "trips.view", labelKey: "perm.trips" },
      { capability: "vehicles.manage", labelKey: "perm.fleetManage" },
      { capability: "drivers.view", labelKey: "perm.drivers" },
      { capability: "drivers.create", labelKey: "perm.drivers" },
      { capability: "customers.view", labelKey: "perm.registrations" },
      { capability: "registrations.review", labelKey: "perm.registrations" },
      { capability: "reports.view", labelKey: "perm.reports" },
      { capability: "finance.view", labelKey: "perm.finance" },
      { capability: "branding.manage", labelKey: "perm.branding" },
      { capability: "settings.manage", labelKey: "perm.settings" },
      { capability: "audit.view", labelKey: "perm.registrations" },
      { capability: "gps.view", labelKey: "perm.fleetManage" },
    ];
    return checks.map((c) => ({ ...c, granted: can(user, c.capability) }));
  }, [user]);

  const { can: allowed, canManagePermissions } = usePermissions();
  const isAdmin = can(user, "settings.manage") || can(user, "registrations.review") || canSwitchAccounts(user);
  /* Only the system administrator (or a role explicitly granted
     `permissions.manage`) ever sees the permissions tab. */
  const isPermissionAdmin = canManagePermissions || allowed("permissions.manage");

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
              {TABS.filter((tb) => (tb.id === "system" ? isAdmin : tb.id === "permissions" ? isPermissionAdmin : true)).map(({ id, labelEn, labelAr, icon: Icon }) => {
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
                    <span className="whitespace-nowrap">{t(labelEn, labelAr)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panels */}
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {/* ── الأدوار والصلاحيات ─────────────────────────────── */}
            {tab === "permissions" && isPermissionAdmin && <RolePermissionsManager />}

            {/* ── حسابي (§7) ───────────────────────────────────────── */}
            {tab === "account" && (
              <section className="space-y-4">
                <PanelHeading title={t("Account data", "بيانات الحساب")} hint={t("Personal information of the signed-in user", "المعلومات الشخصية للمستخدم الحالي")} />

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
                    <Field
                      label={t("Account status", "حالة الحساب")}
                      value={
                        user?.accountApproved === false
                          ? t("Under review", "قيد المراجعة")
                          : t("Active", "نشط")
                      }
                    />
                    <Field label={t("Account type", "نوع الحساب")} value={user?.role || "—"} />
                  </dl>
                </div>

                <PanelHeading title={t("Security & sessions", "الأمان والجلسات")} />
                <div className="card p-4">
                  <div className="flex items-center justify-between gap-3 rounded-[10px] bg-surface-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-text-primary">
                        {t("Encrypted session token", "رمز جلسة مشفّر")}
                      </div>
                      <div className="text-[10.5px] text-text-muted">
                        {t("Every sign-in is recorded in the audit log", "كل عملية دخول تُسجَّل في سجل التدقيق")}
                      </div>
                    </div>
                    <IconLock size={16} className="shrink-0 text-brand" />
                  </div>
                </div>

                <div className="card p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="card-title">{tk("account.permissions")}</span>
                    {Array.isArray(user?.permissions) && user.permissions.includes("*") && (
                      <span className="pill pill-brand">{tk("account.fullPermissions")}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {permissionSummary.map((p, idx) => (
                      <div
                        key={`${p.capability}-${idx}`}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-[10px] border px-3 py-2 text-[12px]",
                          p.granted
                            ? "border-status-active/30 bg-status-active/8 text-text-primary"
                            : "border-border-subtle bg-surface-2 text-text-muted",
                        )}
                      >
                        <span className="truncate">
                          {tk(p.labelKey)} <span className="text-[9.5px] text-text-muted">({p.capability})</span>
                        </span>
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

            {/* ── إعدادات التطبيق (§5) ─────────────────────────────── */}
            {tab === "app" && (
              <section className="space-y-4">
                <PanelHeading title={tk("language.title")} hint={tk("language.choose")} />
                <div className="card p-3">
                  <LanguageList />
                </div>

                <PanelHeading title={tk("account.appearance")} hint={t("Light · Dark · System", "فاتح · داكن · حسب النظام")} />
                <div className="card grid grid-cols-1 gap-2 p-3 sm:grid-cols-3">
                  {(
                    [
                      { id: "light" as const, label: tk("theme.light"), hint: tk("theme.lightHint") },
                      { id: "dark" as const, label: tk("theme.dark"), hint: tk("theme.darkHint") },
                      { id: "system" as const, label: tk("theme.system"), hint: t("Follow the device colour scheme", "يتبع نظام الألوان في جهازك") },
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
                <p className="text-[10.5px] text-text-muted">
                  {t("Active theme", "المظهر المفعّل")}: {resolvedTheme === "dark" ? tk("theme.dark") : tk("theme.light")}
                </p>

                <PanelHeading title={t("Time & date", "الوقت والتاريخ")} hint={t("Clock and date display preferences", "تفضيلات عرض الساعة والتاريخ")} />
                <div className="card divide-y divide-border-subtle">
                  <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-text-primary">{t("Time format", "نظام الوقت")}</div>
                      <div className="text-[10px] text-text-muted">{t("24-hour or 12-hour clock", "نظام ٢٤ ساعة أو ١٢ ساعة")}</div>
                    </div>
                    <div className="flex shrink-0 rounded-[8px] border border-border-subtle p-0.5">
                      {(["24", "12"] as const).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => setPref("timeFormat", fmt)}
                          className={cn(
                            "rounded-[6px] px-2.5 py-1 text-[10px] font-bold",
                            prefs.timeFormat === fmt ? "bg-brand text-on-brand" : "text-text-muted",
                          )}
                        >
                          {fmt === "24" ? "24H" : "12H"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-text-primary">{t("Date format", "نظام التاريخ")}</div>
                      <div className="text-[10px] text-text-muted">{t("Gregorian display preference", "تفضيل عرض التاريخ الميلادي")}</div>
                    </div>
                    <div className="flex shrink-0 rounded-[8px] border border-border-subtle p-0.5">
                      {(["iso", "arabic"] as const).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => setPref("dateFormat", fmt)}
                          className={cn(
                            "rounded-[6px] px-2.5 py-1 text-[10px] font-bold",
                            prefs.dateFormat === fmt ? "bg-brand text-on-brand" : "text-text-muted",
                          )}
                        >
                          {fmt === "iso" ? "2026-10-04" : "٢٠٢٦/١٠/٠٤"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

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

                <PanelHeading title={t("App information", "معلومات التطبيق")} hint={t("Platform, establishment and system", "المنصة والمؤسسة والنظام")} />
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <InfoCard label={t("Platform", "المنصة")} value={tk("app.name")} icon={IconStar} />
                  <InfoCard label={tk("settings.helpVersion")} value="V1.0-PROD" icon={IconInfo} />
                  <InfoCard label={t("EJAZ Transport Establishment", "مؤسسة إيجاز للنقليات")} value={tk("app.tagline")} icon={IconTruck} />
                  <InfoCard label={t("System environment", "بيئة النظام")} value={t("Production", "الإنتاج")} icon={IconBolt} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-surface-2 px-3 py-2.5">
                  <span className="text-[10.5px] text-text-muted">{tk("settings.persistence")}</span>
                  <button
                    onClick={() => {
                      reset();
                      setTheme("light");
                      toast(tk("settings.reset"), tk("settings.saved"));
                    }}
                    className="btn-ghost text-[11px] py-1 px-3"
                  >
                    {tk("settings.reset")}
                  </button>
                </div>
              </section>
            )}

            {/* ── التطبيقات (§12) ──────────────────────────────────── */}
            {tab === "apps" && (
              <section className="space-y-4">
                <PanelHeading title={t("Mobile apps", "تطبيقات الجوال")} hint={tk("settings.appsHint")} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => onOpenMobileApp?.("client")}
                    className="flex flex-col items-center gap-2.5 rounded-[16px] border border-border-subtle bg-surface-2 p-6 transition-colors hover:border-accent-2/60"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-2/15 text-accent-2">
                      <IconProfile size={22} />
                    </span>
                    <span className="text-[13px] font-bold text-text-primary">{tk("settings.appsClient")}</span>
                    <span className="text-[10.5px] text-text-muted">
                      {t("Trips, tracking, documents and account", "الرحلات، التتبع، المستندات والحساب")}
                    </span>
                  </button>
                  <button
                    onClick={() => onOpenMobileApp?.("driver")}
                    className="flex flex-col items-center gap-2.5 rounded-[16px] border border-border-subtle bg-surface-2 p-6 transition-colors hover:border-brand/60"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-brand/15 text-brand">
                      <IconTruck size={22} />
                    </span>
                    <span className="text-[13px] font-bold text-text-primary">{tk("settings.appsDriver")}</span>
                    <span className="text-[10.5px] text-text-muted">
                      {t("Dispatch, trips, GPS and account", "العمليات، الرحلات، التتبع والحساب")}
                    </span>
                  </button>
                </div>
                <p className="text-[10.5px] leading-relaxed text-text-muted">
                  {t(
                    "Both apps run on the same backend, database, accounts and permissions — every action reflects across the whole system.",
                    "كلا التطبيقين يعملان على نفس الخادم وقاعدة البيانات والحسابات والصلاحيات — أي عملية تنعكس على النظام بأكمله.",
                  )}
                </p>
              </section>
            )}

            {/* ── معاينة شاشة تسجيل الدخول (§11) ───────────────────── */}
            {tab === "loginPreview" && (
              <section className="space-y-4">
                <PanelHeading title={tk("account.previewLogin")} hint={tk("settings.loginPreviewHint")} />
                <div className="card p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                      <IconLock size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-bold text-text-primary">
                        {t("Preview only", "معاينة فقط")}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                        {t(
                          "Shows exactly what an unauthenticated visitor sees. No control-room, driver-app or client-app entry buttons are included inside the preview.",
                          "تعرض بالضبط ما يراه الزائر غير المسجّل. لا تتضمن أي أزرار دخول للوحة التحكم أو تطبيق السائق أو تطبيق العميل.",
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onPreviewLogin?.();
                    }}
                    className="btn-primary mt-4 w-full gap-2 py-2.5"
                  >
                    <IconLock size={15} /> {tk("account.previewLogin")}
                  </button>
                </div>
              </section>
            )}

            {/* ── إعدادات النظام (§8-§10, §22, §24) ────────────────── */}
            {tab === "system" && (
              <section className="space-y-4">
                <PanelHeading title={tk("settings.tabSystem")} hint={tk("settings.systemHint")} />

                {/* هوية المؤسسة */}
                <SystemRow
                  icon={IconLayers}
                  label={t("Establishment identity", "هوية المؤسسة")}
                  hint={t("Name, logos, contact data", "الاسم، الشعارات، بيانات التواصل")}
                  onOpen={() => onNavigate?.("branding")}
                />

                {/* المستخدمون */}
                <div>
                  <h3 className="mb-2 text-[var(--type-card-title)] font-bold text-text-primary">
                    {t("Users & staff", "المستخدمون والموظفون")}
                  </h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <SystemRow icon={IconProfile} label={tk("settings.systemDrivers")} hint={t("Driver registry & licences", "سجل السائقين والرخص")} onOpen={() => onNavigate?.("drivers")} />
                    <SystemRow icon={IconStar} label={tk("settings.systemCustomers")} hint={t("Customers & merchants accounts", "حسابات العملاء والتجار")} onOpen={() => onNavigate?.("shipments")} />
                    <SystemRow icon={IconDoc} label={tk("settings.systemUsers")} hint={t("Registration requests & approvals", "طلبات التسجيل والاعتماد")} onOpen={() => onNavigate?.("registrations")} />
                    <SystemRow icon={IconDashboard} label={tk("settings.systemAdmins")} hint={t("Staff & admin accounts", "الحسابات الإدارية والموظفون")} onOpen={() => onNavigate?.("drivers")} />
                  </div>
                </div>

                {/* الأدوار والصلاحيات — live administration, not a static table */}
                {isPermissionAdmin && (
                  <div>
                    <h3 className="mb-2 text-[var(--type-card-title)] font-bold text-text-primary">
                      {t("Roles & permissions (RBAC)", "الأدوار والصلاحيات")}
                    </h3>
                    <div className="card flex flex-wrap items-center gap-3 p-3.5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-brand/12 text-brand">
                        <IconLock size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-semibold text-text-primary">
                          {t("Roles & permissions", "إدارة الأدوار والصلاحيات")}
                        </div>
                        <div className="text-[10.5px] text-text-muted">
                          {t(
                            "Show or hide any section, page or function for any role — applied on save.",
                            "إظهار أو إخفاء أي قسم أو صفحة أو وظيفة لأي دور — يسري فور الحفظ.",
                          )}
                        </div>
                      </div>
                      <button onClick={() => setTab("permissions")} className="btn-primary px-3.5 py-2 text-[11.5px]">
                        {t("Open", "فتح")}
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] text-text-muted">
                      {t(
                        "Enforced in the API on every call — hiding a button is never the protection.",
                        "تُفرض في الواجهة البرمجية مع كل طلب — إخفاء الزر ليس حماية أبدًا.",
                      )}
                    </p>
                  </div>
                )}

                {/* إعدادات الرحلات (§22) */}
                <div>
                  <h3 className="mb-2 text-[var(--type-card-title)] font-bold text-text-primary">
                    {tk("settings.systemTrips")}
                  </h3>
                  <div className="card space-y-2 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-text-muted">{tk("settings.tripNumberScheme")}</span>
                      <span className="font-mono text-[11.5px] font-bold text-brand">EJ-YYYY-XXXXXX</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-text-muted">{t("Example", "مثال")}</span>
                      <span className="font-mono text-[11px] text-text-secondary">EJ-2026-000001</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-text-muted">{tk("settings.tripStates")}</span>
                      <span className="text-[10.5px] font-semibold text-text-secondary">
                        {t("Draft → Pending → Confirmed → Loading → In transit → Arrived → Delivered → Settled", "مسودة → بانتظار الاعتماد → مؤكدة → تحميل → في الطريق → وصلت → سُلّمت → مُسوّاة")}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted">
                      {t(
                        "Numbers come only from the backend generator; cancellations, reopening and archiving follow the canonical state machine.",
                        "الأرقام تأتي من مُولّد الخادم فقط؛ الإلغاء وإعادة الفتح والأرشفة تتبع آلة الحالات المعتمدة.",
                      )}
                    </p>
                  </div>
                </div>

                {/* الأسطول / GPS / المالية / المستندات / التقارير / Audit */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <SystemRow icon={IconTruck} label={tk("settings.systemFleet")} hint={t("Four official body types + assets", "الأنواع الأربعة الرسمية + الأصول")} onOpen={() => onNavigate?.("fleet")} />
                  <SystemRow
                    icon={IconBolt}
                    label={tk("settings.systemGps")}
                    hint={
                      gpsStatus
                        ? gpsStatus.configured
                          ? t("Provider active", "المزود مفعّل")
                          : t("GPS service is not configured", "خدمة GPS غير مهيأة")
                        : t("Checking provider…", "جاري فحص المزود…")
                    }
                    onOpen={() => onNavigate?.("tracking")}
                  />
                  <SystemRow icon={IconStar} label={tk("settings.systemFinance")} hint={t("Ledger, invoices & settlements", "الدفاتر والفواتير والتسويات")} onOpen={() => onNavigate?.("reports")} />
                  <SystemRow icon={IconDoc} label={tk("settings.systemDocuments")} hint={t("Waybills, PODs & permits", "البوليصات وإثبات التسليم والتصاريح")} onOpen={() => onNavigate?.("shipments")} />
                  <SystemRow icon={IconReport} label={tk("settings.systemReports")} hint={t("PDF · Excel · Print", "PDF · Excel · طباعة")} onOpen={() => onNavigate?.("reports")} />
                  <SystemRow icon={IconHistory} label={tk("settings.systemAudit")} hint={t("Sensitive operations record", "سجل العمليات الحساسة")} onOpen={() => onNavigate?.("history")} />
                </div>
              </section>
            )}

            {/* ── المساعدة والدعم ───────────────────────────────────── */}
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

/** A system-settings row that opens an EXISTING console section. */
function SystemRow({
  icon: Icon,
  label,
  hint,
  onOpen,
}: {
  icon: typeof IconDoc;
  label: string;
  hint?: string;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="card flex items-center gap-3 p-3.5 text-start transition-colors hover:border-brand/50"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-brand/12 text-brand">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold text-text-primary">{label}</span>
        {hint && <span className="block truncate text-[10px] text-text-muted">{hint}</span>}
      </span>
      <IconArrowRight size={13} className="shrink-0 text-text-muted rtl:rotate-180" />
    </button>
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
