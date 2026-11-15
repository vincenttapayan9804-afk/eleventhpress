import { NextRequest, NextResponse } from "next/server";
import { loadSharedConversation } from "@/lib/research-share";
import { resolveTenantFromHeaders } from "@/lib/tenant";

/** GET /api/corpus-chat/shared/[token] — a shared, read-only conversation (see research-share.ts). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tenant = await resolveTenantFromHeaders(req.headers).catch(() => null);
  const shared = await loadSharedConversation(token, tenant);
  if (!shared) return NextResponse.json({ error: "This shared conversation isn't available. The link may have been revoked." }, { status: 404 });
  return NextResponse.json({ conversation: shared }, { headers: { "Cache-Control": "private, no-store" } });
}
