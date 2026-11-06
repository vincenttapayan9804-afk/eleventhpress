/**
 * Site-wide interface sound: a short click played when the pointer moves
 * onto, or presses, anything interactive (buttons, links, tabs, menu items,
 * accordion/section triggers, checkboxes…), and when keyboard focus lands
 * on one. Mounted once in the root layout (src/components/ui-sound.tsx), so
 * every current and future page gets it without per-component wiring.
 *
 * - One delegated listener set on `document`; no per-element handlers.
 * - Web Audio buffer playback, so rapid hovers overlap cleanly with no
 *   <audio> element latency. The 3 KB clip is fetched lazily on the first
 *   user gesture (browsers keep audio locked until one anyway).
 * - Hover is quieter and slightly higher-pitched than a press.
 * - The visitor's on/off choice persists in localStorage; elements can opt
 *   out with `data-sound="off"` (or opt in with `data-sound`).
 */

export const UI_SOUND_SRC = "/sounds/ui-click.mp3";
export const UI_SOUND_STORAGE_KEY = "ep-ui-sound";

/** Things a visitor points at or presses. Text fields are deliberately absent. */
export const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "summary",
  "select",
  "label[for]",
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="submit"]',
  'input[type="button"]',
  'input[type="reset"]',
  'input[type="range"]',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="treeitem"]',
  "[data-sound]",
].join(",");

export type SoundKind = "hover" | "press";

/** Volume / pitch per interaction. Hover stays subtle so browsing isn't noisy. */
export const SOUND_PROFILE: Record<SoundKind, { gain: number; rate: number }> = {
  hover: { gain: 0.18, rate: 1.18 },
  press: { gain: 0.55, rate: 1 },
};

/** Minimum gap between two sounds of the same kind, in ms. */
export const MIN_GAP_MS: Record<SoundKind, number> = { hover: 45, press: 25 };

interface ElementLike {
  closest(selector: string): ElementLike | null;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  matches?(selector: string): boolean;
}

/**
 * The interactive element a pointer/focus target belongs to, or null when
 * it isn't interactive, is disabled, or sits inside a `data-sound="off"` zone.
 */
export function soundTarget(target: unknown): ElementLike | null {
  const el = target as ElementLike | null;
  if (!el || typeof el.closest !== "function") return null;
  if (el.closest('[data-sound="off"]')) return null;
  const hit = el.closest(INTERACTIVE_SELECTOR);
  if (!hit) return null;
  if (hit.hasAttribute("disabled")) return null;
  if (hit.getAttribute("aria-disabled") === "true") return null;
  if (hit.getAttribute("data-disabled") !== null) return null;
  return hit;
}

/** Reads the stored preference; sound is on unless the visitor turned it off. */
export function readSoundEnabled(storage: Pick<Storage, "getItem"> | null | undefined): boolean {
  try {
    return storage?.getItem(UI_SOUND_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Per-kind rate limiter (pure; time is injected so it can be unit-tested). */
export function createThrottle(gaps: Record<SoundKind, number> = MIN_GAP_MS) {
  const last: Record<SoundKind, number> = { hover: -Infinity, press: -Infinity };
  return (kind: SoundKind, now: number): boolean => {
    if (now - last[kind] < gaps[kind]) return false;
    last[kind] = now;
    return true;
  };
}
