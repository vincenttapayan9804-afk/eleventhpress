import { db } from "@/lib/db";
import { verifyArticleProvenance, type ProvenanceVerdict, type ProvenanceChecks } from "@/lib/article-provenance-server";
import { PROVENANCE_SEAL_VERSION } from "@/lib/article-provenance";
export { SEALED_FIELDS } from "@/lib/article-provenance";
import { parseAuthors, parseFunders, INSIGHT_CATEGORY_LABELS, type InsightCategory } from "@/lib/article";
import { formatCitationStyle, type CitationStyleId } from "@/lib/citation-styles";
import { buildBibTeX, buildRis, type ExportableArticle } from "@/lib/citation-export";
import { APP_BASE_URL } from "@/lib/site";
import { publisherIdentityForJournal } from "@/lib/publisher-identity";

/**
 * Everything the public provenance surfaces show about one published work —
 * the /verify/article/[id] page and its downloadable PDF certificate
 * (src/lib/provenance-certificate-pdf.ts) render from this one object, so the
 * two can never disagree. The verdict is recomputed live on every load; it is
 * never cached or read back from a stored flag.
 *
 * Public by design: author emails and anything else not already shown on the
 * public article page are deliberately left out.
 */


const SEAL_REASON_LABELS: Record<string, string> = {
  publish: "Sealed at publication",
  "doi-assigned": "Resealed after DOI registration",
  "galleys-regenerated": "Resealed after PDF/EPUB galley regeneration",
  "backfill-initial": "Initial seal recorded",
  "backfill-forced": "Resealed during administrative re-verification",
};

export function sealReasonLabel(reason: string): string {
  if (SEAL_REASON_LABELS[reason]) return SEAL_REASON_LABELS[reason];
  const v = /^backfill-seal-v(\d+)$/.exec(reason);
  if (v) return `Resealed under provenance rules v${v[1]}`;
  return "Resealed";
}

export interface ProvenanceTimelineEvent {
  at: string; // ISO
  kind: "submitted" | "accepted" | "published" | "sealed" | "correction" | "verified";
  label: string;
  detail?: string;
}

export interface ProvenanceCitation {
  id: CitationStyleId | "bibtex" | "ris";
  label: string;
  text: string;
}

export interface ProvenanceRecord {
  id: string;
  sealReference: string;
  verdict: ProvenanceVerdict;
  unavailable: string[];
  checks: ProvenanceChecks;
  checkedAt: string; // ISO — when this verdict was computed
  title: string;
  abstract: string;
  authors: { name: string; affiliation: string; orcid?: string; rorId?: string; creditRoles?: string[] }[];
  contentTypeLabel: string;
  insightCategoryLabel: string | null;
  discipline: string;
  keywords: string[];
  journal: { name: string; issn: string | null; publisher: string };
  /** Who issues this record — the publishing tenant for a whitelabel journal, else the platform. */
  brand: { whitelabel: boolean; publisher: string; primaryHex: string; accentHex: string };
  issue: { volume: number; issueNumber: number; year: number } | null;
  versionNumber: number;
  reviewModelLabel: string;
  integrityStatus: string;
  integrityStatusLabel: string;
  corrections: { type: string; title: string; issuedAt: string; doi: string | null }[];
  funders: string[];
  doi: string | null;
  doiStatus: string;
  zenodoRecordId: string | null;
  license: { name: string; url: string };
  dates: {
    submittedAt: string | null;
    acceptedAt: string | null;
    publishedAt: string | null;
    sealedAt: string | null;
  };
  hashes: { content: string; pdf: string | null; epub: string | null };
  sealVersion: number;
  currentSealVersion: number;
  sealCount: number;
  timeline: ProvenanceTimelineEvent[];
  citations: ProvenanceCitation[];
  urls: { verify: string; article: string; api: string; certificate: string; doi: string | null };
}

export type ProvenanceLookup =
  | { kind: "not-found" }
  | { kind: "unsealed"; id: string; title: string }
  | { kind: "sealed"; record: ProvenanceRecord };

const REVIEW_MODEL_LABELS: Record<string, string> = {
  DOUBLE_BLIND: "Double-blind peer review",
  SINGLE_BLIND: "Single-blind peer review",
  OPEN: "Open (signed) peer review",
};

