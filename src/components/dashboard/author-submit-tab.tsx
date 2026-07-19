"use client";

import { useState, useRef } from "react";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  FileText,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  X,
  ShieldCheck,
  FileCheck2,
  Sparkles,
  Upload,
  CloudUpload,
  Globe2,
  Landmark,
} from "lucide-react";
import { DISCIPLINES, CREDIT_ROLES, INSIGHT_CATEGORIES, INSIGHT_CATEGORY_LABELS, KEY_TAKEAWAYS_COUNT, type InsightCategory } from "@/lib/article";

interface Props {
  onSubmitted: () => void;
}

interface Author {
  name: string;
  affiliation: string;
  orcid?: string;
  email: string;
  rorId?: string;
  creditRoles?: string[];
}

interface Funder {
  name: string;
  id?: string;
  awardNumber?: string;
}

interface UploadedFile {
  key: string;
  filename: string;
  size: number;
  contentType: string;
}

// Uploads are proxied through this app's own serverless function (see
// handleFileSelected below for why), so this has to stay comfortably
// under Vercel's ~4.5MB request-body limit rather than the 50MB a
// direct-to-blob upload could otherwise handle.
const MAX_MANUSCRIPT_MB = 4;
const MAX_MANUSCRIPT_BYTES = MAX_MANUSCRIPT_MB * 1024 * 1024;

