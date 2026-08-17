"use client";

import { createContext, useContext } from "react";
import type { TenantBranding } from "@/lib/tenant";

/**
 * Populated server-side (src/app/layout.tsx resolves the tenant once via
 * getCurrentTenant() and passes its branding down as props — no client
 * fetch needed, no layout-shift). Every field is nullable: null means "no
 * override, use the built-in Eleventh Press default" everywhere a consumer
 * reads it, so this stays a pure additive layer over the existing
 * translations/hardcoded copy rather than a required replacement for them.
 */
const TenantBrandingContext = createContext<TenantBranding | null>(null);

export function TenantBrandingProvider({
  branding,
  children,
}: {
  branding: TenantBranding;
  children: React.ReactNode;
}) {
  return <TenantBrandingContext.Provider value={branding}>{children}</TenantBrandingContext.Provider>;
}

/** Always returns a branding object (falls back to all-null) — never throws outside a provider, since every field is designed to be optional at the call site. */
export function useTenantBranding(): TenantBranding {
  return (
    useContext(TenantBrandingContext) ?? {
      siteName: null,
      tagline: null,
      logoUrl: null,
      faviconUrl: null,
      primaryColor: null,
      accentColor: null,
      fontFamily: null,
    }
  );
}
