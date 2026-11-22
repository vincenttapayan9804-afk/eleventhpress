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
 *   the licence, exactly as the publication itself states;
 * - covers whose image belongs to a third party carry `coverRights`: an
 *   explicit copyright attribution to the owner plus a restrictions notice
 *   for readers. Where the publication does not state the image's licence,
 *   it is treated as all rights reserved (the conservative reading).
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
    fileSizeMb: 3.8,
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
];
