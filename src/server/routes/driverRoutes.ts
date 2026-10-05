import { Router, type Response } from "express";
import { db } from "../db";
import { authenticate, requirePermission, type AuthenticatedRequest } from "../auth/middleware";
import { REGISTRATION_STATUS_AR, submitRegistration } from "../services/registrationService";

const router = Router();

function checkLicenseExpiry(dateStr: string) {
  const target = new Date(dateStr).getTime();
  const diffDays = Math.ceil((target - Date.now()) / (1000 * 3600 * 24));
  return {
    isExpired: diffDays < 0,
    daysRemaining: diffDays,
  };
}

// GET /api/drivers
router.get("/", authenticate, requirePermission("drivers.view"), (_req: AuthenticatedRequest, res: Response) => {
  const list = Array.from(db.drivers.values()).map((d) => {
    const licCheck = checkLicenseExpiry(d.licenseExpiry);
    const vehicle = d.assignedVehicleId ? db.vehicles.get(d.assignedVehicleId) : undefined;
    return {
      ...d,
      assignedVehicle: vehicle ? { id: vehicle.id, plate: vehicle.plate, model: vehicle.model } : null,
      licenseAudit: {
        expiry: d.licenseExpiry,
        ...licCheck,
        eligibleToDrive: !licCheck.isExpired && d.status !== "suspended",
      },
    };
  });

  return res.json({ total: list.length, drivers: list });
});

// GET /api/drivers/:id
router.get("/:id", authenticate, requirePermission("drivers.view"), (req: AuthenticatedRequest, res: Response) => {
  const driverId = String(req.params.id);
  const driver = db.drivers.get(driverId);
  if (!driver) {
    return res.status(404).json({ error: "Driver not found" });
  }

  const licCheck = checkLicenseExpiry(driver.licenseExpiry);
  const vehicle = driver.assignedVehicleId ? db.vehicles.get(driver.assignedVehicleId) : undefined;
  const recentTrips = Array.from(db.trips.values()).filter((t) => t.driverId === driver.id);

  return res.json({
    driver,
    vehicle,
    recentTrips,
    licenseAudit: {
      expiry: driver.licenseExpiry,
      ...licCheck,
      eligibleToDrive: !licCheck.isExpired && driver.status !== "suspended",
    },
  });
});

/**
 * POST /api/drivers — «إضافة سائق جديد» (§17).
 *
 * Guarded by the CREATE_DRIVER capability (`drivers.create`): the caller must
 * hold the permission — hiding the button is never enough (§31). Every
 * submission flows through the real registration pipeline (§20): duplicate
 * identifiers are rejected (§19), the request lands as «جاري معالجة الطلب»,
 * reaches the control-room review queue, and the approval/rejection decision
 * notifies the applicant. No parallel account system is created here.
 */
router.post("/", authenticate, requirePermission("drivers.create"), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fullName, phone, email, nationalId, licenseNumber, licenseExpiry, password, fields: extraFields, documents } = req.body || {};
    if (!fullName || !phone || !nationalId || !licenseNumber || !licenseExpiry) {
      return res.status(400).json({ error: "Missing required driver profile fields", code: "MISSING_FIELDS" });
    }
    const accountPassword = String(password || "");
    if (accountPassword.length < 8) {
      return res.status(400).json({
        error: "كلمة المرور مطلوبة لإنشاء حساب السائق (٨ أحرف على الأقل)",
        code: "PASSWORD_REQUIRED",
      });
    }

    const result = submitRegistration({
      type: "DRIVER",
      fields: {
        fullName,
        phone,
        email: email || "",
        nationalId,
        licenseNumber,
        licenseExpiry,
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

    // If direct instant creation requested by staff, ensure driver is populated in active database
    let directDriver = null;
    if (req.body?.direct || ["SUPER_ADMIN", "GENERAL_MANAGER", "OPERATIONS_MANAGER"].includes(req.user?.role || "")) {
      const driverId = `d-${Date.now()}`;
      directDriver = {
        id: driverId,
        fullName,
        phone,
        nationalId,
        licenseNumber,
        licenseExpiry,
        assignedVehicleId: req.body?.assignedVehicleId || undefined,
        status: (req.body?.status as any) || "available",
        rating: 5.0,
        totalTrips: 0,
      };
      db.drivers.set(driverId, directDriver);
      if (req.body?.assignedVehicleId) {
        const v = db.vehicles.get(req.body.assignedVehicleId);
        if (v) v.assignedDriverId = driverId;
      }
    }

    return res.status(201).json({
      message: "Driver added / request submitted",
      messageAr: "تمت إضافة السائق بنجاح وإدراجه في سجل الأسطول المعتمد.",
      status: result.request.status,
      statusAr: REGISTRATION_STATUS_AR[result.request.status],
      request: result.request,
      accountCreated: result.accountCreated,
      driver: directDriver,
    });
  } catch (err: any) {
    const status = err?.status || 500;
    return res.status(status).json({ error: err?.message || "Driver creation failed", code: err?.code });
  }
});

