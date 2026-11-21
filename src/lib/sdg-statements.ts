/**
 * Eleventh Press International Publishing™ — Official UN Sustainable
 * Development Goals (SDGs) Statement ("Institutional Policy & Global Impact
 * Framework"). Text as supplied by the publisher; shown on the
 * Sustainable Development & Global Impact page.
 */

export const SDG_STATEMENT_FACTS: { label: string; value: string }[] = [
  { label: "Publisher", value: "Eleventh Press International Publishing™" },
  { label: "Editorial office", value: "Philippines" },
  { label: "Licence standard", value: "CC BY 4.0 Open Access" },
  { label: "Scope", value: "12 Academic Disciplines & Book Division" },
  { label: "Persistent IDs", value: "Zenodo DOIs & OAI-PMH 2.0" },
  { label: "Benchmarks", value: "COPE · WAME · ICMJE · CONSORT · STM" },
];

export const SDG_DECLARATION: string[] = [
  "As a multidisciplinary, peer-reviewed open-access press spanning the natural sciences, engineering, social sciences, and humanities, Eleventh Press aligns its editorial taxonomy, metadata infrastructure, and barrier-free dissemination model with the United Nations 2030 Agenda for Sustainable Development.",
  "Every accepted article receives a permanently resolving Zenodo DOI, JATS XML archival rendering, and unrestricted global access under a Creative Commons Attribution 4.0 (CC BY 4.0) license—ensuring researchers, policymakers, educators, and communities worldwide can freely access, verify, and apply peer-reviewed evidence toward each of the 17 Sustainable Development Goals.",
];

export interface SdgStatement {
  /** Primary publishing tracks named in the statement. */
  tracks: string;
  statement: string;
}

