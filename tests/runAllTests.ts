import { runAuthTests } from "./auth.test";
import { runTripLifecycleTests } from "./tripLifecycle.test";
import { runGPSAdapterTests } from "./gpsAdapter.test";
import { runFinanceTests } from "./finance.test";
import { runApiSecurityTests } from "./apiSecurity.test";

async function runAll() {
  console.log("============================================================");
  console.log("  EJAZ TRANSPORT — ENTERPRISE PRODUCTION TEST SUITE");
  console.log("============================================================");

  try {
    await runAuthTests();
    runTripLifecycleTests();
    await runGPSAdapterTests();
    runFinanceTests();
    await runApiSecurityTests();

    console.log("============================================================");
    console.log("  ✅ ALL 5 TEST SUITES PASSED (100% SUCCESS)");
    console.log("============================================================");
    process.exit(0);
  } catch (err: any) {
    console.error("  ❌ TEST FAILURE:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runAll();
