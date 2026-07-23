import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PagedPreview } from "@/components/print/paged-preview";

/**
 * GET /print/magazine-issue/[id] — mirrors /print/article/[id] for a full
 * MagazineIssue: cover section + one print-page-break per piece, laid out
 * with the same Paged.js stylesheet. Public and unauthenticated, matching
 * GET /api/magazine-issues/[id]'s own PUBLISHED-only visibility rule.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const issue = await db.magazineIssue.findUnique({ where: { id }, select: { title: true, status: true, volume: true, issueNumber: true } });
  const label = issue?.title || (issue ? `Volume ${issue.volume}, No. ${issue.issueNumber}` : "Print preview");
  return { title: issue && issue.status === "PUBLISHED" ? `Print — ${label}` : "Print preview" };
}

export const dynamic = "force-dynamic";

function authorNames(json: string): string {
  try {
    return (JSON.parse(json) as { name?: string }[]).map((a) => a.name).filter(Boolean).join(", ");
  } catch {
    return "";
  }
}

export default async function PrintMagazineIssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const issue = await db.magazineIssue.findUnique({
    where: { id },
    include: {
      magazine: { select: { name: true } },
      pieces: { orderBy: { order: "asc" } },
    },
  });
  if (!issue || issue.status !== "PUBLISHED") {
    notFound();
  }

  const issueLabel = issue.title || `Volume ${issue.volume}, No. ${issue.issueNumber}`;

  return (
    <>
      <link rel="stylesheet" href="/print/print-layout.css" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div id="print-source">
          <h1 className="print-title print-doc-title">{issue.magazine.name}</h1>
          <p className="print-meta">
            {issueLabel} · Vol. {issue.volume}, No. {issue.issueNumber} · {issue.year}
            {issue.theme && ` · ${issue.theme}`}
          </p>

          {issue.pieces.map((piece) => (
            <section key={piece.id} className="print-piece">
              <h2 className="print-heading">{piece.title}</h2>
              <p className="print-meta">
                {authorNames(piece.authors)}
                {piece.category && ` · ${piece.category}`}
              </p>
              {piece.dek && <p className="print-abstract">{piece.dek}</p>}
              <div className="print-body" dangerouslySetInnerHTML={{ __html: piece.bodyHtml }} />
            </section>
          ))}
        </div>
        <div id="print-target" />
        <PagedPreview cssHref="/print/print-layout.css" />
      </main>
    </>
  );
}
