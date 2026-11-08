"use client";

import { useEffect, useState } from "react";
import { SpaUrlSync, applyRoute } from "@/components/spa-url-sync";
import type { RouteState } from "@/lib/spa-routes";
import { SessionSync } from "@/components/session-sync";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  HomeView,
  BrowseView,
  BooksView,
  ArticleView,
  AboutView,
  AuthView,
  DashboardView,
  ResourcesView,
  CollectionsView,
  AuthorsView,
  ExpertsView,
  CharterView,
  FaqsView,
  PoliciesView,
  PrivacyView,
  TermsView,
  AccessibilityView,
  AdminPortalView,
  MagazinesView,
  MagazineIssueView,
  PodcastsView,
  MediaView,
  MediaPostView,
  DepartmentsView,
  DepartmentView,
  PricingView,
} from "@/components/views/lazy";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { I18nProvider } from "@/components/i18n-provider";

// Floating "Ask the Corpus" launcher — off the critical path everywhere it's
// mounted (every view except dashboard/adminPortal/login/register); its own
// heavy chat panel additionally defers behind next/dynamic(ssr:false) until
// the visitor clicks it (see corpus-chat-widget.tsx).
const CorpusChatWidget = dynamic(() => import("@/components/corpus-chat-widget").then((m) => m.CorpusChatWidget), {
  ssr: false,
});

// Views that need nothing but their own name to render, so the server can
// render them for a direct visit to their URL (real content for crawlers).
// Views with a parameter (an article, an issue, a dashboard tab) wait for
// the client to apply the route from the URL first.
const SSR_SAFE_VIEWS = new Set([
  "home", "browse", "books", "about", "login", "register", "collections", "authors", "experts",
  "charter", "faqs", "policies", "privacy", "terms", "accessibility", "magazines", "podcasts",
  "media", "departments", "resources", "pricing",
]);

/**
 * The single-page public site. Rendered by "/" and by src/app/[...slug]
 * for every other view's URL (see src/lib/spa-routes.ts); `initialRoute`
 * is the state that URL describes.
 */
