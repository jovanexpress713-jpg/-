import { Router, type Response } from "express";
import { db, type CustomerEntity } from "../db";
import { authenticate, requirePermission, type AuthenticatedRequest } from "../auth/middleware";

const router = Router();

// GET /api/customers
router.get("/", authenticate, requirePermission("customers.view"), (_req: AuthenticatedRequest, res: Response) => {
  const list = Array.from(db.customers.values());
  return res.json({ total: list.length, customers: list });
});

// POST /api/customers
router.post("/", authenticate, requirePermission("customers.manage"), (req: AuthenticatedRequest, res: Response) => {
  const { name, contactPerson, phone, email, commercialReg, vatNumber, city, address } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: "Customer name and phone are required" });
  }

  const id = `cust-${Date.now()}`;
  const newCustomer: CustomerEntity = {
    id,
    name,
    contactPerson: contactPerson || "",
    phone,
    email: email || "",
    commercialReg: commercialReg || "",
    vatNumber: vatNumber || "",
    city: city || "الرياض",
    address: address || "",
  };

  db.customers.set(id, newCustomer);
  return res.status(201).json({ message: "Customer created successfully", customer: newCustomer });
});

export default router;
