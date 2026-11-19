import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { getFormDoc, formStatusLabel } from "@/lib/forms";
import { buildFormPdf, formPdfFileName } from "@/lib/form-pdf";
import { canReadFormRecord, parseAnswers } from "@/lib/forms/server";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { resourceBrandFor } from "@/lib/resources/tenant-brand-server";

/**
 * GET /api/forms/records/[id]/pdf — the signed record of an Official Form
 * as a branded PDF, for the signer, the journal's editors and (for
 * author-side forms) the manuscript's corresponding author.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await params;
  const row = await db.formSubmission.findUnique({ where: { id } });
  if (!row || !(await canReadFormRecord(session, row))) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  const brand = await resourceBrandFor(tenant);
  const form = getFormDoc(row.formId, brand);
  if (!form) return NextResponse.json({ error: "Unknown form" }, { status: 404 });
  const article = row.articleId ? await db.article.findUnique({ where: { id: row.articleId }, select: { title: true } }) : null;

  const pdf = await buildFormPdf({ ...form, version: row.formVersion }, brand, {
    id: row.id,
    answers: parseAnswers(row.answers),
    signedName: row.signedName,
    signedAt: row.signedAt,
    status: row.status,
    statusLabel: formStatusLabel(row.formId, row.status),
    articleTitle: article?.title,
    decisionNote: row.decisionNote,
    decidedAt: row.decidedAt,
  });
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${formPdfFileName(form, brand, row)}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
    },
  });
}
