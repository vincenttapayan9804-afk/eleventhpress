import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { APP_BASE_URL, APP_HOST, ARTICLE_LANGUAGE } from "@/lib/site";

/**
 * GET /api/oai-pmh?verb=Identify
 * GET /api/oai-pmh?verb=ListMetadataFormats
 * GET /api/oai-pmh?verb=ListRecords&metadataPrefix=oai_dc[&from=...&until=...]
 * GET /api/oai-pmh?verb=GetRecord&metadataPrefix=oai_dc&identifier=...
 * GET /api/oai-pmh?verb=ListSets
 *
 * Implements an OAI-PMH 2.0 endpoint exposing published articles as
 * Dublin Core records. Scopus / Web of Science harvesters, and real OJS
 * installations' own harvesting tools, consume feeds shaped like this one.
 */

const BASE_URL = `${APP_BASE_URL}/api/oai-pmh`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const verb = searchParams.get("verb") || "Identify";

  if (verb === "Identify") {
    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="Identify">${BASE_URL}</request>
  <Identify>
    <repositoryName>Eleventh Press International Publishing</repositoryName>
    <baseURL>${BASE_URL}</baseURL>
    <protocolVersion>2.0</protocolVersion>
    <adminEmail>editorial@eleventhpress.org</adminEmail>
    <earliestDatestamp>2021-01-01T00:00:00Z</earliestDatestamp>
    <deletedRecord>persistent</deletedRecord>
    <granularity>YYYY-MM-DDThh:mm:ssZ</granularity>
    <description>
      <oai-identifier xmlns="http://www.openarchives.org/OAI/2.0/oai-identifier"
                      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                      xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai-identifier http://www.openarchives.org/OAI/2.0/oai-identifier.xsd">
        <scheme>oai</scheme>
        <repositoryIdentifier>${APP_HOST}</repositoryIdentifier>
        <delimiter>:</delimiter>
        <sampleIdentifier>oai:${APP_HOST}:epip.2024.001</sampleIdentifier>
      </oai-identifier>
    </description>
  </Identify>
</OAI-PMH>`);
  }

  if (verb === "ListMetadataFormats") {
    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="ListMetadataFormats">${BASE_URL}</request>
  <ListMetadataFormats>
    <metadataFormat>
      <metadataPrefix>oai_dc</metadataPrefix>
      <schema>http://www.openarchives.org/OAI/2.0/oai_dc.xsd</schema>
      <metadataNamespace>http://www.openarchives.org/OAI/2.0/oai_dc/</metadataNamespace>
    </metadataFormat>
  </ListMetadataFormats>
</OAI-PMH>`);
  }

  if (verb === "GetRecord") {
    const identifier = searchParams.get("identifier");
    if (!identifier) {
      return errorResponse(verb, "badArgument", "Missing required argument: identifier");
    }
    const id = parseOaiId(identifier);
    // Direct indexed lookup by primary key, not a full-table scan — safe
    // now that the identifier scheme is reversible (see buildOaiId).
    const article = id
      ? await db.article.findUnique({ where: { id }, include: { journal: true, issue: true } })
      : null;
    if (!article || article.status !== "PUBLISHED") {
      return errorResponse(verb, "idDoesNotExist", `No matching record for identifier: ${identifier}`);
    }
    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="GetRecord" identifier="${escapeXml(identifier)}" metadataPrefix="oai_dc">${BASE_URL}</request>
  <GetRecord>
${buildRecordXml(article)}
  </GetRecord>
</OAI-PMH>`);
  }

  if (verb === "ListRecords") {
    const PAGE_SIZE = 100;
    const tokenParam = searchParams.get("resumptionToken");
    let from = searchParams.get("from");
    let until = searchParams.get("until");
    let cursor: { cv: string; cid: string } | null = null;

    if (tokenParam) {
      // Per OAI-PMH spec, a resumptionToken alone determines the query —
      // any from/until on this request are ignored in favor of what's
      // encoded in the token, so a harvester resuming a session can't
      // accidentally shift the selective-harvesting window mid-harvest.
      const decoded = decodeResumptionToken(tokenParam);
      if (!decoded) {
        return errorResponse(verb, "badResumptionToken", "The resumptionToken is invalid or expired");
      }
      from = decoded.from;
      until = decoded.until;
      cursor = decoded.cv ? { cv: decoded.cv, cid: decoded.cid! } : null;
    }
    if ((from && !isValidOaiDate(from)) || (until && !isValidOaiDate(until))) {
      return errorResponse(verb, "badArgument", "from/until must be YYYY-MM-DD or YYYY-MM-DDThh:mm:ssZ");
    }

    const where: any = { status: "PUBLISHED" };
    if (from || until) {
      where.publishedAt = {};
      if (from) where.publishedAt.gte = new Date(normalizeOaiDate(from));
      if (until) where.publishedAt.lte = new Date(normalizeOaiDate(until, true));
    }
    // Filtering by date range now happens in the indexed query itself
    // (Article.status+publishedAt) instead of loading everything and
    // filtering in JS.
    const queryWhere = cursor
      ? {
          AND: [
            where,
            {
              OR: [
                { publishedAt: { lt: new Date(cursor.cv) } },
                { publishedAt: { equals: new Date(cursor.cv) }, id: { lt: cursor.cid } },
              ],
            },
          ],
        }
      : where;

    const articles = await db.article.findMany({
      where: queryWhere,
      include: { journal: true, issue: true },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE,
    });

    if (articles.length === 0) {
      // Only reachable on a resumptionToken continuation (we only issue a
      // token when a full page was returned) — treated the same as no
      // matching records at all, since <ListRecords> requires at least one
      // <record> child to be valid.
      return errorResponse(verb, "noRecordsMatch", "No records match the given selective-harvesting criteria");
    }

    const completeListSize = await db.article.count({ where });
    const last = articles[articles.length - 1];
    const hasMore = articles.length === PAGE_SIZE;
    const nextToken = hasMore
      ? encodeResumptionToken({
          cv: (last.publishedAt || last.createdAt).toISOString(),
          cid: last.id,
          from,
          until,
        })
      : null;

    const records = articles.map(buildRecordXml).join("\n");
    return xmlResponse(listRecordsXml(records, nextToken, completeListSize));
  }

  if (verb === "ListSets") {
    const disciplines = await db.article.findMany({
      where: { status: "PUBLISHED" },
      select: { discipline: true },
      distinct: ["discipline"],
    });
    const sets = disciplines
      .map((d) => {
        const spec = d.discipline.toLowerCase().replace(/\s+/g, "_");
        return `  <set>
    <setSpec>epip:${spec}</setSpec>
    <setName>${escapeXml(d.discipline)}</setName>
  </set>`;
      })
      .join("\n");

    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="ListSets">${BASE_URL}</request>
  <ListSets>
${sets}
  </ListSets>
</OAI-PMH>`);
  }

  return errorResponse(verb, "badVerb", `Unknown verb: ${verb}`);
}

