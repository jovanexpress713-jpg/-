import assert from "assert";
import fs from "fs";
import path from "path";

/**
 * EJAZ Transport — canonical design-scale guard.
 *
 * Closes the two items `docs/EJAZ_CONSOLE_VISUAL_AUDIT.md` still listed as
 * open: §1 (eleven competing `rounded-[Npx]` values across 450 call sites)
 * and §3 (twenty-five competing `text-[Npx]` values across 1,423 call sites,
 * half of them half-pixel steps the eye cannot separate).
 *
 * The migration itself is `scripts/migrate-design-tokens.mjs`. This file does
 * NOT reuse that script's regexes on purpose: a guard that shares a parser
 * with the thing it guards proves nothing. Everything here re-derives the
 * answer from the stylesheet and a fresh scan of the tree.
 *
 *  A. The scale exists, is ordered, is integral, and has an Arabic-legibility
 *     floor.
 *  B. Every legacy token is an alias onto the scale, not a second copy of it.
 *  C. Nothing in `src/` is off-scale: no arbitrary px size, and no Tailwind
 *     default size utility duplicating a canonical step under another name.
 *  D. Every scale utility actually used is actually declared — a typo such as
 *     `text-lable` emits no CSS at all and silently renders at the inherited
 *     size, which is the failure mode a scale migration is most likely to
 *     introduce.
 *  E. The deliberate exemptions are still deliberate.
 */

const root = process.cwd();
const SRC = path.join(root, "src");
const CSS_PATH = path.join(SRC, "index.css");

/* ── The scale, pinned ───────────────────────────────────────────────────── */

const TEXT_STEPS: Record<string, number> = {
  micro: 10,
  label: 11,
  "label-lg": 12,
  body: 13,
  "card-title": 14,
  "page-title": 16,
  "section-title": 18,
  headline: 20,
  "hero-sm": 22,
  hero: 26,
  metric: 28,
  "metric-lg": 36,
};

const RADIUS_STEPS: Record<string, number> = {
  micro: 6,
  chip: 8,
  control: 10,
  inner: 12,
  panel: 16,
  card: 20,
  hero: 24,
};

/** Tailwind's own size utilities, and the canonical step each one duplicates. */
const DEFAULT_TEXT_DUPLICATES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];
const DEFAULT_RADIUS_DUPLICATES = ["md", "lg", "xl", "2xl", "3xl"];

/**
 * The only off-scale radii allowed to survive, with the reason each exists.
 * `rounded-es-sm` / `rounded-ee-sm` are the squared "tail" corner of a chat
 * bubble (DispatchChatCenter) — a 4px notch that reads as the bubble's
 * direction cue, below the 6px scale floor by design.
 */
const RADIUS_EXEMPTIONS = new Set(["rounded-es-sm", "rounded-ee-sm"]);

const ALIGNMENT_AND_KEYWORDS = new Set([
  "center",
  "start",
  "end",
  "left",
  "right",
  "justify",
  "wrap",
  "nowrap",
  "balance",
  "pretty",
  "ellipsis",
  "clip",
  "transparent",
  "current",
  "inherit",
  "initial",
  "unset",
]);

/**
 * Raw CSS properties that start with `text-`. These appear in inline `style`
 * attributes and in the pre-stylesheet boot surface, never as Tailwind
 * utilities, and must not be reported as misspelled scale steps.
 */
const CSS_TEXT_PROPERTIES = new Set([
  "align",
  "anchor",
  "combine-upright",
  "decoration",
  "emphasis",
  "indent",
  "justify",
  "orientation",
  "overflow",
  "rendering",
  "shadow",
  "size-adjust",
  "transform",
  "underline-offset",
  "wrap",
]);

const TAILWIND_PALETTE = new Set([
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "white",
  "black",
]);

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", ".vite", "coverage"]);

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(full);
    } else if (/\.(tsx?|jsx?|html)$/.test(entry.name)) {
      yield full;
    }
  }
}

function sourceFiles(): string[] {
  return [...walk(SRC), path.join(root, "index.html")];
}

/** Reads `--name: value;` from a CSS string. */
function token(css: string, name: string): string {
  const m = css.match(new RegExp(`${name.replace(/-/g, "\\-")}:\\s*([^;]+);`));
  assert.ok(m, `token ${name} must be declared in src/index.css`);
  return m![1].trim();
}

