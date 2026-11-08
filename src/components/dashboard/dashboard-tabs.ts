import type { LucideIcon } from "lucide-react";
import {
  Award,
  BarChart3,
  BookOpen,
  Brain,
  Building2,
  ClipboardCheck,
  Coins,
  Crown,
  FilePlus2,
  FileText,
  FlaskConical,
  FolderOpen,
  Gavel,
  Globe,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Library,
  LibraryIcon,
  LineChart,
  ListChecks,
  Mic,
  Newspaper,
  Palette,
  PenSquare,
  Presentation,
  Receipt,
  Scale,
  Search,
  Share2,
  ShieldCheck,
  Trophy,
  UserCircle,
  Users,
  Users2,
  Volume2,
} from "lucide-react";

/**
 * Every dashboard tab, its sidebar group and the roles that can open it.
 * Shared by the dashboard (sidebar and mobile navigation) and the ⌘K
 * command palette, so both always offer exactly the same tabs.
 * Grouped into sections for the sidebar nav (see docs/dashboard-navigation.md);
 * grouping is purely presentational — every tab keeps its own `roles` gate.
 */
export interface DashboardTabDef {
  key: string;
  label: string;
  icon: LucideIcon | any;
  roles: string[];
  group: string;
}

export const TABS: DashboardTabDef[] = [
  // --- Home ---
  { key: "overview", label: "Overview", icon: LayoutDashboard, roles: ["*"], group: "Home" },
  { key: "secondBrain", label: "Second Brain", icon: Brain, roles: ["*"], group: "Home" },
  { key: "profile", label: "Profile", icon: UserCircle, roles: ["*"], group: "Home" },
  { key: "expertDashboard", label: "Professional Dashboard", icon: Crown, roles: ["EXPERT", "SUPER_ADMIN"], group: "Home" },

  // --- Publishing — My Work ---
  { key: "submit", label: "New submission", icon: FilePlus2, roles: ["AUTHOR", "EXPERT", "SUPER_ADMIN", "TENANT_ADMIN"], group: "Publishing — My Work" },
  { key: "myArticles", label: "My articles", icon: FolderOpen, roles: ["AUTHOR", "EXPERT", "SUPER_ADMIN", "TENANT_ADMIN"], group: "Publishing — My Work" },
  { key: "myBooks", label: "My books", icon: BookOpen, roles: ["AUTHOR", "EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"], group: "Publishing — My Work" },
  { key: "distribution", label: "Article distribution", icon: Share2, roles: ["AUTHOR", "SUPER_ADMIN"], group: "Publishing — My Work" },
  { key: "reviewerQueue", label: "My reviews", icon: PenSquare, roles: ["REVIEWER", "SUPER_ADMIN"], group: "Publishing — My Work" },
  // EXPERT was missing here despite computeEligibility (src/lib/
  // certificates-server.ts) and the Prestige Application approval flow
  // (src/app/api/applications/[id]/review/route.ts) both already
  // assuming a Council of Experts member can reach this tab — the only
  // path they had was a narrower widget buried in Professional Dashboard.
  { key: "certificates", label: "Certificates", icon: Award, roles: ["AUTHOR", "REVIEWER", "EDITOR", "ASSOCIATE_EDITOR", "EXPERT", "SUPER_ADMIN"], group: "Publishing — My Work" },
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
  { key: "editorQueue", label: "Editorial queue", icon: ListChecks, roles: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"], group: "Editorial Operations" },
  { key: "indexing", label: "Indexing & discovery", icon: Search, roles: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"], group: "Editorial Operations" },
  { key: "bookAcquisitions", label: "Book acquisitions", icon: LibraryIcon, roles: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"], group: "Editorial Operations" },
  { key: "researchIntegrity", label: "Research integrity", icon: ShieldCheck, roles: ["SUPER_ADMIN"], group: "Editorial Operations" },

  // --- Content Channels ---
  { key: "magazines", label: "Magazines", icon: Newspaper, roles: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"], group: "Content Channels" },
  { key: "podcasts", label: "Podcasts", icon: Mic, roles: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"], group: "Content Channels" },
  { key: "media", label: "Media (News/Blog)", icon: FileText, roles: ["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN", "TENANT_ADMIN"], group: "Content Channels" },
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
  // header, not a separate top-level module per phase. Phases 1-5, the
  // full set, all live here now.
  { key: "benchmarking", label: "Research benchmarking", icon: Scale, roles: ["SUPER_ADMIN", "TENANT_ADMIN"], group: "Executive Command Intelligence" },
  {
    key: "boardIntelligence",
    label: "Board-level intelligence",
    icon: Presentation,
    roles: ["SUPER_ADMIN", "TENANT_ADMIN"],
    group: "Executive Command Intelligence",
  },
  {
    key: "reputationIntelligence",
    label: "Reputation intelligence",
    icon: Award,
    roles: ["SUPER_ADMIN", "TENANT_ADMIN"],
    group: "Executive Command Intelligence",
  },
  {
    key: "reviewerMarketplace",
    label: "Reviewer marketplace",
    icon: Users2,
    roles: ["SUPER_ADMIN", "TENANT_ADMIN"],
    group: "Executive Command Intelligence",
  },
  {
    key: "researchBoard",
    label: "Research board",
    icon: ClipboardCheck,
    roles: ["SUPER_ADMIN", "TENANT_ADMIN"],
    group: "Executive Command Intelligence",
  },

  // --- Institution Administration ---
  { key: "departments", label: "Departments", icon: GraduationCap, roles: ["SUPER_ADMIN", "TENANT_ADMIN"], group: "Institution Administration" },
  { key: "ethicsReview", label: "Ethics review", icon: Gavel, roles: ["SUPER_ADMIN", "TENANT_ADMIN"], group: "Institution Administration" },
  { key: "grants", label: "Grants", icon: Landmark, roles: ["SUPER_ADMIN", "TENANT_ADMIN"], group: "Institution Administration" },

  // --- Platform Administration ---
  // A tenant admin's branding + team live under their institution's own
  // group; the SUPER_ADMIN sees the same tabs under Platform Administration.
  { key: "branding", label: "Branding & profile", icon: Palette, roles: ["TENANT_ADMIN"], group: "Institution Administration" },
  { key: "team", label: "Team & access", icon: Users2, roles: ["TENANT_ADMIN"], group: "Institution Administration" },
  { key: "branding", label: "Branding", icon: Palette, roles: ["SUPER_ADMIN"], group: "Platform Administration" },
  { key: "tenants", label: "Tenants", icon: Globe, roles: ["SUPER_ADMIN"], group: "Platform Administration" },
  { key: "admin", label: "Admin & audit", icon: Users, roles: ["SUPER_ADMIN"], group: "Platform Administration" },
];

/** Tabs a role can see, in sidebar order. */
export function tabsForRole(role: string | undefined | null): DashboardTabDef[] {
  if (!role) return [];
  return TABS.filter((t) => t.roles.includes("*") || t.roles.includes(role));
}
