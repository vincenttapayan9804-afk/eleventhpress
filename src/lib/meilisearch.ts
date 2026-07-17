import { Meilisearch } from "meilisearch";

/**
 * Meilisearch integration — typo-tolerant, ranked keyword search layered on
 * top of the existing Postgres `contains` queries (src/app/api/articles,
 * src/app/api/resources/search), not a replacement for the separate
 * pgvector/embeddings semantic-similarity layer (src/lib/pgvector.ts,
 * src/lib/embeddings.ts) — those solve a different problem (conceptual
 * similarity vs. exact/fuzzy keyword matching).
 *
 * Meilisearch itself is a long-lived server process — the same "can't run
 * this inside Vercel's serverless model" category as the Pandoc/WeasyPrint
 * worker and the WebSocket dashboard (see docs/deployment.md). Meilisearch
 * Cloud's free tier is the zero-infra path (just MEILISEARCH_HOST +
 * MEILISEARCH_API_KEY, same flat env-var convention every other optional
 * integration in this codebase uses); self-hosting would follow the same
 * "run it on Cloud Run/Fly.io/a VPS" pattern already used for those two
 * mini-services. Until either is configured, every caller here fails open
 * to the existing Postgres-backed search — never a fabricated result set.
 */

export function meilisearchLiveMode(): boolean {
  return !!process.env.MEILISEARCH_HOST;
}

let client: Meilisearch | null = null;

function getClient(): Meilisearch {
  if (!client) {
    client = new Meilisearch({
      host: process.env.MEILISEARCH_HOST!,
      apiKey: process.env.MEILISEARCH_API_KEY,
    });
  }
  return client;
}

export const ARTICLES_INDEX = "epip_articles";
export const RESOURCES_INDEX = "epip_resources";

export interface ArticleSearchDoc {
  id: string;
  title: string;
  abstract: string;
  keywords: string;
  authors: string;
  discipline: string;
  doi: string | null;
  publishedAt: string | null;
}

/** Best-effort — a Meilisearch outage must never break article publishing. */
export async function upsertArticleDocument(doc: ArticleSearchDoc): Promise<void> {
  if (!meilisearchLiveMode()) return;
  try {
    await getClient().index<ArticleSearchDoc>(ARTICLES_INDEX).addDocuments([doc], { primaryKey: "id" });
  } catch (err) {
    console.error("[meilisearch] upsertArticleDocument failed", err);
  }
}

export async function deleteArticleDocument(id: string): Promise<void> {
  if (!meilisearchLiveMode()) return;
  try {
    await getClient().index(ARTICLES_INDEX).deleteDocument(id);
  } catch (err) {
    console.error("[meilisearch] deleteArticleDocument failed", err);
  }
}

/** Returns null (never []) when not live or on error, so callers can tell
 * "no Meilisearch result" apart from "genuinely zero matches" and fall
 * back to the existing Prisma `contains` query. */
export async function searchArticles(query: string, limit = 20): Promise<ArticleSearchDoc[] | null> {
  if (!meilisearchLiveMode()) return null;
  try {
    const result = await getClient().index<ArticleSearchDoc>(ARTICLES_INDEX).search(query, { limit });
    return result.hits;
  } catch (err) {
    console.error("[meilisearch] searchArticles failed", err);
    return null;
  }
}

export interface ResourceSearchDoc {
  id: string;
  kind: "guide" | "blog" | "training" | "webinar" | "book";
  title: string;
  description: string;
  url?: string;
}

export async function syncResourcesIndex(docs: ResourceSearchDoc[]): Promise<void> {
  if (!meilisearchLiveMode()) return;
  try {
    await getClient().index<ResourceSearchDoc>(RESOURCES_INDEX).addDocuments(docs, { primaryKey: "id" });
  } catch (err) {
    console.error("[meilisearch] syncResourcesIndex failed", err);
  }
}

export async function searchResources(query: string, limit = 20): Promise<ResourceSearchDoc[] | null> {
  if (!meilisearchLiveMode()) return null;
  try {
    const result = await getClient().index<ResourceSearchDoc>(RESOURCES_INDEX).search(query, { limit });
    return result.hits;
  } catch (err) {
    console.error("[meilisearch] searchResources failed", err);
    return null;
  }
}
