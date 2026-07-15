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

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a) => (
          <Card
            key={a.key}
            className="paper-card cursor-pointer transition-transform hover:-translate-y-0.5"
            onClick={() => setSelected(a)}
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11 border border-[oklch(0.76_0.11_294/0.3)]">
                  {a.avatarUrl && <AvatarImage src={a.avatarUrl} alt={a.name} className="object-cover" />}
                  <AvatarFallback className="bg-[oklch(0.93_0.04_290)] text-sm font-medium text-[oklch(0.42_0.18_295)]">
                    {initialsOf(a.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-semibold">{a.name}</p>
                  {a.profession ? (
                    <p className="truncate text-xs text-muted-foreground">{a.profession}</p>
                  ) : a.affiliation ? (
                    <p className="truncate text-xs text-muted-foreground">{a.affiliation}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.disciplines.slice(0, 3).map((d) => (
                  <Badge key={d} variant="outline" className="text-[0.6rem]">
                    {d}
                  </Badge>
                ))}
                {a.disciplines.length > 3 && (
                  <Badge variant="outline" className="text-[0.6rem]">
                    +{a.disciplines.length - 3}
                  </Badge>
                )}
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat icon={FileText} value={a.articleCount} label={t("statArticles")} />
                <Stat icon={Quote} value={a.citationMetrics.citedByCount} label={t("statCitations")} />
                <Stat icon={Eye} value={a.totalViews} label={t("statViews")} />
              </div>
              {a.citationMetrics.hIndex != null && (
                <p className="mt-2 text-center text-[0.6rem] text-muted-foreground">
                  h-index {a.citationMetrics.hIndex}
                  {a.citationMetrics.source === "openalex" ? " (OpenAlex)" : " (this platform only)"}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

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
