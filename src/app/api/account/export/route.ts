import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { exportUserAccountData } from "@/lib/account-privacy";

/**
 * GET /api/account/export
 * GDPR Art. 20 / CCPA data-portability — every signed-in user can export
 * their own personal data and platform activity as JSON. No role gate:
 * this is a self-service right, not an editorial permission.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const data = await exportUserAccountData(session.userId);
  if (!data) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json(data, {
    headers: {
      "Content-Disposition": `attachment; filename="eleventhpress-account-export-${session.userId}.json"`,
    },
  });
}
