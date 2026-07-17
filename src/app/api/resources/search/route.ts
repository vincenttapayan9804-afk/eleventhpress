import { NextRequest, NextResponse } from "next/server";
import { searchResources, syncResourcesIndex, meilisearchLiveMode, type ResourceSearchDoc } from "@/lib/meilisearch";
import { BLOGS, GUIDES, TRAININGS, WEBINARS, BOOKS } from "@/lib/resources-content";

// Static content rarely changes, so syncing once per server instance
// (rather than on every request) is enough — a fresh serverless cold start
// re-syncs automatically. Never blocks a search: sync runs best-effort and
// a failure just means this request's search sees a stale/partial index,
// not a broken response.
let synced = false;
async function ensureResourcesIndexed() {
  if (synced || !meilisearchLiveMode()) return;
  synced = true;
  const docs: ResourceSearchDoc[] = [
    ...GUIDES.map((g) => ({ id: g.id, kind: "guide" as const, title: g.title, description: g.summary })),
    ...BLOGS.map((b) => ({ id: b.id, kind: "blog" as const, title: b.title, description: b.excerpt })),
    ...TRAININGS.map((t) => ({ id: t.id, kind: "training" as const, title: t.title, description: t.blurb })),
    ...WEBINARS.map((w) => ({ id: w.id, kind: "webinar" as const, title: w.title, description: w.blurb })),
    ...BOOKS.map((b) => ({ id: b.id, kind: "book" as const, title: b.title, description: `${b.author} — ${b.note}` })),
  ];
  await syncResourcesIndex(docs);
}

/**
 * GET /api/resources/search?q=...
 * Typo-tolerant, ranked search across every static Resources page content
 * type (guides, blogs, trainings, webinars, books) via Meilisearch when
 * configured (src/lib/meilisearch.ts); falls back to a plain
 * case-insensitive substring match over the same shared content
 * (src/lib/resources-content.ts) when it isn't — never an empty result set
 * just because the optional integration isn't set up.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ query: q, results: [], live: false });
  }

  await ensureResourcesIndexed();
  const liveHits = await searchResources(q);
  if (liveHits) {
    return NextResponse.json({ query: q, results: liveHits, live: true });
  }

  const needle = q.toLowerCase();
  const results: ResourceSearchDoc[] = [
    ...GUIDES.filter((g) => g.title.toLowerCase().includes(needle) || g.summary.toLowerCase().includes(needle))
      .map((g) => ({ id: g.id, kind: "guide" as const, title: g.title, description: g.summary })),
    ...BLOGS.filter((b) => b.title.toLowerCase().includes(needle) || b.excerpt.toLowerCase().includes(needle))
      .map((b) => ({ id: b.id, kind: "blog" as const, title: b.title, description: b.excerpt })),
    ...TRAININGS.filter((t) => t.title.toLowerCase().includes(needle) || t.blurb.toLowerCase().includes(needle))
      .map((t) => ({ id: t.id, kind: "training" as const, title: t.title, description: t.blurb })),
    ...WEBINARS.filter((w) => w.title.toLowerCase().includes(needle) || w.blurb.toLowerCase().includes(needle))
      .map((w) => ({ id: w.id, kind: "webinar" as const, title: w.title, description: w.blurb })),
    ...BOOKS.filter((b) => b.title.toLowerCase().includes(needle) || b.author.toLowerCase().includes(needle) || b.note.toLowerCase().includes(needle))
      .map((b) => ({ id: b.id, kind: "book" as const, title: b.title, description: b.note })),
  ];

  return NextResponse.json({ query: q, results, live: false });
}
