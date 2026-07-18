/**
 * Zenodo Data Deposit Service.
 *
 * Integrates with the Zenodo REST API to deposit research datasets linked
 * to published articles (depositToZenodo), the published article itself
 * (depositArticleToZenodo) — a free, real, permanently-resolving DOI (via
 * DataCite) for journals that don't yet have a paid Crossref membership —
 * and, separately, the compiled peer-review report for an article whose
 * Review History transparency is enabled (depositReviewReportToZenodo).
 * Zenodo records are automatically harvested by OpenAIRE and surface in
 * BASE/CORE, so this single free deposit path indirectly reaches three of
 * the platform's indexing targets.
 *
 * API docs: https://developers.zenodo.org/
 *
 * In simulation mode (no ZENODO_TOKEN), creates a local record with a
 * mock DOI so the full UI flow works end-to-end.
 */
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { parseAuthors } from "@/lib/article";

const ZENODO_API = "https://zenodo.org/api/deposit/depositions";
const ZENODO_SANDBOX_API = "https://sandbox.zenodo.org/api/deposit/depositions";

/** Returns true when a free Zenodo personal access token is configured. */
export function zenodoLiveMode(): boolean {
  return !!process.env.ZENODO_TOKEN;
}

/** Extracts a human-readable reason from a Zenodo error response body —
 * Zenodo typically returns JSON like {"message": "...", "status": 403} —
 * falling back to a truncated raw body when it isn't JSON. */
function extractZenodoErrorReason(body: string): string {
  try {
    const parsed = JSON.parse(body);
    if (parsed?.message) return parsed.message;
  } catch {
    // not JSON — fall through to raw text
  }
  return body.slice(0, 200) || "(empty response body)";
}

export interface ZenodoDepositInput {
  articleId: string;
  title: string;
  description: string;
  creators: { name: string; affiliation?: string; orcid?: string }[];
  keywords: string[];
  license: string; // e.g. "CC-BY-4.0"
  accessRight: string; // "open" | "restricted" | "closed"
  depositorId: string;
}

export interface ZenodoDepositOutput {
  ok: boolean;
  mode: "live" | "simulation";
  datasetDoi: string | null;
  datasetUrl: string;
  zenodoDepositId: string | null;
  zenodoConceptId: string | null;
  message: string;
  rawResponse?: string;
}

