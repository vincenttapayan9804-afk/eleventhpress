"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Brain, Loader2, Plus, Sparkles, Building2, Waves } from "lucide-react";
import { SECOND_BRAIN_VIEWS, type SecondBrainLink, type SecondBrainView } from "@/lib/second-brain";
import type { SecondBrainNote } from "./second-brain/note-card";
import { AtriumView } from "./second-brain/atrium-view";
import { ConstellationView } from "./second-brain/constellation-view";
import { TideView } from "./second-brain/tide-view";

const VIEW_META: Record<SecondBrainView, { label: string; icon: typeof Sparkles }> = {
  constellation: { label: "Constellation", icon: Sparkles },
  atrium: { label: "Atrium", icon: Building2 },
  tide: { label: "Tide", icon: Waves },
};

/**
 * Second Brain — Phase 2 adds the Constellation / Atrium / Tide view
 * switcher on top of the Phase 1 data layer (create/pin/delete notes,
 * tag-overlap links). Each view is a different presentation of the same
 * notes/links; the selected view is remembered per-user via
 * SecondBrainPreference.defaultView. Color/font customization lands in
 * Phase 3.
 */
export function SecondBrainTab() {
  const [notes, setNotes] = useState<SecondBrainNote[]>([]);
  const [links, setLinks] = useState<SecondBrainLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<SecondBrainView>("constellation");
  const [accentColor, setAccentColor] = useState("#8b7cf6");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [notesRes, prefsRes] = await Promise.all([
        apiFetch<{ notes: SecondBrainNote[]; links: SecondBrainLink[] }>("/api/second-brain/notes"),
        apiFetch<{ preferences: { accentColor: string; fontPairing: string; defaultView: SecondBrainView } }>(
          "/api/second-brain/preferences"
        ),
      ]);
      setNotes(notesRes.notes);
      setLinks(notesRes.links);
      setView(prefsRes.preferences.defaultView);
      setAccentColor(prefsRes.preferences.accentColor);
    } catch (e: any) {
      toast.error(e.message || "Failed to load your Second Brain");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function changeView(next: SecondBrainView) {
    setView(next);
    try {
      await apiFetch("/api/second-brain/preferences", {
        method: "PUT",
        body: JSON.stringify({ defaultView: next }),
      });
    } catch {
      // Non-critical — the view still switches locally even if the
      // preference fails to save; it'll just default back next visit.
    }
  }

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

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <p className="eyebrow">Your personal knowledge graph</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {notes.length} note{notes.length === 1 ? "" : "s"} · {links.length} connection{links.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex rounded-lg border border-border bg-background p-1">
            {SECOND_BRAIN_VIEWS.map((v) => {
              const meta = VIEW_META[v];
              const Icon = meta.icon;
              const active = view === v;
              return (
                <button
                  key={v}
                  onClick={() => changeView(v)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
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

      {view === "constellation" && (
        <ConstellationView
          notes={notes}
          links={links}
          linkCountByNote={linkCountByNote}
          onTogglePin={togglePin}
          onDelete={deleteNote}
          accentColor={accentColor}
        />
      )}
      {view === "atrium" && (
        <AtriumView notes={notes} linkCountByNote={linkCountByNote} onTogglePin={togglePin} onDelete={deleteNote} accentColor={accentColor} />
      )}
      {view === "tide" && (
        <TideView notes={notes} linkCountByNote={linkCountByNote} onTogglePin={togglePin} onDelete={deleteNote} accentColor={accentColor} />
      )}
    </div>
  );
}
