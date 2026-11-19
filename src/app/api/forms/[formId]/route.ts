import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { notify, notifyMany } from "@/lib/notify";
import { isSameEditorialTenant } from "@/lib/tenant-auth";
import { editorsForReview } from "@/lib/review-editors";
import { formById } from "@/lib/forms";
import { validateFormAnswers } from "@/lib/forms/validate";
import { declaredConflict, editorCoiFor, editorsOfTenant, isEditorRole, latestArticleForm, saveFormSubmission } from "@/lib/forms/server";
import { emailFormContact, formReference } from "@/lib/forms/mail";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { checkRateLimit } from "@/lib/ratelimit";
import { extractRequestIp } from "@/lib/institutions";

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
 * - EP-F-16 / EP-F-17 (corresponding author): proof approval, and a
 *   withdrawal request the editor decides.
 * - EP-F-18 / EP-F-19 (reviewer, per review): reporting-guideline
 *   assessment and open-review consent, asked for with the report.
 * - EP-F-20 / EP-F-21 / EP-F-22 (editor, per manuscript): screening
 *   checklist, APC waiver assessment (updates the waiver status) and
 *   research-integrity record.
 * - EP-F-23 to EP-F-26 (anyone, signed in or not): complaints, concerns,
 *   correction and data-privacy requests, PENDING until an editor (or, for
 *   privacy, an administrator) closes them.
 *
 * The submission declarations (SUBMISSION_FORM_IDS) are only accepted
 * through /api/articles/submit, with the manuscript they belong to.
 * EP-F-12 is signed on paper or PDF and kept by the authors.
 */
const REVIEWER_ROLES = ["REVIEWER", "ASSOCIATE_EDITOR", "EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"];
const APPEAL_WINDOW_DAYS = 30;

