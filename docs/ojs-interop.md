# OJS interoperability

EPIP is not, and does not attempt to become, an installation of PKP's Open
Journal Systems (OJS) — OJS is a separate PHP/MySQL application with its own
hosting requirements. What this feature adds is the ability for EPIP to
**export its data in the format a real OJS installation understands**, so an
editor can hand a file to OJS's own import tooling if the journal ever moves
onto (or additionally publishes through) real OJS.

## What was built

- `src/lib/ojs-native.ts` — builds XML matching PKP's **Native XML
  Import/Export** plugin format (`xmlns="http://pkp.sfu.ca"`), for a single
  article, a single issue (with nested articles), or a full bulk journal
  export.
- `GET /api/export/ojs/article/[id]` — one article as a standalone
  `<article>` element.
- `GET /api/export/ojs/issue/[id]` — one issue as an `<issue>` element with
  its published articles nested inside, and per-discipline `<section>`
  declarations.
- `GET /api/export/ojs/journal` — every issue with at least one published
  article, wrapped in an `<issues>` root. This is the shape PKP's own admin
  guide recommends for bulk / back-issue import.
- `GET /api/issues` — a plain JSON list of issues (used to populate the
  issue picker in the dashboard; not OJS-specific).
- A new **"OJS export"** tab under Dashboard → Editorial → Indexing &
  discovery, next to the existing Crossref/OAI-PMH tooling.
- Fixes to `GET /api/oai-pmh` so it's spec-correct for any OAI-PMH harvester
  (including one a real OJS instance might run): `GetRecord` now returns a
  single record instead of incorrectly reusing the `ListRecords` wrapper,
  honors the `identifier` parameter, `ListMetadataFormats` is implemented
  (was missing entirely), and `from`/`until` selective harvesting is
  supported.

## How to actually import into a real OJS instance

1. Download an export — either one issue (`/api/export/ojs/issue/[id]`,
   also reachable from the "OJS export" dashboard tab) or the full journal
   (`/api/export/ojs/journal`).
2. In OJS: **Administration → Import/Export → Native XML Plugin → Import**,
   upload the file, and follow the plugin's mapping prompts. Or, from the
   OJS server's command line:
   ```
   php tools/importExport.php import <file> <journal_path> <username>
   ```

## Schema provenance — read before trusting this blindly

PKP does not publish a prose specification for the Native XML format. This
implementation was built from:

- The schema files themselves: [`native.xsd`](https://github.com/pkp/ojs/blob/main/plugins/importexport/native/native.xsd)
  (app-specific, in `pkp/ojs`) and [`pkp-native.xsd`](https://github.com/pkp/pkp-lib/blob/main/plugins/importexport/native/pkp-native.xsd)
  (shared base, in `pkp/pkp-lib`) — both version-pinned per OJS release
  (e.g. `stable-3_4_0`), not a single stable URL.
- PKP's admin guide entry on [data import/export](https://github.com/pkp/pkp-docs/blob/main/admin-guide/en/data-import-and-export.md),
  which confirms the Native XML Plugin as the preferred bulk-import route
  and documents the CLI command, and notes that files exported from one
  major OJS version may not import cleanly into a different one.
- Community example files: [`gontsa/ojs3-import-xml-template`](https://github.com/gontsa/ojs3-import-xml-template),
  [`knaw-huc/ojs-tools`](https://github.com/knaw-huc/ojs-tools).
- A migration case study: [Code4Lib Journal — Digital Commons → OJS via native XML](https://journal.code4lib.org/articles/15988).

**Before a real import**, pull the `native.xsd`/`pkp-native.xsd` pair for
your actual target OJS version and validate a sample export against it
(`xmllint --noout --schema pkp-native.xsd <file>`). Community forum threads
document recurring schema/import bugs across OJS versions, so don't assume
correctness from this document alone.

## Deliberate omissions and known caveats

- **Author `<email>` is omitted from every export.** EPIP's `Article.authors`
  JSON includes each author's email, but this export is served from
  unauthenticated routes (consistent with `/api/crossref/xml/[id]`, which
  makes the same choice). The full-journal export in particular aggregates
  every published author across the whole journal into one request, which
  would make an existing pre-existing exposure meaningfully worse — see
  below — so email is left out entirely rather than gated behind a flag.
- **`galleyJatsKey` is not exported as an `<article_galley>`.** Only PDF and
  HTML galleys map cleanly onto OJS's standard galley types; JATS XML has no
  clean OJS-side equivalent, so it's left out rather than guessed at.
- **Galley `<href>` links will 404 until a pre-existing gap is closed.**
  `presignGet()` in `src/lib/storage.ts` builds URLs pointing at
  `/api/storage/download`, which does not exist yet anywhere in this
  codebase (a gap identified separately, before this feature was built).
  The generated XML is structurally correct regardless, but the galley
  links inside it won't resolve until that route is implemented.
- **Pre-existing, unrelated exposure, not fixed here:** `GET
  /api/articles/[id]` already returns full author objects — including
  email — with no authentication check, for any single article by ID. This
  feature does not fix that; it was scoped to OJS interoperability only.
