import { NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { publicView, systemStatus } from "@/lib/system-status";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — machine-readable platform status for uptime monitors
 * (503 when something is down). Configuration-revealing rows are only
 * included for a signed-in platform super admin.
 */
export async function GET(req: Request) {
  const full = await systemStatus();
  const status = getSessionFromHeaders(req.headers)?.role === "SUPER_ADMIN" ? full : publicView(full);
  return NextResponse.json(status, { status: status.overall === "down" ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