const INTEGRITY_LABELS: Record<string, string> = {
  NORMAL: "No post-publication notices",
  CORRECTED: "Corrected (see notices)",
  UNDER_CONCERN: "Expression of concern issued",
  RETRACTED: "Retracted",
};

const CORRECTION_LABELS: Record<string, string> = {
  CORRIGENDUM: "Corrigendum",
  ERRATUM: "Erratum",
  EXPRESSION_OF_CONCERN: "Expression of concern",
  RETRACTION: "Retraction notice",
};

/** Short, human-quotable reference for a seal: year of publication plus the
 * leading bytes of the content hash. Derived, not stored — it changes when a
 * record is legitimately resealed, exactly like the hash it abbreviates. */
export function sealReferenceFor(contentHash: string, publishedAt: Date | null): string {
  const year = publishedAt ? publishedAt.getUTCFullYear() : "0000";
  return `EPIP-PV-${year}-${contentHash.slice(0, 8).toUpperCase()}`;
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export async function loadProvenanceRecord(id: string): Promise<ProvenanceLookup> {
  const article = await db.article.findUnique({
    where: { id },
    include: {
      journal: { select: { name: true, issn: true, publisher: true, tenantId: true } },
      issue: { select: { volume: true, issueNumber: true, year: true } },
      corrections: { select: { type: true, title: true, issuedAt: true, doi: true }, orderBy: { issuedAt: "asc" } },
    },
  });
  if (!article || article.status !== "PUBLISHED") return { kind: "not-found" };
  if (!article.contentHash) return { kind: "unsealed", id: article.id, title: article.title.trim() };

  const [{ verdict, unavailable, checks }, sealLogs] = await Promise.all([
    verifyArticleProvenance({ ...article, contentHash: article.contentHash }),
    db.auditLog.findMany({
      where: { articleId: article.id, action: "PROVENANCE_SEALED" },
      select: { createdAt: true, metadata: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
  ]);
  const checkedAt = new Date().toISOString();

  const authors = parseAuthors(article.authors).map((a) => ({
    name: a.name,
    affiliation: a.affiliation,
    ...(a.orcid ? { orcid: a.orcid } : {}),
    ...(a.rorId ? { rorId: a.rorId } : {}),
    ...(a.creditRoles?.length ? { creditRoles: a.creditRoles } : {}),
  }));

  const timeline: ProvenanceTimelineEvent[] = [];
  if (article.submittedAt) timeline.push({ at: article.submittedAt.toISOString(), kind: "submitted", label: "Manuscript submitted" });
  if (article.acceptedAt) timeline.push({ at: article.acceptedAt.toISOString(), kind: "accepted", label: "Accepted after peer review" });
  if (article.publishedAt) {
    timeline.push({
      at: article.publishedAt.toISOString(),
      kind: "published",
      label: "Published",
      detail: article.journal?.name ?? undefined,
    });
  }
  for (const log of sealLogs) {
    let reason = "";
    let hash = "";
    try {
      const m = JSON.parse(log.metadata ?? "{}") as { reason?: string; contentHash?: string };
      reason = m.reason ?? "";
      hash = m.contentHash ?? "";
    } catch {
      /* malformed metadata — still show the event */
    }
    timeline.push({
      at: log.createdAt.toISOString(),
      kind: "sealed",
      label: sealReasonLabel(reason),
      ...(hash ? { detail: `SHA-256 ${hash.slice(0, 16)}…` } : {}),
    });
  }
  for (const c of article.corrections) {
    timeline.push({
      at: c.issuedAt.toISOString(),
      kind: "correction",
      label: CORRECTION_LABELS[c.type] ?? "Post-publication notice",
      detail: c.title,
    });
  }
  timeline.sort((a, b) => a.at.localeCompare(b.at));
  timeline.push({
    at: checkedAt,
    kind: "verified",
    label:
      verdict === "verified"
        ? "Independently re-verified (this check)"
        : verdict === "unavailable"
          ? "Re-verification attempted (storage unavailable)"
          : "Re-verification failed (hash mismatch)",
  });

  const identity = await publisherIdentityForJournal(article.journal);

  const exportable: ExportableArticle = {
    id: article.id,
    title: article.title,
    authors: article.authors,
    publishedAt: article.publishedAt,
    doi: article.doi,
    journalName: article.journal?.name ?? null,
    journalIssn: identity.whitelabel ? identity.issn : article.journal?.issn ?? null,
    volume: article.issue?.volume ?? null,
    issueNumber: article.issue?.issueNumber ?? null,
    year: article.issue?.year ?? null,
    publisher: identity.whitelabel ? identity.publisher : article.journal?.publisher ?? null,
    articleUrl: `${APP_BASE_URL}/article/${article.id}`,
  };
  const styles: { id: CitationStyleId; label: string }[] = [
    { id: "apa", label: "APA 7" },
    { id: "mla", label: "MLA 9" },
    { id: "chicago-author-date", label: "Chicago" },
    { id: "harvard", label: "Harvard" },
    { id: "ieee", label: "IEEE" },
  ];
  const citations: ProvenanceCitation[] = [
    ...styles.map((s) => ({ id: s.id, label: s.label, text: formatCitationStyle(exportable, s.id) })),
    { id: "bibtex" as const, label: "BibTeX", text: buildBibTeX(exportable) },
    { id: "ris" as const, label: "RIS", text: buildRis(exportable) },
  ];

  const insightLabel =
    article.contentType === "EXPERT_INSIGHT" && article.insightCategory
      ? INSIGHT_CATEGORY_LABELS[article.insightCategory as InsightCategory] ?? article.insightCategory
      : null;

  const record: ProvenanceRecord = {
    id: article.id,
    sealReference: sealReferenceFor(article.contentHash, article.publishedAt),
    verdict,
    unavailable,
    checks,
    checkedAt,
    // Display only — the hash is always computed over the raw stored title.
    title: article.title.replace(/\s+/g, " ").trim(),
    abstract: article.abstract,
    authors,
    contentTypeLabel: article.contentType === "EXPERT_INSIGHT" ? "Expert Insight" : "Research article",
    insightCategoryLabel: insightLabel,
    discipline: article.discipline,
    keywords: article.keywords.split(",").map((k) => k.trim()).filter(Boolean),
    journal: {
      name: article.journal?.name ?? identity.journalName,
      issn: identity.whitelabel ? identity.issn : article.journal?.issn ?? null,
      publisher: identity.publisher,
    },
    brand: {
      whitelabel: identity.whitelabel,
      publisher: identity.publisher,
      primaryHex: identity.primaryHex,
      accentHex: identity.accentHex,
    },
    issue: article.issue,
    versionNumber: article.versionNumber,
    reviewModelLabel:
      article.contentType === "EXPERT_INSIGHT"
        ? "Editorial review (Expert Insight)"
        : REVIEW_MODEL_LABELS[article.reviewModel] ?? article.reviewModel,
    integrityStatus: article.integrityStatus,
    integrityStatusLabel: INTEGRITY_LABELS[article.integrityStatus] ?? article.integrityStatus,
    corrections: article.corrections.map((c) => ({
      type: CORRECTION_LABELS[c.type] ?? c.type,
      title: c.title,
      issuedAt: c.issuedAt.toISOString(),
      doi: c.doi,
    })),
    funders: parseFunders(article.funders).map((f) => f.name).filter(Boolean),
    doi: article.doi,
    doiStatus: article.doiStatus,
    zenodoRecordId: article.zenodoRecordId,
    license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
    dates: {
      submittedAt: iso(article.submittedAt),
      acceptedAt: iso(article.acceptedAt),
      publishedAt: iso(article.publishedAt),
      sealedAt: iso(article.provenanceSealedAt),
    },
    hashes: { content: article.contentHash, pdf: article.galleyPdfHash, epub: article.galleyEpubHash },
    sealVersion: article.provenanceVersion,
    currentSealVersion: PROVENANCE_SEAL_VERSION,
    sealCount: sealLogs.length,
    timeline,
    citations,
    urls: {
      verify: `${APP_BASE_URL}/verify/article/${article.id}`,
      article: `${APP_BASE_URL}/article/${article.id}`,
      api: `${APP_BASE_URL}/api/articles/${article.id}/verify`,
      certificate: `${APP_BASE_URL}/api/articles/${article.id}/verify/certificate`,
      doi: article.doi ? `https://doi.org/${article.doi}` : null,
    },
  };
  return { kind: "sealed", record };
}
