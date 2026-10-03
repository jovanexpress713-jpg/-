import assert from "assert";
import { EnterpriseGPSAdapter, GPSDevelopmentAdapter, type GPSPosition } from "../src/server/services/gpsProviderAdapter";

export async function runGPSAdapterTests() {
  console.log("  [TEST] Running GPS Provider Adapter Tests...");

  // 1. Unconfigured State Behavior (No invented provider in production when credentials missing)
  const unconfiguredAdapter = new EnterpriseGPSAdapter(null, null);
  const initialStatus = unconfiguredAdapter.getStatus();
  assert.strictEqual(initialStatus.status, "CONFIGURATION_REQUIRED", "Without env credentials, status must be CONFIGURATION_REQUIRED");

  // 2. Telemetry ingestion & retrieval of verified position
  const verifiedPos: GPSPosition = {
    vehicleId: "v1",
    deviceId: "AVL-MB-4821",
    tripId: "trip-1",
    latitude: 24.7136,
    longitude: 46.6753,
    speed: 85.4,
    heading: 260,
    ignition: true,
    provider: "ENTERPRISE_AVL",
    timestamp: new Date().toISOString(),
    status: "ONLINE",
  };

  unconfiguredAdapter.recordTelemetry(verifiedPos);

  const retrieved = await unconfiguredAdapter.getLatestPosition("AVL-MB-4821");
  assert(retrieved !== null, "Must retrieve recorded telemetry position");
  assert.strictEqual(retrieved?.latitude, 24.7136);
  assert.strictEqual(retrieved?.longitude, 46.6753);
  assert.strictEqual(retrieved?.deviceId, "AVL-MB-4821");

  // 3. Unknown device returns null (no random hallucination)
  const unknown = await unconfiguredAdapter.getLatestPosition("NON-EXISTENT-DEVICE-999");
  assert.strictEqual(unknown, null, "Unregistered device must return null without fabricating random coordinates");

  // 4. Development Adapter Verification
  const devAdapter = new GPSDevelopmentAdapter();
  const devStatus = devAdapter.getStatus();
  assert.strictEqual(devStatus.status, "CONNECTED", "Development adapter must report CONNECTED status");
  assert.strictEqual(devStatus.isDevelopment, true, "Development adapter must flag isDevelopment: true");

  const devPos = await devAdapter.getLatestPosition("AVL-MB-4821");
  assert(devPos !== null, "Development adapter must provide seeded baseline telemetry for vehicle");
  assert.strictEqual(devPos?.deviceId, "AVL-MB-4821");

  console.log("  ✓ GPS Provider Adapter Tests Passed Successfully!");
}