export async function depositToZenodo(
  input: ZenodoDepositInput
): Promise<ZenodoDepositOutput> {
  const token = process.env.ZENODO_TOKEN;
  const useSandbox = process.env.ZENODO_ENV !== "production";

  // --- SIMULATION MODE ---
  if (!token) {
    const mockSuffix = Math.floor(Math.random() * 9000000) + 1000000;
    const mockDoi = `10.5281/zenodo.${mockSuffix}`;
    const mockUrl = `https://zenodo.org/record/${mockSuffix}`;

    const link = await db.datasetLink.create({
      data: {
        articleId: input.articleId,
        repository: "ZENODO",
        datasetDoi: mockDoi,
        datasetUrl: mockUrl,
        datasetTitle: input.title,
        depositorId: input.depositorId,
        relationType: "isSupplementedBy",
        zenodoDepositId: String(mockSuffix),
        zenodoConceptId: String(mockSuffix),
      },
    });

    return {
      ok: true,
      mode: "simulation",
      datasetDoi: mockDoi,
      datasetUrl: mockUrl,
      zenodoDepositId: String(mockSuffix),
      zenodoConceptId: String(mockSuffix),
      message: `Dataset deposited (simulated). DOI: ${mockDoi}. Set ZENODO_TOKEN to enable live deposits.`,
    };
  }

  // --- LIVE ZENODO API ---
  const apiUrl = useSandbox ? ZENODO_SANDBOX_API : ZENODO_API;

  try {
    // 1. Create empty deposition
    const createRes = await fetch(`${apiUrl}?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!createRes.ok) {
      return {
        ok: false,
        mode: "live",
        datasetDoi: null,
        datasetUrl: "",
        zenodoDepositId: null,
        zenodoConceptId: null,
        message: `Zenodo create failed: ${createRes.status} ${await createRes.text()}`,
      };
    }
    const deposition = await createRes.json();
    const depositionId = deposition.id;
    const bucketUrl: string | undefined = deposition.links?.bucket;

    // 2. Upload a file — Zenodo will not publish an empty deposition, so
    // this step is mandatory. The dataset form collects only metadata (no
    // file input), so synthesize a manifest describing the dataset as the
    // deposited artifact, same fallback pattern used when an article has no
    // galley/manuscript file available (see depositPublishedArticleToZenodo).
    if (!bucketUrl) {
      return {
        ok: false,
        mode: "live",
        datasetDoi: null,
        datasetUrl: "",
        zenodoDepositId: String(depositionId),
        zenodoConceptId: null,
        message: "Zenodo deposition had no upload bucket link",
      };
    }
    const manifest = Buffer.from(
      `${input.title}\n\n${input.description}\n\nKeywords: ${input.keywords.join(", ")}\nLicense: ${input.license}\nAccess: ${input.accessRight}`,
      "utf-8"
    );
    const uploadRes = await fetch(
      `${bucketUrl}/${encodeURIComponent(input.title.slice(0, 60) || "dataset")}.txt?access_token=${token}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: manifest as any,
      }
    );
    if (!uploadRes.ok) {
      return {
        ok: false,
        mode: "live",
        datasetDoi: null,
        datasetUrl: "",
        zenodoDepositId: String(depositionId),
        zenodoConceptId: null,
        message: `Zenodo file upload failed: ${uploadRes.status} — ${extractZenodoErrorReason(await uploadRes.text())}`,
      };
    }

    // 3. Upload metadata
    const metadataRes = await fetch(`${apiUrl}/${depositionId}?access_token=${token}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metadata: {
          title: input.title,
          description: input.description,
          upload_type: "dataset",
          creators: input.creators.map((c) => ({
            name: c.name,
            affiliation: c.affiliation,
            ...(c.orcid ? { orcid: c.orcid } : {}),
          })),
          keywords: input.keywords,
          access_right: input.accessRight,
          license: input.license,
          related_identifiers: [
            {
              identifier: `https://doi.org/${(await db.article.findUnique({ where: { id: input.articleId } }))?.doi}`,
              relation: "isSupplementTo",
              scheme: "doi",
            },
          ],
        },
      }),
    });
    if (!metadataRes.ok) {
      return {
        ok: false,
        mode: "live",
        datasetDoi: null,
        datasetUrl: "",
        zenodoDepositId: String(depositionId),
        zenodoConceptId: null,
        message: `Zenodo metadata failed: ${metadataRes.status}`,
      };
    }
    const updated = await metadataRes.json();

    // 4. Publish
    const publishRes = await fetch(`${apiUrl}/${depositionId}/actions/publish?access_token=${token}`, {
      method: "POST",
    });
    if (!publishRes.ok) {
      return {
        ok: false,
        mode: "live",
        datasetDoi: null,
        datasetUrl: "",
        zenodoDepositId: String(depositionId),
        zenodoConceptId: String(updated.conceptrecid),
        message: `Zenodo publish failed: ${publishRes.status}`,
      };
    }
    const published = await publishRes.json();

    const link = await db.datasetLink.create({
      data: {
        articleId: input.articleId,
        repository: "ZENODO",
        datasetDoi: published.doi,
        datasetUrl: `https://zenodo.org/record/${published.id}`,
        datasetTitle: input.title,
        depositorId: input.depositorId,
        relationType: "isSupplementedBy",
        zenodoDepositId: String(published.id),
        zenodoConceptId: String(published.conceptrecid),
      },
    });

    return {
      ok: true,
      mode: "live",
      datasetDoi: published.doi,
      datasetUrl: `https://zenodo.org/record/${published.id}`,
      zenodoDepositId: String(published.id),
      zenodoConceptId: String(published.conceptrecid),
      message: `Dataset published on Zenodo. DOI: ${published.doi}`,
    };
  } catch (e: any) {
    return {
      ok: false,
      mode: "live",
      datasetDoi: null,
      datasetUrl: "",
      zenodoDepositId: null,
      zenodoConceptId: null,
      message: `Zenodo exception: ${e.message}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Article deposit — mints the article's own real, free DOI via Zenodo.
// ---------------------------------------------------------------------------

export interface ZenodoArticleDepositInput {
  articleId: string;
  title: string;
  abstract: string;
  creators: { name: string; affiliation?: string; orcid?: string }[];
  keywords: string[];
  license: string; // e.g. "CC-BY-4.0" — must match Zenodo's controlled vocabulary id exactly
  journalTitle: string;
  journalVolume?: string;
  journalIssue?: string;
  publicationDate: string; // ISO date (YYYY-MM-DD)
  fileBuffer: Buffer;
  fileName: string;
  fileContentType: string;
}

export interface ZenodoArticleDepositOutput {
  ok: boolean;
  mode: "live" | "simulation";
  doi: string | null;
  recordUrl: string;
  zenodoRecordId: string | null;
  message: string;
  rawLog: string; // JSON-stringified, safe to persist to Article.zenodoDepositLog
}

/**
 * Deposits the article itself (not a supplementary dataset) to Zenodo as a
 * "publication / article" record with journal metadata, uploading the
 * manuscript/galley file before publishing — Zenodo requires at least one
 * file attached to a deposition before it can be published. Returns a real,
 * permanently-resolving DOI in live mode.
 */
export async function depositArticleToZenodo(
  input: ZenodoArticleDepositInput
): Promise<ZenodoArticleDepositOutput> {
  const token = process.env.ZENODO_TOKEN;
  const useSandbox = process.env.ZENODO_ENV !== "production";

  // --- SIMULATION MODE ---
  if (!token) {
    const mockSuffix = Math.floor(Math.random() * 9000000) + 1000000;
    const mockDoi = `10.5281/zenodo.${mockSuffix}`;
    const mockUrl = `https://zenodo.org/record/${mockSuffix}`;
    return {
      ok: true,
      mode: "simulation",
      doi: mockDoi,
      recordUrl: mockUrl,
      zenodoRecordId: String(mockSuffix),
      message: `Article deposit simulated. DOI: ${mockDoi}. Set ZENODO_TOKEN to mint a real, free DOI on publish.`,
      rawLog: JSON.stringify({ mode: "simulation", mockDoi, mockUrl }),
    };
  }

  // --- LIVE ZENODO API ---
  const apiUrl = useSandbox ? ZENODO_SANDBOX_API : ZENODO_API;

  try {
    // 1. Create empty deposition
    const createRes = await fetch(`${apiUrl}?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!createRes.ok) {
      const body = await createRes.text();
      return {
        ok: false,
        mode: "live",
        doi: null,
        recordUrl: "",
        zenodoRecordId: null,
        message: `Zenodo create failed: ${createRes.status} — ${extractZenodoErrorReason(body)}`,
        rawLog: JSON.stringify({ step: "create", status: createRes.status, body }),
      };
    }
    const deposition = await createRes.json();
    const depositionId = deposition.id;
    const bucketUrl: string | undefined = deposition.links?.bucket;

    // 2. Upload the manuscript/galley file — Zenodo will not publish an
    // empty deposition, so this step is mandatory, not optional.
    if (!bucketUrl) {
      return {
        ok: false,
        mode: "live",
        doi: null,
        recordUrl: "",
        zenodoRecordId: String(depositionId),
        message: "Zenodo deposition had no upload bucket link",
        rawLog: JSON.stringify({ step: "bucket", deposition }),
      };
    }
    // Zenodo's bucket upload endpoint (S3-compatible) infers the file's
    // real type from the filename, not this header — it rejects anything
    // other than application/octet-stream here with a 415.
    const uploadRes = await fetch(`${bucketUrl}/${encodeURIComponent(input.fileName)}?access_token=${token}`, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: input.fileBuffer as any,
    });
    if (!uploadRes.ok) {
      const body = await uploadRes.text();
      return {
        ok: false,
        mode: "live",
        doi: null,
        recordUrl: "",
        zenodoRecordId: String(depositionId),
        message: `Zenodo file upload failed: ${uploadRes.status} — ${extractZenodoErrorReason(body)}`,
        rawLog: JSON.stringify({ step: "upload", status: uploadRes.status, body }),
      };
    }

    // 3. Upload metadata
    const metadataRes = await fetch(`${apiUrl}/${depositionId}?access_token=${token}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metadata: {
          title: input.title,
          description: input.abstract,
          upload_type: "publication",
          publication_type: "article",
          publication_date: input.publicationDate,
          creators: input.creators.map((c) => ({
            name: c.name,
            affiliation: c.affiliation,
            ...(c.orcid ? { orcid: c.orcid } : {}),
          })),
          keywords: input.keywords,
          access_right: "open",
          license: input.license,
          journal_title: input.journalTitle,
          ...(input.journalVolume ? { journal_volume: input.journalVolume } : {}),
          ...(input.journalIssue ? { journal_issue: input.journalIssue } : {}),
        },
      }),
    });
    if (!metadataRes.ok) {
      const body = await metadataRes.text();
      return {
        ok: false,
        mode: "live",
        doi: null,
        recordUrl: "",
        zenodoRecordId: String(depositionId),
        message: `Zenodo metadata failed: ${metadataRes.status} — ${extractZenodoErrorReason(body)}`,
        rawLog: JSON.stringify({ step: "metadata", status: metadataRes.status, body }),
      };
    }

    // 4. Publish
    const publishRes = await fetch(`${apiUrl}/${depositionId}/actions/publish?access_token=${token}`, {
      method: "POST",
    });
    if (!publishRes.ok) {
      const body = await publishRes.text();
      return {
        ok: false,
        mode: "live",
        doi: null,
        recordUrl: "",
        zenodoRecordId: String(depositionId),
        message: `Zenodo publish failed: ${publishRes.status} — ${extractZenodoErrorReason(body)}`,
        rawLog: JSON.stringify({ step: "publish", status: publishRes.status, body }),
      };
    }
    const published = await publishRes.json();

    return {
      ok: true,
      mode: "live",
      doi: published.doi,
      recordUrl: `https://zenodo.org/record/${published.id}`,
      zenodoRecordId: String(published.id),
      message: `Article published on Zenodo. DOI: ${published.doi}`,
      rawLog: JSON.stringify({ step: "done", id: published.id, doi: published.doi }),
    };
  } catch (e: any) {
    return {
      ok: false,
      mode: "live",
      doi: null,
      recordUrl: "",
      zenodoRecordId: null,
      message: `Zenodo exception: ${e.message}`,
      rawLog: JSON.stringify({ step: "exception", message: e.message }),
    };
  }
}