export function SpaShell({ initialRoute }: { initialRoute?: RouteState }) {
  const storeView = useApp((s) => s.view);
  const [routeApplied, setRouteApplied] = useState(!initialRoute);
  useEffect(() => {
    if (initialRoute) {
      applyRoute(initialRoute);
      // One extra render after mount, by design: the server can't know the store's state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRouteApplied(true);
    }
    // Only the route the page was loaded with; later changes come from the store.
  }, []);
  const view = routeApplied ? storeView : initialRoute!.view;
  const renderView = routeApplied || SSR_SAFE_VIEWS.has(view);
  const setAuth = useApp((s) => s.setAuth);
  const logout = useApp((s) => s.logout);
  const openDashboard = useApp((s) => s.openDashboard);
  const prefersReducedMotion = useReducedMotion();

  // Rehydrate session on first mount. The session lives in an httpOnly
  // cookie the browser attaches automatically — this always just asks the
  // server "who am I" rather than gating on a client-readable token.
  useEffect(() => {
    apiFetch<{ user: any }>("/api/auth/me")
      .then(({ user }) => setAuth(user))
      // Only an actual stale session needs clearing. For an anonymous
      // visitor, logout() would also reset the view to "home" and so
      // override the view chosen on a server-rendered page (e.g. "Back to
      // Resources" from /resources/blog/...) before the SPA rendered it.
      .catch(() => {
        if (useApp.getState().user) logout();
      });
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
          window.history.replaceState({}, "", window.location.pathname);
        })
        .catch(() => {});
    }
  }, [setAuth, openDashboard]);

  // Handle Blogger OAuth connect callback: URL contains ?blogger_connected=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("blogger_connected") === "1") {
      openDashboard("distribution");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [openDashboard]);

  // Handle the email-verification link's redirect: GET /api/auth/verify-email
  // sets the session cookie's underlying row and redirects here with
  // ?email_verified=1 (or ?error=invalid_verification_token on a bad/
  // already-used link) — no token in this URL, it was already redeemed
  // server-side before the redirect happened.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("email_verified") === "1") {
      toast.success("Email verified");
      apiFetch<{ user: any }>("/api/auth/me").then(({ user }) => setAuth(user)).catch(() => {});
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("error") === "invalid_verification_token") {
      toast.error("That verification link is invalid or already used.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [setAuth]);

  // Links into the sign-in screen: "?view=login" (password-changed email,
  // reset page), "?view=login&forgot=1" (request a new reset link) and
  // "?view=register" (referral links). AuthView reads `forgot` itself.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("view");
    if (target === "dashboard") {
      // Arrived from signing in to a tenant platform (workspace-client.ts):
      // open the dashboard once the session has been re-read.
      window.history.replaceState({}, "", window.location.pathname);
      apiFetch<{ user: any }>("/api/auth/me")
        .then(({ user }) => {
          setAuth(user);
          openDashboard("overview");
        })
        .catch(() => useApp.getState().setView("login"));
      return;
    }
    if (target !== "login" && target !== "register") return;
    window.history.replaceState({}, "", `/${target}${window.location.search}`);
    useApp.getState().setView(target);
    if (params.get("password_reset") === "1") toast.success("Password changed. Sign in with your new password.");
    params.delete("view");
    params.delete("password_reset");
    const rest = params.toString();
    window.history.replaceState({}, "", rest ? `${window.location.pathname}?${rest}` : window.location.pathname);
  }, []);

  // Scroll to top on view change
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" as any });
  }, [view, useApp.getState().articleId]);

  return (
    <I18nProvider>
      <div className="min-h-dvh flex flex-col bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main-content" className="flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={renderView ? view : "pending"}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -14 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: "easeOut" }}
            >
              {!renderView && <div className="min-h-[50vh]" aria-busy="true" />}
              {renderView && view === "home" && <HomeView />}
              {renderView && view === "browse" && <BrowseView />}
              {renderView && view === "books" && <BooksView />}
              {renderView && view === "article" && <ArticleView />}
              {renderView && view === "about" && <AboutView />}
              {renderView && (view === "login" || view === "register") && <AuthView />}
              {renderView && view === "dashboard" && <DashboardView />}
              {renderView && view === "resources" && <ResourcesView />}
              {renderView && view === "collections" && <CollectionsView />}
              {renderView && view === "authors" && <AuthorsView />}
              {renderView && view === "experts" && <ExpertsView />}
              {renderView && view === "charter" && <CharterView />}
              {renderView && view === "faqs" && <FaqsView />}
              {renderView && view === "policies" && <PoliciesView />}
              {renderView && view === "privacy" && <PrivacyView />}
              {renderView && view === "terms" && <TermsView />}
              {renderView && view === "accessibility" && <AccessibilityView />}
              {renderView && view === "adminPortal" && <AdminPortalView />}
              {renderView && view === "magazines" && <MagazinesView />}
              {renderView && view === "magazineIssue" && <MagazineIssueView />}
              {renderView && view === "podcasts" && <PodcastsView />}
              {renderView && view === "media" && <MediaView />}
              {renderView && view === "mediaPost" && <MediaPostView />}
              {renderView && view === "departments" && <DepartmentsView />}
              {renderView && view === "department" && <DepartmentView />}
              {renderView && view === "pricing" && <PricingView />}
            </motion.div>
          </AnimatePresence>
        </main>
        <SiteFooter />
        {view !== "dashboard" && view !== "adminPortal" && view !== "login" && view !== "register" && (
          <CorpusChatWidget />
        )}
        <Toaster richColors position="top-right" />
        <SessionSync />
        <SpaUrlSync />
      </div>
    </I18nProvider>
  );
}
