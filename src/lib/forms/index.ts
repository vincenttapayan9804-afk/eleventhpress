/**
 * Catalog helpers for the Official Forms. Safe for both server and browser:
 * the definitions are plain data.
 */
import { PLATFORM_RESOURCE_BRAND, brandCode, brandDeep, type ResourceBrand } from "@/lib/resources/tenant-brand";
import { OFFICIAL_FORMS, SUBMISSION_FORM_IDS } from "./definitions";
import type { FormRole, OfficialFormDoc } from "./types";

export { OFFICIAL_FORMS, SUBMISSION_FORM_IDS };
export type { OfficialFormDoc } from "./types";

export const FORM_ROLE_LABEL: Record<FormRole, string> = {
  author: "Authors",
  reviewer: "Peer reviewers",
  editor: "Editors",
  public: "Anyone: authors, reviewers and readers",
};

/**
 * Requests an editor decides (status PENDING → APPROVED | DECLINED), with
 * the words used for each outcome.
 */
export const DECIDED_FORMS: Record<string, { approve: string; decline: string; approved: string; declined: string; pending?: string }> = {
  "form-authorship-change": { approve: "Approve and apply", decline: "Decline the change", approved: "Approved", declined: "Declined" },
  "form-appeal": { approve: "Grant the appeal", decline: "Uphold the decision", approved: "Appeal granted: reconsidered", declined: "Decision upheld" },
  "form-withdrawal": { approve: "Withdraw the manuscript", decline: "Decline the withdrawal", approved: "Withdrawn", declined: "Withdrawal declined" },
  "form-complaint": { approve: "Uphold the complaint", decline: "Do not uphold", approved: "Complaint upheld", declined: "Not upheld", pending: "Received" },
  "form-report-concern": { approve: "Close: action taken", decline: "Close: no action needed", approved: "Closed: action taken", declined: "Closed: no action needed", pending: "Under investigation" },
  "form-correction-request": { approve: "Correction will be published", decline: "No correction needed", approved: "Correction accepted", declined: "No correction", pending: "Received" },
  "form-privacy-request": { approve: "Request completed", decline: "Refuse (give reasons)", approved: "Completed", declined: "Refused", pending: "Received" },
};

/** Forms only the platform or tenant administrators (the data controller) may read and decide. */
export const ADMIN_ONLY_FORMS = new Set(["form-privacy-request"]);

export function formById(id: string): OfficialFormDoc | undefined {
  return OFFICIAL_FORMS.find((f) => f.id === id);
}

/**
 * A form by URL slug or id, its text under the site's own name (id, slug and
 * the standards' links are left alone).
 */
export function getFormDoc(slugOrId: string, brand: ResourceBrand = PLATFORM_RESOURCE_BRAND): OfficialFormDoc | null {
  const f = OFFICIAL_FORMS.find((x) => x.slug === slugOrId || x.id === slugOrId);
  if (!f) return null;
  if (!brand.whitelabel) return f;
  return { ...brandDeep(f, brand), id: f.id, slug: f.slug, code: brandCode(f.code, brand), relatedGuides: f.relatedGuides };
}

export const formPath = (f: Pick<OfficialFormDoc, "slug">) => `/resources/forms/${f.slug}`;
export const formPdfPath = (f: Pick<OfficialFormDoc, "slug">) => `/resources/forms/${f.slug}/pdf`;

/** APA-style citation for a form. */
export function formCitation(f: OfficialFormDoc, brand: ResourceBrand = PLATFORM_RESOURCE_BRAND): string {
  return `${brand.publisher}. (${f.effective.slice(0, 4)}). ${f.title} (${brandCode(f.code, brand)}, Version ${f.version}) [Form]. ${brand.baseUrl}${formPath(f)}`;
}

/** Every word in a form, for search. */
export function formPlainText(f: OfficialFormDoc): string {
  return [
    f.summary,
    f.purpose,
    f.when,
    f.where,
    ...f.instructions,
    ...f.sections.flatMap((s) => [s.heading, s.intro ?? "", ...s.fields.flatMap((x) => [x.label, x.help ?? "", ...(x.options ?? []).map((o) => o.label)])]),
    f.signatureStatement,
    ...f.faqs.flatMap((q) => [q.q, q.a]),
  ].join(" ");
}

/** Short label for a record's status. */
export function formStatusLabel(formId: string, status: string): string {
  const d = DECIDED_FORMS[formId];
  if (status === "SUBMITTED") return "Signed";
  if (status === "PENDING") return d?.pending ?? "Awaiting editor";
  if (d) return status === "APPROVED" ? d.approved : d.declined;
  return status === "APPROVED" ? "Approved" : "Declined";
}

/** Where on the platform a form is completed (an in-app path). */
export function formPlatformPath(f: Pick<OfficialFormDoc, "scope" | "role" | "id" | "slug">): string {
  if (f.scope === "public" || f.scope === "offline") return `/resources/forms/${f.slug}${f.scope === "public" ? "#submit" : ""}`;
  if (f.scope === "submission") return "/dashboard/submit";
  if (f.scope === "article-request") return "/dashboard/my-articles";
  if (f.role === "reviewer") return "/dashboard/reviewer-queue";
  return "/dashboard/editor-queue";
}
