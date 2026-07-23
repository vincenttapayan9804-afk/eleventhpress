import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { presignGet } from "@/lib/storage";
import { getSessionFromHeaders, requireRole } from "@/lib/auth";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

/** GET /api/media/[id] — public for PUBLISHED posts, editorial-only otherwise. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await db.mediaPost.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = getSessionFromHeaders(req.headers);
  const isPrivileged = !!session && PRIVILEGED_ROLES.includes(session.role);
  if (post.status !== "PUBLISHED" && !isPrivileged) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    post: { ...post, heroImageUrl: post.heroImageKey ? await presignGet(post.heroImageKey) : null },
  });
}

/** PATCH /api/media/[id] { title?, dek?, authorName?, bodyHtml?, category?, tags?, heroImageKey? } — editorial-only. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await db.mediaPost.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    title?: string;
    dek?: string;
    authorName?: string;
    bodyHtml?: string;
    category?: string;
    tags?: string;
    heroImageKey?: string;
  };

  const post = await db.mediaPost.update({
    where: { id },
    data: {
      title: body.title ?? existing.title,
      dek: body.dek ?? existing.dek,
      authorName: body.authorName ?? existing.authorName,
      bodyHtml: body.bodyHtml ?? existing.bodyHtml,
      category: body.category ?? existing.category,
      tags: body.tags ?? existing.tags,
      heroImageKey: body.heroImageKey ?? existing.heroImageKey,
    },
  });

  return NextResponse.json({ post });
}

/** DELETE /api/media/[id] — editorial-only, DRAFT posts only. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await db.mediaPost.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status === "PUBLISHED") {
    return NextResponse.json({ error: "A published post can't be deleted" }, { status: 400 });
  }

  await db.mediaPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
