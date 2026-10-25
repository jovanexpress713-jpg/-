export function isDemoAccountsEnabled(nodeEnv: string | undefined, flag: string | undefined): boolean {
  if ((nodeEnv || "development").toLowerCase() === "production") return false;
  return flag === "true";
}

export function resolveJwtSecret(nodeEnv: string | undefined, configuredSecret: string | undefined): string {
  const environment = (nodeEnv || "development").toLowerCase();
  if (configuredSecret?.trim()) return configuredSecret.trim();
  if (environment === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  return "ejaz-transport-development-only-secret";
}
