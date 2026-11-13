/**
 * URL <-> view mapping for the single-page site.
 *
 * The public site renders every view from one client component (see
 * src/components/spa-shell.tsx), switching on zustand state. This module
 * gives each of those views a real path so the address bar, Back/Forward,
 * refresh, bookmarks and shared links all work: SpaUrlSync pushes the path
 * for the current state, and on load or popstate it reads the path back
 * into state. src/app/[...slug]/page.tsx serves the shell (with per-page
 * metadata) for every path listed here and 404s anything else.
 *
 * Pure and dependency-free so it runs on the server (metadata, 404s) and
 * in the browser alike.
 */

import type { DashboardTab, ViewKey } from "./store";

export const DASHBOARD_TABS: DashboardTab[] = [
  "overview", "secondBrain", "library", "authorAnalytics", "expertDashboard", "profile", "submit", "myArticles", "invoices",
  "editorQueue", "reviewerQueue", "reviewerForm", "indexing", "counter", "institutions", "reader",
  "application", "distribution", "myBooks", "bookAcquisitions", "magazines", "podcasts", "media",
  "certificates", "researchLab", "researchLabActivity", "benchmarking", "boardIntelligence",
  "reputationIntelligence", "reviewerMarketplace", "researchBoard", "narration", "researchIntegrity",
  "admin", "branding", "team", "tenants", "departments", "ethics", "ethicsReview", "grants",
  "myGrants", "rankings", "researchDashboard",
];

export const RESOURCE_TABS = ["trainings", "webinars", "blogs", "guides", "books", "discover"];

/** The slice of app state a URL describes. */
export interface RouteState {
  view: ViewKey;
  articleId?: string | null;
  magazineIssueId?: string | null;
  mediaPostId?: string | null;
  departmentSlug?: string | null;
  dashboardTab?: DashboardTab;
  reviewId?: string | null;
  resourcesTab?: string;
}

/** Views that are a fixed path with no parameter. */
const STATIC_PATHS: Partial<Record<ViewKey, string>> = {
  home: "/",
  browse: "/articles",
  books: "/books",
  about: "/about",
  login: "/login",
  register: "/register",
  collections: "/collections",
  authors: "/authors",
  experts: "/experts",
  charter: "/charter",
  faqs: "/faqs",
  policies: "/policies",
  privacy: "/privacy",
  terms: "/terms",
  accessibility: "/accessibility",
  adminPortal: "/admin",
  magazines: "/magazines",
  podcasts: "/podcasts",
  media: "/media",
  departments: "/departments",
  pricing: "/pricing",
};

const PATH_TO_VIEW: Record<string, ViewKey> = Object.fromEntries(
  Object.entries(STATIC_PATHS).map(([view, path]) => [path, view as ViewKey])
);

