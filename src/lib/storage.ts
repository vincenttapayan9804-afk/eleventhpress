/**
 * Local storage service — simulates AWS S3 with pre-signed URLs.
 *
 * In production, swap these functions for the AWS S3 SDK:
 *   - putObject     → s3.putObject(...)
 *   - presignGet    → s3.getSignedUrlPromise("getObject", ...)
 *   - getObject     → s3.getObject(...)
 *
 * Here we use the local filesystem under /home/z/my-project/storage/
 * with three "buckets": raw-submissions, anonymized-manuscripts, published-galleys.
 */
import { promises as fs } from "fs";
import path from "path";

const STORAGE_ROOT = path.resolve(process.cwd(), "storage");

const BUCKET_DIRS: Record<string, string> = {
  "raw-submissions": path.join(STORAGE_ROOT, "raw-submissions"),
  "anonymized-manuscripts": path.join(STORAGE_ROOT, "anonymized-manuscripts"),
  "published-galleys": path.join(STORAGE_ROOT, "published-galleys"),
};

/** Ensure all bucket directories exist. */
export async function ensureBuckets(): Promise<void> {
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

/**
 * Write a buffer to local storage under the given key.
 * Equivalent to S3 PutObject.
 */
export async function putObject(
  key: string,
  data: Buffer,
  contentType: string
): Promise<{ key: string; size: number; etag: string }> {
  const { bucket, path: relPath } = parseKey(key);
  const bucketDir = BUCKET_DIRS[bucket];
  if (!bucketDir) {
    throw new Error(`Unknown bucket: ${bucket}`);
  }
  const fullPath = path.join(bucketDir, relPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, data);

  const crypto = await import("crypto");
  const etag = crypto.createHash("md5").update(data).digest("hex");
  return { key, size: data.length, etag };
}

/**
 * Read an object from local storage.
 * Equivalent to S3 GetObject.
 */
export async function getObject(key: string): Promise<Buffer | null> {
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
 * Generate a "pre-signed GET URL" for an object.
 * In production this would be an S3 pre-signed URL with a short TTL.
 * Here we return a relative URL that hits our /api/storage/download endpoint.
 */
export function presignGet(key: string): string {
  return `/api/storage/download?key=${encodeURIComponent(key)}`;
}

/**
 * Check if an object exists.
 */
export async function objectExists(key: string): Promise<boolean> {
  const buf = await getObject(key);
  return buf !== null;
}

/**
 * Delete an object.
 */
export async function deleteObject(key: string): Promise<void> {
  const { bucket, path: relPath } = parseKey(key);
  const bucketDir = BUCKET_DIRS[bucket];
  if (!bucketDir) return;
  const fullPath = path.join(bucketDir, relPath);
  try {
    await fs.unlink(fullPath);
  } catch {}
}
