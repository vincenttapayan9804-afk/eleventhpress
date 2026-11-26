/**
 * Open Resources: third-party open-access publications that Eleventh Press
 * redistributes, unmodified, under their own open licences.
 *
 * These are NOT Eleventh Press titles. They keep their original publisher,
 * rights holder, ISBN/DOI and licence, and they are shown and credited as
 * such. Every entry was transcribed from the publication's own imprint page
 * (title verso) and, where the PDF itself is silent on its licence, from the
 * publisher's or repository's own record (noted in `licenceSource`). The PDFs
 * are served as received (public/open-resources/). Covers are renderings of
 * each PDF's own first page, except where the cover may not be reused (the
 * OECD forbids reuse of its cover images; other covers carry stock or
 * third-party images whose rights are not stated). Those titles show a plain
 * Eleventh Press identification tile instead (`coverKind: "tile"`).
 *
 * Licence obligations reflected in the UI (src/components/open-resources-section.tsx):
 * - attribution to the rights holder, with the licence named and linked;
 * - the work is distributed unchanged, free of charge (required for the
 *   NonCommercial licence) and without implying UNESCO endorsement;
 * - third-party images (e.g. stock cover photos) are flagged as outside
 *   the licence, exactly as the publication itself states;
 * - covers whose image belongs to a third party carry `coverRights`: an
 *   explicit copyright attribution to the owner plus a restrictions notice
 *   for readers. Where the publication does not state the image's licence,
 *   it is treated as all rights reserved (the conservative reading);
 * - each publisher's own terms of use are linked (`terms`), and NonCommercial
 *   titles are offered free of charge only.
 */

export type OpenLicence = {
  code: string;
  name: string;
  url: string;
};

/** A cover image whose copyright belongs to a third party, not the publisher. */
export type CoverRights = {
  /** Short attribution for the card, e.g. "© Sylvie Serprix". */
  label: string;
  /** The credit line exactly as printed in the publication. */
  printedCredit: string;
  /** Who holds the copyright. */
  owner: string;
  /** Why the image sits outside the open licence (quoting the publisher where it says so). */
  basis: string;
};

export type OpenResource = {
  slug: string;
  title: string;
  subtitle?: string;
  series?: string;
  type: string;
  category: string;
  creators: string;
  publisher: string;
  year: number;
  pages: number;
  fileSizeMb: number;
  language: string;
  isbn?: string;
  issn?: string;
  doi?: string;
  reportCode?: string;
  sourceUrl: string;
  licence: OpenLicence;
  rightsHolder: string;
  coverCredit: string;
  coverRights?: CoverRights;
  thirdPartyNotice?: string;
  /** Publisher's open-access terms page, when it differs from UNESCO_OA_TERMS_URL. */
  termsUrl?: string;
  /**
   * The publisher's own terms of use for its open-access works. Left out for
   * UNESCO titles (the UNESCO Open Access terms apply); `null` when the
   * publisher states none beyond the licence.
   */
  terms?: { label: string; url: string } | null;
  /** Publishing organisation, for filtering; defaults to UNESCO. */
  org?: string;
  /** Where the licence is stated, when not on the PDF's own imprint page. */
  licenceSource?: string;
  /** For a part of a larger work, e.g. a single chapter: what it is taken from. */
  extractOf?: string;
  /**
   * "publisher" when the PDF is not redistributed by Eleventh Press and
   * `pdfPath` is the publisher's own download URL (used where the publisher's
   * terms restrict elements printed in the PDF, such as its cover image).
   */
  pdfHost?: "local" | "publisher";
  /** "tile" when the original cover may not be shown and an Eleventh Press identification tile is used. */
  coverKind?: "original" | "tile";
  funding?: string;
  summary: string;
  description: string[];
  highlights: string[];
  audience: string;
  citation: string;
  pdfPath: string;
  coverPath: string;
};

const CC_BY_SA_3_IGO: OpenLicence = {
  code: "CC BY-SA 3.0 IGO",
  name: "Creative Commons Attribution-ShareAlike 3.0 IGO",
  url: "https://creativecommons.org/licenses/by-sa/3.0/igo/",
};

