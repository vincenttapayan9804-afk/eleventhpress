"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { PLATFORMS, type ShareKit, type SubmissionPackage } from "@/lib/distribution";
import { DISTRIBUTION_PACKAGE_ARTICLE_USD } from "@/lib/pricing";
import { PaymentProviderPicker } from "@/components/billing/payment-provider-picker";
import { Share2, Sparkles, Copy, CheckCircle2, Link as LinkIcon, ChevronDown, ChevronUp, ExternalLink, Zap, Lock } from "lucide-react";

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

function isSubmissionPackage(kit: ShareKit | SubmissionPackage): kit is SubmissionPackage {
  return "authors" in kit && "suggestedCategory" in kit;
}

function ArticleDistribution({ article, bloggerBlogUrl, token }: { article: any; bloggerBlogUrl: string | null; token: string | null }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [kitViewFor, setKitViewFor] = useState<string | null>(null);
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({});
  const [consentChecked, setConsentChecked] = useState<Record<string, boolean>>({});
  const [publishing, setPublishing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const isPaid = !!article.distributionPackagePaidAt;

  async function checkoutDistributionPackage(providerId: string) {
    setPurchasing(true);
    try {
      const { redirectUrl } = await apiFetch<{ redirectUrl: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ kind: "DISTRIBUTION_PACKAGE", target: "ARTICLE", targetId: article.id, provider: providerId }),
      });
      window.location.href = redirectUrl;
    } catch (e: any) {
      toast.error("Checkout failed", { description: e.message });
      setPurchasing(false);
    }
  }

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

  async function generate(platform: string, consent?: boolean) {
    try {
      const res = await apiFetch("/api/distribution", {
        method: "POST",
        body: JSON.stringify({ articleId: article.id, platform, consent }),
      });
      toast.success(`Package generated for ${platform}`);
      setKitViewFor(platform);
      await load();
      return res;
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function publishBlogger() {
    setPublishing(true);
    try {
      const res = await apiFetch("/api/distribution", {
        method: "POST",
        body: JSON.stringify({ articleId: article.id, platform: "BLOGGER" }),
      });
      toast.success("Published to Blogger");
      await load();
      return res;
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPublishing(false);
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
            let kit: ShareKit | SubmissionPackage | null = null;
            try {
              kit = item.packageContent ? JSON.parse(item.packageContent) : null;
            } catch {}

            const needsPurchase = platform.tier === "B" && !isPaid;
            const needsConsent = platform.tier === "B" && !item.authorConsent;
            const canGenerate = !needsPurchase && (!needsConsent || consentChecked[item.platform]);

            if (platform.tier === "A") {
              return (
                <div key={item.platform} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{platform.label}</span>
                      <Badge variant="outline"><Zap className="mr-1 h-3 w-3" /> Auto-publish</Badge>
                      <Badge className={STATUS_BADGE[item.status] || ""}>{item.status.replace(/_/g, " ")}</Badge>
                    </div>
                    {bloggerBlogUrl ? (
                      <Button size="sm" onClick={publishBlogger} disabled={publishing}>
                        <Zap className="mr-1.5 h-3.5 w-3.5" /> {item.status === "LIVE" ? "Republish" : "Publish"} to Blogger
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/api/auth/blogger?token=${encodeURIComponent(token || "")}`}>Connect Blogger</a>
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{platform.postingHint}</p>
                  {bloggerBlogUrl && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Connected blog: <a href={bloggerBlogUrl} target="_blank" rel="noopener noreferrer" className="underline">{bloggerBlogUrl}</a>
                    </p>
                  )}
                  {item.externalUrl && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <a href={item.externalUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                        {item.externalUrl}
                      </a>
                    </div>
                  )}
                  {item.status === "FAILED" && item.notes && (
                    <p className="mt-2 text-xs text-red-700">{item.notes}</p>
                  )}
                </div>
              );
            }

            return (
              <div key={item.platform} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{platform.label}</span>
                    {platform.tier === "B" && <Badge variant="outline">Preprint</Badge>}
                    <Badge className={STATUS_BADGE[item.status] || ""}>{item.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="flex gap-2">
                    {needsPurchase ? (
                      <Button size="sm" disabled={purchasing} onClick={() => setPickerOpen(true)}>
                        <Lock className="mr-1.5 h-3.5 w-3.5" /> Unlock Distribution Package — ${DISTRIBUTION_PACKAGE_ARTICLE_USD.toFixed(0)}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={!canGenerate} onClick={() => generate(item.platform, consentChecked[item.platform])}>
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" /> {item.id ? "Regenerate" : "Generate"} package
                      </Button>
                    )}
                    {kit && (
                      <Button size="sm" variant="ghost" onClick={() => setKitViewFor(kitViewFor === item.platform ? null : item.platform)}>
                        {kitViewFor === item.platform ? "Hide" : "View"} package
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{platform.postingHint}</p>
                {needsPurchase && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    One-time fee unlocks both arXiv and SSRN package generation for this article.
                  </p>
                )}

                {!needsPurchase && needsConsent && (
                  <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 p-2">
                    <Checkbox
                      id={`consent-${article.id}-${item.platform}`}
                      checked={!!consentChecked[item.platform]}
                      onCheckedChange={(v) => setConsentChecked((c) => ({ ...c, [item.platform]: !!v }))}
                    />
                    <label htmlFor={`consent-${article.id}-${item.platform}`} className="text-xs text-amber-900">
                      {platform.consentText}
                    </label>
                  </div>
                )}

                {kitViewFor === item.platform && kit && !isSubmissionPackage(kit) && (
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

                {kitViewFor === item.platform && kit && isSubmissionPackage(kit) && (
                  <div className="mt-3 space-y-2">
                    <Field label="Title" value={kit.title} onCopy={copy} />
                    <Field label="Authors" value={kit.authors} onCopy={copy} />
                    <div className="flex items-center justify-between">
                      <Label>Abstract</Label>
                      <Button size="sm" variant="ghost" onClick={() => copy(kit!.abstract)}>
                        <Copy className="mr-1 h-3 w-3" /> Copy
                      </Button>
                    </div>
                    <Textarea readOnly value={kit.abstract} rows={5} className="text-xs" />
                    <Field label="Keywords" value={kit.keywords} onCopy={copy} />
                    {kit.suggestedCategory && <Field label="Suggested category" value={kit.suggestedCategory} onCopy={copy} />}
                    <Field label="Comment / journal reference" value={kit.comment} onCopy={copy} />

                    <Separator />
                    <Button size="sm" asChild>
                      <a href={platform.submitUrl} target="_blank" rel="noopener noreferrer">
                        Continue to {platform.label} <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
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
      <PaymentProviderPicker
        open={pickerOpen}
        onOpenChange={(open) => !open && setPickerOpen(false)}
        onSelect={checkoutDistributionPackage}
        busy={purchasing}
      />
    </Card>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-muted-foreground">{children}</span>;
}

function Field({ label, value, onCopy }: { label: string; value: string; onCopy: (text: string) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button size="sm" variant="ghost" onClick={() => onCopy(value)}>
          <Copy className="mr-1 h-3 w-3" /> Copy
        </Button>
      </div>
      <Input readOnly value={value} className="h-8 text-xs" />
    </div>
  );
}

export function DistributionTab({ submissions }: Props) {
  const published = submissions.filter((s) => s.status === "PUBLISHED");
  const token = useApp((s) => s.token);
  const [bloggerBlogUrl, setBloggerBlogUrl] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ user: any }>("/api/auth/me")
      .then(({ user }) => setBloggerBlogUrl(user.bloggerBlogUrl || null))
      .catch(() => {});
  }, []);

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
          Generate ready-to-post share kits and prefilled preprint submission packages for each published article, and track where it's been syndicated.
        </p>
      </div>
      {published.map((a) => (
        <ArticleDistribution key={a.id} article={a} bloggerBlogUrl={bloggerBlogUrl} token={token} />
      ))}
    </div>
  );
}
