#!/usr/bin/env node
/**
 * EJAZ Transport — i18n coverage audit.
 *
 * Scans every `t("English", "العربية")` call site in `src/` and reports what an
 * Urdu session would actually render:
 *
 *   covered(exact)  → the English source has a hand-written Urdu entry
 *   covered(data)   → the Arabic twin resolves through the data word/phrase map
 *   fallback        → neither exists, so the English source is shown
 *
 * Usage:  node scripts/i18n-audit.mjs [--list]
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const shouldList = process.argv.includes("--list");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const files = [...walk(path.join(root, "src")), ...walk(path.join(root, "scripts"))];

/* ── Gather every legacy call site ─────────────────────────────────────── */
const callSites = new Map(); // english → { ar, count }
const pattern =
  /(?<![\w.])t\(\s*("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)\s*,\s*("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g;

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  let match;
  while ((match = pattern.exec(text))) {
    const en = match[1].replace(/^["`]|["`]$/g, "");
    const ar = match[2].replace(/^["`]|["`]$/g, "");
    if (!/[A-Za-z\u0600-\u06FF]/.test(en)) continue;      // pure symbols/units
    if (/\$\{/.test(en)) continue;                        // interpolated template
    const previous = callSites.get(en);
    callSites.set(en, { ar, count: (previous?.count ?? 0) + 1 });
  }
}

/* ── Load the Urdu layer ───────────────────────────────────────────────── */
const glossaryFiles = ["shell", "ops", "mobile"].map((name) =>
  fs.readFileSync(path.join(root, "src", "localization", "urdu", `${name}.ts`), "utf8"),
);
const dataFile = fs.readFileSync(path.join(root, "src", "localization", "urdu", "data.ts"), "utf8");

const exact = new Set();
for (const text of glossaryFiles) {
  for (const match of text.matchAll(/^\s*"((?:[^"\\]|\\.)*)":/gm)) exact.add(match[1]);
}
const phraseKeys = new Set();
for (const match of dataFile.matchAll(/^\s*"((?:[^"\\]|\\.)*)":\s*"(?:[^"\\]|\\.)*",/gm)) {
  phraseKeys.add(match[1]);
}

/* Word-map coverage for an Arabic twin (mirrors urduFromArabic's 55% rule). */
const wordKeys = new Set(
  [...dataFile.matchAll(/^\s*"?([^\s":]+)"?:\s*"[^"]*",/gm)].map((m) => m[1]),
);
function dataCovered(ar) {
  if (!ar) return false;
  if (phraseKeys.has(ar)) return true;
  const tokens = ar
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .split(/(\s+|[·،,:؛.()\-–—/])/g)
    .filter((t) => /[\u0600-\u06FF]/.test(t));
  if (tokens.length === 0) return false;
  const known = tokens.filter((t) => wordKeys.has(t)).length;
  return known / tokens.length >= 0.55;
}

let exactCount = 0;
let dataCount = 0;
const missing = [];
for (const [en, { ar }] of callSites) {
  if (exact.has(en)) {
    exactCount += 1;
  } else if (dataCovered(ar)) {
    dataCount += 1;
  } else {
    missing.push({ en, ar, count: callSites.get(en).count });
  }
}

const total = callSites.size;
const covered = exactCount + dataCount;
const pct = ((covered / total) * 100).toFixed(1);

console.log("──────────────────────────────────────────────");
console.log(`  Urdu coverage audit — ${files.length} source files`);
console.log("──────────────────────────────────────────────");
console.log(`  distinct English strings   : ${total}`);
console.log(`  exact Urdu glossary entries: ${exactCount}`);
console.log(`  resolved via data map      : ${dataCount}`);
console.log(`  falling back to English    : ${missing.length}`);
console.log(`  coverage                   : ${pct}%`);
console.log("──────────────────────────────────────────────");

if (shouldList) {
  missing
    .sort((a, b) => b.count - a.count)
    .forEach((m) => console.log(`  ${m.count}×  ${m.en}`));
}

export const audit = { total, exactCount, dataCount, missing, coverage: Number(pct) / 100 };