/** Goal-by-Goal Institutional Support Matrix, keyed by goal number. */
export const SDG_STATEMENTS: Record<number, SdgStatement> = {
  1: {
    tracks: "Economics, Sociology, Business",
    statement: "Eleventh Press supports SDG 1 by publishing peer-reviewed research on poverty alleviation, social protection systems, microfinance, and inclusive economic development across its Economics, Sociology, and Business tracks. Through diamond-accessible readership—requiring zero subscriptions or login walls under CC BY 4.0 licensing—researchers, policymakers, and NGOs in low-income regions gain unrestricted access to actionable economic findings.",
  },
  2: {
    tracks: "Biology, Environmental Science, Economics",
    statement: "Eleventh Press advances SDG 2 by disseminating open-access scholarship on sustainable agriculture, crop resilience, food security supply chains, and nutrition economics. Automated syndication across scholarly repositories (Zenodo, OpenAIRE, CORE) and public knowledge platforms ensures agricultural innovations reach practitioners and rural development agencies without paywall delays.",
  },
  3: {
    tracks: "Psychology, Biology, Sociology",
    statement: "Eleventh Press promotes SDG 3 by enforcing rigorous reporting and ethical benchmarks—including ICMJE, CONSORT, and COPE standards—for research in behavioral psychology, mental health, public health sociology, and biological sciences. Rapid editorial turnaround (38-day average to first decision) accelerates the global availability of validated health and well-being scholarship.",
  },
  4: {
    tracks: "Education, Language & Literature, Psychology",
    statement: "SDG 4 is foundational to Eleventh Press's mission. Beyond maintaining a dedicated Education and Language & Literature publishing division, the press converts all accepted research into open educational resources under CC BY 4.0, enabling educators and students worldwide to freely reuse, translate, and distribute peer-reviewed knowledge and academic monographs.",
  },
  5: {
    tracks: "Sociology, Economics, Business, Education",
    statement: "Eleventh Press upholds SDG 5 both editorially and operationally. Its double-blind peer-review architecture automatically anonymizes manuscripts prior to reviewer assignment, mitigating gender and institutional bias in editorial evaluation. Additionally, the press actively publishes interdisciplinary research on gender equity, labor participation, and inclusive leadership.",
  },
  6: {
    tracks: "Environmental Science, Biology, Technology",
    statement: "Eleventh Press supports SDG 6 by providing an open-access venue for hydrological research, water purification technologies, sanitation infrastructure, and watershed management. Persistent Zenodo DOIs and JATS XML archiving preserve critical environmental datasets for long-term municipal and scientific reuse.",
  },
  7: {
    tracks: "Physics, Technology, Environmental Science, Economics",
    statement: "Eleventh Press contributes to SDG 7 by publishing peer-reviewed advancements in renewable energy physics, grid storage technologies, clean-tech engineering, and energy transition economics. Preprint packaging for arXiv and SSRN alongside immediate open-access publication speeds up knowledge transfer across the clean energy sector.",
  },
  8: {
    tracks: "Economics, Business, Technology, Sociology",
    statement: "Eleventh Press advances SDG 8 by disseminating empirical research on sustainable economic growth, labor markets, entrepreneurship, and ethical business governance. Its integrated book-publishing division enables authors to compile economic and management research into globally distributed print and EPUB editions via IngramSpark and Draft2Digital.",
  },
  9: {
    tracks: "Computer Science, Technology, Physics, Mathematics",
    statement: "Eleventh Press directly embodies SDG 9 through both its Computer Science, Technology, Physics, and Mathematics publishing tracks and its modern scholarly infrastructure. Engineered as a 9-microservice publishing ecosystem with OAI-PMH 2.0 endpoints, JATS XML rendering, and AI-assisted editorial checks, the press modernizes open-science dissemination.",
  },
  10: {
    tracks: "Sociology, Economics, Education, Language & Literature",
    statement: "Eleventh Press actively addresses SDG 10 by dismantling geographic and financial barriers to scholarly participation. Operating from its editorial office in the Philippines with a global reach, the press guarantees zero reader fees, double-blind manuscript evaluation to eliminate author prestige bias, and wide indexing across Google Scholar, BASE, and CORE.",
  },
  11: {
    tracks: "Sociology, Environmental Science, Technology, Economics",
    statement: "Eleventh Press supports SDG 11 by publishing multidisciplinary research on urban resilience, sustainable transport systems, smart city infrastructure, and community development. Automated 8-platform syndication helps translate academic urban-planning findings into accessible formats for civic leaders and public stakeholders.",
  },
  12: {
    tracks: "Business, Environmental Science, Economics, Technology",
    statement: "Eleventh Press aligns with SDG 12 by publishing research on circular economy models, sustainable supply chains, lifecycle assessment, and corporate ESG accountability. Operationally, its digital-first publishing pipeline and print-on-demand book distribution eliminate physical inventory waste and excess print runs.",
  },
  13: {
    tracks: "Environmental Science, Physics, Biology, Economics",
    statement: "Eleventh Press prioritizes SDG 13 by providing rapid, unrestricted open access to climate modeling, mitigation strategies, adaptation policy, and climate economics research. Immediate open licensing under CC BY 4.0 ensures climate findings can be cited, synthesized, and acted upon globally without licensing friction.",
  },
  14: {
    tracks: "Biology, Environmental Science",
    statement: "Eleventh Press supports SDG 14 through its Biology and Environmental Science divisions by publishing peer-reviewed studies on marine biodiversity, ocean acidification, coastal ecosystem conservation, and sustainable fisheries—leveraging permanent Zenodo DOI archiving to safeguard marine research records.",
  },
  15: {
    tracks: "Biology, Environmental Science",
    statement: "Eleventh Press advances SDG 15 by disseminating open-access scholarship on terrestrial ecology, biodiversity conservation, reforestation, and land-use sustainability. OpenAIRE and Google Scholar indexing ensures conservation biologists and land managers worldwide can discover and apply critical ecological evidence.",
  },
  16: {
    tracks: "Sociology, Economics, Language & Literature",
    statement: "Eleventh Press upholds SDG 16 by anchoring its governance in transparent publication ethics, strict data privacy rights (export and deletion), PCI-DSS compliance, and adherence to COPE, WAME, and STM standards. Editorially, the press publishes scholarship on institutional governance, public policy, social cohesion, and ethical accountability.",
  },
  17: {
    tracks: "All 12 Multidisciplinary Tracks",
    statement: "Eleventh Press operationalizes SDG 17 through an interoperable open-science ecosystem that bridges disciplines, repositories, and public communication channels. By integrating Zenodo DOI minting, OAI-PMH 2.0 metadata harvesting, 6 scholarly indexers, and 16 syndication networks, the press fosters cross-border knowledge partnerships.",
  },
};

/** UN Brand & Attribution notice (non-UN entity disclaimer). */
export const SDG_UN_DISCLAIMER = "The content of this site does not reflect the views of the United Nations or its officials or Member States.";
