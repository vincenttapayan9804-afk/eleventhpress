import { NextResponse } from "next/server";
import { usingBlob } from "@/lib/storage";

/**
 * GET /api/storage/mode
 * Tells the client which upload flow to use: Vercel Blob's real
 * client-upload protocol (production, once Blob storage is connected) or
 * the simpler local-proxy fallback (dev, when no BLOB_READ_WRITE_TOKEN is
 * configured). The two aren't interchangeable — Blob's client upload
 * bypasses this server entirely for the file bytes (avoiding serverless
 * function body-size limits, which matters for 50MB manuscripts), so the
 * frontend needs to know which contract to speak before it starts.
 */
export async function GET() {
  return NextResponse.json({ mode: usingBlob() ? "blob" : "local" });
}
