import { db } from "@/lib/db";

/**
 * ORCID works-push — POSTs a just-published article into the
 * corresponding author's own ORCID record via ORCID's Member API. This is
 * the one piece of this codebase's ORCID integration that requests write
 * access (the `/activities/update` scope, src/app/api/auth/orcid/route.ts)
 * but, until now, never actually used it: every other ORCID touch here
 * only ever reads (profile auto-population at OAuth callback) or embeds
 * the iD as an identifier in outbound Crossref/Zenodo metadata — nothing
 * ever wrote to the author's own record.
 *
 * Fails open (never throws) — a publish must never be blocked or delayed
 * by an ORCID push failure, same fire-and-forget contract as the
 * embeddings/RAG indexing and WebSocket broadcast calls it runs alongside
 * at publish time (src/app/api/articles/workflow/route.ts).
 */

const ORCID_API_BASE =
  process.env.ORCID_ENV === "production" ? "https://api.orcid.org/v3.0" : "https://api.sandbox.orcid.org/v3.0";

export interface PushWorkResult {
  mode: "pushed" | "skipped" | "failed";
  reason?: string;
  putCode?: string;
}

export async function pushWorkToOrcid(
  correspondingAuthorId: string,
  article: { title: string; doi: string | null; publishedAt: Date | null; journalName?: string | null }
): Promise<PushWorkResult> {
  const user = await db.user.findUnique({
    where: { id: correspondingAuthorId },
    select: { orcid: true, orcidAccessToken: true, orcidTokenExpiry: true },
  });
  if (!user?.orcid || !user.orcidAccessToken) {
    return { mode: "skipped", reason: "Corresponding author has no ORCID account linked with write access" };
  }
  if (user.orcidTokenExpiry && user.orcidTokenExpiry < new Date()) {
    return { mode: "skipped", reason: "ORCID access token expired — the author needs to re-link ORCID" };
  }
  if (!article.doi || !article.publishedAt) {
    return { mode: "skipped", reason: "Article has no DOI or publish date yet" };
  }

  const payload = {
    title: { title: { value: article.title } },
    type: "JOURNAL_ARTICLE",
    "publication-date": {
      year: { value: String(article.publishedAt.getFullYear()) },
      month: { value: String(article.publishedAt.getMonth() + 1).padStart(2, "0") },
      day: { value: String(article.publishedAt.getDate()).padStart(2, "0") },
    },
    "external-ids": {
      "external-id": [
        {
          "external-id-type": "doi",
          "external-id-value": article.doi,
          "external-id-url": { value: `https://doi.org/${article.doi}` },
          "external-id-relationship": "SELF",
        },
      ],
    },
    url: { value: `https://doi.org/${article.doi}` },
    ...(article.journalName ? { "journal-title": { value: article.journalName } } : {}),
  };

  try {
    const res = await fetch(`${ORCID_API_BASE}/${user.orcid}/work`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.orcidAccessToken}`,
        "Content-Type": "application/vnd.orcid+json",
        Accept: "application/vnd.orcid+json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      return { mode: "failed", reason: `ORCID API returned ${res.status}: ${body.slice(0, 300)}` };
    }

    // A successful POST returns the new work's location in a Location
    // header; the put-code (its last path segment) is what any future
    // update/delete call would need to reference it.
    const location = res.headers.get("Location") || "";
    const putCode = location.split("/").filter(Boolean).pop();
    return { mode: "pushed", putCode };
  } catch (e: any) {
    return { mode: "failed", reason: e?.message || "Network error" };
  }
}
