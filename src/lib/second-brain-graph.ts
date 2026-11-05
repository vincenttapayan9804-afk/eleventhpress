/**
 * Second Brain — 3D graph layout and network statistics.
 *
 * Pure functions with no three.js import, so the dashboard's DOM panel and
 * its lazily-loaded WebGL scene share one layout, and the maths is unit
 * testable. Layouts are deterministic (no Math.random): the same notes always
 * land in the same place, so the graph doesn't reshuffle on every reload.
 */

export type Vec3 = [number, number, number];

export interface GraphNoteInput {
  id: string;
  title: string;
  tags: string[];
  pinned: boolean;
  color: string | null;
  createdAt: string;
}

export interface GraphLinkInput {
  a: string;
  b: string;
  sharedTags: string[];
}

export interface GraphNode {
  id: string;
  title: string;
  position: Vec3;
  /** World-space sphere radius. */
  radius: number;
  pinned: boolean;
  color: string | null;
  linkCount: number;
  tags: string[];
  /** Constellation: 0 = inner shell (most connected). Tide: day index. */
  group: number;
  createdAt: string;
}

export interface GraphEdge {
  a: string;
  b: string;
  /** 1-4: number of shared tags, capped. */
  strength: number;
  sharedTags: string[];
}

export interface TideTick {
  x: number;
  label: string;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Tide only: date ticks along the time axis. */
  ticks: TideTick[];
  /** Radius of a sphere that contains every node — the camera frames this. */
  extent: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const CONSTELLATION_SHELLS = [2.4, 3.8, 5.2] as const;
const TIDE_HALF_WIDTH = 6.5;

const round = (n: number) => Math.round(n * 1000) / 1000;

function nodeRadius(pinned: boolean, linkCount: number): number {
  return round((pinned ? 0.2 : 0.15) + Math.min(linkCount, 8) * 0.022);
}

function buildEdges(links: GraphLinkInput[], ids: Set<string>): GraphEdge[] {
  return links
    .filter((l) => ids.has(l.a) && ids.has(l.b))
    .map((l) => ({ a: l.a, b: l.b, strength: Math.max(1, Math.min(l.sharedTags.length, 4)), sharedTags: l.sharedTags }));
}

/**
 * Constellation: notes sit on three concentric spherical shells around a
 * glass core, most-connected notes on the inner shell. Each shell is filled
 * with a Fibonacci (golden-angle) spiral, which spreads any number of points
 * evenly over a sphere, so no two notes clump together.
 */
export function layoutConstellation(
  notes: GraphNoteInput[],
  links: GraphLinkInput[],
  linkCountByNote: Record<string, number>
): GraphLayout {
  if (notes.length === 0) return { nodes: [], edges: [], ticks: [], extent: CONSTELLATION_SHELLS[2] };
  const sorted = [...notes].sort(
    (a, b) =>
      (linkCountByNote[b.id] || 0) - (linkCountByNote[a.id] || 0) ||
      Number(b.pinned) - Number(a.pinned) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id)
  );
  const total = sorted.length;
  const innerCap = Math.max(1, Math.ceil(total * 0.18));
  const middleCap = Math.ceil(total * 0.37);
  const shells: GraphNoteInput[][] = [
    sorted.slice(0, innerCap),
    sorted.slice(innerCap, innerCap + middleCap),
    sorted.slice(innerCap + middleCap),
  ];

  const nodes: GraphNode[] = [];
  shells.forEach((shell, s) => {
    const r = CONSTELLATION_SHELLS[s];
    const n = shell.length;
    shell.forEach((note, i) => {
      // y from +0.85 to -0.85 (keeps poles clear of the camera's up axis).
      const t = n === 1 ? 0.5 : i / (n - 1);
      const y = (1 - 2 * t) * 0.85;
      const ring = Math.sqrt(1 - y * y);
      const theta = i * GOLDEN_ANGLE + s * 1.1;
      const linkCount = linkCountByNote[note.id] || 0;
      nodes.push({
        id: note.id,
        title: note.title,
        position: [round(Math.cos(theta) * ring * r), round(y * r * 0.82), round(Math.sin(theta) * ring * r)],
        radius: nodeRadius(note.pinned, linkCount),
        pinned: note.pinned,
        color: note.color,
        linkCount,
        tags: note.tags,
        group: s,
        createdAt: note.createdAt,
      });
    });
  });

  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, edges: buildEdges(links, ids), ticks: [], extent: CONSTELLATION_SHELLS[2] + 0.6 };
}

function utcDayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Height of the tide's wave surface at x — shared by the scene's ribbon mesh. */
export function tideWaveY(x: number): number {
  return round(Math.sin(x * 0.55) * 0.45 - 1.2);
}

