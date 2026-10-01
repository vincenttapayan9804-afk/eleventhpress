"use client";

import { useEffect, useState } from "react";
import { ALL_ROLES as ASSIGNABLE_ROLES } from "@/lib/roles";
import { RESEARCHER_PLAN_KEYS, RESEARCHER_PLANS } from "@/lib/researcher-plans";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Activity,
  CheckCircle2,
  Clock,
  PenSquare,
  FileText,
  Send,
  ShieldCheck,
  CreditCard,
  XCircle,
  Sparkles,
  Users,
  Download,
  Loader2 as Spinner,
  X,
  Globe2,
  Plus,
  CircleCheck,
  Trash2,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";

interface Props {
  audit: any[];
  stats?: { published: number; inReview: number; accepted: number; submitted: number };
  currentRole?: string;
}

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  affiliation: string | null;
  country: string | null;
  createdAt: string;
  researchPlan: string | null;
}

function UserManagementCard({ currentRole }: { currentRole?: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const canEditResearchPlan = currentRole === "SUPER_ADMIN";

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ users: AdminUser[] }>("/api/admin/users");
      setUsers(res.users);
    } catch (e: any) {
      toast.error("Failed to load users", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function changeRole(userId: string, role: string) {
    setSavingId(userId);
    try {
      await apiFetch(`/api/admin/users/${userId}/role`, {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      toast.success("Role updated");
    } catch (e: any) {
      toast.error("Failed to update role", { description: e.message });
    } finally {
      setSavingId(null);
    }
  }

  async function changeResearchPlan(userId: string, researchPlan: string) {
    setSavingPlanId(userId);
    try {
      await apiFetch(`/api/admin/users/${userId}/research-plan`, {
        method: "PATCH",
        body: JSON.stringify({ researchPlan: researchPlan === "" ? null : researchPlan }),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, researchPlan: researchPlan === "" ? null : researchPlan } : u))
      );
      toast.success("Researcher plan updated");
    } catch (e: any) {
      toast.error("Failed to update researcher plan", { description: e.message });
    } finally {
      setSavingPlanId(null);
    }
  }

  return (
    <Card className="paper-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <p className="eyebrow">User management</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Registration can only ever create Reader or Author accounts. Reviewer, editor, and admin
          access is granted here — the only place a privileged role can be assigned.
          {canEditResearchPlan
            ? " SUPER_ADMIN may also assign an individual Researcher SaaS plan, which overrides any plan bundled from the account's institution."
            : ""}
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96 pr-3 epip-scroll">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{u.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.email}
                      {u.affiliation ? ` · ${u.affiliation}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={u.role}
                      onValueChange={(v) => changeRole(u.id, v)}
                      disabled={savingId === u.id}
                    >
                      <SelectTrigger className="h-9 w-full min-w-0 sm:w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {canEditResearchPlan && (
                      <Select
                        value={u.researchPlan ?? ""}
                        onValueChange={(v) => changeResearchPlan(u.id, v)}
                        disabled={savingPlanId === u.id}
                      >
                        <SelectTrigger className="h-9 w-full min-w-0 sm:w-48" title="Researcher SaaS plan (overrides any bundled institutional plan)">
                          <SelectValue placeholder="No researcher plan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No researcher plan</SelectItem>
                          {RESEARCHER_PLAN_KEYS.map((key) => (
                            <SelectItem key={key} value={key}>
                              {RESEARCHER_PLANS[key].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface AuthorDomainEntry {
  id: string;
  hostname: string;
  verified: boolean;
  vercelAdded: boolean;
  verificationToken: string | null;
}

/**
 * Admin-provisioned custom domain for one author's public profile — same
 * trust model and verification flow as a tenant's own custom domain
 * (ownership proven via a DNS TXT record, then added to the Vercel
 * project for SSL). See the AuthorDomain model's schema comment: a
 * verified row here is provisioned but not yet wired into live request
 * routing, so this card is honest about that status rather than implying
 * the domain already serves the author's profile.
 */
function AuthorDomainsCard() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [hostname, setHostname] = useState("");
  // Keyed by userId rather than a single flat array + a separate "loading"
  // boolean toggled inside the effect — an entry's absence from the map IS
  // the loading state, so the fetch effect below never calls setState
  // synchronously in its own body (only from inside the .then()/.catch()
  // of the request it starts), which is what keeps this clear of
  // react-hooks/set-state-in-effect.
  const [domainsByUser, setDomainsByUser] = useState<Record<string, AuthorDomainEntry[]>>({});
  const [adding, setAdding] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const domains = selectedUserId ? domainsByUser[selectedUserId] : undefined;
  const loadingDomains = !!selectedUserId && domains === undefined;

  useEffect(() => {
    apiFetch<{ users: AdminUser[] }>("/api/admin/users")
      .then((res) => setUsers(res.users.filter((u) => ["AUTHOR", "EXPERT"].includes(u.role))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedUserId || domainsByUser[selectedUserId] !== undefined) return;
    apiFetch<{ domains: AuthorDomainEntry[] }>(`/api/admin/users/${selectedUserId}/domains`)
      .then((res) => setDomainsByUser((prev) => ({ ...prev, [selectedUserId]: res.domains })))
      .catch((e: any) => toast.error("Failed to load domains", { description: e.message }));
  }, [selectedUserId, domainsByUser]);

  function patchDomains(updater: (prev: AuthorDomainEntry[]) => AuthorDomainEntry[]) {
    setDomainsByUser((prev) => ({ ...prev, [selectedUserId]: updater(prev[selectedUserId] ?? []) }));
  }

  async function addDomain() {
    if (!selectedUserId || !hostname.trim()) return;
    setAdding(true);
    try {
      const res = await apiFetch<{ domain: AuthorDomainEntry }>(`/api/admin/users/${selectedUserId}/domains`, {
        method: "POST",
        body: JSON.stringify({ hostname: hostname.trim() }),
      });
      patchDomains((prev) => [...prev, res.domain]);
      setHostname("");
      toast.success("Domain added — share the TXT record with the author to verify it");
    } catch (e: any) {
      toast.error("Failed to add domain", { description: e.message });
    } finally {
      setAdding(false);
    }
  }

  async function verifyDomain(domainId: string) {
    setVerifyingId(domainId);
    try {
      const res = await apiFetch<{ domain: AuthorDomainEntry }>(`/api/admin/users/${selectedUserId}/domains/${domainId}/verify`, {
        method: "POST",
      });
      patchDomains((prev) => prev.map((d) => (d.id === domainId ? res.domain : d)));
      toast.success("Domain verified");
    } catch (e: any) {
      toast.error("Verification failed", { description: e.message });
    } finally {
      setVerifyingId(null);
    }
  }

  async function removeDomain(domainId: string) {
    setRemovingId(domainId);
    try {
      await apiFetch(`/api/admin/users/${selectedUserId}/domains/${domainId}`, { method: "DELETE" });
      patchDomains((prev) => prev.filter((d) => d.id !== domainId));
    } catch (e: any) {
      toast.error("Failed to remove domain", { description: e.message });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Card className="paper-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-primary" />
          <p className="eyebrow">Author custom domains</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Provision a verified custom domain for an author or expert's public profile. Ownership is
          proven via a DNS TXT record and the domain is added to the Vercel project for SSL —
          routing live traffic through it to the profile page is a separate step, not yet shipped.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="h-9 sm:w-64"><SelectValue placeholder="Select an author or expert" /></SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.fullName} · {u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            placeholder="jane-doe.com"
            className="h-9"
            disabled={!selectedUserId}
          />
          <Button type="button" size="sm" onClick={addDomain} disabled={!selectedUserId || !hostname.trim() || adding} className="shrink-0">
            {adding ? <Spinner className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            Add
          </Button>
        </div>

        {selectedUserId && (
          loadingDomains || !domains ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : domains.length === 0 ? (
            <p className="text-xs text-muted-foreground">No domains yet for this account.</p>
          ) : (
            <div className="space-y-2">
              {domains.map((d) => (
                <div key={d.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs">{d.hostname}</code>
                      {d.verified ? (
                        <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[0.6rem]">
                          <CircleCheck className="mr-1 h-3 w-3" /> Verified{d.vercelAdded ? "" : " · Vercel pending"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[0.6rem]">Pending verification</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!d.verified && (
                        <Button type="button" size="sm" variant="outline" onClick={() => verifyDomain(d.id)} disabled={verifyingId === d.id}>
                          {verifyingId === d.id ? <Spinner className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                          Verify
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeDomain(d.id)} disabled={removingId === d.id}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {!d.verified && d.verificationToken && (
                    <p className="mt-2 text-[0.65rem] text-muted-foreground">
                      Add a TXT record at <code className="font-mono">_ep-verify.{d.hostname}</code> with value{" "}
                      <code className="font-mono">{d.verificationToken}</code>, then click Verify.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

const ACTION_ICONS: Record<string, any> = {
  SUBMIT: Send,
  ASSIGN_REVIEWER: PenSquare,
  SUBMIT_REVIEW: PenSquare,
  ACCEPT: CheckCircle2,
  REJECT: XCircle,
  PUBLISH: Sparkles,
  DOI_MINT: FileText,
  DOI_PUBLISH: Sparkles,
  PAYMENT_RECEIVED: CreditCard,
};

// AuditLog.action/entityType are free-text strings, not Prisma enums (see
// the schema), so this is a curated list of the values actually written by
// the ~46 call sites — not exhaustive by construction, just what's
// realistic to filter by. "All" always falls back to no filter.
const AUDIT_ACTIONS = [
  "SUBMIT", "ASSIGN_REVIEWER", "SUBMIT_REVIEW", "ACCEPT", "REJECT", "PUBLISH",
  "DOI_MINT", "DOI_PUBLISH", "PAYMENT_RECEIVED", "CROSSREF_DEPOSIT", "GALLEY_GENERATED",
];
const AUDIT_ENTITY_TYPES = ["ARTICLE", "REVIEW", "INVOICE", "SUBSCRIPTION", "USER"];

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  articleId: string | null;
  metadata: string | null;
  createdAt: string;
  user?: { fullName: string; role: string } | null;
}

function AuditLogCard({ initialAudit }: { initialAudit: AuditEntry[] }) {
  const [entries, setEntries] = useState<AuditEntry[]>(initialAudit);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filtersActive, setFiltersActive] = useState(false);
  const [action, setAction] = useState<string>("");
  const [entityType, setEntityType] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  function buildParams(withCursor?: string | null) {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (entityType) params.set("entityType", entityType);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q.trim()) params.set("q", q.trim());
    if (withCursor) params.set("cursor", withCursor);
    return params;
  }

  async function runSearch() {
    setLoading(true);
    setFiltersActive(true);
    try {
      const params = buildParams();
      const res = await apiFetch<{ entries: AuditEntry[]; nextCursor: string | null }>(
        `/api/admin/audit-log?${params.toString()}`
      );
      setEntries(res.entries);
      setCursor(res.nextCursor);
    } catch (e: any) {
      toast.error("Failed to load audit log", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const params = buildParams(cursor);
      const res = await apiFetch<{ entries: AuditEntry[]; nextCursor: string | null }>(
        `/api/admin/audit-log?${params.toString()}`
      );
      setEntries((prev) => [...prev, ...res.entries]);
      setCursor(res.nextCursor);
    } catch (e: any) {
      toast.error("Failed to load more", { description: e.message });
    } finally {
      setLoadingMore(false);
    }
  }

  function clearFilters() {
    setAction("");
    setEntityType("");
    setFrom("");
    setTo("");
    setQ("");
    setFiltersActive(false);
    setEntries(initialAudit);
    setCursor(null);
  }

  function exportCsv() {
    const params = buildParams();
    params.set("format", "csv");
    window.open(`/api/admin/audit-log?${params.toString()}`, "_blank");
  }

  return (
    <Card className="paper-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <p className="eyebrow">Cross-service audit log</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Every state transition across all microservices is recorded here. The log is
          append-only and serves as the system’s event-sourcing backbone.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={action || "__all"} onValueChange={(v) => setAction(v === "__all" ? "" : v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All actions</SelectItem>
              {AUDIT_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={entityType || "__all"} onValueChange={(v) => setEntityType(v === "__all" ? "" : v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Entity type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All entity types</SelectItem>
              {AUDIT_ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-xs" aria-label="From date" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-xs" aria-label="To date" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search entity ID…"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-xs"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={runSearch} disabled={loading}>
            {loading ? <Spinner className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Apply filters
          </Button>
          {filtersActive && (
            <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
              <X className="mr-1.5 h-3.5 w-3.5" /> Clear
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={exportCsv} className="ml-auto">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[28rem] pr-3 epip-scroll">
          <div className="space-y-2">
            {entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No audit entries match these filters.</p>
            ) : (
              entries.map((e) => {
                const Icon = ACTION_ICONS[e.action] || Activity;
                return (
                  <div key={e.id} className="flex items-start gap-3 rounded-md border border-border p-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[0.6rem]">
                          {e.action}
                        </Badge>
                        <span className="text-[0.65rem] text-muted-foreground">
                          {e.user?.fullName || "system"} · {e.user?.role || ""}
                        </span>
                        <span className="ml-auto text-[0.65rem] text-muted-foreground">
                          {new Date(e.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs">
                        <span className="text-muted-foreground">{e.entityType}</span>
                        {" · "}
                        <code className="font-mono text-[0.65rem]">{e.entityId.slice(0, 12)}</code>
                      </p>
                      {e.metadata && (
                        <pre className="mt-1 overflow-x-auto rounded bg-muted/30 px-2 py-1 font-mono text-[0.6rem] text-foreground/70 epip-scroll">
                          {typeof e.metadata === "string" ? e.metadata : JSON.stringify(e.metadata)}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {cursor && (
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <Spinner className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Load more
              </Button>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function AdminTab({ audit, stats, currentRole }: Props) {
  return (
    <div className="space-y-5">
      {/* Stats */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-4">
          <StatTile icon={Clock} label="Submitted" value={stats.submitted} color="text-amber-600" />
          <StatTile icon={PenSquare} label="In review" value={stats.inReview} color="text-violet-600" />
          <StatTile icon={CheckCircle2} label="Accepted" value={stats.accepted} color="text-emerald-600" />
          <StatTile icon={FileText} label="Published" value={stats.published} color="text-primary" />
        </div>
      )}

      <UserManagementCard currentRole={currentRole} />

      <AuthorDomainsCard />

      <AuditLogCard initialAudit={audit} />

      {/* Service health (mock) */}
      <Card className="paper-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="eyebrow">Microservice health</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              "IAM Service",
              "Submission Service",
              "Workflow & Peer Review",
              "Production & Typesetting",
              "Indexing & Discovery",
              "DOI & Metadata",
              "Billing & Subscription",
              "Notification Service",
              "Audit & Event Sourcing",
            ].map((s) => (
              <div key={s} className="flex items-center justify-between rounded-md border border-border p-2.5">
                <span className="font-sans text-xs">{s}</span>
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[0.6rem]">
                  <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  healthy
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card className="paper-card">
      <CardContent className="p-4">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="mt-1.5 font-display text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
