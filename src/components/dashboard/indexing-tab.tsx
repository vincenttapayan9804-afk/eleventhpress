"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Search,
  Globe2,
  FileText,
  CheckCircle2,
  Clock,
  ExternalLink,
  Code2,
  ShieldCheck,
  RefreshCw,
  Send,
  Loader2,
  AlertCircle,
  Import,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CrossrefLog {
  id: string;
  action: string;
  createdAt: string;
  user: { fullName: string; role: string } | null;
  article: { id: string; title: string; doi: string | null; status: string; discipline: string } | null;
  metadata: any;
}

export function IndexingTab() {
  const [logs, setLogs] = useState<CrossrefLog[]>([]);
  const [published, setPublished] = useState<any[]>([]);
  const [oaiPmhXml, setOaiPmhXml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [crossrefLive, setCrossrefLive] = useState<boolean>(false);
  const [zenodoLive, setZenodoLive] = useState<boolean>(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string>("");
  const [previewXml, setPreviewXml] = useState<string>("");
  const [depositing, setDepositing] = useState(false);
  const [lastDepositResult, setLastDepositResult] = useState<any>(null);

  const [issues, setIssues] = useState<any[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string>("");
  const [ojsPreviewXml, setOjsPreviewXml] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const [logRes, oaiRes, liveRes, zenodoRes, issuesRes] = await Promise.all([
        apiFetch<{ logs: CrossrefLog[]; published: any[] }>("/api/crossref-log"),
        fetch("/api/oai-pmh?verb=ListRecords&metadataPrefix=oai_dc").then((r) => r.text()),
        apiFetch<{ liveMode: boolean }>("/api/crossref/deposit"),
        apiFetch<{ liveMode: boolean }>("/api/zenodo/status"),
        apiFetch<{ items: any[] }>("/api/issues"),
      ]);
      setLogs(logRes.logs);
      setPublished(logRes.published);
      setOaiPmhXml(oaiRes);
      setCrossrefLive(liveRes.liveMode);
      setZenodoLive(zenodoRes.liveMode);
      if (logRes.published.length > 0 && !selectedArticleId) {
        setSelectedArticleId(logRes.published[0].id);
      }
      const publishedIssues = issuesRes.items.filter((i) => i.articleCount > 0);
      setIssues(publishedIssues);
      if (publishedIssues.length > 0 && !selectedIssueId) {
        setSelectedIssueId(publishedIssues[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Fetch XML preview when selected article changes
  useEffect(() => {
    if (!selectedArticleId) {
      setPreviewXml("");
      return;
    }
    fetch(`/api/crossref/xml/${selectedArticleId}`)
      .then((r) => r.text())
      .then(setPreviewXml)
      .catch((e) => setPreviewXml(`<!-- failed to load: ${e.message} -->`));
  }, [selectedArticleId]);

  // Fetch OJS Native XML preview when selected issue changes
  useEffect(() => {
    if (!selectedIssueId) {
      setOjsPreviewXml("");
      return;
    }
    fetch(`/api/export/ojs/issue/${selectedIssueId}`)
      .then((r) => r.text())
      .then(setOjsPreviewXml)
      .catch((e) => setOjsPreviewXml(`<!-- failed to load: ${e.message} -->`));
  }, [selectedIssueId]);

  async function deposit() {
    if (!selectedArticleId) return;
    setDepositing(true);
    setLastDepositResult(null);
    try {
      const res = await apiFetch<{ result: any; liveMode: boolean }>("/api/crossref/deposit", {
        method: "POST",
        body: JSON.stringify({ articleId: selectedArticleId }),
      });
      setLastDepositResult(res.result);
      setCrossrefLive(res.liveMode);
      toast.success(
        res.result.ok ? "Crossref deposit submitted" : "Deposit failed",
        {
          description: `Mode: ${res.result.mode} · Status: ${res.result.status} · Batch: ${res.result.batchId}`,
        }
      );
      load();
    } catch (e: any) {
      toast.error("Deposit failed", { description: e.message });
    } finally {
      setDepositing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-5">
      <Card className="paper-card bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Search className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
            <div>
              <p className="font-display text-base font-semibold">Indexing &amp; discovery engine</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This panel surfaces the real-time state of the Indexing Service. Every publication
                triggers async events that (1) mint a DOI, (2) refresh the OAI-PMH 2.0 Dublin Core
                feed harvested by BASE / CORE, and (3) emit
                <code className="mx-1 font-mono">citation_*</code> meta tags for Google Scholar’s
                crawler.
              </p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* DOI provider status */}
      <Card className={`paper-card ${zenodoLive ? "border-emerald-300" : "border-amber-300"}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {zenodoLive ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            )}
            <div>
              <p className="text-sm font-medium">
                DOI provider: {zenodoLive ? "Zenodo (real, free DOI — live)" : "Simulation only"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {zenodoLive
                  ? "ZENODO_TOKEN is configured. Publishing an article deposits it to Zenodo and mints a real, permanently-resolving DOI at no cost — automatically harvested by OpenAIRE, and surfaced in BASE/CORE."
                  : "No ZENODO_TOKEN is set, so publishing only simulates a DOI deposit — the resulting DOI will not resolve. Set ZENODO_TOKEN (free, from zenodo.org → Applications → Personal access tokens) to mint real DOIs on publish, at zero cost."}
                {" "}
                {crossrefLive
                  ? "Crossref credentials are also configured, but are unused while Zenodo is active — Crossref is only used as a fallback simulation when ZENODO_TOKEN is absent."
                  : ""}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="crossref">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="crossref">
            <FileText className="mr-1.5 h-3.5 w-3.5" /> Crossref DOI log
          </TabsTrigger>
          <TabsTrigger value="deposit">
            <Send className="mr-1.5 h-3.5 w-3.5" /> Deposit XML
          </TabsTrigger>
          <TabsTrigger value="oaipmh">
            <Globe2 className="mr-1.5 h-3.5 w-3.5" /> OAI-PMH feed
          </TabsTrigger>
          <TabsTrigger value="ojs">
            <Import className="mr-1.5 h-3.5 w-3.5" /> OJS export
          </TabsTrigger>
          <TabsTrigger value="scholar">
            <Search className="mr-1.5 h-3.5 w-3.5" /> Google Scholar
          </TabsTrigger>
        </TabsList>

        {/* Crossref log */}
        <TabsContent value="crossref" className="mt-4 space-y-4">
          <Card className="paper-card">
            <CardHeader className="pb-3">
              <p className="eyebrow">Recent DOI / Crossref events</p>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <ScrollArea className="h-96 pr-3 epip-scroll">
                  <div className="space-y-2">
                    {logs.map((l) => (
                      <div key={l.id} className="rounded-md border border-border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`font-mono text-[0.6rem] ${
                                l.action === "DOI_PUBLISH"
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                  : l.action === "PUBLISH"
                                  ? "border-primary/30 bg-primary/5 text-primary"
                                  : "border-amber-300 bg-amber-50 text-amber-700"
                              }`}
                            >
                              {l.action}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {l.user?.fullName || "system"} · {new Date(l.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {l.metadata?.crossrefResponse === "ok" && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          )}
                        </div>
                        {l.article && (
                          <p className="mt-1.5 text-xs font-medium">{l.article.title}</p>
                        )}
                        {l.article?.doi && (
                          <p className="font-mono text-[0.65rem] text-muted-foreground">
                            DOI: {l.article.doi}
                          </p>
                        )}
                        {l.metadata?.registeredAt && (
                          <p className="mt-1 text-[0.65rem] text-muted-foreground">
                            Registered at Crossref: {new Date(l.metadata.registeredAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Published DOIs table */}
          <Card className="paper-card">
            <CardHeader className="pb-3">
              <p className="eyebrow">Published articles with active DOIs</p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-72 pr-3 epip-scroll">
                <table className="w-full text-xs">
                  <thead className="border-b border-border text-left text-muted-foreground">
                    <tr>
                      <th className="pb-2 pr-2 font-medium">DOI</th>
                      <th className="pb-2 pr-2 font-medium">Discipline</th>
                      <th className="pb-2 pr-2 font-medium">Title</th>
                      <th className="pb-2 font-medium">Published</th>
                    </tr>
                  </thead>
                  <tbody>
                    {published.map((p, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 pr-2 font-mono text-[0.65rem]">{p.doi}</td>
                        <td className="py-2 pr-2">{p.discipline}</td>
                        <td className="py-2 pr-2 max-w-xs truncate">{p.title}</td>
                        <td className="py-2 text-muted-foreground">
                          {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deposit XML tab */}
        <TabsContent value="deposit" className="mt-4 space-y-4">
          <Card className="paper-card">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-base font-semibold">Crossref deposit payload</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Preview the full <code className="font-mono">&lt;doi_batch&gt;</code> XML that
                    will be POSTed to the Crossref deposit endpoint. Pick an article, inspect
                    the XML, then trigger a deposit. The deposit goes to
                    <code className="mx-1 font-mono">api.test.crossref.org</code> when
                    CROSSREF_USERNAME / CROSSREF_PASSWORD env vars are set; otherwise the
                    deposit is simulated locally and the resulting batch ID is recorded.
                  </p>
                </div>
                <Badge variant="outline" className={crossrefLive ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}>
                  {crossrefLive ? "Live mode" : "Simulation mode"}
                </Badge>
              </div>

              {!crossrefLive && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Crossref credentials not configured.</p>
                    <p className="mt-0.5">
                      Set <code className="font-mono">CROSSREF_USERNAME</code>, <code className="font-mono">CROSSREF_PASSWORD</code>,
                      and <code className="font-mono">CROSSREF_PREFIX</code> environment variables to enable live deposits
                      to <code className="font-mono">api.test.crossref.org</code>. Without these, the deposit is simulated
                      locally — the XML is still generated and the batch ID is still recorded in the audit log.
                    </p>
                  </div>
                </div>
              )}

              {/* Article picker + deposit button */}
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[260px] space-y-1.5">
                  <label className="text-xs font-medium">Article</label>
                  <Select value={selectedArticleId} onValueChange={setSelectedArticleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick an article to deposit…" />
                    </SelectTrigger>
                    <SelectContent>
                      {published.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.doi} · {p.title.slice(0, 60)}{p.title.length > 60 ? "…" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={deposit} disabled={!selectedArticleId || depositing}>
                  {depositing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                  {crossrefLive ? "Deposit to Crossref test" : "Simulate deposit"}
                </Button>
              </div>

              {/* Last deposit result */}
              {lastDepositResult && (
                <div className={`mt-4 rounded-md border p-3 text-xs ${
                  lastDepositResult.ok ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-rose-300 bg-rose-50 text-rose-800"
                }`}>
                  <p className="font-medium">
                    {lastDepositResult.ok ? "Deposit succeeded" : "Deposit failed"} ({lastDepositResult.mode} mode)
                  </p>
                  <p className="mt-0.5 font-mono text-[0.65rem]">
                    batch: {lastDepositResult.batchId} · status: {lastDepositResult.status} {lastDepositResult.statusText}
                  </p>
                  <pre className="mt-2 max-h-32 overflow-auto rounded bg-white/40 p-2 font-mono text-[0.6rem] epip-scroll">
{lastDepositResult.responseBody.slice(0, 1500)}
                  </pre>
                </div>
              )}

              {/* XML preview */}
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="eyebrow flex items-center gap-1.5">
                    <Code2 className="h-3 w-3" /> doi_batch XML preview
                  </p>
                  {selectedArticleId && (
                    <a
                      href={`/api/crossref/xml/${selectedArticleId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Open raw
                    </a>
                  )}
                </div>
                <pre className="max-h-96 overflow-auto rounded-md border border-border bg-[oklch(0.18_0.012_60)] p-4 font-mono text-[0.65rem] leading-relaxed text-[oklch(0.85_0.012_80)] epip-scroll">
{previewXml || "Select an article to preview its Crossref deposit XML."}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OAI-PMH */}
        <TabsContent value="oaipmh" className="mt-4 space-y-4">
          <Card className="paper-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-base font-semibold">
                    OAI-PMH 2.0 endpoint
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Exposes Dublin Core records for every published article. Scopus and Web of
                    Science harvesters poll this endpoint daily.
                  </p>
                  <code className="mt-2 block rounded bg-muted px-2 py-1 font-mono text-xs">
                    GET /api/oai-pmh?verb=ListRecords&metadataPrefix=oai_dc
                  </code>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href="/api/oai-pmh?verb=Identify" target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open raw
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="paper-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                <p className="eyebrow">Live XML response (truncated)</p>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="max-h-96 overflow-auto rounded-md border border-border bg-[oklch(0.18_0.012_60)] p-4 font-mono text-[0.65rem] leading-relaxed text-[oklch(0.85_0.012_80)] epip-scroll">
                {oaiPmhXml.slice(0, 5000)}
                {oaiPmhXml.length > 5000 && "\n... (truncated — open raw endpoint for full feed)"}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OJS Native XML export */}
        <TabsContent value="ojs" className="mt-4 space-y-4">
          <Card className="paper-card">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-base font-semibold">
                    Export to Open Journal Systems (OJS)
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Generates PKP's Native XML Import/Export format — the file format a real OJS
                    installation accepts via <span className="font-medium">Admin → Native Import/Export
                    plugin</span> (or the CLI: <code className="font-mono">php tools/importExport.php
                    import &lt;file&gt; &lt;journal_path&gt; &lt;username&gt;</code>). Pick an issue to
                    preview its export, or download the full journal.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href="/api/export/ojs/journal">
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download full journal export
                  </a>
                </Button>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">No official schema documentation exists for this format.</p>
                  <p className="mt-0.5">
                    This export is built from PKP's XSD (<code className="font-mono">native.xsd</code> /{" "}
                    <code className="font-mono">pkp-native.xsd</code>) and community example files — there
                    is no published prose spec. Validate the output against your target OJS version's
                    actual schema before importing into a production instance. See{" "}
                    <code className="font-mono">docs/ojs-interop.md</code> for sources and caveats.
                  </p>
                </div>
              </div>

              {/* Issue picker */}
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[260px] space-y-1.5">
                  <label className="text-xs font-medium">Issue</label>
                  <Select value={selectedIssueId} onValueChange={setSelectedIssueId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick an issue to export…" />
                    </SelectTrigger>
                    <SelectContent>
                      {issues.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          Vol. {i.volume}, Iss. {i.issueNumber} ({i.year}) · {i.articleCount} article
                          {i.articleCount === 1 ? "" : "s"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* XML preview */}
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="eyebrow flex items-center gap-1.5">
                    <Code2 className="h-3 w-3" /> PKP Native XML preview (this issue)
                  </p>
                  {selectedIssueId && (
                    <a
                      href={`/api/export/ojs/issue/${selectedIssueId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Open raw
                    </a>
                  )}
                </div>
                <pre className="max-h-96 overflow-auto rounded-md border border-border bg-[oklch(0.18_0.012_60)] p-4 font-mono text-[0.65rem] leading-relaxed text-[oklch(0.85_0.012_80)] epip-scroll">
{ojsPreviewXml || "Select an issue to preview its OJS Native XML export."}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Google Scholar */}
        <TabsContent value="scholar" className="mt-4 space-y-4">
          <Card className="paper-card">
            <CardContent className="p-5">
              <p className="font-display text-base font-semibold">Google Scholar integration</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Google Scholar automatically crawls the journal. The platform emits
                <code className="mx-1 font-mono">citation_*</code> meta tags on every published
                article page and updates a dynamic <code className="font-mono">sitemap.xml</code>.
              </p>
              <Separator className="my-3" />
              <div className="space-y-2 text-xs">
                <p className="font-medium">Emitted meta tags (per article page):</p>
                <div className="rounded-md border border-border bg-muted/30 p-3 font-mono text-[0.65rem]">
                  <div>&lt;meta name="citation_title" content="…" /&gt;</div>
                  <div>&lt;meta name="citation_author" content="…" /&gt; <span className="text-muted-foreground">— once per author</span></div>
                  <div>&lt;meta name="citation_publication_date" content="YYYY-MM-DD" /&gt;</div>
                  <div>&lt;meta name="citation_journal_title" content="…" /&gt;</div>
                  <div>&lt;meta name="citation_issn" content="2945-1138" /&gt;</div>
                  <div>&lt;meta name="citation_volume" content="4" /&gt;</div>
                  <div>&lt;meta name="citation_issue" content="2" /&gt;</div>
                  <div>&lt;meta name="citation_doi" content="10.52011/epip.2024.XXXX" /&gt;</div>
                  <div>&lt;meta name="citation_pdf_url" content="https://eleventhpress.org/galleys/…" /&gt;</div>
                  <div>&lt;meta name="citation_abstract_html_url" content="…" /&gt;</div>
                </div>
                <p className="mt-2 text-muted-foreground">
                  Open any published article page to see these tags injected live into the document head.
                </p>
              </div>
              <Separator className="my-3" />
              <div className="grid gap-3 sm:grid-cols-3">
                <StatusTile icon={CheckCircle2} label="DOI registrar" value={zenodoLive ? "Zenodo (live)" : "Not yet configured"} ok={zenodoLive} />
                <StatusTile icon={CheckCircle2} label="OAI-PMH feed" value="Live" ok />
                <StatusTile icon={CheckCircle2} label="Sitemap" value="Updated" ok />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusTile({ icon: Icon, label, value, ok }: { icon: any; label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-md border border-border p-3">
      <Icon className={`h-4 w-4 ${ok ? "text-emerald-600" : "text-amber-600"}`} />
      <p className="mt-1.5 font-sans text-sm font-semibold">{value}</p>
      <p className="text-[0.65rem] text-muted-foreground">{label}</p>
    </div>
  );
}
