import { NextRequest, NextResponse } from "next/server";
import { getFormDoc } from "@/lib/forms";
import { buildFormPdf, formPdfFileName } from "@/lib/form-pdf";
import { resolveTenantFromHeaders, tenantCacheControl } from "@/lib/tenant";
import { resourceBrandFor } from "@/lib/resources/tenant-brand-server";

/**
 * GET /resources/forms/[slug]/pdf — public, no auth. The printable, branded
 * PDF edition of an Official Form, under the publisher of the site it's
 * requested on. `?inline=1` opens it in the browser instead of downloading.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  const brand = await resourceBrandFor(tenant);
  const form = getFormDoc(slug, brand);
  if (!form) return NextResponse.json({ error: "No form with this name" }, { status: 404 });

  const pdf = await buildFormPdf(form, brand);
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${formPdfFileName(form, brand)}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": tenantCacheControl(req, tenant, "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"),
    },
  });
}
