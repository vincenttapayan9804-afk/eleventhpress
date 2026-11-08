"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pathForState } from "@/lib/spa-routes";
import { SpaUrlSync } from "@/components/spa-url-sync";
import { useApp } from "@/lib/store";
import { ArticleView } from "@/components/views/article-view";

/**
 * Bridges the real /article/[id] server route into the existing
 * client-driven SPA. Renders the server-rendered bibliographic snapshot
 * (children) until hydration, then hands off to the full interactive
 * ArticleView — same component the in-app "view an article" flow already
 * uses, so nothing about that experience changes for a real visitor.
 */
export function ArticleRouteBootstrap({ articleId, children }: { articleId: string; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const openArticle = useApp((s) => s.openArticle);
  const view = useApp((s) => s.view);
  const router = useRouter();

  useEffect(() => {
    openArticle(articleId);
    setMounted(true);
  }, [articleId, openArticle]);

  // This page only renders the article. Picking any other page from the
  // header (or a related article) opens that page's own URL, served by the
  // single-page site with the store's state intact.
  useEffect(() => {
    if (!mounted || view === "article") return;
    const s = useApp.getState();
    // SpaUrlSync has already pushed this URL; replace that entry with the real page.
    router.replace(pathForState(s) ?? "/");
  }, [mounted, view, router]);

  if (!mounted) return <>{children}</>;
  return (
    <>
      <ArticleView />
      <SpaUrlSync />
    </>
  );
}