const DOI_RE = /\b(10\.\d{4,9}\/[^\s"<>]+)/i;

export async function POST(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  const { formId } = await params;
  const doc = formById(formId);
  if (!doc) return NextResponse.json({ error: "No such form" }, { status: 404 });
  if (doc.scope === "submission") {
    return NextResponse.json({ error: `${doc.code} is completed as part of the submission form.` }, { status: 400 });
  }
  if (doc.scope === "offline") {
    return NextResponse.json({ error: `${doc.code} is completed on the PDF and kept by the authors.` }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { answers?: unknown; signedName?: unknown; articleId?: string; reviewId?: string };

  // ── Public forms: complaints, concerns, correction and privacy requests ──
  if (doc.scope === "public") {
    const rl = await checkRateLimit(`form-public:${doc.id}:${session?.userId ?? extractRequestIp(req.headers)}`, 5, 3600);
    if (!rl.ok) return NextResponse.json({ error: "Too many submissions. Please try again later or email the editorial office." }, { status: 429 });
    const v = validateFormAnswers(doc, body.answers, body.signedName);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
    let tenantId: string | null = tenant && !tenant.isPlatform ? tenant.id : null;
    // Link the record to the article it names, when it can be found.
    let articleId: string | null = null;
    const ref = typeof v.answers.articleRef === "string" ? v.answers.articleRef : "";
    const doi = ref.match(DOI_RE)?.[1]?.replace(/[.,;)]+$/, "");
    if (doi || ref.length >= 12) {
      const a = await db.article.findFirst({
        where: doi ? { doi: { equals: doi, mode: "insensitive" } } : { title: { equals: ref.trim(), mode: "insensitive" } },
        select: { id: true, journal: { select: { tenantId: true } } },
      });
      if (a) {
        articleId = a.id;
        tenantId = a.journal?.tenantId ?? tenantId;
      }
    }
    const contactEmail = typeof v.answers.contactEmail === "string" ? v.answers.contactEmail : null;
    const record = await saveFormSubmission({ doc, userId: session?.userId ?? null, contactEmail, tenantId, articleId, answers: v.answers, signedName: v.signedName, status: "PENDING" });
    const reference = formReference(record);
    await db.auditLog.create({
      data: { userId: session?.userId ?? null, action: `${doc.id.replace(/^form-/, "").replace(/-/g, "_").toUpperCase()}_RECEIVED`, entityType: "FORM", entityId: record.id, articleId, metadata: JSON.stringify({ form: doc.code, reference }) },
    }).catch(() => {});
    const privacy = doc.id === "form-privacy-request";
    const recipients = privacy
      ? (await db.user.findMany({ where: { OR: [{ role: "SUPER_ADMIN" }, ...(tenantId ? [{ role: "TENANT_ADMIN", tenantId }] : [])] }, select: { id: true } })).map((u) => u.id)
      : await editorsOfTenant(tenantId);
    await notifyMany(
      recipients.map((userId) => ({
        userId,
        type: (doc.id === "form-report-concern" ? "WARNING" : "INFO") as "WARNING" | "INFO",
        category: "EDITORIAL" as const,
        link: "/dashboard/official-forms",
        ...(articleId ? { articleId } : {}),
        title: `New ${doc.title.toLowerCase()} (${reference})`,
        message: `${v.signedName === "Anonymous" ? "An anonymous sender" : v.signedName} submitted ${doc.code} ${doc.title}${ref ? ` about “${ref.slice(0, 160)}”` : ""}. Open Official forms in your dashboard to handle it.`,
      }))
    );
    await emailFormContact(
      contactEmail,
      tenantId,
      `We received your ${doc.title.toLowerCase()} (${reference})`,
      `Thank you. Your ${doc.title.toLowerCase()} has been received and given the reference ${reference}. ${doc.afterSubmission.join(" ")}`
    );
    return NextResponse.json({ record: { id: record.id }, reference, outcome: "PENDING" });
  }

  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

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

  // ── Reviewer forms that go with the report ──────────────────────────
  if (doc.scope === "review") {
    const review = body.reviewId ? await db.review.findUnique({ where: { id: body.reviewId }, select: { id: true, reviewerId: true, status: true, articleId: true, article: { select: { journal: { select: { tenantId: true } } } } } }) : null;
    if (!review || review.reviewerId !== session.userId) return NextResponse.json({ error: "Review invitation not found" }, { status: 404 });
    if (["DECLINED", "COMPLETED"].includes(review.status)) return NextResponse.json({ error: "This review is already closed." }, { status: 409 });
    const v = validateFormAnswers(doc, body.answers, body.signedName);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    const record = await saveFormSubmission({ doc, userId: session.userId, tenantId: review.article.journal?.tenantId, articleId: review.articleId, reviewId: review.id, answers: v.answers, signedName: v.signedName });
    return NextResponse.json({ record: { id: record.id }, outcome: "SIGNED" });
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

  // ── Editor records: screening, APC waiver, research integrity ───────
  if (doc.scope === "editor-article") {
    if (!isEditorRole(session.role) || !isSameEditorialTenant(session, tenantId)) {
      return NextResponse.json({ error: "Only an editor of this journal can complete this form." }, { status: 403 });
    }
    if (doc.id !== "form-integrity-record" && declaredConflict(await editorCoiFor(session.userId, article.id))) {
      return NextResponse.json({ error: "You declared a competing interest on this manuscript (EP-F-09) and are recused from it." }, { status: 403 });
    }
    const waiver = doc.id === "form-waiver-assessment" ? await db.article.findUnique({ where: { id: article.id }, select: { apcWaiverStatus: true, apcWaiverRequested: true } }) : null;
    if (waiver && !waiver.apcWaiverRequested && waiver.apcWaiverStatus === "NONE") {
      return NextResponse.json({ error: "The authors did not request an APC waiver for this manuscript." }, { status: 409 });
    }
    const v = validateFormAnswers(doc, body.answers, body.signedName);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    if (doc.id === "form-waiver-assessment" && v.answers.decision === "partial") {
      const pct = Number(v.answers.percentage);
      if (!Number.isInteger(pct) || pct < 1 || pct > 99) return NextResponse.json({ error: "A partial waiver needs a percentage between 1 and 99." }, { status: 400 });
    }
    const record = await saveFormSubmission({ doc, userId: session.userId, tenantId, articleId: article.id, answers: v.answers, signedName: v.signedName });
    let outcome = "SIGNED";
    if (doc.id === "form-waiver-assessment") {
      const granted = v.answers.decision !== "deny";
      outcome = granted ? "WAIVER_APPROVED" : "WAIVER_DENIED";
      await db.article.update({ where: { id: article.id }, data: { apcWaiverStatus: granted ? "APPROVED" : "DENIED" } });
      if (article.correspondingAuthorId) {
        const what = v.answers.decision === "full" ? "a full waiver of the article processing charge" : v.answers.decision === "partial" ? `a ${v.answers.percentage}% waiver of the article processing charge` : "no waiver of the article processing charge";
        await notify({
          userId: article.correspondingAuthorId,
          type: granted ? "SUCCESS" : "INFO",
          category: "EDITORIAL",
          articleId: article.id,
          link: "/dashboard/my-articles",
          title: granted ? "APC waiver approved" : "Decision on your APC waiver request",
          message: `Your waiver request for "${article.title}" was assessed under the APC Waiver Policy: ${what}. ${String(v.answers.reasons ?? "")} This decision is separate from, and has no effect on, the editorial decision.`,
        });
      }
    }
    if (doc.id === "form-desk-screening") outcome = String(v.answers.outcome).toUpperCase();
    await db.auditLog.create({
      data: {
        userId: session.userId,
        action: { "form-desk-screening": "SCREENING_RECORDED", "form-waiver-assessment": "APC_WAIVER_ASSESSED", "form-integrity-record": "INTEGRITY_RECORD" }[doc.id] ?? "FORM_SIGNED",
        entityType: "ARTICLE",
        entityId: article.id,
        articleId: article.id,
        metadata: JSON.stringify({ form: doc.code, recordId: record.id, outcome: v.answers.outcome ?? v.answers.decision ?? null }),
      },
    });
    return NextResponse.json({ record: { id: record.id }, outcome });
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
  } else if (doc.id === "form-withdrawal") {
    if (["PUBLISHED", "RETRACTED", "WITHDRAWN", "REJECTED"].includes(article.status)) {
      return NextResponse.json({ error: "Only a manuscript that has not been published or decided can be withdrawn. A published article needs a correction or retraction." }, { status: 409 });
    }
    const pending = await db.formSubmission.findFirst({ where: { articleId: article.id, formId: doc.id, status: "PENDING" }, select: { id: true } });
    if (pending) return NextResponse.json({ error: "A withdrawal request for this manuscript is already waiting for the editor." }, { status: 409 });
  } else if (doc.id === "form-proof-approval") {
    if (!["ACCEPTED", "IN_PRODUCTION"].includes(article.status)) return NextResponse.json({ error: "A proof can be approved once the article is accepted and in production." }, { status: 409 });
    const v = validateFormAnswers(doc, body.answers, body.signedName);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    const record = await saveFormSubmission({ doc, userId: session.userId, tenantId, articleId: article.id, answers: v.answers, signedName: v.signedName });
    const corrections = v.answers.decision === "corrections";
    await db.auditLog.create({
      data: { userId: session.userId, action: corrections ? "PROOF_CORRECTIONS" : "PROOF_APPROVED", entityType: "ARTICLE", entityId: article.id, articleId: article.id, metadata: JSON.stringify({ form: doc.code, recordId: record.id }) },
    });
    const editors = await editorsOfTenant(tenantId);
    await notifyMany(
      editors.map((userId) => ({
        userId,
        type: (corrections ? "WARNING" : "SUCCESS") as "WARNING" | "SUCCESS",
        category: "EDITORIAL" as const,
        link: "/dashboard/editor-queue",
        articleId: article.id,
        title: corrections ? "Proof corrections from the author" : "Proof approved by the author",
        message: `${session.fullName} approved the proof of "${article.title}"${corrections ? " subject to corrections. The list is in the manuscript's Forms tab." : " for publication."} (${doc.code})`,
      }))
    );
    return NextResponse.json({ record: { id: record.id }, outcome: corrections ? "CORRECTIONS" : "APPROVED" });
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
    data: { userId: session.userId, action: { "form-appeal": "APPEAL_SUBMITTED", "form-withdrawal": "WITHDRAWAL_REQUESTED" }[doc.id] ?? "AUTHORSHIP_CHANGE_REQUESTED", entityType: "ARTICLE", entityId: article.id, articleId: article.id, metadata: JSON.stringify({ form: doc.code, recordId: record.id }) },
  });
  const editors = await editorsOfTenant(tenantId);
  await notifyMany(
    editors.map((userId) => ({
      userId,
      type: "INFO" as const,
      category: "EDITORIAL" as const,
      link: "/dashboard/official-forms",
      articleId: article.id,
      title: { "form-appeal": "New appeal of an editorial decision", "form-withdrawal": "Withdrawal requested" }[doc.id] ?? "Authorship change requested",
      message: `${session.fullName} submitted ${doc.code} (${doc.title}) for "${article.title}". Open Official forms in your dashboard to decide it.`,
    }))
  );
  return NextResponse.json({ record: { id: record.id }, outcome: "PENDING" });
}
