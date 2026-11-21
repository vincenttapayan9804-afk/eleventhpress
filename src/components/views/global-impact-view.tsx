"use client";

/**
 * About → "Sustainable Development & Global Impact" (/sustainable-development):
 * the home for the UN SDGs, Eleventh Press's official goal-by-goal SDG
 * statement, the SDG Publishers Compact, and the other global missions and
 * initiatives Eleventh Press supports. Shown on every journal, including
 * whitelabel tenants (see `hostedJournal`).
 *
 * Each official goal icon is a button: selecting it reveals that goal's
 * official supporting statement in a panel inserted right after the icon's
 * row, so it opens where the reader clicked. #sdg-N links open a goal.
 *
 * Honesty rule for the initiatives list: each one carries the status that is
 * actually true ("Application submitted", "Signatory", "Supporter",
 * "Aligned", "Follows", "Integrated"). Eleventh Press is described as a
 * member or signatory only once the organisation has confirmed it. SDG
 * Publishers Compact: applied (badge supplied by the publisher); switch the
 * card to STATUS_STYLE.Signatory / "Signatory" once membership is confirmed.
 *
 * The SDG poster includes the SDG logo/colour wheel, so the required
 * attribution line (SDG_ATTRIBUTION) sits directly beneath it.
 */

import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Accessibility, ChevronLeft, ChevronRight, Fingerprint, Globe2, LockOpen, Scale, Share2, ShieldCheck, Users, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SDG_ATTRIBUTION, SDG_GOALS, SDG_POSTER, sdgGoal } from "@/lib/sdg";
import { SDG_DECLARATION, SDG_STATEMENT_FACTS, SDG_STATEMENTS, SDG_UN_DISCLAIMER } from "@/lib/sdg-statements";
import { useTenantBranding, isWhitelabel } from "@/lib/tenant-branding-context";

type Status = "Applied" | "Signatory" | "Supporter" | "Aligned" | "Follows" | "Integrated";

/** Official SDG Publishers Compact badge (UN / International Publishers Association), shown as supplied. */
const PUBLISHERS_COMPACT_BADGE = "/sdg/sdg-publishers-compact.svg";

const STATUS_STYLE: Record<Status, string> = {
  Applied: "border-primary/40 bg-primary/10 text-primary",
  Signatory: "border-primary/40 bg-primary/10 text-primary",
  Supporter: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  Aligned: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200",
  Follows: "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200",
  Integrated: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
};

const SDG_CONTRIBUTIONS = [
  {
    goals: "SDG 4 & SDG 10",
    title: "Barrier-free knowledge access",
    desc: "Every article is published under CC BY 4.0 with no login wall or reader fee, so researchers, policymakers and practitioners anywhere can read peer-reviewed findings immediately.",
  },
  {
    goals: "SDG 9 & SDG 17",
    title: "Open-science infrastructure",
    desc: "Permanent Zenodo DOIs, an OAI-PMH 2.0 metadata feed and syndication across scholarly and public platforms connect academic discovery with policy and practice.",
  },
  {
    goals: "SDG 16",
    title: "Ethical, transparent governance",
    desc: "Our editorial pipeline follows COPE and ICMJE guidance, with an append-only audit trail and published corrections and retractions.",
  },
  {
    goals: "All 17 goals",
    title: "Article-level SDG tagging",
    desc: "Being introduced: authors will flag the goals their work supports when they submit, editors will confirm them, and readers and indexing services will be able to find research by goal.",
  },
];

