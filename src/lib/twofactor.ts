/**
 * TOTP-based two-factor authentication (RFC 6238), via otplib — no
 * external service, no vendor dependency, works with any authenticator
 * app (Google Authenticator, Authy, 1Password, etc). Unlike the platform's
 * other premium integrations (Zenodo, iThenticate), this needs no API key
 * or live-mode gate: the secret is generated and verified entirely
 * server-side, so it is always fully functional once a user opts in.
 *
 * otplib v13's functional API (generate/verify) is async — it dynamically
 * picks a crypto plugin whose HMAC operations aren't guaranteed
 * synchronous, so this file mirrors that (no *Sync variants).
 */
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { generateSecret, generateURI, verify as verifyOtp } from "otplib";
import QRCode from "qrcode";

const ISSUER = "Eleventh Press";
const BACKUP_CODE_COUNT = 10;
const BCRYPT_ROUNDS = 10;
// Symmetric tolerance in seconds around the current 30s time step, so a
// code from just before/after the boundary (clock drift, submission lag)
// still verifies — equivalent to a ±1-step window.
const EPOCH_TOLERANCE_SECONDS = 30;

export function generateTwoFactorSecret(): string {
  return generateSecret();
}

export async function generateTwoFactorQrCode(email: string, secret: string): Promise<string> {
  const otpauthUrl = generateURI({ issuer: ISSUER, label: email, secret });
  return QRCode.toDataURL(otpauthUrl);
}

export async function verifyTwoFactorToken(token: string, secret: string): Promise<boolean> {
  try {
    const result = await verifyOtp({ secret, token: token.trim(), epochTolerance: EPOCH_TOLERANCE_SECONDS });
    return result.valid;
  } catch {
    return false;
  }
}

/** One-time-use recovery codes for when the authenticator device is lost. Returned plaintext exactly once at generation time; only bcrypt hashes are ever persisted. */
export function generateBackupCodes(): { plaintext: string[]; hashed: string } {
  const plaintext = Array.from({ length: BACKUP_CODE_COUNT }, () =>
    crypto.randomBytes(5).toString("hex").toUpperCase().replace(/(.{5})/, "$1-")
  );
  const hashed = plaintext.map((code) => bcrypt.hashSync(code, BCRYPT_ROUNDS)).join(",");
  return { plaintext, hashed };
}

/**
 * Checks `code` against the stored comma-separated bcrypt hash list and, if
 * it matches, returns the remaining hash list with that one consumed
 * (single-use). Returns null when there's no match — callers must not
 * persist anything in that case.
 */
export function consumeBackupCode(code: string, storedHashed: string | null): string | null {
  if (!storedHashed) return null;
  const hashes = storedHashed.split(",").filter(Boolean);
  const normalized = code.trim().toUpperCase();
  const matchIndex = hashes.findIndex((h) => bcrypt.compareSync(normalized, h));
  if (matchIndex === -1) return null;
  hashes.splice(matchIndex, 1);
  return hashes.join(",");
}
