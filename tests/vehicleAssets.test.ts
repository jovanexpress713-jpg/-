import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import type { AddressInfo } from "net";
import { createServerApp } from "../src/server/app";

/**
 * EJAZ Transport — Official Vehicle Asset Registry tests.
 *
 * Verifies the single source of truth for vehicle imagery and 3D models:
 * the 4 approved categories, official image publication, GLB validation,
 * RBAC on publishing, automatic asset re-binding on a type change, and the
 * honest fallback when no 3D model has been provisioned.
 */

let server: http.Server | null = null;
let baseUrl = "";

/**
 * The registry is sandboxed for the duration of this test so publishing assets
 * here can never overwrite the official fleet assets of a running deployment.
 */
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), "ejaz-vehicle-assets-"));
process.env.VEHICLE_ASSET_UPLOAD_ROOT = path.join(SANDBOX, "uploads", "vehicle-assets");
process.env.VEHICLE_ASSET_MANIFEST_PATH = path.join(SANDBOX, "manifest.json");

async function api(method: string, path: string, options: { token?: string | null; body?: any } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep raw */
  }
  return { status: res.status, body };
}

const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

/** Builds a structurally valid (minimal) binary glTF 2.0 container. */
function buildMinimalGlb(): string {
  const json = Buffer.from('{"asset":{"version":"2.0","generator":"ejaz-test"}}'.padEnd(52, " "), "utf8");
  const totalLength = 12 + 8 + json.length;
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.writeUInt32LE(json.length, 0);
  chunkHeader.writeUInt32LE(0x4e4f534a, 4); // "JSON"
  return Buffer.concat([header, chunkHeader, json]).toString("base64");
}

const GLB_MIN = buildMinimalGlb();

