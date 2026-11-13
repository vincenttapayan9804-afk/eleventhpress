"use client";

import { useEffect, useMemo, useState } from "react";
import { FileUp, GitCompare, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { wordDiff } from "@/lib/text-diff";

/** Inline word diff: removed text struck through in red, added text highlighted in green. */
export function DiffText({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => wordDiff(before, after), [before, after]);
  if (before === after) return <p className="text-sm text-muted-foreground">No changes.</p>;
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((p, i) =>
        p.type === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.type === "added" ? (
          <ins key={i} className="rounded-sm bg-emerald-100 px-0.5 text-emerald-900 no-underline dark:bg-emerald-950/60 dark:text-emerald-200">{p.text}</ins>
        ) : (
          <del key={i} className="rounded-sm bg-rose-100 px-0.5 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200">{p.text}</del>
        )
      )}
    </p>
  );
}

const MAX_MB = 4;

/**
 * My Articles → Submit revision: upload the revised manuscript, edit the
 * title/abstract (with a live diff), and answer each review point by point.
 */
export function SubmitRevisionDialog({ article, open, onOpenChange, onDone }: { article: any; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const reviews: any[] = (article?.reviews ?? []).filter((r: any) => r.status === "COMPLETED");
  const [title, setTitle] = useState(article?.title ?? "");
  const [abstract, setAbstract] = useState(article?.abstract ?? "");
  const [replies, setReplies] = useState<string[]>(() => reviews.map(() => ""));
  const [coverNote, setCoverNote] = useState("");
  const [file, setFile] = useState<{ key: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    if (!open || !article) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(article.title);
    setAbstract(article.abstract);
    setReplies((article.reviews ?? []).filter((r: any) => r.status === "COMPLETED").map(() => ""));
    setCoverNote("");
    setFile(null);
  }, [open, article]);

  const upload = async (f: File) => {
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`The file is larger than ${MAX_MB} MB`);
      return;
    }
    setUploading(true);
    try {
      const presign = await apiFetch<{ uploadUrl: string; key: string; headers: Record<string, string> }>("/api/storage/presign-local", {
        method: "POST",
        body: JSON.stringify({ filename: f.name, contentType: f.type || "application/octet-stream", bucket: "raw-submissions" }),
      });
      const res = await fetch(presign.uploadUrl, { method: "PUT", body: f, headers: presign.headers });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      setFile({ key: presign.key, name: f.name });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const r = await apiFetch<{ round: number }>(`/api/articles/${article.id}/revision`, {
        method: "POST",
        body: JSON.stringify({ title, abstract, replies, coverNote, manuscriptKey: file?.key, manuscriptName: file?.name }),
      });
      toast.success(`Revision ${r.round} submitted — it's back with the editor`);
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!article) return null;
  const answered = replies.filter((r) => r.trim()).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Submit your revision</DialogTitle>
          <DialogDescription className="line-clamp-2">{article.title}</DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <Label>Revised manuscript</Label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm hover:bg-muted/40">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4 text-primary" />}
            <span className="flex-1 truncate">{file ? file.name : "Upload the revised file (Word or PDF, up to 4 MB) — optional if only the abstract changed"}</span>
            <input type="file" className="sr-only" accept=".doc,.docx,.pdf,.odt,.tex,.zip" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </section>

        <section className="space-y-2">
          <Label htmlFor="rev-title">Title</Label>
          <Input id="rev-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Label htmlFor="rev-abstract">Abstract</Label>
          <Textarea id="rev-abstract" rows={6} value={abstract} onChange={(e) => setAbstract(e.target.value)} />
          <button type="button" onClick={() => setShowDiff((v) => !v)} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            <GitCompare className="h-3.5 w-3.5" /> {showDiff ? "Hide changes" : "Show changes to title and abstract"}
          </button>
          {showDiff && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <DiffText before={article.title} after={title} />
              <DiffText before={article.abstract} after={abstract} />
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <Label>Response to reviewers</Label>
            {reviews.length > 0 && <span className="text-xs text-muted-foreground">{answered} of {reviews.length} answered</span>}
          </div>
          <Textarea rows={3} value={coverNote} onChange={(e) => setCoverNote(e.target.value)} placeholder="A short cover note to the editor summarising the main changes" />
          {reviews.map((r, i) => (
            <div key={r.id} className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reviewer {i + 1}{r.recommendation ? ` · ${r.recommendation.replace(/_/g, " ").toLowerCase()}` : ""}</p>
              {r.commentsToAuthor && (
                <blockquote className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap border-l-2 border-border pl-3 text-sm text-muted-foreground">{r.commentsToAuthor}</blockquote>
              )}
              <Textarea
                className="mt-2"
                rows={4}
                value={replies[i] ?? ""}
                onChange={(e) => setReplies((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder="Your reply — what you changed (with page or section) or why you respectfully disagree"
              />
            </div>
          ))}
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || uploading || (!coverNote.trim() && answered === 0)}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />} Submit revision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Editor view: each revision round's changes and the authors' response letter. */
export function RevisionHistory({ articleId }: { articleId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    apiFetch<{ revisions: any[] }>(`/api/articles/${articleId}/revision`).then((r) => setRows(r.revisions)).catch(() => setRows([]));
  }, [articleId]);
  if (!rows || rows.length === 0) return null;
  return (
    <div className="space-y-3">
      <p className="eyebrow flex items-center gap-1.5"><GitCompare className="h-3.5 w-3.5" /> Revisions</p>
      {rows.map((r) => (
        <details key={r.id} className="rounded-lg border border-border p-3" open={r === rows[0]}>
          <summary className="cursor-pointer text-sm font-medium">
            Revision {r.round} · {new Date(r.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            {r.manuscriptName ? ` · ${r.manuscriptName}` : ""}
          </summary>
          <div className="mt-3 space-y-3">
            {r.previousTitle !== r.title && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Title</p>
                <DiffText before={r.previousTitle} after={r.title} />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Abstract</p>
              <DiffText before={r.previousAbstract} after={r.abstract} />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Response to reviewers</p>
              <p className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{r.responseLetter}</p>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
