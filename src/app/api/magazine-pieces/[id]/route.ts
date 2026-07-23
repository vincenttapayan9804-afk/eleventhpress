import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PRIVILEGED_ROLES_LIST as PRIVILEGED_ROLES } from "@/lib/roles";

/**
 * PATCH /api/magazine-pieces/[id]
 * { title?, dek?, authors?, category?, bodyHtml?, heroImageKey?, isCoverStory?, order? }
 * Editorial-only, and only while the parent issue is still DRAFT — a
 * piece inside a compiled/published issue is locked, same reasoning as
 * PATCH /api/magazine-issues/[id].
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await db.magazinePiece.findUnique({ where: { id }, include: { issue: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.issue.status !== "DRAFT") {
    return NextResponse.json({ error: "Pieces can only be edited while the issue is in DRAFT" }, { status: 400 });
  }

  const body = (await req.json()) as {
    title?: string;
    dek?: string;
    authors?: string;
    category?: string;
    bodyHtml?: string;
    heroImageKey?: string;
    isCoverStory?: boolean;
    order?: number;
  };

  if (body.isCoverStory) {
    await db.magazinePiece.updateMany({ where: { issueId: existing.issueId, id: { not: id } }, data: { isCoverStory: false } });
  }

  const piece = await db.magazinePiece.update({
    where: { id },
    data: {
      title: body.title ?? existing.title,
      dek: body.dek ?? existing.dek,
      authors: body.authors ?? existing.authors,
      category: body.category ?? existing.category,
      bodyHtml: body.bodyHtml ?? existing.bodyHtml,
      heroImageKey: body.heroImageKey ?? existing.heroImageKey,
      isCoverStory: body.isCoverStory ?? existing.isCoverStory,
      order: body.order ?? existing.order,
    },
  });

  return NextResponse.json({ piece });
}

/** DELETE /api/magazine-pieces/[id] — editorial-only, DRAFT issues only. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(req.headers, PRIVILEGED_ROLES);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await db.magazinePiece.findUnique({ where: { id }, include: { issue: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.issue.status !== "DRAFT") {
    return NextResponse.json({ error: "Pieces can only be removed while the issue is in DRAFT" }, { status: 400 });
  }

  await db.magazinePiece.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