export async function runVehicleAssetTests() {
  console.log("  [TEST] Running Official Vehicle Asset Registry Tests...");

  const app = createServerApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const { port } = server!.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. The catalogue is a protected operational resource
    const anonymous = await api("GET", "/api/vehicle-assets");
    assert.strictEqual(anonymous.status, 401, "The asset catalogue must require authentication");

    const admin = (await api("POST", "/api/auth/login", { body: { email: "admin@ejaz.sa", password: "Ejaz@2026Admin" } })).body;
    const driver = (await api("POST", "/api/auth/login", { body: { email: "driver@ejaz.sa", password: "Ejaz@2026Driver" } })).body;

    // 2. Exactly four approved categories — never a fifth type
    const registry = await api("GET", "/api/vehicle-assets", { token: admin.token });
    assert.strictEqual(registry.status, 200, "The registry must be readable by an authorized operator");
    const types = registry.body.registry.types;
    assert.strictEqual(types.length, 4, "The fleet must expose exactly 4 approved categories");
    assert.deepStrictEqual(
      types.map((t: any) => t.type).sort(),
      ["curtain", "dry", "flatbed", "reefer"],
      "Categories must be flatbed / reefer / dry / curtain",
    );
    for (const type of types) {
      assert.ok(type.officialImage, `Category ${type.type} must always resolve an official image`);
    }

    // 3. Only authorized roles can publish official assets
    const driverImage = await api("PUT", "/api/vehicle-assets/flatbed/image", {
      token: driver.token,
      body: { data: PNG_1x1, fileName: "x.png" },
    });
    assert.strictEqual(driverImage.status, 403, "DRIVER must not publish official assets");

    // 4. Publishing an official reference image
    const publishedImage = await api("PUT", "/api/vehicle-assets/flatbed/image", {
      token: admin.token,
      body: { data: `data:image/png;base64,${PNG_1x1}`, fileName: "official-flatbed.png" },
    });
    assert.strictEqual(publishedImage.status, 200, "An authorized operator must be able to publish the official image");
    assert.strictEqual(publishedImage.body.asset.imageSource, "OFFICIAL_UPLOAD", "The image must be flagged as official");
    assert.ok(publishedImage.body.asset.originalImage, "The untouched original must be preserved");

    // served through the same public URL the UI consumes
    const servedImage = await fetch(baseUrl + publishedImage.body.asset.officialImage);
    assert.strictEqual(servedImage.status, 200, "The published image must be served by the platform");

    // 5. Payload validation
    const badExtension = await api("PUT", "/api/vehicle-assets/flatbed/image", {
      token: admin.token,
      body: { data: PNG_1x1, fileName: "payload.exe" },
    });
    assert.strictEqual(badExtension.status, 415, "Non-image uploads must be rejected");

    const badModel = await api("PUT", "/api/vehicle-assets/reefer/model", {
      token: admin.token,
      body: { data: Buffer.from("definitely not a model").toString("base64"), fileName: "bad.glb" },
    });
    assert.strictEqual(badModel.status, 415, "Payloads without a glTF signature must be rejected");

    const unknownType = await api("PUT", "/api/vehicle-assets/tipper/image", {
      token: admin.token,
      body: { data: PNG_1x1, fileName: "x.png" },
    });
    assert.strictEqual(unknownType.status, 400, "A fifth vehicle category must never be accepted");

    // 6. Publishing a real GLB model
    const publishedModel = await api("PUT", "/api/vehicle-assets/flatbed/model", {
      token: admin.token,
      body: { data: GLB_MIN, fileName: "flatbed.glb", scale: 1.25, rotationY: 90 },
    });
    assert.strictEqual(publishedModel.status, 200, "A valid GLB must be accepted");
    assert.strictEqual(publishedModel.body.asset.model.source, "OFFICIAL_UPLOAD", "The model must be flagged as official");
    assert.ok(publishedModel.body.asset.model.sha256, "The model must be fingerprinted");

    const servedModel = await fetch(baseUrl + publishedModel.body.asset.model.url);
    assert.strictEqual(servedModel.status, 200, "The published model must be served");
    const magic = Buffer.from(await servedModel.arrayBuffer()).subarray(0, 4).toString("ascii");
    assert.strictEqual(magic, "glTF", "The stored model must keep its binary glTF container intact");

    // 7. Viewer framing controls
    const transform = await api("PATCH", "/api/vehicle-assets/flatbed/model", {
      token: admin.token,
      body: { scale: 1.5, rotationY: 180, yOffset: 0.25 },
    });
    assert.strictEqual(transform.status, 200, "Model framing must be configurable");
    assert.strictEqual(transform.body.asset.model.scale, 1.5, "Scale must persist");
    assert.strictEqual(transform.body.asset.model.rotationY, 180, "Heading must persist");

    // 8. Changing a vehicle's category re-binds its official assets
    const created = await api("POST", "/api/vehicles", {
      token: admin.token,
      body: { plate: "س س س ٩٩٩", type: "سطحة", model: "Actros 2040", year: 2025, maxLoadTons: 30 },
    });
    assert.strictEqual(created.status, 201, "A vehicle must be creatable");
    const vehicleId: string = created.body.vehicle.id;

    const typeChange = await api("PATCH", `/api/vehicles/${vehicleId}`, { token: admin.token, body: { type: "براد" } });
    assert.strictEqual(typeChange.status, 200, "Changing the body type must succeed");
    assert.strictEqual(typeChange.body.assetRebind.typeId, "reefer", "The unit must re-bind to the new category's asset");
    assert.ok(typeChange.body.assetRebind.officialImage, "The re-bound official image must be reported");

    const invalidType = await api("PATCH", `/api/vehicles/${vehicleId}`, { token: admin.token, body: { type: "صهريج" } });
    assert.strictEqual(invalidType.status, 400, "A non-approved body type must be rejected");

    // 9. Per-vehicle photographs override the category asset and can be reverted
    const vehicleImage = await api("PUT", `/api/vehicle-assets/vehicle/${vehicleId}/image`, {
      token: admin.token,
      body: { data: PNG_1x1, fileName: "unit.png" },
    });
    assert.strictEqual(vehicleImage.status, 200, "A per-vehicle photograph must be publishable");

    const withPhoto = await api("GET", "/api/vehicle-assets", { token: admin.token });
    assert.ok(withPhoto.body.registry.vehicles[vehicleId]?.url, "The registry must expose the vehicle photograph");

    const removed = await api("DELETE", `/api/vehicle-assets/vehicle/${vehicleId}/image`, { token: admin.token });
    assert.strictEqual(removed.status, 200, "Removing the photograph must succeed");

    const afterRemoval = await api("GET", "/api/vehicle-assets", { token: admin.token });
    assert.ok(!afterRemoval.body.registry.vehicles[vehicleId], "The photograph must be cleared from the registry");

    // 10. Every sensitive asset operation is audited
    const audit = await api("GET", "/api/audit?limit=100", { token: admin.token });
    const actions = (audit.body.logs || []).map((l: any) => l.action);
    for (const action of [
      "VEHICLE_TYPE_IMAGE_PUBLISHED",
      "VEHICLE_TYPE_MODEL_PUBLISHED",
      "VEHICLE_TYPE_CHANGED",
      "VEHICLE_CUSTOM_IMAGE_PUBLISHED",
    ]) {
      assert.ok(actions.includes(action), `${action} must be recorded in the audit log`);
    }

    // 11. Withdrawing a model returns the viewer to the official photograph
    const withdrawn = await api("DELETE", "/api/vehicle-assets/flatbed/model", { token: admin.token });
    assert.strictEqual(withdrawn.status, 200, "A published model must be withdrawable");
    assert.strictEqual(withdrawn.body.asset.model.url, null, "The withdrawn model must clear its URL");

    console.log("  ✓ Official Vehicle Asset Registry Tests Passed Successfully!");
  } finally {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    server = null;
    fs.rmSync(SANDBOX, { recursive: true, force: true });
    delete process.env.VEHICLE_ASSET_UPLOAD_ROOT;
    delete process.env.VEHICLE_ASSET_MANIFEST_PATH;
  }
}
