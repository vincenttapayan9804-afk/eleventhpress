import { describe, expect, test } from "bun:test";
import { INTERACTIVE_SELECTOR, createThrottle, readSoundEnabled, soundTarget, UI_SOUND_STORAGE_KEY } from "./ui-sound";

/** Minimal element stand-in: `closest` walks a parent chain by tag/attr predicates. */
type Fake = { tag: string; attrs: Record<string, string>; parent: Fake | null };
const el = (tag: string, attrs: Record<string, string> = {}, parent: Fake | null = null): Fake => ({ tag, attrs, parent });
function matches(f: Fake, sel: string): boolean {
  return sel.split(",").some((s) => {
    const m = s.trim().match(/^([a-z]*)(?:\[([a-z-]+)(?:="([^"]*)")?\])?$/);
    if (!m) return false;
    const [, tag, attr, val] = m;
    if (tag && tag !== f.tag) return false;
    if (attr && !(attr in f.attrs)) return false;
    if (val !== undefined && f.attrs[attr] !== val) return false;
    return true;
  });
}
function wrap(f: Fake | null): any {
  if (!f) return null;
  return {
    closest(sel: string) {
      for (let c: Fake | null = f; c; c = c.parent) if (matches(c, sel)) return wrap(c);
      return null;
    },
    getAttribute: (n: string) => (n in f.attrs ? f.attrs[n] : null),
    hasAttribute: (n: string) => n in f.attrs,
    tag: f.tag,
  };
}

describe("soundTarget", () => {
  test("resolves an icon inside a button to the button", () => {
    const btn = el("button");
    expect((soundTarget(wrap(el("svg", {}, btn))) as { tag?: string } | null)?.tag).toBe("button");
  });
  test("tabs, links and menu items are interactive", () => {
    expect(soundTarget(wrap(el("div", { role: "tab" })))).not.toBeNull();
    expect(soundTarget(wrap(el("a", { href: "/x" })))).not.toBeNull();
    expect(soundTarget(wrap(el("div", { role: "menuitem" })))).not.toBeNull();
    expect(soundTarget(wrap(el("summary")))).not.toBeNull();
  });
  test("plain text, anchors without href and text inputs are silent", () => {
    expect(soundTarget(wrap(el("p")))).toBeNull();
    expect(soundTarget(wrap(el("a")))).toBeNull();
    expect(soundTarget(wrap(el("input", { type: "text" })))).toBeNull();
    expect(soundTarget(wrap(el("textarea")))).toBeNull();
  });
  test("disabled controls and opted-out zones are silent", () => {
    expect(soundTarget(wrap(el("button", { disabled: "" })))).toBeNull();
    expect(soundTarget(wrap(el("button", { "aria-disabled": "true" })))).toBeNull();
    expect(soundTarget(wrap(el("div", { role: "menuitem", "data-disabled": "" })))).toBeNull();
    const zone = el("div", { "data-sound": "off" });
    expect(soundTarget(wrap(el("button", {}, zone)))).toBeNull();
  });
  test("non-elements are ignored", () => {
    expect(soundTarget(null)).toBeNull();
    expect(soundTarget({})).toBeNull();
  });
  test("selector never targets free-text fields", () => {
    expect(INTERACTIVE_SELECTOR).not.toContain("textarea");
    expect(INTERACTIVE_SELECTOR).not.toContain('type="text"');
  });
});

describe("preferences and throttling", () => {
  test("sound is on by default and off only when stored off", () => {
    expect(readSoundEnabled(null)).toBe(true);
    expect(readSoundEnabled({ getItem: () => null })).toBe(true);
    expect(readSoundEnabled({ getItem: (k) => (k === UI_SOUND_STORAGE_KEY ? "off" : null) })).toBe(false);
    expect(readSoundEnabled({ getItem: () => { throw new Error("blocked"); } })).toBe(true);
  });
  test("throttle limits each kind independently", () => {
    const allow = createThrottle({ hover: 50, press: 20 });
    expect(allow("hover", 0)).toBe(true);
    expect(allow("hover", 30)).toBe(false);
    expect(allow("press", 30)).toBe(true);
    expect(allow("hover", 60)).toBe(true);
  });
});
