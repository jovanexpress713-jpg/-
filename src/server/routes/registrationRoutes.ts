import { Router, type Response } from "express";
import {
  authenticate,
  hasPermission,
  requirePermission,
  type AuthenticatedRequest,
} from "../auth/middleware";
import {
  REGISTRATION_DOCUMENTS,
  REGISTRATION_FIELDS,
  REGISTRATION_STATUS_AR,
  REGISTRATION_TYPES,
  decideRequest,
  getRegistrationDocumentFile,
  getRequest,
  getRequestForUser,
  listRequests,
  resubmitRegistration,
  statusForUser,
  submitRegistration,
  validateSubmission,
  type RegistrationType,
} from "../services/registrationService";

/**
 * EJAZ Transport — Registration request endpoints.
 *
 *  applicant   POST   /api/registrations                 submit (or save a draft)
 *  applicant   GET    /api/registrations/me              follow up on your own request
 *  applicant   POST   /api/registrations/me/resubmit     complete and re-send after review
 *  admin       GET    /api/registrations                 the review queue
 *  admin       GET    /api/registrations/:id             one request with all data + documents
 *  admin       POST   /api/registrations/:id/decision    APPROVE | NEEDS_COMPLETION | REJECT
 *
 * Creating an account is a REQUEST; only an administration decision activates it.
 */

const router = Router();

const REVIEW_PERMISSIONS = ["registrations.review", "settings.manage"];

function handleError(res: Response, err: any) {
  const status = err?.status || 500;
  return res.status(status).json({ error: err?.message || "Registration service error", code: err?.code });
}

/** The form contract (fields + required documents) for both account types. */
router.get("/schema", (_req, res: Response) => {
  return res.json({
    types: REGISTRATION_TYPES,
    fields: REGISTRATION_FIELDS,
    documents: REGISTRATION_DOCUMENTS,
    statuses: REGISTRATION_STATUS_AR,
  });
});

/** Public submission — no session required. */
router.post("/", (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, fields, password, documents, submit } = req.body || {};
    if (!type) return res.status(400).json({ error: "نوع الطلب مطلوب (DRIVER أو CUSTOMER)" });
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: "كلمة المرور مطلوبة (٨ أحرف على الأقل)" });
    }

    const result = submitRegistration({
      type: type as RegistrationType,
      fields: fields || {},
      password: String(password),
      documents: documents || [],
      submit: submit !== false,
    });

    if (submit !== false && !result.validation.complete) {
      return res.status(422).json({
        error: "البيانات غير مكتملة",
        code: "INCOMPLETE_SUBMISSION",
        validation: result.validation,
        request: result.request,
      });
    }

    return res.status(201).json({
      request: result.request,
      validation: result.validation,
      accountCreated: result.accountCreated,
      status: result.request.status,
      statusAr: REGISTRATION_STATUS_AR[result.request.status],
      messageAr:
        result.request.status === "PENDING_REVIEW"
          ? "تم استلام طلبك بنجاح، وسيتم مراجعته من الإدارة. سنقوم بإشعارك عند الانتهاء من المراجعة."
          : "تم حفظ الطلب كمسودة.",
    });
  } catch (err) {
    return handleError(res, err);
  }
});

/** Validation preview — tells the applicant exactly what is still missing. */
router.post("/validate", (req: AuthenticatedRequest, res: Response) => {
  const { type, fields, documents } = req.body || {};
  if (!REGISTRATION_TYPES.includes(type)) {
    return res.status(400).json({ error: "نوع الطلب غير مدعوم" });
  }
  return res.json(validateSubmission(type, fields || {}, documents || []));
});

/** The applicant's own status — available as soon as the account exists. */
router.get("/me", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const status = statusForUser({ userId: req.user?.userId, email: req.user?.email });
  if (!status) return res.status(404).json({ error: "لا يوجد طلب تسجيل لهذا الحساب", code: "NO_REQUEST" });
  return res.json(status);
});

