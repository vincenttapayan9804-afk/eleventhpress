/**
 * Zenodo Data Deposit Service.
 *
 * Integrates with the Zenodo REST API to deposit research datasets linked
 * to published articles (depositToZenodo) and, separately, to deposit the
 * published article itself (depositArticleToZenodo) — a free, real,
 * permanently-resolving DOI (via DataCite) for journals that don't yet
 * have a paid Crossref membership. Zenodo records are automatically
 * harvested by OpenAIRE and surface in BASE/CORE, so this single free
 * deposit indirectly reaches three of the platform's indexing targets.
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

    // 2. Upload metadata
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

    // 3. Publish
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
        message: `Zenodo create failed: ${createRes.status}`,
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
    const uploadRes = await fetch(`${bucketUrl}/${encodeURIComponent(input.fileName)}?access_token=${token}`, {
      method: "PUT",
      headers: { "Content-Type": input.fileContentType || "application/octet-stream" },
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
        message: `Zenodo file upload failed: ${uploadRes.status}`,
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
        message: `Zenodo metadata failed: ${metadataRes.status}`,
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
        message: `Zenodo publish failed: ${publishRes.status}`,
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
