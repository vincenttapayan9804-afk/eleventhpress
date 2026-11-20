import { NextRequest, NextResponse } from "next/server";
import { assistantAdminScope } from "@/lib/research-assistant-admin";
import { streamProviderStatus } from "@/lib/llm-stream";

/**
 * GET /api/admin/research-assistant/providers — the model providers the
 * Research Assistant tries, in order (self-hosted server, pinned free
 * OpenRouter models, Anthropic), and which this server instance is
 * currently skipping after a failure. Platform super admin only: the
 * providers are deployment-wide, not per institution. No keys or URLs are
 * returned.
 */
export async function GET(req: NextRequest) {
  const scope = await assistantAdminScope(req.headers, null);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!scope.platformAdmin) return NextResponse.json({ error: "Only the platform administrator can view model providers" }, { status: 403 });
  return NextResponse.json({ providers: streamProviderStatus() }, { headers: { "Cache-Control": "private, no-store" } });
}
