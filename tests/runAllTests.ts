import { runAuthTests } from "./auth.test";
import { runTripLifecycleTests } from "./tripLifecycle.test";
import { runGPSAdapterTests } from "./gpsAdapter.test";
import { runFinanceTests } from "./finance.test";
import { runApiSecurityTests } from "./apiSecurity.test";
import { runVehicleAssetTests } from "./vehicleAssets.test";
import { runBootSurfaceTests } from "./bootSurface.test";
import { runFleetImageryTests } from "./fleetImagery.test";
import { runRegistrationTests } from "./registration.test";
import { runUiInteractionTests } from "./uiInteraction.test";
import { runRuntimeUiTests } from "./runtimeUi.test";
import { runResponsiveAudit } from "./responsiveAudit.test";
import { runBrandingTests } from "./branding.test";
import { runNovaDesignTests } from "./novaDesign.test";

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
    await runVehicleAssetTests();
    runBootSurfaceTests();
    runFleetImageryTests();
    await runRegistrationTests();
    runUiInteractionTests();
    await runRuntimeUiTests();
    runResponsiveAudit();
    runBrandingTests();
    await runNovaDesignTests();

    console.log("============================================================");
    console.log("  ✅ ALL 14 TEST SUITES PASSED (100% SUCCESS)");
    console.log("============================================================");
    process.exit(0);
  } catch (err: any) {
    console.error("  ❌ TEST FAILURE:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runAll();
