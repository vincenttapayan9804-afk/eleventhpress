/**
 * Open Resources: third-party open-access publications that Eleventh Press
 * redistributes, unmodified, under their own open licences.
 *
 * These are NOT Eleventh Press titles. They keep their original publisher,
 * rights holder, ISBN/DOI and licence, and they are shown and credited as
 * such. Every entry was transcribed from the publication's own imprint page
 * (title verso). The PDFs are served as received (public/open-resources/)
 * and the covers are renderings of each PDF's own first page.
 *
 * Licence obligations reflected in the UI (src/components/open-resources-section.tsx):
 * - attribution to the rights holder, with the licence named and linked;
 * - the work is distributed unchanged, free of charge (required for the
 *   NonCommercial licence) and without implying UNESCO endorsement;
 * - third-party images (e.g. stock cover photos) are flagged as outside
 *   the licence, exactly as the publication itself states.
 */

export type OpenLicence = {
  code: string;
  name: string;
  url: string;
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
  thirdPartyNotice?: string;
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

export const UNESCO_OA_TERMS_URL = "https://www.unesco.org/en/open-access/cc-sa";

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
    fileSizeMb: 2.4,
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
    fileSizeMb: 2.7,
    language: "English",
    isbn: "978-92-803-1478-6",
    doi: "10.54673/ZHOX5913",
    sourceUrl: unesdoc("400087"),
    licence: CC_BY_NC_SA_4_IGO,
    rightsHolder: "© UNESCO / GPE EOL 2026",
    coverCredit: "Cover photo: Shutterstock. Typesetting: Suzanne Grossmann.",
    thirdPartyNotice:
      "The cover photograph is a third-party stock image and is not covered by the publication's open licence; it appears here only as part of the unmodified original publication.",
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
    fileSizeMb: 3.8,
    language: "English",
    issn: "2220-2285 (print); 2220-2293 (online)",
    sourceUrl: unesdoc("399990"),
    licence: CC_BY_SA_3_IGO,
    rightsHolder: "© UNESCO 2026",
    coverCredit: "Cover illustration: © Sylvie Serprix. Design: Jacqueline Gensollen-Bloch.",
    thirdPartyNotice:
      "Per the publisher, the open licence applies exclusively to the texts. Images, including the cover illustration, are not openly licensed and require prior permission for any separate use; they appear here only as part of the unmodified original issue.",
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
    thirdPartyNotice:
      "Per the publisher, the Shutterstock cover image is not covered by the CC BY-SA licence and may not be used or reproduced separately without the copyright holder's permission; it appears here only as part of the unmodified original publication.",
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
];
