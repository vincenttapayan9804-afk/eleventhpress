/**
 * Checksum pinning for the models that run on the platform itself (Phase 3).
 *
 * models.lock.json lists, for each local model, the SHA-256 of every file it
 * needs. When a model has an entry, the files on disk must match it before
 * the model is used; a mismatch means the file changed since you pinned it
 * (a tampered or silently updated download), and the model is not used.
 * A model with no entry runs as before and is reported as "not pinned".
 *
 * The lock file is created by `bun scripts/pin-models.ts` on a machine you
 * trust, right after the model first downloads. Nothing here invents a hash.
 */
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface ModelLockEntry {
  /** Where the files were taken from, for the record (a revision or commit id). */
  source?: string;
  pinnedAt?: string;
  files: Record<string, string>;
}
export interface ModelLock {
  models: Record<string, ModelLockEntry>;
}

export const EMPTY_LOCK: ModelLock = { models: {} };

export function parseLock(json: string): ModelLock {
  try {
    const raw = JSON.parse(json) as Partial<ModelLock>;
    const models: Record<string, ModelLockEntry> = {};
    for (const [id, e] of Object.entries(raw.models ?? {})) {
      if (!e || typeof e !== "object" || typeof e.files !== "object" || e.files === null) continue;
      const files: Record<string, string> = {};
      for (const [f, h] of Object.entries(e.files)) if (typeof h === "string" && /^[0-9a-f]{64}$/.test(h)) files[f] = h;
      if (Object.keys(files).length > 0) models[id] = { source: typeof e.source === "string" ? e.source : undefined, pinnedAt: typeof e.pinnedAt === "string" ? e.pinnedAt : undefined, files };
    }
    return { models };
  } catch {
    return EMPTY_LOCK;
  }
}

export function loadLock(path = join(process.cwd(), "models.lock.json")): ModelLock {
  try {
    return parseLock(readFileSync(path, "utf8"));
  } catch {
    return EMPTY_LOCK;
  }
}

export function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(path).on("data", (d) => h.update(d)).on("error", reject).on("end", () => resolve(h.digest("hex")));
  });
}

/** Every file under dir, as forward-slash paths relative to it. */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(dir, full).split(sep).join("/"));
    }
  };
  if (existsSync(dir)) walk(dir);
  return out.sort();
}

/** Hashes every file under dir (used when pinning). */
export async function hashDirectory(dir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const f of listFiles(dir)) files[f] = await sha256File(join(dir, f));
  return files;
}

export type ModelCheck =
  | { status: "not-pinned" }
  | { status: "ok"; files: number }
  | { status: "mismatch"; missing: string[]; changed: string[] };

/** Compares the files on disk with the pinned entry. Files not in the lock are ignored. */
export async function verifyModel(dir: string, entry: ModelLockEntry | undefined): Promise<ModelCheck> {
  if (!entry) return { status: "not-pinned" };
  const missing: string[] = [];
  const changed: string[] = [];
  for (const [f, hash] of Object.entries(entry.files)) {
    const full = join(dir, f);
    if (!existsSync(full)) {
      missing.push(f);
      continue;
    }
    if ((await sha256File(full)) !== hash) changed.push(f);
  }
  return missing.length || changed.length ? { status: "mismatch", missing, changed } : { status: "ok", files: Object.keys(entry.files).length };
}

/** Throws when a pinned model's files do not match; does nothing for a model that is not pinned. */
export async function assertModelIntegrity(modelId: string, dir: string, lock = loadLock()): Promise<ModelCheck> {
  const res = await verifyModel(dir, lock.models[modelId]);
  if (res.status === "mismatch") {
    throw new Error(`Model ${modelId} does not match its pinned checksums (changed: ${res.changed.join(", ") || "none"}; missing: ${res.missing.join(", ") || "none"}). It was not used.`);
  }
  return res;
}
