import { DOI_REGISTRAR, JOURNAL_IDENTITY } from "@/lib/site";
import type { BlogPost } from "@/lib/resources/types";

/**
 * Full text of the Resources blog: long-form, referenced editorial essays.
 * Each post follows the same structure, so it reads well and works for both
 * classic search and answer engines:
 *
 * - an answer-first lede (the passage an AI overview or featured snippet
 *   quotes);
 * - exactly ten key takeaways;
 * - question-led section headings;
 * - an FAQ block (emitted as schema.org FAQPage JSON-LD);
 * - an APA 7 reference list.
 *
 * Catalog fields (title, slug, excerpt, dates) live in
 * src/lib/resources-content.ts and are merged in by getBlogPost().
 *
 * Rules for editing:
 * - Describe only workflows the platform actually runs.
 * - Cite only sources that exist.
 * - Never claim memberships or certifications the journal doesn't hold:
 *   "aligned with COPE", not "COPE member".
 */
export const BLOG_POSTS: Record<string, BlogPost> = {
  "blog-syndication-network": {
    id: "blog-syndication-network",
    lede: `Most journals treat the DOI as the finish line. At ${JOURNAL_IDENTITY.name} publication is the starting line: every peer-reviewed, DOI-registered article becomes eligible for syndication across eight platforms — one automated API channel, six ready-to-post share kits and two consent-gated preprint packages — while the DOI and the version of record stay the single authoritative copy.`,
    metaDescription:
      "How Eleventh Press syndicates every peer-reviewed article across eight platforms — Blogger, ResearchGate, Academia.edu, Substack, Medium, LinkedIn, HubPages, arXiv/SSRN — without diluting the DOI or version of record.",
    keywords: [
      "research syndication",
      "scholarly dissemination",
      "version of record",
      "canonical link",
      "DOI",
      "ResearchGate",
      "Academia.edu",
      "preprint",
      "arXiv",
      "SSRN",
      "open access discoverability",
      "altmetrics",
    ],
    keyTakeaways: [
      "Publication is the beginning of an article's public life, not the end: discoverability now depends on reaching readers where they already search and read.",
      "Every published Eleventh Press article is eligible for syndication across eight platforms with no extra manuscript preparation by the author.",
      "Blogger is fully automated through the official Blogger API: connect once, then publish any future article to your blog with a single action.",
      "ResearchGate, Academia.edu, Substack, Medium, LinkedIn Articles and HubPages each receive a ready-to-post share kit with a plain-language excerpt and a canonical backlink.",
      "arXiv and SSRN submission packages are generated only after an explicit consent step, because preprint posting carries policy implications that vary by field and agreement.",
      "Syndication never creates a second version of record: every copy points back to the DOI, consistent with the NISO Journal Article Versions recommendations.",
      "Canonical links consolidate citations and search signals on the original article instead of splitting them across duplicates.",
      "Plain-language excerpts summarise the published findings without adding new claims, so the peer-reviewed text remains the authoritative account.",
      "Evidence links early and wide dissemination with more attention and citations, but reach should be read through responsible-metrics frameworks such as DORA and the Leiden Manifesto.",
      "Syndication is dissemination, not republication: it does not trigger new peer review and is not redundant or duplicate publication.",
    ],
    sections: [
      {
        heading: "Why is publication the starting line rather than the finish line?",
        paragraphs: [
          "For most of the history of scholarly journals, the publisher's job ended once an article was registered, typeset and placed in an issue. Readers came to the journal; the journal did not need to go to them. That model assumed a small number of venues, a library-mediated readership and a reader who browsed tables of contents. None of those assumptions holds today. Millions of research articles are published every year, readers arrive through search engines, social platforms, academic networks and newsletters, and an increasing share of the audience for research sits outside the academy altogether — practitioners, policymakers, journalists and the interested public.",
          "In that environment a DOI is necessary but not sufficient. It guarantees that an article can always be found once someone is looking for it; it does nothing to make sure that the right readers start looking. Research on open access consistently finds that freely available articles are read and cited more than paywalled ones, and that much of that advantage comes from findability as much as from cost (Piwowar et al., 2018). We built Eleventh Press to treat dissemination as part of the publishing service rather than as homework left to the author after the fact.",
        ],
      },
      {
        heading: "Which eight platforms does the syndication network cover?",
        paragraphs: [
          "The network has three tiers, chosen according to what each platform technically allows and what each one is for. Our guiding principle is that we automate only where an official, supported interface exists, and that we never post on an author's behalf to a platform without the author's own account and consent.",
        ],
        bullets: [
          "Automated channel — Blogger: after a one-time account connection, any future article can be published to the author's Blogger site through the official Blogger API with a single action, including the abstract, a plain-language summary and the canonical DOI link.",
          "Share kits — ResearchGate, Academia.edu, Substack, Medium, LinkedIn Articles and HubPages: each kit contains a repurposed excerpt tuned to the platform's conventions, suggested headline and tags, and a canonical backlink to the version of record, ready to paste in a couple of minutes.",
          "Preprint packages — arXiv and SSRN: formatted submission packages for disciplines where preprint servers are a central part of the literature, generated only after the author completes an explicit consent step.",
        ],
        after:
          "Because the share kits are generated from the accepted, typeset article, authors do not need to prepare a second manuscript, write promotional copy or reformat figures. The work that remains is the part only an author can legitimately do: deciding where they want their work to appear under their own name.",
      },
      {
        heading: "How does syndication protect the version of record?",
        paragraphs: [
          "The scholarly record depends on there being one authoritative, citable version of each article. The NISO/ALPSP Journal Article Versions recommendations distinguish the author's original, the accepted manuscript and the version of record, the final, formally published article that carries the DOI (NISO, 2008). Syndicated copies are not new versions in that sense; they are pointers and summaries that send readers back to the version of record.",
          "That is why every share kit and every automated Blogger post carries a canonical link to the DOI landing page. For search engines a canonical link signals that the original page is the primary source, which consolidates ranking signals there rather than splitting them across near-duplicates. For readers it means a citation copied from any platform resolves to the same permanent record. For the integrity of the literature it means that if a correction or retraction is ever issued, the authoritative page that readers reach carries the notice.",
        ],
      },
      {
        heading: "What is a plain-language excerpt, and what safeguards apply to it?",
        paragraphs: [
          "Each share kit includes an excerpt rewritten for a general academic or professional audience: what question the research asked, what it found and why it matters, typically in a few hundred words. Plain-language summaries are increasingly expected by funders and are one of the most effective ways to make specialist research legible to adjacent fields.",
          "Summaries also carry a risk familiar to anyone who has watched a press release overstate a finding: compression invites exaggeration. Our excerpts are therefore generated strictly from the published abstract and lay summary, never introduce claims the article does not make, preserve stated limitations, and are presented to the author for review before anything is posted. The peer-reviewed article remains the authoritative account; the excerpt is an invitation to read it.",
        ],
      },
      {
        heading: "Why are arXiv and SSRN packages gated behind a consent step?",
        paragraphs: [
          "Preprint servers are central to research communication in physics, mathematics, computer science, economics, law and parts of the social sciences, and evidence suggests that posting a preprint is associated with more attention and more citations for the eventual peer-reviewed article (Fu & Hughey, 2019). But preprint posting is also governed by rules that differ by server, discipline, funder and, for authors who have co-authors or institutional agreements, by contracts we cannot see.",
          "The consent step asks authors to confirm that posting is compatible with their obligations, that all co-authors agree, and that they understand the licence the server will apply. Only then is the package generated. Because Eleventh Press publishes under CC BY 4.0 and authors retain copyright, our own policy places no barrier on posting; the gate exists so that the author makes an informed decision rather than an automatic one.",
        ],
      },
      {
        heading: "How should the reach of a syndicated article be measured?",
        paragraphs: [
          "Syndication increases the surface area of an article, and with it the number of views, downloads, mentions and saves it can accumulate. These signals are useful: they show where an article is being discussed and by whom. They are also easy to over-read. A view on a social platform is not a reading, and neither attention nor citation counts are a direct measure of quality.",
          "We encourage authors and assessors to follow the responsible-metrics principles of the San Francisco Declaration on Research Assessment (DORA, 2012) and the Leiden Manifesto (Hicks et al., 2015): judge research on its content, use metrics to support rather than replace expert judgement, and read any indicator in the context of the field and the audience it reflects. Attention data from syndicated channels is best used to learn which communities found the work valuable, and to plan where the next piece of work should be shared.",
        ],
      },
      {
        heading: "What syndication is not",
        paragraphs: [
          "Syndication is not republication. The article is not peer reviewed again, does not receive a second DOI and does not appear as a new item in any other journal. Duplicate or redundant publication — presenting substantially the same work as new in more than one venue — is a recognised breach of publication ethics under COPE guidance; syndication avoids it precisely because every copy is labelled as a pointer to the one published original.",
          `Nor is syndication a substitute for indexing. Every article is still registered with ${DOI_REGISTRAR}, exposed through our OAI-PMH 2.0 interface and marked up for Google Scholar. Syndication works alongside that infrastructure: indexing makes an article findable to people already searching, and syndication brings it to the people who did not yet know to look.`,
        ],
      },
    ],
    faqs: [
      {
        q: "Does syndicating my article count as duplicate publication?",
        a: "No. Duplicate publication means presenting the same work as new in more than one venue. Syndicated posts are clearly labelled excerpts and links that point back to the single DOI-registered version of record, so there is only ever one published article.",
      },
      {
        q: "Will syndication split my citations across different copies?",
        a: "No. Every share kit and automated post includes a canonical link to the DOI landing page, so readers, reference managers and search engines all resolve to the same version of record.",
      },
      {
        q: "Do I have to syndicate my article?",
        a: "No. Syndication is optional. The automated Blogger channel needs a one-time account connection, the share kits are posted by you, and preprint packages require an explicit consent step.",
      },
      {
        q: "Can I post my published article to arXiv or SSRN?",
        a: "Eleventh Press publishes under CC BY 4.0 and authors retain copyright, so our policy does not prevent it. Check the server's own rules, any funder or institutional conditions, and your co-authors' agreement before you complete the consent step.",
      },
      {
        q: "Is the plain-language excerpt reviewed before it is posted?",
        a: "Yes. Excerpts are generated from the published abstract and lay summary, never add new claims, and are shown to you before anything is posted under your name.",
      },
    ],
    references: [
      { text: "DORA. (2012). San Francisco Declaration on Research Assessment.", url: "https://sfdora.org/read/" },
      { text: "Fu, D. Y., & Hughey, J. J. (2019). Releasing a preprint is associated with more attention and citations for the peer-reviewed article. eLife, 8, e52646.", url: "https://doi.org/10.7554/eLife.52646" },
      { text: "Hicks, D., Wouters, P., Waltman, L., de Rijcke, S., & Rafols, I. (2015). Bibliometrics: The Leiden Manifesto for research metrics. Nature, 520(7548), 429–431.", url: "https://doi.org/10.1038/520429a" },
      { text: "NISO/ALPSP Journal Article Versions (JAV) Technical Working Group. (2008). Journal article versions (JAV): Recommendations of the NISO/ALPSP JAV Technical Working Group (NISO RP-8-2008). National Information Standards Organization." },
      { text: "Piwowar, H., Priem, J., Larivière, V., Alperin, J. P., Matthias, L., Norlander, B., Farley, A., West, J., & Haustein, S. (2018). The state of OA: A large-scale analysis of the prevalence and impact of open access articles. PeerJ, 6, e4375.", url: "https://doi.org/10.7717/peerj.4375" },
      { text: "Committee on Publication Ethics. (2017). Core practices.", url: "https://publicationethics.org/core-practices" },
    ],
    relatedGuides: ["guide-author-submission", "guide-publication-ethics"],
  },

  "blog-book-division": {
    id: "blog-book-division",
    lede: "Eleventh Press authors can turn their published research into a book by two routes: compiling their own published articles into an edited volume or anthology, or submitting a new monograph manuscript. Both go through editorial review and production into a standards-compliant EPUB 3 file and a print-ready PDF, then out to major retailers through Draft2Digital and IngramSpark.",
    metaDescription:
      "How the Eleventh Press book division turns published articles into edited volumes or publishes new monographs: editorial review, EPUB 3 and print-ready production, rights, metadata and retail distribution.",
    keywords: [
      "academic book publishing",
      "edited volume",
      "monograph",
      "anthology",
      "EPUB 3",
      "print-on-demand",
      "IngramSpark",
      "Draft2Digital",
      "open access monograph",
      "book distribution",
    ],
    keyTakeaways: [
      "The monograph and the edited volume remain central forms of scholarship, especially in the humanities and social sciences, where sustained argument needs book length.",
      "Route one compiles your own published Eleventh Press articles into an edited volume or anthology with new framing material.",
      "Route two accepts a new monograph manuscript for full editorial and peer review, on the same footing as a journal article.",
      "Production generates a genuine EPUB 3 file and a print-ready PDF directly from the manuscript or compiled chapters, not placeholder files.",
      "Compiled chapters keep a clear link to the original articles through “previously published” notes and DOIs, preserving the scholarly record.",
      "CC BY 4.0 permits reuse of published articles in a book, but every co-author of a reused article should agree to its inclusion.",
      "Draft2Digital and IngramSpark each distribute a title to multiple retailers, including Apple Books, Barnes & Noble, Kobo and IngramSpark's print-on-demand network.",
      "Amazon KDP and Lulu remain available as free, self-serve routes for authors who prefer to publish there directly.",
      "Accurate metadata — title, contributors, subject categories and description — decides whether a book is found in retailer and library catalogues.",
      "Accessible EPUB design (structure, alternative text, reading order) widens readership and reflects W3C EPUB accessibility guidance.",
    ],
    sections: [
      {
        heading: "Why does the academic book still matter?",
        paragraphs: [
          "Journal articles are the dominant unit of communication in most sciences, but they are not the only one. In history, philosophy, literature, law, area studies and large parts of the social sciences, the monograph is where a scholar develops a sustained argument at a scale that an eight-thousand-word article cannot accommodate. Edited volumes do something different but equally valuable: they bring a set of related studies into conversation, give a field a shared reference point, and introduce a body of work to readers who would not have found its parts scattered across journals.",
          "The UK review of monographs and open access led by Geoffrey Crossick concluded that the monograph remains a vital, not vestigial, form of scholarship, while recognising the economic pressures that have made it harder to publish (Crossick, 2015). Our book division exists to lower those barriers for authors who already publish with us, without lowering the editorial standard a book deserves.",
        ],
      },
      {
        heading: "What are the two routes to publishing a book with us?",
        paragraphs: [
          "The first route is compilation. An author who has published a coherent body of work with Eleventh Press can propose an edited volume or anthology built from those articles. A strong proposal adds what a set of articles lacks on its own: an introduction that sets out the shared problem, connective material that explains how the studies relate, an updated conclusion and, where appropriate, a consolidated bibliography and index. A book that is only a stapled set of PDFs serves no reader well, so the editorial review of a compiled volume concentrates on that added framing.",
          "The second route is a new manuscript: a monograph, a research-based textbook or a scholarly edited collection with external contributors. New manuscripts go through submission, editorial assessment and peer review in the same way as a journal article, with reviewers asked to evaluate the argument at book length, its contribution to the field, and the structure and readability of the whole.",
        ],
      },
      {
        heading: "How does editorial review work for books?",
        paragraphs: [
          "Book review follows the same principles as our journal: independent expert assessment, disclosure and management of competing interests, confidentiality, and decisions made by the editor on the basis of the reviews rather than on commercial grounds. The COPE Core Practices apply to books as much as to journals, and so do our policies on authorship, plagiarism and research integrity.",
          "Reviewers of a monograph are typically asked a broader set of questions than article reviewers: whether the argument justifies book length, whether the chapters build on one another, whether the literature engaged is current and representative, and who the intended readership is. For compiled volumes the review concentrates on the coherence and value of the new framing material and on whether the selection of articles tells a story worth telling as a book.",
        ],
      },
      {
        heading: "What does production actually produce?",
        paragraphs: [
          "Production generates two real files from the accepted manuscript or compiled chapters: a reflowable EPUB 3 e-book and a print-ready PDF interior. EPUB 3 is the W3C-maintained open standard for e-books and the format accepted across major e-book retailers and library platforms. Its reflowable layout adapts to phones, tablets and e-readers, and its structural markup supports navigation, search and assistive technologies.",
          "The print PDF is laid out for trim size, margins and typography suitable for print-on-demand. Accessibility is part of production rather than an afterthought: headings are structurally tagged, images carry alternative text supplied by the author, reading order is defined, and the publication follows the direction set by the W3C EPUB Accessibility specification.",
        ],
      },
      {
        heading: "Can I reuse my CC BY articles in a book?",
        paragraphs: [
          "Yes. Articles published by Eleventh Press carry the Creative Commons Attribution 4.0 licence and authors retain copyright, so reuse in a book is permitted, provided the original publication is credited. In practice we ask for three things. First, every chapter derived from an article includes a “previously published” note with the full citation and DOI, so the book and the article remain linked in the scholarly record. Second, where an article had co-authors, all of them should agree to its inclusion and be credited as chapter authors. Third, any third-party material inside the original article — a figure reproduced with permission, for example — is checked, because a permission granted for a journal article does not always extend to a commercially distributed book.",
          "Substantial revisions are welcome and often desirable, but a revised chapter should say so, so that readers know whether they are reading the version of record or an updated text.",
        ],
      },
      {
        heading: "Where will my book be sold, and how?",
        paragraphs: [
          "Distribution is where the division reaches furthest. Draft2Digital and IngramSpark are aggregators: a single submission to each places a title with multiple retailers, including Apple Books, Barnes & Noble and Kobo, while IngramSpark also offers print-on-demand through its wholesale network, which many bookshops and libraries order from. Print-on-demand means there is no print run to fund and no stock to store; copies are printed as orders arrive.",
          "Amazon Kindle Direct Publishing and Lulu remain available as free, self-serve routes for authors who would rather publish there directly under their own account. We provide the production files and guidance; the author controls those listings. Each channel has its own rules on ISBNs, pricing and territories, and our production team confirms the arrangement for each title before distribution begins.",
        ],
      },
      {
        heading: "How do readers and libraries discover a book?",
        paragraphs: [
          "A book's metadata is its storefront. Retailers and library suppliers rely on structured records to classify and surface titles, and the book trade exchanges that metadata using standards such as EDItEUR's ONIX for Books. The fields that matter most are the same everywhere: an accurate title and subtitle, the contributor names and roles, a descriptive and keyword-rich blurb written for the intended reader, subject categories, and the publication date.",
          "Authors are best placed to write the description and to tell us who the book is for, so the proposal form asks for both. For edited volumes built from articles, the book description should also name the problem the volume addresses, because that is what a reader searches for — not the titles of the individual chapters.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I publish a book made from articles I published with Eleventh Press?",
        a: "Yes. You can propose an edited volume or anthology compiled from your published articles. The proposal should include new framing material such as an introduction and connective chapters, and every reused article keeps a “previously published” note with its DOI.",
      },
      {
        q: "Is a book manuscript peer reviewed?",
        a: "Yes. New monographs go through editorial assessment and independent peer review. For compiled volumes, review concentrates on the new framing material and the coherence of the selection.",
      },
      {
        q: "What file formats does production create?",
        a: "A reflowable EPUB 3 e-book and a print-ready PDF interior suitable for print-on-demand, both generated from your accepted manuscript or compiled chapters.",
      },
      {
        q: "Which retailers will carry my book?",
        a: "Through Draft2Digital and IngramSpark, titles reach retailers including Apple Books, Barnes & Noble and Kobo, plus IngramSpark's print-on-demand network. Amazon KDP and Lulu are available as self-serve routes under your own account.",
      },
      {
        q: "Do my co-authors need to agree before an article is reused?",
        a: "Yes. CC BY permits the reuse legally, but good practice and fairness require that every co-author of a reused article agrees to its inclusion and is credited.",
      },
    ],
    references: [
      { text: "Crossick, G. (2015). Monographs and open access: A report to HEFCE. Higher Education Funding Council for England." },
      { text: "Eve, M. P. (2014). Open access and the humanities: Contexts, controversies and the future. Cambridge University Press.", url: "https://doi.org/10.1017/CBO9781316161012" },
      { text: "Thompson, J. B. (2005). Books in the digital age: The transformation of academic and higher education publishing in Britain and the United States. Polity Press." },
      { text: "World Wide Web Consortium. (2023). EPUB 3.3 (W3C Recommendation).", url: "https://www.w3.org/TR/epub-33/" },
      { text: "World Wide Web Consortium. (2023). EPUB Accessibility 1.1 (W3C Recommendation).", url: "https://www.w3.org/TR/epub-a11y-11/" },
      { text: "EDItEUR. (n.d.). ONIX for Books.", url: "https://www.editeur.org/8/ONIX/" },
    ],
    relatedGuides: ["guide-author-submission", "guide-formatting-citation"],
  },

  "blog-multidisciplinary-standards": {
    id: "blog-multidisciplinary-standards",
    lede: "Multidisciplinary manuscripts fail single-discipline review because no single reviewer can judge every component. Eleventh Press assigns discipline-matched reviewers to each component, applies the reporting guideline that fits each method, and asks the handling editor to synthesise the reviews and judge the integration itself — so cross-field work is evaluated on its own terms.",
    metaDescription:
      "Why multidisciplinary and interdisciplinary research needs its own peer-review standards: component-matched reviewers, reporting guidelines per method, mixed-methods integration and editorial synthesis.",
    keywords: [
      "multidisciplinary research",
      "interdisciplinary peer review",
      "transdisciplinary research",
      "reporting guidelines",
      "EQUATOR Network",
      "mixed methods",
      "GRAMMS",
      "editorial standards",
      "research evaluation",
      "peer review bias",
    ],
    keyTakeaways: [
      "Multidisciplinary, interdisciplinary and transdisciplinary research differ in how deeply fields are integrated, and each needs a different kind of evaluation.",
      "Evidence shows interdisciplinary proposals and careers face systematic disadvantages in conventional evaluation, which a well-designed review process must counteract.",
      "Single-discipline checklists fail on cross-field manuscripts because no single reviewer can credibly assess every method and literature involved.",
      "Eleventh Press assigns discipline-matched reviewers to each substantive component of a manuscript rather than one generalist to the whole.",
      "Each component is assessed against the reporting guideline appropriate to its method, drawn from the EQUATOR Network library where one exists.",
      "Mixed-methods work is additionally judged on integration — how the strands combine — using criteria such as GRAMMS.",
      "The handling editor synthesises divergent reviews and makes a decision about the manuscript as a whole, not by counting votes.",
      "Authors can help by writing for the adjacent reader: define field-specific terms, justify methods to outsiders and state each field's contribution explicitly.",
      "Component-matched review takes longer than single-track review, and we accept that cost as the price of fair evaluation.",
      `Our twelve-discipline remit, from Physics to Language and Literature, exists because the most consequential research questions rarely respect disciplinary boundaries.`,
    ],
    sections: [
      {
        heading: "What makes research multidisciplinary, interdisciplinary or transdisciplinary?",
        paragraphs: [
          "The terms are often used interchangeably, but they describe different degrees of integration. Multidisciplinary research places several disciplines side by side, each contributing its own methods to a shared problem. Interdisciplinary research integrates concepts, data or methods from different fields into a framework none of them would produce alone. Transdisciplinary research goes further again, frequently involving non-academic partners and producing knowledge that transcends the contributing disciplines. The US National Academies' influential report on facilitating interdisciplinary research framed the distinction around integration of information, data, techniques, tools, perspectives, concepts and theories (National Academies, 2005).",
          "For editors the distinction matters because it decides what has to be evaluated. A multidisciplinary paper can largely be assessed component by component. An interdisciplinary paper must also be assessed on whether the integration works: whether the climate model's assumptions are compatible with the epidemiological data it is coupled to, or whether the qualitative findings genuinely inform the quantitative design.",
        ],
      },
      {
        heading: "Is interdisciplinary work disadvantaged in conventional evaluation?",
        paragraphs: [
          "The evidence suggests that it often is. An analysis of research proposals submitted to the Australian Research Council found that the more interdisciplinary a proposal, the lower its chance of being funded (Bromham et al., 2016). A large study of researchers' careers found that interdisciplinary scientists were more visible but less productive by conventional publication counts, partly because integration takes time and partly because their work is harder to place (Leahey et al., 2017). Bibliometric work suggests interdisciplinary papers can take longer to accumulate citations even when their long-term impact is high (Wang et al., 2015).",
          "Michèle Lamont's ethnography of funding panels describes why. Reviewers apply the standards of their own discipline, and work that does not fit those standards is easily read as weak rather than as different (Lamont, 2009). A journal that claims a multidisciplinary remit has to design its review process to counteract that tendency, not merely tolerate cross-field submissions.",
        ],
      },
      {
        heading: "Why do single-discipline checklists break down?",
        paragraphs: [
          "Most peer-review forms were written for a single discipline and then reused everywhere. They ask whether the methods are appropriate and the conclusions follow from the results, and they implicitly assume that one reviewer can answer both questions for the whole paper. Consider a manuscript that combines downscaled climate projections, a statistical model of heat-related hospital admissions and semi-structured interviews with municipal planners. A climate scientist is well placed to judge the projections, an epidemiologist the admissions model and a qualitative social scientist the interviews; it is rare for anyone to be expert in all three.",
          "When a single generalist reviews such a paper, two failure modes are common. The reviewer may defer on everything outside their expertise, so parts of the work receive no meaningful scrutiny; or they may judge the unfamiliar parts by the conventions of their own field and reject sound work for the wrong reasons. Either outcome is unfair to authors and unhelpful to readers.",
        ],
      },
      {
        heading: "How does component-matched review work at Eleventh Press?",
        paragraphs: [
          "When a cross-field manuscript clears initial screening, the handling editor identifies its substantive components and matches a reviewer to each, using the manuscript's discipline tags and keywords against reviewers' declared expertise. Each reviewer is told which component they are primarily responsible for, invited to comment on the rest where they feel competent, and asked to state their confidence in their own assessment.",
          "Each component is then assessed against the reporting standard that fits its method. The EQUATOR Network maintains a library of reporting guidelines — CONSORT for randomised trials, PRISMA 2020 for systematic reviews (Page et al., 2021), STROBE for observational studies, COREQ and SRQR for qualitative research, ARRIVE for animal research — and we point reviewers to the relevant ones. For mixed-methods studies we also ask reviewers to assess integration using criteria such as GRAMMS, the Good Reporting of A Mixed Methods Study framework (O'Cathain et al., 2008).",
        ],
      },
      {
        heading: "What is the editor's role when reviewers disagree?",
        paragraphs: [
          "Component-matched review produces reports that often pull in different directions: the climate reviewer may be satisfied while the qualitative reviewer asks for a deeper analysis. The handling editor's job is synthesis, not arithmetic. A decision is not reached by counting recommendations; it is reached by asking whether each component meets the standard of its own field and whether the integration delivers something none of the components could deliver alone.",
          "Where reviews conflict on a matter of fact, the editor may seek an additional opinion. Where they conflict on a matter of disciplinary convention, the editor explains in the decision letter which convention applies to which part of the work, so authors receive a coherent set of revisions rather than contradictory instructions.",
        ],
      },
      {
        heading: "How can authors write for a multidisciplinary readership?",
        paragraphs: [
          "Authors can do a great deal to make cross-field work reviewable. The most useful habit is to write for the adjacent reader: the expert in one of your fields who is a newcomer to the others.",
        ],
        bullets: [
          "Define field-specific terms at first use, or include a short glossary.",
          "Justify methodological choices in terms an outsider can follow, not only by citation to your own field's conventions.",
          "State explicitly what each discipline contributes and what the integration adds.",
          "Report each component to its own field's standard and say which reporting guidelines you followed.",
          "Discuss limitations from the perspective of each contributing field, not only the one you trained in.",
        ],
      },
      {
        heading: "What does this cost, and why is it worth it?",
        paragraphs: [
          "Component-matched review is slower than single-track review. It needs more reviewers, more coordination and more editorial time, and finding qualified reviewers for an unusual combination of fields can take longer. We accept that cost deliberately.",
          `Our twelve disciplines — from Physics, Biology and Computer Science to Economics, Education and Language and Literature — were chosen because the questions that matter most, such as climate adaptation, algorithmic governance, genomic medicine and urban inequality, sit across them. A press built for that research has to evaluate it on its own terms. The alternative, forcing cross-field work into a single discipline's checklist, is faster only because it is less fair.`,
        ],
      },
    ],
    faqs: [
      {
        q: "What is the difference between multidisciplinary and interdisciplinary research?",
        a: "Multidisciplinary research places several disciplines side by side on a shared problem; interdisciplinary research integrates their concepts, data or methods into a new framework. Interdisciplinary work must therefore also be evaluated on how well that integration works.",
      },
      {
        q: "How many reviewers will a multidisciplinary manuscript receive?",
        a: "Typically two or three, matched to the manuscript's substantive components. Where a paper has more components than that, the editor may invite additional reviewers or seek a specific opinion on one part.",
      },
      {
        q: "Which reporting guidelines should I follow?",
        a: "Follow the guideline that matches each method, using the EQUATOR Network library — for example CONSORT for trials, PRISMA 2020 for systematic reviews, STROBE for observational studies and COREQ or SRQR for qualitative work — and state which ones you used.",
      },
      {
        q: "What happens when reviewers from different fields disagree?",
        a: "The handling editor synthesises the reports, judges each component against its own field's standards, and explains in the decision letter which expectations apply to which part of the work.",
      },
    ],
    references: [
      { text: "Bromham, L., Dinnage, R., & Hua, X. (2016). Interdisciplinary research has consistently lower funding success. Nature, 534(7609), 684–687.", url: "https://doi.org/10.1038/nature18315" },
      { text: "Lamont, M. (2009). How professors think: Inside the curious world of academic judgment. Harvard University Press." },
      { text: "Leahey, E., Beckman, C. M., & Stanko, T. L. (2017). Prominent but less productive: The impact of interdisciplinarity on scientists' research. Administrative Science Quarterly, 62(1), 105–139.", url: "https://doi.org/10.1177/0001839216665364" },
      { text: "National Academy of Sciences, National Academy of Engineering, & Institute of Medicine. (2005). Facilitating interdisciplinary research. The National Academies Press.", url: "https://doi.org/10.17226/11153" },
      { text: "O'Cathain, A., Murphy, E., & Nicholl, J. (2008). The quality of mixed methods studies in health services research. Journal of Health Services Research & Policy, 13(2), 92–98.", url: "https://doi.org/10.1258/jhsrp.2007.007074" },
      { text: "Page, M. J., McKenzie, J. E., Bossuyt, P. M., et al. (2021). The PRISMA 2020 statement: An updated guideline for reporting systematic reviews. BMJ, 372, n71.", url: "https://doi.org/10.1136/bmj.n71" },
      { text: "Wang, J., Thijs, B., & Glänzel, W. (2015). Interdisciplinarity and impact: Distinct effects of variety, balance, and disparity. PLOS ONE, 10(5), e0127298.", url: "https://doi.org/10.1371/journal.pone.0127298" },
      { text: "EQUATOR Network. (n.d.). Enhancing the QUAlity and Transparency Of health Research: Reporting guidelines library.", url: "https://www.equator-network.org/" },
    ],
    relatedGuides: ["guide-reviewer-handbook", "guide-author-submission"],
  },

  "blog-apc-explained": {
    id: "blog-apc-explained",
    lede: `The Eleventh Press article processing charge is ${JOURNAL_IDENTITY.apc}, invoiced once and only after acceptance. It funds editorial and peer-review coordination, DOI registration with ${DOI_REGISTRAR}, typesetting into PDF, HTML and JATS, permanent open-access hosting, and eligibility for the syndication network and book division. Payment and editorial decisions are kept strictly separate, and waivers are available.`,
    metaDescription:
      "What an open access article processing charge (APC) pays for, when Eleventh Press charges its USD 97 APC, how fees are firewalled from peer review, how waivers work and how to spot a predatory fee.",
    keywords: [
      "article processing charge",
      "APC",
      "open access publishing cost",
      "gold open access",
      "diamond open access",
      "APC waiver",
      "Plan S",
      "predatory journals",
      "price transparency",
      "open access funding",
    ],
    keyTakeaways: [
      "An article processing charge (APC) is a publication fee that replaces reader subscriptions, so the article can be free to read for everyone, permanently.",
      `The Eleventh Press APC is ${JOURNAL_IDENTITY.apc}, charged once per accepted article, with no submission fee and no page or colour charges.`,
      "The APC is invoiced only after acceptance and is never a condition of being reviewed.",
      `It funds five concrete services: editorial and peer-review coordination, DOI registration with ${DOI_REGISTRAR}, production into PDF, HTML and JATS XML, permanent open-access hosting, and syndication and book-division eligibility.`,
      "Waiver requests are handled by the editorial office, entirely separate from reviewers and the handling editor, and never influence the editorial decision.",
      "Full and partial waivers are available; ask before assuming you cannot publish.",
      "Open access comes in several models — gold, diamond, green and hybrid — and an APC is only one way of paying for it.",
      "Authors can often fund APCs through research grants, institutional open-access funds or transformative agreements.",
      "Fee transparency is a core requirement of the Principles of Transparency and Best Practice in Scholarly Publishing and of Plan S.",
      "Predatory journals are characterised by fees without genuine services; a legitimate APC is published in advance and maps to real, verifiable work.",
    ],
    sections: [
      {
        heading: "What is an article processing charge?",
        paragraphs: [
          "In the subscription model, readers or their libraries pay for access after publication, and articles sit behind a paywall. Open access reverses that flow. The Budapest Open Access Initiative of 2002 set out the goal of research literature that is free to read and free to reuse, and one way to sustain it is to charge a fee at the point of publication, so that the cost of producing an article is covered before it is released to everyone (Suber, 2012). That fee is the article processing charge.",
          "An APC is not the only way to fund open access. In the “diamond” model, a funder, society or institution covers costs and neither readers nor authors pay. In the “green” model, authors deposit a version of a subscription article in a repository. Hybrid journals charge APCs for individual articles in otherwise subscription titles, a model funders such as cOAlition S have moved away from supporting. Eleventh Press is a fully open-access “gold” journal: every article is free to read from the day it is published, under CC BY 4.0.",
        ],
      },
      {
        heading: `What does the ${JOURNAL_IDENTITY.apc} APC actually fund?`,
        paragraphs: [
          "An APC often reads as an abstract toll. In practice ours maps to five concrete services, each of which has a real cost in staff time or infrastructure:",
        ],
        bullets: [
          "Editorial and peer-review coordination: initial screening, the similarity check, anonymisation, reviewer matching and invitations, decision letters and revision handling.",
          `DOI registration with ${DOI_REGISTRAR}, so the article has a persistent identifier that resolves for as long as the scholarly record exists.`,
          "Production: typesetting into PDF, HTML and JATS XML, citation validation against OpenAlex, and the provenance seal that lets anyone verify the published record has not been altered.",
          "Permanent open-access hosting, exposure through OAI-PMH 2.0 and Google Scholar markup, and preservation of the archived galleys.",
          "Eligibility for the syndication network across eight platforms and for the book-publishing division.",
        ],
        after:
          "Studies of APC pricing have documented fees ranging from under a hundred to several thousand US dollars, with no simple relationship between price and quality (Solomon & Björk, 2012). Our fee is set to cover these services at a level that individual researchers, not only well-funded laboratories, can meet.",
      },
      {
        heading: "When is the APC charged?",
        paragraphs: [
          "Once, and only after acceptance. There is no submission fee, no fee for being reviewed and no charge for revisions, extra pages or colour figures. If a manuscript is rejected, the author pays nothing.",
          "The timing is deliberate. Charging at submission would create an incentive to accept papers in order to keep fees, or a perception of one. Charging only on acceptance keeps the editorial decision about the work alone.",
        ],
      },
      {
        heading: "How is payment kept separate from peer review?",
        paragraphs: [
          "If a reviewer's recommendation or an editor's decision were linked in any way to an author's ability to pay, the review process would be compromised. We therefore keep the two strictly apart. Reviewers never see information about fees or waiver requests. Waiver requests — made in the submission form, or later by email to the editorial office if circumstances change — are assessed by the editorial office, not by the handling editor or reviewers. A pending waiver request never delays production once it is approved.",
          "This separation reflects the Principles of Transparency and Best Practice in Scholarly Publishing, jointly maintained by COPE, DOAJ, OASPA and WAME, which require journals to state their fees clearly and in advance and to ensure that publishing decisions are not influenced by an author's ability to pay (COPE et al., 2022).",
        ],
      },
      {
        heading: "What if I cannot afford the APC?",
        paragraphs: [
          "Ask for a waiver before you assume you cannot publish with us. Full waivers are available, and so are partial waivers for cases where the full fee is a genuine burden but a reduced amount is manageable. A brief explanation of your funding situation is enough for a standard request; elaborate documentation is not required. The APC Waiver Request Guide sets out the process, and the World Bank income classifications and Research4Life country lists are among the reference points we use.",
          "Plan S, the open-access initiative of cOAlition S funders, expects journals to offer waivers or discounts for authors from lower-income economies and to make fees transparent. Our waiver policy is designed to meet that expectation and to make sure no author is excluded on cost alone.",
        ],
      },
      {
        heading: "Where can I find funding for an APC?",
        paragraphs: [
          "Many authors do not need to pay an APC personally. Before requesting a waiver, check three common sources. Research grants frequently allow publication costs as an eligible expense, particularly where the funder mandates open access. Many universities hold institutional open-access funds or library budgets for APCs. And a growing number of institutions have transformative or read-and-publish agreements that cover APCs for their authors with participating publishers. Your library or research office will know which apply to you.",
        ],
      },
      {
        heading: "How can I tell a fair APC from a predatory one?",
        paragraphs: [
          "Predatory journals have been defined by an international consensus as entities that prioritise self-interest at the expense of scholarship, characterised by false or misleading information, deviation from best editorial and publication practices, a lack of transparency and aggressive, indiscriminate solicitation (Grudniewicz et al., 2019). Their fees buy the appearance of publication without the substance.",
          "A legitimate APC has a few recognisable features: it is published before you submit; it is charged only after a genuine peer-review process has led to acceptance; it maps to services you can verify, such as a resolving DOI, an indexed record and a stable hosted article; and a waiver policy exists. Check whether the journal's ISSN, editorial board and contact details are real and verifiable. Every claim we make about our own services — the DOI, the indexing interfaces, the provenance seal — can be checked independently on any published article.",
        ],
      },
    ],
    faqs: [
      {
        q: "How much is the Eleventh Press APC?",
        a: `${JOURNAL_IDENTITY.apc}, charged once per accepted article. There is no submission fee and no page, colour or revision charge.`,
      },
      {
        q: "When do I pay the APC?",
        a: "Only after your manuscript has been accepted. If your manuscript is rejected at any stage you pay nothing.",
      },
      {
        q: "Will asking for a waiver affect whether my paper is accepted?",
        a: "No. Waiver requests are assessed by the editorial office, separately from reviewers and the handling editor, and play no part in the editorial decision.",
      },
      {
        q: "Can I get a partial waiver?",
        a: "Yes. Partial waivers are available where a full waiver isn't warranted but the full fee is still a genuine burden.",
      },
      {
        q: "What is the difference between gold and diamond open access?",
        a: "Gold open access journals make every article free to read immediately, often funded by an APC. Diamond open access journals charge neither readers nor authors because a funder, society or institution covers the costs.",
      },
    ],
    references: [
      { text: "Budapest Open Access Initiative. (2002). Budapest Open Access Initiative declaration.", url: "https://www.budapestopenaccessinitiative.org/read/" },
      { text: "cOAlition S. (2018). Plan S: Principles and implementation.", url: "https://www.coalition-s.org/plan_s_principles/" },
      { text: "Committee on Publication Ethics, Directory of Open Access Journals, Open Access Scholarly Publishing Association, & World Association of Medical Editors. (2022). Principles of transparency and best practice in scholarly publishing (Version 4).", url: "https://doaj.org/apply/transparency/" },
      { text: "Grudniewicz, A., Moher, D., Cobey, K. D., et al. (2019). Predatory journals: No definition, no defence. Nature, 576(7786), 210–212.", url: "https://doi.org/10.1038/d41586-019-03759-y" },
      { text: "Solomon, D. J., & Björk, B.-C. (2012). A study of open access journals using article processing charges. Journal of the American Society for Information Science and Technology, 63(8), 1485–1495.", url: "https://doi.org/10.1002/asi.22673" },
      { text: "Suber, P. (2012). Open access. MIT Press.", url: "https://doi.org/10.7551/mitpress/9286.001.0001" },
    ],
    relatedGuides: ["guide-apc-waiver", "guide-author-submission"],
  },

  "blog-double-blind-review": {
    id: "blog-double-blind-review",
    lede: "In double-blind (double-anonymised) peer review, authors do not know who reviewed their work and reviewers do not know who wrote it. At Eleventh Press it is the default model: names, affiliations, acknowledgements, funding statements and file metadata are removed before a manuscript reaches reviewers, so the work is judged on its merits first. Single-anonymised or open review is offered where a field's norms make blinding impractical.",
    metaDescription:
      "Double-blind peer review explained: what gets anonymised, what the evidence says about reviewer bias, how to anonymise a manuscript, its limits, and when single-anonymised or open review fits better.",
    keywords: [
      "double-blind peer review",
      "double-anonymised review",
      "peer review bias",
      "anonymise manuscript",
      "single-blind review",
      "open peer review",
      "NISO peer review terminology",
      "reviewer bias",
      "prestige bias",
      "COPE peer reviewers",
    ],
    keyTakeaways: [
      "Double-blind review hides the authors' identities from reviewers and the reviewers' identities from authors; NISO's standard terminology calls it “double anonymized”.",
      "It is the default review model at Eleventh Press because it removes the most easily biased signals: name, institution, seniority and geography.",
      "Controlled evidence shows reviewers who can see author identities favour famous authors and prestigious institutions.",
      "Anonymisation covers more than the title page: acknowledgements, funding, self-citations, file names and document metadata all need attention.",
      "Self-citation is allowed in an anonymised manuscript when written in the third person, not removed.",
      "Blinding is imperfect: a niche dataset or a distinctive approach can reveal authorship, but the aim is to reduce bias, not to guarantee secrecy.",
      "Reviewers must not try to identify authors and must declare it to the editor if they recognise the work.",
      "Single-anonymised and fully open review are available where blinding is impractical or counterproductive, for example in some community-based research.",
      "Optional open peer review can publish reports alongside the article for authors who want the review history to be visible.",
      "Whatever the model, COPE's ethical guidelines for peer reviewers govern confidentiality, conflicts of interest and conduct.",
    ],
    sections: [
      {
        heading: "What exactly is double-blind peer review?",
        paragraphs: [
          "Peer review models differ mainly in who knows whose identity. In single-blind (single-anonymised) review, reviewers know who the authors are but authors do not know who the reviewers are; this remains the most common model in many sciences. In double-blind (double-anonymised) review, neither side knows the other's identity. In open review, identities are known to both sides, and in some forms the reports themselves are published.",
          "The publishing industry has moved towards more precise language. ANSI/NISO Z39.106-2023, the Standard Terminology for Peer Review developed with the STM association, describes these models in terms of identity transparency and uses “anonymized” rather than “blind”, partly to avoid ableist connotations and partly because it describes what actually happens to the manuscript. We use both terms in this article because “double-blind” is still what most researchers search for.",
        ],
      },
      {
        heading: "Why does hiding identities matter? What does the evidence say?",
        paragraphs: [
          "The case for double-anonymised review rests on evidence that reviewers are influenced by who wrote a paper, not only by what it says. In a controlled experiment at a leading computer-science conference, reviewers who could see author identities were significantly more likely to recommend acceptance of papers by famous authors and from top universities and companies than reviewers of the same papers who could not (Tomkins et al., 2017). A large field experiment in economics found that the same manuscript was far more likely to be accepted when attributed to a Nobel laureate than to an unknown early-career researcher (Huber et al., 2022). A randomised study in orthopaedics found reviewers rated a manuscript more favourably when they knew it came from prominent authors (Okike et al., 2016).",
          "Reviews of the literature on peer review bias identify prestige, nationality, language, gender and institutional affiliation as recurring concerns, while noting the evidence is mixed on some of them (Lee et al., 2013). Double-anonymised review does not remove every source of bias, but it removes the cheapest and most visible signals before a reviewer forms a first impression.",
        ],
      },
      {
        heading: "What is removed from a manuscript before review?",
        paragraphs: [
          "Anonymisation is harder than deleting names from the first page. Before a manuscript reaches reviewers, the editorial office and the author together make sure that the following are removed or masked:",
        ],
        bullets: [
          "Author names, affiliations, email addresses and ORCID iDs, which live on a separate title page rather than in the anonymised file.",
          "Acknowledgements and funding statements, which often name laboratories, supervisors or grant numbers; these are restored at production.",
          "Self-identifying references in the text (“in our previous work [12]”), rewritten in the third person (“Smith et al. [12] showed…”).",
          "Institutional names in the methods, such as the name of the hospital, school or ethics committee, replaced with neutral placeholders.",
          "File names and document properties — the author and organisation fields that word processors and PDF tools embed automatically.",
          "Identifying links, such as repository URLs or project websites; data can be shared through an anonymised review link where the repository supports one.",
        ],
        after:
          "Self-citation is not prohibited. Removing every reference to one's own earlier work would weaken the manuscript and can itself give the game away. Cite your work as you would cite anyone else's.",
      },
      {
        heading: "What are the limits of double-blind review?",
        paragraphs: [
          "Blinding is imperfect. In a small field, a distinctive dataset, an unusual instrument or a recognisable line of argument can reveal who wrote a paper, and preprints make the full text of many submissions findable online. Studies of reviewers' ability to guess authorship report that a meaningful share of guesses are correct, especially in narrow subfields.",
          "The goal, however, was never cryptographic anonymity. It is to make sure that a reviewer's first and dominant impression comes from the work rather than from the name on it, and to give reviewers an explicit norm: do not try to find out. Our Reviewer Handbook asks reviewers who recognise a manuscript to say so to the editor, so that the editor can decide whether the review can proceed fairly.",
        ],
      },
      {
        heading: "When is single-anonymised or open review more appropriate?",
        paragraphs: [
          "In some fields blinding is impractical or counterproductive. Community-based participatory research, for example, may be impossible to describe without identifying the partners involved, and some qualitative and practice-based work depends on the researcher's positionality, which is part of what reviewers need to assess. In those cases authors can choose single-anonymised review, or fully open review where both parties are known.",
          "Open peer review is itself a family of practices — open identities, open reports, open participation and more — as Ross-Hellauer's systematic review showed (Ross-Hellauer, 2017). At Eleventh Press authors can additionally opt in to open peer review, in which the review reports are made public alongside the published article. Publishing reports adds transparency and gives reviewers' work visible credit; it is optional because not every author or reviewer is comfortable with it.",
        ],
      },
      {
        heading: "What do reviewers owe authors under any model?",
        paragraphs: [
          "Whatever the model, the same ethical obligations apply. COPE's Ethical Guidelines for Peer Reviewers set out the core of them: accept only reviews you are qualified to do and can complete on time; declare competing interests; keep the manuscript and its contents confidential; do not use unpublished information for your own advantage; and write reports that are objective, constructive and free of personal remarks (COPE Council, 2017).",
          "Confidentiality now also covers technology. A manuscript under review is unpublished, confidential work, and uploading it to a generative AI tool that may retain or reuse its content breaches that confidentiality — a point the ICMJE Recommendations make explicitly. Our reviewers are asked not to do it.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is the difference between single-blind and double-blind peer review?",
        a: "In single-blind review the reviewers know the authors' identities but not vice versa. In double-blind review neither side knows the other's identity.",
      },
      {
        q: "Should I remove all citations to my own work?",
        a: "No. Keep them, but write them in the third person (“Smith et al. showed…”) rather than “in our previous work”, and make sure the reference list does not mark them as yours.",
      },
      {
        q: "How do I remove hidden metadata from my file?",
        a: "Clear the author and organisation fields in your word processor's document properties or inspection tool before exporting, give the file a neutral name, and check the PDF properties if you upload a PDF.",
      },
      {
        q: "Can I choose a different review model?",
        a: "Yes. Double-blind is the default, but you can choose single-anonymised or open review at submission where your field's norms make blinding impractical, and you can opt in to publishing the review reports.",
      },
      {
        q: "What should a reviewer do if they recognise the author?",
        a: "Tell the handling editor, without trying to confirm the guess. The editor decides whether the review can proceed fairly or should be reassigned.",
      },
    ],
    references: [
      { text: "Committee on Publication Ethics Council. (2017). Ethical guidelines for peer reviewers (Version 2).", url: "https://doi.org/10.24318/cope.2019.1.9" },
      { text: "Huber, J., Inoua, S., Kerschbamer, R., König-Kersting, C., Palan, S., & Smith, V. L. (2022). Nobel and novice: Author prominence affects peer review. Proceedings of the National Academy of Sciences, 119(41), e2205779119.", url: "https://doi.org/10.1073/pnas.2205779119" },
      { text: "Lee, C. J., Sugimoto, C. R., Zhang, G., & Cronin, B. (2013). Bias in peer review. Journal of the American Society for Information Science and Technology, 64(1), 2–17.", url: "https://doi.org/10.1002/asi.22784" },
      { text: "National Information Standards Organization. (2023). Standard terminology for peer review (ANSI/NISO Z39.106-2023).", url: "https://doi.org/10.3789/ansi.niso.z39.106-2023" },
      { text: "Okike, K., Hug, K. T., Kocher, M. S., & Leopold, S. S. (2016). Single-blind vs double-blind peer review in the setting of author prestige. JAMA, 316(12), 1315–1316.", url: "https://doi.org/10.1001/jama.2016.11014" },
      { text: "Ross-Hellauer, T. (2017). What is open peer review? A systematic review. F1000Research, 6, 588.", url: "https://doi.org/10.12688/f1000research.11369.2" },
      { text: "Tomkins, A., Zhang, M., & Heavlin, W. D. (2017). Reviewer bias in single- versus double-blind peer review. Proceedings of the National Academy of Sciences, 114(48), 12708–12713.", url: "https://doi.org/10.1073/pnas.1707323114" },
    ],
    relatedGuides: ["guide-reviewer-handbook", "guide-author-submission"],
  },

  "blog-open-access-licensing": {
    id: "blog-open-access-licensing",
    lede: "Every Eleventh Press article is published under the Creative Commons Attribution 4.0 International licence (CC BY 4.0). In one sentence: anyone may copy, share and adapt your work for any purpose, including commercially, as long as they credit you and indicate changes. You keep your copyright, and CC BY 4.0 satisfies the licence requirements of Plan S and most major funder open-access policies.",
    metaDescription:
      "CC BY 4.0 explained in plain language: what it permits, how it compares with the other Creative Commons licences, copyright retention, third-party material, attribution and funder open access mandates.",
    keywords: [
      "CC BY 4.0",
      "Creative Commons licence",
      "open access licensing",
      "copyright retention",
      "rights retention strategy",
      "Plan S",
      "UKRI open access",
      "attribution",
      "CC0",
      "funder mandate",
    ],
    keyTakeaways: [
      "CC BY 4.0 lets anyone share and adapt your work for any purpose, including commercially, provided they give appropriate credit and indicate changes.",
      "Authors publishing with Eleventh Press keep their copyright; they grant a licence rather than transferring ownership.",
      "There are six Creative Commons licences; NC (non-commercial), ND (no derivatives) and SA (share-alike) each add restrictions to the basic CC BY licence.",
      "CC BY is the licence most aligned with the Budapest Open Access Initiative's definition of open access: free to read and free to reuse.",
      "Plan S requires CC BY by default for funded research articles, and UKRI's open-access policy likewise requires CC BY for research articles.",
      "The rights-retention statement confirmed at submission protects your right to share the accepted manuscript under CC BY regardless of other agreements.",
      "Good attribution follows the TASL pattern: Title, Author, Source and Licence.",
      "Third-party material, such as a figure from another publication, needs permission compatible with CC BY or must be clearly excluded from the licence.",
      "Creative Commons licences are irrevocable for the copies already distributed, so choose with confidence rather than as a trial.",
      "Data are often best released under CC0 and code under an OSI-approved software licence, since CC licences are not designed for software.",
    ],
    sections: [
      {
        heading: "What does CC BY 4.0 allow, in plain English?",
        paragraphs: [
          "The Creative Commons Attribution 4.0 International licence gives everyone permission to do two things with your published article: share it (copy and redistribute it in any medium or format) and adapt it (remix, transform and build upon it), for any purpose, including commercial purposes. The one condition is attribution: users must give appropriate credit, provide a link to the licence and indicate whether changes were made, without suggesting that you endorse them or their use.",
          "In practice that means a student can print your article for a seminar, a journalist can quote a figure, a textbook author can adapt a table, a translator can produce a Spanish edition and a company can use your method in a product, all without asking — provided they credit you. That breadth is the point: the licence removes the friction that otherwise stops research being used.",
        ],
      },
      {
        heading: "How does CC BY compare with the other Creative Commons licences?",
        paragraphs: [
          "Creative Commons offers six licences, all of which require attribution. The others add one or two restrictions to CC BY:",
        ],
        bullets: [
          "CC BY-SA (ShareAlike): adaptations must be released under the same licence.",
          "CC BY-NC (NonCommercial): reuse is limited to non-commercial purposes.",
          "CC BY-ND (NoDerivatives): the work may be shared but not adapted.",
          "CC BY-NC-SA and CC BY-NC-ND combine those restrictions.",
          "Separately, CC0 is a public-domain dedication that waives rights altogether and is widely used for data.",
        ],
        after:
          "Restrictions can look protective, but they often stop legitimate scholarly reuse. “Non-commercial” is notoriously hard to interpret — is a for-profit textbook, an advertising-supported blog or a commercial text-mining service non-commercial? “No derivatives” can prevent translation, accessible-format conversion and inclusion in systematic reviews. That is why research funders and open-access advocates favour plain CC BY.",
      },
      {
        heading: "Do I keep my copyright?",
        paragraphs: [
          "Yes. Under a traditional copyright transfer agreement, the publisher becomes the owner of the work and controls reuse; even the author may need permission to post it or reuse figures. Eleventh Press does not take copyright. Authors retain it and grant a CC BY 4.0 licence to the world, together with the non-exclusive right for us to publish the version of record.",
          "At submission you also confirm a rights-retention statement: that you retain the right to make the accepted manuscript publicly available under CC BY 4.0 regardless of any other agreement you might enter into. The cOAlition S Rights Retention Strategy uses the same mechanism to make sure funded authors can always comply with their open-access obligations.",
        ],
      },
      {
        heading: "Which funder mandates does CC BY satisfy?",
        paragraphs: [
          "Plan S, launched by cOAlition S in 2018, requires that scholarly publications resulting from research funded by its members be published with immediate open access under an open licence, CC BY by default. UK Research and Innovation's open-access policy, in force for research articles since April 2022, likewise requires immediate open access and a CC BY licence for in-scope articles. Many other funders, including large charitable foundations, have comparable requirements, and US federal agencies have moved towards zero-embargo public access.",
          "Because CC BY 4.0 is our default and there is no embargo, articles published with us generally comply with these policies without extra steps. Requirements change, so always check your funder's current policy and note any specific deposit requirements, such as depositing in a named repository.",
        ],
      },
      {
        heading: "How should others credit my work?",
        paragraphs: [
          "Creative Commons recommends the TASL pattern for attribution: Title, Author, Source and Licence. A good attribution for a figure adapted from one of our articles might read: “Figure adapted from ‘Title of article’ by A. Author and B. Author, Eleventh Press International Publishing™, https://doi.org/…, licensed under CC BY 4.0. Changes: colours and labels modified.”",
          "For scholarly use, a normal citation in the reference list, with the DOI, usually satisfies attribution. What the licence prohibits is presenting your work without credit or implying that you endorse the reuser's conclusions.",
        ],
      },
      {
        heading: "What about images, figures and other third-party material?",
        paragraphs: [
          "A CC BY licence can only cover what the authors have the right to license. If your article includes a figure, photograph, map or long quotation owned by someone else, you need permission compatible with CC BY reuse — or the item must be clearly marked as excluded from the licence, with its own copyright notice. Permission to reproduce an image “in your article” is not always permission to license it to everyone for any purpose.",
          "When possible, use material that is already openly licensed or in the public domain, create your own figures, or redraw a figure from the underlying data (with citation). Identify any excluded items in the caption so reusers know which parts of the article they may not adapt.",
        ],
      },
      {
        heading: "How should data and code be licensed?",
        paragraphs: [
          "Creative Commons licences are designed for creative and scholarly works, not for software, and Creative Commons itself recommends against using them for code. For research software, use a licence approved by the Open Source Initiative, such as MIT, BSD or Apache 2.0, or a copyleft licence such as the GPL if you want derivatives to remain open.",
          "For datasets, many repositories and funders recommend CC0, which removes legal barriers to aggregation and reuse, while scholarly norms of citation continue to ensure credit. CC BY is also common for data. Whatever you choose, state it in the repository record and in your article's data availability statement.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can someone use my CC BY article commercially?",
        a: "Yes. CC BY 4.0 permits commercial reuse, provided the user credits you, links to the licence and indicates any changes.",
      },
      {
        q: "Do I give up copyright when I publish with Eleventh Press?",
        a: "No. You retain copyright and grant a CC BY 4.0 licence, plus a non-exclusive right for us to publish the version of record.",
      },
      {
        q: "Does CC BY 4.0 meet Plan S and UKRI requirements?",
        a: "Yes. CC BY is the default licence required by Plan S and by UKRI's open-access policy for research articles. Always check your funder's current policy for any deposit requirements.",
      },
      {
        q: "Can I include a figure from another journal in my article?",
        a: "Only with permission compatible with CC BY reuse, or if the figure is clearly marked as excluded from the article's licence with its own copyright notice.",
      },
      {
        q: "Can a CC BY licence be withdrawn later?",
        a: "No. Creative Commons licences are irrevocable for copies already distributed under them.",
      },
    ],
    references: [
      { text: "Budapest Open Access Initiative. (2002). Budapest Open Access Initiative declaration.", url: "https://www.budapestopenaccessinitiative.org/read/" },
      { text: "cOAlition S. (2018). Plan S principles.", url: "https://www.coalition-s.org/plan_s_principles/" },
      { text: "cOAlition S. (2020). Rights retention strategy.", url: "https://www.coalition-s.org/rights-retention-strategy/" },
      { text: "Creative Commons. (2013). Attribution 4.0 International (CC BY 4.0) legal code.", url: "https://creativecommons.org/licenses/by/4.0/legalcode" },
      { text: "Creative Commons. (n.d.). Recommended practices for attribution.", url: "https://wiki.creativecommons.org/wiki/Recommended_practices_for_attribution" },
      { text: "Suber, P. (2012). Open access. MIT Press.", url: "https://doi.org/10.7551/mitpress/9286.001.0001" },
      { text: "UK Research and Innovation. (2021). UKRI open access policy.", url: "https://www.ukri.org/publications/ukri-open-access-policy/" },
    ],
    relatedGuides: ["guide-data-code-availability", "guide-author-submission"],
  },

  "blog-reviewer-matching": {
    id: "blog-reviewer-matching",
    lede: "At Eleventh Press, reviewers are matched to manuscripts by comparing each manuscript's discipline tag and keywords with reviewers' declared expertise, ranking candidates by match strength, screening out conflicts of interest and inviting the top two or three. Reviewers have a 14-day window, can request extensions, and if too many decline the editor widens the search rather than settling for a weaker match.",
    metaDescription:
      "How journal editors match peer reviewers to manuscripts: expertise matching, conflict-of-interest screening, reviewer workload, the 14-day review window and how authors and reviewers can improve matching.",
    keywords: [
      "reviewer matching",
      "peer reviewer selection",
      "reviewer assignment",
      "conflict of interest peer review",
      "reviewer expertise",
      "peer review workload",
      "ORCID peer review",
      "how to become a peer reviewer",
      "editorial process",
      "manuscript review time",
    ],
    keyTakeaways: [
      "Reviewer choice is one of the most consequential editorial decisions: a mismatched reviewer produces feedback that helps no one.",
      "Matching compares the manuscript's discipline tag and extracted keywords with each reviewer's declared expertise.",
      "Candidates are ranked by match strength and the top two or three are invited; multidisciplinary papers get reviewers matched to each component.",
      "Conflicts of interest — shared institutions, recent collaborations, personal relationships, competing work — are screened before invitation and must be declared by reviewers.",
      "Reviewers can accept, decline or request an extension on the standard 14-day window.",
      "When too many invitations are declined, the editor widens the search rather than lowering the bar on expertise.",
      "Research shows review work is concentrated on a small share of researchers, so spreading invitations fairly matters for quality and sustainability.",
      "Computational matching supports, but never replaces, the editor's judgement about who can evaluate a paper fairly.",
      "Reviewers improve their own invitations by keeping expertise keywords precise and current.",
      "Reviewers who connect ORCID can have completed reviews credited on their ORCID record, making invisible work visible.",
    ],
    sections: [
      {
        heading: "Why does reviewer selection matter so much?",
        paragraphs: [
          "Peer review is only as good as the people doing it. A reviewer who knows the field well can spot a flawed control, a misapplied statistical test or a missing body of literature, and can suggest a fix. A reviewer who is out of their depth tends either to approve weak work or to reject sound work on misunderstood grounds, and in both cases the author receives little that helps them improve the paper. Selecting reviewers is therefore one of the editor's most consequential decisions, even though authors never see it happen.",
          "It is also one of the hardest to do well at scale. Editors must find people who are expert, available, free of conflicts and willing, often across unusual combinations of fields, and must do so without overloading the same small group of reliable reviewers.",
        ],
      },
      {
        heading: "How does the matching process work?",
        paragraphs: [
          "When a manuscript clears initial screening, it is matched against our reviewer pool. The system compares the manuscript's discipline tag and the keywords extracted from its title, abstract and author keywords with each reviewer's declared expertise. Candidates are ranked by the strength of that match, and the handling editor reviews the ranked list before invitations go out — typically to two or three reviewers per manuscript. For multidisciplinary manuscripts the editor matches reviewers to each substantive component rather than to the paper as a whole.",
          "Approaches of this kind have a long history in computer science, where conferences receiving thousands of submissions pioneered automated reviewer assignment, such as the Toronto Paper Matching System (Charlin & Zemel, 2013). The research literature is clear that computational matching is best treated as decision support: it surfaces candidates an editor might not have thought of, while the editor judges fit, balance and fairness (Price & Flach, 2017).",
        ],
      },
      {
        heading: "How are conflicts of interest handled?",
        paragraphs: [
          "A good expertise match is useless if the reviewer cannot be impartial. Before invitation, the editor screens candidates for obvious conflicts, such as a shared institution, a recent co-authorship or a known close collaboration with an author. Because the review is double-anonymised by default, reviewers cannot always detect conflicts themselves, so the editor carries this responsibility first.",
          "Reviewers carry it second. COPE's guidelines ask reviewers to declare any competing interest — personal, professional, financial or intellectual, including directly competing work — and to decline where it would compromise their judgement (COPE Council, 2017). If a reviewer realises during review that they know the authors or have a conflict, they should tell the editor immediately rather than complete the review.",
        ],
      },
      {
        heading: "What happens after an invitation is sent?",
        paragraphs: [
          "Invited reviewers can accept, decline or request an extension. Once a reviewer accepts, the standard window to submit the report is 14 days. If more time is needed, reviewers should request an extension rather than let the deadline lapse silently: editors would much rather adjust the timeline than lose a well-matched reviewer, and a silent lapse delays the author for everyone.",
          "If too many invitations are declined, the editor widens the search — moving down the ranked list, looking at adjacent expertise or asking a declining reviewer for suggestions — rather than settling for a weaker match. This can add time, but a review from someone who cannot evaluate the work is worse than a slightly later one from someone who can.",
        ],
      },
      {
        heading: "Why does reviewer workload matter?",
        paragraphs: [
          "Peer review rests on goodwill, and that goodwill is unevenly shared. A study of the biomedical literature estimated that a small fraction of researchers performs a large proportion of all reviews (Kovanis et al., 2016), and large surveys of reviewers have documented both rising invitation volumes and reviewer fatigue (Publons, 2018). Over-relying on the same people burns them out and narrows the range of perspectives the literature receives.",
          "Our matching therefore considers more than expertise. Editors are encouraged to spread invitations across the pool, including well-qualified early-career researchers, and to avoid inviting the same reviewer repeatedly in a short period.",
        ],
      },
      {
        heading: "How can reviewers and authors improve matching?",
        paragraphs: [
          "Reviewers can do the most. The quality of every invitation you receive depends on the expertise keywords in your reviewer profile. Keep them specific (“Bayesian hierarchical models for ecological count data” rather than “statistics”), current, and limited to areas you would genuinely be comfortable evaluating. Precise keywords mean fewer irrelevant invitations and more reviews you are qualified to give.",
          "Authors help by choosing accurate discipline tags and three to eight informative keywords, and by writing an abstract that names the methods as well as the findings. If there is someone who should not review your work because of a genuine conflict, say so in your cover letter with a brief reason; editors take such requests seriously, though they are not obliged to follow them.",
        ],
      },
      {
        heading: "How is reviewing recognised?",
        paragraphs: [
          "Reviewing is skilled, time-consuming and largely invisible work. Recognition does not make it less demanding, but it makes it count. Reviewers who connect their ORCID iD to their account and grant update permission have each submitted review offered to their ORCID record as a peer-review activity, which credits the service to the journal without revealing the confidential content of the review. Members of the Board of Reviewers can also be issued a formal service certificate.",
        ],
      },
    ],
    faqs: [
      {
        q: "How do editors choose peer reviewers?",
        a: "By matching the manuscript's discipline and keywords to reviewers' declared expertise, ranking candidates, screening for conflicts of interest and inviting the strongest two or three, with the editor making the final choice.",
      },
      {
        q: "How long do reviewers have to complete a review?",
        a: "Fourteen days from accepting the invitation. Reviewers can request an extension if they need more time.",
      },
      {
        q: "What counts as a reviewer conflict of interest?",
        a: "Any personal, professional, financial or intellectual interest that could affect impartiality — for example a shared institution, a recent collaboration, a close relationship or directly competing work.",
      },
      {
        q: "Can I ask for a specific person not to review my manuscript?",
        a: "Yes. Explain the genuine conflict briefly in your cover letter. Editors take these requests seriously but are not obliged to follow them.",
      },
      {
        q: "How can I get more relevant review invitations?",
        a: "Keep the expertise keywords in your reviewer profile specific and up to date, and limit them to areas you would genuinely be comfortable evaluating.",
      },
    ],
    references: [
      { text: "Charlin, L., & Zemel, R. S. (2013). The Toronto paper matching system: An automated paper-reviewer assignment system. In Proceedings of the ICML Workshop on Peer Reviewing and Publishing Models." },
      { text: "Committee on Publication Ethics Council. (2017). Ethical guidelines for peer reviewers (Version 2).", url: "https://doi.org/10.24318/cope.2019.1.9" },
      { text: "Kovanis, M., Porcher, R., Ravaud, P., & Trinquart, L. (2016). The global burden of journal peer review in the biomedical literature: Strong imbalance in the collective enterprise. PLOS ONE, 11(11), e0166387.", url: "https://doi.org/10.1371/journal.pone.0166387" },
      { text: "Price, S., & Flach, P. A. (2017). Computational support for academic peer review: A perspective from artificial intelligence. Communications of the ACM, 60(3), 70–79.", url: "https://doi.org/10.1145/2979672" },
      { text: "Publons. (2018). Global state of peer review. Clarivate Analytics.", url: "https://doi.org/10.14322/publons.GSPR2018" },
      { text: "ORCID. (n.d.). Peer review: ORCID integration guide." },
    ],
    relatedGuides: ["guide-reviewer-handbook", "guide-publication-ethics"],
  },

  "blog-reading-rejection": {
    id: "blog-reading-rejection",
    lede: "A rejection usually means one of three things: the work is outside the journal's scope, the methodology has a fixable gap, or reviewers judged the contribution too incremental for the venue. Read the decision letter and reviewer comments together to tell which, triage every comment, revise before resubmitting elsewhere, and write to the handling editor only if a review contains a demonstrable factual error.",
    metaDescription:
      "How to read a journal rejection letter: decision types, decoding reviewer feedback, triaging comments, choosing where to resubmit, and when to request a second read at Eleventh Press.",
    keywords: [
      "manuscript rejection",
      "journal rejection letter",
      "desk rejection",
      "reviewer comments",
      "resubmit manuscript",
      "appeal journal decision",
      "response to reviewers",
      "revise and resubmit",
      "academic publishing advice",
      "peer review feedback",
    ],
    keyTakeaways: [
      "Rejection is a normal part of research publishing; most published papers have been rejected somewhere along the way.",
      "Decision types differ: desk rejection, rejection after review, reject-and-resubmit, and major or minor revisions each call for a different response.",
      "Read the editor's letter and the reviewer reports together; the editor's summary tells you which concerns were decisive.",
      "Most rejections fall into three categories: scope mismatch, a fixable methodological gap, or a contribution judged too incremental for the venue.",
      "Triage every reviewer comment into must-fix, should-address and disagree-with-reasons before deciding your next step.",
      "Evidence suggests papers resubmitted after rejection can go on to be cited at least as well as first-time acceptances, so feedback is worth acting on.",
      "Never resubmit a rejected manuscript elsewhere unchanged; reviewers overlap more often than authors expect.",
      "Never submit the same manuscript to two journals at the same time.",
      "Eleventh Press does not offer formal appeals for scope rejections, but you can ask the handling editor for a second read if a review contains a factual error.",
      "A clear, courteous, evidence-based reply serves you better than a combative one, whichever journal you go to next.",
    ],
    sections: [
      {
        heading: "Is rejection normal?",
        paragraphs: [
          "Yes. Rejection is part of the ordinary life of research, not a verdict on the researcher. Selective journals reject the majority of what they receive, and most experienced authors have had papers rejected that were later published elsewhere and went on to be well cited. A study that traced the submission histories of tens of thousands of articles found that a substantial share had been rejected before finding a home, and that papers published after a rejection received, on average, more citations than those accepted at their first journal (Calcagno et al., 2012).",
          "None of that makes a rejection pleasant. It is worth giving yourself a day before rereading the decision, because the most useful reading is the calm, analytical one.",
        ],
      },
      {
        heading: "What kind of decision did you receive?",
        paragraphs: ["Editorial decisions are not all the same, and the right next step depends on which one you have:"],
        bullets: [
          "Desk rejection: the editor declined the manuscript without external review, usually because of scope, a clear mismatch with the journal's article types or a fundamental problem visible at screening.",
          "Rejection after review: reviewers assessed the work and the editor concluded it could not be made suitable through revision.",
          "Reject and resubmit: the work is not acceptable in its current form, but a substantially revised version may be considered as a new submission.",
          "Major revisions: the manuscript may be acceptable if significant concerns are addressed; not a rejection, but not a guarantee either.",
          "Minor revisions: the manuscript is close to acceptable and needs specific, limited changes.",
        ],
      },
      {
        heading: "How do you decode the decision letter and the reviews?",
        paragraphs: [
          "Read the editor's letter first and then the reports, and look for the reasons the editor singles out. Reviewers may raise dozens of points; the editor's summary tells you which were decisive. Most rejections fall into one of three categories. A scope mismatch means the work does not fit the journal's aims, and no amount of revision will change that outcome there. A methodological gap — an underpowered sample, a missing control, an analysis that does not support the claim — is often fixable, and fixing it is worth doing before you submit anywhere else. A contribution judged too incremental means the reviewers did not see enough advance over existing work for that venue; sometimes that calls for a better-matched journal, and sometimes for a clearer statement of what is new.",
          "Distinguish carefully between comments that identify a problem and comments that propose a solution. A reviewer who says “the statistical analysis is inappropriate; use a mixed model” may be right about the problem and wrong about the fix. Your obligation is to address the problem.",
        ],
      },
      {
        heading: "How should you triage reviewer comments?",
        paragraphs: [
          "Make a table with every reviewer comment in one column and three possible responses in the next: must fix (the comment identifies a real error or a gap any reader would notice), should address (the comment points to an improvement in clarity, framing or completeness), and disagree with reasons (you believe the comment is mistaken, and can explain why with evidence). The exercise turns an emotional document into a work plan, and it makes the decision about where to go next much clearer.",
          "The same table becomes the basis of a response letter if you are invited to revise, or a checklist if you are resubmitting elsewhere. Noble's ten simple rules for responding to reviewers — among them, be polite, respond to every point, and make the changes easy to find — apply just as well to that internal exercise (Noble, 2017).",
        ],
      },
      {
        heading: "Where should you go next?",
        paragraphs: [
          "If the decision was a scope rejection, choose a journal whose aims and recent publications genuinely match the work, and say in your cover letter why it fits. If it was a fixable methodological concern, fix it first: reviewer pools overlap more often than authors expect, and a reviewer who sees the same unaddressed problem at a second journal is unlikely to be more forgiving. Update the literature review, reformat to the new journal's requirements and refresh the cover letter.",
          "Two things to avoid. Never resubmit a rejected manuscript unchanged as though the review had not happened. And never submit the same manuscript to more than one journal at a time; simultaneous submission is a breach of publication ethics and wastes the time of editors and reviewers at both journals.",
        ],
      },
      {
        heading: "Can you appeal an Eleventh Press decision?",
        paragraphs: [
          "COPE expects journals to have a clear process for complaints and appeals, and ours is deliberately simple. We do not offer formal appeals for straightforward scope rejections, because scope is an editorial judgement about the journal rather than about the quality of the work. But if you believe a review contains a demonstrable factual error — it misreads a result, criticises an analysis you did not perform, or relies on a misunderstanding you can document — write to the handling editor, explain the specific error with evidence and ask for a second read.",
          "The editor will consider the request and may consult another reviewer. A second read is not a renegotiation of every point, and it will rarely succeed if the disagreement is about interpretation rather than fact. Concerns about the conduct of the review process itself, as distinct from its outcome, can be raised with the editorial office, which handles them independently of the original editor.",
        ],
      },
      {
        heading: "How do you respond well, whatever you decide?",
        paragraphs: [
          "Courtesy is a strategy, not just a virtue. Editors remember authors, and a calm, evidence-based response — whether to a revision request, in a second-read request or in a new cover letter — is more persuasive than an aggrieved one. Thank reviewers for their time even when you disagree with them; it costs nothing and it signals that you have engaged with the substance.",
          "Above all, treat the review as information. Even a rejection from a poorly matched venue usually contains two or three points that, once addressed, make the paper stronger wherever it is published next.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is a desk rejection?",
        a: "A decision by the editor to decline a manuscript without sending it for external peer review, usually because it is outside the journal's scope or has a fundamental problem visible at screening.",
      },
      {
        q: "Should I resubmit a rejected manuscript to another journal unchanged?",
        a: "No. Address the reviewers' substantive concerns first. Reviewer pools overlap, and the same unaddressed problems are likely to be raised again.",
      },
      {
        q: "Can I appeal a rejection from Eleventh Press?",
        a: "There is no formal appeal for scope rejections. If a review contains a demonstrable factual error, you can write to the handling editor with evidence and request a second read.",
      },
      {
        q: "Can I submit my manuscript to two journals at once?",
        a: "No. Simultaneous submission breaches publication ethics. Wait for a decision, or formally withdraw the manuscript, before submitting elsewhere.",
      },
      {
        q: "Is reject-and-resubmit the same as major revisions?",
        a: "No. Major revisions continue the same submission; reject-and-resubmit closes it, and a substantially revised manuscript is treated as a new submission.",
      },
    ],
    references: [
      { text: "Calcagno, V., Demoinet, E., Gollner, K., Guidi, L., Ruths, D., & de Mazancourt, C. (2012). Flows of research manuscripts among scientific journals reveal hidden submission patterns. Science, 338(6110), 1065–1069.", url: "https://doi.org/10.1126/science.1227833" },
      { text: "Committee on Publication Ethics. (2017). Core practices: Complaints and appeals.", url: "https://publicationethics.org/core-practices" },
      { text: "Noble, W. S. (2017). Ten simple rules for writing a response to reviewers. PLOS Computational Biology, 13(10), e1005730.", url: "https://doi.org/10.1371/journal.pcbi.1005730" },
      { text: "Silvia, P. J. (2019). How to write a lot: A practical guide to productive academic writing (2nd ed.). American Psychological Association." },
      { text: "International Committee of Medical Journal Editors. (n.d.). Recommendations for the conduct, reporting, editing, and publication of scholarly work in medical journals.", url: "https://www.icmje.org/recommendations/" },
    ],
    relatedGuides: ["guide-author-submission", "guide-publication-ethics"],
  },
};
