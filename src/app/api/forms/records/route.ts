import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { isSameEditorialTenant } from "@/lib/tenant-auth";
import { formById, formStatusLabel } from "@/lib/forms";
import { canReadFormRecord, isEditorRole, parseAnswers } from "@/lib/forms/server";

/**
 * GET /api/forms/records — signed Official Forms the caller may read.
 *
 * - `?articleId=` every record on that manuscript the caller may see
 *   (editors: all; the corresponding author: the author-side forms).
 * - `?inbox=1` (editors) authorship-change requests and appeals for the
 *   editor's journal, pending first.
 * - otherwise the caller's own signed forms.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const articleId = sp.get("articleId");

  let rows: Awaited<ReturnType<typeof db.formSubmission.findMany>>;
  if (sp.get("inbox") === "1") {
    if (!isEditorRole(session.role)) return NextResponse.json({ error: "Editor role required" }, { status: 403 });
    rows = await db.formSubmission.findMany({
      where: {
        formId: { in: ["form-authorship-change", "form-appeal"] },
        ...(session.role === "SUPER_ADMIN" || !session.tenantId ? {} : { OR: [{ tenantId: session.tenantId }, { tenantId: null }] }),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    rows = rows.filter((r) => isSameEditorialTenant(session, r.tenantId));
    rows.sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING"));
  } else if (articleId) {
    const all = await db.formSubmission.findMany({ where: { articleId }, orderBy: { createdAt: "asc" } });
    rows = [];
    for (const r of all) if (await canReadFormRecord(session, r)) rows.push(r);
  } else {
    rows = await db.formSubmission.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" }, take: 200 });
  }

  const articleIds = [...new Set(rows.map((r) => r.articleId).filter((x): x is string => !!x))];
  const articles = articleIds.length
    ? await db.article.findMany({ where: { id: { in: articleIds } }, select: { id: true, title: true, status: true } })
    : [];
  const signerIds = [...new Set(rows.map((r) => r.userId))];
  const signers = await db.user.findMany({ where: { id: { in: signerIds } }, select: { id: true, fullName: true } });

  return NextResponse.json({
    records: rows.map((r) => {
      const f = formById(r.formId);
      return {
        id: r.id,
        formId: r.formId,
        code: r.formCode,
        title: f?.title ?? r.formCode,
        version: r.formVersion,
        status: r.status,
        statusLabel: formStatusLabel(r.formId, r.status),
        signedName: r.signedName,
        signedAt: r.signedAt,
        signer: signers.find((s) => s.id === r.userId)?.fullName ?? r.signedName,
        article: articles.find((a) => a.id === r.articleId) ?? null,
        reviewId: r.reviewId,
        decisionNote: r.decisionNote,
        decidedAt: r.decidedAt,
        answers: parseAnswers(r.answers),
        pdfUrl: `/api/forms/records/${r.id}/pdf`,
      };
    }),
  });
}
