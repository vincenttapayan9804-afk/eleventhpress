import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { putObject } from "@/lib/storage";

/**
 * PUT /api/storage/upload-local/[token]
 * Receiving end of the dev-only presign-local flow. The token itself is
 * the authorization — matches the frontend's existing comment that it
 * doesn't send a bearer token on this request.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const record = await db.storageObject.findUnique({ where: { presignToken: token } });
  if (!record) {
    return NextResponse.json({ error: "Invalid or unknown upload token" }, { status: 404 });
  }
  if (!record.presignExpiresAt || record.presignExpiresAt < new Date()) {
    return NextResponse.json({ error: "Upload URL has expired" }, { status: 410 });
  }

  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ error: "Empty upload body" }, { status: 400 });
  }

  await putObject(record.key, bytes, record.contentType);

  await db.storageObject.update({
    where: { id: record.id },
    data: { uploadStatus: "UPLOADED", sizeBytes: bytes.length, presignToken: null, presignExpiresAt: null },
  });

  return NextResponse.json({ ok: true, key: record.key, size: bytes.length });
}
