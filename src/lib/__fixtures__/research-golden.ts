/**
 * Golden set for the Research Assistant's retrieval: a small journal of
 * HTML galleys and questions with the articles (and, where it matters, the
 * part of the paper) that must come back. Used by research-golden.test.ts;
 * add a case whenever a real question is answered from the wrong source.
 *
 * Fictional articles, written to resemble the journal's mix: education
 * studies (many sharing words like "students" and "learning"), plus
 * health, environment and agriculture papers.
 */

export interface GoldenArticle {
  id: string;
  title: string;
  authors: string[];
  keywords: string;
  publishedAt: string;
  html: string;
}

export interface GoldenQuestion {
  question: string;
  /** Articles that must be among the top results (every one, for a comparison). */
  expect: string[];
  /** A canonical section that must be among the retrieved passages of the first expected article. */
  section?: string;
  kind: "title" | "author" | "topic" | "section" | "comparison" | "equation" | "table";
}

const galley = (body: string) => `<html><body><div class="article-body">${body}</div></body></html>`;

export const GOLDEN_ARTICLES: GoldenArticle[] = [
  {
    id: "tle",
    title: "Motivation and Laboratory Skills of Grade 10 Technology and Livelihood Education (TLE) Students",
    authors: ["Liza Fernandez", "Ramon Cruz"],
    keywords: "TLE, motivation, laboratory skills, technical-vocational education",
    publishedAt: "2026-02-14",
    html: galley(`
      <h2>Abstract</h2><p>This study describes the motivation and laboratory skills of Grade 10 TLE students in Cagayan de Oro and tests whether motivation predicts skill performance.</p>
      <h2>1. Introduction</h2><p>Technology and Livelihood Education prepares learners for technical-vocational tracks. Laboratory work in cookery, carpentry and electrical installation is central, yet many schools lack equipment.</p>
      <h2>2. Methods</h2><h3>2.1 Respondents</h3><p>A total of 186 Grade 10 TLE students from four public high schools were selected by stratified random sampling.</p>
      <h3>2.2 Instruments</h3><p>Motivation was measured with an adapted Academic Motivation Scale; laboratory skills were rated by teachers using a performance rubric.</p>
      <h2>3. Results</h2><p>Students reported high intrinsic motivation (M = 4.21). Laboratory skills were rated proficient in cookery but developing in electrical installation.</p>
      <table><caption>Table 2. Laboratory skill ratings by specialisation</caption><tr><th>Specialisation</th><th>Mean</th><th>Description</th></tr><tr><td>Cookery</td><td>4.05</td><td>Proficient</td></tr><tr><td>Carpentry</td><td>3.62</td><td>Approaching proficiency</td></tr><tr><td>Electrical installation</td><td>3.18</td><td>Developing</td></tr></table>
      <p>Intrinsic motivation significantly predicted laboratory skill scores (r = .48, p &lt; .001).</p>
      <h2>4. Limitations</h2><p>Teacher ratings may be lenient, and only four schools in one division took part.</p>
      <h2>5. Conclusion and Recommendations</h2><p>Schools should invest in electrical installation equipment and keep hands-on activities that sustain intrinsic motivation.</p>`),
  },
  {
    id: "reading",
    title: "Effects of a Phonics-Based Reading Intervention on Struggling Grade 4 Readers",
    authors: ["Grace Villanueva"],
    keywords: "reading comprehension, phonics, intervention, elementary education",
    publishedAt: "2025-11-03",
    html: galley(`
      <h2>Abstract</h2><p>We evaluate a twelve-week phonics-based reading intervention for Grade 4 pupils identified as frustration-level readers by the Phil-IRI.</p>
      <h2>Introduction</h2><p>Many Filipino elementary pupils read below grade level, and remediation is often unstructured.</p>
      <h2>Methodology</h2><p>A quasi-experimental pretest-posttest design compared 48 pupils who received the intervention with 46 pupils in regular remedial reading. Reading comprehension was measured with the Phil-IRI graded passages.</p>
      <h2>Results and Discussion</h2><p>The intervention group gained 18.6 points in comprehension against 7.2 points in the comparison group, a large effect (d = 0.91). Gains were largest in decoding multisyllabic words.</p>
      <h2>Limitations</h2><p>Pupils were not randomly assigned, and the follow-up period was only one quarter.</p>
      <h2>Recommendations</h2><p>Division offices should train reading teachers in systematic phonics and schedule daily 30-minute sessions.</p>`),
  },
  {
    id: "mathanxiety",
    title: "Mathematics Anxiety and Achievement among Senior High School Students",
    authors: ["Paolo Reyes", "Andrea Lim"],
    keywords: "mathematics anxiety, achievement, senior high school, regression",
    publishedAt: "2026-05-20",
    html: galley(`
      <h2>Abstract</h2><p>This study examines how mathematics anxiety relates to achievement in General Mathematics among senior high school students.</p>
      <h2>Introduction</h2><p>Mathematics anxiety is a persistent barrier to achievement and course choice.</p>
      <h2>Methods</h2><p>We surveyed 402 Grade 11 students using the Abbreviated Math Anxiety Scale and collected their first-semester General Mathematics grades. The relationship was modelled by ordinary least squares regression,
      <math display="block"><semantics><mrow><mi>y</mi></mrow><annotation encoding="application/x-tex">\\hat{y} = \\beta_0 + \\beta_1 x_{\\text{anxiety}} + \\beta_2 x_{\\text{sex}} + \\varepsilon</annotation></semantics></math>
      where the outcome is the semester grade.</p>
      <h2>Results</h2><p>Anxiety was negatively associated with achievement (β1 = −0.37, p &lt; .001); each one-point increase in anxiety predicted a grade 0.37 points lower. Female students reported higher anxiety but similar grades.</p>
      <h2>Discussion</h2><p>The findings echo international studies linking anxiety to working-memory load during problem solving.</p>
      <h2>Limitations</h2><p>Self-report anxiety and a single school year limit causal claims.</p>`),
  },
  {
    id: "online",
    title: "Online Learning Readiness of College Students in Northern Mindanao during the Pandemic",
    authors: ["Jose Manalo"],
    keywords: "online learning, readiness, higher education, COVID-19, internet access",
    publishedAt: "2024-08-11",
    html: galley(`
      <h2>Abstract</h2><p>We assess the online learning readiness of college students and the barriers they faced during pandemic-era distance education.</p>
      <h2>Methods</h2><p>An online survey of 1,150 students from three state universities used the Online Learning Readiness Scale, covering computer self-efficacy, self-directed learning and motivation.</p>
      <h2>Results</h2><p>Readiness was moderate overall. Unstable internet connection was the most-cited barrier (71%), followed by lack of a quiet study space (54%). Students from upland municipalities scored lowest in computer self-efficacy.</p>
      <h2>Conclusion</h2><p>Universities should provide load allowances and asynchronous materials for students with poor connectivity.</p>`),
  },
  {
    id: "burnout",
    title: "Teacher Workload and Burnout in Rural Philippine Schools",
    authors: ["Maria Santos"],
    keywords: "teacher burnout, workload, rural education, Philippines",
    publishedAt: "2026-09-15",
    html: galley(`
      <h2>Abstract</h2><p>This study examines how administrative workload relates to burnout among rural public-school teachers.</p>
      <h2>Methods</h2><p>A survey of 512 teachers in Samar and Leyte used the Maslach Burnout Inventory and a workload log.</p>
      <h2>Results</h2><p>Teachers reporting more than 10 hours of weekly paperwork had markedly higher emotional exhaustion scores.</p>
      <h2>Recommendations</h2><p>Reduce non-teaching administrative tasks and hire administrative support staff.</p>`),
  },
  {
    id: "mangrove",
    title: "Mangrove Restoration and Storm-Surge Protection in Coastal Bangladesh",
    authors: ["Ana Rivera", "Rahim Uddin"],
    keywords: "mangroves, coastal resilience, storm surge, Bangladesh",
    publishedAt: "2026-03-10",
    html: galley(`
      <h2>Abstract</h2><p>We assess whether restored mangrove belts reduce storm-surge damage to coastal villages.</p>
      <h2>Methods</h2><p>We sampled 42 villages across Khulna and Satkhira districts, comparing restored and unrestored shorelines over three cyclone seasons.</p>
      <h2>Results</h2><p>Villages behind restored mangrove belts recorded 31.4% less storm-surge damage to housing than matched controls.</p>
      <h2>Limitations</h2><p>Damage assessments relied on household self-reports, and restoration age varied between sites.</p>`),
  },
  {
    id: "sepsis",
    title: "Machine Learning for Early Sepsis Detection in Intensive Care Units",
    authors: ["Kenji Tanaka"],
    keywords: "sepsis, machine learning, ICU, early warning",
    publishedAt: "2026-06-02",
    html: galley(`
      <h2>Abstract</h2><p>We develop a gradient-boosted model that flags sepsis risk from routine vital signs.</p>
      <h2>Data and Methods</h2><p>We used 18,204 ICU admissions from a single tertiary hospital between 2019 and 2023. Model discrimination was summarised by the area under the ROC curve,
      <math display="block" alttext="\\mathrm{AUROC} = \\int_0^1 \\mathrm{TPR}(t)\\, d\\,\\mathrm{FPR}(t)"><mi>A</mi></math></p>
      <h2>Results</h2><p>The model achieved an AUROC of 0.87 and detected sepsis a median of 5.2 hours before clinical diagnosis.</p>
      <h2>Limitations</h2><p>Single-centre data and a retrospective design limit generalisability.</p>`),
  },
  {
    id: "rice",
    title: "Adoption of Climate-Smart Practices among Smallholder Rice Farmers in Bukidnon",
    authors: ["Ernesto Dela Cruz"],
    keywords: "climate-smart agriculture, rice, smallholder farmers, adoption",
    publishedAt: "2025-04-27",
    html: galley(`
      <h2>Abstract</h2><p>We examine which smallholder rice farmers adopt alternate wetting and drying, drought-tolerant varieties and crop insurance.</p>
      <h2>Methods</h2><p>Structured interviews with 300 farmers in six municipalities; adoption was modelled with logistic regression.</p>
      <h2>Results</h2><p>Access to extension services and membership in a farmers' cooperative were the strongest predictors of adoption. Crop insurance uptake remained low at 22%.</p>
      <h2>Recommendations</h2><p>Extend extension visits to upland barangays and bundle insurance with cooperative loans.</p>`),
  },
];

