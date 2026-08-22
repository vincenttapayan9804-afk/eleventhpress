/**
 * Second Brain — shared constants and pure helpers used by both the API
 * routes and the dashboard tab. Links between notes are computed live from
 * shared tags rather than persisted (see prisma/schema.prisma's
 * SecondBrainNote doc comment) — this file is the single source of truth
 * for that computation so the API and UI never disagree on what counts as
 * "linked".
 */

export const SECOND_BRAIN_VIEWS = ["constellation", "atrium", "tide"] as const;
export type SecondBrainView = (typeof SECOND_BRAIN_VIEWS)[number];

// Curated so every option pairs a display face with a real fallback stack
// and reads well at both the note-card and heading scale used in the tab.
// "id" is what's persisted on SecondBrainPreference.fontPairing.
export const FONT_PAIRINGS = [
  {
    id: "fraunces-manrope",
    label: "Fraunces / Manrope",
    display: "'Fraunces', Georgia, serif",
    body: "'Manrope', -apple-system, sans-serif",
    googleFonts: "Fraunces:opsz,wght@9..144,400;9..144,600&family=Manrope:wght@400;500;700",
  },
  {
    id: "space-grotesk-inter",
    label: "Space Grotesk / Inter",
    display: "'Space Grotesk', -apple-system, sans-serif",
    body: "'Inter', -apple-system, sans-serif",
    googleFonts: "Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600",
  },
  {
    id: "playfair-sourcesans",
    label: "Playfair Display / Source Sans",
    display: "'Playfair Display', Georgia, serif",
    body: "'Source Sans 3', -apple-system, sans-serif",
    googleFonts: "Playfair+Display:wght@500;700&family=Source+Sans+3:wght@400;500;600",
  },
  {
    id: "jetbrains-ibm",
    label: "JetBrains Mono / IBM Plex Sans",
    display: "'JetBrains Mono', 'Courier New', monospace",
    body: "'IBM Plex Sans', -apple-system, sans-serif",
    googleFonts: "JetBrains+Mono:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600",
  },
] as const;
export type FontPairingId = (typeof FONT_PAIRINGS)[number]["id"];
export const FONT_PAIRING_IDS = FONT_PAIRINGS.map((f) => f.id) as FontPairingId[];

// Preset accent swatches shown in the customization toggle. The picker also
// accepts any hex value — these are just fast-path defaults.
export const ACCENT_PRESETS = [
  "#8b7cf6", // violet (default)
  "#38bdf8", // sky
  "#34d399", // emerald
  "#fbbf24", // amber
  "#fb7185", // rose
  "#a3e635", // lime
] as const;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value);
}

export interface SecondBrainNoteLike {
  id: string;
  tags: string[];
}

export interface SecondBrainLink {
  a: string;
  b: string;
  sharedTags: string[];
}

/**
 * Computes note-to-note links by tag overlap. Two notes link when they
 * share at least one tag; `sharedTags` carries which ones, so the UI can
 * render link strength (more shared tags = a stronger edge) without a
 * second pass. O(n^2) over a per-user note count — see schema doc comment
 * for why that's an acceptable tradeoff here.
 */
export function computeSecondBrainLinks(notes: SecondBrainNoteLike[]): SecondBrainLink[] {
  const links: SecondBrainLink[] = [];
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const a = notes[i];
      const b = notes[j];
      const shared = a.tags.filter((t) => b.tags.includes(t));
      if (shared.length > 0) {
        links.push({ a: a.id, b: b.id, sharedTags: shared });
      }
    }
  }
  return links;
}
