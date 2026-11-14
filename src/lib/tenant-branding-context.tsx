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
  legalName: null,
  legalJurisdiction: null,
  privacyEmail: null,
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

/**
 * Who operates this site, for the legal pages (Terms, Privacy, Cookie
 * Policy, FAQs, cookie banner). On a whitelabel tenant's site that is the
 * tenant itself — its own name, legal entity, governing law and contacts —
 * with Eleventh Press named only as the technology provider. On the
 * official site it is Eleventh Press.
 */
export interface LegalIdentity {
  whitelabel: boolean;
  /** Display name used in running text ("Ron Publishing"). */
  orgName: string;
  /** Registered legal entity named as the contracting party / data controller. */
  legalName: string;
  /** Governing-law clause body, e.g. "the laws of England and Wales". */
  governingLaw: string;
  /** Where the operator is based, when known. */
  location: string | null;
  contactEmail: string;
  privacyEmail: string;
}

export const PLATFORM_LEGAL_NAME = "Eleventh Press International Publishing™";

export function legalIdentityOf(b: ClientBranding): LegalIdentity {
  if (!isWhitelabel(b)) {
    return {
      whitelabel: false,
      orgName: "Eleventh Press",
      legalName: PLATFORM_LEGAL_NAME,
      governingLaw: "the laws of England and Wales",
      location: "London, United Kingdom",
      contactEmail: PLATFORM_CONTACT_EMAIL,
      privacyEmail: PLATFORM_CONTACT_EMAIL,
    };
  }
  const orgName = b.siteName || b.tenantName || "This journal";
  const contactEmail = contactEmailOf(b);
  return {
    whitelabel: true,
    orgName,
    legalName: b.legalName || orgName,
    governingLaw: b.legalJurisdiction
      ? `the laws of ${b.legalJurisdiction.replace(/^the laws of /i, "")}`
      : `the laws of the place where ${b.legalName || orgName} is established`,
    location: b.address,
    contactEmail,
    privacyEmail: b.privacyEmail || contactEmail,
  };
}

export function useLegalIdentity(): LegalIdentity {
  return legalIdentityOf(useTenantBranding());
}
