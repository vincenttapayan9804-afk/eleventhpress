"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Hand,
  Link2,
  Network,
  Pause,
  Pin,
  PinOff,
  Play,
  RotateCcw,
  Tag,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { DataSceneGuard } from "@/components/three-d/lazy";
import {
  graphStats,
  layoutConstellation,
  layoutTide,
  neighboursOf,
} from "@/lib/second-brain-graph";
import type { SecondBrainLink } from "@/lib/second-brain";
import type { SecondBrainNote } from "./note-card";
import type { GraphCameraApi, GraphMode } from "./graph-3d-scene";

const SceneImpl = dynamic(() => import("./graph-3d-scene").then((m) => m.SecondBrainGraphScene), {
  ssr: false,
  loading: () => <div className="h-full w-full shimmer rounded-xl" />,
});

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

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/**
 * Second Brain's interactive 3D knowledge graph — Constellation (notes on
 * shells around a glass core, most-connected innermost) and Tide (notes on a
 * time axis riding a wave, height = connections). Orbit by dragging, zoom
 * with the toolbar, hover for a summary, click to focus a note and light up
 * its connections, or filter the whole graph by tag. `fallback` (the
 * original SVG view) renders on devices without WebGL.
 */
export function SecondBrainGraph3D({
  mode,
  notes,
  links,
  linkCountByNote,
  accentColor,
  onTogglePin,
  onDelete,
  fallback,
}: {
  mode: GraphMode;
  notes: SecondBrainNote[];
  links: SecondBrainLink[];
  linkCountByNote: Record<string, number>;
  accentColor: string;
  onTogglePin: (n: SecondBrainNote) => void;
  onDelete: (id: string) => void;
  fallback: ReactNode;
}) {
  const dark = useSyncExternalStore(subscribeDark, getDark, () => false);
  const allowMotion = useSyncExternalStore(subscribeMotion, getAllowMotion, () => false);
  const [hover, setHover] = useState<{ id: string; pointer?: { x: number; y: number } } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const camera = useRef<GraphCameraApi | null>(null);
  const handleCameraApi = useCallback((api: GraphCameraApi | null) => {
    camera.current = api;
  }, []);

  const layout = useMemo(
    () =>
      mode === "constellation"
        ? layoutConstellation(notes, links, linkCountByNote)
        : layoutTide(notes, links, linkCountByNote, (iso) =>
            new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })
          ),
    [mode, notes, links, linkCountByNote]
  );
  const stats = useMemo(() => graphStats(notes, links, linkCountByNote), [notes, links, linkCountByNote]);
  const noteById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const selectedNote = selected ? noteById.get(selected) ?? null : null;

  // Which notes stay lit: the selection and its neighbours, else the tag filter.
  const lit = useMemo(() => {
    if (selected) return new Set([selected, ...neighboursOf(selected, layout.edges)]);
    if (tagFilter) return new Set(notes.filter((n) => n.tags.includes(tagFilter)).map((n) => n.id));
    return null;
  }, [selected, tagFilter, layout.edges, notes]);

  const selectedLinks = useMemo(
    () =>
      selected
        ? layout.edges
            .filter((e) => e.a === selected || e.b === selected)
            .map((e) => ({ other: noteById.get(e.a === selected ? e.b : e.a), sharedTags: e.sharedTags }))
            .filter((x): x is { other: SecondBrainNote; sharedTags: string[] } => !!x.other)
            .sort((a, b) => b.sharedTags.length - a.sharedTags.length)
        : [],
    [selected, layout.edges, noteById]
  );

  const hoverNote = hover?.pointer ? noteById.get(hover.id) : undefined;
  const maxTag = stats.topTags[0]?.count ?? 1;

  if (notes.length === 0) return <>{fallback}</>;

  const kpis = [
    { label: "Notes", value: stats.notes.toLocaleString() },
    { label: "Connections", value: stats.connections.toLocaleString() },
    { label: "Tags", value: stats.tags.toLocaleString() },
    { label: "Avg. links / note", value: stats.avgDegree.toFixed(1) },
    { label: "Network density", value: `${Math.round(stats.density * 100)}%` },
  ];

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {kpis.map((k, i) => (
          <div
            key={k.label}
            className={`rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] to-transparent px-3 py-2.5 ${
              i === kpis.length - 1 ? "col-span-2 sm:col-span-1" : ""
            }`}
          >
            <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{k.label}</dt>
            <dd className="mt-0.5 font-display text-xl font-semibold tabular-nums text-foreground">{k.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div
          role="img"
          aria-label={
            mode === "constellation"
              ? `3D constellation of ${stats.notes} notes and ${stats.connections} tag connections. Most-connected notes orbit closest to the core.`
              : `3D tide of ${stats.notes} notes along a timeline; taller notes have more connections.`
          }
          className="relative h-[380px] overflow-hidden rounded-2xl border border-primary/20 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_70%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_50px_-24px_color-mix(in_oklab,var(--primary)_45%,transparent)] sm:h-[520px]"
        >
          <DataSceneGuard fallback={fallback}>
            <SceneImpl
              mode={mode}
              layout={layout}
              accent={accentColor}
              dark={dark}
              allowMotion={allowMotion}
              autoRotate={autoRotate}
              hovered={hover?.id ?? null}
              selected={selected}
              lit={lit}
              onHover={(id, pointer) => setHover(id ? { id, pointer } : null)}
              onSelect={setSelected}
              onCameraApi={handleCameraApi}
            />
          </DataSceneGuard>

          <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-lg border border-border/60 bg-background/85 p-0.5 backdrop-blur-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Zoom out" onClick={() => camera.current?.zoomBy(1.25)}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Zoom in" onClick={() => camera.current?.zoomBy(1 / 1.25)}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            {allowMotion && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={autoRotate ? "Pause rotation" : "Resume rotation"}
                aria-pressed={!autoRotate}
                onClick={() => setAutoRotate((v) => !v)}
              >
                {autoRotate ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Reset view"
              onClick={() => {
                setSelected(null);
                camera.current?.reset();
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="pointer-events-none absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/60 bg-background/85 px-2.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur-sm sm:text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: accentColor }} /> Note (size = links)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: accentColor }} /> Pinned
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-px w-4" style={{ background: accentColor }} /> Shared tag
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              <Hand className="h-3 w-3" /> Drag to orbit · click a note to focus
            </span>
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          {selectedNote ? (
            <div className="rounded-2xl border border-primary/20 bg-background/70 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-sm font-semibold leading-snug">{selectedNote.title}</h3>
                <button onClick={() => setSelected(null)} className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label="Close note">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Captured {fmtDate(selectedNote.createdAt)}</p>
              <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-line text-xs text-foreground/80">{selectedNote.content}</p>
              {selectedNote.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedNote.tags.map((t) => (
                    <Badge key={t} variant="outline" className="gap-1 text-[0.6rem]">
                      <Tag className="h-2.5 w-2.5" /> {t}
                    </Badge>
                  ))}
                </div>
              )}
              {selectedLinks.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Connected notes ({selectedLinks.length})
                  </p>
                  <ul className="mt-1.5 max-h-32 space-y-1 overflow-y-auto">
                    {selectedLinks.map(({ other, sharedTags }) => (
                      <li key={other.id}>
                        <button
                          onClick={() => setSelected(other.id)}
                          className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-accent"
                        >
                          <span className="truncate">{other.title}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{sharedTags.join(", ")}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => onTogglePin(selectedNote)}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[0.65rem] text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {selectedNote.pinned ? <Pin className="h-3 w-3 fill-current" /> : <PinOff className="h-3 w-3" />}
                  {selectedNote.pinned ? "Pinned" : "Pin"}
                </button>
                <button
                  onClick={() => {
                    onDelete(selectedNote.id);
                    setSelected(null);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[0.65rem] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-background/60 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                <Network className="h-3.5 w-3.5" /> Knowledge hubs
              </p>
              {stats.hubs.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  No connections yet — give two notes a shared tag to link them.
                </p>
              ) : (
                <ol className="mt-2 space-y-1">
                  {stats.hubs.map((h, i) => (
                    <li key={h.id}>
                      <button
                        onClick={() => setSelected(h.id)}
                        onMouseEnter={() => setHover({ id: h.id })}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover({ id: h.id })}
                        onBlur={() => setHover(null)}
                        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-accent"
                      >
                        <span className="w-4 shrink-0 text-[10px] tabular-nums text-muted-foreground">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate">{h.title}</span>
                        <span className="flex shrink-0 items-center gap-0.5 text-[10px] tabular-nums text-muted-foreground">
                          <Link2 className="h-3 w-3" /> {h.linkCount}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              {stats.isolated > 0 && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {stats.isolated} unconnected note{stats.isolated === 1 ? "" : "s"}
                </p>
              )}
            </div>
          )}

          {stats.topTags.length > 0 && (
            <div className="rounded-2xl border border-border bg-background/60 p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" /> Top tags
                </p>
                {tagFilter && (
                  <button onClick={() => setTagFilter(null)} className="text-[10px] text-primary hover:underline">
                    Clear filter
                  </button>
                )}
              </div>
              <ul className="mt-2 space-y-1">
                {stats.topTags.map((t) => {
                  const active = tagFilter === t.tag;
                  return (
                    <li key={t.tag}>
                      <button
                        aria-pressed={active}
                        onClick={() => {
                          setSelected(null);
                          setTagFilter(active ? null : t.tag);
                        }}
                        className={`grid w-full grid-cols-[minmax(0,6.5rem)_1fr_1.75rem] items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors ${
                          active ? "bg-primary/10 text-primary" : "hover:bg-accent"
                        } ${tagFilter && !active ? "opacity-50" : ""}`}
                      >
                        <span className="truncate">{t.tag}</span>
                        <span className="h-2 rounded-r-[4px]" style={{ width: `${Math.max((t.count / maxTag) * 100, 6)}%`, background: accentColor }} />
                        <span className="text-right text-[10px] tabular-nums text-muted-foreground">{t.count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {hoverNote &&
        hover?.pointer &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-50 w-[230px] rounded-lg border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-lg"
            style={{
              left: Math.max(8, Math.min(hover.pointer.x + 16, window.innerWidth - 238)),
              top: Math.max(8, Math.min(hover.pointer.y + 16, window.innerHeight - 150)),
            }}
          >
            <p className="line-clamp-2 text-sm font-semibold">{hoverNote.title}</p>
            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{hoverNote.content}</p>
            <p className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Link2 className="h-3 w-3" /> {linkCountByNote[hoverNote.id] || 0} links
              </span>
              <span>{fmtDate(hoverNote.createdAt)}</span>
              {hoverNote.pinned && <span className="font-medium text-primary">Pinned</span>}
            </p>
          </div>,
          document.body
        )}
    </div>
  );
}
