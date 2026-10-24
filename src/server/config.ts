import dotenv from "dotenv";
dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const jwtSecret = process.env.JWT_SECRET || (isProduction ? "" : "development-only-ejaz-jwt-secret-not-for-production");

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be configured in production; refusing to start with a fallback secret.");
}
if (isProduction && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production.");
}

export const config = {
  port: parseInt(process.env.APP_PORT || "3000", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  databaseUrl: process.env.DATABASE_URL || "",
  gpsProviderApiKey: process.env.GPS_PROVIDER_API_KEY || "",
  gpsProviderEndpoint: process.env.GPS_PROVIDER_ENDPOINT || "",
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  // Demo credentials are opt-in only; production never enables them by default.
  enableDemoAccounts: process.env.ENABLE_DEMO_ACCOUNTS === "true" && !isProduction,
};