"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useReveal } from "@/hooks/use-scroll-reveal";
import { Newspaper, FileX, ArrowRight } from "lucide-react";
import { OPEN_EDITION_ISSUES, readingMinutes, type OpenEditionIssue } from "@/lib/open-edition";
import { OpenEditionCover } from "@/components/views/open-edition-issue-view";

/** The latest Open Edition issue, featured at the top of /magazines. */
function OpenEditionFeature({ issue, onOpen }: { issue: OpenEditionIssue; onOpen: () => void }) {
  const minutes = issue.pieces.reduce((t, p) => t + readingMinutes(p.bodyHtml), 0);
  const highlights = issue.pieces.filter((p) => p.kind === "original").slice(0, 4);
  return (
    <section aria-labelledby="oe-feature-h" className="mt-8 overflow-hidden rounded-2xl border border-foreground/10 bg-gradient-to-br from-[var(--gold-200)]/40 via-background to-[var(--royal-100)]/50 dark:from-[oklch(0.22_0.04_85)]/40 dark:to-[oklch(0.22_0.06_295)]/50">
      <div className="grid items-center gap-10 p-6 sm:p-10 md:grid-cols-[minmax(0,260px)_1fr] lg:gap-14 lg:p-12">
        <button onClick={onOpen} aria-label={`Open ${issue.series}: ${issue.title} ${issue.titleItalic}`} className="cover-click-glow mx-auto block w-full max-w-[260px] transition-transform duration-500 hover:-translate-y-1">
          <OpenEditionCover issue={issue} />
        </button>
        <div>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-[var(--gold-600)]">
            New · {issue.series} · Vol. {issue.volume}, No. {issue.issueNumber}
          </p>
          <h2 id="oe-feature-h" className="mt-3 font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl">
            {issue.title} <span className="font-normal italic text-primary">{issue.titleItalic}</span>
          </h2>
          <p className="mt-4 max-w-2xl font-serif text-lg leading-relaxed text-foreground/80">{issue.description}</p>
          <ul className="mt-6 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {highlights.map((p) => (
              <li key={p.slug} className="flex gap-2 border-t border-foreground/10 pt-2">
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">{p.section}</span>
                <span className="font-medium leading-snug">{p.title}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button onClick={onOpen} className="rounded-full px-6">
              Read the issue <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">Free to read · {issue.pieces.length} pieces · {minutes} min</span>
          </div>
        </div>
      </div>
    </section>
  );
}

interface IssueItem {
  id: string;
  magazineName: string;
  magazineSlug: string;
  volume: number;
  issueNumber: number;
  year: number;
  title: string | null;
  theme: string | null;
  publishedAt: string | null;
  coverImageUrl: string | null;
  coverStoryTitle: string | null;
  coverStoryDek: string | null;
}

function issueLabel(i: Pick<IssueItem, "title" | "volume" | "issueNumber" | "year">) {
  return i.title || `Volume ${i.volume}, No. ${i.issueNumber}`;
}

function issueDate(publishedAt: string | null) {
  return publishedAt
    ? new Date(publishedAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })
    : "";
}

