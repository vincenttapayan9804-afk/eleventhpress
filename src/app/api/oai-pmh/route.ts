import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/oai-pmh?verb=Identify
 * GET /api/oai-pmh?verb=ListRecords&metadataPrefix=oai_dc
 *
 * Implements a minimal OAI-PMH 2.0 endpoint exposing published articles as
 * Dublin Core records. Scopus / Web of Science harvesters consume this feed.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const verb = searchParams.get("verb") || "Identify";
  const journal = await db.journal.findFirst();

  if (verb === "Identify") {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="Identify">https://eleventhpress.org/api/oai-pmh</request>
  <Identify>
    <repositoryName>Eleventh Press International Publishing</repositoryName>
    <baseURL>https://eleventhpress.org/api/oai-pmh</baseURL>
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
</OAI-PMH>`;
    return new NextResponse(xml, {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  if (verb === "ListRecords" || verb === "GetRecord") {
    const articles = await db.article.findMany({
      where: { status: "PUBLISHED" },
      include: { journal: true, issue: true, author: true },
      orderBy: { publishedAt: "desc" },
      take: 100,
    });

    const records = articles
      .map((a) => {
        const authors = safeParse(a.authors);
        const authorDc = authors
          .map((au: any) => `      <dc:creator>${escapeXml(au.name)}</dc:creator>`)
          .join("\n");
        const keywords = a.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean)
          .map((k) => `      <dc:subject>${escapeXml(k)}</dc:subject>`)
          .join("\n");
        const oaiId = `oai:eleventhpress.org:${a.doi?.replace(/\./g, "/") || a.id}`;
        const datestamp = a.publishedAt
          ? new Date(a.publishedAt).toISOString()
          : new Date(a.createdAt).toISOString();

        return `  <record>
    <header>
      <identifier>${oaiId}</identifier>
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
    </metadata>
  </record>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="${verb}" metadataPrefix="oai_dc">https://eleventhpress.org/api/oai-pmh</request>
  <ListRecords>
${records}
  </ListRecords>
</OAI-PMH>`;

    return new NextResponse(xml, {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
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

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="ListSets">https://eleventhpress.org/api/oai-pmh</request>
  <ListSets>
${sets}
  </ListSets>
</OAI-PMH>`;
    return new NextResponse(xml, { headers: { "Content-Type": "application/xml" } });
  }

  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="${verb}">https://eleventhpress.org/api/oai-pmh</request>
  <error code="badVerb">Unknown verb: ${escapeXml(verb)}</error>
</OAI-PMH>`,
    { status: 400, headers: { "Content-Type": "application/xml" } }
  );
}

function safeParse(s: string): any[] {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
