import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

const BASE_URL = "https://eleventhpress.org/api/oai-pmh";

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
        <repositoryIdentifier>eleventhpress.org</repositoryIdentifier>
        <delimiter>:</delimiter>
        <sampleIdentifier>oai:eleventhpress.org:epip.2024.001</sampleIdentifier>
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
    const candidates = await db.article.findMany({
      where: { status: "PUBLISHED" },
      include: { journal: true, issue: true },
    });
    const article = candidates.find((a) => buildOaiId(a) === identifier);
    if (!article) {
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
    const from = searchParams.get("from");
    const until = searchParams.get("until");
    if ((from && !isValidOaiDate(from)) || (until && !isValidOaiDate(until))) {
      return errorResponse(verb, "badArgument", "from/until must be YYYY-MM-DD or YYYY-MM-DDThh:mm:ssZ");
    }

    const articles = await db.article.findMany({
      where: { status: "PUBLISHED" },
      include: { journal: true, issue: true },
      orderBy: { publishedAt: "desc" },
      take: 100,
    });

    const filtered = articles.filter((a) => {
      const datestamp = (a.publishedAt || a.createdAt).toISOString();
      if (from && datestamp < normalizeOaiDate(from)) return false;
      if (until && datestamp > normalizeOaiDate(until, true)) return false;
      return true;
    });

    if (filtered.length === 0) {
      return errorResponse(verb, "noRecordsMatch", "No records match the given selective-harvesting criteria");
    }

    const records = filtered.map(buildRecordXml).join("\n");
    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="ListRecords" metadataPrefix="oai_dc">${BASE_URL}</request>
  <ListRecords>
${records}
  </ListRecords>
</OAI-PMH>`);
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

function buildOaiId(a: { doi: string | null; id: string }): string {
  return `oai:eleventhpress.org:${a.doi?.replace(/\./g, "/") || a.id}`;
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
      <dc:language>en</dc:language>
      <dc:rights>info:eu-repo/semantics/openAccess</dc:rights>
      </oai_dc:dc>
    </metadata>
  </record>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function xmlResponse(xml: string): NextResponse {
  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
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