export function AuthorSubmitTab({ onSubmitted }: Props) {
  const { user, openDashboard } = useApp();
  const isExpert = user?.role === "EXPERT";
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ doi: string; plagiarismScore: number; status: string } | null>(null);

  const [form, setForm] = useState({
    title: "",
    abstract: "",
    keywords: "",
    discipline: "Physics",
    insightCategory: "" as InsightCategory | "",
    reviewModel: "DOUBLE_BLIND",
    openReview: false,
    apcWaiverRequested: false,
    apcWaiverReason: "",
  });
  // The Publication Charter's mandatory "Key Takeaways" box — exactly 5
  // bullets, required for every Expert Insight, unused for RESEARCH.
  const [keyTakeaways, setKeyTakeaways] = useState<string[]>(Array(KEY_TAKEAWAYS_COUNT).fill(""));
  function updateTakeaway(i: number, value: string) {
    setKeyTakeaways((prev) => prev.map((t, idx) => (idx === i ? value : t)));
  }
  const [authors, setAuthors] = useState<Author[]>([
    {
      name: user?.fullName || "",
      affiliation: user?.affiliation || "",
      orcid: user?.orcid || "",
      email: user?.email || "",
      rorId: "",
      creditRoles: [],
    },
  ]);
  const [funders, setFunders] = useState<Funder[]>([]);
  const [references, setReferences] = useState("");

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addAuthor() {
    setAuthors([...authors, { name: "", affiliation: "", email: "", rorId: "", creditRoles: [] }]);
  }
  function removeAuthor(i: number) {
    setAuthors(authors.filter((_, idx) => idx !== i));
  }
  function updateAuthor(i: number, field: keyof Author, value: string) {
    setAuthors(authors.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));
  }
  function toggleAuthorRole(i: number, role: string) {
    setAuthors(
      authors.map((a, idx) => {
        if (idx !== i) return a;
        const roles = a.creditRoles || [];
        return { ...a, creditRoles: roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role] };
      })
    );
  }

  function addFunder() {
    setFunders([...funders, { name: "", id: "", awardNumber: "" }]);
  }
  function removeFunder(i: number) {
    setFunders(funders.filter((_, idx) => idx !== i));
  }
  function updateFunder(i: number, field: keyof Funder, value: string) {
    setFunders(funders.map((f, idx) => (idx === i ? { ...f, [field]: value } : f)));
  }

  function validateStep(): string | null {
    if (step === 1) {
      if (!form.title.trim()) return `Please enter a title for your ${isExpert ? "insight" : "manuscript"}.`;
      if (form.title.trim().length < 6) return "Title must be at least 6 characters.";
      if (!form.abstract.trim()) return "Please enter an abstract.";
      if (form.abstract.trim().length < 50) return `Abstract must be at least 50 characters (currently ${form.abstract.trim().length}).`;
      if (isExpert) {
        const filled = keyTakeaways.map((t) => t.trim()).filter(Boolean);
        if (filled.length !== KEY_TAKEAWAYS_COUNT) return `Key Takeaways must have exactly ${KEY_TAKEAWAYS_COUNT} filled-in bullet points.`;
        const refCount = references.split("\n").map((r) => r.trim()).filter(Boolean).length;
        if (refCount < 1) return "Per the Publication Charter, every Insight must cite at least one data source or peer-reviewed reference.";
      }
      return null;
    }
    if (step === 2) {
      const missing = authors.findIndex((a) => !a.name.trim() || !a.email.trim());
      if (missing !== -1) return `Author ${missing + 1} is missing a name or email address.`;
      return null;
    }
    if (step === 3) {
      if (isExpert) {
        if (!form.insightCategory) return "Please select an Insight Category.";
      } else if (!form.discipline) {
        return "Please select a discipline.";
      }
      if (!form.reviewModel) return "Please select a review model.";
      return null;
    }
    return null;
  }

  function handleContinue() {
    const error = validateStep();
    if (error) {
      toast.error("Cannot continue", { description: error });
      return;
    }
    setStep(step + 1);
  }

  // ----- Real pre-signed S3-style upload -----
  async function handleFileSelected(file: File) {
    if (!file) return;
    // Basic validation
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/markdown",
      "text/plain",
      "text/html",
      "application/x-tex",
    ];
    const allowedExt = [".pdf", ".docx", ".doc", ".md", ".txt", ".html", ".tex"];
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!allowedTypes.includes(file.type) && !allowedExt.includes(ext)) {
      toast.error("Unsupported file type", {
        description: "Allowed: PDF, DOCX, DOC, MD, TXT, HTML, TEX",
      });
      return;
    }
    if (file.size > MAX_MANUSCRIPT_BYTES) {
      toast.error("File too large", { description: `Maximum ${MAX_MANUSCRIPT_MB} MB.` });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      // Always proxied through our own server rather than Vercel Blob's
      // direct-to-browser client-token protocol. That protocol requires a
      // classic BLOB_READ_WRITE_TOKEN to sign client tokens — an OIDC-only
      // Blob connection (BLOB_STORE_ID) doesn't have one, which is exactly
      // why uploads were failing with "Failed to retrieve the client
      // token". Proxying through this app's own API does still reach real
      // Blob storage (via putObject() in storage.ts, which is OIDC-aware)
      // — the tradeoff is the file now passes through a serverless
      // function, which is why the size cap below is well under Vercel's
      // ~4.5MB request-body limit rather than the 50MB the direct-to-blob
      // path could otherwise handle. If a real BLOB_READ_WRITE_TOKEN gets
      // added later, this cap can go back up and the direct-to-blob path
      // (still implemented in /api/storage/presign) can be re-enabled.
      const presign = await apiFetch<{
        uploadUrl: string;
        key: string;
        headers: Record<string, string>;
      }>("/api/storage/presign-local", {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          bucket: "raw-submissions",
        }),
      });

      const uploadRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        body: file,
        headers: presign.headers,
      });
      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Upload failed (${uploadRes.status}): ${errText}`);
      }
      const key = presign.key;

      setUploadedFile({
        key,
        filename: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      });
      setUploadProgress(100);
      toast.success("Manuscript uploaded", {
        description: `${file.name} (${formatBytes(file.size)}) — stored at ${key}`,
      });
    } catch (e: any) {
      toast.error("Upload failed", { description: e.message });
    } finally {
      setUploading(false);
    }
  }

  function onFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  }

  async function submit() {
    setLoading(true);
    try {
      const res = await apiFetch<{ article: { doi: string; plagiarismScore: number; status: string } }>(
        "/api/articles/submit",
        {
          method: "POST",
          body: JSON.stringify({
            ...form,
            authors,
            funders,
            references: references.split("\n").map((r) => r.trim()).filter(Boolean),
            manuscriptKey: uploadedFile?.key,
            manuscriptName: uploadedFile?.filename,
            keyTakeaways: isExpert ? keyTakeaways.map((t) => t.trim()).filter(Boolean) : undefined,
          }),
        }
      );
      setResult(res.article);
      toast.success("Submission received", {
        description: `Draft DOI: ${res.article.doi} · Plagiarism: ${res.article.plagiarismScore}%`,
      });
    } catch (e: any) {
      toast.error("Submission failed", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <Card className="paper-card">
        <CardContent className="p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-semibold">Submission received</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {isExpert
              ? "Your insight has entered the Council's editorial pipeline for board review. A tracking reference has been assigned and the editorial office has been notified."
              : <>Your manuscript has entered the editorial pipeline. A tracking reference has been
              assigned, the manuscript has been stored in the <code className="font-mono text-xs">raw-submissions</code> bucket,
              and the editorial office has been notified.</>}
          </p>
          <div className="mx-auto mt-6 max-w-md rounded-md border border-border bg-muted/30 p-4 text-left text-sm">
            <Row label="Tracking reference" value={<code className="font-mono text-xs">{result.doi}</code>} />
            <Row label="Similarity score" value={`${result.plagiarismScore}% (in-corpus)`} />
            <Row label="Workflow status" value={<Badge variant="outline" className="font-mono text-[0.6rem]">{result.status}</Badge>} />
            <Row label="Review model" value={form.reviewModel.replace("_", " ")} />
            <Row label="Open peer review" value={form.openReview ? "Enabled — reviews will be public" : "Disabled"} />
            {uploadedFile && (
              <Row label="Manuscript" value={<code className="font-mono text-xs">{uploadedFile.filename}</code>} />
            )}
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => { setResult(null); setStep(1); setForm({ title: "", abstract: "", keywords: "", discipline: "Physics", insightCategory: "", reviewModel: "DOUBLE_BLIND", openReview: false, apcWaiverRequested: false, apcWaiverReason: "" }); setUploadedFile(null); setFunders([]); setReferences(""); setKeyTakeaways(Array(KEY_TAKEAWAYS_COUNT).fill("")); }}>
              Submit another
            </Button>
            <Button variant="outline" onClick={() => { onSubmitted(); openDashboard("myArticles"); }}>
              View my articles <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="paper-card">
        <CardHeader>
          <p className="eyebrow">{isExpert ? "New Expert Insight" : "New submission"}</p>
          <h2 className="font-display text-2xl font-semibold">
            {isExpert ? "Submit an Insight" : "Submit a manuscript"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isExpert
              ? "Complete the three-step form below. Every Insight opens with a Key Takeaways box, must cite at least one source, and is board-reviewed before publication — see the Publication Charter for the full standard."
              : "Complete the three-step form below. A tracking reference is assigned upon submission (your real, permanently-resolving DOI is minted upon publication), the manuscript is uploaded to private S3-style storage via a pre-signed PUT URL, and an in-corpus similarity check runs against every other article already in the journal."}
          </p>
        </CardHeader>
        <CardContent>
          {/* Stepper */}
          <div className="mb-8 flex items-center justify-between">
            {[
              { n: 1, label: isExpert ? "Insight details" : "Manuscript details", icon: FileText },
              { n: 2, label: "Authors & affiliations", icon: ShieldCheck },
              { n: 3, label: isExpert ? "Category & review" : "Classification & review", icon: FileCheck2 },
            ].map((s, i) => {
              const active = step === s.n;
              const done = step > s.n;
              return (
                <div key={s.n} className="flex flex-1 items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                        done
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : s.n}
                    </div>
                    <span className={`hidden text-xs font-medium sm:inline ${active ? "text-foreground" : "text-muted-foreground"}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < 2 && <div className={`mx-2 h-px flex-1 ${done ? "bg-emerald-500" : "bg-border"}`} />}
                </div>
              );
            })}
          </div>

          {/* Step 1: Manuscript details */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">{isExpert ? "Insight title" : "Article title"}</Label>
                <Input
                  id="title"
                  placeholder={isExpert ? "e.g. Why Boards Are Getting AI Governance Wrong" : "e.g. Topological Signatures in Strain-Engineered Transition Metal Dichalcogenides"}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="abstract">Abstract</Label>
                <Textarea
                  id="abstract"
                  rows={8}
                  placeholder="Paste your structured abstract here (min. 50 characters). The abstract is what reviewers and search engines see first."
                  value={form.abstract}
                  onChange={(e) => setForm({ ...form, abstract: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">{form.abstract.length} characters</p>
              </div>

              {isExpert && (
                <div className="space-y-1.5 rounded-md border border-primary/30 bg-primary/5 p-4">
                  <Label className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Key Takeaways (5 required Executive Insights)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Per the Enterprise-Grade Formatting standard, every Insight opens with exactly
                    5 bulleted takeaways for enhanced enterprise readership.
                  </p>
                  <div className="mt-2 space-y-2">
                    {keyTakeaways.map((t, i) => (
                      <Input
                        key={i}
                        value={t}
                        onChange={(e) => updateTakeaway(i, e.target.value)}
                        placeholder={`Takeaway ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                <Input
                  id="keywords"
                  placeholder="quantum materials, superconductivity, topological insulators"
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="references">{isExpert ? "Cited sources (at least 1 required, one per line)" : "References (optional, one per line)"}</Label>
                <Textarea
                  id="references"
                  rows={5}
                  placeholder={"Smith, J. (2023). A study of X. Journal of Y, 12(3), 45-67. https://doi.org/10.1234/example\nDoe, A. et al. (2021). Another paper. ..."}
                  value={references}
                  onChange={(e) => setReferences(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {isExpert
                    ? "Even opinion pieces must cite data or peer-reviewed sources, per the Publication Charter's intellectual-rigor standard."
                    : "An editor will validate these against OpenAlex before publication."}
                </p>
              </div>

              {/* Real file upload */}
              <div className="space-y-1.5">
                <Label htmlFor="manuscript">{isExpert ? "Insight file" : "Manuscript file"}</Label>
                <input
                  ref={fileInputRef}
                  id="manuscript"
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.doc,.md,.txt,.html,.tex"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelected(f);
                  }}
                />
                {uploadedFile ? (
                  <div className="flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <div>
                        <p className="text-sm font-medium">{uploadedFile.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(uploadedFile.size)} · stored at <code className="font-mono text-[0.65rem]">{uploadedFile.key}</code>
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setUploadedFile(null); setUploadProgress(0); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-8 text-center transition-colors ${
                      dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="mt-3 text-sm font-medium">Uploading…</p>
                        <p className="text-xs text-muted-foreground">
                          Requesting pre-signed URL and streaming to storage…
                        </p>
                      </>
                    ) : (
                      <>
                        <CloudUpload className="h-8 w-8 text-muted-foreground" />
                        <p className="mt-3 text-sm font-medium">Drop your manuscript here or click to browse</p>
                        <p className="text-xs text-muted-foreground">
                          PDF, DOCX, MD, TXT, HTML, TEX · max {MAX_MANUSCRIPT_MB} MB
                        </p>
                        <p className="mt-2 text-[0.7rem] text-muted-foreground">
                          A pre-signed PUT URL is requested from <code className="font-mono">/api/storage/presign-local</code> —
                          the file streams to private S3-style storage.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Authors */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                List all authors in the order they should appear on the published article. The first
                author will be the corresponding author by default.
              </p>
              {authors.map((a, i) => (
                <Card key={i} className="border-border">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-[0.65rem]">
                        Author {i + 1} {i === 0 && "· corresponding"}
                      </Badge>
                      {authors.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeAuthor(i)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs" htmlFor={`author-${i}-name`}>Full name</Label>
                        <Input id={`author-${i}-name`} value={a.name} onChange={(e) => updateAuthor(i, "name", e.target.value)} placeholder="Dr. Jane Doe" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs" htmlFor={`author-${i}-email`}>Email</Label>
                        <Input id={`author-${i}-email`} type="email" value={a.email} onChange={(e) => updateAuthor(i, "email", e.target.value)} placeholder="jane@university.edu" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs" htmlFor={`author-${i}-affiliation`}>Affiliation</Label>
                        <Input id={`author-${i}-affiliation`} value={a.affiliation} onChange={(e) => updateAuthor(i, "affiliation", e.target.value)} placeholder="University of Example" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs" htmlFor={`author-${i}-orcid`}>ORCID (optional)</Label>
                        <Input id={`author-${i}-orcid`} value={a.orcid || ""} onChange={(e) => updateAuthor(i, "orcid", e.target.value)} placeholder="0000-0002-..." />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs" htmlFor={`author-${i}-ror`}>ROR ID (optional)</Label>
                        <Input
                          id={`author-${i}-ror`}
                          value={a.rorId || ""}
                          onChange={(e) => updateAuthor(i, "rorId", e.target.value)}
                          placeholder="e.g. 057zh3y96 — from ror.org, identifies the affiliation above"
                        />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <Label className="text-xs">CRediT contributor roles (optional)</Label>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                        {CREDIT_ROLES.map((role) => (
                          <label key={role} className="flex items-center gap-1.5 text-xs">
                            <Checkbox
                              checked={(a.creditRoles || []).includes(role)}
                              onCheckedChange={() => toggleAuthorRole(i, role)}
                            />
                            {role}
                          </label>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={addAuthor}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add author
              </Button>

              <Separator className="my-4" />
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5" /> Funders (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Funding bodies that supported this research, for Crossref FundRef deposit.
                </p>
              </div>
              {funders.map((f, i) => (
                <Card key={i} className="border-border">
                  <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`funder-${i}-name`}>Funder name</Label>
                      <Input id={`funder-${i}-name`} value={f.name} onChange={(e) => updateFunder(i, "name", e.target.value)} placeholder="National Science Foundation" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`funder-${i}-id`}>Funder ID (optional)</Label>
                      <Input id={`funder-${i}-id`} value={f.id || ""} onChange={(e) => updateFunder(i, "id", e.target.value)} placeholder="Crossref Funder ID / ROR" />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs" htmlFor={`funder-${i}-award`}>Award number (optional)</Label>
                        <Input id={`funder-${i}-award`} value={f.awardNumber || ""} onChange={(e) => updateFunder(i, "awardNumber", e.target.value)} placeholder="GRANT-12345" />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeFunder(i)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={addFunder}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add funder
              </Button>
            </div>
          )}

          {/* Step 3: Classification & review */}
          {step === 3 && (
            <div className="space-y-4">
              {isExpert ? (
                <div className="space-y-1.5">
                  <Label htmlFor="insightCategory">Insight Category</Label>
                  <Select value={form.insightCategory} onValueChange={(v) => setForm({ ...form, insightCategory: v as InsightCategory })}>
                    <SelectTrigger id="insightCategory">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {INSIGHT_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{INSIGHT_CATEGORY_LABELS[c]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Determines where your Insight appears in the Council of Experts' Directory.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="discipline">Primary discipline</Label>
                  <Select value={form.discipline} onValueChange={(v) => setForm({ ...form, discipline: v })}>
                    <SelectTrigger id="discipline">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISCIPLINES.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Used by Elasticsearch to match your paper against the reviewer pool.
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="review">{isExpert ? "Council review model" : "Peer-review model"}</Label>
                <Select value={form.reviewModel} onValueChange={(v) => setForm({ ...form, reviewModel: v })}>
                  <SelectTrigger id="review">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOUBLE_BLIND">Double-blind (default — both authors and reviewers anonymised)</SelectItem>
                    <SelectItem value="SINGLE_BLIND">Single-blind (reviewers anonymised, authors known)</SelectItem>
                    <SelectItem value="OPEN">Open (identities visible to all parties)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Open peer review toggle */}
              <div className="rounded-md border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Globe2 className="h-4 w-4 text-primary" />
                      <p className="font-display text-sm font-semibold">Open peer review</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      When enabled, completed reviews (reviewer name, affiliation, ORCID,
                      recommendation, scores, and comments-to-author) will be published
                      alongside the article upon publication. This is independent of the
                      review-model above — even double-blind reviews can be released after
                      acceptance, as is common in venues like eLife and EMBO.
                    </p>
                  </div>
                  <Switch
                    checked={form.openReview}
                    onCheckedChange={(v) => setForm({ ...form, openReview: v })}
                  />
                </div>
              </div>

              {/* APC waiver request — not applicable to Expert Insights, which
                  carry no article processing charge */}
              {!isExpert && (
                <div className="rounded-md border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-primary" />
                        <p className="font-display text-sm font-semibold">Request an APC waiver</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        If you cannot cover the article processing charge (e.g. no institutional funding,
                        based in a low/middle-income country), request a full or partial waiver. An editor
                        will review this request before the article proceeds to production.
                      </p>
                    </div>
                    <Switch
                      checked={form.apcWaiverRequested}
                      onCheckedChange={(v) => setForm({ ...form, apcWaiverRequested: v })}
                    />
                  </div>
                  {form.apcWaiverRequested && (
                    <div className="mt-3 space-y-1.5">
                      <Label htmlFor="waiverReason" className="text-xs">Reason for waiver request</Label>
                      <Textarea
                        id="waiverReason"
                        rows={3}
                        placeholder="Briefly explain your funding situation…"
                        value={form.apcWaiverReason}
                        onChange={(e) => setForm({ ...form, apcWaiverReason: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              )}

              <Separator className="my-4" />
              <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
                <p className="flex items-center gap-2 font-display text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" /> What happens next?
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li>· A tracking reference is assigned (your real DOI is minted upon publication).</li>
                  <li>· The {isExpert ? "insight" : "manuscript"} is uploaded to private S3-style storage with a pre-signed PUT URL.</li>
                  <li>· An in-corpus similarity check runs against every other {isExpert ? "insight" : "article"} already published.</li>
                  {isExpert ? (
                    <li>· The Council board reviews it for industry relevance and professional alignment.</li>
                  ) : (
                    <li>· If double-blind, an anonymised copy of your PDF is created for reviewers.</li>
                  )}
                  <li>· Editors are notified and the {isExpert ? "insight" : "article"} enters the SUBMITTED state.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <Button
              variant="ghost"
              onClick={() => (step === 1 ? openDashboard("overview") : setStep(step - 1))}
              disabled={loading}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" /> {step === 1 ? "Cancel" : "Back"}
            </Button>
            {step < 3 ? (
              <Button onClick={handleContinue}>
                Continue <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => { const err = validateStep(); if (err) { toast.error("Cannot submit", { description: err }); return; } submit(); }} disabled={loading}>
                {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                {isExpert ? "Submit insight" : "Submit manuscript"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
