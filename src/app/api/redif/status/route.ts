import { NextResponse } from "next/server";
import { repecLiveMode, repecArchiveCode } from "@/lib/redif";

/**
 * GET /api/redif/status
 * Returns whether a real RePEc archive code is configured, so the UI can
 * show whether the ReDIF feed is registered with RePEc yet or still
 * awaiting the (manual, one-time) archive-registration application.
 */
export async function GET() {
  return NextResponse.json({
    liveMode: repecLiveMode(),
    archiveCode: repecArchiveCode(),
  });
}