/** The applicant completes the missing items and re-sends the request. */
router.post("/me/resubmit", authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const own = getRequestForUser(req.user?.userId, req.user?.email);
    if (!own) return res.status(404).json({ error: "لا يوجد طلب تسجيل لهذا الحساب", code: "NO_REQUEST" });

    const { fields, documents } = req.body || {};
    const result = resubmitRegistration(
      own.id,
      { fields: fields || {}, documents: documents || [] },
      { userId: req.user?.userId, email: req.user?.email }
    );

    if (!result.validation.complete) {
      return res.status(422).json({
        error: "لا يزال هناك بيانات ناقصة",
        code: "INCOMPLETE_SUBMISSION",
        validation: result.validation,
        request: result.request,
      });
    }

    return res.json({
      request: result.request,
      validation: result.validation,
      status: result.request.status,
      statusAr: REGISTRATION_STATUS_AR[result.request.status],
      messageAr: "تم إعادة إرسال طلبك إلى الإدارة للمراجعة.",
    });
  } catch (err) {
    return handleError(res, err);
  }
});

/**
 * Read a document only for the applicant who uploaded it or an authorized
 * reviewer. These files are stored outside the public static upload root.
 */
router.get("/:id/documents/:documentId", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const request = getRequest(String(req.params.id));
  if (!request) return res.status(404).json({ error: "طلب التسجيل غير موجود", code: "NOT_FOUND" });

  const isOwner = request.userId === req.user?.userId;
  const isReviewer = hasPermission(req.user?.role, "registrations.review") || hasPermission(req.user?.role, "settings.manage");
  if (!isOwner && !isReviewer) {
    return res.status(403).json({ error: "لا تملك صلاحية الوصول إلى هذا المستند", code: "FORBIDDEN" });
  }

  const file = getRegistrationDocumentFile(String(req.params.id), String(req.params.documentId));
  if (!file) return res.status(404).json({ error: "المستند غير موجود", code: "DOCUMENT_NOT_FOUND" });

  const safeName = file.fileName.replace(/[\\r\\n"\\\\]/g, "_");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
  res.type(file.mimeType);
  return res.sendFile(file.filePath);
});

/** Review queue for the control room. */
router.get("/", authenticate, requirePermission(...REVIEW_PERMISSIONS), (req: AuthenticatedRequest, res: Response) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const type = req.query.type ? String(req.query.type) : undefined;
  const requests = listRequests({ status, type });
  return res.json({
    total: requests.length,
    pending: requests.filter((r) => r.status === "PENDING_REVIEW").length,
    needsCompletion: requests.filter((r) => r.status === "NEEDS_COMPLETION").length,
    approved: requests.filter((r) => r.status === "APPROVED").length,
    rejected: requests.filter((r) => r.status === "REJECTED").length,
    requests,
  });
});

router.get("/:id", authenticate, requirePermission(...REVIEW_PERMISSIONS), (req: AuthenticatedRequest, res: Response) => {
  const request = getRequest(String(req.params.id));
  if (!request) return res.status(404).json({ error: "طلب التسجيل غير موجود", code: "NOT_FOUND" });
  return res.json({
    request,
    history: request.history,
    statusAr: REGISTRATION_STATUS_AR[request.status],
  });
});

/** The administration decision. Rejection and completion requests need a reason. */
router.post(
  "/:id/decision",
  authenticate,
  requirePermission(...REVIEW_PERMISSIONS),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const { action, reason, missingItems } = req.body || {};
      const normalized = String(action || "").toUpperCase();
      if (!["APPROVE", "NEEDS_COMPLETION", "REJECT"].includes(normalized)) {
        return res.status(400).json({ error: "إجراء غير معروف. استخدم APPROVE أو NEEDS_COMPLETION أو REJECT" });
      }

      const request = decideRequest(String(req.params.id), {
        action: normalized as any,
        reason,
        missingItems: Array.isArray(missingItems) ? missingItems : undefined,
        reviewer: { id: req.user?.userId, name: req.user?.fullName, role: req.user?.role },
      });

      return res.json({
        request,
        status: request.status,
        statusAr: REGISTRATION_STATUS_AR[request.status],
        history: request.history,
      });
    } catch (err) {
      return handleError(res, err);
    }
  }
);

export default router;
