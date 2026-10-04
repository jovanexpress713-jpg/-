import { useCallback, useEffect, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { apiClient } from "../services/apiClient";
import { IconBell, IconCheck, IconDoc, IconInfo, IconAlertCircle } from "../components/Icons";

/**
 * Shared mobile-app surfaces used by BOTH the driver app and the client app so
 * neither duplicates the other (§27).
 *
 *   • useMobileNotifications — the real notification feed (`/api/notifications`).
 *   • <MobileNotificationsList /> — the «الإشعارات» tab content (§13, §14).
 *   • <MobileSection>, <MobileRow>      — the card/row building blocks of the
 *     current EJAZ mobile design (same radii, borders and spacing).
 */

export interface MobileNotification {
  id: string;
  titleAr?: string;
  titleEn?: string;
  messageAr?: string;
  messageEn?: string;
  type?: string;
  isRead?: boolean;
  createdAt?: string;
}

export function useMobileNotifications() {
  const [notifications, setNotifications] = useState<MobileNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.notifications.getAll();
      setNotifications(res?.notifications || []);
      setUnread(res?.unread ?? (res?.notifications || []).filter((n: MobileNotification) => !n.isRead).length);
      setError(null);
    } catch {
      setError(null);
      setNotifications([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((list) =>
      list.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnread((n) => Math.max(0, n - 1));
    try {
      await apiClient.notifications.markAsRead(id);
    } catch {
      /* the optimistic update already reflects the intent */
    }
  }, []);

  return { notifications, unread, loading, error, reload: load, markAsRead };
}

/** The «الإشعارات» tab — one implementation shared by both mobile apps. */
export function MobileNotificationsList({
  notifications,
  loading,
  onMarkRead,
  onReload,
}: {
  notifications: MobileNotification[];
  loading?: boolean;
  onMarkRead: (id: string) => void;
  onReload?: () => void;
}) {
  const { t, td } = useSettings();

  const titleOf = (n: MobileNotification) =>
    t(n.titleEn || "", n.titleAr || n.titleEn || "");
  const messageOf = (n: MobileNotification) =>
    t(n.messageEn || "", n.messageAr || n.messageEn || "");

  return (
    <div className="px-5 py-4 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-white">
          {t("Notifications", "الإشعارات")}
        </h2>
        {onReload && (
          <button
            onClick={onReload}
            className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/80 hover:bg-white/20"
          >
            {t("Refresh", "تحديث")}
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-[14px] border border-border-subtle bg-surface-1 p-6 text-center text-[11px] text-text-muted">
          {t("Loading…", "جاري التحميل…")}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-[14px] border border-border-subtle bg-surface-1 p-6 text-center">
          <IconBell size={22} className="mx-auto text-text-muted" />
          <p className="mt-2 text-[11.5px] text-text-muted">
            {t("No notifications yet.", "لا توجد إشعارات حتى الآن.")}
          </p>
        </div>
      ) : (
        notifications.map((n) => {
          const kind = (n.type || "INFO").toUpperCase();
          const Icon =
            kind === "SUCCESS" ? IconCheck : kind === "ALERT" ? IconAlertCircle : kind === "WARNING" ? IconAlertCircle : IconInfo;
          return (
            <button
              key={n.id}
              onClick={() => !n.isRead && onMarkRead(n.id)}
              className={cn(
                "w-full rounded-[14px] border p-3 text-start transition-colors",
                n.isRead
                  ? "border-border-subtle bg-surface-1 opacity-75"
                  : "border-brand/40 bg-surface-1",
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full",
                    kind === "SUCCESS"
                      ? "bg-status-active/20 text-status-active"
                      : kind === "ALERT"
                        ? "bg-status-danger/20 text-status-danger"
                        : kind === "WARNING"
                          ? "bg-brand/20 text-brand"
                          : "bg-white/10 text-white/70",
                  )}
                >
                  <Icon size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[12px] font-bold text-white">
                      {titleOf(n)}
                    </span>
                    {!n.isRead && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    )}
                  </div>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-text-muted">
                    {messageOf(n)}
                  </p>
                  {n.createdAt && (
                    <span className="mt-1 block text-[9.5px] text-text-muted/80">
                      {td(new Date(n.createdAt).toLocaleString())}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

/** A titled section card — the shared mobile card primitive. */
export function MobileSection({
  title,
  hint,
  children,
  action,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[12.5px] font-bold text-white">{title}</h3>
          {hint && <p className="mt-0.5 text-[10px] text-text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="rounded-[16px] border border-border-subtle bg-surface-1">{children}</div>
    </section>
  );
}

/** A settings/action row inside a <MobileSection>. */
export function MobileRow({
  icon: Icon,
  label,
  hint,
  value,
  onClick,
  danger,
  trailing,
}: {
  icon?: typeof IconDoc;
  label: string;
  hint?: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
}) {
  const Body = (
    <>
      {Icon && (
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-[10px]",
            danger ? "bg-status-danger/15 text-status-danger" : "bg-brand/12 text-brand",
          )}
        >
          <Icon size={15} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[12px] font-semibold",
            danger ? "text-status-danger" : "text-white",
          )}
        >
          {label}
        </span>
        {hint && <span className="block truncate text-[10px] text-text-muted">{hint}</span>}
      </span>
      {value && (
        <span className="shrink-0 text-[11px] font-semibold text-text-muted">{value}</span>
      )}
      {trailing}
    </>
  );

  if (!onClick) {
    return <div className="flex items-center gap-3 px-3.5 py-3">{Body}</div>;
  }
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3.5 py-3 text-start transition-colors hover:bg-surface-2",
        danger && "hover:bg-status-danger/10",
      )}
    >
      {Body}
    </button>
  );
}
