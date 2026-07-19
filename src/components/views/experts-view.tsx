"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  FileText,
  Eye,
  Share2,
  Users,
  Crown,
  Sparkles,
  BadgeCheck,
  Loader2,
  Globe2,
  Link2,
  Linkedin,
  Github,
  Mail,
  Phone,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface ExpertInsight {
  id: string;
  title: string;
  insightCategory: string | null;
  publishedAt: string | null;
  doi: string | null;
}

interface ExpertEntry {
  key: string;
  name: string;
  expertTier: string | null;
  avatarUrl: string | null;
  profession: string | null;
  bio: string | null;
  website: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  country: string | null;
  orcid: string | null;
  categories: string[];
  insightCount: number;
  totalViews: number;
  totalDownloads: number;
  totalShares: number;
  followerCount: number;
  insights: ExpertInsight[];
}

interface ExpertTotals {
  experts: number;
  insights: number;
  views: number;
  followers: number;
}

const TIER_LABELS: Record<string, string> = {
  COUNCIL_MEMBER: "Council Member",
  CONTRIBUTOR: "Contributor",
};

function initialsOf(name: string) {
  return name
    .replace(/^Dr\.?\s+|^Prof\.?\s+/, "")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ExpertsView() {
  const openArticle = useApp((s) => s.openArticle);
  const user = useApp((s) => s.user);
  const setView = useApp((s) => s.setView);
  const openDashboard = useApp((s) => s.openDashboard);
  const t = useTranslations("experts");
  const [experts, setExperts] = useState<ExpertEntry[] | null>(null);
  const [totals, setTotals] = useState<ExpertTotals | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<ExpertEntry | null>(null);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [followBusy, setFollowBusy] = useState<string | null>(null);
  const [brokenAvatars, setBrokenAvatars] = useState<Set<string>>(new Set());
  const markAvatarBroken = (key: string) =>
    setBrokenAvatars((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));

  useEffect(() => {
    apiFetch<{ experts: ExpertEntry[]; totals: ExpertTotals }>("/api/experts")
      .then(({ experts, totals }) => {
        setExperts(experts);
        setTotals(totals);
      })
      .catch(() => setExperts([]));
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (experts || []).forEach((e) => e.categories.forEach((c) => set.add(c)));
    return [...set].sort();
  }, [experts]);

  const filtered = useMemo(() => {
    if (!experts) return [];
    const query = q.trim().toLowerCase();
    return experts.filter((e) => {
      if (category && !e.categories.includes(category)) return false;
      if (!query) return true;
      return e.name.toLowerCase().includes(query) || (e.profession || "").toLowerCase().includes(query);
    });
  }, [experts, q, category]);

  // Already server-ranked by insight count → followers → views → shares
  // (see /api/experts) — the whole list doubles as `ranked` here, unlike
  // authors-view.tsx which computes ranking client-side.
  const featured = experts?.[0] ?? null;
  const spotlight = (experts || []).slice(1, 9);

  async function toggleFollow(expert: ExpertEntry) {
    if (!user) {
      toast.error("Sign in to follow experts");
      return;
    }
    setFollowBusy(expert.key);
    const isFollowing = following.has(expert.key);
    try {
      const res = await apiFetch<{ following: boolean; followerCount: number }>(`/api/experts/${expert.key}/follow`, {
        method: isFollowing ? "DELETE" : "POST",
      });
      setFollowing((prev) => {
        const next = new Set(prev);
        if (res.following) next.add(expert.key);
        else next.delete(expert.key);
        return next;
      });
      setExperts((prev) =>
        (prev || []).map((e) => (e.key === expert.key ? { ...e, followerCount: res.followerCount } : e))
      );
    } catch (e: any) {
      toast.error("Could not update follow status", { description: e.message });
    } finally {
      setFollowBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-8">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setView("charter")}>
            <ShieldCheck className="mr-1.5 h-4 w-4" /> {t("charterCta")}
          </Button>
          <Button onClick={() => (user ? openDashboard("application") : setView("login"))}>
            <Crown className="mr-1.5 h-4 w-4" /> {t("applyCta")}
          </Button>
        </div>
      </div>

      {/* MASTHEAD — Editor's Pick hero, forked from authors-view.tsx's
          masthead treatment. */}
      {featured && (
        <button
          onClick={() => setSelected(featured)}
          className="group relative mt-8 block w-full overflow-hidden rounded-2xl text-left shadow-[var(--shadow-glass-lg)]"
        >
          <div className="relative h-[380px] w-full sm:h-[460px]">
            {featured.avatarUrl && !brokenAvatars.has(featured.key) ? (
              <img
                src={featured.avatarUrl}
                alt={featured.name}
                onError={() => markAvatarBroken(featured.key)}
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[oklch(0.5_0.18_296)] to-[oklch(0.28_0.13_293)]">
                <span className="font-display text-8xl font-semibold text-white/90">
                  {initialsOf(featured.name)}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.16_0.07_295/0.92)] via-[oklch(0.2_0.09_295/0.35)] to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
              <div className="flex items-center gap-2">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-white/85">
                  {t("editorsPick")}
                </p>
                {featured.expertTier && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-white/90">
                    {featured.expertTier === "COUNCIL_MEMBER" && <Crown className="h-3 w-3" />}
                    {TIER_LABELS[featured.expertTier]}
                  </span>
                )}
              </div>
              <h2 className="mt-2 font-display text-3xl font-semibold text-white sm:text-5xl">
                {featured.name}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-white/75 sm:text-base">
                {featured.profession || t("noProfession")}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
                <HeroStat icon={FileText} value={featured.insightCount} label={t("statInsights")} />
                <HeroStat icon={Eye} value={featured.totalViews} label={t("statViews")} />
                <HeroStat icon={Users} value={featured.followerCount} label={t("statFollowers")} />
                <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-white/70 transition-colors group-hover:text-white">
                  {t("heroCta")} <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
        </button>
      )}

      {/* SPOTLIGHT */}
      {spotlight.length > 0 && (
        <div className="mt-12">
          <p className="eyebrow">{t("spotlightEyebrow")}</p>
          <h3 className="mt-1 font-display text-xl font-semibold sm:text-2xl">{t("spotlightTitle")}</h3>
          <div className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {spotlight.map((e) => (
              <button
                key={e.key}
                onClick={() => setSelected(e)}
                className="group relative h-64 w-44 shrink-0 snap-start overflow-hidden rounded-xl border border-[oklch(0.76_0.11_294/0.25)] sm:h-72 sm:w-52"
              >
                {e.avatarUrl && !brokenAvatars.has(e.key) ? (
                  <img
                    src={e.avatarUrl}
                    alt={e.name}
                    onError={() => markAvatarBroken(e.key)}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[oklch(0.93_0.04_290)]">
                    <span className="font-display text-4xl font-semibold text-[oklch(0.42_0.18_295)]">
                      {initialsOf(e.name)}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.16_0.06_295/0.9)] via-transparent to-transparent" />
                {e.expertTier === "COUNCIL_MEMBER" && (
                  <div className="absolute right-2 top-2 rounded-full bg-white/15 p-1 backdrop-blur-sm">
                    <Crown className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-3 text-left">
                  <p className="truncate font-display text-sm font-semibold text-white">{e.name}</p>
                  <p className="truncate text-[0.65rem] text-white/70">
                    {e.categories[0] || e.profession || ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live-totals ticker */}
      {totals && totals.experts > 0 && (
        <div className="glass-panel relative mt-10 overflow-hidden py-3">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent" />
          <div className="flex w-max animate-marquee">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
                <TickerStat label={t("tickerExperts")} value={totals.experts} />
                <TickerStat label={t("statInsights")} value={totals.insights} />
                <TickerStat label={t("statViews")} value={totals.views} />
                <TickerStat label={t("statFollowers")} value={totals.followers} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-10 pl-9"
          />
        </div>
        <Select value={category || "__all"} onValueChange={(v) => setCategory(v === "__all" ? "" : v)}>
          <SelectTrigger className="h-10 w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{t("allCategories")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`category.${c}` as any)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {experts === null && (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {experts !== null && experts.length === 0 && (
        <div className="mt-16 text-center">
          <Crown className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 font-display text-lg font-semibold">{t("noExpertsFound")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("noExpertsHint")}</p>
        </div>
      )}

      {experts !== null && experts.length > 0 && filtered.length === 0 && (
        <div className="mt-16 text-center">
          <p className="font-display text-lg font-semibold">{t("noExpertsFound")}</p>
        </div>
      )}

      {/* INDEX */}
      {filtered.length > 0 && (
        <div className="mt-10">
          <p className="eyebrow">{t("indexEyebrow")}</p>
          <h3 className="mt-1 font-display text-xl font-semibold">{t("indexTitle")}</h3>
          <div className="mt-4 divide-y divide-border">
            {filtered.map((e, i) => (
              <button
                key={e.key}
                onClick={() => setSelected(e)}
                className="group flex w-full items-center gap-4 py-4 text-left transition-colors hover:bg-[oklch(0.97_0.012_290/0.6)]"
              >
                <span className="w-8 shrink-0 text-right font-mono text-sm text-muted-foreground/70 transition-colors group-hover:text-[oklch(0.42_0.18_295)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Avatar className="h-11 w-11 shrink-0 border border-[oklch(0.76_0.11_294/0.3)]">
                  {e.avatarUrl && <AvatarImage src={e.avatarUrl} alt={e.name} className="object-cover" />}
                  <AvatarFallback className="bg-[oklch(0.93_0.04_290)] text-sm font-medium text-[oklch(0.42_0.18_295)]">
                    {initialsOf(e.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-display text-base font-semibold">{e.name}</p>
                    {e.expertTier === "COUNCIL_MEMBER" && <Crown className="h-3.5 w-3.5 shrink-0 text-[oklch(0.55_0.16_80)]" />}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{e.profession || t("noProfession")}</p>
                  <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                    {e.categories.slice(0, 2).map((c) => (
                      <Badge key={c} variant="outline" className="text-[0.55rem]">
                        {t(`category.${c}` as any)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="hidden shrink-0 flex-wrap gap-1.5 md:flex md:max-w-[13rem]">
                  {e.categories.slice(0, 2).map((c) => (
                    <Badge key={c} variant="outline" className="text-[0.6rem]">
                      {t(`category.${c}` as any)}
                    </Badge>
                  ))}
                </div>
                <div className="hidden shrink-0 items-center gap-4 sm:flex">
                  <Stat icon={FileText} value={e.insightCount} label={t("statInsights")} />
                  <Stat icon={Eye} value={e.totalViews} label={t("statViews")} />
                  <Stat icon={Users} value={e.followerCount} label={t("statFollowers")} />
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-[oklch(0.42_0.18_295)]" />
              </button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border border-[oklch(0.76_0.11_294/0.3)]">
                    {selected.avatarUrl && <AvatarImage src={selected.avatarUrl} alt={selected.name} className="object-cover" />}
                    <AvatarFallback className="bg-[oklch(0.93_0.04_290)] text-sm font-medium text-[oklch(0.42_0.18_295)]">
                      {initialsOf(selected.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <DialogTitle className="font-display text-lg">{selected.name}</DialogTitle>
                      {selected.expertTier && (
                        <Badge variant="outline" className="gap-1 text-[0.6rem]">
                          {selected.expertTier === "COUNCIL_MEMBER" && <Crown className="h-3 w-3" />}
                          {TIER_LABELS[selected.expertTier]}
                        </Badge>
                      )}
                    </div>
                    <DialogDescription>{selected.profession || t("noProfession")}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {selected.bio && (
                <p className="mt-1 text-sm leading-relaxed text-foreground/85">{selected.bio}</p>
              )}

              <div className="mt-1 flex flex-wrap gap-1.5">
                {selected.orcid && (
                  <a
                    href={`https://orcid.org/${selected.orcid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-1.5 rounded-md border border-[oklch(0.76_0.11_294/0.3)] px-2.5 py-1 text-xs font-medium text-[oklch(0.42_0.18_295)] hover:bg-[oklch(0.93_0.04_290)]"
                  >
                    <BadgeCheck className="h-3.5 w-3.5" /> {selected.orcid}
                  </a>
                )}
                {selected.website && <SocialLink href={selected.website} icon={Globe2} label="Website" />}
                {selected.twitterUrl && <SocialLink href={selected.twitterUrl} icon={Link2} label="X / Twitter" />}
                {selected.linkedinUrl && <SocialLink href={selected.linkedinUrl} icon={Linkedin} label="LinkedIn" />}
                {selected.githubUrl && <SocialLink href={selected.githubUrl} icon={Github} label="GitHub" />}
                {selected.contactEmail && (
                  <SocialLink href={`mailto:${selected.contactEmail}`} icon={Mail} label={selected.contactEmail} />
                )}
                {selected.contactPhone && (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {selected.contactPhone}
                  </span>
                )}
              </div>

              <Button
                variant={following.has(selected.key) ? "outline" : "default"}
                size="sm"
                className="mt-2 w-fit"
                disabled={followBusy === selected.key}
                onClick={() => toggleFollow(selected)}
              >
                {followBusy === selected.key ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Users className="mr-1.5 h-3.5 w-3.5" />
                )}
                {following.has(selected.key) ? t("followingCta") : t("followCta")}
              </Button>

              <div className="mt-3 grid grid-cols-4 gap-2 rounded-md border border-border bg-muted/30 p-3 text-center">
                <Stat icon={FileText} value={selected.insightCount} label={t("statInsights")} />
                <Stat icon={Eye} value={selected.totalViews} label={t("statViews")} />
                <Stat icon={Share2} value={selected.totalShares} label={t("statShares")} />
                <Stat icon={Users} value={selected.followerCount} label={t("statFollowers")} />
              </div>

              <div className="mt-4">
                <p className="eyebrow">{t("publications")}</p>
                <div className="mt-2 space-y-2">
                  {selected.insights.map((art) => (
                    <button
                      key={art.id}
                      onClick={() => {
                        openArticle(art.id);
                        setSelected(null);
                      }}
                      className="block w-full rounded-md border border-border p-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      <p className="font-medium leading-snug">{art.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {art.insightCategory ? t(`category.${art.insightCategory}` as any) : ""}
                        {art.publishedAt ? ` · ${new Date(art.publishedAt).getFullYear()}` : ""}
                        {art.doi ? ` · DOI ${art.doi}` : ""}
                      </p>
                    </button>
                  ))}
                  {selected.insights.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t("noInsightsYet")}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SocialLink({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel="noreferrer"
      className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </a>
  );
}

function Stat({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 text-foreground">
        <Icon className="h-3 w-3 text-primary" />
        <span className="font-mono text-sm font-semibold">{value.toLocaleString()}</span>
      </div>
      <p className="mt-0.5 text-[0.6rem] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function HeroStat({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-white/70" />
      <span className="font-mono text-sm font-semibold text-white">{value.toLocaleString()}</span>
      <span className="text-[0.65rem] uppercase tracking-wide text-white/60">{label}</span>
    </div>
  );
}

function TickerStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="mx-6 flex items-center gap-2 whitespace-nowrap">
      <span className="font-mono text-lg font-semibold text-[oklch(0.42_0.18_295)]">{value.toLocaleString()}</span>
      <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}
