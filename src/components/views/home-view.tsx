"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { ArticleListItem } from "@/lib/types";
import { DISCIPLINES, parseAuthors } from "@/lib/article";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { HeroGlobe, ImpactSphere } from "@/components/three-d/scenes";
import { useReveal } from "@/hooks/use-scroll-reveal";
import {
  Search, ArrowRight, Sparkles, FileText, Quote, TrendingUp, Globe2,
  Atom, Microscope, Cpu, Users, BarChart3, Brain, Leaf, Calculator,
  GraduationCap, Building2, Cog, BookOpen,
} from "lucide-react";

const DISCIPLINE_ICONS: Record<string, any> = {
  Physics: Atom, Biology: Microscope, "Computer Science": Cpu, Sociology: Users,
  Economics: BarChart3, Psychology: Brain, "Environmental Science": Leaf, Mathematics: Calculator,
  Education: GraduationCap, Business: Building2, Technology: Cog, "Language and Literature": BookOpen,
};

const DISCIPLINE_SLUGS: Record<string, string> = {
  Physics: "physics",
  Biology: "biology",
  "Computer Science": "computer-science",
  Sociology: "sociology",
  Economics: "economics",
  Psychology: "psychology",
  "Environmental Science": "environmental-science",
  Mathematics: "mathematics",
  Education: "education",
  Business: "business",
  Technology: "technology",
  "Language and Literature": "language-literature",
};

const DISCIPLINE_COLORS: Record<string, string> = {
  Physics: "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  Biology: "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  "Computer Science": "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  Sociology: "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  Economics: "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  Psychology: "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  "Environmental Science": "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
  Mathematics: "bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)] border-[oklch(0.76_0.11_294/0.3)]",
};

