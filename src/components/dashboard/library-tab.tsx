"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, BookOpenText, Highlighter, BellRing, Trash2, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { DISCIPLINES } from "@/lib/article";

interface Entry { id: string; title: string; discipline: string; authors: string[]; publishedAt: string | null; doi: string | null }
interface LibraryData { lists: Record<string, Entry[]>; listNames: string[]; continueReading: (Entry & { viewedAt: string })[] }
interface Highlight { id: string; articleId: string; articleTitle: string; quote: string; note: string | null; createdAt: string }
interface Alert { id: string; kind: string; query: string; frequency: string; label: string }

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "");

function ArticleRow({ a, action }: { a: Entry; action?: React.ReactNode }) {
  const openArticle = useApp((s) => s.openArticle);
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => openArticle(a.id)} className="text-left font-display text-[0.95rem] font-semibold leading-snug hover:text-primary">
          {a.title}
        </button>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {a.authors.join(", ")} · {a.discipline}{a.publishedAt ? ` · ${fmt(a.publishedAt)}` : ""}
        </p>
      </div>
      {action}
    </li>
  );
}

/** Dashboard → Library: saved lists, continue reading, highlights and reading alerts. */
export function LibraryTab() {
  const [data, setData] = useState<LibraryData | null>(null);
  const [highlights, setHighlights] = useState<Highlight[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [activeList, setActiveList] = useState("Saved");
  const [kind, setKind] = useState("SEARCH");
  const [query, setQuery] = useState("");
  const [frequency, setFrequency] = useState("WEEKLY");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<LibraryData>("/api/library").then(setData).catch(() => setData({ lists: {}, listNames: [], continueReading: [] }));
    apiFetch<{ highlights: Highlight[] }>("/api/library/highlights").then((r) => setHighlights(r.highlights)).catch(() => setHighlights([]));
    apiFetch<{ alerts: Alert[] }>("/api/alerts").then((r) => setAlerts(r.alerts)).catch(() => setAlerts([]));
  }, []);
  useEffect(load, [load]);

  const remove = async (articleId: string, listName: string) => {
    await apiFetch(`/api/library?articleId=${encodeURIComponent(articleId)}&listName=${encodeURIComponent(listName)}`, { method: "DELETE" }).catch(() => {});
    load();
  };

  const addAlert = async () => {
    setBusy(true);
    try {
      await apiFetch("/api/alerts", { method: "POST", body: JSON.stringify({ kind, query, frequency }) });
      toast.success("Alert created");
      setQuery("");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const lists = data?.listNames.length ? data.listNames : ["Saved"];
  const current = data?.lists[activeList] ?? [];

  return (
    <div className="space-y-6">
      {data && data.continueReading.length > 0 && (
        <Card className="paper-card">
          <CardHeader className="pb-2">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><BookOpenText className="h-4 w-4 text-primary" /> Continue reading</h2>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {data.continueReading.map((a) => <ArticleRow key={a.id} a={a} />)}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="paper-card">
        <CardHeader className="pb-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Bookmark className="h-4 w-4 text-primary" /> Saved articles</h2>
          {lists.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lists.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setActiveList(l)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${activeList === l ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
                >
                  {l} <span className="opacity-70">{data?.lists[l]?.length ?? 0}</span>
                </button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!data ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : current.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing saved yet. Use <strong>Save</strong> on any article to keep it here — saved articles also open offline on this device once read.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {current.map((a) => (
                <ArticleRow
                  key={a.id}
                  a={a}
                  action={
                    <Button variant="ghost" size="icon" className="size-8" aria-label="Remove from list" onClick={() => remove(a.id, activeList)}>
                      <X className="h-4 w-4" />
                    </Button>
                  }
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="paper-card">
        <CardHeader className="pb-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Highlighter className="h-4 w-4 text-primary" /> Highlights &amp; notes</h2>
          <p className="text-xs text-muted-foreground">Select text in any article and choose Highlight. Only you can see these.</p>
        </CardHeader>
        <CardContent>
          {!highlights ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : highlights.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No highlights yet.</p>
          ) : (
            <ul className="space-y-3">
              {highlights.slice(0, 50).map((h) => (
                <li key={h.id} className="rounded-lg border border-border p-3">
                  <blockquote className="border-l-2 border-primary/60 pl-3 text-sm italic text-foreground/90">{h.quote}</blockquote>
                  {h.note && <p className="mt-2 text-sm">{h.note}</p>}
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <button type="button" className="truncate hover:text-primary" onClick={() => useApp.getState().openArticle(h.articleId)}>{h.articleTitle}</button>
                    <button
                      type="button"
                      aria-label="Delete highlight"
                      className="rounded p-1 hover:bg-muted"
                      onClick={async () => {
                        await apiFetch(`/api/library/highlights?id=${h.id}`, { method: "DELETE" }).catch(() => {});
                        setHighlights((prev) => prev?.filter((x) => x.id !== h.id) ?? prev);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="paper-card">
        <CardHeader className="pb-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><BellRing className="h-4 w-4 text-primary" /> Reading alerts</h2>
          <p className="text-xs text-muted-foreground">Hear about new publications on a topic, in a discipline or by an author. Delivery follows your email preferences.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[150px_1fr_120px_auto]">
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SEARCH">Topic or phrase</SelectItem>
                <SelectItem value="DISCIPLINE">Discipline</SelectItem>
                <SelectItem value="AUTHOR">Author</SelectItem>
                <SelectItem value="MAGAZINE">Magazine issues</SelectItem>
              </SelectContent>
            </Select>
            {kind === "DISCIPLINE" ? (
              <Select value={query} onValueChange={setQuery}>
                <SelectTrigger><SelectValue placeholder="Choose a discipline" /></SelectTrigger>
                <SelectContent>{DISCIPLINES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            ) : kind === "MAGAZINE" ? (
              <p className="self-center text-sm text-muted-foreground">Every newly published issue</p>
            ) : (
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={kind === "AUTHOR" ? "Author name or ORCID iD" : "e.g. climate adaptation"} />
            )}
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="DAILY">Daily</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={addAlert} disabled={busy || (kind !== "MAGAZINE" && !query.trim())}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />} Add
            </Button>
          </div>
          {alerts && alerts.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 truncate">{a.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{a.frequency === "DAILY" ? "Daily" : "Weekly"}</span>
                    <button
                      type="button"
                      aria-label={`Delete alert: ${a.label}`}
                      className="rounded p-1 hover:bg-muted"
                      onClick={async () => {
                        await apiFetch(`/api/alerts?id=${a.id}`, { method: "DELETE" }).catch(() => {});
                        setAlerts((prev) => prev?.filter((x) => x.id !== a.id) ?? prev);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
