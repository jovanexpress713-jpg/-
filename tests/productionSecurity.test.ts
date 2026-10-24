import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

export function runProductionSecurityTests() {
  console.log("  [TEST] Running Production Authentication Security Regression Tests...");

  const config = read("src/server/config.ts");
  const main = read("src/main.tsx");
  const authGate = read("src/components/ConsoleAuthGate.tsx");
  const apiClient = read("src/services/apiClient.ts");
  const serverApp = read("src/server/app.ts");
  const authRoutes = read("src/server/routes/authRoutes.ts");

  // Production must never fall back to a public, source-controlled JWT secret.
  assert.doesNotMatch(
    config,
    /ejaz-transport-enterprise-jwt-secret-key-2026/,
    "JWT signing must never use the source-controlled fallback secret",
  );
  assert.match(config, /ENABLE_DEMO_ACCOUNTS === \"true\"/, "demo accounts must be opt-in, not enabled by default");
  assert.match(config, /JWT_SECRET is required when NODE_ENV=production/, "production must fail closed without JWT_SECRET");

  // The boot entry point neutralizes the legacy quick-access call before App is evaluated.
  // This is the regression guard for the old catch-path that could fabricate a local
  // SUPER_ADMIN session when the backend was unavailable.
  assert.match(main, /apiClient\.auth\.quickAccess = async \(\) => \(\{ token: \"\", user: null \}\)/, "boot must neutralize passwordless quick access");

  // The login gate must not fabricate a JWT-like Google token in the browser.
  assert.doesNotMatch(authGate, /firebase_token_/, "Google sign-in must not fabricate a JWT-like token in the browser");

  // Tokens must be transported as Authorization/X-Ejaz-Token, not exposed in URLs.
  assert.doesNotMatch(apiClient, /[?&]token=|token=\$\{/, "API requests must not put authentication tokens in URLs");

  // The public server boundary must make quick access inert unless demo mode is explicitly enabled.
  assert.match(serverApp, /guardQuickAccess/, "server must guard passwordless quick access");
  assert.match(serverApp, /\/api\/users\/quick-access/, "the users alias must be guarded too");
  assert.match(serverApp, /disabled: true, token: \"\", user: null/, "disabled quick access must not issue a session");
  assert.match(authRoutes, /config\.enableDemoAccounts/, "quick-access/demo behavior must remain configuration-aware");

  console.log("  ✓ Production Authentication Security Regression Tests Passed Successfully!");
}

runProductionSecurityTests();
