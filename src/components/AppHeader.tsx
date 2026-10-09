import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { BrandEmblem } from "./Logo";
import { GlobalSearch } from "./GlobalSearch";
import { AccountMenu } from "./AccountMenu";
import type { SettingsTab } from "./SettingsCenter";
import type { SessionUser } from "../utils/permissions";
import { IconBolt, IconBell, IconMenu } from "./Icons";

type ConnectionQuality = "optimal" | "fair" | "offline" | "checking";

interface BatteryManagerLike extends EventTarget {
  charging: boolean;
  level: number;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

/**
 * The operational application bar (§2).
 *
 * Design rules this component is built to keep:
 *   • ONE row, 58px, never wraps — no element can push another out of place.
 *   • Exactly five affordances: identity, current page, search, notifications,
 *     assistant + account. Language, theme, role switching, sign-out, settings
 *     and the mobile apps live inside the account menu / settings center (§6).
 *   • The logo is balanced (34px emblem, name + tagline at text scale) and
 *     collapses to the emblem alone on phones, so nothing crowds.
 *   • Sticky, frosted, hairline-bottom: it reads as an app chrome, not a
 *     marketing hero.
 */
export function AppHeader({
  user,
  pageTitle,
  pageHint,
  unreadAlerts,
  onOpenSidebar,
  onOpenAssistant,
  onOpenAlerts,
  onOpenSettings,
  onPreviewLogin,
  onLogout,
  onNavigate,
  onOpenMobileApp,
  showMenuButton = false,
}: {
  user: SessionUser | null;
  pageTitle: string;
  pageHint?: string;
  unreadAlerts: number;
  onOpenSidebar?: () => void;
  onOpenAssistant: () => void;
  onOpenAlerts: () => void;
  onOpenSettings: (tab?: SettingsTab) => void;
  onPreviewLogin: () => void;
  onLogout: () => void;
  onNavigate: (targetView: string, entityId?: string) => void;
  /** Open one mobile app in its own interface (§12). */
  onOpenMobileApp?: (kind: "driver" | "client") => void;
  showMenuButton?: boolean;
}) {
  const { tk, lang } = useSettings();
  const [searchOpen, setSearchOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionQuality>("optimal");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [batteryInfo, setBatteryInfo] = useState<{ level: number; charging: boolean } | null>(null);
  const isPingingRef = useRef(false);

  // Periodic device battery level check if available from client's system API
  useEffect(() => {
    let isMounted = true;
    let bmRef: BatteryManagerLike | null = null;

    const syncBattery = (bm: BatteryManagerLike) => {
      if (!isMounted) return;
      const level = Math.round((bm.level ?? 1) * 100);
      const charging = Boolean(bm.charging);
      setBatteryInfo({ level, charging });
    };

    const onBatteryChange = () => {
      if (bmRef) syncBattery(bmRef);
    };

    const nav = typeof navigator !== "undefined" ? (navigator as unknown as { getBattery?: () => Promise<BatteryManagerLike> }) : null;
    if (nav && typeof nav.getBattery === "function") {
      nav.getBattery()
        .then((bm) => {
          if (!isMounted || !bm) return;
          bmRef = bm;
          syncBattery(bm);
          bm.addEventListener("levelchange", onBatteryChange);
          bm.addEventListener("chargingchange", onBatteryChange);
        })
        .catch(() => {
          // Gracefully ignore if battery API is unsupported, denied, or unavailable
        });
    }

    // Periodic check every 30s as safety fallback for platforms that do not fire events
    const batteryInterval = setInterval(() => {
      if (bmRef) {
        syncBattery(bmRef);
      }
    }, 30_000);

    return () => {
      isMounted = false;
      clearInterval(batteryInterval);
      if (bmRef) {
        bmRef.removeEventListener("levelchange", onBatteryChange);
        bmRef.removeEventListener("chargingchange", onBatteryChange);
      }
    };
  }, []);

  // Periodic health check ping to ensure server connectivity & display connection quality
  useEffect(() => {
    let isMounted = true;

    async function checkHealth() {
      if (isPingingRef.current) return;
      isPingingRef.current = true;
      const start = performance.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch("/api/health", {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const elapsed = Math.round(performance.now() - start);
        if (!isMounted) return;

        if (res.ok) {
          setLatencyMs(elapsed);
          setConnectionStatus(elapsed > 1200 ? "fair" : "optimal");
        } else {
          setConnectionStatus("offline");
          setLatencyMs(null);
        }
      } catch {
        if (!isMounted) return;
        setConnectionStatus("offline");
        setLatencyMs(null);
      } finally {
        isPingingRef.current = false;
      }
    }

    // Initial ping on mount
    checkHealth();

    // Periodic ping every 30 seconds
    const interval = setInterval(checkHealth, 30_000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const statusLabel =
    connectionStatus === "optimal"
      ? tk("header.connectionOnline")
      : connectionStatus === "fair"
        ? tk("header.connectionSlow")
        : connectionStatus === "offline"
          ? tk("header.connectionOffline")
          : tk("header.connectionChecking");

  const batteryTooltip = batteryInfo
    ? ` • ${tk("header.batteryLevel")}: ${batteryInfo.level}%${batteryInfo.charging ? ` (${tk("header.batteryCharging")})` : ""}`
    : "";

  const tooltipText = latencyMs !== null
    ? `${statusLabel} (${latencyMs}ms)${batteryTooltip}`
    : `${statusLabel}${batteryTooltip}`;

  return (
    <header className="app-header sticky top-0 z-[60] h-[var(--header-height)] shrink-0">
      <div className="mx-auto flex h-full items-center gap-2 px-2.5 sm:gap-3 sm:px-4">
        {showMenuButton && onOpenSidebar && (
          <button
            onClick={onOpenSidebar}
            className="btn-icon shrink-0 lg:hidden"
            aria-label={tk("nav.openMenu")}
            title={tk("nav.openMenu")}
          >
            <IconMenu size={17} />
          </button>
        )}

        {/* Brand — emblem always, wordmark from lg up so the row never wraps. */}
        <div className="flex shrink-0 items-center gap-2.5">
          <BrandEmblem size={34} variant="header" />
          <div className="hidden min-w-0 leading-tight lg:block">
            <div className="truncate text-card-title font-extrabold text-text-primary">
              {tk("app.name")}
            </div>
            <div className="tagline truncate">{tk("app.tagline")}</div>
          </div>
        </div>

        <span className="hidden h-7 w-px shrink-0 bg-border-subtle lg:block" aria-hidden="true" />

        {/* Current page — the one piece of context an operator always needs. */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-page-title font-bold text-text-primary">
            {pageTitle}
          </h1>
          {pageHint && (
            <p className="hidden truncate text-label text-text-muted sm:block">{pageHint}</p>
          )}
        </div>

        {/* Search: inline from md up, full-width overlay on phones. */}
        <div className="hidden w-[220px] shrink-0 md:block xl:w-[320px]">
          <GlobalSearch onNavigate={onNavigate} />
        </div>

        <button
          onClick={() => setSearchOpen((v) => !v)}
          className={cn("btn-icon shrink-0 md:hidden", searchOpen && "text-brand")}
          aria-label={tk("common.search")}
          title={tk("common.search")}
        >
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.6-3.6" />
          </svg>
        </button>

        {/* Assistant */}
        <button
          onClick={onOpenAssistant}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-brand/35 px-2.5 text-label-lg font-bold text-brand transition-colors hover:bg-brand hover:text-on-brand"
          title={tk("header.assistantTitle")}
          aria-label={tk("header.assistantTitle")}
        >
          <IconBolt size={15} />
          <span className="hidden sm:inline">{tk("header.assistant")}</span>
        </button>

        {/* Notifications */}
        <button
          onClick={onOpenAlerts}
          className="btn-icon relative shrink-0"
          title={tk("header.notificationsTitle")}
          aria-label={tk("header.notificationsTitle")}
        >
          <IconBell size={16} />
          {unreadAlerts > 0 && (
            <span className="num absolute -top-0.5 -end-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-status-danger px-1 text-micro font-extrabold text-white">
              {unreadAlerts > 99 ? "99+" : unreadAlerts}
            </span>
          )}
        </button>

        {/* Server Connection & Battery Health Indicator */}
        <div
          className={cn(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-1.5 transition-colors",
            batteryInfo
              ? "border border-border-subtle bg-surface-2/60 pe-2 ps-1.5"
              : "justify-center px-1"
          )}
          title={tooltipText}
          aria-label={tooltipText}
        >
          <div className="group relative flex items-center">
            <span
              className={cn(
                "relative inline-flex h-2.5 w-2.5 rounded-full transition-all duration-300",
                connectionStatus === "optimal" && "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.55)]",
                connectionStatus === "fair" && "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.55)]",
                connectionStatus === "offline" && "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.55)]",
                connectionStatus === "checking" && "bg-slate-400 animate-pulse"
              )}
            >
              {connectionStatus === "optimal" && (
                <span className="absolute -inset-0.5 rounded-full bg-emerald-400/30 animate-ping opacity-75" />
              )}
            </span>
          </div>

          {/* Battery level badge when supported by browser */}
          {batteryInfo && (
            <div className="flex items-center gap-1 text-label font-semibold text-text-secondary select-none">
              <span className="h-3 w-px bg-border-subtle" aria-hidden="true" />
              <svg
                width="16"
                height="10"
                viewBox="0 0 20 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={cn(
                  "shrink-0",
                  batteryInfo.level <= 15
                    ? "text-rose-500"
                    : batteryInfo.level <= 30
                      ? "text-amber-500"
                      : "text-emerald-500"
                )}
                aria-hidden="true"
              >
                <rect x="0.75" y="1" width="15.5" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.3" fill="none" opacity="0.65" />
                <path d="M17.5 4.2C18.1 4.4 18.5 4.8 18.5 5.5V6.5C18.5 7.2 18.1 7.6 17.5 7.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.65" />
                {!batteryInfo.charging ? (
                  <rect
                    x="2.5"
                    y="2.5"
                    width={Math.max(1.5, Math.min(12, (batteryInfo.level / 100) * 12))}
                    height="7"
                    rx="1"
                    fill="currentColor"
                  />
                ) : (
                  <path
                    d="M8.5 1.8L5.5 6.2H8L7.5 10.2L11.5 5.8H9L9.5 1.8H8.5Z"
                    fill="currentColor"
                  />
                )}
              </svg>
              <span className="tabular-nums">{batteryInfo.level}%</span>
            </div>
          )}

          <span className="sr-only">{tooltipText}</span>
        </div>

        {/* Account — everything secondary lives inside. */}
        <AccountMenu
          className="shrink-0"
          user={user}
          onOpenSettings={onOpenSettings}
          onOpenAssistant={onOpenAssistant}
          onOpenMobileApp={onOpenMobileApp ?? (() => {})}
          onPreviewLogin={onPreviewLogin}
          onLogout={onLogout}
        />
      </div>

      {/* Phone search overlay — keeps the bar itself uncluttered. */}
      {searchOpen && (
        <div className="animate-fade-in absolute inset-x-0 top-full border-b border-border-subtle bg-surface-1 p-2.5 md:hidden">
          <GlobalSearch
            onNavigate={(view, id) => {
              setSearchOpen(false);
              onNavigate(view, id);
            }}
          />
          <button
            onClick={() => setSearchOpen(false)}
            className="mt-2 w-full rounded-control py-2 text-center text-label-lg font-semibold text-text-muted hover:text-text-primary"
          >
            {tk("common.close")}
          </button>
        </div>
      )}

      {/* Screen-reader / status line: language + direction, without visual noise. */}
      <span className="sr-only" data-lang={lang}>
        {tk("language.current")}
      </span>
    </header>
  );
}
