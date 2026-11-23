/**
 * Open Edition — Eleventh Press's curated open-access magazine.
 *
 * Each issue mixes original features by the Eleventh Press Editorial Team
 * (every claim sourced and logged in `verification`) with openly licensed
 * reprints reproduced unchanged under their original Creative Commons
 * licences (`reprint`). Issues are static, versioned content rather than
 * rows in the Magazine tables: they are free to read for everyone, never
 * paywall-metered, and reviewable in a pull request like any other copy.
 *
 * bodyHtml is trusted, editor-authored markup (originals) or text copied
 * verbatim from the licensed source (reprints), sanitised to a small tag
 * allow-list when it was imported.
 *
 * Rendered by src/components/views/open-edition-issue-view.tsx and listed
 * on /magazines by src/components/views/magazines-view.tsx.
 */

export type VerificationStatus = "source" | "document" | "reported";

export interface VerificationEntry {
  claim: string;
  /** Which numbered source(s) support the claim, e.g. "[1] UN News". */
  source: string;
  status: VerificationStatus;
  note: string;
}

export interface ReprintCredit {
  publication: string;
  publisher: string;
  authors: string | null;
  sourceUrl: string;
  licence: { label: string; url: string };
  notes: string;
}

export interface OpenEditionPiece {
  slug: string;
  kind: "original" | "reprint";
  /** Short section label shown above the headline. */
  section: string;
  category: string;
  title: string;
  dek: string;
  image: string;
  imageAlt: string;
  imageCredit: string;
  /** Originals: the date context of the data ("Data as published June 2025"). */
  dataNote?: string | null;
  bodyHtml: string;
  /** Originals: numbered source list (HTML), cited in the body as #<refPrefix>-s<n>. */
  sources?: string[];
  refPrefix?: string;
  verification?: VerificationEntry[];
  reprint?: ReprintCredit | null;
}

export interface OpenEditionIssue {
  /** URL id: /magazines/<id>. */
  id: string;
  series: string;
  volume: number;
  issueNumber: number;
  year: number;
  /** ISO date the issue went live. */
  publishedAt: string;
  title: string;
  /** Second half of the cover title, set in italic. */
  titleItalic: string;
  coverLine: string;
  description: string;
  cover: string;
  coverAlt: string;
  /** Downloadable print edition, built by scripts/build-open-edition-pdf.tsx. */
  pdf: string;
  editorsNote: string[];
  pieces: OpenEditionPiece[];
}

export const OPEN_EDITION_BYLINE = "Eleventh Press Editorial Team";

export const OPEN_EDITION_PUBLISHER = "Eleventh Press International Publishing";

/**
 * Rights in Open Edition's own work. Originals (text, charts and
 * illustrations) are NOT released under Creative Commons, unlike the
 * platform's journal articles; reprints keep their own licences.
 */
export function openEditionCopyright(year: number): string {
  return `© ${year} ${OPEN_EDITION_PUBLISHER}™. All rights reserved.`;
}

export const OPEN_EDITION_RIGHTS_DETAIL =
  "Original articles, charts and illustrations in Open Edition are the copyright of Eleventh Press International Publishing and are not published under a Creative Commons licence. You may link to them and quote brief extracts with credit; any other reproduction needs our written permission. Reprints keep the open licence shown on each one.";

export const OPEN_EDITION_GUIDANCE = [
  { label: "COPE (2023). Authorship and AI tools: COPE position statement", url: "https://publicationethics.org/node/56046" },
  { label: "WAME (revised 31 May 2023). Chatbots, Generative AI, and Scholarly Manuscripts", url: "https://wame.org/page3.php?id=106" },
  { label: "STM (December 2023). Generative AI in Scholarly Communications: Ethical and Practical Guidelines for the Use of Generative AI in the Publication Process", url: "https://stm-assoc.org/document/stm-generative-ai-paper-2023/" },
];

export const OPEN_EDITION_PRINCIPLES = [
  { title: "People are accountable", body: "A named editorial team is responsible for every article. AI tools cannot take responsibility for published work, so they are never listed as authors.", basis: "COPE; WAME Recommendation 1" },
  { title: "We say how AI was used", body: "Each article states where AI tools supported the work, from literature mapping and source retrieval to first drafts, and what the editors did to check it.", basis: "WAME Recommendation 2; STM 2023" },
  { title: "Sources come first", body: "We rely on official statistics, intergovernmental agencies and peer-reviewed research, cited with links and the year of the data. Every claim is checked against its source before publication.", basis: "COPE core practices" },
  { title: "Charts tell the truth", body: "Charts are drawn to scale from the cited data, with the source printed underneath. We do not use AI to generate or alter images or data.", basis: "Eleventh Press policy, in line with publisher image-integrity practice" },
  { title: "Only public sources go in", body: "AI tools are given only published, public material. No personal, confidential or unpublished information is entered into them.", basis: "Eleventh Press policy, in line with confidentiality principles" },
  { title: "Credit and corrections", body: "Reprints are reproduced unchanged under their licences, with full credit and no implied endorsement. Errors are corrected openly, and each correction is dated on the article.", basis: "Creative Commons licence terms; COPE" },
];