export function MagazinesView() {
  const t = useTranslations("magazines");
  const { openMagazineIssue } = useApp();
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [magazine, setMagazine] = useState("ALL");
  const headerReveal = useReveal();
  const gridReveal = useReveal();

  useEffect(() => {
    apiFetch<{ issues: IssueItem[] }>("/api/magazine-issues")
      .then((res) => setIssues(res.issues))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const magazines = useMemo(
    () => Array.from(new Set(issues.map((i) => i.magazineName))).sort(),
    [issues]
  );
  const filtered = useMemo(
    () => (magazine === "ALL" ? issues : issues.filter((i) => i.magazineName === magazine)),
    [issues, magazine]
  );
  const [hero, ...rest] = filtered;
  const latestOpenEdition = OPEN_EDITION_ISSUES[OPEN_EDITION_ISSUES.length - 1];

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* The masthead renders while the list loads: this is also what the
            server sends, so crawlers get the page's heading and intro. */}
        <div className="border-b-2 border-foreground/90 pb-6">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-2 font-display text-5xl font-bold tracking-tight sm:text-6xl">{t("title")}</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {latestOpenEdition && <OpenEditionFeature issue={latestOpenEdition} onOpen={() => openMagazineIssue(latestOpenEdition.id)} />}
        <div className="mt-8 h-64 shimmer rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Masthead */}
      <div ref={headerReveal.observe} className={`reveal ${headerReveal.inView ? "in-view" : ""} flex flex-wrap items-end justify-between gap-4 border-b-2 border-foreground/90 pb-6`}>
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-2 font-display text-5xl font-bold tracking-tight sm:text-6xl">{t("title")}</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {magazines.length > 1 && (
          <Select value={magazine} onValueChange={setMagazine}>
            <SelectTrigger className="h-10 w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("allMagazines")}</SelectItem>
              {magazines.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {magazine === "ALL" && latestOpenEdition && (
        <OpenEditionFeature issue={latestOpenEdition} onOpen={() => openMagazineIssue(latestOpenEdition.id)} />
      )}

      {filtered.length === 0 ? (latestOpenEdition ? null : (
        <div className="mt-16 flex flex-col items-center justify-center py-24 text-center">
          <FileX className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 font-display text-lg font-medium">{t("noIssuesTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("noIssuesHint")}</p>
        </div>
      )) : (
        <>
          {/* Hero — latest issue, Forbes-style split cover treatment */}
          {hero && (
            <button
              onClick={() => openMagazineIssue(hero.id)}
              className="cover-click-glow group mt-8 grid w-full gap-0 overflow-hidden rounded-2xl border border-foreground/10 bg-black text-left shadow-[0_24px_64px_oklch(0.38_0.18_295/0.18)] transition-all duration-500 hover:shadow-[0_32px_80px_oklch(0.38_0.18_295/0.28)] lg:grid-cols-2"
            >
              <div className="relative aspect-[4/3] overflow-hidden lg:aspect-auto">
                {hero.coverImageUrl ? (
                  <img src={hero.coverImageUrl} alt={issueLabel(hero)} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[oklch(0.25_0.08_295)] to-black">
                    <Newspaper className="h-16 w-16 text-white/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent lg:hidden" />
              </div>
              <div className="flex flex-col justify-center px-8 py-10 sm:px-12 sm:py-14">
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-[oklch(0.76_0.11_294)]">
                  {hero.magazineName} · Vol. {hero.volume}, No. {hero.issueNumber} · {hero.year}
                </p>
                <h2 className="mt-4 font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl lg:text-5xl">
                  {hero.coverStoryTitle || issueLabel(hero)}
                </h2>
                {hero.coverStoryDek && (
                  <p className="mt-4 max-w-md font-serif text-lg italic leading-relaxed text-white/70">{hero.coverStoryDek}</p>
                )}
                <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-white">
                  {t("readTheIssue")} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </button>
          )}

          {/* Grid — remaining issues */}
          {rest.length > 0 && (
            <div ref={gridReveal.observe} className={`reveal ${gridReveal.inView ? "in-view" : ""} mt-14`}>
              <p className="eyebrow border-b border-foreground/10 pb-3">{t("moreIssues")}</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((issue, i) => (
                  <button
                    key={issue.id}
                    onClick={() => openMagazineIssue(issue.id)}
                    className="cover-click-glow pearl-card group flex flex-col overflow-hidden p-0 text-left transition-all duration-500 hover:scale-[1.02]"
                    style={{ transitionTimingFunction: "var(--ease-luxury)", animationDelay: `${i * 60}ms` }}
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-[var(--royal-100)]">
                      {issue.coverImageUrl ? (
                        <img src={issue.coverImageUrl} alt={issueLabel(issue)} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center"><Newspaper className="h-10 w-10 text-primary" /></div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <Badge variant="outline" className="w-fit border-[var(--royal-300)]/30 bg-[var(--royal-100)]/50 text-[0.65rem] text-primary">
                        {issue.magazineName}
                      </Badge>
                      <h3 className="mt-3 line-clamp-2 font-display text-lg font-semibold leading-snug">
                        {issue.coverStoryTitle || issueLabel(issue)}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">Vol. {issue.volume}, No. {issue.issueNumber} · {issueDate(issue.publishedAt)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
