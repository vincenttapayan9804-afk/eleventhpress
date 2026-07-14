"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { PLATFORMS } from "@/lib/distribution";
import { Share2, Sparkles, Copy, CheckCircle2, Link as LinkIcon, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  submissions: any[];
}

const STATUS_BADGE: Record<string, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  PACKAGE_READY: "bg-blue-100 text-blue-800",
  AWAITING_AUTHOR_ACTION: "bg-amber-100 text-amber-800",
  SUBMITTED: "bg-purple-100 text-purple-800",
  LIVE: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

function ArticleDistribution({ article }: { article: any }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [kitViewFor, setKitViewFor] = useState<string | null>(null);
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/distribution?articleId=${article.id}`);
      setItems(res.items);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (expanded && !items) load();
  }, [expanded]);

  async function generate(platform: string) {
    try {
      const res = await apiFetch("/api/distribution", {
        method: "POST",
        body: JSON.stringify({ articleId: article.id, platform }),
      });
      toast.success(`Share kit generated for ${platform}`);
      setKitViewFor(platform);
      await load();
      return res;
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function markSubmitted(id: string, status: "SUBMITTED" | "LIVE") {
    try {
      await apiFetch(`/api/distribution/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, externalUrl: urlDrafts[id] || undefined }),
      });
      toast.success("Status updated");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  return (
    <Card className="paper-card">
      <CardHeader className="flex flex-row items-center justify-between p-4">
        <div>
          <p className="font-display font-medium">{article.title}</p>
          <p className="text-xs text-muted-foreground">{article.discipline}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3 border-t p-4">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {items?.map((item) => {
            const platform = PLATFORMS.find((p) => p.id === item.platform)!;
            let kit: { blurb: string; excerpt: string; canonicalUrl: string } | null = null;
            try {
              kit = item.packageContent ? JSON.parse(item.packageContent) : null;
            } catch {}
            return (
              <div key={item.platform} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{platform.label}</span>
                    <Badge className={STATUS_BADGE[item.status] || ""}>{item.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => generate(item.platform)}>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" /> {item.id ? "Regenerate" : "Generate"} kit
                    </Button>
                    {kit && (
                      <Button size="sm" variant="ghost" onClick={() => setKitViewFor(kitViewFor === item.platform ? null : item.platform)}>
                        {kitViewFor === item.platform ? "Hide" : "View"} kit
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{platform.postingHint}</p>

                {kitViewFor === item.platform && kit && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Blurb</Label>
                      <Button size="sm" variant="ghost" onClick={() => copy(kit!.blurb)}>
                        <Copy className="mr-1 h-3 w-3" /> Copy
                      </Button>
                    </div>
                    <Textarea readOnly value={kit.blurb} rows={4} className="text-xs" />
                    <div className="flex items-center justify-between">
                      <Label>Repurposed excerpt (Markdown)</Label>
                      <Button size="sm" variant="ghost" onClick={() => copy(kit!.excerpt)}>
                        <Copy className="mr-1 h-3 w-3" /> Copy
                      </Button>
                    </div>
                    <Textarea readOnly value={kit.excerpt} rows={6} className="text-xs" />

                    <Separator />
                    <div className="flex flex-wrap items-center gap-2">
                      <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Paste the live URL once posted (optional)"
                        value={urlDrafts[item.id] ?? item.externalUrl ?? ""}
                        onChange={(e) => setUrlDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                        className="h-8 max-w-xs text-xs"
                      />
                      <Button size="sm" variant="outline" onClick={() => markSubmitted(item.id, "SUBMITTED")}>
                        Mark submitted
                      </Button>
                      <Button size="sm" onClick={() => markSubmitted(item.id, "LIVE")}>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark live
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-muted-foreground">{children}</span>;
}

export function DistributionTab({ submissions }: Props) {
  const published = submissions.filter((s) => s.status === "PUBLISHED");

  if (published.length === 0) {
    return (
      <Card className="paper-card">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Share2 className="h-10 w-10 text-muted-foreground" />
          <p className="mt-4 font-display text-lg font-medium">No published articles yet</p>
          <p className="text-sm text-muted-foreground">
            Distribution kits become available once an article is published.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-lg font-medium">Article distribution</p>
        <p className="text-sm text-muted-foreground">
          Generate ready-to-post share kits for each published article and track where it's been syndicated.
        </p>
      </div>
      {published.map((a) => (
        <ArticleDistribution key={a.id} article={a} />
      ))}
    </div>
  );
}
