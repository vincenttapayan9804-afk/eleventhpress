"use client";

import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Quote,
  Eye,
  Download,
  ListChecks,
  PenSquare,
  Search,
  Users,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Library,
} from "lucide-react";

interface Props {
  data: any;
}

export function OverviewTab({ data }: Props) {
  const { user, openDashboard, openArticle } = useApp();
  const role = data.role;

  return (
    <div className="space-y-6">
      {/* Welcome card */}
      <Card className="paper-card overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Role · {role.replace(/_/g, " ")}</p>
              <h2 className="mt-1 font-display text-2xl font-semibold">
                {greeting()}, {user?.fullName.split(" ")[0]}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {getRoleTagline(role)}
              </p>
            </div>
            <div className="flex gap-2">
              {canSubmit(role) && (
                <Button onClick={() => openDashboard("submit")}>
                  <Sparkles className="mr-1.5 h-4 w-4" /> New submission
                </Button>
              )}
              {role === "EDITOR" || role === "ASSOCIATE_EDITOR" || role === "SUPER_ADMIN" ? (
                <Button variant="outline" onClick={() => openDashboard("editorQueue")}>
                  Open queue <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : role === "REVIEWER" ? (
                <Button variant="outline" onClick={() => openDashboard("reviewerQueue")}>
                  My reviews <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role-specific stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {getStatCards(data).map((s, i) => (
          <Card key={i} className="paper-card">
            <CardContent className="p-5">
              <s.icon className="h-5 w-5 text-primary" />
              <p className="mt-2 font-display text-2xl font-semibold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions / panels by role */}
      {(role === "AUTHOR" || role === "SUPER_ADMIN") && data.submissions && (
        <Card className="paper-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Recent submissions</p>
              <Button variant="ghost" size="sm" onClick={() => openDashboard("myArticles")}>
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.submissions.slice(0, 4).map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => openArticle(s.id)}
                  className="flex w-full items-center justify-between rounded-md border border-border p-3 text-left hover:border-primary/40 hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-sm font-medium">{s.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s.discipline} · DOI {s.doi || "—"}
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-3 font-mono text-[0.6rem]">
                    {s.status.replace(/_/g, " ")}
                  </Badge>
                </button>
              ))}
              {data.submissions.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No submissions yet — click “New submission” to begin.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(role === "EDITOR" || role === "ASSOCIATE_EDITOR" || role === "SUPER_ADMIN") && data.queue && (
        <Card className="paper-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Active editorial queue</p>
              <Button variant="ghost" size="sm" onClick={() => openDashboard("editorQueue")}>
                Open queue <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.queue.slice(0, 4).map((a: any) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-sm font-medium">{a.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.discipline} · {a.reviews.length} reviewer(s) assigned
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-3 font-mono text-[0.6rem]">
                    {a.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
              {data.queue.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Editorial queue is empty.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(role === "REVIEWER" || role === "SUPER_ADMIN") && data.reviews && (
        <Card className="paper-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Pending reviews</p>
              <Button variant="ghost" size="sm" onClick={() => openDashboard("reviewerQueue")}>
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.reviews.slice(0, 4).map((r: any) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-sm font-medium">{r.article?.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Due {new Date(r.dueDate).toLocaleDateString()} · {r.status}
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-3 font-mono text-[0.6rem]">
                    {r.status}
                  </Badge>
                </div>
              ))}
              {data.reviews.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No review invitations.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Indexing/Discovery quick access for editors */}
      {(role === "EDITOR" || role === "ASSOCIATE_EDITOR" || role === "SUPER_ADMIN") && (
        <Card className="paper-card bg-primary/5">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-base font-semibold">Indexing &amp; discovery engine</p>
                <p className="text-xs text-muted-foreground">
                  View Crossref deposit log, OAI-PMH feed preview, and Google Scholar meta-tag status.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => openDashboard("indexing")}>
              Open <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function canSubmit(role: string): boolean {
  return ["AUTHOR", "SUPER_ADMIN"].includes(role);
}

function getRoleTagline(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Full oversight of the editorial pipeline, billing, indexing, and audit trail.";
    case "EDITOR":
    case "ASSOCIATE_EDITOR":
      return "Assign reviewers, transition articles through the workflow, and publish to the global indexing layer.";
    case "REVIEWER":
      return "Complete your assigned double-blind reviews before the due date.";
    case "AUTHOR":
      return "Submit manuscripts, track their progress, and pay Article Processing Charges.";
    case "READER":
      return "Manage your subscription and access the full PDF galleys of every published article.";
    default:
      return "";
  }
}

function getStatCards(data: any): { icon: any; label: string; value: any }[] {
  const role = data.role;
  if (role === "EDITOR" || role === "ASSOCIATE_EDITOR" || role === "SUPER_ADMIN") {
    return [
      { icon: Clock, label: "Awaiting review", value: data.stats?.submitted ?? 0 },
      { icon: PenSquare, label: "In review", value: data.stats?.inReview ?? 0 },
      { icon: CheckCircle2, label: "Accepted (pending prod)", value: data.stats?.accepted ?? 0 },
      { icon: FileText, label: "Published", value: data.stats?.published ?? 0 },
    ];
  }
  if (role === "REVIEWER") {
    const reviews = data.reviews || [];
    return [
      { icon: PenSquare, label: "Assigned", value: reviews.length },
      { icon: Clock, label: "In progress", value: reviews.filter((r: any) => r.status === "IN_PROGRESS" || r.status === "ACCEPTED" || r.status === "INVITED").length },
      { icon: CheckCircle2, label: "Completed", value: reviews.filter((r: any) => r.status === "COMPLETED").length },
      { icon: ListChecks, label: "Declined", value: reviews.filter((r: any) => r.status === "DECLINED").length },
    ];
  }
  if (role === "AUTHOR") {
    const subs = data.submissions || [];
    return [
      { icon: FileText, label: "Total submissions", value: subs.length },
      { icon: Clock, label: "In review", value: subs.filter((s: any) => s.status === "UNDER_REVIEW" || s.status === "SUBMITTED").length },
      { icon: CheckCircle2, label: "Accepted", value: subs.filter((s: any) => s.status === "ACCEPTED" || s.status === "IN_PRODUCTION").length },
      { icon: Sparkles, label: "Published", value: subs.filter((s: any) => s.status === "PUBLISHED").length },
    ];
  }
  // READER
  return [
    { icon: FileText, label: "Subscription status", value: data.subscription ? "Active" : "—" },
    { icon: Library, label: "Plan", value: data.subscription?.plan?.replace(/_/g, " ") ?? "—" },
    { icon: Clock, label: "Renews", value: data.subscription?.currentPeriodEnd ? new Date(data.subscription.currentPeriodEnd).toLocaleDateString() : "—" },
    { icon: Eye, label: "Articles browsed", value: 0 },
  ];
}
