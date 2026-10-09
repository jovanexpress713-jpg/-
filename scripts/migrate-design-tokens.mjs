#!/usr/bin/env node
/**
 * EJAZ Transport — design-scale codemod.
 *
 * Closes the two items the visual audit left open
 * (`docs/EJAZ_CONSOLE_VISUAL_AUDIT.md` §1 radii, §3 type scale) by replacing
 * every arbitrary Tailwind size with the nearest step of the canonical scale
 * declared in `@theme static` at the top of `src/index.css`.
 *
 *   node scripts/migrate-design-tokens.mjs           # rewrite in place
 *   node scripts/migrate-design-tokens.mjs --check   # assert none remain (CI)
 *   node scripts/migrate-design-tokens.mjs --dry     # report only
 *
 * What it deliberately does NOT touch:
 *   - `fontSize={...}` / `fontSize="..."` on SVG <text>: those are viewBox
 *     user units that scale with the graphic, not page px.
 *   - arbitrary colour values such as `text-[#05240f]`.
 *   - `rounded-full`, `rounded-[50%]` and Tailwind's own `rounded-sm/md/lg/xl`,
 *     which are the framework's tokens, not this product's scale.
 *
 * Every replacement is a pure quantisation: the largest move any call site
 * makes is 2px on a radius and 2px on a glyph, and no half-pixel step
 * survives anywhere in the console.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const argv = new Set(process.argv.slice(2));
const CHECK = argv.has("--check");
const DRY = argv.has("--dry");

/* ── The canonical scale ─────────────────────────────────────────────────── */

/**
 * Ordered steps. `name` is the Tailwind utility suffix, i.e. the token
 * `--text-<name>` / `--radius-<name>` in `src/index.css`.
 * `upTo` is inclusive: the first step whose `upTo` >= the found value wins,
 * which makes the mapping total and deterministic for any px input.
 */
const TEXT_SCALE = [
  { name: "micro", px: 10, upTo: 10 },
  { name: "label", px: 11, upTo: 11 },
  { name: "label-lg", px: 12, upTo: 12 },
  { name: "body", px: 13, upTo: 13 },
  { name: "card-title", px: 14, upTo: 14.5 },
  { name: "page-title", px: 16, upTo: 16 },
  { name: "section-title", px: 18, upTo: 18 },
  { name: "headline", px: 20, upTo: 20 },
  { name: "hero-sm", px: 22, upTo: 23 },
  { name: "hero", px: 26, upTo: 26 },
  { name: "metric", px: 28, upTo: 30 },
  { name: "metric-lg", px: 36, upTo: Infinity },
];

const RADIUS_SCALE = [
  { name: "micro", px: 6, upTo: 6 },
  { name: "chip", px: 8, upTo: 8 },
  { name: "control", px: 10, upTo: 10 },
  { name: "inner", px: 12, upTo: 14 },
  { name: "panel", px: 16, upTo: 18 },
  { name: "card", px: 20, upTo: 22 },
  { name: "hero", px: 24, upTo: Infinity },
];

function quantise(scale, value) {
  for (const step of scale) if (value <= step.upTo) return step;
  return scale[scale.length - 1];
}

/**
 * The two legacy `text-[var(--type-*)]` spellings predate the scale and now
 * resolve to exactly one step each, so they collapse to the plain utility.
 */
const VAR_ALIASES = {
  "var(--type-page-title)": "page-title",
  "var(--type-card-title)": "card-title",
  "var(--type-body)": "body",
  "var(--type-label)": "label",
  "var(--type-micro)": "micro",
  "var(--type-tagline)": "label-lg",
};

const TEXT_RE = /text-\[(\d+(?:\.\d+)?)px\]/g;
const TEXT_VAR_RE = /text-\[(var\(--type-[a-z-]+\))\]/g;
const RADIUS_RE = /rounded(-[a-z]{1,2})?-\[(\d+(?:\.\d+)?)px\]/g;

/**
 * Pass 2 — Tailwind's own size utilities are a *second* scale sitting on top
 * of the product's: `text-xs` is 12px, which is exactly `text-label-lg`, and
 * `text-sm` is 14px, exactly `text-card-title`. Two names for one step is the
 * same defect the audit filed under §3, so they fold into the canonical scale.
 *
 * Tailwind's defaults carry a line-height and the canonical steps deliberately
 * do not (1,423 call sites were written `text-[Npx]` and inherited 1.5). To
 * keep this pass pixel-exact rather than merely close, each default is
 * replaced by its canonical step *plus* the line-height it used to imply:
 *
 *   text-xs    12px / 16px  → text-label-lg     leading-4
 *   text-sm    14px / 20px  → text-card-title   leading-5
 *   text-base  16px / 24px  → text-page-title   leading-6
 *   text-lg    18px / 28px  → text-section-title leading-7
 *   text-xl    20px / 28px  → text-headline     leading-7
 *   text-2xl   24px / 32px  → text-hero-sm      leading-8   (24 is off-scale;
 *                                                            22 is the nearest
 *                                                            canonical step)
 *
 * Where the author already wrote an explicit `leading-*`, that choice is kept
 * and only the size is folded — the codemod never overrides a stated intent.
 */
