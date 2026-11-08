"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { DISCIPLINES, parseAuthors } from "@/lib/article";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DisciplineAnalyticsPanel } from "@/components/three-d/discipline-analytics-panel";
import type { DisciplineStat } from "@/components/three-d/discipline-analytics-shared";
import { useReveal } from "@/hooks/use-scroll-reveal";
import {
  Search,
  SlidersHorizontal,
  FileX,
  ChevronLeft,
  ChevronRight,
  Quote,
  Eye,
  Download,
  X,
  BarChart3,
  CalendarDays,
  CalendarRange,
  ArrowUpDown,
  ScanSearch,
} from "lucide-react";

const DISCIPLINE_COLORS: Record<string, string> = Object.fromEntries(
  DISCIPLINES.map((d) => [d, "bg-[var(--royal-100)] text-primary border-[var(--royal-300)]/30"])
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
  const [year, setYear] = useState("ALL");
  const [month, setMonth] = useState("ALL");
  const [publicationYears, setPublicationYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [semanticMode, setSemanticMode] = useState(false);
  const [semanticScores, setSemanticScores] = useState<Record<string, { score: number; matchType: string }>>({});
  const [show3dAnalytics, setShow3dAnalytics] = useState(false);
  const [disciplineStats, setDisciplineStats] = useState<DisciplineStat[] | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const headerReveal = useReveal();
  const locale = useLocale();
  const monthNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(Date.UTC(2000, i, 1))));
  }, [locale]);

  // Years that actually have published work, for the Year filter.
  useEffect(() => {
    apiFetch<{ publicationYears?: number[] }>("/api/articles?facets=1&pageSize=1")
      .then((res) => setPublicationYears(res.publicationYears ?? []))
      .catch(() => setPublicationYears([]));
  }, []);

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
      if (year !== "ALL") params.set("year", year);
      if (month !== "ALL") params.set("month", month);
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
  }, [q, discipline, sort, year, month, page, semanticMode, cursor, cursorDir]);

  useEffect(() => {
    const t = setTimeout(fetchArticles, 250);
    return () => clearTimeout(t);
  }, [fetchArticles]);

  useEffect(() => { setPage(1); setCursor(null); }, [q, discipline, sort, year, month]);

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

  // Discipline-wide analytics — a journal-wide aggregate, not scoped to the
  // current search/filter, so it's fetched once on first open rather than
  // refetched on every keystroke or filter change.
  useEffect(() => {
    if (!show3dAnalytics || disciplineStats !== null) return;
    setStatsLoading(true);
    apiFetch<{ disciplines: DisciplineStat[] }>("/api/articles/discipline-stats")
      .then((res) => setDisciplineStats(res.disciplines))
      .catch((e) => { console.error(e); setDisciplineStats([]); })
      .finally(() => setStatsLoading(false));
  }, [show3dAnalytics, disciplineStats]);

  return (
    <div className="page-enter mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div ref={headerReveal.observe} className={`reveal ${headerReveal.inView ? "in-view" : ""} border-b border-[var(--royal-300)]/10 pb-8`}>
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      {/* 3D-layered filter system — sticky only on wide screens, where it
          doesn't eat half of a phone's viewport while scrolling results. */}
      <div className="z-30 mt-6 lg:sticky lg:top-16">
        <div className="glass-strong rounded-2xl p-3 shadow-[0_12px_40px_oklch(0.38_0.18_295/0.08)] sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={semanticMode ? t("semanticPlaceholder") : t("searchPlaceholder")}
                className="glass-panel h-11 pl-11 pr-10 border-[var(--royal-300)]/20"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search articles"
              />
              {semanticMode && q.trim() && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-[var(--royal-100)] px-1.5 py-0.5 text-[0.6rem] font-mono text-primary">AI</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
              <Button
                variant={semanticMode ? "default" : "outline"}
                size="sm"
                className="btn-royal-glow h-11"
                onClick={() => { setSemanticMode(!semanticMode); setPage(1); setCursor(null); }}
              >
                <ScanSearch className="mr-1.5 h-3.5 w-3.5" />
                {semanticMode ? t("semantic") : t("lexical")}
              </Button>
              <Button
                variant={show3dAnalytics ? "default" : "outline"}
                size="sm"
                className="h-11"
                onClick={() => setShow3dAnalytics(!show3dAnalytics)}
              >
                <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                {t("cluster3d")}
              </Button>
            </div>
          </div>
          <div
            className={`mt-3 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 ${semanticMode ? "opacity-60" : ""}`}
            title={semanticMode ? "Filters apply to keyword search; semantic search ranks the whole corpus." : undefined}
          >
            <Select value={discipline} onValueChange={setDiscipline} disabled={semanticMode}>
              <SelectTrigger aria-label="Discipline" className="glass-panel h-11 w-full min-w-0 border-[var(--royal-300)]/20">
                <SlidersHorizontal className="mr-1 hidden h-3.5 w-3.5 shrink-0 min-[400px]:block" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-strong">
                <SelectItem value="ALL">{t("allDisciplines")}</SelectItem>
                {DISCIPLINES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={year} onValueChange={setYear} disabled={semanticMode}>
              <SelectTrigger aria-label="Publication year" className="glass-panel h-11 w-full min-w-0 border-[var(--royal-300)]/20">
                <CalendarRange className="mr-1 hidden h-3.5 w-3.5 shrink-0 min-[400px]:block" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-strong">
                <SelectItem value="ALL">All years</SelectItem>
                {publicationYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={month} onValueChange={setMonth} disabled={semanticMode}>
              <SelectTrigger aria-label="Publication month" className="glass-panel h-11 w-full min-w-0 border-[var(--royal-300)]/20">
                <CalendarDays className="mr-1 hidden h-3.5 w-3.5 shrink-0 min-[400px]:block" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-strong">
                <SelectItem value="ALL">All months</SelectItem>
                {monthNames.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort} disabled={semanticMode}>
              <SelectTrigger aria-label="Sort by" className="glass-panel h-11 w-full min-w-0 border-[var(--royal-300)]/20">
                <ArrowUpDown className="mr-1 hidden h-3.5 w-3.5 shrink-0 min-[400px]:block" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-strong">
                {SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{loading ? "Searching…" : t("articlesFound", { count: total })}</span>
            {(q || discipline !== "ALL" || year !== "ALL" || month !== "ALL" || semanticMode) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setQ(""); setDiscipline("ALL"); setYear("ALL"); setMonth("ALL"); setSemanticMode(false); }}
              >
                <X className="mr-1 h-3 w-3" /> Clear filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 3D Discipline Analytics panel */}
      {show3dAnalytics && (
        <section aria-labelledby="discipline-analytics-heading" className="mt-6 glass-royal rounded-2xl p-4 animate-luxury-scale sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p id="discipline-analytics-heading" className="eyebrow">3D Discipline Analytics</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Journal-wide publication, citation and readership metrics per discipline. Orbit the chart, switch metrics,
                or select a discipline to filter the articles below.
              </p>
            </div>
            <Button variant="ghost" size="sm" aria-label="Close analytics" onClick={() => setShow3dAnalytics(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {statsLoading || disciplineStats === null ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[74px] shimmer rounded-xl" />)}
              </div>
              <div className="h-[340px] shimmer rounded-xl sm:h-[440px]" />
            </div>
          ) : disciplineStats.length > 0 ? (
            <DisciplineAnalyticsPanel
              stats={disciplineStats}
              selectedDiscipline={discipline}
              onSelectDiscipline={setDiscipline}
            />
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No published articles yet.
            </div>
          )}
        </section>
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
                className="pearl-card cover-click-glow flex cursor-pointer flex-col p-6 transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_24px_64px_oklch(0.38_0.18_295/0.12)]"
                style={{ transitionTimingFunction: "var(--ease-luxury)", animationDelay: `${i * 60}ms` }}
                onClick={() => openArticle(a.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="outline" className={`border ${DISCIPLINE_COLORS[a.discipline] || DISCIPLINE_COLORS["Physics"]}`}>{a.discipline}</Badge>
                  {semanticScores[a.id] ? (
                    <Badge variant="outline" className="border-[var(--royal-300)]/30 bg-[var(--royal-100)]/50 text-[0.6rem] font-mono text-primary">
                      <ScanSearch className="mr-1 h-2.5 w-2.5" />
                      {(semanticScores[a.id].score * 100).toFixed(0)}% · {semanticScores[a.id].matchType}
                    </Badge>
                  ) : (
                    <span className="font-mono text-[0.6rem] text-muted-foreground">{a.doi}</span>
                  )}
                </div>
                <h3 className="mt-3 line-clamp-3 font-display text-base font-semibold leading-snug">{a.title}</h3>
                <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">{authors.map((au: any) => au.name).join(", ")}</p>
                <p className="mt-3 line-clamp-4 flex-1 text-xs leading-relaxed text-muted-foreground">{a.abstract}</p>
                <div className="mt-4 flex items-center justify-between border-t border-[var(--royal-300)]/10 pt-3 text-[0.7rem] text-muted-foreground">
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
