"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    openArticle(articleId);
    setMounted(true);
  }, [articleId, openArticle]);

  if (!mounted) return <>{children}</>;
  return <ArticleView />;
}
