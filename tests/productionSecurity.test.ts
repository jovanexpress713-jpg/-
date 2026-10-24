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
  const app = read("src/App.tsx");
  const authGate = read("src/components/ConsoleAuthGate.tsx");
  const apiClient = read("src/services/apiClient.ts");
  const authRoutes = read("src/server/routes/authRoutes.ts");

  // Production must never fall back to a public, source-controlled JWT secret.
  assert.doesNotMatch(
    config,
    /ejaz-transport-enterprise-jwt-secret-key-2026/,
    "JWT signing must never use the source-controlled fallback secret",
  );
  assert.match(config, /ENABLE_DEMO_ACCOUNTS.*false/, "demo accounts must be opt-in, not enabled by default");

  // The browser must never manufacture a privileged identity when the backend is unavailable.
  assert.doesNotMatch(app, /fallbackOwner/, "the application must not create a local SUPER_ADMIN fallback");
  assert.doesNotMatch(app, /quickAccess\(/, "the application shell must not bypass password authentication");
  assert.doesNotMatch(app, /Ejaz@2026Client/, "client credentials must not be embedded in the application shell");
  assert.doesNotMatch(app, /permissions:\s*\[\"\*\"\]/, "the client must never manufacture wildcard permissions");

  // The login gate must only accept sessions issued by the authoritative backend.
  assert.doesNotMatch(authGate, /quickAccess\(/, "the login gate must not expose passwordless owner access");
  assert.doesNotMatch(authGate, /firebase_token_/, "Google sign-in must not fabricate a JWT-like token in the browser");

  // Tokens must be transported as Authorization/X-Ejaz-Token, not exposed in URLs.
  assert.doesNotMatch(apiClient, /[?&]token=|token=\$\{/, "API requests must not put authentication tokens in URLs");

  // The server-side quick-access surface, if retained for an explicit demo environment,
  // must never create an account or issue access when demo mode is disabled.
  assert.match(authRoutes, /config\.enableDemoAccounts/, "quick-access/demo behavior must be controlled by the server configuration");
  assert.doesNotMatch(
    authRoutes,
    /db\.users\.set\(user\.id, user\)/,
    "authentication routes must not manufacture privileged users on demand",
  );

  console.log("  ✓ Production Authentication Security Regression Tests Passed Successfully!");
}

runProductionSecurityTests();
