import { Router, type Response } from "express";
import { authenticate, requirePermission, type AuthenticatedRequest } from "../auth/middleware";
import { getNotifications, markAsRead } from "../services/notificationService";

const router = Router();

// GET /api/notifications
router.get("/", authenticate, requirePermission("notifications.view"), (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role;
  const userId = req.user?.userId;
  const list = getNotifications({ role, userId });
  return res.json({ total: list.length, unread: list.filter((n) => !n.isRead).length, notifications: list });
});

// POST /api/notifications/:id/read
router.post("/:id/read", authenticate, requirePermission("notifications.view"), (req: AuthenticatedRequest, res: Response) => {
  const notificationId = String(req.params.id);
  const visible = getNotifications({ role: req.user?.role, userId: req.user?.userId });
  if (!visible.some((n) => n.id === notificationId)) {
    return res.status(404).json({ error: "Notification not found", code: "NOT_FOUND" });
  }

  const success = markAsRead(notificationId);
  return res.json({ success });
});

export default router;
