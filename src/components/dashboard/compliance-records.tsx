"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { KIND_DEFS, canActivate, isEventKind, recordOpenNotes, type FieldDef, type RecordData, type RecordKind, type RecordState } from "@/lib/compliance-records";

export interface RecordRow {
  id: string;
  kind: RecordKind;
  title: string;
  status: string;
  data: RecordData;
  isPublic: boolean;
  intervalMonths: number;
  lastDoneAt: string | null;
  nextDue: string | null;
  state: RecordState;
  openNotes: number;
}

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
}

const STYLE: Record<string, string> = {
  CURRENT: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  DUE_SOON: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  OVERDUE: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  DRAFT: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  RETIRED: "border-border bg-muted text-muted-foreground",
};
const LABEL: Record<string, string> = { CURRENT: "Confirmed", DUE_SOON: "Review due soon", OVERDUE: "Review overdue", DRAFT: "Draft", RETIRED: "Retired" };

function FieldInput({ f, value, onChange, disabled, id }: { f: FieldDef; value: string; onChange: (v: string) => void; disabled?: boolean; id: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{f.label}{f.required ? " *" : ""}</Label>
      {f.type === "area" ? (
        <Textarea id={id} value={value} rows={f.max > 3000 ? 14 : 4} maxLength={f.max} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="text-sm" />
      ) : f.type === "select" ? (
        <select id={id} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {f.options?.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
      ) : (
        <Input id={id} value={value} maxLength={f.max} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="h-9" />
      )}
      {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
    </div>
  );
}

function NotesBox({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <p className="mb-1 flex items-center gap-1.5 font-medium"><AlertTriangle className="h-4 w-4" /> {notes.length} note{notes.length === 1 ? "" : "s"} need your answer</p>
      <ul className="list-disc space-y-1 pl-5 text-xs">{notes.map((n, i) => (<li key={i}>{n.replace(/^\[CONFIRM:\s*/, "").replace(/\]$/, "")}</li>))}</ul>
      <p className="mt-2 text-xs text-muted-foreground">Replace each [CONFIRM: …] with the true statement. You cannot confirm until none are left.</p>
    </div>
  );
}

function LivingCard({ r, onChanged }: { r: RecordRow; onChanged: () => void }) {
  const def = KIND_DEFS[r.kind];
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(r.title);
  const [data, setData] = useState<RecordData>(r.data);
  const [busy, setBusy] = useState<string | null>(null);
  const dirty = title !== r.title || def.fields.some((f) => (data[f.key] ?? "") !== (r.data[f.key] ?? ""));
  const notes = useMemo(() => recordOpenNotes(title, data), [title, data]);
  const ready = canActivate(r.kind, title, data);

  async function act(key: string, payload: Record<string, unknown>, ok: string) {
    setBusy(key);
    try {
      const res = await apiFetch<{ backToDraft?: boolean }>(`/api/admin/compliance/records/${r.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      toast.success(res.backToDraft ? "Saved. It is a draft again until you confirm the new wording." : ok);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const sub = r.status === "DRAFT" ? (r.openNotes > 0 ? `${r.openNotes} note${r.openNotes === 1 ? "" : "s"} to answer before you can confirm` : "Check it, then confirm") : r.status === "RETIRED" ? "Retired" : `${def.doneLabel === "Record rotation" ? "Last changed" : "Last reviewed"} ${fmt(r.lastDoneAt)} · next ${fmt(r.nextDue)}`;

  return (
    <Card className="paper-card">
      <CardContent className="pt-4">
        <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
          <div>
            <p className="font-medium">{r.title}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
          <Badge variant="outline" className={`text-[0.65rem] ${STYLE[r.state]}`}>{LABEL[r.state]}</Badge>
        </button>
        {open && (
          <div className="mt-3 space-y-3 border-t border-border/60 pt-4">
            <NotesBox notes={notes} />
            <div className="space-y-1">
              <Label htmlFor={`t-${r.id}`} className="text-xs">Name</Label>
              <Input id={`t-${r.id}`} value={title} maxLength={200} disabled={r.status === "RETIRED"} onChange={(e) => setTitle(e.target.value)} className="h-9" />
            </div>
            {def.fields.map((f) => (
              <FieldInput key={f.key} id={`${r.id}-${f.key}`} f={f} value={data[f.key] ?? ""} disabled={r.status === "RETIRED"} onChange={(v) => setData((d) => ({ ...d, [f.key]: v }))} />
            ))}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <label className="flex items-center gap-2">
                Review every
                <Input type="number" min={1} max={36} defaultValue={r.intervalMonths} className="h-8 w-16" onBlur={(e) => { const v = Number(e.target.value); if (v && v !== r.intervalMonths) act("interval", { action: "save", intervalMonths: v }, "Saved"); }} />
                months
              </label>
              {r.kind === "SUPPLIER" && (
                <label className="flex items-center gap-2">
                  <Checkbox checked={r.isPublic} onCheckedChange={(v) => act("public", { action: "save", isPublic: v === true }, v === true ? "Will be listed on the Trust page once confirmed" : "Hidden from the Trust page")} />
                  List on the Trust page as an outside service
                </label>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {r.status !== "RETIRED" && (
                <Button size="sm" variant="outline" disabled={!dirty || busy !== null} onClick={() => act("save", { action: "save", title, data }, "Saved")}>
                  {busy === "save" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Save
                </Button>
              )}
              {r.status === "DRAFT" && (
                <Button size="sm" disabled={dirty || !ready.ok || busy !== null} title={dirty ? "Save first" : !ready.ok ? ready.reason : undefined} onClick={() => act("activate", { action: "activate" }, "Confirmed. The review date is set.")}>
                  {busy === "activate" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Confirm this record
                </Button>
              )}
              {r.status === "ACTIVE" && (
                <Button size="sm" disabled={dirty || busy !== null} onClick={() => act("done", { action: "done" }, `${def.doneLabel === "Record rotation" ? "Rotation" : "Review"} recorded`)}>
                  {busy === "done" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} {def.doneLabel}
                </Button>
              )}
              {r.status === "ACTIVE" && (
                <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => { if (confirm("Retire this record? Its history is kept.")) act("retire", { action: "retire" }, "Retired"); }}>Retire</Button>
              )}
              {r.status === "RETIRED" && <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act("reopen", { action: "reopen" }, "Reopened as a draft")}>Reopen as draft</Button>}
              {r.status === "DRAFT" && !r.lastDoneAt && (
                <Button size="sm" variant="ghost" disabled={busy !== null} onClick={async () => {
                  if (!confirm("Delete this draft?")) return;
                  try { await apiFetch(`/api/admin/compliance/records/${r.id}`, { method: "DELETE" }); toast.success("Deleted"); onChanged(); } catch (e) { toast.error((e as Error).message); }
                }}>Delete draft</Button>
              )}
            </div>
            {r.kind === "RISK" && r.status === "ACTIVE" && <p className="text-xs text-muted-foreground">Likelihood {r.data.likelihood.toLowerCase()} · seriousness {r.data.impact.toLowerCase()}.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewLiving({ kind, onChanged }: { kind: RecordKind; onChanged: () => void }) {
  const def = KIND_DEFS[kind];
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [data, setData] = useState<RecordData>({});
  const [busy, setBusy] = useState(false);
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> Add {def.label.toLowerCase()}</Button>;
  return (
    <Card className="paper-card">
      <CardContent className="space-y-3 pt-4">
        <div className="space-y-1">
          <Label htmlFor={`new-${kind}-t`} className="text-xs">Name *</Label>
          <Input id={`new-${kind}-t`} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className="h-9" />
        </div>
        {def.fields.map((f) => (<FieldInput key={f.key} id={`new-${kind}-${f.key}`} f={f} value={data[f.key] ?? ""} onChange={(v) => setData((d) => ({ ...d, [f.key]: v }))} />))}
        <div className="flex gap-2">
          <Button size="sm" disabled={busy || title.trim().length < 3} onClick={async () => {
            setBusy(true);
            try { await apiFetch("/api/admin/compliance/records", { method: "POST", body: JSON.stringify({ action: "create", kind, title, data }) }); toast.success("Added as a draft"); setOpen(false); setTitle(""); setData({}); onChanged(); }
            catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
          }}>{busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Add as draft</Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EventForm({ kind, onChanged }: { kind: "ACCESS_REVIEW" | "EXERCISE" | "INCIDENT"; onChanged: () => void }) {
  const def = KIND_DEFS[kind];
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<RecordData>({});
  const [doneOn, setDoneOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const typeLabel = def.fields.find((f) => f.key === "type")?.options?.find((o) => o.value === data.type)?.label;
  const title = kind === "ACCESS_REVIEW" ? `Access review ${doneOn}` : kind === "INCIDENT" ? `Incident ${doneOn}` : `${typeLabel ?? "Exercise"} ${doneOn}`;

  async function loadAccounts() {
    try {
      const r = await apiFetch<{ accounts: { name: string; email: string; role: string; scope: string; twoStep: boolean }[] }>("/api/admin/compliance/access-snapshot");
      const lines = r.accounts.map((a) => `${a.name} <${a.email}> · ${a.role} on ${a.scope} · two-step sign-in ${a.twoStep ? "on" : "OFF"}`);
      setData((d) => ({ ...d, accounts: `${lines.length} account${lines.length === 1 ? "" : "s"} held an administrator or editor role on ${doneOn}:\n${lines.join("\n")}` }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!open) return <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> {def.doneLabel}</Button>;
  const ok = canActivate(kind, title, data);
  return (
    <Card className="paper-card">
      <CardContent className="space-y-3 pt-4">
        <p className="text-xs text-muted-foreground">Record this only when it has really been done. It is saved with the date you give and cannot be edited later.</p>
        <div className="space-y-1">
          <Label htmlFor={`ev-${kind}-d`} className="text-xs">{kind === "INCIDENT" ? "Date it was noticed *" : "Date it was done *"}</Label>
          <Input id={`ev-${kind}-d`} type="date" max={today} value={doneOn} onChange={(e) => setDoneOn(e.target.value)} className="h-9 w-44" />
        </div>
        {kind === "ACCESS_REVIEW" && <Button size="sm" variant="outline" onClick={loadAccounts}>Load the accounts that hold these roles now</Button>}
        {def.fields.map((f) => (<FieldInput key={f.key} id={`ev-${kind}-${f.key}`} f={f} value={data[f.key] ?? ""} onChange={(v) => setData((d) => ({ ...d, [f.key]: v }))} />))}
        <div className="flex gap-2">
          <Button size="sm" disabled={busy || !ok.ok || !doneOn} title={!ok.ok ? ok.reason : undefined} onClick={async () => {
            setBusy(true);
            try { await apiFetch("/api/admin/compliance/records", { method: "POST", body: JSON.stringify({ action: "create", kind, title, data, doneOn }) }); toast.success("Recorded"); setOpen(false); setData({}); onChanged(); }
            catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
          }}>{busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Save entry</Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EventList({ rows }: { rows: RecordRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id}>
          <Card className="paper-card">
            <CardHeader className="pb-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{r.title}</p>
                <Badge variant="outline" className={`text-[0.65rem] ${STYLE[r.status === "RETIRED" ? "RETIRED" : r.state]}`}>{r.kind === "INCIDENT" ? "Logged" : r.status === "RETIRED" ? "Retired" : r.state === "CURRENT" ? "Up to date" : LABEL[r.state]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{r.kind === "INCIDENT" ? `Noticed ${fmt(r.lastDoneAt)}` : `Done ${fmt(r.lastDoneAt)} · next due ${fmt(r.nextDue)}`}</p>
            </CardHeader>
            <CardContent>
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">Show the entry</summary>
                <dl className="mt-2 space-y-2 text-xs">
                  {KIND_DEFS[r.kind].fields.map((f) => r.data[f.key] ? (
                    <div key={f.key}><dt className="font-medium">{f.label}</dt><dd className="whitespace-pre-wrap text-muted-foreground">{f.options?.find((o) => o.value === r.data[f.key])?.label ?? r.data[f.key]}</dd></div>
                  ) : null)}
                </dl>
              </details>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** One section of the register for one or more record kinds. */
export function RecordsSection({ kinds, rows, onChanged, incidents }: { kinds: RecordKind[]; rows: RecordRow[]; onChanged: () => void; incidents?: RecordsOverview["incidents"] }) {
  return (
    <div className="space-y-8">
      {kinds.map((kind) => {
        const def = KIND_DEFS[kind];
        const mine = rows.filter((r) => r.kind === kind && r.status !== "RETIRED");
        const retired = rows.filter((r) => r.kind === kind && r.status === "RETIRED");
        return (
          <section key={kind} aria-labelledby={`rec-${kind}`} className="space-y-3">
            <div>
              <h3 id={`rec-${kind}`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{def.plural} ({mine.length})</h3>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{def.intro}</p>
              {kind === "INCIDENT" && incidents && (
                <p className="mt-2 text-xs text-muted-foreground" data-testid="incident-metrics">
                  {incidents.total} logged ({incidents.lastYear} in the last 12 months) · major {incidents.bySeverity.SEV1}, significant {incidents.bySeverity.SEV2}, minor {incidents.bySeverity.SEV3} · {incidents.meanDaysToResolve === null ? "no resolution time yet" : `average ${incidents.meanDaysToResolve} days to resolve`}
                </p>
              )}
            </div>
            {isEventKind(kind) ? (
              <>
                <EventForm kind={kind as "ACCESS_REVIEW" | "EXERCISE" | "INCIDENT"} onChanged={onChanged} />
                <EventList rows={mine} />
              </>
            ) : (
              <>
                <div className="space-y-2">{mine.map((r) => (<LivingCard key={`${r.id}-${r.status}-${r.lastDoneAt}`} r={r} onChanged={onChanged} />))}</div>
                {mine.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
                <NewLiving kind={kind} onChanged={onChanged} />
                {retired.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs text-muted-foreground">Retired ({retired.length})</summary>
                    <div className="mt-2 space-y-2">{retired.map((r) => (<LivingCard key={r.id} r={r} onChanged={onChanged} />))}</div>
                  </details>
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

export interface RecordsOverview {
  summary: { byKind: Record<RecordKind, { total: number; draft: number; active: number; dueSoon: number; overdue: number }>; eventsNeeded: string[] };
  records: RecordRow[];
  seedsAvailable: number;
  incidents?: { total: number; lastYear: number; bySeverity: { SEV1: number; SEV2: number; SEV3: number }; meanDaysToResolve: number | null };
}
