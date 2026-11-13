import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CookiePolicyContent } from "@/components/legal/cookie-policy-content";
import { getCurrentTenant } from "@/lib/tenant";

/** The visiting site's name — a whitelabel tenant's own, never Eleventh Press's. */
async function siteName(): Promise<string> {
  const tenant = await getCurrentTenant().catch(() => null);
  return tenant && !tenant.isPlatform ? tenant.siteName || tenant.name : "Eleventh Press International Publishing";
}

export async function generateMetadata(): Promise<Metadata> {
  const name = await siteName();
  return {
    title: `Cookie Policy — ${name}`,
    description: `Every cookie and browser-storage item ${name} uses, why, for how long, and how to change your cookie preferences.`,
  };
}

/** GET /cookie-policy — public, linkable Cookie Policy. */
export default async function CookiePolicyPage() {
  const name = await siteName();
  return (
    <main id="main-content" className="min-h-dvh">
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> {name}
        </Link>
      </div>
      <CookiePolicyContent />
    </main>
  );
}