export function HomeView() {
  const { setView, openArticle } = useApp();
  const [featured, setFeatured] = useState<ArticleListItem[]>([]);
  const [stats, setStats] = useState({ articles: 0, citations: 0, downloads: 0, countries: 28 });
  const [searchQ, setSearchQ] = useState("");
  const [loading, setLoading] = useState(true);

  const heroReveal = useReveal();
  const statsReveal = useReveal();
  const disciplinesReveal = useReveal();
  const featuredReveal = useReveal();
  const pipelineReveal = useReveal();

  useEffect(() => {
    apiFetch<{ items: ArticleListItem[]; total: number }>("/api/articles?sort=cited&pageSize=4")
      .then(({ items, total }) => { setFeatured(items); setStats((s) => ({ ...s, articles: total })); })
      .finally(() => setLoading(false));
    apiFetch<{ items: ArticleListItem[] }>("/api/articles?sort=viewed&pageSize=48")
      .then(({ items }) => {
        setStats((s) => ({ ...s, citations: items.reduce((sum, a) => sum + a.citations, 0), downloads: items.reduce((sum, a) => sum + a.downloads, 0) }));
      })
      .catch(() => {});
  }, []);

  function doSearch() { setView("browse"); }

  return (
    <div className="page-enter">
      {/* ════════════════════════════════════════════════════════════════
          HERO — studio-grade 4D image background
          ════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Studio-grade 4D hero image background */}
        <div className="absolute inset-0 -z-10">
          <img
            src="/hero/hero-bg.png"
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: "center right" }}
          />
          {/* Dark vignette on the left for text contrast */}
          <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.14_0.02_285/0.88)] via-[oklch(0.14_0.02_285/0.45)] to-transparent" />
          {/* Bottom fade to pearlescent */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[oklch(0.992_0.004_285)]" />
          {/* Top subtle darkening */}
          <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.14_0.02_285/0.5)] via-transparent to-transparent" />
        </div>

        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-32">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div ref={heroReveal.observe} className={`reveal ${heroReveal.inView ? "in-view" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[oklch(0.86_0.07_292)] drop-shadow-lg">
                Volume 4 · Issue 2 · 2024 · ISSN 2945-1138
              </p>
              <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] text-white drop-shadow-[0_4px_24px_oklch(0.14_0.02_285/0.6)] sm:text-5xl lg:text-6xl">
                Where disciplines<br />
                <span className="bg-gradient-to-r from-[oklch(0.86_0.07_292)] via-[oklch(0.76_0.11_294)] to-[oklch(0.62_0.16_296)] bg-clip-text text-transparent">converge</span>.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-[oklch(0.93_0.01_285)] drop-shadow-[0_2px_8px_oklch(0.14_0.02_285/0.5)]">
                Eleventh Press International Publishing is a peer-reviewed, open-access
                multidisciplinary journal. Rigorous editorial workflow, Crossref DOI registration,
                and OAI-PMH 2.0 indexing — engineered for high-performance scholarly discovery.
              </p>

              {/* Search */}
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
                  <Input
                    placeholder="Search articles, authors, keywords…"
                    className="h-12 border-white/20 bg-white/10 pl-11 font-sans text-white placeholder:text-white/50 backdrop-blur-xl"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  />
                </div>
                <Button size="lg" onClick={doSearch} className="btn-royal-glow h-12 border-white/20 bg-white/15 px-8 text-white backdrop-blur-xl hover:bg-white/25">
                  Search <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>

              <div className="mt-7 flex flex-wrap gap-3 text-sm">
                <Button variant="outline" size="sm" onClick={() => setView("browse")} className="border-white/25 bg-white/10 text-white backdrop-blur-xl hover:bg-white/20 hover:text-white btn-royal-glow">
                  <FileText className="mr-1.5 h-3.5 w-3.5" /> Browse all articles
                </Button>
                <Button variant="outline" size="sm" onClick={() => setView("about")} className="border-white/25 bg-white/10 text-white backdrop-blur-xl hover:bg-white/20 hover:text-white">
                  About the journal
                </Button>
                <Button size="sm" variant="ghost" className="text-[oklch(0.86_0.07_292)] hover:bg-white/10 hover:text-white" onClick={() => useApp.getState().setAuthSheetOpen(true)}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Sign in to submit
                </Button>
              </div>
            </div>

            {/* Right: Glass stat card overlapping the 3D globe */}
            <div className="relative hidden lg:block">
              <div className="glass-royal p-1 rounded-[1.5rem]">
                <div className="glass-strong rounded-[1.35rem] p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="eyebrow">Journal at a glance</p>
                      <p className="mt-1 font-display text-xl text-royal-gradient">Live editorial metrics</p>
                    </div>
                    <div className="h-12 w-12"><ImpactSphere /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-[oklch(0.88_0.015_285/0.4)]">
                    <StatTile label="Published articles" value={stats.articles} icon={FileText} />
                    <StatTile label="Total citations" value={stats.citations} icon={Quote} />
                    <StatTile label="PDF downloads" value={stats.downloads} icon={TrendingUp} />
                    <StatTile label="Indexing sources" value={3} icon={Globe2} />
                  </div>
                  <div className="mt-4 rounded-xl bg-[oklch(0.93_0.04_290/0.5)] px-4 py-3 text-xs text-muted-foreground">
                    Indexed in: <strong className="text-foreground">Google Scholar</strong> · <strong className="text-foreground">Crossref</strong> · <strong className="text-foreground">OAI-PMH 2.0</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          DISCIPLINES — 3D realistic visual backgrounds per discipline
          ════════════════════════════════════════════════════════════════ */}
      <section className="border-y border-[oklch(0.76_0.11_294/0.1)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div ref={disciplinesReveal.observe} className={`reveal stagger ${disciplinesReveal.inView ? "in-view" : ""}`}>
            <div className="mb-10 flex items-end justify-between">
              <div>
                <p className="eyebrow">Scope</p>
                <h2 className="mt-2 font-display text-3xl font-semibold">Twelve disciplines, one platform</h2>
              </div>
              <Button variant="ghost" onClick={() => setView("browse")} className="text-[oklch(0.42_0.18_295)]">
                See all <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {DISCIPLINES.map((d) => {
                const Icon = DISCIPLINE_ICONS[d] ?? FileText;
                return (
                  <button
                    key={d}
                    onClick={() => { window.location.hash = `discipline=${encodeURIComponent(d)}`; setView("browse"); }}
                    className="group relative h-44 overflow-hidden rounded-2xl glass-panel p-0 text-left transition-all duration-500 hover:scale-[1.03] hover:shadow-[0_24px_64px_oklch(0.38_0.18_295/0.18)]"
                    style={{ transitionTimingFunction: "var(--ease-luxury)" }}
                  >
                    {/* Studio-grade 4D image background */}
                    <img
                      src={`/disciplines/${DISCIPLINE_SLUGS[d] || "physics"}.png`}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-60 transition-opacity duration-500 group-hover:opacity-85 group-hover:scale-105"
                      style={{ transitionTimingFunction: "var(--ease-luxury)" }}
                    />
                    {/* Gradient overlay for text contrast */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.992_0.004_285/0.95)] via-[oklch(0.992_0.004_285/0.4)] to-[oklch(0.992_0.004_285/0.15)]" />
                    {/* Content */}
                    <div className="relative z-10 flex h-full flex-col justify-end p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-full border ${DISCIPLINE_COLORS[d]} group-hover:scale-110 transition-transform duration-500`} style={{ transitionTimingFunction: "var(--ease-luxury)" }}>
                          <Icon className="h-4 w-4" />
                        </span>
                      </div>
                      <span className="font-display text-sm font-semibold leading-tight text-foreground">{d}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          FEATURED — glass cards with scroll reveal
          ════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div ref={featuredReveal.observe} className={`reveal ${featuredReveal.inView ? "in-view" : ""}`}>
            <div className="mb-10 flex items-end justify-between">
              <div>
                <p className="eyebrow">Most cited</p>
                <h2 className="mt-2 font-display text-3xl font-semibold">Featured research</h2>
                <p className="mt-1 text-sm text-muted-foreground">Top-cited articles across all disciplines.</p>
              </div>
              <Button variant="outline" onClick={() => setView("browse")} className="glass">
                <FileText className="mr-1.5 h-4 w-4" /> Browse all
              </Button>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-72 shimmer rounded-2xl" />
                ))
              ) : (
                featured.map((a, i) => {
                  const authors = parseAuthors(a.authors);
                  return (
                    <div
                      key={a.id}
                      className="pearl-card cursor-pointer p-7 transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_24px_64px_oklch(0.38_0.18_295/0.12)]"
                      style={{ transitionTimingFunction: "var(--ease-luxury)", animationDelay: `${i * 100}ms` }}
                      onClick={() => openArticle(a.id)}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className={`border ${DISCIPLINE_COLORS[a.discipline]}`}>{a.discipline}</Badge>
                        {a.doi && <span className="font-mono text-[0.65rem] text-muted-foreground">{a.doi}</span>}
                      </div>
                      <h3 className="mt-4 font-display text-xl font-semibold leading-snug">{a.title}</h3>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {authors.slice(0, 3).map((au) => au.name).join(", ")}{authors.length > 3 ? " et al." : ""}
                      </p>
                      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{a.abstract}</p>
                      <div className="mt-5 flex items-center justify-between border-t border-[oklch(0.76_0.11_294/0.1)] pt-4 text-xs text-muted-foreground">
                        <span>Vol. {a.volume}, Iss. {a.issueNumber} ({a.year})</span>
                        <span className="flex items-center gap-3">
                          <span className="flex items-center gap-1"><Quote className="h-3 w-3" /> {a.citations}</span>
                          <span>{a.views} views</span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          PIPELINE — editorial workflow visualized
          ════════════════════════════════════════════════════════════════ */}
      <section className="border-y border-[oklch(0.76_0.11_294/0.1)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div ref={pipelineReveal.observe} className={`reveal ${pipelineReveal.inView ? "in-view" : ""}`}>
            <div className="mb-12 text-center">
              <p className="eyebrow">Editorial pipeline</p>
              <h2 className="mt-2 font-display text-3xl font-semibold">From submission to indexed publication</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
                Every submission passes through an event-driven workflow: identity and access management,
                manuscript anonymisation, peer review, APC invoicing, production, Crossref DOI registration,
                and OAI-PMH feed harvest.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {PIPELINE_STEPS.map((step, i) => (
                <div key={step.title} className="glass-panel p-6 transition-all duration-500 hover:scale-[1.03]" style={{ transitionTimingFunction: "var(--ease-luxury)" }}>
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[oklch(0.93_0.04_290)] text-[oklch(0.42_0.18_295)]">
                      <step.icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                  </div>
                  <p className="mt-4 font-display text-base font-semibold">{step.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          CTA — royal purple band
          ════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[oklch(0.36_0.16_294)] via-[oklch(0.42_0.18_295)] to-[oklch(0.30_0.13_293)] p-12 lg:p-16">
            <div className="absolute inset-0 opacity-20">
              <ImpactSphere />
            </div>
            <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[oklch(0.86_0.07_292)]">Submit your research</p>
                <h2 className="mt-3 font-display text-3xl font-semibold text-white lg:text-4xl">Ready to publish?</h2>
                <p className="mt-4 text-sm leading-relaxed text-[oklch(0.90_0.04_290)]">
                  Authors receive a draft Crossref DOI at submission, double-blind peer review by
                  discipline-matched experts, and global indexing upon publication. Average time from
                  submission to first decision: 38 days.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" variant="secondary" className="btn-royal-glow bg-white text-[oklch(0.42_0.18_295)] hover:bg-[oklch(0.97_0.004_285)]" onClick={() => useApp.getState().setAuthSheetOpen(true)}>
                  Author sign-in
                </Button>
                <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => setView("about")}>
                  Author guidelines
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const PIPELINE_STEPS = [
  { title: "Submit & Anonymise", description: "Author uploads the manuscript to raw-submissions storage. A double-blind copy is generated automatically for reviewers.", icon: FileText },
  { title: "Peer Review", description: "Editor assigns discipline-matched reviewers. Reviewers submit scores, recommendations, and confidential editor comments.", icon: Sparkles },
  { title: "Production", description: "After acceptance and APC payment, the production service renders HTML, PDF, and XML JATS galleys in the journal brand.", icon: TrendingUp },
  { title: "Index & Publish", description: "DOI is activated at Crossref, OAI-PMH 2.0 feed is regenerated, and Google Scholar is pinged via citation meta tags.", icon: Globe2 },
];

function StatTile({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="bg-[oklch(0.99_0.004_285/0.8)] p-5">
      <Icon className="h-5 w-5 text-[oklch(0.42_0.18_295)]" />
      <p className="mt-2 font-display text-2xl font-semibold">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
