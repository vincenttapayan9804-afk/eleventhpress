import { NextResponse } from "next/server";
import { systemStatus } from "@/lib/system-status";

export const dynamic = "force-dynamic";

/** GET /api/health — machine-readable platform status for uptime monitors (503 when something is down). */
export async function GET() {
  const status = await systemStatus();
  return NextResponse.json(status, { status: status.overall === "down" ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
