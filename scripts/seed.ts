/**
 * ELEVENTH PRESS INTERNATIONAL PUBLISHING - Seed Script
 * Populates the database with a multidisciplinary sample corpus
 * and users spanning every RBAC role.
 */
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

const USERS_INPUT = [
  {
    email: "admin@eleventhpress.org",
    password: "admin",
    fullName: "Eleanor Vance",
    affiliation: "Eleventh Press International Publishing",
    role: "SUPER_ADMIN",
    expertise: "publishing, editorial management",
    country: "United Kingdom",
    orcid: "0000-0002-1001-0010",
    bio: "Editor-in-Chief with twenty years of academic publishing experience across STM and HSS disciplines.",
  },
  {
    email: "editor@eleventhpress.org",
    password: "editor",
    fullName: "Dr. Marcus Holloway",
    affiliation: "University of Edinburgh, School of Engineering",
    role: "EDITOR",
    expertise: "machine learning, distributed systems, computer vision",
    country: "United Kingdom",
    orcid: "0000-0002-1001-0011",
    bio: "Professor of Computer Science overseeing the computing and physical sciences track of the journal.",
  },
  {
    email: "assoc.editor@eleventhpress.org",
    password: "assoc",
    fullName: "Dr. Priya Raghunathan",
    affiliation: "Indian Institute of Science, Bengaluru",
    role: "ASSOCIATE_EDITOR",
    expertise: "molecular biology, genomics, CRISPR",
    country: "India",
    orcid: "0000-0002-1001-0012",
    bio: "Associate Editor handling life sciences and biomedical submissions.",
  },
  {
    email: "reviewer@eleventhpress.org",
    password: "reviewer",
    fullName: "Prof. Kenji Watanabe",
    affiliation: "University of Tokyo, Department of Applied Physics",
    role: "REVIEWER",
    expertise: "quantum materials, superconductivity, condensed matter",
    country: "Japan",
    orcid: "0000-0002-1001-0013",
    bio: "Reviewer in condensed matter physics with active research on topological insulators.",
  },
  {
    email: "reviewer2@eleventhpress.org",
    password: "reviewer",
    fullName: "Dr. Sofia Marenco",
    affiliation: "University of Bologna, Department of Sociology",
    role: "REVIEWER",
    expertise: "urban sociology, migration, social networks",
    country: "Italy",
    orcid: "0000-0002-1001-0014",
    bio: "Reviewer specialising in urban studies and migration policy.",
  },
  {
    email: "author@eleventhpress.org",
    password: "author",
    fullName: "Dr. Amara Okafor",
    affiliation: "University of Cape Town, Climate Systems Lab",
    role: "AUTHOR",
    expertise: "climate modelling, atmospheric science",
    country: "South Africa",
    orcid: "0000-0002-1001-0015",
    bio: "Author of several interdisciplinary papers on regional climate downscaling.",
  },
  {
    email: "reader@eleventhpress.org",
    password: "reader",
    fullName: "Liang Wei",
    affiliation: "Tsinghua University",
    role: "READER",
    expertise: "",
    country: "China",
    bio: "Doctoral candidate subscribing to the journal for coursework and research.",
  },
];

const USERS = USERS_INPUT.map(({ password, ...rest }) => ({
  ...rest,
  passwordHash: hashPassword(password),
}));

interface SeedArticle {
  title: string;
  abstract: string;
  keywords: string[];
  discipline: string;
  authors: { name: string; affiliation: string; orcid?: string; email: string }[];
  status: "PUBLISHED" | "UNDER_REVIEW" | "ACCEPTED" | "REVISIONS_REQUIRED" | "SUBMITTED";
  reviewModel: "DOUBLE_BLIND" | "SINGLE_BLIND" | "OPEN";
  openReview?: boolean;
  views: number;
  downloads: number;
  citations: number;
  publishedAt?: Date;
  submittedAt?: Date;
  acceptedAt?: Date;
  plagiarismScore?: number;
}

