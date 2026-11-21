/**
 * UN Sustainable Development Goals: the 17 goals, their official colours and
 * icons, and the Eleventh Press discipline/keyword mapping from the
 * "UN SDG Integration & Policy Guide" (editorial & policy kit).
 *
 * Icons are the UN's official English web icons (E-WEB-Goal-NN), scaled
 * proportionally into /public/sdg — never cropped, recoloured or merged
 * with another logo, per the UN SDG guidelines for non-UN entities. They are
 * for information only: keep them off paid/commercial pages (pricing, APC
 * checkout, billing).
 *
 * suggestSdgs() is deliberately not AI: it matches the guide's keyword
 * lists locally, so an unpublished manuscript never leaves the platform to
 * get a suggestion, and it costs nothing to run.
 */

import { DISCIPLINES } from "@/lib/article";

export type Discipline = (typeof DISCIPLINES)[number];

export interface SdgGoal {
  number: number;
  /** Official UN short title. */
  title: string;
  /** Official UN colour (hex). */
  color: string;
  /** Path of the official icon under /public. */
  icon: string;
  primary: readonly Discipline[];
  /** Secondary / cross-cutting disciplines; "ALL" for every discipline. */
  secondary: readonly Discipline[] | "ALL";
  /** Tagging keywords and scope, lower case. Phrases match on word boundaries; a trailing "s" is tolerated. */
  keywords: readonly string[];
}

/** Required wherever the SDG logo or colour wheel appears next to the Eleventh Press logo. */
export const SDG_ATTRIBUTION = "Eleventh Press International Publishing supports the Sustainable Development Goals.";

export const SDG_POSTER = "/sdg/sdg-poster.webp";

const icon = (n: number) => `/sdg/goal-${String(n).padStart(2, "0")}.webp`;

