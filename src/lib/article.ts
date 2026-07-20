/** Article helpers shared between API routes and UI. */
export type ArticleStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REVISIONS_REQUIRED"
  | "ACCEPTED"
  | "IN_PRODUCTION"
  | "PUBLISHED"
  | "REJECTED"
  | "WITHDRAWN";

export const STATUS_FLOW: ArticleStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVISIONS_REQUIRED",
  "ACCEPTED",
  "IN_PRODUCTION",
  "PUBLISHED",
];

export const STATUS_LABELS: Record<ArticleStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  REVISIONS_REQUIRED: "Revisions Required",
  ACCEPTED: "Accepted",
  IN_PRODUCTION: "In Production",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export const STATUS_COLORS: Record<ArticleStatus, string> = {
  DRAFT: "bg-[oklch(0.95_0.01_285)] text-muted-foreground border-[oklch(0.88_0.015_285)]",
  SUBMITTED: "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  UNDER_REVIEW: "bg-[oklch(0.90_0.05_295)] text-[oklch(0.36_0.16_294)] border-[oklch(0.62_0.16_296/0.4)]",
  REVISIONS_REQUIRED: "bg-[oklch(0.92_0.06_60)] text-[oklch(0.45_0.16_55)] border-[oklch(0.76_0.12_60/0.3)]",
  ACCEPTED: "bg-[oklch(0.90_0.08_150)] text-[oklch(0.35_0.12_155)] border-[oklch(0.65_0.14_160/0.3)]",
  IN_PRODUCTION: "bg-[oklch(0.90_0.05_220)] text-[oklch(0.40_0.12_225)] border-[oklch(0.65_0.10_220/0.3)]",
  PUBLISHED: "bg-[oklch(0.88_0.06_295)] text-[oklch(0.36_0.18_295)] border-[oklch(0.62_0.16_296/0.4)]",
  REJECTED: "bg-[oklch(0.90_0.05_20)] text-[oklch(0.45_0.18_18)] border-[oklch(0.65_0.15_20/0.3)]",
  WITHDRAWN: "bg-[oklch(0.95_0.01_285)] text-muted-foreground border-[oklch(0.88_0.015_285)]",
};

// Statuses a manuscript can be posted as a public preprint under
// (src/app/api/articles/[id]/preprint/route.ts, src/app/api/preprints/*).
// Excludes DRAFT (not yet submitted at all), PUBLISHED (it's the real
// archive now, not a preprint), and REJECTED/WITHDRAWN (shouldn't newly
// become publicly browsable once in a terminal negative state).
export const PREPRINT_ELIGIBLE_STATUSES: ArticleStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVISIONS_REQUIRED",
  "ACCEPTED",
  "IN_PRODUCTION",
];

export const DISCIPLINES = [
  "Physics",
  "Biology",
  "Computer Science",
  "Sociology",
  "Economics",
  "Psychology",
  "Environmental Science",
  "Mathematics",
  "Education",
  "Business",
  "Technology",
  "Language and Literature",
] as const;

export const DISCIPLINE_COLORS: Record<string, string> = {
  Physics: "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  Biology: "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  "Computer Science": "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  Sociology: "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  Economics: "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  Psychology: "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  "Environmental Science": "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  Mathematics: "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  Education: "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  Business: "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  Technology: "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  "Language and Literature": "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
};

/**
 * Experts' Insights — the Publication Charter's five Insight Categories.
 * Only meaningful when Article.contentType === "EXPERT_INSIGHT"; values are
 * stored on Article.insightCategory. Keys are the stored/enum values, used
 * as i18n keys (`experts.category.<key>`) — see src/messages/en.json.
 */
export const INSIGHT_CATEGORIES = [
  "LEGAL_COMPLIANCE",
  "ACADEMIC_PEDAGOGY",
  "BUSINESS_TECHNOLOGY",
  "SCIENTIFIC_CLINICAL",
  "PSYCHOLOGY",
] as const;
export type InsightCategory = (typeof INSIGHT_CATEGORIES)[number];

