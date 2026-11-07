/**
 * Brand colour helpers shared by the root layout (CSS variables), the
 * branding console (live preview + contrast hints), emails and PDFs.
 * Client-safe: no server imports.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string | null | undefined): value is string {
  return !!value && HEX_RE.test(value.trim());
}

/** "#abc" / "abc" / "#aabbcc" -> "#aabbcc" (lowercase); null for anything else. */
export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.trim().match(HEX_RE);
  if (!m) return null;
  let hex = m[1].toLowerCase();
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return `#${hex}`;
}

export function hexToRgb(value: string): Rgb | null {
  const hex = normalizeHex(value);
  if (!hex) return null;
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG relative luminance (0..1). */
export function luminance(rgb: Rgb): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(rgb.r) + 0.7152 * ch(rgb.g) + 0.0722 * ch(rgb.b);
}

export function contrastRatio(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return 1;
  const la = luminance(ra);
  const lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** White or near-black, whichever reads better on `bg`. */
export function readableOn(bg: string): string {
  return contrastRatio(bg, "#ffffff") >= contrastRatio(bg, "#16121f") ? "#ffffff" : "#16121f";
}

/** Linear mix of two hex colours; `weight` is the share of `b` (0..1). */
export function mixHex(a: string, b: string, weight: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return a;
  return rgbToHex({
    r: ra.r + (rb.r - ra.r) * weight,
    g: ra.g + (rb.g - ra.g) * weight,
    b: ra.b + (rb.b - ra.b) * weight,
  });
}

/**
 * CSS custom properties for a tenant's colours. Hex values get a full,
 * derived palette (readable foregrounds, focus ring, chart/sidebar accents
 * and a lighter dark-mode variant); any other plain CSS colour (older
 * oklch() values) is applied as-is to --primary/--accent only.
 *
 * Doubled selectors (`:root:root`, `:root.dark`) out-rank globals.css's
 * `:root` / `.dark` blocks regardless of stylesheet order.
 */
export function brandCssVars(primary: string | null | undefined, accent: string | null | undefined): string {
  const light: string[] = [];
  const dark: string[] = [];
  const p = normalizeHex(primary);
  const a = normalizeHex(accent);

  if (p) {
    const fg = readableOn(p);
    // The "royal" scale (eyebrows, dividers, glass tints, borders) follows
    // the brand too: tints toward white above 600, shades toward black below.
    const tints: [number, number][] = [[50, 0.95], [100, 0.88], [200, 0.72], [300, 0.52], [400, 0.3], [500, 0.12]];
    const shades: [number, number][] = [[700, 0.15], [800, 0.3], [900, 0.45]];
    light.push(
      ...tints.map(([k, w]) => `--royal-${k}:${mixHex(p, "#ffffff", w)}`),
      `--royal-600:${p}`,
      ...shades.map(([k, w]) => `--royal-${k}:${mixHex(p, "#000000", w)}`)
    );
    light.push(
      `--primary:${p}`,
      `--primary-foreground:${fg}`,
      `--ring:${p}`,
      `--chart-1:${p}`,
      `--sidebar-primary:${p}`,
      `--sidebar-primary-foreground:${fg}`
    );
    const pd = luminance(hexToRgb(p)!) < 0.18 ? mixHex(p, "#ffffff", 0.45) : p;
    const pdFg = readableOn(pd);
    const darkSteps: [number, string, number][] = [
      [50, "#16121f", 0.85], [100, "#16121f", 0.78], [200, "#16121f", 0.66], [300, "#16121f", 0.5], [400, "#16121f", 0.25],
      [500, "#16121f", 0.1], [700, "#ffffff", 0.2], [800, "#ffffff", 0.4], [900, "#ffffff", 0.6],
    ];
    dark.push(...darkSteps.map(([k, to, w]) => `--royal-${k}:${mixHex(pd, to, w)}`), `--royal-600:${pd}`);
    dark.push(
      `--primary:${pd}`,
      `--primary-foreground:${pdFg}`,
      `--ring:${pd}`,
      `--chart-1:${pd}`,
      `--sidebar-primary:${pd}`,
      `--sidebar-primary-foreground:${pdFg}`
    );
  } else if (primary) {
    light.push(`--primary:${primary}`);
  }

  if (a) {
    light.push(`--accent:${a}`, `--accent-foreground:${readableOn(a)}`);
    const ad = mixHex(a, "#16121f", 0.72);
    dark.push(`--accent:${ad}`, `--accent-foreground:${readableOn(ad)}`);
  } else if (accent) {
    light.push(`--accent:${accent}`);
  }

  let css = "";
  if (light.length) css += `:root:root{${light.join(";")}}`;
  if (dark.length) css += `:root.dark{${dark.join(";")}}`;
  return css;
}

/** Curated starting points shown as one-click swatches in the branding console. */
export const BRAND_COLOR_PRESETS: { name: string; primary: string; accent: string }[] = [
  { name: "Royal purple", primary: "#4b2e83", accent: "#e4dbf5" },
  { name: "Academic navy", primary: "#1f3a68", accent: "#dbe6f5" },
  { name: "Oxford blue", primary: "#002147", accent: "#d6e2f0" },
  { name: "Forest green", primary: "#1f5f3f", accent: "#d8eee2" },
  { name: "Emerald", primary: "#047857", accent: "#d1fae5" },
  { name: "Crimson", primary: "#9b1c31", accent: "#f7dde1" },
  { name: "Maroon", primary: "#7a1f2b", accent: "#f1dcdc" },
  { name: "Teal", primary: "#0f6e74", accent: "#d4eef0" },
  { name: "Burnt orange", primary: "#b4530f", accent: "#fbe6d4" },
  { name: "Gold & black", primary: "#1c1917", accent: "#f3e3b5" },
  { name: "Slate", primary: "#334155", accent: "#e2e8f0" },
  { name: "Indigo", primary: "#3730a3", accent: "#e0e7ff" },
];

/**
 * Picks up to `max` distinct, usable brand colours from raw RGBA pixel data
 * (e.g. a logo drawn to a canvas): ignores transparent, near-white and
 * near-grey pixels, buckets the rest, and returns the most common buckets
 * that differ visibly from each other.
 */
export function extractPalette(data: ArrayLike<number>, max = 6): string[] {
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const alpha = data[i + 3];
    if (alpha < 160) continue;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    if (maxC > 240 && minC > 228) continue; // near white background
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }
  const ranked = [...buckets.values()]
    .map((v) => {
      const rgb = { r: v.r / v.count, g: v.g / v.count, b: v.b / v.count };
      const sat = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
      // Favour saturated colours over greys; greys still qualify if dominant.
      return { hex: rgbToHex(rgb), rgb, score: v.count * (sat > 40 ? 3 : 1) };
    })
    .sort((x, y) => y.score - x.score);

  const picked: { hex: string; rgb: Rgb }[] = [];
  for (const c of ranked) {
    const distinct = picked.every(
      (p) => Math.abs(p.rgb.r - c.rgb.r) + Math.abs(p.rgb.g - c.rgb.g) + Math.abs(p.rgb.b - c.rgb.b) > 90
    );
    if (distinct) picked.push(c);
    if (picked.length >= max) break;
  }
  return picked.map((p) => p.hex);
}
