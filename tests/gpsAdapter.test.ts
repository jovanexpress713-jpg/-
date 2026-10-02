import assert from "assert";
import { EnterpriseGPSAdapter, type GPSPosition } from "../src/server/services/gpsProviderAdapter";

export async function runGPSAdapterTests() {
  console.log("  [TEST] Running GPS Provider Adapter Tests...");

  const adapter = new EnterpriseGPSAdapter();

  // 1. Unconfigured State Behavior (No invented provider in production)
  const initialStatus = adapter.getStatus();
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

  adapter.recordTelemetry(verifiedPos);

  const retrieved = await adapter.getLatestPosition("AVL-MB-4821");
  assert(retrieved !== null, "Must retrieve recorded telemetry position");
  assert.strictEqual(retrieved?.latitude, 24.7136);
  assert.strictEqual(retrieved?.longitude, 46.6753);
  assert.strictEqual(retrieved?.deviceId, "AVL-MB-4821");

  // 3. Unknown device returns null (no random hallucination)
  const unknown = await adapter.getLatestPosition("NON-EXISTENT-DEVICE-999");
  assert.strictEqual(unknown, null, "Unregistered device must return null without fabricating random coordinates");

  console.log("  ✓ GPS Provider Adapter Tests Passed Successfully!");
}