// ---------------------------------------------------------------------------
// Record building — shared by ListRecords and GetRecord so both verbs stay
// in sync and GetRecord isn't incorrectly wrapped in <ListRecords>.
// ---------------------------------------------------------------------------

// Identifier is the article's own primary key, not a mangled DOI. The
// previous scheme (dots-to-slashes on the DOI) was lossy for any DOI that
// itself contains a slash (e.g. Zenodo/DataCite DOIs like
// "10.5072/zenodo.563298") and couldn't be reversed, which is why
// GetRecord previously had to load every published article and recompute
// buildOaiId() on each one just to find a string match — an O(n) scan on
// every lookup. Using the id directly makes the identifier reversible (see
// parseOaiId) and the lookup a single indexed query. Made pre-launch, before
// any external harvester could have indexed the old scheme.
function buildOaiId(a: { id: string }): string {
  return `oai:${APP_HOST}:${a.id}`;
}

function parseOaiId(identifier: string): string | null {
  const prefix = `oai:${APP_HOST}:`;
  if (!identifier.startsWith(prefix)) return null;
  const id = identifier.slice(prefix.length);
  return id || null;
}

// ---------------------------------------------------------------------------
// ListRecords resumptionToken — a base64url-encoded keyset cursor
// (publishedAt + id, mirroring the same tuple-comparison pagination used by
// /api/articles) plus the original selective-harvesting window, so a
// harvester can page through arbitrarily many records at constant cost per
// page instead of the endpoint silently truncating at a fixed 100 records.
// ---------------------------------------------------------------------------
function encodeResumptionToken(t: { cv: string; cid: string; from: string | null; until: string | null }): string {
  return Buffer.from(JSON.stringify(t)).toString("base64url");
}
function decodeResumptionToken(s: string): { cv: string; cid: string | null; from: string | null; until: string | null } | null {
  try {
    const parsed = JSON.parse(Buffer.from(s, "base64url").toString("utf-8"));
    if (parsed && typeof parsed.cv === "string") return parsed;
  } catch {}
  return null;
}