const ARTICLES: SeedArticle[] = [
  {
    title: "Topological Signatures in Strain-Engineered Transition Metal Dichalcogenides",
    abstract:
      "We report a systematic angle-resolved photoemission study of strain-engineered MoS2 and WSe2 monolayers grown by chemical vapour deposition. By tuning the biaxial strain magnitude between -1.2% and +1.8%, we map the evolution of the valence-band spin splitting at the K point and identify a topological phase transition boundary near +0.6% tensile strain. The observed band inversion is corroborated by first-principles density functional calculations including spin-orbit coupling, and is consistent with the emergence of a quantum spin Hall regime at cryogenic temperatures. Our findings open a scalable pathway toward room-temperature topological devices based on solution-processable two-dimensional crystals.",
    keywords: ["topological insulators", "transition metal dichalcogenides", "strain engineering", "spin-orbit coupling", "ARPES"],
    discipline: "Physics",
    authors: [
      { name: "Hiroshi Tanabe", affiliation: "University of Tokyo", orcid: "0000-0002-2222-1111", email: "h.tanabe@u-tokyo.ac.jp" },
      { name: "Mira Patel", affiliation: "Indian Institute of Science", email: "mira.patel@iisc.ac.in" },
      { name: "James O'Connor", affiliation: "Trinity College Dublin", orcid: "0000-0002-2222-1112", email: "j.oconnor@tcd.ie" },
    ],
    status: "PUBLISHED",
    reviewModel: "DOUBLE_BLIND",
    views: 4821,
    downloads: 1320,
    citations: 27,
    publishedAt: new Date("2024-03-12"),
    submittedAt: new Date("2023-09-04"),
    acceptedAt: new Date("2024-02-01"),
    plagiarismScore: 8,
  },
  {
    title: "CRISPR-Cas12a Base Editing Rescues Splicing Defects in a Cellular Model of Cystic Fibrosis",
    abstract:
      "Cystic fibrosis remains the most common lethal autosomal recessive disorder in populations of European descent, with the c.3849G>A splicing variant accounting for a substantial fraction of severe CFTR mutations. Using a cytosine base editor delivered via lipid nanoparticles, we achieved up to 64% on-target correction in primary patient-derived bronchial epithelial cells. Restored CFTR function was confirmed by transepithelial chloride current measurements and forskolin-induced swelling assays. Off-target editing, assessed by GUIDE-seq, remained within the threshold tolerated by current regulatory guidance. The work establishes a preclinical rationale for in vivo base-editing interventions in class II CFTR variants.",
    keywords: ["CRISPR", "base editing", "cystic fibrosis", "CFTR", "lipid nanoparticles"],
    discipline: "Biology",
    authors: [
      { name: "Ana Beatriz Souza", affiliation: "University of São Paulo", orcid: "0000-0002-3333-0001", email: "a.souza@usp.br" },
      { name: "Daniel Kim", affiliation: "Stanford University", email: "dkim@stanford.edu" },
    ],
    status: "PUBLISHED",
    reviewModel: "DOUBLE_BLIND",
    openReview: true,
    views: 9214,
    downloads: 2845,
    citations: 81,
    publishedAt: new Date("2024-05-22"),
    submittedAt: new Date("2023-11-15"),
    acceptedAt: new Date("2024-04-09"),
    plagiarismScore: 5,
  },
  {
    title: "Sparse Mixture-of-Experts Routing for Resource-Constrained Edge Inference",
    abstract:
      "Mixture-of-experts (MoE) architectures have become a standard technique for scaling transformer models without proportional increases in inference cost, yet their deployment on commodity edge accelerators remains hampered by irregular memory access patterns and load imbalance. We introduce SparseEdge-MoE, a routing mechanism that combines locality-sensitive hashing with hierarchical expert grouping to reduce expert activation variance by 41% on a Raspberry Pi 5 platform. Benchmarked against GLaM and Mixtral configurations, SparseEdge-MoE attains within 2.1% of dense baseline accuracy on SuperGLUE while consuming 3.8x less peak memory bandwidth. We release the runtime and benchmark suite under a permissive open-source license.",
    keywords: ["mixture of experts", "edge inference", "transformers", "model compression", "sparse routing"],
    discipline: "Computer Science",
    authors: [
      { name: "Liu Chen", affiliation: "Tsinghua University", orcid: "0000-0002-4444-0001", email: "liuchen@tsinghua.edu.cn" },
      { name: "Priya Raghunathan", affiliation: "Indian Institute of Science", email: "priya.r@iisc.ac.in" },
      { name: "Sven Larsson", affiliation: "KTH Royal Institute of Technology", email: "svenl@kth.se" },
    ],
    status: "PUBLISHED",
    reviewModel: "SINGLE_BLIND",
    openReview: true,
    views: 15302,
    downloads: 5410,
    citations: 142,
    publishedAt: new Date("2024-06-08"),
    submittedAt: new Date("2024-01-20"),
    acceptedAt: new Date("2024-05-15"),
    plagiarismScore: 11,
  },
  {
    title: "Gentrification, Displacement, and the Informal Care Economy in Post-2010 Lisbon",
    abstract:
      "Drawing on a five-year multi-sited ethnography conducted across three Lisbon parishes, this article examines how tourism-led gentrification reconfigures the city's informal care economy. We argue that the displacement of long-term residents has cascading effects on intergenerational caregiving arrangements, disproportionately burdening migrant women employed as live-in domestic workers. The analysis integrates 87 qualitative interviews, household budget diaries, and a comparative mapping of care-related mobility patterns. We propose the concept of 'cascading displacement' to capture how housing precarity transmits into the affective and reproductive spheres, and we outline policy implications for municipal welfare regimes in southern European cities.",
    keywords: ["gentrification", "care economy", "migration", "Lisbon", "urban sociology"],
    discipline: "Sociology",
    authors: [
      { name: "Sofia Marenco", affiliation: "University of Bologna", orcid: "0000-0002-5555-0001", email: "s.marenco@unibo.it" },
      { name: "João Ferreira", affiliation: "University of Coimbra", email: "jferreira@uc.pt" },
    ],
    status: "PUBLISHED",
    reviewModel: "DOUBLE_BLIND",
    views: 3104,
    downloads: 980,
    citations: 19,
    publishedAt: new Date("2024-04-30"),
    submittedAt: new Date("2023-08-12"),
    acceptedAt: new Date("2024-03-18"),
    plagiarismScore: 4,
  },
  {
    title: "Carbon Border Adjustment Mechanisms: A General Equilibrium Assessment of Distributional Effects",
    abstract:
      "The European Union's Carbon Border Adjustment Mechanism (CBAM) represents the most significant cross-jurisdictional climate trade policy implemented to date. We embed CBAM within a multi-region, multi-sector computable general equilibrium model calibrated to 2021 GTAP data and assess distributional outcomes across 14 global regions and 26 production sectors. Our central simulation suggests that CBAM will reduce covered emissions by 6.4% while generating welfare losses concentrated in middle-income export economies, particularly in South Asia and sub-Saharan Africa. Revenue recycling schemes directed at low-carbon technology transfer substantially mitigate but do not eliminate these asymmetries.",
    keywords: ["carbon border adjustment", "CGE modelling", "climate policy", "trade", "distributional effects"],
    discipline: "Economics",
    authors: [
      { name: "Amara Okafor", affiliation: "University of Cape Town", orcid: "0000-0002-1001-0015", email: "amara.okafor@uct.ac.za" },
      { name: "Lucas Bauer", affiliation: "DIW Berlin", email: "lbauer@diw.de" },
    ],
    status: "UNDER_REVIEW",
    reviewModel: "DOUBLE_BLIND",
    views: 0,
    downloads: 0,
    citations: 0,
    submittedAt: new Date("2024-07-01"),
    plagiarismScore: 7,
  },
  {
    title: "Attentional Bias Modification in Subclinical Anxiety: A Pre-Registered Multi-Site Replication",
    abstract:
      "Attentional bias modification (ABM) has been proposed as a low-intensity digital intervention for anxiety, but published effect sizes vary widely and the original trials are concentrated in a small number of laboratories. We report a pre-registered multi-site replication across four universities (N=612) using a standardised dot-probe training protocol. Contrary to the original reports, we find a small but statistically reliable effect on attentional bias (d=0.18) and a non-significant effect on self-reported anxiety symptoms at four-week follow-up. Bayesian analyses indicate moderate evidence for the null on the clinical outcome. Implications for digital mental health deployment are discussed.",
    keywords: ["attentional bias", "anxiety", "replication", "digital mental health", "dot-probe"],
    discipline: "Psychology",
    authors: [
      { name: "Rachel Goldstein", affiliation: "Northwestern University", orcid: "0000-0002-6666-0001", email: "r.goldstein@northwestern.edu" },
      { name: "Tobias Frank", affiliation: "Humboldt University of Berlin", email: "tfrank@hu-berlin.de" },
    ],
    status: "REVISIONS_REQUIRED",
    reviewModel: "SINGLE_BLIND",
    views: 0,
    downloads: 0,
    citations: 0,
    submittedAt: new Date("2024-05-10"),
    plagiarismScore: 12,
  },
  {
    title: "Reconstructing Seasonal Snowpack Trends in the Hindu Kush-Karakoram from Sentinel-2 Time Series",
    abstract:
      "The Hindu Kush-Karakoram region exhibits anomalous glacier stability in the context of broader High Mountain Asia mass loss, yet observational constraints on seasonal snowpack remain sparse. We develop a cloud-gap-filled snow cover product at 20m resolution by harmonising Sentinel-2 surface reflectance with MODIS snow climatology over 2017-2024. Trend analysis reveals a counterintuitive increase in winter snow water equivalent above 4,500 m, offset by accelerated spring ablation below 3,800 m. The pattern is consistent with elevated freezing levels and intensifying western disturbance activity, and carries direct implications for downstream irrigation scheduling in the Indus basin.",
    keywords: ["snowpack", "Sentinel-2", "Hindu Kush", "remote sensing", "water resources"],
    discipline: "Environmental Science",
    authors: [
      { name: "Imran Khan", affiliation: "COMSATS University Islamabad", orcid: "0000-0002-7777-0001", email: "imran.khan@comsats.edu.pk" },
      { name: "Élise Dubois", affiliation: "ETH Zürich", email: "elise.dubois@ethz.ch" },
    ],
    status: "ACCEPTED",
    reviewModel: "DOUBLE_BLIND",
    views: 0,
    downloads: 0,
    citations: 0,
    submittedAt: new Date("2024-02-18"),
    acceptedAt: new Date("2024-07-05"),
    plagiarismScore: 6,
  },
  {
    title: "A Refined Bound for the Sum-of-Digits Function in Modular Arithmetic",
    abstract:
      "Let s_q(n) denote the sum of digits of n in base q. We improve the upper bound on the discrepancy of the sequence (s_q(p_k) mod m) where p_k denotes the k-th prime, sharpening a result of Mauduit and Rivat (2009) for the case q=2 and m an odd prime. Our approach combines a refined exponential sum estimate with new sieve-theoretic input on primes in arithmetic progressions. The improvement is uniform in m up to q^{1/3} and removes a logarithmic factor present in earlier work.",
    keywords: ["sum of digits", "prime numbers", "exponential sums", "analytic number theory", "discrepancy"],
    discipline: "Mathematics",
    authors: [
      { name: "Yuki Nakamura", affiliation: "Kyoto University", orcid: "0000-0002-8888-0001", email: "y.nakamura@kyoto-u.ac.jp" },
    ],
    status: "SUBMITTED",
    reviewModel: "DOUBLE_BLIND",
    views: 0,
    downloads: 0,
    citations: 0,
    submittedAt: new Date("2024-07-08"),
    plagiarismScore: 3,
  },
  {
    title: "Quantum Metrology with Squeezed-Vacuum-Enhanced Mach-Zehnder Interferometers",
    abstract:
      "We demonstrate a 7.2 dB phase sensitivity improvement over the shot-noise limit using a squeezed-vacuum-enhanced Mach-Zehnder interferometer operating at telecommunication wavelengths. The squeezed source is generated via a periodically poled lithium niobate waveguide pumped at 775 nm, and is injected into the unused port of the interferometer. Stability over 72 hours of continuous operation is reported, with a duty cycle of 88%. The system is compatible with existing fibre-optic sensor networks and points toward practical quantum-enhanced measurement in geophysical and inertial sensing applications.",
    keywords: ["quantum metrology", "squeezed light", "Mach-Zehnder", "quantum sensing", "fibre optics"],
    discipline: "Physics",
    authors: [
      { name: "Kenji Watanabe", affiliation: "University of Tokyo", orcid: "0000-0002-1001-0013", email: "k.watanabe@u-tokyo.ac.jp" },
      { name: "Mateo Rossi", affiliation: "Politecnico di Milano", email: "mateo.rossi@polimi.it" },
    ],
    status: "PUBLISHED",
    reviewModel: "SINGLE_BLIND",
    views: 6720,
    downloads: 1845,
    citations: 44,
    publishedAt: new Date("2024-02-20"),
    submittedAt: new Date("2023-07-15"),
    acceptedAt: new Date("2024-01-10"),
    plagiarismScore: 9,
  },
  {
    title: "Microplastic Loads in Urban Stormwater Biofilters: A Six-City Comparative Audit",
    abstract:
      "Stormwater biofilters are increasingly deployed as nature-based solutions for urban runoff management, yet their effectiveness at retaining microplastics has not been systematically compared across climatic and demographic contexts. We sampled influent and effluent at 48 biofilter cells across six cities (Auckland, Singapore, Copenhagen, Lagos, São Paulo, and Vancouver) over twelve months. Median retention efficiency ranged from 61% to 89%, with fibres retained less effectively than fragments. Linear mixed-effects models indicate that vegetation density and hydraulic loading rate are the dominant predictors of performance, while maintenance frequency shows a non-monotonic relationship. We provide design heuristics for retrofitting existing installations.",
    keywords: ["microplastics", "stormwater", "biofilters", "urban ecology", "nature-based solutions"],
    discipline: "Environmental Science",
    authors: [
      { name: "Mei Lin Tan", affiliation: "National University of Singapore", orcid: "0000-0002-9999-0001", email: "meilin.tan@nus.edu.sg" },
      { name: "Olufemi Adebayo", affiliation: "University of Lagos", email: "o.adebayo@unilag.edu.ng" },
    ],
    status: "PUBLISHED",
    reviewModel: "DOUBLE_BLIND",
    views: 4203,
    downloads: 1102,
    citations: 12,
    publishedAt: new Date("2024-06-30"),
    submittedAt: new Date("2023-12-05"),
    acceptedAt: new Date("2024-05-25"),
    plagiarismScore: 7,
  },
];

