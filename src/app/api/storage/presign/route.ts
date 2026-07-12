import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";

/** Per-bucket upload rules. Only buckets listed here may be uploaded to directly from the client. */
const BUCKET_RULES: Record<string, { contentTypes: string[]; maxSizeBytes: number }> = {
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
    maxSizeBytes: 50 * 1024 * 1024,
  },
  avatars: {
    contentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    maxSizeBytes: 5 * 1024 * 1024,
  },
};

/**
 * POST /api/storage/presign
 * Implements Vercel Blob's client-upload token protocol (@vercel/blob/client
 * upload() on the frontend talks to this route, then PUTs the file bytes
 * directly to Blob storage — never through this serverless function, which
 * is what lets a 50MB manuscript upload without hitting the platform's
 * request-body size limit). Only reachable when Blob storage is connected;
 * the frontend checks GET /api/storage/mode first and uses the simpler
 * local-proxy routes otherwise.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const bucket = pathname.split("/")[0];
        const rules = BUCKET_RULES[bucket];
        if (!rules || !pathname.startsWith(`${bucket}/`)) {
          throw new Error(`Uploads are only permitted into: ${Object.keys(BUCKET_RULES).join(", ")}`);
        }
        return {
          allowedContentTypes: rules.contentTypes,
          maximumSizeInBytes: rules.maxSizeBytes,
          tokenPayload: JSON.stringify({ userId: session.userId, bucket }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Only fires via a webhook from Vercel to a publicly reachable URL —
        // never on localhost. Best-effort bookkeeping; the blob itself
        // existing is what actually matters for the app to function.
        try {
          const payload = tokenPayload ? JSON.parse(tokenPayload) : {};
          await db.storageObject.create({
            data: {
              bucket: payload.bucket || "raw-submissions",
              key: blob.pathname,
              fileName: blob.pathname.split("/").pop() || blob.pathname,
              contentType: blob.contentType,
              sizeBytes: 0,
              uploadStatus: "UPLOADED",
              uploadedBy: payload.userId || null,
            },
          });
        } catch (e) {
          console.error("[storage/presign] onUploadCompleted bookkeeping failed:", e);
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
