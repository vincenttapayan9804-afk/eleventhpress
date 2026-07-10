/**
 * Institutional IP-Range Authentication Service.
 *
 * Checks a requesting IP address against all registered institutions'
 * IP ranges (CIDR notation). If the IP matches, the requester is
 * granted institutional access — full PDF downloads, COUNTER reports
 * sliced by institution, and (for transformative agreements) APC waivers.
 *
 * In production, this runs at the API Gateway layer. Here it's exposed
 * as a library function called from the storage download endpoint and
 * the article detail route.
 */
import { db } from "@/lib/db";

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
