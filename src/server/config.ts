import dotenv from "dotenv";
import { isDemoAccountsEnabled, resolveJwtSecret } from "./configPolicy";

dotenv.config();

export const config = {
  port: parseInt(process.env.APP_PORT || "3000", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: resolveJwtSecret(process.env.NODE_ENV, process.env.JWT_SECRET),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  databaseUrl: process.env.DATABASE_URL || "",
  gpsProviderApiKey: process.env.GPS_PROVIDER_API_KEY || "",
  gpsProviderEndpoint: process.env.GPS_PROVIDER_ENDPOINT || "",
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  // Demo accounts are opt-in for development/test environments and are always disabled in production.
  enableDemoAccounts: isDemoAccountsEnabled(process.env.NODE_ENV, process.env.ENABLE_DEMO_ACCOUNTS),
};
