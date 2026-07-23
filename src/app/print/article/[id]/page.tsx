import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { parseAuthors } from "@/lib/article";
import { PagedPreview } from "@/components/print/paged-preview";

/**
 * GET /print/article/[id] — a real, public, server-rendered print/PDF
 * preview (not part of the client SPA shell, same pattern as
 * /preservation-manifest) laid out with Paged.js (public/print/print-
 * layout.css) so the browser's native print dialog produces a properly
 * paginated PDF with running header + page numbers — no PDFKit/server
 * rendering step, no per-request cost. Public and unauthenticated, same
 * open-access rationale as GET /api/articles/[id]/body.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const article = await db.article.findUnique({ where: { id }, select: { title: true, status: true } });
  return { title: article && article.status === "PUBLISHED" ? `Print — ${article.title}` : "Print preview" };
}

export const dynamic = "force-dynamic";

export default async function PrintArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await db.article.findUnique({
    where: { id },
    select: {
      status: true,
      title: true,
      abstract: true,
      authors: true,
      doi: true,
      discipline: true,
      publishedAt: true,
      galleyHtmlKey: true,
    },
  });
  if (!article || article.status !== "PUBLISHED") {
    notFound();
  }

  let bodyHtml = "";
  if (article.galleyHtmlKey) {
    const buf = await getObject(article.galleyHtmlKey);
    if (buf) {
      const match = buf.toString("utf-8").match(/<div class="article-body">([\s\S]*)<\/div>\s*<\/body>/);
      if (match) bodyHtml = match[1];
    }
  }

  const authors = parseAuthors(article.authors);
  const publishedLabel = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <>
      <link rel="stylesheet" href="/print/print-layout.css" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div id="print-source">
          <h1 className="print-title print-doc-title">{article.title}</h1>
          <p className="print-meta">
            {authors.map((a) => a.name).join(", ")}
            {publishedLabel && ` · ${publishedLabel}`}
            {article.doi && ` · DOI: ${article.doi}`}
            {article.discipline && ` · ${article.discipline}`}
          </p>
          <p className="print-abstract">{article.abstract}</p>
          {bodyHtml ? (
            <div className="print-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          ) : (
            <p className="print-body">The full text isn&apos;t available for inline print layout for this article.</p>
          )}
        </div>
        <div id="print-target" />
        <PagedPreview cssHref="/print/print-layout.css" />
      </main>
    </>
  );
}
