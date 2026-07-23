"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Mic, Plus, Loader2, ChevronDown, ChevronUp, Rss, CheckCircle2, Copy, UploadCloud } from "lucide-react";
import { PODCAST_PLATFORMS } from "@/lib/podcast-distribution";
import { APP_BASE_URL } from "@/lib/site";

const EPISODE_STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-green-100 text-green-800",
};
const DIST_STATUS_BADGE: Record<string, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  PACKAGE_READY: "bg-blue-100 text-blue-800",
  SUBMITTED: "bg-purple-100 text-purple-800",
  LIVE: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

async function uploadFile(file: File, bucket: string): Promise<string> {
  const presign = await apiFetch<{ uploadUrl: string; key: string; headers: Record<string, string> }>("/api/storage/presign-local", {
    method: "POST",
    body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream", bucket }),
  });
  const res = await fetch(presign.uploadUrl, { method: "PUT", body: file, headers: presign.headers });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return presign.key;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copied");
}

function PodcastDistribution({ podcast }: { podcast: any }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const feedUrl = `${APP_BASE_URL}/api/podcasts/${podcast.id}/rss.xml`;

  async function load() {
    try {
      const res = await apiFetch<{ items: any[] }>(`/api/podcast-distribution?podcastId=${podcast.id}`);
      setItems(res.items);
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  useEffect(() => { load(); }, [podcast.id]);

  async function generate(platform: string) {
    setBusy(platform);
    try {
      await apiFetch("/api/podcast-distribution", {
        method: "POST",
        body: JSON.stringify({ podcastId: podcast.id, platform, consent: consent[platform] }),
      });
      toast.success("Package generated");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function markSubmitted(id: string) {
    setBusy(id);
    try {
      await apiFetch(`/api/podcast-distribution/${id}`, { method: "PATCH", body: JSON.stringify({ status: "SUBMITTED" }) });
      toast.success("Marked as submitted");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border p-3">
        <Rss className="h-4 w-4 shrink-0 text-muted-foreground" />
        <code className="flex-1 truncate text-xs">{feedUrl}</code>
        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(feedUrl)}><Copy className="h-3 w-3" /></Button>
      </div>

      {!items ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        items.map((item) => {
          const def = PODCAST_PLATFORMS.find((p) => p.id === item.platform)!;
          return (
            <div key={item.platform} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{def.label}</span>
                <Badge className={DIST_STATUS_BADGE[item.status]}>{item.status.replace(/_/g, " ")}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{def.postingHint}</p>
              {item.status === "NOT_STARTED" && (
                <div className="mt-2 space-y-2">
                  <label className="flex items-start gap-2 text-xs">
                    <Checkbox checked={!!consent[item.platform]} onCheckedChange={(v) => setConsent((c) => ({ ...c, [item.platform]: !!v }))} />
                    {def.consentText}
                  </label>
                  <Button size="sm" disabled={busy === item.platform || !consent[item.platform]} onClick={() => generate(item.platform)}>
                    {busy === item.platform ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null} Generate package
                  </Button>
                </div>
              )}
              {item.status === "PACKAGE_READY" && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={def.submitUrl} target="_blank" rel="noopener noreferrer">Continue to {def.label}</a>
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => markSubmitted(item.id)}>
                    {busy === item.id ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-2 h-3 w-3" />} Mark submitted
                  </Button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function EpisodeForm({ podcastId, onCreated }: { podcastId: string; onCreated: () => void }) {
  const [form, setForm] = useState({ episodeNumber: "1", seasonNumber: "", title: "", description: "" });
  const [audio, setAudio] = useState<{ key: string; filename: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  async function handleAudioSelected(file: File) {
    setUploading(true);
    try {
      const key = await uploadFile(file, "podcast-audio");
      setAudio({ key, filename: file.name });
      toast.success("Audio uploaded");
    } catch (e: any) {
      toast.error("Upload failed", { description: e.message });
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!form.title || !form.description) {
      toast.error("Title and description are required");
      return;
    }
    setCreating(true);
    try {
      await apiFetch(`/api/podcasts/${podcastId}/episodes`, {
        method: "POST",
        body: JSON.stringify({
          episodeNumber: parseInt(form.episodeNumber, 10),
          seasonNumber: form.seasonNumber ? parseInt(form.seasonNumber, 10) : undefined,
          title: form.title,
          description: form.description,
          audioKey: audio?.key,
        }),
      });
      toast.success("Episode created");
      setForm({ episodeNumber: String(parseInt(form.episodeNumber, 10) + 1), seasonNumber: "", title: "", description: "" });
      setAudio(null);
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-sm font-semibold">New episode</CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Episode #</Label><Input type="number" value={form.episodeNumber} onChange={(e) => setForm((f) => ({ ...f, episodeNumber: e.target.value }))} /></div>
          <div><Label className="text-xs">Season (optional)</Label><Input type="number" value={form.seasonNumber} onChange={(e) => setForm((f) => ({ ...f, seasonNumber: e.target.value }))} /></div>
        </div>
        <Input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        <Textarea placeholder="Description / shownotes" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        <div>
          <Label className="text-xs">Audio file (MP3)</Label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="file"
              accept="audio/mpeg,audio/mp3"
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && handleAudioSelected(e.target.files[0])}
              className="text-xs"
            />
            {uploading && <Loader2 className="h-3 w-3 animate-spin" />}
            {audio && <Badge variant="outline" className="text-[0.65rem]"><UploadCloud className="mr-1 h-3 w-3" />{audio.filename}</Badge>}
          </div>
        </div>
        <Button size="sm" disabled={creating} onClick={submit}>
          {creating ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Plus className="mr-2 h-3 w-3" />} Create episode
        </Button>
      </CardContent>
    </Card>
  );
}

function PodcastDetail({ podcastId }: { podcastId: string }) {
  const [podcast, setPodcast] = useState<any | null>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [showNewEpisode, setShowNewEpisode] = useState(false);
  const [busyEpisodeId, setBusyEpisodeId] = useState<string | null>(null);
  const [showDistribution, setShowDistribution] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<{ podcast: any; episodes: any[] }>(`/api/podcasts/${podcastId}`);
      setPodcast(res.podcast);
      setEpisodes(res.episodes);
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  useEffect(() => { load(); }, [podcastId]);

  async function publish(episodeId: string, action: "PUBLISH" | "UNPUBLISH") {
    setBusyEpisodeId(episodeId);
    try {
      await apiFetch(`/api/podcast-episodes/${episodeId}/workflow`, { method: "POST", body: JSON.stringify({ action }) });
      toast.success(action === "PUBLISH" ? "Episode published" : "Episode unpublished");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyEpisodeId(null);
    }
  }

  if (!podcast) return <Loader2 className="h-4 w-4 animate-spin" />;
  const hasPublished = episodes.some((e) => e.status === "PUBLISHED");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Episodes</p>
        <Button size="sm" variant="outline" onClick={() => setShowNewEpisode((v) => !v)}><Plus className="mr-1 h-3 w-3" /> New episode</Button>
      </div>

      {showNewEpisode && <EpisodeForm podcastId={podcastId} onCreated={() => { setShowNewEpisode(false); load(); }} />}

      <div className="space-y-2">
        {episodes.map((ep) => (
          <div key={ep.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">
                {ep.seasonNumber ? `S${ep.seasonNumber}` : ""}E{ep.episodeNumber} — {ep.title}
              </p>
              <p className="text-xs text-muted-foreground">{ep.durationSec ? `${Math.round(ep.durationSec / 60)} min` : "Duration not set"}{ep.audioKey ? "" : " · no audio uploaded"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={EPISODE_STATUS_BADGE[ep.status]}>{ep.status}</Badge>
              <Button
                size="sm"
                variant="outline"
                disabled={busyEpisodeId === ep.id || (ep.status === "DRAFT" && !ep.audioKey)}
                onClick={() => publish(ep.id, ep.status === "DRAFT" ? "PUBLISH" : "UNPUBLISH")}
              >
                {busyEpisodeId === ep.id ? <Loader2 className="h-3 w-3 animate-spin" /> : ep.status === "DRAFT" ? "Publish" : "Unpublish"}
              </Button>
            </div>
          </div>
        ))}
        {episodes.length === 0 && <p className="text-sm text-muted-foreground">No episodes yet.</p>}
      </div>

      {hasPublished && (
        <>
          <Separator />
          <button className="flex items-center gap-2 text-sm font-semibold" onClick={() => setShowDistribution((v) => !v)}>
            Distribution {showDistribution ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showDistribution && <PodcastDistribution podcast={podcast} />}
        </>
      )}
    </div>
  );
}

export function PodcastsTab() {
  const [podcasts, setPodcasts] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", slug: "", description: "", hostName: "", category: "" });
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<{ podcasts: any[] }>("/api/podcasts");
      setPodcasts(res.podcasts);
      if (!selectedId && res.podcasts.length) setSelectedId(res.podcasts[0].id);
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function createPodcast() {
    if (!form.title || !form.slug || !form.description || !form.hostName || !form.category) {
      toast.error("All fields are required");
      return;
    }
    setCreating(true);
    try {
      const res = await apiFetch<{ podcast: any }>("/api/podcasts", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          slug: form.slug,
          description: form.description,
          hosts: JSON.stringify([{ name: form.hostName }]),
          category: form.category,
        }),
      });
      toast.success("Show created");
      setShowNew(false);
      setForm({ title: "", slug: "", description: "", hostName: "", category: "" });
      await load();
      setSelectedId(res.podcast.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold">Podcasts</h2>
          <p className="text-sm text-muted-foreground">Upload episodes, publish, and track directory distribution.</p>
        </div>
        <Button size="sm" onClick={() => setShowNew((v) => !v)}><Plus className="mr-2 h-4 w-4" /> New show</Button>
      </div>

      {showNew && (
        <Card>
          <CardContent className="space-y-2 pt-4">
            <Input placeholder="Show title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <Input placeholder="Slug (lowercase-with-hyphens)" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
            <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Host name" value={form.hostName} onChange={(e) => setForm((f) => ({ ...f, hostName: e.target.value }))} />
              <Input placeholder="Category (e.g. Science & Medicine)" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <Button size="sm" disabled={creating} onClick={createPodcast}>
              {creating ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null} Create show
            </Button>
          </CardContent>
        </Card>
      )}

      {podcasts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No shows yet. Create one to get started.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="space-y-1">
            {podcasts.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${selectedId === p.id ? "bg-[oklch(0.93_0.04_290)] font-medium" : "hover:bg-muted"}`}
              >
                <Mic className="h-4 w-4 shrink-0" /> {p.title}
                <span className="ml-auto text-xs text-muted-foreground">{p.episodeCount}</span>
              </button>
            ))}
          </div>
          <Card>
            <CardContent className="pt-6">
              {selectedId && <PodcastDetail podcastId={selectedId} />}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
