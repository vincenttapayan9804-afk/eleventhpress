/** Server side of tenant-brand.ts: the ResourceBrand for a resolved tenant. */
import type { TenantContext } from "@/lib/tenant";
import { tenantBaseUrl } from "@/lib/tenant";
import { publisherIdentityForTenantId } from "@/lib/publisher-identity";
import { PLATFORM_RESOURCE_BRAND, type ResourceBrand } from "./tenant-brand";

export async function resourceBrandFor(tenant: TenantContext | null | undefined): Promise<ResourceBrand> {
  if (!tenant || tenant.isPlatform) return PLATFORM_RESOURCE_BRAND;
  const id = await publisherIdentityForTenantId(tenant.id).catch(() => null);
  if (!id || !id.whitelabel) return PLATFORM_RESOURCE_BRAND;
  const baseUrl = (await tenantBaseUrl(tenant.id)).replace(/\/+$/, "");
  const logo = id.logoUrl ? (/^https?:\/\//i.test(id.logoUrl) ? id.logoUrl : `${baseUrl}${id.logoUrl.startsWith("/") ? "" : "/"}${id.logoUrl}`) : `${baseUrl}/pwa-icon/512`;
  return {
    whitelabel: true,
    publisher: id.publisher,
    shortName: id.shortName,
    journalName: id.journalName,
    email: id.email,
    issn: id.issn,
    location: id.location,
    baseUrl,
    logoUrl: logo,
    primaryHex: id.primaryHex,
    accentHex: id.accentHex,
  };
}

/** True when the Resources blog (Eleventh Press's own editorial posts) is shown on this site. */
export function resourcesBlogVisible(tenant: TenantContext | null | undefined): boolean {
  return !tenant || tenant.isPlatform;
}
