"use client";

/**
 * Dashboard → Research Assistant: how readers use "Ask the Corpus" and how
 * well it answers, the readers' ratings and issue reports for the editors
 * to review, and (for an institution's admin, or the platform super admin)
 * the assistant's settings: on/off, a disclaimer, hourly question limits,
 * conversation retention, starter questions and question logging.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flag,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Save,
  Search,
  SearchX,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { AssistantAnalytics } from "@/lib/research-assistant-admin";

const chartConfig = {
  answered: { label: "Answered", color: "var(--chart-1)" },
  notCovered: { label: "Not covered by the journal", color: "var(--chart-4)" },
  other: { label: "Unavailable, timed out or stopped", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

const INTENT_LABELS: Record<string, string> = {
  bibliographic: "Bibliographic lookups",
  section: "A part of a paper",
  comparison: "Comparisons across papers",
  overview: "Journal overviews",
  general: "Research questions",
};

const PROVIDER_LABELS: Record<string, string> = {
  "self-hosted": "Self-hosted",
  "oss-free": "Free (OpenRouter)",
  anthropic: "Anthropic",
  "local-airgapped": "Local (airgapped)",
};

const ISSUE_LABELS: Record<string, string> = {
  INACCURATE: "Inaccurate information",
  WRONG_CITATION: "Citation doesn't support the claim",
  MISSING_INFORMATION: "Missing or incomplete",
  WRONG_ARTICLE: "Wrong article",
  OTHER: "Other",
};

interface FeedbackItem {
  id: string;
  rating: "HELPFUL" | "NOT_HELPFUL" | "ISSUE";
  issueType: string | null;
  comment: string | null;
  question: string;
  answer: string;
  status: "OPEN" | "RESOLVED";
  resolution: string | null;
  resolvedAt: string | null;
  signedIn: boolean;
  createdAt: string;
  institution?: string | null;
  articles: { id: string; title: string }[];
}

interface SettingsPayload {
  tenantId: string;
  canManage: boolean;
  settings: {
    enabled: boolean;
    disclaimer: string | null;
    retentionDays: number | null;
    starterQuestions: string[];
    signedInHourlyLimit: number;
    anonymousHourlyLimit: number;
    logQuestions: boolean;
    updatedAt: string | null;
  };
  defaults: { signedInHourlyLimit: number; anonymousHourlyLimit: number; retentionDays: number };
}

type Section = "overview" | "feedback" | "settings";

function fmtMs(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function pct(v: number | null): string {
  return v === null ? "—" : `${v}%`;
}

export function ResearchAssistantTab({ role, platformAdmin }: { role: string; platformAdmin: boolean }) {
  const [section, setSection] = useState<Section>("overview");
  const [tenantId, setTenantId] = useState<string>("");
  const [tenants, setTenants] = useState<{ id: string; name: string; isPlatform?: boolean }[]>([]);
  const canSeeSettings = role === "SUPER_ADMIN" || role === "TENANT_ADMIN";

  useEffect(() => {
    if (!platformAdmin) return;
    apiFetch<{ tenants: { id: string; name: string; isPlatform?: boolean }[] }>("/api/admin/tenants")
      .then((r) => setTenants(r.tenants ?? []))
      .catch(() => setTenants([]));
  }, [platformAdmin]);

  const tenantParam = tenantId ? `tenantId=${encodeURIComponent(tenantId)}` : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Research Assistant</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            How readers use Ask the Corpus, how well it answers from the journal&apos;s articles, and what they report — so the editors can act on it.
          </p>
        </div>
        {platformAdmin && (
          <label className="text-xs font-medium text-muted-foreground">
            Institution
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="mt-1 block h-9 min-w-[14rem] rounded-md border border-border bg-background px-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">Eleventh Press (platform)</option>
              <option value="all">All institutions</option>
              {tenants
                .filter((t) => !t.isPlatform)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>

      <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-sm" role="tablist" aria-label="Research Assistant sections">
        {(
          [
            ["overview", "Usage & quality"],
            ["feedback", "Feedback & reports"],
            ...(canSeeSettings ? [["settings", "Settings"]] : []),
          ] as [Section, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={section === key}
            onClick={() => setSection(key)}
            className={cn(
              "rounded-md px-3.5 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              section === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "overview" && <Overview tenantParam={tenantParam} showByTenant={tenantId === "all"} />}
      {section === "feedback" && <Feedback tenantParam={tenantParam} showInstitution={tenantId === "all"} />}
      {section === "settings" && canSeeSettings && (tenantId === "all" ? <p className="text-sm text-muted-foreground">Choose one institution to change its settings.</p> : <Settings tenantParam={tenantParam} />)}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Overview({ tenantParam, showByTenant }: { tenantParam: string; showByTenant: boolean }) {
  const [days, setDays] = useState(30);
  const key = `${days}|${tenantParam}`;
  const [result, setResult] = useState<{ key: string; data?: AssistantAnalytics; error?: string } | null>(null);
  const [lastData, setLastData] = useState<AssistantAnalytics | null>(null);
  const loading = result?.key !== key;
  const error = !loading ? (result?.error ?? null) : null;
  const data = (!loading ? result?.data : null) ?? lastData;

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ analytics: AssistantAnalytics }>(`/api/admin/research-assistant/analytics?days=${days}${tenantParam ? `&${tenantParam}` : ""}`)
      .then((r) => {
        if (cancelled) return;
        setResult({ key: `${days}|${tenantParam}`, data: r.analytics });
        setLastData(r.analytics);
      })
      .catch((e) => !cancelled && setResult({ key: `${days}|${tenantParam}`, error: e?.message || "Analytics couldn't be loaded." }));
    return () => {
      cancelled = true;
    };
  }, [days, tenantParam]);

  const tiles = useMemo(() => {
    if (!data) return [];
    const t = data.totals;
    return [
      { label: "Questions asked", value: t.questions.toLocaleString(), icon: MessageSquareText, hint: `${pct(t.signedInShare)} from signed-in readers` },
      {
        label: "Answered from the journal",
        value: t.questions ? `${Math.round((t.answered / t.questions) * 100)}%` : "—",
        icon: CheckCircle2,
        hint: `${t.answered.toLocaleString()} answered · ${t.notCovered.toLocaleString()} not covered`,
      },
      { label: "Evidence fully verified", value: pct(t.verifiedShare), icon: ShieldCheck, hint: "Citations, DOIs, quotes and figures checked" },
      { label: "Rated helpful", value: pct(data.feedback.helpfulRate), icon: ThumbsUp, hint: `${data.feedback.helpful} 👍 · ${data.feedback.notHelpful} 👎` },
      {
        label: "Typical response time",
        value: fmtMs(t.medianLatencyMs),
        icon: Clock,
        hint: `First words after ${fmtMs(t.medianFirstTokenMs ?? null)} · 90% within ${fmtMs(t.p90LatencyMs)}${t.timeouts ? ` · ${t.timeouts} hit the time limit` : ""}`,
        alert: t.timeouts > 0,
      },
      {
        label: "Open issue reports",
        value: data.feedback.openIssues.toLocaleString(),
        icon: Flag,
        hint: `${data.feedback.issues} reported in this period`,
        alert: data.feedback.openIssues > 0,
      },
    ];
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1.5" role="group" aria-label="Period">
        {[7, 30, 90, 180].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            aria-pressed={days === d}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              days === d ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            Last {d} days
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : error ? (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {error}
        </p>
      ) : data ? (
        <>
          <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-3", loading && "opacity-60")}>
            {tiles.map((t) => (
              <Card key={t.label} className={cn("paper-card", t.alert && "border-amber-500/40")}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
                    <t.icon className={cn("h-4 w-4", t.alert ? "text-amber-600" : "text-primary")} aria-hidden="true" />
                  </div>
                  <p className="mt-1.5 font-display text-3xl font-semibold tabular-nums">{t.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="paper-card">
            <CardHeader className="pb-0">
              <h3 className="font-display text-base font-semibold">Questions per day</h3>
            </CardHeader>
            <CardContent className="pt-4">
              {data.totals.questions === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No questions in this period yet.</p>
              ) : (
                <ChartContainer config={chartConfig} className="h-64 w-full">
                  <BarChart data={data.daily} margin={{ left: 0, right: 12, top: 8 }}>
                    <CartesianGrid vertical={false} strokeOpacity={0.4} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      minTickGap={32}
                      tickFormatter={(d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                    <ChartTooltip
                      cursor={{ fillOpacity: 0.06 }}
                      content={<ChartTooltipContent labelFormatter={(d) => new Date(String(d)).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} />}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="answered" stackId="q" fill="var(--color-answered)" maxBarSize={18} />
                    <Bar dataKey="notCovered" stackId="q" fill="var(--color-notCovered)" maxBarSize={18} />
                    <Bar dataKey="other" stackId="q" fill="var(--color-other)" fillOpacity={0.45} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
            <Card className="paper-card">
              <CardHeader className="pb-2">
                <h3 className="flex items-center gap-2 font-display text-base font-semibold">
                  <SearchX className="h-4 w-4 text-amber-600" aria-hidden="true" /> Questions the journal couldn&apos;t answer
                </h3>
                <p className="text-xs text-muted-foreground">Not covered by the published articles, or rated unhelpful — candidates for calls for papers, special issues or clearer abstracts.</p>
              </CardHeader>
              <CardContent>
                {data.unanswered.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">None in this period.</p>
                ) : (
                  <ol className="divide-y divide-border/70">
                    {data.unanswered.map((u) => (
                      <li key={u.question} className="flex items-start justify-between gap-3 py-2">
                        <span className="text-sm leading-snug text-foreground">{u.question}</span>
                        <span className="flex-shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">×{u.count}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {data.totals.questions > 0 && data.unanswered.length === 0 && data.totals.notCovered > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">Question text isn&apos;t being kept (see Settings → Keep question text).</p>
                )}
              </CardContent>
            </Card>
            <Card className="paper-card">
              <CardHeader className="pb-2">
                <h3 className="font-display text-base font-semibold">What readers ask</h3>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {data.intents.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No answered questions yet.</p>
                ) : (
                  data.intents.map((i) => {
                    const total = data.intents.reduce((s, x) => s + x.count, 0);
                    const share = total ? Math.round((i.count / total) * 100) : 0;
                    return (
                      <div key={i.intent}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-foreground">{INTENT_LABELS[i.intent] ?? i.intent}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {i.count} · {share}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
                <p className="pt-1 text-xs text-muted-foreground">{pct(data.totals.scopedShare)} of questions were narrowed to part of the journal.</p>
                {data.models?.length ? (
                  <div className="border-t border-border pt-2.5">
                    <p className="text-xs font-medium text-foreground">Models that answered</p>
                    <ul className="mt-1.5 space-y-1">
                      {data.models.map((m) => (
                        <li key={`${m.provider}|${m.model}`} className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate text-muted-foreground" title={m.model}>
                            {PROVIDER_LABELS[m.provider] ?? m.provider} · {m.model}
                          </span>
                          <span className="tabular-nums text-muted-foreground">{m.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {showByTenant && data.byTenant && (
            <Card className="paper-card">
              <CardHeader className="pb-2">
                <h3 className="font-display text-base font-semibold">By institution</h3>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-3 font-semibold">Institution</th>
                      <th className="py-2 pr-3 text-right font-semibold">Questions</th>
                      <th className="py-2 pr-3 text-right font-semibold">Answered</th>
                      <th className="py-2 pr-3 text-right font-semibold">Rated helpful</th>
                      <th className="py-2 text-right font-semibold">Open reports</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byTenant.map((r) => (
                      <tr key={r.tenantId ?? "none"} className="border-b border-border/60">
                        <td className="py-2 pr-3">{r.name}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.questions.toLocaleString()}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.questions ? `${Math.round((r.answered / r.questions) * 100)}%` : "—"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{pct(r.helpfulRate)}</td>
                        <td className={cn("py-2 text-right tabular-nums", r.openIssues > 0 && "font-semibold text-amber-700 dark:text-amber-300")}>{r.openIssues}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Feedback({ tenantParam, showInstitution }: { tenantParam: string; showInstitution: boolean }) {
  const [rating, setRating] = useState<"" | "ISSUE" | "NOT_HELPFUL" | "HELPFUL">("ISSUE");
  const [status, setStatus] = useState<"" | "OPEN" | "RESOLVED">("OPEN");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: FeedbackItem[]; total: number; pageSize: number } | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (rating) p.set("rating", rating);
    if (rating === "ISSUE" && status) p.set("status", status);
    if (query) p.set("q", query);
    p.set("page", String(page));
    return `${p}${tenantParam ? `&${tenantParam}` : ""}`;
  }, [rating, status, query, page, tenantParam]);
  const requestKey = `${params}#${reloads}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ items: FeedbackItem[]; total: number; pageSize: number }>(`/api/admin/research-assistant/feedback?${params}`)
      .then((r) => !cancelled && setData(r))
      .catch((e) => !cancelled && toast.error(e?.message || "Feedback couldn't be loaded."))
      .finally(() => !cancelled && setLoadedKey(`${params}#${reloads}`));
    return () => {
      cancelled = true;
    };
  }, [params, reloads]);
  const load = useCallback(() => setReloads((n) => n + 1), []);

  async function setItemStatus(item: FeedbackItem, next: "OPEN" | "RESOLVED") {
    setSaving(item.id);
    try {
      await apiFetch(`/api/admin/research-assistant/feedback/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next, resolution: notes[item.id] ?? "" }),
      });
      toast.success(next === "RESOLVED" ? "Report resolved." : "Report reopened.");
      load();
    } catch (e: any) {
      toast.error(e?.message || "The report couldn't be updated.");
    } finally {
      setSaving(null);
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["ISSUE", "Issue reports", Flag],
            ["NOT_HELPFUL", "Not helpful", ThumbsDown],
            ["HELPFUL", "Helpful", ThumbsUp],
            ["", "All feedback", MessageSquareText],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key || "all"}
            type="button"
            onClick={() => {
              setRating(key);
              setPage(1);
            }}
            aria-pressed={rating === key}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              rating === key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
          </button>
        ))}
        {rating === "ISSUE" && (
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
            aria-label="Report status"
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Resolved</option>
            <option value="">Open and resolved</option>
          </select>
        )}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search questions, answers, notes"
            aria-label="Search feedback"
            className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-xs focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card className="paper-card">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-600" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Nothing here</p>
            <p className="mt-1 text-xs text-muted-foreground">{rating === "ISSUE" && status === "OPEN" ? "No open issue reports. Readers' reports appear here, and editors are notified." : "No feedback matches these filters."}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className={cn("space-y-2.5", loading && "opacity-60")}>
          {data.items.map((item) => {
            const open = expanded === item.id;
            return (
              <li key={item.id}>
                <Card className="paper-card">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {item.rating === "ISSUE" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-800 dark:text-amber-300">
                          <Flag className="h-3 w-3" aria-hidden="true" /> {ISSUE_LABELS[item.issueType ?? "OTHER"]}
                        </span>
                      ) : item.rating === "HELPFUL" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">
                          <ThumbsUp className="h-3 w-3" aria-hidden="true" /> Helpful
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
                          <ThumbsDown className="h-3 w-3" aria-hidden="true" /> Not helpful
                        </span>
                      )}
                      {item.rating === "ISSUE" && (
                        <span className={cn("rounded-full px-2 py-0.5 font-medium", item.status === "RESOLVED" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-primary/10 text-primary")}>
                          {item.status === "RESOLVED" ? "Resolved" : "Open"}
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {item.signedIn ? "signed-in reader" : "visitor"}
                        {showInstitution && item.institution ? ` · ${item.institution}` : ""}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-snug text-foreground">“{item.question}”</p>
                    {item.comment && <p className="mt-1 text-sm text-foreground/85">Reader&apos;s note: {item.comment}</p>}
                    {item.articles.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">Cited: {item.articles.map((a) => a.title).join(" · ")}</p>
                    )}
                    <button type="button" onClick={() => setExpanded(open ? null : item.id)} className="mt-2 text-xs font-medium text-primary hover:underline" aria-expanded={open}>
                      {open ? "Hide the answer" : "Show the answer it gave"}
                    </button>
                    {open && <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-foreground/85">{item.answer}</p>}
                    {item.rating === "ISSUE" && (
                      <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-start">
                        {item.status === "OPEN" ? (
                          <>
                            <Textarea
                              value={notes[item.id] ?? ""}
                              onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))}
                              placeholder="Optional: what was done (e.g. corrected the article's abstract, passed to the authors)"
                              maxLength={1000}
                              className="min-h-[38px] flex-1 text-xs"
                            />
                            <button
                              type="button"
                              disabled={saving === item.id}
                              onClick={() => void setItemStatus(item, "RESOLVED")}
                              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                            >
                              {saving === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Mark resolved
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="flex-1 text-xs text-muted-foreground">
                              Resolved {item.resolvedAt ? new Date(item.resolvedAt).toLocaleDateString() : ""}
                              {item.resolution ? ` — ${item.resolution}` : ""}
                            </p>
                            <button
                              type="button"
                              disabled={saving === item.id}
                              onClick={() => void setItemStatus(item, "OPEN")}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-60"
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Reopen
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {data.total.toLocaleString()} item{data.total === 1 ? "" : "s"} · page {page} of {pages}
          </span>
          <div className="flex gap-1.5">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40">
              Previous
            </button>
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Settings({ tenantParam }: { tenantParam: string }) {
  const [loaded, setLoaded] = useState<{ param: string; data: SettingsPayload } | null>(null);
  const [form, setForm] = useState<SettingsPayload["settings"] | null>(null);
  const [questionsText, setQuestionsText] = useState("");
  const [saving, setSaving] = useState(false);
  const data = loaded?.param === tenantParam ? loaded.data : null;

  useEffect(() => {
    let cancelled = false;
    apiFetch<SettingsPayload>(`/api/admin/research-assistant/settings${tenantParam ? `?${tenantParam}` : ""}`)
      .then((r) => {
        if (cancelled) return;
        setLoaded({ param: tenantParam, data: r });
        setForm(r.settings);
        setQuestionsText(r.settings.starterQuestions.join("\n"));
      })
      .catch((e) => !cancelled && toast.error(e?.message || "Settings couldn't be loaded."));
    return () => {
      cancelled = true;
    };
  }, [tenantParam]);

  if (!data || !form) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted/60" />;
  }
  const disabled = !data.canManage;

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ settings: SettingsPayload["settings"] }>(`/api/admin/research-assistant/settings${tenantParam ? `?${tenantParam}` : ""}`, {
        method: "PUT",
        body: JSON.stringify({
          enabled: form.enabled,
          disclaimer: form.disclaimer ?? "",
          retentionDays: form.retentionDays,
          signedInHourlyLimit: form.signedInHourlyLimit,
          anonymousHourlyLimit: form.anonymousHourlyLimit,
          logQuestions: form.logQuestions,
          starterQuestions: questionsText.split("\n").map((s) => s.trim()).filter(Boolean),
        }),
      });
      setForm(res.settings);
      setQuestionsText(res.settings.starterQuestions.join("\n"));
      toast.success("Research Assistant settings saved. Readers see them within a minute.");
    } catch (e: any) {
      toast.error(e?.message || "Settings couldn't be saved.");
    } finally {
      setSaving(false);
    }
  }

  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const field = "mt-1.5 h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none disabled:opacity-60";

  return (
    <Card className="paper-card">
      <CardContent className="space-y-6 p-5">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-semibold text-foreground">Offer the Research Assistant</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">When off, the Ask the Corpus button is hidden from readers on this site.</span>
          </span>
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} disabled={disabled} aria-label="Offer the Research Assistant" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-foreground">Additional disclaimer</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">Shown under the question box after the standard accuracy note (up to 600 characters).</span>
          <Textarea
            value={form.disclaimer ?? ""}
            onChange={(e) => setForm({ ...form, disclaimer: e.target.value })}
            maxLength={600}
            disabled={disabled}
            placeholder="e.g. Answers are for study support and don't replace your supervisor's guidance."
            className="mt-1.5 min-h-[70px] text-sm"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-semibold text-foreground">Questions per hour — signed-in reader</span>
            <input
              type="number"
              min={1}
              max={2000}
              value={form.signedInHourlyLimit}
              disabled={disabled}
              onChange={(e) => setForm({ ...form, signedInHourlyLimit: Number(e.target.value) || data.defaults.signedInHourlyLimit })}
              className={field}
            />
            <span className="mt-1 block text-xs text-muted-foreground">Each account&apos;s own quota. Default {data.defaults.signedInHourlyLimit}.</span>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-foreground">Questions per hour — visitors per network</span>
            <input
              type="number"
              min={1}
              max={2000}
              value={form.anonymousHourlyLimit}
              disabled={disabled}
              onChange={(e) => setForm({ ...form, anonymousHourlyLimit: Number(e.target.value) || data.defaults.anonymousHourlyLimit })}
              className={field}
            />
            <span className="mt-1 block text-xs text-muted-foreground">Shared by everyone on one network address (a campus can share one). Default {data.defaults.anonymousHourlyLimit}.</span>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-foreground">Keep conversations for (days)</span>
            <input
              type="number"
              min={7}
              max={3650}
              value={form.retentionDays ?? ""}
              placeholder={String(data.defaults.retentionDays)}
              disabled={disabled}
              onChange={(e) => setForm({ ...form, retentionDays: num(e.target.value) })}
              className={field}
            />
            <span className="mt-1 block text-xs text-muted-foreground">After the last activity. Empty = platform default ({data.defaults.retentionDays} days).</span>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-foreground">Starter questions</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">One per line, up to 8. Shown first in an empty chat as “Suggested by the editors”.</span>
          <Textarea
            value={questionsText}
            onChange={(e) => setQuestionsText(e.target.value)}
            disabled={disabled}
            placeholder={"What research has the journal published on teacher wellbeing?\nWhich studies used mixed methods in 2025?"}
            className="mt-1.5 min-h-[110px] text-sm"
          />
        </label>

        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-semibold text-foreground">Keep question text in the analytics</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Lets editors see which questions the journal couldn&apos;t answer. No names, accounts or network addresses are stored with them; they&apos;re deleted after 180 days.
            </span>
          </span>
          <Switch checked={form.logQuestions} onCheckedChange={(v) => setForm({ ...form, logQuestions: v })} disabled={disabled} aria-label="Keep question text in the analytics" />
        </label>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <p className="text-xs text-muted-foreground">{form.updatedAt ? `Last changed ${new Date(form.updatedAt).toLocaleString()}` : "Using the platform defaults."}</p>
          {data.canManage && (
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
