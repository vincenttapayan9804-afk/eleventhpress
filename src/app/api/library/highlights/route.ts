import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * Private highlights and notes.
 * GET ?articleId=… (one article) or no params (all, newest first, with article titles).
 * POST { articleId, quote, note? }   DELETE ?id=…   PATCH { id, note }
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const articleId = req.nextUrl.searchParams.get("articleId");
  const rows = await db.articleHighlight.findMany({
    where: { userId: session.userId, ...(articleId ? { articleId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  if (articleId) return NextResponse.json({ highlights: rows });
  const titles = new Map(
    (await db.article.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.articleId))] } }, select: { id: true, title: true } })).map((a) => [a.id, a.title])
  );
  return NextResponse.json({ highlights: rows.filter((r) => titles.has(r.articleId)).map((r) => ({ ...r, articleTitle: titles.get(r.articleId) })) });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { articleId?: string; quote?: string; note?: string };
  const quote = (b.quote || "").trim().slice(0, 2000);
  if (!b.articleId || !quote) return NextResponse.json({ error: "articleId and quote are required" }, { status: 400 });
  const h = await db.articleHighlight.create({
    data: { userId: session.userId, articleId: b.articleId, quote, note: (b.note || "").trim().slice(0, 2000) || null },
  });
  return NextResponse.json({ highlight: h });
}

export async function PATCH(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; note?: string };
  if (!b.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await db.articleHighlight.updateMany({ where: { id: b.id, userId: session.userId }, data: { note: (b.note || "").trim().slice(0, 2000) || null } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await db.articleHighlight.deleteMany({ where: { id, userId: session.userId } });
  return NextResponse.json({ ok: true });
}
