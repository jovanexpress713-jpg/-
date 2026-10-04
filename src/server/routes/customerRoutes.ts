import { Router, type Response } from "express";
import { db } from "../db";
import { authenticate, requirePermission, type AuthenticatedRequest } from "../auth/middleware";
import { REGISTRATION_STATUS_AR, submitRegistration } from "../services/registrationService";

const router = Router();

// GET /api/customers
router.get("/", authenticate, requirePermission("customers.view"), (_req: AuthenticatedRequest, res: Response) => {
  const list = Array.from(db.customers.values());
  return res.json({ total: list.length, customers: list });
});

/**
 * POST /api/customers — «إضافة عميل جديد» (§18).
 *
 * Guarded by the CREATE_CUSTOMER capability (`customers.create`, or the broader
 * `customers.manage`): the permission is enforced in the API, not just by
 * hiding the button (§31). The submission reuses the registration pipeline —
 * duplicate phone / e-mail / commercial registration are rejected (§19) and the
 * request is reviewed in the control room before activation (§20-21).
 */
router.post("/", authenticate, requirePermission("customers.create", "customers.manage"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name, contactPerson, fullName, companyName, phone, email,
      commercialReg, vatNumber, city, address, password, fields: extraFields, documents,
    } = req.body || {};
    const contact = fullName || contactPerson || "";
    const company = companyName || name || "";
    if (!company || !phone) {
      return res.status(400).json({ error: "Customer name and phone are required", code: "MISSING_FIELDS" });
    }
    const accountPassword = String(password || "");
    if (accountPassword.length < 8) {
      return res.status(400).json({
        error: "كلمة المرور مطلوبة لإنشاء حساب العميل (٨ أحرف على الأقل)",
        code: "PASSWORD_REQUIRED",
      });
    }

    const result = submitRegistration({
      type: "CUSTOMER",
      fields: {
        fullName: contact,
        companyName: company,
        phone,
        email: email || "",
        commercialReg: commercialReg || "",
        vatNumber: vatNumber || "",
        city: city || "",
        address: address || "",
        ...(extraFields && typeof extraFields === "object" ? extraFields : {}),
      },
      password: accountPassword,
      documents: Array.isArray(documents) ? documents : [],
      submit: true,
      submittedBy: { id: req.user?.userId, name: req.user?.fullName, role: req.user?.role },
    });

    if (!result.validation.complete) {
      return res.status(422).json({
        error: "البيانات غير مكتملة",
        code: "INCOMPLETE_SUBMISSION",
        validation: result.validation,
        request: result.request,
      });
    }

    return res.status(201).json({
      message: "Customer request submitted — جاري معالجة الطلب",
      messageAr: "تم إرسال طلب إضافة العميل بنجاح. الحالة: جاري معالجة الطلب، وسيظهر في لوحة التحكم للمراجعة.",
      status: result.request.status,
      statusAr: REGISTRATION_STATUS_AR[result.request.status],
      request: result.request,
      accountCreated: result.accountCreated,
    });
  } catch (err: any) {
    const status = err?.status || 500;
    return res.status(status).json({ error: err?.message || "Customer creation failed", code: err?.code });
  }
});

export default router;
