/**
 * Server side of the Official Forms: storing signed forms, the checks that
 * hold back a review or an editorial decision until the right forms are
 * signed, and access rules for reading a signed record.
 */
import { db } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth";
import { isSameEditorialTenant } from "@/lib/tenant-auth";
import { ADMIN_ONLY_FORMS, formById } from "./index";
import type { FormAnswers, OfficialFormDoc } from "./types";

export const EDITOR_ROLES = ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"] as const;
export const isEditorRole = (role: string) => (EDITOR_ROLES as readonly string[]).includes(role);

/** The decisions that need EP-F-09 and EP-F-10 signed first. */
export const GATED_EDITORIAL_ACTIONS = new Set(["SEND_TO_REVIEW", "REQUEST_REVISIONS", "ACCEPT", "REJECT"]);

export interface RequiredFormRef {
  formId: string;
  code: string;
  title: string;
  articleId?: string;
  reviewId?: string;
}

const ref = (formId: string, extra: Partial<RequiredFormRef> = {}): RequiredFormRef => {
  const f = formById(formId)!;
  return { formId, code: f.code, title: f.title, ...extra };
};

export async function saveFormSubmission(input: {
  doc: OfficialFormDoc;
  userId: string | null;
  contactEmail?: string | null;
  tenantId?: string | null;
  articleId?: string | null;
  reviewId?: string | null;
  answers: FormAnswers;
  signedName: string;
  status?: "SUBMITTED" | "PENDING";
}) {
  return db.formSubmission.create({
    data: {
      formId: input.doc.id,
      formCode: formById(input.doc.id)?.code ?? input.doc.code,
      formVersion: input.doc.version,
      userId: input.userId,
      contactEmail: input.contactEmail ?? null,
      tenantId: input.tenantId ?? null,
      articleId: input.articleId ?? null,
      reviewId: input.reviewId ?? null,
      answers: JSON.stringify(input.answers),
      signedName: input.signedName,
      status: input.status ?? "SUBMITTED",
    },
  });
}

/** Whether `userId` has signed the current version of a once-per-person form. */
async function hasSignedCurrent(userId: string, formId: string): Promise<boolean> {
  const f = formById(formId)!;
  const row = await db.formSubmission.findFirst({ where: { userId, formId, formVersion: f.version }, select: { id: true } });
  return !!row;
}

/** The latest answers to one form on a manuscript (any signer). */
export async function latestArticleForm(articleId: string, formId: string): Promise<FormAnswers | null> {
  const row = await db.formSubmission.findFirst({ where: { articleId, formId }, orderBy: { createdAt: "desc" }, select: { answers: true } });
  return row ? parseAnswers(row.answers) : null;
}

/**
 * Forms a reviewer must sign before accepting (or reporting on) this review.
 * With `report`, also the forms that go with the report itself: the
 * reporting-guideline assessment (EP-F-18) when the authors declared a
 * guideline in EP-F-13, and open-review consent (EP-F-19) when the
 * manuscript is under the open-review option.
 */
export async function missingReviewerForms(userId: string, reviewId: string, articleId: string, opts: { report?: boolean } = {}): Promise<RequiredFormRef[]> {
  const missing: RequiredFormRef[] = [];
  if (!(await hasSignedCurrent(userId, "form-reviewer-confidentiality"))) missing.push(ref("form-reviewer-confidentiality"));
  const signedHere = await db.formSubmission.findMany({ where: { userId, reviewId }, select: { formId: true } });
  const has = (id: string) => signedHere.some((r) => r.formId === id);
  if (!has("form-reviewer-coi")) missing.push(ref("form-reviewer-coi", { reviewId, articleId }));
  if (opts.report) {
    const guideline = await latestArticleForm(articleId, "form-reporting-guideline");
    if (guideline && guideline.guideline && guideline.guideline !== "none" && !has("form-reporting-assessment")) missing.push(ref("form-reporting-assessment", { reviewId, articleId }));
    const article = await db.article.findUnique({ where: { id: articleId }, select: { openReview: true } });
    if (article?.openReview && !has("form-open-review-consent")) missing.push(ref("form-open-review-consent", { reviewId, articleId }));
  }
  return missing;
}

/** Reviewers who did not consent (EP-F-19) to their report being published. */
export async function reviewsWithoutPublicationConsent(articleId: string): Promise<{ withheld: string[]; anonymous: string[] }> {
  const rows = await db.formSubmission.findMany({ where: { articleId, formId: "form-open-review-consent" }, orderBy: { createdAt: "asc" }, select: { reviewId: true, answers: true } });
  const latest = new Map<string, FormAnswers>();
  for (const r of rows) if (r.reviewId) latest.set(r.reviewId, parseAnswers(r.answers));
  const withheld: string[] = [];
  const anonymous: string[] = [];
  for (const [reviewId, a] of latest) {
    if (a.publishReport !== "yes") withheld.push(reviewId);
    else if (a.publishName === "anonymous") anonymous.push(reviewId);
  }
  return { withheld, anonymous };
}

