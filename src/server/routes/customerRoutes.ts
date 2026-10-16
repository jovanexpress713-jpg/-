import { Router, type Response } from "express";
import { db } from "../db";
import {
  authenticate,
  canAccessRegionalEntity,
  canAccessTrip,
  denyRegionalAccess,
  filterRegionalEntities,
  getRepresentativeRegionId,
  requirePermission,
  requireRepresentativeRegionAssignment,
  type AuthenticatedRequest,
} from "../auth/middleware";
import { getCityRegionId, normalizeRegionId } from "../services/cityRegistry";
import { REGISTRATION_STATUS_AR, submitRegistration } from "../services/registrationService";

const router = Router();

router.use(authenticate, requireRepresentativeRegionAssignment("customers"));
router.param("id", (req: AuthenticatedRequest, res: Response, next, rawId) => {
  if (req.user?.role !== "REPRESENTATIVE") return next();
  const customer = db.customers.get(String(rawId));
  if (!customer) return next();
  if (!canAccessRegionalEntity(req.user, "customers", customer)) {
    return denyRegionalAccess(req, res, {
      resource: "customers",
      entityId: customer.id,
      targetRegionId: customer.regionId,
      reason: "Representative attempted to read or mutate a customer outside the database-assigned region",
    });
  }
  return next();
});

// GET /api/customers
router.get("/", authenticate, requirePermission("customers.view"), (req: AuthenticatedRequest, res: Response) => {
  const list = filterRegionalEntities(req.user, "customers", Array.from(db.customers.values()));
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
    const requestedCity = String(city || (extraFields as any)?.city || "").trim();
    const isRepresentative = req.user?.role === "REPRESENTATIVE";
    const representativeRegionId = isRepresentative ? getRepresentativeRegionId(req.user) : null;
    if (isRepresentative && !representativeRegionId) {
      return denyRegionalAccess(req, res, {
        resource: "customers",
        entityId: "new",
        reason: "Representative attempted customer creation without a valid database region assignment",
      });
    }
    const assignedRegionId =
      representativeRegionId ||
      normalizeRegionId(req.body?.regionId ?? req.body?.region) ||
      getCityRegionId(requestedCity || "الرياض");
    if (isRepresentative && requestedCity) {
      const cityRegionId = getCityRegionId(requestedCity);
      if (!cityRegionId || cityRegionId !== representativeRegionId) {
        return denyRegionalAccess(req, res, {
          resource: "customers",
          entityId: "new",
          targetRegionId: cityRegionId,
          reason: "Representative attempted to create a customer record outside the assigned region",
        });
      }
    }
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
      assignedRegionId: assignedRegionId || undefined,
      fields: {
        ...(extraFields && typeof extraFields === "object" ? extraFields : {}),
        fullName: contact,
        companyName: company,
        phone,
        email: email || "",
        commercialReg: commercialReg || "",
        vatNumber: vatNumber || "",
        city: requestedCity,
        address: address || "",
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

    // Direct active customer creation for administrative staff and authorized representatives
    let directCustomer = null;
    if (
      req.body?.direct !== false &&
      (req.body?.direct ||
        req.user?.role === "REPRESENTATIVE" ||
        ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER"].includes(req.user?.role || ""))
    ) {
      const custId = `cust-${Date.now()}`;
      directCustomer = {
        id: custId,
        name: company,
        contactPerson: contact,
        phone,
        email: email || "",
        commercialReg: commercialReg || "",
        vatNumber: vatNumber || "",
        city: requestedCity || "الرياض",
        address: address || "",
        regionId: assignedRegionId || undefined,
      };
      db.customers.set(custId, directCustomer);
    }

    return res.status(201).json({
      message: "Customer created / request submitted",
      messageAr: "تم تسجيل العميل بنجاح وإدراجه في قائمة العملاء المعتمدين.",
      status: result.request.status,
      statusAr: REGISTRATION_STATUS_AR[result.request.status],
      request: result.request,
      accountCreated: result.accountCreated,
      customer: directCustomer,
    });
  } catch (err: any) {
    const status = err?.status || 500;
    return res.status(status).json({ error: err?.message || "Customer creation failed", code: err?.code });
  }
});

// GET /api/customers/:id
router.get("/:id", authenticate, requirePermission("customers.view"), (req: AuthenticatedRequest, res: Response) => {
  const customer = db.customers.get(String(req.params.id));
  if (!customer) {
    return res.status(404).json({ error: "Customer not found", errorAr: "العميل غير موجود" });
  }
  const customerTrips = Array.from(db.trips.values()).filter(
    (trip) =>
      trip.customerId === customer.id &&
      (req.user?.role !== "REPRESENTATIVE" || canAccessTrip(req.user, trip))
  );
  return res.json({
    customer,
    totalTrips: customerTrips.length,
    activeTrips: customerTrips.filter((t) => !["DELIVERED", "POD_CONFIRMED", "SETTLED", "CANCELLED"].includes(t.status)).length,
    recentTrips: customerTrips.slice(0, 10),
  });
});

// PATCH /api/customers/:id — update customer details
router.patch("/:id", authenticate, requirePermission("customers.edit", "customers.create", "customers.manage"), (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const customer = db.customers.get(id);
  if (!customer) {
    return res.status(404).json({ error: "Customer not found", errorAr: "العميل غير موجود" });
  }

  const { name, companyName, contactPerson, fullName, phone, email, commercialReg, vatNumber, city, address } = req.body || {};
  if (req.user?.role === "REPRESENTATIVE" && city !== undefined) {
    const cityRegionId = getCityRegionId(String(city));
    if (!cityRegionId || cityRegionId !== getRepresentativeRegionId(req.user)) {
      return denyRegionalAccess(req, res, {
        resource: "customers",
        entityId: customer.id,
        targetRegionId: cityRegionId,
        reason: "Representative attempted to move a customer profile outside the assigned region",
      });
    }
  }
  if (name !== undefined || companyName !== undefined) customer.name = companyName || name || customer.name;
  if (contactPerson !== undefined || fullName !== undefined) customer.contactPerson = fullName || contactPerson || customer.contactPerson;
  if (phone !== undefined) customer.phone = phone;
  if (email !== undefined) customer.email = email;
  if (commercialReg !== undefined) customer.commercialReg = commercialReg;
  if (vatNumber !== undefined) customer.vatNumber = vatNumber;
  if (city !== undefined) customer.city = city;
  if (address !== undefined) customer.address = address;

  return res.json({
    message: "Customer updated successfully",
    messageAr: "تم تحديث بيانات العميل بنجاح",
    customer,
  });
});

// DELETE /api/customers/:id — delete customer
router.delete("/:id", authenticate, requirePermission("customers.delete", "customers.manage"), (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const customer = db.customers.get(id);
  if (!customer) {
    return res.status(404).json({ error: "Customer not found", errorAr: "العميل غير موجود" });
  }

  const activeTrip = Array.from(db.trips.values()).find(
    (t) => t.customerId === id && !["DELIVERED", "POD_CONFIRMED", "SETTLED", "CANCELLED"].includes(t.status)
  );
  if (activeTrip) {
    return res.status(400).json({
      error: `Cannot delete customer '${customer.name}' with active trips`,
      errorAr: `لا يمكن حذف العميل '${customer.name}' لوجود شحنات أو رحلات نشطة مرتبطة بحسابه.`,
      code: "CUSTOMER_HAS_ACTIVE_TRIPS",
    });
  }

  db.customers.delete(id);
  return res.json({
    message: "Customer deleted successfully",
    messageAr: `تم حذف العميل '${customer.name}' بنجاح`,
    id,
  });
});

export default router;
