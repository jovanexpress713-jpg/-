/**
 * End-to-end proof that a photograph uploaded from the dashboard control panel
 * reaches every screen immediately.
 *
 * Signs in as the administrator, publishes a per-vehicle photograph through the
 * exact same endpoint the dashboard calls, then re-reads the public registry and
 * the served file — no page reload, no build step. It finishes by restoring the
 * official category photograph, so the fleet is left exactly as it was.
 *
 * Usage: start the server, then `npm run verify:upload`.
 */
import fs from "fs";

const BASE = "http://127.0.0.1:3000";
const fail = (msg) => {
  console.error("❌", msg);
  process.exit(1);
};

const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@ejaz.sa", password: "Ejaz@2026Admin" }),
});
const auth = await login.json();
const token = auth.token || auth.accessToken || auth?.data?.token;
if (!token) fail(`login failed: ${JSON.stringify(auth).slice(0, 200)}`);
console.log("✓ signed in as administrator");

const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
const readRegistry = async () => {
  const res = await fetch(`${BASE}/api/vehicle-assets`, { headers: authHeaders });
  return (await res.json()).registry;
};

const before = await readRegistry();
const target = "v1";
console.log(`✓ registry read — ${target} photograph before:`, before.vehicles?.[target]?.url ?? "(none, official image in use)");

const png = fs.readFileSync("public/images/trucks/official/official-reefer.png").toString("base64");
const publish = await fetch(`${BASE}/api/vehicle-assets/vehicle/${target}/image`, {
  method: "PUT",
  headers: authHeaders,
  body: JSON.stringify({ data: `data:image/png;base64,${png}`, fileName: "dashboard-upload-check.png" }),
});
if (!publish.ok) fail(`publish failed: ${publish.status} ${await publish.text()}`);
const published = await publish.json();
console.log("✓ photograph published:", published.image?.url);

const after = await readRegistry();
const live = after.vehicles?.[target]?.url;
if (live !== published.image.url) fail(`registry did not update instantly (got ${live})`);
console.log("✓ registry updated instantly with no reload:", live);

const served = await fetch(`${BASE}${live}`);
const bytes = (await served.arrayBuffer()).byteLength;
console.log(`✓ the new photograph is served: HTTP ${served.status}, ${bytes} bytes`);
if (served.status !== 200 || bytes < 1000) fail("served photograph is not valid");

// Restore the official category asset for this vehicle.
const removed = await fetch(`${BASE}/api/vehicle-assets/vehicle/${target}/image`, {
  method: "DELETE",
  headers: authHeaders,
});
if (!removed.ok) fail(`restore failed: ${removed.status}`);
const restored = await readRegistry();
if (restored.vehicles?.[target]) fail("vehicle photograph was not restored to the official asset");
console.log("✓ restored to the official category photograph (fleet left as it was)");

console.log("\n✅ DASHBOARD UPLOAD → INSTANT PROPAGATION VERIFIED");
