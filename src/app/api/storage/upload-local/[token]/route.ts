import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { putObject, presignGet } from "@/lib/storage";

/**
 * PUT /api/storage/upload-local/[token]
 * Receiving end of the presign-local flow. Despite the name (this route
 * predates it being used for anything but local dev), `putObject()`
 * already routes to real Vercel Blob storage whenever it's connected —
 * so this proxied-through-our-server upload path is also the safe choice
 * in production for small files (avatars) where going through a
 * serverless function is fine, as opposed to the direct-to-blob
 * client-token protocol (`/api/storage/presign`), which requires a
 * classic `BLOB_READ_WRITE_TOKEN` that OIDC-only Blob connections don't
 * have. The token itself is the authorization — matches the frontend's
 * existing comment that it doesn't send a bearer token on this request.
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

  const url = await presignGet(record.key);
  return NextResponse.json({ ok: true, key: record.key, size: bytes.length, url });
}
