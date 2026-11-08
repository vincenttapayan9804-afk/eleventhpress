import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { parseAuthors } from "@/lib/article";

const cleanList = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : "Saved");

/**
 * The reader's library.
 * GET    — saved articles by list, "continue reading" (recently opened,
 *          not yet saved) and the lists' names. ?articleId=… instead
 *          returns which lists hold that article.
 * POST   — { articleId, listName? } save to a list (default "Saved").
 * DELETE — ?articleId=…&listName=… remove from a list (all lists if omitted).
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const articleId = req.nextUrl.searchParams.get("articleId");
  if (articleId) {
    const rows = await db.libraryItem.findMany({ where: { userId: session.userId, articleId }, select: { listName: true } });
    return NextResponse.json({ lists: rows.map((r) => r.listName) });
  }

  const [items, history] = await Promise.all([
    db.libraryItem.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" }, take: 500 }),
    db.readingHistory.findMany({ where: { userId: session.userId }, orderBy: { viewedAt: "desc" }, take: 12 }),
  ]);
  const ids = [...new Set([...items.map((i) => i.articleId), ...history.map((h) => h.articleId)])];
  const articles = await db.article.findMany({
    where: { id: { in: ids }, status: "PUBLISHED" },
    select: { id: true, title: true, discipline: true, authors: true, publishedAt: true, doi: true },
  });
  const byId = new Map(
    articles.map((a) => [a.id, { ...a, authors: parseAuthors(a.authors).map((x) => x.name).filter(Boolean).slice(0, 4) }])
  );
  const saved = new Set(items.map((i) => i.articleId));
  const lists: Record<string, any[]> = {};
  for (const i of items) {
    const a = byId.get(i.articleId);
    if (!a) continue;
    (lists[i.listName] ??= []).push({ ...a, savedAt: i.createdAt });
  }
  const continueReading = history
    .filter((h) => !saved.has(h.articleId) && byId.has(h.articleId))
    .slice(0, 6)
    .map((h) => ({ ...byId.get(h.articleId)!, viewedAt: h.viewedAt }));
  return NextResponse.json({ lists, listNames: Object.keys(lists), continueReading });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { articleId?: string; listName?: string };
  if (!body.articleId) return NextResponse.json({ error: "articleId is required" }, { status: 400 });
  const exists = await db.article.findUnique({ where: { id: body.articleId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Article not found" }, { status: 404 });
  const listName = cleanList(body.listName);
  await db.libraryItem.upsert({
    where: { userId_articleId_listName: { userId: session.userId, articleId: body.articleId, listName } },
    create: { userId: session.userId, articleId: body.articleId, listName },
    update: {},
  });
  return NextResponse.json({ ok: true, listName });
}

export async function DELETE(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const articleId = req.nextUrl.searchParams.get("articleId");
  const listName = req.nextUrl.searchParams.get("listName");
  if (!articleId) return NextResponse.json({ error: "articleId is required" }, { status: 400 });
  await db.libraryItem.deleteMany({ where: { userId: session.userId, articleId, ...(listName ? { listName } : {}) } });
  return NextResponse.json({ ok: true });
}
