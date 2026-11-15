import { NextRequest, NextResponse } from "next/server";
import { resolveTenantFromHeaders, tenantCacheControl } from "@/lib/tenant";
import { getAssistantSettings } from "@/lib/research-assistant-settings";

/** GET /api/corpus-chat/status — whether this institution offers the Research Assistant (for the launcher button). */
export async function GET(req: NextRequest) {
  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  const settings = await getAssistantSettings(tenant?.id ?? null);
  return NextResponse.json(
    { enabled: settings.enabled },
    { headers: { "Cache-Control": tenantCacheControl(req, tenant, "public, s-maxage=60, stale-while-revalidate=600") } }
  );
}