const INITIATIVES: { icon: typeof Globe2; name: string; status: Status; desc: string }[] = [
  {
    icon: Globe2,
    name: "UN Sustainable Development Goals",
    status: "Supporter",
    desc: "We publish and promote multidisciplinary research that advances the 2030 Agenda across all twelve of our disciplines.",
  },
  {
    icon: LockOpen,
    name: "Budapest Open Access Initiative",
    status: "Aligned",
    desc: "Immediate, free online access to every article under CC BY 4.0 — the licence the Initiative recommends.",
  },
  {
    icon: Scale,
    name: "Plan S / cOAlition S principles",
    status: "Aligned",
    desc: "CC BY 4.0 by default, a rights-retention statement at submission, and genuine APC waivers for authors who need them.",
  },
  {
    icon: ShieldCheck,
    name: "COPE & ICMJE",
    status: "Follows",
    desc: "Publication-ethics guidance for authorship, conflicts of interest, misconduct, corrections and retractions.",
  },
  {
    icon: Share2,
    name: "FAIR principles",
    status: "Aligned",
    desc: "Findable, accessible, interoperable, reusable: DOIs, open metadata feeds, FAIR Signposting links and data-availability statements.",
  },
  {
    icon: Accessibility,
    name: "WCAG 2.2",
    status: "Follows",
    desc: "Web accessibility guidelines, so research can be read with screen readers, keyboards and other assistive technology.",
  },
  {
    icon: Fingerprint,
    name: "ORCID",
    status: "Integrated",
    desc: "Persistent researcher identifiers linked to authors, so credit follows the person, not the spelling of their name.",
  },
  {
    icon: Users,
    name: "CRediT contributor roles",
    status: "Integrated",
    desc: "A standard record of who did what on each paper, recognising every contributor.",
  },
];

/** Columns in the goal grid: 3 on phones, 6 from the `sm` breakpoint. */
function useGoalColumns(): number {
  const [cols, setCols] = useState(6);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 640px)");
    const update = () => setCols(mql.matches ? 6 : 3);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return cols;
}

function goalFromHash(hash: string): number | null {
  const m = /^#sdg-(\d{1,2})$/.exec(hash);
  return m && sdgGoal(Number(m[1])) ? Number(m[1]) : null;
}

const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

/** The 17 official goal icons; selecting one reveals its official statement. */
export function SdgGoalExplorer({ initialGoal = null }: { initialGoal?: number | null }) {
  // A #sdg-N link opens that goal until the reader picks another one.
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const [picked, setPicked] = useState<number | null | undefined>(undefined);
  const selected = picked !== undefined ? picked : (goalFromHash(hash) ?? initialGoal);
  // A new #sdg-N link (e.g. followed from elsewhere on the page) wins over an earlier pick.
  useEffect(() => {
    const reset = () => setPicked(undefined);
    window.addEventListener("hashchange", reset);
    return () => window.removeEventListener("hashchange", reset);
  }, []);
  const cols = useGoalColumns();
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  // Keep the revealed statement in view (it can open below the fold on phones).
  useEffect(() => {
    if (selected == null) return;
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight || r.top < 0) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    }
  }, [selected]);

  const choose = (n: number | null) => {
    setPicked(n);
    try {
      window.history.replaceState(window.history.state, "", n ? `#sdg-${n}` : window.location.pathname + window.location.search);
    } catch {
      /* address-bar sync is a convenience only */
    }
  };
  const step = (delta: number) => {
    if (selected == null) return;
    const n = ((selected - 1 + delta + 17) % 17) + 1;
    choose(n);
    buttonRefs.current[n]?.focus({ preventScroll: true });
  };

  const goal = selected != null ? sdgGoal(selected) : undefined;
  const stmt = selected != null ? SDG_STATEMENTS[selected] : undefined;
  // The panel goes right after the last icon in the selected icon's row.
  const rowEnd = selected != null ? Math.min(Math.ceil(selected / cols) * cols, 17) : -1;

  return (
    <div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3" aria-label="The 17 Sustainable Development Goals">
        {SDG_GOALS.map((g) => {
          const active = g.number === selected;
          return (
            <Fragment key={g.number}>
              <li>
                <button
                  ref={(el) => { buttonRefs.current[g.number] = el; }}
                  type="button"
                  onClick={() => choose(active ? null : g.number)}
                  aria-expanded={active}
                  aria-controls="sdg-statement-panel"
                  aria-label={`SDG ${g.number}: ${g.title}. ${active ? "Hide" : "Show"} our supporting statement`}
                  data-testid={`sdg-goal-${g.number}`}
                  className={`group relative block w-full rounded-sm outline-none transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5 ${
                    active ? "ring-2 ring-offset-2 ring-offset-background" : ""
                  }`}
                  style={active ? ({ "--tw-ring-color": g.color } as CSSProperties) : undefined}
                >
                  <img
                    src={g.icon}
                    alt=""
                    width={480}
                    height={480}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square h-auto w-full"
                  />
                </button>
              </li>
              {g.number === rowEnd && goal && stmt && (
                <li className="col-span-full" key={`panel-${goal.number}`}>
                  <div
                    ref={panelRef}
                    id="sdg-statement-panel"
                    role="region"
                    aria-live="polite"
                    aria-label={`SDG ${goal.number}: ${goal.title}`}
                    data-testid="sdg-statement-panel"
                    className="animate-in fade-in-0 slide-in-from-top-2 duration-300 flex overflow-hidden rounded-md border border-border bg-card shadow-sm"
                  >
                    <div className="flex w-14 shrink-0 flex-col items-center justify-start pt-4 text-white sm:w-20" style={{ backgroundColor: goal.color }} aria-hidden>
                      <span className="text-[0.6rem] font-semibold tracking-widest">SDG</span>
                      <span className="font-display text-2xl font-bold leading-none sm:text-3xl">{String(goal.number).padStart(2, "0")}</span>
                    </div>
                    <div className="min-w-0 flex-1 p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display text-base font-semibold sm:text-lg">Goal {goal.number}: {goal.title}</p>
                          <p className="mt-0.5 text-xs font-medium text-primary">Primary tracks: {stmt.tracks}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="-mr-2 -mt-2 h-8 w-8 shrink-0" onClick={() => { const n = goal.number; choose(null); buttonRefs.current[n]?.focus(); }} aria-label="Close statement">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-foreground/85 sm:text-justify">{stmt.statement}</p>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <Button variant="outline" size="sm" onClick={() => step(-1)} aria-label="Previous goal">
                          <ChevronLeft className="mr-1 h-3.5 w-3.5" /> SDG {goal.number === 1 ? 17 : goal.number - 1}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => step(1)} aria-label="Next goal">
                          SDG {goal.number === 17 ? 1 : goal.number + 1} <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              )}
            </Fragment>
          );
        })}
      </ul>
      {selected == null && (
        <p className="mt-3 text-xs text-muted-foreground">Select a goal to read our official supporting statement.</p>
      )}
    </div>
  );
}

