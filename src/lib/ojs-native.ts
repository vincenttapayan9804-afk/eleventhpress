/**
 * PKP OJS "Native XML" export builders.
 *
 * Produces XML matching Open Journal Systems' Native Import/Export plugin
 * format (namespace http://pkp.sfu.ca), so an editor can hand a file to a
 * real OJS installation's Admin -> Native Import/Export plugin, or its CLI
 * (`php tools/importExport.php import <file> <journal_path> <username>`).
 *
 * There is no official prose spec for this format — only PKP's XSD
 * (plugins/importexport/native/native.xsd + pkp-native.xsd, which in turn
 * includes xml/importexport.xsd, all in the pkp/ojs and pkp/pkp-lib repos)
 * and its PHP import filters. The structure below was verified by pulling
 * those three XSD files for OJS `stable-3_4_0` and validating sample output
 * against them with `xmllint --schema` — see docs/ojs-interop.md for the
 * exact sources and for what's still worth re-checking against a different
 * target OJS version before a real import.
 *
 * Key structural fact this schema enforces that's easy to get wrong: an
 * <article> (a "submission") does not carry title/abstract/authors/galleys
 * directly — those all live one level down, inside a nested <publication>
 * element. <article> only carries submission-level bookkeeping (stage,
 * date_submitted, locale) plus one or more <publication> children.
 */
import { parseAuthors } from "@/lib/article";
import type { ArticleStatus } from "@/lib/article";
import { presignGet } from "@/lib/storage";

const OJS_NS = "http://pkp.sfu.ca";
const DEFAULT_LOCALE = "en_US";
const APP_BASE_URL = process.env.APP_BASE_URL || "https://eleventhpress.org";
const CC_BY_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
/**
 * The schema's <identity> type (which <author> extends) requires <email> —
 * it is not optional. EPIP's Article.authors JSON does carry each author's
 * real email, but this export is served unauthenticated and the full-journal
 * variant would aggregate every published author's address into one request
 * — a materially worse exposure than the existing per-article leak in
 * GET /api/articles/[id]. Rather than either propagate real addresses or
 * produce schema-invalid output by omitting a required field, every author
 * gets this placeholder; real addresses are never included.
 */
const REDACTED_EMAIL = "redacted@eleventhpress.org";

/** Maps an EPIP workflow status to the OJS submission "stage" attribute. */
export function mapStatusToOjsStage(
  status: ArticleStatus
): "submission" | "externalReview" | "editorial" | "production" {
  switch (status) {
    case "DRAFT":
    case "SUBMITTED":
      return "submission";
    case "UNDER_REVIEW":
    case "REVISIONS_REQUIRED":
      return "externalReview";
    case "ACCEPTED":
      return "editorial";
    case "IN_PRODUCTION":
    case "PUBLISHED":
    default:
      return "production";
  }
}

/** Slugifies a discipline name into an OJS section reference, e.g. "Computer Science" -> "computer_science". */
export function disciplineToSectionRef(discipline: string): string {
  return (
    (discipline || "general")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "general"
  );
}

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

/** Renders a boolean as the schema's int-typed "1"/"0", not "true"/"false". */
function intBool(b: boolean): "1" | "0" {
  return b ? "1" : "0";
}

function isoDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function absoluteUrl(relativeOrAbsolute: string): string {
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute;
  return `${APP_BASE_URL}${relativeOrAbsolute.startsWith("/") ? "" : "/"}${relativeOrAbsolute}`;
}

/**
 * Builds the <authors> block for one article's <publication>.
 * `<identity>` (the base type <author> extends) requires givenname, email,
 * and the author-level `id`/`seq` attributes — all included here even
 * though EPIP doesn't track a numeric per-author id, since the schema
 * doesn't make them optional. See REDACTED_EMAIL above for the email choice.
 */
function buildAuthorsXml(authorsRaw: string): string {
  const authors = parseAuthors(authorsRaw);
  return authors
    .map((a, i) => {
      const cleanName = (a.name || "").replace(/^Dr\.?\s+|^Prof\.?\s+/, "");
      const parts = cleanName.split(" ").filter(Boolean);
      const givenname = parts.slice(0, -1).join(" ") || cleanName;
      const familyname = parts.length > 1 ? parts.slice(-1).join(" ") : "";
      const orcidXml = a.orcid ? `\n          <orcid>https://orcid.org/${esc(a.orcid)}</orcid>` : "";
      return `        <author id="${i + 1}" seq="${i + 1}" user_group_ref="Author" primary_contact="${i === 0}" include_in_browse="true">
          <givenname locale="${DEFAULT_LOCALE}">${esc(givenname)}</givenname>${
            familyname ? `\n          <familyname locale="${DEFAULT_LOCALE}">${esc(familyname)}</familyname>` : ""
          }
          <affiliation locale="${DEFAULT_LOCALE}">${esc(a.affiliation || "")}</affiliation>
          <email>${esc(REDACTED_EMAIL)}</email>${orcidXml}
        </author>`;
    })
    .join("\n");
}

