import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { buildExportMarkdown, buildExportPdf, buildExportBibliography } from "@/lib/research-lab-export";
import { canViewResearchLabDocument } from "@/lib/research-lab-access";

const RESEARCH_LAB_ROLES = ["AUTHOR", "EXPERT", "REVIEWER", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"];

/**
 * GET /api/research-lab/export/[id]?format=md|bibtex|ris|pdf
 * Real, downloadable exports of a saved Gap Finder/PRISMA-draft document —
 * closes the "AI output only lives inside this dashboard tab" gap. Owner-
 * scoped: these are personal research drafts, same posture as the
 * transcription retry route.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!RESEARCH_LAB_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Not available for this role" }, { status: 403 });
  }

  const format = req.nextUrl.searchParams.get("format");
  if (format !== "md" && format !== "bibtex" && format !== "ris" && format !== "pdf") {
    return NextResponse.json({ error: "format must be 'md', 'bibtex', 'ris', or 'pdf'" }, { status: 400 });
  }

  const { id } = await params;
  const doc = await db.researchLabDocument.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (doc.userId !== session.userId && !(await canViewResearchLabDocument(id, session.userId))) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const filename = doc.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "").slice(0, 60) || doc.id;

  if (format === "md") {
    return new NextResponse(buildExportMarkdown(doc), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.md"`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (format === "pdf") {
    const pdf = await buildExportPdf(doc);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const bibliography = await buildExportBibliography(doc, format);
  return new NextResponse(bibliography, {
    headers: {
      "Content-Type": format === "bibtex" ? "application/x-bibtex; charset=utf-8" : "application/x-research-info-systems; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.${format === "bibtex" ? "bib" : "ris"}"`,
      "Cache-Control": "no-store",
    },
  });
}