/**
 * @param hostedJournal On a whitelabel tenant's site, the journal's name:
 *   the commitments below belong to the Eleventh Press infrastructure the
 *   journal is published on, and the page says so rather than implying the
 *   journal itself signed them.
 */
export function GlobalImpactContent({ hostedJournal = null }: { hostedJournal?: string | null }) {
  return (
    <div data-testid="global-impact">
      {/* Header */}
      <div className="border-b border-border pb-8">
        <p className="eyebrow">About</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Sustainable Development &amp; Global Impact</h1>
        <p className="mt-3 font-display text-lg text-royal-gradient">
          Goal-by-goal alignment across multidisciplinary peer review, open access infrastructure, and global syndication
        </p>
        {hostedJournal && (
          <p className="mt-4 max-w-3xl text-sm font-medium leading-relaxed text-foreground/85" data-testid="global-impact-hosted">
            {hostedJournal} is published on the Eleventh Press International Publishing™ infrastructure, which
            carries the commitments below.
          </p>
        )}
      </div>

      {/* Institutional declaration of support */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Institutional declaration of support</h2>
        <Card className="paper-card mt-4">
          <CardContent className="p-5 sm:p-6">
            <div className="space-y-3 text-sm leading-relaxed text-foreground/85 sm:text-justify">
              <p>
                <strong>{SDG_ATTRIBUTION}</strong> {SDG_DECLARATION[0]}
              </p>
              {SDG_DECLARATION.slice(1).map((p) => <p key={p}>{p}</p>)}
            </div>
            <dl className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border text-sm sm:grid-cols-2 lg:grid-cols-3">
              {SDG_STATEMENT_FACTS.map((f) => (
                <div key={f.label} className="bg-card p-3">
                  <dt className="text-xs text-muted-foreground">{f.label}</dt>
                  <dd className="mt-0.5 font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </section>

      {/* UN SDGs */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">The Sustainable Development Goals</h2>
        <Card className="paper-card mt-4">
          <CardContent className="p-5 sm:p-6">
            {/* The official poster carries the SDG logo, hence the attribution
                line beneath it. Phones skip it: its text is too small there,
                and the goal icons below show the same goals. */}
            <figure className="hidden sm:block">
              <img
                src={SDG_POSTER}
                alt="The 17 UN Sustainable Development Goals: 1 No Poverty, 2 Zero Hunger, 3 Good Health and Well-being, 4 Quality Education, 5 Gender Equality, 6 Clean Water and Sanitation, 7 Affordable and Clean Energy, 8 Decent Work and Economic Growth, 9 Industry, Innovation and Infrastructure, 10 Reduced Inequalities, 11 Sustainable Cities and Communities, 12 Responsible Consumption and Production, 13 Climate Action, 14 Life Below Water, 15 Life on Land, 16 Peace, Justice and Strong Institutions, 17 Partnerships for the Goals"
                width={2400}
                height={1697}
                loading="lazy"
                decoding="async"
                className="h-auto w-full rounded-md border border-border bg-white"
              />
              <figcaption className="mt-3 text-sm font-medium italic text-foreground/85" data-testid="sdg-attribution">
                {SDG_ATTRIBUTION}
              </figcaption>
            </figure>

            <h3 className="font-display text-lg font-semibold sm:mt-8">Goal-by-goal institutional support (SDGs 1–17)</h3>
            <p className="mt-1 text-sm text-muted-foreground">Select any goal to reveal how Eleventh Press supports it.</p>
            <div className="mt-4">
              <SdgGoalExplorer />
            </div>
            <p className="mt-4 text-sm font-medium italic text-foreground/85 sm:hidden">{SDG_ATTRIBUTION}</p>

            <h3 className="mt-8 font-display text-lg font-semibold">How our publishing supports the goals</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {SDG_CONTRIBUTIONS.map((c) => (
                <div key={c.title} className="rounded-md border border-border p-4">
                  <p className="font-mono text-[0.65rem] uppercase tracking-wide text-primary">{c.goals}</p>
                  <p className="mt-1 font-display text-sm font-semibold">{c.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-12">
      {/* SDG Publishers Compact */}
      <Card className="paper-card mt-5" data-testid="sdg-publishers-compact">
        <CardContent className="flex flex-col items-center gap-5 p-5 text-center sm:flex-row sm:items-center sm:p-6 sm:text-left">
          <img
            src={PUBLISHERS_COMPACT_BADGE}
            alt="SDG Publishers Compact"
            width={144}
            height={144}
            loading="lazy"
            decoding="async"
            className="h-32 w-32 shrink-0 sm:h-36 sm:w-36"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h3 className="font-display text-xl font-semibold">SDG Publishers Compact</h3>
              <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${STATUS_STYLE.Applied}`} data-testid="compact-status">Application submitted</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/85 sm:text-justify">
              Eleventh Press International Publishing™ has applied to join the SDG Publishers Compact, launched
              by the United Nations in collaboration with the International Publishers Association. Signatories
              commit to ten actions that accelerate progress on the Sustainable Development Goals by 2030 —
              among them promoting and publishing SDG-related content, raising awareness of the goals among
              staff, authors and readers, and reporting annually on progress.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Other global missions & initiatives */}
      <h2 className="mt-12 font-display text-2xl font-semibold">Global missions &amp; initiatives</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {INITIATIVES.map(({ icon: Icon, name, status, desc }) => (
          <Card key={name} className="paper-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${STATUS_STYLE[status]}`}>{status}</span>
              </div>
              <p className="mt-2 font-display text-sm font-semibold">{name}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        <strong>Application submitted</strong>: we have formally applied to join. <strong>Supporter</strong>: a public commitment we make. <strong>Aligned</strong>: our policies meet the
        initiative&apos;s principles. <strong>Follows</strong>: we apply its guidance. <strong>Integrated</strong>:
        built into the platform. We describe ourselves as a member or signatory only once the
        organisation concerned has confirmed it.
      </p>
      </section>

      {/* UN Brand & Attribution notice */}
      <aside className="mt-10 rounded-md border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground" data-testid="sdg-un-notice">
        <strong className="text-foreground">UN Brand &amp; Attribution Notice:</strong> {SDG_ATTRIBUTION} The goal
        icons, poster and SDG logo are the official United Nations assets, used for information in accordance with
        the United Nations SDG guidelines for non-UN entities. {SDG_UN_DISCLAIMER}
      </aside>
    </div>
  );
}

export function GlobalImpactView() {
  const branding = useTenantBranding();
  const whitelabel = isWhitelabel(branding);
  const hostedJournal = whitelabel ? branding.siteName || branding.tenantName || "This journal" : null;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <GlobalImpactContent hostedJournal={hostedJournal} />
    </div>
  );
}