function listRecordsXml(records: string, resumptionToken: string | null, completeListSize?: number): string {
  const tokenAttrs = completeListSize !== undefined ? ` completeListSize="${completeListSize}"` : "";
  const tokenEl = resumptionToken
    ? `<resumptionToken${tokenAttrs}>${resumptionToken}</resumptionToken>`
    : `<resumptionToken${tokenAttrs}/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="ListRecords" metadataPrefix="oai_dc">${BASE_URL}</request>
  <ListRecords>
${records}
  ${tokenEl}
  </ListRecords>
</OAI-PMH>`;
}

function buildRecordXml(a: any): string {
  const authors = safeParse(a.authors);
  const authorDc = authors
    .map((au: any) => `      <dc:creator>${escapeXml(au.name)}</dc:creator>`)
    .join("\n");
  const keywords = (a.keywords as string)
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => `      <dc:subject>${escapeXml(k)}</dc:subject>`)
    .join("\n");
  const datestamp = a.publishedAt
    ? new Date(a.publishedAt).toISOString()
    : new Date(a.createdAt).toISOString();

  return `  <record>
    <header>
      <identifier>${buildOaiId(a)}</identifier>
      <datestamp>${datestamp}</datestamp>
      <setSpec>epip:${escapeXml(a.discipline.toLowerCase().replace(/\s+/g, "_"))}</setSpec>
    </header>
    <metadata>
      <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"
                 xmlns:dc="http://purl.org/dc/elements/1.1/"
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">
      <dc:title>${escapeXml(a.title)}</dc:title>
${authorDc}
${keywords}
      <dc:description>${escapeXml(a.abstract)}</dc:description>
      <dc:publisher>${escapeXml(a.journal?.publisher || "Eleventh Press International Publishing")}</dc:publisher>
      <dc:date>${new Date(a.publishedAt || a.createdAt).toISOString().split("T")[0]}</dc:date>
      <dc:type>info:eu-repo/semantics/article</dc:type>
      <dc:identifier>https://doi.org/${a.doi}</dc:identifier>
      <dc:source>${escapeXml(a.journal?.name || "")}, ISSN ${a.journal?.issn || ""}, Vol. ${a.issue?.volume || ""}, Iss. ${a.issue?.issueNumber || ""} (${a.issue?.year || ""})</dc:source>
      <dc:language>${ARTICLE_LANGUAGE}</dc:language>
      <dc:rights>info:eu-repo/semantics/openAccess</dc:rights>
      </oai_dc:dc>
    </metadata>
  </record>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Harvesters (Scopus, Web of Science, etc.) re-poll on their own schedule
// and already tolerate eventual consistency — that's the point of OAI-PMH's
// periodic-harvest model — so a short edge cache meaningfully cuts DB load
// from repeat/overlapping harvest runs without harvesters ever noticing.
// Every successful verb response is public and fully determined by the
// query string (verb, resumptionToken, identifier, from/until), so the
// CDN's default per-URL cache key is exactly right — no manual Vary needed.
function xmlResponse(xml: string): NextResponse {
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
    },
  });
}

function errorResponse(verb: string, code: string, message: string): NextResponse {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="${escapeXml(verb)}">${BASE_URL}</request>
  <error code="${code}">${escapeXml(message)}</error>
</OAI-PMH>`,
    { status: 400, headers: { "Content-Type": "application/xml; charset=utf-8" } }
  );
}

/** OAI-PMH selective harvesting dates: either YYYY-MM-DD or a full UTCdatetime. */
function isValidOaiDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z)?$/.test(s);
}

function normalizeOaiDate(s: string, endOfDay = false): string {
  if (s.includes("T")) return s;
  return endOfDay ? `${s}T23:59:59.999Z` : `${s}T00:00:00.000Z`;
}

function safeParse(s: string): any[] {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}
function escapeXml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
