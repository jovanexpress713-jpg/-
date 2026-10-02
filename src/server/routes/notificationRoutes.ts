import { Router, type Response } from "express";
import { authenticate, optionalAuthenticate, type AuthenticatedRequest } from "../auth/middleware";
import { getNotifications, markAsRead } from "../services/notificationService";

const router = Router();

// GET /api/notifications
router.get("/", optionalAuthenticate, (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role;
  const userId = req.user?.userId;
  const list = getNotifications({ role, userId });
  return res.json({ total: list.length, unread: list.filter((n) => !n.isRead).length, notifications: list });
});

// POST /api/notifications/:id/read
router.post("/:id/read", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const success = markAsRead(String(req.params.id));
  return res.json({ success });
});

export default router;
