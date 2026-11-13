"use client";

import { createContext, useContext } from "react";
import type { TenantBranding, TenantSource } from "@/lib/tenant";

/**
 * Branding plus which tenant ("workspace") this page belongs to. Populated
 * server-side (src/app/layout.tsx resolves the tenant once via
 * getCurrentTenant() and passes it down as props — no client fetch needed,
 * no layout shift). Every branding field is nullable: null means "no
 * override, use the built-in Eleventh Press default" at the call site.
 */
export interface ClientBranding extends TenantBranding {
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  isPlatform: boolean;
  source: TenantSource;
}

export const DEFAULT_CLIENT_BRANDING: ClientBranding = {
  siteName: null,
  tagline: null,
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  accentColor: null,
  fontFamily: null,
  officialEmail: null,
  supportEmail: null,
  phone: null,
  phoneAlt: null,
  websiteUrl: null,
  address: null,
  socialLinks: null,
  tenantId: null,
  tenantSlug: null,
  tenantName: null,
  isPlatform: true,
  source: "platform",
};

const TenantBrandingContext = createContext<ClientBranding | null>(null);

export function TenantBrandingProvider({
  branding,
  children,
}: {
  branding: ClientBranding;
  children: React.ReactNode;
}) {
  return <TenantBrandingContext.Provider value={branding}>{children}</TenantBrandingContext.Provider>;
}

/** Always returns a branding object (falls back to the platform defaults) — never throws outside a provider. */
export function useTenantBranding(): ClientBranding {
  return useContext(TenantBrandingContext) ?? DEFAULT_CLIENT_BRANDING;
}

/** True when the page is a whitelabel tenant's platform rather than the official Eleventh Press site. */
export function isWhitelabel(b: ClientBranding): boolean {
  return !b.isPlatform && !!b.tenantId;
}

/** The platform's own editorial inbox. */
export const PLATFORM_CONTACT_EMAIL = "editorial@eleventhpress.org";

/**
 * Where "email us" links on this site should go: a whitelabel tenant's own
 * official/support email when it has one, otherwise the platform's editorial
 * office (the operator of the platform the tenant runs on).
 */
export function contactEmailOf(b: ClientBranding): string {
  if (isWhitelabel(b)) return b.officialEmail || b.supportEmail || PLATFORM_CONTACT_EMAIL;
  return PLATFORM_CONTACT_EMAIL;
}

export function useContactEmail(): string {
  return contactEmailOf(useTenantBranding());
}
