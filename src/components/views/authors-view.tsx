"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
  Download,
  Quote,
  BadgeCheck,
  Loader2,
  Globe2,
  Link2,
  Linkedin,
  Github,
  Mail,
  Phone,
  ChevronRight,
} from "lucide-react";

interface AuthorArticle {
  id: string;
  title: string;
  discipline: string;
  publishedAt: string | null;
  doi: string | null;
}

interface AuthorCitationMetrics {
  worksCount: number;
  citedByCount: number;
  hIndex: number | null;
  // "openalex" = the author's real, whole-career metrics from a live
  // OpenAlex lookup by ORCID. "platform-only" = no ORCID on file, so this
  // is just an h-index/total computed from what they've published here.
  source: "openalex" | "platform-only";
}

interface AuthorEntry {
  key: string;
  name: string;
  affiliation: string;
  orcid: string | null;
  country: string | null;
  disciplines: string[];
  articleCount: number;
  totalViews: number;
  totalDownloads: number;
  totalCitations: number;
  citationMetrics: AuthorCitationMetrics;
  articles: AuthorArticle[];
  // Merged in from a matching registered account, when one exists —
  // always reflects whatever that author currently has saved in their
  // dashboard Profile tab, refreshed on every load of this directory.
  hasAccount: boolean;
  avatarUrl: string | null;
  profession: string | null;
  bio: string | null;
  website: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

interface AuthorDistribution {
  totalAuthors: number;
  accountsWithCountry: number;
  countries: { country: string; count: number }[];
}

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

export function AuthorsView() {
  const openArticle = useApp((s) => s.openArticle);
  const t = useTranslations("authors");
  const [authors, setAuthors] = useState<AuthorEntry[] | null>(null);
  const [distribution, setDistribution] = useState<AuthorDistribution | null>(null);
  const [q, setQ] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [selected, setSelected] = useState<AuthorEntry | null>(null);
  // Portrait <img>s in the hero/spotlight (unlike the shadcn Avatar used
  // elsewhere, which already falls back to initials via Radix) have no
  // built-in broken-image handling, so a bad/expired avatarUrl would
  // otherwise stretch a blank or corrupt image across the whole tile.
  const [brokenAvatars, setBrokenAvatars] = useState<Set<string>>(new Set());
  const markAvatarBroken = (key: string) =>
    setBrokenAvatars((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));

  useEffect(() => {
    apiFetch<{ authors: AuthorEntry[]; distribution: AuthorDistribution }>("/api/authors")
      .then(({ authors, distribution }) => {
        setAuthors(authors);
        setDistribution(distribution);
      })
      .catch(() => setAuthors([]));
  }, []);

  const disciplines = useMemo(() => {
    const set = new Set<string>();
    (authors || []).forEach((a) => a.disciplines.forEach((d) => set.add(d)));
    return [...set].sort();
  }, [authors]);

  const filtered = useMemo(() => {
    if (!authors) return [];
    const query = q.trim().toLowerCase();
    return authors.filter((a) => {
      if (discipline && !a.disciplines.includes(discipline)) return false;
      if (!query) return true;
      return a.name.toLowerCase().includes(query) || a.affiliation.toLowerCase().includes(query);
    });
  }, [authors, q, discipline]);

  // Ranked by real citation counts (falling back to platform views as a
  // tiebreak) — the same citationMetrics.citedByCount already shown per
  // card, just used to order the hero/spotlight/index instead of a fixed
  // fetch order. Unaffected by the search/discipline filter so the
  // "masthead" always reflects the whole directory.
  const ranked = useMemo(() => {
    return [...(authors || [])].sort((a, b) => {
      if (b.citationMetrics.citedByCount !== a.citationMetrics.citedByCount) {
        return b.citationMetrics.citedByCount - a.citationMetrics.citedByCount;
      }
      return b.totalViews - a.totalViews;
    });
  }, [authors]);

  const featured = ranked[0] ?? null;
  const spotlight = ranked.slice(1, 9);

  const totals = useMemo(() => {
    const list = authors || [];
    return {
      authors: list.length,
      citations: list.reduce((s, a) => s + a.citationMetrics.citedByCount, 0),
      views: list.reduce((s, a) => s + a.totalViews, 0),
      articles: list.reduce((s, a) => s + a.articleCount, 0),
    };
  }, [authors]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {/* MASTHEAD — Editor's Pick hero, full-bleed portrait with a royal-purple
          scrim. Falls back to an initials-on-gradient treatment when the
          author has no avatarUrl, same fallback logic as the Avatar below. */}
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
              {/* Not the shared .eyebrow class here: it sets an unlayered
                  color (globals.css) that beats any Tailwind text-color
                  utility in the cascade regardless of class order, so the
                  purple it hardcodes would win over white on this photo. */}
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-white/85">
                {t("editorsPick")}
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-white sm:text-5xl">
                {featured.name}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-white/75 sm:text-base">
                {featured.profession || featured.affiliation || t("noAffiliation")}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
                <HeroStat icon={Quote} value={featured.citationMetrics.citedByCount} label={t("statCitations")} />
                <HeroStat icon={FileText} value={featured.articleCount} label={t("statArticles")} />
                <HeroStat icon={Eye} value={featured.totalViews} label={t("statViews")} />
                <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-white/70 transition-colors group-hover:text-white">
                  {t("heroCta")} <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
        </button>
      )}