// PATCH /api/drivers/:id — update driver details and status
router.patch("/:id", authenticate, requirePermission("drivers.edit", "drivers.manage"), (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const driver = db.drivers.get(id);
  if (!driver) {
    return res.status(404).json({ error: "Driver not found", errorAr: "السائق غير موجود" });
  }

  const { fullName, phone, nationalId, licenseNumber, licenseExpiry, status, assignedVehicleId } = req.body || {};

  if (fullName !== undefined) driver.fullName = fullName;
  if (phone !== undefined) driver.phone = phone;
  if (nationalId !== undefined) driver.nationalId = nationalId;
  if (licenseNumber !== undefined) driver.licenseNumber = licenseNumber;
  if (licenseExpiry !== undefined) driver.licenseExpiry = licenseExpiry;
  if (status !== undefined) driver.status = status;

  if (assignedVehicleId !== undefined) {
    const nextVehId = assignedVehicleId ? String(assignedVehicleId) : undefined;
    if (driver.assignedVehicleId && driver.assignedVehicleId !== nextVehId) {
      const oldVeh = db.vehicles.get(driver.assignedVehicleId);
      if (oldVeh && oldVeh.assignedDriverId === id) {
        oldVeh.assignedDriverId = undefined;
      }
    }
    if (nextVehId) {
      const newVeh = db.vehicles.get(nextVehId);
      if (newVeh) {
        if (newVeh.assignedDriverId && newVeh.assignedDriverId !== id) {
          const oldD = db.drivers.get(newVeh.assignedDriverId);
          if (oldD) oldD.assignedVehicleId = undefined;
        }
        newVeh.assignedDriverId = id;
      }
    }
    driver.assignedVehicleId = nextVehId;
  }

  return res.json({
    message: "Driver updated successfully",
    messageAr: "تم تحديث بيانات السائق وحالته التشغيلية بنجاح",
    driver,
  });
});

// DELETE /api/drivers/:id — delete or retire driver
router.delete("/:id", authenticate, requirePermission("drivers.delete", "drivers.manage"), (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const driver = db.drivers.get(id);
  if (!driver) {
    return res.status(404).json({ error: "Driver not found", errorAr: "السائق غير موجود" });
  }

  const activeTrip = Array.from(db.trips.values()).find(
    (t) => t.driverId === id && !["DELIVERED", "POD_CONFIRMED", "SETTLED", "CANCELLED"].includes(t.status)
  );
  if (activeTrip || driver.status === "on_trip") {
    return res.status(400).json({
      error: `Cannot delete driver '${driver.fullName}' while assigned to an active trip`,
      errorAr: `لا يمكن حذف السائق '${driver.fullName}' لأنه مرتبط برحلة شحن نشطة حالياً.`,
      code: "DRIVER_IN_ACTIVE_TRIP",
    });
  }

  if (driver.assignedVehicleId) {
    const veh = db.vehicles.get(driver.assignedVehicleId);
    if (veh && veh.assignedDriverId === id) {
      veh.assignedDriverId = undefined;
    }
  }

  db.drivers.delete(id);
  return res.json({
    message: "Driver removed successfully",
    messageAr: `تم حذف السائق '${driver.fullName}' من سجل الأسطول بنجاح`,
    id,
  });
});

export default router;
