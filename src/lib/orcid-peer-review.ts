import { db } from "@/lib/db";
import { JOURNAL_ORG_CITY, JOURNAL_ORG_COUNTRY } from "@/lib/site";

/**
 * ORCID Peer Review API push — POSTs a just-completed review into the
 * reviewer's own ORCID record, crediting their peer-review service the
 * same way src/lib/orcid-works.ts credits a corresponding author's
 * published work. Uses the same write-scope token requested at OAuth
 * (`/activities/update`, src/app/api/auth/orcid/route.ts) and the same
 * fail-open contract: submitting a review must never be blocked or
 * delayed by this push.
 *
 * ORCID's `review-group-id` field identifies the venue a review was
 * performed for; this uses the documented `issn:XXXX-XXXX` convention
 * rather than a pre-registered ORCID Group ID (the formal path, which
 * requires a separate application to ORCID's Group ID Registry). Until
 * that registration exists, ORCID may reject the push outright — that
 * surfaces as an ordinary `{ mode: "failed" }` result here, logged but
 * never thrown, the same posture this codebase already takes toward
 * Crossref membership/COUNTER SUSHI keys/Zenodo tokens not being live yet.
 */

const ORCID_API_BASE =
  process.env.ORCID_ENV === "production" ? "https://api.orcid.org/v3.0" : "https://api.sandbox.orcid.org/v3.0";

export interface PushPeerReviewResult {
  mode: "pushed" | "skipped" | "failed";
  reason?: string;
  putCode?: string;
}

export async function pushPeerReviewToOrcid(
  reviewerId: string,
  params: {
    articleId: string;
    articleTitle: string;
    articleDoi?: string | null;
    journalName?: string | null;
    journalIssn?: string | null;
    publisher?: string | null;
    completedAt: Date;
  }
): Promise<PushPeerReviewResult> {
  const user = await db.user.findUnique({
    where: { id: reviewerId },
    select: { orcid: true, orcidAccessToken: true, orcidTokenExpiry: true },
  });
  if (!user?.orcid || !user.orcidAccessToken) {
    return { mode: "skipped", reason: "Reviewer has no ORCID account linked with write access" };
  }
  if (user.orcidTokenExpiry && user.orcidTokenExpiry < new Date()) {
    return { mode: "skipped", reason: "ORCID access token expired — the reviewer needs to re-link ORCID" };
  }

  const issn = params.journalIssn || "2945-1138";

  const payload = {
    "reviewer-role": "reviewer",
    "review-identifiers": {
      "external-id": [
        {
          "external-id-type": "source-work-id",
          "external-id-value": params.articleId,
          "external-id-relationship": "SELF",
        },
      ],
    },
    "review-type": "review",
    "review-group-id": `issn:${issn}`,
    "subject-container-name": { value: params.journalName || "Eleventh Press" },
    "subject-type": "journal-article",
    "subject-name": { title: { value: params.articleTitle } },
    ...(params.articleDoi
      ? {
          "subject-external-identifier": {
            "external-id-type": "doi",
            "external-id-value": params.articleDoi,
            "external-id-relationship": "SELF",
          },
        }
      : {}),
    "convening-organization": {
      name: params.publisher || "Eleventh Press International Publishing",
      address: { city: JOURNAL_ORG_CITY, country: JOURNAL_ORG_COUNTRY },
    },
    "completion-date": {
      year: { value: String(params.completedAt.getFullYear()) },
      month: { value: String(params.completedAt.getMonth() + 1).padStart(2, "0") },
      day: { value: String(params.completedAt.getDate()).padStart(2, "0") },
    },
  };

  try {
    const res = await fetch(`${ORCID_API_BASE}/${user.orcid}/peer-review`, {
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

    // A successful POST returns the new peer-review's location in a
    // Location header; the put-code (its last path segment) is what any
    // future update/delete call would need to reference it.
    const location = res.headers.get("Location") || "";
    const putCode = location.split("/").filter(Boolean).pop();
    return { mode: "pushed", putCode };
  } catch (e: any) {
    return { mode: "failed", reason: e?.message || "Network error" };
  }
}
