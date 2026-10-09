import { useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { BrandEmblem } from "./Logo";
import { GlobalSearch } from "./GlobalSearch";
import { AccountMenu } from "./AccountMenu";
import type { SettingsTab } from "./SettingsCenter";
import type { SessionUser } from "../utils/permissions";
import { IconBolt, IconBell, IconMenu } from "./Icons";

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
