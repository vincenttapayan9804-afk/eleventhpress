/**
 * Crossref deposit service.
 *
 * Builds a full <doi_batch> XML deposit and POSTs it to the Crossref
 * sandbox at https://api.test.crossref.org/deposits using multipart
 * form data with HTTP Basic auth.
 *
 * If the sandbox is unreachable (no network, no credentials), falls
 * back to SIMULATION mode that records what would have been sent
 * so the platform still functions end-to-end in offline environments.
 */

import { parseAuthors } from "@/lib/article";
import { APP_HOST } from "@/lib/site";

const CROSSREF_TEST_ENDPOINT = "https://api.test.crossref.org/deposits";
const CROSSREF_USERNAME = process.env.CROSSREF_USERNAME || "";
const CROSSREF_PASSWORD = process.env.CROSSREF_PASSWORD || "";

/** Returns true when real Crossref credentials are configured. */
export function isLiveMode(): boolean {
  return !!CROSSREF_USERNAME && !!CROSSREF_PASSWORD;
}

export interface CrossrefDepositInput {
  article: any;
  articleUrl: string;
}

export interface CrossrefDepositOutput {
  ok: boolean;
  mode: "sandbox" | "simulation";
  status: number;
  statusText: string;
  responseBody: string;
  endpoint: string;
  batchId: string;
  depositedAt: Date;
  xml: string;
}

/**
 * Build the full <doi_batch> XML for a journal-article deposit.
 * Accepts { article, articleUrl } to match the existing interface.
 * Schema: Crossref 5.3.1
 */
export function buildDoiBatchXml(input: CrossrefDepositInput): string {
  const { article, articleUrl } = input;
  const authors = parseAuthors(article.authors || "[]");
  const batchId = `epip-${article.id?.slice(-12) || Date.now()}-${Date.now()}`;
  const pubDate = article.publishedAt ? new Date(article.publishedAt) : new Date();
  const year = pubDate.getFullYear();
  const month = String(pubDate.getMonth() + 1).padStart(2, "0");
  const day = String(pubDate.getDate()).padStart(2, "0");
  const journal = article.journal || {};
  const issue = article.issue || {};
  const contributorsXml = buildContributorsXml(authors);

  return `<?xml version="1.0" encoding="UTF-8"?>
<doi_batch version="5.3.1" xmlns="http://www.crossref.org/schema/5.3.1"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xmlns:jats="http://www.ncbi.nlm.nih.gov/JATS1"
           xsi:schemaLocation="http://www.crossref.org/schema/5.3.1 http://www.crossref.org/schemas/crossref5.3.1.xsd">
  <head>
    <doi_batch_id>${esc(batchId)}</doi_batch_id>
    <timestamp>${Date.now()}</timestamp>
    <depositor>
      <depositor_name>Eleventh Press International Publishing</depositor_name>
      <email_address>editorial@eleventhpress.org</email_address>
    </depositor>
    <registrant>Eleventh Press International Publishing</registrant>
  </head>
  <body>
    <journal>
      <journal_metadata language="en">
        <full_title>${esc(journal.name || "Eleventh Press International Journal of Multidisciplinary Research")}</full_title>
        <abbrev_title>EPIP Int. J. Multidiscip. Res.</abbrev_title>
        <issn media_type="electronic">${esc(journal.issn || "2945-1138")}</issn>
      </journal_metadata>
      <journal_issue>
        <publication_date media_type="online"><year>${year}</year></publication_date>
        <journal_volume><volume>${issue.volume || 1}</volume></journal_volume>
        <issue>${issue.issueNumber || 1}</issue>
      </journal_issue>
      <journal_article publication_type="full_text" language="en">
        <titles><title>${esc(article.title)}</title></titles>
        <contributors>
${contributorsXml}
        </contributors>
        <jats:abstract><jats:p>${esc(article.abstract || "")}</jats:p></jats:abstract>
        <publication_date media_type="online">
          <month>${month}</month><day>${day}</day><year>${year}</year>
        </publication_date>
        <publisher_item><item_number item_number_type="article-number">${esc(article.doi || "")}</item_number></publisher_item>
        <program xmlns="http://www.crossref.org/AccessIndicators.xsd">
          <free_to_read start_date="${year}-${month}-${day}"/>
          <license_ref start_date="${year}-${month}-${day}" applies_to="vor">https://creativecommons.org/licenses/by/4.0/</license_ref>
        </program>
${buildFundRefXml(article.funders)}
        <doi_data>
          <doi>${esc(article.doi || "")}</doi>
          <resource>${esc(articleUrl)}</resource>
          <collection property="text-mining">
            <item><resource mime_type="application/pdf">${esc(articleUrl)}/pdf</resource></item>
            <item><resource mime_type="text/html">${esc(articleUrl)}</resource></item>
          </collection>
        </doi_data>
      </journal_article>
    </journal>
  </body>
</doi_batch>`;
}

