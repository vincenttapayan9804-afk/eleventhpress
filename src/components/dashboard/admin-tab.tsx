"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";

interface Props {
  audit: any[];
  stats?: { published: number; inReview: number; accepted: number; submitted: number };
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
