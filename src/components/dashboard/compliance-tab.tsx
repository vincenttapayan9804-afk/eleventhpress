"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, FileText, Laptop, CheckCircle2, AlertTriangle, Clock, Lock, ListChecks, Building2, KeyRound, Dumbbell } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RecordsSection, type RecordsOverview } from "@/components/dashboard/compliance-records";
import {
  POLICY_CATEGORIES,
  POLICY_CATEGORY_LABELS,
  DEVICE_CHECKS,
  DEVICE_KINDS,
  DEVICE_KIND_LABELS,
  openConfirmNotes,
  type DeviceCheckKey,
  type DeviceKind,
  type RegisterSummary,
  type ReviewState,
  type DeviceState,
} from "@/lib/compliance";

interface PolicyRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: string;
  version: number;
  reviewIntervalMonths: number;
  isPublic: boolean;
  covers: string[];
  adoptedAt: string | null;
  lastReviewedAt: string | null;
  nextReviewDue: string | null;
  state: ReviewState;
  openNotes: number;
}

interface DeviceRow {
  id: string;
  label: string;
  kind: DeviceKind;
  checks: Record<DeviceCheckKey, boolean>;
  failing: string[];
  notes: string | null;
  lastCheckedAt: string | null;
  nextCheckDue: string | null;
  retiredAt: string | null;
  state: DeviceState;
}

interface Overview {
  summary: RegisterSummary;
  policies: PolicyRow[];
  devices: DeviceRow[];
  draftsAvailable: number;
}

interface PolicyFull {
  id: string;
  body: string;
  reviews: { id: string; reviewedAt: string; outcome: string; notes: string | null; version: number }[];
}

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
}

const STATE_STYLE: Record<string, string> = {
  CURRENT: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  DUE_SOON: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  OVERDUE: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  FAILING: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  NOT_CHECKED: "border-border bg-muted text-muted-foreground",
  DRAFT: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  RETIRED: "border-border bg-muted text-muted-foreground",
};
const STATE_LABEL: Record<string, string> = {
  CURRENT: "In force",
  DUE_SOON: "Review due soon",
  OVERDUE: "Review overdue",
  FAILING: "Checklist not passed",
  NOT_CHECKED: "Not checked yet",
  DRAFT: "Draft",
  RETIRED: "Retired",
};

const DEVICE_STATE_LABEL: Record<string, string> = { CURRENT: "Passed", DUE_SOON: "Check due soon", OVERDUE: "Check overdue" };

