/**
 * Field-level encryption at rest for OAuth tokens (ORCID/Blogger access +
 * refresh tokens on User) — a stolen database dump alone should not hand
 * over live, usable third-party credentials. AES-256-GCM via Node's
 * `crypto` module (this only ever runs in Node route handlers/the Prisma
 * client, never Next's Edge middleware runtime, unlike src/lib/csrf.ts's
 * Web Crypto choice — no cross-runtime constraint here).
 *
 * Same posture as SESSION_SECRET (src/lib/auth.ts): a fixed, insecure
 * dev-only default so local `bun dev` works out of the box, but the app
 * refuses to start in production without a real FIELD_ENCRYPTION_KEY.
 *
 * Read-compatible with rows written before this feature shipped:
 * decryptField() only decrypts values carrying the ENCRYPTED_PREFIX marker
 * and returns anything else (legacy plaintext) unchanged — no forced
 * migration, no fabricated "encrypted" status for data that isn't.
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM's recommended nonce length
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = "enc:v1:";

const FIELD_ENCRYPTION_KEY_HEX =
  process.env.FIELD_ENCRYPTION_KEY ||
  (process.env.NODE_ENV !== "production" ? "0".repeat(64) : undefined);

if (!FIELD_ENCRYPTION_KEY_HEX) {
  throw new Error(
    "FIELD_ENCRYPTION_KEY environment variable is required in production — OAuth tokens cannot be encrypted at rest without it."
  );
}

function getKey(): Buffer {
  const key = Buffer.from(FIELD_ENCRYPTION_KEY_HEX!, "hex");
  if (key.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes) for AES-256-GCM.");
  }
  return key;
}

/** Encrypts a plaintext string into a self-contained, storable value (marker + base64(iv | authTag | ciphertext)). */
export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ENCRYPTED_PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Decrypts a value produced by encryptField(). A value without the marker is passed through unchanged (legacy plaintext row). */
export function decryptField(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }
  const raw = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/** The four User columns encrypted at rest — kept as a single list so the Prisma extension in src/lib/db.ts and any future caller stay in sync. */
export const ENCRYPTED_USER_FIELDS = [
  "orcidAccessToken",
  "orcidRefreshToken",
  "bloggerAccessToken",
  "bloggerRefreshToken",
] as const;

/**
 * Mutates and returns `data` with any of ENCRYPTED_USER_FIELDS present as
 * a plain string encrypted in place. Only handles the plain-string
 * assignment shape (`{ bloggerAccessToken: "..." }`), which is the only
 * shape this codebase's writes use today — not Prisma's field-update
 * operator objects (e.g. `{ set: "..." }`), so a future write using that
 * form would need this function extended to match.
 */
export function encryptUserFields<T extends Record<string, unknown> | null | undefined>(data: T): T {
  if (!data) return data;
  for (const field of ENCRYPTED_USER_FIELDS) {
    const value = data[field];
    if (typeof value === "string") {
      (data as Record<string, unknown>)[field] = encryptField(value);
    }
  }
  return data;
}

/** Mutates and returns `result` with any of ENCRYPTED_USER_FIELDS present as a string decrypted in place. Safe to call on a result where none of the fields were selected — it's simply a no-op for each absent field. */
export function decryptUserFields<T extends Record<string, unknown> | null | undefined>(result: T): T {
  if (!result || typeof result !== "object") return result;
  for (const field of ENCRYPTED_USER_FIELDS) {
    const value = result[field];
    if (typeof value === "string") {
      (result as Record<string, unknown>)[field] = decryptField(value);
    }
  }
  return result;
}
