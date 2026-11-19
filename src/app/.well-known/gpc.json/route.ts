import { NextResponse } from "next/server";

/**
 * Global Privacy Control support resource
 * (https://privacycg.github.io/gpc-spec/#gpc-support-resource): declares
 * that this site honours the Sec-GPC / navigator.globalPrivacyControl
 * signal — see src/components/cookie-consent-banner.tsx and the reader_key
 * check in src/app/api/magazine-issues/[id]/route.ts.
 */
const GPC_SUPPORT_UPDATED = "2026-11-19";

export function GET() {
  return NextResponse.json(
    { gpc: true, lastUpdate: GPC_SUPPORT_UPDATED },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
