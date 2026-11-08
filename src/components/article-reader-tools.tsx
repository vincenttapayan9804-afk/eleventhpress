"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Highlighter, ListPlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";

interface Highlight { id: string; quote: string; note: string | null }

/** Saving an article warms the offline cache so it opens without a connection. */
function cacheForOffline() {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "cache-page", url: window.location.pathname });
  } catch {
    /* no service worker */
  }
}

/**
 * Article sidebar: save to the reader's library (default list or a named
 * one) and the reader's own highlights and notes for this article. Text
 * selected in the article body offers a Highlight button (HighlightCapture).
 */
export function ReaderToolsCard({ articleId }: { articleId: string }) {
  const user = useApp((s) => s.user);
  const [lists, setLists] = useState<string[] | null>(null);
  const [allLists, setAllLists] = useState<string[]>(["Saved"]);
  const [newList, setNewList] = useState("");
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [busy, setBusy] = useState(false);

  const loadHighlights = useCallback(() => {
    apiFetch<{ highlights: Highlight[] }>(`/api/library/highlights?articleId=${articleId}`).then((r) => setHighlights(r.highlights)).catch(() => {});
  }, [articleId]);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ lists: string[] }>(`/api/library?articleId=${articleId}`).then((r) => setLists(r.lists)).catch(() => setLists([]));
    apiFetch<{ listNames: string[] }>("/api/library").then((r) => setAllLists([...new Set(["Saved", ...r.listNames])])).catch(() => {});
    loadHighlights();
    const onNew = () => loadHighlights();
    window.addEventListener("highlight-saved", onNew);
    return () => window.removeEventListener("highlight-saved", onNew);
  }, [user, articleId, loadHighlights]);

  const saved = (lists?.length ?? 0) > 0;

  const toggle = async (listName = "Saved") => {
    if (!user) {
      useApp.getState().setView("login");
      return;
    }
    setBusy(true);
    try {
      if (lists?.includes(listName)) {
        await apiFetch(`/api/library?articleId=${articleId}&listName=${encodeURIComponent(listName)}`, { method: "DELETE" });
        setLists((l) => l?.filter((x) => x !== listName) ?? []);
        toast.success(`Removed from ${listName}`);
      } else {
        await apiFetch("/api/library", { method: "POST", body: JSON.stringify({ articleId, listName }) });
        setLists((l) => [...(l ?? []), listName]);
        setAllLists((a) => [...new Set([...a, listName])]);
        cacheForOffline();
        toast.success(`Saved to ${listName}`, {
          action: { label: "Open library", onClick: () => useApp.getState().openDashboard("library") },
        });
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="paper-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex gap-2">
          <Button className="flex-1 justify-start" variant={saved ? "secondary" : "outline"} disabled={busy} onClick={() => toggle(saved && lists ? lists[0] : "Saved")}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : saved ? <BookmarkCheck className="mr-2 h-4 w-4 text-primary" /> : <Bookmark className="mr-2 h-4 w-4" />}
            {saved ? `Saved${lists && lists.length === 1 && lists[0] !== "Saved" ? ` · ${lists[0]}` : ""}` : "Save"}
          </Button>
          {user && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Add to a reading list"><ListPlus className="h-4 w-4" /></Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reading lists</p>
                <ul className="space-y-1">
                  {allLists.map((l) => (
                    <li key={l}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
                        <input type="checkbox" className="accent-[var(--royal-500)]" checked={!!lists?.includes(l)} onChange={() => toggle(l)} />
                        {l}
                      </label>
                    </li>
                  ))}
                </ul>
                <form
                  className="mt-2 flex gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newList.trim()) toggle(newList.trim());
                    setNewList("");
                  }}
                >
                  <Input value={newList} onChange={(e) => setNewList(e.target.value)} placeholder="New list" className="h-8 text-sm" />
                  <Button type="submit" size="sm" className="h-8">Add</Button>
                </form>
              </PopoverContent>
            </Popover>
          )}
        </div>
        {user && (
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Highlighter className="h-3.5 w-3.5" /> Your highlights
            </p>
            {highlights.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">Select text in the article to highlight it and add a note.</p>
            ) : (
              <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                {highlights.map((h) => (
                  <li key={h.id} className="group rounded-md bg-muted/40 p-2 text-xs">
                    <p className="line-clamp-3 italic">“{h.quote}”</p>
                    {h.note && <p className="mt-1 text-foreground/80">{h.note}</p>}
                    <button
                      type="button"
                      aria-label="Delete highlight"
                      className="mt-1 text-muted-foreground opacity-70 hover:text-destructive group-hover:opacity-100"
                      onClick={async () => {
                        await apiFetch(`/api/library/highlights?id=${h.id}`, { method: "DELETE" }).catch(() => {});
                        setHighlights((p) => p.filter((x) => x.id !== h.id));
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Floating "Highlight" button for text selected inside the element with id `targetId`. */
export function HighlightCapture({ articleId, targetId }: { articleId: string; targetId: string }) {
  const user = useApp((s) => s.user);
  const [pos, setPos] = useState<{ x: number; y: number; text: string } | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!user) return;
    const onUp = () => {
      window.setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim() || "";
        const target = document.getElementById(targetId);
        if (!sel || !text || text.length < 3 || !target || !sel.anchorNode || !target.contains(sel.anchorNode)) {
          if (!noteOpen) setPos(null);
          return;
        }
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        setPos({ x: rect.left + rect.width / 2, y: rect.top - 8, text: text.slice(0, 2000) });
      }, 10);
    };
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
    };
  }, [user, targetId, noteOpen]);

  if (!pos) return null;

  const save = async () => {
    try {
      await apiFetch("/api/library/highlights", { method: "POST", body: JSON.stringify({ articleId, quote: pos.text, note }) });
      toast.success("Highlight saved");
      window.dispatchEvent(new Event("highlight-saved"));
      window.getSelection()?.removeAllRanges();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPos(null);
      setNoteOpen(false);
      setNote("");
    }
  };

  return (
    <div
      className="fixed z-50 -translate-x-1/2 -translate-y-full"
      style={{ left: pos.x, top: pos.y }}
      onMouseUp={(e) => e.stopPropagation()}
    >
      {noteOpen ? (
        <div className="w-72 rounded-lg border border-border bg-popover p-3 shadow-lg">
          <Textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Add a note (optional)" className="text-sm" />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setPos(null); setNoteOpen(false); }}>Cancel</Button>
            <Button size="sm" onClick={save}>Save</Button>
          </div>
        </div>
      ) : (
        <div className="flex overflow-hidden rounded-full border border-border bg-popover shadow-lg">
          <button type="button" onClick={save} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium hover:bg-muted">
            <Highlighter className="h-3.5 w-3.5 text-primary" /> Highlight
          </button>
          <button type="button" onClick={() => setNoteOpen(true)} className="border-l border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            Add note
          </button>
        </div>
      )}
    </div>
  );
}
