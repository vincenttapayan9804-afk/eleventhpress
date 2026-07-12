import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/** Per-bucket upload rules — mirrors /api/storage/presign's BUCKET_RULES. */
const BUCKET_RULES: Record<string, { contentTypes: string[] }> = {
  "raw-submissions": {
    contentTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/markdown",
      "text/plain",
      "text/html",
      "application/x-tex",
    ],
  },
  avatars: {
    contentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
};
const PRESIGN_TTL_MS = 10 * 60 * 1000;

/**
 * POST /api/storage/presign-local
 * Dev-only fallback used when no Blob storage is connected (see
 * GET /api/storage/mode). Simpler contract than Vercel Blob's client-upload
 * protocol: returns a URL the browser PUTs the raw file bytes to directly,
 * proxied through this app's own /api/storage/upload-local/[token] route
 * and written to local disk — fine for local testing, but note this proxies
 * bytes through a serverless function, so it does NOT scale to large files
 * on a real Vercel deployment the way the Blob-backed flow does.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { filename, contentType, bucket } = (await req.json()) as {
    filename?: string;
    contentType?: string;
    bucket?: string;
  };
  if (!filename) {
    return NextResponse.json({ error: "filename is required" }, { status: 400 });
  }
  const resolvedBucket = bucket || "raw-submissions";
  const rules = BUCKET_RULES[resolvedBucket];
  if (!rules) {
    return NextResponse.json({ error: `Unknown bucket: ${resolvedBucket}` }, { status: 400 });
  }
  if (contentType && !rules.contentTypes.includes(contentType)) {
    return NextResponse.json({ error: `Unsupported content type: ${contentType}` }, { status: 400 });
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${resolvedBucket}/${session.userId}/${Date.now()}-${safeName}`;
  const token = crypto.randomBytes(24).toString("hex");
  const presignExpiresAt = new Date(Date.now() + PRESIGN_TTL_MS);

  await db.storageObject.create({
    data: {
      bucket: resolvedBucket,
      key,
      fileName: filename,
      contentType: contentType || "application/octet-stream",
      sizeBytes: 0,
      uploadStatus: "PENDING",
      uploadedBy: session.userId,
      presignToken: token,
      presignExpiresAt,
    },
  });

  return NextResponse.json({
    uploadUrl: `/api/storage/upload-local/${token}`,
    key,
    headers: { "Content-Type": contentType || "application/octet-stream" },
  });
}
