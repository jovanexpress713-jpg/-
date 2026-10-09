import type { ReactElement } from "react";
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

export function Sidebar({ active, onSelect, counts, onCreate }: Props) {
  const { t, tk } = useSettings();
  const { pageVisible, can } = usePermissions();
  const current = KEY_ALIAS[active] ?? active;

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
      <div className="mb-1">
        {heading(tk(labelKey))}
        <div className="space-y-0.5">{visible}</div>
        <div className="my-3 border-t border-border-subtle" />
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
        className={cn("nav-item w-full", isActive && "nav-item-on")}
      >
        <Icon size={17} />
        <span className="flex-1 text-start">{label}</span>
        {opts.modal && !isActive && (
          <span
            aria-hidden="true"
            title={tk("nav.opensWindow")}
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted/60"
          />
        )}
        {typeof opts.count === "number" && (
          <span className={cn("badge", isActive ? "bg-white/20 text-on-orange" : "badge-brand")}>
            {opts.count}
          </span>
        )}
      </button>
    );
  };

  const heading = (label: string) => (
    <div className="label-sm px-3 pt-4 pb-1.5 first:pt-0 uppercase">{label}</div>
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
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-e border-border-subtle bg-surface-1 px-3 py-4">
      {/* Compact identity block — the header carries the full brand lockup. */}
      <div className="flex items-center gap-2.5 px-2">
        <BrandEmblem size={28} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-body font-extrabold text-text-primary">
            {tk("app.name")}
          </div>
          <div className="tagline truncate">{tk("app.tagline")}</div>
        </div>
      </div>

      <nav className="scroll-thin mt-5 flex-1 overflow-y-auto px-1 pb-2">
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
      <div className="mt-3 shrink-0 space-y-2 border-t border-border-subtle pt-3">
        <div className="flex items-center justify-between gap-1 px-1">
          <span className="label-sm">{tk("nav.quickCreate")}</span>
          <div className="flex items-center gap-1">
            {QUICK_VISIBLE.map(({ kind, label, icon: Icon }) => (
              <button
                key={kind}
                title={label}
                aria-label={label}
                onClick={() => onCreate(kind)}
                className="btn-icon-sm"
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onCreate(QUICK_VISIBLE[0].kind)}
          className="group flex w-full items-center gap-3 rounded-panel border-[1.5px] border-dashed border-brand bg-brand/5 p-3 text-start transition-[background-color,border-color,transform] duration-200 hover:bg-brand/10 active:scale-[0.98]"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-on-brand transition-transform duration-300 group-hover:rotate-90">
            <IconPlus size={18} />
          </span>
          <span className="min-w-0">
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
