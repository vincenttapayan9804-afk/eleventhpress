import { describe, expect, test } from "bun:test";
import {
  CONSTELLATION_SHELLS,
  graphStats,
  layoutConstellation,
  layoutTide,
  neighboursOf,
  type GraphNoteInput,
} from "./second-brain-graph";

function note(id: string, tags: string[], createdAt: string, pinned = false): GraphNoteInput {
  return { id, title: `Note ${id}`, tags, pinned, color: null, createdAt };
}

const notes = [
  note("a", ["x", "y"], "2026-01-01T10:00:00Z", true),
  note("b", ["x"], "2026-01-01T12:00:00Z"),
  note("c", ["y"], "2026-01-03T09:00:00Z"),
  note("d", [], "2026-02-10T09:00:00Z"),
];
const links = [
  { a: "a", b: "b", sharedTags: ["x"] },
  { a: "a", b: "c", sharedTags: ["y"] },
];
const counts = { a: 2, b: 1, c: 1 };

describe("layoutConstellation", () => {
  test("places every note on its shell, most-connected innermost, deterministically", () => {
    const l1 = layoutConstellation(notes, links, counts);
    const l2 = layoutConstellation(notes, links, counts);
    expect(l1).toEqual(l2);
    expect(l1.nodes).toHaveLength(4);
    const a = l1.nodes.find((n) => n.id === "a")!;
    expect(a.group).toBe(0);
    for (const n of l1.nodes) {
      const [x, , z] = n.position;
      // Horizontal distance never exceeds the shell radius.
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(CONSTELLATION_SHELLS[n.group] + 0.01);
      expect(Number.isFinite(n.position[1])).toBe(true);
    }
    expect(l1.edges).toHaveLength(2);
  });

  test("handles no notes", () => {
    expect(layoutConstellation([], [], {}).nodes).toEqual([]);
  });
});

describe("layoutTide", () => {
  test("orders notes left-to-right by capture day and spreads same-day notes in depth", () => {
    const l = layoutTide(notes, links, counts, (iso) => iso.slice(0, 10));
    const x = (id: string) => l.nodes.find((n) => n.id === id)!.position[0];
    const z = (id: string) => l.nodes.find((n) => n.id === id)!.position[2];
    expect(x("a")).toBe(x("b"));
    expect(z("a")).not.toBe(z("b"));
    expect(x("a")).toBeLessThan(x("c"));
    expect(x("c")).toBeLessThan(x("d"));
    expect(l.ticks[0].label).toBe("2026-01-01");
    expect(l.ticks[l.ticks.length - 1].label).toBe("2026-02-10");
  });

  test("more connections ride higher above the wave", () => {
    const l = layoutTide(
      [note("p", ["t"], "2026-01-01T00:00:00Z"), note("q", [], "2026-01-01T00:00:00Z")],
      [],
      { p: 5 },
      () => ""
    );
    const y = (id: string) => l.nodes.find((n) => n.id === id)!.position[1];
    expect(y("p")).toBeGreaterThan(y("q"));
  });
});

describe("graphStats / neighboursOf", () => {
  test("computes network statistics", () => {
    const s = graphStats(notes, links, counts);
    expect(s.notes).toBe(4);
    expect(s.connections).toBe(2);
    expect(s.tags).toBe(2);
    expect(s.avgDegree).toBe(1);
    expect(s.density).toBeCloseTo(2 / 6);
    expect(s.isolated).toBe(1);
    expect(s.hubs[0]).toEqual({ id: "a", title: "Note a", linkCount: 2 });
    expect(s.topTags.map((t) => t.tag)).toEqual(["x", "y"]);
  });

  test("finds direct neighbours only", () => {
    const l = layoutConstellation(notes, links, counts);
    expect([...neighboursOf("a", l.edges)].sort()).toEqual(["b", "c"]);
    expect([...neighboursOf("d", l.edges)]).toEqual([]);
  });
});
