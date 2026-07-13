import { NextResponse } from "next/server";
import { zenodoLiveMode } from "@/lib/zenodo";

/**
 * GET /api/zenodo/status
 * Returns whether a free Zenodo personal access token is configured, so the
 * UI can show which DOI provider is actually active on the next publish.
 */
export async function GET() {
  return NextResponse.json({
    liveMode: zenodoLiveMode(),
    sandbox: process.env.ZENODO_ENV !== "production",
  });
}
