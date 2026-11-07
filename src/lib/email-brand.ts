/**
 * Whitelabel branding for outgoing email: a tenant member's emails carry
 * their institution's name, logo, colour and contact details instead of
 * Eleventh Press's. Platform users get `undefined` (the default template).
 */
import { db } from "./db";
import { brandingOf } from "./tenant";
import type { EmailBrand } from "./email";

type TenantForBrand = Parameters<typeof brandingOf>[0] & { name: string; isPlatform: boolean };

export function emailBrandOf(tenant: TenantForBrand | null | undefined): EmailBrand | undefined {
  if (!tenant || tenant.isPlatform) return undefined;
  const b = brandingOf(tenant);
  return {
    name: b.siteName || tenant.name,
    logoUrl: b.logoUrl && /^https?:\/\//i.test(b.logoUrl) ? b.logoUrl : null,
    primaryColor: b.primaryColor,
    contactLines: [
      [b.officialEmail || b.supportEmail, b.phone].filter(Boolean).join(" · "),
      b.websiteUrl ? b.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") : "",
      b.address ?? "",
    ].filter(Boolean),
  };
}

export async function emailBrandForTenantId(tenantId: string | null | undefined): Promise<EmailBrand | undefined> {
  if (!tenantId) return undefined;
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } }).catch(() => null);
  return emailBrandOf(tenant);
}

/** Display name for copy inside an email ("your <name> account"). */
export function brandName(brand: EmailBrand | undefined): string {
  return brand?.name ?? "Eleventh Press";
}
