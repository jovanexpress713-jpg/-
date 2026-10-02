/**
 * EJAZ Transport — Operational Notification Service
 */

export interface SystemNotification {
  id: string;
  userId?: string;
  targetRole?: string;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  type: "INFO" | "WARNING" | "ALERT" | "SUCCESS";
  entityType?: string;
  entityId?: string;
  tripId?: string;
  isRead: boolean;
  createdAt: string;
}

const notificationsStore: SystemNotification[] = [];

export function dispatchNotification(params: Omit<SystemNotification, "id" | "isRead" | "createdAt">): SystemNotification {
  const notification: SystemNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...params,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  notificationsStore.unshift(notification);

  if (notificationsStore.length > 500) {
    notificationsStore.pop();
  }

  return notification;
}

export function getNotifications(filter?: { role?: string; userId?: string; unreadOnly?: boolean }): SystemNotification[] {
  let list = notificationsStore;
  if (filter?.role) {
    list = list.filter((n) => !n.targetRole || n.targetRole === filter.role || n.targetRole === "ALL");
  }
  if (filter?.userId) {
    list = list.filter((n) => !n.userId || n.userId === filter.userId);
  }
  if (filter?.unreadOnly) {
    list = list.filter((n) => !n.isRead);
  }
  return list;
}

export function markAsRead(notificationId: string): boolean {
  const notif = notificationsStore.find((n) => n.id === notificationId);
  if (notif) {
    notif.isRead = true;
    return true;
  }
  return false;
}
