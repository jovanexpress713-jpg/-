import dotenv from "dotenv";
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const configuredJwtSecret = process.env.JWT_SECRET || "";

if (isProduction && configuredJwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be explicitly configured with at least 32 characters in production.");
}

export const config = {
  port: parseInt(process.env.APP_PORT || "3000", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",
  // A predictable development-only fallback must never be used in production.
  jwtSecret: configuredJwtSecret || "development-only-insecure-secret-do-not-deploy",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  databaseUrl: process.env.DATABASE_URL || "",
  gpsProviderApiKey: process.env.GPS_PROVIDER_API_KEY || "",
  gpsProviderEndpoint: process.env.GPS_PROVIDER_ENDPOINT || "",
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  // Demo access is opt-in in production; development remains convenient by default.
  enableDemoAccounts:
    process.env.ENABLE_DEMO_ACCOUNTS === "true" ||
    (!isProduction && process.env.ENABLE_DEMO_ACCOUNTS !== "false"),
};
