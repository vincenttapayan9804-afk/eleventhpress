import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CookiePolicyContent } from "@/components/legal/cookie-policy-content";

export const metadata: Metadata = {
  title: "Cookie Policy — Eleventh Press International Publishing",
  description:
    "Every cookie and browser-storage item Eleventh Press uses, why, for how long, and how to change your cookie preferences.",
};

/** GET /cookie-policy — public, linkable Cookie Policy. */
export default function CookiePolicyPage() {
  return (
    <main id="main-content" className="min-h-dvh">
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Eleventh Press International Publishing
        </Link>
      </div>
      <CookiePolicyContent />
    </main>
  );
}
