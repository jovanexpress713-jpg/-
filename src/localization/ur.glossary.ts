/**
 * Urdu resolution layer.
 *
 * The console carries two families of user-facing text:
 *
 *  1. ~1000 legacy `t("English", "العربية")` call sites — resolved here by
 *     looking the English source string up in `UR_EN`, then the Arabic source
 *     in the data map (`urdu/data.ts`).
 *  2. Data-layer strings coming from `fleetStore` / the fleet catalogue, which
 *     arrive as an Arabic/English pair — resolved by `urduForArabic` first and
 *     the English twin as a last resort.
 *
 * Nothing is ever left in Arabic inside an Urdu session: if no Urdu form can be
 * produced, the English source is used, and `i18n audit` (tests/i18n.test.ts)
 * reports the residual list so the glossary can keep growing.
 */
import { UR_SHELL } from "./urdu/shell";
import { UR_OPS } from "./urdu/ops";
import { UR_MOBILE } from "./urdu/mobile";
import { UR_ORGANIZATION } from "./urdu/organization";
import { urduFromArabic, UR_AR_PHRASES } from "./urdu/data";
import { urduFromTemplate } from "./urdu/templates";

export const UR_EN: Record<string, string> = {
  ...UR_SHELL,
  ...UR_OPS,
  ...UR_MOBILE,
  ...UR_ORGANIZATION,
};

/** Exact Urdu for an Arabic source string, when one was authored. */
export function urduPhrase(ar?: string): string | null {
  if (!ar) return null;
  const key = ar.replace(/[\u064B-\u0652\u0670\u0640]/g, "");
  return UR_AR_PHRASES[ar] ?? UR_AR_PHRASES[key] ?? null;
}

/**
 * Resolve the Urdu rendering of a legacy `t(en, ar, ur?)` call.
 * Order: explicit Urdu → English glossary → Arabic phrase → token map → English.
 */
export function resolveUrdu(en: string, ar: string, explicit?: string): string {
  if (explicit) return explicit;

  const byEnglish = UR_EN[en];
  if (byEnglish) return byEnglish;

  const phrase = urduPhrase(ar);
  if (phrase) return phrase;

  const composed = urduFromArabic(ar);
  if (composed) return composed;

  /* Rendered counters and route strings ("12 of 40 shipments", "Route from …"). */
  const templated = urduFromTemplate(en) ?? urduFromTemplate(ar);
  if (templated) return templated;

  /* Never surface Arabic inside an Urdu session. */
  return en || ar;
}

/** English-source Urdu lookup only (used by the coverage audit + tests). */
export function urduForEnglish(en: string): string | null {
  return UR_EN[en] ?? null;
}

export function hasUrduFor(en: string, ar: string, explicit?: string): boolean {
  if (explicit) return true;
  if (UR_EN[en]) return true;
  if (urduPhrase(ar)) return true;
  return urduFromArabic(ar) !== null;
}

export { urduFromArabic, UR_AR_PHRASES };
