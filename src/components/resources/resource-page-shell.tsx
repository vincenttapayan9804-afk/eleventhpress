"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { pathForState } from "@/lib/spa-routes";
import { I18nProvider } from "@/components/i18n-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";

/**
 * Chrome for the real, crawlable /resources/... pages (blog posts and
 * guides). The rest of the site is a single-page app that switches views in
 * zustand state under "/", so the site header's links only change `view`.
 * This shell marks the current view as Resources and, as soon as the reader
 * picks any destination from the header (including Resources itself),
 * navigates back to "/" where the SPA renders it. The zustand store survives client-side navigation, so
 * the chosen view is what appears.
 */
export function ResourcePageShell({ tab, children }: { tab: "blogs" | "guides"; children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    useApp.setState({ view: "resourcePage", resourcesTab: tab });
    const unsubscribe = useApp.subscribe((s, prev) => {
      if (s.view !== prev.view && s.view !== "resourcePage") router.push(pathForState(s) ?? "/");
    });
    return () => {
      unsubscribe();
      // Browser Back to "/" unmounts this page: land on the Resources view
      // rather than the placeholder view.
      if (useApp.getState().view === "resourcePage") useApp.setState({ view: "resources" });
    };
  }, [router, tab]);

  return (
    <I18nProvider>
      <div className="flex min-h-dvh flex-col bg-background">
        <SiteHeader />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <Toaster richColors position="top-right" />
      </div>
    </I18nProvider>
  );
}

/** "Back to Resources" — returns to the SPA on the tab this page belongs to. */
export function BackToResources({ tab, label }: { tab: "blogs" | "guides"; label: string }) {
  // Changing the view triggers ResourcePageShell's navigation back to "/".
  return (
    <button
      type="button"
      onClick={() => useApp.getState().openResources(tab)}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      <span aria-hidden>←</span> {label}
    </button>
  );
}