function StateBadge({ state, device }: { state: string; device?: boolean }) {
  return (
    <Badge variant="outline" className={`text-[0.65rem] ${STATE_STYLE[state] ?? ""}`}>
      {(device && DEVICE_STATE_LABEL[state]) || STATE_LABEL[state] || state}
    </Badge>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" | "bad" | "ok" }) {
  const color = tone === "bad" ? "text-red-600 dark:text-red-400" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : tone === "ok" ? "text-emerald-600 dark:text-emerald-400" : "";
  return (
    <div>
      <p className={`font-display text-2xl font-semibold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function PolicyEditor({ row, onChanged }: { row: PolicyRow; onChanged: () => void }) {
  const [full, setFull] = useState<PolicyFull | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"NO_CHANGE" | "UPDATED">("NO_CHANGE");
  const [note, setNote] = useState("");

  useEffect(() => {
    apiFetch<{ policy: PolicyFull }>(`/api/admin/compliance/policies/${row.id}`)
      .then((r) => {
        setFull(r.policy);
        setBody(r.policy.body);
      })
      .catch((e) => toast.error(e.message));
  }, [row.id, row.version, row.status]);

  const notes = useMemo(() => openConfirmNotes(body), [body]);
  const dirty = full !== null && body !== full.body;

  async function act(key: string, payload: Record<string, unknown>, ok: string) {
    setBusy(key);
    try {
      await apiFetch(`/api/admin/compliance/policies/${row.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      toast.success(ok);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!full) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const inForce = row.status === "ADOPTED";
  return (
    <div className="space-y-4 border-t border-border/60 pt-4">
      {row.status === "DRAFT" && (
        <p className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3 text-sm">
          This is a <strong>draft</strong>. Read every line. Change anything that is not true for you. A policy is a promise, so adopt it only when you will follow it.
        </p>
      )}
      {notes.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="mb-1 flex items-center gap-1.5 font-medium"><AlertTriangle className="h-4 w-4" /> {notes.length} note{notes.length === 1 ? "" : "s"} need your answer</p>
          <ul className="list-disc space-y-1 pl-5 text-xs">
            {notes.map((n, i) => (<li key={i}>{n.replace(/^\[CONFIRM:\s*/, "").replace(/\]$/, "")}</li>))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Replace each [CONFIRM: …] with the true statement, or delete the line. You cannot adopt until none are left.</p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`body-${row.id}`} className="text-xs">Text of the policy (internal; never shown publicly)</Label>
        <Textarea id={`body-${row.id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={18} className="font-mono text-xs leading-relaxed" disabled={row.status === "RETIRED"} />
        {inForce && dirty && <p className="text-xs text-muted-foreground">Saving changes to a policy in force makes version {row.version + 1}.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          Review every
          <Input type="number" min={1} max={36} defaultValue={row.reviewIntervalMonths} className="h-8 w-16" onBlur={(e) => { const v = Number(e.target.value); if (v && v !== row.reviewIntervalMonths) act("interval", { action: "save", reviewIntervalMonths: v }, "Review interval saved"); }} />
          months
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={row.isPublic} onCheckedChange={(v) => act("public", { action: "save", isPublic: v === true }, v === true ? "Will be listed on the Trust page once adopted" : "Hidden from the Trust page")} />
          List title and dates on the Trust page
        </label>
      </div>
      {row.covers.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Supports {row.covers.length} STAR answer{row.covers.length === 1 ? "" : "s"}: <span className="font-mono">{row.covers.join(" ")}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {row.status !== "RETIRED" && (
          <Button size="sm" variant="outline" disabled={!dirty || busy !== null} onClick={() => act("save", { action: "save", body }, "Saved")}>
            {busy === "save" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Save text
          </Button>
        )}
        {row.status === "DRAFT" && (
          <Button size="sm" disabled={dirty || notes.length > 0 || busy !== null} title={dirty ? "Save first" : notes.length ? "Answer the notes first" : undefined} onClick={() => act("adopt", { action: "adopt" }, "Adopted. The review date is set.")}>
            {busy === "adopt" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Adopt this policy
          </Button>
        )}
        {row.status === "ADOPTED" && (
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => { if (confirm("Retire this policy? It stops being listed and its history is kept.")) act("retire", { action: "retire" }, "Retired"); }}>
            Retire
          </Button>
        )}
        {row.status === "RETIRED" && (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act("reopen", { action: "reopen" }, "Reopened as a draft")}>Reopen as draft</Button>
        )}
        {row.status === "DRAFT" && full.reviews.length === 0 && (
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={async () => {
            if (!confirm("Delete this draft?")) return;
            try { await apiFetch(`/api/admin/compliance/policies/${row.id}`, { method: "DELETE" }); toast.success("Deleted"); onChanged(); } catch (e) { toast.error((e as Error).message); }
          }}>Delete draft</Button>
        )}
      </div>

      {inForce && (
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="mb-2 text-sm font-medium">Record a review</p>
          <p className="mb-2 text-xs text-muted-foreground">Do this only after you have really read the policy and compared it with how the platform works. The date is saved and the next review is set {row.reviewIntervalMonths} months ahead.</p>
          <div className="flex flex-wrap items-end gap-2">
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={outcome} onChange={(e) => setOutcome(e.target.value as "NO_CHANGE" | "UPDATED")} aria-label="Outcome of the review">
              <option value="NO_CHANGE">Still correct, no change</option>
              <option value="UPDATED">I changed it</option>
            </select>
            <Input className="h-9 min-w-[14rem] flex-1" placeholder="Optional note" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} aria-label="Review note" />
            <Button size="sm" disabled={busy !== null || dirty} onClick={() => act("review", { action: "review", outcome, notes: note || undefined }, "Review recorded").then(() => setNote(""))}>
              {busy === "review" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Record review
            </Button>
          </div>
        </div>
      )}

      {full.reviews.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">History</p>
          <ul className="space-y-1 text-xs">
            {full.reviews.map((r) => (
              <li key={r.id}>
                {fmt(r.reviewedAt)} · version {r.version} · {r.outcome === "NO_CHANGE" ? "reviewed, no change" : "updated"}{r.notes ? ` · ${r.notes}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DeviceCard({ d, onChanged }: { d: DeviceRow; onChanged: () => void }) {
  const [checks, setChecks] = useState(d.checks);
  const [busy, setBusy] = useState(false);
  const retired = !!d.retiredAt;
  const changed = DEVICE_CHECKS.some((c) => checks[c.key] !== d.checks[c.key]);

  async function save() {
    setBusy(true);
    try {
      const r = await apiFetch<{ failing: string[] }>(`/api/admin/compliance/devices/${d.id}`, { method: "PATCH", body: JSON.stringify({ action: "check", checks }) });
      toast.success(r.failing.length ? `Saved. ${r.failing.length} item${r.failing.length === 1 ? "" : "s"} still to fix.` : "Checklist passed and dated");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="paper-card">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">{d.label}</p>
            <p className="text-xs text-muted-foreground">{DEVICE_KIND_LABELS[d.kind]} · last checked {fmt(d.lastCheckedAt)} · next due {fmt(d.nextCheckDue)}</p>
          </div>
          <StateBadge state={d.state} device />
        </div>
      </CardHeader>
      {!retired && (
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {DEVICE_CHECKS.map((c) => (
              <li key={c.key} className="flex items-start gap-2">
                <Checkbox id={`${d.id}-${c.key}`} checked={checks[c.key]} onCheckedChange={(v) => setChecks((s) => ({ ...s, [c.key]: v === true }))} className="mt-0.5" />
                <label htmlFor={`${d.id}-${c.key}`} className="text-sm leading-snug">
                  {c.label}
                  <span className="block text-xs text-muted-foreground">{c.help}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Tick only what you have looked at on this device today.</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || (!changed && !!d.lastCheckedAt)} onClick={save}>
              {busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Save check
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={async () => {
              if (!confirm("Retire this device? It leaves the inventory but the record is kept.")) return;
              try { await apiFetch(`/api/admin/compliance/devices/${d.id}`, { method: "PATCH", body: JSON.stringify({ action: "retire" }) }); onChanged(); } catch (e) { toast.error((e as Error).message); }
            }}>Retire device</Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function ComplianceTab() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<"policies" | "devices" | "risks" | "suppliers" | "keys" | "exercises">("policies");
  const [recs, setRecs] = useState<RecordsOverview | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newKind, setNewKind] = useState<DeviceKind>("OWNER");

  const load = useCallback(() => {
    apiFetch<Overview>("/api/admin/compliance").then(setData).catch((e) => setError(e.message));
    apiFetch<RecordsOverview>("/api/admin/compliance/records").then(setRecs).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function seed() {
    setSeeding(true);
    try {
      const r = await apiFetch<{ added: number }>("/api/admin/compliance/policies", { method: "POST", body: JSON.stringify({ action: "seed" }) });
      toast.success(`${r.added} draft polic${r.added === 1 ? "y" : "ies"} added`);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  async function seedRecords() {
    setSeeding(true);
    try {
      const r = await apiFetch<{ added: number }>("/api/admin/compliance/records", { method: "POST", body: JSON.stringify({ action: "seed" }) });
      toast.success(`${r.added} starting record${r.added === 1 ? "" : "s"} added as drafts`);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  async function adoptReady() {
    const ready = data?.policies.filter((p) => p.status === "DRAFT" && p.openNotes === 0).length ?? 0;
    if (!confirm(`Adopt ${ready} polic${ready === 1 ? "y" : "ies"} now?\n\nBy doing this you say you have read each one and that it is true for the platform. Each is dated today, set to be reviewed in a year, and written to the audit log. Policies that still have notes to answer are left as drafts.`)) return;
    setAdopting(true);
    try {
      const r = await apiFetch<{ adopted: string[]; skipped: { title: string }[] }>("/api/admin/compliance/policies", { method: "POST", body: JSON.stringify({ action: "adopt-ready" }) });
      toast.success(`${r.adopted.length} adopted${r.skipped.length ? `. ${r.skipped.length} left as drafts because they still have notes to answer: ${r.skipped.map((x) => x.title).join(", ")}` : ""}`, { duration: 10000 });
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAdopting(false);
    }
  }

  async function addDevice() {
    try {
      await apiFetch("/api/admin/compliance/devices", { method: "POST", body: JSON.stringify({ label: newLabel, kind: newKind }) });
      setNewLabel("");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <div className="flex min-h-[30vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  const { summary: s } = data;
  const devices = data.devices.filter((d) => !d.retiredAt);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow flex items-center gap-1.5"><Lock className="h-3 w-3" /> Private · platform owner only</p>
        <h2 className="font-display text-2xl font-semibold">Compliance Register</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          The record behind the Trust page and the STAR self-assessments. It stores your policies, the dated reviews and your device checks, and reminds you when one is due. It cannot do the review for you: a date is saved only when you record one. The public Trust page shows only the titles and dates of policies you have adopted. It never shows a draft or any text.
        </p>
      </div>

      <Card className="paper-card">
        <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-4 lg:grid-cols-8">
          <Stat label="Policies adopted" value={s.policies.adopted} tone={s.policies.adopted > 0 ? "ok" : undefined} />
          <Stat label="Drafts to finish" value={s.policies.draft} />
          <Stat label="Reviews due soon" value={s.policies.dueSoon} tone={s.policies.dueSoon ? "warn" : undefined} />
          <Stat label="Reviews overdue" value={s.policies.overdue} tone={s.policies.overdue ? "bad" : undefined} />
          <Stat label="Devices passed" value={s.devices.current + s.devices.dueSoon} tone={s.devices.current ? "ok" : undefined} />
          <Stat label="Devices not checked" value={s.devices.notChecked} />
          <Stat label="Devices failing" value={s.devices.failing} tone={s.devices.failing ? "bad" : undefined} />
          <Stat label="Device checks overdue" value={s.devices.overdue} tone={s.devices.overdue ? "bad" : undefined} />
        </CardContent>
      </Card>

      {recs && (
        <Card className="paper-card">
          <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-4 lg:grid-cols-8">
            <Stat label="Risks confirmed" value={recs.summary.byKind.RISK.active} tone={recs.summary.byKind.RISK.active ? "ok" : undefined} />
            <Stat label="Assessments confirmed" value={recs.summary.byKind.ASSESSMENT.active} tone={recs.summary.byKind.ASSESSMENT.active ? "ok" : undefined} />
            <Stat label="Suppliers confirmed" value={recs.summary.byKind.SUPPLIER.active} tone={recs.summary.byKind.SUPPLIER.active ? "ok" : undefined} />
            <Stat label="Keys confirmed" value={recs.summary.byKind.KEY.active} tone={recs.summary.byKind.KEY.active ? "ok" : undefined} />
            <Stat label="Drafts to finish" value={Object.values(recs.summary.byKind).reduce((n, k) => n + k.draft, 0)} />
            <Stat label="Reviews due soon" value={Object.values(recs.summary.byKind).reduce((n, k) => n + k.dueSoon, 0)} tone={Object.values(recs.summary.byKind).some((k) => k.dueSoon) ? "warn" : undefined} />
            <Stat label="Reviews overdue" value={Object.values(recs.summary.byKind).reduce((n, k) => n + k.overdue, 0)} tone={Object.values(recs.summary.byKind).some((k) => k.overdue) ? "bad" : undefined} />
            <Stat label="Yearly tasks to do" value={recs.summary.eventsNeeded.length} tone={recs.summary.eventsNeeded.length ? "warn" : "ok"} />
          </CardContent>
        </Card>
      )}

      {recs && recs.summary.eventsNeeded.length > 0 && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm"><strong>Yearly tasks:</strong> {recs.summary.eventsNeeded.join(" · ")}.</p>
      )}

      {recs && recs.seedsAvailable > 0 && (
        <Card className="paper-card border-sky-500/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div className="max-w-2xl text-sm">
              <p className="font-medium">{recs.seedsAvailable} starting record{recs.seedsAvailable === 1 ? " is" : "s are"} ready to load</p>
              <p className="text-muted-foreground">A supplier list, a risk register, the key list and two impact assessments, written from how the platform works. They load as drafts. Each has notes only you can answer, and nothing is shown publicly until you confirm it.</p>
            </div>
            <Button onClick={seedRecords} disabled={seeding}>{seeding && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Load the starting records</Button>
          </CardContent>
        </Card>
      )}

      {data.draftsAvailable > 0 && (
        <Card className="paper-card border-sky-500/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div className="max-w-2xl text-sm">
              <p className="font-medium">{data.draftsAvailable} starting polic{data.draftsAvailable === 1 ? "y is" : "ies are"} ready to load</p>
              <p className="text-muted-foreground">They are written from how the platform works today. They load as drafts, not as adopted policies, and nothing is shown publicly until you adopt each one.</p>
            </div>
            <Button onClick={seed} disabled={seeding}>{seeding && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Load the drafts</Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Register sections">
        <Button size="sm" role="tab" aria-selected={view === "policies"} variant={view === "policies" ? "default" : "outline"} onClick={() => setView("policies")}><FileText className="mr-1 h-4 w-4" /> Policy Library ({data.policies.length})</Button>
        <Button size="sm" role="tab" aria-selected={view === "devices"} variant={view === "devices" ? "default" : "outline"} onClick={() => setView("devices")}><Laptop className="mr-1 h-4 w-4" /> Devices ({devices.length})</Button>
        <Button size="sm" role="tab" aria-selected={view === "risks"} variant={view === "risks" ? "default" : "outline"} onClick={() => setView("risks")}><ListChecks className="mr-1 h-4 w-4" /> Risks and assessments</Button>
        <Button size="sm" role="tab" aria-selected={view === "suppliers"} variant={view === "suppliers" ? "default" : "outline"} onClick={() => setView("suppliers")}><Building2 className="mr-1 h-4 w-4" /> Suppliers</Button>
        <Button size="sm" role="tab" aria-selected={view === "keys"} variant={view === "keys" ? "default" : "outline"} onClick={() => setView("keys")}><KeyRound className="mr-1 h-4 w-4" /> Keys and access</Button>
        <Button size="sm" role="tab" aria-selected={view === "exercises"} variant={view === "exercises" ? "default" : "outline"} onClick={() => setView("exercises")}><Dumbbell className="mr-1 h-4 w-4" /> Exercises</Button>
      </div>

      {recs && view === "risks" && <RecordsSection kinds={["RISK", "ASSESSMENT"]} rows={recs.records} onChanged={load} />}
      {recs && view === "suppliers" && <RecordsSection kinds={["SUPPLIER"]} rows={recs.records} onChanged={load} />}
      {recs && view === "keys" && <RecordsSection kinds={["KEY", "ACCESS_REVIEW"]} rows={recs.records} onChanged={load} />}
      {recs && view === "exercises" && <RecordsSection kinds={["EXERCISE", "INCIDENT"]} rows={recs.records} onChanged={load} incidents={recs.incidents} />}

      {view === "policies" && (
        <div className="space-y-6">
          {data.policies.some((p) => p.status === "DRAFT" && p.openNotes === 0) && (
            <Card className="paper-card border-primary/30">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                <div className="max-w-2xl text-sm">
                  <p className="font-medium">{data.policies.filter((p) => p.status === "DRAFT" && p.openNotes === 0).length} draft{data.policies.filter((p) => p.status === "DRAFT" && p.openNotes === 0).length === 1 ? " has" : "s have"} no open notes</p>
                  <p className="text-muted-foreground">Read them first (open each below and change anything that is not true). Then adopt them all at once. Drafts that still have notes to answer are skipped.</p>
                </div>
                <Button onClick={adoptReady} disabled={adopting}>{adopting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Adopt all ready policies</Button>
              </CardContent>
            </Card>
          )}
          {POLICY_CATEGORIES.map((cat) => {
            const rows = data.policies.filter((p) => p.category === cat);
            if (rows.length === 0) return null;
            return (
              <section key={cat} aria-labelledby={`cat-${cat}`}>
                <h3 id={`cat-${cat}`} className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{POLICY_CATEGORY_LABELS[cat]}</h3>
                <div className="space-y-2">
                  {rows.map((p) => (
                    <Card key={p.id} className="paper-card">
                      <CardContent className="pt-4">
                        <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 text-left" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
                          <div>
                            <p className="font-medium">{p.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.status === "ADOPTED"
                                ? `Version ${p.version} · adopted ${fmt(p.adoptedAt)} · last reviewed ${fmt(p.lastReviewedAt)} · next review ${fmt(p.nextReviewDue)}`
                                : p.status === "DRAFT"
                                  ? p.openNotes > 0 ? `${p.openNotes} note${p.openNotes === 1 ? "" : "s"} to answer before it can be adopted` : "Ready to adopt once you have read it"
                                  : "Retired"}
                            </p>
                          </div>
                          <StateBadge state={p.state} />
                        </button>
                        {open === p.id && <div className="mt-3"><PolicyEditor row={p} onChanged={load} /></div>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
          {data.policies.length === 0 && <p className="text-sm text-muted-foreground">No policies yet. Load the starting drafts above.</p>}
        </div>
      )}

      {view === "devices" && (
        <div className="space-y-4">
          <p className="max-w-3xl text-sm text-muted-foreground">Add every laptop, phone or tablet used for platform work, including a contractor's or volunteer's own device. Each one gets the same one-page checklist. A device counts as passed only when every box is ticked.</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="dev-label" className="text-xs">Device name</Label>
              <Input id="dev-label" className="h-9 w-64" placeholder="e.g. Work laptop" value={newLabel} maxLength={120} onChange={(e) => setNewLabel(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dev-kind" className="text-xs">Whose device</Label>
              <select id="dev-kind" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={newKind} onChange={(e) => setNewKind(e.target.value as DeviceKind)}>
                {DEVICE_KINDS.map((k) => (<option key={k} value={k}>{DEVICE_KIND_LABELS[k]}</option>))}
              </select>
            </div>
            <Button size="sm" disabled={newLabel.trim().length < 2} onClick={addDevice}>Add device</Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {devices.map((d) => (<DeviceCard key={`${d.id}-${d.lastCheckedAt}`} d={d} onChanged={load} />))}
          </div>
          {devices.length === 0 && <p className="text-sm text-muted-foreground">No devices yet.</p>}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Every change here is written to the audit log. <Clock className="mx-0.5 inline h-3 w-3" /> You are emailed when a review comes due. <CheckCircle2 className="mx-0.5 inline h-3 w-3" /> Nothing is published until you adopt it.
      </p>
    </div>
  );
}
