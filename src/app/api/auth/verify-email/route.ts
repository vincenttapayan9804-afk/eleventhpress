import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/auth/verify-email?token=...
 * Redeems the link POST /api/auth/register (or /api/auth/resend-verification)
 * emailed out. Redirects back into the SPA with a query flag src/app/
 * page.tsx reads to show a confirmation toast, mirroring the existing
 * orcid_linked/blogger_connected redirect convention there.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/?error=invalid_verification_token", req.url));
  }

  const user = await db.user.findUnique({ where: { emailVerificationToken: token }, select: { id: true } });
  if (!user) {
    return NextResponse.redirect(new URL("/?error=invalid_verification_token", req.url));
  }

  await db.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), emailVerificationToken: null },
  });

  return NextResponse.redirect(new URL("/?email_verified=1", req.url));
}
