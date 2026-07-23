"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useReveal } from "@/hooks/use-scroll-reveal";
import { Mic, ArrowLeft, FileX, Rss, Play } from "lucide-react";
import { APP_BASE_URL } from "@/lib/site";

interface PodcastItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  hosts: string;
  coverImageUrl: string | null;
  episodeCount: number;
}

interface EpisodeItem {
  id: string;
  seasonNumber: number | null;
  episodeNumber: number;
  title: string;
  description: string;
  audioUrl: string | null;
  durationSec: number | null;
  publishedAt: string | null;
}

function hostNames(json: string): string {
  try {
    return (JSON.parse(json) as { name?: string }[]).map((h) => h.name).filter(Boolean).join(", ");
  } catch {
    return "";
  }
}

function duration(sec: number | null): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ShowDetail({ podcast, onBack }: { podcast: PodcastItem; onBack: () => void }) {
  const [episodes, setEpisodes] = useState<EpisodeItem[] | null>(null);

  useEffect(() => {
    apiFetch<{ episodes: EpisodeItem[] }>(`/api/podcasts/${podcast.id}`)
      .then((res) => setEpisodes(res.episodes))
      .catch((e) => console.error(e));
  }, [podcast.id]);

  return (
    <div className="page-enter mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All shows
      </button>

      <div className="mt-6 flex flex-col gap-6 border-b-2 border-foreground/90 pb-8 sm:flex-row sm:items-end">
        <div className="h-40 w-40 shrink-0 overflow-hidden rounded-xl bg-[oklch(0.93_0.04_290)] shadow-[0_16px_40px_oklch(0.38_0.18_295/0.15)]">
          {podcast.coverImageUrl ? (
            <img src={podcast.coverImageUrl} alt={podcast.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center"><Mic className="h-12 w-12 text-[oklch(0.42_0.18_295)]" /></div>
          )}
        </div>
        <div>
          <p className="eyebrow">{podcast.category}</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">{podcast.title}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{podcast.description}</p>
          <p className="mt-3 text-xs font-medium text-muted-foreground">Hosted by {hostNames(podcast.hosts)}</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <a href={`${APP_BASE_URL}/api/podcasts/${podcast.id}/rss.xml`} target="_blank" rel="noopener noreferrer">
              <Rss className="mr-1.5 h-3.5 w-3.5" /> Subscribe (RSS)
            </a>
          </Button>
        </div>
      </div>

      <div className="mt-10 space-y-4">
        {episodes === null ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 shimmer rounded-xl" />)
        ) : episodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No episodes published yet.</p>
        ) : (
          episodes.map((ep) => (
            <div key={ep.id} className="pearl-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[oklch(0.76_0.11_294)]">
                    {ep.seasonNumber ? `Season ${ep.seasonNumber} · ` : ""}Episode {ep.episodeNumber}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-semibold leading-snug">{ep.title}</h3>
                </div>
                {ep.durationSec != null && <Badge variant="outline" className="shrink-0 text-[0.65rem]">{duration(ep.durationSec)}</Badge>}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{ep.description}</p>
              {ep.audioUrl && (
                <audio controls preload="none" className="mt-4 w-full" src={ep.audioUrl}>
                  Your browser does not support the audio element.
                </audio>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function PodcastsView() {
  const [podcasts, setPodcasts] = useState<PodcastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PodcastItem | null>(null);
  const headerReveal = useReveal();

  useEffect(() => {
    apiFetch<{ podcasts: PodcastItem[] }>("/api/podcasts")
      .then((res) => setPodcasts(res.podcasts))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (selected) {
    return <ShowDetail podcast={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="page-enter mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div ref={headerReveal.observe} className={`reveal ${headerReveal.inView ? "in-view" : ""} border-b-2 border-foreground/90 pb-6`}>
        <p className="eyebrow">Podcasts</p>
        <h1 className="mt-2 font-display text-5xl font-bold tracking-tight sm:text-6xl">Listen</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">Conversations with researchers, editors, and contributors — real recorded audio, real RSS feeds.</p>
      </div>

      {loading ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 shimmer rounded-2xl" />)}
        </div>
      ) : podcasts.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center py-24 text-center">
          <FileX className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 font-display text-lg font-medium">No shows published yet</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {podcasts.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="cover-click-glow pearl-card group flex flex-col overflow-hidden p-0 text-left transition-all duration-500 hover:scale-[1.02]"
              style={{ transitionTimingFunction: "var(--ease-luxury)", animationDelay: `${i * 60}ms` }}
            >
              <div className="relative aspect-square overflow-hidden bg-[oklch(0.93_0.04_290)]">
                {p.coverImageUrl ? (
                  <img src={p.coverImageUrl} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><Mic className="h-12 w-12 text-[oklch(0.42_0.18_295)]" /></div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/30 group-hover:opacity-100">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90"><Play className="ml-0.5 h-5 w-5 text-black" /></div>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <Badge variant="outline" className="w-fit border-[oklch(0.76_0.11_294/0.3)] bg-[oklch(0.93_0.04_290/0.5)] text-[0.65rem] text-[oklch(0.42_0.18_295)]">{p.category}</Badge>
                <h3 className="mt-3 font-display text-lg font-semibold leading-snug">{p.title}</h3>
                <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                <p className="mt-3 text-xs font-medium text-muted-foreground">{p.episodeCount} episode{p.episodeCount === 1 ? "" : "s"}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
