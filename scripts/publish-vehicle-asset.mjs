#!/usr/bin/env node
/**
 * EJAZ Transport — Official Vehicle Asset Publisher
 *
 * Publishes an official vehicle reference image and/or GLB/glTF model through
 * the live API, so the asset is recorded in the audit trail and appears in
 * every client that consumes the Vehicle Asset Registry.
 *
 * Usage:
 *   node scripts/publish-vehicle-asset.mjs --type flatbed --image ./photo.jpg
 *   node scripts/publish-vehicle-asset.mjs --type reefer --model ./reefer.glb
 *   node scripts/publish-vehicle-asset.mjs --type dry --image ./photo.png --model ./dry.glb --scale 1.2 --rotation 90
 *
 * Options:
 *   --type      flatbed | reefer | dry | curtain      (required)
 *   --image     path to the official reference image  (optional)
 *   --model     path to the official GLB/glTF model   (optional)
 *   --scale     viewer scale for the model             (optional, default 1)
 *   --rotation  heading in degrees                     (optional, default 0)
 *   --yoffset   vertical offset                        (optional, default 0)
 *   --base      API base URL                           (default http://localhost:3000)
 *   --email     operator account                       (or EJAZ_OPERATOR_EMAIL)
 *   --password  operator password                     (or EJAZ_OPERATOR_PASSWORD)
 *
 * At least one of --image or --model is required. This is intentional: a
 * real 3D asset can now be published without inventing or supplying a photo.
 */

import fs from "fs";
import path from "path";

const API_BASE = process.env.EJAZ_API_BASE || "http://localhost:3000";
const TYPE_IDS = { flatbed: "سطحة", reefer: "براد", dry: "جاف", curtain: "ستارة" };

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    args[key] = value;
  }
  return args;
}

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

function toDataUrl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || (ext === ".glb" ? "model/gltf-binary" : ext === ".gltf" ? "model/gltf+json" : "application/octet-stream");
  return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

async function api(pathname, { method = "GET", token, body } = {}) {
  const res = await fetch(API_BASE + pathname, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${pathname} → ${res.status}: ${json?.error || text.slice(0, 200)}`);
  }
  return json;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const base = args.base || API_BASE;

  if (!args.type || !TYPE_IDS[args.type]) {
    console.error(`✗ --type is required and must be one of: ${Object.keys(TYPE_IDS).join(" | ")}`);
    process.exit(1);
  }
  if (!args.image && !args.model) {
    console.error("✗ At least one real asset is required: pass --image and/or --model.");
    process.exit(1);
  }
  if (args.image && !fs.existsSync(args.image)) {
    console.error(`✗ Image not found: ${args.image}`);
    process.exit(1);
  }
  if (args.model && !fs.existsSync(args.model)) {
    console.error(`✗ Model not found: ${args.model}`);
    process.exit(1);
  }

  const email = args.email || process.env.EJAZ_OPERATOR_EMAIL;
  const password = args.password || process.env.EJAZ_OPERATOR_PASSWORD;
  if (!email || !password) {
    console.error("✗ Operator credentials are required. Pass --email/--password or set EJAZ_OPERATOR_EMAIL/EJAZ_OPERATOR_PASSWORD.");
    process.exit(1);
  }

  console.log(`EJAZ Vehicle Asset Publisher → ${base}`);
  console.log(`  category : ${args.type} (${TYPE_IDS[args.type]})`);
  if (args.image) console.log(`  image    : ${args.image} (${(fs.statSync(args.image).size / 1024).toFixed(0)} KB)`);
  if (args.model) console.log(`  model    : ${args.model} (${(fs.statSync(args.model).size / 1024).toFixed(0)} KB)`);

  const login = await api("/api/auth/login", { method: "POST", body: { email, password } });
  const token = login.token;
  console.log(`  operator : ${login.user.fullName} (${login.user.role})`);

  if (args.image) {
    const published = await api(`/api/vehicle-assets/${args.type}/image`, {
      method: "PUT",
      token,
      body: { data: toDataUrl(args.image), fileName: path.basename(args.image) },
    });
    console.log(`✓ official image published → ${published.asset.officialImage}`);
    if (published.asset.originalImage) console.log(`  untouched original preserved → ${published.asset.originalImage}`);
  }

  if (args.model) {
    const model = await api(`/api/vehicle-assets/${args.type}/model`, {
      method: "PUT",
      token,
      body: {
        data: toDataUrl(args.model),
        fileName: path.basename(args.model),
        scale: args.scale ? Number(args.scale) : undefined,
        rotationY: args.rotation ? Number(args.rotation) : undefined,
        yOffset: args.yoffset ? Number(args.yoffset) : undefined,
      },
    });
    console.log(`✓ official 3D model published → ${model.asset.model.url}`);
    console.log(`  size ${(model.asset.model.sizeBytes / 1024).toFixed(0)} KB · sha256 ${model.asset.model.sha256.slice(0, 24)}…`);
  }

  const registry = await api("/api/vehicle-assets", { token });
  const entry = registry.registry.types.find((t) => t.type === args.type);
  console.log("\nCurrent category state:");
  console.log(`  official image : ${entry.officialImage || "not published"} (${entry.imageSource || "none"})`);
  console.log(`  3D model       : ${entry.model.url || "not published"}`);
  console.log("\nAsset publication completed through the Vehicle Asset Registry.");
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
