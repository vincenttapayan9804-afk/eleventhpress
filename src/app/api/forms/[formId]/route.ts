import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { notifyMany } from "@/lib/notify";
import { isSameEditorialTenant } from "@/lib/tenant-auth";
import { editorsForReview } from "@/lib/review-editors";
import { formById } from "@/lib/forms";
import { validateFormAnswers } from "@/lib/forms/validate";
import { editorsOfTenant, isEditorRole, saveFormSubmission } from "@/lib/forms/server";

/**
 * POST /api/forms/[formId] — sign an Official Form outside the submission
 * form. Body: { answers, signedName, articleId?, reviewId? }.
 *
 * - EP-F-07 (reviewer COI, per review invitation): a declared competing
 *   interest declines the invitation; a possible one is passed to the editor.
 * - EP-F-08 / EP-F-10 (once per person): reviewer and editor undertakings.
 * - EP-F-09 (editor COI, per manuscript): a declared interest recuses the
 *   editor from decisions on that manuscript.
 * - EP-F-06 / EP-F-11 (requests by the corresponding author): an authorship
 *   change or an appeal, PENDING until an editor decides it.
 *
 * The five submission declarations (EP-F-01 to EP-F-05) are only accepted
 * through /api/articles/submit, with the manuscript they belong to.
 */
const REVIEWER_ROLES = ["REVIEWER", "ASSOCIATE_EDITOR", "EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"];
const APPEAL_WINDOW_DAYS = 30;

