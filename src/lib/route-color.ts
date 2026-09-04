/**
 * Route chip colours (UX audit E): feed colours are often pure `#FF0000` / `#00FF00`,
 * which is garish and low-contrast next to white text. Rule:
 *   1. pure primaries or missing → the component colour;
 *   2. otherwise blend 35 % toward the component colour;
 *   3. pick the text colour with the best WCAG contrast and darken/lighten the
 *      background until it reaches 4.5:1.
 * Map markers use `desaturate()` so the base map stays readable underneath.
 */

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb | null {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const p = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${p(r)}${p(g)}${p(b)}`;
}

/** Relative luminance per WCAG 2.x. */
export function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const PURE = new Set(["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff", "#ff00ff"]);

/** True for the neon primaries some feeds ship as route colours. */
export function isNeon(hex: string | null | undefined): boolean {
  if (!hex) return true;
  const rgb = hexToRgb(hex);
  return !rgb || PURE.has(rgbToHex(rgb));
}

const WHITE: Rgb = [255, 255, 255];
const INK: Rgb = [20, 22, 26];

/**
 * Background + text colour for a route chip. `componentHex` is the taxonomy colour
 * (trunk red, zonal blue…); it is the fallback and the blend target.
 */
export function routeChipColors(feedHex: string | null | undefined, componentHex: string, blend = 0.35): { bg: string; fg: string } {
  const comp = hexToRgb(componentHex) ?? [102, 112, 133];
  let bg: Rgb = isNeon(feedHex) ? comp : mix(hexToRgb(feedHex!)!, comp, blend);
  // Ensure ≥ 4.5:1 with whichever text colour reads better; nudge the background if not.
  for (let i = 0; i < 12; i++) {
    const cw = contrastRatio(bg, WHITE);
    const ci = contrastRatio(bg, INK);
    if (Math.max(cw, ci) >= 4.5) return { bg: rgbToHex(bg), fg: cw >= ci ? "#ffffff" : "#14161a" };
    // mid-tone: move toward black (white text is what signage uses)
    bg = mix(bg, [0, 0, 0], 0.12);
  }
  return { bg: rgbToHex(bg), fg: "#ffffff" };
}

/** Desaturate toward the colour's own grey (keeps lightness), amount 0..1. */
export function desaturate(hex: string, amount = 0.2): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const grey = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return rgbToHex(mix(rgb, [grey, grey, grey], amount));
}
