import assert from "assert";
import { isDemoAccountsEnabled, resolveJwtSecret } from "../src/server/configPolicy";

export function runConfigPolicyTests() {
  console.log("  [TEST] Running Production Configuration Policy Tests...");

  assert.strictEqual(isDemoAccountsEnabled("development", undefined), false, "Demo accounts must be opt-in");
  assert.strictEqual(isDemoAccountsEnabled("development", "true"), true, "Demo accounts may be explicitly enabled for tests");
  assert.strictEqual(isDemoAccountsEnabled("production", "true"), false, "Production must never enable demo accounts");
  assert.strictEqual(isDemoAccountsEnabled("production", "false"), false, "Production demo accounts must remain disabled");

  assert.throws(
    () => resolveJwtSecret("production", undefined),
    /JWT_SECRET is required in production/,
    "Production must not fall back to a predictable JWT secret",
  );
  assert.strictEqual(resolveJwtSecret("production", "real-secret"), "real-secret");
  assert.strictEqual(resolveJwtSecret("development", undefined), "ejaz-transport-development-only-secret");

  console.log("  ✓ Production Configuration Policy Tests Passed Successfully!");
}