/**
 * Tide: a time axis. x is the capture date (oldest left, newest right),
 * notes captured on the same day fan out in depth (z), and each note rides
 * above the wave on a stem whose height grows with its connections.
 */
export function layoutTide(
  notes: GraphNoteInput[],
  links: GraphLinkInput[],
  linkCountByNote: Record<string, number>,
  formatTick: (iso: string) => string
): GraphLayout {
  if (notes.length === 0) return { nodes: [], edges: [], ticks: [], extent: TIDE_HALF_WIDTH };
  const sorted = [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const dayKeys = [...new Set(sorted.map((n) => utcDayKey(n.createdAt)))];
  const dayTime = (k: string) => Date.parse(`${k}T00:00:00Z`);
  const first = dayTime(dayKeys[0]);
  const last = dayTime(dayKeys[dayKeys.length - 1]);
  const span = Math.max(last - first, 1);
  // Evenly spaced days read better than true time when there are few;
  // with many days, true time keeps gaps in your note-taking visible.
  const useTrueTime = dayKeys.length > 6;
  const xForDay = (k: string, idx: number) => {
    const t = dayKeys.length === 1 ? 0.5 : useTrueTime ? (dayTime(k) - first) / span : idx / (dayKeys.length - 1);
    return round(-TIDE_HALF_WIDTH + t * TIDE_HALF_WIDTH * 2);
  };

  const byDay = new Map<string, GraphNoteInput[]>();
  for (const n of sorted) {
    const k = utcDayKey(n.createdAt);
    byDay.set(k, [...(byDay.get(k) ?? []), n]);
  }

  const nodes: GraphNode[] = [];
  dayKeys.forEach((k, dayIdx) => {
    const x = xForDay(k, dayIdx);
    const dayNotes = byDay.get(k)!;
    const m = dayNotes.length;
    dayNotes.forEach((note, j) => {
      const z = m === 1 ? 0 : round(-1.6 + (j / (m - 1)) * 3.2);
      const linkCount = linkCountByNote[note.id] || 0;
      const y = round(tideWaveY(x) + 0.9 + Math.min(linkCount, 8) * 0.28 + (note.pinned ? 0.35 : 0));
      nodes.push({
        id: note.id,
        title: note.title,
        position: [x, y, z],
        radius: nodeRadius(note.pinned, linkCount),
        pinned: note.pinned,
        color: note.color,
        linkCount,
        tags: note.tags,
        group: dayIdx,
        createdAt: note.createdAt,
      });
    });
  });

  // At most ~6 date ticks, always including the first and last day.
  const step = Math.max(1, Math.ceil(dayKeys.length / 6));
  const ticks: TideTick[] = dayKeys
    .map((k, i) => ({ k, i }))
    .filter(({ i }) => i % step === 0 || i === dayKeys.length - 1)
    .map(({ k, i }) => ({ x: xForDay(k, i), label: formatTick(`${k}T00:00:00Z`) }));

  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, edges: buildEdges(links, ids), ticks, extent: TIDE_HALF_WIDTH + 1 };
}

export interface GraphStats {
  notes: number;
  connections: number;
  tags: number;
  /** Mean connections per note. */
  avgDegree: number;
  /** Share of all possible note pairs that are connected, 0-1. */
  density: number;
  /** Notes with no connection at all. */
  isolated: number;
  topTags: { tag: string; count: number }[];
  hubs: { id: string; title: string; linkCount: number }[];
}

export function graphStats(
  notes: GraphNoteInput[],
  links: GraphLinkInput[],
  linkCountByNote: Record<string, number>
): GraphStats {
  const n = notes.length;
  const tagCounts = new Map<string, number>();
  for (const note of notes) for (const t of new Set(note.tags)) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const possible = (n * (n - 1)) / 2;
  return {
    notes: n,
    connections: links.length,
    tags: tagCounts.size,
    avgDegree: n === 0 ? 0 : (links.length * 2) / n,
    density: possible === 0 ? 0 : links.length / possible,
    isolated: notes.filter((x) => !(linkCountByNote[x.id] > 0)).length,
    topTags: [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count })),
    hubs: notes
      .filter((x) => (linkCountByNote[x.id] || 0) > 0)
      .sort((a, b) => (linkCountByNote[b.id] || 0) - (linkCountByNote[a.id] || 0) || a.title.localeCompare(b.title))
      .slice(0, 5)
      .map((x) => ({ id: x.id, title: x.title, linkCount: linkCountByNote[x.id] || 0 })),
  };
}

/** Ids of every note directly linked to `id` (not including `id` itself). */
export function neighboursOf(id: string, edges: GraphEdge[]): Set<string> {
  const out = new Set<string>();
  for (const e of edges) {
    if (e.a === id) out.add(e.b);
    else if (e.b === id) out.add(e.a);
  }
  return out;
}