      {/* SPOTLIGHT — horizontally scrollable, portrait-forward carousel of
          the next-ranked authors. Manual scroll (not the auto .animate-marquee
          used below) since these cards are individually clickable. */}
      {spotlight.length > 0 && (
        <div className="mt-12">
          <p className="eyebrow">{t("spotlightEyebrow")}</p>
          <h3 className="mt-1 font-display text-xl font-semibold sm:text-2xl">{t("spotlightTitle")}</h3>
          <div className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {spotlight.map((a) => (
              <button
                key={a.key}
                onClick={() => setSelected(a)}
                className="group relative h-64 w-44 shrink-0 snap-start overflow-hidden rounded-xl border border-[oklch(0.76_0.11_294/0.25)] sm:h-72 sm:w-52"
              >
                {a.avatarUrl && !brokenAvatars.has(a.key) ? (
                  <img
                    src={a.avatarUrl}
                    alt={a.name}
                    onError={() => markAvatarBroken(a.key)}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[oklch(0.93_0.04_290)]">
                    <span className="font-display text-4xl font-semibold text-[oklch(0.42_0.18_295)]">
                      {initialsOf(a.name)}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.16_0.06_295/0.9)] via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-left">
                  <p className="truncate font-display text-sm font-semibold text-white">{a.name}</p>
                  <p className="truncate text-[0.65rem] text-white/70">
                    {a.disciplines[0] || a.profession || a.affiliation}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live-totals ticker — reuses the same duplicated-track
          .animate-marquee pattern as the homepage syndication strip
          (home-view.tsx), aria-hidden on the second copy so it doesn't
          double up for screen readers. */}
      {totals.authors > 0 && (
        <div className="glass-panel relative mt-10 overflow-hidden py-3">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent" />
          <div className="flex w-max animate-marquee">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
                <TickerStat label={t("tickerAuthors")} value={totals.authors} />
                <TickerStat label={t("statArticles")} value={totals.articles} />
                <TickerStat label={t("statCitations")} value={totals.citations} />
                <TickerStat label={t("statViews")} value={totals.views} />
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
        <Select value={discipline || "__all"} onValueChange={(v) => setDiscipline(v === "__all" ? "" : v)}>
          <SelectTrigger className="h-10 w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{t("allDisciplines")}</SelectItem>
            {disciplines.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {distribution && distribution.countries.length > 0 && (
        <Card className="paper-card mt-6">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Author distribution</p>
              <span className="text-[0.65rem] text-muted-foreground">
                {distribution.accountsWithCountry} of {distribution.totalAuthors} authors — registered accounts with a stated country only
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {distribution.countries.map((c) => (
                <Badge key={c.country} variant="outline" className="gap-1 text-[0.65rem]">
                  <Globe2 className="h-3 w-3" /> {c.country} · {c.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {authors === null && (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {authors !== null && filtered.length === 0 && (
        <div className="mt-16 text-center">
          <p className="font-display text-lg font-semibold">{t("noAuthorsFound")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("noAuthorsHint")}</p>
        </div>
      )}

      {/* INDEX — dense, ranked list rows (Forbes-style) rather than a
          uniform card grid; reflects the active search/discipline filter,
          unlike the masthead/spotlight/ticker above. */}
      {filtered.length > 0 && (
        <div className="mt-10">
          <p className="eyebrow">{t("indexEyebrow")}</p>
          <h3 className="mt-1 font-display text-xl font-semibold">{t("indexTitle")}</h3>
          <div className="mt-4 divide-y divide-border">
            {filtered.map((a, i) => (
              <button
                key={a.key}
                onClick={() => setSelected(a)}
                className="group flex w-full items-center gap-4 py-4 text-left transition-colors hover:bg-[oklch(0.97_0.012_290/0.6)]"
              >
                <span className="w-8 shrink-0 text-right font-mono text-sm text-muted-foreground/70 transition-colors group-hover:text-[oklch(0.42_0.18_295)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Avatar className="h-11 w-11 shrink-0 border border-[oklch(0.76_0.11_294/0.3)]">
                  {a.avatarUrl && <AvatarImage src={a.avatarUrl} alt={a.name} className="object-cover" />}
                  <AvatarFallback className="bg-[oklch(0.93_0.04_290)] text-sm font-medium text-[oklch(0.42_0.18_295)]">
                    {initialsOf(a.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-semibold">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.profession || a.affiliation || t("noAffiliation")}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                    {a.disciplines.slice(0, 2).map((d) => (
                      <Badge key={d} variant="outline" className="text-[0.55rem]">
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="hidden shrink-0 flex-wrap gap-1.5 md:flex md:max-w-[13rem]">
                  {a.disciplines.slice(0, 2).map((d) => (
                    <Badge key={d} variant="outline" className="text-[0.6rem]">
                      {d}
                    </Badge>
                  ))}
                </div>
                <div className="hidden shrink-0 items-center gap-4 sm:flex">
                  <Stat icon={FileText} value={a.articleCount} label={t("statArticles")} />
                  <Stat icon={Quote} value={a.citationMetrics.citedByCount} label={t("statCitations")} />
                  <Stat icon={Eye} value={a.totalViews} label={t("statViews")} />
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
                    <DialogTitle className="font-display text-lg">{selected.name}</DialogTitle>
                    <DialogDescription>
                      {selected.profession || selected.affiliation || t("noAffiliation")}
                    </DialogDescription>
                    {selected.profession && selected.affiliation && (
                      <p className="text-xs text-muted-foreground">{selected.affiliation}</p>
                    )}
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
                {selected.website && (
                  <SocialLink href={selected.website} icon={Globe2} label="Website" />
                )}
                {selected.twitterUrl && (
                  <SocialLink href={selected.twitterUrl} icon={Link2} label="X / Twitter" />
                )}
                {selected.linkedinUrl && (
                  <SocialLink href={selected.linkedinUrl} icon={Linkedin} label="LinkedIn" />
                )}
                {selected.githubUrl && (
                  <SocialLink href={selected.githubUrl} icon={Github} label="GitHub" />
                )}
                {selected.contactEmail && (
                  <SocialLink href={`mailto:${selected.contactEmail}`} icon={Mail} label={selected.contactEmail} />
                )}
                {selected.contactPhone && (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {selected.contactPhone}
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 rounded-md border border-border bg-muted/30 p-3 text-center">
                <Stat icon={FileText} value={selected.articleCount} label={t("statArticles")} />
                <Stat icon={Quote} value={selected.citationMetrics.citedByCount} label={t("statCitations")} />
                <Stat icon={Download} value={selected.totalDownloads} label={t("statDownloads")} />
                <Stat icon={BadgeCheck} value={selected.citationMetrics.hIndex ?? 0} label="h-index" />
              </div>
              <p className="mt-1 text-center text-[0.6rem] text-muted-foreground">
                {selected.citationMetrics.source === "openalex"
                  ? "Citation metrics from OpenAlex — this author's full scholarly output, not just what's published here."
                  : "Citation metrics reflect articles published on this platform only — no ORCID on file to look up a full scholarly record."}
              </p>

              <div className="mt-4">
                <p className="eyebrow">{t("publications")}</p>
                <div className="mt-2 space-y-2">
                  {selected.articles.map((art) => (
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
                        {art.discipline}
                        {art.publishedAt ? ` · ${new Date(art.publishedAt).getFullYear()}` : ""}
                        {art.doi ? ` · DOI ${art.doi}` : ""}
                      </p>
                    </button>
                  ))}
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
