import type { MediaStory } from "@/lib/media/types";

/**
 * Newsroom stories for the Media section.
 *
 * Rules for editing:
 * - Every figure must come from the cited source; cite it with [n].
 * - Prefer the primary source (the report, the press release, the paper).
 * - Say what a number measures (incidence vs deaths, firms vs workers) and
 *   for which year.
 * - Don't round, extrapolate or "update" a figure the source doesn't give.
 */

const PUBLISHED = "2026-11-14";

export const NEWS: MediaStory[] = [
  {
    slug: "who-global-tuberculosis-report-2026-key-findings",
    type: "NEWS",
    title: "WHO Global Tuberculosis Report 2026: Deaths Fall to 1.13 Million, but Progress Remains Too Slow",
    dek: "TB killed an estimated 1.13 million people in 2025, 4% fewer than in 2024. New cases barely moved, and international funding fell for a second year.",
    metaDescription:
      "WHO's Global Tuberculosis Report 2026: 10.6 million people fell ill with TB in 2025 and 1.13 million died. Key findings on deaths, diagnosis gaps and funding.",
    keywords: [
      "Global Tuberculosis Report 2026",
      "WHO tuberculosis report",
      "TB deaths 2025",
      "tuberculosis incidence",
      "End TB Strategy",
      "TB funding",
      "global health",
    ],
    category: "Health",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    lede:
      "The World Health Organization’s Global Tuberculosis Report 2026, released on 12 November 2026, estimates that 10.6 million people fell ill with tuberculosis in 2025 and 1.13 million died [1][3]. Deaths fell 4% from 2024 and are now 35% below 2015 levels, but new cases fell by only 0.7% and an estimated 2.2 million people with TB were never diagnosed or reported [3].",
    keyPoints: [
      "An estimated 10.6 million people (95% uncertainty interval 9.8–11.4 million) developed TB in 2025, a 0.7% reduction on 2024 [3].",
      "TB deaths fell 4%, from 1.18 million in 2024 to an estimated 1.13 million in 2025 [3].",
      "Deaths are 35% lower than in 2015, which means the first milestone of WHO’s End TB Strategy has been reached, five years late [3].",
      "Of the 10.6 million people who developed TB, 8.4 million were diagnosed, leaving about 2.2 million undiagnosed or unreported [3].",
      "Domestic TB funding in low- and middle-income countries rose 14% to US$ 5.6 billion, partly offsetting a 14% fall in international donor funding [1][3].",
      "Total funding of US$ 6.6 billion in 2025 is about 30% of the US$ 22 billion a year that countries committed to reach by 2027 [3].",
    ],
    sections: [
      {
        heading: "How many people did tuberculosis kill in 2025?",
        paragraphs: [
          "WHO estimates that 1.13 million people died from TB in 2025 (95% uncertainty interval 1.05–1.22 million), down from 1.18 million in 2024 [3]. That is a 4% fall in a single year and a 35% fall since 2015, the baseline year of the End TB Strategy [3].",
          "Even so, tuberculosis remains the world’s leading cause of death from a single infectious agent [3][5]. WHO Director-General Tedros Adhanom Ghebreyesus noted that more than a million people still die every year from a disease that is preventable and treatable [1].",
        ],
      },
      {
        heading: "Are fewer people getting TB?",
        paragraphs: [
          "Only slightly. The report estimates 10.6 million new cases in 2025, about 75,000 (0.7%) fewer than in 2024, and the second consecutive year of a small decline [3]. TB Alliance, a non-profit drug developer, described the 1.6% fall in the global incidence rate as far too slow to meet international commitments [4].",
          "This edition also changes how incidence is estimated: for the first time WHO used vital registration data in a new method for estimating TB incidence, which its technical appendix describes in detail [6]. Comparisons with older editions should use the revised time series in the 2026 report rather than headline figures published in earlier years.",
        ],
      },
      {
        heading: "Where is the diagnosis gap?",
        paragraphs: [
          "Of the estimated 10.6 million people who developed TB in 2025, 8.4 million were diagnosed and notified [3]. The remaining 2.2 million were either never diagnosed or diagnosed without being reported to national programmes [3]. Each undiagnosed case matters twice: the person misses treatment, and untreated pulmonary TB can keep spreading.",
        ],
      },
      {
        heading: "Who is paying for the TB response?",
        paragraphs: [
          "Countries themselves, increasingly. Domestic funding for TB prevention, diagnosis and treatment rose 14% to US$ 5.6 billion between 2024 and 2025, and domestic sources supplied 86% of the money available in 2025 [1][3]. International donor funding moved the other way, falling 14% to US$ 0.94 billion [3].",
          "The total, US$ 6.6 billion, is roughly 30% of the global target of US$ 22 billion per year by 2027 [3]. Research funding lags further behind: US$ 1.2 billion in 2023, less than a quarter of the US$ 5 billion annual target [3].",
        ],
      },
      {
        heading: "Why it matters",
        paragraphs: [
          "The 2026 report shows a response that is still moving in the right direction but at a pace that leaves the 2030 targets out of reach. Falling deaths show that diagnosis and treatment work when people can reach them; the flat incidence curve and the 2.2 million missing cases show how many still cannot. For researchers and funders, the report’s financing chapter is a reminder that domestic budgets are now carrying most of the load.",
        ],
      },
    ],
    faqs: [
      {
        q: "How many people died of tuberculosis in 2025?",
        a: "WHO estimates 1.13 million TB deaths in 2025, with a 95% uncertainty interval of 1.05–1.22 million. That is 4% fewer than the 1.18 million estimated for 2024 [3].",
      },
      {
        q: "When was the Global Tuberculosis Report 2026 published?",
        a: "WHO released the Global Tuberculosis Report 2026 on 12 November 2026 [1][2].",
      },
      {
        q: "Is tuberculosis still the deadliest infectious disease?",
        a: "Yes. WHO describes TB as the leading cause of death worldwide from a single infectious agent [3][5].",
      },
      {
        q: "How much funding does the TB response have?",
        a: "Funding for TB prevention, diagnosis and treatment reached US$ 6.6 billion in 2025, about 30% of the US$ 22 billion per year targeted for 2027. Domestic sources provided 86% of it [3].",
      },
    ],
    references: [
      {
        text: "World Health Organization. (2026, November 12). Amid challenges, countries increase domestic investment to protect progress against tuberculosis [News release].",
        url: "https://www.who.int/news/item/12-11-2026-amid-challenges-countries-increase-domestic-investment-to-protect-progress-against-tuberculosis",
      },
      {
        text: "World Health Organization. (2026). Global tuberculosis report 2026. WHO.",
        url: "https://www.who.int/publications/i/item/9789240126480",
      },
      {
        text: "World Health Organization. (2026). Global tuberculosis report 2026: Top findings and messages. WHO.",
        url: "https://cdn.who.int/media/docs/default-source/hq-tuberculosis/top-findings-and-messages_english.pdf",
      },
      {
        text: "TB Alliance. (2026). New WHO report highlights promise of TB innovation and urgent need to accelerate progress.",
        url: "https://www.tballiance.org/new-who-report-highlights-promise-of-tb-innovation-and-urgent-need-to-accelerate-progress/",
      },
      {
        text: "World Health Organization. (n.d.). Tuberculosis [Fact sheet].",
        url: "https://www.who.int/news-room/fact-sheets/detail/tuberculosis",
      },
      {
        text: "World Health Organization. (2026). Technical appendix: Methods used by WHO to estimate the global burden of TB disease. Global tuberculosis report 2026.",
        url: "https://cdn.who.int/media/docs/default-source/hq-tuberculosis/technical-appendix-global-tuberculosis-report-2026.pdf",
      },
    ],
    cover: {
      stat: "1.13M",
      statLabel: "TB deaths in 2025, down 4% on 2024",
      source: "WHO Global Tuberculosis Report 2026",
      hue: 12,
      alt: "Data card: 1.13 million tuberculosis deaths in 2025, down 4% on 2024, from the WHO Global Tuberculosis Report 2026.",
    },
  },

  {
    slug: "imf-world-economic-outlook-october-2026-global-growth",
    type: "NEWS",
    title: "IMF October 2026 Outlook: Global Growth Slows to 3.1% as an AI Boom Offsets an Energy Shock",
    dek: "The IMF’s latest World Economic Outlook, “Resilience Under Strain, Urgent Choices”, sees growth of 3.1% this year and 3.4% in 2027, with inflation peaking at 4.7%.",
    metaDescription:
      "IMF World Economic Outlook, October 2026: global growth of 3.1% in 2026 and 3.4% in 2027, inflation peaking at 4.7%, and the risks from energy prices and AI.",
    keywords: [
      "IMF World Economic Outlook October 2026",
      "global growth forecast 2026",
      "global inflation 2026",
      "AI investment boom",
      "energy price shock",
      "world economy",
      "business outlook",
    ],
    category: "Business & Economy",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    lede:
      "The International Monetary Fund projects global growth of 3.1% in 2026, 0.4 percentage points below 2025, rising to 3.4% in 2027, according to its October 2026 World Economic Outlook [1][2]. The IMF says higher energy and commodity prices triggered by war in the Middle East are acting as a negative supply shock, while an AI-driven technology boom is acting as a positive demand shock [2].",
    keyPoints: [
      "Global growth is projected at 3.1% in 2026, 40 basis points lower than in 2025, and 3.4% in 2027 [2].",
      "Global headline inflation is projected to rise to 4.7% in 2026 before easing to 4.1% in 2027 [2].",
      "The IMF names two opposing forces: an energy and commodity price shock from the war in the Middle East, and an AI-led technology boom [2].",
      "Country projections cited at the launch include 4.5% growth for China and 7% for India in 2026 [2].",
      "The IMF judges that risks to the outlook are tilted to the downside [1].",
    ],
    sections: [
      {
        heading: "What does the IMF forecast for global growth in 2026?",
        paragraphs: [
          "The October 2026 World Economic Outlook, subtitled “Resilience Under Strain, Urgent Choices”, was published on 13 October 2026 during the IMF and World Bank Annual Meetings [1]. It projects global activity to grow by 3.1% this year, 40 basis points lower than last year, and by 3.4% in 2027 [2].",
          "The forecast assumes that the conflict in the Middle East does not escalate further and that energy markets gradually normalise [1]. Growth is weakest in energy-importing and lower-income economies and strongest in countries closely tied to AI investment and supply chains [1][2].",
        ],
      },
      {
        heading: "Why is inflation rising again?",
        paragraphs: [
          "The IMF expects global headline inflation to rise notably to 4.7% in 2026 before easing to 4.1% in 2027 [2]. The main driver is the increase in energy and other commodity prices triggered by the war, which the Fund describes as a negative global supply shock: it raises prices and lowers output at the same time [2].",
        ],
      },
      {
        heading: "How is artificial intelligence affecting the world economy?",
        paragraphs: [
          "On the other side of the ledger is the technology boom, which the IMF says is mostly driven by AI and acts as a positive demand shock through heavy investment in data centres, chips and power [2]. The Fund also flagged a structural risk: AI supply chains are highly concentrated in a few countries, sectors and firms, which creates potential chokepoints [2].",
          "For businesses, that combination explains a split picture. Firms in AI-linked supply chains are investing and hiring, while energy-intensive and import-dependent sectors face higher costs.",
        ],
      },
      {
        heading: "What are the main risks?",
        paragraphs: [
          "The IMF judges that risks are tilted to the downside [1]. Its accompanying Fiscal Monitor briefing warned that debt service costs are rising, limiting governments’ room to respond to new shocks [3]. In a blog published alongside the report, IMF staff described global resilience as under strain and called for decisive policy action to rebuild fiscal buffers and keep inflation expectations anchored [4]. Escalation in the Middle East, a sharper correction in AI-related asset prices, or disruption at one of the concentrated points in AI supply chains would all push growth below the baseline [1][2].",
        ],
      },
      {
        heading: "Why it matters",
        paragraphs: [
          "A 3.1% world economy is not a recession, but it is one in which inflation is drifting up while growth drifts down. For entrepreneurs and finance teams, the IMF’s numbers argue for planning around higher input costs and tighter public budgets, while watching whether the AI investment cycle keeps its momentum.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is the IMF’s global growth forecast for 2026?",
        a: "In the October 2026 World Economic Outlook, the IMF projects global growth of 3.1% in 2026 and 3.4% in 2027 [1][2].",
      },
      {
        q: "What inflation rate does the IMF expect in 2026?",
        a: "The IMF projects global headline inflation of 4.7% in 2026, easing to 4.1% in 2027 [2].",
      },
      {
        q: "When was the October 2026 World Economic Outlook released?",
        a: "It was released on 13 October 2026, during the IMF and World Bank Annual Meetings [1].",
      },
    ],
    references: [
      {
        text: "International Monetary Fund. (2026). World economic outlook, October 2026: Resilience under strain, urgent choices. IMF.",
        url: "https://www.imf.org/en/publications/weo/issues/2026/10/13/world-economic-outlook-october-2026",
      },
      {
        text: "International Monetary Fund. (2026, October 13). Press briefing transcript: World economic outlook, Annual Meetings 2026.",
        url: "https://www.imf.org/en/news/articles/2026/10/13/tr-101326-press-briefing-transcript-world-economic-outlook-annual-meetings-2026",
      },
      {
        text: "International Monetary Fund. (2026, October 14). Press briefing transcript: Fiscal monitor, Annual Meetings 2026.",
        url: "https://www.imf.org/en/news/articles/2026/10/14/tr-10142026-press-briefing-transcript-fiscal-monitor-annual-meetings-2026",
      },
      {
        text: "International Monetary Fund. (2026, October 12). Global economic resilience is under strain, demanding decisive policy action [IMF Blog].",
        url: "https://www.imf.org/en/blogs/articles/2026/10/12/global-economic-resilience-is-under-strain-demanding-decisive-policy-action",
      },
    ],
    cover: {
      stat: "3.1%",
      statLabel: "Global growth forecast for 2026",
      source: "IMF World Economic Outlook, October 2026",
      hue: 220,
      alt: "Data card: the IMF forecasts 3.1% global growth for 2026, from the October 2026 World Economic Outlook.",
    },
  },

  {
    slug: "nobel-prize-medicine-2026-optogenetics",
    type: "NEWS",
    title: "2026 Nobel Prize in Medicine Honours Optogenetics, the Light Switch for Brain Cells",
    dek: "Karl Deisseroth, Peter Hegemann and Georg Nagel share the prize for discovering light-gated ion channels and turning them into a tool that switches individual neurons on and off.",
    metaDescription:
      "The 2026 Nobel Prize in Physiology or Medicine goes to Deisseroth, Hegemann and Nagel for light-gated ion channels and optogenetics. What they found and why it matters.",
    keywords: [
      "Nobel Prize in Physiology or Medicine 2026",
      "optogenetics",
      "channelrhodopsin",
      "Karl Deisseroth",
      "Peter Hegemann",
      "Georg Nagel",
      "neuroscience",
      "psychology research",
    ],
    category: "Neuroscience & Psychology",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    lede:
      "The 2026 Nobel Prize in Physiology or Medicine was awarded on 5 October 2026 to Karl Deisseroth, Peter Hegemann and Georg Nagel “for their discoveries concerning light-gated ion channels and optogenetics” [1][4]. Their work made it possible to switch individual nerve cells on or off with light, giving neuroscience and psychology a precise way to test how specific brain circuits shape memories, feelings and behaviour [1][2].",
    keyPoints: [
      "The Nobel Assembly at Karolinska Institutet announced the prize on 5 October 2026 [1].",
      "Hegemann and Nagel’s work traced a light-sensitive ion channel, channelrhodopsin, in the green alga Chlamydomonas [2][3].",
      "Deisseroth introduced the channel into mammalian nerve cells, where a pulse of blue light triggered a nerve signal [2][5].",
      "Deisseroth is at Stanford University; Hegemann at Humboldt University of Berlin; Nagel at the University of Würzburg [5][6].",
      "The laureates share prize money of 12 million Swedish kronor [5].",
    ],
    sections: [
      {
        heading: "What did the 2026 Nobel laureates in medicine discover?",
        paragraphs: [
          "The story starts in pond water. The single-celled green alga Chlamydomonas swims towards light, and the laureates’ work identified the protein behind that behaviour: an ion channel that opens when it absorbs light, letting charged particles flow across the cell membrane [2][3]. Because nerve cells communicate through exactly that kind of ion flow, a light-gated channel is, in principle, a light-operated switch for a neuron.",
          "Deisseroth turned the principle into practice. He introduced the gene for the algal channel into mammalian nerve cells, and showed that blue light could make those cells fire [2][5]. The Nobel committee summarised the result simply: the method makes it possible to switch the activity of individual nerve cells on or off [2].",
        ],
      },
      {
        heading: "How does optogenetics work?",
        paragraphs: [
          "Optogenetics combines two tools. Genetics decides which cells carry the light-sensitive channel, so researchers can target one type of neuron in one brain region. Optics then delivers light to those cells, typically through a thin optical fibre, so the researcher decides exactly when they are switched on or off [2][3].",
        ],
      },
      {
        heading: "Why does optogenetics matter for psychology and mental-health research?",
        paragraphs: [
          "The Nobel Assembly framed the discovery as a way to study how nerve cells shape memories, feelings and behaviour in a living brain [1]. Brain imaging can show which areas become active during fear, reward or decision-making; optogenetics lets scientists switch a specific circuit on or off and observe what changes. That shift from correlation to causal testing is why the technique spread so quickly through neuroscience laboratories studying anxiety, addiction, learning and memory, mostly in animal models.",
          "Clinical use is at an early stage. One milestone came in 2021, when researchers reported partial recovery of visual function in a blind patient with retinitis pigmentosa after optogenetic therapy combined with light-stimulating goggles [7].",
        ],
      },
    ],
    faqs: [
      {
        q: "Who won the 2026 Nobel Prize in Physiology or Medicine?",
        a: "Karl Deisseroth, Peter Hegemann and Georg Nagel, “for their discoveries concerning light-gated ion channels and optogenetics” [1][4].",
      },
      {
        q: "What is optogenetics in simple terms?",
        a: "It is a method that puts a light-sensitive protein into chosen nerve cells, so that shining light on them switches their activity on or off [2].",
      },
      {
        q: "Is optogenetics used to treat people?",
        a: "Mostly not yet; it is primarily a research tool. An early clinical example is a 2021 report of partial vision recovery in a blind patient treated with optogenetic therapy [7].",
      },
    ],
    references: [
      {
        text: "The Nobel Assembly at Karolinska Institutet. (2026, October 5). Press release: The Nobel Prize in Physiology or Medicine 2026. NobelPrize.org.",
        url: "https://www.nobelprize.org/prizes/medicine/2026/press-release/",
      },
      {
        text: "NobelPrize.org. (2026). The Nobel Prize in Physiology or Medicine 2026: Popular information.",
        url: "https://www.nobelprize.org/prizes/medicine/2026/popular-information/",
      },
      {
        text: "The Nobel Committee for Physiology or Medicine. (2026). Scientific background: Optogenetics — Discovery of a neuronal switch. NobelPrize.org.",
        url: "https://www.nobelprize.org/uploads/2026/10/advanced-medicineprize2026.pdf",
      },
      {
        text: "NobelPrize.org. (2026). The Nobel Prize in Physiology or Medicine 2026: Summary.",
        url: "https://www.nobelprize.org/prizes/medicine/2026/summary/",
      },
      {
        text: "Al Jazeera. (2026, October 5). Nobel medicine prize honours US and German scientists for optogenetics work.",
        url: "https://www.aljazeera.com/amp/news/2026/10/5/nobel-medicine-prize-honours-us-and-german-scientists-for-optogenetics-work",
      },
      {
        text: "Georgia Public Broadcasting. (2026, October 5). Nobel medicine prize goes to 3 scientists for research on brain activity.",
        url: "https://www.gpb.org/news/2026/10/05/nobel-medicine-prize-goes-3-scientists-for-research-brain-activity",
      },
      {
        text: "Sahel, J.-A., Boulanger-Scemama, E., Pagot, C., Arleo, A., Galluppi, F., Martel, J. N., … Roska, B. (2021). Partial recovery of visual function in a blind patient after optogenetic therapy. Nature Medicine, 27(7), 1223–1229.",
        url: "https://doi.org/10.1038/s41591-021-01351-4",
      },
    ],
    cover: {
      stat: "On / Off",
      statLabel: "Neurons switched with light: optogenetics",
      source: "Nobel Prize in Physiology or Medicine 2026",
      hue: 285,
      alt: "Data card: optogenetics switches neurons on and off with light, the subject of the 2026 Nobel Prize in Physiology or Medicine.",
    },
  },

  {
    slug: "stanford-ai-index-2026-key-findings",
    type: "NEWS",
    title: "Stanford AI Index 2026: Capabilities Surge, Adoption Reaches 53%, and Safety Lags Behind",
    dek: "The ninth AI Index finds frontier models matching human baselines on hard benchmarks while documented AI incidents rise and public trust trails expert optimism.",
    metaDescription:
      "Stanford HAI's AI Index 2026: coding benchmark scores near 100% of human baseline, 53% generative AI adoption, $285.9B US private investment and 362 AI incidents.",
    keywords: [
      "AI Index 2026",
      "Stanford HAI",
      "AI adoption",
      "generative AI statistics",
      "AI investment 2025",
      "AI safety incidents",
      "technology trends",
    ],
    category: "Technology",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    lede:
      "Stanford HAI’s 2026 AI Index reports that AI capability is still climbing fast: performance on the SWE-bench Verified coding benchmark rose from 60% to near 100% in a single year, and generative AI reached 53% population adoption within three years [1][2]. The same report finds documented AI incidents rising to 362, from 233 in 2024, and a wide gap between expert and public expectations [2].",
    keyPoints: [
      "Industry produced over 90% of notable frontier AI models in 2025 [2].",
      "On SWE-bench Verified, a software-engineering benchmark, performance rose from 60% to near 100% in one year [2].",
      "As of March 2026, the top US model led the best Chinese model by only 2.7% [2].",
      "US private AI investment reached $285.9 billion in 2025 [2].",
      "Generative AI reached 53% population adoption within three years; the United States ranks 24th at 28.3% [2].",
      "Documented AI incidents rose to 362, up from 233 in 2024 [2].",
    ],
    sections: [
      {
        heading: "How capable is AI in 2026?",
        paragraphs: [
          "Very capable, and unevenly so. The AI Index finds that several frontier models now meet or exceed human baselines on PhD-level science questions, multimodal reasoning and competition mathematics, and that SWE-bench Verified scores went from 60% to near 100% in a single year [2].",
          "The report is just as clear about the gaps. The same class of models that can win a mathematics olympiad gold medal reads analogue clocks correctly only 50.6% of the time, against 90.1% for humans, and AI agents still fail roughly one in three attempts on structured benchmarks [2].",
        ],
      },
      {
        heading: "Who is building frontier AI?",
        paragraphs: [
          "Mostly companies. Industry produced more than 90% of notable frontier models in 2025 [2]. The competitive gap between countries has narrowed sharply: as of March 2026, the leading US model was ahead of China’s best by just 2.7% [2]. The United States still dominates private investment, at $285.9 billion in 2025 [3], but the inflow of AI researchers to the US has fallen 89% since 2017 [2].",
        ],
      },
      {
        heading: "How fast are people and businesses adopting AI?",
        paragraphs: [
          "Generative AI reached 53% population adoption within three years, and the Index ranks the United States 24th, at 28.3% [2]. Business adoption is lower when measured strictly: the US Census Bureau’s Business Trends and Outlook Survey put the share of US firms using AI to produce goods or services at 19.8% in early May 2026, with much higher rates in the information (39.7%) and finance and insurance (33.9%) sectors [4].",
        ],
      },
      {
        heading: "Is AI safety keeping up?",
        paragraphs: [
          "Not according to the Index. Documented AI incidents rose to 362 from 233 in 2024, and reporting on safety benchmarks remains patchy [2]. Expectations also diverge: 73% of experts expect AI to have a positive impact on jobs, compared with 23% of the public [2].",
        ],
      },
      {
        heading: "Why it matters",
        paragraphs: [
          "For organisations deciding how to use AI, the Index offers a practical lesson: benchmark headlines describe what models can do at their best, not how reliably they perform on your task. The jagged profile, superhuman on some tests and unreliable on others, argues for careful evaluation, human review and clear accountability before AI output is trusted in high-stakes work.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is the Stanford AI Index?",
        a: "An annual, independent report from the Stanford Institute for Human-Centered Artificial Intelligence (HAI) that tracks AI research, technical performance, investment, adoption and policy [1].",
      },
      {
        q: "How many people use generative AI?",
        a: "The 2026 AI Index reports that generative AI reached 53% population adoption within three years [2].",
      },
      {
        q: "How much was invested in AI in 2025?",
        a: "The AI Index reports US private AI investment of $285.9 billion in 2025 [2].",
      },
    ],
    references: [
      {
        text: "Stanford Institute for Human-Centered Artificial Intelligence. (2026). The 2026 AI Index report. Stanford University.",
        url: "https://hai.stanford.edu/ai-index/2026-ai-index-report",
      },
      {
        text: "Stanford HAI. (2026). Inside the AI Index: 12 takeaways from the 2026 report.",
        url: "https://hai.stanford.edu/news/inside-the-ai-index-12-takeaways-from-the-2026-report",
      },
      {
        text: "Stanford HAI. (2026). AI Index report 2026, Chapter 4: Economy.",
        url: "https://hai.stanford.edu/ai-index/2026-ai-index-report/economy",
      },
      {
        text: "U.S. Census Bureau. (2026, May). Large firms with at least 20 employees biggest AI users.",
        url: "https://www.census.gov/library/stories/2026/05/ai-use-businesses.html",
      },
    ],
    cover: {
      stat: "53%",
      statLabel: "Generative AI adoption within three years",
      source: "Stanford HAI AI Index 2026",
      hue: 200,
      alt: "Data card: generative AI reached 53% population adoption within three years, from the Stanford AI Index 2026.",
    },
  },

  {
    slug: "oecd-education-at-a-glance-2026-teacher-shortages",
    type: "NEWS",
    title: "Education at a Glance 2026: OECD Finds Teacher Shortages Are About Qualifications, Not Just Vacancies",
    dek: "Unfilled posts are below 4% of the teaching workforce everywhere with data, but about 9% of teachers are not fully qualified, and 6.4% of qualified teachers left in a single year.",
    metaDescription:
      "OECD Education at a Glance 2026: 9.1% of teachers not fully qualified, 6.4% attrition and maths and science gaps. Key findings on teacher shortages explained.",
    keywords: [
      "Education at a Glance 2026",
      "OECD teacher shortages",
      "teacher attrition",
      "unqualified teachers",
      "STEM teachers",
      "education policy",
    ],
    category: "Education",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    lede:
      "The OECD’s Education at a Glance 2026 finds that teacher shortages show up less as empty posts than as underqualified staff: unfilled vacancies were under 4% of the primary and secondary teaching workforce in all 20 systems with data in 2024/25, but 9.1% of teachers across OECD countries were not fully qualified [1][2]. Shortages are concentrated in mathematics and science and in rural, remote and disadvantaged schools [1].",
    keyPoints: [
      "In all 20 education systems with data, unfilled posts were under 4% of the primary and secondary teaching workforce in 2024/25 [1].",
      "Across OECD countries, 9.1% of primary and secondary teachers were not fully qualified in 2024/25; the share exceeded 18% in Chile, Denmark, Estonia and Germany [1][2].",
      "6.4% of fully qualified primary and secondary teachers left the profession during the 2024/25 school year [1].",
      "11 of the 16 countries and economies with data reported shortages of fully qualified secondary mathematics and science teachers [1].",
      "85% of teachers report being satisfied with their jobs, similar to other workers [1].",
      "The number of children aged 5–14 in OECD countries is projected to fall by 9% between 2024 and 2033 [1].",
    ],
    sections: [
      {
        heading: "What does Education at a Glance 2026 focus on?",
        paragraphs: [
          "The 2026 edition of the OECD’s annual statistical report on education takes teacher shortages and the attractiveness of the teaching profession as its theme [1][3]. It covers the 38 OECD member countries alongside partner countries [1].",
        ],
      },
      {
        heading: "How big is the teacher shortage?",
        paragraphs: [
          "It depends on how you measure it. Counting empty posts gives a reassuring answer: in every one of the 20 systems with data, unfilled positions were less than 4% of the combined primary and secondary teaching workforce in 2024/25 [1].",
          "Counting qualifications gives a different one. Across OECD countries, 9.1% of primary and secondary teachers were not fully qualified, meaning they did not yet meet all national requirements for a fully qualified teacher [2]. The share exceeded 18% in Chile, Denmark, Estonia and Germany, while Japan and Korea require teachers to be fully qualified before entering the profession [1]. Country notes show the spread: 13.9% in Sweden’s public schools against 0.3% in Ireland [4][5].",
        ],
      },
      {
        heading: "Where are teachers hardest to find?",
        paragraphs: [
          "In particular subjects and places. Among the 16 countries and economies with data, 11 reported shortages of fully qualified mathematics and science teachers at secondary level, and the OECD points to rural, remote and disadvantaged communities as the places where recruitment is most acute [1].",
        ],
      },
      {
        heading: "Why do teachers leave?",
        paragraphs: [
          "Attrition is meaningful: 6.4% of fully qualified primary and secondary teachers left the profession during the 2024/25 school year [1]. Job satisfaction is not the obvious culprit. The OECD reports that 85% of teachers are satisfied with their jobs, broadly in line with workers in other professions [1], which suggests that workload, working conditions and career structure deserve as much attention as pay.",
        ],
      },
      {
        heading: "Why it matters",
        paragraphs: [
          "Falling pupil numbers will ease pressure in some places, with the OECD projecting a 9% fall in the 5–14 population between 2024 and 2033, but the decline will be uneven [1]. The report’s central message for policymakers is that vacancy counts understate the problem. Students in shortage subjects and disadvantaged areas are the most likely to be taught by teachers who are not yet fully qualified.",
        ],
      },
    ],
    faqs: [
      {
        q: "What percentage of teachers are not fully qualified in OECD countries?",
        a: "Education at a Glance 2026 reports that 9.1% of primary and secondary teachers across OECD countries were not fully qualified in 2024/25 [2].",
      },
      {
        q: "Which subjects have the worst teacher shortages?",
        a: "Mathematics and science: 11 of the 16 countries and economies with data reported shortages of fully qualified secondary teachers in those subjects [1].",
      },
      {
        q: "How many teachers leave the profession each year?",
        a: "6.4% of fully qualified primary and secondary teachers in OECD countries left the profession during the 2024/25 school year [1].",
      },
    ],
    references: [
      {
        text: "OECD. (2026, September). Teacher shortages are putting pressure on education systems across the OECD [Press release].",
        url: "https://www.oecd.org/en/about/news/press-releases/2026/09/teacher-shortages-are-putting-pressure-on-education-systems-across-the-oecd.html",
      },
      {
        text: "OECD. (2026). Teacher shortages and the attractiveness of the teaching profession. In Education at a glance 2026: OECD indicators. OECD Publishing.",
        url: "https://www.oecd.org/en/publications/2026/09/education-at-a-glance-2026_3bce4131/full-report/teacher-shortages-and-the-attractiveness-of-the-teaching-profession_074961e4.html",
      },
      {
        text: "OECD. (2026). Education at a glance 2026: OECD indicators. OECD Publishing.",
        url: "https://www.oecd.org/en/publications/2026/09/education-at-a-glance-2026_3bce4131.html",
      },
      {
        text: "OECD. (2026). Education at a glance 2026: Sweden [Country note].",
        url: "https://www.oecd.org/en/publications/education-at-a-glance-2026_c0e523a9-en/sweden_f39a43ca-en.html",
      },
      {
        text: "OECD. (2026). Education at a glance 2026: Ireland [Country note].",
        url: "https://www.oecd.org/en/publications/education-at-a-glance-2026_c0e523a9-en/ireland_659909ab-en.html",
      },
    ],
    cover: {
      stat: "9.1%",
      statLabel: "Teachers not fully qualified, OECD average",
      source: "OECD Education at a Glance 2026",
      hue: 160,
      alt: "Data card: 9.1% of primary and secondary teachers in OECD countries were not fully qualified in 2024/25, from Education at a Glance 2026.",
    },
  },

  {
    slug: "gallup-state-of-the-global-workplace-2026-employee-engagement",
    type: "NEWS",
    title: "Global Employee Engagement Falls to 20%, Gallup’s 2026 Workplace Report Finds — Managers Drive the Decline",
    dek: "Engagement hit its lowest level since 2020, costing an estimated $10 trillion in lost productivity. A five-point drop among managers accounts for most of the fall.",
    metaDescription:
      "Gallup State of the Global Workplace 2026: engagement fell to 20% in 2025, manager engagement dropped from 27% to 22%, costing an estimated $10 trillion.",
    keywords: [
      "State of the Global Workplace 2026",
      "Gallup employee engagement",
      "manager engagement",
      "workplace psychology",
      "employee wellbeing",
      "productivity",
    ],
    category: "Business & Workplace Psychology",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    lede:
      "Gallup’s State of the Global Workplace 2026 report finds that only 20% of employees worldwide were engaged at work in 2025, the lowest level since 2020, at an estimated cost of $10 trillion in lost productivity [1]. The decline is driven by managers: manager engagement fell five points in a year, from 27% to 22% [2].",
    keyPoints: [
      "Global employee engagement fell to 20% in 2025, its lowest level since 2020 [1].",
      "64% of employees are not engaged and 16% are actively disengaged [1].",
      "Manager engagement dropped from 27% to 22% between 2024 and 2025, and is down nine points since 2022 [2].",
      "In best-practice organisations, 79% of managers are engaged, nearly four times the global average [2].",
      "Regional engagement ranges from 12% in Europe to 31% in the United States and Canada [3].",
    ],
    sections: [
      {
        heading: "How engaged are employees in 2026?",
        paragraphs: [
          "Gallup classifies employees as engaged, not engaged or actively disengaged based on its workplace survey. In 2025, 20% of employees worldwide were engaged, 64% were not engaged and 16% were actively disengaged [1]. Gallup estimates that low engagement cost the world economy around $10 trillion in lost productivity [1].",
        ],
      },
      {
        heading: "Why are managers the key to the decline?",
        paragraphs: [
          "Most of the downturn comes from managers. Gallup reports that manager engagement fell five points, from 27% to 22%, between 2024 and 2025, the largest year-on-year drop it has recorded, and nine points since 2022 [2]. South Asia saw the steepest regional fall in manager engagement, at eight points [2].",
          "This matters because, in Gallup’s research, managers shape the daily experience of their teams: clarity of expectations, recognition, development and the feeling that someone cares. When managers disengage, the effect cascades.",
        ],
      },
      {
        heading: "What do the best organisations do differently?",
        paragraphs: [
          "In best-practice organisations, 79% of managers were engaged in 2025, nearly quadruple the global average [2]. Gallup’s report argues that the gap is closed by investing in managers themselves: selecting people with the talent to manage, developing their coaching skills and supporting their own wellbeing [1][2].",
        ],
      },
      {
        heading: "Is employee wellbeing also falling?",
        paragraphs: [
          "Not uniformly. The share of employees Gallup classifies as thriving in their overall lives rose one point to 34%, with Latin America and the Caribbean and Europe seeing the largest increases [3]. Engagement varies widely by region, from 12% in Europe to 31% in the United States and Canada [3][4].",
        ],
      },
      {
        heading: "Why it matters",
        paragraphs: [
          "For business leaders, the report reframes engagement as a management-capability problem rather than a perks problem. For organisational psychologists, the manager decline is a reminder that the people expected to absorb change, including the rollout of AI tools, are often the least supported.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is the global employee engagement rate in 2026?",
        a: "Gallup’s 2026 report puts global employee engagement at 20% for 2025, the lowest level since 2020 [1].",
      },
      {
        q: "How much does disengagement cost the economy?",
        a: "Gallup estimates the cost of low engagement at about $10 trillion in lost productivity [1].",
      },
      {
        q: "Why did engagement fall?",
        a: "Gallup attributes most of the decline to managers, whose engagement fell from 27% to 22% between 2024 and 2025 [2].",
      },
    ],
    references: [
      {
        text: "Gallup. (2026). State of the global workplace: 2026 report. Gallup, Inc.",
        url: "https://www.gallup.com/workplace/349484/state-of-the-global-workplace.aspx",
      },
      {
        text: "Gallup. (2026). Global employee engagement continues decline.",
        url: "https://www.gallup.com/workplace/708071/global-employee-engagement-continues-decline.aspx",
      },
      {
        text: "Gallup. (2026). State of the global workplace: Global data.",
        url: "https://www.gallup.com/workplace/697904/state-of-the-global-workplace-global-data.aspx",
      },
      {
        text: "Gallup. (2026). State of the global workplace: Regional data.",
        url: "https://www.gallup.com/workplace/697850/state-of-the-global-workplace-regional-data.aspx",
      },
    ],
    cover: {
      stat: "20%",
      statLabel: "Employees engaged at work worldwide, 2025",
      source: "Gallup State of the Global Workplace 2026",
      hue: 35,
      alt: "Data card: 20% of employees worldwide were engaged at work in 2025, from Gallup's State of the Global Workplace 2026.",
    },
  },

  {
    slug: "nobel-prize-physics-2026-francis-halzen-icecube",
    type: "NEWS",
    title: "Nobel Prize in Physics 2026: Francis Halzen and the Neutrino Telescope Buried in Antarctic Ice",
    dek: "Halzen is honoured for decisive contributions to the IceCube Neutrino Observatory, a cubic kilometre of instrumented ice at the South Pole that discovered high-energy neutrinos from the cosmos.",
    metaDescription:
      "The 2026 Nobel Prize in Physics goes to Francis Halzen for the IceCube Neutrino Observatory and the discovery of high-energy astrophysical neutrinos. Key facts.",
    keywords: [
      "Nobel Prize in Physics 2026",
      "Francis Halzen",
      "IceCube Neutrino Observatory",
      "astrophysical neutrinos",
      "neutrino astronomy",
      "South Pole",
    ],
    category: "Research",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    lede:
      "The Royal Swedish Academy of Sciences awarded the 2026 Nobel Prize in Physics to Francis Halzen “for decisive contributions to the IceCube Neutrino Observatory and the discovery of high-energy neutrinos of astrophysical origin” [1][3]. Halzen first proposed using Antarctic ice as a neutrino detector in 1988; the completed observatory instruments a full cubic kilometre of ice at the South Pole [3].",
    keyPoints: [
      "The prize was announced on 6 October 2026 [1].",
      "Halzen, of the University of Wisconsin–Madison, is IceCube’s principal investigator [3][4].",
      "He first presented the idea of capturing neutrinos in South Pole ice in 1988 [3].",
      "IceCube, completed in 2011, instruments a cubic kilometre of Antarctic ice [3].",
      "In 2013 IceCube reported the first evidence of high-energy neutrinos from beyond the solar system [5].",
    ],
    sections: [
      {
        heading: "Why did Francis Halzen win the 2026 Nobel Prize in Physics?",
        paragraphs: [
          "Neutrinos are almost massless, carry no electric charge and pass through ordinary matter almost untouched, which makes them ideal messengers from violent cosmic events and extremely hard to catch [2]. Halzen championed the idea that a huge, transparent natural medium, the deep ice of Antarctica, could be turned into a detector large enough to register the rare high-energy neutrinos arriving from space [2][3].",
        ],
      },
      {
        heading: "How does IceCube detect neutrinos?",
        paragraphs: [
          "When a neutrino occasionally collides with an atom in the ice, it produces charged particles that emit a faint blue Cherenkov light. Thousands of optical sensors, lowered on cables into holes drilled deep into the ice, record that light; its timing and pattern reveal the neutrino’s energy and direction [2][3]. The finished detector, completed in 2011, spans an entire cubic kilometre [3].",
        ],
      },
      {
        heading: "What has IceCube discovered?",
        paragraphs: [
          "In 2013 the collaboration reported evidence of high-energy neutrinos of extraterrestrial origin, opening a new window on the universe [5]. In 2018 it linked a high-energy neutrino to a flaring blazar, TXS 0506+056, the first evidence of an individual cosmic source [6]. Later results identified neutrino emission from the active galaxy NGC 1068 in 2022 [7] and from the plane of our own Milky Way in 2023 [8].",
        ],
      },
      {
        heading: "Why it matters",
        paragraphs: [
          "IceCube helped found neutrino astronomy as a field and made it part of multimessenger astronomy, in which light, gravitational waves and particles are combined to study the same cosmic events. The prize also recognises a model of big science: a decades-long bet on an unconventional instrument, built and run by a large international collaboration.",
        ],
      },
    ],
    faqs: [
      {
        q: "Who won the Nobel Prize in Physics 2026?",
        a: "Francis Halzen, “for decisive contributions to the IceCube Neutrino Observatory and the discovery of high-energy neutrinos of astrophysical origin” [1].",
      },
      {
        q: "What is the IceCube Neutrino Observatory?",
        a: "A neutrino detector that instruments a cubic kilometre of ice at the South Pole with optical sensors, completed in 2011 [3].",
      },
      {
        q: "Why are astrophysical neutrinos important?",
        a: "Because they travel through space almost unimpeded, they carry information directly from the most energetic places in the universe, such as active galactic nuclei [2][7].",
      },
    ],
    references: [
      {
        text: "The Royal Swedish Academy of Sciences. (2026, October 6). Press release: The Nobel Prize in Physics 2026. NobelPrize.org.",
        url: "https://www.nobelprize.org/prizes/physics/2026/press-release/",
      },
      {
        text: "The Royal Swedish Academy of Sciences. (2026). The Nobel Prize in Physics 2026: Popular science background. NobelPrize.org.",
        url: "https://www.nobelprize.org/uploads/2026/10/popular-physicsprize2026.pdf",
      },
      {
        text: "IceCube Neutrino Observatory. (2026, October). Francis Halzen, IceCube principal investigator, wins 2026 Physics Nobel Prize.",
        url: "https://icecube.wisc.edu/news/awards/2026/10/francis-halzen-icecube-principal-investigator-wins-2026-physics-nobel-prize/",
      },
      {
        text: "University of Wisconsin–Madison. (2026, October). University of Wisconsin–Madison professor Francis Halzen named 2026 Nobel laureate in physics.",
        url: "https://news.wisc.edu/university-of-wisconsin-madison-professor-francis-halzen-named-2026-nobel-laureate-in-physics/",
      },
      {
        text: "IceCube Collaboration. (2013). Evidence for high-energy extraterrestrial neutrinos at the IceCube detector. Science, 342(6161), 1242856.",
        url: "https://doi.org/10.1126/science.1242856",
      },
      {
        text: "IceCube Collaboration et al. (2018). Multimessenger observations of a flaring blazar coincident with high-energy neutrino IceCube-170922A. Science, 361(6398), eaat1378.",
        url: "https://doi.org/10.1126/science.aat1378",
      },
      {
        text: "IceCube Collaboration. (2022). Evidence for neutrino emission from the nearby active galaxy NGC 1068. Science, 378(6619), 538–543.",
        url: "https://doi.org/10.1126/science.abg3395",
      },
      {
        text: "IceCube Collaboration. (2023). Observation of high-energy neutrinos from the Galactic plane. Science, 380(6652), 1338–1343.",
        url: "https://doi.org/10.1126/science.adc9818",
      },
    ],
    cover: {
      stat: "1 km³",
      statLabel: "Of Antarctic ice turned into a neutrino telescope",
      source: "Nobel Prize in Physics 2026 · IceCube",
      hue: 240,
      alt: "Data card: one cubic kilometre of Antarctic ice instrumented as the IceCube neutrino telescope, honoured by the 2026 Nobel Prize in Physics.",
    },
  },

  {
    slug: "global-physical-activity-unchanged-nature-2026",
    type: "NEWS",
    title: "One in Three Adults Still Miss WHO Exercise Targets After Two Decades, Nature Studies Find",
    dek: "Papers in Nature Health and Nature Medicine show that physical inactivity has barely moved since the early 2000s, despite a wave of national activity policies.",
    metaDescription:
      "Nature Health and Nature Medicine 2026: one in three adults and about 80% of adolescents miss WHO activity guidelines, and inactivity has not improved in 20 years.",
    keywords: [
      "physical inactivity 2026",
      "WHO physical activity guidelines",
      "global physical activity",
      "exercise statistics",
      "Nature Health",
      "public health",
      "fitness",
    ],
    category: "Health & Fitness",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    lede:
      "Global physical activity has not improved in two decades: about one in three adults and roughly 80% of adolescents worldwide still do not meet WHO activity guidelines, according to papers published in Nature Health and Nature Medicine in March 2026 [1][2]. Countries adopted far more physical-activity policies after 2004, the authors found, but implementation has remained weak [2].",
    keyPoints: [
      "Three papers in Nature Health and Nature Medicine were published together in March 2026 [1].",
      "About one in three adults and around 80% of adolescents do not meet WHO physical-activity guidelines [1][2].",
      "The prevalence of physical inactivity has stayed unchanged in most countries for two decades [2].",
      "More than 5 million deaths a year are attributed to physical inactivity [3].",
      "WHO’s goal of a 15% relative reduction in inactivity by 2030 is unlikely to be met [4].",
    ],
    sections: [
      {
        heading: "How many people don’t get enough exercise?",
        paragraphs: [
          "WHO recommends that adults do at least 150–300 minutes of moderate-intensity aerobic activity a week, or 75–150 minutes of vigorous activity, plus muscle-strengthening on two or more days [7]. By that standard, about a third of adults and roughly four in five adolescents fall short [1][2].",
          "The new papers build on WHO-led estimates published in 2024, which found that 31% of adults, nearly 1.8 billion people, were insufficiently active in 2022, up from 23% in 2000 and 26% in 2010 [5][6].",
        ],
      },
      {
        heading: "Have physical-activity policies worked?",
        paragraphs: [
          "Policies have multiplied; behaviour has not followed. The Nature Health analysis by Ramírez Varela, Bauman, Woods and colleagues found that national adoption of physical-activity policies has increased since 2004, while the prevalence of inactivity remained unchanged in most countries [2]. The authors attribute the gap to weak implementation and low political priority [2]. An accompanying commentary concludes that WHO’s target of a 15% relative reduction in physical inactivity by 2030 is unlikely to be met [4].",
        ],
      },
      {
        heading: "Who is most affected?",
        paragraphs: [
          "The Nature Medicine paper looks at inequalities by gender and socioeconomic position across leisure-time, transport and occupational activity, using WHO STEPwise survey data [3]. It highlights that many people are active out of necessity, through manual work or walking for transport, rather than choice, and describes groups who remain “physical activity insecure” despite high overall activity [3]. It links physical inactivity to more than 5 million deaths each year [3].",
        ],
      },
      {
        heading: "Why it matters",
        paragraphs: [
          "The findings shift the conversation from individual motivation to systems: safe streets, active transport, school sport and workplace design. For individuals, the evidence remains encouraging; every extra bout of movement counts towards the guideline, and the largest health gains come from moving from very little activity to some.",
        ],
      },
    ],
    faqs: [
      {
        q: "What share of adults don’t meet exercise guidelines?",
        a: "About one in three adults worldwide do not meet WHO physical-activity guidelines; the 2024 WHO-led estimate was 31% of adults in 2022 [2][5].",
      },
      {
        q: "How much exercise does WHO recommend?",
        a: "For adults, 150–300 minutes of moderate or 75–150 minutes of vigorous aerobic activity a week, plus muscle-strengthening activities on two or more days [7].",
      },
      {
        q: "Has global physical activity improved?",
        a: "No. The 2026 Nature Health analysis found inactivity prevalence unchanged in most countries over the last two decades [2].",
      },
    ],
    references: [
      {
        text: "Springer Nature. (2026, March). Health: Global physical activity levels have not improved over 20 years (Nature Medicine, Nature Health) [Press release]. Nature Asia.",
        url: "https://www.natureasia.com/en/info/press-releases/detail/9261",
      },
      {
        text: "Ramírez Varela, A., Bauman, A., Woods, C., et al. (2026). Low global physical activity despite two decades of policy progress. Nature Health.",
        url: "https://www.nature.com/articles/s44360-025-00044-3",
      },
      {
        text: "Physical activity for public health in the 21st century. (2026). Nature Medicine.",
        url: "https://doi.org/10.1038/s41591-026-04237-5",
      },
      {
        text: "Physical activity remains under-prioritized in political agendas. (2026). Nature Health.",
        url: "https://www.nature.com/articles/s44360-026-00078-1",
      },
      {
        text: "Strain, T., Flaxman, S., Guthold, R., et al. (2024). National, regional, and global trends in insufficient physical activity among adults from 2000 to 2022. The Lancet Global Health, 12(8), e1232–e1243.",
        url: "https://doi.org/10.1016/S2214-109X(24)00150-5",
      },
      {
        text: "World Health Organization. (2024, June 26). Nearly 1.8 billion adults at risk of disease from not doing enough physical activity [News release].",
        url: "https://www.who.int/news/item/26-06-2024-nearly-1.8-billion-adults-at-risk-of-disease-from-not-doing-enough-physical-activity",
      },
      {
        text: "Bull, F. C., Al-Ansari, S. S., Biddle, S., et al. (2020). World Health Organization 2020 guidelines on physical activity and sedentary behaviour. British Journal of Sports Medicine, 54(24), 1451–1462.",
        url: "https://doi.org/10.1136/bjsports-2020-102955",
      },
    ],
    cover: {
      stat: "1 in 3",
      statLabel: "Adults miss WHO physical-activity guidelines",
      source: "Nature Health & Nature Medicine, 2026",
      hue: 140,
      alt: "Data card: one in three adults miss WHO physical-activity guidelines, from studies in Nature Health and Nature Medicine, 2026.",
    },
  },

  {
    slug: "gem-global-entrepreneurship-monitor-2025-2026-survival-gap",
    type: "NEWS",
    title: "Startups Hit Record Highs but Struggle to Survive, Global Entrepreneurship Monitor Warns",
    dek: "GEM’s 2025/2026 Global Report finds early-stage entrepreneurship at record levels across many of its 53 economies, but too few ventures grow into established businesses.",
    metaDescription:
      "GEM 2025/2026 Global Report: record early-stage entrepreneurship, a widening survival gap, weak finance in 36 of 53 economies and new data on women founders.",
    keywords: [
      "Global Entrepreneurship Monitor 2025/2026",
      "GEM report",
      "entrepreneurship statistics",
      "startup survival",
      "women entrepreneurs",
      "small business",
    ],
    category: "Business & Entrepreneurship",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    lede:
      "The Global Entrepreneurship Monitor’s 2025/2026 Global Report, “From Uncertainty to Opportunity”, finds early-stage entrepreneurial activity at record highs in many of the 53 economies it surveys, while the progression from startup to established business, a firm older than 3.5 years, is stalling [1]. GEM calls this the “Survival Gap” [1].",
    keyPoints: [
      "The report covers 53 economies and finds record levels of early-stage entrepreneurial activity in many of them [1].",
      "Too few new ventures reach established-business status, creating what GEM calls a “Survival Gap” [1].",
      "Entrepreneurial finance is rated insufficient in 36 of the 53 economies [1].",
      "Fear of failure deters roughly two in five adults from starting a business [1].",
      "GEM’s companion women’s report finds women lead about 40% of high-potential new businesses, but their activity drops sharply at the established stage [2][3].",
    ],
    sections: [
      {
        heading: "What is the entrepreneurship “Survival Gap”?",
        paragraphs: [
          "GEM tracks Total early-stage Entrepreneurial Activity (TEA): the share of adults starting or running a new business. The 2025/2026 report finds that TEA has reached record highs, but that progression to established business, meaning a firm that has paid wages for more than 3.5 years, is stalling across many economies [1]. In other words, more people are starting businesses than ever, and too few of those businesses last.",
        ],
      },
      {
        heading: "What holds new businesses back?",
        paragraphs: [
          "GEM’s experts rated both the provision of and access to entrepreneurial finance as insufficient in 36 of the 53 economies, and entrepreneurship education at school was the lowest-rated condition in 33 of them [1]. Fear of failure deters roughly two in five adults, although people who have previously exited a business are more likely to start again [1].",
          "Only India, Lithuania, Saudi Arabia and the United Arab Emirates were rated sufficient on all 13 of GEM’s framework conditions, and the UAE ranked first on the National Entrepreneurship Context Index for the fifth year in a row [1].",
        ],
      },
      {
        heading: "Are entrepreneurs ready for artificial intelligence?",
        paragraphs: [
          "Not everywhere. In 19 of 48 economies, fewer than one in three new entrepreneurs expect AI to become very important to their business in the near term, a pattern GEM warns could produce a two-tier entrepreneurial economy [1]. On motivation, an average of 84% of early-stage entrepreneurs say they consider social or environmental impact in their business decisions [1].",
        ],
      },
      {
        heading: "What does GEM find about women entrepreneurs?",
        paragraphs: [
          "GEM’s Women’s Entrepreneurship Report, based on its 2025 Adult Population Survey of 150,799 adults in 48 economies, finds that 12% of women surveyed were running new businesses, compared with 14% of men, and that women lead about 40% of high-potential new businesses [2][3]. Women also made up 44% of entrepreneurs emphasising digitalisation and 43% of those reporting AI innovation [2].",
          "The drop-off comes later: women’s high-potential activity was 6.0% at the early stage but 0.1% at the established-business stage, and the women-to-men ratio in established business ownership, 0.69, was the widest gap across the life cycle [2]. Women were also more likely than men to cite family or personal reasons for exiting a business (20% vs 13%) [2].",
        ],
      },
      {
        heading: "Why it matters",
        paragraphs: [
          "Startup counts make attractive headlines, but jobs, innovation and tax revenue come disproportionately from firms that survive and grow. GEM’s data point policymakers and support programmes towards the second and third years of a business: access to growth finance, management skills, and support for founders with caring responsibilities.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is the Global Entrepreneurship Monitor?",
        a: "GEM is an international research consortium that surveys adults and national experts each year to measure entrepreneurial activity and the conditions that support it; the 2025/2026 Global Report covers 53 economies [1].",
      },
      {
        q: "What does TEA mean in the GEM report?",
        a: "Total early-stage Entrepreneurial Activity: the share of adults who are starting or running a new business [1].",
      },
      {
        q: "What share of high-potential startups are led by women?",
        a: "GEM’s women’s entrepreneurship report finds that women lead about 40% of high-potential new businesses globally [3].",
      },
    ],
    references: [
      {
        text: "Global Entrepreneurship Monitor. (2026). GEM 2025/2026 global report: From uncertainty to opportunity. GERA.",
        url: "https://www.gemconsortium.org/reports/latest-global-report",
      },
      {
        text: "Global Entrepreneurship Monitor. (2026). GEM 2025/2026 women’s entrepreneurship report: How metrics shape the narrative. GERA.",
        url: "https://www.gemconsortium.org/reports/womens-entrepreneurship",
      },
      {
        text: "Global Entrepreneurship Monitor. (2026). New GEM report finds women are active in high-potential entrepreneurship — but activity falls sharply at the established business stage [News release].",
        url: "https://gemconsortium.org/news/new-gem-report-finds-women-are-active-in-high-potential-entrepreneurship-%E2%80%94-but-activity-falls-sharply-at-the-established-business-stage",
      },
    ],
    cover: {
      stat: "36 / 53",
      statLabel: "Economies where startup finance is insufficient",
      source: "GEM 2025/2026 Global Report",
      hue: 55,
      alt: "Data card: entrepreneurial finance rated insufficient in 36 of 53 economies, from the GEM 2025/2026 Global Report.",
    },
  },

  {
    slug: "nobel-prize-chemistry-2026-kagan-soai-homochirality",
    type: "NEWS",
    title: "Nobel Prize in Chemistry 2026: Kagan and Soai Explain How Molecules Choose a Hand",
    dek: "Henri B. Kagan and Kenso Soai are honoured for discovering non-linear effects and autocatalysis in asymmetric synthesis, work that bears on why life uses only one mirror-image form of its molecules.",
    metaDescription:
      "The 2026 Nobel Prize in Chemistry goes to Henri B. Kagan and Kenso Soai for non-linear effects and autocatalysis in asymmetric organic synthesis. What it means.",
    keywords: [
      "Nobel Prize in Chemistry 2026",
      "Henri Kagan",
      "Kenso Soai",
      "chirality",
      "homochirality",
      "asymmetric synthesis",
      "Soai reaction",
    ],
    category: "Research",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    lede:
      "The 2026 Nobel Prize in Chemistry was awarded on 7 October 2026 to Henri B. Kagan and Kenso Soai “for the discovery of non-linear effects and autocatalysis in asymmetric organic synthesis” [1][2]. Their discoveries show how a small imbalance between mirror-image molecules can be amplified into an almost pure single form, a central clue to why living things use only one “hand” of key molecules [3].",
    keyPoints: [
      "The Royal Swedish Academy of Sciences announced the prize on 7 October 2026 [1].",
      "Kagan is affiliated with Université Paris-Sud, France, and Soai with Tokyo University of Science, Japan [1][2].",
      "Kagan’s group described non-linear effects in asymmetric synthesis in 1986 [3][5].",
      "Soai reported in 1995 a reaction whose product catalyses its own formation and amplifies a small excess of one mirror image [3][6].",
      "The laureates share 12 million Swedish kronor equally [2][4].",
    ],
    sections: [
      {
        heading: "What is chirality, and why does it matter?",
        paragraphs: [
          "Many molecules come in two forms that are mirror images of each other, like left and right hands. This property is called chirality. The two forms have the same atoms and bonds but can behave very differently in living systems, which is why many medicines are made as a single mirror-image form. Life itself is lopsided: the amino acids in proteins and the sugars in DNA occur almost exclusively in one form, a property called homochirality [3].",
        ],
      },
      {
        heading: "What did Kagan discover?",
        paragraphs: [
          "Chemists had long assumed that the purity of a product made with a chiral catalyst would track the purity of the catalyst in a straight line. In 1986 Kagan and colleagues showed that this is not always true: in some reactions, a catalyst that is only partly pure produces a product that is purer, or less pure, than the simple proportion predicts [3][5]. These non-linear effects showed that chiral molecules interact with each other during a reaction in ways that can amplify an imbalance.",
        ],
      },
      {
        heading: "What did Soai discover?",
        paragraphs: [
          "Soai took the idea a decisive step further. In 1995 he reported an asymmetric autocatalytic reaction: the product is itself the catalyst for making more of the product, so a tiny initial excess of one mirror image grows with each cycle into an overwhelming majority [3][6]. The Nobel committee describes it as the first chemical reaction of its kind [3].",
        ],
      },
      {
        heading: "Why it matters",
        paragraphs: [
          "The Soai reaction is a working chemical model of how a slight, perhaps random, chiral bias on the early Earth could have been amplified into the single-handed chemistry of life. In applied chemistry, non-linear effects are now a standard tool for understanding how chiral catalysts behave, which matters for the efficient manufacture of single-form drugs and fine chemicals.",
        ],
      },
    ],
    faqs: [
      {
        q: "Who won the 2026 Nobel Prize in Chemistry?",
        a: "Henri B. Kagan and Kenso Soai, “for the discovery of non-linear effects and autocatalysis in asymmetric organic synthesis” [1][2].",
      },
      {
        q: "What is asymmetric autocatalysis?",
        a: "A reaction in which a chiral product catalyses its own formation, so a small excess of one mirror-image form is amplified with each cycle [3][6].",
      },
      {
        q: "What is homochirality?",
        a: "The fact that key molecules of life, such as amino acids and sugars, occur in only one of their two mirror-image forms [3].",
      },
    ],
    references: [
      {
        text: "The Royal Swedish Academy of Sciences. (2026, October 7). Press release: The Nobel Prize in Chemistry 2026. NobelPrize.org.",
        url: "https://www.nobelprize.org/prizes/chemistry/2026/press-release/",
      },
      {
        text: "NobelPrize.org. (2026). The Nobel Prize in Chemistry 2026: Summary.",
        url: "https://www.nobelprize.org/prizes/chemistry/2026/summary/",
      },
      {
        text: "NobelPrize.org. (2026). The Nobel Prize in Chemistry 2026: Popular information.",
        url: "https://www.nobelprize.org/prizes/chemistry/2026/popular-information/",
      },
      {
        text: "Al Jazeera. (2026, October 7). Henri Kagan, Kenso Soai win Nobel chemistry prize for ‘mirror image’ work.",
        url: "https://www.aljazeera.com/news/2026/10/7/henri-kagan-kenso-soai-win-chemistry-nobel-for-mirror-image-breakthrough",
      },
      {
        text: "Puchot, C., Samuel, O., Duñach, E., Zhao, S., Agami, C., & Kagan, H. B. (1986). Nonlinear effects in asymmetric synthesis: Examples in asymmetric oxidations and aldolization reactions. Journal of the American Chemical Society, 108(9), 2353–2357.",
        url: "https://doi.org/10.1021/ja00269a036",
      },
      {
        text: "Soai, K., Shibata, T., Morioka, H., & Choji, K. (1995). Asymmetric autocatalysis and amplification of enantiomeric excess of a chiral molecule. Nature, 378(6559), 767–768.",
        url: "https://doi.org/10.1038/378767a0",
      },
    ],
    cover: {
      stat: "1 hand",
      statLabel: "Life builds key molecules in one mirror-image form",
      source: "Nobel Prize in Chemistry 2026",
      hue: 320,
      alt: "Data card: mirror-image molecules, the subject of the 2026 Nobel Prize in Chemistry awarded to Henri B. Kagan and Kenso Soai.",
    },
  },
];