/**
 * Builds <person_name> contributor entries. Per the real Crossref 5.3.1
 * schema (verified against the live XSD, not memory): affiliation is a
 * structured <affiliations><institution> container — a bare <affiliation>
 * text element does not exist in 5.3.1 — and it must be positioned before
 * <ORCID>, not after. See docs/standards.md.
 */
function buildContributorsXml(authors: any[]): string {
  return authors
    .map((a: any, i: number) => {
      const cleanName = (a.name || "").replace(/^Dr\.?\s+|^Prof\.?\s+/, "");
      const parts = cleanName.split(" ");
      const given = parts.slice(0, -1).join(" ");
      const family = parts.slice(-1).join(" ");
      const institutionIdXml = a.rorId
        ? `<institution_id type="ror">https://ror.org/${esc(a.rorId)}</institution_id>`
        : "";
      const affiliationsXml = a.affiliation
        ? `<affiliations><institution><institution_name>${esc(a.affiliation)}</institution_name>${institutionIdXml}</institution></affiliations>`
        : "";
      const orcidXml = a.orcid ? `<ORCID>https://orcid.org/${esc(a.orcid)}</ORCID>` : "";
      return `      <person_name sequence="${i === 0 ? "first" : "additional"}" contributor_role="author">
        <given_name>${esc(given)}</given_name>
        <surname>${esc(family)}</surname>
        ${affiliationsXml}
        ${orcidXml}
      </person_name>`;
    })
    .join("\n");
}

/**
 * Builds the FundRef Registry funding block (Crossref's standard
 * fr:program extension) from Article.funders — a JSON array of
 * { name, id?, awardNumber? } captured at submission (see the "Funders"
 * section of the submit form) but, until now, never actually deposited
 * anywhere: it sat in the database unused. `id`, when present, is a
 * Crossref Funder ID / ROR URI, deposited as <fr:funder_identifier> so
 * FundRef can resolve it to a canonical funder record rather than only
 * ever having free-text funder names on file.
 */
function buildFundRefXml(fundersJson: string | null | undefined): string {
  if (!fundersJson) return "";
  let funders: any[];
  try {
    funders = JSON.parse(fundersJson);
  } catch {
    return "";
  }
  if (!Array.isArray(funders) || funders.length === 0) return "";

  const assertions = funders
    .filter((f) => f?.name)
    .map((f) => {
      const funderIdXml = f.id
        ? `\n            <fr:assertion name="funder_identifier">${esc(f.id)}</fr:assertion>`
        : "";
      const awardXml = f.awardNumber
        ? `\n          <fr:assertion name="award_number">${esc(f.awardNumber)}</fr:assertion>`
        : "";
      return `        <fr:assertion name="fundgroup">
          <fr:assertion name="funder_name">${esc(f.name)}${funderIdXml}</fr:assertion>${awardXml}
        </fr:assertion>`;
    })
    .join("\n");
  if (!assertions) return "";

  return `        <fr:program xmlns:fr="http://www.crossref.org/fundref.xsd" name="fundref">
${assertions}
        </fr:program>`;
}

