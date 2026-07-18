"use client";

import { useEffect, useState } from "react";
import { ALL_ROLES as ASSIGNABLE_ROLES } from "@/lib/roles";
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
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";

interface Props {
  audit: any[];
  stats?: { published: number; inReview: number; accepted: number; submitted: number };
}

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  affiliation: string | null;
  country: string | null;
  createdAt: string;
}

function UserManagementCard() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

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
                  <Select
                    value={u.role}
                    onValueChange={(v) => changeRole(u.id, v)}
                    disabled={savingId === u.id}
                  >
                    <SelectTrigger className="h-9 w-44">
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
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
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

export function AdminTab({ audit, stats }: Props) {
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

      <UserManagementCard />

      {/* Audit log */}
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
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

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
