"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { BarChart3, Box, MousePointerClick, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DisciplineAnalyticsScene } from "./lazy";
import type { CameraApi } from "./discipline-analytics-scene";
import {
  CHART_THEME,
  METRICS,
  METRIC_ORDER,
  type AnalyticsMetric,
  type AnalyticsView,
  type DisciplineStat,
} from "./discipline-analytics-shared";

function subscribeDark(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}
const getDark = () => document.documentElement.classList.contains("dark");

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}
const getAllowMotion = () => !window.matchMedia(REDUCED_MOTION).matches;

interface Hover {
  discipline: string;
  pointer?: { x: number; y: number };
}

/** Plain-DOM ranked bars of the same data — shown on low-power devices and if WebGL fails. */
function RankedBarsFallback({
  rows,
  metric,
  focus,
  onFocus,
  onSelect,
  mark,
  accent,
  note,
}: {
  rows: DisciplineStat[];
  metric: AnalyticsMetric;
  focus: string | null;
  onFocus: (d: string | null) => void;
  onSelect: (d: string) => void;
  mark: string;
  accent: string;
  note?: string;
}) {
  const def = METRICS[metric];
  const max = Math.max(...rows.map(def.value), 0) || 1;
  return (
    <div className="flex h-full flex-col gap-1.5 overflow-y-auto p-4">
      {note && <p className="mb-1 text-xs text-muted-foreground">{note}</p>}
      {rows.map((s) => {
        const v = def.value(s);
        return (
          <button
            key={s.discipline}
            type="button"
            onClick={() => onSelect(s.discipline)}
            onMouseEnter={() => onFocus(s.discipline)}
            onMouseLeave={() => onFocus(null)}
            className={`grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-3 rounded-md px-1 py-1 text-left text-xs transition-opacity ${
              focus && focus !== s.discipline ? "opacity-40" : ""
            }`}
          >
            <span className="flex items-center gap-1.5 truncate font-medium">
              {s.indexed && <span className="h-2 w-2 shrink-0 rounded-full border-2" style={{ borderColor: accent }} />}
              <span className="truncate">{s.discipline}</span>
            </span>
            <span className="h-3 rounded-r-[4px] bg-transparent">
              <span
                className="block h-full rounded-r-[4px]"
                style={{ width: `${Math.max((v / max) * 100, 1)}%`, background: mark }}
              />
            </span>
            <span className="text-right tabular-nums text-muted-foreground">{def.format(v)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function DisciplineAnalyticsPanel({
  stats,
  selectedDiscipline,
  onSelectDiscipline,
}: {
  stats: DisciplineStat[];
  /** The browse page's discipline filter ("ALL" when unfiltered). */
  selectedDiscipline: string;
  onSelectDiscipline: (discipline: string) => void;
}) {
  const dark = useSyncExternalStore(subscribeDark, getDark, () => false);
  const allowMotion = useSyncExternalStore(subscribeMotion, getAllowMotion, () => false);
  const theme = dark ? CHART_THEME.dark : CHART_THEME.light;

  const [view, setView] = useState<AnalyticsView>("bars");
  const [metric, setMetric] = useState<AnalyticsMetric>("articles");
  const [chartHover, setChartHover] = useState<Hover | null>(null);
  const [tableFocus, setTableFocus] = useState<string | null>(null);
  const cameraApi = useRef<CameraApi | null>(null);
  const handleCameraApi = useCallback((api: CameraApi | null) => {
    cameraApi.current = api;
  }, []);

  const selected = selectedDiscipline !== "ALL" ? selectedDiscipline : null;
  const highlighted = chartHover?.discipline ?? tableFocus;
  const sortMetric: AnalyticsMetric = view === "bars" ? metric : "articles";
  const def = METRICS[sortMetric];

  const rows = useMemo(
    () => [...stats].sort((a, b) => def.value(b) - def.value(a) || a.discipline.localeCompare(b.discipline)),
    [stats, def]
  );
  const totals = useMemo(
    () => ({
      articles: stats.reduce((n, s) => n + s.articles, 0),
      citations: stats.reduce((n, s) => n + s.citations, 0),
      views: stats.reduce((n, s) => n + s.views, 0),
    }),
    [stats]
  );
  const statByName = useMemo(() => new Map(stats.map((s) => [s.discipline, s])), [stats]);

  const select = (d: string) => onSelectDiscipline(selected === d ? "ALL" : d);
  const tooltipStat = chartHover?.pointer ? statByName.get(chartHover.discipline) : undefined;

  const fallback = (
    <RankedBarsFallback
      rows={rows}
      metric={sortMetric}
      focus={highlighted ?? selected}
      onFocus={setTableFocus}
      onSelect={select}
      mark={theme.mark}
      accent={theme.accent}
      note={view === "scatter" ? "The 3D correlation view needs WebGL — showing published articles per discipline instead." : undefined}
    />
  );

  const kpis = [
    { label: "Disciplines", value: stats.length },
    { label: "Published articles", value: totals.articles },
    { label: "Citations", value: totals.citations },
    { label: "Views", value: totals.views },
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border/60 bg-background/60 px-4 py-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{k.label}</dt>
            <dd className="mt-1 text-2xl font-semibold text-foreground">{k.value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={view}
          onValueChange={(v) => v && setView(v as AnalyticsView)}
          aria-label="Chart type"
        >
          <ToggleGroupItem value="bars" aria-label="Ranked 3D bars" className="px-3">
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Ranked bars
          </ToggleGroupItem>
          <ToggleGroupItem value="scatter" aria-label="3D correlation of articles, citations and views" className="px-3">
            <Box className="mr-1.5 h-3.5 w-3.5" /> 3D correlation
          </ToggleGroupItem>
        </ToggleGroup>

        {view === "bars" && (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={metric}
            onValueChange={(v) => v && setMetric(v as AnalyticsMetric)}
            aria-label="Metric"
            className="flex-wrap"
          >
            {METRIC_ORDER.map((m) => (
              <ToggleGroupItem key={m} value={m} className="px-3">
                {METRICS[m].label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Zoom out" onClick={() => cameraApi.current?.zoomBy(1.2)}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Zoom in" onClick={() => cameraApi.current?.zoomBy(1 / 1.2)}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={() => cameraApi.current?.reset()}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset view
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div
          role="img"
          aria-label={
            view === "bars"
              ? `3D bar chart of ${METRICS[metric].axisTitle.toLowerCase()} per discipline. The table beside it lists every value.`
              : "3D scatter plot of published articles, citations and views per discipline. The table beside it lists every value."
          }
          className="relative h-[440px] overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-[var(--royal-50)] to-transparent"
        >
          <DisciplineAnalyticsScene
            stats={stats}
            view={view}
            metric={metric}
            highlighted={highlighted}
            selected={selected}
            onHover={(d, pointer) => setChartHover(d ? { discipline: d, pointer } : null)}
            onSelect={select}
            allowMotion={allowMotion}
            dark={dark}
            onCameraApi={handleCameraApi}
            fallback={fallback}
          />

          <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 rounded-lg border border-border/60 bg-background/85 px-2.5 py-2 text-[11px] text-muted-foreground backdrop-blur-sm">
            <span className="flex items-center gap-1.5">
              {view === "bars" ? (
                <span className="h-3 w-2 rounded-t-[2px]" style={{ background: theme.mark }} />
              ) : (
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: theme.mark }} />
              )}
              {view === "bars"
                ? `Bar height: ${METRICS[metric].axisTitle.toLowerCase()}`
                : "Discipline — x: articles · y: citations · z: views"}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: theme.accent }} />
              Has DOI-registered articles
            </span>
          </div>
          <p className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md bg-background/80 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur-sm">
            <MousePointerClick className="h-3 w-3" /> Drag to orbit · click a discipline to filter
          </p>
        </div>

        <div className="max-h-[440px] overflow-auto rounded-xl border border-border/60 bg-background/60">
          <table className="w-full text-xs">
            <caption className="sr-only">
              Published articles, citations and views per discipline, sorted by {def.axisTitle.toLowerCase()}.
              Select a discipline to filter the article list.
            </caption>
            <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
              <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-medium">Discipline</th>
                {(["articles", "citations", "views"] as const).map((m) => (
                  <th
                    key={m}
                    scope="col"
                    aria-sort={sortMetric === m ? "descending" : undefined}
                    className={`px-2 py-2 text-right font-medium ${sortMetric === m ? "text-foreground" : ""}`}
                  >
                    {METRICS[m].label}
                  </th>
                ))}
                <th
                  scope="col"
                  aria-sort={sortMetric === "citationsPerArticle" ? "descending" : undefined}
                  className={`px-3 py-2 text-right font-medium ${sortMetric === "citationsPerArticle" ? "text-foreground" : ""}`}
                >
                  Cit./art.
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const isSelected = selected === s.discipline;
                const isFocus = highlighted === s.discipline;
                return (
                  <tr
                    key={s.discipline}
                    onMouseEnter={() => setTableFocus(s.discipline)}
                    onMouseLeave={() => setTableFocus(null)}
                    className={`border-b border-border/40 last:border-0 ${isFocus || isSelected ? "bg-[var(--royal-100)]/60" : ""}`}
                  >
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => select(s.discipline)}
                        onFocus={() => setTableFocus(s.discipline)}
                        onBlur={() => setTableFocus(null)}
                        className="flex items-center gap-1.5 rounded text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {s.indexed ? (
                          <span className="h-2 w-2 shrink-0 rounded-full border-2" style={{ borderColor: theme.accent }} aria-hidden />
                        ) : (
                          <span className="h-2 w-2 shrink-0" aria-hidden />
                        )}
                        <span>{s.discipline}</span>
                        {s.indexed && <span className="sr-only">(has DOI-registered articles)</span>}
                        {isSelected && (
                          <span className="ml-1 rounded bg-primary px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-primary-foreground">
                            Filter
                          </span>
                        )}
                      </button>
                    </th>
                    <td className="px-2 py-2 text-right tabular-nums">{METRICS.articles.format(s.articles)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{METRICS.citations.format(s.citations)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{METRICS.views.format(s.views)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {METRICS.citationsPerArticle.format(METRICS.citationsPerArticle.value(s))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Portalled: an ancestor's entrance animation leaves a transform that
          would otherwise turn position:fixed into ancestor-relative. */}
      {tooltipStat &&
        chartHover?.pointer &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-50 w-[220px] rounded-lg border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-lg"
            style={{
              left: Math.min(chartHover.pointer.x + 16, window.innerWidth - 236),
              top: Math.min(chartHover.pointer.y + 16, window.innerHeight - 170),
            }}
          >
            <p className="text-sm font-semibold">{tooltipStat.discipline}</p>
            <dl className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
              {METRIC_ORDER.map((m) => (
                <div key={m} className="flex justify-between gap-4">
                  <dt>{METRICS[m].axisTitle}</dt>
                  <dd className="font-semibold tabular-nums text-popover-foreground">
                    {METRICS[m].format(METRICS[m].value(tooltipStat))}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full border-2"
                style={{ borderColor: tooltipStat.indexed ? theme.accent : "currentColor" }}
              />
              {tooltipStat.indexed ? "Has DOI-registered articles" : "No registered DOIs yet"}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {selected === tooltipStat.discipline ? "Click to clear the filter" : "Click to filter articles"}
            </p>
          </div>,
          document.body
        )}
    </div>
  );
}