/**
 * Looks up an article, assembles the deposit payload (galley PDF, falling
 * back to the raw manuscript, falling back to a minimal synthesized text
 * file), deposits it to Zenodo, and persists the result on the Article row.
 * Shared by both the publish workflow (automatic, on PUBLISH) and the
 * manual "Deposit to Zenodo" retry button (for when the automatic deposit
 * failed and an editor wants to retry after a fix, without re-running the
 * whole publish pipeline).
 */
export async function depositPublishedArticleToZenodo(
  articleId: string
): Promise<ZenodoArticleDepositOutput> {
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: { journal: true, issue: true },
  });
  if (!article) {
    return {
      ok: false,
      mode: "live",
      doi: null,
      recordUrl: "",
      zenodoRecordId: null,
      message: "Article not found",
      rawLog: JSON.stringify({ step: "lookup" }),
    };
  }

  let fileBuffer: Buffer | null = article.galleyPdfKey ? await getObject(article.galleyPdfKey) : null;
  let fileName = article.galleyPdfKey?.split("/").pop() || `${article.id}.pdf`;
  let fileContentType = "application/pdf";
  if (!fileBuffer) {
    fileBuffer = article.manuscriptKey ? await getObject(article.manuscriptKey) : null;
    fileName = article.manuscriptKey?.split("/").pop() || `${article.id}.md`;
    fileContentType = "text/markdown";
  }
  if (!fileBuffer) {
    fileBuffer = Buffer.from(
      `${article.title}\n\n${article.abstract}\n\nPublished by ${article.journal?.name || "Eleventh Press International Publishing"}.`,
      "utf-8"
    );
    fileName = `${article.id}.txt`;
    fileContentType = "text/plain";
  }

  const authors = parseAuthors(article.authors);
  const deposit = await depositArticleToZenodo({
    articleId: article.id,
    title: article.title,
    abstract: article.abstract,
    creators: authors.map((a) => ({ name: a.name, affiliation: a.affiliation, orcid: a.orcid })),
    keywords: article.keywords.split(",").map((k) => k.trim()).filter(Boolean),
    // Platform-wide policy is fully open access — CC-BY-4.0 is the default
    // license for every Zenodo deposit rather than a per-article field.
    // Must match Zenodo's controlled vocabulary id exactly (uppercase).
    license: "CC-BY-4.0",
    journalTitle: article.journal?.name || "Eleventh Press International Publishing",
    journalVolume: article.issue?.volume ? String(article.issue.volume) : undefined,
    journalIssue: article.issue?.issueNumber ? String(article.issue.issueNumber) : undefined,
    publicationDate: (article.publishedAt || new Date()).toISOString().slice(0, 10),
    fileBuffer,
    fileName,
    fileContentType,
  });

  await db.article.update({
    where: { id: articleId },
    data: {
      ...(deposit.ok && deposit.doi ? { doi: deposit.doi, doiStatus: "PUBLISHED" } : {}),
      zenodoRecordId: deposit.zenodoRecordId,
      zenodoDepositLog: deposit.rawLog,
    },
  });

  return deposit;
}

