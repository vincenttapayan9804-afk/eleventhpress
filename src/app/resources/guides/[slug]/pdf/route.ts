import { NextRequest, NextResponse } from "next/server";
import { getGuideDoc } from "@/lib/resources";
import { buildGuidePdf, guidePdfFileName } from "@/lib/guide-pdf";
import { resolveTenantFromHeaders, tenantCacheControl } from "@/lib/tenant";
import { resourceBrandFor } from "@/lib/resources/tenant-brand-server";

/**
 * GET /resources/guides/[slug]/pdf — public, no auth. The official,
 * branded PDF edition of a Resources guide, rendered from the same content
 * as /resources/guides/[slug], under the publisher of the site it's
 * requested on. `?inline=1` opens it in the browser instead
 * of downloading. Content only changes on deploy, so it is cached at the
 * edge for a day.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  const brand = await resourceBrandFor(tenant);
  const guide = getGuideDoc(slug, brand);
  if (!guide) return NextResponse.json({ error: "No guide with this name" }, { status: 404 });

  const pdf = await buildGuidePdf(guide, brand);
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${guidePdfFileName(guide, brand)}"`,
      "Content-Length": String(pdf.length),
      // Cached per host; never publicly for a tenant reached through the official host.
      "Cache-Control": tenantCacheControl(req, tenant, "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"),
    },
  });
}
