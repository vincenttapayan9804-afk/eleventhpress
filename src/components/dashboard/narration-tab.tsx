"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Volume2, Loader2, RotateCw } from "lucide-react";

interface NarrationInfo {
  id: string;
  status: string;
  durationSec: number | null;
  errorMessage: string | null;
  audioUrl: string | null;
}

interface Candidate {
  id: string;
  title: string;
  subtitle: string;
  narration: NarrationInfo | null;
}

const CONTENT_TYPES = [
  { value: "ARTICLE", label: "Articles" },
  { value: "MAGAZINE_PIECE", label: "Magazine pieces" },
  { value: "MEDIA_POST", label: "Media posts" },
];

const STATUS_BADGE: Record<string, string> = {
  QUEUED: "bg-muted text-muted-foreground",
  PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

function formatDuration(sec: number | null) {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function NarrationTab() {
  const [contentType, setContentType] = useState("ARTICLE");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ contentType, ...(query ? { query } : {}) });
      const res = await apiFetch<{ items: Candidate[] }>(`/api/narration/candidates?${qs.toString()}`);
      setItems(res.items);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [contentType]);

  async function narrate(contentId: string) {
    setBusyId(contentId);
    try {
      await apiFetch("/api/narration", {
        method: "POST",
        body: JSON.stringify({ contentType, contentId }),
      });
      toast.success("Narration generated");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold">Narration (Kokoro-82M)</h2>
        <p className="text-sm text-muted-foreground">
          Generate a real, downloadable &ldquo;Listen&rdquo; audio track for a published article, magazine piece, or
          media post — runs a free, open-weight text-to-speech model locally, no external API and no per-request cost.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={contentType} onValueChange={setContentType}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CONTENT_TYPES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Search by title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          className="max-w-xs"
        />
        <Button size="sm" variant="outline" onClick={load}>Search</Button>
      </div>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No published items found.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.narration && (
                      <Badge className={STATUS_BADGE[item.narration.status]}>
                        {item.narration.status}
                        {item.narration.durationSec ? ` · ${formatDuration(item.narration.durationSec)}` : ""}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.id}
                      onClick={() => narrate(item.id)}
                    >
                      {busyId === item.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : item.narration ? (
                        <RotateCw className="mr-1.5 h-3 w-3" />
                      ) : (
                        <Volume2 className="mr-1.5 h-3 w-3" />
                      )}
                      {item.narration ? "Re-generate" : "Narrate"}
                    </Button>
                  </div>
                </div>
                {item.narration?.status === "FAILED" && item.narration.errorMessage && (
                  <p className="text-xs text-red-600">{item.narration.errorMessage}</p>
                )}
                {item.narration?.status === "COMPLETED" && item.narration.audioUrl && (
                  <audio controls preload="none" className="w-full" src={item.narration.audioUrl}>
                    Your browser does not support the audio element.
                  </audio>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