// ---------------------------------------------------------------------------
// Review report deposit — mints a real, citable DOI for a published
// article's compiled peer-review report (Review History tab), reusing
// depositArticleToZenodo above rather than duplicating the create/upload/
// metadata/publish sequence. Only meaningful once the article is published
// and its Review History transparency (Article.anonymizedReviewHistory) is
// enabled with at least one completed review to report on.
// ---------------------------------------------------------------------------

/**
 * Renders the article's completed reviews (anonymized — "Reviewer 1"/
 * "Reviewer 2", numbered from Review.createdAt order, same scheme as
 * src/app/api/articles/[id]/review-history/route.ts), the author's
 * responses, and any published decision letters into one plain-text
 * document suitable for depositing as a standalone, citable record.
 */
function renderReviewReportText(args: {
  articleTitle: string;
  articleDoi: string | null;
  reviews: { reviewerNumber: number; recommendation: string | null; overallScore: number | null; commentsToAuthor: string | null; completedAt: Date | null }[];
  authorResponses: { authorName: string; content: string; createdAt: Date }[];
  decisionLetters: { editorName: string; decision: string; letterBody: string | null; publishedAt: Date | null }[];
}): string {
  const lines: string[] = [];
  lines.push(`Peer Review Report`);
  lines.push(`Article: ${args.articleTitle}`);
  if (args.articleDoi) lines.push(`Article DOI: https://doi.org/${args.articleDoi}`);
  lines.push("");
  lines.push("This report compiles the anonymized peer-review record for the article");
  lines.push("above, published under this journal's transparent Review History policy.");
  lines.push("Reviewer identities are withheld by design; the article's own authorship");
  lines.push("is a matter of public record on the published article page.");
  lines.push("");

  lines.push("== Reviews ==");
  for (const r of args.reviews) {
    lines.push("");
    lines.push(`Reviewer ${r.reviewerNumber}${r.completedAt ? ` — completed ${r.completedAt.toISOString().slice(0, 10)}` : ""}`);
    if (r.recommendation) lines.push(`Recommendation: ${r.recommendation}`);
    if (r.overallScore != null) lines.push(`Overall score: ${r.overallScore}/5`);
    if (r.commentsToAuthor) lines.push(`Comments to author:\n${r.commentsToAuthor}`);
  }

  if (args.authorResponses.length > 0) {
    lines.push("");
    lines.push("== Author responses ==");
    for (const a of args.authorResponses) {
      lines.push("");
      lines.push(`${a.authorName} — ${a.createdAt.toISOString().slice(0, 10)}`);
      lines.push(a.content);
    }
  }

  if (args.decisionLetters.length > 0) {
    lines.push("");
    lines.push("== Editorial decision letters ==");
    for (const d of args.decisionLetters) {
      lines.push("");
      lines.push(`${d.decision} — ${d.editorName}${d.publishedAt ? ` — ${d.publishedAt.toISOString().slice(0, 10)}` : ""}`);
      if (d.letterBody) lines.push(d.letterBody);
    }
  }

  return lines.join("\n");
}