const LEARNING_EVERYWHERE_PIECES: OpenEditionPiece[] = [
  {
    "slug": "out-of-school",
    "kind": "original",
    "section": "Access",
    "category": "Feature",
    "title": "272 million and counting: the children still out of school",
    "dek": "The world's out-of-school population is bigger than we thought, and it is growing. Here is who is missing out, and why the number went up.",
    "image": "/magazines/open-edition/01/out-of-school.webp",
    "imageAlt": "Rows of empty desks in a classroom",
    "imageCredit": "Photo: Unsplash, Unsplash Licence",
    "dataNote": "Data as published June 2025",
    "bodyHtml": "<p>For years, the global count of children out of school told a story of slow progress. The latest estimate tells a harder one.</p> <p>In June 2025, the UNESCO Institute for Statistics (UIS) and the team behind UNESCO's Global Education Monitoring (GEM) Report put the global out-of-school population at <strong>272 million in 2023</strong>. That is 21 million more than their previous estimate.<sup><a href=\"#a1-s1\">1</a></sup> The same figure appears in the UIS publication <i>World education statistics, 2025</i>.<sup><a href=\"#a1-s3\">3</a></sup></p> <h3>Who is missing out</h3> <p>The figure covers children and young people of primary and secondary school age. The older they are, the more likely they are to be out of school.<sup><a href=\"#a1-s1\">1</a></sup></p> <figure class=\"oe-figure\"> <h4>Out of school in 2023, by age group (millions)</h4> <svg viewBox=\"0 0 600 190\" role=\"img\" aria-label=\"Bar chart: primary age 78 million (11%), lower secondary age 64 million (15%), upper secondary age 130 million (31%)\"> <g font-size=\"13\" fill=\"var(--oe-ink)\"> <text x=\"0\" y=\"36\">Primary age</text> <text x=\"0\" y=\"96\">Lower secondary</text> <text x=\"0\" y=\"156\">Upper secondary</text> </g> <rect x=\"150\" y=\"18\" width=\"211\" height=\"28\" rx=\"3\" fill=\"var(--oe-chart-a)\"/> <rect x=\"150\" y=\"78\" width=\"173\" height=\"28\" rx=\"3\" fill=\"var(--oe-chart-a)\"/> <rect x=\"150\" y=\"138\" width=\"351\" height=\"28\" rx=\"3\" fill=\"var(--oe-chart-b)\"/> <g font-size=\"13\" font-weight=\"600\" fill=\"var(--oe-ink)\"> <text x=\"369\" y=\"37\">78m · 11% of age group</text> <text x=\"331\" y=\"97\">64m · 15%</text> <text x=\"509\" y=\"157\">130m · 31%</text> </g> </svg> <figcaption>Source: GEM Report and UIS, June 2025. Chart: Eleventh Press.</figcaption> </figure> <p>Almost half of the total, 130 million, are young people of upper secondary age. Nearly one in three people in that age group is not in school.</p> <h3>Why the number went up</h3> <p>Some of the rise reflects better counting rather than a sudden change on the ground. The GEM Report team explains the increase in two parts.<sup><a href=\"#a1-s1\">1</a></sup></p> <ul> <li><strong>New data: 8 million (38% of the increase).</strong> Newer enrolment and attendance data raised the count. This includes the effect of Afghanistan's 2021 ban on girls attending secondary school.</li> <li><strong>More children than we thought: 13 million (62%).</strong> The UN's 2024 population estimates show 49 million more 6- to 17-year-olds in 2025 than earlier estimates assumed, an increase of 3.1%.</li> </ul> <p class=\"oe-pull\">There are more children than the old model assumed, and more of them are out of school than it recorded.</p> <h3>The children the numbers miss</h3> <p>Even 272 million may be too low. Conflict makes counting hard. Analysis by the GEM Report team suggests that almost 13 million more children may need to be added. That includes large underestimates for Myanmar and Sudan, where there have been no data since conflict began, and a first-ever estimate of 3.7 million out-of-school children in Somalia. These estimates are going through expert review.<sup><a href=\"#a1-s1\">1</a></sup></p> <h3>What countries have promised</h3> <p>As part of their national targets for Sustainable Development Goal 4, countries have collectively committed to reduce their out-of-school population by 165 million by 2030. The GEM Report team says the challenge they face is larger than previously thought.<sup><a href=\"#a1-s1\">1</a>,<a href=\"#a1-s2\">2</a></sup></p> <p>Getting children into school is the first step. As the next article shows, being in school is not the same as learning.</p>",
    "sources": [
      "GEM Report team (9 June 2025). <a href=\"https://world-education-blog.org/2025/06/09/the-out-of-school-population-is-higher-than-previously-thought-and-rising/\" target=\"_blank\" rel=\"noopener\">The out-of-school population is higher than previously thought – and rising</a>. World Education Blog, UNESCO.",
      "UNESCO GEM Report (2025). <a href=\"https://www.unesco.org/gem-report/en/2025sdg4scorecard\" target=\"_blank\" rel=\"noopener\">SDG 4 Scorecard 2025</a>.",
      "UNESCO Institute for Statistics (2025). <a href=\"https://unesdoc.unesco.org/ark:/48223/pf0000396754\" target=\"_blank\" rel=\"noopener\">World education statistics, 2025</a>."
    ],
    "verification": [
      {
        "claim": "272 million out of school in 2023, 21 million more than last estimate",
        "source": "[1] GEM blog",
        "status": "source",
        "note": "Exact wording on page"
      },
      {
        "claim": "Same figure in UIS World education statistics 2025",
        "source": "[3] UIS",
        "status": "document",
        "note": "UNESCO site blocks automated reading"
      },
      {
        "claim": "11% / 78m primary; 15% / 64m lower secondary; 31% / 130m upper secondary",
        "source": "[1] GEM blog",
        "status": "source",
        "note": ""
      },
      {
        "claim": "New data = 8m (38%) of increase, incl. Afghanistan 2021 ban",
        "source": "[1] GEM blog",
        "status": "source",
        "note": ""
      },
      {
        "claim": "Population revisions = 13m (62%); 49m more 6–17-year-olds (3.1%)",
        "source": "[1] GEM blog",
        "status": "source",
        "note": ""
      },
      {
        "claim": "Almost 13m more may need adding; Myanmar, Sudan; Somalia 3.7m",
        "source": "[1] GEM blog",
        "status": "source",
        "note": "Estimates under expert review, as stated"
      },
      {
        "claim": "Countries committed to cut out-of-school by 165m by 2030",
        "source": "[1] GEM blog, [2] Scorecard",
        "status": "source",
        "note": ""
      }
    ],
    "refPrefix": "a1"
  },
  {
    "slug": "learning-poverty",
    "kind": "original",
    "section": "Learning",
    "category": "Feature",
    "title": "Seven in ten: what “learning poverty” means",
    "dek": "Millions of children are in school but not learning to read. A plain guide to one of education's most quoted numbers, and how it was worked out.",
    "image": "/magazines/open-edition/01/learning-poverty.webp",
    "imageAlt": "A boy writing at his desk in a busy primary classroom",
    "imageCredit": "Photo: Unsplash, Unsplash Licence",
    "dataNote": "Data as published June 2022",
    "bodyHtml": "<p>Being in a classroom and learning are not the same thing. To capture the difference, the World Bank and UNESCO use a measure called <strong>learning poverty</strong>: the share of children who cannot read and understand a simple text by the age of 10.<sup><a href=\"#a2-s1\">1</a>,<a href=\"#a2-s2\">2</a></sup></p> <p>Reading is the foundation for almost everything else a child learns at school. A child who cannot read a simple story at 10 is likely to find other subjects hard too.</p> <h3>The 2022 estimate</h3> <p>In June 2022, the World Bank, UNESCO, UNICEF, the UK's Foreign, Commonwealth and Development Office, USAID and the Bill &amp; Melinda Gates Foundation published <i>The State of Global Learning Poverty: 2022 Update</i>. It estimated that <strong>70% of 10-year-olds in low- and middle-income countries</strong> were unable to understand a simple written text. Learning poverty had risen by a third, largely because of school closures during the COVID-19 pandemic.<sup><a href=\"#a2-s1\">1</a></sup></p> <figure class=\"oe-figure\"> <h4>Learning poverty in low- and middle-income countries, 2022 estimate</h4> <svg viewBox=\"0 0 600 120\" role=\"img\" aria-label=\"Seven of ten child figures highlighted: an estimated 70 percent of 10-year-olds cannot read and understand a simple text\"> <defs> <g id=\"kid\"><circle cx=\"0\" cy=\"-30\" r=\"9\"/><path d=\"M-13 -16 h26 a4 4 0 0 1 4 4 v28 h-34 v-28 a4 4 0 0 1 4 -4z\"/></g> </defs> <g fill=\"var(--oe-chart-a)\"> <use href=\"#kid\" x=\"30\" y=\"70\"/><use href=\"#kid\" x=\"80\" y=\"70\"/><use href=\"#kid\" x=\"130\" y=\"70\"/><use href=\"#kid\" x=\"180\" y=\"70\"/><use href=\"#kid\" x=\"230\" y=\"70\"/><use href=\"#kid\" x=\"280\" y=\"70\"/><use href=\"#kid\" x=\"330\" y=\"70\"/> </g> <g fill=\"var(--oe-chart-mute)\"> <use href=\"#kid\" x=\"380\" y=\"70\"/><use href=\"#kid\" x=\"430\" y=\"70\"/><use href=\"#kid\" x=\"480\" y=\"70\"/> </g> <text x=\"30\" y=\"112\" font-size=\"13\" fill=\"var(--oe-ink)\">7 in 10 cannot read and understand a simple text by age 10</text> </svg> <figcaption>Source: World Bank, UNESCO, UNICEF and partners, 2022. Illustration: Eleventh Press.</figcaption> </figure> <p>The crisis was already deep before the pandemic. The report revised the pre-pandemic rate upward, to 57% of 10-year-olds, from an earlier estimate of 53% for 2015.<sup><a href=\"#a2-s1\">1</a></sup></p> <h3>Where it is worst</h3> <ul> <li><strong>Latin America and the Caribbean:</strong> a predicted 80% of children at the end of primary school age, up from around 50% before the pandemic. This region had some of the longest school closures.<sup><a href=\"#a2-s1\">1</a></sup></li> <li><strong>South Asia:</strong> 78%, up from 60%.<sup><a href=\"#a2-s1\">1</a></sup></li> <li><strong>Sub-Saharan Africa:</strong> the increase was smaller, because school closures there typically lasted only a few months. But learning poverty stands at an extremely high 89%.<sup><a href=\"#a2-s2\">2</a></sup></li> </ul> <h3>How the number was worked out</h3> <p>The 70% figure is an estimate, not a test of every child. The researchers combined the most recent learning data with evidence on how school closures and household income shocks affected children, then simulated where children now stand. The report notes that new data from reopened schools support its predictions of large learning losses.<sup><a href=\"#a2-s1\">1</a></sup></p> <p class=\"oe-pull\">Returning to the pre-COVID status quo, the report warns, will not secure the future of the world's children.</p> <h3>Why it matters</h3> <p>The report warns that this generation of students risks losing US$21 trillion in lifetime earnings. Its authors call for a vigorous learning recovery and acceleration, not a return to how things were.<sup><a href=\"#a2-s1\">1</a></sup></p> <p>One reason children struggle to read is easy to overlook: many are taught in a language they do not speak at home. Our feature on home languages, later in this issue, looks at that problem.</p>",
    "sources": [
      "World Bank (23 June 2022). <a href=\"https://www.worldbank.org/en/news/press-release/2022/06/23/70-of-10-year-olds-now-in-learning-poverty-unable-to-read-and-understand-a-simple-text\" target=\"_blank\" rel=\"noopener\">70% of 10-year-olds now in learning poverty, unable to read and understand a simple text</a>. Press release. Full report: <a href=\"https://www.worldbank.org/en/topic/education/publication/state-of-global-learning-poverty\" target=\"_blank\" rel=\"noopener\">The State of Global Learning Poverty: 2022 Update</a>.",
      "UNICEF (23 June 2022). <a href=\"https://www.unicef.org/press-releases/70-cent-10-year-olds-learning-poverty-unable-read-and-understand-simple-text\" target=\"_blank\" rel=\"noopener\">70 per cent of 10-year-olds in 'learning poverty', unable to read and understand a simple text</a>. Press release."
    ],
    "verification": [
      {
        "claim": "Definition: cannot read and understand simple text by age 10",
        "source": "[1] World Bank, [2] UNICEF",
        "status": "source",
        "note": ""
      },
      {
        "claim": "Report by World Bank, UNESCO, UNICEF, FCDO, USAID, Gates Foundation, June 2022",
        "source": "[1] World Bank",
        "status": "source",
        "note": ""
      },
      {
        "claim": "70% of 10-year-olds in LMICs; up by a third",
        "source": "[1] World Bank",
        "status": "source",
        "note": ""
      },
      {
        "claim": "Pre-pandemic revised to 57% (from 53% for 2015)",
        "source": "[1] World Bank",
        "status": "source",
        "note": ""
      },
      {
        "claim": "LAC 80% from ~50%; South Asia 78% from 60%",
        "source": "[1] World Bank",
        "status": "source",
        "note": ""
      },
      {
        "claim": "Sub-Saharan Africa 89%, smaller increase, short closures",
        "source": "[2] UNICEF",
        "status": "source",
        "note": ""
      },
      {
        "claim": "Figure is a simulation; new data support predictions",
        "source": "[1] World Bank",
        "status": "source",
        "note": "Paraphrased"
      },
      {
        "claim": "US$21 trillion in lifetime earnings at risk",
        "source": "[1] World Bank",
        "status": "source",
        "note": "From press release headline"
      },
      {
        "claim": "'Returning to the pre-COVID status quo will not secure the future…'",
        "source": "[1] World Bank",
        "status": "source",
        "note": "Paraphrased in pull quote"
      }
    ],
    "refPrefix": "a2"
  },
  {
    "slug": "teacher-gap",
    "kind": "original",
    "section": "Teachers",
    "category": "Feature",
    "title": "The 44-million-teacher gap",
    "dek": "The world does not have enough teachers to keep its promise of education for every child by 2030. Where the gap is widest, why teachers leave, and what closing it would cost.",
    "image": "/magazines/open-edition/01/teacher-gap.webp",
    "imageAlt": "A teacher at the front of a classroom while pupils raise their hands",
    "imageCredit": "Photo: Unsplash, Unsplash Licence",
    "dataNote": "Data as published February 2024, with an October 2026 note",
    "bodyHtml": "<p>Every goal in this issue depends on one thing: a trained teacher in the room. And the world is running short of them.</p> <p>In February 2024, UNESCO published its first <i>Global Report on Teachers</i>, prepared with the International Task Force on Teachers for Education 2030. It found that <strong>44 million additional primary and secondary teachers</strong> are needed worldwide by 2030 to meet Sustainable Development Goal 4, quality education for all.<sup><a href=\"#a3-s1\">1</a>,<a href=\"#a3-s2\">2</a></sup></p> <h3>Where the gap is widest</h3> <p>The shortage is global, but it hits sub-Saharan Africa hardest. The region alone needs an estimated 15 million new teachers by 2030, about a third of the world total.<sup><a href=\"#a3-s2\">2</a></sup></p> <figure class=\"oe-figure\"> <h4>Additional primary and secondary teachers needed by 2030 (millions)</h4> <svg viewBox=\"0 0 600 120\" role=\"img\" aria-label=\"Stacked bar: of 44 million teachers needed, 15 million are in sub-Saharan Africa and 29 million in the rest of the world\"> <rect x=\"0\" y=\"20\" width=\"204\" height=\"40\" rx=\"3\" fill=\"var(--oe-chart-b)\"/> <rect x=\"206\" y=\"20\" width=\"394\" height=\"40\" rx=\"3\" fill=\"var(--oe-chart-a)\"/> <g font-size=\"13\" font-weight=\"600\"> <text x=\"12\" y=\"45\" fill=\"oklch(0.2 0.04 280)\">15m</text> <text x=\"218\" y=\"45\" fill=\"oklch(0.98 0.01 295)\">29m</text> </g> <g font-size=\"13\" fill=\"var(--oe-ink)\"> <text x=\"0\" y=\"86\">Sub-Saharan Africa</text> <text x=\"206\" y=\"86\">Rest of the world</text> <text x=\"0\" y=\"110\" fill=\"var(--oe-ink-soft)\">Total: 44 million</text> </g> </svg> <figcaption>Source: UNESCO Global Report on Teachers, 2024, via UN News. \"Rest of the world\" is the remainder. Chart: Eleventh Press.</figcaption> </figure> <h3>The leaking bucket</h3> <p>Hiring is only half the problem. Keeping teachers is the other. According to UNESCO, \"seven out of 10 teachers at the secondary level will need to be replaced by 2030, along with over half of all existing teachers who will have left the profession by the decade's end.\"<sup><a href=\"#a3-s2\">2</a></sup></p> <p>The rate at which primary teachers leave has almost doubled, from 4.62% globally in 2015 to 9.06% in 2022. Many leave within their first five years.<sup><a href=\"#a3-s2\">2</a></sup></p> <p class=\"oe-pull\">44 million teachers by 2030. Fifteen million of them in sub-Saharan Africa.</p> <h3>The price of closing the gap</h3> <p>UNESCO estimates that an additional US$120 billion a year is needed to pay the salaries of the primary and secondary teachers required to reach SDG 4 by 2030.<sup><a href=\"#a3-s2\">2</a></sup></p> <h3>A newer estimate</h3> <p>In October 2026, news reports on new UNESCO data released for World Teachers' Day put the total need at about 50 million teachers by 2030. That total adds about 6 million pre-primary teachers to the 44 million needed for primary and secondary schools.<sup><a href=\"#a3-s3\">3</a>,<a href=\"#a3-s4\">4</a></sup> We have not yet been able to read UNESCO's own release, so we report this figure as published by news outlets and will update this article once we have checked it.</p> <p>However the gap is counted, the direction is clear. Without more teachers, and better support to keep them, the other promises in this issue cannot be kept.</p>",
    "sources": [
      "UNESCO and International Task Force on Teachers for Education 2030 (2024). <a href=\"https://unesdoc.unesco.org/ark:/48223/pf0000388832\" target=\"_blank\" rel=\"noopener\">Global report on teachers: addressing teacher shortages and transforming the profession</a>.",
      "UN News (February 2024). <a href=\"https://news.un.org/en/story/2024/02/1147067\" target=\"_blank\" rel=\"noopener\">UN issues global alert over teacher shortage</a>.",
      "Africanews (6 October 2026). <a href=\"https://www.africanews.com/2026/10/06/world-needs-50-million-additional-teachers-by-2030-unesco-says/\" target=\"_blank\" rel=\"noopener\">World needs 50 million additional teachers by 2030, UNESCO says</a>.",
      "DevelopmentAid (October 2026). <a href=\"https://www.developmentaid.org/news-stream/post/211189/unesco-world-needs-50-million-more-teachers-by-2030\" target=\"_blank\" rel=\"noopener\">UNESCO: World needs 50 million more teachers by 2030</a>."
    ],
    "verification": [
      {
        "claim": "44 million primary and secondary teachers needed by 2030",
        "source": "[1] UNESCO, [2] UN News",
        "status": "source",
        "note": "Read on UN News"
      },
      {
        "claim": "Sub-Saharan Africa needs about 15 million",
        "source": "[2] UN News",
        "status": "source",
        "note": ""
      },
      {
        "claim": "Quote: 'seven out of 10 teachers at the secondary level…'",
        "source": "[2] UN News",
        "status": "source",
        "note": "Quoted exactly"
      },
      {
        "claim": "Primary attrition 4.62% (2015) to 9.06% (2022); many leave in first 5 years",
        "source": "[2] UN News",
        "status": "source",
        "note": ""
      },
      {
        "claim": "US$120 billion a year in extra salary funding",
        "source": "[2] UN News",
        "status": "source",
        "note": ""
      },
      {
        "claim": "~50 million incl. ~6 million pre-primary (Oct 2026)",
        "source": "[3] Africanews, [4] DevelopmentAid",
        "status": "reported",
        "note": "Reported by news outlets; awaiting confirmation from UNESCO's own release. The article says so."
      }
    ],
    "refPrefix": "a3"
  },
  {
    "slug": "home-language",
    "kind": "original",
    "section": "Language",
    "category": "Feature",
    "title": "Learning in the language you speak at home",
    "dek": "Hundreds of millions of children sit in classrooms taught in a language they barely understand. Why mother-tongue teaching matters, and what the evidence shows.",
    "image": "/magazines/open-edition/01/home-language.webp",
    "imageAlt": "A group of smiling children standing together outdoors",
    "imageCredit": "Photo: Unsplash, Unsplash Licence",
    "dataNote": "Data as published February 2024",
    "bodyHtml": "<p>Imagine starting school and finding that your teacher, your textbook and every test speak a language you do not use at home. For a large share of the world's children, that is simply the first day of school.</p> <p>UNESCO estimates that <strong>40% of the world's population does not have access to education in a language they speak or understand</strong>.<sup><a href=\"#a4-s1\">1</a></sup> The figure is a long-standing estimate, first published in a 2016 GEM Report policy paper, which cited earlier research.<sup><a href=\"#a4-s2\">2</a></sup> It is best read as a sign of the scale of the problem rather than a precise count.</p> <h3>A multilingual world</h3> <p>Speaking more than one language is normal. UNESCO's World Atlas of Languages records around 7,000 spoken or signed languages in use, and it is estimated that at least half of the world's people are bilingual.<sup><a href=\"#a4-s1\">1</a></sup></p> <p>Many of those languages are at risk. UNESCO data indicate that around 600 languages have disappeared in the last century. If current trends continue, up to 90% of the world's languages may become extinct by the end of this century.<sup><a href=\"#a4-s1\">1</a></sup> Schools that teach only in a few dominant languages are part of that story.</p> <h3>What the evidence shows</h3> <p>Children learn best in a language they understand. In upper-middle- and high-income countries, children who speak the language they are taught in are <strong>14% more likely to read with understanding</strong> at the end of primary school than those who do not.<sup><a href=\"#a4-s1\">1</a></sup></p> <p>The gap appears at secondary level too, and varies widely between countries. According to UNESCO, it ranges from 4% in Canada to around 40% in Germany and the Netherlands, and over 60% in Thailand.<sup><a href=\"#a4-s1\">1</a></sup></p> <p class=\"oe-pull\">Students learn best in a language they understand.</p> <p>The benefits go beyond test scores. Studies cited by UNESCO show that mother-tongue-based multilingual education can boost classroom participation, improve retention rates and encourage families and communities to get involved in their children's schooling.<sup><a href=\"#a4-s1\">1</a></sup></p> <h3>What helps</h3> <p>UNESCO points to countries as different as Ghana, Peru, Singapore and South Africa that have adopted policies promoting mother-language education from early childhood. It also calls for:<sup><a href=\"#a4-s1\">1</a></sup></p> <ul> <li>recruiting and training teachers and community members who speak learners' home languages;</li> <li>more teaching and learning materials in local languages, in print and digital form;</li> <li>assessments designed to fairly measure what multilingual learners know.</li> </ul> <p>Open educational resources, the subject of our explainer on open textbooks, can help with that second point: openly licensed materials can be legally translated and adapted into local languages.</p>",
    "sources": [
      "Giannini, S. (21 February 2024). <a href=\"https://www.un.org/en/un-chronicle/multilingual-education-key-quality-and-inclusive-learning\" target=\"_blank\" rel=\"noopener\">Multilingual Education: A Key to Quality and Inclusive Learning</a>. UN Chronicle, United Nations. The author is UNESCO's Assistant Director-General for Education.",
      "UNESCO GEM Report (2016). <a href=\"https://reliefweb.int/report/world/if-you-don-t-understand-how-can-you-learn\" target=\"_blank\" rel=\"noopener\">If you don't understand, how can you learn?</a> Policy Paper 24."
    ],
    "verification": [
      {
        "claim": "40% lack education in a language they speak or understand",
        "source": "[1] UN Chronicle, [2] GEM 2016",
        "status": "source",
        "note": "Article notes it is a long-standing estimate"
      },
      {
        "claim": "~7,000 languages; at least half of people bilingual",
        "source": "[1] UN Chronicle",
        "status": "source",
        "note": ""
      },
      {
        "claim": "~600 languages lost in last century; up to 90% may vanish this century",
        "source": "[1] UN Chronicle",
        "status": "source",
        "note": ""
      },
      {
        "claim": "14% more likely to read with understanding (upper-middle and high-income)",
        "source": "[1] UN Chronicle",
        "status": "source",
        "note": ""
      },
      {
        "claim": "Gap ranges: 4% Canada, ~40% Germany and Netherlands, >60% Thailand",
        "source": "[1] UN Chronicle",
        "status": "source",
        "note": "Refers to end of lower secondary"
      },
      {
        "claim": "Benefits: participation, retention, family involvement",
        "source": "[1] UN Chronicle",
        "status": "source",
        "note": ""
      },
      {
        "claim": "Policy examples: Ghana, Peru, Singapore, South Africa",
        "source": "[1] UN Chronicle",
        "status": "source",
        "note": ""
      }
    ],
    "refPrefix": "a4"
  },
  {
    "slug": "xreality-in-education",
    "kind": "reprint",
    "section": "Technology",
    "category": "Reprint",
    "title": "Making the most of (x)Reality in education",
    "dek": "How to apply augmented, virtual and mixed reality in ways that add educational value, not just novelty.",
    "image": "/magazines/open-edition/01/xreality.webp",
    "imageAlt": "Students working together around laptops at a table",
    "imageCredit": "Photo: Unsplash, Unsplash Licence. Chosen by Eleventh Press; not part of the original article.",
    "reprint": {
      "publication": "Connections, Vol 28, No 3 (2023)",
      "publisher": "Commonwealth of Learning",
      "authors": "Dr Mark Nichols",
      "sourceUrl": "https://openbooks.col.org/connectionsvol28no3/chapter_making-the-most-of-xreality-in-education.html",
      "licence": {
        "label": "CC BY-SA 4.0",
        "url": "https://creativecommons.org/licenses/by-sa/4.0/"
      },
      "notes": "Text reproduced unchanged. This reprint is shared under the same licence."
    },
    "bodyHtml": "<p><em>By Dr Mark Nichols, Executive Director, Learning Design &amp; Development, Te Pūkenga | Open Polytechnic business division, New Zealand.</em></p> <p>The technology is there, and education is eager to apply it. But how do we apply augmented/virtual/mixed reality in ways that will make a positive difference to learning?<sup>[1]</sup></p> <p>Let’s start by defining just what it is we are dealing with here. Augmented, virtual and mixed reality are different. Augmented describes digital objects (including sound, graphics and video) overlayed in a real-world environment, visible via a digital device camera such as that of a mobile phone. Virtual is where the entire environment is digital, and elements can be interacted with, usually experienced through an immersive headset. Mixed is where augmented and virtual are combined, such that virtual objects in an augmented view can be engaged with and manipulated. A useful way of talking about all at once is to use the term xR – eXtended Reality.</p> <p>Each of these technologies continues to surprise. Real-time text and audio translation are now technically possible through augmented reality, and virtual reality headsets are finding their way into classrooms.<sup>[2]</sup> Medical operations, fire extinguisher training, sports techniques – even situations that may require officers to use tasers – are all current applications of VR in learning. Augmented reality can likewise be applied in fascinating ways for educational purposes. A quick online search will provide a variety of exciting, interesting and creative uses of xR.</p> <p>It’s easy to get lost in the potential, which is entirely openended. But how can we harness the options in ways that add value, not just novelty, to education? Here is a series of steps that might be followed to evaluate the contribution.</p> <p>First, <strong>start with a learning opportunity</strong>. Is there a particular concept, learning requirement or teaching difficulty that learners simply find hard to grasp? Are there any misconceptions that learners continue to have, despite best efforts? Is there a complex task or skill that is difficult to simulate, or too expensive or risky to provide in real life? A yes to any of these indicates an xR solution may make sense.</p> <p>Second, <strong>investigate the learning problem </strong>from an educational standpoint. What actual understandings, skills and experiences are required? What are some common misunderstandings, errors and perspectives that need to be corrected? These will give insight into the design that might apply.</p> <p>Third, <strong>consider the return on investment</strong>. Does development (or purchase of an existing solution) make sense financially? In what ways might it make teaching and learning more efficient, as well as effective? What is the likely life cycle of the intervention, that is, how often might it need updating?</p> <p>Fourth, <strong>confirm user access and experience</strong>. A few years ago, this step might have even come first. The combination of more accessible technology and increasingly ubiquitous access makes user access a later, yet still potentially halting, step. Not all xR requires expensive headsets, high bandwidth or top-of-the-line tablets. Consider the minimum technology that a solution may require and determine whether this might hinder xR as a viable solution. Alternatively, given the responses to the steps above, it might make sense to invest in some devices.</p> <p>As with most technological possibilities available to us, xR promises much. Yet as open, distance and flexible learning (ODFL) practitioners, our focus must always be on the educational benefits a technology might bring, and so base its application on educational need. My position is that I believe the contribution xR can make will depend on specific learning requirements and a carefully considered set of educational outcomes.</p> <p>I encountered an example of the potential for xR early in my career as a learning technologist. A colleague explained that drug calculations, an essential skill for nursing students to develop, was tedious to teach and frustrating for some learners. Mistakes were often made in decimal places; the difference between 1 litre and 0.1 litre is easy to see physically but can slip by on paper. The practice questions were too abstract. At the time of this conversation, xR was in its very early stages. Now, I can see an xR solution as entirely relevant for this situation.</p> <p>Imagine a series of xR scenarios, based on real drugs and concentrations, providing endless opportunities for students to select a virtual syringe and draw the right dose to present their answer. Imagine, too, a virtual patient explaining the consequence of too little or – likely worse – too much being administered. Different patients, conditions, drugs and means of administering might all form part of the mix. The spatial and consequential concerns of drug calculations would become explicit.</p> <p>Ultimately, the elegance of the educational solution, not the novelty or slickness of graphics, should drive our use of all educational technologies. xR has potential for use across all subject areas and practice disciplines, but whether it makes a positive difference in ODFL will depend on it being applied to the right learning opportunities.</p> <ol><li>I would like to acknowledge Kerry Deane, Digital Experience Manager at Te Pūkenga | Open Polytechnic, for his insight into the latest xR possibilities, that have informed this piece.</li><li>See, for example,‘Metaverse school’ teaches students using VR - YouTube | <a href=\"https://www.youtube.com/watch?v=4nwQ36m9aDE\" target=\"_blank\" rel=\"noopener\">https://www.youtube.com/watch?v=4nwQ36m9aDE</a></li></ol>"
  },
  {
    "slug": "open-textbooks",
    "kind": "original",
    "section": "Open knowledge",
    "category": "Explainer",
    "title": "Open textbooks for everyone: the UNESCO OER Recommendation",
    "dek": "In 2019, UNESCO's member states agreed on a shared framework for free, openly licensed learning materials. What \"open\" means, what governments signed up to, and how you can use open books today.",
    "image": "/magazines/open-edition/01/open-textbooks.webp",
    "imageAlt": "An open book lying on top of other books",
    "imageCredit": "Photo: Unsplash, Unsplash Licence",
    "dataNote": null,
    "bodyHtml": "<p>A textbook that is free to read is useful. A textbook that is free to read, copy, translate, adapt and share is something more: it can be reshaped for a different country, language or classroom without asking anyone's permission. That is the idea behind <strong>open educational resources</strong>, or OER.</p> <h3>What counts as open</h3> <p>UNESCO's 2019 Recommendation defines OER as learning, teaching and research materials in any format and medium that are in the public domain, or that are under copyright but released under an open licence. That licence must allow anyone to access, reuse, repurpose, adapt and redistribute them at no cost.<sup><a href=\"#a6-s1\">1</a></sup></p> <p>In practice, most open materials use Creative Commons licences. Every licence label you see in this issue is made of a few building blocks:<sup><a href=\"#a6-s3\">3</a></sup></p> <figure class=\"oe-figure\"> <h4>The Creative Commons building blocks</h4> <svg viewBox=\"0 0 600 170\" role=\"img\" aria-label=\"Four licence elements: BY means credit the creator; SA means share adaptations under the same licence; NC means non-commercial use only; ND means no changes\"> <g font-family=\"var(--font-mono)\" font-weight=\"500\" font-size=\"22\"> <rect x=\"0\" y=\"6\" width=\"64\" height=\"34\" rx=\"6\" fill=\"var(--oe-chart-a)\"/><text x=\"32\" y=\"30\" text-anchor=\"middle\" fill=\"var(--oe-paper)\">BY</text> <rect x=\"0\" y=\"48\" width=\"64\" height=\"34\" rx=\"6\" fill=\"var(--oe-chart-a)\"/><text x=\"32\" y=\"72\" text-anchor=\"middle\" fill=\"var(--oe-paper)\">SA</text> <rect x=\"0\" y=\"90\" width=\"64\" height=\"34\" rx=\"6\" fill=\"var(--oe-chart-b)\"/><text x=\"32\" y=\"114\" text-anchor=\"middle\" fill=\"oklch(0.2 0.04 280)\">NC</text> <rect x=\"0\" y=\"132\" width=\"64\" height=\"34\" rx=\"6\" fill=\"var(--oe-chart-b)\"/><text x=\"32\" y=\"156\" text-anchor=\"middle\" fill=\"oklch(0.2 0.04 280)\">ND</text> </g> <g font-size=\"14\" fill=\"var(--oe-ink)\"> <text x=\"80\" y=\"29\">Credit the creator. Part of every CC licence.</text> <text x=\"80\" y=\"71\">Share your adapted version under the same licence.</text> <text x=\"80\" y=\"113\">Non-commercial use only.</text> <text x=\"80\" y=\"155\">No changes: share it exactly as published.</text> </g> </svg> <figcaption>Plum blocks allow adaptation. Gold blocks add limits. Source: Creative Commons. Illustration: Eleventh Press.</figcaption> </figure> <h3>What governments agreed</h3> <p>UNESCO's General Conference adopted the Recommendation on Open Educational Resources at its 40th session in Paris in November 2019.<sup><a href=\"#a6-s1\">1</a>,<a href=\"#a6-s2\">2</a></sup> UNESCO describes it as the only international standard-setting framework in this area.<sup><a href=\"#a6-s1\">1</a></sup> It asks governments to act in five areas:<sup><a href=\"#a6-s1\">1</a></sup></p> <ol> <li>building the capacity of teachers, learners and institutions to create, access, reuse, adapt and redistribute OER;</li> <li>developing supportive policy;</li> <li>ensuring effective, inclusive and equitable access to quality OER;</li> <li>nurturing sustainable models for creating OER;</li> <li>promoting international cooperation.</li> </ol> <p class=\"oe-pull\">Open does not just mean free to read. It means free to adapt.</p> <h3>Why it matters for the other stories here</h3> <p>The problems in this issue connect directly to open materials. Children taught in an unfamiliar language need books in their own language, and an openly licensed text can be legally translated. Countries short of teachers need training materials they can adapt without paying again for every copy.</p> <h3>Where to find open books</h3> <p>The Open Resources shelf on the Eleventh Press Books page collects openly licensed titles from publishers including UNESCO, the OECD, the World Bank and the Commonwealth of Learning. Each title shows its licence, so you know exactly what you may do with it. This magazine follows the same rule: every reprint carries its licence and a link to the original.</p>",
    "sources": [
      "UNESCO (2019). <a href=\"https://en.unesco.org/themes/building-knowledge-societies/oer/recommendation\" target=\"_blank\" rel=\"noopener\">Recommendation on Open Educational Resources (OER)</a>.",
      "Creative Commons (24 October 2019). <a href=\"https://creativecommons.org/2019/10/24/we-support-unesco-oer/\" target=\"_blank\" rel=\"noopener\">We support the UNESCO OER Recommendation</a>.",
      "Creative Commons. <a href=\"https://creativecommons.org/licenses/\" target=\"_blank\" rel=\"noopener\">About CC licenses</a>."
    ],
    "verification": [
      {
        "claim": "OER definition (any format and medium, public domain or open licence…)",
        "source": "[1] UNESCO",
        "status": "document",
        "note": "Paraphrased; UNESCO page blocks automated reading"
      },
      {
        "claim": "Adopted at 40th General Conference, November 2019",
        "source": "[1] UNESCO, [2] CC",
        "status": "document",
        "note": "Sources differ on exact day, so only month given"
      },
      {
        "claim": "'Only international standard-setting framework' in this area",
        "source": "[1] UNESCO",
        "status": "document",
        "note": ""
      },
      {
        "claim": "Five areas of action",
        "source": "[1] UNESCO",
        "status": "document",
        "note": "Wording lightly simplified"
      },
      {
        "claim": "CC building blocks BY / SA / NC / ND",
        "source": "[3] Creative Commons",
        "status": "source",
        "note": "Standard licence terms"
      },
      {
        "claim": "Open Resources shelf has titles from UNESCO, OECD, World Bank, COL",
        "source": "Eleventh Press catalogue",
        "status": "source",
        "note": "From our own site data"
      }
    ],
    "refPrefix": "a6"
  },
  {
    "slug": "group-interviews",
    "kind": "reprint",
    "section": "In the classroom",
    "category": "Reprint",
    "title": "Learning through group interviews",
    "dek": "Live by your wits: group interviews based on disaster scenarios provide a fun opportunity to develop scientific literacy and transferable skills.",
    "image": "/magazines/open-edition/01/group-interviews.webp",
    "imageAlt": "Four young adults discussing something on a laptop",
    "imageCredit": "Photo: Unsplash, Unsplash Licence. Chosen by Eleventh Press; the original article’s images are not reproduced.",
    "reprint": {
      "publication": "Science in School, Issue 74 (2025)",
      "publisher": "EIROforum",
      "authors": "Martin McHugh, Laura Coffey, Andrew Fagan, Mary Flood, Laura Foley, Jamie Guidera, Md Kamruzzaman, Oxana Kotova, Kruga Owodeha-Ashaka, Maja Railic and Callum Ryan",
      "sourceUrl": "https://scienceinschool.org/article/2025/learning-through-group-interviews/",
      "licence": {
        "label": "CC BY",
        "url": "https://creativecommons.org/licenses/by/4.0/"
      },
      "notes": "Text reproduced unchanged; images and photo captions omitted. Handouts and scoring sheets are on the original page."
    },
    "bodyHtml": "<p>Group interviews are a common way for large companies to assess multiple candidates simultaneously. It has proved to be a cost-effective method to evaluate how people interact with each other in what can be a high-stakes environment. Group interviews are designed to test soft or transferable skills, such as communication and leadership. While in a company this approach is pragmatic, they knowingly or unknowingly tend to utilize role-playing situations that also examine scientific literacy. From desert survival to missions on the moon, group-interview activities often use scenarios with environmental limitations, where participants must work together to prioritize a list of items to ensure their survival.</p> <p>This type of activity can be readily applied to a science classroom, providing a novel and engaging approach for teaching and learning. In the past decade, soft skills have emerged as important factors linked to student achievement, emotions, motivation, and life satisfaction. Such skills include adaptability, curiosity, and social awareness.<sup>[<a href=\"https://doi.org/10.1007/s10212-022-00601-4\" target=\"_blank\" rel=\"noopener\">1</a>]</sup> Yet, many science curricula are dominated by learning objectives grounded in scientific knowledge. While efforts have been made to make science more relevant, resources that highlight the inherent social aspects of science are warranted. Developing an understanding of the social and institutional dimensions of science aid students in the development of scientific literacy.<sup>[<a href=\"https://doi.org/10.1126/science.adk1509\" target=\"_blank\" rel=\"noopener\">2</a>]</sup></p> <p>Accordingly, group interviews with a distinct focus on science can provide a contextual learning experience with a real-world application. This activity is aimed at science lessons for students aged 15–17 but can work with younger students and even adults. The premise of the activity is that students are presented with a scenario or short story. Here, we give three examples.</p> <ul> <li>Antarctic escape: scientists trapped at a research facility<br></li> </ul> <ul> <li>Rainforest rally: students navigating the Amazon rainforest</li> </ul> <ul> <li>Flood fighters: people trying to survive a flood</li> </ul> <p>In each instance, a list of unique items is given. Many items listed are linked to the science curriculum, while others are items that students will have interacted with in their daily lives. The goal of the activity is that, through constructive debate and argumentation, students must come to a group consensus and list the items from most to least important.</p> <p>What makes the activity ‘tick’ is selecting a scenario with environmental limitations and variables, combined with a balanced list of items that open avenues for scientific reasoning and discourse.</p> <p>The Antarctic escape activity is described below, but the other two follow a very similar format. Materials for all three scenarios are provided in the supporting material.</p> <h2>Activity: Antarctic escape</h2> <p>This scenario places students in an isolated Antarctic research facility. Upon the accidental release of a pathogen, students must work together to use items effectively and ensure their survival.</p> <p>This activity should take around 40 minutes.</p> <h4>Materials</h4> <ul> <li>Pen and paper</li> <li>A printed copy of the<a href=\"https://scienceinschool.org/wp-content/uploads/2025/09/Antarctic-escape-challenge.pdf\" target=\"_blank\" rel=\"noopener\"> scenario handout</a> for all students</li> <li>A printed copy of the <a href=\"https://scienceinschool.org/wp-content/uploads/2025/09/Antarctic-escape-scoring-sheet.pdf\" target=\"_blank\" rel=\"noopener\">scoring sheet</a> for all students</li> <li>Optional: <a href=\"https://scienceinschool.org/wp-content/uploads/2025/09/Marking-rubric.pdf\" target=\"_blank\" rel=\"noopener\">marking rubric</a></li> <li>Whiteboard or other large board or screen to record the class item ranking</li> </ul> <h4>Procedure</h4> <ol> <li>Introduce the activity by explaining the concept of a group interview to students. Give details on positive behaviour that can be displayed during a group interview, such as making strong arguments, taking on feedback, and working with others. Make it clear that behaviour such as talking over others, talking too much, and making weak arguments will be marked negatively and is not what an employer (or teacher in this instance) wants from the activity. Social interactions and scientific arguments will determine if students pass the group-interview stage.</li> <li>You can further engage students by asking them why companies might use a group interview as opposed to interviewing people individually, or what kind of actions will make you stand out in a group interview (answers can be positive or negative). Finally, ask students if it is a good strategy to talk too much or too little during a group interview. Essentially, they are trying to hit the Goldilocks zone, with just the right amount of talking and listening.</li> <li>Each student is given the scenario handout. The handout contains the scenario description and a table listing 15 items that have varying levels of usefulness for the scenario.</li> <li>Read the scenario aloud to the students and explain that the task is to rank the articles in order of usefulness, using scientific arguments, first individually and then as a group. Introduce the self-scoring system at this stage to make it clear that this is a fun exercise and should not be a source of stress!</li> <li>To start, students are given around 10 minutes to reread the scenario and start to rank the items by themselves and record their individual rankings on their handouts. Items are ranked from 1 to 15 in order of their usefulness pertaining to the survival of the group in a given scenario, with 1 being the most important and 15 being the least important.</li> <li>Once the individual rankings are complete, the entire class is asked to come together and create a new ranking as a group. This process should take between 15 and 20 minutes. The teacher writes the group rankings on the board.</li> <li>Ask students to rank their first item and to make arguments for why they have placed the item in that slot. Feel free to ask probing questions or diffuse potential debates, depending on how long it takes to rank certain items.</li> <li>A good strategy is, once the group has ranked their first five items, to ask them to change tactics and rank the worst items. The best and worst items are easiest to rank. Feel free to go through the items that rank in the middle faster, as they have less importance over the highest- and lowest-ranked items.</li> <li>If students are stuck or in a gridlock, you can ask them to vote by raising their hands. Even better is if a student asks the rest of the group to vote.</li> <li>To finish the activity, hand the students the scoring sheet with the official article rankings. Students can work out the difference between this and their individual results, and on this basis, give themselves a grade to determine their scenario outcome based on the self-scoring system (see below).</li> </ol> <h3>Scenario-outcome scoring</h3> <p><strong>0–25 Excellent</strong> – you and the team survive and become minor celebrities.</p> <p><strong>26–32 Good</strong> – you and the team are shaken up, but happy to be alive.</p> <p><strong>33–45 Average</strong> – you are found wandering in the tundra and are helicoptered to safety.</p> <p><strong>46–55 Fair</strong> – you survive the expedition but leave your researcher role, turn your back on science, and spend the rest of your days believing the Earth is flat.</p> <p><strong>56–70 Poor</strong> – you are emotionally scarred for life and develop globophobia (fear of balloons).</p> <p><strong>71–112 Very poor</strong> – you become infected and don’t make it out of the research facility.</p> <ol> <li>While this is happening, you can score the class item ranking on the board. It is important to note that this grade does not determine if students pass the group-interview stage; it just determines whether the team has survived the scenario!</li> <li>Ask the class about their individual grades and see if anyone scored better than the group.</li> <li>Once complete, provide constructive feedback to the entire class on positive behaviour demonstrated during the activity. Feel free to give examples of these types of behaviours that took place during the activity. If you decide to give individual feedback, you can use the scoring rubric provided in the supporting material.</li> </ol> <h4>Results/discussion</h4> <p>The effectiveness of this activity relies on the teacher acting as a facilitator of arguments and debates. By moderating behaviour, the teacher can try to ensure that louder voices are limited in terms of their impact and quieter voices are given time to talk. This is important, as the idea of a group interview can be intimidating for less-confident students. Teachers should facilitate an inclusive learning environment.</p> <p>In terms of items, the results give a justification for their placement, but teachers can use their knowledge and experience to encourage discussions around their usefulness. Some items may have multiple use cases. For example, a lab notebook might provide useful information in a survival scenario and can also be used as fuel in a fire. Furthermore, some items have ethical implications. For example, pistols and bullets are often included in these types of group interviews. While they may have some practical use, the question remains as to who gets control of these items in a survival scenario where you may not be able to trust everyone. Students will often think about items from a scientific or survival point of view, but not an ethical one. The item ranking that is developed collaboratively by the class should reflect their input. A persuasive argument for an ‘incorrect’ item is important, especially if that student convinces classmates to follow their line of thinking.</p> <p>Student self-scoring is designed to be fun, and each score informs the student of what happened to them in the end. Some students will survive, some won’t, and others will turn their back on science and become flat-earthers. This self-score should not impact too much on whether the student gets through to the next round of interviews, as the focus of the activity is on developing transferable skills. Expanding on this, there may even be a case where a student gets all the science incorrect but is charismatic and convincing to the point that others in the group follow. This can lead to discussions around misinformation and critical thinking. Teachers can decide who has passed the activity based on their observations of the class. Generally, three or four students stand out in terms of their engagement, teamwork, arguments, and persuasiveness. For teachers who would like a more formal assessment for their students, the rubric provided will allow them to score students and determine who has passed the activity and who can improve. This is particularly beneficial if you plan on running different scenarios multiple times with the same class.</p> <h3>References</h3><p><a href=\"\" target=\"_blank\" rel=\"noopener\"></a>[1] Feraco T et al. (2023) <a href=\"https://doi.org/10.1007/s10212-022-00601-4\" target=\"_blank\" rel=\"noopener\">An integrated model of school students’ academic achievement and life satisfaction. Linking soft skills, extracurricular activities, self-regulated learning, motivation, and emotions</a>. <em>European Journal of Psychology of Education</em> <strong>38</strong>: 109–130. doi: 10.1007/s10212-022-00601-4</p> <p><a href=\"\" target=\"_blank\" rel=\"noopener\"></a>[2] Erduran S (2023). <a href=\"https://doi.org/10.1126/science.adk1509\" target=\"_blank\" rel=\"noopener\">Social and institutional dimensions of science: The forgotten components of the science curriculum?</a> <em>Science</em> <strong>381</strong>: 6659. doi: 10.1126/science.adk1509</p>"
  },
  {
    "slug": "ai-in-the-classroom",
    "kind": "original",
    "section": "Technology",
    "category": "Explainer",
    "title": "AI in the classroom: what the guidance actually says",
    "dek": "Chatbots arrived in schools faster than the rules did. A calm guide for parents and teachers to UNESCO's advice on generative AI.",
    "image": "/magazines/open-edition/01/ai-classroom.webp",
    "imageAlt": "Abstract 3D letters A and I on a blue background",
    "imageCredit": "Photo: Unsplash, Unsplash Licence",
    "dataNote": "Covers guidance published 2023 and 2024",
    "bodyHtml": "<p>When generative AI tools became widely available, students started using them for homework almost overnight. Schools and governments were left asking: is this allowed, and is it safe?</p> <p>In September 2023, UNESCO published its <i>Guidance for generative AI in education and research</i>. UN News described it as the first attempt to create a global standard for the use of generative AI in education.<sup><a href=\"#a8-s1\">1</a>,<a href=\"#a8-s2\">2</a></sup></p> <h3>What the guidance asks for</h3> <p>UNESCO called on governments to regulate the use of generative AI in education and research. Its immediate steps include:<sup><a href=\"#a8-s1\">1</a></sup></p> <ul> <li><strong>Protecting data privacy.</strong> Governments should make the protection of students' data mandatory.</li> <li><strong>An age limit.</strong> Governments should consider an age limit of 13 for using generative AI in the classroom. This is a suggestion for countries to weigh, not a fixed global rule.</li> <li><strong>Checking tools first.</strong> Schools and universities should validate AI systems for ethical and teaching suitability before students use them.</li> <li><strong>Rules for providers.</strong> The guidance sets out requirements that AI companies should meet for ethical and effective use in education.</li> </ul> <p class=\"oe-pull\">\"Generative AI can be a tremendous opportunity for human development, but it can also cause harm and prejudice.\" Audrey Azoulay, UNESCO Director-General</p> <p>UNESCO stressed that the technology \"cannot be integrated into education without public engagement, and the necessary safeguards and regulations from governments.\"<sup><a href=\"#a8-s1\">1</a></sup></p> <h3>What students and teachers should learn</h3> <p>In 2024, UNESCO followed up with two AI competency frameworks, describing what students and teachers need to know.<sup><a href=\"#a8-s3\">3</a>,<a href=\"#a8-s4\">4</a></sup></p> <figure class=\"oe-figure\"> <h4>UNESCO AI competency framework for students: four dimensions</h4> <svg viewBox=\"0 0 600 150\" role=\"img\" aria-label=\"Four boxes: human-centred mindset, ethics of AI, AI techniques and applications, AI system design\"> <g font-size=\"13.5\" font-weight=\"600\"> <rect x=\"0\" y=\"0\" width=\"292\" height=\"62\" rx=\"8\" fill=\"var(--oe-chart-a)\"/><text x=\"16\" y=\"36\" fill=\"var(--oe-paper)\">Human-centred mindset</text> <rect x=\"308\" y=\"0\" width=\"292\" height=\"62\" rx=\"8\" fill=\"var(--oe-chart-a)\"/><text x=\"324\" y=\"36\" fill=\"var(--oe-paper)\">Ethics of AI</text> <rect x=\"0\" y=\"76\" width=\"292\" height=\"62\" rx=\"8\" fill=\"var(--oe-chart-b)\"/><text x=\"16\" y=\"112\" fill=\"oklch(0.2 0.04 280)\">AI techniques and applications</text> <rect x=\"308\" y=\"76\" width=\"292\" height=\"62\" rx=\"8\" fill=\"var(--oe-chart-b)\"/><text x=\"324\" y=\"112\" fill=\"oklch(0.2 0.04 280)\">AI system design</text> </g> </svg> <figcaption>12 competencies across four dimensions, at three levels: understand, apply, create. Source: UNESCO, 2024. Illustration: Eleventh Press.</figcaption> </figure> <p>The <strong>student framework</strong>, which UNESCO describes as the first global framework of its kind, sets out 12 competencies across four dimensions. Students progress through three levels: understand, apply and create.<sup><a href=\"#a8-s3\">3</a></sup></p> <p>The <strong>teacher framework</strong> covers five dimensions: a human-centred mindset, the ethics of AI, AI foundations and applications, AI pedagogy, and the use of AI for teachers’ own professional growth. It sets out 15 competencies, and teachers progress through three levels: acquire, deepen and create.<sup><a href=\"#a8-s4\">4</a></sup></p> <h3>What this means at home and in class</h3> <p>Both frameworks start in the same place: people first, then ethics, then tools. For parents, that suggests a few simple questions. Does my child's school have a policy on AI? Do the tools it uses protect children's data? Is my child learning how these systems work, not just how to use them?</p> <p>The reprint that closes this issue shows one careful use of AI in practice: a pilot in Samoa that used AI to answer online learners' questions.</p>",
    "sources": [
      "UN News (September 2023). <a href=\"https://news.un.org/en/story/2023/09/1140477\" target=\"_blank\" rel=\"noopener\">UNESCO calls for regulations on AI use in schools</a>.",
      "UNESCO (2023). <a href=\"https://unesdoc.unesco.org/ark:/48223/pf0000386693\" target=\"_blank\" rel=\"noopener\">Guidance for generative AI in education and research</a>.",
      "UNESCO (2024). <a href=\"https://unesdoc.unesco.org/ark:/48223/pf0000391105\" target=\"_blank\" rel=\"noopener\">AI competency framework for students</a>.",
      "UNESCO (2024). <a href=\"https://doi.org/10.54675/ZJTE2084\" target=\"_blank\" rel=\"noopener\">AI competency framework for teachers</a>. Miao, F. and Cukurova, M."
    ],
    "verification": [
      {
        "claim": "Guidance published September 2023; first attempt at a global standard",
        "source": "[1] UN News",
        "status": "source",
        "note": ""
      },
      {
        "claim": "Calls on governments to regulate GenAI in education and research",
        "source": "[1] UN News",
        "status": "source",
        "note": ""
      },
      {
        "claim": "Data privacy; consider age limit of 13; validate tools; provider requirements",
        "source": "[1] UN News",
        "status": "source",
        "note": "Age limit described as something to consider"
      },
      {
        "claim": "Azoulay quote on 'tremendous opportunity… harm and prejudice'",
        "source": "[1] UN News",
        "status": "source",
        "note": "Quoted exactly"
      },
      {
        "claim": "Quote: 'cannot be integrated into education without public engagement…'",
        "source": "[1] UN News",
        "status": "source",
        "note": "Speaker not named in the source, so it is attributed to UNESCO"
      },
      {
        "claim": "Student framework: first global; 12 competencies, 4 dimensions; understand/apply/create",
        "source": "[3] UNESCO",
        "status": "document",
        "note": ""
      },
      {
        "claim": "Teacher framework: 15 competencies across 5 dimensions; acquire, deepen, create",
        "source": "[4] UNESCO",
        "status": "document",
        "note": "Checked against UNESCO's published summary and the framework record"
      },
      {
        "claim": "Links to the two UNESCO framework documents",
        "source": "[3], [4]",
        "status": "document",
        "note": "Student framework on UNESDOC; teacher framework by its DOI"
      }
    ],
    "refPrefix": "a8"
  },
  {
    "slug": "from-the-commonwealth",
    "kind": "reprint",
    "section": "Around the Commonwealth",
    "category": "Reprint",
    "title": "From the Commonwealth: Eswatini and Samoa",
    "dek": "Two short reports from the Commonwealth of Learning: open schooling goes digital in Eswatini, and an AI pilot supports online learners in Samoa.",
    "image": "/magazines/open-edition/01/commonwealth.webp",
    "imageAlt": "Pupils at their desks in a classroom, a teacher standing at the front",
    "imageCredit": "Photo: Unsplash, Unsplash Licence. Chosen by Eleventh Press.",
    "reprint": {
      "publication": "Connections, Vol 28, No 3 (2023)",
      "publisher": "Commonwealth of Learning",
      "authors": null,
      "sourceUrl": "https://openbooks.col.org/connectionsvol28no3/index.html",
      "licence": {
        "label": "CC BY-SA 4.0",
        "url": "https://creativecommons.org/licenses/by-sa/4.0/"
      },
      "notes": "Text of both items reproduced unchanged. This reprint is shared under the same licence."
    },
    "bodyHtml": "<h3>Digital media for open schooling in Eswatini</h3><p>COL is supporting the Emlalatini Development Centre (EDC), in Eswatini, to migrate from a print-based to a digital and blended model of open schooling provision.</p> <p>As part of this process, COL supported the acquisition of technical equipment to establish a media development centre, along with staff training to create digital educational media using the new equipment.</p> <p>COL noted that while the move into the virtual space represents a profound shift for EDC, it will contribute to greater resilience in the schooling system in the face of future challenges to traditional schooling, such as another pandemic or the growing incidence of climate change-related disruptions.</p><h3>Samoa pioneers AI-powered learner support</h3><p>Providing sustained, high-quality support to online learners can be challenging for small island countries of the Pacific, especially in resource-constrained situations. Yet insufficient support can impede learner progress.</p> <p>Recent advances in generative artificial intelligence (AI) could help. During the pandemic, COL research showed that up to a quarter of online learner queries are about the learning management system. In this context, AI technology such as Generative Pre-trained Transformer (GPT) offers solutions.</p> <p>COL has collaborated with the National University of Samoa to conduct a pilot project on providing online learner support using GPT-powered technology. Initial results from the pilot reveal over 85 per cent accuracy in AI-powered responses, affirming its efficacy in improving learner support.</p>"
  }
];

