/**
 * Zenodo Data Deposit Service.
 *
 * Integrates with the Zenodo REST API to deposit research datasets linked
 * to published articles. Mints a separate DOI for each dataset and records
 * the Crossref `isSupplementedBy` relation.
 *
 * API docs: https://developers.zenodo.org/
 *
 * In simulation mode (no ZENODO_TOKEN), creates a local dataset record
 * with a mock DOI so the full UI flow works end-to-end.
 */
import { db } from "@/lib/db";

const ZENODO_API = "https://zenodo.org/api/deposit/depositions";
const ZENODO_SANDBOX_API = "https://sandbox.zenodo.org/api/deposit/depositions";

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