function buildKeywordsXml(keywordsCsv: string): string {
  const keywords = (keywordsCsv || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (keywords.length === 0) return "";
  return `        <keywords locale="${DEFAULT_LOCALE}">
${keywords.map((k) => `          <keyword>${esc(k)}</keyword>`).join("\n")}
        </keywords>`;
}

/**
 * Builds <article_galley> ("representation") elements. Uses <remote src="…">
 * rather than <submission_file_ref> — the latter only carries a numeric
 * reference to a submission_file imported in the same batch (attribute
 * `id: int`, no href/URL), which doesn't fit a "point at an already-hosted
 * galley" export like this one.
 */
function buildGalleysXml(article: any): string {
  const galleys: string[] = [];
  if (article.galleyPdfKey) {
    galleys.push(
      `        <article_galley approved="true" galley_type="PDF">
          <name locale="${DEFAULT_LOCALE}">PDF</name>
          <seq>1</seq>
          <remote src="${esc(absoluteUrl(presignGet(article.galleyPdfKey)))}"/>
        </article_galley>`
    );
  }
  if (article.galleyHtmlKey) {
    galleys.push(
      `        <article_galley approved="true" galley_type="HTML">
          <name locale="${DEFAULT_LOCALE}">HTML</name>
          <seq>2</seq>
          <remote src="${esc(absoluteUrl(presignGet(article.galleyHtmlKey)))}"/>
        </article_galley>`
    );
  }
  // Note: galleyJatsKey is intentionally not mapped — JATS XML has no clean
  // OJS <article_galley galley_type="..."> equivalent. See docs/ojs-interop.md.
  return galleys.join("\n");
}

/**
 * Builds a standalone <article> element (a "submission") wrapping exactly
 * one <publication>, which is where title/abstract/authors/galleys/DOI
 * actually live per the schema.
 */
export function buildOjsArticleXml(input: { article: any; issue: any; journal: any }): string {
  const { article } = input;
  const sectionRef = disciplineToSectionRef(article.discipline);
  const stage = mapStatusToOjsStage(article.status);
  const dateSubmitted = isoDate(article.submittedAt || article.createdAt);
  const datePublished = isoDate(article.publishedAt);
  const copyrightYear = article.publishedAt
    ? new Date(article.publishedAt).getFullYear()
    : new Date().getFullYear();
  const authors = parseAuthors(article.authors);
  const copyrightHolder = authors[0]?.name || "";

  return `<article xmlns="${OJS_NS}" locale="${DEFAULT_LOCALE}" date_submitted="${dateSubmitted}" stage="${stage}">
      <publication date_submitted="${dateSubmitted}"${
        datePublished ? ` date_published="${datePublished}"` : ""
      } section_ref="${esc(sectionRef)}" seq="1" access_status="1">
        <id type="doi">${esc(article.doi || "")}</id>
        <title locale="${DEFAULT_LOCALE}">${esc(article.title)}</title>
        <abstract locale="${DEFAULT_LOCALE}">${esc(article.abstract)}</abstract>
        <licenseUrl>${esc(CC_BY_LICENSE_URL)}</licenseUrl>
        <copyrightHolder locale="${DEFAULT_LOCALE}">${esc(copyrightHolder)}</copyrightHolder>
        <copyrightYear>${copyrightYear}</copyrightYear>
${buildKeywordsXml(article.keywords)}
        <authors>
${buildAuthorsXml(article.authors)}
        </authors>
${buildGalleysXml(article)}
      </publication>
    </article>`;
}

/** Builds a <section> element for one discipline, declared before <articles>. */
function buildSectionXml(discipline: string): string {
  const ref = disciplineToSectionRef(discipline);
  return `    <section ref="${esc(ref)}" seq="0" editor_restricted="${intBool(false)}" meta_indexed="${intBool(
    true
  )}" meta_reviewed="${intBool(true)}" abstracts_not_required="${intBool(false)}" hide_title="${intBool(
    false
  )}" hide_author="${intBool(false)}">
      <abbrev locale="${DEFAULT_LOCALE}">${esc(ref.toUpperCase().slice(0, 10))}</abbrev>
      <title locale="${DEFAULT_LOCALE}">${esc(discipline)}</title>
    </section>`;
}

/**
 * Builds a single <issue> element with its <sections> (one per distinct
 * discipline among the given articles, declared before <articles> per the
 * schema's child order) and nested <articles>.
 */
export function buildOjsIssueXml(input: { issue: any; articles: any[]; journal: any }): string {
  const { issue, articles, journal } = input;
  const disciplines = Array.from(new Set(articles.map((a) => a.discipline).filter(Boolean)));
  const sectionsXml = disciplines.map(buildSectionXml).join("\n");
  const articlesXml = articles
    .map((a) => buildOjsArticleXml({ article: a, issue, journal }))
    .join("\n");

  return `<issue xmlns="${OJS_NS}" published="${intBool(!!issue.publishedAt)}" current="${intBool(
    false
  )}" access_status="1">
  <issue_identification>
    <volume>${issue.volume}</volume>
    <number>${esc(String(issue.issueNumber))}</number>
    <year>${issue.year}</year>
  </issue_identification>
  <sections>
${sectionsXml || "    <!-- no published articles in this issue -->"}
  </sections>
  <articles>
${articlesXml || "    <!-- no published articles in this issue -->"}
  </articles>
</issue>`;
}

/**
 * Builds the bulk <issues> root wrapping every given issue — the format
 * PKP's admin guide recommends for back-issue / bulk import.
 */
export function buildOjsIssuesExportXml(input: {
  journal: any;
  issues: { issue: any; articles: any[] }[];
}): string {
  const { issues } = input;
  const issuesXml = issues
    .map(({ issue, articles }) => indent(buildOjsIssueXml({ issue, articles, journal: input.journal }), 2))
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- PKP Native XML export — Eleventh Press International Publishing.
     Reverse-engineered from PKP's XSD + community examples (no official
     prose spec exists). Validate against the target OJS version's XSD
     before importing. See docs/ojs-interop.md. -->
<issues xmlns="${OJS_NS}">
${issuesXml}
</issues>`;
}

function indent(xml: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return xml
    .split("\n")
    .map((line) => (line.length ? pad + line : line))
    .join("\n");
}
