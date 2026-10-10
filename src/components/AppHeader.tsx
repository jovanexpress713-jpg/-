import { useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { BrandEmblem } from "./Logo";
import { GlobalSearch } from "./GlobalSearch";
import { AccountMenu } from "./AccountMenu";
import type { SettingsTab } from "./SettingsCenter";
import type { SessionUser } from "../utils/permissions";
import { IconSparkles, IconBell, IconMenu } from "./Icons";

/**
 * The operational application bar (§2).
 *
 * Design rules this component is built to keep:
 *   • ONE row, 58px, never wraps — no element can push another out of place.
 *   • Clean and uncluttered: identity, search button, assistant, notifications,
 *     and system/account menu.
 *   • Sticky, frosted, hairline-bottom: it reads as an app chrome, not a
 *     marketing hero.
 */
export function AppHeader({
  user,
  pageTitle: _pageTitle,
  pageHint: _pageHint,
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

  return (
    <header className="app-header sticky top-0 z-[60] h-[var(--header-height)] shrink-0 bg-[#060e1d]/85 backdrop-blur-2xl border-b border-white/[0.08] shadow-[0_4px_24px_-4px_rgba(2,6,23,0.7),inset_0_1px_0_rgba(255,255,255,0.06)] transition-all">
      <div className="mx-auto flex h-full items-center gap-2.5 px-3 sm:gap-3.5 sm:px-5">
        {showMenuButton && onOpenSidebar && (
          <button
            onClick={onOpenSidebar}
            className="btn-icon shrink-0 rounded-inner border border-white/[0.08] bg-surface-2/70 hover:bg-surface-3 hover:text-text-primary backdrop-blur-md lg:hidden"
            aria-label={tk("nav.openMenu")}
            title={tk("nav.openMenu")}
          >
            <IconMenu size={17} />
          </button>
        )}

        {/* Brand — emblem always, wordmark from lg up so the row never wraps. */}
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="relative flex items-center justify-center rounded-inner p-1 bg-gradient-to-br from-brand/25 via-surface-2/85 to-brand/5 border border-brand/35 shadow-sm shadow-brand/20 backdrop-blur-md">
            <BrandEmblem size={32} variant="header" />
          </div>
          <div className="hidden min-w-0 leading-tight lg:block">
            <div className="truncate text-card-title font-extrabold text-text-primary tracking-tight">
              {tk("app.name")}
            </div>
            <div className="tagline truncate text-label font-semibold text-brand-soft">{tk("app.tagline")}</div>
          </div>
        </div>

        <span className="hidden h-6 w-px shrink-0 bg-white/[0.08] lg:block" aria-hidden="true" />

        {/* Spacer to push actions to the end */}
        <div className="min-w-0 flex-1" />

        {/* Assistant */}
        <button
          onClick={onOpenAssistant}
          className="btn-icon relative shrink-0 rounded-full border border-brand/40 bg-gradient-to-br from-brand/20 via-surface-2/80 to-brand/10 text-brand shadow-sm shadow-brand/20 backdrop-blur-md transition-all duration-200 hover:from-brand hover:to-orange-soft hover:text-white hover:shadow-brand/40 hover:border-brand active:scale-95 group"
          title={tk("header.assistantTitle")}
          aria-label={tk("header.assistantTitle")}
        >
          <IconSparkles size={17} className="transition-transform duration-200 group-hover:scale-110" />
        </button>

        {/* Search — placed next to notifications */}
        <button
          onClick={() => setSearchOpen((v) => !v)}
          className={cn(
            "btn-icon relative shrink-0 rounded-full border border-white/[0.08] bg-surface-2/70 hover:bg-surface-3 hover:text-text-primary hover:border-brand/40 backdrop-blur-md transition-all active:scale-95",
            searchOpen && "text-brand border-brand/50 bg-brand/10"
          )}
          aria-label={tk("common.search")}
          title={tk("common.search")}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.6-3.6" />
          </svg>
        </button>

        {/* Notifications */}
        <button
          onClick={onOpenAlerts}
          className="btn-icon relative shrink-0 rounded-full border border-white/[0.08] bg-surface-2/70 hover:bg-surface-3 hover:text-text-primary hover:border-brand/40 backdrop-blur-md transition-all active:scale-95"
          title={tk("header.notificationsTitle")}
          aria-label={tk("header.notificationsTitle")}
        >
          <IconBell size={16} />
          {unreadAlerts > 0 && (
            <span className="num absolute -top-1 -end-1 grid h-4 min-w-4 place-items-center rounded-full bg-status-danger px-1 text-micro font-extrabold text-white ring-2 ring-surface-0 shadow-sm animate-pulse">
              {unreadAlerts > 99 ? "99+" : unreadAlerts}
            </span>
          )}
        </button>

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

      {/* Search overlay popup — keeps the bar itself uncluttered and clean */}
      {searchOpen && (
        <div className="animate-fade-in absolute inset-x-0 top-full border-b border-white/[0.08] bg-[#060e1d]/95 backdrop-blur-2xl p-2.5 shadow-2xl">
          <div className="max-w-2xl mx-auto">
            <GlobalSearch
              onNavigate={(view, id) => {
                setSearchOpen(false);
                onNavigate(view, id);
              }}
            />
            <button
              onClick={() => setSearchOpen(false)}
              className="mt-2 w-full rounded-control py-1.5 text-center text-label-lg font-semibold text-text-muted hover:text-text-primary"
            >
              {tk("common.close")}
            </button>
          </div>
        </div>
      )}

      {/* Screen-reader / status line: language + direction, without visual noise. */}
      <span className="sr-only" data-lang={lang}>
        {tk("language.current")}
      </span>
    </header>
  );
}
