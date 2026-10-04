import { useEffect, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { LANGUAGE_OPTIONS } from "../localization/i18n";
import { usePreferences } from "../state/preferencesStore";
import { canSwitchAccounts, type SessionUser } from "../utils/permissions";
import { apiClient } from "../services/apiClient";
import { MobileSection, MobileRow } from "./MobileShared";
import {
  IconArrowRight,
  IconBolt,
  IconCheck,
  IconGlobe,
  IconInfo,
  IconLock,
  IconProfile,
  IconTruck,
  IconStar,
  IconKey,
} from "../components/Icons";

/**
 * «إعدادات التطبيق» (§5) — the ONE place for every user-facing preference of
 * the mobile app: account, language (a clear dropdown — never a button that
 * needs several taps), appearance (light / dark / system), time & date, app
 * information, and — for identities allowed more than one interface — the
 * interface switcher (§5 «إدارة نوع الواجهة»).
 *
 * Nothing here lives in the header (§4): no clock, no language, no theme, no
 * platform name, no interface pills.
 */

export function MobileAppSettings({
  user,
  onClose,
  interfacePref,
  onSwitchInterface,
  onLogout,
}: {
  user: SessionUser | null;
  onClose: () => void;
  interfacePref: "driver" | "client";
  onSwitchInterface?: (next: "driver" | "client") => void;
  onLogout: () => void;
}) {
  const { t, tk, lang, setLang, theme, setTheme, resolvedTheme } = useSettings();
  const { prefs, set: setPref } = usePreferences();
  const [systemInfo, setSystemInfo] = useState<{ version?: string; environment?: string; uptimeSeconds?: number } | null>(null);
  const [logoutArmed, setLogoutArmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.system
      .health()
      .then((h) => {
        if (!cancelled && h) setSystemInfo({ version: h.version, environment: h.environment, uptimeSeconds: h.uptimeSeconds });
      })
      .catch(() => {
        /* offline — the static app info below is still accurate */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const roleLabel = (role?: string) => (role ? role.replace(/_/g, " ") : "—");

  const maySwitchInterface =
    !!onSwitchInterface && (canSwitchAccounts(user) || (user as any)?.driverId || (user as any)?.customerId);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-surface-0 animate-fade-in">
      {/* Settings header: back + title only (§4) */}
      <header className="shrink-0 flex items-center gap-2.5 border-b border-border-subtle bg-navy px-3 py-2.5 text-white">
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20"
          aria-label={tk("common.back")}
        >
          <IconArrowRight size={15} className="rtl:rotate-180" />
        </button>
        <h1 className="text-[13.5px] font-bold">{t("App Settings", "إعدادات التطبيق")}</h1>
      </header>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* ── الحساب ─────────────────────────────────────────────── */}
        <MobileSection title={tk("account.myAccount")} hint={t("Account data, security and sessions", "بيانات الحساب والأمان والجلسات")}>
          <div className="flex items-center gap-3 px-3.5 py-3.5 border-b border-border-subtle">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand/20 text-[14px] font-bold text-brand">
              {(user?.fullName || user?.email || "EJ").slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-bold text-white">{user?.fullName || "—"}</div>
              <div className="truncate text-[10px] text-text-muted" dir="ltr">{user?.email || "—"}</div>
            </div>
          </div>
          <MobileRow label={tk("account.phone")} value={user?.phone || "—"} />
          <MobileRow label={t("Account type", "نوع الحساب")} value={roleLabel(user?.role)} />
          <MobileRow
            icon={IconKey}
            label={t("Security & sessions", "الأمان والجلسات")}
            hint={t("Signed in with an encrypted session token", "الجلسة مشفّرة عبر رمز وصول آمن")}
            value={tk("account.sessionActive")}
          />
          <MobileRow
            icon={IconLock}
            label={t("Sign out", "تسجيل الخروج")}
            hint={logoutArmed ? t("Tap again to confirm", "اضغط مرة أخرى للتأكيد") : undefined}
            danger
            onClick={() => {
              if (logoutArmed) onLogout();
              else setLogoutArmed(true);
            }}
          />
        </MobileSection>

        {/* ── اللغة (Dropdown واضح) ───────────────────────────────── */}
        <MobileSection title={tk("language.title")} hint={t("Choose the interface language", "اختر لغة الواجهة")}>
          <div className="p-3">
            <label className="mb-1.5 block text-[10px] font-semibold text-text-muted">
              {tk("language.choose")}
            </label>
            <div className="relative">
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as typeof lang)}
                className="h-11 w-full appearance-none rounded-[10px] border border-border-subtle bg-surface-2 px-3 text-[12px] font-semibold text-white focus:border-brand focus:outline-none"
                aria-label={tk("language.choose")}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.flag} {tk(option.labelKey)}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-text-muted">
                <IconGlobe size={13} />
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-text-muted">
              <IconCheck size={11} className="text-brand" />
              {t("Current", "الحالية")}: {tk(LANGUAGE_OPTIONS.find((o) => o.code === lang)?.labelKey ?? "language.ar")}
            </div>
          </div>
        </MobileSection>

        {/* ── المظهر ──────────────────────────────────────────────── */}
        <MobileSection title={tk("account.appearance")} hint={t("Light · Dark · System", "فاتح · داكن · حسب النظام")}>
          <div className="grid grid-cols-3 gap-2 p-3">
            {(
              [
                { id: "light" as const, label: tk("theme.light"), icon: "☀" },
                { id: "dark" as const, label: tk("theme.dark"), icon: "☾" },
                { id: "system" as const, label: t("System", "حسب النظام"), icon: "🖥" },
              ]
            ).map((option) => (
              <button
                key={option.id}
                onClick={() => setTheme(option.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-[10px] border px-2 py-2.5 text-[10px] font-semibold transition-colors",
                  theme === option.id
                    ? "border-brand bg-brand/15 text-brand"
                    : "border-border-subtle bg-surface-2 text-text-secondary hover:border-border-focus",
                )}
              >
                <span className="text-[14px] leading-none">{option.icon}</span>
                <span>{option.label}</span>
                {theme === option.id && <IconCheck size={11} className="text-brand" />}
              </button>
            ))}
          </div>
          <div className="px-3.5 pb-3 text-[9.5px] text-text-muted">
            {t("Active theme", "المظهر المفعّل")}: {resolvedTheme === "dark" ? tk("theme.dark") : tk("theme.light")}
          </div>
        </MobileSection>

        {/* ── الوقت والتاريخ ─────────────────────────────────────── */}
        <MobileSection title={t("Time & date", "الوقت والتاريخ")} hint={t("Clock and date display preferences", "تفضيلات عرض الساعة والتاريخ")}>
          <div className="flex items-center justify-between gap-3 px-3.5 py-3">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-white">{t("Time format", "نظام الوقت")}</div>
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
          <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-3.5 py-3">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-white">{t("Date format", "نظام التاريخ")}</div>
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
          <div className="border-t border-border-subtle px-3.5 py-3">
            <div className="text-[10px] text-text-muted">{t("Preview", "معاينة")}</div>
            <div className="mt-1 font-mono text-[12px] text-white" dir="ltr">
              {formatPreview(new Date(), prefs.timeFormat, prefs.dateFormat)}
            </div>
          </div>
        </MobileSection>

        {/* ── معلومات التطبيق ─────────────────────────────────────── */}
        <MobileSection title={t("App information", "معلومات التطبيق")} hint={t("Platform, establishment and system", "المنصة والمؤسسة والنظام")}>
          <MobileRow icon={IconStar} label={t("Platform", "المنصة")} value={tk("app.shortName")} />
          <MobileRow icon={IconInfo} label={t("App version", "إصدار التطبيق")} value={systemInfo?.version || "1.0.0-PROD"} />
          <MobileRow
            icon={IconTruck}
            label={t("EJAZ Transport Establishment", "مؤسسة إيجاز للنقليات")}
            hint={t("Unified fleet & logistics platform", "منصة موحّدة لإدارة الأسطول والرحلات اللوجستية")}
          />
          <MobileRow
            icon={IconBolt}
            label={t("System", "النظام")}
            value={(systemInfo?.environment || "—").toUpperCase()}
          />
        </MobileSection>

        {/* ── إدارة نوع الواجهة ───────────────────────────────────── */}
        {maySwitchInterface && (
          <MobileSection
            title={t("Interface type", "إدارة نوع الواجهة")}
            hint={t("Choose the interface authorized for your account", "اختر الواجهة المصرّح بها لحسابك")}
          >
            <div className="grid grid-cols-2 gap-2 p-3">
              <button
                onClick={() => onSwitchInterface?.("driver")}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-[12px] border px-2 py-3 text-[11px] font-bold transition-colors",
                  interfacePref === "driver"
                    ? "border-brand bg-brand/15 text-brand"
                    : "border-border-subtle bg-surface-2 text-text-secondary",
                )}
              >
                <IconTruck size={18} />
                {t("Driver app", "واجهة السائق")}
                {interfacePref === "driver" && <IconCheck size={12} className="text-brand" />}
              </button>
              <button
                onClick={() => onSwitchInterface?.("client")}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-[12px] border px-2 py-3 text-[11px] font-bold transition-colors",
                  interfacePref === "client"
                    ? "border-accent-2 bg-accent-2/15 text-accent-2"
                    : "border-border-subtle bg-surface-2 text-text-secondary",
                )}
              >
                <IconProfile size={18} />
                {t("Client app", "واجهة العميل")}
                {interfacePref === "client" && <IconCheck size={12} className="text-accent-2" />}
              </button>
            </div>
          </MobileSection>
        )}
      </div>
    </div>
  );
}

function formatPreview(now: Date, timeFormat: "24" | "12", dateFormat: "iso" | "arabic") {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const datePart =
    dateFormat === "iso"
      ? `${year}-${month}-${day}`
      : `${year}/${month}/${day}`;
  let hours = now.getHours();
  const suffix = timeFormat === "12" ? (hours >= 12 ? " PM" : " AM") : "";
  if (timeFormat === "12") hours = hours % 12 || 12;
  return `${datePart}  ${pad(hours)}:${pad(now.getMinutes())}${suffix}`;
}
