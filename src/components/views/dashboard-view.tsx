"use client";

import { LibraryTab } from "@/components/dashboard/library-tab";
import { AuthorAnalyticsTab } from "@/components/dashboard/author-analytics-tab";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { AttentionPanel } from "@/components/dashboard/attention-panel";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { TABS as ALL_TABS } from "@/components/dashboard/dashboard-tabs";
import { ResumeDraftCard } from "@/components/dashboard/resume-draft-card";
import { useEffect, useState, useCallback } from "react";
import { useTenantBranding, isWhitelabel } from "@/lib/tenant-branding-context";
import { useAutoAnimate } from "@formkit/auto-animate/react";
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
  ShieldCheck,
  Share2,
  BookOpen,
  Library as LibraryIcon,
  Award,
  FlaskConical,
  Newspaper,
  Mic,
  FileText,
  Volume2,
  Palette,
  Globe,
  GraduationCap,
  Gavel,
  Coins,
  Landmark,
  LineChart,
  Scale,
  Presentation,
  Users2,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  ProfileTab,
  AuthorSubmitTab,
  AuthorArticlesTab,
  InvoicesTab,
  EditorQueueTab,
  ReviewerQueueTab,
  ReviewerFormTab,
  IndexingTab,
  ReaderTab,
  AdminTab,
  OverviewTab,
  ExpertDashboardTab,
  CounterTab,
  InstitutionsTab,
  ApplicationTab,
  DistributionTab,
  MyBooksTab,
  BookAcquisitionsTab,
  CertificatesTab,
  ResearchLabTab,
  ResearchLabAuditTab,
  MagazinesTab,
  PodcastsTab,
  MediaTab,
  NarrationTab,
  ResearchIntegrityTab,
  BrandingTab,
  TeamTab,
  TenantsTab,
  DepartmentsTab,
  EthicsTab,
  EthicsReviewTab,
  GrantsTab,
  MyGrantsTab,
  RankingsTab,
  ResearchDashboardTab,
  BenchmarkingTab,
  BoardIntelligenceTab,
  ReputationIntelligenceTab,
  ReviewerMarketplaceTab,
  ResearchBoardTab,
  SecondBrainTab,
} from "@/components/dashboard/lazy";
import { useLiveDashboard } from "@/hooks/use-live-dashboard";
import { MfaGate } from "@/components/mfa-gate";

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
  const branding = useTenantBranding();
  const { user, dashboardTab, setView, openDashboard, openAdminPortal, logout, reviewId } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifListRef] = useAutoAnimate();
  const [mobileNotifListRef] = useAutoAnimate();

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    try {
      const d = await apiFetch<DashboardData>("/api/dashboard");
      setData(d);
    } catch (e: any) {
      toast.error("Failed to load dashboard", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      // Come back to the tab that was asked for once signed in.
      const asked = useApp.getState().dashboardTab;
      if (asked !== "overview") useApp.setState({ returnTab: asked });
      // Replace (not push) the dashboard address, so Back doesn't land on
      // it and bounce straight back to sign-in.
      window.history.replaceState(null, "", "/login");
      setView("login");
      return;
    }
    loadDashboard();
  }, [user, setView, loadDashboard]);

  // Live WebSocket updates (must be before any early return)
  const { connected: wsConnected, liveEvents } = useLiveDashboard();

  if (!user) {
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
  // Grouped into 9 sections for the sidebar nav (see docs/dashboard-navigation.md)
  // rather than one flat 33-item list. Grouping is purely presentational —
  // every tab keeps its exact pre-existing `roles` gate, so this changes
  // nothing about who can see what, only how it's organized on screen.
  const TABS = ALL_TABS;

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
    <MfaGate>
    <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Soft ambient glow behind the floating glass dashboard panels */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="ambient-glow-orb absolute -left-24 top-8 h-72 w-72 bg-[oklch(0.76_0.11_294/0.35)]" />
        <div className="ambient-glow-orb absolute -right-24 top-72 h-96 w-96 bg-[oklch(0.62_0.16_296/0.22)]" />
      </div>

      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">
              {isWhitelabel(branding)
                ? `${branding.siteName || branding.tenantName} · ${data.role === "TENANT_ADMIN" ? "Administrator" : data.role.replace(/_/g, " ").toLowerCase()} dashboard`
                : `${data.role.replace(/_/g, " ")} dashboard`}
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

      {/* grid-cols-1 (minmax(0,1fr)) + min-w-0: without them the mobile
          tab strip's full scroll width (~30 tabs) set the grid track's
          minimum, stretching the whole dashboard far past the screen. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          {/* Grouped sidebar on wide screens; a current-section bar with a
              searchable sections sheet on phones (dashboard-nav.tsx). */}
          <DashboardNav tabs={visibleTabs} active={dashboardTab} onOpen={(k) => openDashboard(k as any)} />

          {/* Admin Portal shortcut — a separate, password-gated view (not a
              dashboardTab), so it's kept visually distinct from the tab
              list above rather than mixed into it. SUPER_ADMIN only. */}
          {user.role === "SUPER_ADMIN" && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 flex w-full items-center justify-center gap-2 border-primary/30 text-primary hover:bg-primary/5"
              onClick={openAdminPortal}
            >
              <ShieldCheck className="h-4 w-4" /> Admin Portal
            </Button>
          )}

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
                  <div ref={notifListRef} className="space-y-2">
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
          {dashboardTab === "library" && <LibraryTab />}
          {dashboardTab === "authorAnalytics" && <AuthorAnalyticsTab />}
          {dashboardTab === "overview" && (
            <>
              <ResumeDraftCard />
              <AttentionPanel data={data} />
              <OnboardingChecklist hasSubmissions={(data.submissions ?? []).length > 0} />
              <OverviewTab data={data} />
            </>
          )}
          {dashboardTab === "secondBrain" && <SecondBrainTab />}
          {dashboardTab === "expertDashboard" && <ExpertDashboardTab />}
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
          {dashboardTab === "distribution" && <DistributionTab submissions={data.submissions || []} />}
          {dashboardTab === "myBooks" && <MyBooksTab />}
          {dashboardTab === "bookAcquisitions" && <BookAcquisitionsTab />}
          {dashboardTab === "magazines" && <MagazinesTab />}
          {dashboardTab === "podcasts" && <PodcastsTab />}
          {dashboardTab === "media" && <MediaTab />}
          {dashboardTab === "narration" && <NarrationTab />}
          {dashboardTab === "researchIntegrity" && <ResearchIntegrityTab />}
          {dashboardTab === "branding" && <BrandingTab />}
          {dashboardTab === "tenants" && <TenantsTab />}
          {dashboardTab === "team" && <TeamTab />}
          {dashboardTab === "departments" && <DepartmentsTab />}
          {dashboardTab === "ethics" && <EthicsTab />}
          {dashboardTab === "ethicsReview" && <EthicsReviewTab />}
          {dashboardTab === "myGrants" && <MyGrantsTab />}
          {dashboardTab === "grants" && <GrantsTab />}
          {dashboardTab === "researchDashboard" && <ResearchDashboardTab />}
          {dashboardTab === "rankings" && <RankingsTab />}
          {dashboardTab === "benchmarking" && <BenchmarkingTab role={user.role} />}
          {dashboardTab === "boardIntelligence" && <BoardIntelligenceTab role={user.role} />}
          {dashboardTab === "reputationIntelligence" && <ReputationIntelligenceTab role={user.role} />}
          {dashboardTab === "reviewerMarketplace" && <ReviewerMarketplaceTab role={user.role} />}
          {dashboardTab === "researchBoard" && <ResearchBoardTab role={user.role} />}
          {dashboardTab === "reader" && <ReaderTab subscription={data.subscription} onRefresh={loadDashboard} />}
          {dashboardTab === "certificates" && <CertificatesTab />}
          {dashboardTab === "researchLab" && <ResearchLabTab />}
          {dashboardTab === "researchLabActivity" && <ResearchLabAuditTab />}
          {dashboardTab === "admin" && <AdminTab audit={data.recentAudit || []} stats={data.stats} currentRole={user.role} />}
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
            <div ref={mobileNotifListRef}>
              {data.notifications.slice(0, 6).map((n) => (
                <div key={n.id} className="mb-2 rounded-md border border-border p-2.5 text-xs">
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-muted-foreground">{n.message}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
    </MfaGate>
  );
}

function NotifIcon({ type }: { type: string }) {
  if (type === "SUCCESS") return <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-600" />;
  if (type === "ERROR") return <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-rose-600" />;
  return <Bell className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary" />;
}
