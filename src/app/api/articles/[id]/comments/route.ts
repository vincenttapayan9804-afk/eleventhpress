import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { notify } from "@/lib/notify";
import { articlePath } from "@/lib/spa-routes";

const EDITORS = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"];
const MAX_LEN = 5000;

/**
 * Post-publication discussion.
 * GET    — visible comments (editors also see hidden ones and report counts).
 * POST   { body, parentId? } — signed-in readers comment on a published article; the
 *          corresponding author is told about new top-level comments, and a commenter
 *          about replies to them.
 * PATCH  { commentId, action: "hide" | "show" | "report" } — editors moderate; anyone signed in can report.
 * DELETE ?commentId=… — remove your own comment.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSessionFromHeaders(req.headers);
  const editor = !!session && EDITORS.includes(session.role);
  const rows = await db.articleComment.findMany({
    where: { articleId: id, ...(editor ? {} : { status: "VISIBLE" }) },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
    select: { id: true, fullName: true, avatarUrl: true, affiliation: true, role: true },
  });
  const article = await db.article.findUnique({ where: { id }, select: { correspondingAuthorId: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return NextResponse.json({
    canModerate: editor,
    comments: rows.map((r) => {
      const u = byId.get(r.userId);
      return {
        id: r.id,
        parentId: r.parentId,
        body: r.body,
        createdAt: r.createdAt,
        editedAt: r.editedAt,
        mine: r.userId === session?.userId,
        isAuthor: r.userId === article?.correspondingAuthorId,
        isEditor: !!u && EDITORS.includes(u.role),
        author: { name: u?.fullName ?? "Former member", avatarUrl: u?.avatarUrl ?? null, affiliation: u?.affiliation ?? null },
        ...(editor ? { status: r.status, reports: r.reports } : {}),
      };
    }),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Sign in to join the discussion" }, { status: 401 });
  const { id } = await params;
  const rl = await checkRateLimit(`comment:${session.userId}`, 10, 600);
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { body?: string; parentId?: string };
  const body = (b.body || "").trim();
  if (body.length < 2) return NextResponse.json({ error: "Write a comment first" }, { status: 400 });
  if (body.length > MAX_LEN) return NextResponse.json({ error: `Comments are limited to ${MAX_LEN} characters` }, { status: 400 });
  const article = await db.article.findUnique({ where: { id }, select: { id: true, title: true, status: true, correspondingAuthorId: true } });
  if (!article || article.status !== "PUBLISHED") return NextResponse.json({ error: "Discussion is open on published articles only" }, { status: 404 });
  let parent: Awaited<ReturnType<typeof db.articleComment.findUnique>> = null;
  if (b.parentId) {
    parent = await db.articleComment.findUnique({ where: { id: b.parentId } });
    if (!parent || parent.articleId !== id) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  const comment = await db.articleComment.create({ data: { articleId: id, userId: session.userId, parentId: parent?.parentId ?? parent?.id ?? null, body } });

  const link = `${articlePath(article.id, article.title)}#discussion`;
  const recipient = parent ? parent.userId : article.correspondingAuthorId;
  if (recipient && recipient !== session.userId) {
    await notify({
      userId: recipient,
      type: "INFO",
      category: parent ? "GENERAL" : "SUBMISSIONS",
      link,
      title: parent ? `${session.fullName} replied to your comment` : `New comment on "${article.title.slice(0, 80)}"`,
      message: body.slice(0, 280),
    }).catch(() => {});
  }
  return NextResponse.json({ id: comment.id });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { commentId?: string; action?: string };
  const c = b.commentId ? await db.articleComment.findUnique({ where: { id: b.commentId } }) : null;
  if (!c || c.articleId !== id) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  if (b.action === "report") {
    await db.articleComment.update({ where: { id: c.id }, data: { reports: { increment: 1 } } });
    return NextResponse.json({ ok: true });
  }
  if (!EDITORS.includes(session.role)) return NextResponse.json({ error: "Editors only" }, { status: 403 });
  if (b.action !== "hide" && b.action !== "show") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  await db.articleComment.update({ where: { id: c.id }, data: { status: b.action === "hide" ? "HIDDEN" : "VISIBLE" } });
  await db.auditLog
    .create({ data: { userId: session.userId, action: b.action === "hide" ? "COMMENT_HIDDEN" : "COMMENT_SHOWN", entityType: "COMMENT", entityId: c.id, articleId: id } })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await params;
  const commentId = req.nextUrl.searchParams.get("commentId");
  if (!commentId) return NextResponse.json({ error: "commentId is required" }, { status: 400 });
  const r = await db.articleComment.deleteMany({ where: { id: commentId, articleId: id, userId: session.userId } });
  if (r.count) await db.articleComment.deleteMany({ where: { parentId: commentId } });
  return NextResponse.json({ ok: r.count > 0 });
}
