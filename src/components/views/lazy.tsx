"use client";

/**
 * Lazy wrappers around the 11 top-level views rendered by src/app/page.tsx.
 * page.tsx is a single "use client" component that picks exactly one of
 * these based on client-side zustand state (view: ViewKey, never persisted
 * — see src/lib/store.ts's partialize — so it's always "home" on a fresh
 * load). Statically importing all 11 pulled every view's full dependency
 * graph into one bundle regardless of which view actually renders; routing
 * through next/dynamic here splits each into its own chunk, fetched only
 * when that view is selected. ssr stays at its default (true) so the
 * active view at request time still renders on the server exactly as
 * before — this only defers the OTHER 10 views' code off the initial
 * bundle, it doesn't change what gets server-rendered.
 */
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

function ViewLoadingFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export const HomeView = dynamic(() => import("./home-view").then((m) => m.HomeView), {
  loading: () => <ViewLoadingFallback />,
});
export const BrowseView = dynamic(() => import("./browse-view").then((m) => m.BrowseView), {
  loading: () => <ViewLoadingFallback />,
});
export const BooksView = dynamic(() => import("./books-view").then((m) => m.BooksView), {
  loading: () => <ViewLoadingFallback />,
});
export const ArticleView = dynamic(() => import("./article-view").then((m) => m.ArticleView), {
  loading: () => <ViewLoadingFallback />,
});
export const AboutView = dynamic(() => import("./about-view").then((m) => m.AboutView), {
  loading: () => <ViewLoadingFallback />,
});
export const AuthView = dynamic(() => import("./auth-view").then((m) => m.AuthView), {
  loading: () => <ViewLoadingFallback />,
});
export const DashboardView = dynamic(() => import("./dashboard-view").then((m) => m.DashboardView), {
  loading: () => <ViewLoadingFallback />,
});
export const ResourcesView = dynamic(() => import("./resources-view").then((m) => m.ResourcesView), {
  loading: () => <ViewLoadingFallback />,
});
export const CollectionsView = dynamic(() => import("./collections-view").then((m) => m.CollectionsView), {
  loading: () => <ViewLoadingFallback />,
});
export const AuthorsView = dynamic(() => import("./authors-view").then((m) => m.AuthorsView), {
  loading: () => <ViewLoadingFallback />,
});
export const ExpertsView = dynamic(() => import("./experts-view").then((m) => m.ExpertsView), {
  loading: () => <ViewLoadingFallback />,
});
export const CharterView = dynamic(() => import("./charter-view").then((m) => m.CharterView), {
  loading: () => <ViewLoadingFallback />,
});
export const FaqsView = dynamic(() => import("./faqs-view").then((m) => m.FaqsView), {
  loading: () => <ViewLoadingFallback />,
});
export const PoliciesView = dynamic(() => import("./policies-view").then((m) => m.PoliciesView), {
  loading: () => <ViewLoadingFallback />,
});
export const PrivacyView = dynamic(() => import("./privacy-view").then((m) => m.PrivacyView), {
  loading: () => <ViewLoadingFallback />,
});
export const AccessibilityView = dynamic(() => import("./accessibility-view").then((m) => m.AccessibilityView), {
  loading: () => <ViewLoadingFallback />,
});
export const TermsView = dynamic(() => import("./terms-view").then((m) => m.TermsView), {
  loading: () => <ViewLoadingFallback />,
});
export const AdminPortalView = dynamic(() => import("./admin-portal-view").then((m) => m.AdminPortalView), {
  loading: () => <ViewLoadingFallback />,
});
export const MagazinesView = dynamic(() => import("./magazines-view").then((m) => m.MagazinesView), {
  loading: () => <ViewLoadingFallback />,
});
export const MagazineIssueView = dynamic(() => import("./magazine-issue-view").then((m) => m.MagazineIssueView), {
  loading: () => <ViewLoadingFallback />,
});
export const PodcastsView = dynamic(() => import("./podcasts-view").then((m) => m.PodcastsView), {
  loading: () => <ViewLoadingFallback />,
});
export const MediaView = dynamic(() => import("./media-view").then((m) => m.MediaView), {
  loading: () => <ViewLoadingFallback />,
});
export const MediaPostView = dynamic(() => import("./media-post-view").then((m) => m.MediaPostView), {
  loading: () => <ViewLoadingFallback />,
});
