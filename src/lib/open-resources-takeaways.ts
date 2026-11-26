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
  "They are not written, reviewed or endorsed by the publishers, co-publishers or authors of the publication, and they do not " +
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
  "oecd-digital-education-outlook-2026": {
    code: "EP-OR-15",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Better output is not the same as more learning",
        text: "The report's sharpest warning is that students who lean heavily on general-purpose chatbots can hand in stronger work while thinking less. When the mental effort that turns answers into understanding drops, performance and learning come apart.",
      },
      {
        title: "Pedagogy-first tools outperform generic chatbots",
        text: "Hybrid systems that pair generative AI with an explicit teaching model, such as Socratic tutoring or evidence-centred assessment design, show more promise than off-the-shelf assistants that simply supply answers.",
      },
      {
        title: "Use it slowly to support creativity",
        text: "The evidence it reviews suggests generative AI helps creativity most when it is used for iterative exploration and reflection, and can undermine original thinking when used to churn out instant content.",
      },
      {
        title: "Teachers should be augmented, not replaced",
        text: "Of three ways humans and AI can work together (replacement, complementarity and augmentation), the report favours augmentation, in which teachers and AI critique and refine each other's work while professional judgement stays with the teacher.",
      },
      {
        title: "Beyond the classroom: institutions, assessment and research",
        text: "Generative AI is already mapping course equivalencies for admissions and guidance, generating assessment items at scale and changing how education research is done, though the report stresses that human oversight remains essential.",
      },
    ],
    whyItMatters:
      "For universities and journals alike, the report gives an evidence-based vocabulary for AI policy: the question is not whether students and researchers use generative AI, but whether its use preserves the effort through which people learn and judge. That distinction should shape assessment design, author guidance and research-integrity rules.",
    researchQuestions: [
      "How can institutions measure the gap between AI-assisted task performance and actual learning gains?",
      "Do purpose-built educational AI tools produce better learning outcomes than general chatbots in low-resource classrooms?",
      "What forms of teacher–AI teaming preserve teacher agency in Philippine and ASEAN schools?",
    ],
  },
  "oecd-skills-in-the-ai-age-2026": {
    code: "EP-OR-16",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "AI adoption is accelerating, but unevenly",
        text: "The paper reports that the share of firms using AI in OECD countries rose from about 7% to 20% between 2021 and 2025. Large firms and start-ups lead, while small businesses are held back by cost, infrastructure and a shortage of skilled staff.",
      },
      {
        title: "Exposure is not the same as automation risk",
        text: "Highly skilled occupations such as managers, professionals and engineers are the most exposed to AI, yet the least likely to be automated. Routine low- and middle-skill jobs face the higher risk of being replaced.",
      },
      {
        title: "AI tends to complement work, but displacement is real",
        text: "AI affects jobs by automating some tasks, creating new ones and raising productivity. The evidence reviewed suggests it more often complements human labour, while workers in repetitive roles remain vulnerable.",
      },
      {
        title: "A broad skills mix is needed, not just coding",
        text: "Foundational literacy and numeracy, everyday ICT skills, scarce advanced AI skills (held by around 1% of the workforce) and complementary skills such as critical thinking, creativity and collaboration all matter.",
      },
      {
        title: "Six policy levers for governments",
        text: "The paper calls for stronger education and training, lifelong learning, an ICT and AI talent pipeline, AI literacy for everyone, employer-led training and better policy co-ordination guided by labour-market data.",
      },
    ],
    whyItMatters:
      "The paper offers a clear framework for curriculum and research planning in an AI-shaped labour market. Its distinction between exposure and automation risk is especially useful for higher education institutions deciding which programmes to redesign, and for researchers studying skills mismatch in emerging economies.",
    researchQuestions: [
      "Which occupations in the Philippines are most exposed to generative AI, and how does that differ from their automation risk?",
      "What barriers keep small and medium-sized enterprises in developing economies from adopting AI?",
      "How effective are short, modular AI-literacy programmes for adult workers?",
    ],
  },
  "world-development-report-2024-middle-income-trap": {
    code: "EP-OR-17",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Middle-income countries are in a race against time",
        text: "The report finds that the 108 middle-income countries, home to about 6 billion people, face long odds: the economies that have reached high income since 1990 together have fewer than 250 million people, and ageing, debt and protectionism make the climb harder.",
      },
      {
        title: "Two transitions, not one",
        text: "Its “3i” framework says lower-middle-income countries must add infusion, bringing in and spreading technologies from abroad, to investment; upper-middle-income countries must then add innovation, pushing out the frontier themselves.",
      },
      {
        title: "Creation, preservation and destruction must be balanced",
        text: "Drawing on Schumpeterian economics, the report argues that growth depends on letting new firms and ideas grow, preserving what works and allowing outdated arrangements to give way.",
      },
      {
        title: "Discipline incumbents and reward merit",
        text: "Powerful incumbents, from large corporations to state-owned enterprises, can add value or block it. Competition policy should welcome new entrants without coddling small firms or vilifying large ones, and talent must be developed and allocated by merit.",
      },
      {
        title: "Efficiency is the simple imperative",
        text: "The report concludes that middle-income economies must use capital, labour and energy far more efficiently, and treats crises, including climate pressures, as openings for reforms that would otherwise stall.",
      },
    ],
    whyItMatters:
      "The Philippines is a lower-middle-income country, so the report speaks directly to its development choices. For researchers in economics, business and public policy it offers a testable framework, linking technology diffusion, competition and talent to growth, that local data can confirm or challenge.",
    researchQuestions: [
      "How far has the Philippines moved from an investment-led to an investment-and-infusion growth strategy?",
      "Which institutions most effectively diffuse foreign technologies to domestic firms in ASEAN economies?",
      "How do competition regimes in middle-income countries affect firm entry and productivity growth?",
    ],
  },
  "organization-in-biology": {
    code: "EP-OR-18",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Organisation has been biology's blind spot",
        text: "The editor argues that, since the Modern Synthesis and the rise of molecular biology, research focused on genes and populations and largely neglected how the parts of living systems interact to keep the whole going.",
      },
      {
        title: "Closure of constraints is the unifying idea",
        text: "Most chapters build on a definition of biological organisation as a “closure of constraints”: the structures that channel a system's processes are themselves produced and maintained by that system.",
      },
      {
        title: "A concept with a long history",
        text: "Organisation has defined life since the seventeenth century and helped make biology a discipline of its own; later it was joined by the concepts of evolution and regulation.",
      },
      {
        title: "From philosophy to models and experiments",
        text: "The volume applies the organisational view to cognition, organismal agency in evolution, the origins of life from prebiotic chemistry, inheritance, development, organogenesis and ecological function.",
      },
      {
        title: "A real debate, not a manifesto",
        text: "One chapter argues that organicism can stand without the concept of organisation at all, and another compares organisational and evolutionary accounts of what an organism is, which keeps the book open to critique.",
      },
    ],
    whyItMatters:
      "The book shows how a philosophical concept can become a working scientific tool, which matters for interdisciplinary research in biology, ecology and systems science. Its organisational account of ecological function also gives sustainability researchers a fresh theoretical footing.",
    researchQuestions: [
      "Can “closure of constraints” be operationalised as a measurable property in experimental systems biology?",
      "How would an organisational definition of ecological function change biodiversity and sustainability assessments?",
      "What does an organisational view of development imply for models of organogenesis and regeneration?",
    ],
  },
  "national-skills-strategies-saudi-arabia-2025": {
    code: "EP-OR-19",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Stop-gap training is not a skills strategy",
        text: "The report argues that one-off interventions cannot keep up with changing skill needs, and that countries are moving towards coordinated national systems that connect education, training and work.",
      },
      {
        title: "Think in systems, not silos",
        text: "Skills development is too often left to the TVET sector alone. A systems view treats education, labour markets, policy, industry and society as one ecosystem and looks for leverage points where action has most effect.",
      },
      {
        title: "Saudi Arabia built a dedicated lead body",
        text: "With World Bank support, the Ministry of Human Resources and Social Development set up a Skills and Training Deputyship to lead the national skilling agenda, as part of the Kingdom's economic diversification.",
      },
      {
        title: "Five principles for a coordinated system",
        text: "The authors distil five principles: good governance and an enabling environment; demand-led skills development; decisions based on accurate labour market information; credible quality assurance; and partnerships.",
      },
      {
        title: "Employers need a formal voice",
        text: "Sectoral bodies such as Sector Skills Councils are presented as the bridge between what employers need and what training providers supply, supported by labour market information systems.",
      },
    ],
    whyItMatters:
      "The five principles offer a ready checklist for evaluating skills reforms in other countries, including the Philippines, where TESDA, the Department of Education and the Commission on Higher Education share responsibility. For researchers, the report is a well-documented case of system-level reform in progress.",
    researchQuestions: [
      "How well do the five principles describe the governance of the Philippine skills system?",
      "What makes Sector Skills Councils effective in economies with large informal sectors?",
      "How can labour market information systems be kept accurate and timely in developing countries?",
    ],
  },
  "using-technology-to-improve-tvet-2023": {
    code: "EP-OR-20",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "EdTech touches the whole TVET cycle",
        text: "The paper maps technology's roles from materials design and open educational resources, through online and blended delivery and simulations, to work-based learning, credentialing and recognition of prior learning.",
      },
      {
        title: "COVID-19 turned a choice into a necessity",
        text: "The pandemic, together with the Fourth Industrial Revolution, made technology essential for keeping technical and vocational training running and relevant.",
      },
      {
        title: "Countries are at different starting points",
        text: "Recommendations are matched to three levels of EdTech advancement: latent, emerging and established, so that each country can start from where it actually is.",
      },
      {
        title: "Infrastructure alone is not enough",
        text: "Governance, reliable funding, teacher and trainer capacity, partnerships and incentives for innovation all appear alongside devices and connectivity as conditions for success.",
      },
      {
        title: "Open licensing multiplies impact",
        text: "Openly licensed materials can be adapted to local contexts and shared across institutions, which lowers costs and speeds up updates in fast-changing trades.",
      },
    ],
    whyItMatters:
      "The latent, emerging and established framework gives TVET researchers and administrators a practical diagnostic for planning technology investments. It also suits comparative studies across ASEAN, where systems sit at very different stages of EdTech readiness.",
    researchQuestions: [
      "At which level of EdTech advancement do Philippine TVET institutions sit, and what explains differences between regions?",
      "How effective are simulations and virtual reality for practical skills training compared with workshop practice?",
      "What makes recognition of prior learning systems trusted by employers?",
    ],
  },
  "costing-odl-and-icts-in-tvet-2017": {
    code: "EP-OR-21",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Technology does not automatically cut costs",
        text: "The chapter warns against the assumption that distance and technology-based delivery is always cheaper, noting how little costing research exists for TVET in particular.",
      },
      {
        title: "Know your cost categories",
        text: "It clarifies direct, indirect, fixed, variable, marginal and unit costs, and the difference between cost-efficiency and cost-effectiveness, as a shared language for planners.",
      },
      {
        title: "Scale is what makes distance learning cheaper",
        text: "Course design costs are paid whatever the enrolment, so lower costs per student follow only when many students study and succeed, and when presenting the course needs fewer staff than face-to-face teaching.",
      },
      {
        title: "Completion changes the arithmetic",
        text: "Measured per graduate rather than per enrolment, programmes with low completion rates can be far more expensive than they appear.",
      },
      {
        title: "Share to save",
        text: "Because TVET serves small groups across many trades, the authors recommend consortia, industry partnerships, shared repositories, MOOCs and open educational resources to spread development costs.",
      },
    ],
    whyItMatters:
      "Sound costing is often missing from proposals for online and blended programmes. This chapter gives researchers and administrators a compact framework for building realistic budgets and for judging cost-effectiveness claims in grant proposals and policy debates.",
    researchQuestions: [
      "What is the full cost per graduate of blended TVET programmes compared with face-to-face delivery?",
      "How much do shared open educational resources reduce course development costs in practice?",
      "Which student support costs most affect completion rates in distance TVET?",
    ],
  },
  "good-stories-dont-grow-on-trees": {
    code: "EP-OR-22",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Free to read is not free to make",
        text: "Openly licensed storybooks still cost money to write, illustrate, translate, edit and print, and those costs have to be met fairly for local publishing to survive.",
      },
      {
        title: "Different books, different cost drivers",
        text: "The study compares basic storybooks read for enjoyment, levelled readers that teach reading and STEM stories that need subject experts, each with its own cost profile.",
      },
      {
        title: "Translation is a fast but imperfect shortcut",
        text: "Translating existing stories can grow local-language collections quickly, but the report shows it carries its own costs and quality questions.",
      },
      {
        title: "Seven very different business models",
        text: "Profiles of Let's Read!, BookBox, Book Dash, African Storybook, StoryWeaver, Sub-Saharan Publishers and Ubongo show varied approaches to paying creators, quality assurance and licensing.",
      },
      {
        title: "Funding must reach local creators",
        text: "The authors conclude there is no one-size-fits-all cost, and that if money does not reach local authors, illustrators and publishers, short-term book supply may undermine long-term capacity.",
      },
    ],
    whyItMatters:
      "The report applies to any open-content initiative, including open-access publishing: openness is a distribution model, not a cost model. It is a useful reference for Eleventh Press authors and researchers studying the economics of open knowledge and mother-tongue learning materials.",
    researchQuestions: [
      "What does it cost to produce a quality storybook in a Philippine mother-tongue language, and who pays?",
      "How do open licences affect the revenue and visibility of small local publishers?",
      "Does machine translation lower the cost of local-language storybooks without lowering quality?",
    ],
  },
  "guide-to-quality-in-online-learning": {
    code: "EP-OR-23",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Online is a different method, not a copy of the classroom",
        text: "The guide stresses that good online teaching does not try to reproduce face-to-face lessons online; it uses the medium to offer different, and sometimes better, learning experiences.",
      },
      {
        title: "Quality must be planned at institution level",
        text: "Strategic plans, policies, governance and budgets need to recognise online learning explicitly, rather than leaving it to individual enthusiasts.",
      },
      {
        title: "Course design and usability matter",
        text: "Clear course design, accessible materials and good web usability are treated as core quality factors, not technical extras.",
      },
      {
        title: "Community is built, not assumed",
        text: "Interaction needs clear purposes, instructions, small groups, active facilitation and etiquette guidelines if students are to collaborate well online.",
      },
      {
        title: "Assessment and support close the loop",
        text: "Sound assessment, exam security and consistent student support are presented as decisive for both quality and credibility.",
      },
    ],
    whyItMatters:
      "Written before the pandemic made online teaching universal, the guide's sixteen questions remain a compact quality checklist. Institutions can use it to audit their programmes, and researchers can use it as a baseline for studying how quality expectations have changed since 2013.",
    researchQuestions: [
      "Which of the guide's quality factors best predict student completion in online programmes?",
      "How have institutions' approaches to online exam security changed since the rise of generative AI?",
      "What forms of online community building work best for working adult learners?",
    ],
  },
  "guide-to-quality-in-post-traditional-online-higher-education": {
    code: "EP-OR-24",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Openness is reshaping higher education",
        text: "The guide describes a move towards open content, open data, open educational resources and MOOCs, driven by youth unemployment, tighter public funding and new technology.",
      },
      {
        title: "Traditional quality assurance does not fit easily",
        text: "Quality systems were built for tightly structured programmes, while post-traditional learning is defined by openness and flexibility, which creates a genuine dilemma.",
      },
      {
        title: "OER and MOOCs need their own quality lens",
        text: "It sets out separate quality considerations for open educational resources and for MOOCs, rather than applying course-accreditation rules unchanged.",
      },
      {
        title: "Recognition is the hard question",
        text: "The guide asks whether open learning can lead to recognised awards, and what open badges and other credentials add.",
      },
      {
        title: "Institutions must rethink policy and budgets",
        text: "Openness raises institutional policy questions and may shift spending priorities, from producing content towards supporting, assessing and certifying learners.",
      },
    ],
    whyItMatters:
      "Its questions about micro-credentials, badges and the accreditation of open learning are now central to higher education policy. Read alongside the 2013 guide, it helps researchers trace how quality thinking has adapted to openness.",
    researchQuestions: [
      "How do employers in the Philippines value micro-credentials and digital badges compared with degrees?",
      "What quality assurance models work for MOOCs offered for academic credit?",
      "How has the adoption of open educational resources changed institutional spending priorities?",
    ],
  },
  "survey-government-oer-policies-2012": {
    code: "EP-OR-25",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "A global snapshot from 82 countries",
        text: "The survey, run by the Commonwealth of Learning and UNESCO, analysed responses from 82 countries received by April 2012, ahead of the World OER Congress in Paris.",
      },
      {
        title: "High interest, few explicit policies",
        text: "Interest in OER was strong in every region, but few governments had explicit OER policies, and many digital-content projects did not clearly state an open licence.",
      },
      {
        title: "Confusion about what OER means",
        text: "Some responses mixed up OER with open source software, open access journals or distance learning, which the report flags as a need for clearer communication.",
      },
      {
        title: "Creative Commons leads where licences are open",
        text: "Where open licences were used, the Creative Commons framework was the most common, though licensing choices varied between countries.",
      },
      {
        title: "A roadmap for further work",
        text: "The report recommends deeper policy analysis, regional studies, a repository of OER research and continued advocacy in several languages.",
      },
    ],
    whyItMatters:
      "The survey is a historical baseline for the open education movement. Comparing it with today's policies, including UNESCO's 2019 Recommendation on OER, shows how far governments have moved and where gaps persist, which makes it a valuable source for policy researchers.",
    researchQuestions: [
      "How have national OER policies in Southeast Asia changed since the 2012 survey?",
      "What explains differences in OER policy adoption between regions?",
      "How do teachers understand the difference between OER and other free online materials?",
    ],
  },
  "ict-professional-development-teachers-guyana-2012": {
    code: "EP-OR-26",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Start from the teacher, not the device",
        text: "Guyana's strategy grew from a gap in its ICT plan: teachers had not been prepared to use technology for teaching, in a country where many teachers were untrained.",
      },
      {
        title: "A national learning pathway",
        text: "The strategy sets out a progression from ICT courses in initial teacher education to short in-service courses for principals, ICT coordinators and support staff.",
      },
      {
        title: "A shared framework ends curriculum disputes",
        text: "Adopting the UNESCO ICT Competency Framework for Teachers streamlined a contested curriculum review and gave the two teacher education institutions a common structure.",
      },
      {
        title: "Audit before you train",
        text: "Surveys of ICT skills, access and attitudes among teachers, officials and trainers informed which interventions to fund first.",
      },
      {
        title: "Keep it affordable and monitored",
        text: "Mentoring, CD-ROM distribution where connectivity was poor, open educational resources and a built-in monitoring and evaluation plan kept the approach low-cost and adaptable.",
      },
    ],
    whyItMatters:
      "Small and resource-constrained education systems, including many island and rural communities in the Philippines, face the same challenges Guyana addressed. The case study offers a replicable model and a useful comparison point for research on teachers' digital competence.",
    researchQuestions: [
      "How well does the UNESCO ICT Competency Framework for Teachers fit pre-service curricula in the Philippines?",
      "What are the long-term effects of school-based ICT mentoring on teaching practice?",
      "How can ICT professional development be delivered cost-effectively in low-connectivity areas?",
    ],
  },
  "practical-guide-responsible-research-assessment-funders-2026": {
    code: "EP-OR-27",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Funders set the tone for how research is judged",
        text: "The guide starts from the point that the criteria, policies and expectations a funder sets reach well beyond its own decisions. They influence institutional strategies and researcher behaviour, so reform at funders can spread through the whole system.",
      },
      {
        title: "Reform is a set of activities, not a single policy",
        text: "Seven activities carry the work inside an organisation, from engaging leadership and developing a vision to mobilising resources, planning communication, and monitoring and reviewing what has been tried.",
      },
      {
        title: "Responsible assessment touches the whole funding cycle",
        text: "Five moments are covered: establishing programmes and calls, making funding decisions, setting grant terms and conditions, monitoring and evaluating grants, and communicating with communities.",
      },
      {
        title: "Funders sit inside a wider research system",
        text: "Eight components link funders' practice to responsible use of metrics, research information infrastructure, equity, diversity and inclusion, ethics and integrity, open science, societal impact and scholarly communication.",
      },
      {
        title: "Learn from what other funders have tried",
        text: "The guide pairs its advice with case studies from funders in several countries and spotlights on topics such as narrative CVs, the use of AI in research funding and experiments to make funding decisions fairer.",
      },
    ],
    whyItMatters:
      "National and regional research funders, including those supporting researchers in the Philippines and across the Global South, can use the guide as a checklist when they review calls, reviewer instructions and grant terms. It also gives open-access publishers and researchers a clear picture of what funders may ask for under responsible assessment.",
    researchQuestions: [
      "Which of the guide's activities have funders in Southeast Asia adopted, and which have been hardest to put in place?",
      "How do narrative CVs and similar formats change who receives funding?",
      "What evidence shows whether responsible research assessment changes the behaviour of applicants and reviewers?",
    ],
  },
  "the-politics-of-riverine-rights-2026": {
    code: "EP-OR-28",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Three countries, four rivers",
        text: "The book follows the Whanganui in Aotearoa New Zealand, the Atrato in Colombia, and the Ganga and Yamuna in India, three places where rivers have been declared legal persons.",
      },
      {
        title: "A legal status is not the same as protection",
        text: "The case chapters look at how each decision came about, who was involved and what followed, rather than assuming that a new legal status changes conditions on the river.",
      },
      {
        title: "Indigenous and marginalised communities are at the centre",
        text: "The comparative chapters examine the struggles of Indigenous peoples, ethnic minorities and marginalised groups, and how different ways of understanding people, rivers and nature shape the outcomes.",
      },
      {
        title: "Human rights and the rights of nature can pull apart",
        text: "The closing chapters discuss tensions and overlaps between human rights and the rights of nature, with particular attention to how Indigenous rights connect to the rights of rivers.",
      },
      {
        title: "Rights for the river, and for those who live by it",
        text: "The editors argue for a broad idea of riverine rights that includes the people who depend on the river, and that looks to the social, cultural and political sides of legal change.",
      },
    ],
    whyItMatters:
      "The Philippines is a country of rivers, Indigenous peoples and active debate on environmental rights, so these three comparisons offer useful background for law, policy and community advocacy on water. The book also shows how open-access publishing can put expensive academic research within reach of researchers outside wealthy institutions.",
    researchQuestions: [
      "What would recognising a Philippine river as a legal person mean for Indigenous and riverside communities?",
      "How do the rights of nature and Indigenous rights work together or conflict in water governance?",
      "What conditions turn a court declaration into lasting protection on the ground?",
    ],
  },
  "evaluating-environment-in-international-development-2021": {
    code: "EP-OR-29",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Evaluation is how decision-makers learn what works",
        text: "The book treats systematic evaluation as an essential source of evidence for environmental and development decisions, and its editor argues that evaluation needs to raise its game.",
      },
      {
        title: "Look beyond single projects",
        text: "It covers normative work on the environment and the environmental effects of economic and social development, not only individual projects and programmes.",
      },
      {
        title: "Poverty, climate and disaster risk are linked",
        text: "Chapters in the first part treat environment and poverty as a global public goods question and ask whether the links between poverty, climate change and disaster risk are too complex to evaluate.",
      },
      {
        title: "New data tools are part of the toolkit",
        text: "Part II covers big data and geospatial approaches, meta-analysis of climate mitigation evaluations and theory-of-change methods for judging progress towards impact.",
      },
      {
        title: "Lessons come from programmes in many regions",
        text: "Case chapters include the GEF-UNDP Small Grants Programme, the poverty-environment nexus in Africa, green economy initiatives in Latin America and the Caribbean, transboundary aquifers and disaster risk management.",
      },
    ],
    whyItMatters:
      "Climate and disaster risk shape development planning across the Philippines, where agencies, NGOs and funders need ways to judge whether environmental programmes deliver. The book gives evaluators and researchers a broad, practice-based overview of those methods.",
    researchQuestions: [
      "How could geospatial and big data methods improve evaluation of environmental programmes in the Philippines?",
      "What would a joint evaluation of climate and disaster risk programmes need to measure?",
      "How well do theory-of-change approaches capture long-term environmental impact in small-grant programmes?",
    ],
  },
  "what-makes-or-breaks-a-democracy-2026": {
    code: "EP-OR-30",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "A fast rise and a slow dismantling",
        text: "The book contrasts the quick and peaceful move to democracy in 1989 with the gradual dismantling of democratic institutions after 2010.",
      },
      {
        title: "Seven factors, not one cause",
        text: "It examines political agency, the constitutional setup, economic performance, the international environment, political communication, political ideology and social culture.",
      },
      {
        title: "Institutions can be bent from within",
        text: "The chapter on the constitutional setup is titled for broken guardrails, pointing to how formal safeguards can be weakened by those who hold power.",
      },
      {
        title: "Communication and ideology matter",
        text: "Separate chapters treat political communication and political ideology as drivers of the downturn, alongside economic performance and culture.",
      },
      {
        title: "Lessons meant to travel",
        text: "The author writes the lessons for readers in many countries, and the preface notes the April 2026 election that ended the Orbán government.",
      },
    ],
    whyItMatters:
      "Democratic backsliding is a worry in many countries, including in Southeast Asia. A case study that separates several causes helps researchers and civil society compare warning signs and defences across very different places.",
    researchQuestions: [
      "Which of the seven factors best explain democratic backsliding in other countries, including in Asia?",
      "How do formal constitutional safeguards hold up when political actors choose to ignore them?",
      "What role do political communication and social media play in weakening democratic norms?",
    ],
  },
  "negotiating-bioethics-2013": {
    code: "EP-OR-31",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Equal votes do not mean equal voices",
        text: "The study finds that procedures gave every country an equal voice and vote, yet delegates from the global North were more numerous and more experienced than those from the global South.",
      },
      {
        title: "Three declarations, negotiated with compromise",
        text: "The declarations of 1997, 2003 and 2005 are described as classic products of a formal international regime, with compromises on their nature and content needed to reach agreement.",
      },
      {
        title: "Norms need national uptake",
        text: "Case studies in Kenya and South Africa look at how the declarations were received, adopted and used nationally, and at views on UNESCO's capacity-building work.",
      },
      {
        title: "No agreement on cloning",
        text: "The book traces the debate on an international convention on human reproductive cloning and notes the lack of universal norms on the subject.",
      },
      {
        title: "Small practical fixes can help",
        text: "The closing suggestions are modest: for example, starting meetings on time so debates are not cut short, and covering some participation costs for developing countries.",
      },
    ],
    whyItMatters:
      "Philippine researchers, ethics committees and policymakers deal with international research ethics standards that were negotiated elsewhere. The book shows how those norms are made, who gets heard, and what helps them work in developing countries.",
    researchQuestions: [
      "How have UNESCO's bioethics declarations been used by research ethics committees in the Philippines?",
      "What helps developing countries take an equal part in international norm-setting?",
      "How should universal bioethics norms be adapted to local contexts without losing their force?",
    ],
  },
  "the-question-of-emergence-2026": {
    code: "EP-OR-32",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "The core question",
        text: "Can everything, including human behaviour, be explained by the behaviour of the most basic physical elements (physicalist reductionism), or do new forms of causality emerge at higher levels (emergentism)? The book defends the second view.",
      },
      {
        title: "The mystery may come from the model of cause",
        text: "The author argues that the apparent mystery of emergence is an artefact of the covering-law model of causal explanation, which both sides of the debate have assumed.",
      },
      {
        title: "Think in powers, not laws",
        text: "Replacing lawful regularities with a view of causality based on powers is presented as the move that lets emergence be explained without mystery.",
      },
      {
        title: "Look at relations among wholes, not just whole and parts",
        text: "The book says the debate has focused too narrowly on a single whole and its parts, and that attention should go to the new causal logics that arise among emergent wholes.",
      },
      {
        title: "A case for sociology",
        text: "The later chapters take the argument to social powers, social wholes and downward causation, leading to the author's claim that sociology rather than physics is the queen of the sciences.",
      },
    ],
    whyItMatters:
      "The debate shapes how researchers think about explaining social life: whether social structures have real causal effects of their own. The book is a compact entry point for social scientists and philosophers, and a model of argument within critical realism.",
    researchQuestions: [
      "How does a powers view of causality change how social scientists explain institutions?",
      "Where might the distinction between one-off and level emergence apply in other disciplines?",
      "What evidence would count for or against downward causation in social systems?",
    ],
  },
  "creating-future-people-2024": {
    code: "EP-OR-33",
    preparedOn: PREPARED,
    takeaways: [
      {
        title: "Screening embryos is already possible",
        text: "The preface explains that pre-implantation genetic testing already lets parents screen embryos for some single-gene and some polygenic diseases, and expects selection for complex traits to follow.",
      },
      {
        title: "Polygenic scores are statistical estimates",
        text: "Embryos are given scores that indicate the likelihood of developing traits, built from large genome-wide association studies that link genetic tests to physical and psychological traits.",
      },
      {
        title: "One parent's choice affects everyone",
        text: "The book argues that once selection for complex traits happens, everyone will have an interest in the traits others choose, creating coordination problems earlier writers did not consider.",
      },
      {
        title: "Parents differ, and regulators are limited",
        text: "It takes seriously the diversity of parents' preferences and the limits policymakers face in regulating what may become a global market for reproductive technology.",
      },
      {
        title: "Read it as one author's argument",
        text: "The book takes positions on contested ethical questions. The back cover discloses that the author works with a company offering polygenic embryo screening, which readers may want to weigh alongside other views.",
      },
    ],
    whyItMatters:
      "Reproductive genetics is moving from research to clinics and commercial services, and countries including the Philippines will need to decide how to regulate it. A short, readable text helps students and policymakers understand the science and the moral questions before they read wider and opposing views.",
    researchQuestions: [
      "How should countries regulate embryo screening for complex traits, and who should take part in deciding?",
      "What are the strongest objections to the book's coordination-problem argument?",
      "How do religious, cultural and legal contexts in the Philippines shape attitudes to genetic selection?",
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