/** Email addresses the authors asked not to be invited as reviewers (EP-F-15). */
export async function opposedReviewerEmails(articleId: string): Promise<string[]> {
  const a = await latestArticleForm(articleId, "form-reviewer-suggestions");
  if (!a || a.oppose !== "yes" || typeof a.opposed !== "string") return [];
  return [...new Set((a.opposed.match(/[^\s@<>(),;]+@[^\s@<>(),;]+\.[a-z]{2,}/gi) ?? []).map((e) => e.toLowerCase()))];
}

/** The editor's latest EP-F-09 on this article, if any. */
export async function editorCoiFor(userId: string, articleId: string) {
  return db.formSubmission.findFirst({
    where: { userId, formId: "form-editor-coi", articleId },
    orderBy: { createdAt: "desc" },
    select: { id: true, answers: true },
  });
}

export function declaredConflict(row: { answers: string } | null | undefined): boolean {
  if (!row) return false;
  try {
    return (JSON.parse(row.answers) as { conflict?: string }).conflict === "yes";
  } catch {
    return false;
  }
}

/**
 * Forms an editor must sign before an editorial decision on this article.
 * Sending a manuscript to review also needs the Initial Editorial
 * Screening Checklist (EP-F-20), completed once per manuscript by any editor.
 */
export async function missingEditorForms(userId: string, articleId: string, action?: string): Promise<RequiredFormRef[]> {
  const missing: RequiredFormRef[] = [];
  if (!(await hasSignedCurrent(userId, "form-editor-code"))) missing.push(ref("form-editor-code"));
  if (!(await editorCoiFor(userId, articleId))) missing.push(ref("form-editor-coi", { articleId }));
  if (action === "SEND_TO_REVIEW" && !(await latestArticleForm(articleId, "form-desk-screening"))) missing.push(ref("form-desk-screening", { articleId }));
  return missing;
}

/** The JSON body a gated route returns while forms are outstanding (HTTP 428). */
export function requiredFormsBody(missing: RequiredFormRef[]) {
  return {
    error: `Please sign ${missing.map((m) => `${m.code} (${m.title})`).join(" and ")} first.`,
    requiredForms: missing,
  };
}

/** Authors whose co-authors may see a manuscript's author-side records. */
const AUTHOR_SIDE = new Set([
  "form-author-declaration",
  "form-author-coi",
  "form-ethics-consent",
  "form-ai-disclosure",
  "form-licence-to-publish",
  "form-authorship-change",
  "form-appeal",
  "form-reporting-guideline",
  "form-third-party-permissions",
  "form-reviewer-suggestions",
  "form-proof-approval",
  "form-withdrawal",
]);

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "TENANT_ADMIN"]);

/**
 * Who may read a signed record: the signer; an editor of the article's (or
 * record's) tenant; and, for author-side forms, the article's corresponding
 * author. Reviewer and editor declarations are never shown to authors.
 */
export async function canReadFormRecord(
  session: SessionPayload,
  row: { userId: string | null; formId: string; tenantId: string | null; articleId: string | null }
): Promise<boolean> {
  if (row.userId && row.userId === session.userId) return true;
  if (ADMIN_ONLY_FORMS.has(row.formId)) return ADMIN_ROLES.has(session.role) && isSameEditorialTenant(session, row.tenantId);
  let articleTenant: string | null = row.tenantId;
  let corresponding: string | null = null;
  if (row.articleId) {
    const a = await db.article.findUnique({ where: { id: row.articleId }, select: { correspondingAuthorId: true, journal: { select: { tenantId: true } } } });
    articleTenant = a?.journal?.tenantId ?? articleTenant;
    corresponding = a?.correspondingAuthorId ?? null;
  }
  if (isEditorRole(session.role) && isSameEditorialTenant(session, articleTenant)) return true;
  return AUTHOR_SIDE.has(row.formId) && corresponding === session.userId;
}

export function parseAnswers(raw: string): FormAnswers {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** Editors who should hear about a form on a manuscript of `tenantId` (platform super admins always). */
export async function editorsOfTenant(tenantId: string | null | undefined, exceptUserId?: string): Promise<string[]> {
  const rows = await db.user.findMany({
    where: {
      OR: [
        { role: "SUPER_ADMIN" },
        { role: { in: ["EDITOR", "ASSOCIATE_EDITOR", "TENANT_ADMIN"] }, ...(tenantId ? { tenantId } : {}) },
      ],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id).filter((id) => id !== exceptUserId);
}
