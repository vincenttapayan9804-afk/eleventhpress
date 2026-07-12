"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  FilePlus2,
  FolderOpen,
  Receipt,
  ListChecks,
  PenSquare,
  Search,
  Library,
  Building2,
  Users,
  Bell,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertCircle,
  BarChart3,
  UserCircle,
} from "lucide-react";
import { toast } from "sonner";

import { ProfileTab } from "@/components/dashboard/profile-tab";
import { AuthorSubmitTab } from "@/components/dashboard/author-submit-tab";
import { AuthorArticlesTab } from "@/components/dashboard/author-articles-tab";
import { InvoicesTab } from "@/components/dashboard/invoices-tab";
import { EditorQueueTab } from "@/components/dashboard/editor-queue-tab";
import { ReviewerQueueTab } from "@/components/dashboard/reviewer-queue-tab";
import { ReviewerFormTab } from "@/components/dashboard/reviewer-form-tab";
import { IndexingTab } from "@/components/dashboard/indexing-tab";
import { ReaderTab } from "@/components/dashboard/reader-tab";
import { AdminTab } from "@/components/dashboard/admin-tab";
import { OverviewTab } from "@/components/dashboard/overview-tab";
import { CounterTab } from "@/components/dashboard/counter-tab";
import { InstitutionsTab } from "@/components/dashboard/institutions-tab";
import { ApplicationTab } from "@/components/dashboard/application-tab";
import { useLiveDashboard } from "@/hooks/use-live-dashboard";

interface DashboardData {
  role: string;
  notifications: any[];
  unreadCount: number;
  submissions?: any[];
  invoices?: any[];
  queue?: any[];
  stats?: { published: number; inReview: number; accepted: number; submitted: number };
  recentAudit?: any[];
  reviews?: any[];
  subscription?: any | null;
}

