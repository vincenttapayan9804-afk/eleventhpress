"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { DISCIPLINES, parseAuthors } from "@/lib/article";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { KeywordCluster } from "@/components/three-d/scenes";
import { useReveal } from "@/hooks/use-scroll-reveal";
import {
  Search, SlidersHorizontal, FileX, ChevronLeft, ChevronRight,
  Quote, Eye, Download, Sparkles, X,
} from "lucide-react";

const DISCIPLINE_COLORS: Record<string, string> = Object.fromEntries(
  DISCIPLINES.map((d) => [d, "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]"])
);

export function BrowseView() {
  const { openArticle } = useApp();
  const t = useTranslations("browse");
  const SORTS = [
    { value: "newest", label: t("sortNewest") },
    { value: "cited", label: t("sortCited") },
    { value: "viewed", label: t("sortViewed") },
    { value: "title", label: t("sortTitle") },
  ];
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Cursor-based navigation (constant-time regardless of corpus size, unlike
  // OFFSET-based paging) — `page`/`totalPages` stay purely for the
  // "Page X of Y" label and button disabled-state, matching prior UX exactly;
  // the actual fetch is driven by these cursors, not the page number.
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorDir, setCursorDir] = useState<"next" | "prev">("next");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [discipline, setDiscipline] = useState("ALL");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [semanticMode, setSemanticMode] = useState(false);
  const [semanticScores, setSemanticScores] = useState<Record<string, { score: number; matchType: string }>>({});
  const [showKeywordCluster, setShowKeywordCluster] = useState(false);

  const headerReveal = useReveal();

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const qParam = params.get("q");
    const discParam = params.get("discipline");
    if (qParam) setQ(qParam);
    if (discParam && DISCIPLINES.includes(discParam as any)) setDiscipline(discParam);
    window.location.hash = "";
  }, []);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      if (semanticMode && q.trim()) {
        const res = await apiFetch<{ results: any[]; total: number }>(
          `/api/search/semantic?q=${encodeURIComponent(q.trim())}&limit=24`
        );
        setItems(res.results);
        setTotal(res.total);
        setTotalPages(1);
        const scores: Record<string, { score: number; matchType: string }> = {};
        for (const r of res.results) scores[r.id] = { score: r.score, matchType: r.matchType };
        setSemanticScores(scores);
        setNextCursor(null);
        setPrevCursor(null);
        return;
      }
      setSemanticScores({});
      const params = new URLSearchParams({ sort, page: String(page), pageSize: "12" });
      if (q.trim()) params.set("q", q.trim());
      if (discipline !== "ALL") params.set("discipline", discipline);
      if (cursor) {
        params.set("cursor", cursor);
        params.set("dir", cursorDir);
      }
      const res = await apiFetch<{ items: any[]; total: number; totalPages: number; nextCursor: string | null; prevCursor: string | null }>(`/api/articles?${params}`);
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setNextCursor(res.nextCursor);
      setPrevCursor(res.prevCursor);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [q, discipline, sort, page, semanticMode, cursor, cursorDir]);

  useEffect(() => {
    const t = setTimeout(fetchArticles, 250);
    return () => clearTimeout(t);
  }, [fetchArticles]);

  useEffect(() => { setPage(1); setCursor(null); }, [q, discipline, sort]);

  function goNext() {
    if (!nextCursor) return;
    setCursor(nextCursor);
    setCursorDir("next");
    setPage((p) => p + 1);
  }
  function goPrev() {
    if (page <= 1) return;
    if (page === 2) {
      // Back to page 1 — no cursor needed, avoids any boundary edge case.
      setCursor(null);
    } else if (prevCursor) {
      setCursor(prevCursor);
      setCursorDir("prev");
    }
    setPage((p) => Math.max(1, p - 1));
  }

  // Aggregate keywords from results for the 3D cluster
  const clusterKeywords = items.slice(0, 6).flatMap(a =>
    (a.keywords || "").split(",").map((k: string) => k.trim()).filter(Boolean)
  ).slice(0, 8);

  return (
    <div className="page-enter mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div ref={headerReveal.observe} className={`reveal ${headerReveal.inView ? "in-view" : ""} border-b border-[oklch(0.76_0.11_294/0.1)] pb-8`}>
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      {/* 3D-layered filter system */}
      <div className="sticky top-16 z-30 mt-6">
        <div className="glass-strong rounded-2xl p-4 shadow-[0_12px_40px_oklch(0.38_0.18_295/0.08)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={semanticMode ? t("semanticPlaceholder") : t("searchPlaceholder")}
                className="glass-panel h-11 pl-11 border-[oklch(0.76_0.11_294/0.2)]"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {semanticMode && q.trim() && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-[oklch(0.93_0.04_290)] px-1.5 py-0.5 text-[0.6rem] font-mono text-[oklch(0.42_0.18_295)]">AI</span>
              )}
            </div>
            <Button
              variant={semanticMode ? "default" : "outline"}
              size="sm"
              className="btn-royal-glow h-11"
              onClick={() => { setSemanticMode(!semanticMode); setPage(1); setCursor(null); }}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {semanticMode ? t("semantic") : t("lexical")}
            </Button>
            <Button
              variant={showKeywordCluster ? "default" : "outline"}
              size="sm"
              className="h-11"
              onClick={() => setShowKeywordCluster(!showKeywordCluster)}
            >
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
              {t("cluster3d")}
            </Button>
            <Select value={discipline} onValueChange={setDiscipline}>
              <SelectTrigger className="glass-panel h-11 w-[180px] border-[oklch(0.76_0.11_294/0.2)]">
                <SlidersHorizontal className="mr-2 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-strong">
                <SelectItem value="ALL">{t("allDisciplines")}</SelectItem>
                {DISCIPLINES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="glass-panel h-11 w-[160px] border-[oklch(0.76_0.11_294/0.2)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-strong">
                {SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{loading ? "Searching…" : t("articlesFound", { count: total })}</span>
            {(q || discipline !== "ALL" || semanticMode) && (
              <Button variant="ghost" size="sm" onClick={() => { setQ(""); setDiscipline("ALL"); setSemanticMode(false); }}>
                <X className="mr-1 h-3 w-3" /> Clear filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 3D Keyword Cluster panel */}
      {showKeywordCluster && (
        <div className="mt-6 glass-royal rounded-2xl p-6 animate-luxury-scale">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="eyebrow">3D Keyword Constellation</p>
              <p className="mt-1 text-sm text-muted-foreground">Visual mapping of research themes from current results. Each orb represents a keyword cluster.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowKeywordCluster(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-72 w-full">
            {clusterKeywords.length > 0 ? (
              <KeywordCluster keywords={clusterKeywords} className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Search for articles to see the keyword constellation.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-72 shimmer rounded-2xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center py-24 text-center">
          <FileX className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 font-display text-lg font-medium">{t("noArticlesFound")}</p>
          <p className="text-sm text-muted-foreground">{t("tryAdjusting")}</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((a, i) => {
            const authors = parseAuthors(a.authors);
            return (
              <div
                key={a.id}
                className="pearl-card flex cursor-pointer flex-col p-6 transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_24px_64px_oklch(0.38_0.18_295/0.12)]"
                style={{ transitionTimingFunction: "var(--ease-luxury)", animationDelay: `${i * 60}ms` }}
                onClick={() => openArticle(a.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="outline" className={`border ${DISCIPLINE_COLORS[a.discipline] || DISCIPLINE_COLORS["Physics"]}`}>{a.discipline}</Badge>
                  {semanticScores[a.id] ? (
                    <Badge variant="outline" className="border-[oklch(0.76_0.11_294/0.3)] bg-[oklch(0.93_0.04_290/0.5)] text-[0.6rem] font-mono text-[oklch(0.42_0.18_295)]">
                      <Sparkles className="mr-1 h-2.5 w-2.5" />
                      {(semanticScores[a.id].score * 100).toFixed(0)}% · {semanticScores[a.id].matchType}
                    </Badge>
                  ) : (
                    <span className="font-mono text-[0.6rem] text-muted-foreground">{a.doi}</span>
                  )}
                </div>
                <h3 className="mt-3 line-clamp-3 font-display text-base font-semibold leading-snug">{a.title}</h3>
                <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">{authors.map((au: any) => au.name).join(", ")}</p>
                <p className="mt-3 line-clamp-4 flex-1 text-xs leading-relaxed text-muted-foreground">{a.abstract}</p>
                <div className="mt-4 flex items-center justify-between border-t border-[oklch(0.76_0.11_294/0.1)] pt-3 text-[0.7rem] text-muted-foreground">
                  <span>Vol. {a.volume}, Iss. {a.issueNumber} ({a.year})</span>
                  <span className="flex items-center gap-3 font-mono">
                    <span className="flex items-center gap-1"><Quote className="h-3 w-3" /> {a.citations}</span>
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {a.views}</span>
                    <span className="flex items-center gap-1"><Download className="h-3 w-3" /> {a.downloads}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={goPrev} className="glass">
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="px-4 text-sm text-muted-foreground">Page <strong className="text-foreground">{page}</strong> of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={goNext} className="glass">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