export function kebab(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

const TAB_BY_KEBAB: Record<string, DashboardTab> = Object.fromEntries(
  DASHBOARD_TABS.map((t) => [kebab(t), t])
);

/** "Climate adaptation in Asia" -> "climate-adaptation-in-asia" (max ~80 chars). */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/**
 * Readable article path: /article/<title-slug>--<id>. The double hyphen
 * separates the slug from the id so ids containing single hyphens still
 * parse. Plain /article/<id> links (DOIs, feeds, provenance records) keep
 * working and redirect here.
 */
export function articlePath(id: string, title?: string | null): string {
  const slug = title ? slugify(title) : "";
  return slug ? `/article/${slug}--${encodeURIComponent(id)}` : `/article/${encodeURIComponent(id)}`;
}

/** The article id inside an /article/<segment> path segment. */
export function articleIdFromSegment(segment: string): string {
  const decoded = safeDecode(segment);
  const i = decoded.lastIndexOf("--");
  return i >= 0 ? decoded.slice(i + 2) : decoded;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Path (with query, if any) for a state. Null for views with no URL. */
export function pathForState(s: RouteState): string | null {
  switch (s.view) {
    case "article":
      return s.articleId ? articlePath(s.articleId) : "/articles";
    case "magazineIssue":
      return s.magazineIssueId ? `/magazines/${encodeURIComponent(s.magazineIssueId)}` : "/magazines";
    case "mediaPost":
      return s.mediaPostId ? `/media/${encodeURIComponent(s.mediaPostId)}` : "/media";
    case "department":
      return s.departmentSlug ? `/departments/${encodeURIComponent(s.departmentSlug)}` : "/departments";
    case "resources":
      return s.resourcesTab && s.resourcesTab !== "trainings"
        ? `/resources?tab=${encodeURIComponent(s.resourcesTab)}`
        : "/resources";
    case "dashboard": {
      const tab = s.dashboardTab ?? "overview";
      if (tab === "reviewerForm") {
        return s.reviewId ? `/dashboard/reviewer-form/${encodeURIComponent(s.reviewId)}` : "/dashboard/reviewer-queue";
      }
      return tab === "overview" ? "/dashboard" : `/dashboard/${kebab(tab)}`;
    }
    case "resourcePage":
    case "authorProfile":
      return null;
    default:
      return STATIC_PATHS[s.view] ?? null;
  }
}

/**
 * State for a pathname (+ optional search string). Null when the path is
 * not a page of the single-page site, which the catch-all route turns
 * into a 404.
 */
export function stateForPath(pathname: string, search = ""): RouteState | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const fixed = PATH_TO_VIEW[clean];
  if (fixed) return { view: fixed };

  const parts = clean.split("/").filter(Boolean);
  const [head, a, b] = parts;
  if (head === "resources" && parts.length === 1) {
    const tab = new URLSearchParams(search).get("tab");
    return { view: "resources", resourcesTab: tab && RESOURCE_TABS.includes(tab) ? tab : "trainings" };
  }
  if (head === "article" && parts.length === 2) return { view: "article", articleId: articleIdFromSegment(a) };
  if (head === "magazines" && parts.length === 2) return { view: "magazineIssue", magazineIssueId: safeDecode(a) };
  if (head === "media" && parts.length === 2) return { view: "mediaPost", mediaPostId: safeDecode(a) };
  if (head === "departments" && parts.length === 2) return { view: "department", departmentSlug: safeDecode(a) };
  if (head === "dashboard") {
    if (parts.length === 1) return { view: "dashboard", dashboardTab: "overview" };
    if (a === "reviewer-form" && parts.length === 3) {
      return { view: "dashboard", dashboardTab: "reviewerForm", reviewId: safeDecode(b) };
    }
    const tab = TAB_BY_KEBAB[a];
    if (tab && tab !== "reviewerForm" && parts.length === 2) return { view: "dashboard", dashboardTab: tab };
  }
  return null;
}

/** Whether two states describe the same page (so no history entry is needed). */
export function sameRoute(a: RouteState, b: RouteState): boolean {
  return pathForState(a) === pathForState(b);
}

/** Title and description for server-rendered metadata of a static view. */
export const VIEW_META: Partial<Record<ViewKey, { title: string; description: string; index?: boolean }>> = {
  browse: { title: "Articles", description: "Browse peer-reviewed, open-access articles by discipline, year and topic." },
  books: { title: "Books", description: "Scholarly books and monographs published by {site}." },
  about: { title: "About", description: "Who we are, our editorial standards and our mission." },
  collections: { title: "Collections", description: "Curated collections of research across disciplines." },
  authors: { title: "Authors", description: "Researchers who publish with {site}." },
  experts: { title: "Experts' Insights", description: "Thought leadership from vetted industry experts." },
  charter: { title: "Publication Charter", description: "The standards every publication on this platform meets." },
  faqs: { title: "FAQs", description: "Answers to common questions about submitting, reviewing and reading." },
  policies: { title: "Policies", description: "Editorial, ethics and publishing policies." },
  privacy: { title: "Privacy Policy", description: "How we collect, use and protect personal data." },
  terms: { title: "Terms of Use", description: "The terms that govern use of this platform." },
  accessibility: { title: "Accessibility", description: "Our accessibility commitment and conformance." },
  magazines: { title: "Magazines", description: "Magazine issues from {site}." },
  podcasts: { title: "Podcasts", description: "Research conversations and episodes." },
  media: { title: "Media", description: "News, video and media from {site}." },
  departments: { title: "Departments", description: "Academic departments on the platform." },
  pricing: { title: "Pricing", description: "Reader plans, author fees and how billing works — every article is free to read." },
  resources: { title: "Resources", description: "Trainings, webinars, blogs, guides and books for researchers." },
  login: { title: "Sign in", description: "Sign in to your account.", index: false },
  register: { title: "Create an account", description: "Join as an author, reviewer or reader.", index: false },
  dashboard: { title: "Dashboard", description: "Your workspace.", index: false },
  adminPortal: { title: "Admin", description: "Administration.", index: false },
};

/** A view's description in the visiting site's own name ("{site}" → "Eleventh Press" or the tenant). */
export function viewDescription(description: string, siteName: string | null | undefined): string {
  return description.replace(/\{site\}/g, siteName || "Eleventh Press");
}

/** Static view paths worth listing in the sitemap. */
export const SITEMAP_PATHS: string[] = Object.entries(STATIC_PATHS)
  .filter(([view]) => VIEW_META[view as ViewKey]?.index !== false && view !== "home")
  .map(([, path]) => path)
  .concat("/resources");
