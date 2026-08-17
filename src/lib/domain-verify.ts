/**
 * Whitelabel Phase 3 — proves an admin controls a custom domain before it's
 * allowed to resolve to their tenant (see the `verified` gate in
 * resolveTenantFromHost, src/lib/tenant.ts). Uses a TXT record challenge:
 * the admin publishes TenantDomain.verificationToken at
 * `_ep-verify.<hostname>` and we confirm it resolves before flipping
 * `verified` to true.
 */
import { resolveTxt } from "dns/promises";

export interface DomainVerifyResult {
  verified: boolean;
  error?: string;
}

export async function verifyDomainTxtRecord(hostname: string, token: string): Promise<DomainVerifyResult> {
  const recordHost = `_ep-verify.${hostname}`;
  let records: string[][];
  try {
    records = await resolveTxt(recordHost);
  } catch (e: any) {
    return {
      verified: false,
      error: `No TXT record found at ${recordHost} (${e?.code || e?.message || "lookup failed"}). DNS changes can take up to 24-48h to propagate — try again shortly after adding the record.`,
    };
  }
  const values = records.map((chunks) => chunks.join(""));
  if (values.includes(token)) return { verified: true };
  return {
    verified: false,
    error: `TXT record found at ${recordHost} but its value doesn't match the expected token.`,
  };
}
