import { Router, type Response } from "express";
import { authenticate, requireRole, type AuthenticatedRequest } from "../auth/middleware";
import { getAuditLogs } from "../services/auditService";

const router = Router();

// GET /api/audit
router.get("/", authenticate, requireRole("SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER"), (req: AuthenticatedRequest, res: Response) => {
  const { entity, entityId, tripId, limit } = req.query;
  const logs = getAuditLogs({
    entity: typeof entity === "string" ? entity : undefined,
    entityId: typeof entityId === "string" ? entityId : undefined,
    tripId: typeof tripId === "string" ? tripId : undefined,
    limit: limit ? Number(limit) : 100,
  });

  return res.json({ total: logs.length, logs });
});

export default router;
