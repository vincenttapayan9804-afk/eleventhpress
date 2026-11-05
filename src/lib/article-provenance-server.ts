import crypto from "crypto";
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";
import {
  canonicalArticleProvenancePayload,
  PROVENANCE_SEAL_VERSION,
  type ArticleProvenancePayload,
} from "@/lib/article-provenance";

/** Server-only half — needs Node's `crypto`, split out for the same reason
 * certificates-server.ts is split from certificates.ts. */
export function computeArticleContentHash(p: ArticleProvenancePayload): string {
  return crypto.createHash("sha256").update(canonicalArticleProvenancePayload(p)).digest("hex");
}

export function sha256(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

interface SealableArticle {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  doi: string | null;
  publishedAt: Date | null;
  contentType: string;
  discipline: string;
  insightCategory: string | null;
  keyTakeaways: string | null;
  galleyPdfKey: string | null;
  galleyEpubKey: string | null;
}

function payloadFor(
  a: SealableArticle,
  galleyPdfHash: string | null,
  galleyEpubHash: string | null
): ArticleProvenancePayload {
  return {
    id: a.id,
    title: a.title,
    authors: a.authors,
    abstract: a.abstract,
    doi: a.doi,
    publishedAtIso: a.publishedAt ? a.publishedAt.toISOString() : null,
    contentType: a.contentType,
    discipline: a.discipline,
    insightCategory: a.insightCategory,
    keyTakeaways: a.keyTakeaways,
    galleyPdfHash,
    galleyEpubHash,
  };
}

/** Hash the galley bytes currently in storage. A key whose bytes can't be
 * read yields `unavailable` rather than a null hash, so a transient storage
 * failure is never sealed in, nor reported as tampering. */
async function hashGalleys(a: SealableArticle) {
  const [pdf, epub] = await Promise.all([
    a.galleyPdfKey ? getObject(a.galleyPdfKey) : Promise.resolve(null),
    a.galleyEpubKey ? getObject(a.galleyEpubKey) : Promise.resolve(null),
  ]);
  const unavailable: string[] = [];
  if (a.galleyPdfKey && !pdf) unavailable.push("PDF");
  if (a.galleyEpubKey && !epub) unavailable.push("EPUB");
  return {
    pdfHash: pdf ? sha256(pdf) : null,
    epubHash: epub ? sha256(epub) : null,
    unavailable,
  };
}

/**
 * (Re)seal a PUBLISHED article's provenance from its current record and the
 * galley bytes currently in storage. Call after any platform-initiated change
 * to a sealed input (publish, DOI assignment, galley regeneration) so the
 * public verify page keeps matching. Every seal is audit-logged with the
 * previous hash and the reason, so a reseal is always traceable.
 *
 * No-ops for unpublished articles. Throws if a galley key exists but its
 * bytes can't be read — sealing then would bake a wrong hash in.
 */
export async function sealArticleProvenance(
  articleId: string,
  reason: string
): Promise<{ contentHash: string } | null> {
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article || article.status !== "PUBLISHED") return null;

  const { pdfHash, epubHash, unavailable } = await hashGalleys(article);
  if (unavailable.length > 0) {
    throw new Error(`cannot seal: ${unavailable.join(" and ")} galley unreadable from storage`);
  }
  const contentHash = computeArticleContentHash(payloadFor(article, pdfHash, epubHash));

  if (
    contentHash === article.contentHash &&
    article.provenanceVersion >= PROVENANCE_SEAL_VERSION
  ) {
    return { contentHash };
  }

  await db.article.update({
    where: { id: articleId },
    data: {
      contentHash,
      galleyPdfHash: pdfHash,
      galleyEpubHash: epubHash,
      provenanceVersion: PROVENANCE_SEAL_VERSION,
      provenanceSealedAt: new Date(),
    },
  });
  await db.auditLog.create({
    data: {
      action: "PROVENANCE_SEALED",
      entityType: "ARTICLE",
      entityId: articleId,
      articleId,
      metadata: JSON.stringify({
        reason,
        previousContentHash: article.contentHash,
        contentHash,
        sealVersion: PROVENANCE_SEAL_VERSION,
      }),
    },
  });
  return { contentHash };
}

/** Best-effort wrapper for side paths (DOI deposit, galley regeneration)
 * that must never fail because sealing did. */
export async function resealArticleProvenanceSafely(articleId: string, reason: string): Promise<void> {
  try {
    await sealArticleProvenance(articleId, reason);
  } catch (e) {
    console.error(`[provenance] reseal failed for article ${articleId} (${reason}):`, e);
  }
}

export type ProvenanceVerdict = "verified" | "mismatch" | "unavailable";

/** Recompute and compare — shared by /verify/article/[id] and its JSON API. */
export async function verifyArticleProvenance(
  article: SealableArticle & {
    contentHash: string;
    galleyPdfHash: string | null;
    galleyEpubHash: string | null;
  }
): Promise<{ verdict: ProvenanceVerdict; unavailable: string[] }> {
  const { pdfHash, epubHash, unavailable } = await hashGalleys(article);
  if (unavailable.length > 0) return { verdict: "unavailable", unavailable };

  const filesMatch = pdfHash === article.galleyPdfHash && epubHash === article.galleyEpubHash;
  const recomputed = computeArticleContentHash(payloadFor(article, article.galleyPdfHash, article.galleyEpubHash));
  return { verdict: filesMatch && recomputed === article.contentHash ? "verified" : "mismatch", unavailable };
}
