import { GET as servePdf } from "../pdf/route";
import { ARTICLE_PDF_FILE } from "@/lib/scholar-meta";

/**
 * GET /article/<segment>/fulltext.pdf
 *
 * The same published PDF galley as /article/<segment>/pdf, at a URL that
 * ends in ".pdf" — the address used in citation_pdf_url, following Google
 * Scholar's guidance that full-text PDFs end in ".pdf" and sit under the
 * article page's own path. Any other file name is a 404.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await ctx.params;
  if (decodeURIComponent(file).toLowerCase() !== ARTICLE_PDF_FILE) return new Response("Not found", { status: 404 });
  return servePdf(req, { params: Promise.resolve({ id }) });
}
