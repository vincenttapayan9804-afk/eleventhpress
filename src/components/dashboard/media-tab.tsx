"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Plus, Loader2, Trash2 } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-green-100 text-green-800",
};

export function MediaTab() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "NEWS", title: "", dek: "", authorName: "", category: "", bodyHtml: "" });

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ posts: any[] }>("/api/media?all=1");
      setPosts(res.posts);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.title || !form.authorName || !form.category || !form.bodyHtml) {
      toast.error("Title, author, category, and body are required");
      return;
    }
    setCreating(true);
    try {
      await apiFetch("/api/media", {
        method: "POST",
        body: JSON.stringify({
          type: form.type,
          title: form.title,
          dek: form.dek || undefined,
          authorName: form.authorName,
          category: form.category,
          bodyHtml: `<p>${form.bodyHtml}</p>`,
        }),
      });
      toast.success("Post created as a draft");
      setForm({ type: "NEWS", title: "", dek: "", authorName: "", category: "", bodyHtml: "" });
      setShowNew(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function toggle(id: string, action: "PUBLISH" | "UNPUBLISH") {
    setBusyId(id);
    try {
      await apiFetch(`/api/media/${id}/workflow`, { method: "POST", body: JSON.stringify({ action }) });
      toast.success(action === "PUBLISH" ? "Published" : "Unpublished");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/api/media/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold">Media (News &amp; Blog)</h2>
          <p className="text-sm text-muted-foreground">Short-form editorial posts — announcements, community notes, commentary.</p>
        </div>
        <Button size="sm" onClick={() => setShowNew((v) => !v)}><Plus className="mr-2 h-4 w-4" /> New post</Button>
      </div>

      {showNew && (
        <Card>
          <CardContent className="space-y-2 pt-4">
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEWS">News</SelectItem>
                  <SelectItem value="BLOG">Blog</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Category (e.g. Announcements)" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <Input placeholder="Dek / subhead (optional)" value={form.dek} onChange={(e) => setForm((f) => ({ ...f, dek: e.target.value }))} />
            <Input placeholder="Author name" value={form.authorName} onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))} />
            <Textarea placeholder="Body text" rows={5} value={form.bodyHtml} onChange={(e) => setForm((f) => ({ ...f, bodyHtml: e.target.value }))} />
            <Button size="sm" disabled={creating} onClick={create}>
              {creating ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null} Save as draft
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No posts yet.</p>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.type} · {p.category} · {p.authorName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={STATUS_BADGE[p.status]}>{p.status}</Badge>
                <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => toggle(p.id, p.status === "DRAFT" ? "PUBLISH" : "UNPUBLISH")}>
                  {busyId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : p.status === "DRAFT" ? "Publish" : "Unpublish"}
                </Button>
                {p.status === "DRAFT" && (
                  <Button size="icon" variant="ghost" disabled={busyId === p.id} onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
