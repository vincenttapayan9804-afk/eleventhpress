# Standards this platform implements against

Sources for the specific structural choices in the corrections/retractions
workflow (`prisma/schema.prisma`'s `Correction` model, `Article.integrityStatus`),
ROR, and CRediT support — kept here rather than scattered across code comments
so they're easy to re-check against a future standards revision.

## Corrections, errata, expressions of concern, retractions

Per COPE's Retraction Guidelines and the ICMJE Recommendations:

- **Corrigendum** — addresses an error introduced by the author(s).
- **Erratum** — addresses an error introduced by the publisher/production process.
- **Expression of Concern** — signals unresolved doubt about a paper's
  reliability while an investigation is pending; not a final finding.
- **Retraction** — withdraws the findings entirely, for reasons including
  major error, fabrication, falsification, or research misconduct. Titled
  "Retraction: [original title]" and signed by the authors and/or editor.

Sources:
- COPE Retraction Guidelines — https://publicationethics.org/guidance/guideline/retraction-guidelines
- ICMJE Recommendations, "Scientific Misconduct, Expressions of Concern, and
  Retraction" — https://www.icmje.org/recommendations/browse/publishing-and-editorial-issues/scientific-misconduct-expressions-of-concern-and-retraction.html

## Crossmark

Crossref's Crossmark service registers these updates against the DOI of the
version of record, so a Crossmark button embedded in the article page (and,
per a publisher's Crossmark participation commitment, in the downloaded PDF
itself) alerts a reader to the current status indefinitely — even long after
the PDF was downloaded and disconnected from the live web page.

Source: Crossref Crossmark — https://www.crossref.org/services/crossmark/

## ROR (Research Organization Registry)

A free, CC0-licensed registry of persistent institutional identifiers
(~110,000+ organizations), now the default org-identifier Crossref, DataCite,
and ORCID use in place of free-text affiliation strings.

Source: https://ror.org/about/ ; https://www.crossref.org/community/ror/

## CRediT (Contributor Roles Taxonomy)

A 14-role taxonomy for describing what each author actually contributed
(Conceptualization, Data curation, Formal analysis, ...), formalized as
ANSI/NISO Z39.104-2022, CC-BY licensed, adopted by 50+ publishers.

Source: https://credit.niso.org/ ; https://www.niso.org/standards-committees/credit

## Crossref 5.3.1 XML structural facts (verified against the real XSD, not memory)

`src/lib/crossref.ts`'s XML builders were validated with `xmllint --schema`
against the actual `crossref5.3.1.xsd` fetched from
`gitlab.com/crossref/schema` (schema's current home — it moved off GitHub),
with its full transitive include/import chain resolved (`common5.3.1.xsd`,
`AccessIndicators.xsd`, `fundref.xsd`, `clinicaltrials.xsd`, `relations.xsd`,
and the JATS/MathML module chain that `crossref5.3.1.xsd` imports even
though this platform's deposits don't use JATS/MathML content directly).
That validation surfaced several structural facts that aren't obvious from
prose documentation:

- **`journal_metadata` has no `<publisher>` element.** It only accepts
  `full_title`, `abbrev_title`, `issn`, `coden`, `archive_locations`,
  `doi_data` — Crossref infers the publisher from the depositor account,
  not from the deposit XML. (`<publisher>` exists in the schema, but only
  for book/conference metadata types.)
- **Author affiliation is a structured container, not free text.**
  `<person_name>` takes `<affiliations><institution><institution_name>...
  </institution_name><institution_id type="ror">https://ror.org/...
  </institution_id></institution></affiliations>` — positioned *before*
  `<ORCID>`, not after. `institution_id`'s `type` attribute is one of
  `ror` | `isni` | `wikidata`.
- **The abstract is a JATS-namespaced element, not a Crossref one.**
  `<jats:abstract><jats:p>...</jats:p></jats:abstract>` (namespace
  `http://www.ncbi.nlm.nih.gov/JATS1`, declared as `xmlns:jats` on the
  `<doi_batch>` root), positioned in `journal_article` right after
  `</contributors>` and before `<publication_date>`.
- **`<crossmark>` and the AccessIndicators `<program>` block are mutually
  exclusive** — `journal_article`'s content model puts them in an
  `xsd:choice`, confirming the design in `buildCrossmarkUpdateXml`: a
  correction/retraction re-deposit omits the license/free-to-read block
  rather than risk sending both.
- **`AccessIndicators.xsd`'s `<free_to_read>` takes no child elements** —
  `start_date`/`end_date` are attributes, not nested elements.
  **`<license_ref>`'s URL is the element's own text content**, not a
  nested `<URI>` — `start_date` and `applies_to` are attributes.