export const GOLDEN_QUESTIONS: GoldenQuestion[] = [
  // Naming the paper
  { kind: "title", question: "What did the study on TLE students' laboratory skills find?", expect: ["tle"], section: "results" },
  { kind: "title", question: "Summarize the phonics reading intervention study.", expect: ["reading"] },
  { kind: "title", question: "What is the mangrove restoration paper about?", expect: ["mangrove"] },
  { kind: "title", question: "Tell me about the online learning readiness study.", expect: ["online"] },
  { kind: "title", question: "What are the main findings on mathematics anxiety and achievement?", expect: ["mathanxiety"], section: "results" },
  // Naming the author
  { kind: "author", question: "What did Villanueva find?", expect: ["reading"] },
  { kind: "author", question: "What is Tanaka's study about?", expect: ["sepsis"] },
  { kind: "author", question: "What did Dela Cruz recommend?", expect: ["rice"] },
  { kind: "author", question: "Summarize the work of Maria Santos.", expect: ["burnout"] },
  // Topic, without the title's wording
  { kind: "topic", question: "Does fear of math affect students' grades?", expect: ["mathanxiety"] },
  { kind: "topic", question: "Which barriers did students face with distance education?", expect: ["online"] },
  { kind: "topic", question: "How can schools reduce teacher paperwork?", expect: ["burnout"] },
  { kind: "topic", question: "Do coastal forests protect villages from cyclones?", expect: ["mangrove"] },
  { kind: "topic", question: "What predicts whether farmers take up crop insurance?", expect: ["rice"] },
  { kind: "topic", question: "Can vital signs predict sepsis early?", expect: ["sepsis"] },
  { kind: "topic", question: "How motivated are students in cookery and carpentry classes?", expect: ["tle"] },
  // A part of a paper
  { kind: "section", question: "Who were the respondents of the TLE study?", expect: ["tle"], section: "methods" },
  { kind: "section", question: "What were the limitations of the reading intervention study?", expect: ["reading"], section: "limitations" },
  { kind: "section", question: "What instrument measured burnout among the teachers?", expect: ["burnout"], section: "methods" },
  { kind: "section", question: "What research design did the phonics study use?", expect: ["reading"], section: "methods" },
  { kind: "section", question: "What were the limitations of the sepsis model?", expect: ["sepsis"], section: "limitations" },
  { kind: "section", question: "What did the climate-smart rice study recommend?", expect: ["rice"], section: "conclusion" },
  // Comparisons: every listed article must come back
  { kind: "comparison", question: "Compare the reading intervention study and the mathematics anxiety study.", expect: ["reading", "mathanxiety"] },
  { kind: "comparison", question: "Compare the methods of the TLE study and the online learning readiness study.", expect: ["tle", "online"] },
  { kind: "comparison", question: "How do the teacher burnout and TLE studies differ in their respondents?", expect: ["burnout", "tle"] },
  // Equations and tables
  { kind: "equation", question: "What regression model did the mathematics anxiety study use?", expect: ["mathanxiety"], section: "methods" },
  { kind: "equation", question: "How was the AUROC of the sepsis model defined?", expect: ["sepsis"] },
  { kind: "table", question: "What were the laboratory skill ratings in electrical installation?", expect: ["tle"] },
];
