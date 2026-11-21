/**
 * About → "Sustainable Development & Global Impact": the home for the UN
 * SDGs and the other global missions and initiatives Eleventh Press supports.
 *
 * Honesty rule for the initiatives list: each one carries the status that is
 * actually true ("Signatory", "Supporter", "Aligned", "Follows",
 * "Integrated"). A formal membership or signatory badge is only added once
 * the publisher has signed (the SDG Publishers Compact: signed, badge
 * supplied by the publisher).
 *
 * The SDG poster includes the SDG logo/colour wheel, so the required
 * attribution line (SDG_ATTRIBUTION) sits directly beneath it.
 */

import { Accessibility, Fingerprint, Globe2, LockOpen, Scale, Share2, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SDG_ATTRIBUTION, SDG_GOALS, SDG_POSTER } from "@/lib/sdg";

type Status = "Signatory" | "Supporter" | "Aligned" | "Follows" | "Integrated";

/** Official SDG Publishers Compact badge (UN / International Publishers Association), shown as supplied. */
const PUBLISHERS_COMPACT_BADGE = "/sdg/sdg-publishers-compact.svg";

const STATUS_STYLE: Record<Status, string> = {
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

/**
 * @param hostedJournal On a whitelabel tenant's About page, the journal's
 *   name: the commitments below belong to the Eleventh Press infrastructure
 *   the journal is published on, and the section says so rather than
 *   implying the journal itself signed them.
 */
export function GlobalImpactSection({ hostedJournal = null }: { hostedJournal?: string | null }) {
  return (
    <section className="mt-12" id="global-impact" data-testid="about-global-impact">
      <h2 className="font-display text-2xl font-semibold">Sustainable Development &amp; Global Impact</h2>
      {hostedJournal && (
        <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-foreground/85" data-testid="global-impact-hosted">
          {hostedJournal} is published on the Eleventh Press International Publishing™ infrastructure, which
          carries the commitments below.
        </p>
      )}
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground text-justify">
        Eleventh Press International Publishing™ is committed to accelerating progress toward the United
        Nations Sustainable Development Goals through barrier-free, peer-reviewed scholarship. This is also
        where we list the wider global missions and initiatives we support and follow.
      </p>

      {/* UN SDGs */}
      <Card className="paper-card mt-5">
        <CardContent className="p-5 sm:p-6">
          <p className="eyebrow">United Nations</p>
          <h3 className="mt-1 font-display text-xl font-semibold">The Sustainable Development Goals</h3>
          {/* Wide screens: the official poster (it carries the SDG logo, hence
              the attribution line). Phones: the poster's text is too small,
              so the 17 official icons are shown as a grid instead. */}
          <figure className="mt-4">
            <img
              src={SDG_POSTER}
              alt="The 17 UN Sustainable Development Goals: 1 No Poverty, 2 Zero Hunger, 3 Good Health and Well-being, 4 Quality Education, 5 Gender Equality, 6 Clean Water and Sanitation, 7 Affordable and Clean Energy, 8 Decent Work and Economic Growth, 9 Industry, Innovation and Infrastructure, 10 Reduced Inequalities, 11 Sustainable Cities and Communities, 12 Responsible Consumption and Production, 13 Climate Action, 14 Life Below Water, 15 Life on Land, 16 Peace, Justice and Strong Institutions, 17 Partnerships for the Goals"
              width={2400}
              height={1697}
              loading="lazy"
              decoding="async"
              className="hidden h-auto w-full rounded-md border border-border bg-white sm:block"
            />
            <ul className="grid grid-cols-3 gap-2 sm:hidden" aria-label="The 17 Sustainable Development Goals">
              {SDG_GOALS.map((g) => (
                <li key={g.number}>
                  <img
                    src={g.icon}
                    alt={`SDG ${g.number}: ${g.title}`}
                    width={480}
                    height={480}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square h-auto w-full"
                  />
                </li>
              ))}
            </ul>
            <figcaption className="mt-3 text-sm font-medium italic text-foreground/85" data-testid="sdg-attribution">
              {SDG_ATTRIBUTION}
            </figcaption>
          </figure>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {SDG_CONTRIBUTIONS.map((c) => (
              <div key={c.title} className="rounded-md border border-border p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-wide text-primary">{c.goals}</p>
                <p className="mt-1 font-display text-sm font-semibold">{c.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>

          <p className="mt-5 text-xs text-muted-foreground">
            Goal icons and poster are the official United Nations assets, used for information. The content of
            this site has not been approved by the United Nations and does not reflect the views of the United
            Nations or its officials or Member States.
          </p>
        </CardContent>
      </Card>

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
              <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${STATUS_STYLE.Signatory}`}>Signatory</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/85 sm:text-justify">
              Eleventh Press International Publishing™ is a signatory of the SDG Publishers Compact, launched by
              the United Nations in collaboration with the International Publishers Association. Signatories
              commit to ten actions that accelerate progress on the Sustainable Development Goals by 2030 —
              among them promoting and publishing SDG-related content, raising awareness of the goals among
              staff, authors and readers, and reporting annually on progress.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Other global missions & initiatives */}
      <h3 className="mt-8 font-display text-xl font-semibold">Global missions &amp; initiatives</h3>
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
        <strong>Signatory</strong>: a formal commitment we have signed. <strong>Supporter</strong>: a public commitment we make. <strong>Aligned</strong>: our policies meet the
        initiative&apos;s principles. <strong>Follows</strong>: we apply its guidance. <strong>Integrated</strong>:
        built into the platform. We show a formal membership or signatory badge only once the organisation
        concerned has confirmed it.
      </p>
    </section>
  );
}
