/**
 * Titles of the sample articles created by scripts/seed.ts (verbatim from its
 * ARTICLES array). Shared by scripts/remove-seed-articles.ts, which deletes
 * them, and the sitemap, which leaves their placeholder authors out while
 * any of them are still published.
 */
export const SEED_ARTICLE_TITLES: readonly string[] = [
  "Topological Signatures in Strain-Engineered Transition Metal Dichalcogenides",
  "CRISPR-Cas12a Base Editing Rescues Splicing Defects in a Cellular Model of Cystic Fibrosis",
  "Sparse Mixture-of-Experts Routing for Resource-Constrained Edge Inference",
  "Gentrification, Displacement, and the Informal Care Economy in Post-2010 Lisbon",
  "Carbon Border Adjustment Mechanisms: A General Equilibrium Assessment of Distributional Effects",
  "Attentional Bias Modification in Subclinical Anxiety: A Pre-Registered Multi-Site Replication",
  "Reconstructing Seasonal Snowpack Trends in the Hindu Kush-Karakoram from Sentinel-2 Time Series",
  "A Refined Bound for the Sum-of-Digits Function in Modular Arithmetic",
  "Quantum Metrology with Squeezed-Vacuum-Enhanced Mach-Zehnder Interferometers",
  "Microplastic Loads in Urban Stormwater Biofilters: A Six-City Comparative Audit",
];

const SEED_TITLE_SET = new Set(SEED_ARTICLE_TITLES);

/** Whether an article is one of the scripts/seed.ts sample articles. */
export function isSeedArticleTitle(title: string): boolean {
  return SEED_TITLE_SET.has(title.trim());
}