/** Pulls every `--text-*` / `--radius-*` declaration out of the @theme block. */
function themeBlock(css: string): string {
  const start = css.indexOf("@theme static {");
  assert.ok(start >= 0, "src/index.css must declare the scale in an `@theme static` block");
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

function declaredSteps(block: string, namespace: "text" | "radius"): Map<string, number> {
  const found = new Map<string, number>();
  const re = new RegExp(`--${namespace}-([a-z0-9-]+):\\s*([^;]+);`, "g");
  for (const m of block.matchAll(re)) {
    const value = m[2].trim();
    const px = /^(\d+(?:\.\d+)?)px$/.exec(value);
    assert.ok(px, `--${namespace}-${m[1]} must be a plain px value, got "${value}"`);
    found.set(m[1], Number.parseFloat(px![1]));
  }
  return found;
}

/* ── A. The scale itself ─────────────────────────────────────────────────── */

function testScaleShape() {
  const css = fs.readFileSync(CSS_PATH, "utf8");
  const block = themeBlock(css);

  const text = declaredSteps(block, "text");
  const radius = declaredSteps(block, "radius");

  /* A1. Exactly the pinned steps — no strays, none missing. */
  assert.deepStrictEqual(
    Object.fromEntries([...text.entries()].sort()),
    Object.fromEntries(Object.entries(TEXT_STEPS).sort()),
    "the --text-* scale in src/index.css must match the pinned canonical scale",
  );
  assert.deepStrictEqual(
    Object.fromEntries([...radius.entries()].sort()),
    Object.fromEntries(Object.entries(RADIUS_STEPS).sort()),
    "the --radius-* scale in src/index.css must match the pinned canonical scale",
  );

  /* A2. Ordered, and integral. The audit's whole complaint (§3) was that
         10 / 10.5 / 11 / 11.5 / 12 / 12.5 are three sizes the eye reads as
         one, so a fractional step is a defect, not a nuance. */
  for (const [namespace, steps] of [
    ["text", text],
    ["radius", radius],
  ] as const) {
    const values = [...steps.values()];
    values.forEach((v, i) => {
      assert.ok(Number.isInteger(v), `--${namespace} step ${i} must be a whole px, got ${v}`);
      if (i > 0) {
        assert.ok(
          v > values[i - 1],
          `--${namespace} steps must strictly increase: ${values[i - 1]} then ${v}`,
        );
      }
    });
  }

  /* A3. The Arabic floor. `index.html` ships `lang="ar" dir="rtl"`: connected
         glyphs and diacritics lose their counters below 10px, which is why the
         scale starts there and not at the 9px the old console used. */
  const smallest = Math.min(...text.values());
  assert.ok(smallest >= 10, `no type step may sit below 10px, found ${smallest}px`);
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /lang="ar"/, "the 10px floor is justified by the document language");

  /* A4. `static` matters: the legacy `--ds-*` / `--type-*` aliases below point
         at these variables, and Tailwind tree-shakes unused theme variables
         unless the block is declared static. */
  assert.match(css, /@theme static \{/, "the scale block must be @theme static");
}

/* ── B. Legacy tokens are aliases, not copies ────────────────────────────── */

function testLegacyAliases() {
  const css = fs.readFileSync(CSS_PATH, "utf8");

  const expectedAliases: Record<string, string> = {
    "--ds-text-label": "var(--text-label)",
    "--ds-text-label-lg": "var(--text-label-lg)",
    "--ds-text-card-title": "var(--text-card-title)",
    "--ds-text-body": "var(--text-body)",
    "--ds-text-metric": "var(--text-metric)",
    "--ds-text-metric-lg": "var(--text-metric-lg)",
    "--ds-radius-sm": "var(--radius-micro)",
    "--ds-radius-md": "var(--radius-inner)",
    "--ds-radius-lg": "var(--radius-panel)",
    "--ds-radius-xl": "var(--radius-hero)",
    "--ds-radius-card": "var(--radius-card)",
    "--ds-radius-panel": "var(--radius-panel)",
    "--ds-radius-inner": "var(--radius-inner)",
    "--type-page-title": "var(--text-page-title)",
    "--type-card-title": "var(--text-card-title)",
    "--type-body": "var(--text-body)",
    "--type-label": "var(--text-label)",
    "--type-micro": "var(--text-micro)",
    "--type-tagline": "var(--text-label-lg)",
  };

  for (const [name, want] of Object.entries(expectedAliases)) {
    assert.strictEqual(
      token(css, name),
      want,
      `${name} must alias onto the canonical scale, not restate a px value`,
    );
  }

  /* B2. No half-pixel type value survives anywhere in the stylesheet — that
         includes the 11.5 / 10.5 / 12.5 this file used to carry on its own. */
  const halfPx = [...css.matchAll(/--(?:ds-|type-)?text-[a-z-]+:\s*(\d+\.\d+)px/g)];
  assert.deepStrictEqual(
    halfPx.map((m) => m[0]),
    [],
    "no fractional-px type token may remain in src/index.css",
  );
}

/* ── C. Nothing off-scale in the tree ────────────────────────────────────── */

function testNothingOffScale() {
  const arbitraryText: string[] = [];
  const arbitraryRadius: string[] = [];
  const defaultText: string[] = [];
  const defaultRadius: string[] = [];

  const arbitraryTextRe = /text-\[\d+(?:\.\d+)?(?:px|rem|em)\]/g;
  const arbitraryRadiusRe = /rounded(?:-[a-z]{1,2})?-\[\d+(?:\.\d+)?(?:px|rem|em)\]/g;
  const defaultTextRe = /(?<![\w:-])text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)(?![\w-])/g;
  const defaultRadiusRe = new RegExp(
    `(?<![\\w:-])rounded(?:-[a-z]{1,2})?-(?:${DEFAULT_RADIUS_DUPLICATES.join("|")})(?![\\w-])`,
    "g",
  );

  for (const file of sourceFiles()) {
    const rel = path.relative(root, file);
    const code = fs.readFileSync(file, "utf8");
    const lines = code.split("\n");

    lines.forEach((line, i) => {
      const at = `${rel}:${i + 1}`;
      for (const m of line.matchAll(arbitraryTextRe)) arbitraryText.push(`${at} ${m[0]}`);
      for (const m of line.matchAll(arbitraryRadiusRe)) arbitraryRadius.push(`${at} ${m[0]}`);
      for (const m of line.matchAll(defaultTextRe)) defaultText.push(`${at} ${m[0]}`);
      for (const m of line.matchAll(defaultRadiusRe)) {
        if (!RADIUS_EXEMPTIONS.has(m[0])) defaultRadius.push(`${at} ${m[0]}`);
      }
    });
  }

  assert.deepStrictEqual(
    arbitraryText,
    [],
    "every font size must be a canonical step — no text-[Npx] anywhere in src/",
  );
  assert.deepStrictEqual(
    arbitraryRadius,
    [],
    "every radius must be a canonical step — no rounded-[Npx] anywhere in src/",
  );
  assert.deepStrictEqual(
    defaultText,
    [],
    `Tailwind's default sizes duplicate the canonical scale under a second name ` +
      `(${DEFAULT_TEXT_DUPLICATES.join("/")}) — fold them with ` +
      "`node scripts/migrate-design-tokens.mjs`",
  );
  assert.deepStrictEqual(
    defaultRadius,
    [],
    `Tailwind's default radii duplicate the canonical scale under a second name ` +
      `(${DEFAULT_RADIUS_DUPLICATES.join("/")}) — fold them with ` +
      "`node scripts/migrate-design-tokens.mjs`",
  );
}

