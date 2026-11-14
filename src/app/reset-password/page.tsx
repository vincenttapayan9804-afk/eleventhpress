import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { getCurrentTenant } from "@/lib/tenant";

/** The visiting site's name — a whitelabel tenant's own, never Eleventh Press's. */
async function siteName(): Promise<string> {
  const tenant = await getCurrentTenant().catch(() => null);
  return tenant && !tenant.isPlatform ? tenant.siteName || tenant.name : "Eleventh Press International Publishing™";
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Reset your password — ${await siteName()}`,
    robots: { index: false, follow: false },
    // The token is in the URL: never send it to another site as a referrer.
    referrer: "no-referrer",
  };
}

/** GET /reset-password?token=… — opened from the "Forgot password" email. */
export default async function ResetPasswordPage() {
  const name = await siteName();
  return (
    <main id="main-content" className="min-h-dvh bg-background">
      <div className="mx-auto max-w-md px-4 pt-6 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> {name}
        </Link>
      </div>
      <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
        <ResetPasswordForm />
      </div>
      <Toaster />
    </main>
  );
}