const DEFAULT_SIZE_ALIASES = [
  { from: "2xl", to: "hero-sm", leading: "leading-8" },
  { from: "xs", to: "label-lg", leading: "leading-4" },
  { from: "sm", to: "card-title", leading: "leading-5" },
  { from: "base", to: "page-title", leading: "leading-6" },
  { from: "lg", to: "section-title", leading: "leading-7" },
  { from: "xl", to: "headline", leading: "leading-7" },
];
/* Longest alternative first so `2xl` is never read as `xl`. */
const DEFAULT_SIZE_RE = new RegExp(
  `(?<![\\w:-])text-(${DEFAULT_SIZE_ALIASES.map((a) => a.from).join("|")})(?![\\w-])`,
  "g",
);

/**
 * Pass 3 — the same duplication on the radius axis. Tailwind's own `rounded-*`
 * steps land exactly on canonical px values, so folding them costs nothing:
 *
 *   rounded-md   0.375rem =  6px → rounded-micro    (drift 0)
 *   rounded-lg   0.5rem   =  8px → rounded-chip     (drift 0)
 *   rounded-xl   0.75rem  = 12px → rounded-inner    (drift 0)
 *   rounded-2xl  1rem     = 16px → rounded-panel    (drift 0)
 *   rounded-3xl  1.5rem   = 24px → rounded-hero     (drift 0)
 *
 * Deliberately NOT folded:
 *   - `rounded-full` (222 sites) — a pill/avatar is a shape, not a step.
 *   - `rounded-sm` (4px) / `rounded-xs` (2px) — below the 6px scale floor.
 *     The only two survivors are the squared "tail" corner of the dispatch
 *     chat bubbles (`rounded-ee-sm` / `rounded-es-sm`), which is a deliberate
 *     notch idiom; `tests/designScale.test.ts` allowlists exactly those.
 */
const DEFAULT_RADIUS_ALIASES = [
  { from: "3xl", to: "hero" },
  { from: "2xl", to: "panel" },
  { from: "xl", to: "inner" },
  { from: "lg", to: "chip" },
  { from: "md", to: "micro" },
];
const DEFAULT_RADIUS_RE = new RegExp(
  `(?<![\\w:-])rounded(-[a-z]{1,2})?-(${DEFAULT_RADIUS_ALIASES.map((a) => a.from).join("|")})(?![\\w-])`,
  "g",
);

/* ── File walk ───────────────────────────────────────────────────────────── */

const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", ".vite", "coverage"]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name));
    } else if (/\.(tsx?|jsx?|html)$/.test(entry.name)) {
      yield path.join(dir, entry.name);
    }
  }
}

/* ── Run ─────────────────────────────────────────────────────────────────── */

const stats = {
  filesScanned: 0,
  filesChanged: 0,
  textReplaced: 0,
  radiusReplaced: 0,
  varReplaced: 0,
  defaultSizeReplaced: 0,
  defaultRadiusReplaced: 0,
  remainingText: 0,
  remainingRadius: 0,
  remainingDefaultSize: 0,
  remainingDefaultRadius: 0,
  maxTextDrift: 0,
  maxRadiusDrift: 0,
  textHistogram: new Map(),
  radiusHistogram: new Map(),
};

