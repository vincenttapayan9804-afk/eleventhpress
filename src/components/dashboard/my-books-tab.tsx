"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { BookOpen, Plus, Loader2, Download, FileCheck2 } from "lucide-react";

const FORMATS = [
  { value: "MONOGRAPH", label: "Monograph (single manuscript)" },
  { value: "EDITED_VOLUME", label: "Edited volume (compiled from published articles)" },
  { value: "ANTHOLOGY", label: "Anthology (compiled from published articles)" },
];

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-800",
  UNDER_REVIEW: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-purple-100 text-purple-800",
  IN_PRODUCTION: "bg-indigo-100 text-indigo-800",
  PUBLISHED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export function MyBooksTab() {
  const { user } = useApp();
  const [books, setBooks] = useState<any[] | null>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishedArticles, setPublishedArticles] = useState<any[]>([]);
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);
  const [uploadedManuscript, setUploadedManuscript] = useState<{ key: string; filename: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    description: "",
    category: "",
    format: "MONOGRAPH",
    isbn: "",
    price: "0",
  });

  async function load() {
    try {
      const res = await apiFetch("/api/books");
      setBooks(res.books);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function loadPublishedArticles() {
    try {
      const res = await apiFetch("/api/articles?pageSize=48&sort=newest");
      setPublishedArticles(res.items);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  useEffect(() => {
    if (open && form.format !== "MONOGRAPH") loadPublishedArticles();
  }, [open, form.format]);

  async function handleManuscriptSelected(file: File) {
    setUploading(true);
    try {
      const presign = await apiFetch<{ uploadUrl: string; key: string; headers: Record<string, string> }>("/api/storage/presign-local", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream", bucket: "book-manuscripts" }),
      });
      const uploadRes = await fetch(presign.uploadUrl, { method: "PUT", body: file, headers: presign.headers });
      if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`);
      setUploadedManuscript({ key: presign.key, filename: file.name });
      toast.success("Manuscript uploaded");
    } catch (e: any) {
      toast.error("Upload failed", { description: e.message });
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!form.title || !form.description || !form.category) {
      toast.error("Title, description, and category are required");
      return;
    }
    if (form.format === "MONOGRAPH" && !uploadedManuscript) {
      toast.error("Upload a manuscript before submitting a monograph");
      return;
    }
    if (form.format !== "MONOGRAPH" && selectedArticleIds.length === 0) {
      toast.error("Select at least one published article to compile");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/books", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          subtitle: form.subtitle || undefined,
          description: form.description,
          category: form.category,
          format: form.format,
          isbn: form.isbn || undefined,
          price: parseFloat(form.price) || 0,
          authors: JSON.stringify([{ name: user?.fullName, affiliation: user?.affiliation || "", orcid: user?.orcid || "", email: user?.email }]),
          manuscriptKey: uploadedManuscript?.key,
          articleIds: form.format !== "MONOGRAPH" ? selectedArticleIds : undefined,
        }),
      });
      toast.success("Book submitted for editorial review");
      setOpen(false);
      setForm({ title: "", subtitle: "", description: "", category: "", format: "MONOGRAPH", isbn: "", price: "0" });
      setUploadedManuscript(null);
      setSelectedArticleIds([]);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-medium">My books</p>
          <p className="text-sm text-muted-foreground">Submit a monograph or compile a volume from your published articles.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> New book
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submit a book</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Format</Label>
                <Select value={form.format} onValueChange={(v) => setForm((f) => ({ ...f, format: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <Label>Subtitle (optional)</Label>
                <Input value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Physics" />
                </div>
                <div>
                  <Label>Price (USD)</Label>
                  <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>ISBN (optional)</Label>
                <Input value={form.isbn} onChange={(e) => setForm((f) => ({ ...f, isbn: e.target.value }))} />
              </div>

              {form.format === "MONOGRAPH" ? (
                <div>
                  <Label>Manuscript</Label>
                  {uploadedManuscript ? (
                    <div className="mt-1 flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs">
                      <FileCheck2 className="h-4 w-4 text-emerald-600" /> {uploadedManuscript.filename}
                    </div>
                  ) : (
                    <Input
                      type="file"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleManuscriptSelected(f);
                      }}
                    />
                  )}
                  {uploading && <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>}
                </div>
              ) : (
                <div>
                  <Label>Select published articles to compile (in order)</Label>
                  <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                    {publishedArticles.map((a: any) => {
                      const idx = selectedArticleIds.indexOf(a.id);
                      return (
                        <label key={a.id} className="flex items-center gap-2 rounded p-1 text-xs hover:bg-accent">
                          <Checkbox
                            checked={idx !== -1}
                            onCheckedChange={(v) =>
                              setSelectedArticleIds((ids) => (v ? [...ids, a.id] : ids.filter((id) => id !== a.id)))
                            }
                          />
                          {idx !== -1 && <Badge variant="outline" className="font-mono">{idx + 1}</Badge>}
                          {a.title}
                        </label>
                      );
                    })}
                    {publishedArticles.length === 0 && <p className="text-xs text-muted-foreground">No published articles available.</p>}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!books ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : books.length === 0 ? (
        <Card className="paper-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-display text-lg font-medium">No books submitted yet</p>
          </CardContent>
        </Card>
      ) : (
        books.map((b) => (
          <Card key={b.id} className="paper-card">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-display font-medium">{b.title}</p>
                <p className="text-xs text-muted-foreground">{b.format.replace(/_/g, " ")} · {b.category} · {b.chapters?.length || 0} chapter(s)</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={STATUS_BADGE[b.status] || ""}>{b.status.replace(/_/g, " ")}</Badge>
                {b.status === "PUBLISHED" && b.epubUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={b.epubUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-1.5 h-3.5 w-3.5" /> EPUB
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
