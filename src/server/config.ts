import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.APP_PORT || "3000", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "ejaz-transport-enterprise-jwt-secret-key-2026",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  databaseUrl: process.env.DATABASE_URL || "",
  gpsProviderApiKey: process.env.GPS_PROVIDER_API_KEY || "",
  gpsProviderEndpoint: process.env.GPS_PROVIDER_ENDPOINT || "",
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  enableDemoAccounts: process.env.ENABLE_DEMO_ACCOUNTS !== "false",
};