const CC_BY_NC_SA_4_IGO: OpenLicence = {
  code: "CC BY-NC-SA 4.0 IGO",
  name: "Creative Commons Attribution-NonCommercial-ShareAlike 4.0 IGO",
  url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

const CC_BY_4: OpenLicence = {
  code: "CC BY 4.0",
  name: "Creative Commons Attribution 4.0 International",
  url: "https://creativecommons.org/licenses/by/4.0/",
};

const CC_BY_3_IGO: OpenLicence = {
  code: "CC BY 3.0 IGO",
  name: "Creative Commons Attribution 3.0 IGO",
  url: "https://creativecommons.org/licenses/by/3.0/igo/",
};

const CC_BY_NC_3_IGO: OpenLicence = {
  code: "CC BY-NC 3.0 IGO",
  name: "Creative Commons Attribution-NonCommercial 3.0 IGO",
  url: "https://creativecommons.org/licenses/by-nc/3.0/igo/",
};

const CC_BY_SA_3: OpenLicence = {
  code: "CC BY-SA 3.0",
  name: "Creative Commons Attribution-ShareAlike 3.0",
  url: "https://creativecommons.org/licenses/by-sa/3.0/",
};

const CC_BY_NC: OpenLicence = {
  code: "CC BY-NC",
  name: "Creative Commons Attribution-NonCommercial",
  url: "https://creativecommons.org/licenses/by-nc/4.0/",
};

const CC_BY_NC_ND_3: OpenLicence = {
  code: "CC BY-NC-ND 3.0",
  name: "Creative Commons Attribution-NonCommercial-NoDerivs 3.0 Unported",
  url: "https://creativecommons.org/licenses/by-nc-nd/3.0/",
};

const CC_BY_NC_ND_4: OpenLicence = {
  code: "CC BY-NC-ND 4.0",
  name: "Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International",
  url: "https://creativecommons.org/licenses/by-nc-nd/4.0/",
};

const CC_BY_SA_4: OpenLicence = {
  code: "CC BY-SA 4.0",
  name: "Creative Commons Attribution-ShareAlike 4.0 International",
  url: "https://creativecommons.org/licenses/by-sa/4.0/",
};

export const UNESCO_OA_TERMS_URL = "https://www.unesco.org/en/open-access/cc-sa";

const OECD_TERMS = { label: "OECD terms and conditions", url: "https://www.oecd.org/en/about/terms-conditions.html" };
const WORLD_BANK_TERMS = { label: "World Bank Open Knowledge Repository terms of use", url: "https://openknowledge.worldbank.org/pages/terms-of-use" };
const COL_TERMS = { label: "Commonwealth of Learning Open Access Repository (OASIS)", url: "https://oasis.col.org" };

/** The OECD's own licence condition, printed on each OECD title's imprint page. */
const OECD_NOTICE =
  "Per the OECD's licence conditions, the CC BY 4.0 licence does not apply to third-party material in the work, and the OECD logo, visual identity and cover image may not be used without the OECD's express permission. For that reason Eleventh Press does not redistribute this PDF: the download links go to the OECD's own copy, and a plain identification tile stands in for the cover. No OECD endorsement of Eleventh Press is suggested or implied.";

const WORLD_BANK_NOTICE =
  "Per the World Bank, it does not necessarily own each component of the content in the work (such as tables, figures or images); the licence does not warrant that reusing a third-party component will not infringe its owner's rights, and permission for such reuse must be sought from that owner.";

/** Shown for titles whose cover is replaced by an Eleventh Press identification tile. */
export const TILE_COVER_CREDIT =
  "Identification tile designed by Eleventh Press. The publication's original cover is not reproduced on this page.";

const unesdoc = (id: string) => `https://unesdoc.unesco.org/ark:/48223/pf0000${id}`;

export const OPEN_RESOURCES: OpenResource[] = [
  {
    slug: "sdg4-scorecard-2026",
    title: "SDG 4 Scorecard",
    subtitle: "Progress Report on National Benchmarks — Focus on Completion Rates",
    series: "SDG 4 Scorecard, 4th edition",
    type: "Report",
    category: "Education statistics",
    creators: "UNESCO Institute for Statistics (UIS) and the Global Education Monitoring (GEM) Report",
    publisher: "UNESCO Institute for Statistics, Montreal, and Global Education Monitoring Report, Paris",
    year: 2026,
    pages: 141,
    fileSizeMb: 2.6,
    language: "English",
    isbn: "978-92-9189-356-0",
    doi: "10.54676/HAMS6403",
    sourceUrl: unesdoc("397943"),
    licence: CC_BY_SA_3_IGO,
    rightsHolder: "© UNESCO-UIS 2026",
    coverCredit: "Cover design by Big Yellow Taxi, Inc.; graphic design, illustrations and typesetting by UNESCO.",
    summary:
      "The fourth annual check on whether countries are on track to reach the education targets they set for themselves for 2025 and 2030, with a special focus on school completion.",
    description: [
      "Rather than measuring every country against a single global target of 100%, the SDG 4 Scorecard tracks progress against the national benchmarks that countries themselves have set on eight education indicators: early childhood participation, out-of-school and completion rates, minimum learning proficiency, gender equity, trained teachers, education spending and school connectivity.",
      "As of 2026, 170 countries (83%) have set national targets, up from 58% in 2021. The report finds faster progress than expected in primary and lower secondary completion, but upper secondary completion is on track in only about one in five countries, learning outcomes and data coverage remain the deepest concerns, and only 19 countries meet both education financing benchmarks.",
      "This edition's focus on completion rates explains an apparent paradox: completion has risen steadily since 1990 even as out-of-school rates stagnated, largely because repetition has fallen. It closes with an extract from the 2026 Global Education Monitoring Report on the policy levers available to raise completion.",
    ],
    highlights: [
      "Country-by-country progress assessments against national 2025 and 2030 targets",
      "Completion-rate trends by region and income group since 1990",
      "Institutional, demand-side and supply-side policies that explain differences in completion",
      "Annexes listing each country's submitted benchmark values",
    ],
    audience: "Education ministries, statisticians, development partners, researchers and advocates monitoring SDG 4.",
    citation:
      "UNESCO Institute for Statistics and Global Education Monitoring Report. 2026. SDG 4 Scorecard: Progress Report on National Benchmarks — Focus on Completion Rates. Montreal: UIS; Paris: GEM Report. https://doi.org/10.54676/HAMS6403",
    pdfPath: "/open-resources/sdg4-scorecard-2026.pdf",
    coverPath: "/open-resources/covers/sdg4-scorecard-2026.webp",
  },
  {
    slug: "engaging-civil-society-education-policy",
    title: "Engaging Civil Society Organizations in the Education Policy Cycle",
    subtitle: "Evidence and Lessons Learned",
    type: "Edited volume",
    category: "Education policy & planning",
    creators:
      "Edited by Muriel Poisson. Contributors: Solène Burtz; Avani Kapur, Sidharth Santhosh and Pritika Malhotra; Johanna Marie Astrid Sister, May Rendon-Cinco, Maria Fatima Villena, Magnolia Eva Jacinto-Escobedo and Janice Tapil",
    publisher: "UNESCO International Institute for Educational Planning (IIEP), Paris; Global Partnership for Education (GPE) Education Out Loud",
    year: 2026,
    pages: 192,
    fileSizeMb: 2.8,
    language: "English",
    isbn: "978-92-803-1478-6",
    doi: "10.54673/ZHOX5913",
    sourceUrl: unesdoc("400087"),
    licence: CC_BY_NC_SA_4_IGO,
    rightsHolder: "© UNESCO / GPE EOL 2026",
    coverCredit: "Cover photo: Shutterstock. Typesetting: Suzanne Grossmann.",
    coverRights: {
      label: "Cover photo: Shutterstock",
      printedCredit: "Cover photo: Shutterstock",
      owner: "The contributing photographer, licensed through Shutterstock, Inc. (contributor not named in the publication)",
      basis:
        "A licensed stock photograph. Stock images are licensed to the publisher for its own use; the publication's Creative Commons licence does not and cannot extend to them.",
    },
    funding: "Funded by Education Out Loud (GPE), with IIEP-UNESCO as Global Learning Partner.",
    summary:
      "How civil society organizations can help shape, finance and monitor education policy, drawn from evidence across GPE partner countries, India and the Philippines.",
    description: [
      "Education reforms are more legitimate and more likely to succeed when they are planned with, not just for, the communities they serve. This edited volume from IIEP-UNESCO examines how civil society organizations (CSOs) contribute across the whole policy cycle: planning, budgeting, implementation and monitoring.",
      "Part 1 studies CSOs in Local Education Groups (LEGs) across GPE partner countries, drawing on survey responses from 25 CSOs in 21 countries and case studies from Cameroon, Indonesia and Zimbabwe. Part 2 shows how Indian CSOs are reshaping education finance, from costing early childhood education to school-level budget oversight. Part 3 traces government–civil society partnerships in the Philippines, including the Alternative Learning System, the Last Mile Schools Program and school child-protection systems.",
      "Across all three, the book identifies what makes engagement work (clear mandates, access to fiscal data, trust built through sustained, non-confrontational advocacy) and what holds it back, particularly in contexts of shrinking civic space.",
    ],
    highlights: [
      "Nine case studies from Cameroon, Indonesia, Zimbabwe, India and the Philippines",
      "Mapping of CSO roles against the full education budget cycle",
      "Philippine case studies with DepEd, E-Net Philippines and Social Watch Philippines",
      "Practical recommendations for governments, CSOs and funders",
    ],
    audience: "Education planners, ministries, civil society coalitions, funders and researchers in education governance.",
    citation:
      "Poisson, M. (ed). 2026. Engaging civil society organizations in the education policy cycle. Evidence and lessons learned. Paris: IIEP-UNESCO; Washington DC: Global Partnership for Education (GPE) Education Out Loud (EOL). https://doi.org/10.54673/ZHOX5913",
    pdfPath: "/open-resources/engaging-civil-society-education-policy.pdf",
    coverPath: "/open-resources/covers/engaging-civil-society-education-policy.webp",
  },
  {
    slug: "unesco-courier-2026-4",
    title: "The UNESCO Courier: UNESCO at 80",
    subtitle: "October–December 2026 (No. 4)",
    series: "The UNESCO Courier, published since 1948",
    type: "Magazine issue",
    category: "Culture, science & society",
    creators: "UNESCO. Editor-in-Chief: Agnès Bardon",
    publisher: "United Nations Educational, Scientific and Cultural Organization (UNESCO), Paris",
    year: 2026,
    pages: 56,
    fileSizeMb: 4.0,
    language: "English",
    issn: "2220-2285 (print); 2220-2293 (online)",
    sourceUrl: unesdoc("399990"),
    licence: CC_BY_SA_3_IGO,
    rightsHolder: "© UNESCO 2026",
    coverCredit: "Cover illustration: © Sylvie Serprix. Design: Jacqueline Gensollen-Bloch.",
    coverRights: {
      label: "Cover illustration © Sylvie Serprix",
      printedCredit: "Cover illustration: © Sylvie Serprix",
      owner: "Sylvie Serprix (illustrator)",
      basis:
        "The publisher states that the open licence “applies exclusively to the texts” and that “for the use of images, prior permission shall be requested”.",
    },
    thirdPartyNotice:
      "Per the publisher, the open licence applies exclusively to the texts of this issue. All photographs and illustrations inside the magazine are likewise excluded and require prior permission from their rights holders for any separate use.",
    summary:
      "A special anniversary issue marking 80 years since UNESCO's Constitution entered into force, told through the people and places its work has touched.",
    description: [
      "UNESCO's flagship quarterly marks the Organization's 80th anniversary with a wide-ranging look at what international cooperation in education, science and culture has achieved, and where it must go next.",
      "It opens with an interview with Director-General Khaled El-Enany, then moves through four sections. Changing Lives follows people such as Kewé Ndiaye, a graduate of a UNESCO literacy programme in Dakar who now runs her own sewing workshop, and Iraqi investigative reporter Mai Al-Ani, who took a stand against online harassment. Moving Beyond covers living heritage from Norway to Congolese rumba and Shenzhen's reading culture. Joining Forces looks at cooperation from the Guarani Aquifer to theoretical physics in Trieste. Looking Forward takes in reconstruction in Yemen, justice in the age of algorithms, and protecting the human mind from neurotechnology.",
    ],
    highlights: [
      "Interview: “UNESCO's compass is human dignity” with Khaled El-Enany",
      "The Guarani Aquifer as a model of shared water governance",
      "Rebuilding with communities in Yemen",
      "Ethics at the frontier: algorithms in justice and protecting our “brain power”",
    ],
    audience: "General readers, students, educators and anyone interested in international cooperation and culture.",
    citation:
      "UNESCO. 2026. The UNESCO Courier, October–December 2026, No. 4: UNESCO at 80. Paris: UNESCO. ISSN 2220-2293.",
    pdfPath: "/open-resources/unesco-courier-2026-4.pdf",
    coverPath: "/open-resources/covers/unesco-courier-2026-4.webp",
  },
  {
    slug: "open-solutions-brief-03-right-to-know",
    title: "The Right to Know",
    subtitle: "Open Knowledge Ecosystems and AI",
    series: "Open Solutions Brief Series, No. 03",
    type: "Policy brief",
    category: "Open knowledge & AI policy",
    creators:
      "Principal author: Dr Javiera Atenas (University of Suffolk). Series managed by Zeynep Varoglu; production overseen by Eleni Boursinou, UNESCO Communication and Information Sector",
    publisher: "United Nations Educational, Scientific and Cultural Organization (UNESCO), Paris",
    year: 2026,
    pages: 29,
    fileSizeMb: 1.1,
    language: "English",
    reportCode: "CI/DPT/UAI/12",
    sourceUrl: unesdoc("399308"),
    licence: CC_BY_SA_3_IGO,
    rightsHolder: "© UNESCO 2026",
    coverCredit: "Cover credits: Curated Lifestyle on Unsplash. Graphic design: UNESCO.",
    coverRights: {
      label: "Cover photo © Curated Lifestyle / Unsplash",
      printedCredit: "Cover credits: Curated Lifestyle on Unsplash",
      owner: "Curated Lifestyle (photographer), published via Unsplash",
      basis:
        "A photograph published under the Unsplash Licence, not under Creative Commons. The photographer retains copyright, and the publication's CC BY-SA licence does not extend to it.",
    },
    thirdPartyNotice:
      "Per the publisher, the Shutterstock image in this publication is not covered by the CC BY-SA licence and may not be used or reproduced separately without the copyright holder's permission.",
    summary:
      "A policy brief on connecting Open Educational Resources, Open Access, Open Science, Open Data and open-source software, so that publicly funded knowledge stays a public good as AI reshapes how knowledge is made and shared.",
    description: [
      "Access to knowledge is essential to equitable participation in a digital society. This brief argues that the open movements (OER, Open Access, Open Science, Open Data and Free and Open Source Software) are strongest when they are governed together through shared policies, infrastructure and standards rather than in separate silos.",
      "Grounded in the UNESCO 2019 Recommendation on OER, the Recommendation on Open Science and the Global Digital Compact, it identifies the main gaps (fragmented policy, weak legal frameworks, low capacity, and AI adoption that sidesteps openness) and sets out how integrated open policies can protect authorship, licensing, human rights and digital sovereignty in the age of AI.",
    ],
    highlights: [
      "Five policy recommendations, from open licensing to AI procurement",
      "FAIR, TRUST and CARE principles for data stewardship",
      "OER as a catalyst for AI capacity-building",
      "An action matrix for stakeholders, plus a glossary of key terms",
    ],
    audience: "Policymakers, university leaders, librarians, educators and technologists working on open knowledge and AI.",
    citation:
      "Atenas, J. 2026. The Right to Know: Open Knowledge Ecosystems and AI. Open Solutions Brief 03 (CI/DPT/UAI/12). Paris: UNESCO.",
    pdfPath: "/open-resources/open-solutions-brief-03-right-to-know.pdf",
    coverPath: "/open-resources/covers/open-solutions-brief-03-right-to-know.webp",
  },
  {
    slug: "open-solutions-brief-04-diamond-open-access",
    title: "Unlocking Knowledge",
    subtitle: "Diamond Open Access Publishing",
    series: "Open Solutions Brief Series, No. 04",
    type: "Policy brief",
    category: "Scholarly publishing",
    creators:
      "Principal author: Dr Johan Rooryck (Leiden University; European Diamond Capacity Hub, OPERAS), with inputs from Dr David Oliva Uribe. Series managed by Zeynep Varoglu, UNESCO Communication and Information Sector",
    publisher: "United Nations Educational, Scientific and Cultural Organization (UNESCO), Paris",
    year: 2026,
    pages: 21,
    fileSizeMb: 0.9,
    language: "English",
    reportCode: "CI/DPT/UAI/13",
    sourceUrl: unesdoc("399309"),
    licence: CC_BY_SA_3_IGO,
    rightsHolder: "© UNESCO 2026",
    coverCredit: "Cover credits: NorthSky Films/shutterstock.com. Graphic design: UNESCO.",
    coverRights: {
      label: "Cover © NorthSky Films / Shutterstock",
      printedCredit: "Cover credits: NorthSky Films/shutterstock.com",
      owner: "NorthSky Films, licensed through Shutterstock, Inc.",
      basis:
        "The publisher states that the “Shutterstock image does not fall under the CC-BY-SA license and may not be used or reproduced without the prior permission of the copyright holder”.",
    },
    summary:
      "A practical policy guide to Diamond Open Access: scholarly publishing with no fees for readers or authors, built on shared infrastructure and community governance.",
    description: [
      "Diamond Open Access treats research as a digital public good: nobody pays to read and nobody pays to publish. Running mostly on non-profit, academy-led infrastructure, it already spans more than 20,000 journals across Africa, Europe and Latin America (ALMASI project count).",
      "This brief explains why publicly funded research is not always publicly accessible, what Diamond OA needs to be sustainable (publishing workflows, specialist infrastructure, multilingual support and coordinated capacity) and how it connects to OER, Open Data and open research software. It ends with strategic recommendations on policy and funding, governance and sustainability, and international cooperation, plus a stakeholder action matrix.",
    ],
    highlights: [
      "Why multilingual publishing matters to equitable access",
      "Infrastructure map, from Crossref, ORCID and DOAJ to OpenAlex",
      "Recommendations for funders, ministries, universities and libraries",
      "A stakeholder action matrix for strengthening Diamond OA",
    ],
    audience: "Research funders, university presses, journal editors, librarians and science policymakers.",
    citation:
      "Rooryck, J. 2026. Unlocking Knowledge: Diamond Open Access Publishing. Open Solutions Brief 04 (CI/DPT/UAI/13). Paris: UNESCO.",
    pdfPath: "/open-resources/open-solutions-brief-04-diamond-open-access.pdf",
    coverPath: "/open-resources/covers/open-solutions-brief-04-diamond-open-access.webp",
  },
  {
    slug: "education-and-justice-2026",
    title: "Education and Justice",
    subtitle: "Learning to Build Just Societies",
    series: "Global Education Monitoring Report, 2026",
    type: "Report",
    category: "Education, justice & SDG 16",
    creators:
      "Global Education Monitoring (GEM) Report and Namati. Led by Priyadarshani Joshi (GEM Report) and Abigail Moy (Namati) under the overall guidance of Manos Antoninis; edited by Andy Quan",
    publisher:
      "United Nations Educational, Scientific and Cultural Organization (UNESCO), Paris, and Namati, Washington DC",
    year: 2026,
    pages: 69,
    fileSizeMb: 2.4,
    language: "English",
    isbn: "978-92-3-100868-9",
    doi: "10.54676/TPMN5922",
    sourceUrl: unesdoc("398170"),
    licence: CC_BY_SA_3_IGO,
    rightsHolder: "© UNESCO / Namati 2026",
    coverCredit: "Photo credit: © BRAC*. Illustrations by Toby Morris. Graphic design and layout by UNESCO.",
    coverRights: {
      label: "Cover photo © BRAC",
      printedCredit: "Photo credit: © BRAC*",
      owner: "BRAC",
      basis:
        "The publisher marks this photo with an asterisk and states that “images marked with an asterisk (*) do not fall under the CC-BY-SA license and may not be used or reproduced without the prior permission of the copyright holders”.",
    },
    thirdPartyNotice:
      "Per the publisher, any image in this report marked with an asterisk (*) is excluded from the CC BY-SA licence and may not be used or reproduced without the prior permission of its copyright holder.",
    funding:
      "The GEM Report is an independent annual publication funded by governments, multilateral agencies and private foundations, and facilitated and supported by UNESCO.",
    summary:
      "How justice can be achieved in, for and through education, and why people-centred justice needs a legally empowered public. The third GEM Report paper on education's links with the other SDGs.",
    description: [
      "Around 1.4 billion people face barriers to resolving everyday legal problems, and by one measure the rule of law has weakened in more than half of all countries. Prepared by the Global Education Monitoring Report with Namati, the global legal-empowerment organization that convenes the Grassroots Justice Network, this paper examines the two-way relationship between quality education (SDG 4) and peaceful, just and inclusive societies (SDG 16).",
      "Justice in education: the right to education is written into 82% of national constitutions but can be enforced in court in only 55% of countries, 273 million children and young people are out of school, and some 260,000 children are held in detention. Education in justice: more schooling builds trust in institutions, strengthens people's ability to deal with legal problems and lowers crime. In Sweden, each extra year of schooling cut the likelihood of a violent-crime conviction by 10%. Yet only 2.5% of the 2,257 peace agreements signed since 1990 mention the right to education.",
      "The report then examines what schools, universities and non-formal programmes teach about rights, peace and the law; how judges, prosecutors, lawyers, community paralegals, police and prison officers are trained; and the data gaps that hide these links. Testimonials from organizations in Argentina, Kenya, the Philippines (SALIGAN) and Canada show the work on the ground.",
    ],
    highlights: [
      "Key messages on “justice in education” and “education in justice”, with global data",
      "Curricula, teacher training and whole-school approaches to teaching justice",
      "Community paralegals: in India, Kenya and Myanmar, 84% of people reported deeper legal knowledge after working with them",
      "Recommendations, from legal education in schools to monitoring SDG 4 and SDG 16 together",
    ],
    audience:
      "Education and justice ministries, teachers and teacher educators, legal-aid and civil society organizations, law schools and researchers working on SDG 4 and SDG 16.",
    citation:
      "UNESCO and Namati. 2026. Education and justice: Learning to build just societies. Paris: UNESCO. https://doi.org/10.54676/TPMN5922",
    pdfPath: "/open-resources/education-and-justice-2026.pdf",
    coverPath: "/open-resources/covers/education-and-justice-2026.webp",
  },
  {
    slug: "state-of-education-asean-2026",
    title: "The State of Education in ASEAN",
    type: "Regional report",
    category: "Education statistics & policy",
    creators:
      "UNESCO Institute for Statistics (UIS), in coordination with the ASEAN Secretariat and the ASEAN Senior Officials Meeting on Education (SOM-ED)",
    publisher: "UNESCO Institute for Statistics, Montreal",
    year: 2026,
    pages: 216,
    fileSizeMb: 9.1,
    language: "English",
    isbn: "978-92-9189-366-9",
    reportCode: "UIS/2026/ED/RR/22",
    sourceUrl: unesdoc("399552"),
    licence: CC_BY_SA_3_IGO,
    rightsHolder: "© UNESCO-UIS 2026",
    coverCredit: "Cover image: designer Rafiya. Design and typeset: Narisara Saisanguansat.",
    coverRights: {
      label: "Cover image: designer Rafiya",
      printedCredit: "Cover image: designer Rafiya",
      owner: "Rafiya (designer)",
      basis:
        "The cover artwork is credited to an outside designer, and the publication does not say that it is released under the open licence. Eleventh Press therefore treats it as all rights reserved by its creator.",
    },
    funding:
      "Produced with financial support from the United Kingdom's Foreign, Commonwealth & Development Office (FCDO), through the UK Mission to ASEAN and the ASEAN–UK Supporting the Advancement of Girls' Education (SAGE) Programme.",
    summary:
      "The first ASEAN-wide analysis of education across the whole learning continuum, from early childhood to adult learning, prepared to shape the region's post-2025 education agenda.",
    description: [
      "Commissioned under the ASEAN Work Plan on Education 2021–2025 and developed principally by the UNESCO Institute for Statistics, this report takes stock of education in the 11 ASEAN Member States. It combines internationally comparable data from UIS, ASEANstats, the World Bank and national statistical authorities with policy analysis, case studies and regional consultations.",
      "Its central finding is that ASEAN is shifting from expanding access to improving learning. Participation has grown at every level, but upper secondary education now accounts for more than half of out-of-school adolescents and youth, foundational literacy and numeracy remain the most urgent challenge, and provision for children under 3 is extremely limited. Women remain under-represented in STEM, adult participation in skills development is very low, and public education spending has stagnated in many countries.",
      "Chapters cover early childhood, basic and higher education, TVET, adult literacy, learning environments and climate resilience, teachers and financing, followed by an equity analysis of the most marginalized learners and a review of progress against national SDG 4 benchmarks. It ends with strategic directions for the ASEAN Work Plan 2026–2030, including ethical and equitable use of artificial intelligence in education.",
    ],
    highlights: [
      "A sector-wide review from early childhood to lifelong learning, with country data",
      "Equity analysis by income, gender, location, disability, migration status and ethnicity",
      "Progress of ASEAN countries toward their 2025 national SDG 4 benchmarks",
      "Ten strategic directions for ASEAN's post-2025 education agenda",
    ],
    audience:
      "ASEAN education ministries and senior officials, statisticians, development partners, researchers and advocates across Southeast Asia, including the Philippines.",
    citation:
      "UNESCO Institute for Statistics. 2026. The State of Education in ASEAN (UIS/2026/ED/RR/22). Montreal: UIS.",
    pdfPath: "/open-resources/state-of-education-asean-2026.pdf",
    coverPath: "/open-resources/covers/state-of-education-asean-2026.webp",
  },
  {
    slug: "universities-lifelong-learning-inclusive-societies",
    title: "Universities Driving Lifelong Learning for Inclusive Societies",
    subtitle: "Practical Approaches to Supporting Learning in Later Life and Promoting Community Engagement",
    type: "Case-study collection",
    category: "Higher education & lifelong learning",
    creators:
      "UNESCO Institute for Lifelong Learning (UIL), with Shanghai Open University. Part 1 led by Mo Wang, co-edited by Tanya Zubrzycki and Hugo-Henrik Hany Hachem; Part 2 led by Edith Hammer and Nora Lorenz; overall supervision by Raúl Valdés-Cotera",
    publisher: "UNESCO Institute for Lifelong Learning, Hamburg",
    year: 2026,
    pages: 174,
    fileSizeMb: 7.0,
    language: "English",
    isbn: "978-92-820-1265-9",
    sourceUrl: unesdoc("399861"),
    licence: CC_BY_SA_3_IGO,
    rightsHolder: "© UNESCO 2026",
    termsUrl: "https://www.unesco.org/en/open-access/creative-commons?hub=779",
    coverCredit: "Cover photograph: Wavebreakmedia / Shutterstock.com. Copyediting: Hannah Mowat. Design: Teresa Boese.",
    coverRights: {
      label: "Cover © Wavebreakmedia / Shutterstock",
      printedCredit: "Cover photograph: Wavebreakmedia / Shutterstock.com",
      owner: "Wavebreakmedia, licensed through Shutterstock, Inc.",
      basis:
        "A licensed stock photograph. Stock images are licensed to the publisher for its own use; the publication's Creative Commons licence does not and cannot extend to them.",
    },
    thirdPartyNotice:
      "Photographs inside the publication are credited to Shutterstock contributors, the American University of Beirut and SETBI. These are third-party images, not covered by the open licence; they may not be reused separately without their copyright holders' permission.",
    summary:
      "Twelve case studies on how universities open their doors to older learners and work with marginalized communities, from Lagos and Beirut to Davao City.",
    description: [
      "Populations are ageing, inequalities are widening and labour markets are being reshaped by digitalization and AI. This publication from the UNESCO Institute for Lifelong Learning shows how universities are taking on a broader mission: making lifelong learning a reality for people of all ages and backgrounds, not only for traditional students.",
      "Part 1 looks at learning in later life through six universities: the University of Lagos (Nigeria), the American University of Beirut's University for Seniors (Lebanon), the Elder Academy at The Education University of Hong Kong (China), Dublin City University's age-friendly initiative (Ireland), Arizona State University (United States) and the Active Ageing Programme at the Universidade Federal de Minas Gerais (Brazil). It shows that older adults learn for intellectual enrichment, social connection, well-being and work.",
      "Part 2 turns to community engagement with groups facing structural disadvantage: women's participation at Ahfad University for Women (Sudan), rural outreach by Gulu University (Uganda), refugee integration at Kiel University (Germany), peace-building at the University of Ibagué (Colombia), education for persons deprived of liberty in Davao City Jail by the University of Southeastern Philippines, and Indigenous partnerships at the University of Victoria (Canada). Each part closes with a cross-case synthesis and recommendations.",
    ],
    highlights: [
      "Six case studies on older learners in higher education across five continents",
      "Six community-engagement case studies, including the University of Southeastern Philippines",
      "Synthesis of what makes later-life and community programmes inclusive and sustainable",
      "Recommendations for universities and policymakers on lifelong learning",
    ],
    audience:
      "University leaders, extension and continuing-education offices, policymakers, adult educators and researchers in higher education and lifelong learning.",
    citation:
      "UNESCO Institute for Lifelong Learning. 2026. Universities driving lifelong learning for inclusive societies: Practical approaches to supporting learning in later life and promoting community engagement. Hamburg: UIL.",
    pdfPath: "/open-resources/universities-lifelong-learning-inclusive-societies.pdf",
    coverPath: "/open-resources/covers/universities-lifelong-learning-inclusive-societies.webp",
  },
  {
    slug: "red-teaming-ai-social-good-playbook",
    title: "Red Teaming Artificial Intelligence for Social Good",
    subtitle: "The PLAYBOOK",
    type: "Practical guide",
    category: "AI ethics & gender equality",
    creators:
      "Dr Rumman Chowdhury, Theodora Skeadas, Dhanya Lakshmi and Sarah Amos (Humane Intelligence). Edited by Danielle Cliche and Sinéad Andrews (UNESCO Division for Gender Equality)",
    publisher: "United Nations Educational, Scientific and Cultural Organization (UNESCO), Paris",
    year: 2025,
    pages: 36,
    fileSizeMb: 2.3,
    language: "English",
    isbn: "978-92-3-100758-3",
    doi: "10.63813/MDVH6041",
    sourceUrl: unesdoc("394338"),
    licence: CC_BY_SA_3_IGO,
    rightsHolder: "© UNESCO 2025",
    coverCredit:
      "Cover credits: © Mara Dindeal. Graphic design and layout: Anna Mortreux and Barbara Osmond (mot.tiff).",
    coverRights: {
      label: "Cover © Mara Dindeal",
      printedCredit: "Cover credits: © Mara Dindeal",
      owner: "Mara Dindeal (artist)",
      basis:
        "The publication credits the cover artwork with the artist's own copyright notice, separate from UNESCO's. Eleventh Press therefore treats it as reserved to the artist and not covered by the open licence.",
    },
    summary:
      "A step-by-step guide that lets organizations and communities, not just AI labs, test generative AI for stereotypes, bias and technology-facilitated gender-based violence.",
    description: [
      "Red Teaming means deliberately probing a generative AI model to expose its flaws. Until now it has mostly happened behind closed doors at major tech companies. This playbook builds on a Red Teaming exercise UNESCO ran with Humane Intelligence for the International Day for the Elimination of Violence against Women, and opens the method to anyone. No additional IT skills are needed.",
      "It separates two kinds of risk. Unintended harms happen when biased training data leads a model to reproduce stereotypes. Intended malicious attacks happen when bad actors use AI to automate harassment, such as deepfakes or smear campaigns. It then explains how to set up a coordination group, choose between expert and public Red Teaming, pick an in-person, online or hybrid format, and protect participants' psychological safety.",
      "Two worked examples show the method in action. In the first, a fill-in-the-blank prompt shows a model describing a girl's maths aptitude more conditionally than a boy's with an identical record. In the second, a request framed as “storytelling” gets a model to produce insults about a woman journalist, translated into several languages. The guide closes with advice on analysing results, reporting to model owners and policymakers, and overcoming common objections, plus a ready-to-use sample report template.",
    ],
    highlights: [
      "Roles for subject experts, facilitators, technical evaluators and senior leaders",
      "Expert vs public Red Teaming, and in-person, online and hybrid formats",
      "Prompt templates for testing gender bias and safety guardrails",
      "Tips for analysing results, from spreadsheets to NLP tools, plus a sample report template",
    ],
    audience:
      "Civil society organizations, educators and students, researchers, policymakers, AI practitioners, artists and citizen scientists. No technical background is required.",
    citation:
      "Chowdhury, R., Skeadas, T., Lakshmi, D. and Amos, S. 2025. Red Teaming Artificial Intelligence for Social Good: The PLAYBOOK. D. Cliche and S. Andrews (eds). Paris: UNESCO. https://doi.org/10.63813/MDVH6041",
    pdfPath: "/open-resources/red-teaming-ai-social-good-playbook.pdf",
    coverPath: "/open-resources/covers/red-teaming-ai-social-good-playbook.webp",
  },
  {
    slug: "mhpss-ukrainian-scientists-2026",
    title: "Mental Health and Psychosocial Support of Ukrainian Scientists and Researchers",
    type: "Research report",
    category: "Science, well-being & crisis response",
    creators:
      "FAMA Research agency: Mariana Malachivska-Danchak, Bohdana Borushchak, Sofiia Prokopiv and Nazar Pashko. UNESCO coordination: Veronika Yurchuk and Olena Tsyplitska",
    publisher: "United Nations Educational, Scientific and Cultural Organization (UNESCO), Paris",
    year: 2026,
    pages: 51,
    fileSizeMb: 5.2,
    language: "English",
    isbn: "978-92-3-100905-1",
    doi: "10.54677/TUQW9737",
    sourceUrl: unesdoc("399597"),
    licence: CC_BY_SA_3_IGO,
    rightsHolder: "© UNESCO 2026",
    coverCredit:
      "Cover photos: © UNESCO / Vlad Nechyporenko. Graphic design and cover design: FAMA Research agency / Inesa Biliuk.",
    summary:
      "The first large-scale study of the mental health and psychosocial support needs of Ukraine's scientists during the full-scale war, based on a survey of 1,423 researchers.",
    description: [
      "Ukraine's scientists keep research going while living with the psychological weight of war. This UNESCO study, carried out by FAMA Research agency between January and March 2026, combines a nationwide online survey of 1,423 scientists and researchers with five focus groups. It builds on UNESCO's 2025 qualitative study Resilient Minds.",
      "It finds signs of psychological distress in 83% of respondents, with anxiety more pronounced than depression. The full-scale invasion has hit their sense of safety, confidence in the future and mental health hardest, and only 1 in 20 reports no negative effect on their professional work. Most believe they know enough about mental health, yet few seek professional help: stigma, cost, time and distrust stand in the way, and institutional support exists more on paper than in practice.",
      "The report highlights a resource that is easy to overlook: a strong culture of informal peer support within research teams. Its gender analysis shows that women report more distress but are better informed and more open to help, while men have less social support and are less aware of the help available. It closes with recommendations, from proactive burnout prevention to training in peer-support skills and gender-responsive programmes.",
    ],
    highlights: [
      "Survey of 1,423 scientists, with breakdowns by gender, age, region and field",
      "Stress markers, coping strategies and barriers to professional support",
      "Peer support within research teams as an untapped entry point",
      "Six recommendations for policymakers, research institutions and international partners",
    ],
    audience:
      "Science and education policymakers, research-institution leaders, international partners, and mental health and psychosocial support professionals.",
    citation:
      "UNESCO. 2026. Mental health and psychosocial support of Ukrainian scientists and researchers. Paris: UNESCO. https://doi.org/10.54677/TUQW9737",
    pdfPath: "/open-resources/mhpss-ukrainian-scientists-2026.pdf",
    coverPath: "/open-resources/covers/mhpss-ukrainian-scientists-2026.webp",
  },
  {
    slug: "teaching-with-care-mental-health-well-being",
    title: "Teaching with Care",
    subtitle: "A Practical Guide for Teachers to Support Mental Health and Well-being in Schools",
    type: "Practical guide",
    category: "Teaching, mental health & well-being",
    creators:
      "UNESCO, in collaboration with UNICEF and WHO. Written by Rena Deitz, Jennifer Flemming and Ashley Nemiro; coordinated by Yongfeng Liu with Munire Abulimiti (UNESCO Section of Health and Education)",
    publisher:
      "United Nations Educational, Scientific and Cultural Organization (UNESCO), Paris; United Nations Children's Fund (UNICEF), New York; World Health Organization (WHO), Geneva",
    year: 2026,
    pages: 93,
    fileSizeMb: 1.4,
    language: "English",
    isbn: "978-92-3-100899-3 (UNESCO); 978-92-4-012491-2 (WHO, electronic)",
    doi: "10.54675/QDVK2110",
    sourceUrl: unesdoc("399510"),
    licence: CC_BY_SA_3_IGO,
    rightsHolder: "© UNESCO, UNICEF, WHO 2026",
    coverCredit: "Cover photo: Twinsterphoto/Shutterstock.com. Inside icons: © UNESCO/Weiwei Kang. Designed by UNESCO.",
    coverRights: {
      label: "Cover photo © Twinsterphoto / Shutterstock",
      printedCredit: "Cover photo: Twinsterphoto/Shutterstock.com",
      owner: "Twinsterphoto, licensed through Shutterstock, Inc.",
      basis:
        "A licensed stock photograph. The publisher states that “the present license applies exclusively to the text content of the publication”, so this photo is not covered by the CC BY-SA licence.",
    },
    thirdPartyNotice:
      "Per the publisher, the CC BY-SA licence applies exclusively to the text. Images, illustrations and charts not clearly identified as UNESCO's or as public domain need prior permission from UNESCO (publication.copyright@unesco.org). UNICEF and WHO photographs are copyrighted and may not be reproduced in any medium without their prior written permission.",
    funding: "Supported by the Governments of Norway and Sweden.",
    summary:
      "Everyday, evidence-based strategies that help teachers protect learners' mental health and well-being, without extra training or turning teachers into therapists. A joint UNESCO, UNICEF and WHO guide.",
    description: [
      "Around one in seven adolescents worldwide lives with a mental health condition, and many more face stress, adversity or exclusion that affect how they feel and learn. Teachers say they want to help but need clarity on what is feasible and within their role. This joint guide from UNESCO, UNICEF and WHO, shaped by teachers in Nigeria, India, Viet Nam, Germany, Singapore and elsewhere, answers that need.",
      "It is organized around ten practical actions in four modules. Module 1 covers promoting well-being in the classroom: safe and predictable routines, positive relationships, prosocial behaviour and social-emotional skills woven into ordinary lessons. Module 2 is about noticing early signs of distress across ages and genders and linking learners to school and community support. Module 3 turns to teachers' own well-being and that of their colleagues. Module 4 covers working with families and communities and advocating for change.",
      "The guide is clear about what teachers are not expected to do: diagnose conditions or provide treatment. Each module ends with adaptations for different settings and a self-assessment, and examples of good practice range from a multilingual classroom in Ghana to a teacher's self-care plan in Ukraine.",
    ],
    highlights: [
      "Ten classroom actions across four modules, each with a self-assessment",
      "Myths and facts about learner mental health, and early signs of distress by age",
      "Tools for mapping school and community support services",
      "STOP–THINK–GO and peer check-ins for teachers' own well-being",
    ],
    audience:
      "Teachers at every level, school leaders, teacher educators, school counsellors and education ministries building whole-school approaches to mental health and psychosocial support.",
    citation:
      "UNESCO, UNICEF and WHO. 2026. Teaching with care: A practical guide for teachers to support mental health and well-being in schools. Paris: UNESCO. https://doi.org/10.54675/QDVK2110",
    pdfPath: "/open-resources/teaching-with-care-mental-health-well-being.pdf",
    coverPath: "/open-resources/covers/teaching-with-care-mental-health-well-being.webp",
  },
  {
    slug: "addressing-violent-pasts-through-education",
    title: "Addressing Violent Pasts through Education",
    subtitle: "A Policy Guide",
    type: "Policy guide",
    category: "Peace, history & citizenship education",
    creators:
      "UNESCO Section of Global Citizenship and Peace Education. Drafted by Michelle J. Bellino (University of Michigan) and Julia Paulson (University of Saskatchewan), reviewed and edited by Natasha Robinson (University of Oxford)",
    publisher: "United Nations Educational, Scientific and Cultural Organization (UNESCO), Paris",
    year: 2025,
    pages: 103,
    fileSizeMb: 2.5,
    language: "English",
    isbn: "978-92-3-100787-3",
    doi: "10.54675/LJOW4285",
    sourceUrl: unesdoc("395088"),
    licence: CC_BY_SA_3_IGO,
    rightsHolder: "© UNESCO 2025",
    coverCredit:
      "Cover credits: Ajdin Kamber/Shutterstock.com*; Rhodes no nose: Crispin Cooper via Wikimedia Commons (CC BY-SA 4.0); © UNESCO/Chris Dansie/Hortenzia. Cover design: Chris Dansie/Hortenzia. Typeset: Luiza Maximo.",
    coverRights: {
      label: "Cover photo © Ajdin Kamber / Shutterstock*",
      printedCredit:
        "Cover credits: Ajdin Kamber/Shutterstock.com*; Rhodes no nose: Crispin Cooper via WikiMedia Commons (Available under CC BY-SA 4.0); © UNESCO/Chris Dansie/Hortenzia",
      owner: "Ajdin Kamber, licensed through Shutterstock, Inc.",
      basis:
        "The publisher marks this photo with an asterisk and states that “images marked with an asterisk (*) do not fall under the CC-BY-SA license and may not be used or reproduced without the prior permission of the copyright holders”. The cover is a composite: the statue photograph “Rhodes no nose” is by Crispin Cooper and is separately available under its own CC BY-SA 4.0 licence (https://creativecommons.org/licenses/by-sa/4.0/), which requires crediting him; the cover design is © UNESCO / Chris Dansie / Hortenzia. The restrictions below apply to the Shutterstock photo.",
    },
    thirdPartyNotice:
      "Per the publisher, any image in this guide marked with an asterisk (*) is excluded from the CC BY-SA licence and may not be used or reproduced without the prior permission of its copyright holder.",
    funding:
      "Financially supported by the Government of Canada. Developed in the International Program on Holocaust and Genocide Education, run jointly by UNESCO and the United States Holocaust Memorial Museum.",
    summary:
      "UNESCO's first policy guidance on teaching about war, genocide, colonialism, enslavement and their legacies in ways that build peace rather than deepen divides.",
    description: [
      "How a society teaches its violent past shapes its future. Left unaddressed, or taught as a single heroic story, histories of war and atrocity can fuel polarization, denial and renewed conflict. This guide, rooted in UNESCO's decades of Holocaust education and in the 2023 Recommendation on Education for Peace, Human Rights and Sustainable Development, gives education policymakers strategies for teaching these histories with care.",
      "It first defines “violent pasts”, from war and displacement to colonial oppression and enslavement, and shows how violence can persist long after it officially ends. It then sets out frameworks for this work: human rights education, global citizenship education, education about atrocity crimes and peace education. The core of the guide describes system-wide action on policy, curricula and textbooks, teacher support, museums and memorials, and civil society and international cooperation.",
      "A chapter on pedagogy covers historical inquiry, open classroom climates, working with emotions, remembrance, teaching with testimonies and the particular care needed in victim communities. Fifteen case studies run from Argentina, Colombia and Cambodia to Rwanda, Timor-Leste, Lebanon, Canada and Bristol in the United Kingdom. Annexes provide an example roadmap and a needs-assessment tool.",
    ],
    highlights: [
      "Fifteen country and programme case studies of education about violent pasts",
      "Promising practices for policies, curricula, textbooks, teachers and memory sites",
      "Pedagogical strategies, from historical inquiry to teaching with testimonies",
      "An example roadmap and a needs-assessment tool for ministries",
    ],
    audience:
      "Education policymakers and curriculum developers, history and civics teachers, teacher educators, museums and memorial institutions, and peacebuilding and transitional-justice practitioners.",
    citation:
      "UNESCO. 2025. Addressing violent pasts through education: A policy guide. Paris: UNESCO. https://doi.org/10.54675/LJOW4285",
    pdfPath: "/open-resources/addressing-violent-pasts-through-education.pdf",
    coverPath: "/open-resources/covers/addressing-violent-pasts-through-education.webp",
  },
  {
    slug: "ai-answers-you-decide-mil-companion",
    title: "AI Answers. You Decide.",
    subtitle: "A Companion Guide to the UNESCO Media and Information Literacy Curriculum",
    type: "Teaching guide",
    category: "Media & information literacy, AI",
    creators:
      "Anne Leppäjärvi (author). Coordinated by Adeline Hulin and Olivier Van Bockstael, with an International Expert Group and a Peer Review Group",
    publisher: "United Nations Educational, Scientific and Cultural Organization (UNESCO), Paris",
    year: 2026,
    pages: 118,
    fileSizeMb: 18.4,
    language: "English",
    isbn: "978-92-3-100915-0",
    doi: "10.58338/JXYO3928",
    sourceUrl: unesdoc("400013"),
    licence: CC_BY_SA_3_IGO,
    rightsHolder: "© UNESCO 2026",
    coverCredit: "Cover image: Haui Roa. Design and illustration: Haui Roa. Typeset by UNESCO.",
    coverRights: {
      label: "Cover image: Haui Roa",
      printedCredit: "Cover image: Haui Roa",
      owner: "Haui Roa (designer and illustrator)",
      basis:
        "The cover artwork is credited by name to its illustrator, and the publication does not say that it is released under the open licence. Eleventh Press therefore treats it as all rights reserved by its creator.",
    },
    summary:
      "A ready-to-teach guide that helps learners understand how AI shapes the information they see, question what it tells them and keep their own judgement.",
    description: [
      "AI now shapes how information is produced, filtered and shared, often without people noticing. This companion to UNESCO's Media and Information Literacy curriculum Think Critically, Click Wisely! extends media and information literacy to that new environment. It is written for educators in classrooms, libraries, youth groups and adult education, and needs no technical expertise.",
      "It starts with an Orientation Map that places the learner at the centre of the systems that predict, classify, decide and generate. Five units follow. AI in Our Pocket covers the four types of AI and the data we give away. AI's Roles in the Media Landscape covers journalism, publishing ethics and informed trust. AI, the Human Mind and Knowledge covers chatbots, filtering, fact-checking, emotions and research. AI, Power and Human Rights covers the right to evaluate, inequality, accountability and AI's energy costs. AI Futures Are Being Built Now asks learners to move from bystander to builder.",
      "Every section can be taught as a standalone lesson with “Try This” activities designed for learners aged 13 to 15 and adaptable for other ages. Most activities work without learners using AI themselves, since the educator can run the tool on a shared screen. A glossary, a Shared Global Examples Table and a Try This Finder make the guide easy to use.",
    ],
    highlights: [
      "Five units, each usable as a standalone lesson",
      "“Try This” classroom activities, most of which work without learners using AI directly",
      "Real-world examples from many countries, gathered in a Shared Global Examples Table",
      "Covers AI and journalism, human rights, accountability, inclusion and climate costs",
    ],
    audience:
      "Teachers, librarians, youth workers, adult and teacher educators, and anyone teaching media and information literacy to learners aged about 13 and up.",
    citation:
      "Leppäjärvi, A. 2026. AI answers. You decide. A companion guide to the UNESCO Media and Information Literacy Curriculum. Paris: UNESCO. https://doi.org/10.58338/JXYO3928",
    pdfPath: "/open-resources/ai-answers-you-decide-mil-companion.pdf",
    coverPath: "/open-resources/covers/ai-answers-you-decide-mil-companion.webp",
  },
  {
    slug: "differentiated-teaching-learning-asia-pacific",
    title: "Teachers' Guide on Differentiated Teaching and Learning",
    subtitle: "Addressing Learning Needs in the Asia-Pacific Region",
    type: "Teachers' guide",
    category: "Inclusive teaching & assessment",
    creators:
      "Isabelle Nizet (Université de Sherbrooke), author, with UNESCO Bangkok under the supervision of Rika Yorozu, and national drafting teams from Bhutan and Lao PDR",
    publisher:
      "UNESCO, Paris, and the UNESCO Regional Office in Bangkok and Office for UN Coordination for Asia and the Pacific",
    year: 2026,
    pages: 131,
    fileSizeMb: 1.8,
    language: "English",
    doi: "10.54675/ZOWN9409",
    reportCode: "BGK/C4-8703/ED/26/013",
    sourceUrl: unesdoc("400036"),
    licence: CC_BY_SA_3_IGO,
    rightsHolder: "© UNESCO 2026",
    coverCredit: "Graphic design and cover illustration: Nattawud Nittayagun. Copyediting: Ingrid Lewis.",
    thirdPartyNotice:
      "Per the publisher, any image in this guide marked with an asterisk (*) is excluded from the CC BY-SA licence and may not be used or reproduced without the prior permission of its copyright holder. The cover illustration is not so marked.",
    funding:
      "Financially supported by the Government of the Republic of Korea, through UNESCO Bangkok's project on addressing learning gaps and preventing drop-out in Asia-Pacific.",
    summary:
      "Practical tools that help teachers in Asia and the Pacific find out what each learner needs and adapt their teaching so no one is left behind, piloted in Bhutan and Lao PDR.",
    description: [
      "Across the Asia-Pacific region, many learners still fall short of minimum proficiency and the most vulnerable are at risk of dropping out. Classrooms are increasingly diverse in readiness, interests, preferences and backgrounds. This guide from UNESCO Bangkok, developed with the education ministries of Bhutan and Lao PDR, helps teachers move beyond one-size-fits-all teaching.",
      "Chapter 1 explains differentiated teaching and its link to inclusive education. Chapter 2 shows how to use low-stakes diagnostic and formative assessments to build learner, group and class profiles. Chapter 3 is a toolbox of strategies: universal design for learning, tiered tasks, scaffolding, jigsaw, learning menus, flexible grouping, learning stations and centres. It also covers support for learners with disabilities, reducing gender and cultural bias, and adapting assessment.",
      "Chapter 4 helps teachers plan with a “differentiation compass” and templates. Chapter 5 shows where digital tools, from augmented reality to learning management systems, can support differentiation. Twenty-eight worked examples from real lessons, many from Bhutanese and Lao classrooms, and a reflection exercise at the end of each chapter make the guide practical.",
    ],
    highlights: [
      "28 worked classroom examples, from Grade 6 science to Grade 11 physics",
      "Ready-to-use diagnostic, interest and preference assessment tools",
      "Strategies by learner readiness, interest, preference and environment",
      "Guidance on learners with disabilities, gender bias and digital tools",
    ],
    audience:
      "Primary and secondary teachers, school leaders, teacher educators and education policymakers in Asia and the Pacific, including the Philippines, and anyone building inclusive classrooms.",
    citation:
      "UNESCO. 2026. Teachers' guide on differentiated teaching and learning: Addressing learning needs in the Asia-Pacific region. Paris: UNESCO; Bangkok: UNESCO Bangkok. https://doi.org/10.54675/ZOWN9409",
    pdfPath: "/open-resources/differentiated-teaching-learning-asia-pacific.pdf",
    coverPath: "/open-resources/covers/differentiated-teaching-learning-asia-pacific.webp",
  },
  {
    slug: "oecd-digital-education-outlook-2026",
    org: "OECD",
    title: "OECD Digital Education Outlook 2026",
    subtitle: "Exploring Effective Uses of Generative AI in Education",
    series: "OECD Digital Education Outlook",
    type: "Flagship report",
    category: "AI in education",
    creators:
      "OECD Directorate for Education and Skills (Centre for Educational Research and Innovation), edited by Stéphan Vincent-Lancrin, with chapters by international researchers",
    publisher: "OECD Publishing, Paris",
    year: 2026,
    pages: 267,
    fileSizeMb: 11.4,
    language: "English",
    isbn: "978-92-64-91530-5 (PDF); 978-92-64-74128-7 (print)",
    issn: "2788-8576 (online); 2788-8568 (print)",
    doi: "10.1787/062a7394-en",
    sourceUrl: "https://www.oecd.org/en/publications/oecd-digital-education-outlook-2026_062a7394-en.html",
    licence: CC_BY_4,
    terms: OECD_TERMS,
    rightsHolder: "© OECD 2026",
    coverKind: "tile",
    coverCredit: TILE_COVER_CREDIT,
    coverRights: {
      label: "Gerhard Richter, “Lesende”",
      printedCredit: "Photo credits: Cover © Gerhard Richter 2025 (23122025).",
      owner: "Gerhard Richter",
      basis:
        "A work of art reproduced by the OECD with the permission of the Gerhard Richter Atelier, as the publication's acknowledgements state. Third-party material is outside the OECD's CC BY 4.0 licence, and the OECD's terms also forbid use of its cover image without express permission.",
    },
    thirdPartyNotice: OECD_NOTICE,
    pdfHost: "publisher",
    summary:
      "The OECD's evidence review of generative AI in education: where it genuinely helps students, teachers and institutions, and why general-purpose chatbots can improve output without improving learning.",
    description: [
      "Generative AI arrived in classrooms before most education systems had a policy for it. This edition of the OECD's flagship Digital Education Outlook brings together empirical studies, design experiments and expert contributions to ask a sharper question than whether to allow it: under which conditions does GenAI actually support learning?",
      "Its central finding is a warning about a gap between performance and learning. When students lean on general-purpose chatbots, their work can look better while the mental effort that produces understanding falls away. Tools built on explicit pedagogy, such as Socratic AI tutors, structured feedback and evidence-centred assessment design, show more promise than generic assistants.",
      "Later chapters turn to teachers and systems: a framework for teacher–AI teaming that favours augmentation over replacement, purpose-built educational tools co-designed with teachers, AI teaching assistants and tutoring copilots, AI for course-equivalency mapping, test-item generation, and the use of GenAI in education research itself, including low-connectivity “unplugged” approaches tested in rural Brazil.",
    ],
    highlights: [
      "Evidence on when GenAI improves learning and when it only improves task output",
      "AI tutoring, collaborative learning and creativity, chapter by chapter",
      "A teacher–AI teaming framework: replacement, complementarity, augmentation",
      "System uses: admissions, curriculum analytics, assessment and research",
    ],
    audience:
      "Education policymakers, school and university leaders, teacher educators, edtech designers and researchers studying AI in teaching and learning.",
    citation:
      "OECD (2026), OECD Digital Education Outlook 2026: Exploring Effective Uses of Generative AI in Education, OECD Publishing, Paris, https://doi.org/10.1787/062a7394-en.",
    pdfPath: "https://www.oecd.org/content/dam/oecd/en/publications/reports/2026/01/oecd-digital-education-outlook-2026_940e0dd8/062a7394-en.pdf",
    coverPath: "/open-resources/covers/oecd-digital-education-outlook-2026.webp",
  },
  {
    slug: "oecd-skills-in-the-ai-age-2026",
    org: "OECD",
    title: "Skills in the AI Age",
    series: "OECD Artificial Intelligence Papers, No. 60",
    type: "Policy paper",
    category: "AI, skills & work",
    creators: "Written by Elif Köksal-Oudot for the OECD-Korea Digital Society Initiative of the OECD Digital Policy Committee",
    publisher: "OECD Publishing, Paris",
    year: 2026,
    pages: 36,
    fileSizeMb: 2.2,
    language: "English",
    doi: "10.1787/972bd15e-en",
    sourceUrl: "https://www.oecd.org/en/publications/skills-in-the-ai-age_972bd15e-en.html",
    licence: CC_BY_4,
    terms: OECD_TERMS,
    rightsHolder: "© OECD 2026",
    coverKind: "tile",
    coverCredit: TILE_COVER_CREDIT,
    coverRights: {
      label: "© Viktoriia Hnatiuk/Shutterstock",
      printedCredit: "Photo credits: © Viktoriia Hnatiuk/Shutterstock.",
      owner: "Viktoriia Hnatiuk, licensed through Shutterstock, Inc.",
      basis:
        "A licensed stock photograph. Third-party material is outside the OECD's CC BY 4.0 licence, and the OECD's terms also forbid use of its cover image without express permission.",
    },
    thirdPartyNotice: OECD_NOTICE,
    pdfHost: "publisher",
    summary:
      "A concise OECD policy paper on how AI is reshaping jobs and skill needs, and what governments can do so that workers gain from it rather than lose out.",
    description: [
      "AI is spreading quickly through firms: the paper reports that the share of firms using it in OECD countries rose from around 7% to 20% between 2021 and 2025, with larger firms and start-ups leading and small businesses held back by cost, infrastructure and skills shortages.",
      "It separates exposure to AI from risk of automation. Highly skilled occupations are the most exposed, yet least likely to be automated, while routine low- and middle-skill jobs carry the higher automation risk. Overall, the evidence it reviews suggests AI more often complements human work than replaces it, though displacement remains a real risk for routine roles.",
      "The paper then sets out the skills people need (foundational, ICT and specialist AI skills, plus critical thinking, creativity and collaboration) and six policy directions: stronger education and training, lifelong learning, an ICT and AI talent pipeline, AI literacy for all, employer-led training, and better co-ordination using labour-market data.",
    ],
    highlights: [
      "Firm-level AI adoption trends across OECD countries, 2021–2025",
      "Why exposure to AI is not the same as risk of automation",
      "The skill mix for the AI age, from literacy to machine learning",
      "Six policy levers for governments, employers and education systems",
    ],
    audience:
      "Policymakers in education, labour and digital affairs, TVET and higher education leaders, employers, and researchers studying AI and the future of work.",
    citation:
      "OECD (2026), “Skills in the AI age”, OECD Artificial Intelligence Papers, No. 60, OECD Publishing, Paris, https://doi.org/10.1787/972bd15e-en.",
    pdfPath: "https://www.oecd.org/content/dam/oecd/en/publications/reports/2026/07/skills-in-the-ai-age_e8d8c1e6/972bd15e-en.pdf",
    coverPath: "/open-resources/covers/oecd-skills-in-the-ai-age-2026.webp",
  },
  {
    slug: "world-development-report-2024-middle-income-trap",
    org: "World Bank",
    title: "World Development Report 2024",
    subtitle: "The Middle-Income Trap",
    series: "World Development Report",
    type: "Flagship report",
    category: "Economic development",
    creators: "A World Bank Group team led by Somik V. Lall, under the overall guidance of Indermit Gill, Senior Vice President and Chief Economist",
    publisher: "The World Bank, Washington, DC",
    year: 2024,
    pages: 276,
    fileSizeMb: 9.2,
    language: "English",
    isbn: "978-1-4648-2078-6 (softcover); e-ISBN 978-1-4648-2096-0",
    issn: "0163-5085",
    doi: "10.1596/978-1-4648-2078-6",
    sourceUrl: "https://openknowledge.worldbank.org/entities/publication/7c5cd962-11ae-4101-8f3f-e15b86135f0e",
    licence: CC_BY_3_IGO,
    terms: WORLD_BANK_TERMS,
    rightsHolder: "© 2024 International Bank for Reconstruction and Development / The World Bank",
    coverCredit: "Cover rendered from the first page of the publication.",
    thirdPartyNotice: WORLD_BANK_NOTICE,
    summary:
      "The World Bank's flagship argument for how middle-income countries, home to 6 billion people, can avoid stalling before they reach high income: invest, then infuse technology, then innovate.",
    description: [
      "The 108 middle-income countries aim to reach high-income status within a generation or two, yet the report finds the record discouraging: the economies that have made that leap since 1990 together hold fewer than 250 million people, and rising debt, ageing populations, protectionism and the energy transition are making the climb harder.",
      "Its answer is the “3i” framework. Lower-middle-income countries need to move beyond investment alone (1i) to investment plus infusion (2i), bringing in technologies and business practices from abroad and spreading them at home. Upper-middle-income countries that have mastered infusion then add innovation (3i), pushing out the technological frontier rather than only borrowing from it.",
      "Drawing on Schumpeterian economics, the report shows that these shifts depend on how societies balance the forces of creation, preservation and destruction: disciplining powerful incumbents, rewarding merit so talent rises, and using crises to retire outdated policies. Country experiences from the Republic of Korea, Poland and Chile illustrate the path, with an emphasis on efficiency in capital, labour and energy.",
    ],
    highlights: [
      "The 1i → 2i → 3i sequence of growth strategies",
      "Creation, preservation and destruction as forces of structural change",
      "Talent, social mobility and the role of incumbents and SMEs",
      "Energy efficiency and emissions as conditions for growth",
    ],
    audience:
      "Economists, development policymakers, planning agencies, business schools and researchers in growth, innovation and public policy, including in the Philippines and ASEAN.",
    citation:
      "World Bank. 2024. World Development Report 2024: The Middle-Income Trap. Washington, DC: World Bank. doi:10.1596/978-1-4648-2078-6. License: Creative Commons Attribution CC BY 3.0 IGO.",
    pdfPath: "/open-resources/world-development-report-2024-middle-income-trap.pdf",
    coverPath: "/open-resources/covers/world-development-report-2024-middle-income-trap.webp",
  },
  {
    slug: "organization-in-biology",
    org: "Springer Nature",
    title: "Organization in Biology",
    series: "History, Philosophy and Theory of the Life Sciences, Vol. 33",
    type: "Edited volume",
    category: "Biology & philosophy of science",
    creators:
      "Edited by Matteo Mossio (IHPST, CNRS/Université Paris 1). Contributors: Georg Toepfer; Charles T. Wolfe; Gertrudis Van de Vijver and Levi Haeck; Cliff Hooker; Olivier Sartenaer; Philippe Huneman; Johannes Jaeger; Kepa Ruiz-Mirazo and Alvaro Moreno; Gaëlle Pontarotti; Leonardo Bich and Derek Skillings; Maël Montévil and Ana M. Soto; Charbel N. El-Hani, Felipe Rebelo Gomes de Lima and Nei de Freitas Nunes-Neto",
    publisher: "Springer, Cham (Springer Nature Switzerland AG)",
    year: 2024,
    pages: 338,
    fileSizeMb: 4.7,
    language: "English",
    isbn: "978-3-031-38968-9 (eBook); 978-3-031-38967-2 (print)",
    issn: "2211-1956 (electronic); 2211-1948 (print)",
    doi: "10.1007/978-3-031-38968-9",
    sourceUrl: "https://link.springer.com/book/10.1007/978-3-031-38968-9",
    licence: CC_BY_4,
    terms: null,
    rightsHolder: "© The Editor(s) (if applicable) and The Author(s) 2024",
    coverCredit: "Cover rendered from the first page of the publication.",
    thirdPartyNotice:
      "Per the publisher, images or other third-party material in the book are included in its Creative Commons licence unless a credit line to the material indicates otherwise.",
    summary:
      "Thirteen chapters arguing that biology has overlooked how living systems organise themselves, and showing how the concept of organisation can guide theory, models and experiments.",
    description: [
      "For most of the twentieth century, the editor argues, biology focused on genes and populations and lost sight of organisation: the distinctive way the parts of a living system interact so that the system maintains itself. This open-access volume asks whether making organisation an explicit scientific concept can strengthen today's move beyond gene-centred explanation.",
      "Most contributions build on the idea of biological organisation as a “closure of constraints”, in which the structures that channel a system's processes are themselves produced and maintained by that system. Early chapters trace the concept's history from the seventeenth century, examine varieties of organicism, and debate how far it should be treated philosophically or as a working scientific principle.",
      "Later chapters apply the organisational view to evolution and organismal agency, the origins of life from prebiotic chemistry, inheritance, development and organogenesis, and ecology, where it leads to a new notion of ecological function and sustainability. One chapter deliberately argues the opposite case, which makes the book a genuine debate.",
    ],
    highlights: [
      "Organisation as “closure of constraints”, the book's unifying idea",
      "History of the concept and the case for and against organicism",
      "Applications to evolution, origins of life, development and inheritance",
      "An organisational theory of ecological functions and sustainability",
    ],
    audience:
      "Biologists, philosophers of science, theoretical and systems biologists, ecologists and graduate students interested in the foundations of the life sciences.",
    citation:
      "Mossio, M. (Ed.). (2024). Organization in Biology. History, Philosophy and Theory of the Life Sciences, vol. 33. Cham: Springer. https://doi.org/10.1007/978-3-031-38968-9",
    pdfPath: "/open-resources/organization-in-biology.pdf",
    coverPath: "/open-resources/covers/organization-in-biology.webp",
  },
  {
    slug: "national-skills-strategies-saudi-arabia-2025",
    org: "World Bank",
    title: "Towards System-Level Reform through National Skills Strategies",
    subtitle: "Lessons from the Kingdom of Saudi Arabia",
    type: "Report",
    category: "Skills & TVET policy",
    creators: "Ahmed Alzahrani, Sonja Loots, Neil Butcher and Carole Chartouni",
    publisher:
      "The World Bank, Washington, DC, prepared at the request of the Ministry of Human Resources and Social Development (MHRSD), Kingdom of Saudi Arabia",
    year: 2025,
    pages: 72,
    fileSizeMb: 14.0,
    language: "English",
    sourceUrl: "https://hdl.handle.net/10986/42811",
    licence: CC_BY_NC_3_IGO,
    terms: WORLD_BANK_TERMS,
    licenceSource:
      "The licence is recorded on the World Bank Open Knowledge Repository record for this report (hdl.handle.net/10986/42811). The report's own rights page permits reproduction, in whole or in part, for noncommercial purposes with full attribution.",
    rightsHolder: "© 2025 The World Bank",
    coverKind: "tile",
    coverCredit: TILE_COVER_CREDIT,
    coverRights: {
      label: "iStock.com / Vadim Nefedov",
      printedCredit: "Cover photo: iStock.com / Vadim Nefedov",
      owner: "Vadim Nefedov, licensed through iStock (Getty Images)",
      basis:
        "A licensed stock photograph. The publication states that non-World Bank images require further permission for reuse.",
    },
    thirdPartyNotice:
      "Per the World Bank, images credited to the MHRSD archives, Unsplash and iStock require further permission for reuse. Cover design: www.doscuatroocho.net.",
    funding: "Prepared under the Technical Cooperation Program between the World Bank and the Government of Saudi Arabia.",
    summary:
      "How Saudi Arabia, with World Bank support, built a system-level national skills strategy, and five principles any country can use to coordinate skills development.",
    description: [
      "Skills gaps are rarely solved by one-off training programmes. This World Bank report argues for a systems approach to national skills strategies: treating education, training, labour markets, industry and policy as one connected ecosystem rather than leaving skills development to the TVET sector alone.",
      "It draws on the World Bank's work with Saudi Arabia's Ministry of Human Resources and Social Development, which created a Skills and Training Deputyship to lead the national skilling agenda as part of the Kingdom's drive to diversify its economy.",
      "From that experience it distils five principles: good governance and an enabling environment; demand-led skills development through bodies such as Sector Skills Councils; decisions based on accurate labour market information; credible quality assurance; and partnerships among government, employers and providers. The authors present these principles as applicable well beyond Saudi Arabia.",
    ],
    highlights: [
      "Why a systems approach outperforms stop-gap skills interventions",
      "Five principles for a coordinated national skills system",
      "Sector Skills Councils and labour market information systems in practice",
      "Lessons from the Kingdom of Saudi Arabia's reform",
    ],
    audience:
      "Labour and education ministries, TVET authorities, sector skills bodies, employers' associations, development partners and researchers in skills policy.",
    citation:
      "Alzahrani, A., Loots, S., Butcher, N., and Chartouni, C. 2025. Towards System-Level National Skills Strategies: Lessons from the Kingdom of Saudi Arabia. World Bank. Washington, DC.",
    pdfPath: "/open-resources/national-skills-strategies-saudi-arabia-2025.pdf",
    coverPath: "/open-resources/covers/national-skills-strategies-saudi-arabia-2025.webp",
  },
  {
    slug: "using-technology-to-improve-tvet-2023",
    org: "Neil Butcher & Associates",
    title: "Using Technology to Improve Access, Equity, Quality, and Relevance of TVET",
    series: "Background paper for Building Better Formal TVET Systems (World Bank, UNESCO and ILO, 2023)",
    type: "Background paper",
    category: "Skills & TVET policy",
    creators: "Sarah Hoosen, Mohini Baijnath and Neil Butcher (Neil Butcher & Associates)",
    publisher: "Neil Butcher & Associates, Johannesburg",
    year: 2023,
    pages: 85,
    fileSizeMb: 1.1,
    language: "English",
    sourceUrl: "https://www.nba.co.za/resource/using-technology-improve-access-equity-quality-and-relevance-tvet",
    licence: CC_BY_SA_4,
    terms: null,
    licenceSource:
      "The PDF carries no licence statement; the licence is the one the publisher, Neil Butcher & Associates, states for this paper on its resource page (nba.co.za).",
    rightsHolder: "Neil Butcher & Associates, 2023",
    coverKind: "tile",
    coverCredit: TILE_COVER_CREDIT,
    summary:
      "A practical review of how educational technology can widen access to TVET and improve its quality and relevance, with recommendations matched to each country's stage of EdTech readiness.",
    description: [
      "Written as a background paper for the World Bank, UNESCO and ILO report Building Better Formal TVET Systems, this study asks how technical and vocational education can harness educational technology at a time of rapid digital change, the Fourth Industrial Revolution and the disruption of COVID-19.",
      "It maps EdTech's roles across the whole TVET cycle: designing and sharing learning materials (including open educational resources), online and blended delivery, simulations and virtual reality, work-based learning, and credentialing and recognition of prior learning, with case studies from around the world.",
      "The paper closes with the barriers that stall progress and a matrix of recommendations for countries at three levels of EdTech advancement (latent, emerging and established) covering infrastructure, governance, funding, capacity, partnerships, open licensing and innovation.",
    ],
    highlights: [
      "A conceptual framework for EdTech's roles in TVET",
      "Case studies on online delivery, simulations, work-based learning and RPL",
      "Challenges and lessons learned from implementation",
      "Recommendations by level of country EdTech advancement",
    ],
    audience:
      "TVET policymakers, institution leaders, trainers, development partners and researchers working on skills and educational technology.",
    citation:
      "Hoosen, S., Baijnath, M., and Butcher, N. 2023. Using Technology to Improve Access, Equity, Quality, and Relevance of TVET. Background paper for World Bank, UNESCO and ILO (2023), Building Better Formal TVET Systems: Principles and Practice in Low- and Middle-Income Countries. Neil Butcher & Associates.",
    pdfPath: "/open-resources/using-technology-to-improve-tvet-2023.pdf",
    coverPath: "/open-resources/covers/using-technology-to-improve-tvet-2023.webp",
  },
  {
    slug: "costing-odl-and-icts-in-tvet-2017",
    org: "Commonwealth of Learning",
    title: "Considerations in Costing ODL and ICTs in TVET",
    series: "Chapter 12 of Using ICTs and Blended Learning in Transforming TVET (ed. Colin Latchem)",
    type: "Book chapter",
    category: "Skills & TVET policy",
    creators: "Sarah Hoosen and Neil Butcher. Book edited by Colin Latchem",
    publisher:
      "United Nations Educational, Scientific and Cultural Organization (UNESCO), Paris, and Commonwealth of Learning (COL), Burnaby",
    year: 2017,
    pages: 16,
    fileSizeMb: 0.1,
    language: "English",
    isbn: "978-92-3-100212-0 (UNESCO); 978-1-894975-85-8 (COL)",
    sourceUrl: "http://hdl.handle.net/11599/2718",
    licence: CC_BY_SA_3_IGO,
    terms: COL_TERMS,
    licenceSource:
      "This chapter file carries no licence statement of its own. The licence is the one printed on the imprint page of the full book, which is also recorded on the Commonwealth of Learning's repository record (hdl.handle.net/11599/2718).",
    extractOf:
      "This file is Chapter 12 (pages 185–200) of Latchem, C. (Ed.) (2017), Using ICTs and Blended Learning in Transforming TVET, provided as a separate chapter extract. Eleventh Press has made no other changes. The complete book is available from the Commonwealth of Learning.",
    rightsHolder: "© UNESCO and Commonwealth of Learning, 2017",
    coverKind: "tile",
    coverCredit: TILE_COVER_CREDIT,
    summary:
      "What it really costs to deliver technical and vocational training at a distance or with technology, and why cheaper per student does not always mean more cost-effective.",
    description: [
      "Policymakers often assume that open and distance learning (ODL) and ICTs will cut the cost of technical and vocational education. This chapter tests that assumption, noting how little costing research exists for TVET and drawing lessons from wider ODL experience.",
      "It defines the key costing terms (direct, indirect, fixed, variable, marginal and unit costs, cost-efficiency and cost-effectiveness) and then works through the main cost areas: students' own costs, student support, teachers and trainers, technology and ICT, course design and development, delivery and administration.",
      "Its core message is that design costs are incurred regardless of enrolment, so ODL is cheaper per student only when large numbers study successfully. Because TVET often serves small groups across many trades, the authors point to consortia, industry partnerships, shared repositories, MOOCs and open educational resources as ways to make technology-based TVET affordable.",
    ],
    highlights: [
      "A glossary of costing terms for education planners",
      "The seven main cost areas of ODL, applied to TVET",
      "Why completion rates change the cost-per-graduate picture",
      "How OER and shared development can lower costs",
    ],
    audience:
      "TVET planners, finance officers, institution managers and researchers making the case for, or evaluating, technology-based training.",
    citation:
      "Hoosen, S., and Butcher, N. 2017. Considerations in Costing ODL and ICTs in TVET. In C. Latchem (Ed.), Using ICTs and Blended Learning in Transforming TVET (pp. 185–200). Paris: UNESCO; Burnaby: Commonwealth of Learning.",
    pdfPath: "/open-resources/costing-odl-and-icts-in-tvet-2017.pdf",
    coverPath: "/open-resources/covers/costing-odl-and-icts-in-tvet-2017.webp",
  },
  {
    slug: "good-stories-dont-grow-on-trees",
    org: "Neil Butcher & Associates",
    title: "Good Stories Don’t Grow on Trees",
    subtitle: "A Guide to Effective Costing of Storybooks in the Global South",
    type: "Research report",
    category: "Early literacy & publishing",
    creators: "Neil Butcher, Lisbeth Levey and Kirsty von Gogh",
    publisher: "Neil Butcher & Associates, Johannesburg",
    year: 2019,
    pages: 98,
    fileSizeMb: 3.7,
    language: "English",
    sourceUrl: "https://www.nba.co.za/resource/good-stories-dont-grow-trees-guide-effective-costing-storybooks-global-south",
    licence: CC_BY_4,
    terms: null,
    rightsHolder: "Neil Butcher & Associates, 2019",
    coverKind: "tile",
    coverCredit: TILE_COVER_CREDIT,
    thirdPartyNotice:
      "The publication's cover image is credited to Fati and the Honey Tree, by Osu Library Fund, illustrated by Therson Boadu (Sub-Saharan Publishers), via StoryWeaver. As its licence terms are not restated in the report, Eleventh Press does not reproduce it here. Figures and screenshots of other organisations' platforms remain theirs.",
    funding: "Funded by the William and Flora Hewlett Foundation.",
    summary:
      "What it actually costs to write, illustrate, translate and print children's storybooks in local languages, drawn from seven publishers and platforms across Africa and Asia.",
    description: [
      "Openly licensed storybooks are free to read, but someone still pays to create, translate and print them. This study from Neil Butcher & Associates examines those costs so that funders and governments can support local-language children's publishing sustainably.",
      "It compares three storybook models (basic storybooks read for pleasure, levelled readers that teach reading, and STEM stories that need subject expertise) and the cost drivers of each: authors and illustrators, editing and quality assurance, translation, printing and overheads.",
      "Seven organisational profiles, including the Asia Foundation's Let's Read!, BookBox, Book Dash, Saide's African Storybook, Pratham Books' StoryWeaver, Sub-Saharan Publishers and Ubongo, show the range of business models and licensing choices. The conclusion is that there is no one-size-fits-all cost, and that money must reach local authors, illustrators and publishers if early-literacy efforts are to last.",
    ],
    highlights: [
      "Cost drivers for basic, levelled and STEM storybooks",
      "Translation, print and overhead costs compared",
      "Seven publisher and platform profiles from Africa and Asia",
      "How open licensing interacts with sustainable business models",
    ],
    audience:
      "Early-literacy funders, ministries of education, children's publishers, NGOs and researchers in book provision and open educational resources.",
    citation:
      "Butcher, N., Levey, L., and von Gogh, K. 2019. Good Stories Don't Grow on Trees: A Guide to Effective Costing of Storybooks in the Global South. Neil Butcher & Associates.",
    pdfPath: "/open-resources/good-stories-dont-grow-on-trees.pdf",
    coverPath: "/open-resources/covers/good-stories-dont-grow-on-trees.webp",
  },
  {
    slug: "guide-to-quality-in-online-learning",
    org: "Academic Partnerships",
    title: "A Guide to Quality in Online Learning",
    type: "Guide",
    category: "Online & distance learning",
    creators: "Neil Butcher and Merridy Wilson-Strydom. Edited by Sir John Daniel and Stamenka Uvalić-Trumbić",
    publisher: "Academic Partnerships, Dallas, Texas",
    year: 2013,
    pages: 28,
    fileSizeMb: 2.6,
    language: "English",
    sourceUrl: "https://www.nba.co.za/resource/guide-quality-online-learning",
    licence: CC_BY_SA_3,
    terms: null,
    rightsHolder: "Academic Partnerships, 2013",
    coverKind: "tile",
    coverCredit: TILE_COVER_CREDIT,
    thirdPartyNotice:
      "The cover illustration's creator and licence are not stated in the publication, so Eleventh Press does not reproduce it here. The licence stated in the PDF (CC BY-SA 3.0) is used; where a later web listing gives a different licence, the one printed in the work applies.",
    summary:
      "A short, practical guide that answers sixteen common questions about what makes formal online courses high quality, with a reading list of international benchmarks.",
    description: [
      "Commissioned by Academic Partnerships as online learning expanded rapidly after 2012, this guide distils existing quality frameworks into the issues that matter most to academics and students taking or teaching credit-bearing online courses.",
      "It is organised as sixteen frequently asked questions: what online learning is and how it is offered; what quality means and how institutions assure it; what resources quality requires; how students can judge a course; and the roles of course design, web usability, assessment, exam security, interaction and community building, teaching and facilitation, and student support.",
      "Each answer is brief and grounded in examples from higher education worldwide, and the guide closes with an annotated reading list of quality benchmarks and international good practice for readers who want to go deeper.",
    ],
    highlights: [
      "Sixteen FAQs covering the full online course life cycle",
      "Institutional quality assurance and resourcing",
      "Assessment, exam security, interaction and student support",
      "An annotated list of quality benchmarks and frameworks",
    ],
    audience:
      "Academics, programme leaders, quality assurance staff and students in higher education who design, teach or choose online courses.",
    citation:
      "Butcher, N., and Wilson-Strydom, M. 2013. A Guide to Quality in Online Learning. Edited by J. Daniel and S. Uvalić-Trumbić. Dallas, TX: Academic Partnerships.",
    pdfPath: "/open-resources/guide-to-quality-in-online-learning.pdf",
    coverPath: "/open-resources/covers/guide-to-quality-in-online-learning.webp",
  },
  {
    slug: "guide-to-quality-in-post-traditional-online-higher-education",
    org: "Academic Partnerships",
    title: "A Guide to Quality in Post-Traditional Online Higher Education",
    type: "Guide",
    category: "Online & distance learning",
    creators: "Neil Butcher and Sarah Hoosen. Edited by Sir John Daniel and Stamenka Uvalić-Trumbić",
    publisher: "Academic Partnerships, Dallas, Texas",
    year: 2014,
    pages: 36,
    fileSizeMb: 1.9,
    language: "English",
    sourceUrl: "https://www.nba.co.za/resource/guide-quality-post-traditional-online-higher-education",
    licence: CC_BY_SA_3,
    terms: null,
    rightsHolder: "Academic Partnerships, 2014",
    coverKind: "tile",
    coverCredit: TILE_COVER_CREDIT,
    thirdPartyNotice:
      "The cover illustration's creator and licence are not stated in the publication, so Eleventh Press does not reproduce it here. The licence stated in the PDF (CC BY-SA 3.0) is used; where a later web listing gives a different licence, the one printed in the work applies.",
    summary:
      "The companion guide on assuring quality when higher education goes open: OER, MOOCs, open badges, alternative credentials and the accreditation questions they raise.",
    description: [
      "A year after the first guide on formal online learning, its editors asked how quality can be assured in the less formal, more open forms of higher education that were multiplying: short courses, open content, MOOCs and new kinds of certification. This guide calls them “post-traditional” higher education.",
      "It first explains what openness means in education, defining open learning, open source software, open access, open data, open educational resources and MOOCs, and the forces driving them, from youth unemployment to shrinking public funding and new technology.",
      "It then works through the hard questions: how to assure quality in OER and MOOCs, whether post-traditional learning can lead to recognised awards, what open badges add, how accreditation might adapt, which policy issues openness raises for institutions, and how it may change their spending priorities.",
    ],
    highlights: [
      "Key terms of openness, from open access to MOOCs",
      "Quality considerations for OER and for MOOCs",
      "Open badges, awards and the future of accreditation",
      "Policy and budget implications for institutions",
    ],
    audience:
      "University leaders, quality agencies, accreditation bodies, open-education practitioners and researchers in higher education policy.",
    citation:
      "Butcher, N., and Hoosen, S. 2014. A Guide to Quality in Post-Traditional Online Higher Education. Edited by J. Daniel and S. Uvalić-Trumbić. Dallas, TX: Academic Partnerships.",
    pdfPath: "/open-resources/guide-to-quality-in-post-traditional-online-higher-education.pdf",
    coverPath: "/open-resources/covers/guide-to-quality-in-post-traditional-online-higher-education.webp",
  },
  {
    slug: "survey-government-oer-policies-2012",
    org: "Commonwealth of Learning",
    title: "Survey on Governments’ Open Educational Resources (OER) Policies",
    type: "Survey report",
    category: "Open education policy",
    creators: "Prepared by Sarah Hoosen of Neil Butcher & Associates, for the Commonwealth of Learning and UNESCO",
    publisher: "Commonwealth of Learning, Vancouver, and UNESCO, Paris",
    year: 2012,
    pages: 40,
    fileSizeMb: 1.1,
    language: "English",
    isbn: "978-1-894975-54-1",
    sourceUrl: "http://hdl.handle.net/11599/291",
    licence: CC_BY_SA_3,
    terms: COL_TERMS,
    rightsHolder: "© 2012 by the Commonwealth of Learning",
    coverKind: "tile",
    coverCredit: TILE_COVER_CREDIT,
    thirdPartyNotice:
      "The cover photograph's creator and licence are not stated in the publication, so Eleventh Press does not reproduce it here.",
    funding:
      "Part of the project Fostering Governmental Support for OER Internationally (Commonwealth of Learning and UNESCO), partially funded by the William and Flora Hewlett Foundation.",
    summary:
      "The first worldwide survey of government policies on open educational resources, with responses from 82 countries, prepared for the 2012 World OER Congress in Paris.",
    description: [
      "In 2012 the Commonwealth of Learning and UNESCO asked the world's governments what policies they had on open educational resources (OER). This report analyses the responses received from 82 countries by April 2012, in time for the World OER Congress that adopted the Paris OER Declaration.",
      "It reviews, region by region, whether governments had OER policies, how they supported OER in practice, which licences they used and which obstacles they faced, alongside notable national initiatives.",
      "The findings show strong interest but few explicit OER policies, some confusion between OER, open source software and distance learning, and Creative Commons as the most widely used open licensing framework. The report recommends deeper policy analysis, regional studies, a repository of OER research and continued awareness-raising.",
    ],
    highlights: [
      "Responses from 82 countries, analysed by region",
      "The state of national OER policies and initiatives in 2012",
      "Licensing choices and barriers to OER adoption",
      "Recommendations that fed into the 2012 Paris OER Declaration",
    ],
    audience:
      "Education policymakers, open-education advocates, librarians and researchers tracing the history and spread of OER policy.",
    citation:
      "Hoosen, S. 2012. Survey on Governments' Open Educational Resources (OER) Policies. Vancouver: Commonwealth of Learning; Paris: UNESCO. http://hdl.handle.net/11599/291",
    pdfPath: "/open-resources/survey-government-oer-policies-2012.pdf",
    coverPath: "/open-resources/covers/survey-government-oer-policies-2012.webp",
  },
  {
    slug: "ict-professional-development-teachers-guyana-2012",
    org: "Commonwealth of Learning",
    title: "Information and Communication Technologies (ICT) Professional Development Strategy for Teachers in Guyana",
    subtitle: "A Case Study",
    type: "Case study",
    category: "Teacher development",
    creators: "Andrew Moore (author and researcher). Edited by Neil Butcher and Trudi van Wyk",
    publisher: "Commonwealth of Learning, Vancouver",
    year: 2012,
    pages: 24,
    fileSizeMb: 5.6,
    language: "English",
    sourceUrl: "http://hdl.handle.net/11599/279",
    licence: CC_BY_SA_4,
    terms: COL_TERMS,
    licenceSource:
      "The brochure itself carries no licence statement; the licence is the one recorded for it on the Commonwealth of Learning's Open Access Repository (hdl.handle.net/11599/279).",
    rightsHolder: "Commonwealth of Learning, 2012",
    coverCredit: "Cover rendered from the first page of the publication. Photographs: Andrew Moore. Design and layout: Denise Tremblay.",
    thirdPartyNotice:
      "The partner logos printed on the cover (including those of the Commonwealth of Learning, the Commonwealth Secretariat, Microsoft and UNESCO) belong to their owners and are not covered by the licence.",
    summary:
      "How Guyana built a national, low-cost strategy to train teachers to use ICT in the classroom, using the UNESCO ICT Competency Framework for Teachers as its backbone.",
    description: [
      "In a country where only about a quarter of people used the Internet and many teachers were untrained, Guyana's Ministry of Education set out in 2011 to make ICT a lever for better teaching. This Commonwealth of Learning case study describes the ICT Professional Development Strategy for Teachers that resulted.",
      "Developed with the Commonwealth Secretariat, the Commonwealth of Learning, Microsoft, Neil Butcher & Associates and Guyana's national teacher education institutions, the strategy sets a learning pathway for officials, teacher educators, teachers, student teachers and principals, from ICT courses in initial teacher education to short in-service courses for principals, ICT coordinators and support staff.",
      "It shows how the UNESCO ICT Competency Framework for Teachers streamlined a contested curriculum review, and how audits of skills and access, mentoring, open educational resources and a monitoring and evaluation plan made the approach affordable and adaptable for other developing countries.",
    ],
    highlights: [
      "A national ICT learning pathway from pre-service to principals",
      "Use of the UNESCO ICT Competency Framework for Teachers",
      "Audits of ICT skills and access, mentoring and cost-saving delivery",
      "Monitoring and evaluation built into the strategy",
    ],
    audience:
      "Ministries of education, teacher education institutions, ICT-in-education planners and researchers in small or resource-constrained systems.",
    citation:
      "Moore, A. 2012. Information and Communication Technologies (ICT) Professional Development Strategy for Teachers in Guyana: A Case Study. Vancouver: Commonwealth of Learning. http://hdl.handle.net/11599/279",
    pdfPath: "/open-resources/ict-professional-development-teachers-guyana-2012.pdf",
    coverPath: "/open-resources/covers/ict-professional-development-teachers-guyana-2012.webp",
  },
  {
    slug: "practical-guide-responsible-research-assessment-funders-2026",
    org: "DORA",
    title: "A Practical Guide to Implementing Responsible Research Assessment",
    subtitle: "at Research Funding Organizations",
    type: "Guide",
    category: "Research assessment",
    creators:
      "Liz Allen, Virginia Barbour, Lidia Borrell-Damián, Kelly Cobey, Nosisa Dube, Catriona Firth, Rebecca Lawrence, Giovanna Lima, Shawn McGuirk, James Morris, Anh-Khoi Trinh and Joséphine Uwineza",
    publisher:
      "Declaration on Research Assessment (DORA), in collaboration with the Global Research Council's Responsible Research Assessment Working Group and Science Europe",
    year: 2026,
    pages: 102,
    fileSizeMb: 8.5,
    language: "English",
    doi: "10.5281/zenodo.18402271",
    sourceUrl: "https://doi.org/10.5281/zenodo.18402271",
    licence: CC_BY_NC,
    terms: null,
    licenceSource:
      "The PDF states: “This publication is licensed under the Creative Commons Attribution-Noncommercial CC BY-NC” and gives no version number; the link above goes to the current version of that licence. DORA's Zenodo record for the guide lists CC BY 4.0, which is more permissive. Eleventh Press follows the stricter licence printed in the PDF itself: the guide is shown unchanged, free of charge and for non-commercial use only.",
    rightsHolder: "Declaration on Research Assessment (DORA), 2026",
    coverKind: "tile",
    coverCredit: TILE_COVER_CREDIT,
    thirdPartyNotice:
      "The DORA, Global Research Council and Science Europe logos, the photographs in the guide (for example the one credited “© Peter Madsen”) and the third-party material it quotes or links to are not covered by the licence. The original cover is not reproduced here. DORA, the Global Research Council and Science Europe have not reviewed this listing, and no endorsement of Eleventh Press is suggested or implied.",
    summary:
      "A practical guide for research funders on building responsible research assessment into how they plan programmes, choose projects, set grant terms and report on results.",
    description: [
      "Research funders shape what counts as good research through the criteria they set and the questions they ask. This guide, written for staff across a funding organisation from leadership to programme officers, reviewers and grant administrators, sets out how to put the principles of responsible research assessment into everyday funding practice.",
      "It is organised in four parts: an introduction to research assessment reform; seven activities for embedding responsible assessment inside an organisation; five key moments in the funding cycle, from designing programmes and calls to communicating with communities; and eight components of the wider research system, including responsible use of metrics, open science and equity, diversity and inclusion.",
      "Case studies from funders in several countries, spotlights on topics such as the use of AI in research funding and narrative CVs, and a long list of further resources sit alongside the guidance. It was produced by DORA with the Global Research Council's Responsible Research Assessment Working Group and Science Europe, and follows DORA's earlier guide for research performing organisations.",
    ],
    highlights: [
      "Seven activities for embedding responsible research assessment in a funder",
      "Five moments in the funding cycle, from calls to community engagement",
      "Eight components, from responsible use of metrics to open science",
      "Case studies from funders and spotlights on AI and narrative CVs",
    ],
    audience:
      "Research funders and funding agencies, programme managers, grant reviewers and administrators, research managers and policymakers working on research evaluation reform.",
    citation:
      "Allen, L., Barbour, V., Borrell-Damián, L., Cobey, K., Dube, N., Firth, C., Lawrence, R., Lima, G., McGuirk, S., Morris, J. P., Trinh, A.-K., & Uwineza, J. (2026). A practical guide to implementing responsible research assessment at research funding organizations. Declaration on Research Assessment (DORA). https://doi.org/10.5281/zenodo.18402271",
    pdfPath: "/open-resources/practical-guide-responsible-research-assessment-funders-2026.pdf",
    coverPath: "/open-resources/covers/practical-guide-responsible-research-assessment-funders-2026.webp",
  },
  {
    slug: "the-politics-of-riverine-rights-2026",
    org: "Routledge",
    title: "The Politics of Riverine Rights",
    subtitle: "Environmental Struggles in Aotearoa New Zealand, Colombia and India",
    series: "Routledge Studies in Environmental Justice",
    type: "Edited book",
    category: "Environmental justice & law",
    creators: "Edited by Malene K. Brandshaug and Axel Borchgrevink, with chapters by Miriama Cribb, Catalina Vallejo Piedrahíta, John Andrew McNeish, Jenny Moreno Socha, Arlinton Cuesta Mosquera, Daniel Alfonso León, Kavita Upadhyay, Nataly Montoya-Restrepo, Camilo Arango Duque and Julián Gaviria Mira",
    publisher: "Routledge, an imprint of the Taylor & Francis Group, Abingdon, Oxon and New York",
    year: 2026,
    pages: 245,
    fileSizeMb: 6.7,
    language: "English",
    isbn: "978-1-003-58120-8",
    doi: "10.4324/9781003581208",
    sourceUrl: "https://doi.org/10.4324/9781003581208",
    licence: CC_BY_NC_ND_4,
    terms: null,
    rightsHolder: "© 2026 selection and editorial matter, Malene K. Brandshaug and Axel Borchgrevink; individual chapters, the contributors",
    coverKind: "tile",
    coverCredit: TILE_COVER_CREDIT,
    thirdPartyNotice:
      "Per the publisher, the Creative Commons licence applies to the Open Access version of the book; any third-party material in it is not included in the licence unless a credit line says otherwise. This is a NoDerivatives licence: Eleventh Press shows the book unchanged and does not adapt, excerpt or translate it, and its Editorial Takeaways are separate commentary, not a version of the book. The Routledge and Taylor & Francis names and logos are trademarks of their owners. Routledge and the authors have not reviewed this listing, and no endorsement of Eleventh Press is suggested or implied.",
    summary:
      "Comparative research on what it means for a river to be a legal person, drawing on the Whanganui in Aotearoa New Zealand, the Atrato in Colombia and the Ganga and Yamuna in India.",
    description: [
      "In recent years courts and parliaments in Aotearoa New Zealand, Colombia and India have declared rivers to be legal persons. This edited collection, based on comparative ethnographic research, asks what those decisions have meant in practice for the Whanganui River, the Río Atrato, the Ganga and the Yamuna, and for the people who live by them.",
      "The first chapters take each case in turn, covering its history, institutional setting, the actors and interests involved and the outcomes of the legal decisions. Later chapters compare the cases across legal pluralism, the struggles of Indigenous peoples, ethnic minorities and marginalised groups, and different understandings of how people, rivers and nature are related.",
      "The book closes by placing the cases in global trends, weighing human rights against the rights of nature, and arguing for a broad idea of riverine rights that includes those who live by the river. It was written by an interdisciplinary team from anthropology, law, history, political science, management studies and water science, many from the case study countries.",
    ],
    highlights: [
      "Case chapters on the Whanganui, the Atrato, and the Ganga and Yamuna",
      "Comparative chapters on legal pluralism and Indigenous rights",
      "How human rights and the rights of nature meet and conflict",
      "A case for riverine rights that include the people who live by the river",
    ],
    audience:
      "Researchers and students in law, anthropology, geography and environmental studies, plus policymakers, lawyers, activists and communities working on the rights of nature and water governance.",
    citation:
      "Brandshaug, M. K. and Borchgrevink, A. (eds.) 2026. The Politics of Riverine Rights: Environmental Struggles in Aotearoa New Zealand, Colombia and India. Routledge Studies in Environmental Justice. Abingdon and New York: Routledge. https://doi.org/10.4324/9781003581208",
    pdfPath: "/open-resources/the-politics-of-riverine-rights-2026.pdf",
    coverPath: "/open-resources/covers/the-politics-of-riverine-rights-2026.webp",
  },
  {
    slug: "evaluating-environment-in-international-development-2021",
    org: "Routledge",
    title: "Evaluating Environment in International Development",
    subtitle: "Second Edition",
    type: "Edited book",
    category: "Environmental evaluation",
    creators: "Edited by Juha I. Uitto, with chapters by Rob D. van den Berg, Andy Rowe, Hazel Todd, David Todd and other contributors",
    publisher: "Routledge, an imprint of the Taylor & Francis Group, Abingdon, Oxon and New York",
    year: 2021,
    pages: 346,
    fileSizeMb: 7.6,
    language: "English",
    isbn: "978-1-003-09482-1",
    sourceUrl: "https://doi.org/10.4324/9781003094821",
    licence: CC_BY_NC_ND_4,
    terms: null,
    licenceSource:
      "The imprint page states that the Open Access version of the book is available under a Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 licence. The DOI link above follows Taylor & Francis's pattern for e-book ISBNs; the PDF itself does not print a DOI.",
    rightsHolder: "© 2021 selection and editorial matter, Juha I. Uitto; individual chapters, the contributors",
    coverKind: "tile",
    coverCredit: TILE_COVER_CREDIT,
    thirdPartyNotice:
      "This is a NoDerivatives licence: Eleventh Press shows the book unchanged and does not adapt, excerpt or translate it, and its Editorial Takeaways are separate commentary, not a version of the book. Chapters, figures and quotations from other sources remain the property of their owners and are not covered by the licence unless the book says so. The Routledge and Taylor & Francis names and logos are trademarks of their owners. Routledge and the authors have not reviewed this listing, and no endorsement of Eleventh Press is suggested or implied.",
    summary:
      "How leading international organisations, aid agencies and not-for-profits evaluate environmental and sustainability work in developing countries, updated for the 2030 Agenda and the Sustainable Development Goals.",
    description: [
      "Evaluation gives decision-makers the evidence they need to judge whether environmental and development efforts work. This second edition, edited by Juha I. Uitto, who directs the Independent Evaluation Office of the Global Environment Facility, brings together approaches and experiences from international organisations, not-for-profits and multilateral and bilateral aid agencies.",
      "It goes beyond single projects and programmes to examine normative work on the environment and the environmental effects of economic and social development. Part I sets out the concepts, including environment and poverty as a global public goods question, evaluation at the nexus of sustainable development, and the links between poverty, climate change and disaster risk. Part II covers methods and cases, from big data and geospatial approaches to meta-analysis of climate mitigation evaluations, theory-of-change approaches and evaluations of small grants, transboundary aquifers, disaster risk management and agricultural research.",
      "The new edition reflects the 2030 Agenda for Sustainable Development, recent climate change research and the implications of the 2020 pandemic.",
    ],
    highlights: [
      "Concepts: global public goods, the sustainable development nexus, and poverty, climate and disaster risk",
      "Methods: big data and geospatial tools, meta-analysis and theory-of-change approaches",
      "Cases from the Global Environment Facility, UNDP, CGIAR and regional programmes",
      "Updated for the SDGs, climate change research and the 2020 pandemic",
    ],
    audience:
      "Evaluators, development and environment practitioners, international organisations and NGOs, and students and scholars of environmental studies, development, sustainable development and evaluation.",
    citation:
      "Uitto, J. I. (ed.) 2021. Evaluating Environment in International Development. Second edition. Abingdon and New York: Routledge. https://doi.org/10.4324/9781003094821",
    pdfPath: "/open-resources/evaluating-environment-in-international-development-2021.pdf",
    coverPath: "/open-resources/covers/evaluating-environment-in-international-development-2021.webp",
  },
  {
    slug: "what-makes-or-breaks-a-democracy-2026",
    org: "Central European University Press",
    title: "What Makes or Breaks a Democracy",
    subtitle: "Lessons from Hungary",
    type: "Book",
    category: "Democracy & politics",
    creators: "András Schweitzer",
    publisher: "Central European University Press, Budapest–Vienna–New York–Amsterdam, with Amsterdam University Press",
    year: 2026,
    pages: 190,
    fileSizeMb: 5.5,
    language: "English",
    isbn: "978 90 4857 932 7",
    doi: "10.5117/9789048579310",
    sourceUrl: "https://doi.org/10.5117/9789048579310",
    licence: CC_BY_NC_ND_4,
    terms: null,
    rightsHolder: "© András Schweitzer / Amsterdam University Press B.V. | Central European University Press, 2026",
    coverKind: "tile",
    coverCredit: TILE_COVER_CREDIT,
    funding:
      "An electronic version is freely available thanks to the libraries supporting CEU Press's Opening the Future model.",
    thirdPartyNotice:
      "This is a NoDerivatives licence: Eleventh Press shows the book unchanged and does not adapt, excerpt or translate it, and its Editorial Takeaways are separate commentary, not a version of the book. The publisher's imprint also states that no part of the book may be used or reproduced for the purpose of training artificial intelligence technologies or systems; Eleventh Press does not use it for that. The cover photograph (credited to a Pixabay contributor) is not reproduced here. Central European University Press and the author have not reviewed this listing, and no endorsement of Eleventh Press is suggested or implied.",
    summary:
      "A study of Hungary's democratic ups and downs since 1989, tracing seven factors, from political agency and the constitution to the economy, communication and culture, to draw lessons for building and keeping a democracy.",
    description: [
      "Hungary moved quickly and peacefully to democracy in 1989, then saw it gradually dismantled after 2010 under a hybrid regime that called itself the System of National Cooperation. The author, who has followed the country's transformation since it began, asks what made the democracy fragile and what can be learned from it.",
      "The book examines seven factors in turn: political agency, the constitutional setup, economic performance, the international environment, political communication, political ideology and social culture. A conclusion weighs their causes, blunders and lessons, and an epilogue considers the April 2026 election that ended the Orbán government, which the author describes in the preface as a peaceful turnaround.",
      "Although it centres on Hungary, the lessons are written for readers in many places who want to understand how democracies are made, kept and lost.",
    ],
    highlights: [
      "Seven factors behind Hungary's democratic rise and decline",
      "Why constitutional guardrails matter, and how they were broken",
      "How political communication and ideology shaped the downturn",
      "Lessons for building and maintaining a democracy elsewhere",
    ],
    audience:
      "Researchers and students of political science, comparative politics and European studies, journalists, civil society groups and anyone interested in the resilience of democratic institutions.",
    citation:
      "Schweitzer, A. 2026. What Makes or Breaks a Democracy: Lessons from Hungary. Amsterdam: Amsterdam University Press / Central European University Press. https://doi.org/10.5117/9789048579310",
    pdfPath: "/open-resources/what-makes-or-breaks-a-democracy-2026.pdf",
    coverPath: "/open-resources/covers/what-makes-or-breaks-a-democracy-2026.webp",
  },
  {
    slug: "negotiating-bioethics-2013",
    org: "Routledge",
    title: "Negotiating Bioethics",
    subtitle: "The governance of UNESCO's Bioethics Programme",
    series: "Genetics and Society",
    type: "Book",
    category: "Bioethics & global governance",
    creators: "Adèle Langlois",
    publisher: "Routledge, an imprint of the Taylor & Francis Group, Abingdon, Oxon and New York",
    year: 2013,
    pages: 212,
    fileSizeMb: 1.9,
    language: "English",
    isbn: "978-0-203-10179-7",
    sourceUrl: "https://doi.org/10.4324/9780203101797",
    licence: CC_BY_NC_ND_3,
    terms: null,
    licenceSource:
      "The imprint page states that a PDF version is available free in Open Access under a Creative Commons Attribution-Non Commercial-No Derivatives 3.0 licence. The DOI link above follows Taylor & Francis's pattern for e-book ISBNs; the PDF itself does not print a DOI.",
    rightsHolder: "© 2013 Adèle Langlois",
    coverKind: "tile",
    coverCredit: TILE_COVER_CREDIT,
    funding:
      "The author's doctoral research and follow-up project were funded by the Wellcome Trust (grant refs 075315 and 096024), with further support from Innogen, the Open University and the University of Lincoln.",
    thirdPartyNotice:
      "This is a NoDerivatives licence: Eleventh Press shows the book unchanged and does not adapt, excerpt or translate it, and its Editorial Takeaways are separate commentary, not a version of the book. UNESCO is the subject of this study, not its publisher: the views in it are the author's and not UNESCO's, and Eleventh Press is not affiliated with UNESCO. The Routledge and Taylor & Francis names and logos are trademarks of their owners. Routledge and the author have not reviewed this listing, and no endorsement of Eleventh Press is suggested or implied.",
    summary:
      "A study of how UNESCO's Bioethics Programme negotiated and put into practice its declarations on human genetics and bioethics, based on fieldwork in Kenya, South Africa, France and the UK.",
    description: [
      "UNESCO's Bioethics Programme was set up in 1993 and has since adopted three declarations on human genetics and bioethics (1997, 2003 and 2005), run training programmes around the world and debated an international convention on human reproductive cloning. This book asks whether it is an effective forum for making decisions on bioethics and for making sure ethical practice follows.",
      "It uses a global governance framework to look at two sides of the programme, deliberation and implementation, at international and national levels. The research draws on fieldwork among policy-makers, geneticists, ethicists, civil society representatives and industry professionals, with national case studies in Kenya and South Africa.",
      "Along the way it asks how relations between developed and developing countries can be made more equal, who should take part in global decisions, how far universal norms can be adapted to local contexts and how states can be helped to implement international norms.",
    ],
    highlights: [
      "How three UNESCO declarations on genetics and bioethics were negotiated",
      "Whether formally equal states take part on equal terms",
      "How the declarations were received in Kenya and South Africa",
      "The cloning debate and pragmatic suggestions for better governance",
    ],
    audience:
      "Students and scholars of politics, sociology, science and technology studies, bioethics, anthropology, international relations and public health, and policy-makers working on research ethics.",
    citation:
      "Langlois, A. 2013. Negotiating Bioethics: The governance of UNESCO's Bioethics Programme. Genetics and Society. Abingdon and New York: Routledge. https://doi.org/10.4324/9780203101797",
    pdfPath: "/open-resources/negotiating-bioethics-2013.pdf",
    coverPath: "/open-resources/covers/negotiating-bioethics-2013.webp",
  },
  {
    slug: "the-question-of-emergence-2026",
    org: "Routledge",
    title: "The Question of Emergence",
    subtitle: "Sociology vs. Physics",
    series: "Routledge Studies in Critical Realism",
    type: "Book",
    category: "Philosophy of science & social theory",
    creators: "Douglas V. Porpora",
    publisher: "Routledge, an imprint of the Taylor & Francis Group, Abingdon, Oxon and New York",
    year: 2026,
    pages: 148,
    fileSizeMb: 2.2,
    language: "English",
    isbn: "978-1-003-64959-5",
    doi: "10.4324/9781003649595",
    sourceUrl: "https://doi.org/10.4324/9781003649595",
    licence: CC_BY_4,
    terms: null,
    rightsHolder: "© 2026 Douglas V. Porpora",
    coverKind: "tile",
    coverCredit: TILE_COVER_CREDIT,
    thirdPartyNotice:
      "Per the publisher, any third-party material in the book is not included in the Creative Commons licence unless a credit line says otherwise. The Routledge and Taylor & Francis names and logos are trademarks of their owners. Routledge and the author have not reviewed this listing, and no endorsement of Eleventh Press is suggested or implied.",
    summary:
      "A critical realist argument that the mystery of emergence, the idea that wholes show properties their parts lack, disappears once causality is understood as powers rather than laws.",
    description: [
      "Do higher-level things, such as human choices and social structures, reduce to the behaviour of the most basic physical elements, or do new forms of causality emerge as atoms combine into molecules and molecules into cells and societies? This book takes the debate between physicalist reductionism and emergentism as its subject and defends emergentism.",
      "From a critical realist perspective, it argues that the mystery attached to emergence is an artefact of the Humean covering-law model of causality that both reductionists and emergentists have assumed. Replacing it with a powers view of causality removes the mystery and lets emergence be traced across the levels from physics to social behaviour.",
      "The chapters move from laws and physicalist reductionism to powers, ontological emergence, the difference between one-off and level emergence, and social powers, social wholes and downward causation. The author argues that this gives sociology, rather than physics, a claim to be the queen of the sciences.",
    ],
    highlights: [
      "The dispute between reductionism and emergentism, set out plainly",
      "From laws to causal powers as the way out of the mystery",
      "One-off versus level emergence, from physics to society",
      "Social powers, social wholes and downward causation",
    ],
    audience:
      "Critical realists, philosophers of science and mind, social theorists and social scientists, and theoretically minded practitioners in chemistry, biology and psychology.",
    citation:
      "Porpora, D. V. 2026. The Question of Emergence: Sociology vs. Physics. Routledge Studies in Critical Realism. Abingdon and New York: Routledge. https://doi.org/10.4324/9781003649595",
    pdfPath: "/open-resources/the-question-of-emergence-2026.pdf",
    coverPath: "/open-resources/covers/the-question-of-emergence-2026.webp",
  },
  {
    slug: "creating-future-people-2024",
    org: "Routledge",
    title: "Creating Future People",
    subtitle: "The Science and Ethics of Genetic Enhancement",
    type: "Book",
    category: "Genetics & ethics",
    creators: "Jonathan Anomaly",
    publisher: "Routledge, an imprint of the Taylor & Francis Group, New York and Abingdon, Oxon",
    year: 2024,
    pages: 175,
    fileSizeMb: 3.0,
    language: "English",
    isbn: "978-1-003-46426-6",
    doi: "10.4324/9781003464266",
    sourceUrl: "https://doi.org/10.4324/9781003464266",
    licence: CC_BY_NC_ND_4,
    terms: null,
    rightsHolder: "© 2024 Jonathan Anomaly",
    coverKind: "tile",
    coverCredit: TILE_COVER_CREDIT,
    thirdPartyNotice:
      "This is a NoDerivatives licence: Eleventh Press shows the book unchanged and does not adapt, excerpt or translate it, and its Editorial Takeaways are separate commentary, not a version of the book. The cover image is credited to Getty and is not reproduced here. The book argues positions on contested ethical questions; they are the author's own, and Eleventh Press neither endorses nor disputes them. The book's back-cover biography states that the author works with a company that offers polygenic embryo screening. The Routledge and Taylor & Francis names and logos are trademarks of their owners. Routledge and the author have not reviewed this listing, and no endorsement of Eleventh Press is suggested or implied.",
    summary:
      "A short primer on how advances in genetics may let parents influence their children's traits, and on the moral and coordination problems that embryo selection and gene editing raise.",
    description: [
      "Pre-implantation genetic testing already lets parents screen embryos for some inherited diseases, and the book looks ahead to selection for complex traits using polygenic scores. This second edition explains the science of gene editing and embryo selection and the moral questions they raise, with new coverage of embryo selection to reduce the risk of genetic disease.",
      "Its distinctive argument is that once embryo selection for complex traits becomes possible, everyone will have an interest in the traits others select, creating coordination problems that earlier writers on genetic enhancement did not consider. It also takes seriously the diversity of parents' preferences and the limits policymakers face in regulating a global market for reproductive technology.",
      "Chapters take up smart, good, pretty, healthy and synthetic people, with appendices on the Ultimatum Game, the Prisoner's Dilemma and the Public Goods Game, and close by asking how genetic engineering may transform humanity.",
    ],
    highlights: [
      "How gene editing and embryo selection work, in plain terms",
      "Why parents' choices can create coordination problems for everyone",
      "Chapters on intelligence, morality, appearance, health and synthetic biology",
      "A glossary and short appendices on game theory",
    ],
    audience:
      "Students and scholars of bioethics, philosophy, genetics and public policy, clinicians and policymakers, and general readers curious about reproductive genetics.",
    citation:
      "Anomaly, J. 2024. Creating Future People: The Science and Ethics of Genetic Enhancement. Second edition. New York and Abingdon: Routledge. https://doi.org/10.4324/9781003464266",
    pdfPath: "/open-resources/creating-future-people-2024.pdf",
    coverPath: "/open-resources/covers/creating-future-people-2024.webp",
  },
];

/** The publisher's terms of use shown with a title, or null when none apply beyond the licence. */
export function termsFor(r: OpenResource): { label: string; url: string } | null {
  if (r.terms !== undefined) return r.terms;
  return { label: "terms of use of the UNESCO Open Access Repository", url: r.termsUrl ?? UNESCO_OA_TERMS_URL };
}

/** Publishing organisation of a title, for filtering. */
export function orgOf(r: OpenResource): string {
  return r.org ?? "UNESCO";
}

/** Publishers in the collection, in catalogue order. */
export const OPEN_RESOURCE_ORGS: string[] = [...new Set(OPEN_RESOURCES.map(orgOf))];

/** True when the title's licence forbids commercial use. */
export function isNonCommercial(r: OpenResource): boolean {
  return r.licence.code.includes("NC");
}

/** True when Eleventh Press links to the publisher's copy instead of redistributing the PDF. */
export function isPublisherHosted(r: OpenResource): boolean {
  return r.pdfHost === "publisher";
}