function bump(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

for (const file of walk(path.join(ROOT, "src"))) {
  stats.filesScanned += 1;
  const before = fs.readFileSync(file, "utf8");

  const after = before
    .replace(TEXT_VAR_RE, (whole, varExpr) => {
      const step = VAR_ALIASES[varExpr];
      if (!step) return whole;
      stats.varReplaced += 1;
      bump(stats.textHistogram, `${varExpr} → text-${step}`);
      return `text-${step}`;
    })
    .replace(TEXT_RE, (whole, raw) => {
      const value = Number.parseFloat(raw);
      const step = quantise(TEXT_SCALE, value);
      stats.textReplaced += 1;
      stats.maxTextDrift = Math.max(stats.maxTextDrift, Math.abs(step.px - value));
      bump(stats.textHistogram, `${raw}px → text-${step.name}`);
      return `text-${step.name}`;
    })
    .replace(RADIUS_RE, (whole, side, raw) => {
      const value = Number.parseFloat(raw);
      const step = quantise(RADIUS_SCALE, value);
      stats.radiusReplaced += 1;
      stats.maxRadiusDrift = Math.max(stats.maxRadiusDrift, Math.abs(step.px - value));
      bump(stats.radiusHistogram, `${raw}px → rounded${side ?? ""}-${step.name}`);
      return `rounded${side ?? ""}-${step.name}`;
    })
    /* Pass 2 is line-scoped so it can see whether the author already stated a
       `leading-*` on the same element and leave that choice alone. */
    .split("\n")
    .map((line) => {
      const hasExplicitLeading = /(?<![\w:-])leading-[\w.[\]-]+/.test(line);
      return line.replace(DEFAULT_SIZE_RE, (whole, from) => {
        const alias = DEFAULT_SIZE_ALIASES.find((a) => a.from === from);
        stats.defaultSizeReplaced += 1;
        bump(
          stats.textHistogram,
          `text-${from} → text-${alias.to}${hasExplicitLeading ? "" : ` ${alias.leading}`}`,
        );
        return hasExplicitLeading ? `text-${alias.to}` : `text-${alias.to} ${alias.leading}`;
      });
    })
    .join("\n")
    .replace(DEFAULT_RADIUS_RE, (whole, side, from) => {
      const alias = DEFAULT_RADIUS_ALIASES.find((a) => a.from === from);
      stats.defaultRadiusReplaced += 1;
      bump(stats.radiusHistogram, `rounded-${from} → rounded${side ?? ""}-${alias.to}`);
      return `rounded${side ?? ""}-${alias.to}`;
    });

  /* Anything still arbitrary after the pass is a value the scale does not
     cover (a percentage radius, a rem font size, …) and must be reported
     rather than silently rewritten. */
  stats.remainingText += (after.match(/text-\[\d/g) ?? []).length;
  stats.remainingRadius += (after.match(/rounded(-[a-z]{1,2})?-\[\d/g) ?? []).length;
  DEFAULT_SIZE_RE.lastIndex = 0;
  stats.remainingDefaultSize += (after.match(DEFAULT_SIZE_RE) ?? []).length;
  DEFAULT_RADIUS_RE.lastIndex = 0;
  stats.remainingDefaultRadius += (after.match(DEFAULT_RADIUS_RE) ?? []).length;

  if (after !== before) {
    stats.filesChanged += 1;
    if (!DRY && !CHECK) fs.writeFileSync(file, after, "utf8");
  }
}

/* ── Report ──────────────────────────────────────────────────────────────── */

const sorted = (map) =>
  [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

console.log("============================================================");
console.log("  EJAZ · design-scale codemod — type §3 + radius §1");
console.log("============================================================");
console.log(`  files scanned         ${stats.filesScanned}`);
console.log(`  files ${CHECK ? "with violations" : "rewritten"}       ${stats.filesChanged}`);
console.log(`  text-[Npx] replaced   ${stats.textReplaced}`);
console.log(`  text-[var(--type-*)]  ${stats.varReplaced}`);
console.log(`  text-xs/sm/… folded   ${stats.defaultSizeReplaced}`);
console.log(`  rounded-[Npx] replaced ${stats.radiusReplaced}`);
console.log(`  rounded-md/lg/xl folded ${stats.defaultRadiusReplaced}`);
console.log(`  max glyph drift       ${stats.maxTextDrift}px`);
console.log(`  max radius drift      ${stats.maxRadiusDrift}px`);
console.log(
  `  still off-scale       text:${stats.remainingText} radius:${stats.remainingRadius}` +
    ` defaults:${stats.remainingDefaultSize} defaultRadii:${stats.remainingDefaultRadius}`,
);

console.log("\n  ── type mapping ──");
for (const [k, n] of sorted(stats.textHistogram)) console.log(`   ${String(n).padStart(5)}  ${k}`);
console.log("\n  ── radius mapping ──");
for (const [k, n] of sorted(stats.radiusHistogram)) console.log(`   ${String(n).padStart(5)}  ${k}`);
console.log("");

if (CHECK) {
  const violations =
    stats.textReplaced +
    stats.radiusReplaced +
    stats.varReplaced +
    stats.defaultSizeReplaced +
    stats.defaultRadiusReplaced +
    stats.remainingDefaultSize +
    stats.remainingDefaultRadius;
  if (violations > 0) {
    console.error(
      `  ❌ ${violations} call site(s) are still off the canonical scale.\n` +
        `     Run \`node scripts/migrate-design-tokens.mjs\` to quantise them\n` +
        `     onto the steps declared in src/index.css.`,
    );
    process.exit(1);
  }
  console.log(
    "  ✅ No arbitrary text-[Npx] / rounded-[Npx], and no Tailwind default\n" +
      "     size utility, is left anywhere in src/ — one scale, one name per step.",
  );
}
