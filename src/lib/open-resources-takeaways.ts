/**
 * Eleventh Press Editorial Takeaways for the Open Resources collection
 * (src/lib/open-resources.ts).
 *
 * This is Eleventh Press's own commentary, kept apart from the catalogue
 * data on purpose: the catalogue is transcribed from each publication's
 * imprint page, while these notes are our independent reading of it.
 *
 * Editorial rules (so the notes stay commentary, not a copy or adaptation):
 * - written in our own words; no passages copied from the publication;
 * - figures are reported as the publication gives them, to point readers
 *   to the original, never to replace it;
 * - always labelled as Eleventh Press's view, with the no-endorsement
 *   notice (TAKEAWAYS_NOTICE) shown alongside, in the UI and the PDF;
 * - no third-party images (covers and photos are excluded from the
 *   publications' open licences), so the PDF edition uses none.
 *
 * Shown on the Eleventh Press platform only, like the Resources blog:
 * tenant sites would otherwise appear to author our commentary.
 */
import { withTrademark } from "@/lib/brand-mark";
import type { OpenResource } from "@/lib/open-resources";

export type EditorialTakeaway = { title: string; text: string };

export type EditorialTakeaways = {
  /** Eleventh Press document code, e.g. "EP-OR-01". */
  code: string;
  takeaways: EditorialTakeaway[];
  whyItMatters: string;
  researchQuestions: string[];
  /** ISO date the notes were written or last revised. */
  preparedOn: string;
};

export const TAKEAWAYS_AUTHOR = withTrademark("Editorial Office, Eleventh Press International Publishing");

/** Shown with every set of takeaways, on the page and in the PDF. */
export const TAKEAWAYS_NOTICE =
  "These takeaways are Eleventh Press's own independent reading of the publication, written in our own words. " +
  "They are not written, reviewed or endorsed by UNESCO, the co-publishers or the authors, and they do not " +
  "replace the original. Figures are reported as the publication gives them; for exact wording, data and " +
  "context, read the full publication.";

const PREPARED = "2026-11-22";

