import type { Metadata } from "next";
import { db } from "@/lib/db";
import { computeArticleContentHash, sha256 } from "@/lib/article-provenance-server";
import { getObject } from "@/lib/storage";
import { parseAuthors } from "@/lib/article";
import { CheckCircle2, XCircle, ShieldQuestion } from "lucide-react";

/**
 * GET /verify/article/[id] — the same real, public, server-rendered
 * verification page as /verify/[serialNumber] (Certificates), applied to a
 * published work's own record instead of a person's credential. See
 * src/lib/article-provenance.ts for what's actually hashed.
 *
 * "Cryptographically verifiable" here means the same thing it means for a
 * Certificate: the content hash is recomputed from the fields actually
 * stored on this row (plus a fresh hash of the actual PDF/EPUB bytes in
 * storage) and compared to the hash sealed at publish time. This is
 * deliberately NOT described as blockchain-verified — verification depends
 * on this platform's own database and storage, not a decentralized ledger.
 * It also does not restrict use: every article here is CC BY 4.0.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Verify article ${id} — Eleventh Press International Publishing`,
    description: "Verify the digital provenance of a published article, book chapter, or Expert Insight.",
  };
}

export const dynamic = "force-dynamic";

export default async function VerifyArticlePage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const article = await db.article.findUnique({ where: { id } });

  if (!article || article.status !== "PUBLISHED") {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <ShieldQuestion className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-2xl font-semibold">No published article found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Article ID <code className="font-mono">{id}</code> does not match any published record. If you
          scanned a link from a downloaded PDF/EPUB, double-check it was copied correctly.
        </p>
      </main>
    );
  }

  if (!article.contentHash) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <ShieldQuestion className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Not yet sealed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          &ldquo;{article.title}&rdquo; was published before digital provenance sealing existed, or sealing
          failed at publish time. It is still a real, CC BY 4.0 published record — it just has no
          cryptographic seal to verify here.
        </p>
      </main>
    );
  }

  const [pdfBytes, epubBytes] = await Promise.all([
    article.galleyPdfKey ? getObject(article.galleyPdfKey) : Promise.resolve(null),
    article.galleyEpubKey ? getObject(article.galleyEpubKey) : Promise.resolve(null),
  ]);
  const recomputedPdfHash = pdfBytes ? sha256(pdfBytes) : null;
  const recomputedEpubHash = epubBytes ? sha256(epubBytes) : null;
  const filesMatch =
    recomputedPdfHash === article.galleyPdfHash && recomputedEpubHash === article.galleyEpubHash;

  const recomputedContentHash = computeArticleContentHash({
    id: article.id,
    title: article.title,
    authors: article.authors,
    abstract: article.abstract,
    doi: article.doi,
    publishedAtIso: article.publishedAt ? article.publishedAt.toISOString() : null,
    contentType: article.contentType,
    discipline: article.discipline,
    insightCategory: article.insightCategory,
    keyTakeaways: article.keyTakeaways,
    galleyPdfHash: article.galleyPdfHash,
    galleyEpubHash: article.galleyEpubHash,
  });
  const valid = filesMatch && recomputedContentHash === article.contentHash;
  const authors = parseAuthors(article.authors).map((a) => a.name).filter(Boolean).join(", ");

  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="eyebrow">Digital provenance verification</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{article.title}</h1>
      {authors && <p className="mt-1 text-sm text-muted-foreground">{authors}</p>}

      <section className={`mt-8 rounded-md border p-5 ${valid ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
        <div className="flex items-center gap-2">
          {valid ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600" />
          )}
          <p className={`font-display text-lg font-semibold ${valid ? "text-emerald-800" : "text-red-800"}`}>
            {valid ? "Verified — this record is authentic" : "Verification failed — hash mismatch"}
          </p>
        </div>
        <p className={`mt-1 text-sm ${valid ? "text-emerald-700" : "text-red-700"}`}>
          {valid
            ? "The content hash recomputed from our records, and the file hashes recomputed from the actual stored PDF/EPUB bytes, both match what was sealed at publish time."
            : "The recomputed hash does not match the record on file. Do not treat this article's metadata or files as unaltered since publication."}
        </p>
      </section>

      <dl className="mt-6 space-y-3 rounded-md border border-border bg-card p-5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Content type</dt>
          <dd className="font-medium">{article.contentType === "EXPERT_INSIGHT" ? "Expert Insight" : "Research article"}</dd>
        </div>
        {article.doi && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">DOI</dt>
            <dd className="font-medium">
              <a href={`https://doi.org/${article.doi}`} className="underline">{article.doi}</a>
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Published</dt>
          <dd className="font-medium">
            {article.publishedAt?.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }) ?? "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">License</dt>
          <dd className="font-medium">CC BY 4.0</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Content hash (SHA-256)</dt>
          <dd className="break-all font-mono text-xs">{article.contentHash}</dd>
        </div>
        {article.galleyPdfHash && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">PDF file hash</dt>
            <dd className="break-all font-mono text-xs">{article.galleyPdfHash}</dd>
          </div>
        )}
        {article.galleyEpubHash && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">EPUB file hash</dt>
            <dd className="break-all font-mono text-xs">{article.galleyEpubHash}</dd>
          </div>
        )}
      </dl>

      <p className="mt-6 text-xs text-muted-foreground">
        This record is cryptographically verifiable and tamper-evident: any alteration to the stored
        metadata or to the downloaded PDF/EPUB files breaks the match above. Verification depends on
        Eleventh Press International Publishing&rsquo;s own records, not a decentralized blockchain ledger.
        This proves authenticity — it does not restrict reading, sharing, or reuse; this article is
        licensed CC BY 4.0 and redistribution with attribution is always permitted.
      </p>
    </main>
  );
}
