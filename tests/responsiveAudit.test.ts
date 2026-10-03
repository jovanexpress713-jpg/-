import assert from "assert";
import fs from "fs";
import path from "path";

/**
 * EJAZ Transport — responsive layout audit.
 *
 * No browser engine is available in CI, so instead of eyeballing viewports this
 * suite enforces the structural invariants that cause (or prevent) horizontal
 * overflow on a 320px phone. Every rule below is derived from a concrete failure
 * mode:
 *
 *   1. A fixed pixel width wider than the narrowest supported viewport must be
 *      either capped by the viewport or hidden until a wider breakpoint.
 *   2. A fixed-pixel grid track must only apply at `lg:` and above.
 *   3. An `auto-fill` track must be `minmax(min(Npx,100%),1fr)`, never a bare
 *      `minmax(Npx,1fr)` — a bare one overflows below N.
 *   4. Horizontal scrollers must be opt-in containers, never the page itself.
 */

const NARROWEST = 320; // px — the smallest viewport the product must survive

const root = process.cwd();

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** Strips a class string of every variant-prefixed utility (sm:, lg:, md:…). */
function unprefixedClasses(raw: string): string[] {
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .filter((c) => !/^(sm|md|lg|xl|2xl|hover|focus|active|group-hover|rtl|ltr):/.test(c));
}

/** Splits a grid template on top-level separators, ignoring nested parens. */
function splitTopLevel(template: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of template) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (depth === 0 && (ch === "," || ch === "_")) {
      out.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  out.push(buf);
  return out;
}

/** Collects `className="…"` literals from a component source file. */
function classLiterals(source: string): string[] {
  const out: string[] = [];
  const re = /className=(?:"([^"]*)"|\{cn\(([\s\S]*?)\)\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    out.push(m[1] ?? m[2] ?? "");
  }
  return out;
}

export function runResponsiveAudit() {
  console.log("  [TEST] Running Responsive Layout Audit...");

  const offenders: string[] = [];
  const files = sourceFiles(path.join(root, "src"));

  /* 1. Fixed pixel widths that cannot fit a 320px viewport.
        `max-w-[Npx]` is a cap, not a floor — it never overflows, so it is fine. */
  const widthRe = /(?<![-\w])(?:min-)?w-\[(\d+)px\]/g;
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const rel = path.relative(root, file);
    for (const raw of classLiterals(source)) {
      for (const cls of unprefixedClasses(raw)) {
        widthRe.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = widthRe.exec(cls))) {
          const px = Number(m[1]);
          if (px <= NARROWEST) continue;
          // Allowed when the same literal also caps itself to the viewport, or
          // when the element is `hidden` at base and only revealed from a wide
          // breakpoint up (so it can never be laid out on a phone).
          const capped = /\bmax-w-(?:full|\[min\()|\bmax-w-\[calc\(/.test(raw);
          const wideOnly =
            /(^|\s)hidden(\s|$)/.test(raw) &&
            /\b(?:lg|xl|2xl):(?:block|flex|grid|inline-flex)\b/.test(raw);
          if (!capped && !wideOnly) {
            offenders.push(`${rel}: unguarded w-[${px}px] (viewport ${NARROWEST}px)`);
          }
        }
      }
    }
  }

  /* 2. Fixed-pixel grid tracks must be breakpoint-scoped. Only a *bare* pixel
        track overflows; `minmax(min(Npx,100%),1fr)` and `minmax(0,1fr)` do not. */
  const bareTrack = (template: string) =>
    splitTopLevel(template).some((track) => /^\d+px$/.test(track.trim()));
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const rel = path.relative(root, file);
    for (const raw of classLiterals(source)) {
      const re = /(?<![-\w:])([\w-]*:)?grid-cols-\[([^\]]*)\]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(raw))) {
        const scoped = Boolean(m[1]); // sm: / lg: / xl: …
        if (!scoped && bareTrack(m[2])) {
          offenders.push(`${rel}: grid-cols-[${m[2]}] has a bare pixel track with no breakpoint`);
        }
      }
    }
  }

  /* 3. auto-fill tracks must clamp to the viewport. */
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const rel = path.relative(root, file);
    const re = /minmax\((\d+)px,\s*1fr\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) {
      if (Number(m[1]) > NARROWEST) {
        offenders.push(
          `${rel}: minmax(${m[1]}px,1fr) must be minmax(min(${m[1]}px,100%),1fr)`
        );
      }
    }
  }

  /* 4. The document itself must be the overflow guard. */
  const css = fs.readFileSync(path.join(root, "src", "index.css"), "utf8");
  assert.match(css, /html \{ overflow-x: clip; \}/, "the document must clip sideways overflow");

  assert.deepStrictEqual(
    offenders,
    [],
    `responsive overflow risks remain:\n      ${offenders.join("\n      ")}`
  );

  console.log("  ✓ Responsive Layout Audit Passed Successfully!");
}
