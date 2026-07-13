import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { ensurePgvector, pgvectorRowCount } from "@/lib/pgvector";

/**
 * GET /api/search/semantic/status
 * Diagnostic endpoint for confirming pgvector rollout succeeded in
 * production without DB console access — semanticSearch()/checkSimilarity()
 * already fall back silently on failure, so this is the fastest way to see
 * whether the indexed path is actually active. SUPER_ADMIN only.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pgvectorReady = await ensurePgvector();
  const rowCount = pgvectorReady ? await pgvectorRowCount().catch(() => 0) : 0;

  return NextResponse.json({ pgvectorReady, rowCount });
}
