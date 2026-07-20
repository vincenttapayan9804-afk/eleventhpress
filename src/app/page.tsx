"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  HomeView,
  BrowseView,
  ArticleView,
  AboutView,
  AuthView,
  DashboardView,
  ResourcesView,
  DatasetsView,
  PreprintsView,
  CollectionsView,
  AuthorsView,
  ExpertsView,
  CharterView,
  FaqsView,
  PoliciesView,
  PrivacyView,
  AccessibilityView,
  AdminPortalView,
} from "@/components/views/lazy";
import { AuthSheet } from "@/components/auth-sheet";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n-provider";
import { CorpusChatWidget } from "@/components/corpus-chat-widget";

export default function Page() {
  const view = useApp((s) => s.view);
  const setAuth = useApp((s) => s.setAuth);
  const logout = useApp((s) => s.logout);
  const openDashboard = useApp((s) => s.openDashboard);

  // Rehydrate session on first mount. The session lives in an httpOnly
  // cookie the browser attaches automatically — this always just asks the
  // server "who am I" rather than gating on a client-readable token.
  useEffect(() => {
    apiFetch<{ user: any }>("/api/auth/me")
      .then(({ user }) => setAuth(user))
      .catch(() => logout());
  }, []);

  // Handle ORCID OAuth callback: the callback route sets the session
  // cookie itself and redirects with ?orcid_linked=1&orcid_id=… — no
  // session token in the URL (that would leak into browser history,
  // Referer headers, and server access logs).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("orcid_linked") === "1") {
      apiFetch<{ user: any }>("/api/auth/me")
        .then(({ user }) => {
          setAuth(user);
          openDashboard("overview");
          // Clean URL
          window.history.replaceState({}, "", "/");
        })
        .catch(() => {});
    }
  }, [setAuth, openDashboard]);

  // Handle Blogger OAuth connect callback: URL contains ?blogger_connected=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("blogger_connected") === "1") {
      openDashboard("distribution");
      window.history.replaceState({}, "", "/");
    }
  }, [openDashboard]);

  // Scroll to top on view change
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" as any });
  }, [view, useApp.getState().articleId]);

  return (
    <I18nProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main-content" className="flex-1">
          {view === "home" && <HomeView />}
          {view === "browse" && <BrowseView />}
          {view === "article" && <ArticleView />}
          {view === "about" && <AboutView />}
          {(view === "login" || view === "register") && <AuthView />}
          {view === "dashboard" && <DashboardView />}
          {view === "resources" && <ResourcesView />}
          {view === "datasets" && <DatasetsView />}
          {view === "preprints" && <PreprintsView />}
          {view === "collections" && <CollectionsView />}
          {view === "authors" && <AuthorsView />}
          {view === "experts" && <ExpertsView />}
          {view === "charter" && <CharterView />}
          {view === "faqs" && <FaqsView />}
          {view === "policies" && <PoliciesView />}
          {view === "privacy" && <PrivacyView />}
          {view === "accessibility" && <AccessibilityView />}
          {view === "adminPortal" && <AdminPortalView />}
        </main>
        <SiteFooter />
        <AuthSheet />
        {view !== "dashboard" && view !== "adminPortal" && view !== "login" && view !== "register" && (
          <CorpusChatWidget />
        )}
        <Toaster richColors position="top-right" />
      </div>
    </I18nProvider>
  );
}
