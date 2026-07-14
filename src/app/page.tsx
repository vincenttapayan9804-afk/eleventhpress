"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HomeView } from "@/components/views/home-view";
import { BrowseView } from "@/components/views/browse-view";
import { ArticleView } from "@/components/views/article-view";
import { AboutView } from "@/components/views/about-view";
import { AuthView } from "@/components/views/auth-view";
import { DashboardView } from "@/components/views/dashboard-view";
import { ResourcesView } from "@/components/views/resources-view";
import { AuthorsView } from "@/components/views/authors-view";
import { FaqsView } from "@/components/views/faqs-view";
import { AdminPortalView } from "@/components/views/admin-portal-view";
import { AuthSheet } from "@/components/auth-sheet";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n-provider";

export default function Page() {
  const view = useApp((s) => s.view);
  const token = useApp((s) => s.token);
  const setAuth = useApp((s) => s.setAuth);
  const logout = useApp((s) => s.logout);
  const openDashboard = useApp((s) => s.openDashboard);

  // Rehydrate session on first mount
  useEffect(() => {
    if (!token) return;
    apiFetch<{ user: any }>("/api/auth/me")
      .then(({ user }) => setAuth(token, user))
      .catch(() => logout());
  }, []);

  // Handle ORCID OAuth callback: URL contains ?orcid_token=…
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orcidToken = params.get("orcid_token");
    const orcidId = params.get("orcid_id");
    const orcidSimulated = params.get("orcid_simulated");
    if (orcidToken) {
      apiFetch<{ user: any }>("/api/auth/me", {
        headers: { Authorization: `Bearer ${orcidToken}` },
      })
        .then(({ user }) => {
          setAuth(orcidToken, user);
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
        <SiteHeader />
        <main className="flex-1">
          {view === "home" && <HomeView />}
          {view === "browse" && <BrowseView />}
          {view === "article" && <ArticleView />}
          {view === "about" && <AboutView />}
          {(view === "login" || view === "register") && <AuthView />}
          {view === "dashboard" && <DashboardView />}
          {view === "resources" && <ResourcesView />}
          {view === "authors" && <AuthorsView />}
          {view === "faqs" && <FaqsView />}
          {view === "adminPortal" && <AdminPortalView />}
        </main>
        <SiteFooter />
        <AuthSheet />
        <Toaster richColors position="top-right" />
      </div>
    </I18nProvider>
  );
}
