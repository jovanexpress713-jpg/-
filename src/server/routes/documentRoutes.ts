import { Router, type Response } from "express";
import { db, type TripDocumentEntity } from "../db";
import { authenticate, requirePermission, type AuthenticatedRequest } from "../auth/middleware";

const router = Router();

// GET /api/documents/:tripId
router.get("/:tripId", authenticate, requirePermission("documents.view"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.tripId);
  const docs = Array.from(db.documents.values()).filter((d) => d.tripId === tripId);
  return res.json({ tripId, documents: docs });
});

// POST /api/documents/:tripId
router.post("/:tripId", authenticate, requirePermission("documents.upload"), (req: AuthenticatedRequest, res: Response) => {
  const tripId = String(req.params.tripId);
  const { documentType, title, fileUrl, fileSizeBytes, mimeType, expiresAt } = req.body;
  if (!documentType || !title) {
    return res.status(400).json({ error: "documentType and title are required" });
  }

  const id = `doc-${Date.now()}`;
  const doc: TripDocumentEntity = {
    id,
    tripId,
    documentType,
    title,
    fileUrl: fileUrl || `/documents/${id}.pdf`,
    fileSizeBytes: Number(fileSizeBytes || 102400),
    mimeType: mimeType || "application/pdf",
    verificationStatus: "VERIFIED",
    uploadedBy: req.user?.userId,
    expiresAt,
    createdAt: new Date().toISOString(),
  };

  db.documents.set(id, doc);
  return res.status(201).json({ message: "Document recorded successfully", document: doc });
});

export default router;
