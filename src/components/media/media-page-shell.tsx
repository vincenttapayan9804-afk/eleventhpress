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
 * Chrome for the server-rendered /media/<slug> story pages, mirroring
 * ResourcePageShell: the header marks Media as current, and picking any
 * destination from the header navigates to that view's URL, where the
 * single-page app renders it.
 */
export function MediaPageShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    useApp.setState({ view: "mediaPost", mediaPostId: slug });
    const unsubscribe = useApp.subscribe((s, prev) => {
      if (s.view !== prev.view || s.mediaPostId !== prev.mediaPostId) router.push(pathForState(s) ?? "/");
    });
    return () => {
      unsubscribe();
      const s = useApp.getState();
      if (s.view === "mediaPost" && s.mediaPostId === slug) useApp.setState({ view: "media" });
    };
  }, [router, slug]);

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

/** "Back to Media" — opens the Media list in the single-page app. */
export function BackToMedia({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => useApp.getState().setView("media")}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      <span aria-hidden>←</span> {label}
    </button>
  );
}
