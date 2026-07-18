"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { ALL_ROLES as ASSIGNABLE_ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  ShieldCheck,
  Lock,
  Loader2,
  ArrowLeft,
  Users,
  FileCheck2,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Send,
  PenSquare,
  FileText,
  Sparkles,
  CreditCard,
  Search,
  RefreshCw,
  FileDown,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  affiliation: string | null;
  country: string | null;
  createdAt: string;
}

interface SearchIndexStatus {
  pgvectorReady: boolean;
  rowCount: number;
}

interface GalleyJobRow {
  id: string;
  articleId: string;
  articleTitle: string | null;
  status: string;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface RoleApp {
  id: string;
  userId: string;
  requestedRole: string;
  status: string;
  applicationText: string | null;
  orcidId: string | null;
  expertise: string | null;
  specializations: string | null;
  resumeKey: string | null;
  transcriptKey: string | null;
  certificateKeys: string | null;
  reviewNote: string | null;
  createdAt: string;
  applicant: { id: string; email: string; fullName: string; affiliation: string | null; country: string | null; orcid: string | null };
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
  ROLE_APPLICATION_APPROVED: CheckCircle2,
  ROLE_APPLICATION_REJECTED: XCircle,
};

export function AdminPortalView() {
  const { user, adminVerified, setAdminVerified, setView } = useApp();

  if (!user || user.role !== "SUPER_ADMIN") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 font-display text-2xl font-semibold">Access Denied</h2>
        <p className="mt-2 text-muted-foreground">This portal is restricted to administrators.</p>
        <Button variant="outline" className="mt-6" onClick={() => setView("home")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Home
        </Button>
      </div>
    );
  }

  if (!adminVerified) {
    return <PasswordGate onVerified={() => setAdminVerified(true)} onBack={() => setView("home")} />;
  }

  return <AdminDashboard />;
}

