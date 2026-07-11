import { NextRequest, NextResponse } from "next/server";
import { getObject } from "@/lib/storage";

/**
 * GET /api/storage/download?key=...&filename=...
 * Serves an object from local-filesystem storage. Only used in the
 * local-dev fallback path (see GET /api/storage/mode) — when Blob storage
 * is connected, presignGet() returns the blob's own real public URL
 * directly instead of pointing here, so this route is never hit in
 * production.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const filename = searchParams.get("filename");
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const buf = await getObject(key);
  if (!buf) {
    return NextResponse.json({ error: "Object not found" }, { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": guessContentType(key),
    "Cache-Control": "private, max-age=0, must-revalidate",
  };
  if (filename) {
    headers["Content-Disposition"] = `attachment; filename="${filename.replace(/"/g, "")}"`;
  }

  return new NextResponse(new Uint8Array(buf), { headers });
}

function guessContentType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "html":
      return "text/html; charset=utf-8";
    case "xml":
      return "application/xml; charset=utf-8";
    case "md":
      return "text/markdown; charset=utf-8";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}