export async function POST(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { formId } = await params;
  const doc = formById(formId);
  if (!doc) return NextResponse.json({ error: "No such form" }, { status: 404 });
  if (doc.scope === "submission") {
    return NextResponse.json({ error: `${doc.code} is completed as part of the submission form.` }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { answers?: unknown; signedName?: unknown; articleId?: string; reviewId?: string };

  // ── Reviewer conflict of interest, per invitation ───────────────────
  if (doc.id === "form-reviewer-coi") {
    const review = body.reviewId
      ? await db.review.findUnique({ where: { id: body.reviewId }, include: { article: { select: { id: true, title: true, journal: { select: { tenantId: true } } } }, reviewer: { select: { fullName: true } } } })
      : null;
    if (!review || review.reviewerId !== session.userId) return NextResponse.json({ error: "Review invitation not found" }, { status: 404 });
    if (["DECLINED", "COMPLETED"].includes(review.status)) return NextResponse.json({ error: "This review is already closed." }, { status: 409 });
    const v = validateFormAnswers(doc, body.answers, body.signedName);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    const conflict = String(v.answers.conflict);
    const record = await saveFormSubmission({ doc, userId: session.userId, tenantId: review.article.journal?.tenantId, articleId: review.articleId, reviewId: review.id, answers: v.answers, signedName: v.signedName });
    const declined = conflict === "yes";
    await db.review.update({
      where: { id: review.id },
      data: {
        conflictOfInterest: conflict !== "none",
        ...(declined ? { status: "DECLINED", respondedAt: new Date(), declineReason: `Declared a competing interest (${doc.code}): ${String(v.answers.details ?? "").slice(0, 600)}` } : {}),
      },
    });
    if (conflict !== "none") {
      const editors = await editorsForReview(review.id);
      await notifyMany(
        editors.map((userId) => ({
          userId,
          type: "WARNING" as const,
          category: "EDITORIAL" as const,
          link: "/dashboard/editor-queue",
          articleId: review.articleId,
          title: declined ? "Reviewer declined: competing interest" : "Reviewer disclosed a possible competing interest",
          message: `${review.reviewer.fullName} ${declined ? "declined to review" : "disclosed a possible competing interest on"} "${review.article.title}" (${doc.code}): ${String(v.answers.details ?? "").slice(0, 300)}${declined ? " Please invite another reviewer." : " Decide whether to keep this reviewer."}`,
        }))
      );
    }
    return NextResponse.json({ record: { id: record.id }, outcome: declined ? "DECLINED" : conflict === "possible" ? "DISCLOSED" : "CLEAR" });
  }

  // ── Once-per-person undertakings ────────────────────────────────────
  if (doc.scope === "once") {
    const allowed = doc.role === "editor" ? isEditorRole(session.role) : REVIEWER_ROLES.includes(session.role);
    if (!allowed) return NextResponse.json({ error: `${doc.code} is for ${doc.audience.toLowerCase()}.` }, { status: 403 });
    const v = validateFormAnswers(doc, body.answers, body.signedName);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    const record = await saveFormSubmission({ doc, userId: session.userId, tenantId: session.tenantId, answers: v.answers, signedName: v.signedName });
    return NextResponse.json({ record: { id: record.id }, outcome: "SIGNED" });
  }

  // Everything below is about one manuscript.
  const article = body.articleId
    ? await db.article.findUnique({ where: { id: body.articleId }, select: { id: true, title: true, status: true, correspondingAuthorId: true, journal: { select: { tenantId: true } } } })
    : null;
  if (!article) return NextResponse.json({ error: "Manuscript not found" }, { status: 404 });
  const tenantId = article.journal?.tenantId ?? null;

  // ── Editor conflict of interest, per manuscript ─────────────────────
  if (doc.id === "form-editor-coi") {
    if (!isEditorRole(session.role) || !isSameEditorialTenant(session, tenantId)) {
      return NextResponse.json({ error: "Only an editor of this journal can sign this declaration." }, { status: 403 });
    }
    const v = validateFormAnswers(doc, body.answers, body.signedName);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    const record = await saveFormSubmission({ doc, userId: session.userId, tenantId, articleId: article.id, answers: v.answers, signedName: v.signedName });
    const recused = v.answers.conflict === "yes";
    if (recused) {
      const editors = await editorsOfTenant(tenantId, session.userId);
      await notifyMany(
        editors.map((userId) => ({
          userId,
          type: "WARNING" as const,
          category: "EDITORIAL" as const,
          link: "/dashboard/editor-queue",
          articleId: article.id,
          title: "Editor recused: please reassign",
          message: `${session.fullName} declared a competing interest on "${article.title}" (${doc.code}) and has recused themselves. Another editor needs to handle this manuscript.`,
        }))
      );
    }
    await db.auditLog.create({
      data: { userId: session.userId, action: recused ? "EDITOR_RECUSED" : "EDITOR_COI_DECLARED", entityType: "ARTICLE", entityId: article.id, articleId: article.id, metadata: JSON.stringify({ form: doc.code }) },
    });
    return NextResponse.json({ record: { id: record.id }, outcome: recused ? "RECUSED" : "CLEAR" });
  }

  // ── Author requests: authorship change, appeal ──────────────────────
  if (article.correspondingAuthorId !== session.userId) {
    return NextResponse.json({ error: "Only the corresponding author can submit this form." }, { status: 403 });
  }
  const existing = await db.formSubmission.findFirst({
    where: { articleId: article.id, formId: doc.id, ...(doc.id === "form-authorship-change" ? { status: "PENDING" } : {}) },
    select: { id: true },
  });
  if (doc.id === "form-appeal") {
    if (article.status !== "REJECTED") return NextResponse.json({ error: "Only a rejected manuscript can be appealed." }, { status: 409 });
    if (existing) return NextResponse.json({ error: "This manuscript has already been appealed. Each manuscript can be appealed once." }, { status: 409 });
    const rejection = await db.editorialDecision.findFirst({ where: { articleId: article.id, decision: "REJECT" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    if (rejection && Date.now() - rejection.createdAt.getTime() > APPEAL_WINDOW_DAYS * 86400000) {
      return NextResponse.json({ error: `Appeals must be made within ${APPEAL_WINDOW_DAYS} days of the decision.` }, { status: 409 });
    }
  } else if (doc.id === "form-authorship-change") {
    if (["PUBLISHED", "RETRACTED", "WITHDRAWN", "REJECTED"].includes(article.status)) {
      return NextResponse.json({ error: "The author list can only be changed before publication. A published article needs a formal correction." }, { status: 409 });
    }
    if (existing) return NextResponse.json({ error: "An authorship change request for this manuscript is already waiting for the editor." }, { status: 409 });
  } else {
    return NextResponse.json({ error: "This form can't be submitted here." }, { status: 400 });
  }

  const v = validateFormAnswers(doc, body.answers, body.signedName);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const record = await saveFormSubmission({ doc, userId: session.userId, tenantId, articleId: article.id, answers: v.answers, signedName: v.signedName, status: "PENDING" });
  await db.auditLog.create({
    data: { userId: session.userId, action: doc.id === "form-appeal" ? "APPEAL_SUBMITTED" : "AUTHORSHIP_CHANGE_REQUESTED", entityType: "ARTICLE", entityId: article.id, articleId: article.id, metadata: JSON.stringify({ form: doc.code, recordId: record.id }) },
  });
  const editors = await editorsOfTenant(tenantId);
  await notifyMany(
    editors.map((userId) => ({
      userId,
      type: "INFO" as const,
      category: "EDITORIAL" as const,
      link: "/dashboard/official-forms",
      articleId: article.id,
      title: doc.id === "form-appeal" ? "New appeal of an editorial decision" : "Authorship change requested",
      message: `${session.fullName} submitted ${doc.code} (${doc.title}) for "${article.title}". Open Official forms in your dashboard to decide it.`,
    }))
  );
  return NextResponse.json({ record: { id: record.id }, outcome: "PENDING" });
}