/* ── D. Every utility used is declared ───────────────────────────────────── */

function testUsedUtilitiesAreDeclared() {
  const css = fs.readFileSync(CSS_PATH, "utf8");

  const colorNames = new Set(
    [...css.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1]),
  );

  const unknownText: string[] = [];
  const unknownRadius: string[] = [];

  const textRe = /(?<![\w-])text-([a-zA-Z0-9[\]/.()%,_-]+)/g;
  const radiusRe = /(?<![\w-])rounded-([a-zA-Z0-9[\]/.()%,_-]+)/g;

  for (const file of sourceFiles()) {
    const rel = path.relative(root, file);
    const code = fs.readFileSync(file, "utf8");
    code.split("\n").forEach((line, i) => {
      const at = `${rel}:${i + 1}`;

      for (const m of line.matchAll(textRe)) {
        const suffix = m[1];
        if (suffix.startsWith("[")) continue; // arbitrary value, covered in C
        const base = suffix.split("/")[0]; // strip an opacity modifier
        if (TEXT_STEPS[base] !== undefined) continue; // a canonical step
        /* The colour tokens are themselves named `--color-text-primary`, so
           their utility is `text-text-primary` — one `text-` of the pair is
           the namespace and the other is part of the colour's own name. */
        if (colorNames.has(base) || colorNames.has(base.replace(/^text-/, ""))) continue;
        if (ALIGNMENT_AND_KEYWORDS.has(base)) continue; // text-center & friends
        if (CSS_TEXT_PROPERTIES.has(base)) continue; // raw CSS in a style="" attribute
        const family = base.replace(/-\d+$/, "");
        if (TAILWIND_PALETTE.has(family)) continue; // a framework colour
        unknownText.push(`${at} text-${suffix}`);
      }

      for (const m of line.matchAll(radiusRe)) {
        const suffix = m[1];
        if (suffix.startsWith("[")) continue;
        const base = suffix.split("/")[0];
        const step = base.replace(/^(?:[a-z]{1,2}-)/, ""); // strip a side (t, es, …)
        if (RADIUS_STEPS[step] !== undefined) continue;
        if (base === "full" || base === "none") continue;
        if (RADIUS_EXEMPTIONS.has(`rounded-${base}`)) continue;
        unknownRadius.push(`${at} rounded-${suffix}`);
      }
    });
  }

  assert.deepStrictEqual(
    unknownText,
    [],
    "these text-* classes are neither a canonical step, a colour, nor an alignment — " +
      "a misspelled step emits no CSS and silently renders at the inherited size",
  );
  assert.deepStrictEqual(
    unknownRadius,
    [],
    "these rounded-* classes are neither a canonical step nor a documented exemption",
  );
}