/**
 * Deposit metadata to Crossref. Attempts the real sandbox first;
 * falls back to SIMULATION mode if no credentials or network failure.
 */
export async function depositToCrossref(
  input: CrossrefDepositInput
): Promise<CrossrefDepositOutput> {
  const { article } = input;
  const xml = buildDoiBatchXml(input);
  return postDepositXml(xml, article.id, article.doi);
}

/**
 * Registers a correction/retraction/erratum/etc. against an already-deposited
 * article's DOI, per Crossref's Crossmark "updates" mechanism — see
 * docs/standards.md for the schema source. This re-deposits the ORIGINAL
 * article's record with a <crossmark> block added, pointing at the DOI of
 * the new correction/retraction notice.
 *
 * The schema (verified directly against Crossref's XSD, not guessed) places
 * <crossmark> in an xsd:choice alongside the AccessIndicators <program>
 * block within <journal_article> — i.e. a single deposit can carry one or
 * the other, not both — so this omits the license/free-to-read <program>
 * block that a normal deposit includes, rather than risk an invalid
 * combination.
 */
export interface CrossmarkUpdateInput {
  article: any; // the ORIGINAL article being updated
  articleUrl: string;
  updateDoi: string; // DOI of the correction/retraction notice
  updateType: "corrigendum" | "erratum" | "expression_of_concern" | "retraction";
  updateDate: Date;
}

export function buildCrossmarkUpdateXml(input: CrossmarkUpdateInput): string {
  const { article, articleUrl, updateDoi, updateType, updateDate } = input;
  const authors = parseAuthors(article.authors || "[]");
  const batchId = `epip-crossmark-${article.id?.slice(-12) || Date.now()}-${Date.now()}`;
  const pubDate = article.publishedAt ? new Date(article.publishedAt) : new Date();
  const year = pubDate.getFullYear();
  const month = String(pubDate.getMonth() + 1).padStart(2, "0");
  const day = String(pubDate.getDate()).padStart(2, "0");
  const journal = article.journal || {};
  const issue = article.issue || {};
  const updateDateStr = updateDate.toISOString().split("T")[0];
  const contributorsXml = buildContributorsXml(authors);

  return `<?xml version="1.0" encoding="UTF-8"?>
<doi_batch version="5.3.1" xmlns="http://www.crossref.org/schema/5.3.1"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xmlns:jats="http://www.ncbi.nlm.nih.gov/JATS1"
           xsi:schemaLocation="http://www.crossref.org/schema/5.3.1 http://www.crossref.org/schemas/crossref5.3.1.xsd">
  <head>
    <doi_batch_id>${esc(batchId)}</doi_batch_id>
    <timestamp>${Date.now()}</timestamp>
    <depositor>
      <depositor_name>Eleventh Press International Publishing</depositor_name>
      <email_address>editorial@eleventhpress.org</email_address>
    </depositor>
    <registrant>Eleventh Press International Publishing</registrant>
  </head>
  <body>
    <journal>
      <journal_metadata language="en">
        <full_title>${esc(journal.name || "Eleventh Press International Journal of Multidisciplinary Research")}</full_title>
        <abbrev_title>EPIP Int. J. Multidiscip. Res.</abbrev_title>
        <issn media_type="electronic">${esc(journal.issn || "2945-1138")}</issn>
      </journal_metadata>
      <journal_issue>
        <publication_date media_type="online"><year>${year}</year></publication_date>
        <journal_volume><volume>${issue.volume || 1}</volume></journal_volume>
        <issue>${issue.issueNumber || 1}</issue>
      </journal_issue>
      <journal_article publication_type="full_text" language="en">
        <titles><title>${esc(article.title)}</title></titles>
        <contributors>
${contributorsXml}
        </contributors>
        <jats:abstract><jats:p>${esc(article.abstract || "")}</jats:p></jats:abstract>
        <publication_date media_type="online">
          <month>${month}</month><day>${day}</day><year>${year}</year>
        </publication_date>
        <publisher_item><item_number item_number_type="article-number">${esc(article.doi || "")}</item_number></publisher_item>
        <crossmark>
          <crossmark_policy>${esc(article.doi || "")}</crossmark_policy>
          <crossmark_domains>
            <crossmark_domain><domain>${esc(APP_HOST)}</domain></crossmark_domain>
          </crossmark_domains>
          <crossmark_domain_exclusive>false</crossmark_domain_exclusive>
          <updates>
            <update type="${updateType}" date="${updateDateStr}">${esc(updateDoi)}</update>
          </updates>
        </crossmark>
        <doi_data>
          <doi>${esc(article.doi || "")}</doi>
          <resource>${esc(articleUrl)}</resource>
          <collection property="text-mining">
            <item><resource mime_type="application/pdf">${esc(articleUrl)}/pdf</resource></item>
            <item><resource mime_type="text/html">${esc(articleUrl)}</resource></item>
          </collection>
        </doi_data>
      </journal_article>
    </journal>
  </body>
</doi_batch>`;
}

