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
 * Chrome for the server-rendered /authors/<slug> profile pages: marks the
 * Authors section active and, when the reader picks another page from the
 * header (or an article on the profile), opens that page's own URL.
 */
export function AuthorProfileShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    useApp.setState({ view: "authorProfile" });
    const unsubscribe = useApp.subscribe((s, prev) => {
      const moved = s.view !== prev.view || (s.view === "article" && s.articleId !== prev.articleId);
      if (moved && s.view !== "authorProfile") router.push(pathForState(s) ?? "/");
    });
    return () => {
      unsubscribe();
      if (useApp.getState().view === "authorProfile") useApp.setState({ view: "authors" });
    };
  }, [router]);

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
