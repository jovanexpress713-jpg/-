/**
 * Canvas / SVG palette bridge.
 *
 * The console's `<canvas>` and hand-written SVG surfaces cannot use Tailwind
 * utilities, so they used to carry their own copies of the brand hex values.
 * When the NOVA palette landed, those copies silently kept painting the old
 * orange and the retired status green.
 *
 * Everything here resolves from the design tokens on `<html>` instead, so a
 * canvas follows the same navy + orange system — and the same light/dark flip —
 * as the DOM around it.
 */

export const PALETTE_TOKENS = [
  "--color-bg-deep",
  "--color-bg-main",
  "--color-bg-card",
  "--color-bg-card-2",
  "--color-bg-input",
  "--color-paper",
  "--color-brand",
  "--color-brand-soft",
  "--color-brand-glow",
  "--color-status-active",
  "--color-status-waiting",
  "--color-status-danger",
  "--color-status-info",
  "--color-border-soft",
  "--color-border-strong",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-muted",
  "--color-navy",
  "--color-surface-2",
  "--color-surface-4",
  "--color-surface-6",
] as const;

export type PaletteToken = (typeof PALETTE_TOKENS)[number];
export type Palette = Record<PaletteToken, string>;

/**
 * Used when there is no DOM to read from (SSR, or a test that mounts before a
 * stylesheet exists). These are the NOVA dark-theme values, so a headless
 * render still paints the intended palette rather than transparent black.
 */
const FALLBACK: Palette = {
  "--color-bg-deep": "#050b18",
  "--color-bg-main": "#08152b",
  "--color-bg-card": "#0e2142",
  "--color-bg-card-2": "#12294f",
  "--color-bg-input": "#0b1b37",
  "--color-paper": "#ffffff",
  "--color-brand": "#ff6b1a",
  "--color-brand-soft": "#ff8a3d",
  "--color-brand-glow": "#ffb077",
  "--color-status-active": "#22c55e",
  "--color-status-waiting": "#ffb020",
  "--color-status-danger": "#ff3b30",
  "--color-status-info": "#38bdf8",
  "--color-border-soft": "#1b3663",
  "--color-border-strong": "#254780",
  "--color-text-primary": "#f1f5f9",
  "--color-text-secondary": "#b8c4da",
  "--color-text-muted": "#7e8dad",
  "--color-navy": "#050b18",
  "--color-surface-2": "#0b1b37",
  "--color-surface-4": "#12294f",
  "--color-surface-6": "#1b3663",
};

const cache = new Map<string, Palette>();

/**
 * Resolves the palette for the active theme. Cached per `data-theme` so a
 * 60fps draw loop never calls `getComputedStyle` on a frame; flipping the theme
 * produces a different cache key and re-resolves.
 */
export function palette(): Palette {
  const theme =
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-theme") ?? "dark"
      : "dark";

  const hit = cache.get(theme);
  if (hit) return hit;

  const styles =
    typeof document !== "undefined" && typeof getComputedStyle === "function"
      ? getComputedStyle(document.documentElement)
      : null;

  const out = {} as Record<string, string>;
  for (const key of PALETTE_TOKENS) {
    const live = styles?.getPropertyValue(key).trim();
    out[key] = live && live.startsWith("#") ? live : FALLBACK[key];
  }

  const frozen = out as Palette;
  cache.set(theme, frozen);
  return frozen;
}

/** Converts a `#rgb` / `#rrggbb` token to `rgba(r, g, b, alpha)`. */
export function rgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Test hook — drops the resolved palettes so a theme flip can be observed. */
export function clearPaletteCache(): void {
  cache.clear();
}
