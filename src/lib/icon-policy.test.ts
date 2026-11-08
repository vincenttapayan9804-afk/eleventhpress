import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Icon policy: generic "decorative AI" icons are not used anywhere in the
 * product. Every icon must say what its control does or what its section
 * is (see the commit replacing them). This test fails if one is imported
 * from lucide-react again.
 */
const BANNED = [
  "Sparkles", "Sparkle", "WandSparkles", "Wand", "Wand2", "Stars", "Rocket", "Bot", "BotMessageSquare",
  "BrainCircuit", "Lightbulb", "Crown", "Trophy", "Gem", "PartyPopper", "Zap", "Flame", "Medal",
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx?|jsx?)$/.test(name) ? [p] : [];
  });
}

describe("icon policy", () => {
  test("no generic decorative icons are imported from lucide-react", () => {
    const offenders: string[] = [];
    for (const f of files(join(import.meta.dir, ".."))) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"lucide-react"/g)) {
        const names = m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
        for (const n of names) if (BANNED.includes(n) || BANNED.includes(n.replace(/Icon$/, ""))) offenders.push(`${f}: ${n}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
