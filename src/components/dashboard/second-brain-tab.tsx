"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Brain, Loader2, Plus, Pin, PinOff, Trash2, Tag, Link2 } from "lucide-react";
import type { SecondBrainLink } from "@/lib/second-brain";

interface SecondBrainNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  color: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Second Brain — Phase 1 (backend + a functional note workspace). Lives in
 * the dashboard right next to Overview (src/components/views/dashboard-view.tsx).
 * This phase ships the real data layer end-to-end: create/pin/delete notes,
 * tag-overlap links surfaced per note. Later phases add the Constellation
 * (Globe) / Atrium / Tide view switcher and the color/font customization
 * toggle on top of this same data — nothing here is throwaway.
 */
export function SecondBrainTab() {
  const [notes, setNotes] = useState<SecondBrainNote[]>([]);
  const [links, setLinks] = useState<SecondBrainLink[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ notes: SecondBrainNote[]; links: SecondBrainLink[] }>("/api/second-brain/notes");
      setNotes(res.notes);
      setLinks(res.links);
    } catch (e: any) {
      toast.error(e.message || "Failed to load your Second Brain");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const linkCountByNote = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of links) {
      counts[l.a] = (counts[l.a] || 0) + 1;
      counts[l.b] = (counts[l.b] || 0) + 1;
    }
    return counts;
  }, [links]);

  async function createNote() {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await apiFetch("/api/second-brain/notes", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), content: content.trim(), tags }),
      });
      toast.success("Note captured");
      setTitle("");
      setContent("");
      setTagsInput("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to capture note");
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePin(note: SecondBrainNote) {
    // Optimistic — pin state is purely a personal-organization toggle, no
    // server-side validation can reject it, so there's nothing to reconcile.
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n)));
    try {
      await apiFetch(`/api/second-brain/notes/${note.id}`, {
        method: "PATCH",
        body: JSON.stringify({ pinned: !note.pinned }),
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to update note");
      await load();
    }
  }

  async function deleteNote(id: string) {
    try {
      await apiFetch(`/api/second-brain/notes/${id}`, { method: "DELETE" });
      toast.success("Note deleted");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete note");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pinned = notes.filter((n) => n.pinned);
  const rest = notes.filter((n) => !n.pinned);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent p-5">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <p className="eyebrow">Your personal knowledge graph</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Capture a thought, tag it, and Second Brain quietly links it to everything else you've captured that shares
          a tag. {notes.length} note{notes.length === 1 ? "" : "s"} · {links.length} connection{links.length === 1 ? "" : "s"}.
        </p>
      </div>

      <Card className="paper-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <p className="eyebrow">Capture a note</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sbTitle">Title</Label>
            <Input id="sbTitle" placeholder="A short, findable name" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sbContent">Note</Label>
            <Textarea
              id="sbContent"
              rows={4}
              placeholder="Write it out — a thought, a quote, a summary of something you read"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sbTags">Tags (comma-separated)</Label>
            <Input
              id="sbTags"
              placeholder="e.g. climate, methodology, to-follow-up"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
            <p className="text-[0.65rem] text-muted-foreground">
              Shared tags are how Second Brain draws connections between notes.
            </p>
          </div>
          <Button onClick={createNote} disabled={submitting}>
            {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            Add to Second Brain
          </Button>
        </CardContent>
      </Card>

      {notes.length === 0 ? (
        <Card className="paper-card">
          <CardContent className="py-12 text-center text-xs text-muted-foreground">
            Nothing captured yet — your first note starts the graph.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {pinned.length > 0 && (
            <div className="space-y-2">
              <p className="eyebrow">Pinned</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {pinned.map((n) => (
                  <NoteCard key={n.id} note={n} linkCount={linkCountByNote[n.id] || 0} onTogglePin={togglePin} onDelete={deleteNote} />
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            {pinned.length > 0 && <p className="eyebrow">All notes</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {rest.map((n) => (
                <NoteCard key={n.id} note={n} linkCount={linkCountByNote[n.id] || 0} onTogglePin={togglePin} onDelete={deleteNote} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteCard({
  note,
  linkCount,
  onTogglePin,
  onDelete,
}: {
  note: SecondBrainNote;
  linkCount: number;
  onTogglePin: (n: SecondBrainNote) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className="rounded-lg border border-border p-4 transition-colors hover:border-primary/30"
      style={note.color ? { borderLeftWidth: "3px", borderLeftColor: note.color } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-sm font-semibold leading-snug">{note.title}</h3>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            onClick={() => onTogglePin(note)}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title={note.pinned ? "Unpin" : "Pin"}
          >
            {note.pinned ? <Pin className="h-3.5 w-3.5 fill-current" /> : <PinOff className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="mt-1.5 line-clamp-3 text-xs text-foreground/80">{note.content}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {note.tags.map((t) => (
          <Badge key={t} variant="outline" className="gap-1 text-[0.6rem]">
            <Tag className="h-2.5 w-2.5" /> {t}
          </Badge>
        ))}
        {linkCount > 0 && (
          <Badge variant="secondary" className="ml-auto gap-1 text-[0.6rem]">
            <Link2 className="h-2.5 w-2.5" /> {linkCount} link{linkCount === 1 ? "" : "s"}
          </Badge>
        )}
      </div>
    </div>
  );
}