function PasswordGate({ onVerified, onBack }: { onVerified: () => void; onBack: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/admin/verify", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      onVerified();
      toast.success("Admin portal unlocked");
    } catch {
      toast.error("Invalid admin password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <Card className="paper-card">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-semibold">Admin Portal</h2>
          <p className="text-sm text-muted-foreground">
            Enter the admin passphrase to continue.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={verify} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-pw">Admin Passphrase</Label>
              <Input
                id="admin-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10"
                autoFocus
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <ShieldCheck className="mr-1.5 h-4 w-4" /> Verify
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminDashboard() {
  const { setView } = useApp();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [applications, setApplications] = useState<RoleApp[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [searchIndex, setSearchIndex] = useState<SearchIndexStatus | null>(null);
  const [searchIndexLoading, setSearchIndexLoading] = useState(true);
  const [searchIndexError, setSearchIndexError] = useState(false);
  const [galleyJobs, setGalleyJobs] = useState<GalleyJobRow[]>([]);
  const [galleyJobsLoading, setGalleyJobsLoading] = useState(true);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  const loadSearchIndex = useCallback(async () => {
    setSearchIndexLoading(true);
    setSearchIndexError(false);
    try {
      const res = await apiFetch<SearchIndexStatus>("/api/search/semantic/status");
      setSearchIndex(res);
    } catch {
      setSearchIndexError(true);
    } finally {
      setSearchIndexLoading(false);
    }
  }, []);

  const loadGalleyJobs = useCallback(async () => {
    setGalleyJobsLoading(true);
    try {
      const res = await apiFetch<{ jobs: GalleyJobRow[] }>("/api/admin/galley-jobs");
      setGalleyJobs(res.jobs);
    } catch (e: any) {
      toast.error("Failed to load galley jobs", { description: e.message });
    } finally {
      setGalleyJobsLoading(false);
    }
  }, []);

  async function retryGalleyJob(jobId: string) {
    setRetryingJobId(jobId);
    try {
      await apiFetch(`/api/admin/galley-jobs/${jobId}/retry`, { method: "POST" });
      toast.success("Galley job retried");
      loadGalleyJobs();
    } catch (e: any) {
      toast.error("Retry failed", { description: e.message });
    } finally {
      setRetryingJobId(null);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, appsRes, dashRes] = await Promise.all([
        apiFetch<{ users: AdminUser[] }>("/api/admin/users"),
        apiFetch<{ applications: RoleApp[] }>("/api/applications?status=PENDING"),
        apiFetch<any>("/api/dashboard"),
      ]);
      setUsers(usersRes.users);
      setApplications(appsRes.applications);
      setAudit(dashRes.recentAudit || []);
      setStats(dashRes.stats || null);
    } catch (e: any) {
      toast.error("Failed to load admin data", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadSearchIndex();
    loadGalleyJobs();
  }, [load, loadSearchIndex, loadGalleyJobs]);

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

  async function reviewApplication(appId: string, action: "APPROVE" | "REJECT") {
    setReviewingId(appId);
    try {
      await apiFetch(`/api/applications/${appId}/review`, {
        method: "POST",
        body: JSON.stringify({ action, note: reviewNote }),
      });
      toast.success(action === "APPROVE" ? "Application approved" : "Application rejected");
      setReviewNote("");
      setExpandedApp(null);
      load();
    } catch (e: any) {
      toast.error("Review failed", { description: e.message });
    } finally {
      setReviewingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const pendingCount = applications.filter((a) => a.status === "PENDING").length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <p className="eyebrow">Gated Admin Portal</p>
          </div>
          <h1 className="mt-1 font-display text-3xl font-semibold">Administration</h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[0.6rem]">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Verified
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setView("dashboard")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Dashboard
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid gap-3 sm:grid-cols-4">
            <StatTile label="Submitted" value={stats.submitted} color="text-amber-600" />
            <StatTile label="In Review" value={stats.inReview} color="text-violet-600" />
            <StatTile label="Accepted" value={stats.accepted} color="text-emerald-600" />
            <StatTile label="Published" value={stats.published} color="text-primary" />
          </div>
        )}

        {/* Search Index Status */}
        <Card className="paper-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                <p className="eyebrow">Search Index (pgvector)</p>
              </div>
              <Button variant="ghost" size="sm" onClick={loadSearchIndex} disabled={searchIndexLoading}>
                <RefreshCw className={`h-3.5 w-3.5 ${searchIndexLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Semantic search and manuscript similarity checks use a Postgres vector index when
              available, and always fall back to the unindexed scan on any failure — this never
              affects search or submission functionality either way.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              {searchIndexLoading ? (
                <Badge variant="outline" className="text-[0.65rem]">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Checking…
                </Badge>
              ) : searchIndexError ? (
                <Badge variant="outline" className="border-muted-foreground/30 text-[0.65rem]">
                  <Clock className="mr-1 h-3 w-3" /> Status unavailable
                </Badge>
              ) : searchIndex?.pgvectorReady ? (
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[0.65rem]">
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Indexed — pgvector active
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[0.65rem]">
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Fallback — in-memory scan active
                </Badge>
              )}
              {searchIndex && (
                <span className="text-xs text-muted-foreground">
                  {searchIndex.rowCount.toLocaleString()} article{searchIndex.rowCount === 1 ? "" : "s"} indexed
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Galley Jobs */}
        <Card className="paper-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileDown className="h-4 w-4 text-primary" />
                <p className="eyebrow">Galley Generation Jobs</p>
              </div>
              <Button variant="ghost" size="sm" onClick={loadGalleyJobs} disabled={galleyJobsLoading}>
                <RefreshCw className={`h-3.5 w-3.5 ${galleyJobsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Recent HTML/PDF/JATS galley builds. A daily sweep automatically retries any job
              that never completed (e.g. a crashed request); failed jobs can also be retried
              manually here.
            </p>
          </CardHeader>
          <CardContent>
            {galleyJobsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : galleyJobs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No galley jobs yet.</p>
            ) : (
              <ScrollArea className="h-80 pr-3 epip-scroll">
                <div className="space-y-2">
                  {galleyJobs.map((j) => (
                    <div key={j.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{j.articleTitle || j.articleId}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(j.createdAt).toLocaleString()}
                          {j.errorMessage ? ` · ${j.errorMessage}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <GalleyStatusBadge status={j.status} />
                        {j.status !== "PROCESSING" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => retryGalleyJob(j.id)}
                            disabled={retryingJobId === j.id}
                          >
                            {retryingJobId === j.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Role Applications */}
        <Card className="paper-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-primary" />
                <p className="eyebrow">Role Applications</p>
              </div>
              {pendingCount > 0 && (
                <Badge variant="default" className="font-mono text-[0.6rem]">
                  {pendingCount} pending
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Review and approve reviewer/editor qualification applications.
            </p>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No pending applications.</p>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div key={app.id} className="rounded-md border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{app.applicant.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {app.applicant.email}
                          {app.applicant.affiliation ? ` · ${app.applicant.affiliation}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{app.requestedRole}</Badge>
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300">{app.status}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedApp(expandedApp === app.id ? null : app.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {expandedApp === app.id && (
                      <div className="mt-4 space-y-3 border-t border-border pt-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <DetailRow label="ORCID" value={app.orcidId} />
                          <DetailRow label="Expertise" value={app.expertise} />
                          <DetailRow label="Specializations" value={app.specializations} />
                          <DetailRow label="Country" value={app.applicant.country} />
                        </div>
                        {app.applicationText && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Statement:</p>
                            <p className="mt-1 text-sm">{app.applicationText}</p>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs">
                          {app.resumeKey && (
                            <Badge variant="outline" className="border-emerald-300">
                              <FileCheck2 className="mr-1 h-3 w-3" /> Resume
                            </Badge>
                          )}
                          {app.transcriptKey && (
                            <Badge variant="outline" className="border-emerald-300">
                              <FileCheck2 className="mr-1 h-3 w-3" /> Transcript
                            </Badge>
                          )}
                          {app.certificateKeys && JSON.parse(app.certificateKeys).length > 0 && (
                            <Badge variant="outline" className="border-emerald-300">
                              <FileCheck2 className="mr-1 h-3 w-3" /> {JSON.parse(app.certificateKeys).length} Certificate(s)
                            </Badge>
                          )}
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <Label className="text-xs">Review Note (optional)</Label>
                          <Input
                            value={reviewNote}
                            onChange={(e) => setReviewNote(e.target.value)}
                            placeholder="Reason for decision..."
                            className="h-9"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => reviewApplication(app.id, "APPROVE")}
                              disabled={reviewingId === app.id}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              {reviewingId === app.id ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reviewApplication(app.id, "REJECT")}
                              disabled={reviewingId === app.id}
                              className="border-rose-300 text-rose-700 hover:bg-rose-50"
                            >
                              <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Management */}
        <Card className="paper-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="eyebrow">User Management</p>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96 pr-3 epip-scroll">
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{u.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.email}{u.affiliation ? ` · ${u.affiliation}` : ""}
                      </p>
                    </div>
                    <Select value={u.role} onValueChange={(v) => changeRole(u.id, v)} disabled={savingId === u.id}>
                      <SelectTrigger className="h-9 w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Audit Log */}
        <Card className="paper-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <p className="eyebrow">Audit Log</p>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[28rem] pr-3 epip-scroll">
              <div className="space-y-2">
                {audit.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No audit entries.</p>
                ) : (
                  audit.map((e) => {
                    const Icon = ACTION_ICONS[e.action] || Activity;
                    return (
                      <div key={e.id} className="flex items-start gap-3 rounded-md border border-border p-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[0.6rem]">{e.action}</Badge>
                            <span className="text-[0.65rem] text-muted-foreground">
                              {e.user?.fullName || "system"} · {e.user?.role || ""}
                            </span>
                            <span className="ml-auto text-[0.65rem] text-muted-foreground">
                              {new Date(e.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="mt-1 text-xs">
                            <span className="text-muted-foreground">{e.entityType}</span>{" · "}
                            <code className="font-mono text-[0.65rem]">{e.entityId.slice(0, 12)}</code>
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Service health */}
        <Card className="paper-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <p className="eyebrow">Service Health</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                "IAM Service", "Submission Service", "Workflow & Peer Review",
                "Production & Typesetting", "Indexing & Discovery", "DOI & Metadata",
                "Billing & Subscription", "Notification Service", "Audit & Event Sourcing",
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
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="paper-card">
      <CardContent className="p-4">
        <p className={`font-display text-2xl font-semibold ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function GalleyStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    QUEUED: "border-muted-foreground/30 text-muted-foreground",
    PROCESSING: "border-violet-300 bg-violet-50 text-violet-700",
    COMPLETED: "border-emerald-300 bg-emerald-50 text-emerald-700",
    FAILED: "border-rose-300 bg-rose-50 text-rose-700",
  };
  return (
    <Badge variant="outline" className={`text-[0.6rem] ${styles[status] || ""}`}>
      {status === "PROCESSING" && <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" />}
      {status}
    </Badge>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}