/**
 * Compiles and deposits the review report for `articleId`, persisting the
 * result on Article.reviewReportDoi/reviewReportZenodoRecordId/
 * reviewReportDepositedAt/reviewReportDepositLog. Fired automatically on
 * publish (workflow route) when anonymizedReviewHistory is already true at
 * that point, and available as a manual retry via
 * POST /api/articles/[id]/review-report-doi for when transparency is
 * turned on after publication — same "automatic + manual retry" shape as
 * depositPublishedArticleToZenodo above.
 *
 * No-ops (returns ok:false with an explanatory message, never throws) when
 * the article isn't published, transparency isn't enabled, or there are no
 * completed reviews yet — a DOI for an empty report would be worse than no
 * DOI at all.
 */
export async function depositReviewReportToZenodo(articleId: string): Promise<ZenodoArticleDepositOutput> {
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: { journal: true, issue: true },
  });
  if (!article) {
    return { ok: false, mode: "live", doi: null, recordUrl: "", zenodoRecordId: null, message: "Article not found", rawLog: "" };
  }
  if (article.status !== "PUBLISHED") {
    return { ok: false, mode: "live", doi: null, recordUrl: "", zenodoRecordId: null, message: "Article is not published yet", rawLog: "" };
  }
  if (!article.anonymizedReviewHistory) {
    return { ok: false, mode: "live", doi: null, recordUrl: "", zenodoRecordId: null, message: "Review History transparency is not enabled for this article", rawLog: "" };
  }

  const [allReviews, authorResponses, decisions] = await Promise.all([
    db.review.findMany({ where: { articleId }, orderBy: { createdAt: "asc" } }),
    db.authorResponse.findMany({ where: { articleId }, orderBy: { createdAt: "asc" }, include: { author: { select: { fullName: true } } } }),
    db.editorialDecision.findMany({ where: { articleId, letterPublishedAt: { not: null } }, orderBy: { createdAt: "asc" }, include: { editor: { select: { fullName: true } } } }),
  ]);
  const completedReviews = allReviews
    .map((r, i) => ({ ...r, reviewerNumber: i + 1 }))
    .filter((r) => r.status === "COMPLETED");

  if (completedReviews.length === 0) {
    return { ok: false, mode: "live", doi: null, recordUrl: "", zenodoRecordId: null, message: "No completed reviews to report on yet", rawLog: "" };
  }

  const reportText = renderReviewReportText({
    articleTitle: article.title,
    articleDoi: article.doi,
    reviews: completedReviews,
    authorResponses: authorResponses.map((a) => ({ authorName: a.author.fullName, content: a.content, createdAt: a.createdAt })),
    decisionLetters: decisions.map((d) => ({ editorName: d.editor.fullName, decision: d.decision, letterBody: d.letterBody, publishedAt: d.letterPublishedAt })),
  });

  const journalName = article.journal?.name || "Eleventh Press International Publishing";
  const deposit = await depositArticleToZenodo({
    articleId: article.id,
    title: `Peer Review Report: "${article.title}"`,
    abstract: `Anonymized peer-review report (${completedReviews.length} review${completedReviews.length === 1 ? "" : "s"}) for the article "${article.title}", published by ${journalName} under its transparent Review History policy.`,
    // Reviewer identities are withheld by design (see review-history
    // route), so this record is attributed to the editorial office rather
    // than any named individual — never fabricates authorship.
    creators: [{ name: `${journalName} Editorial Office` }],
    keywords: ["peer review", "open peer review", "transparent review", article.discipline].filter(Boolean),
    license: "CC-BY-4.0",
    journalTitle: journalName,
    journalVolume: article.issue?.volume ? String(article.issue.volume) : undefined,
    journalIssue: article.issue?.issueNumber ? String(article.issue.issueNumber) : undefined,
    publicationDate: new Date().toISOString().slice(0, 10),
    fileBuffer: Buffer.from(reportText, "utf-8"),
    fileName: `review-report-${article.id}.txt`,
    fileContentType: "text/plain",
  });

  await db.article.update({
    where: { id: articleId },
    data: {
      reviewReportDoi: deposit.ok ? deposit.doi : article.reviewReportDoi,
      reviewReportZenodoRecordId: deposit.zenodoRecordId,
      reviewReportDepositedAt: deposit.ok ? new Date() : article.reviewReportDepositedAt,
      reviewReportDepositLog: deposit.rawLog,
    },
  });

  return deposit;
}
