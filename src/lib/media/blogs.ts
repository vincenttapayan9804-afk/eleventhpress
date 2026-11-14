import type { MediaStory } from "@/lib/media/types";

/**
 * Long-form blog posts for the Media section: evidence reviews written for a
 * general professional audience. Same rules as news.ts: every figure from a
 * cited source, primary sources first, and say what a number measures.
 * Observational findings are described as associations, not causes.
 */

const PUBLISHED = "2026-11-14";

export const MEDIA_BLOGS: MediaStory[] = [
  {
    slug: "generative-ai-productivity-evidence-workplace",
    type: "BLOG",
    title: "Does Generative AI Really Make Us More Productive? What the Best Evidence Shows",
    dek: "Randomised trials and field studies find real gains, largest for less experienced workers, but also a “jagged frontier” where AI makes people worse. A guide to the evidence and what it means for teams.",
    metaDescription:
      "What rigorous studies show about generative AI and productivity: 14% gains in customer support, 40% faster writing, and where AI help backfires. Evidence explained.",
    keywords: [
      "generative AI productivity",
      "AI in the workplace",
      "ChatGPT productivity study",
      "jagged technological frontier",
      "AI adoption business",
      "future of work",
      "AI and skills",
    ],
    category: "Technology",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    lede:
      "Yes, on the right tasks. The strongest studies find that generative AI raised customer-support productivity by 14% on average and by 34% for novices [1], cut the time professionals spent on writing tasks by 40% while raising quality by 18% [2], and helped consultants finish 12.2% more tasks, 25.1% faster [3]. On tasks outside the AI’s capability, the same consultants were 19 percentage points less likely to get the right answer [3].",
    keyPoints: [
      "In a field study of more than 5,000 customer-support agents, an AI assistant raised issues resolved per hour by 14% on average [1].",
      "The gains were largest for novice and lower-skilled agents (34%) and minimal for the most experienced [1].",
      "In a randomised experiment, ChatGPT cut the time college-educated professionals took on writing tasks by 40% and raised rated quality by 18% [2].",
      "Consultants at Boston Consulting Group using GPT-4 completed 12.2% more tasks, 25.1% faster, with more than 40% higher rated quality, on tasks within AI’s capability [3].",
      "On a task deliberately chosen to be outside AI’s capability, consultants using AI were 19 percentage points less likely to produce a correct solution [3].",
      "Researchers call this uneven pattern a “jagged technological frontier”: tasks that look equally hard to humans can fall on opposite sides of AI’s ability [3].",
      "Adoption is broad but shallow: generative AI reached 53% population adoption within three years [4], yet about one in five US firms used AI in production in spring 2026 [5].",
      "Benchmarks overstate everyday reliability; agents still fail roughly one in three attempts on structured tasks [4].",
      "Productivity gains depend on verification: writing-study participants did not fact-check output, so speed gains in real work are smaller [2].",
      "The practical lesson is to map tasks, measure outcomes and keep humans accountable rather than to adopt or ban AI wholesale.",
    ],
    sections: [
      {
        heading: "Why is the evidence on AI productivity so mixed?",
        paragraphs: [
          "Headlines swing between “AI doubles output” and “AI is overhyped” because they often rely on surveys, vendor case studies or benchmark scores. The studies worth paying attention to have a control group: workers who did the same tasks without AI, so differences can be attributed to the tool. Three such studies, published in leading economics and science outlets, form the core of what we know.",
          "Each measures something different (support tickets resolved, writing time and quality, consulting deliverables), and each covers a specific task in a specific setting. Read together, they tell a consistent story about who benefits, on which tasks, and where the risks lie.",
        ],
      },
      {
        heading: "What happened when customer-support agents got an AI assistant?",
        paragraphs: [
          "Erik Brynjolfsson, Danielle Li and Lindsey Raymond studied the staggered rollout of a generative AI conversational assistant to more than 5,000 customer-support agents at a software firm [1]. Because the tool reached different agents at different times, the researchers could compare similar workers with and without it.",
          "Access to the assistant increased the number of issues resolved per hour by 14% on average [1]. The effect was concentrated among novice and lower-skilled workers, whose productivity rose by 34%, while the most experienced and skilled agents saw minimal gains [1]. The authors interpret this as the AI spreading the tacit know-how of top performers to newer staff. They also report improvements in customer sentiment and employee retention [1].",
        ],
      },
      {
        heading: "Does ChatGPT make professional writing faster and better?",
        paragraphs: [
          "Shakked Noy and Whitney Zhang ran a pre-registered online experiment in which 453 college-educated professionals completed occupation-specific writing tasks such as press releases and short reports, with half given access to ChatGPT [2]. Independent evaluators in the same occupations graded the work.",
          "Access to ChatGPT decreased the time taken by 40% and raised output quality by 18% [2]. As in the support study, the tool compressed differences between workers: weaker writers benefited most. The authors caution that participants did not fact-check, so real-world speed gains will be smaller once verification is included [2].",
        ],
      },
      {
        heading: "What is the “jagged technological frontier”?",
        paragraphs: [
          "The most instructive study comes from a randomised experiment with 758 consultants at Boston Consulting Group, run by researchers from Harvard, MIT, Wharton and Warwick [3]. Consultants worked on realistic tasks either with or without GPT-4.",
          "On a set of creative product-development tasks within the AI’s capability, consultants using AI completed 12.2% more tasks, finished 25.1% more quickly and produced work rated more than 40% higher in quality [3]. On a business-analysis task deliberately designed to sit just outside the AI’s capability, where the model gave a confident but wrong answer, consultants using AI were 19 percentage points less likely to reach the correct solution than those working alone [3].",
          "The authors call this a jagged frontier: tasks that look similarly difficult to people can fall on opposite sides of what AI does well [3]. The danger is not that AI fails, but that it fails convincingly, and people who trust it stop checking.",
        ],
      },
      {
        heading: "How widely are businesses actually using AI?",
        paragraphs: [
          "Individual use has spread at record speed: Stanford’s 2026 AI Index reports that generative AI reached 53% population adoption within three years [4]. Firm-level use for producing goods and services is lower. The US Census Bureau’s Business Trends and Outlook Survey found 19.8% of firms using AI in early May 2026, with large firms and the information and finance sectors far ahead of retail [5].",
          "The same AI Index documents capabilities that are impressive but uneven: near-human scores on hard coding benchmarks alongside agents that still fail roughly one in three attempts on structured tasks [4]. That profile is the jagged frontier at industry scale.",
        ],
      },
      {
        heading: "Why do less experienced workers gain the most?",
        paragraphs: [
          "All three studies find that AI narrows the gap between stronger and weaker performers [1][2][3]. In the customer-support study, agents with two months of tenure who had the AI assistant performed about as well as agents with more than six months of tenure who did not [1]. The authors’ explanation is that the assistant had learned from the conversations of the firm’s best agents, so it passed their tacit know-how, such as how to phrase an apology or which troubleshooting step to try first, on to newcomers in real time [1].",
          "This has two implications for organisations. Onboarding can be faster and less stressful, which may be one reason the study found improved retention [1]. But if junior staff lean on AI for exactly the tasks through which people traditionally learned a profession, organisations need to design deliberate practice and mentoring so that expertise still develops.",
        ],
      },
      {
        heading: "What are “centaurs” and “cyborgs”?",
        paragraphs: [
          "Observing how the BCG consultants actually worked, Dell’Acqua and colleagues identified two successful styles [3]. “Centaurs” divided the work, handing specific sub-tasks to the AI and keeping others, such as judgement calls, for themselves. “Cyborgs” wove AI through every step, iterating with it continuously [3]. Both styles can work; what distinguished poor outcomes was uncritical acceptance of output on tasks outside the frontier [3].",
        ],
      },
      {
        heading: "What don’t these studies tell us?",
        paragraphs: [
          "Each study is a snapshot of particular tasks, measured over weeks or months, often with models that have since been superseded. Writing quality was judged by graders rather than by real-world results, and participants in the writing experiment did not fact-check [2]. Gains in a controlled task also do not translate automatically into firm- or economy-wide productivity, which depends on reorganising workflows, retraining staff and managing new risks.",
          "Capability is moving quickly too. Stanford’s AI Index reports that performance on the SWE-bench Verified coding benchmark rose from 60% to near 100% of the human baseline in one year [4]. Organisations should therefore treat any study’s numbers as a floor for what is possible on similar tasks, and as no guarantee of reliability on theirs.",
        ],
      },
      {
        heading: "How should teams use generative AI responsibly?",
        paragraphs: ["The research points to a handful of practical rules for managers and individual professionals:"],
        bullets: [
          "Map tasks, not jobs. Break work into tasks and test AI on each, because performance varies sharply within a single role [3].",
          "Expect the biggest gains for newcomers, and pair AI with mentoring so that novices learn the reasoning, not just the output [1].",
          "Build verification into the workflow. Fact-checking, source checks and peer review are where the time saved is partly spent [2].",
          "Measure outcomes such as resolution rates, error rates and customer satisfaction, not hours saved alone [1].",
          "Keep a named human accountable for every AI-assisted decision, especially in high-stakes or regulated work.",
        ],
        after:
          "Used this way, generative AI behaves less like a replacement for expertise and more like a fast, fallible junior colleague whose work always needs a second look.",
      },
    ],
    faqs: [
      {
        q: "How much does generative AI increase productivity?",
        a: "In rigorous studies, gains range from 14% more customer issues resolved per hour [1] to 40% less time on writing tasks [2] and 12.2% more consulting tasks completed [3]. Results depend heavily on the task.",
      },
      {
        q: "Who benefits most from AI at work?",
        a: "Less experienced and lower-performing workers. In customer support, novices gained 34% while top performers saw little change [1]; weaker writers also gained most in the ChatGPT experiment [2].",
      },
      {
        q: "Can AI make work worse?",
        a: "Yes. On a task outside the AI’s capability, consultants using GPT-4 were 19 percentage points less likely to produce a correct answer [3].",
      },
      {
        q: "What share of businesses use AI?",
        a: "The US Census Bureau found 19.8% of US firms using AI to produce goods or services in early May 2026, with higher rates among large firms [5].",
      },
      {
        q: "What is the jagged technological frontier?",
        a: "A term from the BCG field experiment describing how AI’s abilities are uneven: tasks of similar difficulty for humans may be easy or impossible for AI [3].",
      },
    ],
    references: [
      {
        text: "Brynjolfsson, E., Li, D., & Raymond, L. R. (2023). Generative AI at work (NBER Working Paper No. 31161). National Bureau of Economic Research. Published in The Quarterly Journal of Economics, 140(2), 889–942 (2025).",
        url: "https://www.nber.org/papers/w31161",
      },
      {
        text: "Noy, S., & Zhang, W. (2023). Experimental evidence on the productivity effects of generative artificial intelligence. Science, 381(6654), 187–192.",
        url: "https://doi.org/10.1126/science.adh2586",
      },
      {
        text: "Dell’Acqua, F., McFowland, E., III, Mollick, E. R., Lifshitz-Assaf, H., Kellogg, K., Rajendran, S., Krayer, L., Candelon, F., & Lakhani, K. R. (2023). Navigating the jagged technological frontier: Field experimental evidence of the effects of AI on knowledge worker productivity and quality (Harvard Business School Working Paper No. 24-013).",
        url: "https://mitsloan.mit.edu/sites/default/files/2023-10/SSRN-id4573321.pdf",
      },
      {
        text: "Stanford HAI. (2026). Inside the AI Index: 12 takeaways from the 2026 report.",
        url: "https://hai.stanford.edu/news/inside-the-ai-index-12-takeaways-from-the-2026-report",
      },
      {
        text: "U.S. Census Bureau. (2026, May). Large firms with at least 20 employees biggest AI users.",
        url: "https://www.census.gov/library/stories/2026/05/ai-use-businesses.html",
      },
    ],
    cover: {
      stat: "+14%",
      statLabel: "Support issues resolved per hour with an AI assistant",
      source: "Brynjolfsson, Li & Raymond, NBER / QJE",
      hue: 190,
      alt: "Data card: an AI assistant raised customer-support issues resolved per hour by 14%, from Brynjolfsson, Li and Raymond.",
    },
  },

  {
    slug: "how-many-steps-a-day-exercise-evidence",
    type: "BLOG",
    title: "How Many Steps a Day Do You Really Need? The Science of Exercise, Explained",
    dek: "Ten thousand steps was a marketing number. The latest meta-analyses point to about 7,000, show that intensity and short bursts matter, and explain what WHO guidelines actually ask of you.",
    metaDescription:
      "Do you need 10,000 steps a day? New research says about 7,000 steps cuts death risk by 47% versus 2,000. What the evidence says about steps, exercise and health.",
    keywords: [
      "how many steps a day",
      "7000 steps a day",
      "10000 steps myth",
      "WHO physical activity guidelines",
      "exercise and longevity",
      "daily steps mortality",
      "fitness science",
    ],
    category: "Health & Fitness",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    lede:
      "For most adults, about 7,000 steps a day captures most of the health benefit of walking. A 2025 meta-analysis of 57 studies found that 7,000 steps a day, compared with 2,000, was associated with a 47% lower risk of death from any cause [1]. Benefits continue beyond that but level off, and WHO’s core advice remains 150–300 minutes of moderate activity a week plus strength training [3].",
    keyPoints: [
      "The 10,000-steps target has no special scientific basis; it became popular through marketing rather than research.",
      "A 2025 Lancet Public Health meta-analysis of 57 studies found 7,000 steps a day associated with a 47% lower risk of all-cause death than 2,000 steps [1].",
      "The same analysis linked 7,000 steps with 25% lower cardiovascular disease incidence, 38% lower dementia risk and 22% fewer depressive symptoms [1].",
      "Going from 7,000 to 10,000 steps brings additional but smaller gains, so 10,000 remains a fine goal for people who are already active [1].",
      "A 2022 meta-analysis found mortality benefits plateau at about 6,000–8,000 steps for adults aged 60+ and 8,000–10,000 for younger adults [2].",
      "Even small increases help: rising from about 2,000 to 4,000 steps a day is associated with meaningful health gains [1][6].",
      "WHO recommends 150–300 minutes of moderate or 75–150 minutes of vigorous aerobic activity a week, plus muscle strengthening on two or more days [3].",
      "Short bursts count: about three 1–2-minute bouts of vigorous daily activity were linked with markedly lower mortality among non-exercisers [5].",
      "About 31% of adults, nearly 1.8 billion people, were insufficiently active in 2022 [4].",
      "These are observational associations; they show strong, consistent links, not proof that steps alone cause better health.",
    ],
    sections: [
      {
        heading: "Where did the 10,000-steps goal come from?",
        paragraphs: [
          "The round number is usually traced to a 1960s Japanese pedometer marketed under a name meaning “10,000-step meter”. It was a memorable slogan, not a target derived from health outcomes. Only in the last decade, as wearables made it possible to measure steps in large cohorts, have researchers been able to test which step counts are actually associated with longer, healthier lives.",
        ],
      },
      {
        heading: "What does the latest research say about daily steps?",
        paragraphs: [
          "The most comprehensive answer comes from a systematic review and dose-response meta-analysis led by Melody Ding of the University of Sydney, published in The Lancet Public Health in 2025 [1]. It pooled 57 studies that measured steps with devices and followed people over time for outcomes including death, cardiovascular disease, cancer, diabetes, dementia, depression and falls [1].",
          "Compared with 2,000 steps a day, 7,000 steps was associated with a 47% lower risk of death from any cause, a 25% lower incidence of cardiovascular disease, a 38% lower risk of dementia and a 22% reduction in depressive symptoms [1][6]. The authors concluded that 7,000 steps a day is associated with clinically meaningful improvements and is a realistic target, while 10,000 remains worthwhile for those who are more active [1].",
          "An earlier meta-analysis of 15 cohorts by Amanda Paluch and the Steps for Health Collaborative reached a similar shape of curve: risk of death fell progressively with more steps and then levelled off, at about 6,000–8,000 steps a day for adults aged 60 and over and 8,000–10,000 for younger adults [2].",
        ],
      },
      {
        heading: "Do more steps always mean better health?",
        paragraphs: [
          "More is generally better, but with diminishing returns. In the 2025 analysis, the additional reduction in mortality risk between 7,000 and 10,000 steps was much smaller than the reduction between 2,000 and 7,000 [1][6]. For people who currently move very little, the message is encouraging: the steepest part of the curve is at the bottom, and even 2,000 extra steps a day is associated with meaningful benefit [1][6].",
          "Two caveats matter. First, these are observational studies; healthier people may walk more, and statistical adjustment cannot remove every confounder. Second, the evidence is stronger for some outcomes, such as all-cause mortality, than others, such as dementia, where fewer studies were available [1].",
        ],
      },
      {
        heading: "What do WHO physical-activity guidelines recommend?",
        paragraphs: [
          "WHO’s 2020 guidelines do not set a step count. For adults they recommend 150–300 minutes of moderate-intensity aerobic activity a week, or 75–150 minutes of vigorous activity, or an equivalent mix, plus muscle-strengthening activities involving all major muscle groups on two or more days a week [3]. Older adults are also advised to include balance training to prevent falls [3]. Crucially, the guidelines state that some physical activity is better than none [3].",
          "Most people are not there yet. WHO-led estimates found that 31% of adults worldwide, nearly 1.8 billion people, did not meet the guidelines in 2022 [4].",
        ],
      },
      {
        heading: "Does intensity matter as much as volume?",
        paragraphs: [
          "Yes. Brisk walking counts as moderate activity, and short vigorous efforts appear to punch above their weight. A Nature Medicine study of more than 25,000 UK Biobank participants who did no leisure-time exercise found that around three short bouts of vigorous intermittent lifestyle physical activity a day, each lasting one to two minutes (climbing stairs quickly, carrying heavy shopping, a fast walk to the bus), were associated with substantially lower all-cause, cancer and cardiovascular mortality [5].",
        ],
      },
      {
        heading: "Why does strength training matter as well as walking?",
        paragraphs: [
          "Walking mainly trains the heart and lungs. Muscle-strengthening activity protects muscle mass, bone density and the ability to live independently in later life, which is why WHO recommends it on at least two days a week for all adults [3]. A meta-analysis by Haruki Momma and colleagues found that 30–60 minutes a week of muscle-strengthening activity was associated with a 10–20% lower risk of death from any cause, cardiovascular disease and cancer, independent of aerobic activity [7].",
        ],
      },
      {
        heading: "How strong is the evidence that steps cause better health?",
        paragraphs: [
          "Step studies are prospective cohorts: researchers measure steps once, then follow participants for years. That design rules out some biases but not all. People who are already unwell walk less, so part of the association can run backwards; this is why good studies exclude early deaths and adjust for existing illness [1][2]. Published correspondence on the 2025 meta-analysis also notes that a single baseline measurement can blur the true relationship, and that adjusting for factors such as body weight or diabetes, which lie on the causal pathway, can distort estimates [8].",
          "Despite these caveats, the picture is consistent across countries, devices and outcomes, and it matches evidence from trials showing that exercise improves blood pressure, blood sugar control and fitness. The safest reading is that more daily movement very likely improves health, and that the precise percentages should be treated as estimates rather than guarantees.",
        ],
      },
      {
        heading: "Why are so many people still inactive?",
        paragraphs: [
          "Knowing the benefits has not been enough. Papers published in Nature Health and Nature Medicine in 2026 found that global levels of physical activity have not improved over two decades, despite more countries adopting physical-activity policies [9]. Barriers include long working hours, car-dependent neighbourhoods, unsafe streets and the cost of facilities, which is why public-health researchers increasingly focus on environments as well as individual willpower [9].",
        ],
      },
      {
        heading: "How can you build more activity into a busy day?",
        paragraphs: ["The evidence supports simple, cumulative changes rather than an all-or-nothing programme:"],
        bullets: [
          "Find your baseline with a phone or wearable for a week, then add 1,000 steps a day each week until you reach about 7,000 [1].",
          "Make some of those steps brisk; a pace that makes conversation slightly harder counts as moderate activity [3].",
          "Add two short strength sessions a week, using body weight, bands or weights [3].",
          "Use stairs and fast short walks as deliberate vigorous bursts [5].",
          "Break up long periods of sitting, which WHO also advises limiting [3].",
        ],
        after:
          "If you have a heart condition, are pregnant or have been inactive for a long time, talk to a health professional before sharply increasing intensity.",
      },
    ],
    faqs: [
      {
        q: "Is 7,000 steps a day enough?",
        a: "For most adults it captures most of the benefit. A 2025 meta-analysis linked 7,000 steps with a 47% lower risk of death than 2,000 steps; going higher adds smaller extra benefits [1].",
      },
      {
        q: "Is the 10,000-steps rule a myth?",
        a: "It isn’t harmful, but it isn’t a threshold either. Benefits start well below 10,000 and level off at roughly 6,000–8,000 steps for older adults and 8,000–10,000 for younger adults [2].",
      },
      {
        q: "How many minutes of exercise does WHO recommend?",
        a: "150–300 minutes of moderate or 75–150 minutes of vigorous aerobic activity a week, plus muscle strengthening on two or more days [3].",
      },
      {
        q: "Do short bursts of exercise count?",
        a: "Yes. Short vigorous bouts of 1–2 minutes, done about three times a day, were associated with lower mortality among people who didn’t otherwise exercise [5].",
      },
      {
        q: "Does walking help mental health?",
        a: "The 2025 meta-analysis associated 7,000 steps a day with a 22% reduction in depressive symptoms compared with 2,000 steps [1].",
      },
    ],
    references: [
      {
        text: "Ding, D., Nguyen, B., Nau, T., et al. (2025). Daily steps and health outcomes in adults: A systematic review and dose-response meta-analysis. The Lancet Public Health, 10(8), e668–e681.",
        url: "https://doi.org/10.1016/S2468-2667(25)00164-1",
      },
      {
        text: "Paluch, A. E., Bajpai, S., Bassett, D. R., et al. (2022). Daily steps and all-cause mortality: A meta-analysis of 15 international cohorts. The Lancet Public Health, 7(3), e219–e228.",
        url: "https://doi.org/10.1016/S2468-2667(21)00302-9",
      },
      {
        text: "Bull, F. C., Al-Ansari, S. S., Biddle, S., et al. (2020). World Health Organization 2020 guidelines on physical activity and sedentary behaviour. British Journal of Sports Medicine, 54(24), 1451–1462.",
        url: "https://doi.org/10.1136/bjsports-2020-102955",
      },
      {
        text: "World Health Organization. (2024, June 26). Nearly 1.8 billion adults at risk of disease from not doing enough physical activity [News release].",
        url: "https://www.who.int/news/item/26-06-2024-nearly-1.8-billion-adults-at-risk-of-disease-from-not-doing-enough-physical-activity",
      },
      {
        text: "Stamatakis, E., Ahmadi, M. N., Gill, J. M. R., et al. (2022). Association of wearable device-measured vigorous intermittent lifestyle physical activity with mortality. Nature Medicine, 28(12), 2521–2529.",
        url: "https://doi.org/10.1038/s41591-022-02100-x",
      },
      {
        text: "The University of Sydney. (2025, July 24). Rethink the 10,000-a-day step goal, study suggests [News release].",
        url: "https://www.sydney.edu.au/news-opinion/news/2025/07/24/rethink-the-10000-a-day-step-goal-study-suggests.html",
      },
      {
        text: "Momma, H., Kawakami, R., Honda, T., & Sawada, S. S. (2022). Muscle-strengthening activities are associated with lower risk and mortality in major non-communicable diseases: A systematic review and meta-analysis of cohort studies. British Journal of Sports Medicine, 56(13), 755–763.",
        url: "https://doi.org/10.1136/bjsports-2021-105061",
      },
      {
        text: "Reflections on daily steps and health outcomes [Correspondence]. (2025). The Lancet Public Health.",
        url: "https://www.thelancet.com/journals/lanpub/article/PIIS2468-2667(25)00246-4/fulltext",
      },
      {
        text: "Springer Nature. (2026, March). Health: Global physical activity levels have not improved over 20 years (Nature Medicine, Nature Health) [Press release]. Nature Asia.",
        url: "https://www.natureasia.com/en/info/press-releases/detail/9261",
      },
    ],
    cover: {
      stat: "7,000",
      statLabel: "Daily steps linked to 47% lower risk of death vs 2,000",
      source: "Ding et al., The Lancet Public Health, 2025",
      hue: 130,
      alt: "Data card: 7,000 daily steps linked to a 47% lower risk of death than 2,000 steps, from Ding et al. in The Lancet Public Health, 2025.",
    },
  },

  {
    slug: "science-of-learning-retrieval-practice-spaced-repetition",
    type: "BLOG",
    title: "The Science of Learning: Why Retrieval Practice and Spacing Beat Rereading",
    dek: "Decades of cognitive psychology show that the study habits students like most, rereading and highlighting, work least. Here is what works, why, and how teachers and learners can use it.",
    metaDescription:
      "Evidence-based study techniques: retrieval practice and spaced repetition beat rereading and highlighting. What cognitive psychology says and how to apply it.",
    keywords: [
      "retrieval practice",
      "spaced repetition",
      "testing effect",
      "effective study techniques",
      "learning science",
      "educational psychology",
      "how to study",
    ],
    category: "Education & Psychology",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    lede:
      "The two most effective study techniques are practice testing (retrieval practice) and distributed practice (spacing study over time); a landmark review of ten common techniques rated only these two as “high utility”, while rereading, highlighting and summarising rated low [1]. In one classic experiment, students who repeatedly tested themselves recalled 61% of a passage a week later, against 40% for students who repeatedly reread it [2].",
    keyPoints: [
      "A 2013 review of ten learning techniques rated only practice testing and distributed practice as high utility [1].",
      "Highlighting, rereading and summarising, the techniques students use most, were rated low utility [1].",
      "In a classic experiment, repeated self-testing produced 61% recall after one week versus 40% for repeated studying [2].",
      "Students who reread felt more confident, even though they remembered less: fluency is not the same as learning [2].",
      "Retrieval practice outperformed elaborative concept mapping for learning science texts [4].",
      "A meta-analysis of 272 effect sizes found practice tests more beneficial for learning than restudying and other comparison conditions [5].",
      "Spacing study sessions apart improves long-term retention compared with massing them together, across hundreds of experiments [3].",
      "The best gap between sessions grows with how long you need to remember the material [3].",
      "Interleaving, elaborative interrogation and self-explanation have moderate evidence and are useful complements [1].",
      "These techniques help motivated learners who use them; they are not a substitute for good teaching or sufficient time [1].",
    ],
    sections: [
      {
        heading: "Why do popular study habits fail?",
        paragraphs: [
          "Rereading and highlighting feel productive. The material looks familiar the second time, and familiarity is easily mistaken for mastery. Cognitive psychologists call this an illusion of fluency. The trouble is that exams, jobs and life ask us to recall and use knowledge, not to recognise it on a page.",
          "In 2013 John Dunlosky and colleagues reviewed hundreds of studies on ten techniques that students commonly use, judging each on how well it works across learners, materials and tasks [1]. Highlighting and underlining, rereading and summarisation were rated low utility. Only two techniques earned a high-utility rating: practice testing and distributed practice [1][6].",
        ],
      },
      {
        heading: "What is retrieval practice?",
        paragraphs: [
          "Retrieval practice means pulling information out of memory rather than putting it back in: answering questions, using flashcards, writing down everything you remember about a topic, or explaining it without notes. Each act of recall strengthens the memory and makes it easier to retrieve again, a finding known as the testing effect.",
          "Henry Roediger and Jeffrey Karpicke demonstrated the effect vividly in 2006 [2]. Students studied prose passages under different schedules. After one week, those who had studied once and then tested themselves three times recalled 61% of the material, while those who had studied four times recalled 40% [2]. Strikingly, the rereaders predicted they would remember more [2].",
          "The advantage holds against richer strategies too. Karpicke and Blunt found that students who practised retrieval learned science texts better than students who built detailed concept maps, even on tests that asked them to draw concept maps [4]. A 2017 meta-analysis by Adesope, Trevisan and Sundararajan, covering 272 independent effect sizes, concluded that practice tests are more beneficial for learning than restudying and all other comparison conditions [5].",
        ],
      },
      {
        heading: "How does spaced repetition work?",
        paragraphs: [
          "Distributed or spaced practice means spreading study over several sessions rather than cramming it into one. A meta-analysis by Nicholas Cepeda and colleagues, drawing on hundreds of experiments, confirmed that spacing improves long-term retention compared with massed study [3]. It also found that the optimal gap between sessions depends on how long you need to remember: material needed for a test next week benefits from shorter gaps than material you want to retain for a year [3].",
          "Spacing works partly because it forces effortful retrieval. When some forgetting has happened, recalling the material takes more work, and that work is what makes the memory durable. This is why spaced retrieval, testing yourself at increasing intervals, combines the two most powerful techniques.",
        ],
      },
      {
        heading: "Which other techniques have good evidence?",
        paragraphs: [
          "Dunlosky’s review rated three further techniques as moderate utility: interleaved practice (mixing different types of problems in one session), elaborative interrogation (asking “why is this true?”) and self-explanation (explaining how new information relates to what you know) [1]. They are worth adding once testing and spacing are in place.",
        ],
      },
      {
        heading: "Does retrieval practice work in real classrooms?",
        paragraphs: [
          "Laboratory findings do not always survive the messiness of real schools, so researchers have tested retrieval practice in classrooms directly. A systematic review of applied research by Pooja Agarwal and colleagues found that retrieval practice consistently benefited student learning in schools and classrooms, across grade levels, subjects and types of test [7].",
          "It also need not raise stress. In a survey of middle- and high-school students who used frequent low-stakes quizzes, 72% reported that retrieval practice made them less nervous about unit tests and exams [8]. Framed as practice rather than judgement, quizzing builds both memory and confidence.",
        ],
      },
      {
        heading: "Why does effortful study feel worse but work better?",
        paragraphs: [
          "Learners consistently misjudge which strategies help them. In Roediger and Karpicke’s study, students who reread predicted better recall than students who tested themselves, the opposite of what happened a week later [2]. Rereading produces a sense of fluency in the moment; retrieval produces struggle and visible gaps. Because people tend to choose strategies that feel productive, effective techniques need to be built into routines, timetables and course design rather than left to preference.",
        ],
      },
      {
        heading: "Can apps and AI tools help?",
        paragraphs: [
          "Spaced-repetition flashcard software automates the scheduling that Cepeda’s meta-analysis supports, showing each item again just as it is about to be forgotten [3]. Generative AI can quickly produce practice questions from course notes. The principle to protect is that the learner must try to answer before seeing the answer: reading AI-written summaries or explanations is a form of rereading, while being quizzed by an AI tutor is a form of retrieval practice [1][2].",
        ],
      },
      {
        heading: "What does an evidence-based revision plan look like?",
        paragraphs: [
          "Suppose a student has four weeks before an exam. A plan built on the evidence would look like this: in week one, learn each topic and finish every study session by closing the notes and writing down what can be recalled [2][4]. From week two, begin each session with a short self-quiz on earlier topics before moving on, so that old material is retrieved at growing intervals [3]. Problem sets mix question types from different chapters rather than practising one type at a time [1]. In the final week, full practice papers under exam conditions replace rereading altogether [1][5].",
          "The total study time need not increase. What changes is how the time is used: less time looking at material, more time trying to produce it from memory, spread across more days [1][3].",
        ],
      },
      {
        heading: "How can teachers and learners apply the evidence?",
        paragraphs: ["The techniques are simple, cheap and work across subjects. Practical ways to use them:"],
        bullets: [
          "Start lessons with low-stakes quizzes on material from previous weeks, combining retrieval with spacing [1][2].",
          "Replace rereading with the blank-page method: close the book and write or sketch everything you can recall, then check the gaps [2][4].",
          "Use flashcards and keep reviewing the cards you know, at growing intervals, rather than dropping them [3].",
          "Plan study across days and weeks; the longer you need the knowledge, the longer the gaps can be [3].",
          "Give feedback on practice questions, which supports correction of errors [5].",
          "Mix problem types in homework so students practise choosing a method, not just applying one [1].",
        ],
        after:
          "Expect the techniques to feel harder than rereading. That difficulty is a feature: it is the effort of retrieval that builds lasting memory.",
      },
    ],
    faqs: [
      {
        q: "What is the most effective way to study?",
        a: "Practice testing (retrieval practice) and distributed practice (spacing) are the two techniques rated high utility in a major review of learning research [1].",
      },
      {
        q: "Is rereading notes a good way to study?",
        a: "Not on its own. Rereading was rated low utility [1], and in a classic experiment repeated rereading produced 40% recall after a week versus 61% for repeated self-testing [2].",
      },
      {
        q: "What is the testing effect?",
        a: "The finding that retrieving information from memory strengthens learning more than restudying it [2][5].",
      },
      {
        q: "How far apart should study sessions be?",
        a: "It depends on how long you need to remember the material; longer retention benefits from longer gaps between sessions [3].",
      },
      {
        q: "Does highlighting help learning?",
        a: "The evidence is weak; highlighting and underlining were rated low utility [1].",
      },
    ],
    references: [
      {
        text: "Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). Improving students’ learning with effective learning techniques: Promising directions from cognitive and educational psychology. Psychological Science in the Public Interest, 14(1), 4–58.",
        url: "https://doi.org/10.1177/1529100612453266",
      },
      {
        text: "Roediger, H. L., III, & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. Psychological Science, 17(3), 249–255.",
        url: "https://doi.org/10.1111/j.1467-9280.2006.01693.x",
      },
      {
        text: "Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. Psychological Bulletin, 132(3), 354–380.",
        url: "https://doi.org/10.1037/0033-2909.132.3.354",
      },
      {
        text: "Karpicke, J. D., & Blunt, J. R. (2011). Retrieval practice produces more learning than elaborative studying with concept mapping. Science, 331(6018), 772–775.",
        url: "https://doi.org/10.1126/science.1199327",
      },
      {
        text: "Adesope, O. O., Trevisan, D. A., & Sundararajan, N. (2017). Rethinking the use of tests: A meta-analysis of practice testing. Review of Educational Research, 87(3), 659–701.",
        url: "https://doi.org/10.3102/0034654316689306",
      },
      {
        text: "Association for Psychological Science. (2013). Which study strategies make the grade? [News release].",
        url: "https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html",
      },
      {
        text: "Agarwal, P. K., Nunes, L. D., & Blunt, J. R. (2021). Retrieval practice consistently benefits student learning: A systematic review of applied research in schools and classrooms. Educational Psychology Review, 33(4), 1409–1453.",
        url: "https://doi.org/10.1007/s10648-021-09595-9",
      },
      {
        text: "Agarwal, P. K., D’Antonio, L., Roediger, H. L., III, McDermott, K. B., & McDaniel, M. A. (2014). Classroom-based programs of retrieval practice reduce middle school and high school students’ test anxiety. Journal of Applied Research in Memory and Cognition, 3(3), 131–139.",
        url: "https://doi.org/10.1016/j.jarmac.2014.07.002",
      },
    ],
    cover: {
      stat: "61% vs 40%",
      statLabel: "Recall after a week: self-testing vs rereading",
      source: "Roediger & Karpicke, Psychological Science, 2006",
      hue: 265,
      alt: "Data card: 61% recall after one week with self-testing versus 40% with rereading, from Roediger and Karpicke, 2006.",
    },
  },

  {
    slug: "research-integrity-paper-mills-retractions",
    type: "BLOG",
    title: "Research Integrity in the Paper-Mill Era: What Record Retractions Mean for Science",
    dek: "More than 10,000 papers were retracted in 2023, and organised fraud is growing faster than legitimate science. How we got here, how the scholarly record is fighting back, and what authors and readers can do.",
    metaDescription:
      "Over 10,000 papers were retracted in 2023 and paper-mill output is outpacing real science. What drives research fraud and how authors and readers can protect themselves.",
    keywords: [
      "research integrity",
      "paper mills",
      "retractions",
      "scientific fraud",
      "Retraction Watch",
      "peer review",
      "publication ethics",
    ],
    category: "Research",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    lede:
      "Retractions reached a record in 2023, when more than 10,000 research papers were withdrawn, over 8,000 of them from journals owned by Hindawi [1]. A 2025 PNAS study found that the networks producing fraudulent papers at scale are large, resilient and growing faster than legitimate science [3]. Most retractions are caused by misconduct rather than honest error [2].",
    keyPoints: [
      "More than 10,000 research papers were retracted in 2023, a record [1].",
      "Over 8,000 of those retractions came from journals owned by Hindawi, then part of Wiley [1].",
      "A classic analysis of 2,047 retracted biomedical papers found 67.4% were retracted for misconduct and 21.3% for error [2].",
      "Fraud or suspected fraud accounted for 43.4% of those retractions, duplicate publication 14.2% and plagiarism 9.8% [2].",
      "A 2025 PNAS study assembled a corpus of 32,786 suspected paper-mill papers [3].",
      "The authors found fraudulent output growing faster than legitimate science, with brokers able to place articles on demand [3].",
      "Paper mills adapt quickly: new outlets appear as soon as compromised journals are deindexed [3].",
      "Publishers, COPE and STM have issued shared guidance on recognising and handling paper-mill manuscripts [4].",
      "The Retraction Watch database, now openly available through Crossref, lets anyone check whether a paper has been retracted [5].",
      "Authors and readers can protect the record with simple checks before citing, submitting or relying on a paper.",
    ],
    sections: [
      {
        heading: "How many scientific papers are retracted?",
        paragraphs: [
          "Retractions remain a small share of the literature, but the trend is steep. A Nature analysis by Richard Van Noorden reported that the number of retractions issued for research articles passed 10,000 in 2023, a new record [1]. The single largest contributor was Hindawi, which retracted more than 8,000 articles that year after discovering compromised special issues and peer review [1]. Experts quoted by Nature warned that the true scale of problematic papers is likely larger [1].",
        ],
      },
      {
        heading: "Are retractions caused by fraud or honest error?",
        paragraphs: [
          "Mostly misconduct. In a landmark 2012 study, Ferric Fang, R. Grant Steen and Arturo Casadevall reviewed all 2,047 biomedical and life-science articles indexed as retracted in PubMed and checked the reasons behind vague retraction notices [2]. They found that 67.4% were attributable to misconduct (fraud or suspected fraud, 43.4%; duplicate publication, 14.2%; plagiarism, 9.8%) and only 21.3% to error [2]. Uninformative notices had previously hidden much of the fraud [2].",
        ],
      },
      {
        heading: "What are paper mills?",
        paragraphs: [
          "Paper mills are businesses that sell authorship on fabricated or plagiarised manuscripts, sometimes alongside manipulated images, fake data and arranged peer review. A joint report from COPE and the STM publishers’ association described the problem and set out how editors can recognise telltale patterns [4].",
          "A 2025 study in PNAS by Reese Richardson, Luís Amaral and colleagues examined how these operations work at scale [3]. The team compiled a corpus of 32,786 suspected paper-mill products and identified broker organisations able to place articles in journals on demand, as well as networks of editors who channelled submissions to one another [3]. The authors conclude that the enterprise is evading interventions and that fraudulent publications are growing faster than legitimate science; when compromised journals are deindexed, new outlets appear in their place [3].",
        ],
      },
      {
        heading: "Why does a corrupted record matter beyond academia?",
        paragraphs: [
          "Science builds on itself. Fabricated findings get cited, pooled into meta-analyses and used to justify new experiments, clinical trials and policies. Each fraudulent paper consumes reviewer time and funding and erodes trust in the honest work around it. Retracted papers can also keep being cited for years after withdrawal, especially when the retraction is not clearly flagged.",
        ],
      },
      {
        heading: "Is generative AI making research fraud worse?",
        paragraphs: [
          "It lowers the cost of producing plausible text and images, which is exactly what paper mills sell. Detection has had to evolve. Guillaume Cabanac, Cyril Labbé and Alexander Magazinov documented “tortured phrases”, such as “counterfeit consciousness” in place of “artificial intelligence”, produced when text is run through paraphrasing tools to disguise plagiarism, and used them to flag hundreds of problematic papers [6]. Similar fingerprinting now runs at scale in screening tools used by publishers and volunteer sleuths.",
        ],
      },
      {
        heading: "How should a retraction be handled?",
        paragraphs: [
          "A retraction is not a punishment; it is a correction of the record. COPE’s retraction guidelines say that journals should retract publications whose findings are unreliable, whether through misconduct or honest error, and that retraction notices should be linked to the original article, freely available and clear about who is retracting it and why [7]. Fang and colleagues showed what happens when notices are vague: fraud gets misclassified as error, and the scale of misconduct is underestimated [2].",
        ],
      },
      {
        heading: "Why do incentives matter?",
        paragraphs: [
          "Paper mills exist because there is demand. When hiring, promotion or graduation depend on publication counts or journal prestige, some researchers will buy what they cannot produce. The San Francisco Declaration on Research Assessment (DORA) urges institutions and funders to assess research on its own merits rather than on journal-based metrics such as impact factors [8]. Reforming assessment reduces the market that fraud serves.",
        ],
      },
      {
        heading: "How is the scholarly community responding?",
        paragraphs: [
          "Responses are improving on several fronts. Publishers increasingly screen for paper-mill signals such as tortured phrases, image duplication and suspicious author or reviewer behaviour, using shared guidance from COPE and STM [4]. In 2023 Crossref acquired the Retraction Watch database and made it openly available, so reference managers, publishers and indexing services can flag retracted work automatically [5]. Funders and institutions are also rethinking incentives that reward publication counts over quality.",
        ],
      },
      {
        heading: "What should you do if you spot a problem in a published paper?",
        paragraphs: [
          "Start by checking whether the issue is already known: search the Retraction Watch data through Crossref and look for comments on the paper [5]. If the concern is a possible honest error, contacting the corresponding author is often the fastest route to a correction. If it suggests misconduct, such as duplicated images, impossible statistics or text recycled from another source, write to the journal’s editor with specific, verifiable evidence and keep the tone factual.",
          "Journals that follow COPE guidance should acknowledge the concern, investigate, and, where warranted, publish a correction, an expression of concern or a retraction with a clear explanation [7]. If a journal does not respond, the authors’ institution and research-integrity offices are the next step. Responsible post-publication scrutiny strengthens the record rather than undermining it.",
        ],
      },
      {
        heading: "How can authors and readers protect themselves?",
        paragraphs: ["A few habits make a real difference:"],
        bullets: [
          "Check every source you cite against the Retraction Watch data, now open through Crossref, and use reference managers that flag retractions [5].",
          "Treat unsolicited offers of authorship, guaranteed acceptance or fast special-issue publication as red flags [4].",
          "Look for transparent peer review, clear editorial boards and genuine indexing before submitting to a journal.",
          "Share data, code and protocols; openness makes fabrication harder and honest work easier to verify.",
          "Report concerns to journals and institutions through their formal channels, following COPE guidance [4].",
        ],
        after:
          "Integrity is a shared responsibility. Publishers must invest in screening and transparent correction, but every author, reviewer and reader who checks before citing helps keep the record trustworthy.",
      },
    ],
    faqs: [
      {
        q: "How many papers were retracted in 2023?",
        a: "More than 10,000 research papers were retracted in 2023, a record, according to a Nature analysis [1].",
      },
      {
        q: "What is a paper mill in science?",
        a: "A business that produces and sells fabricated or plagiarised manuscripts and authorship slots, often with manipulated peer review [3][4].",
      },
      {
        q: "What causes most retractions?",
        a: "Misconduct. A study of 2,047 retracted biomedical papers attributed 67.4% to misconduct and 21.3% to error [2].",
      },
      {
        q: "How can I check if a paper has been retracted?",
        a: "Search the Retraction Watch database, which Crossref made openly available after acquiring it in 2023, or use a reference manager that flags retractions [5].",
      },
      {
        q: "Is scientific fraud increasing?",
        a: "A 2025 PNAS study found organised fraud growing faster than legitimate scientific output [3].",
      },
    ],
    references: [
      {
        text: "Van Noorden, R. (2023). More than 10,000 research papers were retracted in 2023 — a new record. Nature, 624(7992), 479–481.",
        url: "https://doi.org/10.1038/d41586-023-03974-8",
      },
      {
        text: "Fang, F. C., Steen, R. G., & Casadevall, A. (2012). Misconduct accounts for the majority of retracted scientific publications. Proceedings of the National Academy of Sciences, 109(42), 17028–17033.",
        url: "https://doi.org/10.1073/pnas.1212247109",
      },
      {
        text: "Richardson, R. A. K., Hong, S. S., Byrne, J. A., Stoeger, T., & Amaral, L. A. N. (2025). The entities enabling scientific fraud at scale are large, resilient, and growing rapidly. Proceedings of the National Academy of Sciences, 122(32), e2420092122.",
        url: "https://doi.org/10.1073/pnas.2420092122",
      },
      {
        text: "COPE & STM. (2022). Paper mills: Research report from COPE & STM. Committee on Publication Ethics.",
        url: "https://doi.org/10.24318/jtbG8IHL",
      },
      {
        text: "Crossref. (2023, September 12). Crossref acquires Retraction Watch data and opens it for the scientific community [Blog post].",
        url: "https://www.crossref.org/blog/news-crossref-and-retraction-watch/",
      },
      {
        text: "Cabanac, G., Labbé, C., & Magazinov, A. (2021). Tortured phrases: A dubious writing style emerging in science. Evidence of critical issues affecting established journals. arXiv:2107.06751.",
        url: "https://arxiv.org/abs/2107.06751",
      },
      {
        text: "COPE Council. (2019). Retraction guidelines. Committee on Publication Ethics.",
        url: "https://doi.org/10.24318/cope.2019.1.4",
      },
      {
        text: "San Francisco Declaration on Research Assessment. (2012). DORA declaration.",
        url: "https://sfdora.org/read/",
      },
    ],
    cover: {
      stat: "10,000+",
      statLabel: "Research papers retracted in 2023, a record",
      source: "Van Noorden, Nature, 2023",
      hue: 0,
      alt: "Data card: more than 10,000 research papers were retracted in 2023, a record, from Nature.",
    },
  },

  {
    slug: "why-new-businesses-fail-startup-survival-data",
    type: "BLOG",
    title: "Why Do New Businesses Fail? What Survival Data Teaches Founders in 2026",
    dek: "About half of new US businesses are still operating after five years. Government data and the Global Entrepreneurship Monitor show when firms fail, why, and the habits that improve the odds.",
    metaDescription:
      "How many startups survive? BLS data show about half of new US businesses last five years. Why new firms fail and what founders can do to beat the odds in 2026.",
    keywords: [
      "business survival rate",
      "why startups fail",
      "small business statistics",
      "startup failure rate",
      "entrepreneurship 2026",
      "founder advice",
      "business planning",
    ],
    category: "Business & Entrepreneurship",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    lede:
      "About half of new businesses fail within five years. US Bureau of Labor Statistics data show five-year survival rates for new establishments ranging from 49.8% for the 2006 cohort to 57.3% for the 2018 cohort, with firms born into recessions faring worst [1]. Globally, the Global Entrepreneurship Monitor reports record startup activity but a widening gap between starting a business and sustaining it [3].",
    keyPoints: [
      "Roughly half of new US establishments survive five years: 57.3% of the 2018 cohort and 49.8% of the 2006 cohort [1].",
      "Startups whose early years coincide with a recession have lower five-year survival rates [1].",
      "First-year survival was lowest for establishments born in the recession years 2001 and 2008 [2].",
      "GEM finds early-stage entrepreneurship at record highs but too few ventures maturing into established firms, which it calls the “Survival Gap” [3].",
      "Entrepreneurial finance is rated insufficient in 36 of the 53 economies GEM studied [3].",
      "Fear of failure deters about two in five adults from starting a business [3].",
      "Only about one in five US firms used AI to produce goods or services in spring 2026, with large firms far ahead [4].",
      "Management quality matters: Gallup links falling manager engagement to lower productivity [5].",
      "Survival improves when founders validate demand early, manage cash closely and build management skills before scaling.",
      "Failure is common and not final; GEM finds people who have exited a business are more likely to start again [3].",
    ],
    sections: [
      {
        heading: "How many new businesses survive?",
        paragraphs: [
          "The best long-run evidence comes from the US Bureau of Labor Statistics’ Business Employment Dynamics programme, which follows every new establishment from its first year. Five-year survival rates for startups have ranged from 49.8% for establishments born in 2006 to 57.3% for those born in 2018 [1]. Put simply, about half of new businesses are still operating after five years.",
          "Timing matters. BLS notes that startups that experience a recession during their early growth generally have lower five-year survival rates than those born during recoveries [1]. One-year survival rates were lowest for establishments born in 2001 and 2008, both recession years [2].",
        ],
      },
      {
        heading: "Is the startup survival problem global?",
        paragraphs: [
          "Yes. The Global Entrepreneurship Monitor’s 2025/2026 Global Report, covering 53 economies, finds Total early-stage Entrepreneurial Activity at record highs in many places, while the progression to established businesses older than 3.5 years is stalling [3]. GEM calls this the “Survival Gap” [3].",
          "The conditions around founders help explain it. GEM’s national experts rated the provision of and access to entrepreneurial finance as insufficient in 36 of 53 economies, and entrepreneurship education at school was the lowest-rated condition in 33 [3].",
        ],
      },
      {
        heading: "Why do new businesses fail?",
        paragraphs: [
          "Government statistics record when firms close, not why. Combining survival data with research on founders and firms, the most common causes fall into a few groups:",
        ],
        bullets: [
          "No real market need: products built around an idea rather than a validated customer problem.",
          "Cash-flow failure: running out of money before revenue arrives, often made worse by limited access to finance [3].",
          "Bad timing: launching into a downturn, when demand and credit both tighten [1][2].",
          "Weak management: unclear roles, poor hiring and founders stretched across every function [5].",
          "Failure to adapt: slow adoption of tools and practices that competitors use to cut costs or reach customers [4].",
        ],
      },
      {
        heading: "Does adopting AI help small businesses survive?",
        paragraphs: [
          "It may help, but most small firms aren’t there yet. The US Census Bureau’s Business Trends and Outlook Survey found 19.8% of firms using AI in early May 2026, rising to 32% of firms with 100–249 employees and 37% of firms with 250 or more [4]. GEM warns of a possible two-tier entrepreneurial economy: in 19 of 48 economies, fewer than one in three new entrepreneurs expect AI to become very important to their business soon [3].",
          "The practical point is not to adopt AI for its own sake, but to look for specific tasks, such as customer service, bookkeeping or marketing copy, where it can free scarce founder time, while checking its output carefully.",
        ],
      },
      {
        heading: "Why does management quality matter so much?",
        paragraphs: [
          "As a business grows past its founders, the quality of management starts to decide its fate. Gallup’s 2026 State of the Global Workplace report found global employee engagement at 20%, with a five-point fall in manager engagement driving the decline and an estimated $10 trillion in lost productivity worldwide [5]. Small firms rarely have formal management training, so the first managers they hire or promote carry outsized weight.",
        ],
      },
      {
        heading: "Is the first year the most dangerous?",
        paragraphs: [
          "Proportionally, yes. An analysis of US Census Business Dynamics Statistics estimated that roughly 77–84% of newborn establishments survived their first year, and only 42–50% survived their first five years [6]. Exit risk is highest early and falls as firms age, so the first two to three years deserve the most careful planning for cash, customers and contingencies.",
        ],
      },
      {
        heading: "How should founders handle the fear of failure?",
        paragraphs: [
          "Fear of failure deters roughly two in five adults from starting a business [3]. It can be useful when it prompts preparation rather than paralysis. One well-known technique is the project “premortem”, described by psychologist Gary Klein: before launching, the team imagines that the venture has failed and writes down every reason why, which surfaces risks that optimism hides [7]. Turning vague fear into a concrete list of risks, each with a mitigation, is a practical way to improve the odds.",
        ],
      },
      {
        heading: "Do women founders face different survival challenges?",
        paragraphs: [
          "GEM’s women’s entrepreneurship research finds that women are strongly represented among high-potential startups, leading about 40% of them, but that their activity falls sharply at the established-business stage [8]. Women were more likely than men to cite family or personal circumstances as a reason for exiting a business (20% vs 13%) and reported investing less capital on average [8]. Support that addresses access to growth finance and caregiving, not just start-up advice, targets the survival stage directly.",
        ],
      },
      {
        heading: "What should founders monitor in the first year?",
        paragraphs: [
          "Because survival risk is highest early [2][6], a short list of numbers reviewed every week is more useful than a long business plan reviewed once a quarter. The essentials are cash in the bank and months of runway; revenue against forecast; the cost of winning a customer compared with what that customer is worth; how many customers return or renew; and overdue invoices.",
          "Watch the wider economy as well as the business. BLS data show that firms born into recessions survive at lower rates [1], so founders should have a plan for cutting costs or extending runway if demand or credit tightens. GEM’s finding that entrepreneurial finance is insufficient in most economies it studies [3] is a reason to line up financing options before they are urgently needed.",
        ],
      },
      {
        heading: "How can founders improve their odds?",
        paragraphs: ["The data suggest a few disciplines that consistently separate survivors from casualties:"],
        bullets: [
          "Validate demand before building: talk to customers, pre-sell, and test pricing.",
          "Plan for at least 18 months of runway and monitor cash weekly, not monthly.",
          "Stress-test the plan against a recession scenario; survival rates drop for firms born into downturns [1].",
          "Learn management early: delegation, feedback and hiring for skill rather than familiarity [5].",
          "Adopt proven digital and AI tools where they save time or reach customers, and measure the results [4].",
          "Use local support networks, mentors and public programmes to fill finance and skills gaps [3].",
        ],
        after:
          "And if a venture does fail, the evidence is encouraging: GEM finds that people who have previously exited a business are more likely to start again [3]. Experience, including failure, is a durable asset.",
      },
    ],
    faqs: [
      {
        q: "What percentage of new businesses fail in five years?",
        a: "Roughly half. BLS data show five-year survival rates of 49.8% to 57.3% for recent US startup cohorts [1].",
      },
      {
        q: "When are new businesses most likely to fail?",
        a: "Survival is weakest when a firm’s early years coincide with a recession; one-year survival was lowest for establishments born in 2001 and 2008 [1][2].",
      },
      {
        q: "What is the startup “Survival Gap”?",
        a: "GEM’s term for record levels of early-stage entrepreneurship combined with too few ventures becoming established businesses [3].",
      },
      {
        q: "How many small businesses use AI?",
        a: "The US Census Bureau found 19.8% of firms using AI in early May 2026, with much higher rates among larger firms [4].",
      },
      {
        q: "Does failing in business make you less likely to succeed later?",
        a: "Not necessarily. GEM finds that people who have previously exited a business are more likely to start again [3].",
      },
    ],
    references: [
      {
        text: "U.S. Bureau of Labor Statistics. (2024). Business Employment Dynamics twentieth anniversary! Spotlight on Statistics.",
        url: "https://www.bls.gov/spotlight/2024/business-employment-dynamics-twentieth-anniversary/home.htm",
      },
      {
        text: "U.S. Bureau of Labor Statistics. (2024). 1-year survival rates for new business establishments by year and location. The Economics Daily.",
        url: "https://www.bls.gov/opub/ted/2024/1-year-survival-rates-for-new-business-establishments-by-year-and-location.htm",
      },
      {
        text: "Global Entrepreneurship Monitor. (2026). GEM 2025/2026 global report: From uncertainty to opportunity. GERA.",
        url: "https://www.gemconsortium.org/reports/latest-global-report",
      },
      {
        text: "U.S. Census Bureau. (2026, May). Large firms with at least 20 employees biggest AI users.",
        url: "https://www.census.gov/library/stories/2026/05/ai-use-businesses.html",
      },
      {
        text: "Gallup. (2026). State of the global workplace: 2026 report. Gallup, Inc.",
        url: "https://www.gallup.com/workplace/349484/state-of-the-global-workplace.aspx",
      },
      {
        text: "The risk of death in newborn businesses during the first years in market. (2020). arXiv:2011.11776.",
        url: "https://arxiv.org/abs/2011.11776",
      },
      {
        text: "Klein, G. (2007). Performing a project premortem. Harvard Business Review, 85(9), 18–19.",
        url: "https://hbr.org/2007/09/performing-a-project-premortem",
      },
      {
        text: "Global Entrepreneurship Monitor. (2026). GEM 2025/2026 women’s entrepreneurship report: How metrics shape the narrative. GERA.",
        url: "https://www.gemconsortium.org/reports/womens-entrepreneurship",
      },
    ],
    cover: {
      stat: "~50%",
      statLabel: "New US businesses still operating after five years",
      source: "U.S. Bureau of Labor Statistics, Business Employment Dynamics",
      hue: 45,
      alt: "Data card: about half of new US businesses are still operating after five years, from BLS Business Employment Dynamics.",
    },
  },
];
