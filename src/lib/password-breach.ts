import crypto from "crypto";

/**
 * Checks a candidate password against Have I Been Pwned's Pwned Passwords
 * API using k-anonymity — only the first 5 hex chars of the password's
 * SHA-1 hash are ever sent, the full password/hash never leaves this
 * process. Free, no API key required. Fails open (returns false — "not
 * known-breached") on any network error, since the breach-check API's own
 * availability should never itself block registration.
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const sha1 = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!res.ok) return false;
    const text = await res.text();
    return text.split("\n").some((line) => line.split(":")[0].trim() === suffix);
  } catch {
    return false;
  }
}
