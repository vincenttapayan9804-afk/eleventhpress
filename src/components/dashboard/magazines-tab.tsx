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
import { Newspaper, Plus, Loader2, ChevronDown, ChevronUp, Trash2, Rocket, CheckCircle2 } from "lucide-react";
import { MAGAZINE_PLATFORMS } from "@/lib/magazine-distribution";

const ISSUE_STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  IN_PRODUCTION: "bg-indigo-100 text-indigo-800",
  PUBLISHED: "bg-green-100 text-green-800",
};
const DIST_STATUS_BADGE: Record<string, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  PACKAGE_READY: "bg-blue-100 text-blue-800",
  SUBMITTED: "bg-purple-100 text-purple-800",
  LIVE: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

function IssueDistribution({ issue }: { issue: any }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const res = await apiFetch<{ items: any[] }>(`/api/magazine-distribution?issueId=${issue.id}`);
      setItems(res.items);
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  useEffect(() => { load(); }, [issue.id]);

  async function generate(platform: string) {
    setBusy(platform);
    try {
      await apiFetch("/api/magazine-distribution", {
        method: "POST",
        body: JSON.stringify({ issueId: issue.id, platform, consent: consent[platform] }),
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
      await apiFetch(`/api/magazine-distribution/${id}`, { method: "PATCH", body: JSON.stringify({ status: "SUBMITTED" }) });
      toast.success("Marked as submitted");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (!items) return <Loader2 className="h-4 w-4 animate-spin" />;

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const def = MAGAZINE_PLATFORMS.find((p) => p.id === item.platform)!;
        return (
          <div key={item.platform} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{def.label}</span>{" "}
                <Badge variant="outline" className="ml-2 text-[0.65rem]">Tier {def.tier}</Badge>
              </div>
              <Badge className={DIST_STATUS_BADGE[item.status]}>{item.status.replace(/_/g, " ")}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{def.postingHint}</p>
            {item.status === "NOT_STARTED" && (
              <div className="mt-2 space-y-2">
                {def.consentText && (
                  <label className="flex items-start gap-2 text-xs">
                    <Checkbox checked={!!consent[item.platform]} onCheckedChange={(v) => setConsent((c) => ({ ...c, [item.platform]: !!v }))} />
                    {def.consentText}
                  </label>
                )}
                <Button size="sm" disabled={busy === item.platform || (def.tier === "B" && !consent[item.platform])} onClick={() => generate(item.platform)}>
                  {busy === item.platform ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null} Generate package
                </Button>
              </div>
            )}
            {item.status === "PACKAGE_READY" && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {def.submitUrl && (
                  <Button asChild size="sm" variant="outline">
                    <a href={def.submitUrl} target="_blank" rel="noopener noreferrer">Continue to {def.label}</a>
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => markSubmitted(item.id)}>
                  {busy === item.id ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-2 h-3 w-3" />} Mark submitted
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function IssueDetail({ issueId, onChanged }: { issueId: string; onChanged: () => void }) {
  const [issue, setIssue] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [pieceForm, setPieceForm] = useState({ title: "", dek: "", authorName: "", category: "Feature", bodyHtml: "" });
  const [addingPiece, setAddingPiece] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ issue: any }>(`/api/magazine-issues/${issueId}`);
      setIssue(res.issue);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [issueId]);

  async function addPiece() {
    if (!pieceForm.title || !pieceForm.authorName || !pieceForm.bodyHtml) {
      toast.error("Title, author, and body are required");
      return;
    }
    setAddingPiece(true);
    try {
      await apiFetch(`/api/magazine-issues/${issueId}/pieces`, {
        method: "POST",
        body: JSON.stringify({
          title: pieceForm.title,
          dek: pieceForm.dek || undefined,
          authors: JSON.stringify([{ name: pieceForm.authorName }]),
          category: pieceForm.category,
          bodyHtml: `<p>${pieceForm.bodyHtml}</p>`,
        }),
      });
      toast.success("Piece added");
      setPieceForm({ title: "", dek: "", authorName: "", category: "Feature", bodyHtml: "" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAddingPiece(false);
    }
  }

  async function removePiece(id: string) {
    try {
      await apiFetch(`/api/magazine-pieces/${id}`, { method: "DELETE" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function runWorkflow(action: string) {
    setWorkflowBusy(true);
    try {
      await apiFetch(`/api/magazine-issues/${issueId}/workflow`, { method: "POST", body: JSON.stringify({ action }) });
      toast.success(action === "SEND_TO_PRODUCTION" ? "Compiling EPUB/PDF…" : "Issue published");
      await load();
      onChanged();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setWorkflowBusy(false);
    }
  }

  if (loading || !issue) return <Loader2 className="h-4 w-4 animate-spin" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-semibold">{issue.title || `Vol. ${issue.volume}, No. ${issue.issueNumber}`}</p>
          <p className="text-xs text-muted-foreground">Vol. {issue.volume}, No. {issue.issueNumber} · {issue.year}</p>
        </div>
        <Badge className={ISSUE_STATUS_BADGE[issue.status]}>{issue.status.replace(/_/g, " ")}</Badge>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pieces ({issue.pieces.length})</p>
        {issue.pieces.map((p: any) => (
          <div key={p.id} className="flex items-start justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{p.title} {p.isCoverStory && <Badge variant="outline" className="ml-1 text-[0.6rem]">Cover story</Badge>}</p>
              <p className="text-xs text-muted-foreground">{p.category} · {(() => { try { return JSON.parse(p.authors).map((a: any) => a.name).join(", "); } catch { return ""; } })()}</p>
            </div>
            {issue.status === "DRAFT" && (
              <Button size="icon" variant="ghost" onClick={() => removePiece(p.id)}><Trash2 className="h-4 w-4" /></Button>
            )}
          </div>
        ))}
      </div>

      {issue.status === "DRAFT" && (
        <Card>
          <CardHeader className="text-sm font-semibold">Add a piece</CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Title" value={pieceForm.title} onChange={(e) => setPieceForm((f) => ({ ...f, title: e.target.value }))} />
            <Input placeholder="Dek / standfirst (optional)" value={pieceForm.dek} onChange={(e) => setPieceForm((f) => ({ ...f, dek: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Author name" value={pieceForm.authorName} onChange={(e) => setPieceForm((f) => ({ ...f, authorName: e.target.value }))} />
              <Input placeholder="Category (e.g. Feature)" value={pieceForm.category} onChange={(e) => setPieceForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <Textarea placeholder="Body text" rows={4} value={pieceForm.bodyHtml} onChange={(e) => setPieceForm((f) => ({ ...f, bodyHtml: e.target.value }))} />
            <Button size="sm" disabled={addingPiece} onClick={addPiece}>
              {addingPiece ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Plus className="mr-2 h-3 w-3" />} Add piece
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="flex flex-wrap gap-2">
        {issue.status === "DRAFT" && (
          <Button disabled={workflowBusy || issue.pieces.length === 0} onClick={() => runWorkflow("SEND_TO_PRODUCTION")}>
            {workflowBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />} Compile EPUB/PDF
          </Button>
        )}
        {issue.status === "IN_PRODUCTION" && (
          <>
            {issue.epubUrl && <Button asChild variant="outline" size="sm"><a href={issue.epubUrl} target="_blank" rel="noopener noreferrer">Preview EPUB</a></Button>}
            {issue.pdfUrl && <Button asChild variant="outline" size="sm"><a href={issue.pdfUrl} target="_blank" rel="noopener noreferrer">Preview PDF</a></Button>}
            <Button disabled={workflowBusy} onClick={() => runWorkflow("PUBLISH")}>
              {workflowBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Publish
            </Button>
          </>
        )}
      </div>

      {issue.status === "PUBLISHED" && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Distribution</p>
          <IssueDistribution issue={issue} />
        </div>
      )}
    </div>
  );
}

export function MagazinesTab() {
  const [magazines, setMagazines] = useState<any[]>([]);
  const [selectedMagazineId, setSelectedMagazineId] = useState<string | null>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [magForm, setMagForm] = useState({ name: "", slug: "", description: "" });
  const [creatingMag, setCreatingMag] = useState(false);
  const [showNewMag, setShowNewMag] = useState(false);
  const [issueForm, setIssueForm] = useState({ volume: "1", issueNumber: "1", year: String(new Date().getFullYear()), title: "" });
  const [creatingIssue, setCreatingIssue] = useState(false);
  const [showNewIssue, setShowNewIssue] = useState(false);

  async function loadMagazines() {
    try {
      const res = await apiFetch<{ magazines: any[] }>("/api/magazines");
      setMagazines(res.magazines);
      if (!selectedMagazineId && res.magazines.length) setSelectedMagazineId(res.magazines[0].id);
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  useEffect(() => { loadMagazines(); }, []);

  async function loadIssues(magazineId: string) {
    try {
      const res = await apiFetch<{ issues: any[] }>(`/api/magazines/${magazineId}`);
      setIssues(res.issues);
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  useEffect(() => {
    if (selectedMagazineId) loadIssues(selectedMagazineId);
  }, [selectedMagazineId]);

  async function createMagazine() {
    if (!magForm.name || !magForm.slug || !magForm.description) {
      toast.error("Name, slug, and description are required");
      return;
    }
    setCreatingMag(true);
    try {
      const res = await apiFetch<{ magazine: any }>("/api/magazines", { method: "POST", body: JSON.stringify(magForm) });
      toast.success("Magazine created");
      setMagForm({ name: "", slug: "", description: "" });
      setShowNewMag(false);
      await loadMagazines();
      setSelectedMagazineId(res.magazine.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreatingMag(false);
    }
  }

  async function createIssue() {
    if (!selectedMagazineId) return;
    setCreatingIssue(true);
    try {
      const res = await apiFetch<{ issue: any }>(`/api/magazines/${selectedMagazineId}/issues`, {
        method: "POST",
        body: JSON.stringify({
          volume: parseInt(issueForm.volume, 10),
          issueNumber: parseInt(issueForm.issueNumber, 10),
          year: parseInt(issueForm.year, 10),
          title: issueForm.title || undefined,
        }),
      });
      toast.success("Issue created");
      setShowNewIssue(false);
      setIssueForm({ volume: "1", issueNumber: "1", year: String(new Date().getFullYear()), title: "" });
      await loadIssues(selectedMagazineId);
      setSelectedIssueId(res.issue.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreatingIssue(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold">Magazines</h2>
          <p className="text-sm text-muted-foreground">Assemble issues, compile EPUB/PDF, and track wide distribution.</p>
        </div>
        <Button size="sm" onClick={() => setShowNewMag((v) => !v)}>
          <Plus className="mr-2 h-4 w-4" /> New magazine
        </Button>
      </div>

      {showNewMag && (
        <Card>
          <CardContent className="space-y-2 pt-4">
            <Input placeholder="Name" value={magForm.name} onChange={(e) => setMagForm((f) => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Slug (lowercase-with-hyphens)" value={magForm.slug} onChange={(e) => setMagForm((f) => ({ ...f, slug: e.target.value }))} />
            <Textarea placeholder="Description" value={magForm.description} onChange={(e) => setMagForm((f) => ({ ...f, description: e.target.value }))} />
            <Button size="sm" disabled={creatingMag} onClick={createMagazine}>
              {creatingMag ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null} Create
            </Button>
          </CardContent>
        </Card>
      )}

      {magazines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No magazines yet. Create one to get started.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="space-y-1">
            {magazines.map((m) => (
              <button
                key={m.id}
                onClick={() => { setSelectedMagazineId(m.id); setSelectedIssueId(null); }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${selectedMagazineId === m.id ? "bg-[oklch(0.93_0.04_290)] font-medium" : "hover:bg-muted"}`}
              >
                <Newspaper className="h-4 w-4 shrink-0" /> {m.name}
                <span className="ml-auto text-xs text-muted-foreground">{m.issueCount}</span>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {selectedMagazineId && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Issues</p>
                  <Button size="sm" variant="outline" onClick={() => setShowNewIssue((v) => !v)}>
                    <Plus className="mr-1 h-3 w-3" /> New issue
                  </Button>
                </div>

                {showNewIssue && (
                  <Card>
                    <CardContent className="space-y-2 pt-4">
                      <div className="grid grid-cols-3 gap-2">
                        <div><Label className="text-xs">Volume</Label><Input type="number" value={issueForm.volume} onChange={(e) => setIssueForm((f) => ({ ...f, volume: e.target.value }))} /></div>
                        <div><Label className="text-xs">Number</Label><Input type="number" value={issueForm.issueNumber} onChange={(e) => setIssueForm((f) => ({ ...f, issueNumber: e.target.value }))} /></div>
                        <div><Label className="text-xs">Year</Label><Input type="number" value={issueForm.year} onChange={(e) => setIssueForm((f) => ({ ...f, year: e.target.value }))} /></div>
                      </div>
                      <Input placeholder="Title (optional)" value={issueForm.title} onChange={(e) => setIssueForm((f) => ({ ...f, title: e.target.value }))} />
                      <Button size="sm" disabled={creatingIssue} onClick={createIssue}>
                        {creatingIssue ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null} Create issue
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  {issues.map((issue) => (
                    <Card key={issue.id}>
                      <button
                        className="flex w-full items-center justify-between p-4 text-left"
                        onClick={() => setSelectedIssueId(selectedIssueId === issue.id ? null : issue.id)}
                      >
                        <div>
                          <p className="text-sm font-medium">{issue.title || `Vol. ${issue.volume}, No. ${issue.issueNumber}`}</p>
                          <p className="text-xs text-muted-foreground">Vol. {issue.volume}, No. {issue.issueNumber} · {issue.year}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={ISSUE_STATUS_BADGE[issue.status]}>{issue.status.replace(/_/g, " ")}</Badge>
                          {selectedIssueId === issue.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </button>
                      {selectedIssueId === issue.id && (
                        <CardContent className="border-t pt-4">
                          <IssueDetail issueId={issue.id} onChanged={() => selectedMagazineId && loadIssues(selectedMagazineId)} />
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