export const SDG_GOALS: readonly SdgGoal[] = [
  {
    number: 1, title: "No Poverty", color: "#E5243B", icon: icon(1),
    primary: ["Economics", "Sociology"], secondary: ["Business", "Education"],
    keywords: ["poverty", "poverty alleviation", "microfinance", "microcredit", "social protection", "economic mobility", "rural livelihood", "cash transfer", "low-income household", "social safety net"],
  },
  {
    number: 2, title: "Zero Hunger", color: "#DDA63A", icon: icon(2),
    primary: ["Biology", "Environmental Science"], secondary: ["Economics", "Technology"],
    keywords: ["hunger", "agricultural biotechnology", "food security", "food insecurity", "crop resilience", "crop yield", "supply-chain nutrition", "nutrition", "malnutrition", "agritech", "agriculture", "smallholder farmer"],
  },
  {
    number: 3, title: "Good Health and Well-being", color: "#4C9F38", icon: icon(3),
    primary: ["Psychology", "Biology"], secondary: ["Sociology", "Technology"],
    keywords: ["mental health", "well-being", "wellbeing", "behavioral intervention", "behavioural intervention", "biomedical", "public health", "health analytics", "disease", "epidemiology", "healthcare", "depression", "anxiety"],
  },
  {
    number: 4, title: "Quality Education", color: "#C5192D", icon: icon(4),
    primary: ["Education", "Language and Literature"], secondary: ["Psychology", "Computer Science"],
    keywords: ["pedagogy", "literacy", "edtech", "educational technology", "inclusive curricula", "inclusive curriculum", "open educational resource", "oer", "multilingualism", "teaching", "learning outcome", "higher education", "student achievement"],
  },
  {
    number: 5, title: "Gender Equality", color: "#FF3A21", icon: icon(5),
    primary: ["Sociology", "Language and Literature"], secondary: ["Economics", "Business", "Psychology"],
    keywords: ["gender", "gender studies", "gender equality", "workplace equity", "feminist", "feminism", "women's leadership", "women in leadership", "pay gap", "gender pay gap", "women empowerment"],
  },
  {
    number: 6, title: "Clean Water and Sanitation", color: "#26BDE2", icon: icon(6),
    primary: ["Environmental Science", "Technology"], secondary: ["Biology", "Physics"],
    keywords: ["hydrology", "wastewater", "wastewater treatment", "aquatic ecology", "desalination", "water governance", "sanitation", "drinking water", "water quality", "water scarcity"],
  },
  {
    number: 7, title: "Affordable and Clean Energy", color: "#FCC30B", icon: icon(7),
    primary: ["Physics", "Technology"], secondary: ["Environmental Science", "Economics"],
    keywords: ["photovoltaic", "solar cell", "solar energy", "energy storage", "battery", "smart grid", "thermodynamics", "renewable energy", "clean energy", "wind energy", "energy efficiency", "energy economics"],
  },
  {
    number: 8, title: "Decent Work and Economic Growth", color: "#A21942", icon: icon(8),
    primary: ["Economics", "Business"], secondary: ["Sociology", "Psychology", "Technology"],
    keywords: ["labor market", "labour market", "employment", "unemployment", "entrepreneurship", "organizational behavior", "organisational behaviour", "sustainable tourism", "fintech", "economic growth", "decent work"],
  },
  {
    number: 9, title: "Industry, Innovation and Infrastructure", color: "#FD6925", icon: icon(9),
    primary: ["Computer Science", "Technology"], secondary: ["Physics", "Mathematics", "Business"],
    keywords: ["artificial intelligence", "machine learning", "ai/ml", "deep learning", "software engineering", "telecommunication", "industrial automation", "mathematical modeling", "mathematical modelling", "infrastructure", "innovation", "manufacturing"],
  },
  {
    number: 10, title: "Reduced Inequalities", color: "#DD1367", icon: icon(10),
    primary: ["Sociology", "Economics"], secondary: ["Education", "Language and Literature"],
    keywords: ["inequality", "income inequality", "migration", "migrant", "linguistic inclusion", "accessibility", "open access", "knowledge equity", "social inclusion", "marginalized", "marginalised", "discrimination"],
  },
  {
    number: 11, title: "Sustainable Cities and Communities", color: "#FD9D24", icon: icon(11),
    primary: ["Environmental Science", "Sociology"], secondary: ["Technology", "Business"],
    keywords: ["urban planning", "smart city", "smart cities", "public transit", "public transport", "cultural heritage", "heritage preservation", "disaster resilience", "disaster risk", "urbanization", "urbanisation", "housing"],
  },
  {
    number: 12, title: "Responsible Consumption and Production", color: "#BF8B2E", icon: icon(12),
    primary: ["Business", "Environmental Science"], secondary: ["Economics", "Technology"],
    keywords: ["circular economy", "esg", "esg reporting", "green supply chain", "lifecycle assessment", "life cycle assessment", "waste reduction", "recycling", "sustainable consumption", "sustainable production"],
  },
  {
    number: 13, title: "Climate Action", color: "#3F7E44", icon: icon(13),
    primary: ["Environmental Science", "Physics"], secondary: ["Mathematics", "Economics"],
    keywords: ["climate", "climate change", "atmospheric physics", "climate modeling", "climate modelling", "carbon pricing", "carbon tax", "mitigation policy", "climate mitigation", "climate adaptation", "extreme weather", "greenhouse gas", "emissions", "global warming"],
  },
  {
    number: 14, title: "Life Below Water", color: "#0A97D9", icon: icon(14),
    primary: ["Biology", "Environmental Science"], secondary: ["Physics", "Technology"],
    keywords: ["marine biology", "marine", "coral reef", "ocean acidification", "ocean", "sustainable fisheries", "fisheries", "marine robotics", "coastal ecosystem"],
  },
  {
    number: 15, title: "Life on Land", color: "#56C02B", icon: icon(15),
    primary: ["Biology", "Environmental Science"], secondary: ["Mathematics", "Technology"],
    keywords: ["biodiversity", "forestry", "deforestation", "conservation genetics", "ecological modeling", "ecological modelling", "soil science", "wildlife", "wildlife protection", "ecosystem", "land degradation"],
  },
  {
    number: 16, title: "Peace, Justice and Strong Institutions", color: "#00689D", icon: icon(16),
    primary: ["Sociology", "Language and Literature"], secondary: ["Business", "Computer Science"],
    keywords: ["governance", "media discourse", "cybersecurity ethics", "cybersecurity", "corporate accountability", "research integrity", "publication ethics", "corruption", "rule of law", "justice", "transparency"],
  },
  {
    number: 17, title: "Partnerships for the Goals", color: "#19486A", icon: icon(17),
    primary: ["Computer Science", "Business", "Economics"], secondary: "ALL",
    keywords: ["open science", "open-science infrastructure", "international trade", "cross-disciplinary collaboration", "interdisciplinary collaboration", "data interoperability", "international cooperation", "partnership"],
  },
];

