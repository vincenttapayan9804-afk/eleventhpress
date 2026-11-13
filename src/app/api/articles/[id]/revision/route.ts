import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { notifyMany } from "@/lib/notify";

const MAX = 20000;

/**
 * GET  /api/articles/[id]/revision — the article's revision rounds (title,
 *      abstract and file before/after, response letter). Corresponding
 *      author or an editor.
 * POST /api/articles/[id]/revision — the corresponding author submits a
 *      revised manuscript while revisions are requested:
 *      { title?, abstract?, manuscriptKey?, manuscriptName?, coverNote?, replies: string[] }
 *      `replies` answer the reviews in order. Records the round, updates the
 *      manuscript, saves the point-by-point response (Review History), moves
 *      the article back to Under review and tells the editors.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await params;
  const article = await db.article.findUnique({ where: { id }, select: { correspondingAuthorId: true } });
  const editor = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"].includes(session.role);
  if (!article || (article.correspondingAuthorId !== session.userId && !editor)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const revisions = await db.articleRevision.findMany({ where: { articleId: id }, orderBy: { round: "desc" } });
  return NextResponse.json({ revisions });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await params;
  const article = await db.article.findUnique({
    where: { id },
    select: { id: true, title: true, abstract: true, manuscriptKey: true, status: true, correspondingAuthorId: true },
  });
  if (!article || article.correspondingAuthorId !== session.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (article.status !== "REVISIONS_REQUIRED") {
    return NextResponse.json({ error: "Revisions can be submitted only after the editor requests them" }, { status: 409 });
  }

  const b = (await req.json().catch(() => ({}))) as {
    title?: string; abstract?: string; manuscriptKey?: string; manuscriptName?: string; coverNote?: string; replies?: unknown;
  };
  const title = (b.title ?? article.title).trim().slice(0, 500) || article.title;
  const abstract = (b.abstract ?? article.abstract).trim().slice(0, MAX) || article.abstract;
  const replies = Array.isArray(b.replies) ? b.replies.map((r) => (typeof r === "string" ? r.trim().slice(0, MAX) : "")) : [];
  const coverNote = (b.coverNote || "").trim().slice(0, MAX);
  if (!coverNote && !replies.some(Boolean)) {
    return NextResponse.json({ error: "Add a response to the reviewers before submitting" }, { status: 400 });
  }
  if (b.manuscriptKey && !/^[\w./-]+$/.test(b.manuscriptKey)) return NextResponse.json({ error: "Invalid manuscript" }, { status: 400 });

  const reviews = await db.review.findMany({
    where: { articleId: id, status: "COMPLETED" },
    orderBy: { createdAt: "asc" },
    select: { commentsToAuthor: true },
  });
  const letter = [
    coverNote && `Dear Editor,\n\n${coverNote}`,
    ...reviews.map((r, i) => {
      const reply = replies[i];
      if (!reply) return null;
      const quoted = (r.commentsToAuthor || "").trim().split("\n").map((l) => `> ${l}`).join("\n");
      return `Response to Reviewer ${i + 1}\n\n${quoted ? `${quoted}\n\n` : ""}${reply}`;
    }),
  ]
    .filter(Boolean)
    .join("\n\n———\n\n")
    .slice(0, MAX * 2);

  const round = (await db.articleRevision.count({ where: { articleId: id } })) + 1;
  await db.articleRevision.create({
    data: {
      articleId: id,
      round,
      previousTitle: article.title,
      previousAbstract: article.abstract,
      previousManuscriptKey: article.manuscriptKey,
      title,
      abstract,
      manuscriptKey: b.manuscriptKey || article.manuscriptKey,
      manuscriptName: b.manuscriptName?.slice(0, 200) || null,
      responseLetter: letter,
    },
  });
  await db.article.update({
    where: { id },
    data: { title, abstract, status: "UNDER_REVIEW", ...(b.manuscriptKey ? { manuscriptKey: b.manuscriptKey } : {}) },
  });
  await db.authorResponse.create({ data: { articleId: id, authorId: session.userId, content: letter } });
  await db.auditLog
    .create({ data: { userId: session.userId, action: "REVISION_SUBMITTED", entityType: "ARTICLE", entityId: id, articleId: id, metadata: JSON.stringify({ round }) } })
    .catch(() => {});

  const editors = await db.user.findMany({ where: { role: { in: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"] } }, select: { id: true } });
  await notifyMany(
    editors.map((e) => ({
      userId: e.id,
      type: "INFO" as const,
      category: "EDITORIAL" as const,
      link: "/dashboard/editor-queue",
      title: `Revision ${round} received`,
      message: `The authors of "${title}" have submitted a revised manuscript with a point-by-point response to the reviewers.`,
      articleId: id,
    }))
  );
  return NextResponse.json({ ok: true, round });
}