export const INSIGHT_CATEGORY_LABELS: Record<InsightCategory, string> = {
  LEGAL_COMPLIANCE: "Legal & Compliance",
  ACADEMIC_PEDAGOGY: "Academic & Pedagogy",
  BUSINESS_TECHNOLOGY: "Business & Technology",
  SCIENTIFIC_CLINICAL: "Scientific / Clinical",
  PSYCHOLOGY: "Psychology",
};

/** Exactly 5 bullets, the Charter's mandatory "Key Takeaways" box. */
export const KEY_TAKEAWAYS_COUNT = 5;

export interface ArticleAuthor {
  name: string;
  affiliation: string;
  orcid?: string;
  email: string;
  // Research Organization Registry ID for `affiliation` (e.g. "01an7q238") —
  // optional, since not every institution is registered yet.
  rorId?: string;
  // ANSI/NISO Z39.104 CRediT contributor roles this author performed.
  creditRoles?: string[];
}

/** The 14 standard CRediT contributor roles (ANSI/NISO Z39.104-2022). */
export const CREDIT_ROLES = [
  "Conceptualization",
  "Data curation",
  "Formal analysis",
  "Funding acquisition",
  "Investigation",
  "Methodology",
  "Project administration",
  "Resources",
  "Software",
  "Supervision",
  "Validation",
  "Visualization",
  "Writing – original draft",
  "Writing – review & editing",
] as const;

export function parseAuthors(raw: string): ArticleAuthor[] {
  try {
    return JSON.parse(raw) as ArticleAuthor[];
  } catch {
    return [];
  }
}

export interface ArticleFunder {
  name: string;
  id?: string; // Crossref Open Funder Registry / ROR identifier, where known
  awardNumber?: string;
}

export function parseFunders(raw: string | null | undefined): ArticleFunder[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ArticleFunder[];
  } catch {
    return [];
  }
}

/**
 * Per COPE/ICMJE convention: a Corrigendum fixes an author error, an
 * Erratum fixes a publisher error, an Expression of Concern flags
 * unresolved doubt pending investigation, a Retraction withdraws the
 * findings entirely. See docs/standards.md for sources.
 */
export type CorrectionType = "CORRIGENDUM" | "ERRATUM" | "EXPRESSION_OF_CONCERN" | "RETRACTION";

export const CORRECTION_TYPE_LABELS: Record<CorrectionType, string> = {
  CORRIGENDUM: "Corrigendum",
  ERRATUM: "Erratum",
  EXPRESSION_OF_CONCERN: "Expression of Concern",
  RETRACTION: "Retraction",
};

/** Maps a correction type to the resulting Article.integrityStatus value. */
export function correctionTypeToIntegrityStatus(type: CorrectionType): string {
  switch (type) {
    case "RETRACTION":
      return "RETRACTED";
    case "EXPRESSION_OF_CONCERN":
      return "UNDER_CONCERN";
    default:
      return "CORRECTED";
  }
}

export function formatCitation(
  article: {
    title: string;
    authors: string;
    publishedAt?: Date | string | null;
    doi?: string | null;
    journalName?: string | null;
    volume?: number | null;
    issueNumber?: number | null;
    year?: number | null;
  }
): string {
  const authors = parseAuthors(article.authors);
  const authorStr = authors
    .map((a) => {
      const parts = a.name.replace(/^Dr\.?\s+|^Prof\.?\s+/, "").trim().split(/\s+/);
      const last = parts[parts.length - 1];
      const initials = parts.slice(0, -1).map((p) => p.charAt(0)).filter(Boolean).join(". ") + ".";
      return `${last}, ${initials}`;
    })
    .join(", ");
  const year = article.publishedAt
    ? new Date(article.publishedAt).getFullYear()
    : article.year ?? "forthcoming";
  const journal = article.journalName ?? "EPIP Int. J. Multidiscip. Res.";
  const vol = article.volume ? `${article.volume}` : "";
  const iss = article.issueNumber ? `(${article.issueNumber})` : "";
  const doi = article.doi ? ` https://doi.org/${article.doi}` : "";
  return `${authorStr} (${year}). ${article.title}. ${journal}, ${vol}${iss}.${doi}`;
}
