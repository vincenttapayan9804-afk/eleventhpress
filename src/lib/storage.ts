/**
 * Storage service — real object storage via Vercel Blob when configured
 * (BLOB_READ_WRITE_TOKEN present, which Vercel injects automatically once
 * Blob storage is connected to the project), falling back to the local
 * filesystem otherwise. Vercel's serverless functions have a read-only
 * filesystem outside /tmp, so the local-filesystem path is a dev-only
 * convenience, not a production storage layer — Blob is what makes uploads
 * actually persist on a real deployment.
 *
 * Three "buckets": raw-submissions, anonymized-manuscripts, published-galleys.
 */
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { put, get, head, del } from "@vercel/blob";

const STORAGE_ROOT = path.resolve(process.cwd(), "storage");

const BUCKET_DIRS: Record<string, string> = {
  "raw-submissions": path.join(STORAGE_ROOT, "raw-submissions"),
  "anonymized-manuscripts": path.join(STORAGE_ROOT, "anonymized-manuscripts"),
  "published-galleys": path.join(STORAGE_ROOT, "published-galleys"),
};

export function usingBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/** Ensure all local bucket directories exist (no-op in Blob mode). */
export async function ensureBuckets(): Promise<void> {
  if (usingBlob()) return;
  for (const dir of Object.values(BUCKET_DIRS)) {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * Parse an S3-style key like "published-galleys/abc123.pdf" into
 * { bucket, path }.
 */
function parseKey(key: string): { bucket: string; path: string } {
  const slashIdx = key.indexOf("/");
  if (slashIdx === -1) {
    return { bucket: "raw-submissions", path: key };
  }
  const bucket = key.slice(0, slashIdx);
  const rest = key.slice(slashIdx + 1);
  return { bucket, path: rest };
}

/** Write a buffer to storage under the given key. */
export async function putObject(
  key: string,
  data: Buffer,
  contentType: string
): Promise<{ key: string; size: number; etag: string }> {
  const etag = crypto.createHash("md5").update(data).digest("hex");

  if (usingBlob()) {
    await put(key, data, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { key, size: data.length, etag };
  }

  const { bucket, path: relPath } = parseKey(key);
  const bucketDir = BUCKET_DIRS[bucket];
  if (!bucketDir) {
    throw new Error(`Unknown bucket: ${bucket}`);
  }
  const fullPath = path.join(bucketDir, relPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, data);
  return { key, size: data.length, etag };
}

/** Read an object from storage. */
export async function getObject(key: string): Promise<Buffer | null> {
  if (usingBlob()) {
    try {
      const result = await get(key, { access: "public" });
      if (!result || result.statusCode !== 200) return null;
      const chunks: Uint8Array[] = [];
      const reader = result.stream.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }

  const { bucket, path: relPath } = parseKey(key);
  const bucketDir = BUCKET_DIRS[bucket];
  if (!bucketDir) return null;
  const fullPath = path.join(bucketDir, relPath);
  try {
    return await fs.readFile(fullPath);
  } catch {
    return null;
  }
}

/**
 * Generate a download URL for an object. In Blob mode this is the blob's
 * real, directly-fetchable public URL (optionally forcing a download
 * filename via Blob's `?download=` convention); otherwise it's a relative
 * URL that hits our own /api/storage/download endpoint.
 */
export async function presignGet(key: string, downloadFilename?: string): Promise<string> {
  if (usingBlob()) {
    try {
      const meta = await head(key);
      const url = new URL(meta.url);
      if (downloadFilename) url.searchParams.set("download", downloadFilename);
      return url.toString();
    } catch {
      // Object doesn't exist yet — fall through to a best-effort local-style URL
      // so callers still get a string back rather than throwing.
    }
  }

  const qs = new URLSearchParams({ key });
  if (downloadFilename) qs.set("filename", downloadFilename);
  return `/api/storage/download?${qs.toString()}`;
}

/** Check if an object exists. */
export async function objectExists(key: string): Promise<boolean> {
  if (usingBlob()) {
    try {
      await head(key);
      return true;
    } catch {
      return false;
    }
  }
  const buf = await getObject(key);
  return buf !== null;
}

/** Delete an object. */
export async function deleteObject(key: string): Promise<void> {
  if (usingBlob()) {
    try {
      await del(key);
    } catch {}
    return;
  }
  const { bucket, path: relPath } = parseKey(key);
  const bucketDir = BUCKET_DIRS[bucket];
  if (!bucketDir) return;
  const fullPath = path.join(bucketDir, relPath);
  try {
    await fs.unlink(fullPath);
  } catch {}
}
