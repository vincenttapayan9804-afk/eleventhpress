"use client";

/**
 * "Search in": narrows the Research Assistant to part of the journal —
 * chosen articles, disciplines, a publication-year range or one issue.
 * The scope applies to every question until the reader clears it, and is
 * shown as removable chips above the composer.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Filter, Loader2, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { CorpusScope, ScopeFacets } from "./types";

export interface ArticleOption {
  id: string;
  title: string;
  year: number | null;
}

export function isScopeEmpty(scope: CorpusScope | null | undefined): boolean {
  return !scope || (!scope.disciplines?.length && !scope.yearFrom && !scope.yearTo && !scope.issueId && !scope.articleIds?.length);
}

/** Chips describing the scope, each with what removing it leaves. */
export function scopeChips(
  scope: CorpusScope,
  facets: ScopeFacets | null,
  titles: Record<string, string>
): { key: string; label: string; without: CorpusScope }[] {
  const chips: { key: string; label: string; without: CorpusScope }[] = [];
  for (const id of scope.articleIds ?? []) {
    chips.push({ key: `a-${id}`, label: titles[id] ?? "Selected article", without: { ...scope, articleIds: scope.articleIds!.filter((x) => x !== id) } });
  }
  for (const d of scope.disciplines ?? []) {
    chips.push({ key: `d-${d}`, label: d, without: { ...scope, disciplines: scope.disciplines!.filter((x) => x !== d) } });
  }
  if (scope.yearFrom || scope.yearTo) {
    const label =
      scope.yearFrom && scope.yearTo
        ? scope.yearFrom === scope.yearTo
          ? `${scope.yearFrom}`
          : `${scope.yearFrom}–${scope.yearTo}`
        : scope.yearFrom
          ? `From ${scope.yearFrom}`
          : `Up to ${scope.yearTo}`;
    chips.push({ key: "y", label, without: { ...scope, yearFrom: undefined, yearTo: undefined } });
  }
  if (scope.issueId) {
    chips.push({ key: "i", label: facets?.issues.find((i) => i.id === scope.issueId)?.label ?? "One issue", without: { ...scope, issueId: undefined } });
  }
  return chips;
}

export function ScopePicker({
  scope,
  onChange,
  facets,
  onTitles,
  disabled,
  open: openProp,
  onOpenChange,
}: {
  scope: CorpusScope;
  onChange: (scope: CorpusScope) => void;
  facets: ScopeFacets | null;
  titles: Record<string, string>;
  onTitles: (t: Record<string, string>) => void;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => {
    setOpenState(o);
    onOpenChange?.(o);
  };
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ArticleOption[]>([]);
  const [searching, setSearching] = useState(false);
  const reqId = useRef(0);
  const count = useMemo(
    () => (scope.articleIds?.length ?? 0) + (scope.disciplines?.length ?? 0) + (scope.yearFrom || scope.yearTo ? 1 : 0) + (scope.issueId ? 1 : 0),
    [scope]
  );

  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    const t = setTimeout(() => {
      setSearching(true);
      apiFetch<{ articles: ArticleOption[] }>(`/api/corpus-chat/articles${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`)
        .then((res) => {
          if (id !== reqId.current) return;
          setResults(res.articles ?? []);
          onTitles(Object.fromEntries((res.articles ?? []).map((a) => [a.id, a.title])));
        })
        .catch(() => id === reqId.current && setResults([]))
        .finally(() => id === reqId.current && setSearching(false));
    }, 220);
    return () => clearTimeout(t);
  }, [q, open, onTitles]);

  const years = useMemo(() => {
    if (!facets?.years) return [];
    const out: number[] = [];
    for (let y = facets.years.max; y >= facets.years.min; y--) out.push(y);
    return out;
  }, [facets]);

  const toggleArticle = (a: ArticleOption) => {
    const ids = scope.articleIds ?? [];
    onChange({ ...scope, articleIds: ids.includes(a.id) ? ids.filter((x) => x !== a.id) : [...ids, a.id].slice(0, 12) });
  };
  const toggleDiscipline = (d: string) => {
    const ds = scope.disciplines ?? [];
    onChange({ ...scope, disciplines: ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d] });
  };

  const selectCls =
    "h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={count ? `Search scope: ${count} filter${count === 1 ? "" : "s"} set. Change scope` : "Search scope: the whole journal. Change scope"}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
            count ? "border-primary/40 bg-primary/[0.07] text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          {count ? `Scope · ${count}` : "Whole journal"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="border-b border-border/70 px-4 py-3">
          <p className="font-display text-sm font-semibold text-foreground">Search in</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Limit answers to part of the journal. Applies to every question until you clear it.</p>
        </div>
        <div className="max-h-[min(60vh,28rem)] space-y-4 overflow-y-auto px-4 py-3 epip-scroll">
          <section aria-label="Articles">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Only these articles</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find an article by title or keyword"
                aria-label="Find an article"
                className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-8 text-sm focus:border-primary focus:outline-none"
              />
              {searching && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />}
            </div>
            <ul className="mt-1.5 max-h-44 space-y-0.5 overflow-y-auto epip-scroll" aria-label="Matching articles">
              {results.map((a) => {
                const on = scope.articleIds?.includes(a.id) ?? false;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => toggleArticle(a)}
                      aria-pressed={on}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        on && "bg-primary/[0.07]"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        )}
                        aria-hidden="true"
                      >
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-2 leading-snug text-foreground">{a.title}</span>
                        {a.year && <span className="text-xs text-muted-foreground">{a.year}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
              {!searching && results.length === 0 && <li className="px-2 py-1.5 text-xs text-muted-foreground">No published articles match.</li>}
            </ul>
          </section>

          {facets && facets.disciplines.length > 0 && (
            <section aria-label="Disciplines">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Disciplines</p>
              <div className="flex flex-wrap gap-1.5">
                {facets.disciplines.map((d) => {
                  const on = scope.disciplines?.includes(d) ?? false;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDiscipline(d)}
                      aria-pressed={on}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:border-primary/40"
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {years.length > 0 && (
            <section aria-label="Publication years">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Published</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  From
                  <select
                    value={scope.yearFrom ?? ""}
                    onChange={(e) => onChange({ ...scope, yearFrom: e.target.value ? Number(e.target.value) : undefined })}
                    className={cn(selectCls, "mt-1")}
                  >
                    <option value="">Any year</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  To
                  <select
                    value={scope.yearTo ?? ""}
                    onChange={(e) => onChange({ ...scope, yearTo: e.target.value ? Number(e.target.value) : undefined })}
                    className={cn(selectCls, "mt-1")}
                  >
                    <option value="">Any year</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          )}

          {facets && facets.issues.length > 0 && (
            <section aria-label="Issue">
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Issue
                <select
                  value={scope.issueId ?? ""}
                  onChange={(e) => onChange({ ...scope, issueId: e.target.value || undefined })}
                  className={cn(selectCls, "mt-1.5 font-normal normal-case tracking-normal")}
                >
                  <option value="">All issues</option>
                  {facets.issues.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border/70 px-4 py-2.5">
          <button
            type="button"
            onClick={() => onChange({})}
            disabled={count === 0}
            className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <X className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            Clear scope
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Done
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
