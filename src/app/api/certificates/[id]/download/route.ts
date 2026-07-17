import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { presignGet } from "@/lib/storage";

/**
 * GET /api/certificates/[id]/download
 * Presigned PDF URL — the owning user or SUPER_ADMIN only. Certificates
 * name a real person; unlike published-article galleys, this is never
 * public.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id } = await params;
  const certificate = await db.certificate.findUnique({ where: { id } });
  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }
  if (certificate.userId !== session.userId && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const url = await presignGet(certificate.pdfKey, `${certificate.serialNumber}.pdf`);
  return NextResponse.json({ url });
}
