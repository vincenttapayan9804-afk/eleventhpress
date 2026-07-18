/**
 * Institutional IP-Range Authentication Service.
 *
 * Checks a requesting IP address against all registered institutions'
 * IP ranges (CIDR notation). If the IP matches, the requester is
 * granted institutional access — full PDF downloads, COUNTER reports
 * sliced by institution, and (for transformative agreements) APC waivers.
 *
 * Called from the article detail route (src/app/api/articles/[id]/route.ts)
 * via recordCounterEvent() below, and from the diagnostic
 * src/app/api/institutions/ip-check/route.ts.
 */
import { randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

/** Constant-time string comparison — a plain `===` on a secret leaks its
 * length/prefix via response-time differences to a network attacker. */
function safeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface InstitutionMatch {
  institutionId: string;
  name: string;
  plan: string;
  status: string;
  apcQuotaAvailable: number;
  counterCustomerId: string | null;
}

/**
 * Check if an IP address falls within any registered institution's IP range.
 * Supports CIDR notation (e.g. "128.103.0.0/16").
 */
export async function matchInstitutionByIp(ip: string): Promise<InstitutionMatch | null> {
  const institutions = await db.institution.findMany({
    where: { status: "ACTIVE" },
  });

  for (const inst of institutions) {
    const ranges = inst.ipRanges.split(",").map((r) => r.trim()).filter(Boolean);
    for (const range of ranges) {
      if (isIpInCidr(ip, range)) {
        return {
          institutionId: inst.id,
          name: inst.name,
          plan: inst.plan,
          status: inst.status,
          apcQuotaAvailable: Math.max(0, inst.apcQuota - inst.apcUsed),
          counterCustomerId: inst.counterCustomerId,
        };
      }
    }
  }
  return null;
}

/**
 * Check if an IP is within a CIDR range.
 * Supports both IPv4 and simple IPv4 CIDR notation.
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  try {
    // Handle plain IP (treat as /32)
    if (!cidr.includes("/")) {
      return ip === cidr;
    }

    const [rangeIp, prefixStr] = cidr.split("/");
    const prefix = parseInt(prefixStr, 10);

    const ipParts = ip.split(".").map(Number);
    const rangeParts = rangeIp.split(".").map(Number);

    if (ipParts.length !== 4 || rangeParts.length !== 4) return false;
    if (ipParts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;
    if (rangeParts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;
    if (prefix < 0 || prefix > 32) return false;

    const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
    const rangeNum = (rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3];

    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;

    return (ipNum & mask) === (rangeNum & mask);
  } catch {
    return false;
  }
}

/**
 * Check if a user's email domain matches a registered institution.
 * Used as a fallback when IP matching fails (e.g. remote access).
 */
export async function matchInstitutionByDomain(email: string): Promise<InstitutionMatch | null> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  const inst = await db.institution.findFirst({
    where: {
      status: "ACTIVE",
      domain: { contains: domain },
    },
  });
  if (!inst) return null;

  return {
    institutionId: inst.id,
    name: inst.name,
    plan: inst.plan,
    status: inst.status,
    apcQuotaAvailable: Math.max(0, inst.apcQuota - inst.apcUsed),
    counterCustomerId: inst.counterCustomerId,
  };
}

/** A random per-institution SUSHI API key, e.g. "sushi_3f9a...". */
export function generateCounterApiKey(): string {
  return `sushi_${randomBytes(24).toString("hex")}`;
}

/** Extracts the requester's IP from proxy headers, same logic ip-check/route.ts used inline. */
export function extractRequestIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || headers.get("x-real-ip") || "127.0.0.1";
}

/** IP match first, email-domain match as fallback — the same two-step lookup ip-check/route.ts performs. */
export async function resolveRequestInstitution(
  headers: Headers,
  email?: string | null
): Promise<InstitutionMatch | null> {
  const ip = extractRequestIp(headers);
  let match = await matchInstitutionByIp(ip);
  if (!match && email) {
    match = await matchInstitutionByDomain(email);
  }
  return match;
}

/**
 * Best-effort usage telemetry: resolves the requesting institution (if any)
 * and records a real CounterEvent row keyed by the institution's
 * counterCustomerId — the same value COUNTER5/SUSHI report routes filter
 * `customer_id` against — so those reports reflect genuine per-institution
 * access instead of being synthesized from Article.views/downloads.
 * Never throws: a telemetry failure must not break the request it's
 * attached to.
 */
export async function recordCounterEvent(params: {
  articleId: string;
  metricType: "Total_Item_Investigations" | "Total_Item_Requests";
  headers: Headers;
  email?: string | null;
}): Promise<void> {
  try {
    const institution = await resolveRequestInstitution(params.headers, params.email);
    await db.counterEvent.create({
      data: {
        articleId: params.articleId,
        institutionId: institution?.counterCustomerId ?? null,
        metricType: params.metricType,
      },
    });
  } catch {
    // best-effort — see docstring
  }
}

/**
 * Verifies a SUSHI customer_id + api_key pair for the COUNTER5 reporting
 * routes. True only when an ACTIVE institution with that counterCustomerId
 * exists, has a counterApiKey configured, and the supplied key matches
 * exactly — so one institution can never read another's usage report by
 * guessing its customer_id.
 */
export async function verifySushiApiKey(customerId: string, apiKey: string | null): Promise<boolean> {
  if (!apiKey) return false;
  const inst = await db.institution.findFirst({
    where: { counterCustomerId: customerId, status: "ACTIVE" },
  });
  if (!inst?.counterApiKey) return false;
  return safeStringEqual(inst.counterApiKey, apiKey);
}

/**
 * Consume one APC from an institution's transformative-agreement quota.
 * Called when an author from a transformative-agreement institution has
 * an article accepted — their APC is billed to the institution, not to them.
 */
export async function consumeApcQuota(institutionId: string): Promise<boolean> {
  const inst = await db.institution.findUnique({ where: { id: institutionId } });
  if (!inst) return false;
  if (inst.apcUsed >= inst.apcQuota) return false;

  await db.institution.update({
    where: { id: institutionId },
    data: { apcUsed: { increment: 1 } },
  });
  return true;
}