export const OPEN_RESOURCE_TAKEAWAYS: Record<string, EditorialTakeaways> = {
  "sdg4-scorecard-2026": {
    code: "EP-OR-01",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Countries are judged against their own commitments",
        text: "Instead of one global 100% target, the Scorecard measures each country against the national benchmarks it set itself. That approach has spread fast: 170 countries (83%) had set at least some targets by 2026, up from 58% in 2021.",
      },
      {
        title: "Primary and lower secondary are moving; upper secondary is not",
        text: "Countries with targets at the primary and lower secondary levels are more likely to be progressing quickly, or to have already arrived. At upper secondary, and for the gender gap in secondary completion, slow progress or stagnation is more common.",
      },
      {
        title: "Completion keeps rising even while out-of-school rates stall",
        text: "The report resolves an apparent contradiction: completion rates have climbed steadily since 1990 because far fewer students now repeat grades, which makes systems more efficient even when attendance figures look flat.",
      },
      {
        title: "Many young people finish late",
        text: "In low- and lower-middle-income countries, late enrolment and repetition mean students reach the end of primary and lower secondary school years later than expected, a hidden cost that headline completion rates can mask.",
      },
      {
        title: "Data gaps are still the biggest blind spot",
        text: "For learning outcomes, school connectivity and teachers, at least six in ten countries lack enough data to establish a trend, so progress on some of the most important indicators simply cannot be judged.",
      },
    ],
    whyItMatters:
      "The Scorecard is a model of fair measurement: progress is read against what each country promised, not against a single yardstick. For researchers, it also marks where evidence is thinnest. Studies that help countries build reliable, affordable data on learning, teachers and connectivity would fill the gaps the report itself identifies.",
    researchQuestions: [
      "Does the act of setting a national benchmark speed up progress, and under what conditions?",
      "Why does upper secondary completion lag even where it is growing fastest, and which policies close the gap?",
      "How can countries with no trend data on learning outcomes build reliable measures at low cost?",
    ],
  },
  "engaging-civil-society-education-policy": {
    code: "EP-OR-02",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Reforms last longer when communities help make them",
        text: "Planning with civil society, not just for the public, makes education reforms more legitimate and more likely to work. Civil society organizations keep attention on the learners most affected: girls, remote communities and other vulnerable groups.",
      },
      {
        title: "Local Education Groups work when they are set up to",
        text: "Across 25 organizations in 21 countries, civil society is most active in planning and monitoring and less involved in budgeting. Its influence depends on how the group is run, the quality of the partnership and the organization's own capacity.",
      },
      {
        title: "The barriers are structural",
        text: "Weak political will, little time for real dialogue, unstable structures, unclear mandates and thin funding and staffing all limit what civil society can contribute, even when it is formally at the table.",
      },
      {
        title: "Budgets: strong at the start, weak at the finish",
        text: "The Indian cases show organizations shaping budget preparation and advocacy but dropping away during implementation, held back by the lack of a formal mandate, strict rules and poor access to fiscal data. Making complex budget data understandable to the public is one of their most valuable roles.",
      },
      {
        title: "Trust turns watchdogs into partners",
        text: "In the Philippine cases, a shared sense of urgency and the Department of Education's openness shifted civil society's role from compliance checker to strategic partner, from the Alternative Learning System to child protection.",
      },
    ],
    whyItMatters:
      "Evidence is most useful when the people it affects help shape it. This volume gives researchers practical models for working with civil society on planning, finance and monitoring, and its Philippine case studies speak directly to readers and institutions in the Philippines.",
    researchQuestions: [
      "Which Local Education Group arrangements best predict real civil society influence on decisions?",
      "How can open budget data be made usable enough for citizens to follow spending through to implementation?",
      "What keeps government–civil society partnerships working when civic space shrinks?",
    ],
  },
  "unesco-courier-2026-4": {
    code: "EP-OR-03",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "International cooperation has a track record",
        text: "The issue returns to the campaign to save the Nubian monuments, including Abu Simbel, as an early proof that nations can treat heritage as belonging to all humanity, and argues the same logic applies to today's shared challenges.",
      },
      {
        title: "Shared resources need shared science",
        text: "The Guarani Aquifer, one of the world's largest freshwater reserves, lies beneath Argentina, Brazil, Paraguay and Uruguay. A four-country agreement and joint monitoring show how science can underpin fair sharing of a resource no single country controls.",
      },
      {
        title: "A right needs a remedy",
        text: "Work by the UNESCO Chair on the Right to Education in Africa shows how legal action can turn the right to education from a promise on paper into real improvements in schools.",
      },
      {
        title: "Judgment must stay human",
        text: "A judge of the Inter-American Court of Human Rights welcomes UNESCO's AI training for judges but warns that justice cannot be handed over to an algorithm: the tools save time, yet their limits and biases must be understood.",
      },
      {
        title: "New frontiers need new ethics",
        text: "UNESCO's Recommendation on the Ethics of Neurotechnology, adopted in November 2025, is presented as the first global standard to set safeguards for brain technologies, a field that touches freedom of thought, autonomy and mental privacy.",
      },
    ],
    whyItMatters:
      "The Courier turns policy into human stories, which makes it valuable teaching material on international cooperation, research ethics and responsible technology. Note that only its texts are openly licensed: its photographs and illustrations need their owners' permission for any separate use.",
    researchQuestions: [
      "What governance features make cross-border resource agreements like the Guarani Aquifer's last?",
      "What training do judges need to use AI tools safely, and how should courts disclose their use?",
      "How can the neurotechnology Recommendation's safeguards for mental privacy be written into national law?",
    ],
  },
  "open-solutions-brief-03-right-to-know": {
    code: "EP-OR-04",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Openness works best as one system",
        text: "Treating open educational resources, open access, open science, open data and open-source software as separate policy areas limits their public value. The brief calls for integrated frameworks that span the whole knowledge lifecycle.",
      },
      {
        title: "Universities are the hinge",
        text: "As major producers, curators and users of publicly funded knowledge, higher education institutions are best placed to connect research, teaching and digital infrastructure and to lead integrated open policies.",
      },
      {
        title: "Open by default, with respect for Indigenous knowledge",
        text: "Publicly funded materials, data and software should be open by default, but Indigenous knowledge and cultural materials may need to be governed on the community's own terms rather than under standard open licences.",
      },
      {
        title: "Reward what you want to see",
        text: "Research assessment should recognise open resources, datasets and research software, and judge quality and societal relevance rather than journal-level metrics, in line with DORA and CoARA commitments.",
      },
      {
        title: "AI must respect licences and authorship",
        text: "Clear rules are needed on how AI interacts with open licences and intellectual property, alongside better procurement frameworks and dedicated offices to govern open solutions within institutions.",
      },
    ],
    whyItMatters:
      "This brief bears directly on how authors share their work: retaining their rights, depositing in trusted repositories with persistent identifiers and making outputs reusable. Its call for AI that respects licences and authorship is one Eleventh Press applies to its own work, including these notes, which credit and link the original rather than reproduce it.",
    researchQuestions: [
      "How can promotion and tenure criteria fairly count open educational resources and research software?",
      "What licensing terms let AI systems use open content while protecting attribution and authorship?",
      "How should “open by default” policies be designed to respect Indigenous data sovereignty?",
    ],
  },
  "open-solutions-brief-04-diamond-open-access": {
    code: "EP-OR-05",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "No fee to read, no fee to publish",
        text: "Diamond Open Access treats scholarly knowledge as a public good: neither readers nor authors pay. It is defined by non-profit ownership and scholarly governance, though service functions can still be outsourced.",
      },
      {
        title: "Open access is not yet equitable",
        text: "More than half of scholarly articles are now open access, but the brief reports that about 70% of open-access publishing is controlled by commercial publishers and only about 13% is Diamond. Author fees and national deals leave out many researchers in lower- and middle-income countries and those without an institution.",
      },
      {
        title: "Language is an equity issue",
        text: "Commercial open access reaches the world but mostly in English. Diamond publishing supports research in national languages, keeping knowledge connected to the communities it serves.",
      },
      {
        title: "Sustainability needs shared infrastructure",
        text: "The skills to run journals well are unevenly spread. The brief argues for coordinated national and regional capacity centres and shared, preferably open-source, infrastructure.",
      },
      {
        title: "A clear agenda for action",
        text: "Recommendations cover policy and funding, governance and sustainability, international cooperation and professional capacity, including the Diamond OA Standard, with an action matrix for each stakeholder group.",
      },
    ],
    whyItMatters:
      "For any publisher, Eleventh Press included, the brief is a useful benchmark: who pays, who governs and who is left out. Its emphasis on persistent identifiers, open metadata and long-term preservation matches the practices that make research findable and lasting.",
    researchQuestions: [
      "What funding mixes keep Diamond journals sustainable over a decade or more?",
      "How does publishing in national languages affect the reach and reuse of research from the Global South?",
      "Can shared infrastructure lower costs for small, scholar-led journals without lowering quality?",
    ],
  },
  "education-and-justice-2026": {
    code: "EP-OR-06",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "The right to education is often unenforceable",
        text: "It appears in 82% of national constitutions but can be taken to court in only 55% of countries, so many violations have no remedy.",
      },
      {
        title: "Exclusion often starts with paperwork and status",
        text: "One in five children under five has no birth registration (one in two in sub-Saharan Africa), which can block schooling. Nearly half of refugee children are out of school, and some 260,000 children are held in detention.",
      },
      {
        title: "Education helps prevent crime",
        text: "The report gathers strong evidence: in Sweden, each extra year of schooling lowered the chance of a violent-crime conviction by 10%, and education in prison reduces reoffending, yet one in four countries has no dedicated rehabilitation strategy.",
      },
      {
        title: "Peace agreements rarely mention schooling",
        text: "Of 2,257 peace agreements signed since 1990, only 2.5% mention the right to education, even though people rank education among the most important factors for peace.",
      },
      {
        title: "Legal empowerment is a learning task",
        text: "Around 1.4 billion people face barriers to resolving legal problems, and legal jargon shuts many out. The recommendations range from whole-school approaches and teacher preparation to legal education and people-centred training for justice workers, with SDG 4 and SDG 16 monitored together.",
      },
    ],
    whyItMatters:
      "The report links two goals usually studied apart, education and justice, and opens a rich interdisciplinary agenda across education, law and criminology. Its call for plain-language legal information is a standard every research communicator can apply.",
    researchQuestions: [
      "Does making the right to education enforceable in court improve access and quality, and for whom?",
      "Which forms of prison education most reduce reoffending in low- and middle-income countries?",
      "How can legal information be written so that people with low literacy can use it?",
    ],
  },
  "state-of-education-asean-2026": {
    code: "EP-OR-07",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "From access to learning",
        text: "In the first ASEAN-wide review of education from early childhood to adult learning, the central message is that enrolling more learners is no longer enough: systems must make sure participation leads to real learning.",
      },
      {
        title: "Exclusion has moved up the ladder",
        text: "Upper secondary education now accounts for more than half of out-of-school adolescents and youth, while foundational literacy and numeracy remain the most urgent challenge.",
      },
      {
        title: "The early years are the biggest opportunity",
        text: "Provision for children under three is extremely limited, and children from disadvantaged homes, who benefit most, are the least likely to reach good early childhood services.",
      },
      {
        title: "Lifelong learning is the weakest link",
        text: "Youth literacy is near universal, but older adults lag far behind, adult participation in skills training is very low and non-formal education is under-resourced.",
      },
      {
        title: "Funding and equity are built into the system",
        text: "Public education spending has stagnated or fallen in many countries, and disadvantage by income, gender, location, disability, migration status and ethnicity is embedded in system design. Ten strategic directions follow, including AI readiness and better data.",
      },
    ],
    whyItMatters:
      "For researchers in the Philippines and across Southeast Asia, this is a shared evidence base and agenda for 2026–2030. Its repeated warnings about missing disaggregated data mark exactly where new research would be most useful.",
    researchQuestions: [
      "Which upper secondary pathways (flexible, vocational or second-chance) best reduce dropout in ASEAN countries?",
      "What keeps adult participation in skills training so low, and what raises it?",
      "How can disaggregated education data be harmonised across the 11 ASEAN Member States?",
    ],
  },
  "universities-lifelong-learning-inclusive-societies": {
    code: "EP-OR-08",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Universities have a third mission",
        text: "Beyond teaching and research, universities are increasingly expected to serve their communities, making lifelong learning real for people of every age and background.",
      },
      {
        title: "Older adults learn for many reasons",
        text: "Six later-life programmes, from Lagos to Belo Horizonte, show older learners seeking intellectual enrichment, social connection, well-being and work-related skills.",
      },
      {
        title: "Engagement often rests on individuals",
        text: "Unclear definitions, few metrics, unstable funding and academic reward systems that favour research mean community work frequently depends on a few committed staff.",
      },
      {
        title: "Local relevance and respect come first",
        text: "The programmes that work are shaped around each community's needs, and they take particular care where there are histories of colonisation or oppression, as the Ahfad University and University of Victoria cases show.",
      },
      {
        title: "Institutional support makes it last",
        text: "Long-term commitment and stable funding make the difference, illustrated by the University of Southeastern Philippines' higher education programme for persons deprived of liberty in Davao City Jail.",
      },
    ],
    whyItMatters:
      "The collection makes a strong case for treating community engagement as scholarly work worth recognising and funding. The University of Southeastern Philippines case is a model that Philippine universities can study closely.",
    researchQuestions: [
      "What metrics can fairly capture the value of university community engagement?",
      "How do later-life learning programmes affect older adults' well-being over time?",
      "What makes university programmes for persons deprived of liberty sustainable after release?",
    ],
  },
  "red-teaming-ai-social-good-playbook": {
    code: "EP-OR-09",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Red Teaming is not only for tech companies",
        text: "Deliberately probing a generative AI model to expose its flaws has mostly happened inside large labs. The playbook opens the method to organizations and communities, with no extra IT skills required.",
      },
      {
        title: "Two kinds of harm",
        text: "Unintended harms come from biased training data that reproduces stereotypes. Intended harms come from people using AI to automate abuse, such as deepfakes and harassment campaigns against women.",
      },
      {
        title: "Plan the people, not just the prompts",
        text: "A good exercise needs clear roles (subject experts, facilitators, technical evaluators and senior leaders), a choice between expert and public formats, and real care for participants' psychological safety.",
      },
      {
        title: "Small tests reveal real bias",
        text: "In one worked example, a model described a girl's maths ability more cautiously than a boy's with an identical record. In another, framing a request as storytelling got a model to produce insults about a woman journalist.",
      },
      {
        title: "Findings must lead somewhere",
        text: "The guide closes with how to analyse results, report them to model owners and policymakers, and answer common objections, with a sample report template.",
      },
    ],
    whyItMatters:
      "Researchers increasingly rely on AI tools to search, summarise and draft. This playbook offers a practical, low-cost way to test those tools for bias before trusting them, an approach in line with responsible AI use in research and publishing.",
    researchQuestions: [
      "How reproducible are Red Teaming findings across model versions and languages?",
      "Which safeguards best protect participants who are exposed to harmful outputs?",
      "How can community Red Teaming results be made to influence model owners' fixes?",
    ],
  },
  "mhpss-ukrainian-scientists-2026": {
    code: "EP-OR-10",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Distress is widespread",
        text: "Of 1,423 scientists and researchers surveyed, 83% showed signs of psychological distress, with anxiety more pronounced than depression.",
      },
      {
        title: "War reaches the work itself",
        text: "Only about one in twenty respondents reported no negative effect of the full-scale war on their professional work.",
      },
      {
        title: "Knowing is not the same as seeking help",
        text: "Most feel informed about mental health, yet few use professional support: stigma, cost, time and distrust stand in the way, and institutional support often exists more on paper than in practice.",
      },
      {
        title: "Peers are an untapped resource",
        text: "Research teams already support one another informally. Training people in peer-support skills may do more than launching new formal programmes.",
      },
      {
        title: "Support should be proactive and gender-responsive",
        text: "The recommendations favour prevention over crisis response, one clear source of information, self-help formats that respect scientists' preference for autonomy, and approaches that reflect the different ways women and men cope.",
      },
    ],
    whyItMatters:
      "A research system is only as strong as the well-being of its researchers. Although the study is about Ukraine, its lessons on prevention, peer support and trusted institutional help apply to any research community working under sustained pressure.",
    researchQuestions: [
      "Which peer-support training formats work best for research teams under prolonged stress?",
      "How does a long crisis affect research productivity and career decisions over time?",
      "What makes institutional mental health support trusted rather than nominal?",
    ],
  },
  "teaching-with-care-mental-health-well-being": {
    code: "EP-OR-11",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Teachers support; they do not treat",
        text: "With around one in seven adolescents living with a mental health condition, the guide is clear about the teacher's role: to protect and promote well-being and connect learners to help, not to diagnose or provide treatment.",
      },
      {
        title: "Everyday routines are mental health tools",
        text: "Safe, predictable and inclusive classrooms, positive relationships and social-emotional skills woven into ordinary lessons form the foundation (Actions 1 to 4).",
      },
      {
        title: "Notice early and link to support",
        text: "Teachers learn to recognise signs of distress across ages and genders and to connect learners with school and community services, with tools for mapping what support exists locally (Actions 5 and 6).",
      },
      {
        title: "Teacher well-being is part of the job",
        text: "Looking after their own well-being and responding to colleagues' distress are treated as core practice, not an afterthought (Actions 7 and 8).",
      },
      {
        title: "Schools cannot do it alone",
        text: "Working with families and communities and advocating for change complete the approach (Actions 9 and 10), with adaptations for different settings and a self-assessment in each module.",
      },
    ],
    whyItMatters:
      "The guide translates evidence into low-cost actions that teachers can start with straight away. For education researchers, its ten actions offer a clear framework to evaluate in real classrooms and to adapt for local contexts.",
    researchQuestions: [
      "Which of the ten actions have the greatest effect on learner well-being when applied without extra training?",
      "How can teachers be supported to spot distress early without adding to their workload?",
      "What school–community referral pathways work best in low-resource settings?",
    ],
  },
  "addressing-violent-pasts-through-education": {
    code: "EP-OR-12",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Past violence rarely stays in the past",
        text: "Histories of war, atrocity, colonialism and enslavement that go unaddressed leave divisions, trauma and injustice that can fuel renewed conflict.",
      },
      {
        title: "History education is easy to manipulate",
        text: "Because it is bound up with national identity, teaching about the past is vulnerable to propaganda, distortion and denial, and can even be used to target groups.",
      },
      {
        title: "Many perspectives, critical thinking",
        text: "The guide favours inquiry-based teaching that recognises multiple perspectives and helps learners understand how we know what we know about the past.",
      },
      {
        title: "It takes the whole system",
        text: "Policy, curricula and textbooks, teacher support, museums and memorials, civil society and international cooperation all have a role.",
      },
      {
        title: "There is no single right way",
        text: "Transparent, inclusive consultation with communities, experts and teachers matters most. Fifteen case studies, an example roadmap and a needs-assessment tool help ministries begin.",
      },
    ],
    whyItMatters:
      "Sound historical research is the best answer to distortion and denial. This guide shows how scholarship, teaching and public memory can work together, and gives researchers in history, education and peace studies a clear map of open questions.",
    researchQuestions: [
      "Which classroom approaches reduce polarization when teaching contested histories?",
      "How do memorials and museums shape young people's understanding of past violence?",
      "How can textbook revision include affected communities without causing further harm?",
    ],
  },
  "ai-answers-you-decide-mil-companion": {
    code: "EP-OR-13",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "AI shapes what we see, often invisibly",
        text: "Systems that predict, classify, decide and generate now filter much of the information people meet each day, usually without their noticing.",
      },
      {
        title: "The learner stays at the centre",
        text: "An orientation map places the learner among these systems, and five units move from the AI in everyday devices to the role learners can play in building AI futures.",
      },
      {
        title: "Informed trust, not blind trust",
        text: "Learners practise questioning what chatbots tell them, checking sources and understanding how AI is changing journalism and publishing.",
      },
      {
        title: "Rights, power and costs",
        text: "The guide covers the right to evaluate AI decisions, inequality, accountability and the energy costs of AI.",
      },
      {
        title: "No technology required to teach it",
        text: "Each section works as a standalone lesson, designed for learners aged about 13 to 15 and adaptable for others. Most activities work without learners using AI themselves.",
      },
    ],
    whyItMatters:
      "The habits this guide teaches are the same ones good research demands: verify AI output, trace claims to their sources and be open about when AI was used. It is a practical bridge between media literacy and research integrity.",
    researchQuestions: [
      "Which media literacy activities most improve learners' ability to judge AI-generated content?",
      "How does learners' trust in chatbots compare with their trust in traditional search?",
      "How can AI literacy be taught fairly where learners have limited access to devices?",
    ],
  },
  "differentiated-teaching-learning-asia-pacific": {
    code: "EP-OR-14",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "One size fits no one",
        text: "Classrooms differ in readiness, interests, preferences and backgrounds, and many learners in the region fall below minimum proficiency and risk dropping out.",
      },
      {
        title: "Start with low-stakes assessment",
        text: "Diagnostic and formative assessments let teachers build learner, group and class profiles before deciding how to adapt their teaching.",
      },
      {
        title: "A toolbox, not a script",
        text: "Strategies include universal design for learning, tiered tasks, scaffolding, jigsaw activities, learning menus, flexible grouping and learning stations.",
      },
      {
        title: "Inclusion means attention to disability, gender and culture",
        text: "The guide covers support for learners with disabilities, reducing gender and cultural bias, and adapting assessment so it is fair.",
      },
      {
        title: "Plan deliberately, use technology where it helps",
        text: "A “differentiation compass” and templates support planning, digital tools are suggested where useful, and 28 worked examples come from real lessons, many in Bhutan and Lao PDR.",
      },
    ],
    whyItMatters:
      "The guide is built for practice, which makes it ideal ground for classroom action research. Its worked examples and reflection exercises give teacher-researchers a ready structure for testing what works with their own learners.",
    researchQuestions: [
      "What is the effect of differentiated teaching on learning outcomes in large or multi-grade classes?",
      "How much planning time does differentiation take, and which tools reduce it most?",
      "How can diagnostic assessment be kept fair in multilingual classrooms?",
    ],
  },
};

export function takeawaysFor(slug: string): EditorialTakeaways | null {
  return OPEN_RESOURCE_TAKEAWAYS[slug] ?? null;
}

/** Public URL of the branded PDF edition of a title's takeaways. */
export function takeawaysPdfPath(slug: string): string {
  return `/resources/open-resources/${slug}/takeaways/pdf`;
}

/** Where the takeaways can be read online (the Open Resources section). */
export const TAKEAWAYS_ONLINE_PATH = "/books#open-resources";

/** How to cite the takeaways themselves (distinct from citing the publication). */
export function takeawaysCitation(r: OpenResource, t: EditorialTakeaways, baseUrl: string): string {
  return withTrademark(
    `Eleventh Press International Publishing. ${t.preparedOn.slice(0, 4)}. Editorial takeaways: ${r.title}${r.subtitle ? `: ${r.subtitle}` : ""} (${t.code}). ${baseUrl.replace(/\/+$/, "")}${TAKEAWAYS_ONLINE_PATH}`
  );
}
