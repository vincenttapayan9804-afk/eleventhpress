import { NextResponse } from "next/server";
import { usingBlob } from "@/lib/storage";

/**
 * GET /api/storage/mode
 * Reports whether Blob storage is connected at all (BLOB_READ_WRITE_TOKEN
 * or BLOB_STORE_ID present). Not currently used by the upload UI — both
 * upload flows (manuscripts, avatars) always go through the local-proxy
 * path (/api/storage/presign-local), since Vercel Blob's client-upload
 * protocol (/api/storage/presign) needs a classic BLOB_READ_WRITE_TOKEN to
 * sign client tokens, which an OIDC-only Blob connection (BLOB_STORE_ID
 * alone) doesn't provide. Kept around as a diagnostic endpoint and for
 * that direct-to-blob path to resume using once a real
 * BLOB_READ_WRITE_TOKEN exists.
 */
export async function GET() {
  return NextResponse.json({ mode: usingBlob() ? "blob" : "local" });
}
