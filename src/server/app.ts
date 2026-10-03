import path from "path";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import tripRoutes from "./routes/tripRoutes";
import vehicleRoutes from "./routes/vehicleRoutes";
import driverRoutes from "./routes/driverRoutes";
import customerRoutes from "./routes/customerRoutes";
import financeRoutes from "./routes/financeRoutes";
import documentRoutes from "./routes/documentRoutes";
import podRoutes from "./routes/podRoutes";
import claimRoutes from "./routes/claimRoutes";
import gpsRoutes from "./routes/gpsRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import auditRoutes from "./routes/auditRoutes";
import reportRoutes from "./routes/reportRoutes";
import systemRoutes from "./routes/systemRoutes";
import brandingRoutes from "./routes/brandingRoutes";
import devGpsRoutes from "./routes/devGpsRoutes";

export function createServerApp() {
  const app = express();

  // Basic Middlewares
  app.use(cors());
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ extended: true, limit: "15mb" }));

  // API Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/users", authRoutes);
  app.use("/api/trips", tripRoutes);
  app.use("/api/branding", brandingRoutes);
  // Canonical alias mounts: the mobile app addresses client/driver trip resources
  // under /api/client/trips and /api/driver/trips (including POST .../:id/request).
  app.use("/api/client/trips", (req, res, next) => {
    req.url = `/client/trips${req.url === "/" ? "" : req.url}`;
    tripRoutes(req, res, next);
  });
  app.use("/api/driver/trips", (req, res, next) => {
    req.url = `/driver/trips${req.url === "/" ? "" : req.url}`;
    tripRoutes(req, res, next);
  });
  app.use("/api/vehicles", vehicleRoutes);
  app.use("/api/drivers", driverRoutes);
  app.use("/api/customers", customerRoutes);
  app.use("/api/finance", financeRoutes);
  app.use("/api/documents", documentRoutes);
  app.use("/api/pod", podRoutes);
  app.use("/api/claims", claimRoutes);
  app.use("/api/gps", gpsRoutes);
  app.use("/api/dev/gps", devGpsRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/audit", auditRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api", systemRoutes);

  // Official uploaded vehicle reference assets handler
  app.use((req, res, next) => {
    if (req.path.endsWith("file_00000000bf908211b85dffc7076e553c.png")) {
      return res.sendFile(path.resolve(process.cwd(), "public/images/trucks/scania-flatbed.jpg"));
    }
    next();
  });

  // Global 404 handler for unmatched API routes
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "Endpoint not found", code: "NOT_FOUND" });
    }
    next();
  });

  return app;
}