export const OPEN_EDITION_ISSUES: OpenEditionIssue[] = [
  {
    id: "open-edition-learning-everywhere",
    series: "Open Edition",
    volume: 1,
    issueNumber: 1,
    year: 2026,
    publishedAt: "2026-11-23",
    title: "Learning,",
    titleItalic: "everywhere",
    coverLine: "Who teaches, who learns, and what helps",
    description:
      "The inaugural issue of Open Edition: six original, fully sourced features on out-of-school children, learning poverty, the global teacher gap, home-language teaching, open textbooks and AI in schools, alongside three openly licensed reprints.",
    cover: "/magazines/open-edition/01/cover.webp",
    coverAlt: "A red apple on a stack of books",
    pdf: "/magazines/open-edition/01/open-edition-vol1-no1-learning-everywhere.pdf",
    editorsNote: [
      "Open Edition is a new kind of magazine from Eleventh Press. Each issue takes one theme and brings together two kinds of writing: original features researched and written by our editorial team, and the best openly licensed journalism from publishers who share their work with the world.",
      "Our first issue is about learning. It starts with the children the system misses, moves to the classrooms where too many still struggle to read, and ends with what helps: more teachers, teaching in the languages children speak, open textbooks anyone can adapt, and careful use of new technology.",
      "Every figure in our features links to its source, and every reprint carries its licence. At the back of the issue you will find the standards we hold ourselves to, including exactly how we use AI tools and where human editors stay accountable.",
    ],
    pieces: LEARNING_EVERYWHERE_PIECES,
  },
];

export function getOpenEditionIssue(id: string | null | undefined): OpenEditionIssue | undefined {
  return id ? OPEN_EDITION_ISSUES.find((i) => i.id === id) : undefined;
}

/** Approximate reading time in minutes (230 words a minute, at least 1). */
export function readingMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}
