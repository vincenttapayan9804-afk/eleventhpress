/**
 * Article digital provenance — the content-hash half of the "Seal of
 * Quality" (src/lib/watermark.ts is the per-download traceability half).
 * Same canonical-payload + SHA-256 pattern as src/lib/certificates.ts,
 * applied to a published work's own record instead of a person's
 * credential — see /verify/article/[id] for the public verification page.
 *
 * Deliberately free of both `db` and Node's `crypto` (same reasoning as
 * certificates.ts's own split from certificates-server.ts): safe to import
 * from a Client Component without pulling server-only code into the
 * browser bundle.
 */

export interface ArticleProvenancePayload {
  id: string;
  title: string;
  authors: string; // JSON, as stored on Article.authors
  abstract: string;
  doi: string | null;
  publishedAtIso: string | null;
  contentType: string;
  discipline: string;
  insightCategory: string | null;
  keyTakeaways: string | null;
  galleyPdfHash: string | null;
  galleyEpubHash: string | null;
}

/**
 * Canonical, stable-key-order JSON — the exact bytes hashed at publish
 * time and re-derived on the public verify page. Any later edit to these
 * fields, or to the actual PDF/EPUB bytes behind galleyPdfHash/
 * galleyEpubHash, breaks this match — the actual tamper-evidence
 * mechanism. Like Certificate, this is honestly database-verified, not
 * blockchain-anchored: it proves the record matches what was stored at
 * publish time, not that the database itself was never altered.
 */
export function canonicalArticleProvenancePayload(p: ArticleProvenancePayload): string {
  return JSON.stringify({
    abstract: p.abstract,
    authors: p.authors,
    contentType: p.contentType,
    discipline: p.discipline,
    doi: p.doi,
    galleyEpubHash: p.galleyEpubHash,
    galleyPdfHash: p.galleyPdfHash,
    id: p.id,
    insightCategory: p.insightCategory,
    keyTakeaways: p.keyTakeaways,
    publishedAt: p.publishedAtIso,
    title: p.title,
  });
}