/* ── E. The exemptions stay deliberate ───────────────────────────────────── */

function testDeliberateExemptions() {
  /* E1. SVG <text> is sized in viewBox user units, which scale with the
         graphic and are not page px. The codemod must never have touched
         them, or the capacity figure would resize with the viewport. */
  const truck = fs.readFileSync(path.join(SRC, "components", "CapacityTruck.tsx"), "utf8");
  assert.match(
    truck,
    /fontSize/,
    "CapacityTruck must still size its SVG <text> numerically — those are viewBox units, not the CSS scale",
  );
  assert.ok(
    !/className="[^"]*text-(micro|label|body|metric)/.test(truck.split("<svg")[1] ?? ""),
    "no SVG text element may carry a CSS type-scale utility",
  );

  /* E2. The chat-bubble notch is still there, and still exactly two sites. */
  const chat = fs.readFileSync(path.join(SRC, "components", "DispatchChatCenter.tsx"), "utf8");
  assert.match(chat, /rounded-ee-sm/, "the outgoing bubble keeps its squared tail corner");
  assert.match(chat, /rounded-es-sm/, "the incoming bubble keeps its squared tail corner");

  /* E3. `rounded-full` is a shape, not a step, and stays a framework token. */
  const fullCount = sourceFiles().reduce((n, f) => {
    const code = fs.readFileSync(f, "utf8");
    return n + (code.match(/(?<![\w:-])rounded-full(?![\w-])/g) ?? []).length;
  }, 0);
  assert.ok(fullCount > 100, `pills and avatars must still use rounded-full (found ${fullCount})`);

  /* E4. `index.html` is the one surface allowed to carry literal px: the boot
         splash and the startup-failure overlay both render *before* the
         stylesheet exists, so they cannot resolve a `var(--text-*)`. That is a
         real exemption, so it gets a real assertion instead of a blind spot —
         every literal there must still be a canonical step, otherwise the
         splash and the app it hands over to disagree by half a pixel (which is
         exactly what the 12.5px tagline used to do). */
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const textSteps = new Set(Object.values(TEXT_STEPS));
  const radiusSteps = new Set([...Object.values(RADIUS_STEPS), 9999]);

  const htmlFontSizes = [...html.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) =>
    Number.parseFloat(m[1]),
  );
  const htmlRadii = [...html.matchAll(/border-radius:\s*(\d+(?:\.\d+)?)px/g)].map((m) =>
    Number.parseFloat(m[1]),
  );
  assert.ok(htmlFontSizes.length > 0, "the boot surface should still declare its own type sizes");
  for (const px of htmlFontSizes) {
    assert.ok(
      textSteps.has(px),
      `index.html renders ${px}px before the stylesheet loads — that is not a canonical step ` +
        `(${[...textSteps].sort((a, b) => a - b).join("/")}px)`,
    );
  }
  for (const px of htmlRadii) {
    assert.ok(
      radiusSteps.has(px),
      `index.html uses a ${px}px radius — use a canonical step, or 9999px for a pill`,
    );
  }
}

/* ── Runner ──────────────────────────────────────────────────────────────── */

export function runDesignScaleTests() {
  console.log("  [TEST] Running Canonical Design-Scale Tests (type §3 + radius §1)...");

  testScaleShape();
  testLegacyAliases();
  testNothingOffScale();
  testUsedUtilitiesAreDeclared();
  testDeliberateExemptions();

  const files = sourceFiles().length;
  const textSites = Object.keys(TEXT_STEPS).length;
  const radiusSites = Object.keys(RADIUS_STEPS).length;
  console.log(
    `  ✓ Canonical Design-Scale Tests Passed — ${files} files scanned, ` +
      `${textSites} type steps, ${radiusSites} radius steps, 0 off-scale call sites.`,
  );
}
