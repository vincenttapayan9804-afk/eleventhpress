"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
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
  Crown,
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
  Trophy,
  LineChart,
  Scale,
  Presentation,
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
} from "@/components/dashboard/lazy";
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
  const TABS: { key: string; label: string; icon: any; roles: string[]; group: string }[] = [
    // --- Home ---
    { key: "overview", label: "Overview", icon: LayoutDashboard, roles: ["*"], group: "Home" },
    { key: "profile", label: "Profile", icon: UserCircle, roles: ["*"], group: "Home" },
    { key: "expertDashboard", label: "Professional Dashboard", icon: Crown, roles: ["EXPERT", "SUPER_ADMIN"], group: "Home" },

    // --- Publishing — My Work ---
    { key: "submit", label: "New submission", icon: FilePlus2, roles: ["AUTHOR", "EXPERT", "SUPER_ADMIN"], group: "Publishing — My Work" },
    { key: "myArticles", label: "My articles", icon: FolderOpen, roles: ["AUTHOR", "EXPERT", "SUPER_ADMIN"], group: "Publishing — My Work" },
    { key: "myBooks", label: "My books", icon: BookOpen, roles: ["AUTHOR", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"], group: "Publishing — My Work" },
    { key: "distribution", label: "Article distribution", icon: Share2, roles: ["AUTHOR", "SUPER_ADMIN"], group: "Publishing — My Work" },
    { key: "reviewerQueue", label: "My reviews", icon: PenSquare, roles: ["REVIEWER", "SUPER_ADMIN"], group: "Publishing — My Work" },
    { key: "certificates", label: "Certificates", icon: Award, roles: ["AUTHOR", "REVIEWER", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"], group: "Publishing — My Work" },
    {
      key: "researchLab",
      label: "Eleventh Research Lab",
      icon: FlaskConical,
      roles: ["AUTHOR", "EXPERT", "REVIEWER", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"],
      group: "Publishing — My Work",
    },
    {
      key: "researchLabActivity",
      label: "Research Lab activity",
      icon: FlaskConical,
      roles: ["SUPER_ADMIN", "EDITOR", "ASSOCIATE_EDITOR"],
      group: "Analytics & Reporting",
    },

    // --- Account & Access ---
    { key: "invoices", label: "Billing & invoices", icon: Receipt, roles: ["AUTHOR", "READER", "SUPER_ADMIN"], group: "Account & Access" },
    { key: "reader", label: "Subscription", icon: Library, roles: ["READER", "AUTHOR", "REVIEWER", "SUPER_ADMIN"], group: "Account & Access" },
    { key: "application", label: "Role application", icon: FilePlus2, roles: ["READER", "AUTHOR"], group: "Account & Access" },

    // --- Research Compliance ---
    {
      key: "ethics",
      label: "Ethics & COI",
      icon: ShieldCheck,
      roles: ["AUTHOR", "EXPERT", "REVIEWER", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"],
      group: "Research Compliance",
    },
    {
      key: "myGrants",
      label: "My grants",
      icon: Coins,
      roles: ["AUTHOR", "EXPERT", "REVIEWER", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"],
      group: "Research Compliance",
    },

    // --- Editorial Operations ---
    { key: "editorQueue", label: "Editorial queue", icon: ListChecks, roles: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"], group: "Editorial Operations" },
    { key: "indexing", label: "Indexing & discovery", icon: Search, roles: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"], group: "Editorial Operations" },
    { key: "bookAcquisitions", label: "Book acquisitions", icon: LibraryIcon, roles: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"], group: "Editorial Operations" },
    { key: "researchIntegrity", label: "Research integrity", icon: ShieldCheck, roles: ["SUPER_ADMIN"], group: "Editorial Operations" },

    // --- Content Channels ---
    { key: "magazines", label: "Magazines", icon: Newspaper, roles: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"], group: "Content Channels" },
    { key: "podcasts", label: "Podcasts", icon: Mic, roles: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"], group: "Content Channels" },
    { key: "media", label: "Media (News/Blog)", icon: FileText, roles: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"], group: "Content Channels" },
    { key: "narration", label: "Narration", icon: Volume2, roles: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"], group: "Content Channels" },

    // --- Analytics & Reporting ---
    { key: "counter", label: "COUNTER 5 / SUSHI", icon: BarChart3, roles: ["SUPER_ADMIN", "EDITOR"], group: "Analytics & Reporting" },
    { key: "institutions", label: "Institutions", icon: Building2, roles: ["SUPER_ADMIN", "EDITOR"], group: "Analytics & Reporting" },
    {
      key: "researchDashboard",
      label: "Research dashboard",
      icon: LineChart,
      roles: ["SUPER_ADMIN", "TENANT_ADMIN"],
      group: "Analytics & Reporting",
    },
    { key: "rankings", label: "Institutional rankings", icon: Trophy, roles: ["SUPER_ADMIN"], group: "Analytics & Reporting" },

    // --- Executive Command Intelligence ---
    // A single module with each phase as a sub-section under this one group
    // header, not a separate top-level module per phase. Phases 1-2 today;
    // Phases 3-5 (Reputation, Marketplace, Research Board) join this same
    // group as additional entries as each ships.
    { key: "benchmarking", label: "Research benchmarking", icon: Scale, roles: ["SUPER_ADMIN", "TENANT_ADMIN"], group: "Executive Command Intelligence" },
    {
      key: "boardIntelligence",
      label: "Board-level intelligence",
      icon: Presentation,
      roles: ["SUPER_ADMIN", "TENANT_ADMIN"],
      group: "Executive Command Intelligence",
    },

    // --- Institution Administration ---
    { key: "departments", label: "Departments", icon: GraduationCap, roles: ["SUPER_ADMIN", "TENANT_ADMIN"], group: "Institution Administration" },
    { key: "ethicsReview", label: "Ethics review", icon: Gavel, roles: ["SUPER_ADMIN", "TENANT_ADMIN"], group: "Institution Administration" },
    { key: "grants", label: "Grants", icon: Landmark, roles: ["SUPER_ADMIN", "TENANT_ADMIN"], group: "Institution Administration" },

    // --- Platform Administration ---
    { key: "branding", label: "Branding", icon: Palette, roles: ["SUPER_ADMIN"], group: "Platform Administration" },
    { key: "tenants", label: "Tenants", icon: Globe, roles: ["SUPER_ADMIN"], group: "Platform Administration" },
    { key: "admin", label: "Admin & audit", icon: Users, roles: ["SUPER_ADMIN"], group: "Platform Administration" },
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
          {/* Edge fade hints that more tabs exist off-screen when this
              scrolls horizontally on mobile/tablet (below lg it's not a
              vertical list yet); no-op on lg+ where it's a static column. */}
          <nav className="flex flex-row gap-1 overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] lg:flex-col lg:[mask-image:none]">
            {visibleTabs.map((t, i) => {
              const Icon = t.icon;
              const active = dashboardTab === t.key;
              // Section headers are lg-only: below lg the sidebar is a
              // horizontally-scrolling flat row (unchanged from before this
              // grouping was added), where an inline label would break the
              // scroll rhythm rather than help it.
              const isNewGroup = i === 0 || visibleTabs[i - 1].group !== t.group;
              return (
                <Fragment key={t.key}>
                  {isNewGroup && (
                    <p className={`hidden px-3 pb-1 font-sans text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground lg:block ${i === 0 ? "pt-1" : "pt-4"}`}>
                      {t.group}
                    </p>
                  )}
                  <button
                    onClick={() => openDashboard(t.key as any)}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left font-sans text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/80 hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {t.label}
                  </button>
                </Fragment>
              );
            })}
          </nav>

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
          {dashboardTab === "overview" && <OverviewTab data={data} />}
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
          {dashboardTab === "departments" && <DepartmentsTab />}
          {dashboardTab === "ethics" && <EthicsTab />}
          {dashboardTab === "ethicsReview" && <EthicsReviewTab />}
          {dashboardTab === "myGrants" && <MyGrantsTab />}
          {dashboardTab === "grants" && <GrantsTab />}
          {dashboardTab === "researchDashboard" && <ResearchDashboardTab />}
          {dashboardTab === "rankings" && <RankingsTab />}
          {dashboardTab === "benchmarking" && <BenchmarkingTab role={user.role} />}
          {dashboardTab === "boardIntelligence" && <BoardIntelligenceTab role={user.role} />}
          {dashboardTab === "reader" && <ReaderTab subscription={data.subscription} onRefresh={loadDashboard} />}
          {dashboardTab === "certificates" && <CertificatesTab />}
          {dashboardTab === "researchLab" && <ResearchLabTab />}
          {dashboardTab === "researchLabActivity" && <ResearchLabAuditTab />}
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
  );
}

function NotifIcon({ type }: { type: string }) {
  if (type === "SUCCESS") return <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-600" />;
  if (type === "ERROR") return <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-rose-600" />;
  return <Bell className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary" />;
}