export async function main() {
  // Idempotent: this runs on every Vercel build (see package.json's "build"
  // script), not just once by hand, so re-running it against an
  // already-seeded database must be a safe no-op rather than a duplicate
  // insert or a unique-constraint crash.
  const existingJournal = await db.journal.findFirst();
  if (existingJournal) {
    console.log("Database already seeded (found an existing Journal row) — skipping.");
    return;
  }

  console.log("Seeding ELEVENTH PRESS INTERNATIONAL PUBLISHING database...");

  // 1. Journal
  const journal = await db.journal.create({
    data: {
      name: "Eleventh Press International Journal of Multidisciplinary Research",
      issn: "2945-1138",
      publisher: "Eleventh Press International Publishing",
      description:
        "A peer-reviewed, open-access multidisciplinary journal publishing original research across the natural sciences, engineering, social sciences, and humanities.",
      aimsScope:
        "Eleventh Press International Publishing is committed to rigorous, transparent, and rapid dissemination of scholarship. The journal welcomes submissions spanning physics, biology, computer science, sociology, economics, psychology, environmental science, and mathematics. We operate a double-blind peer-review process by default and offer open and single-blind tracks where disciplinary norms warrant. All published articles are assigned a Crossref DOI, indexed via OAI-PMH 2.0, and rendered in HTML, PDF, and XML JATS galley formats.",
    },
  });

  // 2. Users
  const userMap: Record<string, string> = {};
  for (const u of USERS) {
    const created = await db.user.create({ data: u });
    userMap[u.email] = created.id;
    console.log(`  Created user ${u.email} (${u.role})`);
  }

  // 3. Issue
  const issue = await db.issue.create({
    data: {
      journalId: journal.id,
      volume: 4,
      issueNumber: 2,
      year: 2024,
      title: "Volume 4, Issue 2 — Multidisciplinary Quarterly",
      publishedAt: new Date("2024-06-30"),
    },
  });

  // 4. Articles
  for (const a of ARTICLES) {
    const doiSuffix = String(Math.floor(Math.random() * 9000) + 1000);
    const article = await db.article.create({
      data: {
        journalId: journal.id,
        issueId: a.status === "PUBLISHED" ? issue.id : null,
        doi: a.status === "PUBLISHED" ? `10.52011/epip.2024.${doiSuffix}` : (a.submittedAt ? `10.52011/epip.draft.${doiSuffix}` : null),
        doiStatus: a.status === "PUBLISHED" ? "PUBLISHED" : (a.submittedAt ? "DRAFT" : "NONE"),
        title: a.title,
        abstract: a.abstract,
        keywords: a.keywords.join(", "),
        discipline: a.discipline,
        authors: JSON.stringify(a.authors),
        correspondingAuthorId: userMap["author@eleventhpress.org"],
        manuscriptKey: `raw-submissions/${a.discipline.toLowerCase().replace(/\s+/g, "-")}-${doiSuffix}.pdf`,
        anonymizedKey: a.reviewModel === "DOUBLE_BLIND" ? `anonymized-manuscripts/anon-${doiSuffix}.pdf` : null,
        galleyPdfKey: a.status === "PUBLISHED" ? `published-galleys/${doiSuffix}.pdf` : null,
        galleyHtmlKey: a.status === "PUBLISHED" ? `published-galleys/${doiSuffix}.html` : null,
        status: a.status,
        reviewModel: a.reviewModel,
        openReview: a.openReview ?? false,
        plagiarismScore: a.plagiarismScore ?? null,
        // For already-published articles, populate Crossref deposit tracking as if a deposit had succeeded at publication time.
        crossrefBatchId: a.status === "PUBLISHED" ? `epip-batch-${doiSuffix}` : null,
        crossrefDepositedAt: a.status === "PUBLISHED" ? a.publishedAt : null,
        crossrefDepositLog: a.status === "PUBLISHED" ? JSON.stringify({ status: "ok", batchId: `epip-batch-${doiSuffix}`, depositedAt: a.publishedAt, message: "DOI deposit successful (sandbox seed)" }) : null,
        submittedAt: a.submittedAt,
        acceptedAt: a.acceptedAt,
        publishedAt: a.publishedAt,
        views: a.views,
        downloads: a.downloads,
        citations: a.citations,
      },
    });

    // For UNDER_REVIEW and REVISIONS_REQUIRED articles, assign reviewer(s)
    if (a.status === "UNDER_REVIEW" || a.status === "REVISIONS_REQUIRED" || a.status === "ACCEPTED") {
      let reviewerEmail = "reviewer@eleventhpress.org";
      if (a.discipline === "Sociology") reviewerEmail = "reviewer2@eleventhpress.org";

      const reviewStatus =
        a.status === "ACCEPTED" ? "COMPLETED" :
        a.status === "REVISIONS_REQUIRED" ? "COMPLETED" :
        "IN_PROGRESS";

      await db.review.create({
        data: {
          articleId: article.id,
          reviewerId: userMap[reviewerEmail],
          status: reviewStatus,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          overallScore: reviewStatus === "COMPLETED" ? (a.status === "ACCEPTED" ? 4 : 3) : null,
          recommendation: reviewStatus === "COMPLETED"
            ? (a.status === "ACCEPTED" ? "ACCEPT" : "MAJOR_REVISIONS")
            : null,
          confidence: reviewStatus === "COMPLETED" ? 4 : null,
          commentsToAuthor: reviewStatus === "COMPLETED"
            ? "The manuscript presents a rigorous contribution to the field. Several clarifications are requested regarding methodological details and the statistical treatment of the dataset. Please address the points enumerated below in a point-by-point response."
            : null,
          commentsToEditor: reviewStatus === "COMPLETED"
            ? "Recommended for publication subject to revisions. The work is novel and methodologically sound; the requested changes are largely presentational."
            : null,
          completedAt: reviewStatus === "COMPLETED" ? new Date() : null,
          // If the article is published with openReview enabled, expose this review publicly.
          madePublic: reviewStatus === "COMPLETED" && a.status === "PUBLISHED" && (a.openReview ?? false),
        },
      });
    }

    // Editorial decision for ACCEPTED
    if (a.status === "ACCEPTED") {
      await db.editorialDecision.create({
        data: {
          articleId: article.id,
          editorId: userMap["editor@eleventhpress.org"],
          decision: "ACCEPT",
          note: "Accepted pending APC payment and production.",
        },
      });
    }

    // Invoice for PUBLISHED APC
    if (a.status === "PUBLISHED") {
      await db.invoice.create({
        data: {
          userId: userMap["author@eleventhpress.org"],
          articleId: article.id,
          type: "APC",
          amount: 1850.00,
          currency: "USD",
          status: "PAID",
          stripeInvoiceId: `in_mock_${doiSuffix}`,
          paidAt: a.acceptedAt,
        },
      });
    }

    // Notification on publication
    if (a.status === "PUBLISHED") {
      await db.notification.create({
        data: {
          userId: userMap["author@eleventhpress.org"],
          type: "SUCCESS",
          title: "Article Published",
          message: `Your article "${a.title}" has been published. DOI: 10.52011/epip.2024.${doiSuffix}`,
          articleId: article.id,
        },
      });
    }

    console.log(`  Created article: ${a.title} [${a.status}]`);
  }

  // 5. Reader subscription
  await db.subscription.create({
    data: {
      userId: userMap["reader@eleventhpress.org"],
      plan: "READER_YEARLY",
      status: "ACTIVE",
      stripeSubId: "sub_mock_reader_yearly",
      currentPeriodEnd: new Date(Date.now() + 280 * 24 * 60 * 60 * 1000),
    },
  });

  // 6. Seed audit log entries
  const sampleArticle = await db.article.findFirst({
    where: { status: "PUBLISHED" },
  });
  if (sampleArticle) {
    await db.auditLog.create({
      data: {
        userId: userMap["editor@eleventhpress.org"],
        action: "PUBLISH",
        entityType: "ARTICLE",
        entityId: sampleArticle.id,
        articleId: sampleArticle.id,
        metadata: JSON.stringify({ doi: sampleArticle.doi, doiStatus: "PUBLISHED" }),
      },
    });
    await db.auditLog.create({
      data: {
        userId: userMap["admin@eleventhpress.org"],
        action: "DOI_PUBLISH",
        entityType: "ARTICLE",
        entityId: sampleArticle.id,
        articleId: sampleArticle.id,
        metadata: JSON.stringify({ crossrefResponse: "ok", registeredAt: new Date().toISOString() }),
      },
    });
  }

  // 7. Premium: Seed sample institutions for IP authentication
  const institutions = [
    {
      name: "University of Edinburgh",
      domain: "ed.ac.uk",
      country: "United Kingdom",
      ipRanges: "129.215.0.0/16,131.211.0.0/16",
      plan: "INSTITUTIONAL",
      apcQuota: 0,
      counterCustomerId: "epip-edinburgh-2024",
    },
    {
      name: "Tsinghua University",
      domain: "tsinghua.edu.cn",
      country: "China",
      ipRanges: "166.111.0.0/16,183.172.0.0/16",
      plan: "TRANSFORMATIVE",
      apcQuota: 12,
      apcUsed: 3,
      counterCustomerId: "epip-tsinghua-2024",
    },
    {
      name: "University of Cape Town",
      domain: "uct.ac.za",
      country: "South Africa",
      ipRanges: "137.158.0.0/16,196.21.0.0/16",
      plan: "INSTITUTIONAL",
      apcQuota: 0,
      counterCustomerId: "epip-uct-2024",
    },
  ];

  for (const inst of institutions) {
    await db.institution.create({
      data: {
        ...inst,
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 280 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`  Created institution: ${inst.name}`);
  }

  // 8. Premium: Index all published articles for semantic search
  console.log("  Indexing published articles for semantic search...");
  const { indexArticle } = await import("../src/lib/embeddings");
  const published = await db.article.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true },
  });
  for (const a of published) {
    await indexArticle(a.id);
  }
  console.log(`  Indexed ${published.length} articles.`);

  // 9. Premium: Run editorial triage on all articles
  console.log("  Running editorial triage on existing articles...");
  const { runEditorialTriage } = await import("../src/lib/triage");
  const allArticles = await db.article.findMany({
    where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "REVISIONS_REQUIRED", "ACCEPTED", "PUBLISHED"] } },
    select: { id: true },
  });
  for (const a of allArticles) {
    await runEditorialTriage(a.id).catch(() => {});
  }
  console.log(`  Triaged ${allArticles.length} articles.`);

  console.log("Seeding complete.");
}

// Only auto-run when invoked directly, not when imported by reseed.ts
if (import.meta.main) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