export function sdgGoal(n: number): SdgGoal | undefined {
  return SDG_GOALS.find((g) => g.number === n);
}

/** Standard label for metadata, e.g. "UN SDG 13: Climate Action". */
export function sdgLabel(n: number): string {
  const g = sdgGoal(n);
  return g ? `UN SDG ${g.number}: ${g.title}` : "";
}

export interface SdgSuggestionInput {
  title?: string | null;
  abstract?: string | null;
  /** Comma-separated, as stored on Article. */
  keywords?: string | null;
  discipline?: string | null;
}

export interface SdgSuggestion {
  number: number;
  score: number;
  /** The keywords that matched, for showing authors and editors why. */
  matched: string[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patternCache = new Map<string, RegExp>();
function keywordPattern(k: string): RegExp {
  let re = patternCache.get(k);
  if (!re) {
    re = new RegExp(`(?:^|[^a-z0-9])${escapeRe(k)}(?:e?s)?(?=$|[^a-z0-9])`, "i");
    patternCache.set(k, re);
  }
  return re;
}

/** Matches in the author's keywords count most, then the title, then the abstract. */
const FIELD_WEIGHT = { keywords: 3, title: 2, abstract: 1 } as const;
/** A tie-breaker only: a discipline alone never produces a suggestion. */
const PRIMARY_DISCIPLINE_BONUS = 1;
const SECONDARY_DISCIPLINE_BONUS = 0.5;
const MIN_SCORE = 2;

/**
 * Up to `limit` goals (default 3) that the text plausibly supports, best
 * first. Needs at least one keyword match; returns [] when nothing fits.
 */
export function suggestSdgs(input: SdgSuggestionInput, limit = 3): SdgSuggestion[] {
  const fields = {
    keywords: (input.keywords ?? "").toLowerCase(),
    title: (input.title ?? "").toLowerCase(),
    abstract: (input.abstract ?? "").toLowerCase(),
  };
  const out: SdgSuggestion[] = [];
  for (const g of SDG_GOALS) {
    let score = 0;
    const matched: string[] = [];
    for (const k of g.keywords) {
      let best = 0;
      for (const f of Object.keys(fields) as (keyof typeof fields)[]) {
        if (fields[f] && keywordPattern(k).test(fields[f])) best = Math.max(best, FIELD_WEIGHT[f]);
      }
      if (best > 0) {
        score += best;
        matched.push(k);
      }
    }
    if (matched.length === 0) continue;
    const d = input.discipline as Discipline | undefined;
    if (d && g.primary.includes(d)) score += PRIMARY_DISCIPLINE_BONUS;
    else if (d && (g.secondary === "ALL" || g.secondary.includes(d))) score += SECONDARY_DISCIPLINE_BONUS;
    if (score >= MIN_SCORE) out.push({ number: g.number, score, matched });
  }
  return out.sort((a, b) => b.score - a.score || a.number - b.number).slice(0, limit);
}
