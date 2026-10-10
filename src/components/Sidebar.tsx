import { useState, type ReactElement } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { BrandEmblem } from "./Logo";
import {
  IconAnalysis,
  IconCargo,
  IconChat,
  IconDashboard,
  IconDriver,
  IconHistory,
  IconPlus,
  IconRepair,
  IconReport,
  IconRequests,
  IconTracking,
  IconTruck,
  IconBolt,
  IconLayers,
  IconDoc,
  IconTag,
  IconChevron,
} from "./Icons";
import type { RequestKind } from "../data/types";
import { usePermissions } from "../state/permissionStore";

export interface NavCounts {
  trucks: number;
  cargos: number;
  repair: number;
  drivers: number;
  reports: number;
}

interface Props {
  active: string;
  onSelect: (key: string) => void;
  counts: NavCounts;
  onCreate: (kind: RequestKind) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

/**
 * Sidebar — grouped navigation (§24).
 *
 * Labels resolve through the central i18n keys, so an English session shows
 * "Trips / Shipments / Live Map" and an Urdu session shows "ٹرپس / کھیپ / لائیو
 * نقشہ" with no per-component string tables. "Settings" now opens the settings
 * center (the same panel the account menu reaches) instead of being a dead end.
 */

/** Legacy keys the console can still hold — highlight their parent instead. */
const KEY_ALIAS: Record<string, string> = {
  trucks: "fleet",
  repair: "fleet",
  cargos: "shipments",
  dashboard: "operations",
};

export function Sidebar({
  active,
  onSelect,
  counts,
  onCreate,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: Props) {
  const { t, tk } = useSettings();
  const { pageVisible, can } = usePermissions();
  const current = KEY_ALIAS[active] ?? active;
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const toggleCollapse = onToggleCollapse ?? (() => setInternalCollapsed((v) => !v));

  /**
   * Navigation gate. Tool entries (assistant, alerts, settings) are gated by
   * their own capability; page entries by the page permission from the registry.
   */
  const isNavAllowed = (key: string): boolean => {
    switch (key) {
      case "ai":
        return can("assistant.act") || can("notifications.view");
      case "alerts":
        return can("notifications.view");
      case "settings":
        return true; // the account menu must always stay reachable
      case "branding":
        return can("branding.manage");
      case "permissions":
        return can("permissions.manage");
      case "finance":
        return pageVisible("finance") || can("finance.view") || can("invoices.view") || can("settlements.view");
      default:
        return pageVisible(key);
    }
  };

  /** Renders a labelled group, and nothing at all when every row is hidden. */
  const group = (labelKey: Parameters<typeof tk>[0], rows: (ReactElement | null)[]) => {
    const visible = rows.filter(Boolean);
    if (!visible.length) return null;
    return (
      <div className="mb-2">
        {isCollapsed ? (
          <div className="my-1.5 border-t border-white/[0.06]" />
        ) : (
          heading(tk(labelKey))
        )}
        <div className="space-y-1">{visible}</div>
        {!isCollapsed && <div className="my-2 border-t border-white/[0.06]" />}
      </div>
    );
  };

  /**
   * A row the role may not see is not rendered at all — the item simply does not
   * exist in this user's navigation, which is the whole point: nobody is ever
   * shown a page only to be told they lack access to it.
   */
  const row = (
    key: string,
    label: string,
    Icon: typeof IconTruck,
    opts: { count?: number; modal?: boolean } = {},
  ) => {
    if (!isNavAllowed(key)) return null;
    const isActive = current === key;
    return (
      <button
        key={key}
        onClick={() => onSelect(key)}
        aria-current={isActive ? "page" : undefined}
        title={isCollapsed ? label : undefined}
        className={cn(
          "nav-item relative w-full rounded-inner transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/80",
          isActive
            ? "nav-item-on shadow-lg shadow-brand/25 font-bold border border-brand/50 ring-1 ring-brand/30"
            : "hover:bg-white/[0.06] text-text-secondary hover:text-text-primary border border-transparent hover:border-white/[0.04]",
          isCollapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
        )}
      >
        {/* Subtle glowing indicator on active item when expanded */}
        {isActive && !isCollapsed && (
          <span className="absolute start-1 top-2.5 bottom-2.5 w-1 rounded-full bg-white/80 shadow-sm" aria-hidden="true" />
        )}
        <span
          className={cn(
            "shrink-0 transition-transform duration-200 group-hover:scale-110",
            isActive ? "text-on-orange" : "text-text-secondary group-hover:text-brand"
          )}
        >
          <Icon size={18} />
        </span>
        <span className={cn("text-start transition-all duration-200", isCollapsed ? "sr-only" : "flex-1 truncate")}>
          {label}
        </span>
        {opts.modal && !isActive && !isCollapsed && (
          <span
            aria-hidden="true"
            title={tk("nav.opensWindow")}
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted/50"
          />
        )}
        {typeof opts.count === "number" && (
          isCollapsed ? (
            <span
              className={cn(
                "absolute top-1.5 end-1.5 h-2 w-2 min-w-0 p-0 rounded-full",
                isActive ? "bg-white" : "bg-brand animate-pulse"
              )}
              title={`${label}: ${opts.count}`}
            />
          ) : (
            <span className={cn("badge", isActive ? "bg-white/20 text-on-orange" : "badge-brand")}>
              {opts.count}
            </span>
          )
        )}
      </button>
    );
  };

  const heading = (label: string) => (
    <div className="label-sm px-2.5 pt-3 pb-1 first:pt-1 uppercase tracking-wider font-extrabold text-text-muted/80">
      {label}
    </div>
  );

  const QUICK: { kind: RequestKind; label: string; icon: typeof IconTruck }[] = [
    { kind: "truck", label: t("Truck", "شاحنة"), icon: IconTruck },
    { kind: "cargo", label: t("Cargo", "شحنة"), icon: IconCargo },
    { kind: "repair", label: t("Repair", "صيانة"), icon: IconRepair },
    { kind: "driver", label: t("Driver", "سائق"), icon: IconDriver },
    { kind: "report", label: t("Report", "تقرير"), icon: IconReport },
  ];

  /** Each shortcut is gated by the capability that actually performs it. */
  const QUICK_CREATE_PERM: Record<RequestKind, string> = {
    truck: "vehicles.create",
    cargo: "trips.create",
    repair: "vehicles.edit",
    driver: "drivers.create",
    report: "reports.view",
  };
  const QUICK_VISIBLE = QUICK.filter((q) => can(QUICK_CREATE_PERM[q.kind]));

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col rounded-panel bg-[#071328]/92 backdrop-blur-2xl border border-white/[0.08] shadow-[0_12px_40px_rgba(2,6,23,0.75),inset_0_1px_0_rgba(255,255,255,0.06)] px-2.5 py-3.5 transition-all duration-300 ease-in-out select-none",
        isCollapsed ? "w-[72px]" : "w-[264px]"
      )}
    >
      {/* Brand & Collapse Header */}
      <div className="flex items-center justify-between gap-2 px-1 pb-3 border-b border-white/[0.06]">
        <div className={cn("flex items-center gap-2.5 min-w-0 transition-all", isCollapsed && "justify-center w-full")}>
          <div className="relative flex items-center justify-center p-1 rounded-inner bg-gradient-to-br from-brand/20 via-surface-2/80 to-brand/5 border border-brand/35 shadow-sm shadow-brand/15 backdrop-blur-md">
            <BrandEmblem size={28} />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-body font-extrabold text-text-primary">
                {tk("app.name")}
              </div>
              <div className="tagline truncate text-label text-brand-soft font-semibold">{tk("app.tagline")}</div>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <button
            onClick={toggleCollapse}
            className="btn-icon-sm rounded-inner text-text-muted hover:text-text-primary hover:bg-white/[0.08] border border-transparent hover:border-white/[0.06] transition-colors shrink-0"
            title={t("Collapse menu", "طي القائمة")}
            aria-label={t("Collapse menu", "طي القائمة")}
          >
            <IconChevron size={14} className="rtl:rotate-90 ltr:-rotate-90" />
          </button>
        )}
      </div>

      {isCollapsed && (
        <div className="pt-2 pb-1 flex justify-center">
          <button
            onClick={toggleCollapse}
            className="btn-icon-sm rounded-inner text-text-muted hover:text-brand hover:bg-brand/10 border border-transparent hover:border-brand/25 transition-colors"
            title={t("Expand menu", "توسيع القائمة")}
            aria-label={t("Expand menu", "توسيع القائمة")}
          >
            <IconChevron size={14} className="rtl:-rotate-90 ltr:rotate-90" />
          </button>
        </div>
      )}

      <nav className="scroll-thin mt-2 flex-1 overflow-y-auto overflow-x-hidden px-0.5 pb-2">
        {/* Operations */}
        {group("nav.operations", [
          row("overview", tk("nav.overview"), IconAnalysis),
          row("operations", tk("nav.operationsCenter"), IconDashboard),
          row("trips", tk("nav.trips"), IconTruck),
          row("shipments", tk("nav.shipments"), IconCargo, { count: counts.cargos }),
          row("tariffs", tk("nav.tariffs"), IconTag),
          row("tracking", tk("nav.tracking"), IconTracking),
          row("chats", tk("nav.chats"), IconChat),
        ])}

        {/* Fleet */}
        {group("nav.fleetGroup", [
          row("fleet", tk("nav.fleet"), IconTruck, { count: counts.trucks }),
          row("vehicle-assets", tk("nav.vehicleAssets"), IconLayers),
          row("drivers", tk("nav.drivers"), IconDriver, { count: counts.drivers }),
          row("customers", tk("nav.customers"), IconDoc),
          row("registrations", tk("nav.registrations"), IconRequests),
        ])}

        {/* Finance & insights — financial surfaces are gated separately from
            operational ones, so a role can run trips without seeing money. */}
        {group("nav.insights", [
          row("finance", tk("nav.finance"), IconReport),
          row("reports", tk("nav.reports"), IconReport, { count: counts.reports }),
          row("analysis", tk("nav.analysis"), IconAnalysis),
          row("history", tk("nav.history"), IconHistory),
        ])}

        {/* Identity & tools */}
        {group("nav.identity", [
          row("permissions", tk("settings.systemRoles"), IconDoc),
          row("settings", tk("nav.settings"), IconDoc, { modal: true }),
          row("branding", tk("nav.branding"), IconLayers, { modal: true }),
          row("alerts", tk("nav.alerts"), IconBolt, { modal: true }),
          row("ai", tk("nav.ai"), IconBolt, { modal: true }),
        ])}
      </nav>

      {/* Quick create — offers only what this role may actually create. */}
      {QUICK_VISIBLE.length > 0 && (
      <div className="mt-2 shrink-0 space-y-2 border-t border-white/[0.06] pt-2.5">
        {!isCollapsed && (
          <div className="flex items-center justify-between gap-1 px-1">
            <span className="label-sm font-bold text-text-muted">{tk("nav.quickCreate")}</span>
            <div className="flex items-center gap-1">
              {QUICK_VISIBLE.map(({ kind, label, icon: Icon }) => (
                <button
                  key={kind}
                  title={label}
                  aria-label={label}
                  onClick={() => onCreate(kind)}
                  className="btn-icon-sm rounded-inner hover:bg-white/[0.08] text-text-secondary hover:text-text-primary transition-colors"
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => onCreate(QUICK_VISIBLE[0].kind)}
          title={isCollapsed ? tk("nav.createRequest") : undefined}
          aria-label={tk("nav.createRequest")}
          className={cn(
            "group flex items-center justify-center rounded-panel border-[1.5px] border-dashed border-brand bg-brand/5 backdrop-blur-sm transition-[background-color,border-color,transform,box-shadow] duration-200 hover:bg-brand/10 hover:shadow-md hover:shadow-brand/10 active:scale-[0.98]",
            isCollapsed ? "h-11 w-11 mx-auto p-0" : "w-full gap-3 p-3 text-start"
          )}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-on-brand transition-transform duration-300 group-hover:rotate-90 shadow-md shadow-brand/25">
            <IconPlus size={18} />
          </span>
          <span className={cn("min-w-0", isCollapsed ? "sr-only" : "block")}>
            <span className="block truncate text-body font-semibold text-brand">
              {tk("nav.createRequest")}
            </span>
            <span className="block truncate text-label text-text-muted">
              {tk("nav.createHint")}
            </span>
          </span>
        </button>
      </div>
      )}
    </aside>
  );
}
