import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { isSameEditorialTenant } from "@/lib/tenant-auth";
import { formById } from "@/lib/forms";
import type { ListedAuthorAnswer } from "@/lib/forms/types";
import { isEditorRole, parseAnswers } from "@/lib/forms/server";

/**
 * POST /api/forms/records/[id]/decide — an editor decides an authorship
 * change request (EP-F-06) or an appeal (EP-F-11).
 * Body: { decision: "APPROVE" | "DECLINE", note: string }
 *
 * - Approving an authorship change replaces the manuscript's author list
 *   with the proposed one (keeping each remaining author's CRediT roles) and
 *   asks every newly listed author to confirm by email.
 * - An appeal is decided by an editor who did not make the rejection
 *   (COPE). Granting it returns the manuscript to the editorial queue.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!isEditorRole(session.role)) return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { decision?: string; note?: string };
  if (body.decision !== "APPROVE" && body.decision !== "DECLINE") return NextResponse.json({ error: "decision must be APPROVE or DECLINE" }, { status: 400 });
  const note = (body.note || "").trim().slice(0, 4000);
  if (note.length < 10) return NextResponse.json({ error: "Explain the decision to the author (at least a sentence)." }, { status: 400 });

  const row = await db.formSubmission.findUnique({ where: { id } });
  if (!row || !["form-authorship-change", "form-appeal"].includes(row.formId) || !row.articleId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (row.status !== "PENDING") return NextResponse.json({ error: "This request has already been decided." }, { status: 409 });
  const article = await db.article.findUnique({ where: { id: row.articleId }, select: { id: true, title: true, status: true, authors: true, journal: { select: { tenantId: true } } } });
  if (!article) return NextResponse.json({ error: "Manuscript not found" }, { status: 404 });
  if (!isSameEditorialTenant(session, article.journal?.tenantId)) return NextResponse.json({ error: "Forbidden — not an editor of this journal" }, { status: 403 });
  const doc = formById(row.formId)!;
  const approve = body.decision === "APPROVE";

  if (row.formId === "form-appeal") {
    const rejection = await db.editorialDecision.findFirst({ where: { articleId: article.id, decision: "REJECT" }, orderBy: { createdAt: "desc" }, select: { editorId: true } });
    if (rejection?.editorId === session.userId) {
      return NextResponse.json({ error: "An appeal must be decided by an editor who was not involved in the original decision." }, { status: 403 });
    }
    if (approve && article.status === "REJECTED") {
      await db.article.update({ where: { id: article.id }, data: { status: "SUBMITTED" } });
    }
  }

  let added = 0;
  if (row.formId === "form-authorship-change" && approve) {
    const answers = parseAnswers(row.answers);
    const proposed = (answers.proposedAuthors as ListedAuthorAnswer[] | undefined) ?? [];
    if (!proposed.length) return NextResponse.json({ error: "The request has no proposed author list." }, { status: 400 });
    let current: { email?: string; creditRoles?: string[]; rorId?: string }[] = [];
    try {
      current = JSON.parse(article.authors || "[]");
    } catch {}
    const byEmail = new Map(current.filter((a) => a.email).map((a) => [String(a.email).toLowerCase(), a]));
    const next = proposed.map((p) => {
      const prev = byEmail.get(p.email.toLowerCase());
      return { name: p.name, email: p.email, affiliation: p.affiliation ?? "", orcid: p.orcid ?? "", rorId: prev?.rorId ?? "", creditRoles: prev?.creditRoles ?? [] };
    });
    let correspondingAuthorId: string | undefined;
    const newCorresponding = typeof answers.newCorresponding === "string" ? answers.newCorresponding.trim().toLowerCase() : "";
    if (newCorresponding) {
      const u = await db.user.findFirst({ where: { email: { equals: newCorresponding, mode: "insensitive" } }, select: { id: true } });
      if (u) correspondingAuthorId = u.id;
    }
    await db.article.update({ where: { id: article.id }, data: { authors: JSON.stringify(next), ...(correspondingAuthorId ? { correspondingAuthorId } : {}) } });
    const asked = await db.authorshipConfirmation.findMany({ where: { articleId: article.id }, select: { email: true } });
    const askedSet = new Set(asked.map((a) => a.email.toLowerCase()));
    const fresh = next.filter((a) => !askedSet.has(a.email.toLowerCase()));
    const requester = await db.user.findUnique({ where: { id: row.userId }, select: { email: true, fullName: true, tenantId: true } });
    if (fresh.length && requester) {
      added = await import("@/lib/authorship")
        .then(({ requestAuthorshipConfirmations }) =>
          requestAuthorshipConfirmations({ articleId: article.id, title: article.title, authors: fresh, submitterEmail: requester.email, submitterName: requester.fullName, tenantId: requester.tenantId })
        )
        .catch(() => 0);
    }
  }

  await db.formSubmission.update({
    where: { id },
    data: { status: approve ? "APPROVED" : "DECLINED", decisionNote: note, decidedById: session.userId, decidedAt: new Date() },
  });
  await db.auditLog.create({
    data: {
      userId: session.userId,
      action: `${row.formId === "form-appeal" ? "APPEAL" : "AUTHORSHIP_CHANGE"}_${approve ? "APPROVED" : "DECLINED"}`,
      entityType: "ARTICLE",
      entityId: article.id,
      articleId: article.id,
      metadata: JSON.stringify({ form: doc.code, recordId: id }),
    },
  });

  const appeal = row.formId === "form-appeal";
  await notify({
    userId: row.userId,
    type: approve ? "SUCCESS" : "INFO",
    category: "EDITORIAL",
    articleId: article.id,
    title: appeal ? (approve ? "Your appeal was granted" : "Outcome of your appeal") : approve ? "Authorship change approved" : "Authorship change declined",
    message: appeal
      ? `${approve ? `"${article.title}" will be reconsidered.` : `The decision on "${article.title}" stands.`} Editor's explanation: ${note}`
      : `${approve ? `The author list of "${article.title}" has been updated${added ? ` and ${added} new author${added === 1 ? " has" : "s have"} been asked to confirm` : ""}.` : `The author list of "${article.title}" is unchanged.`} Editor's explanation: ${note}`,
  });

  return NextResponse.json({ ok: true, status: approve ? "APPROVED" : "DECLINED" });
}
