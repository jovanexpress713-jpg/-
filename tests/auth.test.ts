import assert from "assert";
import { hashPassword, comparePassword, generateToken, verifyToken } from "../src/server/auth/jwt";
import { ROLE_PERMISSIONS } from "../src/server/auth/middleware";

export async function runAuthTests() {
  console.log("  [TEST] Running Authentication & RBAC Tests...");

  // 1. Password hashing & comparison
  const plain = "Ejaz@2026!";
  const hash = await hashPassword(plain);
  assert(hash.startsWith("$2"), "Hash must follow bcrypt prefix");
  const isCorrect = await comparePassword(plain, hash);
  assert.strictEqual(isCorrect, true, "Bcrypt compare must succeed for valid password");
  const isWrong = await comparePassword("WrongPassword123!", hash);
  assert.strictEqual(isWrong, false, "Bcrypt compare must fail for invalid password");

  // 2. JWT Generation & Verification
  const token = generateToken({
    userId: "u-test-1",
    email: "test@ejaz.sa",
    fullName: "اختبار إيجاز",
    role: "OPERATIONS_MANAGER",
  });
  assert(typeof token === "string" && token.length > 20, "JWT token must be a non-empty string");

  const payload = verifyToken(token);
  assert(payload !== null, "Token verification must succeed for signed JWT");
  assert.strictEqual(payload?.userId, "u-test-1");
  assert.strictEqual(payload?.role, "OPERATIONS_MANAGER");

  // 3. Invalid Token Verification
  const invalidPayload = verifyToken("invalid.tampered.token");
  assert.strictEqual(invalidPayload, null, "Tampered token verification must return null");

  // 4. RBAC Permission Matrix
  assert(ROLE_PERMISSIONS.SUPER_ADMIN.includes("*"), "SUPER_ADMIN must have wildcard permission");
  assert(ROLE_PERMISSIONS.OPERATIONS_MANAGER.includes("trips.create"), "OPERATIONS_MANAGER must have trips.create");
  assert(!ROLE_PERMISSIONS.DRIVER.includes("finance.settle"), "DRIVER must not have finance.settle");
  assert(ROLE_PERMISSIONS.ACCOUNTANT.includes("finance.settle"), "ACCOUNTANT must have finance.settle");

  console.log("  ✓ Authentication & RBAC Tests Passed Successfully!");
}
