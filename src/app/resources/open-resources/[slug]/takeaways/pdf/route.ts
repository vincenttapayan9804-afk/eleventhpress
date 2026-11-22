import { NextRequest, NextResponse } from "next/server";
import { OPEN_RESOURCES } from "@/lib/open-resources";
import { takeawaysFor } from "@/lib/open-resources-takeaways";
import { buildTakeawaysPdf, takeawaysPdfFileName } from "@/lib/open-resource-takeaways-pdf";
import { resolveTenantFromHeaders, tenantCacheControl } from "@/lib/tenant";
import { resourcesBlogVisible } from "@/lib/resources/tenant-brand-server";

/**
 * GET /resources/open-resources/[slug]/takeaways/pdf — public, no auth. The
 * branded PDF of Eleventh Press's Editorial Takeaways for an Open Resources
 * title. Like the Resources blog, this is Eleventh Press's own editorial
 * voice, so it is served on the platform only (a tenant site gets 404 rather
 * than appearing to author our commentary). `?inline=1` opens it in the
 * browser instead of downloading. Content only changes on deploy, so it is
 * cached at the edge for a day.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  const resource = OPEN_RESOURCES.find((r) => r.slug === slug);
  const takeaways = resource ? takeawaysFor(slug) : null;
  if (!resource || !takeaways || !resourcesBlogVisible(tenant)) {
    return NextResponse.json({ error: "No takeaways with this name" }, { status: 404 });
  }

  const pdf = await buildTakeawaysPdf(resource, takeaways);
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${takeawaysPdfFileName(resource, takeaways)}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": tenantCacheControl(req, tenant, "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"),
    },
  });
}
