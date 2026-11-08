"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { pathForState, sameRoute, stateForPath, VIEW_META, type RouteState } from "@/lib/spa-routes";

/** Fields of the store that make up the URL. */
function routeOf(s: ReturnType<typeof useApp.getState>): RouteState {
  return {
    view: s.view,
    articleId: s.articleId,
    magazineIssueId: s.magazineIssueId,
    mediaPostId: s.mediaPostId,
    departmentSlug: s.departmentSlug,
    dashboardTab: s.dashboardTab,
    reviewId: s.reviewId,
    resourcesTab: s.resourcesTab,
  };
}

/** Put a route described by a URL into the store. */
export function applyRoute(route: RouteState) {
  const patch: Record<string, unknown> = { view: route.view };
  for (const key of ["articleId", "magazineIssueId", "mediaPostId", "departmentSlug", "dashboardTab", "reviewId", "resourcesTab"] as const) {
    if (route[key] !== undefined) patch[key] = route[key];
  }
  useApp.setState(patch as any);
}

function currentLocationRoute(): RouteState | null {
  return stateForPath(window.location.pathname, window.location.search);
}

/**
 * Keeps the address bar and the single-page site's view in step:
 * - a view change pushes that view's URL (so Back returns to it),
 * - Back/Forward put the URL's view back on screen,
 * - the tab title names the page.
 */
export function SpaUrlSync() {
  useEffect(() => {
    // The site's own title, without a page prefix a direct visit to a
    // view's URL (src/app/[...slug]) put in front of it.
    const prefixes = [...Object.values(VIEW_META).map((m) => m!.title), "Dashboard"];
    const initialTitle = document.title;
    const prefix = prefixes.find((t) => initialTitle.startsWith(`${t} — `));
    const baseTitle = prefix ? initialTitle.slice(prefix.length + 3) : initialTitle;

    const setTitle = (s: RouteState) => {
      const meta = VIEW_META[s.view];
      if (s.view === "home") document.title = baseTitle;
      else if (meta && s.view !== "dashboard") document.title = `${meta.title} — ${baseTitle}`;
      else if (s.view === "dashboard") document.title = `Dashboard — ${baseTitle}`;
    };

    const unsubscribe = useApp.subscribe((s, prev) => {
      const next = routeOf(s);
      if (sameRoute(next, routeOf(prev))) return;
      const path = pathForState(next);
      if (!path) return;
      setTitle(next);
      const here = currentLocationRoute();
      if (here && sameRoute(here, next)) return;
      window.history.pushState(null, "", path);
    });

    const onPopState = () => {
      const route = currentLocationRoute();
      if (!route) return;
      if (!sameRoute(route, routeOf(useApp.getState()))) applyRoute(route);
      setTitle(route);
    };
    window.addEventListener("popstate", onPopState);

    setTitle(routeOf(useApp.getState()));
    return () => {
      unsubscribe();
      window.removeEventListener("popstate", onPopState);
    };
  }, []);
  return null;
}
