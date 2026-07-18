# Public API

The machine-readable reference is `/openapi.json` (OpenAPI 3.0.3, validated
against the real schema — see `public/openapi.json`), linked from the site
footer as "API documentation". It documents the endpoints meant for
third-party/programmatic consumption:

- `/api/articles`, `/api/articles/{id}` — public article browsing/detail
- `/api/oai-pmh` — OAI-PMH 2.0 (Identify, ListMetadataFormats, ListRecords,
  ListIdentifiers, GetRecord, ListSets)
- `/api/reports/counter*` — COUNTER 5 / SUSHI usage reporting
- `/api/discover` — keyless fan-out search across Crossref, OpenAlex,
  Semantic Scholar, ERIC, PubMed Central, Zenodo, CORE
- `/api/redif*` — ReDIF feed for RePEc/IDEAS/EconPapers
- `/api/export/ojs/*`, `/api/issues` — PKP OJS Native XML export (see
  `docs/ojs-interop.md` for the full import walkthrough)
- `/sitemap.xml`, `/robots.txt`

The dashboard's internal editorial-workflow API (submission, review,
decisions, admin — everything under session auth) is intentionally out of
scope: it's a first-party API for this app's own frontend, not a published
integration surface, and documenting it as one would invite external
callers to depend on routes that can change shape with the UI at any time.

## Versioning

There is currently one implicit, unversioned surface — no `/v1/` prefix
anywhere. This is an honest description of the current state, not a design
recommendation to keep it that way forever: if a documented endpoint's
request/response shape ever needs a breaking change, the plan is to
introduce it at a new path (e.g. `/api/v2/...`) alongside the existing one,
rather than changing this one's behavior under external integrations that
may already depend on it. The OAI-PMH, COUNTER 5, and OJS Native XML
surfaces are additionally constrained by their own external specs (OAI-PMH
2.0, COUNTER 5 Code of Practice, PKP's Native XML schema), which are far
more conservative about breaking changes than this platform's own API would
need to be on its own.
