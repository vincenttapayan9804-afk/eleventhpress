/**
 * Storage service — real object storage via Vercel Blob when configured,
 * falling back to the local filesystem otherwise. Vercel's serverless
 * functions have a read-only filesystem outside /tmp, so the
 * local-filesystem path is a dev-only convenience, not a production
 * storage layer — Blob is what makes uploads actually persist on a real
 * deployment.
 *
 * @vercel/blob v2 supports two auth modes: the classic static
 * BLOB_READ_WRITE_TOKEN, or the newer OIDC-based auth (VERCEL_OIDC_TOKEN +
 * BLOB_STORE_ID) that Vercel injects automatically once a store is
 * connected via the dashboard's "Connect Project" flow — no static token
 * involved in that path, so BLOB_STORE_ID is the presence check that
 * actually matches how a dashboard-connected store shows up.
 *
 * Four "buckets": raw-submissions, anonymized-manuscripts, published-galleys,
 * avatars.
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
  avatars: path.join(STORAGE_ROOT, "avatars"),
  applications: path.join(STORAGE_ROOT, "applications"),
  "book-covers": path.join(STORAGE_ROOT, "book-covers"),
  "book-manuscripts": path.join(STORAGE_ROOT, "book-manuscripts"),
  certificates: path.join(STORAGE_ROOT, "certificates"),
  "research-audio": path.join(STORAGE_ROOT, "research-audio"),
};

export function usingBlob(): boolean {
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

/**
 * Derives a safe storage-key filename from a client-supplied original
 * filename (e.g. POST /api/articles/submit's `manuscriptName`) — keeps
 * only the extension from the original name (matching the pattern
 * generateGalleys() already uses to pick a converter) and always
 * generates the base name server-side, so nothing from the client ever
 * becomes part of a filesystem/object-storage path segment. `fallback` is
 * a value already unique to this write (e.g. the draft DOI suffix) used
 * as the base name.
 */
export function safeManuscriptFilename(originalName: string, fallback: string | number): string {
  const rawExt = originalName.split(".").pop() || "";
  const ext = /^[a-zA-Z0-9]{1,10}$/.test(rawExt) ? rawExt.toLowerCase() : "pdf";
  return `${fallback}.${ext}`;
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

/**
 * Joins `bucketDir` + `relPath` and verifies the result is still inside
 * `bucketDir` — the standard resolve-then-check-prefix guard against
 * `relPath` containing "../" segments. Several callers below build `key`
 * (and therefore `relPath`) from data that ultimately traces back to a
 * client-supplied filename (e.g. POST /api/articles/submit's
 * `manuscriptName` fallback) — in Blob mode a traversal-looking key is
 * just an unusual opaque object name, but in local-disk mode (dev, or any
 * deployment without BLOB_READ_WRITE_TOKEN configured) an unguarded
 * `path.join` would let it escape the intended bucket directory entirely.
 * Returns null (never throws) so callers can treat it exactly like a
 * missing/invalid key instead of a distinguishable error.
 */
export function resolveWithinBucket(bucketDir: string, relPath: string): string | null {
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- this join is intentional and is immediately validated below (resolve-then-check-prefix); it's the sanitizer this function exists to provide, not an unguarded use of the traversal-prone pattern the rule flags.
  const fullPath = path.join(bucketDir, relPath);
  const normalizedBucketDir = path.join(bucketDir, path.sep);
  if (fullPath !== path.join(bucketDir) && !fullPath.startsWith(normalizedBucketDir)) {
    return null;
  }
  return fullPath;
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
  const fullPath = resolveWithinBucket(bucketDir, relPath);
  if (!fullPath) {
    throw new Error(`Refusing to write outside bucket directory: ${key}`);
  }
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
  const fullPath = resolveWithinBucket(bucketDir, relPath);
  if (!fullPath) return null;
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
  const fullPath = resolveWithinBucket(bucketDir, relPath);
  if (!fullPath) return;
  try {
    await fs.unlink(fullPath);
  } catch {}
}
