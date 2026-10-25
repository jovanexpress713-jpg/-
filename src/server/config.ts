import dotenv from "dotenv";
dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";
const jwtSecret = process.env.JWT_SECRET || (nodeEnv === "production" ? "" : "ejaz-local-development-only-secret");

if (nodeEnv === "production" && jwtSecret.length < 32) {
  throw new Error("SECURITY CONFIGURATION REQUIRED: set JWT_SECRET to a random secret of at least 32 characters before starting in production.");
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
  // Demo accounts are available only outside production unless explicitly enabled.
  enableDemoAccounts: nodeEnv !== "production" && process.env.ENABLE_DEMO_ACCOUNTS !== "false",
};