export async function depositCrossmarkUpdate(
  input: CrossmarkUpdateInput
): Promise<CrossrefDepositOutput> {
  const xml = buildCrossmarkUpdateXml(input);
  return postDepositXml(xml, input.article.id, input.article.doi);
}

/**
 * Shared POST-to-Crossref-sandbox logic (with SIMULATION fallback) used by
 * both a normal article deposit and a Crossmark update deposit — they only
 * differ in what XML they send.
 */
async function postDepositXml(
  xml: string,
  articleId: string | undefined,
  doi: string | null | undefined
): Promise<CrossrefDepositOutput> {
  const batchId = `epip-${articleId?.slice(-12) || Date.now()}-${Date.now()}`;
  const depositedAt = new Date();

  if (!isLiveMode()) {
    return {
      ok: true,
      mode: "simulation",
      status: 200,
      statusText: "OK (simulated — no Crossref credentials configured)",
      responseBody: JSON.stringify({
        message: "Deposit simulated. Set CROSSREF_USERNAME and CROSSREF_PASSWORD environment variables to deposit to the real sandbox.",
        batchId,
        doi,
        xmlLength: xml.length,
      }),
      endpoint: "simulation://local",
      batchId,
      depositedAt,
      xml,
    };
  }

  try {
    const boundary = `----FormBoundary${Date.now()}`;
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="operation"\r\n\r\ndoMDUpload\r\n`),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="mdFile"; filename="${batchId}.xml"\r\n`),
      Buffer.from(`Content-Type: application/xml\r\n\r\n`),
      Buffer.from(xml),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const auth = Buffer.from(`${CROSSREF_USERNAME}:${CROSSREF_PASSWORD}`).toString("base64");
    const res = await fetch(CROSSREF_TEST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: `Basic ${auth}`,
        "User-Agent": "EPIP-Crossref-Depositor/1.0 (mailto:editorial@eleventhpress.org)",
      },
      body,
    });

    const responseBody = await res.text();
    return {
      ok: res.ok,
      mode: "sandbox",
      status: res.status,
      statusText: res.statusText,
      responseBody,
      endpoint: CROSSREF_TEST_ENDPOINT,
      batchId,
      depositedAt,
      xml,
    };
  } catch (e: any) {
    return {
      ok: true,
      mode: "simulation",
      status: 0,
      statusText: `Network error — simulated: ${e.message}`,
      responseBody: JSON.stringify({ error: e.message, simulatedBatchId: batchId }),
      endpoint: "simulation://network-error",
      batchId,
      depositedAt,
      xml,
    };
  }
}

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}
