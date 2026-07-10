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

export interface ArticleAuthor {
  name: string;
  affiliation: string;
  orcid?: string;
  email: string;
}

export function parseAuthors(raw: string): ArticleAuthor[] {
  try {
    return JSON.parse(raw) as ArticleAuthor[];
  } catch {
    return [];
  }
}

export function formatCitation(
  article: {
    title: string;
    authors: string;
    publishedAt?: Date | string | null;
    doi?: string | null;
    journalName?: string;
    volume?: number;
    issueNumber?: number;
    year?: number;
  }
): string {
  const authors = parseAuthors(article.authors);
  const authorStr = authors
    .map((a) => {
      const [last, ...rest] = a.name.replace(/^Dr\.?\s+|^Prof\.?\s+/, "").split(" ");
      const initials = [...(rest.join(" ").split(" ")), ""].map((p) => p.charAt(0)).filter(Boolean).join(". ") + ".";
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