export function DashboardView() {
  const { user, token, dashboardTab, setView, openDashboard, logout, reviewId } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiFetch<DashboardData>("/api/dashboard");
      setData(d);
    } catch (e: any) {
      toast.error("Failed to load dashboard", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setView("login");
      return;
    }
    loadDashboard();
  }, [token, setView, loadDashboard]);

  // Live WebSocket updates (must be before any early return)
  const { connected: wsConnected, liveEvents } = useLiveDashboard();

  if (!token || !user) {
    return null;
  }

  if (loading || !data) {
    return (
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Role-based tab list
  const TABS: { key: string; label: string; icon: any; roles: string[] }[] = [
    { key: "overview", label: "Overview", icon: LayoutDashboard, roles: ["*"] },
    { key: "profile", label: "Profile", icon: UserCircle, roles: ["*"] },
    { key: "submit", label: "New submission", icon: FilePlus2, roles: ["AUTHOR", "SUPER_ADMIN"] },
    { key: "myArticles", label: "My articles", icon: FolderOpen, roles: ["AUTHOR", "SUPER_ADMIN"] },
    { key: "invoices", label: "Billing & invoices", icon: Receipt, roles: ["AUTHOR", "READER", "SUPER_ADMIN"] },
    { key: "editorQueue", label: "Editorial queue", icon: ListChecks, roles: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"] },
    { key: "reviewerQueue", label: "My reviews", icon: PenSquare, roles: ["REVIEWER", "SUPER_ADMIN"] },
    { key: "indexing", label: "Indexing & discovery", icon: Search, roles: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"] },
    { key: "counter", label: "COUNTER 5 / SUSHI", icon: BarChart3, roles: ["SUPER_ADMIN", "EDITOR"] },
    { key: "institutions", label: "Institutions", icon: Building2, roles: ["SUPER_ADMIN", "EDITOR", "READER"] },
    { key: "application", label: "Role application", icon: FilePlus2, roles: ["READER", "AUTHOR"] },
    { key: "reader", label: "Subscription", icon: Library, roles: ["READER", "AUTHOR", "REVIEWER", "SUPER_ADMIN"] },
    { key: "admin", label: "Admin & audit", icon: Users, roles: ["SUPER_ADMIN"] },
  ];

  const visibleTabs = TABS.filter((t) => t.roles.includes("*") || t.roles.includes(user.role));

  async function markAllRead() {
    try {
      await apiFetch("/api/notifications", { method: "POST", body: JSON.stringify({}) });
      toast.success("All notifications marked as read");
      loadDashboard();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  // Live WebSocket updates (already called above before early returns)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">
              {data.role.replace(/_/g, " ")} dashboard
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold">
              Welcome, {user.fullName.split(" ").slice(-1)[0]}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.affiliation} · {user.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {wsConnected && (
              <Badge variant="outline" className="hidden items-center gap-1.5 border-emerald-300 bg-emerald-50 text-emerald-700 text-[0.6rem] sm:flex">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => { logout(); }}>
              Sign out
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
            {visibleTabs.map((t) => {
              const Icon = t.icon;
              const active = dashboardTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => openDashboard(t.key as any)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left font-sans text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/80 hover:bg-accent"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {t.label}
                </button>
              );
            })}
          </nav>

          {/* Notifications */}
          <Card className="paper-card mt-6 hidden lg:block">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Notifications</p>
                {data.unreadCount > 0 && (
                  <Badge variant="default" className="font-mono text-[0.6rem]">
                    {data.unreadCount}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-72 pr-3 epip-scroll">
                {data.notifications.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No notifications
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`rounded-md border p-2.5 text-xs ${
                          n.read ? "border-border bg-card" : "border-primary/30 bg-primary/5"
                        }`}
                      >
                        <div className="flex items-start gap-1.5">
                          <NotifIcon type={n.type} />
                          <div className="flex-1">
                            <p className="font-medium leading-tight">{n.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-muted-foreground">{n.message}</p>
                            <p className="mt-1 font-mono text-[0.6rem] text-muted-foreground">
                              {new Date(n.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {data.unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={markAllRead}>
                  Mark all as read
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* Main panel */}
        <div className="min-w-0">
          {dashboardTab === "overview" && <OverviewTab data={data} />}
          {dashboardTab === "profile" && <ProfileTab />}
          {dashboardTab === "submit" && <AuthorSubmitTab onSubmitted={loadDashboard} />}
          {dashboardTab === "myArticles" && <AuthorArticlesTab submissions={data.submissions || []} onRefresh={loadDashboard} />}
          {dashboardTab === "invoices" && <InvoicesTab invoices={data.invoices || []} subscription={data.subscription} onRefresh={loadDashboard} />}
          {dashboardTab === "editorQueue" && <EditorQueueTab queue={data.queue || []} stats={data.stats} onRefresh={loadDashboard} />}
          {dashboardTab === "reviewerQueue" && <ReviewerQueueTab reviews={data.reviews || []} onRefresh={loadDashboard} />}
          {dashboardTab === "reviewerForm" && reviewId && <ReviewerFormTab reviewId={reviewId} onRefresh={loadDashboard} />}
          {dashboardTab === "indexing" && <IndexingTab />}
          {dashboardTab === "counter" && <CounterTab />}
          {dashboardTab === "institutions" && <InstitutionsTab />}
          {dashboardTab === "application" && <ApplicationTab onRefresh={loadDashboard} />}
          {dashboardTab === "reader" && <ReaderTab subscription={data.subscription} onRefresh={loadDashboard} />}
          {dashboardTab === "admin" && <AdminTab audit={data.recentAudit || []} stats={data.stats} />}
        </div>
      </div>

      {/* Mobile notifications */}
      <Card className="paper-card mt-6 lg:hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1.5"><Bell className="h-3 w-3" /> Notifications</p>
            {data.unreadCount > 0 && (
              <Badge variant="default" className="font-mono text-[0.6rem]">
                {data.unreadCount}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-48 pr-3 epip-scroll">
            {data.notifications.slice(0, 6).map((n) => (
              <div key={n.id} className="mb-2 rounded-md border border-border p-2.5 text-xs">
                <p className="font-medium">{n.title}</p>
                <p className="mt-0.5 line-clamp-2 text-muted-foreground">{n.message}</p>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function NotifIcon({ type }: { type: string }) {
  if (type === "SUCCESS") return <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-600" />;
  if (type === "ERROR") return <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-rose-600" />;
  return <Bell className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary" />;
}
