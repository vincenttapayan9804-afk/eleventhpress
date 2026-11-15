import { NextRequest, NextResponse } from "next/server";
import { assistantAdminScope, assistantAnalytics } from "@/lib/research-assistant-admin";

/**
 * GET /api/admin/research-assistant/analytics?days=30[&tenantId=…|all] —
 * usage and answer quality of the Research Assistant: questions asked,
 * answered vs. not covered by the journal, evidence checks, response
 * times, reader ratings, the questions it couldn't answer, and (for the
 * platform super admin with tenantId=all) a row per institution.
 */
export async function GET(req: NextRequest) {
  const scope = await assistantAdminScope(req.headers, req.nextUrl.searchParams.get("tenantId"));
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const raw = Number(req.nextUrl.searchParams.get("days"));
  const days = [7, 30, 90, 180].includes(raw) ? raw : 30;
  const analytics = await assistantAnalytics(scope, days);
  return NextResponse.json({ analytics, platformAdmin: scope.platformAdmin }, { headers: { "Cache-Control": "private, no-store" } });
}
