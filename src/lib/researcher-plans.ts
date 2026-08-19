/**
 * Researcher SaaS Phase 1 — individual-researcher plan catalog, the
 * per-user counterpart to src/lib/tenant-plans.ts (Commercial Layer Phase
 * 0). Pure data: which of the three quota-checked Research Lab tools
 * (gap analysis, PRISMA draft, transcription) a plan allows, and how many
 * runs per calendar month. Enforcement lives in researcher-quota.ts.
 *
 * "Ask the Corpus" (corpus-chat) is deliberately not in this catalog — it
 * has no login requirement (see src/app/api/corpus-chat/route.ts's own
 * doc comment on why), so there is no userId to meter it against; it
 * keeps its existing per-IP rate limit instead.
 */
export const RESEARCH_MODULE_KEYS = {
  GAP_ANALYSIS: "GAP_ANALYSIS",
  PRISMA_DRAFT: "PRISMA_DRAFT",
  TRANSCRIPTION: "TRANSCRIPTION",
} as const;

export type ResearchModuleKey = (typeof RESEARCH_MODULE_KEYS)[keyof typeof RESEARCH_MODULE_KEYS];

export const ALL_RESEARCH_MODULE_KEYS: ResearchModuleKey[] = Object.values(RESEARCH_MODULE_KEYS) as ResearchModuleKey[];

export const RESEARCH_MODULE_LABELS: Record<ResearchModuleKey, string> = {
  GAP_ANALYSIS: "Research Gap Finder",
  PRISMA_DRAFT: "PRISMA Review Draft",
  TRANSCRIPTION: "Audio Transcription",
};

export interface ResearcherPlanDefinition {
  key: string;
  label: string;
  priceRange: string;
  // Monthly run cap per module. A module absent from this map has no cap
  // under this plan (unlimited), same "absence = permissive" convention
  // used throughout this codebase.
  monthlyQuotas: Partial<Record<ResearchModuleKey, number>>;
}

export const RESEARCHER_PLANS: Record<string, ResearcherPlanDefinition> = {
  RESEARCHER_FREE: {
    key: "RESEARCHER_FREE",
    label: "EP Researcher Free",
    priceRange: "$0/mo",
    monthlyQuotas: {
      GAP_ANALYSIS: 3,
      PRISMA_DRAFT: 1,
      TRANSCRIPTION: 2,
    },
  },
  RESEARCHER_PRO: {
    key: "RESEARCHER_PRO",
    label: "EP Researcher Pro",
    priceRange: "$19-$39/mo",
    monthlyQuotas: {
      GAP_ANALYSIS: 30,
      PRISMA_DRAFT: 10,
      TRANSCRIPTION: 20,
    },
  },
  RESEARCHER_TEAM: {
    key: "RESEARCHER_TEAM",
    label: "EP Researcher Team",
    priceRange: "$79-$149/mo",
    monthlyQuotas: {
      // Unlimited on every module — an explicit high ceiling rather than
      // omitting the keys, so usage displays still have a number to show.
      GAP_ANALYSIS: 200,
      PRISMA_DRAFT: 100,
      TRANSCRIPTION: 150,
    },
  },
};

export const RESEARCHER_PLAN_KEYS = Object.keys(RESEARCHER_PLANS);

export function getResearcherPlan(planKey: string | null | undefined): ResearcherPlanDefinition | null {
  if (!planKey) return null;
  return RESEARCHER_PLANS[planKey] ?? null;
}
