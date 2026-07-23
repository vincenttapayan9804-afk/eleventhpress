import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { syncRetractionWatchDatabase } from "@/lib/retraction-watch";

/**
 * GET /api/admin/retraction-watch/sync
 * Current sync status (last attempt, record count, last error). SUPER_ADMIN only.
 */
export async function GET(req: NextRequest) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const meta = await db.retractionWatchSyncMeta.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({ meta });
}

/**
 * POST /api/admin/retraction-watch/sync
 * Re-fetches the real Retraction Watch Database CSV (Crossref's free
 * public mirror) and replaces the local lookup table. Runs synchronously —
 * this is a full re-sync of a multi-tens-of-thousands-row dataset, so it
 * can take a while; there's no incremental feed to diff against instead.
 * SUPER_ADMIN only.
 */
export async function POST(req: NextRequest) {
  const auth = requireRole(req.headers, ["SUPER_ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await syncRetractionWatchDatabase();
  return NextResponse.json(result);
}
