import { db } from "@/lib/db";
import { articleIdFromSegment } from "@/lib/spa-routes";
import { getObject, presignGet } from "@/lib/storage";

/**
 * GET /article/<segment>/pdf
 *
 * The published PDF galley, served from the article's own URL. Google
 * Scholar expects citation_pdf_url on the same site (ideally the same
 * directory) as the article page, so this replaces pointing it at the
 * storage host. Served as published, without a per-download stamp, like
 * the galley route's ?preview=1, and not counted as a reader download,
 * since crawlers fetch it too. The file is streamed so large PDFs aren't
 * held in memory.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: segment } = await params;
  const raw = decodeURIComponent(segment);
  const select = { id: true, status: true, doi: true, galleyPdfKey: true } as const;
  const article =
    (await db.article.findUnique({ where: { id: raw }, select })) ??
    (raw.includes("--") ? await db.article.findUnique({ where: { id: articleIdFromSegment(segment) }, select }) : null);

  if (!article || article.status !== "PUBLISHED" || !article.galleyPdfKey) {
    return new Response("Not found", { status: 404 });
  }

  const filename = `${article.doi?.replace(/[^a-z0-9]/gi, "-") || article.id}.pdf`;
  const headers = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
  };

  const url = await presignGet(article.galleyPdfKey);
  if (/^https?:\/\//.test(url)) {
    const upstream = await fetch(url).catch(() => null);
    if (upstream?.ok && upstream.body) return new Response(upstream.body, { headers });
  }
  const bytes = await getObject(article.galleyPdfKey);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), { headers });
}
